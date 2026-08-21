/**
 * Validation monitoring for device ↔ work-zone associations.
 *
 * Runs alongside the matcher (on each event-cache refresh — no separate loop) and
 * answers "are the auto-links trustworthy, and is the pipeline healthy?" using
 * independent cross-checks the matcher itself did not use:
 *
 *  - self-location agreement: many devices embed their own route/direction/milepost
 *    in their name ("SS2426 - I-35 NB @ MM 71.6"). The matcher keyed off the feed's
 *    Route/Direction fields, so the NAME is an independent check on the match.
 *  - message vs zone type: a board reading "REST AREA CLOSED" linked to a generic
 *    construction zone is suspicious (the IPSIR-906 case).
 *  - temporal: the device reported within the zone's active window.
 *  - distance / direction sanity: unusually-far links, or links made without a known
 *    carriageway ("dir both"), are downgraded.
 *
 * Plus feed-health signals (is DMS_View returning data? how many devices are stale?)
 * and coverage (how many work zones actually have a connected device).
 */

// Pull route / NB-SB-EB-WB / milepost out of a device name if present.
function parseSelfLocation(name) {
  const s = String(name || '');
  const out = { route: null, dir: null, mp: null };
  let m = s.match(/\bI[-\s]?(\d{1,3})\b/i); if (m) out.route = `I-${parseInt(m[1], 10)}`;
  else { m = s.match(/\bUS[-\s]?(\d{1,3})\b/i); if (m) out.route = `US-${parseInt(m[1], 10)}`; }
  m = s.match(/\b([NSEW])B\b/i); if (m) out.dir = m[1].toUpperCase();
  m = s.match(/@?\s*MM\s*([\d.]+)/i); if (m) out.mp = parseFloat(m[1]);
  return out;
}

// Does the board's displayed message describe a facility type that clashes with the
// matched zone? Returns null (consistent / can't tell) or a short mismatch reason.
function messageMismatch(msg, event) {
  if (!msg) return null;
  const t = String(msg).toLowerCase();
  const zone = `${event.eventType || ''} ${event.description || ''} ${event.location || ''}`.toLowerCase();
  // Rest-area / facility message but the zone isn't about a rest area.
  if (/rest\s*area|facility/.test(t) && !/rest\s*area|facility/.test(zone)) return 'board says rest-area, zone is not';
  // Ramp/exit-only message but the zone text doesn't mention a ramp/exit.
  if (/exit\s*only|ramp/.test(t) && !/ramp|exit/.test(zone)) return 'board says ramp/exit, zone is not';
  return null;
}

const FAR_M = 800; // links beyond this are plausible but flagged for review

// Validate one match (link or review record; must carry .event).
function validateMatch(rec, device) {
  const checks = {};
  const flags = [];
  const ev = rec.event || {};

  // 1. carriageway known
  checks.directionKnown = !!(device.direction && device.direction !== 'BOTH');
  if (!checks.directionKnown) flags.push('no device direction (carriageway unverified)');

  // 2. distance sanity — prefer true along-road chainage when RAMS resolved it
  const dist = Number.isFinite(rec.chainageM) ? rec.chainageM : rec.distanceM;
  checks.distanceOk = Number.isFinite(dist) && dist <= FAR_M;
  checks.routeConfirmedByRams = !!rec.sameRouteId; // independent RAMS same-ROUTEID confirmation
  if (!checks.distanceOk) flags.push(`far from zone (${dist}m${rec.distance_basis === 'route-measure' ? ' along road' : ''} > ${FAR_M}m)`);

  // 3. temporal (matcher already tags this in reasons)
  checks.inWindow = Array.isArray(rec.reasons) && rec.reasons.includes('within event window');
  if (!checks.inWindow) flags.push('not confirmed within event window');

  // 4. self-location agreement (independent — from the device NAME)
  const self = parseSelfLocation(device.id);
  checks.selfLocationChecked = !!(self.route || self.dir);
  checks.selfRouteAgrees = self.route ? self.route === rec.corridor : null;
  checks.selfDirAgrees = self.dir ? self.dir === (device.direction || '').charAt(0) : null;
  if (checks.selfRouteAgrees === false) flags.push(`self-reported route ${self.route} != matched ${rec.corridor}`);
  if (checks.selfDirAgrees === false) flags.push(`self-reported dir ${self.dir} != feed dir ${device.direction}`);

  // 5. message vs zone type
  const mm = messageMismatch(device.mode && device.mode.pattern, ev);
  checks.messageConsistent = !mm;
  if (mm) flags.push(mm);

  // 6. is the board actually on? a blank/off board isn't actively marking the zone
  checks.deviceOn = !!(device.mode && device.mode.displaying);
  if (!checks.deviceOn) flags.push('board off/blank (not actively marking)');

  // Overall: a route mismatch is a hard fail; other issues warn.
  let status = 'pass';
  if (checks.selfRouteAgrees === false) status = 'fail';
  else if (flags.length) status = 'warn';
  return { device: rec.device, road_event_id: rec.road_event_id, confidence: rec.confidence, status, checks, flags };
}

/**
 * Validate a full match result. `match` = { links, review, unmatched } from the matcher
 * (records carry .event); `devices` = the ingested roster; `iowaEvents` = the events matched.
 * Returns { summary, matches, anomalies }.
 */
function validate(match, devices, iowaEvents, opts = {}) {
  const now = opts.now || Date.now();
  const byId = new Map(devices.map((d) => [d.id, d]));
  const all = [...(match.links || []), ...(match.review || [])];
  const matches = all.map((rec) => validateMatch(rec, byId.get(rec.device) || {}));

  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const m of matches) counts[m.status]++;

  // Feed health
  const stale = devices.filter((d) => {
    const age = d.updated ? now - Date.parse(d.updated) : Infinity;
    return !Number.isFinite(age) || age > 2 * 3600e3;
  }).length;
  const displaying = devices.filter((d) => d.mode && d.mode.displaying).length;

  // Confidence / distance
  const confs = (match.links || []).map((l) => l.confidence).filter(Number.isFinite);
  const avgConfidence = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null;

  // Coverage: how many work zones actually have a connected device.
  const workZones = (iowaEvents || []).filter((e) => /construction|work.?zone|restriction/i.test(`${e.eventType || ''} ${e.type || ''}`));
  const zonesWithDevice = new Set((match.links || []).map((l) => l.road_event_id).filter(Boolean)).size;

  const summary = {
    timestamp: new Date(now).toISOString(),
    feed: {
      ok: devices.length > 0,
      devices: devices.length,
      stale,
      displaying,
      staleShare: devices.length ? +(stale / devices.length).toFixed(2) : null
    },
    matching: {
      autoLinked: (match.links || []).length,
      review: (match.review || []).length,
      unmatched: (match.unmatched || []).length,
      matchRate: devices.length ? +(((match.links || []).length) / devices.length).toFixed(2) : null,
      avgConfidence
    },
    validation: {
      pass: counts.pass,
      warn: counts.warn,
      fail: counts.fail,
      passRate: matches.length ? +(counts.pass / matches.length).toFixed(2) : null
    },
    coverage: {
      workZones: workZones.length,
      zonesWithDevice,
      coverageRate: workZones.length ? +(zonesWithDevice / workZones.length).toFixed(2) : null
    }
  };

  const anomalies = matches.filter((m) => m.status !== 'pass')
    .sort((a, b) => (a.status === 'fail' ? -1 : 1) - (b.status === 'fail' ? -1 : 1));

  return { summary, matches, anomalies };
}

// Append a compact snapshot to a capped rolling trend (in-memory; survives until restart).
function appendTrend(trend, summary, cap = 288) {
  const t = Array.isArray(trend) ? trend : [];
  t.push({
    timestamp: summary.timestamp,
    devices: summary.feed.devices,
    autoLinked: summary.matching.autoLinked,
    matchRate: summary.matching.matchRate,
    avgConfidence: summary.matching.avgConfidence,
    warn: summary.validation.warn,
    fail: summary.validation.fail,
    coverageRate: summary.coverage.coverageRate
  });
  return t.slice(-cap);
}

module.exports = { validate, validateMatch, parseSelfLocation, messageMismatch, appendTrend };

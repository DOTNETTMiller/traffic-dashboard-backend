/**
 * Connected Device ↔ Work Zone Auto-Association
 *
 * Automatically links connected field devices (iCone/Ver-Mac arrow boards,
 * portable DMS, TMA "tractors") to the work-zone event they belong to, replacing
 * the manual eyeball process.
 *
 * Why "nearest device" fails: a connected arrow board is almost never AT the work
 * zone — it sits UPSTREAM in the travel direction (advance-warning / taper), often
 * a quarter to half a mile ahead of the closure, and on a divided highway the two
 * carriageways sit ~100 ft apart. So association is a multi-signal match, not a
 * distance check:
 *   route (normalized) + carriageway direction + proximity to the zone geometry
 *   (snap onto the road-following line, or distance to a point event) + temporal
 *   overlap/freshness + deployment state (displaying & stationary vs in-transit).
 *
 * Output is WZDx-Device-Feed aligned: each matched device carries the event's
 * road_event_id, and each event gets an x_connected_devices[] summary. The match
 * confidence is also usable as a corroboration signal for event-confidence.js.
 */

const turf = require('@turf/turf');

// ---- tuning knobs (metres unless noted) -----------------------------------
const DEFAULTS = {
  maxMatchM: 1600,        // furthest a device can be from the zone and still belong (~1 mi upstream)
  fullSpatialM: 150,      // at/under this the device is effectively on the zone → full spatial credit
  freshnessHours: 2,      // device must have reported within this window to count as "live"
  autoThreshold: 75,      // >= this → auto-link
  reviewThreshold: 60     // [review, auto) → surface for human confirmation, don't silently link
};

// ---- normalizers -----------------------------------------------------------

// "I 380" | "I-380" | "RAMP: I 80E TO 100TH STREET" -> "I-380" / "I-80"
// "US 67" -> "US-67", "IA 122" -> "IA-122". Returns null if no route recognized.
function normalizeRoute(s) {
  if (!s) return null;
  const t = String(s).toUpperCase();
  let m = t.match(/\bI[\s-]?(\d{1,3})\b/);           // interstate first (RAMP strings embed it)
  if (m) return `I-${parseInt(m[1], 10)}`;
  m = t.match(/\bUS[\s-]?(\d{1,3})\b/);
  if (m) return `US-${parseInt(m[1], 10)}`;
  m = t.match(/\b([A-Z]{2})[\s-]?(\d{1,3})\b/);        // state route e.g. IA 122, CA 99
  if (m) return `${m[1]}-${parseInt(m[2], 10)}`;
  return null;
}

// "n" | "Northbound" | "northbound" | "Both" -> 'N' | 'S' | 'E' | 'W' | 'BOTH' | null
function normalizeDir(s) {
  if (!s) return null;
  const t = String(s).trim().toUpperCase();
  if (t.startsWith('BOTH') || t === 'B') return 'BOTH';
  const c = t[0];
  return 'NSEW'.includes(c) ? c : null;
}

// Is the board actively displaying (deployed) vs blank/off (staged/in-transit)?
// iCone exports carry a human-readable msgtext ("Left Chevron, sequential",
// "Double Arrow, flashing", "Caution, Four Corner"); a blank board has none.
function deviceMode(props) {
  const msg = (props.msgtext || props.message || '').trim();
  const displaying = !!msg && !/^blank$|^off$|^none$/i.test(msg);
  return { displaying, pattern: displaying ? msg : null };
}

// Build a normalized device from an iCone/DMS GeoJSON feature (uses lat_/long_,
// which are WGS84, rather than the Web-Mercator geometry).
function deviceFromFeature(f) {
  const p = (f && f.properties) || {};
  const lon = parseFloat(p.long_ ?? p.longitude);
  const lat = parseFloat(p.lat_ ?? p.latitude);
  const name = p.DeviceName || p.deviceName || p.id || 'unknown-device';
  return {
    id: name,
    deviceType: /-\s*AB\b|arrow/i.test(name) ? 'arrow-board' : 'dms',
    rawRoute: p.Route,
    route: normalizeRoute(p.Route),
    direction: normalizeDir(p.Direction),
    coordinates: (Number.isFinite(lon) && Number.isFinite(lat)) ? [lon, lat] : null,
    mode: deviceMode(p),
    updated: p.EditDate || p.updated || null
  };
}

// ---- geometry helper -------------------------------------------------------

// Compass bearing a served travel direction implies (degrees from north).
const DIR_BEARING = { N: 0, E: 90, S: 180, W: 270 };
// Smallest angle between two compass bearings (0..180).
function angleDiff(a, b) { return Math.abs(((a - b + 540) % 360) - 180); }

// Effective distance (km) from a device to an event, plus a reference point on the
// zone (nearest point on the line, or the point event) and whether the device
// falls within the zone's extent (alongside) vs near an end. Handles LineString
// and Point event geometry.
function distanceToEvent(devicePt, event) {
  const g = event.geometry;
  const evPt = event.coordinates || (event.longitude != null ? [event.longitude, event.latitude] : null);
  if (g && g.type === 'LineString' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    const line = turf.lineString(g.coordinates);
    const snap = turf.nearestPointOnLine(line, devicePt, { units: 'kilometers' });
    const perp = snap.properties.dist;                        // perpendicular distance to the line
    // distance to the nearer endpoint (captures a board just off the end of the zone)
    const ends = [g.coordinates[0], g.coordinates[g.coordinates.length - 1]];
    const endDist = Math.min(...ends.map(c => turf.distance(devicePt, turf.point(c), { units: 'kilometers' })));
    // "alongside" if it snaps close to the interior of the line, not just an endpoint
    const alongside = perp <= (DEFAULTS.fullSpatialM / 1000) && perp < endDist;
    return { km: Math.min(perp, endDist), alongside, geom: 'line', ref: snap.geometry.coordinates };
  }
  if (evPt) {
    return { km: turf.distance(devicePt, turf.point(evPt), { units: 'kilometers' }), alongside: false, geom: 'point', ref: evPt };
  }
  return { km: Infinity, alongside: false, geom: 'none', ref: null };
}

// Upstream test (Field Escort's rule): a device is upstream of a zone when traffic
// travelling the served direction passes the device and THEN reaches the zone — i.e.
// the bearing device→zone points roughly the way that traffic is heading. Rejects
// boards the traffic has already gone by (downstream). Returns true if we can't tell
// (unknown/BOTH direction) so those fall through to the distance gate instead.
function isUpstream(deviceCoord, zoneRef, dir) {
  const served = DIR_BEARING[dir];
  if (served == null || !deviceCoord || !zoneRef) return true;   // can't test → don't reject here
  const devToZone = (turf.bearing(turf.point(deviceCoord), turf.point(zoneRef)) + 360) % 360;
  return angleDiff(devToZone, served) <= 100;                    // ~forward hemisphere, with curve slack
}

// ---- scoring ---------------------------------------------------------------

function scoreMatch(device, event, opts) {
  const cfg = { ...DEFAULTS, ...(opts || {}) };
  const reasons = [];

  // Gate 1: route must match.
  const evRoute = normalizeRoute(event.corridor || event.route || event.location);
  if (!device.route || !evRoute || device.route !== evRoute) return null;
  reasons.push(`route ${device.route}`);

  // Gate 2: carriageway direction (reject opposite side; BOTH/unknown pass).
  const evDir = normalizeDir(event.direction);
  let dirScore = 0;
  if (device.direction && evDir) {
    if (device.direction === evDir) { dirScore = 25; reasons.push(`dir ${evDir}`); }
    else if (device.direction === 'BOTH' || evDir === 'BOTH') { dirScore = 12; reasons.push('dir both'); }
    else return null;                                          // opposite carriageway → not a match
  } else {
    reasons.push('dir unknown');                               // no direction info on one side → neutral
  }

  // Gate 3: proximity.
  if (!device.coordinates) return null;
  const d = distanceToEvent(turf.point(device.coordinates), event);
  if (!Number.isFinite(d.km) || d.km * 1000 > cfg.maxMatchM) return null;
  const spatial = 25 * (1 - Math.min(1, (d.km * 1000) / cfg.maxMatchM));
  reasons.push(d.alongside ? `alongside zone (${Math.round(d.km * 1000)}m)` : `${Math.round(d.km * 1000)}m from zone`);

  // Gate 4: upstream (Field Escort rule). A board must sit UPSTREAM of the zone in the
  // served travel direction — reject one the traffic has already passed. Skipped when
  // the device is alongside the zone (it's inside the work area, not an advance board)
  // or when direction is unknown/BOTH.
  const upstreamDir = device.direction && device.direction !== 'BOTH' ? device.direction
    : (evDir && evDir !== 'BOTH' ? evDir : null);
  if (!d.alongside && upstreamDir) {
    if (!isUpstream(device.coordinates, d.ref, upstreamDir)) return null;   // downstream → not this zone's board
    reasons.push('upstream');
  }

  // Temporal: device fresh AND its report overlaps the event's active window.
  let temporal = 0;
  const devMs = device.updated ? Date.parse(device.updated) : NaN;
  const now = Date.now();
  const fresh = Number.isFinite(devMs) && (now - devMs) <= cfg.freshnessHours * 3600e3;
  const startMs = Date.parse(event.startTime || event.startDate || '');
  const endMs = Date.parse(event.endTime || event.endDate || '');
  const inWindow = (!Number.isFinite(startMs) || devMs >= startMs) &&
                   (!Number.isFinite(endMs) || devMs <= endMs);
  if (fresh) { temporal += 5; reasons.push('device live'); }
  else reasons.push('device stale');
  if (fresh && inWindow) reasons.push('within event window');

  // Deployment state: displaying arrow/chevron = actively part of the zone.
  let deploy = 0;
  if (device.mode && device.mode.displaying) { deploy = 5; reasons.push(`displaying: ${device.mode.pattern}`); }

  const confidence = Math.round(40 + dirScore + spatial + temporal + deploy);
  // ref = the point ON the zone the device was matched to (where the link lands).
  return { event, confidence, distanceM: Math.round(d.km * 1000), alongside: d.alongside, fresh, reasons, ref: d.ref };
}

// ---- public API ------------------------------------------------------------

/**
 * Match a batch of devices against a batch of events.
 * Returns { links, review, unmatched } where each link is
 * { device, event_id, confidence, distanceM, reasons }.
 */
function matchDevices(devices, events, opts) {
  const cfg = { ...DEFAULTS, ...(opts || {}) };
  const links = [], review = [], unmatched = [];
  for (const device of devices) {
    let best = null;
    for (const event of events) {
      const s = scoreMatch(device, event, cfg);
      if (s && (!best || s.confidence > best.confidence)) best = s;
    }
    if (!best) { unmatched.push({ device, reason: 'no same-route/direction event within range' }); continue; }
    const eventId = best.event.id || best.event.road_event_id || null;
    const rec = {
      device: device.id,
      deviceType: device.deviceType,
      road_event_id: eventId,
      confidence: best.confidence,
      distanceM: best.distanceM,
      corridor: normalizeRoute(best.event.corridor || best.event.route),
      reasons: best.reasons,
      // WHERE the match was made: the device point, the point on the zone it links
      // to, and a 2-point connector line so the UI can draw exactly where.
      deviceCoord: device.coordinates,
      zoneRef: best.ref || null,
      connector: (device.coordinates && best.ref) ? [device.coordinates, best.ref] : null,
      event: best.event
    };
    if (best.confidence >= cfg.autoThreshold) links.push(rec);
    else if (best.confidence >= cfg.reviewThreshold) review.push(rec);
    else unmatched.push({ device, reason: `best candidate only ${best.confidence}%`, best: rec });
  }
  return { links, review, unmatched };
}

/**
 * Attach match results back onto the events (WZDx-Device-Feed style):
 * event.x_connected_devices = [{ device_id, device_type, confidence }]
 * Only auto-links (>= autoThreshold) are attached; review items are returned separately.
 */
function annotateEvents(events, matchResult) {
  const byEvent = new Map();
  for (const l of matchResult.links) {
    if (!l.road_event_id) continue;
    if (!byEvent.has(l.road_event_id)) byEvent.set(l.road_event_id, []);
    byEvent.get(l.road_event_id).push({ device_id: l.device, device_type: l.deviceType, confidence: l.confidence });
  }
  for (const ev of events) {
    const id = ev.id || ev.road_event_id;
    if (byEvent.has(id)) ev.x_connected_devices = byEvent.get(id);
  }
  return events;
}

// ---- self test -------------------------------------------------------------
// Proves the scoring independent of any live/stale data coincidence.
function selftest() {
  // A ~1.6km I-80 EB work zone (road-following line) near Des Moines.
  const zone = {
    id: 'WZ-TEST-I80-EB', corridor: 'I-80', direction: 'eastbound',
    startTime: new Date(Date.now() - 3600e3).toISOString(),
    endTime: new Date(Date.now() + 6 * 3600e3).toISOString(),
    geometry: { type: 'LineString', coordinates: [[-93.90, 41.60], [-93.88, 41.601], [-93.86, 41.602]] }
  };
  const now = new Date().toISOString();
  const boards = [
    // EB advance board ~400m upstream (west) of the zone start, displaying → should auto-link
    { properties: { DeviceName: '0xAA iCone - AB', Route: 'I 80', Direction: 'e', long_: '-93.9045', lat_: '41.5998',
      msgtext: 'Left Chevron, sequential', EditDate: now } },
    // WB board on the opposite carriageway → must be rejected (wrong direction)
    { properties: { DeviceName: '0xBB iCone - AB', Route: 'I 80', Direction: 'w', long_: '-93.88', lat_: '41.603',
      msgtext: 'Right Chevron, sequential', EditDate: now } },
    // Board on a different route → rejected
    { properties: { DeviceName: '0xCC iCone - AB', Route: 'I 35', Direction: 'n', long_: '-93.61', lat_: '41.60',
      msgtext: 'Double Arrow, flashing', EditDate: now } },
    // EB board DOWNSTREAM (east) of the zone — traffic already passed the zone → rejected by upstream gate
    { properties: { DeviceName: '0xDD iCone - AB', Route: 'I 80', Direction: 'e', long_: '-93.845', lat_: '41.6025',
      msgtext: 'Left Chevron, sequential', EditDate: now } }
  ].map(deviceFromFeature);

  const res = matchDevices(boards, [zone]);
  console.log('SELFTEST links:', res.links.map(l => `${l.device} -> ${l.road_event_id} @ ${l.confidence}% [${l.reasons.join(', ')}]`));
  console.log('SELFTEST review:', res.review.length, '| unmatched:', res.unmatched.map(u => u.device.id));
  const ok = res.links.length === 1 && res.links[0].device.includes('0xAA') && res.links[0].confidence >= DEFAULTS.autoThreshold;
  console.log(ok ? '✅ selftest PASS' : '❌ selftest FAIL');
  return ok;
}

module.exports = {
  normalizeRoute, normalizeDir, deviceMode, deviceFromFeature,
  distanceToEvent, scoreMatch, matchDevices, annotateEvents, selftest, DEFAULTS
};

if (require.main === module) selftest();

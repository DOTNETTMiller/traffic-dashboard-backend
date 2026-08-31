/**
 * TomTom deviation scorecard — the "what's getting through?" view (Phase 2).
 *
 * Matches DOT work-zone events against TomTom's independent incident feed and buckets them:
 *   - matched     : DOT zone + a TomTom work-zone incident at the same spot  → reaching drivers
 *   - dotOnly     : DOT zone with NO TomTom incident nearby                   → NOT reaching drivers (nav)
 *   - tomtomOnly  : TomTom work-zone incident with no DOT zone nearby         → unreported by the DOT
 *   - timingGaps  : matched spatially but the reported time windows disagree
 *
 * Reuses the corroboration match rule (TomTom cat 7/8/9 within maxM on the same interstate).
 * Read-only: consumes already-cached DOT events + TomTom incidents — no API calls here.
 */

const turf = require('@turf/turf');
const { WORKZONE_CATS } = require('./tomtom-corroboration');
const { isActiveNow } = require('./camera-validation');

// Normalize a route token from any string — Interstate OR US route (state routes → null).
function routeTok(s) {
  const S = String(s || '').toUpperCase();
  let m = S.match(/\bI[-\s]?(\d{1,3})\b/); if (m) return `I-${parseInt(m[1], 10)}`;
  m = S.match(/\bUS[-\s]?(\d{1,3})\b/); if (m) return `US-${parseInt(m[1], 10)}`;
  return null;
}
// The DOT zone's ACTUAL road. Prefer the road the work is ON ("Roadwork on US 206 between … I-287 …"
// → US-206, NOT the cross-street I-287), then any route in the description, then the structured fields.
// The coarse corridor tag is last — it labels adjacent-road work with the parent interstate.
function dotRoute(ev) {
  const desc = String(ev.description || ev.name || '');
  const on = desc.match(/\bon\s+((?:I|IH|US|SR|SH)[-\s]?\d{1,3})/i);
  if (on) { const t = routeTok(on[1]); if (t) return t; }
  return routeTok(desc) || routeTok(ev.route) || routeTok(ev.corridor) || routeTok(ev.location);
}
function incRoute(i) { return routeTok((i.roadNumbers || []).join(' ')) || routeTok(i.description); }
function evPoint(ev) { return ev.coordinates || (ev.longitude != null ? [ev.longitude, ev.latitude] : null); }
// A DOT WORK ZONE (not an incident, DMS status, camera, or "No Report" placeholder). The events
// cache mixes all event kinds; the scorecard compares work zones only.
function isWorkZone(ev) {
  const t = String(ev.eventType || ev.event_type || ev.type || (ev.core_details && ev.core_details.event_type) || '').toLowerCase();
  return /work.?zone|construction|road\s*work|roadwork|maintenance|lane\s*clos/.test(t);
}
function ms(x) { const t = x == null ? null : (typeof x === 'number' ? x : Date.parse(x)); return Number.isFinite(t) ? t : null; }

// Do the DOT zone's and TomTom incident's reported windows disagree by more than tolHours?
function timingDisagrees(ev, inc, tolMs) {
  const dEnd = ms(ev.endDate || ev.end_date || ev.endTime);
  const tEnd = ms(inc.endTime);
  if (dEnd == null || tEnd == null) return false;      // can't judge → not a gap
  return Math.abs(dEnd - tEnd) > tolMs;
}

function scorecard(events, incidents, opts = {}) {
  const tolMs = (opts.timingTolHours || 24) * 3600 * 1000;
  const inc = (incidents || []).filter(i =>
    WORKZONE_CATS.has(Number(i.categoryCode)) && Number.isFinite(i.latitude) && Number.isFinite(i.longitude));
  // DOT-reported set = active WORK-ZONE events with a usable point. Excludes 511 placeholder markers
  // (e.g. "<street>: No Report") that some feeds label as work-zone type but carry no actual closure.
  const isPlaceholder = e => /no report|not reported|no current/i.test(String(e.description || e.name || ''));
  const dotZones = (events || []).filter(e =>
    isActiveNow(e) === true && isWorkZone(e) && !isPlaceholder(e) && Array.isArray(evPoint(e)));

  const matchedIncidentIds = new Set();
  const matched = [], dotOnly = [], timingGaps = [];

  const sameRouteM = opts.maxM || 1200;   // same named road: generous (zone/incident points offset along the road)
  const proxM = opts.proxM || 500;        // road unreadable on one side: fall back to TIGHT proximity only
  for (const ev of dotZones) {
    const evPt = evPoint(ev);
    const evRoute = dotRoute(ev);           // the zone's REAL road (from description), not the corridor tag
    let best = null, bestD = Infinity, bestSame = false;
    for (const i of inc) {
      const iRoute = incRoute(i);
      const same = !!(evRoute && iRoute && evRoute === iRoute);
      // both roads known + different → never (parallel road); same road → generous; one unknown → tight proximity.
      const limit = (evRoute && iRoute) ? (same ? sameRouteM : -1) : proxM;
      if (limit < 0) continue;
      const d = turf.distance(turf.point(evPt), turf.point([i.longitude, i.latitude]), { units: 'meters' });
      if (d > limit) continue;
      if ((same && !bestSame) || (same === bestSame && d < bestD)) { best = i; bestD = d; bestSame = same; }
    }
    if (best) {
      matchedIncidentIds.add(best.id);
      const rec = { id: ev.id, route: evRoute || ev.route || ev.corridor || null, coordinates: evPt,
        state: ev.state || ev.event_state || null, county: ev.county || null,
        endDate: ev.endDate || ev.end_date || ev.endTime || null,
        tomtom: { id: best.id, category: best.category, distance_m: Math.round(bestD) } };
      matched.push(rec);
      if (timingDisagrees(ev, best, tolMs)) timingGaps.push({ ...rec, dotEnd: ev.endDate || ev.end_date || null, tomtomEnd: best.endTime || null });
    } else {
      dotOnly.push({ id: ev.id, route: evRoute || ev.route || ev.corridor || null, coordinates: evPt,
        state: ev.state || ev.event_state || null, county: ev.county || null,
        endDate: ev.endDate || ev.end_date || ev.endTime || null,
        description: ev.description || ev.name || null });
    }
  }

  const tomtomOnly = inc.filter(i => !matchedIncidentIds.has(i.id)).map(i => ({
    id: i.id, route: incRoute(i) || null,
    category: i.category, coordinates: [i.longitude, i.latitude], description: i.description || null, severity: i.severity || null }));

  const denom = matched.length + dotOnly.length;
  const coveragePct = denom ? Math.round((matched.length / denom) * 100) : null;

  const cap = opts.limit || 250;
  return {
    summary: {
      dotZones: dotZones.length,
      tomtomWorkZones: inc.length,
      matched: matched.length,
      dotOnly: dotOnly.length,        // DOT reports it, nav doesn't → not reaching drivers
      tomtomOnly: tomtomOnly.length,  // nav sees it, DOT didn't report → reporting gap
      timingGaps: timingGaps.length,
      coveragePct                     // % of DOT zones nav is also showing
    },
    dotOnly: dotOnly.slice(0, cap),
    tomtomOnly: tomtomOnly.slice(0, cap),
    timingGaps: timingGaps.slice(0, cap),
    matchedSample: matched.slice(0, 25),
    generatedAt: new Date().toISOString()
  };
}

module.exports = { scorecard };

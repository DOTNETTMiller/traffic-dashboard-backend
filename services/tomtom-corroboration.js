/**
 * Independent secondary validation for WZDx work zones using TomTom.
 *
 * TomTom's incident feed is a fully independent, commercial data source — it comes
 * from TomTom's own probe/traffic network, NOT from the state DOT that publishes the
 * WZDx zone. So when a WZDx work zone has a TomTom construction/lane-closed/road-closed
 * incident at the same spot on the same interstate, that's genuine secondary
 * corroboration that the zone is really there.
 *
 * Positive-only (like the camera validator): a match ELEVATES a zone; the absence of a
 * TomTom incident never demotes one (TomTom simply may not report every work zone).
 * Free — reuses the already-cached TomTom incident set; no extra API calls here.
 */

const turf = require('@turf/turf');
const { isActiveNow } = require('./camera-validation');

// TomTom iconCategory codes that indicate a work zone / closure.
//   7 = Lane closed, 8 = Road closed, 9 = Road works
const WORKZONE_CATS = new Set([7, 8, 9]);

function interstate(s) {
  const m = String(s || '').toUpperCase().match(/\bI[-\s]?(\d{1,3})\b/);
  return m ? `I-${parseInt(m[1], 10)}` : null;
}

/**
 * Stamp x_tomtom_corroborated on each event that an independent TomTom work-zone
 * incident confirms within maxM metres on the same interstate.
 * @returns {number} count corroborated
 */
function corroborate(events, incidents, opts = {}) {
  const maxM = opts.maxM || 1500;
  const inc = (incidents || []).filter(i =>
    WORKZONE_CATS.has(Number(i.categoryCode)) &&
    Number.isFinite(i.latitude) && Number.isFinite(i.longitude));
  if (!inc.length) return 0;

  let n = 0;
  for (const ev of (events || [])) {
    if (isActiveNow(ev) !== true) continue;              // only zones WZDx currently claims are active
    const evPt = ev.coordinates || (ev.longitude != null ? [ev.longitude, ev.latitude] : null);
    if (!Array.isArray(evPt)) continue;
    const evRoute = interstate(ev.corridor || ev.route || ev.location);

    let best = null, bestD = Infinity;
    for (const i of inc) {
      // If TomTom names a highway, require the same interstate; otherwise fall back to proximity.
      const iRoute = interstate((i.roadNumbers || []).join(' ')) || interstate(i.description);
      if (evRoute && iRoute && iRoute !== evRoute) continue;
      const d = turf.distance(turf.point(evPt), turf.point([i.longitude, i.latitude]), { units: 'meters' });
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best && bestD <= maxM) {
      ev.x_tomtom_corroborated = true;
      ev.x_tomtom_category = best.category;
      ev.x_tomtom_id = best.id;
      ev.x_tomtom_distance_m = Math.round(bestD);
      if (best.delaySeconds != null) ev.x_tomtom_delay_s = best.delaySeconds;
      if (!ev.x_zone_activity || ev.x_zone_activity === 'suspect-inactive') ev.x_zone_activity = 'confirmed-active';
      n++;
    }
  }
  return n;
}

module.exports = { corroborate, WORKZONE_CATS };

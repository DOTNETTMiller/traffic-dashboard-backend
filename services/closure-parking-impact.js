/**
 * Closure → parking surge impact.
 *
 * For each active major closure / incident on the live event cache, find
 * truck parking facilities within ~50 miles and tag them with a surge
 * risk. The mechanic: trucks running an HOS clock can't continue past a
 * closure; they pull off into the nearest available parking, often
 * filling capacity 30-90 min ahead of when the facility's normal demand
 * pattern would predict.
 *
 * The geographic-radius approach captures both
 *   - directly-affected facilities on the closed corridor
 *   - alternate-route facilities that fill up because trucks divert
 * without needing a corridor-membership data model the parking table
 * doesn't have.
 *
 * Magnitude is reported as a low/medium/high band rather than a fake-
 * precise truck count — the underlying drivers (trucks/hr on the
 * corridor at the moment, time-of-day, HOS distribution) aren't
 * calibrated yet. The direction of the signal (yes/no surge) is
 * confident; the band is honest about precision.
 */

// Trigger filter — only major events generate surges. Minor incidents
// or shoulder closures don't materially affect parking demand.
function isSurgeTrigger(event) {
  const type = String(event.eventType || '').toLowerCase();
  const sev = String(event.severity || event.severityLevel || '').toLowerCase();
  const desc = String(event.description || '').toLowerCase();
  const lanes = String(event.lanesAffected || '').toLowerCase();
  const text = `${desc} ${lanes}`;

  const isClosure = /closure|closed/.test(type) || /road closed|all lanes|fully closed|all-lanes-closed/.test(text);
  const isMajorIncident = /incident|crash|accident|collision/.test(type) && (sev.includes('high') || sev.includes('major') || sev.includes('severe'));
  const isMajorWorkZone = (/work-zone|work zone|construction/.test(type)) && /road closed|all lanes/.test(text);

  return isClosure || isMajorIncident || isMajorWorkZone;
}

// Haversine distance in miles between two lat/lng pairs.
function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Per-event surge-band heuristic. High when the trigger is strong AND
// the facility is close; tapers to low as distance grows.
function bandFor(event, distance) {
  const sev = String(event.severity || event.severityLevel || '').toLowerCase();
  const text = `${event.description || ''} ${event.lanesAffected || ''}`.toLowerCase();
  const allLanes = /road closed|all lanes|fully closed/.test(text);

  // Base intensity from severity + lane scope
  let intensity;
  if (allLanes || sev.includes('high') || sev.includes('major') || sev.includes('severe')) intensity = 3;
  else if (sev.includes('medium') || sev.includes('moderate')) intensity = 2;
  else intensity = 1;

  // Distance taper: 0-15mi keeps full intensity, 15-30mi drops 1 band, 30-50mi drops 2
  if (distance > 30) intensity -= 2;
  else if (distance > 15) intensity -= 1;

  if (intensity >= 3) return 'high';
  if (intensity >= 2) return 'medium';
  if (intensity >= 1) return 'low';
  return null;  // out of range
}

// Combine multiple per-event bands into one — take the worst.
const BAND_RANK = { low: 1, medium: 2, high: 3 };
function maxBand(a, b) {
  if (!a) return b;
  if (!b) return a;
  return BAND_RANK[a] >= BAND_RANK[b] ? a : b;
}

// Crude ETA: distance / 60 mph. Trucks already on the corridor reach
// the facility roughly that fast.
function etaMinutes(distance) {
  return Math.max(5, Math.round((distance / 60) * 60));
}

/**
 * Compute closure → parking impact.
 *
 * @param {Array} events     normalized event records (eventsCache.data.events)
 * @param {Array} facilities parking facility rows (db.getParkingFacilities())
 * @returns {Array<{facility_id, facility_name, latitude, longitude,
 *                  state, capacity, surge_risk: 'low'|'medium'|'high',
 *                  eta_minutes, surging_events: [{event_id, event_type,
 *                  description, distance_miles, band}]}>}
 */
function computeImpact(events, facilities, { radiusMiles = 50 } = {}) {
  const triggers = (events || []).filter(isSurgeTrigger);
  if (triggers.length === 0) return [];
  const out = [];

  for (const f of facilities || []) {
    if (!Number.isFinite(f.latitude) || !Number.isFinite(f.longitude)) continue;

    const surging = [];
    for (const e of triggers) {
      const lat = parseFloat(e.latitude);
      const lng = parseFloat(e.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const d = distanceMiles(f.latitude, f.longitude, lat, lng);
      if (d > radiusMiles) continue;
      const band = bandFor(e, d);
      if (!band) continue;
      surging.push({
        event_id: e.id,
        event_type: e.eventType,
        description: (e.description || '').slice(0, 140),
        corridor: e.corridor || null,
        state: e.state || null,
        distance_miles: Math.round(d * 10) / 10,
        band
      });
    }

    if (surging.length === 0) continue;

    surging.sort((a, b) => a.distance_miles - b.distance_miles);
    const surge_risk = surging.reduce((acc, s) => maxBand(acc, s.band), null);
    const eta_minutes = etaMinutes(surging[0].distance_miles);

    out.push({
      facility_id: f.facilityId || f.id,
      site_id: f.siteId || null,
      state: f.state,
      capacity: f.capacity || 0,
      latitude: f.latitude,
      longitude: f.longitude,
      surge_risk,
      eta_minutes,
      surging_events: surging
    });
  }

  // Sort by risk band (high first) then by ETA
  out.sort((a, b) => {
    const r = BAND_RANK[b.surge_risk] - BAND_RANK[a.surge_risk];
    return r !== 0 ? r : a.eta_minutes - b.eta_minutes;
  });
  return out;
}

module.exports = { computeImpact, isSurgeTrigger, distanceMiles };

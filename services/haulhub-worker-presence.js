/**
 * Independent secondary validation for WZDx work zones using HaulHub worker presence.
 *
 * HaulHub publishes a WZDx v4.1 feed whose every feature carries a `worker_presence`
 * object — `are_workers_present`, a `worker_presence_last_confirmed_date` and a
 * `confidence`. The signal originates in the CONTRACTOR's own systems (crew check-in and
 * heavy-equipment telematics), not in the state DOT's work-zone database, so a match is
 * genuine independent corroboration from a different operational chain than the WZDx zone
 * being validated.
 *
 * It is also the strongest activity evidence any of the validators produce. TomTom infers
 * a work zone from traffic behaviour, a DMS shows what an operator typed, a camera shows
 * cones. This says people were on the ground at that spot, recently, and the contractor's
 * own equipment says so.
 *
 * Shape of the feed, measured rather than assumed (Iowa, 2026-09-08, 84 features):
 *   - every feature is event_type "work-zone" with worker_presence present
 *   - are_workers_present was true on all 84; the feed publishes presence, never absence
 *   - confidence "high" throughout
 *   - each event is a fixed 2.0h window; median age of the confirmation was 0.1h (max 2.3h)
 *   - LineString geometry, stable UUID ids, is_start_position_verified true
 *   - core_details is sparse: no description, no mileposts, no lanes, direction mostly
 *     "unknown", vehicle_impact "unknown". So this source is good for WHERE and WHEN work
 *     is happening and useless for what the closure does — match on geometry and time only.
 *
 * POSITIVE-ONLY, and that is a property of the data, not a choice: because the feed never
 * emits are_workers_present=false, "no match" means "HaulHub has no covered contractor
 * working there", never "nobody is working there". It may elevate a zone; it must never
 * demote one. That makes it safe for the sticky ledger, unlike cameras (which can see that
 * a zone is finished and so must stay demotable).
 */

const turf = require('@turf/turf');
const { isActiveNow } = require('./camera-validation');

// Interchanges are where this can go wrong: a crew on I-35 sits a couple of hundred metres
// from an I-80 zone. When BOTH sides name an interstate and they disagree, proximity is not
// enough. HaulHub's road names are informal ("Ramp Rest Area", "I-380 NB"), so this only
// rejects when both sides actually resolve to a route number.
function interstate(s) {
  const m = String(s || '').toUpperCase().match(/\bI[-\s]?(\d{1,3})\b/);
  return m ? `I-${parseInt(m[1], 10)}` : null;
}

// Per-publisher feeds, found by probing the URL pattern rather than assuming it: HaulHub
// uses TWO shapes -- "{state}_dot_feed" and "{agency}_feed" -- so the name is recorded per
// entry instead of being derived. Adding a publisher is a line here, not a code change.
//
// Probed 2026-09-08 (49 state names x 2 patterns x 2 spec versions). Empty is normal and
// not a dead feed: an event is a 2h activity window, so a feed reads empty whenever no
// covered contractor is on site at that moment.
//   iowa  84 features   Iowa Department of Transportation
//   kytc  30 features   Kentucky Transportation Cabinet
//   maine  0            Maine Department of Transportation
//   mdt    0            Montana Department of Transportation
//   itd    0            Idaho Transportation Department
//   ohio   0            Ohio County Engineer's  (county publisher, not the state DOT)
const FEEDS = {
  ia: 'https://wzdx.e-dot.com/iowa_dot_feed_wzdx_v4.1.geojson',
  ky: 'https://wzdx.e-dot.com/kytc_feed_wzdx_v4.1.geojson',
  me: 'https://wzdx.e-dot.com/maine_dot_feed_wzdx_v4.1.geojson',
  mt: 'https://wzdx.e-dot.com/mdt_feed_wzdx_v4.1.geojson',
  id: 'https://wzdx.e-dot.com/itd_feed_wzdx_v4.1.geojson',
  oh: 'https://wzdx.e-dot.com/ohio_feed_wzdx_v4.1.geojson'
};

// Checked once a day, and lazily: nothing here runs until a corroboration pass asks for it,
// and the first ask of the day is the only fetch.
//
// The tradeoff is deliberate and worth stating: an event in this feed is a 2h activity
// window, so one daily read samples a slice of the day rather than watching it. Same-day
// coverage is therefore sparse by design. What makes that acceptable is the sticky
// validation ledger -- a zone corroborated on any day STAYS corroborated -- so coverage
// accumulates across days instead of being re-won each refresh. Raise the cadence here if
// same-day presence ever matters more than the request cost.
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();   // state -> { at, rows }

function httpsGetJSON(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = require('https').get(url, { timeout: timeoutMs }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', d => { buf += d; });
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

/** Normalise one WZDx feature into the fields this validator needs. */
function toRow(f) {
  const p = f && f.properties;
  const wp = p && p.worker_presence;
  if (!wp || wp.are_workers_present !== true) return null;         // presence only
  const g = f.geometry || {};
  let coords = [];
  if (g.type === 'LineString' && Array.isArray(g.coordinates)) coords = g.coordinates;
  else if (g.type === 'Point' && Array.isArray(g.coordinates)) coords = [g.coordinates];
  coords = coords.filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (!coords.length) return null;
  return {
    id: f.id || null,
    coords,
    roadNames: (p.core_details && p.core_details.road_names) || [],
    confirmedAt: wp.worker_presence_last_confirmed_date || null,
    confidence: wp.confidence || null,
    method: Array.isArray(wp.method) ? wp.method : [],
    start: p.start_date || null,
    end: p.end_date || null
  };
}

/**
 * Fetch worker-presence records for a state (default Iowa). Cached; never throws —
 * a validator that cannot reach its source must not take the request down with it.
 * @returns {Promise<Array>} rows (empty on any failure)
 */
async function fetchPresence(opts = {}) {
  const state = String(opts.state || 'ia').toLowerCase();
  const url = FEEDS[state];
  if (!url) return [];
  const hit = cache.get(state);
  if (hit && (Date.now() - hit.at) < TTL_MS && !opts.force) return hit.rows;
  try {
    const j = await httpsGetJSON(url, opts.timeoutMs);
    const rows = ((j && j.features) || []).map(toRow).filter(Boolean);
    cache.set(state, { at: Date.now(), rows });
    return rows;
  } catch (e) {
    // Serve stale rather than lose the validator on a blip; only give up if we never had any.
    if (hit) return hit.rows;
    console.error('haulhub-worker-presence fetch:', e.message);
    return [];
  }
}

/** Metres from a point to the nearest vertex/segment of a presence LineString. */
function distToRow(evPt, row) {
  if (row.coords.length === 1) {
    return turf.distance(turf.point(evPt), turf.point(row.coords[0]), { units: 'meters' });
  }
  try {
    return turf.pointToLineDistance(turf.point(evPt), turf.lineString(row.coords), { units: 'meters' });
  } catch (_) {
    let best = Infinity;
    for (const c of row.coords) {
      const d = turf.distance(turf.point(evPt), turf.point(c), { units: 'meters' });
      if (d < best) best = d;
    }
    return best;
  }
}

/**
 * Stamp worker-presence corroboration on each active event that a HaulHub presence record
 * confirms within maxM metres.
 *
 * maxM defaults to 500 rather than TomTom's 1500: these are equipment/crew positions with
 * verified start positions, not a traffic-model incident dropped on the nearest link, so a
 * loose radius would hand out credit for work happening on the next road over.
 *
 * @returns {number} count corroborated
 */
function corroborate(events, presence, opts = {}) {
  const maxM = opts.maxM || 500;
  const maxAgeH = opts.maxAgeH || 8;          // ignore a confirmation older than this
  const rows = (presence || []).filter(r => r && r.coords && r.coords.length);
  if (!rows.length) return 0;

  const now = opts.now ? new Date(opts.now).getTime() : Date.now();
  const fresh = rows.filter(r => {
    if (!r.confirmedAt) return true;          // undated: fall back to proximity alone
    const t = Date.parse(r.confirmedAt);
    return !Number.isFinite(t) || (now - t) <= maxAgeH * 3600 * 1000;
  });
  if (!fresh.length) return 0;

  let n = 0;
  for (const ev of (events || [])) {
    if (isActiveNow(ev) !== true) continue;   // only zones WZDx currently claims are active
    const evPt = ev.coordinates || (ev.longitude != null ? [ev.longitude, ev.latitude] : null);
    if (!Array.isArray(evPt) || !Number.isFinite(evPt[0]) || !Number.isFinite(evPt[1])) continue;

    const evRoute = interstate(ev.road || ev.corridor || ev.route || ev.location);
    let best = null, bestD = Infinity;
    for (const r of fresh) {
      const rRoute = interstate((r.roadNames || []).join(' '));
      if (evRoute && rRoute && rRoute !== evRoute) continue;   // different interstate: not this zone
      const d = distToRow(evPt, r);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (best && bestD <= maxM) {
      ev.x_workers_present = true;
      ev.x_worker_presence_source = 'haulhub';
      ev.x_worker_presence_confirmed_at = best.confirmedAt || null;
      ev.x_worker_presence_confidence = best.confidence || null;
      ev.x_haulhub_id = best.id || null;
      ev.x_haulhub_distance_m = Math.round(bestD);
      if (best.roadNames && best.roadNames.length) ev.x_haulhub_road = best.roadNames[0];
      // Crews on the ground is the strongest activity evidence we hold, so it overrides a
      // suspected-inactive verdict from a weaker signal.
      ev.x_zone_activity = 'confirmed-active';
      n++;
    }
  }
  return n;
}

/**
 * Every configured publisher's presence rows in one call, each tagged with its feed key.
 * Publishers are independent documents, so one being down or empty never blocks the rest.
 * @returns {Promise<Array>}
 */
async function fetchAllPresence(opts = {}) {
  const keys = opts.states || Object.keys(FEEDS);
  const out = [];
  const results = await Promise.all(keys.map(k =>
    fetchPresence(Object.assign({}, opts, { state: k })).catch(() => [])));
  results.forEach((rows, i) => {
    for (const r of rows) { r.feed = keys[i]; out.push(r); }
  });
  return out;
}

/** Diagnostics: what each publisher last returned, and when it was last read. */
function stats() {
  const out = {};
  for (const k of Object.keys(FEEDS)) {
    const hit = cache.get(k);
    out[k] = hit ? { rows: hit.rows.length, ageMin: Math.round((Date.now() - hit.at) / 60000) } : null;
  }
  return out;
}

module.exports = { fetchPresence, fetchAllPresence, corroborate, toRow, stats, FEEDS, TTL_MS };

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

// Every HaulHub publisher, found by probing rather than assuming. Three things this cost
// me that are worth not rediscovering:
//   1. The file name is NOT derivable. HaulHub uses "{2-letter}_dot_feed", "{2-letter}_feed",
//      "{state}_dot_feed" AND "{agency}_feed" with no rule connecting them, so every URL is
//      recorded literally.
//   2. "la_dot_feed" is the CITY OF LOS ANGELES, not Louisiana. Louisiana publishes nothing.
//      Keying this by state code would have silently filed LA's crews under Louisiana.
//   3. Ohio has two separate publishers: oh_dot_feed is Ohio DOT (the largest feed of all,
//      134 records) and ohio_feed is the county engineers, a different data_source_id.
// Delaware has no feed under any variant tried.
//
// Counts in brackets are what each returned on 2026-09-08; 18 of the 37 were publishing.
// Empty is not dead -- an event is a 2h activity window, so a feed reads empty whenever no
// covered contractor is on site at that moment.
const FEEDS = {
  oh:        'https://wzdx.e-dot.com/oh_dot_feed_wzdx_v4.1.geojson',  // Ohio Department of Transportation  [134]
  ia:        'https://wzdx.e-dot.com/iowa_dot_feed_wzdx_v4.1.geojson',  // Iowa Department of Transportation  [84]
  ks:        'https://wzdx.e-dot.com/ks_dot_feed_wzdx_v4.1.geojson',  // Kansas Department of Transportation  [31]
  ky:        'https://wzdx.e-dot.com/kytc_feed_wzdx_v4.1.geojson',  // Kentucky Transportation Cabinet  [28]
  ri:        'https://wzdx.e-dot.com/ri_feed_wzdx_v4.1.geojson',  // Rhode Island Department of Transportation  [13]
  md:        'https://wzdx.e-dot.com/md_dot_feed_wzdx_v4.1.geojson',  // Maryland State Highway Administration  [11]
  mo:        'https://wzdx.e-dot.com/mo_dot_feed_wzdx_v4.1.geojson',  // Missouri Department of Transportation  [7]
  mi:        'https://wzdx.e-dot.com/mi_dot_feed_wzdx_v4.1.geojson',  // Michigan Department of Transportation  [4]
  sc:        'https://wzdx.e-dot.com/sc_dot_feed_wzdx_v4.1.geojson',  // South Carolina Department of Transportation  [4]
  al:        'https://wzdx.e-dot.com/al_dot_feed_wzdx_v4.1.geojson',  // Alabama Department of Transportation  [3]
  ga:        'https://wzdx.e-dot.com/ga_feed_wzdx_v4.1.geojson',  // Georgia Department of Transportation  [3]
  ok:        'https://wzdx.e-dot.com/ok_dot_feed_wzdx_v4.1.geojson',  // Oklahoma Department of Transportation  [2]
  va:        'https://wzdx.e-dot.com/va_feed_wzdx_v4.1.geojson',  // Virginia Department of Transportation  [2]
  ar:        'https://wzdx.e-dot.com/ar_dot_feed_wzdx_v4.1.geojson',  // Arkansas Department of Transportation  [1]
  in:        'https://wzdx.e-dot.com/in_feed_wzdx_v4.1.geojson',  // Indiana Department of Transportation  [1]
  nd:        'https://wzdx.e-dot.com/nd_dot_feed_wzdx_v4.1.geojson',  // North Dakota Department of Transportation  [1]
  tn:        'https://wzdx.e-dot.com/tn_feed_wzdx_v4.1.geojson',  // Tennessee Department of Transportation  [1]
  wv:        'https://wzdx.e-dot.com/wv_dot_feed_wzdx_v4.1.geojson',  // West Virginia Department of Transportation  [1]
  ct:        'https://wzdx.e-dot.com/ct_dot_feed_wzdx_v4.1.geojson',  // Connecticut Department of Transportation
  il:        'https://wzdx.e-dot.com/il_feed_wzdx_v4.1.geojson',  // Illinois Department of Transportation
  id:        'https://wzdx.e-dot.com/itd_feed_wzdx_v4.1.geojson',  // Idaho Transportation Department
  me:        'https://wzdx.e-dot.com/maine_dot_feed_wzdx_v4.1.geojson',  // Maine Department of Transportation
  mt:        'https://wzdx.e-dot.com/mdt_feed_wzdx_v4.1.geojson',  // Montana Department of Transportation
  mn:        'https://wzdx.e-dot.com/mn_dot_feed_wzdx_v4.1.geojson',  // Minnesota Department of Transportation
  ms:        'https://wzdx.e-dot.com/ms_dot_feed_wzdx_v4.1.geojson',  // Mississippi Department of Transportation
  nc:        'https://wzdx.e-dot.com/nc_dot_feed_wzdx_v4.1.geojson',  // North Carolina Department of Transportation
  ne:        'https://wzdx.e-dot.com/ne_dot_feed_wzdx_v4.1.geojson',  // Nebraska Department of Transportation
  nh:        'https://wzdx.e-dot.com/nh_dot_feed_wzdx_v4.1.geojson',  // New Hampshire Department of Transportation
  nj:        'https://wzdx.e-dot.com/nj_dot_feed_wzdx_v4.1.geojson',  // New Jersey Department of Transportation
  nm:        'https://wzdx.e-dot.com/nm_dot_feed_wzdx_v4.1.geojson',  // New Mexico Department of Transportation
  nv:        'https://wzdx.e-dot.com/nv_dot_feed_wzdx_v4.1.geojson',  // Nevada Department of Transportation
  or:        'https://wzdx.e-dot.com/or_dot_feed_wzdx_v4.1.geojson',  // Oregon Department of Transportation
  tx:        'https://wzdx.e-dot.com/tx_dot_feed_wzdx_v4.1.geojson',  // Texas Department of Transportation
  wa:        'https://wzdx.e-dot.com/wa_feed_wzdx_v4.1.geojson',  // Washington State Department of Transportation
  wy:        'https://wzdx.e-dot.com/wy_dot_feed_wzdx_v4.1.geojson',  // Wyoming Department of Transportation
  oh_county: 'https://wzdx.e-dot.com/ohio_feed_wzdx_v4.1.geojson',  // Ohio County Engineer's (county, not the state)
  la_city:   'https://wzdx.e-dot.com/la_dot_feed_wzdx_v4.1.geojson'  // City of Los Angeles (NOT Louisiana)
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

/**
 * Metres from a point to a presence geometry.
 *
 * Deliberately allocation-free. The turf version of this (turf.pointToLineDistance on a
 * freshly built turf.lineString, per pair) was called once per event per row -- about 2
 * million times on a full national event set -- and each call rebuilt GeoJSON objects and
 * walked the whole line. Measured at production scale that was 497 SECONDS of synchronous
 * CPU, which is not slowness: it is the entire process wedged, because Node runs this on
 * the same thread as every request, timer and log write. The service went unresponsive with
 * no logs and no crash, and since the restart policy is ON_FAILURE, nothing brought it back.
 *
 * Equirectangular metres are exact enough here -- the comparison radius is 500 m.
 */
function distToRowFast(lon, lat, row) {
  const kx = Math.cos(lat * Math.PI / 180) * 111320, ky = 110540;
  const c = row.coords;
  if (c.length === 1) return Math.hypot((c[0][0] - lon) * kx, (c[0][1] - lat) * ky);
  let best = Infinity;
  for (let i = 0; i < c.length - 1; i++) {
    const ax = (c[i][0] - lon) * kx, ay = (c[i][1] - lat) * ky;
    const bx = (c[i + 1][0] - lon) * kx, by = (c[i + 1][1] - lat) * ky;
    const vx = bx - ax, vy = by - ay;
    const L2 = vx * vx + vy * vy;
    let t = L2 ? -(ax * vx + ay * vy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(ax + t * vx, ay + t * vy);
    if (d < best) { best = d; if (best === 0) return 0; }
  }
  return best;
}

/** Bounding box of a row's coordinates, cached on the row. */
function rowBBox(row) {
  if (row._bbox) return row._bbox;
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const c of row.coords) {
    if (c[0] < minLon) minLon = c[0];
    if (c[0] > maxLon) maxLon = c[0];
    if (c[1] < minLat) minLat = c[1];
    if (c[1] > maxLat) maxLat = c[1];
  }
  row._bbox = { minLon, minLat, maxLon, maxLat };
  return row._bbox;
}

/**
 * Stamp worker-presence corroboration on each active event that a HaulHub presence record
 * confirms within maxM metres.
 *
 * maxM defaults to 500 rather than TomTom's 1500: these are equipment/crew positions with
 * verified start positions, not a traffic-model incident dropped on the nearest link, so a
 * loose radius would hand out credit for work happening on the next road over.
 *
 * Candidate rows come from a grid index rather than a full scan. Only rows whose bounding
 * box is already within maxM of the event are measured precisely, which is behaviour-
 * preserving: a row further than maxM could never have been stamped anyway.
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

  // Grid index. Cell is ~maxM across, so an event only ever has to look at its own cell and
  // the eight around it. A row spanning a lot of cells (a long corridor geometry) goes in a
  // catch-all list instead of being written into thousands of buckets.
  const CELL_DEG = Math.max(maxM / 111320, 0.001);
  const MAX_CELLS_PER_ROW = 400;
  const grid = new Map();
  const sprawling = [];
  const key = (cx, cy) => cx + ':' + cy;
  for (const r of fresh) {
    const b = rowBBox(r);
    const pad = CELL_DEG;
    const x0 = Math.floor((b.minLon - pad) / CELL_DEG), x1 = Math.floor((b.maxLon + pad) / CELL_DEG);
    const y0 = Math.floor((b.minLat - pad) / CELL_DEG), y1 = Math.floor((b.maxLat + pad) / CELL_DEG);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS_PER_ROW) { sprawling.push(r); continue; }
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const k = key(x, y);
      let bucket = grid.get(k);
      if (!bucket) grid.set(k, bucket = []);
      bucket.push(r);
    }
  }

  let n = 0;
  for (const ev of (events || [])) {
    if (isActiveNow(ev) !== true) continue;   // only zones WZDx currently claims are active
    const evPt = ev.coordinates || (ev.longitude != null ? [ev.longitude, ev.latitude] : null);
    if (!Array.isArray(evPt) || !Number.isFinite(evPt[0]) || !Number.isFinite(evPt[1])) continue;
    const [lon, lat] = evPt;

    const cand = grid.get(key(Math.floor(lon / CELL_DEG), Math.floor(lat / CELL_DEG)));
    if (!cand && !sprawling.length) continue;

    const evRoute = interstate(ev.road || ev.corridor || ev.route || ev.location);
    let best = null, bestD = Infinity;
    const consider = (r) => {
      const rRoute = interstate((r.roadNames || []).join(' '));
      if (evRoute && rRoute && rRoute !== evRoute) return;     // different interstate: not this zone
      const d = distToRowFast(lon, lat, r);
      if (d < bestD) { bestD = d; best = r; }
    };
    if (cand) for (const r of cand) consider(r);
    for (const r of sprawling) consider(r);

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

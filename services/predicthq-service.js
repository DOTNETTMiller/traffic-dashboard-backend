/**
 * predicthq-service.js
 * ---------------------------------------------------------------------------
 * Upgrades the major-event map alerts from venue-CAPACITY estimates to real
 * PredictHQ PREDICTED ATTENDANCE — the "how full" number — without changing the
 * map/alert layer. It plugs into ticketmaster-service's setAttendanceProvider().
 *
 * FLOW: pre-fetch PredictHQ events near the corridor venues ONCE into an index
 *   (by local date + location), then expose a SYNC matcher (tmEvent) => number
 *   that ticketmaster-service calls per event during enrichment. One batch of
 *   API calls per refresh, not one-per-event.
 *
 * GATED on PREDICTHQ_API_KEY (paid). Without it, nothing here runs and the
 * major-events feature stays capacity-based.
 *
 * Docs: GET https://api.predicthq.com/v1/events/  (Authorization: Bearer KEY)
 *   params: within=<mi>@<lat>,<lon> · start.gte/.lte=YYYY-MM-DD · category · limit
 *   result fields: title, start_local, phq_attendance, rank, geo.geometry.coordinates ([lon,lat])
 * ---------------------------------------------------------------------------
 */

const axios = require('axios');

const EVENTS_URL = 'https://api.predicthq.com/v1/events/';
// Categories that draw corridor traffic; PredictHQ also covers non-ticketed.
const CATEGORIES = 'concerts,sports,festivals,performing-arts,community,expos';

const haversineMiles = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const dateOnly = (s) => (s ? String(s).slice(0, 10) : null);

/**
 * Build a date→events index from PredictHQ result objects. Pure/testable.
 * @returns {Map<string, Array<{lat,lon,title,attendance,rank}>>}
 */
function buildIndex(results) {
  const index = new Map();
  for (const r of (results || [])) {
    const coords = r?.geo?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lon = Number(coords[0]), lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const date = dateOnly(r.start_local || r.start);
    if (!date) continue;
    const att = Number(r.phq_attendance);
    if (!Number.isFinite(att) || att <= 0) continue; // only useful predictions
    if (!index.has(date)) index.set(date, []);
    index.get(date).push({ lat, lon, title: r.title || '', attendance: att, rank: Number(r.rank) || 0 });
  }
  return index;
}

// Token overlap between two titles (0..1) for tie-breaking same-day/same-place.
function titleScore(a = '', b = '') {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const A = new Set(norm(a)), B = new Set(norm(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

/**
 * Make a sync matcher for setAttendanceProvider. Given a parsed Ticketmaster
 * event ({lat, lon, localDate, date, name}), return the predicted attendance of
 * the best-matching PredictHQ event (same local date, within ~1.5 mi), else null.
 * @param {Map} index from buildIndex()
 * @param {object} [opts] { withinMiles }
 */
function makeMatcher(index, { withinMiles = 1.5 } = {}) {
  return (tmEvent) => {
    if (!tmEvent) return null;
    const date = tmEvent.localDate || dateOnly(tmEvent.date);
    const candidates = index.get(date);
    if (!candidates || !candidates.length) return null;
    const lat = tmEvent.lat, lon = tmEvent.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    let best = null, bestKey = -Infinity;
    for (const c of candidates) {
      const d = haversineMiles(lat, lon, c.lat, c.lon);
      if (d > withinMiles) continue;
      // rank candidates by: closer is better, then title overlap.
      const key = -d + titleScore(tmEvent.name || '', c.title) * 0.25;
      if (key > bestKey) { bestKey = key; best = c; }
    }
    return best ? best.attendance : null;
  };
}

/**
 * Fetch PredictHQ events near each corridor venue and build the attendance
 * index. One paginated-ish call per venue (limit 200), deduped by id.
 * @param {object} opts
 * @param {string} opts.apiKey       PREDICTHQ_API_KEY
 * @param {object[]} opts.venues     [{lat, lon}, ...] (e.g. ticketmaster MAJOR_VENUES)
 * @param {number} [opts.withinDays=120]
 * @param {number} [opts.radiusMiles=20]
 * @param {function} [opts.httpGet]  injectable for tests
 * @returns {Promise<Map>} index for makeMatcher
 */
async function fetchAttendanceIndex({ apiKey, venues, withinDays = 120, radiusMiles = 20, httpGet } = {}) {
  if (!apiKey || !Array.isArray(venues) || !venues.length) return new Map();
  const get = httpGet || ((url, config) => axios.get(url, config).then(r => r.data));
  const now = new Date();
  const end = new Date(now.getTime() + withinDays * 86400000);
  const gte = now.toISOString().slice(0, 10);
  const lte = end.toISOString().slice(0, 10);

  const byId = new Map();
  for (const v of venues) {
    if (!Number.isFinite(v.lat) || !Number.isFinite(v.lon)) continue;
    try {
      const data = await get(EVENTS_URL, {
        params: {
          within: `${radiusMiles}mi@${v.lat},${v.lon}`,
          'start.gte': gte,
          'start.lte': lte,
          category: CATEGORIES,
          limit: 200,
          sort: 'start'
        },
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        timeout: 20000
      });
      for (const r of (data?.results || [])) if (r?.id) byId.set(r.id, r);
    } catch (err) {
      if (process.env.DEBUG_PREDICTHQ) console.error('PredictHQ venue query failed', v.lat, v.lon, err.message);
    }
  }
  return buildIndex(Array.from(byId.values()));
}

module.exports = {
  fetchAttendanceIndex,
  buildIndex,
  makeMatcher,
  titleScore,
  CATEGORIES
};

/**
 * TomTom Traffic Incidents ingest — the "consumer-nav" side of the DOT-vs-nav
 * deviation view ("what's getting through?").
 *
 * Pulls live incidents from TomTom's Traffic Incidents API (v5) for a set of
 * corridor bounding-box tiles, normalizes them into the app's event-ish shape,
 * and (later) gets matched against DOT events to surface reporting gaps.
 *
 * COST SAFEGUARDS (free tier, no credit card on the account):
 *  - Free tier = 2,500 non-tile requests/DAY, hard daily reset. With no card,
 *    exceeding it just returns 4xx — it can NEVER bill.
 *  - On top of that we enforce our own DAILY_BUDGET well under 2,500 and stop
 *    early. Each bbox tile is one request; a scheduled poll covers all tiles.
 *  - bbox max area is 10,000 km² (TomTom limit) — callers must pass corridor
 *    tiles no larger than that.
 *
 * Requires process.env.TOMTOM_API_KEY (set on the Railway service; never commit).
 */

const BASE = 'https://api.tomtom.com/traffic/services/5/incidentDetails';

// Self-imposed daily ceiling — comfortably below TomTom's 2,500/day free cap.
const DAILY_BUDGET = 2300;

// Response fields we ask for (smaller payloads + only what we use).
const FIELDS =
  '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,' +
  'events{description,code,iconCategory},startTime,endTime,from,to,delay,length,' +
  'roadNumbers,probabilityOfOccurrence,numberOfReports,lastReportTime}}}';

// iconCategory -> friendly label (TomTom v5 codes).
const CATEGORY = {
  0: 'Unknown', 1: 'Accident', 2: 'Fog', 3: 'Dangerous conditions', 4: 'Rain',
  5: 'Ice', 6: 'Jam', 7: 'Lane closed', 8: 'Road closed', 9: 'Road works',
  10: 'Wind', 11: 'Flooding', 14: 'Broken-down vehicle'
};

// Map TomTom categories onto the app's eventType vocabulary so a TomTom incident
// can be compared against DOT events of the same kind.
const EVENT_TYPE = {
  1: 'Incident', 14: 'Incident', 6: 'Congestion',
  7: 'Construction', 8: 'Closure', 9: 'Construction',
  2: 'Weather', 4: 'Weather', 5: 'Weather', 10: 'Weather', 11: 'Weather', 3: 'Weather'
};

const MAGNITUDE = { 0: 'unknown', 1: 'minor', 2: 'moderate', 3: 'major', 4: 'undefined' };

// ---- daily request budget (in-memory; resets on UTC date change) ------------
const budget = { date: null, count: 0 };

function today() {
  return new Date().toISOString().slice(0, 10);
}
function budgetRemaining() {
  if (budget.date !== today()) { budget.date = today(); budget.count = 0; }
  return DAILY_BUDGET - budget.count;
}
function spend(n = 1) {
  if (budget.date !== today()) { budget.date = today(); budget.count = 0; }
  budget.count += n;
}

// ---- normalization ----------------------------------------------------------
// A TomTom incident geometry may be a Point or a LineString. Reduce to a single
// [lat, lon] representative point (first coord) plus keep the raw geometry.
function representativePoint(geometry) {
  const c = geometry?.coordinates;
  if (!Array.isArray(c)) return null;
  const pair = geometry.type === 'Point' ? c : c[0];
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const lon = Number(pair[0]);
  const lat = Number(pair[1]);
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
}

function normalizeIncident(feature) {
  const p = feature?.properties || {};
  const ll = representativePoint(feature?.geometry);
  if (!ll) return null;
  const cat = Number(p.iconCategory);
  const description = Array.isArray(p.events) && p.events.length
    ? p.events.map(e => e.description).filter(Boolean).join('; ')
    : (CATEGORY[cat] || 'Incident');

  return {
    id: `TT-${p.id}`,
    source: 'tomtom',
    eventType: EVENT_TYPE[cat] || 'Incident',
    category: CATEGORY[cat] || 'Unknown',
    categoryCode: cat,
    description,
    latitude: ll[0],
    longitude: ll[1],
    geometry: feature.geometry || null,
    from: p.from || null,
    to: p.to || null,
    roadNumbers: Array.isArray(p.roadNumbers) ? p.roadNumbers : [],
    startTime: p.startTime || null,
    endTime: p.endTime || null,
    delaySeconds: Number.isFinite(Number(p.delay)) ? Number(p.delay) : null,
    lengthMeters: Number.isFinite(Number(p.length)) ? Number(p.length) : null,
    severity: MAGNITUDE[Number(p.magnitudeOfDelay)] || 'unknown',
    probability: p.probabilityOfOccurrence || null,
    numberOfReports: Number.isFinite(Number(p.numberOfReports)) ? Number(p.numberOfReports) : null,
    lastReportTime: p.lastReportTime || null
  };
}

// ---- corridor tiling --------------------------------------------------------
// TomTom caps a bbox at 10,000 km², so a corridor is covered by a chain of
// tiles walked along the route polyline. Input `lines` is an array of polylines,
// each an array of [lon, lat] pairs (the shape getCorridorLine() returns).
function bboxOf(pts, padKm) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const [lon, lat] of pts) {
    if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
  }
  const midLat = (minLat + maxLat) / 2;
  const dLat = padKm / 110.574;
  const dLon = padKm / (111.320 * Math.cos(midLat * Math.PI / 180) || 1);
  return [minLon - dLon, minLat - dLat, maxLon + dLon, maxLat + dLat];
}

function bboxAreaKm2([minLon, minLat, maxLon, maxLat]) {
  const midLat = (minLat + maxLat) / 2;
  const w = (maxLon - minLon) * 111.320 * Math.cos(midLat * Math.PI / 180);
  const h = (maxLat - minLat) * 110.574;
  return Math.abs(w * h);
}

// Emit "minLon,minLat,maxLon,maxLat" tiles covering the corridor, each under
// maxAreaKm2 (kept below TomTom's 10,000 hard limit) with a padKm buffer.
function corridorTiles(lines, { maxAreaKm2 = 8000, padKm = 10, maxTiles = 120 } = {}) {
  const tiles = [];
  for (const line of lines || []) {
    if (!Array.isArray(line)) continue;
    let cur = [];
    for (const pt of line) {
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const test = [...cur, pt];
      if (cur.length >= 2 && bboxAreaKm2(bboxOf(test, padKm)) > maxAreaKm2) {
        tiles.push(bboxOf(cur, padKm));
        cur = [pt];
      } else {
        cur.push(pt);
      }
    }
    if (cur.length) tiles.push(bboxOf(cur, padKm));
  }
  return tiles.slice(0, maxTiles).map(b => b.map(n => n.toFixed(5)).join(','));
}

// ---- fetch ------------------------------------------------------------------
// bbox string is "minLon,minLat,maxLon,maxLat".
function incidentUrl(apiKey, bbox) {
  const q = new URLSearchParams({
    key: apiKey,
    bbox,
    fields: FIELDS,
    language: 'en-GB',
    timeValidityFilter: 'present'
  });
  return `${BASE}?${q.toString()}`;
}

/**
 * Fetch + normalize incidents across corridor tiles, honoring the daily budget.
 * @param {object} opts
 * @param {string} opts.apiKey  - TomTom key (from env).
 * @param {string[]} opts.tiles - array of "minLon,minLat,maxLon,maxLat" bboxes.
 * @returns {Promise<{incidents: object[], requests: number, budgetLeft: number, stopped: boolean}>}
 */
async function fetchIncidents({ apiKey, tiles }) {
  if (!apiKey) throw new Error('TOMTOM_API_KEY not set');
  const byId = new Map();
  let requests = 0;
  let stopped = false;

  for (const bbox of tiles) {
    if (budgetRemaining() <= 0) { stopped = true; break; } // guardrail
    spend(1);
    requests++;
    try {
      const resp = await fetch(incidentUrl(apiKey, bbox));
      if (!resp.ok) {
        // 4xx (incl. over-quota with no card) — skip this tile, keep going.
        console.warn(`TomTom incident tile ${bbox} -> HTTP ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      for (const f of data?.incidents || []) {
        const n = normalizeIncident(f);
        if (n) byId.set(n.id, n); // de-dupe incidents that straddle tile edges
      }
    } catch (err) {
      console.warn(`TomTom incident tile ${bbox} failed:`, err.message);
    }
  }

  return {
    incidents: [...byId.values()],
    requests,
    budgetLeft: budgetRemaining(),
    stopped
  };
}

module.exports = {
  fetchIncidents,
  normalizeIncident,
  corridorTiles,
  bboxAreaKm2,
  budgetRemaining,
  CATEGORY,
  EVENT_TYPE,
  DAILY_BUDGET
};

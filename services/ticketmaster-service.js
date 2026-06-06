/**
 * ticketmaster-service.js
 * ---------------------------------------------------------------------------
 * Surfaces LARGE upcoming events near the I-80 / I-35 corridors as map alerts,
 * so DOT ops can anticipate demand surges (game days, concerts, World Cup).
 *
 * SOURCE: Ticketmaster Discovery API (free key, app.ticketmaster.com). The
 *   Discovery API exposes venue lat/long, date, and classification — but NO
 *   ticket-sales volume and NO venue capacity. So "large" is INFERRED:
 *     1. Curated major-venue table (MAJOR_VENUES) with known capacities.
 *     2. Classification = Sports (major-league / college) at large venues.
 *     3. Marquee attractions (2026 FIFA World Cup attractionId 4067734).
 *
 * EXPECTED ATTENDANCE: capacity-based for now (assume a marquee event roughly
 *   fills its venue). Each event carries `expectedAttendance` + `impact` so a
 *   real demand source (PredictHQ Predicted Attendance, or the Ticketmaster
 *   Inventory Status partner API) can drop in later via setAttendanceProvider()
 *   WITHOUT touching the map/alert layer.
 *
 * COST: Discovery allows 5,000 calls/day, 5/sec. We query a handful of curated
 *   corridor venues + the World Cup attraction on a slow cache (hours), so this
 *   is a few calls per refresh — negligible.
 * ---------------------------------------------------------------------------
 */

const axios = require('axios');
const turf = require('@turf/turf');

const DISCOVERY_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';
const WORLD_CUP_ATTRACTION_ID = '4067734'; // 2026 FIFA World Cup (Ticketmaster catalog)

// Curated large venues in the I-80 / I-35 corridor metros, with capacities.
// `corridor` is the trusted tag for these (vetted as corridor-relevant metros).
// An event only inherits a capacity when its venue NAME matches one of these
// (within the same metro) — proximity alone is NOT enough, or a club next to a
// stadium would wrongly inherit the stadium's capacity. `alias` lists alternate
// names Ticketmaster may use for the same venue.
const MAJOR_VENUES = [
  // --- I-80 ---
  { name: 'MetLife Stadium',        city: 'East Rutherford', state: 'NJ', lat: 40.8128, lon: -74.0742, capacity: 82500, corridor: 'I-80' },
  { name: 'Yankee Stadium',         city: 'Bronx',           state: 'NY', lat: 40.8296, lon: -73.9262, capacity: 47309, corridor: 'I-80' },
  { name: 'Citi Field',             city: 'Queens',          state: 'NY', lat: 40.7571, lon: -73.8458, capacity: 41922, corridor: 'I-80' },
  { name: 'Madison Square Garden',  city: 'New York',        state: 'NY', lat: 40.7505, lon: -73.9934, capacity: 20000, corridor: 'I-80' },
  { name: 'Prudential Center',      city: 'Newark',          state: 'NJ', lat: 40.7336, lon: -74.1711, capacity: 16500, corridor: 'I-80' },
  { name: 'Memorial Stadium',       city: 'Lincoln',         state: 'NE', lat: 40.8206, lon: -96.7056, capacity: 85000, corridor: 'I-80', alias: ['Stadium at Memorial'] },
  { name: 'Ohio Stadium',           city: 'Columbus',        state: 'OH', lat: 40.0017, lon: -83.0197, capacity: 102780, corridor: 'I-80' },
  { name: "Levi's Stadium",         city: 'Santa Clara',     state: 'CA', lat: 37.4030, lon: -121.9697, capacity: 68500, corridor: 'I-80' },
  { name: 'Oracle Park',            city: 'San Francisco',   state: 'CA', lat: 37.7786, lon: -122.3893, capacity: 41915, corridor: 'I-80' },
  { name: 'Chase Center',           city: 'San Francisco',   state: 'CA', lat: 37.7680, lon: -122.3877, capacity: 18064, corridor: 'I-80' },
  { name: 'Rice-Eccles Stadium',    city: 'Salt Lake City',  state: 'UT', lat: 40.7600, lon: -111.8485, capacity: 51444, corridor: 'I-80' },
  { name: 'Delta Center',           city: 'Salt Lake City',  state: 'UT', lat: 40.7683, lon: -111.9011, capacity: 18306, corridor: 'I-80' },
  // --- I-35 ---
  { name: 'AT&T Stadium',           city: 'Arlington',       state: 'TX', lat: 32.7473, lon: -97.0945, capacity: 80000, corridor: 'I-35' },
  { name: 'Globe Life Field',       city: 'Arlington',       state: 'TX', lat: 32.7473, lon: -97.0825, capacity: 40300, corridor: 'I-35' },
  { name: 'Cotton Bowl',            city: 'Dallas',          state: 'TX', lat: 32.7790, lon: -96.7593, capacity: 92100, corridor: 'I-35' },
  { name: 'American Airlines Center', city: 'Dallas',        state: 'TX', lat: 32.7905, lon: -96.8103, capacity: 20000, corridor: 'I-35' },
  { name: 'DKR-Texas Memorial Stadium', city: 'Austin',      state: 'TX', lat: 30.2837, lon: -97.7325, capacity: 100119, corridor: 'I-35', alias: ['Darrell K Royal', 'Texas Memorial Stadium'] },
  { name: 'Moody Center',           city: 'Austin',          state: 'TX', lat: 30.2826, lon: -97.7320, capacity: 15000, corridor: 'I-35' },
  { name: 'Q2 Stadium',             city: 'Austin',          state: 'TX', lat: 30.3880, lon: -97.7196, capacity: 20738, corridor: 'I-35' },
  { name: 'Alamodome',              city: 'San Antonio',     state: 'TX', lat: 29.4169, lon: -98.4791, capacity: 64000, corridor: 'I-35' },
  { name: 'Frost Bank Center',      city: 'San Antonio',     state: 'TX', lat: 29.4269, lon: -98.4375, capacity: 18418, corridor: 'I-35' },
  { name: 'Arrowhead Stadium',      city: 'Kansas City',     state: 'MO', lat: 39.0489, lon: -94.4839, capacity: 76416, corridor: 'I-35', alias: ['GEHA Field'] },
  { name: 'Kauffman Stadium',       city: 'Kansas City',     state: 'MO', lat: 39.0517, lon: -94.4803, capacity: 37903, corridor: 'I-35' },
  { name: 'T-Mobile Center',        city: 'Kansas City',     state: 'MO', lat: 39.0944, lon: -94.5814, capacity: 19000, corridor: 'I-35' },
  { name: 'U.S. Bank Stadium',      city: 'Minneapolis',     state: 'MN', lat: 44.9736, lon: -93.2575, capacity: 66655, corridor: 'I-35' },
  { name: 'Target Field',           city: 'Minneapolis',     state: 'MN', lat: 44.9817, lon: -93.2776, capacity: 38544, corridor: 'I-35' },
  { name: 'Target Center',          city: 'Minneapolis',     state: 'MN', lat: 44.9795, lon: -93.2761, capacity: 19356, corridor: 'I-35' },
  { name: 'Huntington Bank Stadium', city: 'Minneapolis',    state: 'MN', lat: 44.9764, lon: -93.2249, capacity: 50805, corridor: 'I-35' },
  { name: 'Paycom Center',          city: 'Oklahoma City',   state: 'OK', lat: 35.4634, lon: -97.5151, capacity: 18203, corridor: 'I-35' }
];

// Ticket-package / non-event noise to drop (not actual gatherings).
const NOISE_RE = /\b(parking|season ticket|ticket package|hospitality|premium seat|suite|pass\b|vip package|meet ?& ?greet)\b/i;

// Minimum inferred crowd to count as a corridor "major event" alert.
const DEFAULT_MIN_ATTENDANCE = 12000;

// Pluggable attendance provider. Default = capacity-based. A caller can swap in
// PredictHQ Predicted Attendance (or TM Inventory Status) without changing the
// alert/map layer: setAttendanceProvider(fn) where fn(event) -> number|null.
let attendanceProvider = null;
function setAttendanceProvider(fn) { attendanceProvider = typeof fn === 'function' ? fn : null; }

// --- geohash encoder (Discovery API geoPoint wants a geohash) ----------------
const GEOHASH_B32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function geohash(lat, lon, precision = 6) {
  let idx = 0, bit = 0, even = true, hash = '';
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (lon > mid) { idx = idx * 2 + 1; lonMin = mid; } else { idx = idx * 2; lonMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat > mid) { idx = idx * 2 + 1; latMin = mid; } else { idx = idx * 2; latMax = mid; }
    }
    even = !even;
    if (++bit === 5) { hash += GEOHASH_B32[idx]; bit = 0; idx = 0; }
  }
  return hash;
}

const haversineMiles = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// Match an event's venue to a curated major venue (→ capacity + trusted
// corridor). NAME-based: the event's venue name must match a curated venue (or
// an alias), AND be in the same metro (≤30 mi) to avoid same-name-different-city
// collisions (e.g. "Memorial Stadium" NE vs IL). Proximity alone is NOT used —
// a club next to a stadium must never inherit the stadium's capacity.
function matchVenue(lat, lon, name = '') {
  const n = (name || '').toLowerCase().trim();
  if (!n) return null;
  for (const v of MAJOR_VENUES) {
    const names = [v.name, ...(v.alias || [])].map(s => s.toLowerCase());
    const nameHit = names.some(vn => n.includes(vn) || vn.includes(n));
    if (!nameHit) continue;
    if (haversineMiles(lat, lon, v.lat, v.lon) <= 30) return v; // same metro
  }
  return null;
}

function impactFor(attendance) {
  if (attendance >= 40000) return 'high';
  if (attendance >= 15000) return 'medium';
  return 'low';
}

// Average load factor (fraction of capacity that actually shows up), by league/
// type — a free stand-in for real predicted attendance. Raw capacity overstates
// regular-season baseball especially; these tweakable factors make the crowd
// estimate (and impact color) far more realistic at zero cost. A PredictHQ
// provider value, when present, overrides all of this.
const FILL_RATES = {
  football: 0.95,    // NFL / college fill large stadiums
  baseball: 0.60,    // MLB regular season averages well below capacity
  basketball: 0.90,
  hockey: 0.90,
  soccer: 0.78,
  music: 0.85,       // major-venue concerts
  theatre: 0.70,
  worldCup: 0.98,    // World Cup matches effectively sell out
  sports: 0.80,      // unspecified sport
  default: 0.75
};

function fillRateFor(ev, isWorldCup) {
  if (isWorldCup) return FILL_RATES.worldCup;
  const g = (ev.genre || '').toLowerCase();
  const seg = (ev.segment || '').toLowerCase();
  if (/football/.test(g)) return FILL_RATES.football;
  if (/baseball/.test(g)) return FILL_RATES.baseball;
  if (/basketball/.test(g)) return FILL_RATES.basketball;
  if (/hockey/.test(g)) return FILL_RATES.hockey;
  if (/soccer/.test(g)) return FILL_RATES.soccer;
  if (seg === 'music') return FILL_RATES.music;
  if (/arts? *& *theat/.test(seg)) return FILL_RATES.theatre;
  if (seg === 'sports') return FILL_RATES.sports;
  return FILL_RATES.default;
}

/**
 * Parse a Discovery API events.json payload → normalized event records.
 * Pure (no network) so it's unit-testable with mock JSON.
 */
function parseEvents(payload) {
  const list = payload?._embedded?.events || [];
  const out = [];
  for (const e of list) {
    const venue = e._embedded?.venues?.[0];
    const loc = venue?.location;
    const lat = loc ? parseFloat(loc.latitude) : NaN;
    const lon = loc ? parseFloat(loc.longitude) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const cls = e.classifications?.[0] || {};
    out.push({
      id: e.id,
      name: e.name,
      url: e.url || null,
      date: e.dates?.start?.dateTime || e.dates?.start?.localDate || null,
      localDate: e.dates?.start?.localDate || null,
      statusCode: e.dates?.status?.code || null,
      segment: cls.segment?.name || null,        // Sports / Music / ...
      genre: cls.genre?.name || null,
      venueName: venue?.name || null,
      city: venue?.city?.name || null,
      state: venue?.state?.stateCode || null,
      lat, lon,
      priceMax: Array.isArray(e.priceRanges) ? Math.max(...e.priceRanges.map(p => p.max || 0)) : null
    });
  }
  return out;
}

/**
 * Enrich + corridor-clip parsed events. Returns only on-corridor major events.
 * @param {object[]} events  from parseEvents()
 * @param {function} getCorridorLine (corridor) => [[ [lon,lat], ... ], ...]
 * @param {object}   opts { bufferMiles, minAttendance }
 */
function enrichAndClip(events, getCorridorLine, { bufferMiles = 25, minAttendance = DEFAULT_MIN_ATTENDANCE } = {}) {
  // Build simplified corridor lines once (turf pointToLineDistance per event).
  const lines = {};
  for (const corridor of ['I-80', 'I-35']) {
    const raw = (getCorridorLine && getCorridorLine(corridor)) || [];
    lines[corridor] = raw
      .filter(c => Array.isArray(c) && c.length >= 2)
      .map(coords => {
        try { return turf.simplify(turf.lineString(coords), { tolerance: 0.01, highQuality: false }); }
        catch { return turf.lineString(coords); }
      });
  }

  const corridorForPoint = (lat, lon, curated) => {
    if (curated?.corridor) return curated.corridor; // trusted curated tag
    let best = null, bestD = Infinity;
    const pt = turf.point([lon, lat]);
    for (const corridor of ['I-80', 'I-35']) {
      for (const ln of lines[corridor]) {
        let d;
        try { d = turf.pointToLineDistance(pt, ln, { units: 'miles' }); } catch { continue; }
        if (d < bestD) { bestD = d; best = corridor; }
      }
    }
    return bestD <= bufferMiles ? best : null;
  };

  const seen = new Set();
  const bySlot = new Map(); // dedupe key (venue|date) → kept record
  for (const ev of events) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);

    // Drop ticket-package / parking / hospitality non-events.
    if (NOISE_RE.test(ev.name || '')) continue;
    // Drop guided venue tours (TM lists them under a "... Stadium Tours" venue);
    // they're small walk-throughs, not full-stadium crowds.
    if (/\btours?\b/i.test(ev.venueName || '')) continue;

    const isWorldCup = /world cup/i.test(ev.name || '') || ev._worldCup;
    const curated = matchVenue(ev.lat, ev.lon, ev.venueName || '');

    // "Large" = a known major venue (real capacity) OR a World Cup match.
    // We deliberately DON'T include every Sports event at unknown venues — that
    // swept in minor-league/theater/club noise and guessed a fake 20k crowd.
    if (!curated && !isWorldCup) continue;

    const corridor = corridorForPoint(ev.lat, ev.lon, curated);
    if (!corridor) continue; // not near a corridor

    // Expected attendance: PredictHQ provider (real prediction) → curated
    // capacity × league fill-rate (free estimate) → World Cup default.
    let expectedAttendance = attendanceProvider ? attendanceProvider(ev) : null;
    let attendanceBasis = expectedAttendance != null ? 'provider' : null;
    let fillRate = null;
    if (expectedAttendance == null && curated) {
      fillRate = fillRateFor(ev, isWorldCup);
      expectedAttendance = Math.round(curated.capacity * fillRate);
      attendanceBasis = 'estimated';
    }
    if (expectedAttendance == null) { expectedAttendance = 65000; attendanceBasis = 'world-cup-default'; }

    const rec = {
      id: ev.id,
      name: ev.name,
      corridor,
      venueName: ev.venueName,
      city: ev.city,
      state: ev.state,
      latitude: ev.lat,
      longitude: ev.lon,
      date: ev.date,
      localDate: ev.localDate,
      category: isWorldCup ? 'World Cup' : (ev.segment || 'Event'),
      genre: ev.genre,
      expectedAttendance,
      attendanceBasis,
      fillRate,
      impact: impactFor(expectedAttendance),
      capacity: curated?.capacity || null,
      statusCode: ev.statusCode,
      url: ev.url,
      source: 'ticketmaster'
    };

    // Collapse ticket-type variants of the same event (same venue + day).
    const slot = `${(ev.venueName || '').toLowerCase()}|${ev.localDate || ev.date}`;
    const prior = bySlot.get(slot);
    if (!prior || (rec.name || '').length < (prior.name || '').length) bySlot.set(slot, rec);
  }

  // Soonest first.
  return Array.from(bySlot.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Build the Discovery query params shared by all calls. */
function baseParams(apiKey, withinDays) {
  const now = new Date();
  const end = new Date(now.getTime() + withinDays * 86400000);
  const iso = (d) => d.toISOString().slice(0, 19) + 'Z';
  return {
    apikey: apiKey,
    startDateTime: iso(now),
    endDateTime: iso(end),
    size: 100,
    sort: 'date,asc',
    countryCode: 'US'
  };
}

/**
 * Fetch large corridor events from Ticketmaster.
 * @param {object} opts
 * @param {string} opts.apiKey            TICKETMASTER_API_KEY
 * @param {function} opts.getCorridorLine geometry provider (same as crash svc)
 * @param {number} [opts.withinDays=90]
 * @param {number} [opts.bufferMiles=25]
 * @param {function} [opts.httpGet]       injectable for tests; default axios.get
 * @returns {Promise<object[]>} on-corridor major events
 */
async function fetchMajorEvents({ apiKey, getCorridorLine, withinDays = 90, bufferMiles = 25, httpGet } = {}) {
  if (!apiKey) return [];
  const get = httpGet || ((url, params) => axios.get(url, { params, timeout: 20000 }).then(r => r.data));
  const base = baseParams(apiKey, withinDays);
  const collected = [];

  // 1) One query per curated corridor venue (geoPoint + radius).
  for (const v of MAJOR_VENUES) {
    try {
      const data = await get(DISCOVERY_URL, { ...base, geoPoint: geohash(v.lat, v.lon, 6), radius: 20, unit: 'miles' });
      collected.push(...parseEvents(data));
    } catch (err) {
      // one venue failing shouldn't abort the whole refresh
      if (process.env.DEBUG_TICKETMASTER) console.error('TM venue query failed', v.name, err.message);
    }
  }

  // 2) The 2026 World Cup attraction (flag matches so they're always "large").
  try {
    const data = await get(DISCOVERY_URL, { ...base, attractionId: WORLD_CUP_ATTRACTION_ID });
    for (const ev of parseEvents(data)) collected.push({ ...ev, _worldCup: true });
  } catch (err) {
    if (process.env.DEBUG_TICKETMASTER) console.error('TM world-cup query failed', err.message);
  }

  return enrichAndClip(collected, getCorridorLine, { bufferMiles });
}

module.exports = {
  fetchMajorEvents,
  setAttendanceProvider,
  // exported for tests / reuse
  parseEvents,
  enrichAndClip,
  geohash,
  matchVenue,
  impactFor,
  MAJOR_VENUES,
  WORLD_CUP_ATTRACTION_ID
};

/**
 * Road-service activity: plow AVL, multi-state winter road conditions, and the mobile
 * plow-cam fleet.
 *
 * WHY. PennDOT's friction study (Penn State, Aug 2026) found that road-service operations --
 * plow activity, treatment material, and time since last service -- were the single largest
 * contributor to friction forecast skill, beating every meteorological variable they tried,
 * and that "never-plowed segments proved the most predictable". Weather alone only weakly
 * determines what the road surface will do next. They reached that with one state's data
 * from a commercial vendor.
 *
 * All three sources here are FREE and public, and between them cover nine states.
 *
 * WHAT THIS TURNED OUT TO ALSO BE. The plow fleet carries geotagged dashcams, and it does
 * not stop in summer -- the same trucks run year-round on maintenance. Sampled on a September
 * afternoon: 1,000 images in the previous hour, 113 of them on interstates, 79 on I-80 alone,
 * each stamped with route, milepost, county, speed and coordinates. That is a MOBILE camera
 * network on the corridor, which is a different thing from the fixed-camera validation this
 * project already runs: fixed cameras only ever see the handful of places somebody mounted
 * one, which is exactly what capped camera validation before. A plow drives past the work
 * zone. Whether that is worth a vision call is left to the caller -- nothing here spends
 * money on its own.
 *
 * ENGINEERING NOTE, learned the hard way today: every spatial join in here goes through a
 * grid index. A previous corroborator in this codebase did the obvious nested loop over
 * events x rows and blocked the event loop for 497 seconds at production scale, which took
 * the whole service down. Nothing in this file scans O(n*m).
 */

const AGOL = 'https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services';

const LAYERS = {
  // Live plow positions with what the truck is actually DOING -- plow down, material and
  // rate, road and air temperature. This is the "treatment material / time since service"
  // signal, not just a dot on a map.
  avlDirect: `${AGOL}/AVL_Direct_View/FeatureServer/0/query`,
  avlLocal: `${AGOL}/AVL_Local_View/FeatureServer/0/query`,
  // Eight neighbouring DOTs' winter road conditions, republished by Iowa in one layer:
  // Illinois, Kansas, Minnesota, Missouri, Nebraska, North Dakota, South Dakota, Wisconsin.
  conditions: `${AGOL}/Midwest_Winter_Road_Conditions_View/FeatureServer/0/query`,
  // Geotagged imagery from the trucks themselves.
  camsIA: `${AGOL}/AVL_Images_Past_1HR_View/FeatureServer/0/query`,
  camsMN: `${AGOL}/AVL_Plow_Cam_Images_Minnesota_View/FeatureServer/0/query`,
  camsNE: `${AGOL}/AVL_Plow_Cam_Images_Nebraska_View/FeatureServer/0/query`
};

const TTL = { avl: 5 * 60 * 1000, conditions: 15 * 60 * 1000, cams: 5 * 60 * 1000 };
const cache = new Map();

function httpsGetJSON(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const req = require('https').get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'CorridorCommunicator/1.0' } }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let b = ''; res.setEncoding('utf8');
      res.on('data', d => { b += d; });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(new Error('parse')); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && (Date.now() - hit.at) < ttlMs) return hit.val;
  const val = await fn();
  cache.set(key, { at: Date.now(), val });
  return val;
}

const q = (url, params) => url + '?' + Object.entries(params)
  .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

const num = v => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const iso = v => (v ? new Date(v).toISOString() : null);

/** Any plow blade reported down. The four fields are front / both wings / underbelly. */
function plowDown(a) {
  const states = [a.FRONTPLOWSTATE, a.RIGHTWINGPLOWSTATE, a.LEFTWINGPLOWSTATE, a.UNDERBELLYPLOWSTATE];
  const anyDown = states.some(s => s !== null && s !== undefined && /down|1|true|on/i.test(String(s)));
  return states.every(s => s === null || s === undefined) ? null : anyDown;
}

/**
 * Live plow / maintenance vehicle positions, with treatment state.
 * Seasonal by nature: outside winter only a handful of trucks report, which is correct and
 * should read as "no treatment happening", never as "no data".
 */
async function fetchPlowAVL(opts = {}) {
  return cached('avl', TTL.avl, async () => {
    const out = [];
    try {
      const j = await httpsGetJSON(q(LAYERS.avlDirect, {
        where: '1=1', outFields: '*', returnGeometry: 'true', outSR: '4326', f: 'json'
      }));
      for (const f of (j.features || [])) {
        const a = f.attributes || {}, g = f.geometry || {};
        const lon = num(g.x ?? a.XPOSITION), lat = num(g.y ?? a.YPOSITION);
        if (lat === null || lon === null) continue;
        out.push({
          id: a.LABEL || a.OBJECTID, source: 'IA', kind: 'avl',
          lat, lon, heading: num(a.HEADING), speedMph: num(a.VELOCITY),
          roadTempF: num(a.ROADTEMP), airTempF: num(a.AIRTEMP),
          plowDown: plowDown(a),
          material: {
            solid: a.SOLIDMATERIAL || null, liquid: a.LIQUIDMATERIAL || null, prewet: a.PREWETMATERIAL || null,
            solidRate: num(a.SOLIDRATE), liquidRate: num(a.LIQUIDRATE), prewetRate: num(a.PREWETRATE)
          },
          // Whether material is going down right now is the operational fact; the run totals
          // say how much this truck has already put out on this run.
          treating: [a.SOLIDRATE, a.LIQUIDRATE, a.PREWETRATE].some(r => num(r) > 0),
          runTotals: { solid: num(a.SOLIDRUNTOTAL), liquid: num(a.LIQUIDRUNTOTAL), prewet: num(a.PREWETRUNTOTAL) },
          observedAt: iso(a.LOGDT || a.MODIFIEDDT || a.EditDate)
        });
      }
    } catch (_) { /* direct feed optional */ }
    try {
      const j = await httpsGetJSON(q(LAYERS.avlLocal, {
        where: '1=1', outFields: '*', returnGeometry: 'true', outSR: '4326', f: 'json'
      }));
      for (const f of (j.features || [])) {
        const a = f.attributes || {}, g = f.geometry || {};
        const lon = num(g.x ?? a.XPOSITION), lat = num(g.y ?? a.YPOSITION);
        if (lat === null || lon === null) continue;
        out.push({
          id: a.LABEL || a.LABELNAME || a.OBJECTID, source: 'IA', kind: 'avl-local',
          lat, lon, speedMph: num(a.VELOCITY),
          winterRoute: a.WINTER_ROUTE_NAME || null,
          plowDown: null, treating: null,
          observedAt: iso(a.LOGDT || a.MODIFIEDDT)
        });
      }
    } catch (_) { /* local feed optional */ }
    return out;
  });
}

/**
 * Winter road conditions across the Midwest -- eight state DOTs in one query, plus Iowa.
 * Optionally filtered to a state or a bounding box.
 */
async function fetchConditions(opts = {}) {
  const key = `cond:${opts.source || 'all'}:${opts.bbox ? opts.bbox.join(',') : 'all'}:${opts.activeOnly !== false}`;
  return cached(key, TTL.conditions, async () => {
    const params = {
      where: opts.source ? `SOURCE='${String(opts.source).replace(/'/g, "''")}'` : '1=1',
      outFields: 'ROUTE_NAME,SEGMENT_NAME,HEADLINE,DESCRIPTION,SOURCE,STATUS,ROAD_CONDITION,REPORT_UPDATED,PRIMARYLAT,PRIMARYLONG,SOURCE_LINK',
      returnGeometry: opts.geometry === false ? 'false' : 'true',
      outSR: '4326', f: 'json'
    };
    if (opts.bbox) {
      params.geometry = opts.bbox.join(',');
      params.geometryType = 'esriGeometryEnvelope';
      params.inSR = '4326';
      params.spatialRel = 'esriSpatialRelIntersects';
    }
    // PAGE IT. The service caps a response at 2,000 features and returns them in OBJECTID
    // order, so a single request came back with Missouri, North Dakota and Illinois only --
    // the other five states were simply past the cap. A partial answer that looks complete
    // is worse than a slow one.
    const wanted = Math.min(opts.limit || 8000, 12000);
    const PAGE = 2000;
    const feats = [];
    for (let offset = 0; offset < wanted; offset += PAGE) {
      const j = await httpsGetJSON(q(LAYERS.conditions,
        Object.assign({}, params, { resultRecordCount: String(PAGE), resultOffset: String(offset) })));
      const got = j.features || [];
      feats.push(...got);
      if (got.length < PAGE || !j.exceededTransferLimit) break;
    }
    const rows = [];
    for (const f of feats) {
      const a = f.attributes || {};
      // STATUS distinguishes a CURRENT report from a STALE one. A stale winter report is
      // worse than none -- it describes a road that may since have been treated -- so it is
      // carried explicitly rather than silently mixed in.
      const status = a.STATUS || null;
      if (opts.activeOnly !== false && status && /INACTIVE/i.test(status)) continue;
      rows.push({
        route: a.ROUTE_NAME || null,
        segment: a.SEGMENT_NAME || null,
        state: a.SOURCE || null,
        headline: a.HEADLINE || null,
        description: a.DESCRIPTION || null,
        condition: a.ROAD_CONDITION ?? null,
        status,
        current: status ? /CURRENT/i.test(status) : null,
        updatedAt: iso(a.REPORT_UPDATED),
        lat: num(a.PRIMARYLAT), lon: num(a.PRIMARYLONG),
        link: a.SOURCE_LINK || null,
        geometry: f.geometry ? { type: 'LineString', coordinates: (f.geometry.paths || [])[0] || [] } : null
      });
    }
    return rows;
  });
}

/**
 * Geotagged imagery from the plow/maintenance fleet: Iowa (last hour), Minnesota, Nebraska.
 *
 * Year-round, because the trucks run year-round. Each frame carries route and milepost, so
 * a frame can be tied to a location without any geocoding.
 */
async function fetchPlowCams(opts = {}) {
  return cached(`cams:${opts.states || 'all'}`, TTL.cams, async () => {
    const want = opts.states ? String(opts.states).toUpperCase().split(',') : ['IA', 'MN', 'NE'];
    const jobs = [];
    if (want.includes('IA')) jobs.push(['IA', LAYERS.camsIA]);
    if (want.includes('MN')) jobs.push(['MN', LAYERS.camsMN]);
    if (want.includes('NE')) jobs.push(['NE', LAYERS.camsNE]);
    const out = [];
    await Promise.all(jobs.map(async ([st, url]) => {
      try {
        const j = await httpsGetJSON(q(url, {
          where: '1=1', outFields: '*', returnGeometry: 'true', outSR: '4326',
          orderByFields: 'PHOTO_FILEDATE DESC',
          resultRecordCount: String(Math.min(opts.limit || 1000, 2000)), f: 'json'
        }));
        for (const f of (j.features || [])) {
          const a = f.attributes || {}, g = f.geometry || {};
          const lon = num(g.x ?? a.PHOTO_LONGITUDE), lat = num(g.y ?? a.PHOTO_LATITUDE);
          // Always prefer the https URL: the plain PHOTO_URL is http and 301s.
          const imageUrl = a.SECURE_PHOTO_URL || a.PHOTO_URL || null;
          if (lat === null || lon === null || !imageUrl) continue;
          out.push({
            state: st, id: a.PHOTO_UID || a.PHOTO_ANUMBER || a.OBJECTID,
            truck: a.PHOTO_ANUMBER || null,
            lat, lon, imageUrl,
            route: a.ROUTE_NAME || null, milepost: num(a.REF_POST),
            county: a.COUNTY_NAME || null, garage: a.GARAGE_NAME || null,
            speedMph: num(a.PHOTO_SPEED ?? a.SPEED), heading: num(a.PHOTO_BEARING ?? a.HEADING),
            takenAt: iso(a.PHOTO_FILEDATE)
          });
        }
      } catch (_) { /* one state's cams failing must not lose the others */ }
    }));
    out.sort((a, b) => String(b.takenAt || '').localeCompare(String(a.takenAt || '')));
    return out;
  });
}

// ---- spatial index -------------------------------------------------------------------
// Everything below joins points to points. It goes through a grid, never a nested scan.

const R_EARTH_M = 6371008.8;
const rad = d => d * Math.PI / 180;
function distM(aLat, aLon, bLat, bLon) {
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.sqrt(s));
}

/** Grid of points, cell ~= radiusM, so a lookup only touches the 3x3 around a location. */
function buildIndex(points, radiusM) {
  const cell = Math.max(radiusM / 111320, 0.0005);
  const grid = new Map();
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    const k = `${Math.floor(p.lon / cell)}:${Math.floor(p.lat / cell)}`;
    let b = grid.get(k); if (!b) grid.set(k, b = []);
    b.push(p);
  }
  return { grid, cell };
}
function near(index, lat, lon, radiusM) {
  const { grid, cell } = index;
  const cx = Math.floor(lon / cell), cy = Math.floor(lat / cell);
  const hits = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const b = grid.get(`${cx + dx}:${cy + dy}`);
    if (!b) continue;
    for (const p of b) {
      const d = distM(lat, lon, p.lat, p.lon);
      if (d <= radiusM) hits.push({ point: p, distanceM: Math.round(d) });
    }
  }
  hits.sort((a, b) => a.distanceM - b.distanceM);
  return hits;
}

/**
 * Time since a plow last treated near a point -- PennDOT's strongest single predictor.
 *
 * Reported honestly in three states, because they mean different things operationally:
 *   treated   a truck passed with material going down, and how long ago
 *   passed    a truck passed but was not treating
 *   none      no truck seen within the radius. NOT "never plowed" -- only "not observed",
 *             and outside winter that is the normal answer.
 */
function treatmentNear(avl, lat, lon, opts = {}) {
  const radiusM = opts.radiusM || 3000;
  const idx = opts._index || buildIndex(avl, radiusM);
  const hits = near(idx, lat, lon, radiusM);
  if (!hits.length) return { status: 'none', observed: false };
  const treating = hits.filter(h => h.point.treating === true);
  const best = (treating[0] || hits[0]);
  const at = best.point.observedAt ? Date.parse(best.point.observedAt) : null;
  return {
    status: treating.length ? 'treated' : 'passed',
    observed: true,
    minutesAgo: at ? Math.round((Date.now() - at) / 60000) : null,
    distanceM: best.distanceM,
    truck: best.point.id,
    plowDown: best.point.plowDown,
    material: best.point.material || null,
    roadTempF: best.point.roadTempF ?? null,
    trucksNearby: hits.length
  };
}

/**
 * Work zones with a recent plow-cam frame nearby.
 *
 * Returns CANDIDATES only -- it never calls vision, because that costs money and this runs
 * on a shared path. The caller decides whether any of these are worth looking at. The value
 * over the existing fixed-camera validation is coverage: fixed cameras see the few places
 * one is mounted, whereas the fleet drives the network, so zones with no fixed camera can
 * still get a look.
 */
function camCandidates(events, cams, opts = {}) {
  const radiusM = opts.radiusM || 400;
  const maxAgeMin = opts.maxAgeMin || 60;
  const now = Date.now();
  const fresh = cams.filter(c => {
    if (!c.takenAt) return false;
    const t = Date.parse(c.takenAt);
    return Number.isFinite(t) && (now - t) <= maxAgeMin * 60000;
  });
  if (!fresh.length) return [];
  const idx = buildIndex(fresh, radiusM);
  const out = [];
  for (const ev of (events || [])) {
    const p = ev.coordinates || (ev.longitude != null ? [ev.longitude, ev.latitude] : null);
    if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    const hits = near(idx, p[1], p[0], radiusM);
    if (!hits.length) continue;
    const h = hits[0];
    out.push({
      eventId: ev.id || ev.road_event_id,
      corridor: ev.corridor || null,
      camera: h.point.imageUrl,
      truck: h.point.truck,
      state: h.point.state,
      route: h.point.route,
      milepost: h.point.milepost,
      distanceM: h.distanceM,
      takenAt: h.point.takenAt,
      ageMinutes: Math.round((now - Date.parse(h.point.takenAt)) / 60000),
      framesNearby: hits.length
    });
  }
  out.sort((a, b) => a.distanceM - b.distanceM);
  return out;
}

/**
 * Attach the nearest recent fleet photo to each event it plausibly shows.
 *
 * NOT counted as a validating source, on purpose. A maintenance truck driving past proves
 * that a photograph of that place exists; it does not prove the work zone is active. That
 * is the difference between evidence and verification, and this project has been careful
 * about it everywhere else. The frame is stamped as available evidence -- something a person
 * (or, on request, the existing vision pipeline) can look at -- and x_camera_verified stays
 * untouched unless something actually looks at the image.
 *
 * The photo URL is worth keeping once stamped: it is a dated path in Iowa DOT's cloud
 * storage, so it stays fetchable long after the frame drops out of the one-hour feed. That
 * makes it a durable photographic record of the zone at a known time, which is more than
 * the live fixed-camera URLs give (those always show "now").
 *
 * @returns {number} events stamped
 */
function corroborate(events, cams, opts = {}) {
  const radiusM = opts.radiusM || 400;
  const maxAgeMin = opts.maxAgeMin || 120;
  const now = Date.now();
  const fresh = (cams || []).filter(c => {
    if (!c.takenAt || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) return false;
    const t = Date.parse(c.takenAt);
    return Number.isFinite(t) && (now - t) <= maxAgeMin * 60000;
  });
  if (!fresh.length) return 0;

  const idx = buildIndex(fresh, radiusM);
  let n = 0;
  for (const ev of (events || [])) {
    const p = ev.coordinates || (ev.longitude != null ? [ev.longitude, ev.latitude] : null);
    if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    const hits = near(idx, p[1], p[0], radiusM);
    if (!hits.length) continue;
    const h = hits[0];
    // Keep the closest frame, and do not replace a closer one already stamped this pass.
    if (ev.x_fleet_camera_distance_m != null && ev.x_fleet_camera_distance_m <= h.distanceM) continue;
    ev.x_fleet_camera_url = h.point.imageUrl;
    ev.x_fleet_camera_at = h.point.takenAt;
    ev.x_fleet_camera_distance_m = h.distanceM;
    ev.x_fleet_camera_route = h.point.route || null;
    ev.x_fleet_camera_milepost = h.point.milepost ?? null;
    ev.x_fleet_camera_state = h.point.state || null;
    ev.x_fleet_truck = h.point.truck || null;
    ev.x_fleet_frames_nearby = hits.length;
    n++;
  }
  return n;
}

module.exports = {
  fetchPlowAVL, fetchConditions, fetchPlowCams,
  treatmentNear, camCandidates, corroborate, buildIndex, near,
  LAYERS
};

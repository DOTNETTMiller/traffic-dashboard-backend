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
  camsNE: `${AGOL}/AVL_Plow_Cam_Images_Nebraska_View/FeatureServer/0/query`,
  // Utah publishes its whole plow fleet openly, no key. Positions, speed and a movement
  // status, but no blade state or material -- so those stay null rather than false, because
  // "not reported" and "not treating" are different facts.
  avlUT: 'https://services.arcgis.com/pA2nEVnB6tquxgOW/arcgis/rest/services/SnowPlow_AVL_Public/FeatureServer/0/query'
};

// PennDOT publishes winter road conditions as one layer per severity class, no key. Empty
// outside winter, which is the correct answer rather than a missing one.
const PA_WINTER = 'https://gis.penndot.gov/arcgis/rest/services/winterconditions/winterconditions/MapServer';
const PA_LAYERS = [[0, 'impassable'], [1, 'icy'], [2, 'snow packed'], [3, 'snow/slush'], [4, 'wet/freezing']];

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
    try {
      const j = await httpsGetJSON(q(LAYERS.avlUT, {
        where: '1=1', outFields: 'vehicleid,servicetype,speedmph,heading,location_timestamp',
        returnGeometry: 'true', outSR: '4326', resultRecordCount: '2000', f: 'json'
      }));
      for (const f of (j.features || [])) {
        const a = f.attributes || {}, g = f.geometry || {};
        const lon = num(g.x), lat = num(g.y);
        if (lat === null || lon === null) continue;
        out.push({
          id: a.vehicleid || a.objectid, source: 'UT', kind: 'avl',
          lat, lon, heading: num(a.heading), speedMph: num(a.speedmph),
          // Utah reports movement state, not treatment state. Saying "not treating" here
          // would be inventing a fact the feed does not carry.
          status: a.servicetype || null,
          plowDown: null, treating: null, material: null,
          roadTempF: null, airTempF: null,
          observedAt: iso(a.location_timestamp)
        });
      }
    } catch (_) { /* Utah feed optional */ }
    // CARS/OneStop 511 states, each behind its own free key. Every one without a key is
    // skipped silently, so this costs nothing until keys exist.
    try {
      const { plows } = await require('./plow-adapters').fetchAll();
      out.push(...plows);
    } catch (_) { /* 511 plows optional */ }
    return out;
  });
}

/** PennDOT winter road conditions, one layer per severity class. */
async function fetchPAConditions(opts = {}) {
  return cached('pa-cond', TTL.conditions, async () => {
    const rows = [];
    await Promise.all(PA_LAYERS.map(async ([id, label]) => {
      try {
        const j = await httpsGetJSON(q(`${PA_WINTER}/${id}/query`, {
          where: '1=1', outFields: 'ST_RT_NO,COUNTY_NAME,ROAD_SECTION_ID',
          returnGeometry: opts.geometry === false ? 'false' : 'true',
          outSR: '4326', resultRecordCount: '2000', f: 'json'
        }));
        for (const f of (j.features || [])) {
          const a = f.attributes || {};
          rows.push({
            route: a.ST_RT_NO ? `SR ${a.ST_RT_NO}` : null,
            segment: a.ROAD_SECTION_ID || null,
            state: 'Pennsylvania DOT',
            headline: label,
            description: a.COUNTY_NAME ? `${a.COUNTY_NAME} County` : null,
            condition: label, status: 'ACTIVE-CURRENT', current: true,
            updatedAt: null, lat: null, lon: null, link: null,
            geometry: f.geometry ? { type: 'LineString', coordinates: (f.geometry.paths || [])[0] || [] } : null
          });
        }
      } catch (_) { /* one class failing must not lose the others */ }
    }));
    return rows;
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
    // PennDOT is a separate publisher on its own server, merged here so callers see one
    // multi-state condition set rather than having to know the plumbing.
    if (!opts.source || /pennsylvania/i.test(opts.source)) {
      try { rows.push(...await fetchPAConditions(opts)); } catch (_) { /* optional */ }
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
 * Was this closure in effect at the moment the photo was taken?
 *
 * A frame from before the work started, or after it finished, cannot show it however close
 * the truck was. Frame age alone does not cover this: the median closure in the feed lasts
 * about half a day, so a six-hour-old photo routinely falls outside a short closure's window
 * entirely.
 *
 * Returns true / false, or null when the window is unknown -- and null is treated as "do not
 * claim", never as "probably fine".
 *
 * A caveat worth stating rather than hiding: about a tenth of these events carry spans of a
 * year or more. For those, "the photo is inside the window" is a weak statement — it means
 * the project exists, not that anyone was working that afternoon. spanDays is returned so a
 * caller can weigh it, and the vision gate uses it to rank.
 */
function activeAt(ev, ms) {
  const s = Date.parse(ev.startTime || ev.startDate || ev.start_date || '');
  const e = Date.parse(ev.endTime || ev.endDate || ev.end_date || '');
  if (!Number.isFinite(s)) return { active: null, spanDays: null };
  if (ms < s) return { active: false, reason: 'photo predates the closure', spanDays: null };
  if (Number.isFinite(e) && ms > e) return { active: false, reason: 'photo is after the closure ended', spanDays: null };
  const spanDays = Number.isFinite(e) ? (e - s) / 86400000 : null;
  return { active: true, spanDays };
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
  // Six hours, not one. The fleet feed goes quiet as trucks come off shift -- observed frame
  // ages ran 8 minutes at midday and 129-153 minutes by early evening -- so a tight window
  // silently stamps nothing exactly when you look. A photograph is evidence with a timestamp
  // on it, not a real-time claim: an image from this afternoon still shows what the zone
  // looked like, and the popup states when it was taken. Freshness is presented, not enforced.
  const maxAgeMin = opts.maxAgeMin || 360;
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
    // Only frames taken while the closure was actually in effect. A picture of that stretch
    // of road from before the work began is a picture of nothing.
    const h = hits.find(x => activeAt(ev, Date.parse(x.point.takenAt)).active === true);
    if (!h) continue;
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
    ev.x_fleet_camera_in_window = true;      // taken while the closure was in effect
    n++;
  }
  return n;
}

/**
 * The gate that must be passed before an image is worth sending to a vision model.
 *
 * Vision costs money per image, and the fleet produces a thousand frames an hour, so the
 * question is not "is there a photo near this zone" but "could this photo actually SHOW the
 * zone". Two conditions, and proximity alone is not enough:
 *
 *   1. CLOSE. Default 150 m, hard-capped at 300 m. The earlier 400 m used for attaching a
 *      photo to an event is fine for "a truck was here"; it is too loose to spend a vision
 *      call on, because at 400 m a work zone is a few pixels.
 *
 *   2. AHEAD OF THE CAMERA. These are forward-facing dashcams, so a frame taken 100 m PAST
 *      the zone does not contain it, however close it is. The frame's own heading is
 *      compared against the bearing to the zone, and anything outside the lens's forward
 *      cone is rejected. This is the condition proximity-only filtering misses, and it is
 *      what stops us paying to look at pictures of empty road behind the work.
 *
 * Frames with no heading are kept only when very close, where the zone is likely in shot
 * whichever way the truck was pointing.
 *
 * Returns candidates ranked best-first with the reasoning attached, and NEVER calls vision
 * itself -- the caller decides how many to spend.
 */
function visionCandidates(events, cams, opts = {}) {
  const maxM = Math.min(opts.maxM || 150, 300);
  const coneDeg = opts.coneDeg || 50;          // forward field of view, half-angle
  // Inside this range the bearing test is switched off deliberately. A work zone is hundreds
  // of metres long but is reported as a single point, so at 45 m the truck is effectively IN
  // the zone and the bearing to that one point is dominated by noise -- it will happily
  // reject a frame that plainly shows the work. Close enough is close enough.
  const closeEnoughM = opts.closeEnoughM || 75;
  // At most this many frames per work zone. One frame can miss -- a truck passing at the
  // wrong instant, a vehicle blocking the view -- but the cost of looking is per image, so
  // this is capped low deliberately. Two or three passes give a second chance without the
  // bill scaling with how busy a corridor happens to be.
  const maxPerZone = Math.max(1, Math.min(opts.maxPerZone || 3, 5));
  const noHeadingMaxM = opts.noHeadingMaxM || 75;
  const maxAgeMin = opts.maxAgeMin || 360;
  const now = Date.now();

  const fresh = (cams || []).filter(c => {
    if (!c.takenAt || !Number.isFinite(c.lat) || !Number.isFinite(c.lon) || !c.imageUrl) return false;
    const t = Date.parse(c.takenAt);
    return Number.isFinite(t) && (now - t) <= maxAgeMin * 60000;
  });
  if (!fresh.length) return [];

  const idx = buildIndex(fresh, maxM);
  const out = [];
  for (const ev of (events || [])) {
    const p = ev.coordinates || (ev.longitude != null ? [ev.longitude, ev.latitude] : null);
    if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    const [lon, lat] = p;

    let kept = 0;
    for (const h of near(idx, lat, lon, maxM)) {
      if (kept >= maxPerZone) break;
      const c = h.point;
      // THIRD GATE: the closure has to have been in effect when the shutter fired.
      const when = activeAt(ev, Date.parse(c.takenAt));
      if (when.active !== true) continue;
      const hdg = Number.isFinite(c.heading) ? c.heading : null;
      let bearingOff = null;
      if (h.distanceM <= closeEnoughM) {
        // Practically on top of it: accept without a bearing test.
      } else if (hdg === null) {
        // No heading and not close: cannot tell whether the zone was in shot.
        if (h.distanceM > noHeadingMaxM) continue;
      } else {
        const y = Math.sin(rad(lon - c.lon)) * Math.cos(rad(lat));
        const x = Math.cos(rad(c.lat)) * Math.sin(rad(lat)) -
          Math.sin(rad(c.lat)) * Math.cos(rad(lat)) * Math.cos(rad(lon - c.lon));
        const toZone = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
        const d = Math.abs(hdg - toZone) % 360;
        bearingOff = d > 180 ? 360 - d : d;
        if (bearingOff > coneDeg) continue;    // the zone was behind or beside the lens
      }
      kept++;
      out.push({
        eventId: ev.id || ev.road_event_id,
        corridor: ev.corridor || null,
        imageUrl: c.imageUrl,
        distanceM: h.distanceM,
        bearingOffDeg: bearingOff === null ? null : Math.round(bearingOff),
        headingKnown: hdg !== null,
        route: c.route, milepost: c.milepost, state: c.state, truck: c.truck,
        takenAt: c.takenAt,
        ageMinutes: Math.round((now - Date.parse(c.takenAt)) / 60000),
        inClosureWindow: true,
        closureSpanDays: when.spanDays === null ? null : +when.spanDays.toFixed(1),
        // Closest and most head-on first, so a capped run spends its budget on the frames
        // most likely to show something.
        // Closest and most head-on first. A very long closure is nudged down: "inside a
        // 400-day window" says the project exists, not that work was happening that hour,
        // so a short closure's frame is the better spend.
        score: h.distanceM + (bearingOff || 0) * 2 + (when.spanDays > 30 ? 60 : 0)
      });
    }
  }
  out.sort((a, b) => a.score - b.score);
  return out;
}

module.exports = {
  fetchPlowAVL, fetchConditions, fetchPAConditions, fetchPlowCams,
  treatmentNear, camCandidates, corroborate, visionCandidates, activeAt, buildIndex, near,
  LAYERS
};

/**
 * Turn rail movements into CROSSING IMPACTS.
 *
 * The output of this file is deliberately not a train. Motorists, 511, Waze, ATMS and EMS
 * all need the same thing -- "this crossing is about to be blocked, for about this long" --
 * and none of them need a freight train's coordinates. Publishing crossing impacts instead
 * of train positions is also the version a railroad will not object to, which matters if
 * any of this is ever to be fed by a railroad-derived source.
 *
 * SOURCE-AGNOSTIC BY DESIGN. It consumes the rail_movement shape, so RailState sightings,
 * TRAINFO crossing sensors and Amtrak positions all arrive the same way and the projection
 * never learns which it is looking at. Adding TRAINFO later is an adapter, not a rewrite.
 *
 * GEOMETRY. Iowa DOT publishes both halves, and better than the national layers:
 *   Rail_Crossing_View     5,566 crossings, each with CROSSINGID, RAILROAD, STREET and --
 *                          the useful part -- ROUTE_ID + MEASURE, i.e. already linearly
 *                          referenced onto the rail network
 *   Rail_Line_Active_View  14,374 polylines with OWNER / PRIMARY_OPER / TRACK_TYPE
 *
 * That LRS is what makes this better than the cone-and-bearing approach used for Amtrak:
 * when a movement resolves to a ROUTE_ID, distance to a crossing on the same route is a
 * subtraction of measures rather than a guess about direction. It is the same technique
 * rams-chainage.js uses for devices on the road network.
 *
 * WHAT IT WILL NOT DO. It never claims a crossing is occupied. A sighting-based source is
 * minutes old by construction (RailState: typically <25 min), so the honest output is an
 * ETA with an error band, and any ETA inside the movement's own staleness is reported as
 * such rather than dressed up as precision.
 */

const IA_CROSSINGS =
  'https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Rail_Crossing_View/FeatureServer/0/query';
const IA_RAIL_LINES =
  'https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Rail_Line_Active_View/FeatureServer/0/query';

// Iowa stores RAILROAD as a coded-value domain, so the raw attribute is an integer and a
// popup built on it would read "[11]". Resolved from the layer's own domain definition and
// inlined because it is a stable lookup not worth a second HTTP round trip.
const RAILROAD_CODES = {
  0: 'OTHR', 1: 'APNC', 2: 'CBRX', 3: 'BJRY', 4: 'BNSF', 5: 'BSV', 6: 'CBGR', 7: 'CC',
  8: 'CCRY', 9: 'CEDR', 10: 'CIC', 11: 'UP', 12: 'DAIR', 13: 'BLK1', 14: 'IAIS', 15: 'IANR',
  16: 'IATR', 17: 'BLK2', 18: 'KJRY', 19: 'NS', 20: 'BLK3', 21: 'DME', 22: 'TKEZ', 23: 'BLK4',
  24: 'BLK5', 25: 'DWRV', 26: 'IANW', 27: 'ZMBU', 28: 'SBSX', 29: 'CSSX', 30: 'IARR',
  31: 'CGAQ', 32: 'SIBY', 33: 'CBEC', 34: 'SOO', 36: 'BSVY', 38: 'CN', 40: 'CP', 42: 'ICE',
  44: 'IOPX', 46: 'IOWZ', 48: 'ISUZ', 50: 'IWPZ', 52: 'KCS', 54: 'NS', 56: 'PGR', 58: 'PNRC',
  60: 'XIPH', 62: 'XSSD', 64: 'ZIAP', 66: 'ZIWR', 68: 'ISRY', 70: 'ICG', 72: 'CNW', 73: 'AMTRAK'
};

// Whatever a source calls a railroad -> the reporting mark Iowa uses.
const RR_ALIASES = {
  'UNION PACIFIC': 'UP', UPRR: 'UP', 'UP RAILROAD': 'UP',
  'BNSF RAILWAY': 'BNSF', 'BURLINGTON NORTHERN SANTA FE': 'BNSF',
  'CANADIAN NATIONAL': 'CN', 'CANADIAN PACIFIC': 'CP', CPKC: 'CP',
  'NORFOLK SOUTHERN': 'NS', 'KANSAS CITY SOUTHERN': 'KCS',
  'IOWA INTERSTATE': 'IAIS', 'IOWA NORTHERN': 'IANR', AMTK: 'AMTRAK'
};
const normRR = v => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return RAILROAD_CODES[v] || null;
  const s = String(v).toUpperCase().trim();
  return RR_ALIASES[s] || s;
};

const R_EARTH_M = 6371008.8;
const MI_TO_M = 1609.344;
const rad = d => d * Math.PI / 180;

function distM(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.sqrt(s));
}
function bearingDeg(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}
const angleDelta = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

const COMPASS = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
  NORTH: 0, EAST: 90, SOUTH: 180, WEST: 270,
  NB: 0, EB: 90, SB: 180, WB: 270 };
const headingDeg = h => (typeof h === 'number' ? h : COMPASS[String(h || '').toUpperCase().trim()]);

function httpsGetJSON(url, timeoutMs = 40000) {
  return new Promise((resolve, reject) => {
    const req = require('https').get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'CorridorCommunicator/1.0' } }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let b = ''; res.setEncoding('utf8');
      res.on('data', d => { b += d; });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

/** Crossings within a box, carrying Iowa's LRS reference so measures can be compared. */
async function crossingsNear(lat, lon, radiusM) {
  const dLat = (radiusM / R_EARTH_M) * 180 / Math.PI;
  const dLon = dLat / Math.max(Math.cos(rad(lat)), 1e-6);
  const bb = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');
  const url = IA_CROSSINGS +
    '?where=1%3D1&geometry=' + encodeURIComponent(bb) +
    '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
    '&outFields=' + encodeURIComponent('CROSSINGID,RAILROAD,STREET,HIGHWAY,ROUTE_ID,MEASURE,CITYCD') +
    '&returnGeometry=true&outSR=4326&resultRecordCount=1000&f=json';
  const j = await httpsGetJSON(url);
  return ((j && j.features) || []).map(f => {
    const a = f.attributes || {}, g = f.geometry || {};
    return {
      crossingId: a.CROSSINGID || null,
      railroad: normRR(a.RAILROAD),
      street: a.STREET || null,
      highway: a.HIGHWAY || null,
      routeId: a.ROUTE_ID || null,
      measure: typeof a.MEASURE === 'number' ? a.MEASURE : null,
      lat: g.y, lon: g.x
    };
  }).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon));
}

/**
 * Crossing impacts for one rail movement.
 *
 * @param {Object} movement  a rail_movement event (see railstate-adapter)
 * @param {Object} opts      lookaheadMi, coneDeg, clearanceAssumptionS
 */
async function impactsFor(movement, opts = {}) {
  const lookaheadMi = opts.lookaheadMi || 12;
  const coneDeg = opts.coneDeg || 60;
  const lat = movement && movement.location && Number(movement.location.lat);
  const lon = movement && movement.location && Number(movement.location.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { error: 'movement has no position' };

  const hdg = headingDeg(movement.direction);
  const mph = Number(movement.speed_mph) || 0;
  const ageS = Number(movement.freshness_seconds) || 0;

  // How far the train may have travelled since it was OBSERVED. For a sighting network this
  // is the dominant error term, not a rounding detail: 25 minutes at 40 mph is 16 miles.
  const driftMi = mph > 0 ? (mph * ageS / 3600) : null;

  const all = await crossingsNear(lat, lon, lookaheadMi * MI_TO_M);
  const here = { lat, lon };

  // Prefer Iowa's linear referencing where the movement can be tied to a route: comparing
  // measures on one ROUTE_ID beats inferring "ahead" from a bearing. Falls back to the cone
  // when the movement carries no route (a raw sighting usually will not).
  const onRoute = movement.route_id || null;

  // Proximity is not the same as being on the same track: a UP manifest at Boone sits a few
  // hundred metres from the Boone & Scenic Valley tourist line, and without a guard it gets
  // reported as blocking a heritage railroad's crossings.
  //
  // But the obvious guard -- operator must equal the crossing's railroad -- is wrong for
  // TENANTS. Iowa codes each crossing to the railroad that OWNS it, and Amtrak owns almost
  // no track outside the Northeast Corridor; it runs on UP, BNSF and IAIS rail. Applied
  // naively the guard threw away 66 of 68 crossings around a live Southwest Chief.
  //
  // So the guard is self-limiting: it only engages when the operator actually appears among
  // the nearby crossings, i.e. when the operator demonstrably describes track ownership
  // here. For a tenant it matches nothing, and the engine falls back to pure geometry.
  //
  // Known limitation: freight railroads hold trackage rights over one another, so a UP train
  // on BNSF rail would be over-filtered. Snapping to Rail_Line_Active_View would settle it
  // outright; until then the guard errs toward dropping rather than inventing impacts.
  const myRR = normRR(movement.operator);
  const ownsTrackHere = myRR && all.some(c => c.railroad === myRR);
  let crossRailroadSkipped = 0;

  const out = [];
  for (const c of all) {
    if (ownsTrackHere && c.railroad && c.railroad !== myRR) { crossRailroadSkipped++; continue; }
    const d = distM(here, { lat: c.lat, lon: c.lon });
    const mi = d / MI_TO_M;
    if (mi > lookaheadMi) continue;

    let ahead = true;
    if (onRoute && c.routeId === onRoute && c.measure !== null && movement.measure != null) {
      const delta = c.measure - movement.measure;
      ahead = /S|W/i.test(String(movement.direction || '')) ? delta < 0 : delta > 0;
    } else if (hdg !== undefined) {
      ahead = angleDelta(hdg, bearingDeg(here, { lat: c.lat, lon: c.lon })) <= coneDeg;
    }
    if (!ahead) continue;

    const etaMin = mph > 0 ? (mi / mph) * 60 : null;
    // Blockage duration is a function of train length and speed, both of which a sighting
    // source gives us. No length -> no duration, rather than a made-up number.
    const lengthFt = Number(movement.train_length_ft) || null;
    const clearS = (lengthFt && mph > 0) ? (lengthFt / 5280) / mph * 3600 : null;

    out.push({
      event_type: 'crossing_impact',
      crossing_id: c.crossingId,
      street: c.street,
      railroad: c.railroad,
      location: { lat: c.lat, lon: c.lon },
      distance_mi: +mi.toFixed(2),
      // Status is deliberately never "BLOCKED": nothing here observes occupancy.
      status: etaMin !== null && driftMi !== null && mi <= driftMi ? 'POSSIBLY_PASSED'
        : etaMin !== null && etaMin <= 10 ? 'APPROACHING'
        : 'PREDICTED',
      eta_minutes: etaMin === null ? null : +etaMin.toFixed(1),
      estimated_blockage_seconds: clearS === null ? null : Math.round(clearS),
      source: movement.source || null,
      operator: movement.operator || null,
      train_type: movement.train_type || null,
      observed_at: movement.observed_at || null,
      observation_age_seconds: ageS || null,
      // The error band, stated rather than implied. An ETA under this is inside the noise.
      uncertainty_mi: driftMi === null ? null : +driftMi.toFixed(2),
      confidence: movement.confidence ?? null,
      freshness_tier: movement.freshness_tier || null
    });
  }
  out.sort((a, b) => a.distance_mi - b.distance_mi);
  return {
    movement_id: movement.train_id || null,
    source: movement.source || null,
    operator: myRR,
    operator_filter_applied: !!ownsTrackHere,
    crossings_scanned: all.length,
    crossings_other_railroad: crossRailroadSkipped,
    uncertainty_mi: driftMi === null ? null : +driftMi.toFixed(2),
    impacts: out
  };
}

/** Impacts for many movements, with stale ones excluded unless explicitly asked for. */
async function impactsForAll(movements, opts = {}) {
  const usable = (movements || []).filter(m => opts.includeStale ? true : m.operational !== false);
  const results = [];
  for (const m of usable.slice(0, opts.limit || 25)) {
    try { results.push(await impactsFor(m, opts)); } catch (_) { /* one bad movement must not stop the rest */ }
  }
  const impacts = results.flatMap(r => r.impacts || []);
  return {
    movements: usable.length,
    impacts_total: impacts.length,
    approaching: impacts.filter(i => i.status === 'APPROACHING').length,
    caveat: 'Predicted from observed movements. Nothing here observes occupancy — no impact means no movement was seen, not that a crossing is clear.',
    results
  };
}

/**
 * Amtrak position -> the same rail_movement shape RailState produces.
 *
 * The point of a source-agnostic engine is that it does not have to wait for RailState: the
 * Amtrak feed already runs, so plugging it in here makes crossing impacts a live product
 * today, and the freight source becomes an additional publisher rather than a launch
 * dependency. Amtrak reports no train length, so no blockage duration is estimated -- which
 * is correct anyway, since a passenger consist clears a crossing in seconds.
 */
function fromAmtrakTrain(t, now = Date.now()) {
  if (!t || !Number.isFinite(t.lat) || !Number.isFinite(t.lon)) return null;
  const ageS = Number.isFinite(t.positionAgeS) ? t.positionAgeS : null;
  return {
    event_type: 'rail_movement',
    source: t.source || 'amtrak',
    train_id: t.trainNum ? String(t.trainNum) : null,
    operator: 'AMTRAK',
    observed_at: t.updatedAt || null,
    location: { lat: t.lat, lon: t.lon },
    direction: t.heading || null,
    speed_mph: Number(t.velocity) || 0,
    train_length_ft: null,
    train_type: 'passenger',
    route_name: t.routeName || null,
    freshness_seconds: ageS,
    // Amtrak positions refresh every couple of minutes, so the RailState tiers would call
    // almost everything CURRENT. Judge against the feed's own cadence instead.
    freshness_tier: ageS === null ? 'UNKNOWN' : ageS <= 600 ? 'CURRENT' : ageS <= 1800 ? 'RECENT' : 'STALE',
    operational: ageS === null ? true : ageS <= 1800,
    confidence: null
  };
}

module.exports = {
  impactsFor, impactsForAll, crossingsNear, fromAmtrakTrain,
  normRR, RAILROAD_CODES, IA_CROSSINGS, IA_RAIL_LINES
};

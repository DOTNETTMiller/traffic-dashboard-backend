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

// National grade-crossing inventory (BTS/NTAD), 242,108 records.
const NTAD_CROSSINGS =
  'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Railroad_Grade_Crossings/FeatureServer/0/query';
// Iowa's own layer is richer where it applies, but stops at the state line. Kept for
// reference; the engine runs on the national inventory.
const IA_CROSSINGS =
  'https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Rail_Crossing_View/FeatureServer/0/query';
const IA_RAIL_LINES =
  'https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Rail_Line_Active_View/FeatureServer/0/query';

const railNet = require('./rail-network');

// The rail network is effectively static, and one movement's walk covers the same ground as
// its neighbours'. Cached by rounded centre so a feed of 25 trains does not refetch it 25
// times; TTL is long because track does not move.
const NET_TTL_MS = 6 * 60 * 60 * 1000;
const netCache = new Map();
async function loadNetworkCached(lat, lon, radiusM) {
  const key = `${lat.toFixed(1)},${lon.toFixed(1)},${Math.round(radiusM / 1000)}`;
  const hit = netCache.get(key);
  if (hit && (Date.now() - hit.at) < NET_TTL_MS) return hit.net;
  const net = await railNet.loadNetwork(lat, lon, radiusM);
  netCache.set(key, { at: Date.now(), net });
  return net;
}

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

/**
 * Crossings within a box — NATIONAL.
 *
 * This used Iowa's Rail_Crossing_View, which made the whole impact engine stop at the state
 * line while everything around it was already national: trains come from Amtrak's own feed,
 * track from NARN, and FRA blocked-crossing hotspots answer for any state (Texas alone has
 * 25,000 reports across 2,030 crossings). The crossings were the one Iowa-shaped piece, and
 * a corridor tool that silently returns nothing outside one state is worse than one that
 * says so.
 *
 * NTAD's Railroad Grade Crossings is the national inventory: 242,108 records with
 * CrossingID, STREET, RailroadCode and position.
 *
 * ONLY AT-GRADE CROSSINGS COUNT. The inventory also carries "RR Over" and "RR Under" —
 * grade separations, where the track flies over or under the road. A train cannot block
 * those, so including them would invent impacts at bridges. Around one Chicago sample, four
 * of five nearby records were separations.
 */
async function crossingsNear(lat, lon, radiusM) {
  const dLat = (radiusM / R_EARTH_M) * 180 / Math.PI;
  const dLon = dLat / Math.max(Math.cos(rad(lat)), 1e-6);
  const bb = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');
  const url = NTAD_CROSSINGS +
    '?where=' + encodeURIComponent("CrossingPosition='At Grade'") +
    '&geometry=' + encodeURIComponent(bb) +
    '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
    '&outFields=' + encodeURIComponent('CrossingID,STREET,RailroadCode,ParentRailroadCode,STATENAME,RailroadSubdivision') +
    '&returnGeometry=true&outSR=4326&resultRecordCount=1000&f=json';
  const j = await httpsGetJSON(url);
  return ((j && j.features) || []).map(f => {
    const a = f.attributes || {}, g = f.geometry || {};
    return {
      crossingId: a.CrossingID || null,
      // RailroadCode is the operating railroad's reporting mark, already in the same
      // vocabulary the track layer uses — no numeric domain to decode as Iowa needed.
      railroad: normRR(a.RailroadCode),
      parentRailroad: normRR(a.ParentRailroadCode),
      street: a.STREET || null,
      subdivision: a.RailroadSubdivision || null,
      state: a.STATENAME || null,
      lat: g.y, lon: g.x
    };
  }).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon));
}

/**
 * Crossing impacts for one rail movement, projected ALONG THE TRACK.
 *
 * The movement is snapped to a specific rail line, then the network is walked forward from
 * that point. Everything the walk passes is ahead of the train by construction, so parallel
 * tracks, yards, diamonds and closely spaced railroads fall out geometrically. There is no
 * owner-matching heuristic any more and no bearing cone: both were proxies for track
 * identity, and this resolves track identity directly.
 *
 * If the movement cannot be put on a track, NOTHING is emitted. A position that is not near
 * rail is a position we cannot reason about, and guessing from a bearing is how a crossing
 * on the wrong railroad ends up in an operational feed.
 */
async function impactsFor(movement, opts = {}) {
  const lookaheadMi = opts.lookaheadMi || 12;
  const lat = movement && movement.location && Number(movement.location.lat);
  const lon = movement && movement.location && Number(movement.location.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { error: 'movement has no position' };

  const hdg = headingDeg(movement.direction);
  const ageS = Number(movement.freshness_seconds) || 0;
  const lookaheadM = lookaheadMi * MI_TO_M;

  // Observed along-track speed, where two sightings allow it, beats the reported figure --
  // it is measured over the real geometry rather than taken on trust. Falls back cleanly.
  const mph = Number(movement.observed_speed_mph) || Number(movement.speed_mph) || 0;
  const speedMethod = Number(movement.observed_speed_mph) ? 'observed-along-track' : 'reported';

  // How far the train may have moved since it was OBSERVED. For a sighting network this is
  // the dominant error term, not a rounding detail: 25 min at 40 mph is 16 miles.
  const driftMi = mph > 0 ? (mph * ageS / 3600) : null;

  const net = await loadNetworkCached(lat, lon, lookaheadM + 5000);
  const snap = railNet.snapToNetwork(net, { lat, lon }, {
    headingDeg: hdg, maxSnapM: opts.maxSnapM || 300
  });
  if (!snap) {
    return {
      movement_id: movement.train_id || null,
      source: movement.source || null,
      operator: normRR(movement.operator),
      track_owner: null,
      snapped: false,
      reason: `position is not within ${opts.maxSnapM || 300} m of active rail`,
      impacts: []
    };
  }

  const walk = railNet.traverse(net, snap, { maxDistM: lookaheadM });
  const crossings = await crossingsNear(lat, lon, lookaheadM + 2000);
  const hits = railNet.crossingsAlongPath(net, walk, crossings, { bufferM: opts.bufferM || 30 });

  const lengthFt = Number(movement.train_length_ft) || null;
  // Blockage duration follows from consist length and speed, both of which a sighting source
  // reports. No length -> no duration, rather than an invented number.
  const clearS = (lengthFt && moving) ? (lengthFt / 5280) / mph * 3600 : null;

  // A train doing 0.007 mph is stopped, not crawling. Dividing by it produced ETAs of
  // 6,000+ minutes that read as real numbers -- a station stop or a signal hold turning into
  // "this crossing will be blocked in four days". Below this, no ETA is claimed at all.
  const MIN_ETA_MPH = 3;
  const moving = mph >= MIN_ETA_MPH;

  const out = hits.map(h => {
    const mi = h.alongTrackM / MI_TO_M;
    const etaMin = moving ? (mi / mph) * 60 : null;
    return {
      event_type: 'crossing_impact',
      crossing_id: h.crossing.crossingId,
      street: h.crossing.street,
      railroad: h.crossing.railroad,
      location: { lat: h.crossing.lat, lon: h.crossing.lon },
      distance_mi: +mi.toFixed(2),
      // Never "BLOCKED": nothing in this pipeline observes occupancy.
      status: !moving ? 'STOPPED'
        : etaMin !== null && driftMi !== null && mi <= driftMi ? 'POSSIBLY_PASSED'
        : etaMin !== null && etaMin <= 10 ? 'APPROACHING'
        : 'PREDICTED',
      eta_seconds: etaMin === null ? null : Math.round(etaMin * 60),
      eta_minutes: etaMin === null ? null : +etaMin.toFixed(1),
      estimated_blockage_seconds: clearS === null ? null : Math.round(clearS),
      // Said plainly so a stopped train is not mistaken for a missing reading.
      note: moving ? null : 'train is stopped — no arrival time claimed',
      // Everything needed to audit this number after the fact. It matters more than the
      // number itself once somebody routes traffic on it.
      derivation: {
        movement_source: movement.source || null,
        operator: normRR(movement.operator),
        track_owner: h.trackOwner,
        track_type: h.trackType,
        position_observed_at: movement.observed_at || null,
        position_age_seconds: ageS || null,
        freshness_tier: movement.freshness_tier || null,
        rail_snap_method: 'active-rail-line',
        rail_snap_distance_m: snap.snapDistanceM,
        rail_snap_confidence: snap.confidence,
        parallel_track_candidates: snap.candidates,
        runner_up_distance_m: snap.runnerUpDistanceM,
        direction_method: 'along-track',
        crossing_offset_m: h.offTrackM,
        speed_method: speedMethod,
        speed_mph: mph || null,
        uncertainty_mi: driftMi === null ? null : +driftMi.toFixed(2),
        confidence: +(snap.confidence * (driftMi !== null && mi <= driftMi ? 0.5 : 1)).toFixed(3)
      }
    };
  });

  return {
    movement_id: movement.train_id || null,
    source: movement.source || null,
    operator: normRR(movement.operator),          // who is running the train
    track_owner: snap.trackOwner,                 // whose track it is on
    track_type: snap.trackType,
    snapped: true,
    snap_distance_m: snap.snapDistanceM,
    snap_confidence: snap.confidence,
    projected_mi: +(walk.reachedM / MI_TO_M).toFixed(2),
    segments_walked: walk.path.length,
    crossings_scanned: crossings.length,
    uncertainty_mi: driftMi === null ? null : +driftMi.toFixed(2),
    impacts: out
  };
}

/**
 * Impacts for many movements. Stale ones are refused unless explicitly asked for -- a stale
 * train carried forward on a plausible-looking projection is more dangerous than no train.
 */
async function impactsForAll(movements, opts = {}) {
  const usable = (movements || []).filter(m => opts.includeStale ? true : m.operational !== false);
  const batch = usable.slice(0, opts.limit || 25);

  // Bounded concurrency. This ran strictly sequentially, and each movement costs a network
  // fetch plus a crossings fetch, so 25 trains meant 25 round-trips end to end -- measured at
  // 109 s once the network fetch started paging. Six at a time keeps the external services
  // comfortable while cutting the wall-clock to a fraction of that. Order is preserved so the
  // response is stable between calls.
  const results = new Array(batch.length);
  const CONCURRENCY = 6;
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, async () => {
    while (cursor < batch.length) {
      const i = cursor++;
      try { results[i] = await impactsFor(batch[i], opts); }
      catch (_) { results[i] = null; }     // one bad movement must not stop the rest
    }
  }));
  for (let i = results.length - 1; i >= 0; i--) if (!results[i]) results.splice(i, 1);
  const impacts = results.flatMap(r => r.impacts || []);
  const snapped = results.filter(r => r.snapped);
  return {
    movements: usable.length,
    withheld_stale: (movements || []).length - usable.length,
    snapped: snapped.length,
    not_on_track: results.length - snapped.length,
    impacts_total: impacts.length,
    approaching: impacts.filter(i => i.status === 'APPROACHING').length,
    caveat: 'Predicted from observed movements projected along track. Nothing here observes occupancy \u2014 no impact means no movement was seen, not that a crossing is clear.',
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
    // operator answers WHO RUNS THE TRAIN; track_owner answers WHOSE TRACK AND CROSSINGS
    // apply. They are different questions and conflating them is what broke the first cut:
    // Amtrak owns almost no track outside the Northeast Corridor. Left null here because
    // only the snap can answer it, and the snap fills it in.
    track_owner: null,
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

/**
 * Along-track speed measured from two consecutive sightings of the same train.
 *
 * The reported speed is a spot reading and the reported heading is a compass bearing; over a
 * curve, neither describes what the train actually did between two points. Walking the
 * network from the earlier sighting to the later one gives real distance over real track,
 * divided by real elapsed time. It also cross-checks the source: if the observed speed and
 * the reported speed disagree badly, one of them is wrong and the ETA should be trusted less.
 *
 * @returns {Promise<Object|null>} null when the two sightings cannot be connected on track
 */
async function observedVelocity(prev, curr, opts = {}) {
  if (!prev || !curr) return null;
  const t0 = Date.parse(prev.observed_at), t1 = Date.parse(curr.observed_at);
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return null;
  const dtS = (t1 - t0) / 1000;
  if (dtS < 20 || dtS > 3 * 3600) return null;        // too short to be signal, too long to be one run

  const a = prev.location, b = curr.location;
  if (!a || !b) return null;
  const net = await loadNetworkCached(a.lat, a.lon, (opts.maxSearchM || 60000));
  const straightM = distM(a, b);

  // Walk from the earlier position in each direction; whichever pass comes closest to the
  // later position is the direction the train actually went, and the along-track distance at
  // that point is how far it travelled.
  let best = null;
  for (const headingDeg of [undefined, 0, 90, 180, 270]) {
    const snap = railNet.snapToNetwork(net, a, { headingDeg, maxSnapM: opts.maxSnapM || 300 });
    if (!snap) continue;
    for (const forward of [true, false]) {
      const walk = railNet.traverse(net, { ...snap, forward }, { maxDistM: Math.max(straightM * 3, 5000) });
      const hit = railNet.crossingsAlongPath(net, walk,
        [{ crossingId: '__target__', lat: b.lat, lon: b.lon }], { bufferM: opts.bufferM || 60 });
      if (!hit.length) continue;
      const cand = { alongM: hit[0].alongTrackM, snap, offM: hit[0].offTrackM };
      if (!best || cand.offM < best.offM) best = cand;
    }
  }
  if (!best) return null;

  const mph = (best.alongM / 1609.344) / (dtS / 3600);
  if (!Number.isFinite(mph) || mph < 0 || mph > 120) return null;   // implausible: reject
  const reported = Number(curr.speed_mph) || null;
  return {
    observed_speed_mph: +mph.toFixed(1),
    along_track_m: Math.round(best.alongM),
    straight_line_m: Math.round(straightM),
    // Track is never straighter than the crow flies; a ratio near 1 means tangent track,
    // well above 1 means the straight-line estimate would have understated the distance.
    sinuosity: +(best.alongM / Math.max(straightM, 1)).toFixed(2),
    elapsed_s: Math.round(dtS),
    reported_speed_mph: reported,
    // Second independent check on the source.
    agrees_with_reported: reported === null ? null : Math.abs(mph - reported) <= Math.max(5, reported * 0.25),
    track_owner: best.snap.trackOwner,
    method: 'two-sighting-along-track'
  };
}

module.exports = {
  impactsFor, impactsForAll, crossingsNear, fromAmtrakTrain, observedVelocity,
  normRR, RAILROAD_CODES, NTAD_CROSSINGS, IA_CROSSINGS, IA_RAIL_LINES
};

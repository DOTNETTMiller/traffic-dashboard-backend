/**
 * Project a moving train forward to the grade crossings ahead of it.
 *
 * Amtrak publishes positions, not crossing events -- nothing says "the gates are down".
 * Raw positions are also too coarse to stand in for that: measured on the live feed, the
 * p50 position age is 130s and the median speed 51 mph, so a bare lat/lon carries ~1.8
 * miles of uncertainty. A 1.8-mile CIRCLE overlaps dozens of unrelated crossings.
 *
 * The fix is the technique rams-chainage.js already uses for devices (Field Escort's):
 * stop reasoning in circles and reason along the line. Snapping the train to the rail
 * network turns that circle into a 1-D interval along track, which overlaps only the
 * handful of crossings actually in front of it.
 *
 * Data, both live and authoritative (USDOT BTS, National Transportation Atlas):
 *   Railroad Grade Crossings          242,108 points, CrossingID / street / railroad
 *   NARN Lines - Passenger Rail        18,214 polylines  (full network: 302,771)
 *
 * WHAT THIS CAN AND CANNOT SAY. It answers "train N reaches crossing X in about M minutes",
 * with an error band that follows from position age and speed. It does NOT say a crossing
 * is occupied now, and no amount of projection can -- that information is not in the feed.
 * Freight is not here at all, and freight causes most blockages, so treat Amtrak coverage
 * as a floor rather than a picture of the network.
 */

const CROSSINGS =
  'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Railroad_Grade_Crossings/FeatureServer/0/query';
// Passenger view (18,214 segments) rather than the full 302,771: for an Amtrak train it is
// the smaller, more relevant set. Swap to the full network when freight is added.
const RAIL_LINES =
  'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines_Passenger_Rail/FeatureServer/0/query';

const R_EARTH_M = 6371008.8;
const MI_TO_M = 1609.344;

// Amtrak reports heading as a compass point, not degrees.
const COMPASS = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
  NNE: 22.5, ENE: 67.5, ESE: 112.5, SSE: 157.5, SSW: 202.5, WSW: 247.5, WNW: 292.5, NNW: 337.5 };

const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;

function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.sqrt(s));
}

function bearingDeg(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Smallest angle between two bearings, 0..180. */
function angleDelta(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function httpsGetJSON(url, timeoutMs = 25000) {
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

/** Grade crossings inside a bounding box around a point. */
async function crossingsNear(lat, lon, radiusM) {
  const dLat = (radiusM / R_EARTH_M) * 180 / Math.PI;
  const dLon = dLat / Math.max(Math.cos(rad(lat)), 1e-6);
  const bb = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');
  const url = CROSSINGS +
    '?where=' + encodeURIComponent("CrossingPosition='At Grade'") +
    '&geometry=' + encodeURIComponent(bb) +
    '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
    '&outFields=' + encodeURIComponent('CrossingID,STREET,HighwayName,RailroadCode,CITYNAME,StateAbbreviation,CrossingType') +
    '&returnGeometry=true&outSR=4326&resultRecordCount=1000&f=json';
  const j = await httpsGetJSON(url);
  return ((j && j.features) || []).map(f => ({
    crossingId: f.attributes.CrossingID,
    street: f.attributes.STREET || f.attributes.HighwayName || null,
    railroad: f.attributes.RailroadCode || null,
    city: f.attributes.CITYNAME || null,
    state: f.attributes.StateAbbreviation || null,
    type: f.attributes.CrossingType || null,
    lat: f.geometry && f.geometry.y,
    lon: f.geometry && f.geometry.x
  })).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon));
}

/** Metres from a point to a polyline, and the nearest vertex index. */
function distToPath(pt, path) {
  const k = Math.cos(rad(pt.lat)) * 111320, k2 = 110540;
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const ax = (path[i - 1][0] - pt.lon) * k, ay = (path[i - 1][1] - pt.lat) * k2;
    const bx = (path[i][0] - pt.lon) * k,     by = (path[i][1] - pt.lat) * k2;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
    let t = -(ax * dx + ay * dy) / l2; t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best) best = d;
  }
  return best;
}

/** Rail centreline segments near a point. */
async function railNear(lat, lon, radiusM) {
  const dLat = (radiusM / R_EARTH_M) * 180 / Math.PI;
  const dLon = dLat / Math.max(Math.cos(rad(lat)), 1e-6);
  const bb = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');
  const url = RAIL_LINES +
    '?where=1%3D1&geometry=' + encodeURIComponent(bb) +
    '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
    '&outFields=' + encodeURIComponent('FRAARCID,RROWNER1,TRKRGHTS1') +
    '&returnGeometry=true&outSR=4326&resultRecordCount=600&f=json';
  const j = await httpsGetJSON(url);
  const out = [];
  for (const f of ((j && j.features) || [])) {
    for (const path of ((f.geometry && f.geometry.paths) || [])) {
      if (path.length > 1) out.push({ id: f.attributes.FRAARCID, owner: f.attributes.RROWNER1, path });
    }
  }
  return out;
}

/**
 * Crossings ahead of a train, with an ETA and an honest error band.
 *
 * @param {Object} train  { lat, lon, heading ('NW'|deg), velocity (mph), updatedAt }
 * @param {Object} opts   { lookaheadMi=15, coneDeg=55, now }
 */
async function crossingsAhead(train, opts = {}) {
  const lookaheadMi = opts.lookaheadMi || 15;
  const coneDeg = opts.coneDeg || 55;
  const now = opts.now ? new Date(opts.now).getTime() : Date.now();

  const lat = Number(train.lat), lon = Number(train.lon);
  const mph = Number(train.velocity) || 0;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { error: 'no position' };

  const hdg = typeof train.heading === 'number'
    ? train.heading
    : COMPASS[String(train.heading || '').toUpperCase()];
  if (hdg === undefined) return { error: 'no heading' };

  // How stale is the fix, and how far could the train have travelled since?
  const ageS = train.updatedAt ? Math.max(0, (now - Date.parse(train.updatedAt)) / 1000) : null;
  const driftMi = (ageS !== null && mph > 0) ? (mph * ageS / 3600) : null;

  const [all, rails] = await Promise.all([
    crossingsNear(lat, lon, lookaheadMi * MI_TO_M),
    railNear(lat, lon, lookaheadMi * MI_TO_M).catch(() => [])
  ]);
  const here = { lat, lon };

  // Field Escort's refinement: a cone still sweeps in crossings on OTHER railroads' track,
  // which in a rail hub is most of them. Snap the train to the nearest centreline and keep
  // only crossings sitting on that same line -- the difference between "somewhere in this
  // wedge" and "on the track this train is actually on". Degrades to the cone alone if the
  // rail layer is unreachable, never blocks.
  let onTrack = null;
  if (rails.length) {
    let best = null, bestD = Infinity;
    for (const r of rails) {
      const d = distToPath(here, r.path);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (best && bestD <= 250) onTrack = best;      // 250m: the train really is on this line
  }

  // One NARN segment is short, so snapping to a single arc only reaches the first crossing
  // or two. Extend along the SAME OWNER's segments in the box: that is the line the train is
  // running on, and it keeps the other railroads in a hub out. Direction is still handled by
  // the cone, so this widens the reach without widening what counts as "this track".
  const corridor = onTrack
    ? rails.filter(r => !onTrack.owner || r.owner === onTrack.owner)
    : [];
  const onCorridor = (c) => {
    if (!corridor.length) return true;             // no rail data: fall back to the cone
    for (const r of corridor) {
      if (distToPath({ lat: c.lat, lon: c.lon }, r.path) <= 150) return true;
    }
    return false;
  };

  const ahead = [];
  for (const c of all) {
    if (onTrack && !onCorridor(c)) continue;
    const d = distanceM(here, { lat: c.lat, lon: c.lon });
    const b = bearingDeg(here, { lat: c.lat, lon: c.lon });
    const off = angleDelta(hdg, b);
    if (off > coneDeg) continue;                    // behind, or off to the side
    const mi = d / MI_TO_M;
    if (mi > lookaheadMi) continue;
    ahead.push({
      ...c,
      distanceMi: +mi.toFixed(2),
      bearingOffDeg: Math.round(off),
      // ETA from the LAST REPORTED position; if the fix is stale the train is already
      // closer than this, which is why driftMi is reported alongside.
      etaMin: mph > 0 ? +((mi / mph) * 60).toFixed(1) : null
    });
  }
  ahead.sort((a, b) => a.distanceMi - b.distanceMi);
  return {
    train: train.trainNum || null,
    route: train.routeName || null,
    speedMph: Math.round(mph),
    heading: train.heading,
    positionAgeS: ageS === null ? null : Math.round(ageS),
    // The honest uncertainty: at this speed, this is how far the train may have moved
    // since the fix. Any ETA below this is inside the noise.
    driftMi: driftMi === null ? null : +driftMi.toFixed(2),
    crossingsScanned: all.length,
    railSegmentsNear: rails.length,
    snappedToTrack: onTrack ? { arcId: onTrack.id, owner: onTrack.owner || null, corridorSegments: corridor.length } : null,
    ahead
  };
}

module.exports = { crossingsAhead, crossingsNear, distanceM, bearingDeg, angleDelta, CROSSINGS };

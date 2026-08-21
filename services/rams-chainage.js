/**
 * RAMS linear-referencing chainage for device↔work-zone matches (Iowa).
 *
 * Straight-line distance under-states how far a device really is along the road.
 * This snaps both the device and the zone onto the Iowa DOT RAMS Road Network
 * centerline (M-aware polylines, measures in miles) and, when both resolve to the
 * SAME ROUTEID, returns the true along-road distance by subtracting mileposts —
 * Field Escort's technique. Different ROUTEIDs (or a miss) → null, and the caller
 * keeps the straight-line figure (never mixed).
 *
 * Used as a fail-safe REFINEMENT pass after matching: it re-checks the `far` gate
 * with real chainage and adds an independent same-ROUTEID confirmation. Any RAMS
 * outage degrades to straight-line — it never breaks matching.
 */

const https = require('https');
const turf = require('@turf/turf');

const RAMS_URL = 'https://gis.iowadot.gov/agshost/rest/services/RAMS/Road_Network/FeatureServer/0/query';
const SNAP_M = 150;                 // max snap distance to accept a centerline hit
const MI_TO_M = 1609.344;

const cache = new Map();            // rounded-coord → measure result (route geometry is static)
const keyOf = (lon, lat) => `${lon.toFixed(4)},${lat.toFixed(4)}`;

function getJSON(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('RAMS parse')); } });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('RAMS timeout')); });
  });
}

// Interpolate the M (milepost) value at a snapped point on an [lon,lat,m] path.
function interpMeasure(path, snap) {
  const i = snap.properties.index;
  const a = path[i], b = path[i + 1] || path[i];
  const ma = a[2], mb = b[2];
  if (ma == null && mb == null) return null;
  if (ma == null || mb == null) return ma != null ? ma : mb;
  const segLen = turf.distance([a[0], a[1]], [b[0], b[1]], { units: 'meters' }) || 1;
  const dAlong = turf.distance([a[0], a[1]], snap.geometry.coordinates, { units: 'meters' });
  const frac = Math.min(1, Math.max(0, dAlong / segLen));
  return ma + frac * (mb - ma);
}

// Nearest RAMS route + milepost at a WGS84 point, or null. Cached.
async function measureAt(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const k = keyOf(lon, lat);
  if (cache.has(k)) return cache.get(k);
  let result = null;
  try {
    const dd = 0.0025; // ~250 m envelope
    const env = JSON.stringify({ xmin: lon - dd, ymin: lat - dd, xmax: lon + dd, ymax: lat + dd, spatialReference: { wkid: 4326 } });
    const url = `${RAMS_URL}?geometry=${encodeURIComponent(env)}&geometryType=esriGeometryEnvelope`
      + `&spatialRel=esriSpatialRelIntersects&outFields=ROUTEID,ROUTEID_NAME&returnGeometry=true&returnM=true`
      + `&outSR=4326&f=json&resultRecordCount=50`;
    const j = await getJSON(url);
    const pt = turf.point([lon, lat]);
    let best = null, bestD = Infinity;
    for (const f of (j.features || [])) {
      const paths = f.geometry && f.geometry.paths;
      if (!paths) continue;
      for (const path of paths) {
        if (path.length < 2) continue;
        const line = turf.lineString(path.map((v) => [v[0], v[1]]));
        const snap = turf.nearestPointOnLine(line, pt, { units: 'meters' });
        if (snap.properties.dist < bestD) { bestD = snap.properties.dist; best = { f, path, snap }; }
      }
    }
    if (best && bestD <= SNAP_M) {
      const m = interpMeasure(best.path, best.snap);
      if (m != null) result = { routeId: String(best.f.attributes.ROUTEID), measureMi: m, snapDistM: Math.round(bestD) };
    }
  } catch (_) { result = null; }
  cache.set(k, result);
  return result;
}

// Along-road distance (metres) between two points if they share a ROUTEID, else null.
async function chainageMeters(a, b) {
  if (!a || !b) return null;
  const [ma, mb] = await Promise.all([measureAt(a[0], a[1]), measureAt(b[0], b[1])]);
  if (!ma || !mb || ma.routeId !== mb.routeId) return null;
  return Math.abs(ma.measureMi - mb.measureMi) * MI_TO_M;
}

/**
 * Refine a match result in place with RAMS chainage. For each link/review record:
 * sets distance_basis ('route-measure' | 'straight-line'), chainageM, sameRouteId,
 * and re-checks `far` using real along-road distance — demoting a link to review if
 * the road distance exceeds farM. Never throws; returns the (possibly re-bucketed)
 * { links, review, unmatched }.
 */
async function refine(match, opts = {}) {
  const farM = opts.farM || 800;
  try {
    const recs = [...(match.links || []), ...(match.review || [])];
    // Warm the cache for every unique point in parallel.
    const pts = new Map();
    for (const r of recs) {
      if (r.deviceCoord) pts.set(keyOf(r.deviceCoord[0], r.deviceCoord[1]), r.deviceCoord);
      if (r.zoneRef) pts.set(keyOf(r.zoneRef[0], r.zoneRef[1]), r.zoneRef);
    }
    await Promise.all([...pts.values()].map((c) => measureAt(c[0], c[1])));

    for (const r of recs) {
      const ch = await chainageMeters(r.deviceCoord, r.zoneRef); // cached → no new network
      if (ch != null) {
        r.chainageM = Math.round(ch);
        r.distance_basis = 'route-measure';
        r.sameRouteId = true;
        r.reasons = [...(r.reasons || []), `along-road ${r.chainageM}m`];
        r.far = ch > farM;
      } else {
        r.distance_basis = 'straight-line';
        r.sameRouteId = false;
      }
    }

    // Re-bucket: a link whose true road distance is now `far` drops to review.
    const links = [], review = [...(match.review || [])];
    for (const r of (match.links || [])) {
      if (r.far) { r.reasons = [...(r.reasons || []), 'far by road-measure']; review.push(r); }
      else links.push(r);
    }
    return { links, review, unmatched: match.unmatched || [] };
  } catch (_) {
    return match; // RAMS unavailable → keep straight-line result untouched
  }
}

module.exports = { refine, chainageMeters, measureAt, RAMS_URL };

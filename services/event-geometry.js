/**
 * Treat a closure as the LINE it is, not as one point.
 *
 * A work zone is a stretch of road — often miles of it — and every event in this system
 * carries real geometry for that stretch. Both camera validators were nevertheless matching
 * against a single coordinate, which caused two distinct failures:
 *
 *   1. matchCamera() read `event.coordinates`, a field present on only 1,505 of 6,226 events.
 *      For the other 76% it returned null before it ever looked at a camera — so the fixed
 *      camera validator was blind to most closures for want of a centroid, not for want of a
 *      camera.
 *
 *   2. The fleet frame gate measured the bearing from the truck to that one point. A truck
 *      87 m from a reported point but INSIDE a mile-long zone got a bearing of 156° — the
 *      point was behind it while the work was plainly ahead — and a frame that visibly showed
 *      the zone was rejected.
 *
 * Both are answered by asking "how far is this camera from the closure?" instead of "how far
 * is it from the closure's centroid?", and by taking the bearing to the NEAREST PART of the
 * closure rather than to its midpoint.
 *
 * SAMPLED, NEVER WALKED WHOLE. These geometries total 567,505 vertices, with one event
 * carrying 5,241 on its own. Touching every vertex for every camera is the O(n x m x vertices)
 * shape that has already taken this service down once, so geometry is reduced to points spaced
 * a set distance apart, capped, and cached per event object. Spacing is chosen by the caller to
 * be finer than its own match radius, so nothing within that radius can fall between samples.
 */

// Cached per event object, so a refresh that builds new objects drops the old entries on its
// own. A WeakMap rather than a property: nothing here should ever reach a feed or a response.
const cache = new WeakMap();

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

/** Metres between two lon/lat pairs. Equirectangular — exact enough at these distances and
 *  roughly forty times cheaper than a great-circle call, which matters at this call volume. */
function metres(lon1, lat1, lon2, lat2) {
  const x = rad(lon2 - lon1) * Math.cos(rad((lat1 + lat2) / 2));
  const y = rad(lat2 - lat1);
  return Math.sqrt(x * x + y * y) * R;
}

/** Every coordinate ring in a geometry, whatever its type, as arrays of [lon,lat]. */
function rings(geom) {
  if (!geom) return [];
  const t = geom.type, c = geom.coordinates;
  if (!Array.isArray(c)) return [];
  if (t === 'Point') return [[c]];
  if (t === 'MultiPoint' || t === 'LineString') return [c];
  if (t === 'MultiLineString') return c;
  if (t === 'Polygon') return c;
  if (t === 'MultiPolygon') return c.flat();
  return [];
}

const isPt = (p) => Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1]);

/**
 * Points along the closure, spaced at most `spacingM` apart.
 *
 * Falls back to whatever single point the event has if it carries no usable geometry, so a
 * caller never has to special-case the old shape.
 */
function samplePoints(ev, opts = {}) {
  if (!ev) return [];
  const spacingM = opts.spacingM || 250;
  const maxPts = opts.maxPts || 120;
  const key = spacingM + ':' + maxPts;
  let byKey = cache.get(ev);
  if (byKey && byKey[key]) return byKey[key];

  const out = [];
  for (const ring of rings(ev.geometry)) {
    let carried = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      if (!isPt(p)) continue;
      const pt = [+p[0], +p[1]];
      if (!out.length) { out.push(pt); continue; }
      const prev = ring[i - 1];
      if (isPt(prev)) carried += metres(+prev[0], +prev[1], pt[0], pt[1]);
      // Always keep the last vertex of a ring: the end of a closure is exactly where a camera
      // is most likely to be looking, and dropping it would blind the match to the tail.
      if (carried >= spacingM || i === ring.length - 1) { out.push(pt); carried = 0; }
      if (out.length >= maxPts) break;
    }
    if (out.length >= maxPts) break;
  }

  if (!out.length) {
    const p = ev.coordinates || (ev.longitude != null ? [ev.longitude, ev.latitude] : null);
    if (isPt(p)) out.push([+p[0], +p[1]]);
  }

  if (!byKey) { byKey = {}; cache.set(ev, byKey); }
  byKey[key] = out;
  return out;
}

/**
 * Nearest sampled point of the closure to a given position.
 * @returns {{distanceM:number, point:[number,number]}|null}
 */
function nearestOn(ev, lat, lon, opts = {}) {
  const pts = samplePoints(ev, opts);
  let best = null, bestD = Infinity;
  for (const p of pts) {
    const d = metres(lon, lat, p[0], p[1]);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best ? { distanceM: bestD, point: best } : null;
}

/** True bearing in degrees from a to b. */
function bearing(lon1, lat1, lon2, lat2) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) -
    Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Smallest angle between two bearings, 0-180. */
function bearingDelta(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

module.exports = { samplePoints, nearestOn, metres, bearing, bearingDelta };

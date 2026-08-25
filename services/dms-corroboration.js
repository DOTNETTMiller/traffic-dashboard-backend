/**
 * Independent secondary validation for WZDx work zones using DMS message text.
 *
 * A Dynamic Message Sign displaying a work-zone / closure message near a zone is
 * evidence a human operator posted about that closure — a DIFFERENT operational
 * system than the WZDx feed being validated, driven by a person, not the same
 * automated export. When a DMS within a few miles of an active zone (same
 * interstate when known) shows "ROAD WORK", "LANE CLOSED", "CLOSED AT…",
 * "FOLLOW DETOUR", etc., that corroborates the zone.
 *
 * Positive-only (like the camera + TomTom validators): a match ELEVATES a zone;
 * the absence of a matching DMS never demotes one. Cheap — a handful of CORS-open
 * ArcGIS/511 queries, cached; no per-zone calls.
 */

const turf = require('@turf/turf');
const { isActiveNow } = require('./camera-validation');

// Message text that indicates the sign is talking about a work zone / closure.
const WZ_RE = /ROAD ?WORK|WORK ?ZONE|LANE (CLOSED|CLOSURE)|(RIGHT|LEFT|CENTER) LANE|SHOULDER (CLOSED|WORK)|CONSTRUCTION|ROAD ?CLOSED|CLOSED ?AT|\bCLOSED\b|DETOUR|REDUCED? SPEED|EXPECT DELAY|\bMERGE\b|WORKERS?|PAVING|BRIDGE WORK/i;

function interstate(s) {
  const m = String(s || '').toUpperCase().match(/\bI[-\s]?(\d{1,3})\b/);
  return m ? `I-${parseInt(m[1], 10)}` : null;
}
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

// ---- sign source (cached; lazy) --------------------------------------------
let signCache = { signs: [], timestamp: 0 };
const SIGN_TTL = 10 * 60 * 1000; // 10 min

function getJSON(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      let body = ''; res.on('data', d => body += d);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
  });
}

// Iowa DMS_View — CORS-open, no key. All boards (incl. permanent), with live msgtext.
async function fetchIowaSigns() {
  const url = 'https://services.arcgis.com/8lRhdTsQyJpO52F1/ArcGIS/rest/services/DMS_View/FeatureServer/0/query'
    + '?where=1%3D1&outFields=DeviceName,Route,msgtext,lat_,long_&returnGeometry=false&resultRecordCount=2000&f=json';
  const j = await getJSON(url);
  return (j.features || []).map(f => {
    const a = f.attributes || {};
    const lon = parseFloat(a.long_), lat = parseFloat(a.lat_);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    return { id: `IA-DMS-${a.DeviceName || lon + ',' + lat}`, name: a.DeviceName || 'DMS',
             coordinates: [lon, lat], route: a.Route || null, message: clean(a.msgtext) };
  }).filter(Boolean);
}

// Extra states via the existing device adapters (permanent DMS with live message text).
async function fetchAdapterSigns() {
  let adapters;
  try { adapters = require('./device-adapters'); } catch (_) { return []; }
  const keys = Object.keys(adapters.ADAPTERS || {});
  const lists = await Promise.all(keys.map(k =>
    adapters.fetchState(k).then(r => Array.isArray(r) ? r : []).catch(() => [])));
  return lists.flat()
    .filter(d => d && d.deviceType === 'dms' && Array.isArray(d.coordinates) && d.mode && d.mode.pattern)
    .map(d => ({ id: `${d.state}-${d.id}`, name: d.id, coordinates: d.coordinates,
                 route: d.route || d.rawRoute || null, message: clean(d.mode.pattern) }));
}

/** Fetch DMS signs from every free source, cached for SIGN_TTL. Never throws. */
async function fetchSigns(opts = {}) {
  if (!opts.force && signCache.signs.length && Date.now() - signCache.timestamp < SIGN_TTL) return signCache.signs;
  const [iowa, others] = await Promise.all([
    fetchIowaSigns().catch(() => []),
    fetchAdapterSigns().catch(() => [])
  ]);
  signCache = { signs: [...iowa, ...others], timestamp: Date.now() };
  return signCache.signs;
}

/**
 * Stamp x_dms_corroborated on each active event that a DMS within maxM metres
 * (same interstate when both name one) is displaying a work-zone message for.
 * @returns {number} count corroborated
 */
function corroborate(events, signs, opts = {}) {
  const maxM = opts.maxM || 8000; // ~5 mi — DMS warn upstream of a closure
  const wz = (signs || []).filter(s =>
    Array.isArray(s.coordinates) && s.message && WZ_RE.test(s.message));
  if (!wz.length) return 0;

  let n = 0;
  for (const ev of (events || [])) {
    if (isActiveNow(ev) !== true) continue;
    const evPt = ev.coordinates || (ev.longitude != null ? [ev.longitude, ev.latitude] : null);
    if (!Array.isArray(evPt)) continue;
    const evRoute = interstate(ev.corridor || ev.route || ev.location);

    let best = null, bestD = Infinity;
    for (const s of wz) {
      const sRoute = interstate(s.route) || interstate(s.message);
      if (evRoute && sRoute && sRoute !== evRoute) continue;
      const d = turf.distance(turf.point(evPt), turf.point(s.coordinates), { units: 'meters' });
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best && bestD <= maxM) {
      ev.x_dms_corroborated = true;
      ev.x_dms_message = best.message.slice(0, 120);
      ev.x_dms_name = best.name;
      ev.x_dms_id = best.id;
      ev.x_dms_distance_m = Math.round(bestD);
      if (!ev.x_zone_activity || ev.x_zone_activity === 'suspect-inactive') ev.x_zone_activity = 'confirmed-active';
      n++;
    }
  }
  return n;
}

module.exports = { corroborate, fetchSigns, WZ_RE };

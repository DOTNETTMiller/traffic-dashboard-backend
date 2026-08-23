/**
 * Traffic-camera inventory adapters (locations + snapshot URLs), per state.
 *
 * Feeds the camera-validation service. Camera LOCATIONS are static, so the combined
 * inventory is cached (module-level, long TTL) and fetched lazily on first use — no
 * timer, no loop. Snapshots themselves are fetched on-demand by camera-validation.detect().
 *
 * Normalized camera: { id, state, route, direction, milepost, coordinates:[lon,lat],
 *                      imageUrl, desc }.
 * Add a state = one entry in ADAPTERS (see docs from the camera-feed survey).
 */

const https = require('https');

function getJSON(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('parse')); } });
    }).on('error', reject).setTimeout(timeoutMs, function () { this.destroy(); reject(new Error('timeout')); });
  });
}

// California — CWWP2 per-district CCTV JSON (public, no key). static.currentImageURL snapshot.
async function california() {
  const districts = await Promise.all(Array.from({ length: 12 }, (_, i) => {
    const n = i + 1, dd = String(n).padStart(2, '0');
    return getJSON(`https://cwwp2.dot.ca.gov/data/d${n}/cctv/cctvStatusD${dd}.json`, 10000).catch(() => ({ data: [] }));
  }));
  const out = [];
  for (const j of districts) {
    for (const item of (j.data || [])) {
      const c = item.cctv;
      if (!c || String(c.inService) === 'false') continue;
      const loc = c.location || {};
      const img = c.imageData && c.imageData.static && c.imageData.static.currentImageURL;
      const lon = parseFloat(loc.longitude), lat = parseFloat(loc.latitude);
      if (!img || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      out.push({
        id: `CA-CCTV-${c.index || loc.locationName}`, state: 'CA',
        route: loc.route, direction: loc.direction, milepost: loc.milepost,
        coordinates: [lon, lat], imageUrl: img, desc: loc.locationName
      });
    }
  }
  return out;
}

// Generic ArcGIS FeatureServer camera adapter (field-mapped).
async function arcgisCameras(cfg) {
  const sep = cfg.url.includes('?') ? '&' : '?';
  const j = await getJSON(`${cfg.url}${sep}where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json&resultRecordCount=${cfg.max || 4000}`);
  const out = [];
  for (const f of (j.features || [])) {
    const a = f.attributes || {}, g = f.geometry || {};
    const lon = a[cfg.lonField] != null ? +a[cfg.lonField] : g.x;
    const lat = a[cfg.latField] != null ? +a[cfg.latField] : g.y;
    const img = a[cfg.imageField];
    if (!img || !/^https?:/i.test(String(img)) || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (cfg.blockedField && String(a[cfg.blockedField]).toLowerCase() === 'true') continue;
    out.push({
      id: `${cfg.state}-CAM-${a[cfg.idField]}`, state: cfg.state,
      route: cfg.routeField ? a[cfg.routeField] : null,
      direction: cfg.dirField ? a[cfg.dirField] : null,
      coordinates: [lon, lat], imageUrl: img, desc: cfg.descField ? a[cfg.descField] : null
    });
  }
  return out;
}

// New York — 511NY getcameras (keyless GET); snapshot in the record's Url field.
async function newyork() {
  const j = await getJSON('https://511ny.org/api/getcameras?format=json', 15000);
  const out = [];
  for (const c of (Array.isArray(j) ? j : [])) {
    if (c.Disabled || c.Blocked || !c.Url) continue;
    const lon = +c.Longitude, lat = +c.Latitude;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    out.push({ id: `NY-CAM-${c.ID}`, state: 'NY', route: c.RoadwayName, direction: c.DirectionOfTravel, coordinates: [lon, lat], imageUrl: c.Url, desc: c.Name });
  }
  return out;
}

// Minnesota — CARS cameras_v1 (keyless GET). routeId lives inside location; still image is a
// STILL_IMAGE view, else the public.carsprogram.org snapshot for the camera name.
async function minnesota() {
  const j = await getJSON('https://mntg.carsprogram.org/cameras_v1/api/cameras', 15000);
  const arr = Array.isArray(j) ? j : (j.cameras || j.data || []);
  const out = [];
  for (const c of arr) {
    if (c.public === false) continue;
    const loc = c.location || {};
    const lon = +loc.longitude, lat = +loc.latitude;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const still = (c.views || []).find(v => /still|image/i.test(v.type || ''));
    const img = still ? still.url : `https://public.carsprogram.org/cameras/MN/${c.name}`;
    out.push({ id: `MN-CAM-${c.id || c.name}`, state: 'MN', route: loc.routeId, coordinates: [lon, lat], imageUrl: img, desc: c.name });
  }
  return out;
}

// IBI511 platform (511PA, DriveNC, …): DataTables POST + /map/Cctv/{id} snapshots. Paged.
function postForm(url, body, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers: {
      'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest',
      'Content-Length': Buffer.byteLength(body)
    } }, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('parse')); } }); });
    req.on('error', reject);
    req.setTimeout(timeoutMs, function () { this.destroy(); reject(new Error('timeout')); });
    req.write(body); req.end();
  });
}
function wktLonLat(latLng) {
  const w = latLng && latLng.geography && latLng.geography.wellKnownText;
  const m = w && w.match(/POINT\s*\(([-\d.]+)\s+([-\d.]+)\)/i);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
}
async function ibi511Cameras(cfg) {
  const out = []; let start = 0, total = Infinity;
  while (start < total && start < 20000) {
    const j = await postForm(`${cfg.base}/List/GetData/Cameras`, `draw=1&start=${start}&length=1000`).catch(() => ({ data: [] }));
    const rows = j.data || [];
    total = j.recordsTotal || (start + rows.length);
    if (!rows.length) break;
    for (const c of rows) {
      const ll = wktLonLat(c.latLng);
      const im = (c.images || []).map(i => i.imageUrl).find(Boolean);
      if (!ll || !im) continue;
      out.push({ id: `${cfg.state}-CAM-${c.id}`, state: cfg.state, route: c.roadway, direction: c.direction,
        coordinates: ll, imageUrl: /^https?:/i.test(im) ? im : `${cfg.base}${im}`, desc: c.location || c.cameraName });
    }
    start += rows.length;
  }
  return out;
}

// Texas — City of Austin open data (Socrata, keyless). Snapshot at cctv.austinmobility.io.
async function austin() {
  const j = await getJSON('https://data.austintexas.gov/resource/b4k4-adkb.json?$limit=2000', 15000);
  const out = [];
  for (const c of (Array.isArray(j) ? j : [])) {
    const coords = c.location && c.location.coordinates;
    if (!coords || coords.length < 2) continue;
    const lon = +coords[0], lat = +coords[1];
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (/turned off|down/i.test(c.camera_status || '')) continue;
    out.push({ id: `TX-CAM-${c.camera_id}`, state: 'TX', route: c.primary_st,
      coordinates: [lon, lat], imageUrl: `https://cctv.austinmobility.io/image/${c.camera_id}.jpg`, desc: c.location_name });
  }
  return out;
}

// Registry — keyless, verified public feeds (camera-feed survey 2026-08). Extend as more land.
const ADAPTERS = {
  ny: newyork,
  mn: minnesota,
  pa: () => ibi511Cameras({ state: 'PA', base: 'https://www.511pa.com' }),
  nc: () => ibi511Cameras({ state: 'NC', base: 'https://www.drivenc.gov' }),
  az: () => ibi511Cameras({ state: 'AZ', base: 'https://az511.com' }),
  me: () => ibi511Cameras({ state: 'ME', base: 'https://newengland511.org' }),
  ga: () => ibi511Cameras({ state: 'GA', base: 'https://511ga.org' }),
  tx: austin,
  ca: california,
  ia: () => arcgisCameras({ state: 'IA',
    url: 'https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Traffic_Cameras_View/FeatureServer/0/query',
    latField: 'latitude', lonField: 'longitude', imageField: 'ImageURL', routeField: 'Route', idField: 'COMMON_ID', descField: 'ImageName' }),
  fl: () => arcgisCameras({ state: 'FL',
    url: 'https://gis.fdot.gov/arcgis/rest/services/DIVAS_Cameras/FeatureServer/0/query',
    latField: 'latitude', lonField: 'longitude', imageField: 'imagefilename', routeField: 'highway', dirField: 'direction', idField: 'id', descField: 'description', blockedField: 'blockedimage' })
};

// Cached combined inventory (locations static → cache long; lazy, no loop).
let cache = { list: [], at: 0, ttl: 30 * 60 * 1000 };
async function getCameras(force = false) {
  if (!force && cache.list.length && (Date.now() - cache.at) < cache.ttl) return cache.list;
  const names = Object.keys(ADAPTERS);
  const results = await Promise.all(names.map((n) => ADAPTERS[n]().catch(() => [])));
  cache = { list: results.flat(), at: Date.now(), ttl: cache.ttl };
  return cache.list;
}

module.exports = { getCameras, ADAPTERS };

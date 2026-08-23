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

// Registry — extend with survey-confirmed feeds (IA/FL/NY/WA/OH/…).
const ADAPTERS = { ca: california };

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

/**
 * Rail track geometry for the map.
 *
 * The rail layer drew crossings and trains but never the RAIL ITSELF, which makes both of
 * them hard to read: a train marker floating on a road map gives no sense of where it can
 * actually go, and a crossing is just a dot until you can see the line it sits on.
 *
 * Source is BTS/NTAD's North American Rail Network, which is national -- unlike Iowa's
 * Rail_Line_Active_View, which is richer (it carries TRACK_TYPE and a cleaner owner) but
 * stops at the state line. Corridor work crosses state lines, so national wins here.
 *
 * VOLUME IS THE WHOLE DESIGN PROBLEM. NARN holds ~302,000 line features. Sending them to a
 * browser is not an option, so this is strictly bbox-scoped and capped, and the client only
 * asks once the map is zoomed in far enough to be looking at a corridor rather than the
 * continent. Track does not move, so results cache for a long time and repeated panning
 * over the same ground costs nothing.
 */

const NARN_URL =
  'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines/FeatureServer/0/query';

// NARN's network class. Main line is what matters for through movements; yard and industrial
// track is drawn thinner so a junction does not read as six mainlines.
const NET_LABEL = { M: 'main', S: 'siding', Y: 'yard', I: 'industrial', O: 'other', A: 'abandoned' };

const TTL_MS = 12 * 60 * 60 * 1000;      // track does not move
const MAX_CACHE = 60;
const cache = new Map();

function httpsGetJSON(url, timeoutMs = 45000) {
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
 * Track within a bounding box, as GeoJSON.
 * @param {Object} bbox {minLon,minLat,maxLon,maxLat}
 * @param {Object} opts {limit, mainOnly}
 */
async function fetchLines(bbox, opts = {}) {
  const limit = Math.min(opts.limit || 1200, 2000);
  const mainOnly = !!opts.mainOnly;
  // Round the key so small pans reuse the same fetch instead of re-querying constantly.
  const k = [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat].map(v => v.toFixed(2)).join(',') + `|${limit}|${mainOnly}`;
  const hit = cache.get(k);
  if (hit && (Date.now() - hit.at) < TTL_MS) return hit.data;

  const env = [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat].join(',');
  const where = mainOnly ? "NET='M'" : '1=1';
  const url = NARN_URL +
    '?where=' + encodeURIComponent(where) +
    '&geometry=' + encodeURIComponent(env) +
    '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
    '&outFields=' + encodeURIComponent('RROWNER1,RROWNER2,TRACKS,NET,SUBDIV,MILES,STATEAB') +
    '&returnGeometry=true&outSR=4326&resultRecordCount=' + limit + '&f=json';

  const j = await httpsGetJSON(url);
  if (j && j.error) throw new Error(j.error.message || 'NARN query failed');

  const features = [];
  for (const f of (j.features || [])) {
    const a = f.attributes || {};
    for (const path of ((f.geometry && f.geometry.paths) || [])) {
      if (!path || path.length < 2) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: path.map(p => [p[0], p[1]]) },
        properties: {
          owner: a.RROWNER1 || null,
          owner2: a.RROWNER2 || null,
          // Trackage rights: a second owner on the same segment is exactly the case that
          // makes "whose track is this" more than a single string.
          shared: !!a.RROWNER2,
          net: a.NET || null,
          netLabel: NET_LABEL[a.NET] || 'other',
          tracks: a.TRACKS ?? null,
          subdivision: a.SUBDIV || null,
          miles: a.MILES ?? null,
          state: a.STATEAB || null
        }
      });
    }
  }
  const data = {
    type: 'FeatureCollection',
    features,
    truncated: !!j.exceededTransferLimit,
    source: 'BTS/NTAD North American Rail Network'
  };
  cache.set(k, { at: Date.now(), data });
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  return data;
}

module.exports = { fetchLines, NARN_URL, NET_LABEL };

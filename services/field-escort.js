/**
 * Field Escort — slow-moving farm equipment on public roads.
 *
 * Field Escort publishes a WZDx 4.2 feed of agricultural machines that are currently ON a
 * public road, built from manufacturer telematics (ISO 15143-3 / AEMP 2.0 fleet reads). A
 * combine at 3 mph on a two-lane highway is the same hazard a work zone is — a closing-speed
 * problem drivers meet around a curve — so it belongs on the corridor map beside the closures.
 *
 * WHY THIS IS PROXIED RATHER THAN FETCHED BY THE BROWSER. The feed is public and CC0, but its
 * worker's feedResponse() is the one endpoint in that service that does not send
 * Access-Control-Allow-Origin, so a cross-origin browser read is blocked. Proxying also lets
 * us slim it: the published feed is ~26 KB of full WZDx, and the map needs about a tenth of
 * that. On a service where EGRESS is the cost driver, sending less matters more than saving a
 * hop.
 *
 * NOTHING HERE POLLS. The cache is filled on demand, when someone opens the layer, and the TTL
 * simply stops a second viewer from causing a second upstream read. An idle dashboard makes no
 * requests at all.
 */

const https = require('https');

const FEED_URL = process.env.FIELD_ESCORT_FEED_URL
  || 'https://purposebuilt.systems/field-escort/feed.json';

// The publisher rebuilds at most once a minute and sets max-age=60, so anything shorter here
// would re-fetch bytes that cannot have changed.
const TTL_MS = 60_000;
let cache = { at: 0, data: null };

function getJSON(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: timeoutMs,
      headers: { 'User-Agent': 'CorridorCommunicator/1.0', Accept: 'application/json' }
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let b = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { b += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch (e) { reject(new Error('bad JSON')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * One WZDx feature -> the little the map actually draws.
 *
 * Two geometries come back and they mean different things, so both are kept and named for
 * what they are. `fix` is where the machine actually was at its last GPS report. `path` is a
 * FORWARD PROJECTION of where it is likely heading, dead-reckoned from that fix — it is a
 * prediction, not an observed track, and the popup has to say so or the line reads as truth.
 */
function toTractor(f) {
  const p = f.properties || {};
  const c = p.core_details || {};
  const g = f.geometry || {};
  const path = g.type === 'LineString' && Array.isArray(g.coordinates)
    ? g.coordinates.filter(x => Array.isArray(x) && x.length >= 2).map(x => [+x[1], +x[0]])
    : [];
  const fix = Array.isArray(p.x_fe_fix_pos) && p.x_fe_fix_pos.length >= 2
    ? [+p.x_fe_fix_pos[1], +p.x_fe_fix_pos[0]]
    : (path[0] || null);
  if (!fix) return null;
  return {
    id: f.id || null,
    name: c.name || null,
    road: (c.road_names || [])[0] || null,
    direction: c.direction || null,
    make: p.x_fe_make || null,
    model: p.x_fe_model || null,
    unit: p.x_fe_unit || null,
    speedMph: num(p.x_fe_speed_mph),
    headingDeg: num(p.x_fe_heading_deg),
    fix,
    path,
    // How much to trust the projected line, and how old the fix behind it is. A stale fix
    // with a long projection is the case worth drawing differently.
    confidence: p.x_fe_confidence || null,
    // 'road' = the projection follows the road centerline; anything else is a bearing cone.
    geometryBasis: p.x_fe_geometry_basis || null,
    fixAgeMin: num(p.x_fe_fix_age_min),
    projectionMi: num(p.x_fe_length_mi),
    routeId: p.x_fe_route_id || null,
    updated: c.update_date || null
  };
}

/**
 * The machines currently on a public road.
 *
 * Never throws: a Field Escort outage must not take a map layer down with it. On failure the
 * last good answer is served if there is one, and `stale` says so.
 */
async function fetchTractors(opts = {}) {
  const now = Date.now();
  if (!opts.force && cache.data && (now - cache.at) < TTL_MS) {
    return { ...cache.data, cached: true };
  }
  try {
    const j = await getJSON(FEED_URL, opts.timeoutMs || 8000);
    const info = j.feed_info || {};
    const tractors = (j.features || []).map(toTractor).filter(Boolean);
    const data = {
      available: true,
      tractors,
      counts: {
        onRoad: tractors.length,
        // Published by the feed itself: how many machines are connected at all, versus the
        // handful on a road right now. Without it, an empty layer reads as a broken feed
        // rather than as "no machine is on a road this minute", which is the normal state.
        connected: num(info.x_fe_connected),
        catalog: num(info.x_fe_catalog)
      },
      publisher: info.publisher || 'Field Escort',
      feedUpdated: info.update_date || null,
      stale: false
    };
    cache = { at: now, data };
    return data;
  } catch (e) {
    if (cache.data) return { ...cache.data, stale: true, reason: e.message };
    return { available: false, reason: e.message, tractors: [], counts: { onRoad: 0 } };
  }
}

module.exports = { fetchTractors, toTractor, FEED_URL };

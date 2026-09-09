/**
 * Detect a train occupying a grade crossing, using DOT cameras we already operate.
 *
 * WHY THIS EXISTS. Freight causes most crossing blockages and publishes nothing -- no
 * positions, no API, nothing behind Railinc/AAR commercial agreements. Probing confirmed
 * it: Class I endpoints return 301/403, ATCS Monitor is unreachable, and every public
 * "train" feed found (Amtraker, transitdocs) is passenger. FRA's incident reports catch
 * freight but only after somebody complains, minutes-to-hours late.
 *
 * A camera pointed near a crossing is the only way to OBSERVE rather than infer. This
 * project already runs vision on Iowa DOT stills for work-zone validation, so the pipeline
 * exists; this asks it a different question.
 *
 * COVERAGE IS THE LIMIT, AND IT IS SMALL. Measured against Iowa's 60 worst crossings:
 * 5 have a DOT camera within 500m, 9 within 1000m. So this is not a statewide freight
 * detector and must never be presented as one -- silence here means "no camera saw a
 * train", never "no train". What it does buy is live confirmation at the handful of urban
 * crossings that dominate the blockage hours, including Hubbell Avenue in Des Moines
 * (226 reported hours, camera 306m away).
 *
 * A camera near a crossing is also not necessarily pointed AT it, which is why every
 * result carries the camera distance and the model's own view of whether the crossing is
 * even visible.
 */

const { askVision } = require('./camera-validation');

const CAMERAS_URL =
  'https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Traffic_Cameras_View/FeatureServer/0/query' +
  '?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=2000&f=json';

// Deliberately asks whether the crossing is VISIBLE before asking what is on it. A model
// told to look for a train will find one; giving it an explicit "I cannot see the tracks"
// answer is what keeps a hopeful guess out of the result.
const CROSSING_PROMPT =
  'This is a roadside traffic camera still. A railroad grade crossing is reported to be near this camera. '
  + 'First decide whether any railroad track or crossing is actually VISIBLE in this image. '
  + 'If it is, decide whether a train is present, and whether it is BLOCKING the road crossing '
  + '(occupying the roadway) or merely nearby/parallel. '
  + 'Reply ONLY compact JSON: {"crossing_visible":true|false,"train_present":true|false,'
  + '"blocking_road":true|false,"train_type":"freight"|"passenger"|"unknown"|null,'
  + '"gates_down":true|false|null,"vehicles_queued":true|false,"confidence":0..1}. '
  + 'If you cannot see track or a crossing, set crossing_visible:false and everything else false/null. '
  + 'Do not guess a train from a distant line of railcars parked off the road: blocking_road means the '
  + 'train is across the road itself.';

const R = 6371008.8;
const rad = d => d * Math.PI / 180;
function distM(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function httpsGetJSON(url, timeoutMs = 30000) {
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

let camCache = { at: 0, cams: null };
const CAM_TTL = 60 * 60 * 1000;      // the camera inventory barely moves

async function fetchCameras() {
  if (camCache.cams && (Date.now() - camCache.at) < CAM_TTL) return camCache.cams;
  const j = await httpsGetJSON(CAMERAS_URL);
  const cams = ((j && j.features) || []).map(f => {
    const a = f.attributes || {}, g = f.geometry || {};
    return {
      // The layer's own field names -- Desc_ and ImageURL, not Name/URL, which is what an
      // earlier guess at this schema got wrong.
      id: a.device_id, name: a.Desc_ || a.ImageName || String(a.device_id),
      route: a.Route || null, type: a.Type || null,
      imageUrl: a.ImageURL || null,
      lat: Number(g.y ?? a.latitude), lon: Number(g.x ?? a.longitude)
    };
  }).filter(c => c.imageUrl && Number.isFinite(c.lat) && Number.isFinite(c.lon));
  camCache = { at: Date.now(), cams };
  return cams;
}

/** Pair each crossing with the nearest camera that could plausibly see it. */
async function pairWithCameras(crossings, maxM = 500) {
  const cams = await fetchCameras();
  const pairs = [];
  for (const x of (crossings || [])) {
    const lat = Number(x.latitude ?? x.lat), lon = Number(x.longitude ?? x.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    let best = null, bd = Infinity;
    for (const c of cams) {
      const d = distM({ lat, lon }, c);
      if (d < bd) { bd = d; best = c; }
    }
    if (best && bd <= maxM) pairs.push({ crossing: x, camera: best, distanceM: Math.round(bd) });
  }
  return pairs;
}

/**
 * Look at the cameras covering a set of crossings and report what is on them.
 * @returns {Promise<{checked, covered, results}>}
 */
async function detectAtCrossings(crossings, opts = {}) {
  const pairs = await pairWithCameras(crossings, opts.maxM || 500);
  const results = [];
  for (const p of pairs.slice(0, opts.limit || 12)) {
    const v = await askVision(p.camera.imageUrl, CROSSING_PROMPT, opts);
    results.push({
      crossingId: p.crossing.crossingId || p.crossing.CrossingID || null,
      street: p.crossing.street || null,
      city: p.crossing.city || null,
      blockedHoursReported: p.crossing.blockedHours ?? null,
      camera: { id: p.camera.id, name: p.camera.name, imageUrl: p.camera.imageUrl },
      cameraDistanceM: p.distanceM,
      // Every field the model gave, plus an explicit note that a negative is weak evidence.
      vision: v,
      verdict: !v.available ? 'unavailable'
        : v.crossing_visible === false ? 'crossing-not-visible'
        : v.blocking_road ? 'blocked'
        : v.train_present ? 'train-nearby'
        : 'clear'
    });
  }
  return {
    checked: pairs.length,
    covered: `${pairs.length}/${(crossings || []).length} crossings have a camera within ${opts.maxM || 500}m`,
    caveat: 'A negative means no camera saw a train, not that no train is present. Most crossings have no camera at all.',
    results
  };
}

module.exports = { detectAtCrossings, pairWithCameras, fetchCameras, CROSSING_PROMPT };

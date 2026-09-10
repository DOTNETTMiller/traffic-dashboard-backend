/**
 * Plow feeds from the CARS/OneStop 511 platform, which many states share.
 *
 * WHAT IS ACTUALLY KNOWN, because this is easy to get wrong. Probing these hosts without a
 * key returns <Error><Message>Invalid Key</Message></Error> for EVERY path -- including
 * paths that certainly do not exist, like "dashcams" and "snowplowcameras". The key check
 * runs before routing, so that response proves only that a 511 gateway is there. It does NOT
 * prove a /get/plows resource exists, and an earlier read of this project's own probing made
 * exactly that mistake.
 *
 * What IS confirmed: these hosts run the CARS/OneStop platform, their published developer
 * material documents Cameras, Message Signs and Road Conditions, and the same key unlocks
 * whatever resources a given state has enabled. Which states expose PLOWS is a per-state
 * deployment choice that cannot be determined from outside without a key.
 *
 * So this adapter is built to answer the question rather than assume it. probeStates() tries
 * each configured state and reports, per state, one of: no key / endpoint absent / N plows.
 * One call with a key settles a question that guessing cannot.
 *
 * Keys are free on registration and are read from the env, one per state. A state with no
 * key is skipped, never errored.
 *
 * The record mapper deliberately looks for an image URL too. If any state's plow records
 * carry a camera frame, that is a mobile-imagery source of the kind only Iowa, Minnesota and
 * Nebraska are currently known to publish -- so it is worth catching automatically rather
 * than discovering by hand later.
 */

const https = require('https');

// Every state confirmed to run a CARS/OneStop 511 gateway. Whether each has plows enabled
// is exactly what probeStates() is for.
const STATES = {
  ak: { name: 'Alaska', base: 'https://511.alaska.gov', keyEnv: 'AK_511_KEY' },
  az: { name: 'Arizona', base: 'https://az511.com', keyEnv: 'AZ_511_KEY' },
  ct: { name: 'Connecticut', base: 'https://ctroads.org', keyEnv: 'CT_511_KEY' },
  fl: { name: 'Florida', base: 'https://fl511.com', keyEnv: 'FL_511_KEY' },
  ga: { name: 'Georgia', base: 'https://511ga.org', keyEnv: 'GA_511_KEY' },
  id: { name: 'Idaho', base: 'https://511.idaho.gov', keyEnv: 'ID_511_KEY' },
  la: { name: 'Louisiana', base: 'https://511la.org', keyEnv: 'LA_511_KEY' },
  nv: { name: 'Nevada', base: 'https://www.nvroads.com', keyEnv: 'NV_511_KEY' },
  ny: { name: 'New York', base: 'https://511ny.org', keyEnv: 'NY_511_KEY' },
  pa: { name: 'Pennsylvania', base: 'https://www.511pa.com', keyEnv: 'PA_511_KEY' },
  ut: { name: 'Utah', base: 'https://www.udottraffic.utah.gov', keyEnv: 'UT_511_KEY' },
  wi: { name: 'Wisconsin', base: 'https://511wi.gov', keyEnv: 'WI_511_KEY' },
  // New England 511 is one system serving three states; a single key covers all of them.
  ne_eng: { name: 'Maine / New Hampshire / Vermont', base: 'https://newengland511.org', keyEnv: 'NEWENGLAND_511_KEY' }
};

const PATH = 'api/v2/get/plows';

function getText(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'CorridorCommunicator/1.0', Accept: 'application/json' } }, res => {
      let b = ''; res.setEncoding('utf8');
      res.on('data', d => { b += d; });
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

const num = v => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * One CARS plow record -> the same shape winter-road-service uses for Iowa and Utah.
 * Field names vary between deployments, so every field is tried against several spellings
 * and anything absent stays null rather than being guessed at.
 */
function toPlow(r, stateCode) {
  const lat = num(r.Latitude ?? r.latitude ?? r.Lat ?? r.lat);
  const lon = num(r.Longitude ?? r.longitude ?? r.Lon ?? r.lng ?? r.lon);
  if (lat === null || lon === null) return null;
  // If a deployment attaches a camera frame to its plows, that is mobile imagery and worth
  // surfacing automatically.
  const imageUrl = r.ImageUrl || r.imageUrl || r.CameraUrl || r.cameraUrl || r.Image || r.PhotoUrl || null;
  return {
    id: r.Id || r.id || r.VehicleId || r.vehicleId || r.Name || null,
    source: stateCode.toUpperCase(), kind: 'avl-511',
    lat, lon,
    heading: num(r.Heading ?? r.heading ?? r.Bearing),
    speedMph: num(r.Speed ?? r.speed ?? r.SpeedMph),
    status: r.Status || r.status || r.Activity || null,
    // Only Iowa is known to report blade and material. Anything not reported stays null:
    // "not reported" and "not treating" are different facts.
    plowDown: null, treating: null, material: null,
    roadTempF: num(r.RoadTemperature ?? r.roadTemp), airTempF: num(r.AirTemperature ?? r.airTemp),
    imageUrl,
    observedAt: r.LastUpdated || r.lastUpdated || r.Timestamp || r.timestamp || null
  };
}

/**
 * Plows for one state. Returns {available, plows, reason} — never throws, so one state's
 * outage or missing key cannot affect the others.
 */
async function fetchState(code, opts = {}) {
  const cfg = STATES[code];
  if (!cfg) return { available: false, reason: 'unknown state', plows: [] };
  const key = opts.key || process.env[cfg.keyEnv];
  if (!key) return { available: false, reason: `no key (set ${cfg.keyEnv})`, plows: [], state: cfg.name };
  try {
    const { status, body } = await getText(`${cfg.base}/${PATH}?key=${encodeURIComponent(key)}&format=json`);
    if (/Invalid Key|Missing Key/i.test(body)) return { available: false, reason: 'key rejected', plows: [], state: cfg.name };
    if (status !== 200) return { available: false, reason: `HTTP ${status}`, plows: [], state: cfg.name };
    let j;
    try { j = JSON.parse(body); } catch (_) {
      // A gateway that does not serve this resource tends to answer with an HTML shell.
      return { available: false, reason: 'no plow resource on this deployment', plows: [], state: cfg.name };
    }
    const rows = Array.isArray(j) ? j : (j.Plows || j.plows || j.data || []);
    const plows = rows.map(r => toPlow(r, code)).filter(Boolean);
    return {
      available: true, state: cfg.name, plows,
      // Recorded because it answers the open question of which states carry imagery.
      withImages: plows.filter(p => p.imageUrl).length
    };
  } catch (e) {
    return { available: false, reason: e.message, plows: [], state: cfg.name };
  }
}

/** Every configured state that has a key. */
async function fetchAll(opts = {}) {
  const codes = opts.states || Object.keys(STATES);
  const results = await Promise.all(codes.map(async c => [c, await fetchState(c, opts)]));
  const plows = [];
  const byState = {};
  for (const [c, r] of results) {
    byState[c] = r.available ? { plows: r.plows.length, withImages: r.withImages } : { skipped: r.reason };
    if (r.available) plows.push(...r.plows);
  }
  return { plows, byState };
}

/**
 * Settle the open question: which of these states actually serve plows, and do any of them
 * attach imagery? Run this once keys are in place.
 */
async function probeStates(opts = {}) {
  const codes = opts.states || Object.keys(STATES);
  const out = [];
  for (const c of codes) {
    const r = await fetchState(c, opts);
    out.push({
      state: STATES[c].name, code: c, keyEnv: STATES[c].keyEnv,
      status: r.available ? 'plows available' : r.reason,
      plows: r.available ? r.plows.length : 0,
      withImages: r.available ? r.withImages : 0
    });
  }
  return {
    checked: out.length,
    withPlows: out.filter(r => r.plows > 0).length,
    withImagery: out.filter(r => r.withImages > 0).length,
    note: 'A state without a key is unresolved, not negative. Whether a deployment exposes plows cannot be determined from outside without one.',
    states: out
  };
}

module.exports = { fetchState, fetchAll, probeStates, toPlow, STATES, PATH };

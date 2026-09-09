/**
 * Amtrak train positions, from Amtrak's OWN service rather than a third-party mirror.
 *
 * The rail work so far used api-v3.amtraker.com, a community mirror. It works, but it puts
 * somebody else's uptime and parsing between us and the truth, which is a poor foundation
 * for something used as a validator. Amtrak's Track Your Train map is fed by
 * maps.amtrak.com, and that is the source of record.
 *
 * The catch is that Amtrak encrypts the payload. The scheme is not a secret -- everything
 * needed to decrypt it is served publicly alongside the data, because the browser map has
 * to do exactly this -- but it is undocumented, so it is written out here:
 *
 *   1. GET /rttl/js/RoutesList.json — sum every route's ZoomLevel. That total is an INDEX.
 *   2. GET /rttl/js/RoutesList.v.json — three arrays:
 *        arr[<the sum from step 1>]  -> the key-derivation password for step 4
 *        s[ s[0].length ]            -> PBKDF2 salt   (hex)
 *        v[ v[0].length ]            -> AES IV        (hex)
 *      The salt and IV indices are self-describing: the length of element 0 tells you which
 *      element actually holds the value.
 *   3. GET /services/MapDataService/trains/getTrainsData — base64. The LAST 88 characters
 *      are a separately encrypted, pipe-delimited blob whose first field is the password
 *      for the main body; everything before it is the payload.
 *   4. Both decryptions are AES-128-CBC, key = PBKDF2-SHA1(password, salt, 1000 iters,
 *      16 bytes), with the IV from step 2.
 *
 * Credit for working the scheme out goes to github.com/mgwalker/amtrak-api. That repository
 * carries NO licence, so none of its code is copied here -- this is an independent
 * implementation of the protocol described above, which is why the steps are spelled out
 * rather than referenced.
 *
 * Lazy and cheap: one 1MB fetch, cached. Falls back to returning null so callers can keep
 * using the mirror if Amtrak changes the scheme, which they may without warning.
 */

const crypto = require('crypto');

const ROUTES_LIST = 'https://maps.amtrak.com/rttl/js/RoutesList.json';
const ROUTES_KEYS = 'https://maps.amtrak.com/rttl/js/RoutesList.v.json';
const TRAINS_DATA = 'https://maps.amtrak.com/services/MapDataService/trains/getTrainsData';

// The trailing segment carrying the per-response password: 64 base64 chars padded to 88.
const MASTER_SEGMENT = 88;
const TTL_MS = 60 * 1000;            // positions update every couple of minutes upstream

let keyCache = null;
let dataCache = { at: 0, trains: null };

function httpsGetText(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const req = require('https').get(url, {
      timeout: timeoutMs,
      headers: { 'User-Agent': 'CorridorCommunicator/1.0' }
    }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', d => { buf += d; });
      res.on('end', () => resolve(buf));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

/** Steps 1-2: the password, salt and IV Amtrak publishes for its own map. */
async function getKeys() {
  if (keyCache) return keyCache;
  const routes = JSON.parse(await httpsGetText(ROUTES_LIST));
  const zoomSum = routes.reduce((sum, r) => sum + (r && typeof r.ZoomLevel === 'number' ? r.ZoomLevel : 0), 0);

  const v = JSON.parse(await httpsGetText(ROUTES_KEYS));
  if (!Array.isArray(v.arr) || !Array.isArray(v.s) || !Array.isArray(v.v)) {
    throw new Error('unexpected key document shape');
  }
  const password = v.arr[zoomSum];
  const salt = Buffer.from(v.s[v.s[0].length], 'hex');
  const iv = Buffer.from(v.v[v.v[0].length], 'hex');
  if (!password || !salt.length || !iv.length) throw new Error('could not resolve crypto material');

  keyCache = { password, salt, iv };
  return keyCache;
}

/** Step 4: AES-128-CBC with a PBKDF2-SHA1 derived key. */
function decrypt(base64, password, salt, iv) {
  const key = crypto.pbkdf2Sync(password, salt, 1000, 16, 'sha1');
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  const buf = Buffer.from(base64, 'base64');
  return Buffer.concat([decipher.update(buf), decipher.final()]).toString('utf8');
}

/**
 * Live trains straight from Amtrak.
 * @returns {Promise<Array|null>} normalised trains, or null if the scheme has moved.
 */
async function fetchTrains(opts = {}) {
  if (!opts.force && dataCache.trains && (Date.now() - dataCache.at) < TTL_MS) return dataCache.trains;
  try {
    const { password, salt, iv } = await getKeys();
    const raw = (await httpsGetText(TRAINS_DATA)).trim();

    // Step 3: split payload from its trailing key blob.
    const body = raw.slice(0, -MASTER_SEGMENT);
    const keyBlob = raw.slice(-MASTER_SEGMENT);

    const perResponsePassword = decrypt(keyBlob, password, salt, iv).split('|')[0];
    const plaintext = decrypt(body, perResponsePassword, salt, iv);

    const gj = JSON.parse(plaintext);
    const feats = (gj && gj.features) || [];

    // Amtrak stamps positions as "9/9/2026 9:26:40 AM" with NO timezone. Parsing that as
    // local time gave ages an hour in the FUTURE. Rather than guess at Eastern and then get
    // DST wrong twice a year, take the newest stamp in the feed as the feed's own "now" and
    // measure every train relative to that. Whatever zone Amtrak means, the arithmetic is
    // the same and staleness within the feed is what actually matters.
    const stampMs = (v) => {
      if (!v) return null;
      const m = String(v).match(/^(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)\s*(AM|PM)?$/i);
      if (!m) { const p = Date.parse(v); return Number.isFinite(p) ? p : null; }
      let h = +m[4];
      if (m[7]) { const pm = m[7].toUpperCase() === 'PM'; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
      return Date.UTC(+m[3], +m[1] - 1, +m[2], h, +m[5], +m[6]);   // zone-free reference clock
    };
    let feedNow = 0;
    for (const f of feats) {
      const t = stampMs(f.properties && f.properties.LastValTS);
      if (t && t > feedNow) feedNow = t;
    }
    const trains = feats.map(f => {
      const p = f.properties || {};
      const c = (f.geometry && f.geometry.coordinates) || [];
      return {
        trainNum: p.TrainNum != null ? String(p.TrainNum) : null,
        routeName: p.RouteName || null,
        lat: Number(c[1]),
        lon: Number(c[0]),
        heading: p.Heading || null,
        velocity: p.Velocity != null ? Number(p.Velocity) : null,
        updatedAt: p.LastValTS || null,
        // Seconds behind the newest position in this same feed. Timezone-independent.
        positionAgeS: (() => { const t = stampMs(p.LastValTS); return (t && feedNow) ? Math.round((feedNow - t) / 1000) : null; })(),
        trainState: p.TrainState || null,
        origin: p.OrigCode || null,
        destination: p.DestCode || null,
        statusMsg: p.StatusMsg || null,
        source: 'amtrak-official'
      };
    }).filter(t => Number.isFinite(t.lat) && Number.isFinite(t.lon));

    dataCache = { at: Date.now(), trains };
    return trains;
  } catch (e) {
    // Amtrak can change this without notice. Say so plainly and let the caller fall back
    // to the mirror rather than pretending there are no trains.
    console.error('amtrak-official-feed: could not read Amtrak directly —', e.message);
    return dataCache.trains || null;
  }
}

module.exports = { fetchTrains, getKeys, decrypt, TRAINS_DATA, ROUTES_LIST, ROUTES_KEYS, MASTER_SEGMENT };

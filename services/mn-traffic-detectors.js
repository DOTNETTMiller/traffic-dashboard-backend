/** Live, keyless MnDOT IRIS measurements. Samples are evidence of traffic conditions,
 * not proof of a closure or worker presence. No timers, paid APIs or sticky confirmations.
 * Config supplies location/route/direction; station readings take precedence over their
 * component detectors so the same vehicles are not represented twice at a station.
 */
const https = require('https');
const zlib = require('zlib');
const { parseStringPromise } = require('xml2js');
const geo = require('./event-geometry');

const BASE = 'https://data.dot.state.mn.us/iris_xml/';
const URLS = Object.freeze({
  config: BASE + 'metro_config.xml.gz',
  detectors: BASE + 'det_sample.xml.gz',
  stations: BASE + 'stat_sample.xml.gz',
  signs: BASE + 'sign_message.xml.gz'
});
const SAMPLE_TTL = 30000;
const CONFIG_TTL = 6 * 3600000;
const MAX_AGE = 5 * 60000;
const CELL = 0.01;

function numeric(value) {
  if (value == null || String(value).trim() === '' || /^unknown$/i.test(String(value))) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function routeOf(value) {
  const m = String(value || '').toUpperCase().match(/\b(I|US|TH|MN)[- .]*(\d{1,3})([EW])?\b/);
  return m ? `${m[1] === 'TH' ? 'MN' : m[1]}-${Number(m[2])}${m[3] || ''}` : null;
}
function directionOf(value) {
  const directions = { N: 'N', NB: 'N', NORTH: 'N', NORTHBOUND: 'N',
    S: 'S', SB: 'S', SOUTH: 'S', SOUTHBOUND: 'S', E: 'E', EB: 'E', EAST: 'E', EASTBOUND: 'E',
    W: 'W', WB: 'W', WEST: 'W', WESTBOUND: 'W' };
  return directions[String(value || '').trim().toUpperCase()] || null;
}
function timestamp(value) {
  // IRIS publishes a local wall time with an explicit daylight/standard abbreviation.
  // Interpret that offset rather than the timezone of the machine running this service.
  const cleaned = String(value || '').replace(/\bCDT\b/, '-0500').replace(/\bCST\b/, '-0600');
  const n = Date.parse(cleaned);
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
}
async function xml(text, rootName) {
  const parsed = await parseStringPromise(text, { explicitArray: true });
  if (!parsed[rootName]) throw new Error(`Missing ${rootName} root`);
  return parsed[rootName];
}
async function parseConfig(text) {
  const root = await xml(text, 'tms_config');
  const detectors = new Map(), stations = new Map(), signs = new Map();
  for (const corridor of root.corridor || []) {
    const route = routeOf(corridor.$?.route), direction = directionOf(corridor.$?.dir);
    if (!route || !direction) continue;
    for (const node of corridor.r_node || []) {
      const a = node.$ || {};
      const lon = Number(a.lon), lat = Number(a.lat);
      if (a.lon == null || a.lat == null || !Number.isFinite(lon) || !Number.isFinite(lat)
          || lon < -98 || lon > -89 || lat < 43 || lat > 50) continue;
      // Ramp/parking/intersection observations are not mainline measurements.
      if (a.n_type && a.n_type !== 'Station') continue;
      const location = { route, direction, coordinates: [lon, lat], nodeId: a.name,
        label: a.label || null, speedLimitMph: numeric(a.s_limit), stationId: a.station_id || null };
      if (a.station_id) stations.set(a.station_id, { ...location, id: a.station_id, kind: 'station' });
      for (const detector of node.detector || []) {
        const b = detector.$ || {};
        if (!b.name || b.abandoned === 't' || (b.category && !['Velocity', 'HOV', 'HOT', 'Auxiliary'].includes(b.category))) continue;
        detectors.set(b.name, { ...location, id: b.name, kind: 'detector', lane: numeric(b.lane) });
      }
    }
  }
  for (const sign of root.dms || []) {
    const a = sign.$ || {}, lon = Number(a.lon), lat = Number(a.lat);
    if (!a.name || a.lon == null || a.lat == null || !Number.isFinite(lon) || !Number.isFinite(lat)
      || lon < -98 || lon > -89 || lat < 43 || lat > 50) continue;
    const direction = String(a.description || '').match(/\b(NB|SB|EB|WB)\b/i)?.[1];
    signs.set(a.name, { id: a.name, label: a.description || a.name, coordinates: [lon, lat],
      route: routeOf(a.description), direction: directionOf(direction) });
  }
  if (!detectors.size && !stations.size) throw new Error('Configuration has no usable locations');
  return { detectors, stations, signs, observedAt: timestamp(root.$?.time_stamp) };
}
async function parseSigns(text) {
  const root = await xml(text, 'sign_messages');
  const observedAt = timestamp(root.$?.time_stamp);
  if (!observedAt) throw new Error('Sign timestamp missing or invalid');
  return { observedAt, rows: (root.sign_message || []).map(sign => ({
    id: sign.$?.dms, active: /\bActive\b/i.test(sign.$?.status || ''),
    message: String(sign.$?.multi || '').replace(/\[(?:nl\d*|np)\]/gi, ' / ').replace(/\[[^\]]*\]/g, '').trim(), observedAt
  })).filter(row => row.id) };
}
async function parseSamples(text) {
  const root = await xml(text, 'traffic_sample');
  const observedAt = timestamp(root.$?.time_stamp);
  if (!observedAt) throw new Error('Sample timestamp missing or invalid');
  const rows = (root.sample || []).map(s => ({
    id: s.$?.sensor, speedMph: numeric(s.$?.speed), flowVph: numeric(s.$?.flow),
    occupancyPct: numeric(s.$?.occ), observedAt, periodSeconds: numeric(root.$?.period)
  })).filter(s => s.id && (s.speedMph !== null || s.flowVph !== null || s.occupancyPct !== null));
  return { rows, observedAt };
}
function fresh(row, now = Date.now()) {
  const age = now - Date.parse(row.observedAt || '');
  return Number.isFinite(age) && age >= -60000 && age <= MAX_AGE;
}
function join(config, detectors, stations, now = Date.now()) {
  const stationNodes = new Set();
  const out = [];
  for (const sample of stations.rows) {
    const loc = config.stations.get(sample.id);
    if (!loc || !fresh(sample, now)) continue;
    stationNodes.add(loc.nodeId);
    out.push({ ...loc, ...sample, source: 'MnDOT IRIS', sourceUrl: URLS.stations });
  }
  for (const sample of detectors.rows) {
    const loc = config.detectors.get(sample.id);
    if (!loc || stationNodes.has(loc.nodeId) || !fresh(sample, now)) continue;
    out.push({ ...loc, ...sample, source: 'MnDOT IRIS', sourceUrl: URLS.detectors });
  }
  return out;
}

function fetchXML(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'CorridorConnect/1.0' } }, res => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = []; let length = 0;
      res.on('data', chunk => {
        length += chunk.length;
        if (length > 8 * 1024 * 1024) { res.destroy(new Error('Feed too large')); return; }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => {
        zlib.gunzip(Buffer.concat(chunks), { maxOutputLength: 32 * 1024 * 1024 }, (err, data) => {
          if (err) reject(err); else resolve(data.toString('utf8'));
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('Feed timeout')));
  });
}

function createClient({ fetcher = fetchXML, clock = Date.now } = {}) {
  const cache = new Map();
  async function load(key, ttl, parse) {
    let entry = cache.get(key);
    if (entry?.value && clock() - entry.at < ttl) return entry.value;
    if (entry?.pending) return entry.pending;
    if (entry?.failedAt != null && clock() - entry.failedAt < SAMPLE_TTL) throw new Error(entry.error);
    if (!entry) { entry = {}; cache.set(key, entry); }
    entry.pending = (async () => {
      try {
        const value = await parse(await fetcher(URLS[key]));
        Object.assign(entry, { value, at: clock(), failedAt: null, error: null });
        return value;
      } catch (err) {
        entry.failedAt = clock(); entry.error = err.message;
        throw err;
      } finally { entry.pending = null; }
    })();
    return entry.pending;
  }
  async function snapshot() {
    // A failed sample feed does not discard the other feed; use its last response only
    // while its original observation timestamp is still fresh.
    const results = await Promise.allSettled([
      load('config', CONFIG_TTL, parseConfig),
      load('detectors', SAMPLE_TTL, parseSamples),
      load('stations', SAMPLE_TTL, parseSamples)
    ]);
    const config = results[0].status === 'fulfilled' ? results[0].value : cache.get('config')?.value;
    const sample = i => results[i].status === 'fulfilled' ? results[i].value : cache.get(i === 1 ? 'detectors' : 'stations')?.value || { rows: [], observedAt: null };
    const d = sample(1), s = sample(2), now = clock();
    const rows = config ? join(config, d, s, now) : [];
    const errors = results.flatMap((v, i) => v.status === 'rejected' ? [{ feed: ['config', 'detectors', 'stations'][i], message: v.reason.message }] : []);
    const status = !rows.length ? (errors.length ? 'unavailable' : 'stale-or-empty') : errors.length ? 'degraded' : 'ok';
    return { source: 'MnDOT IRIS', generatedAt: new Date(now).toISOString(), status,
      timestamps: { config: config?.observedAt || null, detectors: d.observedAt, stations: s.observedAt },
      counts: { matchedMeasurements: rows.length, detectorSamples: d.rows.length, stationSamples: s.rows.length },
      maxAgeSeconds: MAX_AGE / 1000, errors, rows };
  }
  async function fetchSigns() {
    const [config, samples] = await Promise.all([
      load('config', CONFIG_TTL, parseConfig), load('signs', SAMPLE_TTL, parseSigns)
    ]);
    return samples.rows.filter(row => config.signs.has(row.id) && fresh(row, clock())).map(row => {
      const loc = config.signs.get(row.id);
      return { id: `MN-${row.id}`, state: 'MN', deviceType: 'dms', signType: 'fixed', portable: false,
        route: loc.route, rawRoute: loc.route, direction: loc.direction, coordinates: loc.coordinates,
        mode: { displaying: row.active && !!row.message, pattern: row.active ? row.message || null : null },
        updated: row.observedAt, inventory: false };
    });
  }
  return { snapshot, fetchSigns };
}

function annotate(events, rows, { now = Date.now(), radiusM = 1000 } = {}) {
  const grid = new Map();
  for (const row of rows) {
    if (!fresh(row, now)) continue;
    const [lon, lat] = row.coordinates;
    const key = `${Math.floor(lon / CELL)}:${Math.floor(lat / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(row);
  }
  let matchedZones = 0;
  for (const ev of events || []) {
    delete ev.x_traffic_measurements;
    const state = String(ev.state || '').trim();
    if (!/^(MN|Minnesota(?:\s|$))/i.test(state) || !/work|construction|roadwork/i.test(ev.eventType || ev.type || '')) continue;
    const route = routeOf(ev.route) || routeOf(ev.road) || routeOf(ev.location) || routeOf(ev.corridor);
    const direction = directionOf(ev.direction);
    if (!route || !direction || ev.x_stale_source) continue;
    const start = Date.parse(ev.startTime || ev.startDate || ev.start_date || '');
    const end = Date.parse(ev.endTime || ev.endDate || ev.end_date || '');
    if (start > now || (Number.isFinite(end) && end < now && ev._lifecycle?.hasNativeEndTime !== false && !ev._lifecycle?.isEstimated)) continue;
    const hits = new Map();
    for (const [lon, lat] of geo.samplePoints(ev, { spacingM: 250, maxPts: 160 })) {
      const cx = Math.floor(lon / CELL), cy = Math.floor(lat / CELL);
      const nx = Math.ceil(radiusM / (111000 * Math.cos(lat * Math.PI / 180) * CELL)) + 1;
      const ny = Math.ceil(radiusM / (111000 * CELL)) + 1;
      for (let dx = -nx; dx <= nx; dx++) for (let dy = -ny; dy <= ny; dy++) {
        for (const row of grid.get(`${cx + dx}:${cy + dy}`) || []) {
          if (row.route !== route || row.direction !== direction) continue;
          const distanceM = geo.metres(lon, lat, ...row.coordinates);
          const key = `${row.kind}:${row.id}`;
          if (distanceM <= radiusM && (!hits.has(key) || hits.get(key).distanceM > distanceM)) hits.set(key, { ...row, distanceM: Math.round(distanceM) });
        }
      }
    }
    const nearest = [...hits.values()].sort((a, b) => a.distanceM - b.distanceM).slice(0, 3);
    if (nearest.length) { ev.x_traffic_measurements = nearest; matchedZones++; }
  }
  return { matchedZones };
}

const client = createClient();
module.exports = { URLS, MAX_AGE, parseConfig, parseSamples, join, annotate, fresh,
  parseSigns, routeOf, directionOf, timestamp, createClient, snapshot: client.snapshot, fetchSigns: client.fetchSigns };

/**
 * Multi-state connected-device ingest adapters.
 *
 * The device↔work-zone matcher is state-agnostic; the only per-state work is turning
 * that state's device feed into the normalized shape below. This registry does that
 * for every state where a feed was found (survey: docs/DEVICE_FEED_STATE_SURVEY.md).
 *
 * Normalized device (what every adapter returns, matching device-workzone-matcher):
 *   { id, state, deviceType:'arrow-board'|'dms', signType, portable:bool|null,
 *     route, rawRoute, direction:'N'|'S'|'E'|'W'|'BOTH'|null,
 *     coordinates:[lon,lat], mode:{displaying,pattern}, updated }
 *
 * Adapter families:
 *   - arcgis      : an ArcGIS FeatureServer/MapServer query (field-mapped)
 *   - wzdxDevice  : a WZDx v4 Device Feed (GeoJSON, arrow-board/DMS field devices)
 *   - cars511     : the CARS/OneStop "get/messagesigns" 511 JSON (needs a free key)
 *   - custom      : bespoke fetchers (Oklahoma, California, New Mexico)
 *
 * Only NO-KEY adapters run without configuration. Key-gated states read their key from
 * an env var (keyEnv); with no key they are skipped, not errored.
 */

const https = require('https');
const zlib = require('zlib');
const matcher = require('./device-workzone-matcher');

function getJSON(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error(`parse: ${d.slice(0, 120)}`)); } });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

const firstDir = (s) => {
  const m = String(s || '').toUpperCase().match(/\b(NORTH|SOUTH|EAST|WEST|NB|SB|EB|WB|[NSEW]B?)\b/);
  return m ? m[1][0] : null;
};

function normalize(o, state) {
  const msg = (o.message == null ? '' : String(o.message)).trim();
  const lon = parseFloat(o.lon), lat = parseFloat(o.lat);
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || (lon === 0 && lat === 0) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return {
    id: o.id != null ? String(o.id) : `${state}-${lon.toFixed(5)},${lat.toFixed(5)}`,
    state,
    deviceType: o.deviceType || 'dms',
    signType: o.signType || null,
    portable: o.portable == null ? null : !!o.portable,
    route: matcher.normalizeRoute(o.route),
    rawRoute: o.route || null,
    direction: matcher.normalizeDir(o.direction) || (o.direction ? firstDir(o.direction) : null),
    coordinates: [lon, lat],
    mode: { displaying: !!msg && !/^blank$|^off$|^none$/i.test(msg), pattern: msg || null },
    updated: o.updated || null,
    // true when the source layer is a static ASSET INVENTORY (no live message, no
    // timestamp) rather than device telemetry. Such a record says a sign exists at a
    // location, never that one is deployed and working right now — so it is not
    // evidence for validation and must not be adjudicated as if it were.
    inventory: !!o.inventory
  };
}

// ---- IBI/OneStop 511 public map JSON (keyless) -------------------------------
// These are the same endpoints a state's own 511 map calls from the browser, so they
// need no key and no registration — which matters, because most of these states were
// previously filed as "one free API key away" behind the CARS v2 path and sat switched
// off waiting for keys that were never needed.
//
// Two documents have to be JOINED, and neither is usable alone:
//   /List/GetData/MessageSigns — message, roadway, direction, status, but NO position
//   /map/mapIcons/MessageSigns — position only, keyed by the list's DT_RowId
// Without the join every record fails normalize()'s coordinate check and the adapter
// silently returns nothing. Verified joinable (FL, 2026-09-29: 100/100 ids matched).
//
// Two measured quirks worth not rediscovering:
//   1. The list caps a page at 100 rows no matter what `length` asks for (cameras allow
//      1000), so page on the count actually RETURNED, never the count requested.
//   2. mapIcons `location` is [lat, lon] — the opposite order from the GeoJSON used
//      everywhere else here. Swapping it silently lands every sign in the wrong state.
// These 511 hosts send the SAME field twice per record: first the full county boundary
// polygon under `area`, then a short display string under `area` again, which is the one a
// JSON parser keeps. So the useful payload is tiny and the transfer is not — North Carolina
// ships 9.0 MB to deliver 39 KB of signs. The endpoint ignores a DataTables column spec, so
// the only lever is transport: asking for gzip takes that 9.0 MB to 1.9 MB. Node's http does
// not decompress on its own, hence this reader.
function readBody(res) {
  const enc = String(res.headers['content-encoding'] || '').toLowerCase();
  const stream = enc === 'gzip' ? res.pipe(zlib.createGunzip())
    : enc === 'deflate' ? res.pipe(zlib.createInflate())
      : enc === 'br' ? res.pipe(zlib.createBrotliDecompress()) : res;
  return new Promise((resolve, reject) => {
    let d = ''; stream.on('data', (c) => (d += c));
    stream.on('end', () => resolve(d));
    stream.on('error', reject);
  });
}
function postForm511(url, body, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers: {
      'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest',
      'Accept-Encoding': 'gzip, deflate', 'User-Agent': 'Mozilla/5.0', 'Content-Length': Buffer.byteLength(body)
    } }, (res) => { readBody(res).then((d) => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('parse')); } }, reject); });
    req.on('error', reject);
    req.setTimeout(timeoutMs, function () { this.destroy(); reject(new Error('timeout')); });
    req.write(body); req.end();
  });
}
function get511(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest',
      'Accept-Encoding': 'gzip, deflate', 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      readBody(res).then((d) => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('parse')); } }, reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
  });
}
// Bounded fan-out: the page size is capped at 100 rows server-side whatever `length` asks,
// so a large state is many round trips, and these hosts start dropping requests when every
// state adapter leans on them at once. Six in flight is the compromise.
async function pool(tasks, limit = 6) {
  const out = new Array(tasks.length);
  let next = 0;
  const workers = new Array(Math.min(limit, tasks.length)).fill(0).map(async () => {
    while (next < tasks.length) { const i = next++; out[i] = await tasks[i](); }
  });
  await Promise.all(workers);
  return out;
}
async function ibi511(cfg) {
  // Positions first: no position, no usable device.
  const icons = await get511(`${cfg.base}/map/mapIcons/MessageSigns`).catch(() => null);
  const pos = new Map();
  for (const it of ((icons && icons.item2) || [])) {
    const L = it.location;
    if (Array.isArray(L) && L.length >= 2) pos.set(String(it.itemId), [L[1], L[0]]); // [lat,lon] -> [lon,lat]
  }
  if (!pos.size) return [];
  // Retry with backoff — these hosts intermittently drop a request when every state
  // adapter fires at once, and one silent miss truncates the roster.
  const page = async (start) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 400 * attempt));
      const j = await postForm511(`${cfg.base}/List/GetData/MessageSigns`, `draw=1&start=${start}&length=1000`).catch(() => null);
      if (j) return j;
    }
    return null;
  };
  // The first page is what tells us the total, so it has to be sequential — but every page
  // after it can go at once. Paging them one at a time made this the slowest adapter in the
  // set (North Carolina: 5 round trips, 17s, which alone consumed the caller's 20s cold
  // deadline). Fanning out the remainder puts it back under 5s.
  const first = await page(0);
  if (!first) return [];
  const step = (first.data || []).length;
  if (!step) return [];
  const total = Math.min(first.recordsTotal || step, 20000);
  const tasks = [];
  for (let start = step; start < total; start += step) tasks.push(() => page(start));
  const pages = [first, ...await pool(tasks)];
  const out = [];
  let missed = 0;
  for (const j of pages) {
    if (!j) { missed++; continue; }
    const rows = j.data || [];
    for (const r of rows) {
      const id = String(r.DT_RowId || '');
      const ll = pos.get(id);
      if (!ll) continue;                       // in the list but not on the map — no position
      const message = [r.message, r.message2, r.message3].map((m) => String(m || '').trim()).filter(Boolean).join(' ');
      const label = `${r.name || ''} ${r.description || ''} ${r.roadwayName || ''}`;
      // One host can serve several states (newengland511 carries ME, NH and VT together),
      // so the state comes from the RECORD when the caller supplies stateFrom. Labelling a
      // shared host with a single state code files two states' signs under the third.
      const st = cfg.stateFrom ? cfg.stateFrom(r) : cfg.state;
      if (!st) continue;
      const rec = normalize({
        id, deviceType: 'dms',
        route: r.roadwayName, direction: r.direction,
        lon: ll[0], lat: ll[1],
        // A sign the state reports as off is off, whatever text was last loaded into it.
        message: /^off$/i.test(String(r.status || '')) ? '' : message,
        updated: r.lastUpdated || null,
        portable: /portable|pvms|pcms|trailer|arrow/i.test(label)
      }, st);
      if (rec) out.push(rec);
    }
  }
  // Say so rather than returning a short roster that reads as complete — a device the
  // matcher never saw becomes "no device at this zone", which is a validation claim.
  if (missed) console.error(`device-adapters ${cfg.state || cfg.base}: ${missed}/${pages.length} pages unrecoverable — roster short of ${total}`);
  return out;
}

// ---- generic families -------------------------------------------------------

async function arcgis(cfg) {
  const sep = cfg.url.includes('?') ? '&' : '?';
  const url = `${cfg.url}${sep}where=${encodeURIComponent(cfg.where || '1=1')}&outFields=*`
    + `&returnGeometry=true&outSR=4326&f=json&resultRecordCount=${cfg.max || 4000}`;
  const j = await getJSON(url);
  const out = [];
  for (const f of (j.features || [])) {
    const a = f.attributes || {};
    const g = f.geometry || {};
    const lon = cfg.lonField != null ? a[cfg.lonField] : g.x;
    const lat = cfg.latField != null ? a[cfg.latField] : g.y;
    const rec = normalize({
      id: cfg.idField ? a[cfg.idField] : (a.OBJECTID != null ? `${cfg.state}-${a.OBJECTID}` : null),
      deviceType: cfg.deviceType,
      route: cfg.routeFrom ? cfg.routeFrom(a) : (cfg.routeField ? a[cfg.routeField] : null),
      direction: cfg.dirFrom ? cfg.dirFrom(a) : (cfg.dirField ? a[cfg.dirField] : null),
      lon, lat,
      message: cfg.messageField ? a[cfg.messageField] : null,
      signType: cfg.signTypeField ? a[cfg.signTypeField] : null,
      portable: cfg.isPortable ? cfg.isPortable(a) : null,
      updated: cfg.updatedField ? a[cfg.updatedField] : null,
      inventory: !!cfg.inventoryOnly
    }, cfg.state);
    if (rec) out.push(rec);
  }
  return out;
}

async function wzdxDevice(cfg) {
  const j = await getJSON(cfg.url);
  const out = [];
  for (const f of (j.features || [])) {
    const p = f.properties || {};
    const c = p.core_details || p;
    const coords = (f.geometry && f.geometry.coordinates) || null;
    if (!coords) continue;
    const lon = Array.isArray(coords[0]) ? coords[0][0] : coords[0];
    const lat = Array.isArray(coords[0]) ? coords[0][1] : coords[1];
    const dtype = c.device_type === 'arrow-board' ? 'arrow-board' : 'dms';
    const rec = normalize({
      id: c.name || f.id || p.id,
      deviceType: dtype,
      route: Array.isArray(c.road_names) ? c.road_names[0] : c.road_names,
      direction: c.road_direction,
      lon, lat,
      message: dtype === 'arrow-board' ? (p.pattern && p.pattern !== 'blank' ? p.pattern : null) : (p.message_multi_string || null),
      signType: c.device_type,
      portable: dtype === 'arrow-board' ? true : null,
      updated: c.update_date
    }, cfg.state);
    if (rec) out.push(rec);
  }
  return out;
}

// CARS/OneStop 511 message-signs JSON. Requires a free key (cfg.keyEnv env var).
async function cars511(cfg) {
  const key = process.env[cfg.keyEnv];
  if (!key && !cfg.keyless) return { skipped: `no key (set ${cfg.keyEnv})` };
  const path = cfg.path || 'api/v2/get/messagesigns';
  const url = key
    ? `${cfg.base}/${path}?key=${encodeURIComponent(key)}&format=json`
    : `${cfg.base}/${path}?format=json`;   // keyless path (e.g. 511NY legacy)
  const j = await getJSON(url);
  const rows = Array.isArray(j) ? j : (j.MessageSigns || j.messagesigns || []);
  const out = [];
  for (const r of rows) {
    const msgs = r.Messages || r.messages;
    const message = Array.isArray(msgs) ? msgs.map((m) => (m.Message || m.text || m)).join(' ') : msgs;
    const rec = normalize({
      id: r.Id || r.id || r.Name, deviceType: 'dms',
      route: r.Roadway || r.roadway, direction: r.DirectionOfTravel || r.direction,
      lon: r.Longitude || r.longitude, lat: r.Latitude || r.latitude,
      message, updated: r.LastUpdated || r.lastUpdated,
      portable: /portable|pvms/i.test(`${r.Name || ''} ${r.Roadway || ''}`)
    }, cfg.state);
    if (rec) out.push(rec);
  }
  return out;
}

// ---- custom fetchers --------------------------------------------------------

// ODOT deviceTypeNames id for the towable-board class (see /api/DeviceTypeNames).
const TRAILER_TYPE_ID = 9;

async function oklahoma(cfg) {
  const base = 'https://oktraffic.org/api';
  const [devs, statuses] = await Promise.all([
    getJSON(`${base}/Devices?filter[include][]=address&filter[include][]=deviceTypeName`),
    getJSON(`${base}/DmsStatuses`).catch(() => [])
  ]);
  const msgById = new Map((Array.isArray(statuses) ? statuses : []).map((s) => [s.id || s.dmsId, s.message || s.currentMessage]));
  const out = [];
  for (const d of (Array.isArray(devs) ? devs : [])) {
    const addr = d.address || {};
    let msg = msgById.get(d.id);
    if (msg) msg = String(msg).replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim(); // strip NTCIP MULTI
    // ODOT's taxonomy (/api/DeviceTypeNames) groups the DMS family under deviceTypeId 1
    // (Permanent / Portable / Lane Control / WeighStation). "Trailer" is deviceTypeNameId 9,
    // its own deviceTypeId 4 — a distinct non-DMS field-device class, and none of them appear
    // in /DmsStatuses (they carry no sign text). Those are the towable boards, so they're
    // portable field devices, not signs. Previously they were typed 'dms' and not even counted
    // as portable, so every one of them was invisible to the matcher.
    const isTrailer = d.deviceTypeNameId === TRAILER_TYPE_ID ||
      /trailer/i.test((d.deviceTypeName && d.deviceTypeName.name) || '');
    const rec = normalize({
      id: d.id != null ? `OK-${d.id}` : null,
      deviceType: isTrailer ? 'arrow-board' : 'dms',
      route: d.name || (d.deviceStatusEvents && d.deviceStatusEvents[0] && d.deviceStatusEvents[0].name),
      direction: addr.direction, lon: addr.longitude, lat: addr.latitude,
      message: msg, signType: d.deviceTypeName && d.deviceTypeName.name,
      portable: isTrailer || d.deviceTypeNameId === 2 ||
        /portable/i.test((d.deviceTypeName && d.deviceTypeName.name) || '')
    }, 'OK');
    if (rec) out.push(rec);
  }
  return out;
}

async function california(cfg) {
  const out = [];
  for (let dnum = 1; dnum <= 12; dnum++) {
    const dd = String(dnum).padStart(2, '0');
    try {
      const j = await getJSON(`https://cwwp2.dot.ca.gov/data/d${dnum}/cms/cmsStatusD${dd}.json`, 10000);
      for (const item of (j.data || [])) {
        const cms = item.cms || item;
        const loc = (cms.location) || {};
        const msg = cms.message && (cms.message.phase1 || cms.message.display) || cms.currentPhase || '';
        const rec = normalize({
          id: cms.cmsId ? `CA-${cms.cmsId}` : null,
          route: loc.route, direction: loc.travelFlowDirection || loc.direction,
          lon: loc.longitude, lat: loc.latitude,
          message: typeof msg === 'string' ? msg : '', updated: cms.recordTimestamp
        }, 'CA');
        if (rec) out.push(rec);
      }
    } catch (_) { /* some districts intermittently 500 — skip */ }
  }
  return out;
}

async function newmexico(cfg) {
  const j = await getJSON('https://servicev4.nmroads.com/RealMapWAR/GetMessageSigns');
  const rows = Array.isArray(j) ? j : (j.messageSigns || j.data || []);
  const out = [];
  for (const r of rows) {
    const desc = r.description || r.location || '';
    const rec = normalize({
      id: r.deviceid || r.id || r.name, route: desc, direction: desc,
      lon: r.longitude, lat: r.latitude, message: r.signText || r.message
    }, 'NM');
    if (rec) out.push(rec);
  }
  return out;
}

// ---- registry ---------------------------------------------------------------
// verified=true means an actual data pull succeeded during the 2026-08 survey.

const ADAPTERS = {
  // ---- Portable / arrow-board capable, no key (the priority set) ----
  wa: { name: 'Washington', portable: true, key: false, run: () => wzdxDevice({ state: 'WA', url: 'https://wzdx.wsdot.wa.gov/api/v4/DeviceFeed' }) },
  ok: { name: 'Oklahoma', portable: true, key: false, run: () => oklahoma({}) },
  // PennDOT's TSAMS layer is an ASSET INVENTORY, not live status: every record is
  // ITS_DEVICE_TYPE 'DMS' with no message and no timestamp. It also carries devices that
  // do not exist yet — of 1040 records, 185 are 'Planned', 83 'Programmed' and 20 'Down';
  // only 752 are 'Existing/Standby'. Ingesting the other 288 asserted the presence of
  // hardware that is not in the field, so the where-clause now filters them out.
  pa: { name: 'Pennsylvania', portable: true, key: false, run: () => arcgis({
    state: 'PA', url: 'https://gis.penndot.gov/arcgis/rest/services/tsams/tsams/MapServer/17/query',
    where: "DEVICE_STATUS = 'Existing/Standby'", inventoryOnly: true,
    routeField: 'STATE_ROUTE', dirField: 'DIRECTION', signTypeField: 'STRUCTURE_TYPE',
    isPortable: (a) => /trailer|type\s*[ab]/i.test(a.STRUCTURE_TYPE || '') }) },
  // MaineDOT's layer is likewise an ASSET INVENTORY: all 101 records are Ver-Mac
  // 'Trailer Mounted' / 'Changable Message Sign' assets with no message and no timestamp.
  me: { name: 'Maine', portable: true, key: false, run: () => arcgis({
    state: 'ME', url: 'https://arcgisserver.maine.gov/arcgis/rest/services/mdot/MaineDOT_Dynamic/MapServer/111/query',
    inventoryOnly: true,
    routeField: 'rt_code', dirField: 'travel_direction', signTypeField: 'installation_type',
    isPortable: (a) => /trailer/i.test(a.installation_type || '') }) },

  // ---- Fixed DMS with live message, no key ----
  // FDOT withdrew public access to the DIVAS_MessageBoard FeatureServer (499 Token
  // Required, and the whole DIVAS folder is gone from the services directory as of
  // 2026-09-29). FL511's own public map JSON replaces it and carries MORE: 1,141 signs.
  fl: { name: 'Florida', portable: false, key: false, run: () => ibi511({ state: 'FL', base: 'https://fl511.com' }) },
  ky: { name: 'Kentucky', portable: false, key: false, run: () => arcgis({
    state: 'KY', url: 'https://services2.arcgis.com/CcI36Pduqd0OR4W9/arcgis/rest/services/dmsSigns_2020/FeatureServer/0/query',
    where: "dmsStatus = 'Online'",
    routeField: 'dmsHighway', dirFrom: (a) => a.dmsLocation, latField: 'dmsLatitude', lonField: 'dmsLongitude',
    messageField: 'kytcMessage', signTypeField: 'dmsStatus', updatedField: 'updateTS' }) },
  md: { name: 'Maryland', portable: false, key: false, run: () => arcgis({
    state: 'MD', url: 'https://chartimap1.sha.maryland.gov/arcgis/rest/services/CHART/DMS/MapServer/0/query',
    routeFrom: (a) => a.location, dirFrom: (a) => a.location, latField: 'Latitude', lonField: 'Longitude', messageField: 'plainMessage' }) },
  nm: { name: 'New Mexico', portable: false, key: false, run: () => newmexico({}) },
  ca: { name: 'California', portable: false, key: false, run: () => california({}) },

  // Alabama — ALGO Traffic, keyless. Unusually well structured for a DMS feed: every sign
  // carries routeDesignator, routeDesignatorType ('Interstate'), direction and a milepost
  // (linearReference) on ALL 72 records, plus the actual message as pages[].lines[].text.
  // 51 of the 72 are on interstates and 54 were displaying text when measured.
  // No timestamp of any kind, so `updated` stays null rather than being invented -- device
  // freshness for Alabama is genuinely unestablishable.
  al: { name: 'Alabama', portable: false, key: false, run: () => algotraffic({}) },

  // ---- Fixed DMS on the keyless public 511 map JSON (was mis-filed as key-gated) ----
  ut: { name: 'Utah', portable: false, key: false, run: () => ibi511({ state: 'UT', base: 'https://www.udottraffic.utah.gov' }) },
  la: { name: 'Louisiana', portable: false, key: false, run: () => ibi511({ state: 'LA', base: 'https://www.511la.org' }) },
  az: { name: 'Arizona', portable: false, key: false, run: () => ibi511({ state: 'AZ', base: 'https://az511.com' }) },
  nc: { name: 'North Carolina', portable: false, key: false, run: () => ibi511({ state: 'NC', base: 'https://www.drivenc.gov' }) },
  // NJ is the one holdout: 511nj.org answers 403 on BOTH the CARS path and the public
  // map JSON, so it really does need a key. Everything else once filed here did not.
  nj: { name: 'New Jersey', portable: false, key: true, run: () => cars511({ state: 'NJ', base: 'https://511nj.org', path: 'api/getmessagesigns', keyEnv: 'NJ_511_KEY' }) },
  wi: { name: 'Wisconsin', portable: false, key: false, run: () => ibi511({ state: 'WI', base: 'https://511wi.gov' }) },
  nv: { name: 'Nevada', portable: false, key: false, run: () => ibi511({ state: 'NV', base: 'https://www.nvroads.com' }) },
  ny: { name: 'New York', portable: true, key: false, run: () => cars511({ state: 'NY', base: 'https://511ny.org', path: 'api/getmessagesigns', keyEnv: 'NY_511_KEY', keyless: true }) },
  id: { name: 'Idaho', portable: false, key: false, run: () => ibi511({ state: 'ID', base: 'https://511.idaho.gov' }) },
  // Newly added — same keyless path, found by probing rather than assumed.
  ga: { name: 'Georgia', portable: false, key: false, run: () => ibi511({ state: 'GA', base: 'https://511ga.org' }) },
  ak: { name: 'Alaska', portable: false, key: false, run: () => ibi511({ state: 'AK', base: 'https://511.alaska.gov' }) },
  // ME, NH and VT share ONE host. The record's `area` field is the only thing that says
  // which state a sign is in (region and county are both null), so it is split on that —
  // measured 2026-09-29: Maine 47, New Hampshire 33, Vermont 20 of the first 100.
  // Additive to the `me` entry above, which reads Maine's own PORTABLE trailer inventory
  // from MaineDOT ArcGIS — a different source and a different device class.
  newengland: { name: 'New England (ME/NH/VT)', portable: false, key: false, run: () => ibi511({
    base: 'https://www.newengland511.org',
    stateFrom: (r) => ({ 'Maine': 'ME', 'New Hampshire': 'NH', 'Vermont': 'VT' })[String(r.area || '').trim()] || null }) }
};

async function algotraffic() {
  const j = await getJSON('https://api.algotraffic.com/v3/MessageSigns', 20000);
  const out = [];
  for (const s of (Array.isArray(j) ? j : [])) {
    const L = s.location || {};
    // The sign cycles pages; the displayed message is every line of every page in order.
    const message = (s.pages || []).flatMap((p) => (p.lines || [])
      .map((l) => String(l.text || '').trim()).filter(Boolean)).join(' ');
    const rec = normalize({
      id: s.id, deviceType: 'dms',
      route: L.routeDesignator, direction: L.direction,
      lon: L.longitude, lat: L.latitude,
      message, updated: null, portable: false
    }, 'AL');
    if (rec) {
      if (Number.isFinite(L.linearReference)) rec.milepost = L.linearReference;
      out.push(rec);
    }
  }
  return out;
}

async function fetchState(stateKey) {
  const a = ADAPTERS[String(stateKey || '').toLowerCase()];
  if (!a) throw new Error(`no adapter for ${stateKey}`);
  return a.run();
}

module.exports = { ADAPTERS, fetchState, normalize, arcgis, wzdxDevice, cars511 };

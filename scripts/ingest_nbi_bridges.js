/**
 * Ingest FHWA National Bridge Inventory (NBI) vertical UNDER-clearances into the
 * `bridge_clearances` table, scoped to the corridor (I-80 / I-35 by default).
 *
 * Item 54 (minimum vertical underclearance) is the relevant value for a corridor
 * app: how tall a load can pass UNDER an overpass crossing the interstate. The
 * NBI inspection date (Item 90) is stored in `last_verified` as the clearance
 * date, so the UI can show how current the reading is and the construction-
 * proximity flag can mark it as "needs updated info".
 *
 * Two data sources (NBI's ArcGIS service is sometimes down / token-gated):
 *
 *   1. ArcGIS REST (default):   node scripts/ingest_nbi_bridges.js
 *      Discovers field names from the layer metadata, paginates, filters by
 *      state + route, and maps the underclearance/lat/lon/date columns.
 *
 *   2. CSV / delimited file:    node scripts/ingest_nbi_bridges.js --csv path/to/state.csv
 *      Ingest a downloaded FHWA per-state NBI delimited file (comma/pipe/tab
 *      auto-detected). This path is the reliable fallback.
 *
 * Flags:
 *   --dry-run     Parse + transform + print a summary, write nothing.
 *   --replace     Clear previously NBI-sourced rows before inserting (default).
 *   --append      Keep existing NBI rows (just add).
 *   --routes=...  Comma list of route tokens to keep (default "I-80,I-35").
 *   --service=URL Override the ArcGIS FeatureServer layer URL.
 */

const fs = require('fs');
const path = require('path');

const USE_POSTGRES = !!process.env.DATABASE_URL;
const M_TO_FT = 3.28084;

// --- corridor scope -----------------------------------------------------------
// Map of route token -> the values that appear in NBI route fields. NBI route
// numbers are stored without the "I-" prefix (e.g. 80, 35), so we match on the
// numeric portion as well as the friendly label we want to store.
const DEFAULT_ROUTES = ['I-80', 'I-35'];

// NBI Item 54A reference codes: H = highway beneath, R = railroad, N = none.
// Only "H" (a roadway passes under the structure) is a truck-clearance concern.
const UNDERCLEARANCE_REF_KEEP = new Set(['H', '1', 'h']);

// Keep only realistic low underclearances. Above ~7.5 m (~24.6 ft) is not a
// truck concern; NBI codes "no/unknown underclearance" as 99.99 m. Below 2.5 m
// is almost certainly a data error for an interstate overpass.
const MIN_METERS = 2.5;
const MAX_METERS = 7.5;

// --- CLI ----------------------------------------------------------------------
function parseArgs(argv) {
  const args = { dryRun: false, mode: 'arcgis', csv: null, replace: true, routes: DEFAULT_ROUTES, service: null, allRoutes: false, out: null };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--append') args.replace = false;
    else if (a === '--replace') args.replace = true;
    else if (a === '--all-routes') args.allRoutes = true;
    else if (a.startsWith('--csv=')) { args.mode = 'csv'; args.csv = a.slice(6); }
    else if (a === '--csv') { args.mode = 'csv'; } // next token handled below
    else if (a.startsWith('--out=')) args.out = a.slice(6);
    else if (a.startsWith('--routes=')) args.routes = a.slice(9).split(',').map(s => s.trim()).filter(Boolean);
    else if (a.startsWith('--service=')) args.service = a.slice(10);
  }
  // support "--csv path" and "--out path" (space separated)
  const csvIdx = argv.indexOf('--csv');
  if (csvIdx !== -1 && argv[csvIdx + 1] && !argv[csvIdx + 1].startsWith('--')) { args.mode = 'csv'; args.csv = argv[csvIdx + 1]; }
  const outIdx = argv.indexOf('--out');
  if (outIdx !== -1 && argv[outIdx + 1] && !argv[outIdx + 1].startsWith('--')) args.out = argv[outIdx + 1];
  return args;
}

// --- field discovery ----------------------------------------------------------
// Find the best column name for a concept by testing regexes against the header.
function pickField(names, patterns) {
  for (const re of patterns) {
    const hit = names.find(n => re.test(n));
    if (hit) return hit;
  }
  return null;
}

function discoverMapping(names) {
  return {
    underRef:   pickField(names, [/054A/i, /VERT_CLR_UND.*REF/i, /REF.*VERT_CLR_UND/i, /under.*ref/i]),
    underMeters: pickField(names, [/VERT_CLR_UND_054B/i, /054B/i, /MIN_VERT_CLR_UND/i, /VERT_CLR_UND/i, /underclear/i]),
    lat:        pickField(names, [/^LATDD$/i, /LATDD/i, /^LAT$/i, /LATITUDE/i, /LAT_016/i, /\bLAT\b/i]),
    lon:        pickField(names, [/^LONGDD$/i, /LONGDD/i, /^LON[G]?$/i, /LONGITUDE/i, /LONG_017/i, /\bLON/i]),
    state:      pickField(names, [/STATE_CODE_001/i, /STATE_CODE/i, /STATE_NAME/i, /\bSTATE\b/i]),
    routeNum:   pickField(names, [/ROUTE_NUMBER_005D/i, /ROUTE_NUMBER/i, /ROUTE_NO/i, /\bROUTE\b/i]),
    routePrefix: pickField(names, [/ROUTE_PREFIX_005B/i, /ROUTE_PREFIX/i]),
    featInter:  pickField(names, [/FEATURES_DESC_006A/i, /FEAT.*INT/i, /FACILITY/i, /FEATURES_DESC/i]),
    structNum:  pickField(names, [/STRUCTURE_NUMBER_008/i, /STRUCTURE_NUMBER/i, /BRIDGE_ID/i, /STRUCT/i]),
    inspDate:   pickField(names, [/DATE_OF_INSPECT_090/i, /INSPECT.*DATE/i, /DATE_OF_INSPECT/i, /INSP_DATE/i]),
    inspYear:   pickField(names, [/YEAR_OF_INSPECT/i, /INSPECT.*YEAR/i, /FILE_YEAR/i, /\bYEAR\b/i])
  };
}

// --- value coercion -----------------------------------------------------------
// Underclearance may arrive as decimal meters (4.79) or NBI-coded centimeters
// (0479 -> 4.79). Normalise to meters.
function toMeters(raw) {
  if (raw == null || raw === '') return null;
  let v = Number(String(raw).trim());
  if (!Number.isFinite(v)) return null;
  if (v >= 100) v = v / 100; // coded "0479" style
  return v;
}

// NBI lat/lon can be decimal degrees, or DMS-coded (DDMMSS.ss / DDDMMSS.ss).
function toDecimalDeg(raw, isLon) {
  if (raw == null || raw === '') return null;
  let v = Number(String(raw).trim());
  if (!Number.isFinite(v) || v === 0) return null;
  const sign = v < 0 ? -1 : 1;
  v = Math.abs(v);
  const max = isLon ? 180 : 90;
  if (v <= max) return sign * v; // already decimal degrees
  // DMS-coded: last 4 digits = SS.ss handled via string slicing on integer part
  const s = String(Math.round(v * 100)).padStart(isLon ? 9 : 8, '0');
  const deg = parseInt(s.slice(0, isLon ? 3 : 2), 10);
  const min = parseInt(s.slice(isLon ? 3 : 2, isLon ? 5 : 4), 10);
  const sec = parseInt(s.slice(isLon ? 5 : 4), 10) / 100;
  const dec = deg + min / 60 + sec / 3600;
  // US longitudes are negative.
  return (isLon ? -1 : 1) * dec;
}

// NBI Item 5B route prefix codes -> friendly label prefix.
const ROUTE_PREFIX = { '1': 'I-', '2': 'US-', '3': 'SR-', '4': 'CR-' };

function routeLabel(rec, map, wantedRoutes, allRoutes) {
  const num = String(rec[map.routeNum] ?? '').replace(/\D/g, '');
  if (allRoutes) {
    const n = Number(num);
    if (!n) return 'Local road';
    const pfx = ROUTE_PREFIX[String(rec[map.routePrefix] ?? '').trim()] ?? 'Rt ';
    return `${pfx}${n}`;
  }
  for (const want of wantedRoutes) {
    const wantNum = want.replace(/\D/g, '');
    if (wantNum && num === wantNum) return want;
  }
  return null;
}

function inspDateISO(rec, map) {
  // Prefer an explicit inspection date; fall back to a year.
  const d = map.inspDate ? rec[map.inspDate] : null;
  if (d) {
    const s = String(d).trim();
    // MMYYYY or MM/YYYY
    let m = s.match(/^(\d{1,2})\D?(\d{4})$/);
    if (m) return `${m[2]}-${String(m[1]).padStart(2, '0')}-01`;
    // MMYY / MYY (NBI Item 90 in the delimited file), e.g. "0624" or "624"
    m = s.match(/^(\d{1,2})(\d{2})$/);
    if (m) {
      const mm = String(m[1]).padStart(2, '0');
      const yy = Number(m[2]);
      const yr = yy <= 60 ? 2000 + yy : 1900 + yy;
      return `${yr}-${mm}-01`;
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  const y = map.inspYear ? String(rec[map.inspYear] ?? '').match(/\d{4}/) : null;
  if (y) return `${y[0]}-01-01`;
  return null;
}

// Transform a raw NBI record into a bridge_clearances row, or null to skip.
function transform(rec, map, wantedRoutes, allRoutes = false) {
  const ref = map.underRef ? String(rec[map.underRef] ?? '').trim() : 'H';
  if (map.underRef && !UNDERCLEARANCE_REF_KEEP.has(ref)) return null; // not a roadway underpass

  const meters = toMeters(rec[map.underMeters]);
  if (meters == null || meters < MIN_METERS || meters > MAX_METERS) return null;

  const route = routeLabel(rec, map, wantedRoutes, allRoutes);
  if (!route) return null;

  const lat = toDecimalDeg(rec[map.lat], false);
  const lon = toDecimalDeg(rec[map.lon], true);
  if (lat == null || lon == null) return null;

  const feet = meters * M_TO_FT;
  const carries = map.featInter ? String(rec[map.featInter] ?? '').trim() : '';
  const struct = map.structNum ? String(rec[map.structNum] ?? '').trim() : '';
  const name = `${route} underpass${carries ? ` at ${carries}` : ''}${struct ? ` (#${struct})` : ''}`.slice(0, 200);

  const feetStr = `${Math.floor(feet)}'${Math.round((feet - Math.floor(feet)) * 12)}"`;
  const warning = feet < 14.0
    ? `⚠️ LOW CLEARANCE: ${feetStr} (${meters.toFixed(2)} m) per NBI. Verify before routing oversize/tall loads.`
    : null;

  return {
    bridge_name: name,
    route,
    state_key: 'nbi',
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lon.toFixed(6)),
    clearance_feet: Number(feet.toFixed(2)),
    clearance_meters: Number(meters.toFixed(2)),
    direction: 'Both',
    restriction_type: 'vertical',
    watch_radius_km: 2,
    warning_message: warning,
    last_verified: inspDateISO(rec, map),
    source: 'NBI'
  };
}

// --- CSV parsing --------------------------------------------------------------
function parseDelimited(text) {
  const firstLine = text.slice(0, text.indexOf('\n'));
  const delim = firstLine.includes('|') ? '|' : firstLine.includes('\t') ? '\t' : ',';
  const rows = [];
  const lines = text.split(/\r?\n/).filter(l => l.length);
  // Delimiter-aware split. Handles a text qualifier of either " or ' (FHWA NBI
  // delimited files use a single-quote qualifier); a doubled qualifier is an
  // escaped literal. A qualifier only applies when it opens a field.
  const splitLine = (line) => {
    const out = []; let cur = ''; let q = null; let atFieldStart = true;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === q && line[i + 1] === q) { cur += q; i++; }
        else if (c === q) { q = null; }
        else cur += c;
      } else if (atFieldStart && (c === '"' || c === "'")) { q = c; atFieldStart = false; }
      else if (c === delim) { out.push(cur.trim()); cur = ''; atFieldStart = true; }
      else { cur += c; atFieldStart = false; }
    }
    out.push(cur.trim());
    return out;
  };
  const header = splitLine(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const obj = {};
    header.forEach((h, idx) => { obj[h] = cells[idx]; });
    rows.push(obj);
  }
  return { header, rows };
}

async function fetchFromArcGIS(serviceUrl, wantedRoutes, allRoutes = false) {
  const base = serviceUrl || 'https://geo.dot.gov/server/rest/services/Hosted/National_Bridge_Inventory_DS/FeatureServer/0';

  const meta = await fetchJSON(`${base}?f=json`);
  if (!meta || !Array.isArray(meta.fields)) {
    throw new Error('Could not read NBI layer metadata (service may be down / token-gated). Use --csv with a downloaded FHWA state file instead.');
  }
  const names = meta.fields.map(f => f.name);
  const map = discoverMapping(names);
  console.log('🔎 Discovered field mapping:', map);
  if (!map.underMeters || !map.lat || !map.lon || !map.routeNum) {
    throw new Error('Required NBI fields not found via discovery. Inspect field names:\n' + names.join(', '));
  }

  const pageSize = Math.min(meta.maxRecordCount || 1000, 2000);
  const routeNums = wantedRoutes.map(r => r.replace(/\D/g, '')).filter(Boolean);
  // Filter to low roadway underclearances server-side so we page ~hundreds, not 600k.
  const clauses = [];
  if (map.underRef) clauses.push(`${map.underRef} = 'H'`);
  if (map.underMeters) clauses.push(`${map.underMeters} > ${MIN_METERS} AND ${map.underMeters} < ${MAX_METERS}`);
  if (!allRoutes && routeNums.length) clauses.push('(' + routeNums.map(n => `${map.routeNum} = ${n}`).join(' OR ') + ')');
  const where = clauses.length ? clauses.join(' AND ') : '1=1';
  console.log('   where:', where);

  const records = [];
  let offset = 0;
  for (;;) {
    const url = `${base}/query?where=${encodeURIComponent(where)}&outFields=*&returnGeometry=false&resultOffset=${offset}&resultRecordCount=${pageSize}&f=json`;
    const page = await fetchJSON(url);
    const feats = (page && page.features) || [];
    if (!feats.length) break;
    feats.forEach(f => records.push(f.attributes));
    offset += feats.length;
    console.log(`   …fetched ${records.length} records`);
    if (!page.exceededTransferLimit && feats.length < pageSize) break;
    if (offset > 200000) break; // safety
  }
  return { records, map };
}

function fetchJSON(url) {
  return fetch(url).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status} for ${url}`)));
}

// --- DB writes ----------------------------------------------------------------
async function ensureSourceColumn(runner) {
  // Add a nullable `source` column so NBI rows can be re-ingested without
  // touching hand-curated bridges. Safe no-op if it already exists.
  try {
    if (USE_POSTGRES) await runner.query('ALTER TABLE bridge_clearances ADD COLUMN IF NOT EXISTS source TEXT');
    else {
      const cols = runner.prepare("PRAGMA table_info(bridge_clearances)").all();
      if (!cols.some(c => c.name === 'source')) runner.prepare('ALTER TABLE bridge_clearances ADD COLUMN source TEXT').run();
    }
  } catch (e) { console.warn('source column note:', e.message); }
}

async function writeRows(rows, { replace }) {
  if (USE_POSTGRES) {
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
    await client.connect();
    try {
      await ensureSourceColumn(client);
      if (replace) {
        await client.query("DELETE FROM bridge_clearance_warnings WHERE bridge_id IN (SELECT id FROM bridge_clearances WHERE source = 'NBI')");
        const del = await client.query("DELETE FROM bridge_clearances WHERE source = 'NBI'");
        console.log(`🗑️  Cleared ${del.rowCount} prior NBI bridges`);
      }
      for (const b of rows) {
        await client.query(
          `INSERT INTO bridge_clearances (bridge_name, route, state_key, latitude, longitude, clearance_feet, clearance_meters, direction, restriction_type, watch_radius_km, warning_message, last_verified, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [b.bridge_name, b.route, b.state_key, b.latitude, b.longitude, b.clearance_feet, b.clearance_meters, b.direction, b.restriction_type, b.watch_radius_km, b.warning_message, b.last_verified, b.source]
        );
      }
    } finally { await client.end(); }
  } else {
    const Database = require('better-sqlite3');
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'states.db');
    const db = new Database(dbPath);
    try {
      await ensureSourceColumn(db);
      if (replace) {
        db.prepare("DELETE FROM bridge_clearance_warnings WHERE bridge_id IN (SELECT id FROM bridge_clearances WHERE source = 'NBI')").run();
        const del = db.prepare("DELETE FROM bridge_clearances WHERE source = 'NBI'").run();
        console.log(`🗑️  Cleared ${del.changes} prior NBI bridges`);
      }
      const stmt = db.prepare(
        `INSERT INTO bridge_clearances (bridge_name, route, state_key, latitude, longitude, clearance_feet, clearance_meters, direction, restriction_type, watch_radius_km, warning_message, last_verified, source)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      const tx = db.transaction(list => list.forEach(b => stmt.run(b.bridge_name, b.route, b.state_key, b.latitude, b.longitude, b.clearance_feet, b.clearance_meters, b.direction, b.restriction_type, b.watch_radius_km, b.warning_message, b.last_verified, b.source)));
      tx(rows);
    } finally { db.close(); }
  }
}

function summarize(rows) {
  console.log(`\n📊 ${rows.length} corridor underclearances ready`);
  const byRoute = {};
  rows.forEach(r => { byRoute[r.route] = (byRoute[r.route] || 0) + 1; });
  Object.entries(byRoute).forEach(([r, c]) => console.log(`   ${r}: ${c}`));
  const low = rows.filter(r => r.clearance_feet < 13.67).sort((a, b) => a.clearance_feet - b.clearance_feet).slice(0, 10);
  if (low.length) {
    console.log("\n⚠️  Lowest (< 13'8\"):");
    low.forEach(r => console.log(`   ${r.clearance_feet}' — ${r.bridge_name}`));
  }
}

// --- main ---------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`🌉 NBI ingest — mode=${args.mode} ${args.allRoutes ? 'ALL routes/states' : 'routes=' + args.routes.join(',')} ${args.dryRun ? '(dry-run)' : ''}`);

  let records, map;
  if (args.mode === 'csv') {
    if (!args.csv || !fs.existsSync(args.csv)) throw new Error(`CSV not found: ${args.csv}`);
    const parsed = parseDelimited(fs.readFileSync(args.csv, 'utf8'));
    map = discoverMapping(parsed.header);
    console.log('🔎 Discovered field mapping:', map);
    records = parsed.rows;
  } else {
    ({ records, map } = await fetchFromArcGIS(args.service, args.routes, args.allRoutes));
  }

  let rows = records.map(r => transform(r, map, args.routes, args.allRoutes)).filter(Boolean);
  // Give each a stable id for the frontend.
  rows = rows.map((r, i) => ({ id: i + 1, ...r }));
  summarize(rows);

  if (args.dryRun) { console.log('\n(dry-run) nothing written.'); return; }
  if (!rows.length) { console.log('\nNo rows to write.'); return; }

  // --out writes a static {success,bridges} JSON (for Cloudflare hosting);
  // otherwise write to the DB.
  if (args.out) {
    const payload = { success: true, count: rows.length, bridges: rows };
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(payload));
    console.log(`\n✅ Wrote ${rows.length} bridges to ${args.out}`);
  } else {
    await writeRows(rows, { replace: args.replace });
    console.log(`\n✅ Wrote ${rows.length} NBI bridge underclearances to DB.`);
  }
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(err => { console.error('\n❌', err.message); process.exit(1); });
}

module.exports = { transform, discoverMapping, toMeters, toDecimalDeg, parseDelimited };

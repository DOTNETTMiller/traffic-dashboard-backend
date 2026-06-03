/**
 * crash-data-service.js
 * ---------------------------------------------------------------------------
 * Historical crash analytics for the I-80 and I-35 corridors, sourced from the
 * NHTSA FARS (Fatality Analysis Reporting System) annual bulk files.
 *
 * WHY BULK FILES, NOT THE FARS CrashAPI:
 *   The live CrashAPI (crashviewer.nhtsa.dot.gov/CrashAPI) is fronted by Akamai
 *   and returns 403 "Access Denied" to datacenter IPs (verified from this env;
 *   Railway egress hits the same wall). The annual CSV bundles are served from
 *   static.nhtsa.gov with no such block and no API key. One ~35 MB zip per year
 *   carries the whole nation, so we fetch a handful of files on a monthly
 *   schedule instead of thousands of throttled per-case API calls.
 *
 * WHAT WE EXTRACT (exactly the two attributes the corridor team asked for):
 *   • Commercial-vehicle involvement — vehicle.csv BODY_TYP in the large-truck
 *     range (GVWR > 10k lbs), corroborated by a motor-carrier id (MCARR_ID).
 *   • Work-zone crashes — accident.csv WRK_ZONE (0 none, 1 construction,
 *     2 maintenance, 3 utility, 4 unknown). Work-zone crash = WRK_ZONE >= 1.
 *
 * CORRIDOR CLIP:
 *   accident.csv carries LATITUDE/LONGITUD (decimal degrees). We keep only
 *   crashes in the corridor states whose point falls within
 *   CRASH_CORRIDOR_BUFFER_MILES of the I-80 / I-35 polyline (the same geometry
 *   the map already loads into interstatePolylinesCache). When no geometry is
 *   available (e.g. local dev without Postgres) we fall back to a text match on
 *   the trafficway id (TWAY_ID), which is coarser but keeps the pipeline alive.
 *
 * CAVEAT: FARS is a census of FATAL crashes only and lags ~1–2 years. It is the
 *   only free, national, geolocated source carrying both CMV and work-zone
 *   flags. Non-fatal corridor coverage would require per-state DOT feeds (Iowa
 *   DOT ICAT, etc.), which can be layered on later.
 * ---------------------------------------------------------------------------
 */

const axios = require('axios');
const JSZip = require('jszip');
const { parse } = require('csv-parse');
const turf = require('@turf/turf');

// --- Corridor states (FIPS) -------------------------------------------------
// Mirrors STATE_OPTIONS in frontend CorridorDelayDashboard.jsx.
const CORRIDOR_STATE_FIPS = {
  'I-80': { 6: 'CA', 32: 'NV', 49: 'UT', 56: 'WY', 31: 'NE', 19: 'IA', 17: 'IL', 18: 'IN', 39: 'OH', 42: 'PA', 34: 'NJ' },
  'I-35': { 48: 'TX', 40: 'OK', 20: 'KS', 29: 'MO', 19: 'IA', 27: 'MN' }
};
// Union of all corridor-state FIPS → quick membership test while scanning.
const ALL_CORRIDOR_FIPS = new Set([
  ...Object.keys(CORRIDOR_STATE_FIPS['I-80']),
  ...Object.keys(CORRIDOR_STATE_FIPS['I-35'])
].map(Number));

// FARS large-truck BODY_TYP codes (GVWR > 10,000 lbs). 50–59 are buses and are
// intentionally excluded — "commercial vehicle" here means large trucks.
const isLargeTruckBodyType = (bodyTyp) => {
  const n = parseInt(bodyTyp, 10);
  return Number.isFinite(n) && n >= 60 && n <= 79;
};

// MCARR_ID sentinels meaning "no motor carrier identified".
const MCARR_NONE = new Set([0, 99999998, 99999999]);

// Reject FARS coordinate sentinels (lat 77.7777/88.8888/99.9999,
// lon 777/888/999.xxxx) and anything outside the US bounding box. A geographic
// sanity range is used rather than matching the sentinel values directly: it
// excludes every sentinel (all fall well outside CONUS+AK+HI+PR) without the
// earlier bug where abs(longitude) of central states (~78–100) looked like a
// latitude sentinel.
const isBadCoord = (lat, lon) =>
  !Number.isFinite(lat) || !Number.isFinite(lon) ||
  lat < 17 || lat > 72 || lon < -180 || lon > -64 ||
  (lat === 0 && lon === 0);

const farsZipUrl = (year) =>
  `https://static.nhtsa.gov/nhtsa/downloads/FARS/${year}/National/FARS${year}NationalCSV.zip`;

// Spatial grid resolution. The DB polylines carry 50k+ points each, so a
// pointToLineDistance scan per crash is O(50k) and takes ~34ms/crash — minutes
// per refresh and a hang risk for the monthly job. Instead we bucket the line's
// vertices into ~1.1 km cells ONCE; each crash is then an O(ring²) Set lookup of
// its cell + neighbors. No per-crash distance math.
const CELL_DEG = 0.01;                 // ~1.1 km latitude
const cellKey = (latIdx, lonIdx) => `${latIdx}:${lonIdx}`;
const cellIdx = (deg) => Math.round(deg / CELL_DEG);

/**
 * Build a per-corridor spatial index from the interstate polylines.
 * getCorridorLine(corridor) returns an array of [lon,lat] coordinate arrays
 * (one per direction), or null/empty if geometry is unavailable (→ text fallback).
 * Returns { [corridor]: Set<cellKey> | null }.
 */
function buildCorridorClips(getCorridorLine) {
  const clips = {};
  for (const corridor of Object.keys(CORRIDOR_STATE_FIPS)) {
    const lines = (getCorridorLine && getCorridorLine(corridor)) || [];
    const valid = lines.filter(c => Array.isArray(c) && c.length >= 2);
    if (valid.length === 0) { clips[corridor] = null; continue; }
    const cells = new Set();
    for (const coords of valid) {
      for (const pt of coords) {
        // pt is [lon, lat]; guard against malformed entries.
        const lon = pt[0], lat = pt[1];
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        cells.add(cellKey(cellIdx(lat), cellIdx(lon)));
      }
    }
    clips[corridor] = cells.size ? cells : null;
  }
  return clips;
}

/**
 * Decide which corridor (if any) a crash point belongs to.
 * Returns 'I-80' | 'I-35' | null. With a spatial index, a crash matches a
 * corridor if its cell (or a neighbor within `ring` cells, derived from
 * bufferMiles) contains a line vertex; the closest ring wins ties. With no
 * geometry (Set null), falls back to a TWAY_ID interstate-number text match.
 */
function matchCorridor({ lat, lon, twayId, stateFips }, clips, bufferMiles) {
  // ring of cells to scan ≈ buffer distance / cell width (~1.1 km/cell)
  const ring = Math.max(1, Math.round((bufferMiles * 1.60934) / 1.1));
  const latI = cellIdx(lat), lonI = cellIdx(lon);
  let best = null, bestRing = Infinity;
  for (const corridor of Object.keys(CORRIDOR_STATE_FIPS)) {
    if (!CORRIDOR_STATE_FIPS[corridor][stateFips]) continue; // wrong state for this corridor
    const cells = clips[corridor];
    if (cells) {
      // Find the smallest neighbor-ring at which this corridor has a vertex.
      let hitRing = Infinity;
      for (let d = 0; d <= ring && hitRing === Infinity; d++) {
        for (let dLat = -d; dLat <= d && hitRing === Infinity; dLat++) {
          for (let dLon = -d; dLon <= d; dLon++) {
            if (Math.max(Math.abs(dLat), Math.abs(dLon)) !== d) continue; // only this ring's border
            if (cells.has(cellKey(latI + dLat, lonI + dLon))) { hitRing = d; break; }
          }
        }
      }
      if (hitRing < bestRing) { bestRing = hitRing; best = corridor; }
    } else {
      // Geometry fallback: match interstate number in the trafficway id.
      const num = corridor.replace('I-', '');
      const re = new RegExp(`\\bI[-\\s]?${num}\\b`, 'i');
      if (twayId && re.test(twayId) && bestRing === Infinity) best = best || corridor;
    }
  }
  return best;
}

/** Download one FARS year zip into a Buffer. Returns null on 404 (year not yet published). */
async function downloadFarsYear(year, log) {
  const url = farsZipUrl(year);
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 180000,
      maxContentLength: 200 * 1024 * 1024,
      headers: { 'User-Agent': 'DOT-Corridor-Communicator/1.0 (+crash-analytics)' }
    });
    return Buffer.from(res.data);
  } catch (err) {
    if (err.response?.status === 404) {
      log(`   ⏭️  FARS ${year} not published yet (404) — skipping`);
      return null;
    }
    throw new Error(`FARS ${year} download failed: ${err.message}`);
  }
}

/** Stream a CSV entry (matched by regex) out of a loaded zip, row by row. */
async function forEachCsvRow(zip, nameRegex, onRow) {
  const matches = zip.file(nameRegex);
  if (!matches || matches.length === 0) {
    throw new Error(`CSV entry ${nameRegex} not found in FARS zip`);
  }
  const parser = matches[0].nodeStream().pipe(parse({
    columns: true,
    bom: true, // FARS CSVs carry a UTF-8 BOM; without this the first column key is mangled
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true
  }));
  for await (const row of parser) onRow(row);
}

/**
 * Parse a single FARS year zip → array of on-corridor crash records.
 * Two passes over the year's data, streamed (memory stays bounded to the
 * on-corridor case set, which is small):
 *   1. accident.csv → keep on-corridor fatal crashes, keyed by ST_CASE.
 *   2. vehicle.csv  → for those cases only, flag commercial-vehicle involvement.
 */
async function parseFarsYear({ year, zipBuffer, clips, bufferMiles, log }) {
  const zip = await JSZip.loadAsync(zipBuffer);
  const cases = new Map(); // key: ST_CASE -> record

  let scanned = 0;
  await forEachCsvRow(zip, /\/accident\.csv$/i, (row) => {
    scanned++;
    const stateFips = parseInt(row.STATE, 10);
    if (!ALL_CORRIDOR_FIPS.has(stateFips)) return;
    if (String(row.ROUTE) !== '1') return; // ROUTE 1 = Interstate; excludes frontage/arterial roads inside the buffer
    const lat = parseFloat(row.LATITUDE);
    const lon = parseFloat(row.LONGITUD);
    if (isBadCoord(lat, lon)) return;
    const twayId = row.TWAY_ID || '';
    const corridor = matchCorridor({ lat, lon, twayId, stateFips }, clips, bufferMiles);
    if (!corridor) return;

    const stCase = String(row.ST_CASE);
    const wrkZone = parseInt(row.WRK_ZONE, 10) || 0;
    cases.set(`${stateFips}:${stCase}`, {
      id: `FARS-${year}-${stateFips}-${stCase}`,
      st_case: stCase,
      year,
      state_fips: stateFips,
      state: (CORRIDOR_STATE_FIPS[corridor][stateFips]) || row.STATENAME || String(stateFips),
      county: row.COUNTYNAME || row.COUNTY || null,
      corridor,
      latitude: lat,
      longitude: lon,
      work_zone: wrkZone,
      work_zone_name: row.WRK_ZONENAME || null,
      fatals: parseInt(row.FATALS, 10) || 0,
      total_vehicles: parseInt(row.VE_TOTAL, 10) || 0, // FARS accident-file: total motor vehicles in the crash
      tway_id: twayId || null,
      commercial_vehicle: 0
    });
  });

  // Pass 2: only inspect vehicles whose crash we kept.
  await forEachCsvRow(zip, /\/vehicle\.csv$/i, (row) => {
    const stateFips = parseInt(row.STATE, 10);
    if (!ALL_CORRIDOR_FIPS.has(stateFips)) return;
    const key = `${stateFips}:${String(row.ST_CASE)}`;
    const rec = cases.get(key);
    if (!rec) return;
    const mcarr = parseInt(row.MCARR_ID, 10);
    const hasCarrier = Number.isFinite(mcarr) && !MCARR_NONE.has(mcarr);
    if (isLargeTruckBodyType(row.BODY_TYP) || hasCarrier) rec.commercial_vehicle = 1;
  });

  log(`   📄 FARS ${year}: scanned ${scanned.toLocaleString()} crashes → ${cases.size} on-corridor`);
  return Array.from(cases.values());
}

const TABLE_DDL = `
CREATE TABLE IF NOT EXISTS crash_records (
  id TEXT PRIMARY KEY,
  st_case TEXT NOT NULL,
  year INTEGER NOT NULL,
  state_fips INTEGER NOT NULL,
  state TEXT,
  county TEXT,
  corridor TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  work_zone INTEGER DEFAULT 0,
  work_zone_name TEXT,
  fatals INTEGER DEFAULT 0,
  total_vehicles INTEGER DEFAULT 0,
  commercial_vehicle INTEGER DEFAULT 0,
  tway_id TEXT,
  source TEXT DEFAULT 'FARS',
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_crash_corridor ON crash_records(corridor);
CREATE INDEX IF NOT EXISTS idx_crash_year ON crash_records(year);
CREATE INDEX IF NOT EXISTS idx_crash_state ON crash_records(state);
`;

async function ensureTable(rawDb) {
  // exec() is fire-and-forget on the PG adapter; await pending ops if present.
  rawDb.exec(TABLE_DDL);
  if (typeof rawDb.waitForPendingOps === 'function') await rawDb.waitForPendingOps();
  // Backfill total_vehicles on a table that predates the column (no-op on fresh
  // tables). PG adapter has .query (supports ADD COLUMN IF NOT EXISTS); sqlite
  // throws if the column exists, which we swallow.
  try {
    if (typeof rawDb.query === 'function') {
      await rawDb.query('ALTER TABLE crash_records ADD COLUMN IF NOT EXISTS total_vehicles INTEGER DEFAULT 0');
    } else {
      rawDb.exec('ALTER TABLE crash_records ADD COLUMN total_vehicles INTEGER DEFAULT 0');
    }
  } catch { /* column already present */ }
}

async function upsertRecords(rawDb, records) {
  const stmt = rawDb.prepare(`
    INSERT OR REPLACE INTO crash_records
      (id, st_case, year, state_fips, state, county, corridor, latitude, longitude,
       work_zone, work_zone_name, fatals, total_vehicles, commercial_vehicle, tway_id, source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  for (const r of records) {
    await stmt.run(
      r.id, r.st_case, r.year, r.state_fips, r.state, r.county, r.corridor,
      r.latitude, r.longitude, r.work_zone, r.work_zone_name, r.fatals,
      r.total_vehicles || 0, r.commercial_vehicle, r.tway_id, 'FARS', now
    );
  }
}

/**
 * Default year window: last 5 published FARS years. FARS lags ~2 years, so the
 * newest we attempt is currentYear - 1 (skipped automatically if 404).
 */
function defaultYears() {
  const newest = new Date().getFullYear() - 1;
  return [newest - 4, newest - 3, newest - 2, newest - 1, newest];
}

/**
 * Full refresh: download → parse → clip → store, one year at a time so peak
 * memory is ~one year's zip. Safe to run on a schedule. Returns a summary.
 *
 * @param {object}   opts
 * @param {object}   opts.db              raw db handle (better-sqlite3 or PG adapter), i.e. `require('./database').db`
 * @param {function} opts.getCorridorLine (corridor) => [[ [lon,lat],... ], ...]  direction lines
 * @param {number[]} [opts.years]
 * @param {number}   [opts.bufferMiles]
 * @param {function} [opts.log]
 */
async function refreshCrashData({ db: rawDb, getCorridorLine, years, bufferMiles, log = console.log } = {}) {
  if (!rawDb) throw new Error('refreshCrashData: db handle required');
  const yrs = years && years.length ? years : defaultYears();
  const buffer = bufferMiles || parseFloat(process.env.CRASH_CORRIDOR_BUFFER_MILES) || 1;
  const clips = buildCorridorClips(getCorridorLine);

  const geomCorridors = Object.keys(clips).filter(c => clips[c]);
  log(`🚗 Crash refresh: years ${yrs.join(', ')} | buffer ${buffer} mi | ` +
      (geomCorridors.length ? `geometry clip for ${geomCorridors.join(', ')}` : 'TWAY_ID text fallback (no corridor geometry loaded)'));

  await ensureTable(rawDb);

  let total = 0;
  const perYear = {};
  for (const year of yrs) {
    let zipBuffer;
    try {
      zipBuffer = await downloadFarsYear(year, log);
    } catch (err) {
      log(`   ❌ ${err.message}`);
      continue;
    }
    if (!zipBuffer) continue;
    const records = await parseFarsYear({ year, zipBuffer, clips, bufferMiles: buffer, log });
    zipBuffer = null; // release before storing
    await upsertRecords(rawDb, records);
    perYear[year] = records.length;
    total += records.length;
  }

  log(`✅ Crash refresh complete: ${total} on-corridor crash records across ${Object.keys(perYear).length} year(s)`);
  return { total, perYear, bufferMiles: buffer, years: yrs };
}

module.exports = {
  refreshCrashData,
  // exported for tests / reuse
  CORRIDOR_STATE_FIPS,
  isLargeTruckBodyType,
  matchCorridor,
  buildCorridorClips,
  parseFarsYear,
  defaultYears,
  TABLE_DDL
};

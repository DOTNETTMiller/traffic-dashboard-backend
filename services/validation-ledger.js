/**
 * Sticky, positive-only validation ledger for TomTom / DMS / device corroboration.
 *
 * Once a work zone is corroborated by one of these sources it STAYS corroborated across
 * cache rebuilds, background refreshes, and TomTom credit cooldowns — the validation
 * accumulates for the user and is NEVER demoted. This is what keeps a zone "validated by
 * TomTom" even after the live incident snapshot rolls over or the account runs out of credits.
 *
 * Cameras are intentionally NOT handled here. They use camera-check-ledger, which re-checks
 * multi-day zones ONCE A DAY and CAN demote (tc_removed) — because a camera can actually SEE
 * that a zone is finished. The other three sources have no such "it's gone" signal, so for
 * them positive-only + sticky is correct.
 *
 * DURABILITY: the source of truth is a JSON file on the persistent `data/` volume (the same
 * disk the truck-parking data uses) — so validations survive restarts AND redeploys. The DB
 * table is kept as a best-effort secondary (prod's Postgres adapter has quirks around plain
 * INSERTs/composite keys), but the file is what we trust. In-memory Maps are the hot path.
 */

const db = require('../database');
const fs = require('fs');
const path = require('path');

function execSql(sql) {
  if (typeof db.db.execAsync === 'function') return db.db.execAsync(sql);
  return db.db.exec(sql);
}

const SOURCES = ['tomtom', 'dms', 'device'];
const mem = { tomtom: new Map(), dms: new Map(), device: new Map() };  // event_id -> meta
const seenAt = { tomtom: new Map(), dms: new Map(), device: new Map() }; // event_id -> epoch ms (for pruning)
let ready = false, hydrated = false, saveTimer = null;

// Durable JSON backing on the persistent volume. LEDGER_FILE overrides; otherwise use the app's
// `data/` dir (Railway-mounted volume) if present, else a repo-local file for dev.
const DATA_DIR = process.env.LEDGER_DIR
  || (fs.existsSync(path.join(__dirname, '..', 'data')) ? path.join(__dirname, '..', 'data') : path.join(__dirname, '..'));
const LEDGER_FILE = process.env.LEDGER_FILE || path.join(DATA_DIR, 'validation-ledger.json');
const PRUNE_MS = 180 * 24 * 60 * 60 * 1000;   // drop zones untouched ~180 days (surely finished)

function loadFile() {
  try {
    if (!fs.existsSync(LEDGER_FILE)) return;
    const obj = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
    const cutoff = Date.now() - PRUNE_MS;
    for (const src of SOURCES) {
      const rows = obj[src] || {};
      for (const id of Object.keys(rows)) {
        const r = rows[id] || {};
        const ts = r.ts || 0;
        if (ts && ts < cutoff) continue;
        mem[src].set(id, r.meta || {});
        seenAt[src].set(id, ts || Date.now());
      }
    }
  } catch (e) { console.error('validation-ledger loadFile:', e.message); }
}

function saveFileSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
      const cutoff = Date.now() - PRUNE_MS;
      const obj = {};
      for (const src of SOURCES) {
        obj[src] = {};
        for (const [id, meta] of mem[src]) {
          const ts = seenAt[src].get(id) || Date.now();
          if (ts < cutoff) { mem[src].delete(id); seenAt[src].delete(id); continue; }
          obj[src][id] = { meta, ts };
        }
      }
      const tmp = LEDGER_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(obj));
      fs.renameSync(tmp, LEDGER_FILE);   // atomic replace
    } catch (e) { console.error('validation-ledger save:', e.message); }
  }, 1500);
}

async function ensure() {
  if (ready) return;
  await execSql(`
    CREATE TABLE IF NOT EXISTS validation_ledger (
      event_id TEXT,
      source   TEXT,
      first_at TEXT,
      last_at  TEXT,
      meta     TEXT,
      PRIMARY KEY (event_id, source)
    );
  `);
  ready = true;
}

// Load the durable ledger into memory once. Safe to call on every request (no-op after first).
async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  loadFile();                                  // PRIMARY: durable file on the persistent volume
  try {                                        // SECONDARY: DB table (best-effort union)
    await ensure();
    const rows = await db.db.prepare('SELECT event_id, source, meta FROM validation_ledger').all();
    for (const r of (rows || [])) {
      if (!mem[r.source] || mem[r.source].has(r.event_id)) continue;
      let m = {}; try { m = JSON.parse(r.meta || '{}'); } catch (_) { /* ignore */ }
      mem[r.source].set(r.event_id, m);
      seenAt[r.source].set(r.event_id, Date.now());
    }
  } catch (e) { /* DB optional — the file is authoritative */ }
}

function has(source, id) { return !!(mem[source] && id && mem[source].has(id)); }
function metaOf(source, id) { return mem[source] && mem[source].get(id); }

// Record a NEW corroboration (idempotent). Sets memory synchronously so has() is immediately
// consistent; persists to the durable file (debounced) + the DB table (background, best-effort).
function add(source, id, meta) {
  if (!mem[source] || !id || mem[source].has(id)) return;
  mem[source].set(id, meta || {});
  seenAt[source].set(id, Date.now());
  saveFileSoon();
  (async () => {
    try {
      await ensure();
      const now = new Date().toISOString();
      await db.db.prepare('INSERT INTO validation_ledger (event_id, source, first_at, last_at, meta) VALUES (?, ?, ?, ?, ?)')
        .run(id, source, now, now, JSON.stringify(meta || {}));
    } catch (e) { /* PK conflict (already stored) or adapter quirk — memory + file are authoritative */ }
  })();
}

// Diagnostics: counts per source + where the durable file lives.
function stats() {
  const counts = {}; for (const s of SOURCES) counts[s] = mem[s].size;
  return { counts, file: LEDGER_FILE, fileExists: (() => { try { return fs.existsSync(LEDGER_FILE); } catch (_) { return false; } })() };
}

module.exports = { hydrate, has, metaOf, add, stats, SOURCES };

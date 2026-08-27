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
 * Driver-agnostic (better-sqlite3 locally, Postgres adapter in prod): an in-memory Map per
 * source is the hot path (re-applied every load with no db read); the table is the durable
 * backing store, hydrated once on startup and written only when a NEW zone is first seen.
 */

const db = require('../database');

function execSql(sql) {
  if (typeof db.db.execAsync === 'function') return db.db.execAsync(sql);
  return db.db.exec(sql);
}

const SOURCES = ['tomtom', 'dms', 'device'];
const mem = { tomtom: new Map(), dms: new Map(), device: new Map() }; // event_id -> meta
let ready = false, hydrated = false;

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
  try {
    await ensure();
    const rows = await db.db.prepare('SELECT event_id, source, meta FROM validation_ledger').all();
    for (const r of (rows || [])) {
      if (!mem[r.source]) continue;
      let m = {}; try { m = JSON.parse(r.meta || '{}'); } catch (_) { /* ignore */ }
      mem[r.source].set(r.event_id, m);
    }
  } catch (e) { console.error('validation-ledger hydrate:', e.message); }
  hydrated = true;
}

function has(source, id) { return !!(mem[source] && id && mem[source].has(id)); }
function metaOf(source, id) { return mem[source] && mem[source].get(id); }

// Record a NEW corroboration (idempotent). Sets memory synchronously so has() is immediately
// consistent; persists to the table in the background (never blocks the response).
function add(source, id, meta) {
  if (!mem[source] || !id || mem[source].has(id)) return;
  mem[source].set(id, meta || {});
  (async () => {
    try {
      await ensure();
      const now = new Date().toISOString();
      await db.db.prepare('INSERT INTO validation_ledger (event_id, source, first_at, last_at, meta) VALUES (?, ?, ?, ?, ?)')
        .run(id, source, now, now, JSON.stringify(meta || {}));
      // Prune zones not touched in ~180 days (surely finished) so the table can't grow forever.
      const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      await db.db.prepare('DELETE FROM validation_ledger WHERE last_at < ?').run(cutoff);
    } catch (e) { /* PK conflict (raced) or write error — memory is already authoritative */ }
  })();
}

module.exports = { hydrate, has, metaOf, add, SOURCES };

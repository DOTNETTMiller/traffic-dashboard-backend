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
 * DURABILITY: persists to the `validation_ledger` table in db.db — Postgres on prod (the SAME
 * durable store the camera ledger uses; the app's local disk is ephemeral on Railway), SQLite
 * locally. Hydrated once on startup; the in-memory Map per source is the hot path. A forced-
 * redeploy test confirmed the full set reloads after a restart. (Sticky flag reads 0 while the
 * source is live because a fresh pull re-corroborates the same zones — it only lights up when the
 * source can't re-see a zone and the ledger keeps it alive.)
 */

const db = require('../database');
const { subjectKey } = require('./stable-event-key');

// A ledger keyed on the published id loses everything the moment the publisher changes it.
// Iowa's ids carry the event's current segmentation, so re-segmenting a zone destroys every
// id naming it -- measured at 6 events and 39 ids in one 18-hour window. Nothing here removes
// a row when its id leaves the feed (rows go only on the 180-day prune), so each occurrence
// strands accumulated evidence on a dead id AND returns the same physical zone under new ids
// carrying nothing.
//
// The subject index below is the fallback: evidence recorded against any id is also reachable
// by the subject that id names, so a re-identified zone inherits rather than resets.
//
// THE TRADE, STATED PLAINLY. A subject is the event on its carriageway, not one slice of it.
// Iowa averages ~3 segments per subject and runs to 14, so inheriting by subject can credit a
// segment that no source actually saw. That is a real loss of precision, accepted because the
// alternative is discarding weeks of true corroboration whenever a publisher re-slices a zone.
// An inherited hit is marked `subject_inherited` so a consumer can tell it apart from a direct
// one. Off by default: it changes what counts as corroborated.
const USE_SUBJECT_KEY = process.env.STABLE_EVENT_KEY === 'true';

function execSql(sql) {
  if (typeof db.db.execAsync === 'function') return db.db.execAsync(sql);
  return db.db.exec(sql);
}

const SOURCES = ['tomtom', 'dms', 'device', 'haulhub'];
// haulhub = contractor worker presence. Safe to make sticky for the same reason as the
// others: its feed only ever publishes are_workers_present=true, so it can confirm a zone
// but can never observe that one has finished.
const mem = { tomtom: new Map(), dms: new Map(), device: new Map(), haulhub: new Map() }; // event_id -> meta
// subject -> meta, the fallback index. Populated alongside mem, never instead of it, so an
// exact-id hit always wins and inheritance only fills a gap.
const bySubject = { tomtom: new Map(), dms: new Map(), device: new Map(), haulhub: new Map() };
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
      if (USE_SUBJECT_KEY) {
        const sk = subjectKey(r.event_id);
        if (sk && !bySubject[r.source].has(sk)) bySubject[r.source].set(sk, m);
      }
    }
  } catch (e) { console.error('validation-ledger hydrate:', e.message); }
  hydrated = true;
}

function has(source, id) {
  if (!mem[source] || !id) return false;
  if (mem[source].has(id)) return true;
  if (!USE_SUBJECT_KEY) return false;
  const sk = subjectKey(id);
  return sk !== id && bySubject[source].has(sk);   // inherited across a re-identification
}

function metaOf(source, id) {
  if (!mem[source] || !id) return undefined;
  const direct = mem[source].get(id);
  if (direct) return direct;
  if (!USE_SUBJECT_KEY) return undefined;
  const sk = subjectKey(id);
  if (sk === id) return undefined;
  const inherited = bySubject[source].get(sk);
  // Flagged, not silently promoted: a consumer must be able to see that this zone was
  // corroborated under a different id than the one it now publishes.
  return inherited ? { ...inherited, subject_inherited: true, inherited_subject: sk } : undefined;
}

// Record a NEW corroboration (idempotent). Sets memory synchronously so has() is immediately
// consistent; persists to the table in the background (never blocks the response).
function add(source, id, meta) {
  if (!mem[source] || !id || mem[source].has(id)) return;
  mem[source].set(id, meta || {});
  if (USE_SUBJECT_KEY) {
    const sk = subjectKey(id);
    if (sk && !bySubject[source].has(sk)) bySubject[source].set(sk, meta || {});
  }
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

// Diagnostics (exposed on /api/tomtom/status): in-memory counts per source + the backing store.
function stats() {
  const counts = {}; for (const s of SOURCES) counts[s] = mem[s].size;
  const subjects = {}; for (const s of SOURCES) subjects[s] = bySubject[s].size;
  return { counts, subjects, subjectKeyEnabled: USE_SUBJECT_KEY,
           store: process.env.DATABASE_URL ? 'postgres' : 'sqlite' };
}

module.exports = { hydrate, has, metaOf, add, stats, SOURCES };

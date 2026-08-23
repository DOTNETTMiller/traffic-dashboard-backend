/**
 * Per-closure camera-check ledger — enforces "at most 2 vision checks per work zone,
 * ever." Persisted to SQLite so the cap survives restarts. Lazily creates its table.
 *
 * Policy (see camera-scan.js): check #1 near the zone's start; if it sees nothing, one
 * follow-up ~30 min later; if that also sees nothing, done. A positive sighting ends it.
 */

const db = require('../database');

let ready = false;
function ensure() {
  if (ready) return;
  db.db.exec(`
    CREATE TABLE IF NOT EXISTS camera_check_ledger (
      event_id TEXT PRIMARY KEY,
      checks INTEGER DEFAULT 0,
      first_check_at TEXT,
      last_check_at TEXT,
      seen INTEGER DEFAULT 0,
      elevated INTEGER DEFAULT 0
    );
  `);
  ready = true;
}

// Current ledger row for an event, or null. Never throws.
function get(eventId) {
  try {
    ensure();
    return db.db.prepare('SELECT * FROM camera_check_ledger WHERE event_id = ?').get(eventId) || null;
  } catch (e) { return null; }
}

// Record a check result (increments checks; stamps first/last time). Never throws.
function record(eventId, { seen, elevated }) {
  try {
    ensure();
    const now = new Date().toISOString();
    const cur = get(eventId);
    if (cur) {
      db.db.prepare(`UPDATE camera_check_ledger SET checks = checks + 1, last_check_at = ?,
        seen = ?, elevated = ? WHERE event_id = ?`)
        .run(now, seen ? 1 : (cur.seen || 0), elevated ? 1 : (cur.elevated || 0), eventId);
    } else {
      db.db.prepare(`INSERT INTO camera_check_ledger (event_id, checks, first_check_at, last_check_at, seen, elevated)
        VALUES (?, 1, ?, ?, ?, ?)`).run(eventId, now, now, seen ? 1 : 0, elevated ? 1 : 0);
    }
    // Bound table growth (closures churn); keep the most recent 20k rows.
    db.db.prepare(`DELETE FROM camera_check_ledger WHERE event_id NOT IN
      (SELECT event_id FROM camera_check_ledger ORDER BY last_check_at DESC LIMIT 20000)`).run();
  } catch (e) { console.error('camera-check-ledger record:', e.message); }
}

module.exports = { get, record };

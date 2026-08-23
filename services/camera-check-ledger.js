/**
 * Per-closure camera-check ledger. Enforces the check policy across restarts (SQLite).
 *
 * Phases (see camera-scan.js):
 *   - initial/follow-up: near the start, confirm the zone is real — at most 2 checks.
 *   - daily: for MULTI-DAY closures that were confirmed, one check per day to detect when
 *     the traffic control is REMOVED (zone actually done, even if WZDx still lists it).
 * `checks` counts only the initial-phase attempts (the "≤2" cap); daily checks update
 * last_check_at and can flip tc_removed without touching that cap.
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
      tc_removed INTEGER DEFAULT 0,
      elevated INTEGER DEFAULT 0
    );
  `);
  // Migrate older tables that predate tc_removed.
  try { db.db.exec('ALTER TABLE camera_check_ledger ADD COLUMN tc_removed INTEGER DEFAULT 0'); } catch (_) { /* exists */ }
  ready = true;
}

function get(eventId) {
  try { ensure(); return db.db.prepare('SELECT * FROM camera_check_ledger WHERE event_id = ?').get(eventId) || null; }
  catch (e) { return null; }
}

// Record a check. phase 'initial'|'followup' counts toward the ≤2 cap; 'daily' does not.
// On a 'daily' check that sees nothing after having been seen, tc_removed flips to 1.
function record(eventId, { phase, seen }) {
  try {
    ensure();
    const now = new Date().toISOString();
    const isInitial = phase === 'initial' || phase === 'followup';
    const cur = get(eventId);
    if (!cur) {
      db.db.prepare(`INSERT INTO camera_check_ledger (event_id, checks, first_check_at, last_check_at, seen, tc_removed, elevated)
        VALUES (?, ?, ?, ?, ?, 0, ?)`).run(eventId, isInitial ? 1 : 0, now, now, seen ? 1 : 0, seen ? 1 : 0);
    } else {
      const checks = cur.checks + (isInitial ? 1 : 0);
      const seenV = seen ? 1 : (cur.seen || 0);
      const tcRemoved = phase === 'daily' ? (seen ? 0 : 1) : (cur.tc_removed || 0);
      const elevated = phase === 'daily' ? (seen ? 1 : 0) : (seen ? 1 : (cur.elevated || 0));
      db.db.prepare(`UPDATE camera_check_ledger SET checks = ?, last_check_at = ?, seen = ?, tc_removed = ?, elevated = ?
        WHERE event_id = ?`).run(checks, now, seenV, tcRemoved, elevated, eventId);
    }
    db.db.prepare(`DELETE FROM camera_check_ledger WHERE event_id NOT IN
      (SELECT event_id FROM camera_check_ledger ORDER BY last_check_at DESC LIMIT 20000)`).run();
  } catch (e) { console.error('camera-check-ledger record:', e.message); }
}

module.exports = { get, record };

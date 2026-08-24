/**
 * Per-closure camera-check ledger. Enforces the check policy across restarts.
 *
 * Phases (see camera-scan.js):
 *   - initial/follow-up: near the start, confirm the zone is real — at most 2 checks.
 *   - daily: for MULTI-DAY closures that were confirmed, one check per day to detect when
 *     the traffic control is REMOVED (zone actually done, even if WZDx still lists it).
 * `checks` counts only the initial-phase attempts (the "≤2" cap); daily checks update
 * last_check_at and can flip tc_removed without touching that cap.
 *
 * IMPORTANT: works on BOTH better-sqlite3 (local, synchronous) and the Postgres adapter
 * (prod, async). Every db call is awaited — awaiting a synchronous value is a no-op, while
 * awaiting the pg-adapter's Promises is required. (A prior version called these synchronously,
 * so on Postgres get() returned a Promise and the whole policy silently no-opped.)
 */

const db = require('../database');

// exec that works on both drivers (pg-adapter exposes execAsync; better-sqlite3 exec()).
function execSql(sql) {
  if (typeof db.db.execAsync === 'function') return db.db.execAsync(sql);
  return db.db.exec(sql);
}

let ready = false;
async function ensure() {
  if (ready) return;
  await execSql(`
    CREATE TABLE IF NOT EXISTS camera_check_ledger (
      event_id TEXT PRIMARY KEY,
      checks INTEGER DEFAULT 0,
      first_check_at TEXT,
      last_check_at TEXT,
      seen INTEGER DEFAULT 0,
      tc_removed INTEGER DEFAULT 0,
      elevated INTEGER DEFAULT 0,
      camera_id TEXT,
      camera_url TEXT,
      devices TEXT,
      detected_at TEXT
    );
  `);
  // Add columns that post-date the original table (each guarded independently).
  for (const col of ['tc_removed INTEGER DEFAULT 0', 'camera_id TEXT', 'camera_url TEXT', 'devices TEXT', 'detected_at TEXT']) {
    try { await execSql(`ALTER TABLE camera_check_ledger ADD COLUMN ${col}`); } catch (_) { /* exists */ }
  }
  ready = true;
}

async function get(eventId) {
  try { await ensure(); return (await db.db.prepare('SELECT * FROM camera_check_ledger WHERE event_id = ?').get(eventId)) || null; }
  catch (e) { return null; }
}

// All zones confirmed by camera and not since seen TC-removed → { event_id: {camera_id, camera_url, devices, detected_at} }.
// Used to re-stamp x_camera_verified on the transient event cache for free (no vision).
async function verifiedMap() {
  try {
    await ensure();
    const rows = await db.db.prepare(
      'SELECT event_id, camera_id, camera_url, devices, detected_at FROM camera_check_ledger WHERE seen = 1 AND (tc_removed IS NULL OR tc_removed = 0)'
    ).all();
    const m = {};
    for (const r of (rows || [])) m[r.event_id] = r;
    return m;
  } catch (e) { return {}; }
}

// Record a check. phase 'initial'|'followup' counts toward the ≤2 cap; 'daily' does not.
// On a 'daily' check that sees nothing after having been seen, tc_removed flips to 1.
// detail {camera, cameraUrl, devices, detectedAt} is persisted so verified zones can be
// re-stamped after a cache rebuild without spending another vision check.
async function record(eventId, { phase, seen, camera, cameraUrl, devices, detectedAt } = {}) {
  try {
    await ensure();
    const now = new Date().toISOString();
    const isInitial = phase === 'initial' || phase === 'followup';
    const devJson = devices ? JSON.stringify(devices) : null;
    const cur = await get(eventId);
    if (!cur) {
      await db.db.prepare(`INSERT INTO camera_check_ledger
        (event_id, checks, first_check_at, last_check_at, seen, tc_removed, elevated, camera_id, camera_url, devices, detected_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`)
        .run(eventId, isInitial ? 1 : 0, now, now, seen ? 1 : 0, seen ? 1 : 0,
             seen ? (camera || null) : null, seen ? (cameraUrl || null) : null, seen ? devJson : null, seen ? now : null);
    } else {
      const checks = cur.checks + (isInitial ? 1 : 0);
      const seenV = seen ? 1 : (cur.seen || 0);
      const tcRemoved = phase === 'daily' ? (seen ? 0 : 1) : (cur.tc_removed || 0);
      const elevated = phase === 'daily' ? (seen ? 1 : 0) : (seen ? 1 : (cur.elevated || 0));
      // Keep the latest confirming detection's detail; preserve prior on a non-seeing check.
      const camId = seen ? (camera || cur.camera_id || null) : (cur.camera_id || null);
      const camUrl = seen ? (cameraUrl || cur.camera_url || null) : (cur.camera_url || null);
      const dev = seen ? (devJson || cur.devices || null) : (cur.devices || null);
      const detAt = seen ? now : (cur.detected_at || null);
      await db.db.prepare(`UPDATE camera_check_ledger SET checks = ?, last_check_at = ?, seen = ?, tc_removed = ?, elevated = ?,
        camera_id = ?, camera_url = ?, devices = ?, detected_at = ? WHERE event_id = ?`)
        .run(checks, now, seenV, tcRemoved, elevated, camId, camUrl, dev, detAt, eventId);
    }
    await db.db.prepare(`DELETE FROM camera_check_ledger WHERE event_id NOT IN
      (SELECT event_id FROM camera_check_ledger ORDER BY last_check_at DESC LIMIT 20000)`).run();
  } catch (e) { console.error('camera-check-ledger record:', e.message); }
}

module.exports = { get, verifiedMap, record };

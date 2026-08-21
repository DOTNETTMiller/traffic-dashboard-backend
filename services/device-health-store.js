// Persistence for device↔work-zone validation health snapshots, so the trend
// survives restarts (the in-memory trend resets on each deploy). Uses the app's
// SQLite handle; the table is created lazily so no change to database.js is needed.

const db = require('../database');

let ready = false;
function ensureTable() {
  if (ready) return;
  db.db.exec(`
    CREATE TABLE IF NOT EXISTS device_health_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      devices INTEGER,
      auto_linked INTEGER,
      match_rate REAL,
      avg_confidence INTEGER,
      warn INTEGER,
      fail INTEGER,
      coverage_rate REAL,
      summary TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_device_health_ts ON device_health_snapshots(id DESC);
  `);
  ready = true;
}

const MAX_ROWS = 5000; // ~months of on-demand refreshes; pruned to keep the table small

// Persist one validation summary. Never throws (monitoring must not break the refresh).
function record(summary) {
  if (!summary) return;
  try {
    ensureTable();
    db.db.prepare(`
      INSERT INTO device_health_snapshots
        (ts, devices, auto_linked, match_rate, avg_confidence, warn, fail, coverage_rate, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      summary.timestamp,
      summary.feed.devices,
      summary.matching.autoLinked,
      summary.matching.matchRate,
      summary.matching.avgConfidence,
      summary.validation.warn,
      summary.validation.fail,
      summary.coverage.coverageRate,
      JSON.stringify(summary)
    );
    db.db.prepare(`
      DELETE FROM device_health_snapshots
      WHERE id NOT IN (SELECT id FROM device_health_snapshots ORDER BY id DESC LIMIT ?)
    `).run(MAX_ROWS);
  } catch (e) {
    console.error('device-health-store record failed:', e.message);
  }
}

// Return the last `limit` snapshots oldest→newest for charting. Empty array on any failure.
function trend(limit = 288) {
  try {
    ensureTable();
    const rows = db.db.prepare(`
      SELECT ts AS timestamp, devices, auto_linked AS autoLinked, match_rate AS matchRate,
             avg_confidence AS avgConfidence, warn, fail, coverage_rate AS coverageRate
      FROM device_health_snapshots ORDER BY id DESC LIMIT ?
    `).all(limit);
    return rows.reverse();
  } catch (e) {
    console.error('device-health-store trend failed:', e.message);
    return [];
  }
}

module.exports = { record, trend };

#!/usr/bin/env node

/**
 * Add Feed Fetch Tracking Tables
 *
 * Creates tables to track feed fetch success/failure for data quality monitoring
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'traffic_data.db');
const db = new Database(dbPath);

console.log('📊 Adding feed fetch tracking tables...\n');

try {
  db.exec('BEGIN TRANSACTION');

  // Create feed_fetch_history table
  console.log('Creating feed_fetch_history table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS feed_fetch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      state_key TEXT NOT NULL,
      feed_type TEXT NOT NULL, -- 'events', 'incidents', 'cameras', etc.
      fetch_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      success INTEGER NOT NULL, -- 1 for success, 0 for failure
      response_time_ms INTEGER, -- Response time in milliseconds
      event_count INTEGER DEFAULT 0, -- Number of events fetched
      error_message TEXT, -- Error details if failed
      http_status INTEGER, -- HTTP status code
      FOREIGN KEY (state_key) REFERENCES states(state_key)
    );
  `);

  // Create index for faster queries
  console.log('Creating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_fetch_history_state_time
    ON feed_fetch_history(state_key, fetch_timestamp DESC);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_fetch_history_success
    ON feed_fetch_history(state_key, success, fetch_timestamp DESC);
  `);

  // Create feed_availability_summary table for quick lookups
  console.log('Creating feed_availability_summary table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS feed_availability_summary (
      state_key TEXT PRIMARY KEY,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_fetches INTEGER DEFAULT 0,
      successful_fetches INTEGER DEFAULT 0,
      failed_fetches INTEGER DEFAULT 0,
      uptime_percentage_24h REAL DEFAULT 100,
      uptime_percentage_7d REAL DEFAULT 100,
      uptime_percentage_30d REAL DEFAULT 100,
      avg_response_time_ms INTEGER DEFAULT 0,
      last_success_timestamp DATETIME,
      last_failure_timestamp DATETIME,
      consecutive_failures INTEGER DEFAULT 0,
      FOREIGN KEY (state_key) REFERENCES states(state_key)
    );
  `);

  db.exec('COMMIT');

  console.log('✅ Feed fetch tracking tables created successfully!\n');

  // Verify tables
  console.log('🔍 Verification:');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND (name LIKE '%fetch%' OR name LIKE '%availability%')
  `).all();

  tables.forEach(table => {
    console.log(`   ✓ ${table.name}`);
  });

  console.log('\n📈 Summary:');
  console.log('   - feed_fetch_history: Tracks every fetch attempt');
  console.log('   - feed_availability_summary: Aggregated availability metrics');
  console.log('   - Indexes created for optimal query performance');

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  throw error;
} finally {
  db.close();
}

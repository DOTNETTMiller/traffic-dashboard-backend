#!/usr/bin/env node

/**
 * Create WFS Connections Table
 *
 * Stores Web Feature Service endpoints for real-time ITS equipment sync
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'traffic_data.db');
const db = new Database(DB_PATH);

console.log('🌐 Creating WFS Connections Table...\n');

try {
  db.pragma('foreign_keys = ON');

  console.log('📦 Creating wfs_connections table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS wfs_connections (
      id TEXT PRIMARY KEY,
      state_key TEXT NOT NULL,
      connection_name TEXT NOT NULL,
      wfs_url TEXT NOT NULL,
      wfs_version TEXT DEFAULT '2.0.0',
      type_name TEXT NOT NULL, -- Feature type name to query

      -- Sync settings
      sync_enabled BOOLEAN DEFAULT TRUE,
      sync_interval INTEGER DEFAULT 3600, -- seconds (default: 1 hour)
      last_sync TEXT,
      next_sync TEXT,

      -- Filters
      cql_filter TEXT, -- Optional CQL filter expression
      bbox TEXT, -- Optional bounding box (minx,miny,maxx,maxy)
      max_features INTEGER DEFAULT 1000,

      -- Status
      status TEXT DEFAULT 'active', -- active, error, disabled
      last_error TEXT,
      total_features_synced INTEGER DEFAULT 0,

      -- Metadata
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),

      FOREIGN KEY (state_key) REFERENCES states(state_key)
    )
  `);
  console.log('✅ wfs_connections table created\n');

  console.log('📦 Creating wfs_sync_history table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS wfs_sync_history (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      sync_date TEXT DEFAULT (datetime('now')),

      features_fetched INTEGER,
      features_imported INTEGER,
      features_updated INTEGER,
      features_failed INTEGER,

      duration_ms INTEGER,
      status TEXT, -- success, partial, failed
      error_message TEXT,

      FOREIGN KEY (connection_id) REFERENCES wfs_connections(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ wfs_sync_history table created\n');

  console.log('🔍 Creating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_wfs_state ON wfs_connections(state_key);
    CREATE INDEX IF NOT EXISTS idx_wfs_enabled ON wfs_connections(sync_enabled);
    CREATE INDEX IF NOT EXISTS idx_wfs_next_sync ON wfs_connections(next_sync);
    CREATE INDEX IF NOT EXISTS idx_sync_history_connection ON wfs_sync_history(connection_id);
    CREATE INDEX IF NOT EXISTS idx_sync_history_date ON wfs_sync_history(sync_date);
  `);
  console.log('✅ Indexes created\n');

  console.log('✨ WFS Connections schema created successfully!\n');

} catch (error) {
  console.error('❌ Error creating WFS tables:', error);
  process.exit(1);
} finally {
  db.close();
}

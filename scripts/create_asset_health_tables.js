#!/usr/bin/env node

/**
 * Database Migration: Asset Health & Management Tables
 *
 * Creates tables for Phase 2: Sensor Health & Asset Management
 * - Tracks ITS equipment health (CCTV, RSU, DMS, RWIS, Detectors)
 * - Historical health tracking
 * - Maintenance scheduling
 * - Predictive failure alerts
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'traffic_data.db');

let db;
try {
  db = new Database(DB_PATH);
  console.log('✓ Connected to database:', DB_PATH);
} catch (err) {
  console.error('❌ Error connecting to database:', err);
  process.exit(1);
}

// Migration SQL
const migrations = [
  {
    name: 'asset_health',
    sql: `
      CREATE TABLE IF NOT EXISTS asset_health (
        asset_id TEXT PRIMARY KEY,
        asset_type TEXT NOT NULL, -- 'CCTV', 'RSU', 'DMS', 'RWIS', 'DETECTOR'
        location_lat REAL,
        location_lon REAL,
        state_key TEXT,
        corridor TEXT,

        -- Health status
        status TEXT DEFAULT 'OPERATIONAL', -- 'OPERATIONAL', 'DEGRADED', 'FAILED', 'MAINTENANCE'
        last_online DATETIME,
        last_successful_ping DATETIME,
        uptime_percentage_30d REAL DEFAULT 100,

        -- Performance metrics
        message_success_rate REAL, -- for RSUs
        video_quality_score REAL, -- for cameras
        display_error_count INTEGER DEFAULT 0, -- for DMS
        sensor_accuracy_score REAL, -- for RWIS

        -- Maintenance tracking
        last_maintenance_date DATE,
        next_maintenance_due DATE,
        maintenance_vendor TEXT,
        warranty_expiration DATE,

        -- Equipment details
        manufacturer TEXT,
        model TEXT,
        serial_number TEXT,
        install_date DATE,
        age_years REAL,
        estimated_remaining_life_years REAL,

        -- Predictive analytics
        failure_probability_7d REAL DEFAULT 0, -- 0-100
        failure_probability_14d REAL DEFAULT 0,
        failure_probability_30d REAL DEFAULT 0,
        ai_recommendation TEXT,

        -- Metadata
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (state_key) REFERENCES states(state_key)
      );
    `
  },
  {
    name: 'asset_health_index_state',
    sql: `CREATE INDEX IF NOT EXISTS idx_asset_state ON asset_health(state_key);`
  },
  {
    name: 'asset_health_index_type',
    sql: `CREATE INDEX IF NOT EXISTS idx_asset_type ON asset_health(asset_type);`
  },
  {
    name: 'asset_health_index_status',
    sql: `CREATE INDEX IF NOT EXISTS idx_asset_status ON asset_health(status);`
  },
  {
    name: 'asset_health_index_corridor',
    sql: `CREATE INDEX IF NOT EXISTS idx_asset_corridor ON asset_health(corridor);`
  },
  {
    name: 'asset_health_history',
    sql: `
      CREATE TABLE IF NOT EXISTS asset_health_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT,
        performance_metric REAL,
        uptime_percentage REAL,
        alert_triggered BOOLEAN DEFAULT FALSE,
        alert_type TEXT, -- 'FAILURE', 'DEGRADED', 'MAINTENANCE_DUE', 'PREDICTED_FAILURE'
        notes TEXT,

        FOREIGN KEY (asset_id) REFERENCES asset_health(asset_id)
      );
    `
  },
  {
    name: 'asset_health_history_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_ahh_asset_timestamp ON asset_health_history(asset_id, timestamp DESC);`
  },
  {
    name: 'asset_health_history_alert_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_ahh_alerts ON asset_health_history(alert_triggered, timestamp DESC);`
  },
  {
    name: 'asset_coverage_gaps',
    sql: `
      CREATE TABLE IF NOT EXISTS asset_coverage_gaps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        state_key TEXT NOT NULL,
        corridor TEXT NOT NULL,
        segment_start_lat REAL,
        segment_start_lon REAL,
        segment_end_lat REAL,
        segment_end_lon REAL,
        gap_distance_miles REAL,

        -- Gap analysis
        missing_asset_types TEXT, -- JSON array of missing types
        incident_response_time_avg_minutes REAL,
        incident_count_30d INTEGER,
        traffic_volume_aadt INTEGER,
        priority_score REAL, -- 0-100, calculated from incident count, traffic volume, response time

        -- Recommendations
        recommended_equipment TEXT, -- JSON array of equipment types
        estimated_installation_cost REAL,
        estimated_annual_roi REAL,
        matching_grant_programs TEXT, -- JSON array of applicable grants

        -- Metadata
        last_analyzed DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'IDENTIFIED', -- 'IDENTIFIED', 'FUNDING_SOUGHT', 'APPROVED', 'INSTALLED'

        FOREIGN KEY (state_key) REFERENCES states(state_key),
        UNIQUE(state_key, corridor, segment_start_lat, segment_start_lon)
      );
    `
  },
  {
    name: 'asset_coverage_gaps_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_acg_state_corridor ON asset_coverage_gaps(state_key, corridor);`
  },
  {
    name: 'asset_coverage_gaps_priority_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_acg_priority ON asset_coverage_gaps(priority_score DESC);`
  },
  {
    name: 'maintenance_schedule',
    sql: `
      CREATE TABLE IF NOT EXISTS maintenance_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT NOT NULL,
        scheduled_date DATE NOT NULL,
        maintenance_type TEXT, -- 'PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY'
        priority TEXT DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
        assigned_vendor TEXT,
        estimated_cost REAL,
        estimated_downtime_hours REAL,

        -- Status tracking
        status TEXT DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
        actual_start_time DATETIME,
        actual_end_time DATETIME,
        actual_cost REAL,
        work_performed TEXT,
        next_maintenance_recommendation DATE,

        -- Metadata
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (asset_id) REFERENCES asset_health(asset_id)
      );
    `
  },
  {
    name: 'maintenance_schedule_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_ms_asset ON maintenance_schedule(asset_id, scheduled_date);`
  },
  {
    name: 'maintenance_schedule_date_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_ms_date ON maintenance_schedule(scheduled_date);`
  },
  {
    name: 'maintenance_schedule_status_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_ms_status ON maintenance_schedule(status);`
  }
];

// Run migrations
function runMigrations() {
  const errors = [];

  for (const migration of migrations) {
    try {
      db.exec(migration.sql);
      console.log(`✓ Created/verified: ${migration.name}`);
    } catch (err) {
      console.error(`❌ Error creating ${migration.name}:`, err.message);
      errors.push({ name: migration.name, error: err.message });
    }
  }

  if (errors.length > 0) {
    throw new Error(`Migration failed with ${errors.length} error(s)`);
  }
}

// Main execution
function main() {
  try {
    console.log('\n🚀 Starting Asset Health Tables Migration...\n');

    runMigrations();

    console.log('\n✅ Migration completed successfully!');
    console.log('\nCreated tables:');
    console.log('  - asset_health (ITS equipment tracking)');
    console.log('  - asset_health_history (historical health data)');
    console.log('  - asset_coverage_gaps (coverage analysis)');
    console.log('  - maintenance_schedule (preventive maintenance)');
    console.log('  + indexes for performance\n');

    db.close();
    console.log('✓ Database connection closed\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    db.close();
    process.exit(1);
  }
}

main();

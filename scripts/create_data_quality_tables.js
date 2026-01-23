#!/usr/bin/env node

/**
 * Database Migration: Data Quality Metrics Tables
 *
 * Creates tables for Phase 1: Data Quality & Accountability Foundation
 * - Tracks 7-dimension quality scores per feed
 * - Historical quality tracking
 * - Vendor/provider performance metrics
 * - State report card data
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
    name: 'data_quality_metrics',
    sql: `
      CREATE TABLE IF NOT EXISTS data_quality_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_key TEXT NOT NULL,
        provider_name TEXT,
        state_key TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

        -- Completeness metrics (0-100)
        total_events INTEGER DEFAULT 0,
        events_with_end_time INTEGER DEFAULT 0,
        events_with_description INTEGER DEFAULT 0,
        events_with_geometry INTEGER DEFAULT 0,
        events_with_severity INTEGER DEFAULT 0,
        events_with_lanes_affected INTEGER DEFAULT 0,
        completeness_score REAL DEFAULT 0,

        -- Freshness metrics (0-100)
        avg_update_latency_seconds REAL,
        max_stale_event_hours REAL,
        events_updated_last_hour INTEGER DEFAULT 0,
        freshness_score REAL DEFAULT 0,

        -- Accuracy metrics (0-100)
        geometry_validation_pass INTEGER DEFAULT 0,
        geometry_validation_fail INTEGER DEFAULT 0,
        schema_valid INTEGER DEFAULT 0,
        schema_invalid INTEGER DEFAULT 0,
        accuracy_score REAL DEFAULT 0,

        -- Availability metrics (0-100)
        fetch_success_count INTEGER DEFAULT 0,
        fetch_failure_count INTEGER DEFAULT 0,
        uptime_percentage REAL DEFAULT 100,
        availability_score REAL DEFAULT 100,

        -- Standardization metrics (0-100)
        wzdx_compliant_events INTEGER DEFAULT 0,
        has_valid_itis_codes INTEGER DEFAULT 0,
        has_valid_event_types INTEGER DEFAULT 0,
        standardization_score REAL DEFAULT 0,

        -- Timeliness metrics (0-100)
        events_future_dated INTEGER DEFAULT 0,
        events_past_30_days INTEGER DEFAULT 0,
        events_stale_over_7_days INTEGER DEFAULT 0,
        timeliness_score REAL DEFAULT 0,

        -- Usability metrics (0-100)
        events_with_contact_info INTEGER DEFAULT 0,
        events_with_restrictions INTEGER DEFAULT 0,
        events_with_work_zone_type INTEGER DEFAULT 0,
        usability_score REAL DEFAULT 0,

        -- Overall scoring
        overall_quality_score REAL DEFAULT 0,
        letter_grade TEXT,
        national_rank INTEGER,

        -- Metadata
        last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (feed_key) REFERENCES data_feeds(feed_key),
        UNIQUE(feed_key, timestamp)
      );
    `
  },
  {
    name: 'data_quality_metrics_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_dqm_feed_timestamp ON data_quality_metrics(feed_key, timestamp DESC);`
  },
  {
    name: 'data_quality_metrics_state_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_dqm_state ON data_quality_metrics(state_key);`
  },
  {
    name: 'quality_history',
    sql: `
      CREATE TABLE IF NOT EXISTS quality_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_key TEXT NOT NULL,
        date DATE NOT NULL,
        daily_score REAL,
        events_processed INTEGER DEFAULT 0,
        issues_detected INTEGER DEFAULT 0,
        uptime_percentage REAL DEFAULT 100,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (feed_key) REFERENCES data_feeds(feed_key),
        UNIQUE(feed_key, date)
      );
    `
  },
  {
    name: 'quality_history_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_qh_feed_date ON quality_history(feed_key, date DESC);`
  },
  {
    name: 'vendor_contracts',
    sql: `
      CREATE TABLE IF NOT EXISTS vendor_contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        state_key TEXT NOT NULL,
        vendor_name TEXT,
        contract_value_annual REAL,
        contract_start_date DATE,
        contract_end_date DATE,
        data_type TEXT,
        sla_uptime_target REAL DEFAULT 99.0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `
  },
  {
    name: 'vendor_contracts_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_vc_state ON vendor_contracts(state_key);`
  },
  {
    name: 'vendor_contracts_vendor_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_vc_vendor ON vendor_contracts(vendor_name);`
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
    console.log('\n🚀 Starting Data Quality Tables Migration...\n');

    runMigrations();

    console.log('\n✅ Migration completed successfully!');
    console.log('\nCreated tables:');
    console.log('  - data_quality_metrics (7-dimension scoring)');
    console.log('  - quality_history (daily rollups)');
    console.log('  - vendor_contracts (contract tracking)');
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

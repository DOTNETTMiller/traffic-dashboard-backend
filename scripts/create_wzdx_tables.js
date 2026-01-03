/**
 * Create WZDx (Work Zone Data Exchange) Database Tables
 *
 * Creates tables for storing WZDx v4.2 compliant work zone data
 * from state DOT feeds and for generating our own WZDx exports.
 */

const db = require('../database');

async function createWZDxTables() {
  console.log('Creating WZDx database tables...\n');

  try {
    // ========================================================================
    // WZDX_WORK_ZONES - Main work zone storage table
    // ========================================================================
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS wzdx_work_zones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        -- WZDx Core Identification
        feature_id TEXT UNIQUE NOT NULL,  -- WZDx road_event_id or unique identifier

        -- Road Information
        road_name TEXT,  -- e.g., "Interstate 80"
        road_number TEXT,  -- e.g., "I-80"
        direction TEXT,  -- northbound, southbound, eastbound, westbound
        beginning_milepost REAL,
        ending_milepost REAL,
        beginning_cross_street TEXT,
        ending_cross_street TEXT,

        -- Event Classification
        event_type TEXT NOT NULL,  -- work-zone, detour, special-event, etc.
        event_status TEXT,  -- active, pending, planned, completed, cancelled
        vehicle_impact TEXT,  -- all-lanes-open, some-lanes-closed, all-lanes-closed, etc.

        -- Temporal Information
        start_date TEXT NOT NULL,
        end_date TEXT,
        is_start_date_verified BOOLEAN DEFAULT 0,
        is_end_date_verified BOOLEAN DEFAULT 0,
        is_end_date_all_day BOOLEAN DEFAULT 0,

        -- Work Zone Details
        work_zone_type TEXT,  -- static, moving, planned-moving-area
        reduced_speed_limit INTEGER,  -- mph
        restrictions TEXT,  -- JSON array of restrictions
        description TEXT,
        creation_date TEXT,
        update_date TEXT,

        -- Lane Information
        lanes TEXT,  -- JSON array of lane objects
        beginning_accuracy TEXT,  -- estimated, verified
        ending_accuracy TEXT,

        -- Location Method
        location_method TEXT,  -- channel-device-method, sign-method, junction-method, etc.

        -- Spatial Data (GeoJSON)
        geometry TEXT NOT NULL,  -- LineString or MultiPoint GeoJSON geometry
        bbox TEXT,  -- Bounding box [minLon, minLat, maxLon, maxLat]

        -- Relationships
        relationship TEXT,  -- JSON object describing related events

        -- Types of Work
        types_of_work TEXT,  -- JSON array of TypeOfWork objects

        -- Worker Presence
        worker_presence TEXT,  -- JSON object with worker presence info

        -- Source Tracking
        source_feed_url TEXT,
        source_feed_name TEXT,
        source_state TEXT,
        data_source_id TEXT,
        last_updated_source TEXT,  -- When source last updated this record

        -- Validation
        wzdx_version TEXT DEFAULT '4.2',
        is_valid BOOLEAN DEFAULT 1,
        validation_errors TEXT,  -- JSON array of validation errors if any

        -- Full WZDx Feature (for complete data retention)
        wzdx_feature_json TEXT,  -- Complete GeoJSON Feature as JSON string

        -- Metadata
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

        -- Indexes for performance
        UNIQUE(feature_id)
      )
    `);
    console.log('✓ Created wzdx_work_zones table');

    // Create indexes for common queries
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_wzdx_state
      ON wzdx_work_zones(source_state)
    `);
    console.log('✓ Created index: idx_wzdx_state');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_wzdx_dates
      ON wzdx_work_zones(start_date, end_date)
    `);
    console.log('✓ Created index: idx_wzdx_dates');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_wzdx_status
      ON wzdx_work_zones(event_status)
    `);
    console.log('✓ Created index: idx_wzdx_status');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_wzdx_road
      ON wzdx_work_zones(road_number, direction)
    `);
    console.log('✓ Created index: idx_wzdx_road');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_wzdx_event_type
      ON wzdx_work_zones(event_type)
    `);
    console.log('✓ Created index: idx_wzdx_event_type');

    // ========================================================================
    // WZDX_FEED_SOURCES - Track WZDx feed sources
    // ========================================================================
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS wzdx_feed_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        -- Feed Identification
        feed_url TEXT UNIQUE NOT NULL,
        feed_name TEXT,
        organization_name TEXT,
        state_code TEXT,  -- Two-letter state code

        -- Feed Metadata
        wzdx_version TEXT,
        update_frequency INTEGER,  -- seconds
        update_date TEXT,
        license TEXT,
        contact_name TEXT,
        contact_email TEXT,

        -- Feed Health
        last_fetch_attempt TEXT,
        last_successful_fetch TEXT,
        last_fetch_status TEXT,  -- success, error, timeout, etc.
        last_fetch_error TEXT,
        consecutive_failures INTEGER DEFAULT 0,

        -- Validation Stats
        is_valid_wzdx BOOLEAN DEFAULT 0,
        validation_errors TEXT,  -- JSON array
        total_features_last_fetch INTEGER DEFAULT 0,
        valid_features_last_fetch INTEGER DEFAULT 0,

        -- Status
        active BOOLEAN DEFAULT 1,
        auto_update BOOLEAN DEFAULT 1,

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created wzdx_feed_sources table');

    // ========================================================================
    // WZDX_IMPORT_LOG - Track import history
    // ========================================================================
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS wzdx_import_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        feed_source_id INTEGER,
        import_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,

        -- Import Results
        status TEXT,  -- success, partial, error
        features_processed INTEGER DEFAULT 0,
        features_inserted INTEGER DEFAULT 0,
        features_updated INTEGER DEFAULT 0,
        features_failed INTEGER DEFAULT 0,

        -- Errors
        errors TEXT,  -- JSON array of error objects

        -- Performance
        duration_ms INTEGER,

        FOREIGN KEY (feed_source_id) REFERENCES wzdx_feed_sources(id)
      )
    `);
    console.log('✓ Created wzdx_import_log table');

    console.log('\n✅ All WZDx tables created successfully!\n');

    // Display summary
    console.log('Tables created:');
    console.log('  • wzdx_work_zones - Store WZDx work zone features');
    console.log('  • wzdx_feed_sources - Track WZDx feed sources');
    console.log('  • wzdx_import_log - Import history and diagnostics\n');

  } catch (error) {
    console.error('❌ Error creating WZDx tables:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createWZDxTables()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { createWZDxTables };

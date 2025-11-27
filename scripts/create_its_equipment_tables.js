#!/usr/bin/env node

/**
 * Create ITS Equipment Inventory Tables
 *
 * This script creates database tables for storing ITS equipment inventory
 * uploaded via GIS files, with ARC-ITS compliance for V2X deployments.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'states.db');
const db = new Database(DB_PATH);

console.log('🏗️  Creating ITS Equipment Inventory Tables...\n');

try {
  db.pragma('foreign_keys = ON');

  // 1. ITS Equipment table - main inventory
  console.log('📦 Creating its_equipment table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS its_equipment (
      id TEXT PRIMARY KEY,
      state_key TEXT NOT NULL,
      equipment_type TEXT NOT NULL, -- camera, dms, rsu, sensor
      equipment_subtype TEXT, -- cctv, pan-tilt-zoom, rwis, etc.

      -- Location
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL,
      location_description TEXT,
      route TEXT,
      milepost REAL,

      -- Equipment Details
      manufacturer TEXT,
      model TEXT,
      serial_number TEXT,
      installation_date TEXT,
      status TEXT DEFAULT 'active', -- active, inactive, maintenance, decommissioned

      -- ARC-ITS Compliance Fields
      arc_its_id TEXT UNIQUE,
      arc_its_category TEXT,
      arc_its_function TEXT,
      arc_its_interface TEXT,

      -- V2X/RSU Specific
      rsu_id TEXT,
      rsu_mode TEXT, -- continuous, scheduled, event-driven
      communication_range INTEGER, -- meters
      supported_protocols TEXT, -- JSON array: ["DSRC", "C-V2X", "5G"]

      -- DMS Specific
      dms_type TEXT, -- fixed, portable
      display_technology TEXT, -- LED, LCD, flip-disk
      message_capacity INTEGER,

      -- Camera Specific
      camera_type TEXT, -- fixed, ptz, thermal
      resolution TEXT, -- 1080p, 4K, etc.
      field_of_view INTEGER, -- degrees
      stream_url TEXT,

      -- Sensor Specific
      sensor_type TEXT, -- loop, radar, lidar, weather
      measurement_types TEXT, -- JSON array: ["speed", "volume", "occupancy"]

      -- Metadata
      data_source TEXT, -- uploaded file name
      upload_date TEXT DEFAULT (datetime('now')),
      uploaded_by TEXT,
      notes TEXT,

      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),

      FOREIGN KEY (state_key) REFERENCES states(state_key)
    )
  `);
  console.log('✅ its_equipment table created\n');

  // 2. Equipment Attributes table - flexible key-value storage
  console.log('📦 Creating equipment_attributes table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_attributes (
      id TEXT PRIMARY KEY,
      equipment_id TEXT NOT NULL,
      attribute_name TEXT NOT NULL,
      attribute_value TEXT,
      attribute_type TEXT, -- string, number, boolean, json

      created_at TEXT DEFAULT (datetime('now')),

      FOREIGN KEY (equipment_id) REFERENCES its_equipment(id) ON DELETE CASCADE,
      UNIQUE(equipment_id, attribute_name)
    )
  `);
  console.log('✅ equipment_attributes table created\n');

  // 3. Equipment Coverage Areas - for V2X deployment planning
  console.log('📦 Creating equipment_coverage table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_coverage (
      id TEXT PRIMARY KEY,
      equipment_id TEXT NOT NULL,
      coverage_type TEXT NOT NULL, -- communication, visual, detection
      coverage_radius INTEGER NOT NULL, -- meters
      coverage_geometry TEXT, -- GeoJSON polygon
      confidence REAL, -- 0-1 confidence score

      created_at TEXT DEFAULT (datetime('now')),

      FOREIGN KEY (equipment_id) REFERENCES its_equipment(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ equipment_coverage table created\n');

  // 4. GIS Upload History
  console.log('📦 Creating gis_upload_history table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS gis_upload_history (
      id TEXT PRIMARY KEY,
      state_key TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL, -- shapefile, kml, geojson, csv
      file_size INTEGER,

      records_total INTEGER,
      records_imported INTEGER,
      records_failed INTEGER,

      uploaded_by TEXT,
      upload_date TEXT DEFAULT (datetime('now')),

      status TEXT DEFAULT 'completed', -- processing, completed, failed
      error_log TEXT,

      FOREIGN KEY (state_key) REFERENCES states(state_key)
    )
  `);
  console.log('✅ gis_upload_history table created\n');

  // 5. V2X Deployment Gaps - for planning
  console.log('📦 Creating v2x_deployment_gaps table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS v2x_deployment_gaps (
      id TEXT PRIMARY KEY,
      state_key TEXT NOT NULL,
      gap_type TEXT NOT NULL, -- coverage, equipment, connectivity

      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      location_description TEXT,
      route TEXT,

      priority TEXT, -- critical, high, medium, low
      estimated_coverage_gap INTEGER, -- meters
      recommended_equipment TEXT, -- JSON array of equipment types

      status TEXT DEFAULT 'identified', -- identified, planned, funded, deployed
      notes TEXT,

      identified_date TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),

      FOREIGN KEY (state_key) REFERENCES states(state_key)
    )
  `);
  console.log('✅ v2x_deployment_gaps table created\n');

  // Create indexes for performance
  console.log('🔍 Creating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_equipment_state ON its_equipment(state_key);
    CREATE INDEX IF NOT EXISTS idx_equipment_type ON its_equipment(equipment_type);
    CREATE INDEX IF NOT EXISTS idx_equipment_status ON its_equipment(status);
    CREATE INDEX IF NOT EXISTS idx_equipment_location ON its_equipment(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_equipment_arc_its ON its_equipment(arc_its_id);

    CREATE INDEX IF NOT EXISTS idx_coverage_equipment ON equipment_coverage(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_coverage_type ON equipment_coverage(coverage_type);

    CREATE INDEX IF NOT EXISTS idx_upload_state ON gis_upload_history(state_key);
    CREATE INDEX IF NOT EXISTS idx_upload_date ON gis_upload_history(upload_date);

    CREATE INDEX IF NOT EXISTS idx_gaps_state ON v2x_deployment_gaps(state_key);
    CREATE INDEX IF NOT EXISTS idx_gaps_priority ON v2x_deployment_gaps(priority);
    CREATE INDEX IF NOT EXISTS idx_gaps_status ON v2x_deployment_gaps(status);
  `);
  console.log('✅ Indexes created\n');

  // Create views for common queries
  console.log('📊 Creating views...');

  // View: Equipment summary by state
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_equipment_summary_by_state AS
    SELECT
      state_key,
      COUNT(*) as total_equipment,
      SUM(CASE WHEN equipment_type = 'camera' THEN 1 ELSE 0 END) as cameras,
      SUM(CASE WHEN equipment_type = 'dms' THEN 1 ELSE 0 END) as dms_signs,
      SUM(CASE WHEN equipment_type = 'rsu' THEN 1 ELSE 0 END) as rsus,
      SUM(CASE WHEN equipment_type = 'sensor' THEN 1 ELSE 0 END) as sensors,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_equipment,
      MAX(upload_date) as last_updated
    FROM its_equipment
    GROUP BY state_key
  `);

  // View: V2X RSU deployment status
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_v2x_rsu_deployment AS
    SELECT
      e.state_key,
      e.id,
      e.latitude,
      e.longitude,
      e.location_description,
      e.rsu_id,
      e.communication_range,
      e.supported_protocols,
      e.status,
      c.coverage_radius,
      c.coverage_geometry
    FROM its_equipment e
    LEFT JOIN equipment_coverage c ON e.id = c.equipment_id AND c.coverage_type = 'communication'
    WHERE e.equipment_type = 'rsu'
  `);

  // View: ARC-ITS compliant equipment
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_arc_its_inventory AS
    SELECT
      arc_its_id,
      state_key,
      equipment_type,
      arc_its_category,
      arc_its_function,
      arc_its_interface,
      manufacturer,
      model,
      latitude,
      longitude,
      status,
      installation_date
    FROM its_equipment
    WHERE arc_its_id IS NOT NULL
    ORDER BY state_key, arc_its_category
  `);

  console.log('✅ Views created\n');

  console.log('✨ ITS Equipment Inventory schema created successfully!\n');
  console.log('📋 Tables created:');
  console.log('   - its_equipment (main inventory)');
  console.log('   - equipment_attributes (flexible metadata)');
  console.log('   - equipment_coverage (V2X coverage areas)');
  console.log('   - gis_upload_history (upload tracking)');
  console.log('   - v2x_deployment_gaps (planning tool)');
  console.log('\n📊 Views created:');
  console.log('   - v_equipment_summary_by_state');
  console.log('   - v_v2x_rsu_deployment');
  console.log('   - v_arc_its_inventory\n');

} catch (error) {
  console.error('❌ Error creating ITS equipment tables:', error);
  process.exit(1);
} finally {
  db.close();
}

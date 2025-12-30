#!/usr/bin/env node

/**
 * Create Extended V2X Message Tables
 *
 * Implements database schemas for comprehensive ODE message support:
 * - SPaT (Signal Phase and Timing) - J2735 traffic signal status
 * - MAP (Intersection Geometry) - J2735 intersection layout
 * - PSM (Personal Safety Message) - Pedestrian/cyclist detection
 * - SRM (Signal Request Message) - Priority requests (emergency, transit)
 * - SSM (Signal Status Message) - Priority request responses
 * - RTCM (Precision Positioning) - Differential GPS corrections
 *
 * Part of comprehensive ITS JPO ODE integration for Corridor Communicator
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'v2x_extended.db');
const db = new Database(dbPath);

console.log('🚦 Creating Extended V2X Message Tables...\n');

  // ============================================================================
  // SPaT (Signal Phase and Timing) - SAE J2735
  // ============================================================================
  console.log('📊 Creating SPaT (Signal Phase and Timing) tables...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS spat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE NOT NULL,
      intersection_id INTEGER NOT NULL,
      intersection_name TEXT,
      latitude REAL,
      longitude REAL,
      timestamp TEXT NOT NULL,
      minute_of_year INTEGER,
      msg_count INTEGER,
      revision INTEGER DEFAULT 0,
      regional_id INTEGER,
      raw_message TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS spat_movement_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spat_message_id INTEGER NOT NULL,
      signal_group INTEGER NOT NULL,
      movement_name TEXT,
      event_state TEXT NOT NULL,
      min_end_time INTEGER,
      max_end_time INTEGER,
      likely_time INTEGER,
      confidence INTEGER,
      next_time INTEGER,
      peddetect BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (spat_message_id) REFERENCES spat_messages(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_spat_intersection ON spat_messages(intersection_id, timestamp)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_spat_timestamp ON spat_messages(timestamp)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_spat_movements ON spat_movement_states(spat_message_id, signal_group)`);

  // ============================================================================
  // MAP (Intersection Geometry) - SAE J2735
  // ============================================================================
  console.log('🗺️  Creating MAP (Intersection Geometry) tables...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS map_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE NOT NULL,
      intersection_id INTEGER NOT NULL,
      intersection_name TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL,
      lane_width REAL,
      speed_limits TEXT,
      msg_count INTEGER,
      revision INTEGER DEFAULT 0,
      regional_id INTEGER,
      raw_message TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS map_lanes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      map_message_id INTEGER NOT NULL,
      lane_id INTEGER NOT NULL,
      lane_type TEXT,
      lane_number INTEGER,
      ingress BOOLEAN DEFAULT 1,
      egress BOOLEAN DEFAULT 0,
      lane_width REAL,
      node_list TEXT,
      connects_to TEXT,
      maneuvers TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (map_message_id) REFERENCES map_messages(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS map_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      map_lane_id INTEGER NOT NULL,
      signal_group INTEGER,
      connecting_lane_id INTEGER,
      maneuver TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (map_lane_id) REFERENCES map_lanes(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_map_intersection ON map_messages(intersection_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_map_lanes ON map_lanes(map_message_id, lane_id)`);

  // ============================================================================
  // PSM (Personal Safety Message) - SAE J2735
  // ============================================================================
  console.log('🚶 Creating PSM (Personal Safety Message) tables...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS psm_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE NOT NULL,
      basic_type TEXT NOT NULL,
      sec_mark INTEGER NOT NULL,
      msg_count INTEGER,
      temporary_id TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL,
      position_accuracy TEXT,
      speed REAL,
      heading REAL,
      accel_set TEXT,
      path_history TEXT,
      path_prediction TEXT,
      propulsion_type TEXT,
      user_type TEXT,
      attachment TEXT,
      attachment_radius REAL,
      animal_type TEXT,
      cluster_size INTEGER DEFAULT 1,
      cluster_radius REAL,
      event_responder_type TEXT,
      raw_message TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_psm_timestamp ON psm_messages(created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_psm_location ON psm_messages(latitude, longitude)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_psm_type ON psm_messages(basic_type, user_type)`);

  // ============================================================================
  // SRM (Signal Request Message) - SAE J2735
  // ============================================================================
  console.log('🚨 Creating SRM (Signal Request Message) tables...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS srm_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE NOT NULL,
      request_id INTEGER NOT NULL,
      sec_mark INTEGER NOT NULL,
      msg_count INTEGER,
      requester_type TEXT NOT NULL,
      vehicle_id TEXT,
      intersection_id INTEGER NOT NULL,
      signal_group INTEGER,
      request_type TEXT NOT NULL,
      in_bound_lane INTEGER,
      out_bound_lane INTEGER,
      minute_of_year INTEGER,
      duration INTEGER,
      eta_minute INTEGER,
      eta_second INTEGER,
      latitude REAL,
      longitude REAL,
      elevation REAL,
      heading REAL,
      speed REAL,
      priority_level INTEGER,
      status TEXT DEFAULT 'pending',
      raw_message TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_srm_intersection ON srm_messages(intersection_id, request_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_srm_status ON srm_messages(status, created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_srm_type ON srm_messages(requester_type, request_type)`);

  // ============================================================================
  // SSM (Signal Status Message) - SAE J2735
  // ============================================================================
  console.log('✅ Creating SSM (Signal Status Message) tables...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS ssm_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE NOT NULL,
      srm_message_id INTEGER,
      request_id INTEGER NOT NULL,
      sec_mark INTEGER NOT NULL,
      msg_count INTEGER,
      intersection_id INTEGER NOT NULL,
      signal_group INTEGER,
      status TEXT NOT NULL,
      minute_of_year INTEGER,
      duration INTEGER,
      rejection_reason TEXT,
      raw_message TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (srm_message_id) REFERENCES srm_messages(id) ON DELETE SET NULL
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_ssm_request ON ssm_messages(request_id, intersection_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ssm_status ON ssm_messages(status, created_at)`);

  // ============================================================================
  // RTCM (Precision Positioning Corrections) - SAE J2735
  // ============================================================================
  console.log('📡 Creating RTCM (Precision Positioning) tables...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS rtcm_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE NOT NULL,
      rtcm_revision INTEGER DEFAULT 3,
      msg_count INTEGER,
      anchor_point_lat REAL,
      anchor_point_lon REAL,
      anchor_point_elevation REAL,
      rtcm_header TEXT,
      rtcm_payload TEXT NOT NULL,
      message_list TEXT,
      raw_message TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_rtcm_timestamp ON rtcm_messages(created_at)`);

  // ============================================================================
  // Intersection Registry
  // ============================================================================
  console.log('🏗️  Creating intersection registry...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS intersections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      intersection_id INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL,
      region_id INTEGER,
      has_spat BOOLEAN DEFAULT 0,
      has_map BOOLEAN DEFAULT 0,
      controller_ip TEXT,
      controller_type TEXT,
      ntcip_enabled BOOLEAN DEFAULT 0,
      signal_groups INTEGER,
      approach_count INTEGER,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_intersections_location ON intersections(latitude, longitude)`);

  // ============================================================================
  // Privacy Geofences
  // ============================================================================
  console.log('🔒 Creating privacy geofence tables...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS privacy_geofences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      fence_type TEXT NOT NULL,
      geometry TEXT NOT NULL,
      center_lat REAL,
      center_lon REAL,
      radius_meters REAL,
      polygon_points TEXT,
      filter_level TEXT DEFAULT 'redact',
      applies_to TEXT DEFAULT 'all',
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS privacy_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL,
      message_types TEXT NOT NULL,
      field_patterns TEXT NOT NULL,
      action TEXT NOT NULL,
      priority INTEGER DEFAULT 100,
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_geofences_location ON privacy_geofences(center_lat, center_lon)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_privacy_rules ON privacy_rules(enabled, priority)`);

  // ============================================================================
  // Message Statistics
  // ============================================================================
  console.log('📈 Creating message statistics table...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2x_message_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_type TEXT NOT NULL,
      date TEXT NOT NULL,
      hour INTEGER NOT NULL,
      count INTEGER DEFAULT 0,
      bytes_processed INTEGER DEFAULT 0,
      privacy_filtered INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_type, date, hour)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_stats_type_date ON v2x_message_stats(message_type, date)`);

  console.log('\n✅ All extended V2X message tables created successfully!');
  console.log('\n📊 Database Schema Summary:');
  console.log('   🚦 SPaT Messages - Signal phase and timing data');
  console.log('   🗺️  MAP Messages - Intersection geometry');
  console.log('   🚶 PSM Messages - Pedestrian/cyclist safety');
  console.log('   🚨 SRM Messages - Signal priority requests');
  console.log('   ✅ SSM Messages - Signal request status');
  console.log('   📡 RTCM Messages - Precision positioning');
  console.log('   🏗️  Intersection Registry - Traffic signal inventory');
  console.log('   🔒 Privacy Controls - Geofencing & PII protection');
  console.log('   📈 Message Statistics - Analytics & monitoring');
  console.log('\n🎯 Corridor Communicator is now ODE-ready!\n');

db.close();


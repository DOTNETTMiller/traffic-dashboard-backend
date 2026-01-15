#!/usr/bin/env node

/**
 * Create Network Connections and Sensor Telemetry Tables
 *
 * This script creates:
 * 1. network_connections - Fiber, radio, and logical links between ITS devices
 * 2. sensor_health_telemetry - Real-time sensor health and performance data
 * 3. equipment_health_history - Historical health/status changes
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'states.db');
const db = new Database(DB_PATH);

console.log('🌐 Creating Network Connections and Sensor Telemetry Tables...\n');

try {
  db.pragma('foreign_keys = ON');

  // 1. Network Connections Table - Physical and logical links between devices
  console.log('📡 Creating network_connections table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS network_connections (
      id TEXT PRIMARY KEY,
      connection_id TEXT UNIQUE NOT NULL,

      -- Connection endpoints
      device_from_id TEXT NOT NULL,
      device_to_id TEXT NOT NULL,

      -- Connection type and medium
      connection_type TEXT NOT NULL, -- 'fiber', 'radio', 'microwave', 'cellular', '5g', 'ethernet'
      connection_subtype TEXT, -- 'single-mode-fiber', 'multi-mode-fiber', '5.9ghz-dsrc', 'lte-v2x', etc.

      -- Physical/logical properties
      is_physical BOOLEAN DEFAULT 1, -- 1 for physical (fiber), 0 for wireless (radio)
      is_bidirectional BOOLEAN DEFAULT 1,
      is_redundant BOOLEAN DEFAULT 0, -- backup/failover link

      -- Geometry (for fiber routes, radio paths)
      geometry TEXT, -- WKT LineString format: 'LINESTRING(lon1 lat1, lon2 lat2, ...)'
      geometry_type TEXT, -- 'LineString', 'MultiLineString'
      distance_meters REAL,

      -- Performance characteristics
      bandwidth_mbps INTEGER,
      latency_ms REAL,
      packet_loss_percent REAL,
      uptime_percent REAL,

      -- Fiber-specific
      fiber_type TEXT, -- 'single-mode', 'multi-mode', 'armored', 'aerial', 'underground'
      fiber_strand_count INTEGER,
      splice_count INTEGER,

      -- Radio-specific
      frequency_mhz REAL,
      transmit_power_dbm REAL,
      antenna_type TEXT,
      line_of_sight BOOLEAN,
      fresnel_clearance_percent REAL, -- RF path clearance

      -- Status and monitoring
      operational_status TEXT DEFAULT 'active', -- 'active', 'degraded', 'down', 'maintenance', 'planned'
      health_status TEXT DEFAULT 'healthy', -- 'healthy', 'warning', 'critical', 'unknown'
      last_monitored DATETIME,
      last_outage DATETIME,
      mean_time_between_failures_hours REAL,

      -- Ownership and administration
      owner TEXT, -- 'state_dot', 'contractor', 'utility', 'telecom_provider'
      provider TEXT, -- Name of telecom/fiber provider
      circuit_id TEXT, -- Provider's circuit identifier
      contract_expiry DATE,

      -- Metadata
      notes TEXT,
      installation_date DATE,
      data_source TEXT, -- 'shapefile_upload', 'manual_entry', 'network_discovery'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (device_from_id) REFERENCES its_equipment(id) ON DELETE CASCADE,
      FOREIGN KEY (device_to_id) REFERENCES its_equipment(id) ON DELETE CASCADE,
      CHECK (device_from_id != device_to_id) -- Prevent self-connections
    )
  `);
  console.log('✅ network_connections table created\n');

  // 2. Sensor Health Telemetry Table - Real-time sensor data and health
  console.log('📊 Creating sensor_health_telemetry table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS sensor_health_telemetry (
      id TEXT PRIMARY KEY,
      equipment_id TEXT NOT NULL,

      -- Timestamp
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

      -- Operational health
      operational_status TEXT NOT NULL, -- 'operational', 'degraded', 'failed', 'offline', 'maintenance'
      health_score REAL CHECK(health_score >= 0 AND health_score <= 100), -- 0-100 composite health score

      -- Connectivity
      is_online BOOLEAN NOT NULL DEFAULT 1,
      last_heartbeat DATETIME,
      heartbeat_interval_seconds INTEGER,
      missed_heartbeats INTEGER DEFAULT 0,

      -- Performance metrics
      uptime_hours REAL, -- Hours since last restart
      uptime_percent_24h REAL, -- Uptime over last 24 hours
      cpu_usage_percent REAL,
      memory_usage_percent REAL,
      disk_usage_percent REAL,
      temperature_celsius REAL,

      -- Network performance
      network_latency_ms REAL,
      network_packet_loss_percent REAL,
      network_bandwidth_mbps REAL,

      -- Sensor-specific data quality
      data_quality_score REAL CHECK(data_quality_score >= 0 AND data_quality_score <= 100),
      measurement_error_rate REAL, -- Percentage of bad readings
      calibration_date DATE,
      calibration_due_date DATE,
      calibration_status TEXT, -- 'current', 'due_soon', 'overdue', 'never_calibrated'

      -- Camera-specific
      video_stream_status TEXT, -- 'streaming', 'buffering', 'offline', 'error'
      video_bitrate_kbps INTEGER,
      video_frame_drops INTEGER,
      camera_ptz_functional BOOLEAN, -- Pan-tilt-zoom working?

      -- Sensor-specific (traffic sensors)
      sensor_readings_per_minute INTEGER,
      sensor_data_gaps INTEGER, -- Missing data points in last hour
      sensor_last_vehicle_detected DATETIME,

      -- DMS-specific
      dms_display_functional BOOLEAN,
      dms_message_errors INTEGER, -- Failed message updates
      dms_pixel_failures INTEGER,

      -- RSU-specific (V2X)
      rsu_message_broadcast_count INTEGER, -- Messages sent in last interval
      rsu_connected_vehicles INTEGER, -- Vehicles currently in range
      rsu_bsm_received INTEGER, -- Basic Safety Messages received
      rsu_tim_sent INTEGER, -- Traveler Information Messages sent

      -- Power and environmental
      power_source TEXT, -- 'grid', 'solar', 'battery', 'hybrid'
      battery_level_percent REAL,
      battery_charging BOOLEAN,
      voltage_volts REAL,
      power_consumption_watts REAL,
      solar_panel_output_watts REAL,

      -- Alerts and issues
      active_alerts TEXT, -- JSON array of alert codes
      error_log TEXT, -- Recent error messages
      firmware_version TEXT,
      firmware_update_available BOOLEAN DEFAULT 0,

      -- Metadata
      reported_by TEXT, -- 'device_self_report', 'monitoring_system', 'manual_inspection'
      data_source TEXT, -- Name of monitoring system

      FOREIGN KEY (equipment_id) REFERENCES its_equipment(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ sensor_health_telemetry table created\n');

  // 3. Equipment Health History - Track status changes over time
  console.log('📜 Creating equipment_health_history table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_health_history (
      id TEXT PRIMARY KEY,
      equipment_id TEXT NOT NULL,

      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

      -- Status change
      old_status TEXT,
      new_status TEXT NOT NULL,
      status_category TEXT NOT NULL, -- 'operational', 'connectivity', 'performance', 'maintenance'

      -- Event details
      event_type TEXT NOT NULL, -- 'status_change', 'outage', 'restoration', 'maintenance', 'failure'
      severity TEXT NOT NULL, -- 'info', 'warning', 'critical', 'emergency'

      -- Description
      title TEXT NOT NULL,
      description TEXT,

      -- Impact
      affected_services TEXT, -- JSON array: ["video_feed", "traffic_data", "v2x_messaging"]
      impact_duration_minutes INTEGER,

      -- Resolution
      resolved BOOLEAN DEFAULT 0,
      resolved_at DATETIME,
      resolved_by TEXT,
      resolution_notes TEXT,

      -- Root cause (if known)
      root_cause TEXT, -- 'fiber_cut', 'power_failure', 'hardware_failure', 'software_bug', 'configuration_error'

      -- Maintenance tracking
      maintenance_ticket_id TEXT,
      technician_assigned TEXT,

      FOREIGN KEY (equipment_id) REFERENCES its_equipment(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ equipment_health_history table created\n');

  // 4. Network Path Cache - Pre-computed network paths for quick queries
  console.log('🗺️  Creating network_path_cache table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS network_path_cache (
      id TEXT PRIMARY KEY,
      device_from_id TEXT NOT NULL,
      device_to_id TEXT NOT NULL,

      -- Path information
      path_type TEXT NOT NULL, -- 'shortest', 'fastest', 'most_reliable', 'redundant'
      hop_count INTEGER NOT NULL,
      total_distance_meters REAL,
      total_latency_ms REAL,

      -- Path as array of connection IDs
      connection_path TEXT NOT NULL, -- JSON array: ["conn1", "conn2", "conn3"]
      device_path TEXT NOT NULL, -- JSON array: ["dev1", "dev2", "dev3", "dev4"]

      -- Path health
      path_operational BOOLEAN DEFAULT 1,
      path_health_score REAL,
      weakest_link_id TEXT, -- Connection ID of weakest link

      -- Metadata
      computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME, -- Path cache expiry

      FOREIGN KEY (device_from_id) REFERENCES its_equipment(id) ON DELETE CASCADE,
      FOREIGN KEY (device_to_id) REFERENCES its_equipment(id) ON DELETE CASCADE,
      UNIQUE(device_from_id, device_to_id, path_type)
    )
  `);
  console.log('✅ network_path_cache table created\n');

  // Create indexes for performance
  console.log('🔍 Creating indexes...');
  db.exec(`
    -- Network connections indexes
    CREATE INDEX IF NOT EXISTS idx_connections_from ON network_connections(device_from_id);
    CREATE INDEX IF NOT EXISTS idx_connections_to ON network_connections(device_to_id);
    CREATE INDEX IF NOT EXISTS idx_connections_type ON network_connections(connection_type);
    CREATE INDEX IF NOT EXISTS idx_connections_status ON network_connections(operational_status);
    CREATE INDEX IF NOT EXISTS idx_connections_health ON network_connections(health_status);

    -- Sensor telemetry indexes
    CREATE INDEX IF NOT EXISTS idx_telemetry_equipment ON sensor_health_telemetry(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON sensor_health_telemetry(timestamp);
    CREATE INDEX IF NOT EXISTS idx_telemetry_status ON sensor_health_telemetry(operational_status);
    CREATE INDEX IF NOT EXISTS idx_telemetry_online ON sensor_health_telemetry(is_online);
    CREATE INDEX IF NOT EXISTS idx_telemetry_health_score ON sensor_health_telemetry(health_score);

    -- Health history indexes
    CREATE INDEX IF NOT EXISTS idx_health_history_equipment ON equipment_health_history(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_health_history_timestamp ON equipment_health_history(timestamp);
    CREATE INDEX IF NOT EXISTS idx_health_history_severity ON equipment_health_history(severity);
    CREATE INDEX IF NOT EXISTS idx_health_history_resolved ON equipment_health_history(resolved);

    -- Network path cache indexes
    CREATE INDEX IF NOT EXISTS idx_path_cache_from ON network_path_cache(device_from_id);
    CREATE INDEX IF NOT EXISTS idx_path_cache_to ON network_path_cache(device_to_id);
    CREATE INDEX IF NOT EXISTS idx_path_cache_expires ON network_path_cache(expires_at);
  `);
  console.log('✅ Indexes created\n');

  // Create views for common queries
  console.log('📊 Creating views...');

  // View: Network topology summary
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_network_topology AS
    SELECT
      nc.id,
      nc.connection_id,
      nc.connection_type,
      nc.is_physical,

      -- From device
      e1.id as from_device_id,
      e1.equipment_type as from_device_type,
      e1.location_description as from_location,
      e1.latitude as from_lat,
      e1.longitude as from_lon,

      -- To device
      e2.id as to_device_id,
      e2.equipment_type as to_device_type,
      e2.location_description as to_location,
      e2.latitude as to_lat,
      e2.longitude as to_lon,

      -- Connection details
      nc.distance_meters,
      nc.bandwidth_mbps,
      nc.operational_status,
      nc.health_status,
      nc.geometry

    FROM network_connections nc
    JOIN its_equipment e1 ON nc.device_from_id = e1.id
    JOIN its_equipment e2 ON nc.device_to_id = e2.id
  `);

  // View: Equipment health dashboard
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_equipment_health_dashboard AS
    SELECT
      e.id,
      e.state_key,
      e.equipment_type,
      e.equipment_subtype,
      e.location_description,
      e.latitude,
      e.longitude,
      e.status as configured_status,

      -- Latest telemetry
      t.operational_status,
      t.health_score,
      t.is_online,
      t.last_heartbeat,
      t.uptime_percent_24h,
      t.data_quality_score,
      t.timestamp as last_telemetry_update,

      -- Computed health
      CASE
        WHEN t.is_online = 0 THEN 'offline'
        WHEN t.health_score >= 90 THEN 'excellent'
        WHEN t.health_score >= 75 THEN 'good'
        WHEN t.health_score >= 50 THEN 'fair'
        WHEN t.health_score >= 25 THEN 'poor'
        ELSE 'critical'
      END as health_category,

      -- Unresolved issues
      (SELECT COUNT(*) FROM equipment_health_history h
       WHERE h.equipment_id = e.id AND h.resolved = 0) as unresolved_issues

    FROM its_equipment e
    LEFT JOIN (
      SELECT equipment_id,
             operational_status,
             health_score,
             is_online,
             last_heartbeat,
             uptime_percent_24h,
             data_quality_score,
             timestamp,
             ROW_NUMBER() OVER (PARTITION BY equipment_id ORDER BY timestamp DESC) as rn
      FROM sensor_health_telemetry
    ) t ON e.id = t.equipment_id AND t.rn = 1
  `);

  // View: Network connectivity matrix
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_network_connectivity_matrix AS
    SELECT
      device_from_id,
      device_to_id,
      COUNT(*) as connection_count,
      COUNT(CASE WHEN is_physical = 1 THEN 1 END) as physical_connections,
      COUNT(CASE WHEN is_physical = 0 THEN 1 END) as wireless_connections,
      COUNT(CASE WHEN operational_status = 'active' THEN 1 END) as active_connections,
      COUNT(CASE WHEN is_redundant = 1 THEN 1 END) as redundant_connections,
      MAX(bandwidth_mbps) as max_bandwidth_mbps,
      MIN(latency_ms) as min_latency_ms
    FROM network_connections
    GROUP BY device_from_id, device_to_id
  `);

  // View: Outage summary
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_recent_outages AS
    SELECT
      h.equipment_id,
      e.equipment_type,
      e.location_description,
      h.timestamp as outage_start,
      h.resolved_at as outage_end,
      h.impact_duration_minutes,
      h.severity,
      h.root_cause,
      h.description,
      h.resolved
    FROM equipment_health_history h
    JOIN its_equipment e ON h.equipment_id = e.id
    WHERE h.event_type IN ('outage', 'failure')
      AND h.timestamp >= datetime('now', '-30 days')
    ORDER BY h.timestamp DESC
  `);

  console.log('✅ Views created\n');

  console.log('✨ Network and Telemetry schema created successfully!\n');
  console.log('📋 Tables created:');
  console.log('   - network_connections (fiber/radio links between devices)');
  console.log('   - sensor_health_telemetry (real-time sensor health & data)');
  console.log('   - equipment_health_history (status change tracking)');
  console.log('   - network_path_cache (pre-computed network paths)');
  console.log('\n📊 Views created:');
  console.log('   - v_network_topology (connection details with endpoints)');
  console.log('   - v_equipment_health_dashboard (latest health for all equipment)');
  console.log('   - v_network_connectivity_matrix (connection summary)');
  console.log('   - v_recent_outages (last 30 days of outages)\n');

  console.log('🎯 Next steps:');
  console.log('   1. Run: node scripts/populate_sample_network_data.js');
  console.log('   2. Update GIS parser to extract LineString features');
  console.log('   3. Integrate telemetry from monitoring systems\n');

} catch (error) {
  console.error('❌ Error creating tables:', error);
  process.exit(1);
} finally {
  db.close();
}

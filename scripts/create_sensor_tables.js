/**
 * Create Sensor Database Tables
 *
 * ARC-IT Physical Object: Roadway Subsystem
 * - Environmental Sensor Stations (ESS)
 * - Road Weather Information System (RWIS)
 * - Traffic Detectors
 * - Bridge Monitoring Systems
 *
 * Supports sensor data collection for V2X warning generation
 */

const db = require('../database');

async function createSensorTables() {
  console.log('Creating sensor database tables...\n');

  try {
    // ========================================================================
    // SENSOR_INVENTORY - Track all sensors
    // ========================================================================
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS sensor_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        -- Sensor Identification
        sensor_id TEXT UNIQUE NOT NULL,
        sensor_name TEXT,
        sensor_type TEXT NOT NULL,  -- rwis, traffic, bridge, environmental

        -- Location
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        elevation REAL,
        roadway TEXT,
        direction TEXT,
        milepost REAL,
        location_description TEXT,

        -- Configuration
        manufacturer TEXT,
        model TEXT,
        serial_number TEXT,
        installation_date TEXT,

        -- Network
        ip_address TEXT,
        data_feed_url TEXT,
        polling_interval INTEGER DEFAULT 300,  -- seconds

        -- Capabilities (JSON)
        capabilities TEXT,  -- {temperature: true, friction: true, visibility: true}

        -- Status
        status TEXT DEFAULT 'active',  -- active, inactive, maintenance, error
        last_reading TEXT,
        last_contact TEXT,

        -- Metadata
        owner TEXT,
        contact_email TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created sensor_inventory table');

    // Create indexes
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_sensor_location
      ON sensor_inventory(latitude, longitude)
    `);
    console.log('✓ Created index: idx_sensor_location');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_sensor_type
      ON sensor_inventory(sensor_type, status)
    `);
    console.log('✓ Created index: idx_sensor_type');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_sensor_roadway
      ON sensor_inventory(roadway, milepost)
    `);
    console.log('✓ Created index: idx_sensor_roadway');

    // ========================================================================
    // RWIS_READINGS - Road Weather Information System data
    // ========================================================================
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS rwis_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        sensor_id TEXT NOT NULL,
        reading_timestamp TEXT NOT NULL,

        -- Air Conditions
        air_temperature REAL,  -- Fahrenheit
        dew_point REAL,
        relative_humidity REAL,  -- Percentage

        -- Precipitation
        precipitation_rate REAL,  -- inches/hour
        precipitation_type TEXT,  -- rain, snow, sleet, freezing_rain, none
        precipitation_accumulation REAL,  -- inches

        -- Pavement Conditions
        pavement_temperature REAL,  -- Fahrenheit
        subsurface_temperature REAL,
        pavement_condition TEXT,  -- dry, wet, ice, snow, slush
        pavement_friction REAL,  -- 0.0 to 1.0
        freeze_point REAL,

        -- Visibility
        visibility REAL,  -- feet
        fog BOOLEAN DEFAULT 0,

        -- Wind
        wind_speed REAL,  -- mph
        wind_direction INTEGER,  -- degrees
        wind_gust REAL,

        -- Calculated/Derived
        black_ice_probability REAL,  -- 0.0 to 1.0
        warning_level INTEGER,  -- 0=none, 1=advisory, 2=warning, 3=critical

        -- Metadata
        data_quality TEXT,  -- good, fair, poor
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (sensor_id) REFERENCES sensor_inventory(sensor_id)
      )
    `);
    console.log('✓ Created rwis_readings table');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_rwis_sensor_time
      ON rwis_readings(sensor_id, reading_timestamp DESC)
    `);
    console.log('✓ Created index: idx_rwis_sensor_time');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_rwis_warning
      ON rwis_readings(warning_level, reading_timestamp)
    `);
    console.log('✓ Created index: idx_rwis_warning');

    // ========================================================================
    // TRAFFIC_READINGS - Traffic detector data
    // ========================================================================
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS traffic_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        sensor_id TEXT NOT NULL,
        reading_timestamp TEXT NOT NULL,

        -- Traffic Flow
        volume INTEGER,  -- vehicles per hour
        speed REAL,  -- mph
        occupancy REAL,  -- percentage

        -- Lane-specific (JSON array)
        lane_data TEXT,  -- [{lane: 1, speed: 65, volume: 500, occupancy: 15}]

        -- Classification (if available)
        vehicle_classification TEXT,  -- JSON: {cars: 450, trucks: 50}

        -- Conditions
        traffic_condition TEXT,  -- free_flow, moderate, heavy, congested, stopped
        incident_detected BOOLEAN DEFAULT 0,

        -- Calculated
        level_of_service TEXT,  -- A, B, C, D, E, F
        congestion_severity INTEGER,  -- 0-5

        -- Metadata
        data_quality TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (sensor_id) REFERENCES sensor_inventory(sensor_id)
      )
    `);
    console.log('✓ Created traffic_readings table');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_traffic_sensor_time
      ON traffic_readings(sensor_id, reading_timestamp DESC)
    `);
    console.log('✓ Created index: idx_traffic_sensor_time');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_traffic_condition
      ON traffic_readings(traffic_condition, reading_timestamp)
    `);
    console.log('✓ Created index: idx_traffic_condition');

    // ========================================================================
    // BRIDGE_READINGS - Bridge sensor data
    // ========================================================================
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS bridge_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        sensor_id TEXT NOT NULL,
        bridge_id TEXT,  -- Reference to bridges table
        reading_timestamp TEXT NOT NULL,

        -- Height/Clearance
        clearance_feet REAL,  -- Current clearance
        min_clearance_warning REAL,  -- Warning threshold
        over_height_detected BOOLEAN DEFAULT 0,

        -- Weight
        vehicle_weight INTEGER,  -- pounds (if WIM sensor)
        overweight_detected BOOLEAN DEFAULT 0,

        -- Environmental
        temperature REAL,
        ice_detected BOOLEAN DEFAULT 0,
        wind_speed REAL,

        -- Structural (if available)
        strain_gauge_readings TEXT,  -- JSON array
        vibration_level REAL,
        deflection REAL,  -- inches

        -- Flood/Water Level
        water_level REAL,  -- feet below bridge deck
        flood_warning BOOLEAN DEFAULT 0,

        -- Alerts
        alert_level INTEGER,  -- 0=none, 1=advisory, 2=warning, 3=critical
        alert_type TEXT,  -- over_height, overweight, ice, flood, structural

        -- Metadata
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (sensor_id) REFERENCES sensor_inventory(sensor_id)
      )
    `);
    console.log('✓ Created bridge_readings table');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_bridge_sensor_time
      ON bridge_readings(sensor_id, reading_timestamp DESC)
    `);
    console.log('✓ Created index: idx_bridge_sensor_time');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_bridge_alerts
      ON bridge_readings(alert_level, reading_timestamp)
    `);
    console.log('✓ Created index: idx_bridge_alerts');

    // ========================================================================
    // SENSOR_ALERTS - Active sensor-based warnings
    // ========================================================================
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS sensor_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        sensor_id TEXT NOT NULL,
        alert_type TEXT NOT NULL,  -- ice, fog, congestion, over_height, etc.
        severity INTEGER NOT NULL,  -- 1-7 (matches TIM priority)

        -- Alert Details
        condition TEXT NOT NULL,
        description TEXT,
        itis_codes TEXT,  -- JSON array of applicable ITIS codes

        -- Location
        latitude REAL,
        longitude REAL,
        roadway TEXT,
        milepost REAL,

        -- Timing
        started_at TEXT NOT NULL,
        expires_at TEXT,
        cleared_at TEXT,

        -- V2X Integration
        tim_generated BOOLEAN DEFAULT 0,
        tim_packet_id TEXT,  -- Reference to tim_broadcast_log
        rsus_notified TEXT,  -- JSON array of RSU IDs

        -- Status
        status TEXT DEFAULT 'active',  -- active, cleared, expired

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (sensor_id) REFERENCES sensor_inventory(sensor_id)
      )
    `);
    console.log('✓ Created sensor_alerts table');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_alerts_active
      ON sensor_alerts(status, started_at)
    `);
    console.log('✓ Created index: idx_alerts_active');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_alerts_sensor
      ON sensor_alerts(sensor_id, status)
    `);
    console.log('✓ Created index: idx_alerts_sensor');

    // ========================================================================
    // SENSOR_HEALTH - Sensor health monitoring
    // ========================================================================
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS sensor_health (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        sensor_id TEXT NOT NULL,

        -- Health Status
        status TEXT,  -- healthy, degraded, critical, offline
        uptime_percent REAL,

        -- Data Quality
        readings_last_hour INTEGER,
        readings_expected_hour INTEGER,
        data_quality_score REAL,  -- 0.0 to 1.0

        -- Connectivity
        last_successful_reading TEXT,
        consecutive_failures INTEGER,
        average_response_time REAL,  -- milliseconds

        -- Issues
        active_issues TEXT,  -- JSON array of issue descriptions
        last_maintenance TEXT,
        next_maintenance_due TEXT,

        check_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (sensor_id) REFERENCES sensor_inventory(sensor_id)
      )
    `);
    console.log('✓ Created sensor_health table');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_health_sensor
      ON sensor_health(sensor_id, check_timestamp)
    `);
    console.log('✓ Created index: idx_health_sensor');

    console.log('\n✅ All sensor tables created successfully!\n');

    // Display summary
    console.log('Tables created:');
    console.log('  • sensor_inventory - Track all sensor assets');
    console.log('  • rwis_readings - Road weather data');
    console.log('  • traffic_readings - Traffic flow and conditions');
    console.log('  • bridge_readings - Bridge sensor data');
    console.log('  • sensor_alerts - Active sensor-based warnings');
    console.log('  • sensor_health - Sensor health monitoring\n');

  } catch (error) {
    console.error('❌ Error creating sensor tables:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createSensorTables()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { createSensorTables };

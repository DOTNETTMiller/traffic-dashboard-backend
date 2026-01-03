/**
 * Create RSU (Roadside Unit) Database Tables
 *
 * ARC-IT Physical Object: Roadside Equipment (RSE)
 *
 * Stores RSU inventory, configuration, and TIM broadcast logs
 * for V2X infrastructure management
 */

const db = require('../database');

async function createRSUTables() {
  console.log('Creating RSU database tables...\n');

  try {
    // ========================================================================
    // RSU_INVENTORY - RSU asset management
    // ========================================================================
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS rsu_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        -- RSU Identification
        rsu_id TEXT UNIQUE NOT NULL,  -- Unique RSU identifier (e.g., RSU-I70-MM145)
        serial_number TEXT,
        manufacturer TEXT,
        model TEXT,

        -- Location
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        elevation REAL,
        roadway TEXT,  -- e.g., "I-70", "US-6"
        direction TEXT,  -- EB, WB, NB, SB
        milepost REAL,
        location_description TEXT,

        -- Network Configuration
        ipv4_address TEXT,
        ipv6_address TEXT,
        mac_address TEXT,
        snmp_community TEXT,
        rsuid TEXT,  -- SNMP RSU ID

        -- Capabilities
        capabilities TEXT,  -- JSON: {tim: true, spat: true, map: true, bsm: true}
        firmware_version TEXT,
        radio_type TEXT,  -- DSRC, C-V2X
        channel INTEGER DEFAULT 178,  -- Default 5.9 GHz DSRC channel

        -- Status
        status TEXT DEFAULT 'active',  -- active, inactive, maintenance, offline
        last_contact TEXT,
        last_health_check TEXT,
        uptime_seconds INTEGER,

        -- Maintenance
        installation_date TEXT,
        last_maintenance_date TEXT,
        warranty_expiration TEXT,
        notes TEXT,

        -- Metadata
        owner TEXT,  -- State DOT, County, City
        managed_by TEXT,
        contact_email TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created rsu_inventory table');

    // Create indexes
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_rsu_location
      ON rsu_inventory(latitude, longitude)
    `);
    console.log('✓ Created index: idx_rsu_location');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_rsu_roadway
      ON rsu_inventory(roadway, milepost)
    `);
    console.log('✓ Created index: idx_rsu_roadway');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_rsu_status
      ON rsu_inventory(status)
    `);
    console.log('✓ Created index: idx_rsu_status');

    // ========================================================================
    // TIM_BROADCAST_LOG - Track TIM message broadcasts
    // ========================================================================
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS tim_broadcast_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        -- TIM Identification
        packet_id TEXT NOT NULL,
        message_count INTEGER,
        timestamp INTEGER,  -- J2735 timestamp

        -- Message Content
        priority INTEGER,  -- 0-7 severity
        itis_codes TEXT,  -- JSON array of ITIS codes
        mutcd_code TEXT,  -- Sign code (e.g., W1-6)
        description TEXT,

        -- Targeting
        rsus_targeted TEXT,  -- JSON array of RSU IDs
        region_lat REAL,
        region_lon REAL,
        radius_miles REAL,

        -- Broadcast Details
        start_time TEXT,
        end_time TEXT,
        duration_minutes INTEGER,

        -- Status
        status TEXT,  -- success, failed, expired
        error_message TEXT,

        -- Source
        source_type TEXT,  -- event, sensor, workzone, manual
        source_id TEXT,  -- Event ID, Sensor ID, etc.

        -- Metadata
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created tim_broadcast_log table');

    // Create indexes for log queries
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_tim_status
      ON tim_broadcast_log(status)
    `);
    console.log('✓ Created index: idx_tim_status');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_tim_created
      ON tim_broadcast_log(created_at)
    `);
    console.log('✓ Created index: idx_tim_created');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_tim_source
      ON tim_broadcast_log(source_type, source_id)
    `);
    console.log('✓ Created index: idx_tim_source');

    // ========================================================================
    // RSU_HEALTH - RSU health monitoring
    // ========================================================================
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS rsu_health (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        rsu_id TEXT NOT NULL,

        -- Health Metrics
        cpu_usage REAL,
        memory_usage REAL,
        disk_usage REAL,
        temperature REAL,

        -- Network Metrics
        packets_transmitted INTEGER,
        packets_received INTEGER,
        messages_broadcast INTEGER,

        -- Radio Metrics
        channel_busy_ratio REAL,  -- Percentage
        signal_strength INTEGER,  -- dBm

        -- Status
        status TEXT,  -- healthy, degraded, critical
        alerts TEXT,  -- JSON array of active alerts

        check_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (rsu_id) REFERENCES rsu_inventory(rsu_id)
      )
    `);
    console.log('✓ Created rsu_health table');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_health_rsu
      ON rsu_health(rsu_id, check_timestamp)
    `);
    console.log('✓ Created index: idx_health_rsu');

    console.log('\n✅ All RSU tables created successfully!\n');

    // Display summary
    console.log('Tables created:');
    console.log('  • rsu_inventory - RSU asset tracking and configuration');
    console.log('  • tim_broadcast_log - TIM message broadcast history');
    console.log('  • rsu_health - RSU health monitoring metrics\n');

  } catch (error) {
    console.error('❌ Error creating RSU tables:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createRSUTables()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { createRSUTables };

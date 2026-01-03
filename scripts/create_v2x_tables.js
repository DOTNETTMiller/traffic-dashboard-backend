/**
 * Create database tables for V2X data storage
 * Supports BSM, TIM, SPaT, and MAP message types from ODE
 */

const db = require('../database');

async function createV2XTables() {
  console.log('Creating V2X data tables...\n');

  try {
    // BSM (Basic Safety Messages) Table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS v2x_bsm (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_type TEXT DEFAULT 'BSM',
        timestamp TEXT NOT NULL,
        temporary_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        elevation REAL,
        speed REAL,
        heading REAL,
        accuracy_semi_major REAL,
        accuracy_semi_minor REAL,
        transmission TEXT,
        brake_status TEXT,
        vehicle_size TEXT,
        received_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(temporary_id, timestamp)
      )
    `);
    console.log('✓ Created v2x_bsm table');

    // Create index for spatial queries
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_bsm_location
      ON v2x_bsm(latitude, longitude)
    `);

    // Create index for time-based queries
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_bsm_timestamp
      ON v2x_bsm(timestamp)
    `);

    // TIM (Traveler Information Messages) Table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS v2x_tim (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_type TEXT DEFAULT 'TIM',
        timestamp TEXT NOT NULL,
        msg_id TEXT NOT NULL,
        frame_type TEXT,
        start_time TEXT,
        duration_time INTEGER,
        priority INTEGER,
        regions TEXT,
        content TEXT,
        ssp_tim_rights INTEGER,
        received_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(msg_id, timestamp)
      )
    `);
    console.log('✓ Created v2x_tim table');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_tim_timestamp
      ON v2x_tim(timestamp)
    `);

    // SPaT (Signal Phase and Timing) Table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS v2x_spat (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_type TEXT DEFAULT 'SPaT',
        timestamp TEXT NOT NULL,
        intersection_id TEXT NOT NULL,
        status TEXT,
        moy INTEGER,
        time_stamp INTEGER,
        states TEXT,
        received_at TEXT DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_spat_intersection (intersection_id),
        INDEX idx_spat_timestamp (timestamp)
      )
    `);
    console.log('✓ Created v2x_spat table');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_spat_intersection
      ON v2x_spat(intersection_id)
    `);

    // MAP (Intersection Geometry) Table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS v2x_map (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_type TEXT DEFAULT 'MAP',
        timestamp TEXT NOT NULL,
        intersection_id TEXT NOT NULL,
        ref_point TEXT,
        lane_width INTEGER,
        speed_limits TEXT,
        lane_set TEXT,
        received_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(intersection_id),
        INDEX idx_map_intersection (intersection_id)
      )
    `);
    console.log('✓ Created v2x_map table');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_map_intersection
      ON v2x_map(intersection_id)
    `);

    // V2X Summary Statistics Table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS v2x_statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_type TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        last_received TEXT,
        first_received TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_type)
      )
    `);
    console.log('✓ Created v2x_statistics table');

    // Initialize statistics rows
    const messageTypes = ['BSM', 'TIM', 'SPaT', 'MAP'];
    for (const type of messageTypes) {
      await db.runAsync(`
        INSERT OR IGNORE INTO v2x_statistics (message_type, count, updated_at)
        VALUES (?, 0, CURRENT_TIMESTAMP)
      `, [type]);
    }
    console.log('✓ Initialized v2x_statistics');

    console.log('\n✅ All V2X tables created successfully!\n');

  } catch (error) {
    console.error('❌ Error creating V2X tables:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createV2XTables()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { createV2XTables };

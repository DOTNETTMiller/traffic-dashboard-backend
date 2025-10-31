// Migrate truck parking patterns from JSON to SQLite database
// This ensures the data persists on Railway deployments

const fs = require('fs');
const path = require('path');
const Database = require('../database.js');

async function migrateParkingData() {
  console.log('\n🚛 Migrating Truck Parking Patterns to Database\n');

  const db = new Database.constructor();
  await db.init();

  // Create tables for parking data
  console.log('📋 Creating database tables...');

  db.db.exec(`
    CREATE TABLE IF NOT EXISTS parking_facilities (
      facility_id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      state TEXT NOT NULL,
      avg_capacity INTEGER NOT NULL,
      total_samples INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS parking_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      hour INTEGER NOT NULL,
      avg_occupancy_rate REAL NOT NULL,
      sample_count INTEGER NOT NULL,
      capacity INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (facility_id) REFERENCES parking_facilities(facility_id),
      UNIQUE(facility_id, day_of_week, hour)
    );

    CREATE INDEX IF NOT EXISTS idx_parking_patterns_lookup
    ON parking_patterns(facility_id, day_of_week, hour);
  `);

  console.log('✅ Tables created successfully\n');

  // Load JSON data
  const jsonPath = path.join(__dirname, '../data/truck_parking_patterns.json');

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ File not found: ${jsonPath}`);
    console.log('💡 Run: node scripts/process_truck_parking_historical.js first');
    process.exit(1);
  }

  console.log(`📂 Loading data from: ${jsonPath}`);
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  console.log(`   Facilities: ${data.facilities?.length || 0}`);
  console.log(`   Patterns: ${data.patterns?.length || 0}\n`);

  // Clear existing data
  console.log('🧹 Clearing existing parking data...');
  if (db.isPostgres) {
    await db.db.execAsync('DELETE FROM parking_patterns');
    await db.db.execAsync('DELETE FROM parking_facilities');
  } else {
    db.db.exec('DELETE FROM parking_patterns');
    db.db.exec('DELETE FROM parking_facilities');
  }
  console.log('✅ Cleared\n');

  // Insert facilities
  console.log('📝 Inserting facilities...');
  const facilityStmt = db.db.prepare(`
    INSERT OR REPLACE INTO parking_facilities
    (facility_id, site_id, state, avg_capacity, total_samples)
    VALUES (?, ?, ?, ?, ?)
  `);

  let facilityCount = 0;
  for (const facility of data.facilities || []) {
    await facilityStmt.run(
      facility.facilityId,
      facility.siteId,
      facility.state,
      facility.avgCapacity || facility.capacity || 0,
      facility.totalSamples || 0
    );
    facilityCount++;
  }
  console.log(`✅ Inserted ${facilityCount} facilities\n`);

  // Insert patterns
  console.log('📝 Inserting patterns...');
  const patternStmt = db.db.prepare(`
    INSERT OR REPLACE INTO parking_patterns
    (facility_id, day_of_week, hour, avg_occupancy_rate, sample_count, capacity)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let patternCount = 0;
  for (const pattern of data.patterns || []) {
    await patternStmt.run(
      pattern.facilityId,
      pattern.dayOfWeek,
      pattern.hour,
      pattern.avgOccupancyRate,
      pattern.sampleCount,
      pattern.capacity
    );
    patternCount++;

    if (patternCount % 1000 === 0) {
      process.stdout.write(`\r   Processed ${patternCount.toLocaleString()} patterns...`);
    }
  }
  console.log(`\r✅ Inserted ${patternCount.toLocaleString()} patterns\n`);

  // Verify data
  console.log('🔍 Verifying migration...');
  const facilityCountCheck = await db.db.prepare('SELECT COUNT(*) as count FROM parking_facilities').get();
  const patternCountCheck = await db.db.prepare('SELECT COUNT(*) as count FROM parking_patterns').get();

  console.log(`   Facilities in DB: ${facilityCountCheck.count}`);
  console.log(`   Patterns in DB: ${patternCountCheck.count}`);

  if (facilityCountCheck.count === facilityCount && patternCountCheck.count === patternCount) {
    console.log('\n✅ Migration completed successfully!\n');
  } else {
    console.log('\n⚠️  Warning: Count mismatch detected\n');
  }

  process.exit(0);
}

if (require.main === module) {
  migrateParkingData().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { migrateParkingData };

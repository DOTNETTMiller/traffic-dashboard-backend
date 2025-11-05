// Migrate truck parking patterns from JSON to SQLite database
// This ensures the data persists on Railway deployments

const fs = require('fs');
const path = require('path');
const db = require('../database.js');

async function migrateParkingData() {
  console.log('\n🚛 Migrating Truck Parking Patterns to Database\n');

  // Database singleton is already initialized by backend_proxy_server.js
  // But ensure it's ready for standalone script execution
  if (db.init && !db.initialized) {
    await db.init();
  }

  // Create tables for parking data
  console.log('📋 Creating database tables...');

  if (db.isPostgres) {
    await db.db.execAsync(`
      CREATE TABLE IF NOT EXISTS parking_facilities (
        facility_id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL,
        state TEXT NOT NULL,
        avg_capacity INTEGER NOT NULL,
        total_samples INTEGER NOT NULL,
        latitude DOUBLE PRECISION DEFAULT 0,
        longitude DOUBLE PRECISION DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS parking_patterns (
        id SERIAL PRIMARY KEY,
        facility_id TEXT NOT NULL,
        day_of_week INTEGER NOT NULL,
        hour INTEGER NOT NULL,
        avg_occupancy_rate DOUBLE PRECISION NOT NULL,
        sample_count INTEGER NOT NULL,
        capacity INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (facility_id) REFERENCES parking_facilities(facility_id),
        UNIQUE(facility_id, day_of_week, hour)
      );

      CREATE INDEX IF NOT EXISTS idx_parking_patterns_lookup
      ON parking_patterns(facility_id, day_of_week, hour);
    `);
  } else {
    db.db.exec(`
      CREATE TABLE IF NOT EXISTS parking_facilities (
        facility_id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL,
        state TEXT NOT NULL,
        avg_capacity INTEGER NOT NULL,
        total_samples INTEGER NOT NULL,
        latitude REAL DEFAULT 0,
        longitude REAL DEFAULT 0,
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
  }

  console.log('✅ Tables created successfully\n');

  // Load coordinate data from GIS export
  console.log('📍 Loading coordinate data from GIS export...');
  const coordDataPath = path.join(__dirname, 'facilities_data.json');
  let coordinateMap = new Map();
  let gisDataMap = new Map(); // Full facility data from GIS

  if (fs.existsSync(coordDataPath)) {
    const coordData = JSON.parse(fs.readFileSync(coordDataPath, 'utf8'));
    for (const facility of coordData) {
      coordinateMap.set(facility.facility_id, {
        latitude: facility.latitude || 0,
        longitude: facility.longitude || 0
      });
      gisDataMap.set(facility.facility_id, facility);
    }
    console.log(`✅ Loaded coordinates for ${coordinateMap.size} facilities\n`);
  } else {
    console.log('⚠️  No coordinate data found (facilities_data.json), will use 0,0 defaults\n');
  }

  // Load JSON data
  const jsonPath = path.join(__dirname, '../data/truck_parking_patterns.json');

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ File not found: ${jsonPath}`);
    console.log('💡 Run: node scripts/process_truck_parking_historical.js first');
    process.exit(1);
  }

  console.log(`📂 Loading data from: ${jsonPath}`);

  // Read raw file and log details
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  console.log(`📊 File size: ${rawData.length} bytes`);
  console.log(`📄 First 200 chars: ${rawData.substring(0, 200)}`);

  const data = JSON.parse(rawData);
  console.log(`📦 Parsed data keys: ${Object.keys(data).join(', ')}`);
  console.log(`   Facilities: ${data.facilities?.length || 0}`);
  console.log(`   Patterns: ${data.patterns?.length || 0}`);

  // Check if this is the old fallback-empty file from persistent storage
  if (data.source === 'fallback-empty' || (data.facilities?.length === 0 && data.patterns?.length === 0 && rawData.length < 1000)) {
    console.log('\n⚠️  WARNING: Found empty fallback file from old deployment (size: ' + rawData.length + ' bytes)');
    console.log('💡 This is a stale file created by a previous version that persists in Railway storage');
    console.log('🔄 Attempting to use the real bundled data file from git deployment...\n');

    // The real file should be in the deployment from git
    // If we're seeing the fallback, it means Railway has a persistent volume overriding it
    // We need to delete the old file and force Railway to use the git version
    console.log('❌ ERROR: Cannot migrate with empty data file');
    console.log('💡 Solution: Delete the persistent data volume on Railway, then redeploy');
    console.log('   This will allow the real 772KB file from git to be used\n');
    console.log('   Railway CLI: railway volume list, then railway volume delete <volume-id>');
    console.log('   Or remove/remount the volume via Railway dashboard\n');
    process.exit(1);
  }

  if (data.facilities && data.facilities.length > 0) {
    console.log(`   Sample facility: ${JSON.stringify(data.facilities[0])}`);
  }
  console.log('');

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
  console.log('📝 Inserting facilities with coordinates...');
  const facilityQuery = db.isPostgres ?
    `INSERT INTO parking_facilities
     (facility_id, site_id, state, avg_capacity, total_samples, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (facility_id) DO UPDATE SET
       site_id = EXCLUDED.site_id,
       state = EXCLUDED.state,
       avg_capacity = EXCLUDED.avg_capacity,
       total_samples = EXCLUDED.total_samples,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude` :
    `INSERT OR REPLACE INTO parking_facilities
     (facility_id, site_id, state, avg_capacity, total_samples, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?)`;

  const facilityStmt = db.db.prepare(facilityQuery);

  let facilityCount = 0;
  let coordMatchCount = 0;
  for (const facility of data.facilities || []) {
    // Get coordinates from GIS data, default to 0,0
    const coords = coordinateMap.get(facility.facilityId) || { latitude: 0, longitude: 0 };
    if (coords.latitude !== 0 || coords.longitude !== 0) {
      coordMatchCount++;
    }

    await facilityStmt.run(
      facility.facilityId,
      facility.siteId,
      facility.state,
      facility.avgCapacity || facility.capacity || 0,
      facility.totalSamples || 0,
      coords.latitude,
      coords.longitude
    );
    facilityCount++;
  }
  console.log(`✅ Inserted ${facilityCount} facilities (${coordMatchCount} with coordinates)\n`);

  // Add facilities from GIS data that don't have historical patterns
  console.log('📍 Checking for facilities in GIS data without patterns...');
  const patternFacilityIds = new Set((data.facilities || []).map(f => f.facilityId));
  let additionalCount = 0;

  for (const [facilityId, coords] of coordinateMap) {
    if (!patternFacilityIds.has(facilityId) && (coords.latitude !== 0 || coords.longitude !== 0)) {
      // Get the facility details from the GIS data map
      const facilityData = gisDataMap.get(facilityId);

      if (facilityData) {
        await facilityStmt.run(
          facilityData.facility_id,
          facilityData.site_id,
          facilityData.state,
          facilityData.capacity || 0,
          0, // no samples for facilities without patterns
          coords.latitude,
          coords.longitude
        );
        additionalCount++;
      }
    }
  }

  if (additionalCount > 0) {
    console.log(`✅ Added ${additionalCount} additional facilities from GIS data\n`);
  } else {
    console.log('✅ All GIS facilities already have patterns\n');
  }

  // Insert patterns
  console.log('📝 Inserting patterns...');
  const patternQuery = db.isPostgres ?
    `INSERT INTO parking_patterns
     (facility_id, day_of_week, hour, avg_occupancy_rate, sample_count, capacity)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (facility_id, day_of_week, hour) DO UPDATE SET
       avg_occupancy_rate = EXCLUDED.avg_occupancy_rate,
       sample_count = EXCLUDED.sample_count,
       capacity = EXCLUDED.capacity` :
    `INSERT OR REPLACE INTO parking_patterns
     (facility_id, day_of_week, hour, avg_occupancy_rate, sample_count, capacity)
     VALUES (?, ?, ?, ?, ?, ?)`;

  const patternStmt = db.db.prepare(patternQuery);

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

  // Don't exit when called as a module from the API endpoint
  // Only exit when run directly from command line
  if (require.main === module) {
    process.exit(0);
  }
}

if (require.main === module) {
  migrateParkingData().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { migrateParkingData };

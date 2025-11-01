// Add GPS coordinates to parking_facilities table and import from Excel
const xlsx = require('xlsx');
const path = require('path');
const Database = require('../database.js');

async function addCoordinatesToParkingFacilities() {
  console.log('\n📍 Adding Coordinates to Parking Facilities\n');

  const db = new Database.constructor();
  await db.init();

  // Step 1: Add latitude and longitude columns to parking_facilities table
  console.log('1️⃣  Adding latitude and longitude columns...');

  try {
    if (db.isPostgres) {
      await db.db.execAsync(`
        ALTER TABLE parking_facilities
        ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
      `);
    } else {
      // SQLite doesn't support IF NOT EXISTS for columns, so we try and catch errors
      try {
        db.db.exec('ALTER TABLE parking_facilities ADD COLUMN latitude REAL');
        console.log('   Added latitude column');
      } catch (e) {
        if (e.message.includes('duplicate column')) {
          console.log('   Latitude column already exists');
        } else {
          throw e;
        }
      }

      try {
        db.db.exec('ALTER TABLE parking_facilities ADD COLUMN longitude REAL');
        console.log('   Added longitude column');
      } catch (e) {
        if (e.message.includes('duplicate column')) {
          console.log('   Longitude column already exists');
        } else {
          throw e;
        }
      }
    }
  } catch (error) {
    console.error('Error adding columns:', error.message);
  }

  console.log('   ✅ Columns ready\n');

  // Step 2: Load Excel file with Iowa coordinates
  const excelPath = path.join(__dirname, '../TruckStopsExport/TruckStopsExport.xlsx');
  console.log(`2️⃣  Reading Excel file: ${excelPath}`);

  const workbook = xlsx.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const facilities = xlsx.utils.sheet_to_json(sheet);

  console.log(`   Found ${facilities.length} facilities in Excel\n`);

  // Step 3: Match and update coordinates
  console.log('3️⃣  Matching facilities and updating coordinates...\n');

  const updateQuery = db.isPostgres ?
    `UPDATE parking_facilities
     SET latitude = $1, longitude = $2
     WHERE facility_id = $3` :
    `UPDATE parking_facilities
     SET latitude = ?, longitude = ?
     WHERE facility_id = ?`;

  let matched = 0;
  let unmatched = 0;
  let updated = 0;

  for (const facility of facilities) {
    const siteId = facility.SiteId;
    const lat = parseFloat(facility.Latitude);
    const lon = parseFloat(facility.Longitude);
    const name = facility.SiteName;

    // Validate coordinates
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      console.log(`   ⚠️  Skipping ${siteId}: Invalid coordinates`);
      continue;
    }

    // Convert Excel SiteId to database facility_id format
    // Excel: IA00080IS0008000ERA80E000
    // DB:    tpims-historical-ia00080is0008000era80e000
    const facilityId = 'tpims-historical-' + siteId.toLowerCase();

    // Check if facility exists in database
    const existing = await db.db.prepare(
      'SELECT facility_id, site_id FROM parking_facilities WHERE facility_id = ?'
    ).get(facilityId);

    if (existing) {
      // Update coordinates
      const stmt = db.db.prepare(updateQuery);
      const result = await stmt.run(lat, lon, facilityId);

      matched++;
      updated++;
      console.log(`   ✅ ${facilityId}`);
      console.log(`      ${name} (${lat}, ${lon})`);
    } else {
      unmatched++;
      console.log(`   ❌ Not found in DB: ${facilityId}`);
      console.log(`      ${name}`);
    }
  }

  console.log(`\n📊 Import Summary:`);
  console.log(`   Matched and updated: ${updated}`);
  console.log(`   Not found in database: ${unmatched}`);
  console.log(`   Total processed: ${facilities.length}\n`);

  // Step 4: Verify the update
  console.log('4️⃣  Verifying coordinates...');

  const withCoords = await db.db.prepare(
    'SELECT COUNT(*) as count FROM parking_facilities WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
  ).get();

  const byState = await db.db.prepare(
    'SELECT state, COUNT(*) as total, SUM(CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END) as with_coords FROM parking_facilities GROUP BY state'
  ).all();

  console.log(`   Total facilities with coordinates: ${withCoords.count}\n`);
  console.log(`   By state:`);
  byState.forEach(row => {
    console.log(`      ${row.state}: ${row.with_coords}/${row.total} have coordinates`);
  });

  console.log('\n✅ Coordinate import completed!\n');

  if (require.main === module) {
    process.exit(0);
  }
}

if (require.main === module) {
  addCoordinatesToParkingFacilities().catch(error => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
}

module.exports = { addCoordinatesToParkingFacilities };

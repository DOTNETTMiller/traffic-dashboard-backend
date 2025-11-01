// Import truck parking facility coordinates from Excel file
const xlsx = require('xlsx');
const path = require('path');
const Database = require('../database.js');

async function importCoordinates() {
  console.log('\n📍 Importing Truck Parking Coordinates\n');

  const db = new Database.constructor();
  await db.init();

  // Read the Excel file
  const excelPath = path.join(__dirname, '../TruckStopsExport/TruckStopsExport.xlsx');
  console.log(`📂 Reading Excel file: ${excelPath}\n`);

  const workbook = xlsx.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const facilities = xlsx.utils.sheet_to_json(sheet);

  console.log(`📊 Found ${facilities.length} facilities in Excel file\n`);

  // Get existing facilities from database
  console.log('🔍 Checking existing facilities in database...');
  const existingFacilities = await db.db.prepare(
    'SELECT facility_id, facility_name, state, latitude, longitude FROM truck_parking_facilities'
  ).all();

  console.log(`   Found ${existingFacilities.length} facilities in database`);
  console.log(`   Sample facility IDs from database:`);
  existingFacilities.slice(0, 5).forEach(f => {
    console.log(`      ${f.facility_id} - ${f.facility_name} (${f.state})`);
  });

  console.log(`\n   Sample SiteIds from Excel:`);
  facilities.slice(0, 5).forEach(f => {
    console.log(`      ${f.SiteId} - ${f.SiteName}`);
  });

  // Count facilities with no coordinates
  const noCoords = existingFacilities.filter(f =>
    !f.latitude || !f.longitude || f.latitude === 0 || f.longitude === 0
  ).length;
  console.log(`\n   Facilities without coordinates: ${noCoords}\n`);

  // Update coordinates
  console.log('📝 Updating facility coordinates...\n');

  const updateQuery = db.isPostgres ?
    `UPDATE truck_parking_facilities
     SET latitude = $1, longitude = $2, facility_name = $3, total_spaces = $4, updated_at = CURRENT_TIMESTAMP
     WHERE facility_id = $5` :
    `UPDATE truck_parking_facilities
     SET latitude = ?, longitude = ?, facility_name = ?, total_spaces = ?, updated_at = CURRENT_TIMESTAMP
     WHERE facility_id = ?`;

  const insertQuery = db.isPostgres ?
    `INSERT INTO truck_parking_facilities
     (facility_id, facility_name, state, latitude, longitude, total_spaces, facility_type)
     VALUES ($1, $2, $3, $4, $5, $6, 'Rest Area')
     ON CONFLICT (facility_id) DO UPDATE SET
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       facility_name = EXCLUDED.facility_name,
       total_spaces = EXCLUDED.total_spaces,
       updated_at = CURRENT_TIMESTAMP` :
    `INSERT OR REPLACE INTO truck_parking_facilities
     (facility_id, facility_name, state, latitude, longitude, total_spaces, facility_type)
     VALUES (?, ?, ?, ?, ?, ?, 'Rest Area')`;

  let updated = 0;
  let inserted = 0;
  let skipped = 0;

  for (const facility of facilities) {
    const siteId = facility.SiteId;
    const lat = parseFloat(facility.Latitude);
    const lon = parseFloat(facility.Longitude);
    const name = facility.SiteName;
    const capacity = parseInt(facility.Capacity) || 0;
    const state = facility.State;

    // Validate coordinates
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      console.log(`   ⚠️  Skipping ${siteId}: Invalid coordinates`);
      skipped++;
      continue;
    }

    // Check if facility exists in database
    const existing = existingFacilities.find(f => f.facility_id === siteId);

    try {
      if (existing) {
        // Update existing facility
        const stmt = db.db.prepare(updateQuery);
        await stmt.run(lat, lon, name, capacity, siteId);
        updated++;
        console.log(`   ✅ Updated: ${siteId} - ${name} (${lat}, ${lon})`);
      } else {
        // Insert new facility
        const stmt = db.db.prepare(insertQuery);
        await stmt.run(siteId, name, state, lat, lon, capacity);
        inserted++;
        console.log(`   ➕ Inserted: ${siteId} - ${name} (${lat}, ${lon})`);
      }
    } catch (error) {
      console.error(`   ❌ Error processing ${siteId}:`, error.message);
      skipped++;
    }
  }

  console.log(`\n📊 Import Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total processed: ${updated + inserted + skipped}\n`);

  // Verify the update
  console.log('🔍 Verifying coordinates...');
  const afterUpdate = await db.db.prepare(
    'SELECT COUNT(*) as total FROM truck_parking_facilities WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0 AND longitude != 0'
  ).get();
  console.log(`   Facilities with valid coordinates: ${afterUpdate.total}\n`);

  console.log('✅ Import completed successfully!\n');

  if (require.main === module) {
    process.exit(0);
  }
}

if (require.main === module) {
  importCoordinates().catch(error => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
}

module.exports = { importCoordinates };

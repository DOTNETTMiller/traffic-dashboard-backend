// Update parking facility coordinates from TruckStopsExport.xlsx
const XLSX = require('xlsx');
const Database = require('../database.js');

const db = new Database.constructor();

async function updateCoordinates() {
  console.log('\n📍 Updating parking facility coordinates from Excel...\n');

  // Read Excel file
  const workbook = XLSX.readFile('./TruckStopsExport/TruckStopsExport.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`📋 Found ${data.length} facilities in Excel file\n`);

  await db.init();

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const row of data) {
    const siteId = row.SiteId;
    const latitude = parseFloat(row.Latitude);
    const longitude = parseFloat(row.Longitude);
    const state = row.State;

    if (!siteId || !latitude || !longitude) {
      continue;
    }

    // Generate facility ID to match what we created
    const facilityId = `tpims-historical-${siteId.toLowerCase()}`;

    try {
      // Check if facility exists
      const existing = db.db.prepare(
        'SELECT facility_id FROM parking_facilities WHERE facility_id = ?'
      ).get(facilityId);

      if (existing) {
        // Update coordinates
        db.db.prepare(`
          UPDATE parking_facilities
          SET latitude = ?, longitude = ?
          WHERE facility_id = ?
        `).run(latitude, longitude, facilityId);

        updated++;
        if (updated % 10 === 0) {
          process.stdout.write(`\r✅ Updated ${updated} facilities...`);
        }
      } else {
        notFound++;
      }
    } catch (error) {
      console.error(`\n❌ Error updating ${siteId}:`, error.message);
      errors++;
    }
  }

  console.log(`\n\n📊 Update Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Not found in DB: ${notFound}`);
  console.log(`   Errors: ${errors}\n`);

  // Verify Iowa facilities
  const iowaWithCoords = db.db.prepare(`
    SELECT COUNT(*) as count
    FROM parking_facilities
    WHERE state = 'IA' AND latitude <> 0 AND longitude <> 0
  `).get();

  console.log(`✅ Iowa facilities with coordinates: ${iowaWithCoords.count}\n`);
}

updateCoordinates().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

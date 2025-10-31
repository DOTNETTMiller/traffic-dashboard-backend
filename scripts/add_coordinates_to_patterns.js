// Add coordinates from TruckStopsExport.xlsx to the parking patterns
// This merges facility location data with historical patterns

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

async function addCoordinates() {
  console.log('\n📍 Adding Coordinates to Parking Patterns\n');

  // Load the Excel file with facility locations
  const excelPath = path.join(__dirname, '../TruckStopsExport/TruckStopsExport.xlsx');

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ File not found: ${excelPath}`);
    process.exit(1);
  }

  console.log('📂 Reading facility locations from Excel...');
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const excelData = xlsx.utils.sheet_to_json(worksheet);

  console.log(`✅ Found ${excelData.length} facilities in Excel file\n`);

  // Create a map of SiteId -> coordinates
  const locationMap = new Map();

  excelData.forEach(row => {
    const siteId = (row.SiteId || row.SiteID || row.siteid || '').toUpperCase();
    const latitude = parseFloat(row.Latitude || row.latitude || row.Lat || row.lat);
    const longitude = parseFloat(row.Longitude || row.longitude || row.Lon || row.lon || row.Long || row.long);
    const name = row.SiteName || row.Name || row.FacilityName || '';
    const city = row.City || row.city || '';
    const state = row.State || row.state || '';
    const capacity = parseInt(row.Capacity || row.capacity || 0);

    if (siteId && !isNaN(latitude) && !isNaN(longitude)) {
      locationMap.set(siteId, {
        latitude,
        longitude,
        name,
        city,
        state,
        capacity,
        address: city && state ? `${city}, ${state}` : ''
      });
    }
  });

  console.log(`📊 Mapped ${locationMap.size} facilities with valid coordinates\n`);

  // Load the existing patterns file
  const patternsPath = path.join(__dirname, '../data/truck_parking_patterns.json');

  if (!fs.existsSync(patternsPath)) {
    console.error(`❌ Patterns file not found: ${patternsPath}`);
    console.log('💡 Run process_truck_parking_historical.js first');
    process.exit(1);
  }

  const patternsData = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));

  console.log('📋 Merging coordinates with pattern data...');

  let matchedCount = 0;
  let unmatchedCount = 0;

  // Update facilities with coordinates
  patternsData.facilities = patternsData.facilities.map(facility => {
    // Extract the original SiteId from the facilityId
    // facilityId format: tpims-historical-ky00065is000020nsmarathon
    const siteIdMatch = facility.facilityId.match(/tpims-historical-(.+)/i);

    if (siteIdMatch) {
      const siteId = siteIdMatch[1].toUpperCase();
      const location = locationMap.get(siteId);

      if (location) {
        matchedCount++;
        return {
          ...facility,
          latitude: location.latitude,
          longitude: location.longitude,
          facilityName: location.name || facility.siteId,
          address: location.address,
          city: location.city,
          capacity: location.capacity || facility.capacity
        };
      }
    }

    unmatchedCount++;
    return facility;
  });

  console.log(`✅ Matched ${matchedCount} facilities with coordinates`);
  console.log(`⚠️  ${unmatchedCount} facilities without coordinates\n`);

  // Update metadata
  patternsData.metadata = {
    ...patternsData.metadata,
    coordinatesAddedAt: new Date().toISOString(),
    facilitiesWithCoordinates: matchedCount,
    facilitiesWithoutCoordinates: unmatchedCount
  };

  // Save updated patterns
  fs.writeFileSync(patternsPath, JSON.stringify(patternsData, null, 2));
  console.log(`💾 Updated patterns saved to: ${patternsPath}\n`);

  // Print summary
  console.log('📊 Summary:');
  console.log(`   Total facilities: ${patternsData.facilities.length}`);
  console.log(`   With coordinates: ${matchedCount} (${Math.round(matchedCount / patternsData.facilities.length * 100)}%)`);
  console.log(`   Without coordinates: ${unmatchedCount}`);
  console.log(`   Total patterns: ${patternsData.patterns.length}\n`);

  console.log('✅ Coordinate merge complete!\n');
}

// Main execution
if (require.main === module) {
  addCoordinates().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { addCoordinates };

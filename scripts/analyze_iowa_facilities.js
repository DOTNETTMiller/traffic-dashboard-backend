// Analyze Iowa facilities to understand which ones should be showing
const fs = require('fs');

const facilities = JSON.parse(fs.readFileSync('scripts/facilities_data.json', 'utf8'));

const iowaFacilities = facilities.filter(f => f.state === 'IA');

console.log(`\n📊 Total Iowa facilities: ${iowaFacilities.length}\n`);

// Check for facilities with zero coordinates (won't show on map)
const withCoords = iowaFacilities.filter(f => f.latitude !== 0 && f.longitude !== 0);
const withoutCoords = iowaFacilities.filter(f => f.latitude === 0 || f.longitude === 0);

console.log(`✅ Iowa facilities WITH coordinates: ${withCoords.length}`);
console.log(`❌ Iowa facilities WITHOUT coordinates (0,0): ${withoutCoords.length}\n`);

// Look for Davenport (user said it works)
const davenportFacilities = iowaFacilities.filter(f =>
  f.facility_id.toLowerCase().includes('daven') ||
  f.site_id.toLowerCase().includes('daven')
);

if (davenportFacilities.length > 0) {
  console.log('🎯 Davenport facilities (user said these work):');
  davenportFacilities.forEach(f => {
    console.log(`  ${f.facility_id}`);
    console.log(`    Site: ${f.site_id}`);
    console.log(`    Coords: (${f.latitude}, ${f.longitude})`);
    console.log(`    Capacity: ${f.capacity}`);
  });
  console.log();
}

// Show all Iowa facilities with coordinates
console.log('📍 All Iowa facilities with valid coordinates:');
withCoords.forEach(f => {
  console.log(`  ${f.facility_id.substring(17)}`); // Remove "tpims-historical-" prefix for readability
  console.log(`    ${f.site_id} - (${f.latitude}, ${f.longitude}) - ${f.capacity} spaces`);
});
console.log();

// Show facilities without coordinates
if (withoutCoords.length > 0) {
  console.log('⚠️  Iowa facilities with missing coordinates (will NOT show on map):');
  withoutCoords.forEach(f => {
    console.log(`  ${f.facility_id.substring(17)} - ${f.site_id}`);
  });
  console.log();
}

// Summary
console.log('📝 Summary:');
console.log(`  - Total Iowa facilities in dataset: ${iowaFacilities.length}`);
console.log(`  - Can show on map (have coordinates): ${withCoords.length}`);
console.log(`  - Cannot show on map (missing coordinates): ${withoutCoords.length}`);
console.log(`\n💡 The ${withCoords.length} facilities with coordinates should all appear on the map once imported.\n`);

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/truck_parking_patterns.json', 'utf8'));

console.log('Facilities WITHOUT coordinates:\n');
const withoutCoords = data.facilities.filter(f => !f.latitude || !f.longitude || f.latitude === 0 || f.longitude === 0);
withoutCoords.forEach(f => {
  const match = f.facilityId.match(/tpims-historical-(.+)/i);
  const siteId = match ? match[1].toUpperCase() : 'unknown';
  console.log(`  ${siteId.substring(0, 30).padEnd(30)} - ${f.state}`);
});

console.log(`\nTotal without coords: ${withoutCoords.length}`);
console.log(`\nFacilities WITH coordinates:\n`);
const withCoords = data.facilities.filter(f => f.latitude && f.longitude && f.latitude !== 0 && f.longitude !== 0);
withCoords.slice(0, 5).forEach(f => {
  console.log(`  ${f.facilityName} - ${f.city}, ${f.state}`);
});
console.log(`  ... and ${withCoords.length - 5} more`);

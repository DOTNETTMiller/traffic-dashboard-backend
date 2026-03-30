// Temporary analysis script - outputs broken facilities from facilities_data.json
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'facilities_data.json'), 'utf8'));

console.log('Total facilities:', data.length);
console.log('Sample keys:', Object.keys(data[0]).join(', '));
console.log('---');

const broken = data.filter(f => !f.latitude || !f.longitude || f.latitude === 0 || f.longitude === 0);
console.log('Broken count:', broken.length);
console.log('---');

broken.forEach(f => {
  console.log(JSON.stringify({ facility_id: f.facility_id, site_id: f.site_id, state: f.state, lat: f.latitude, lon: f.longitude }));
});

console.log('---');
console.log('States with broken:', [...new Set(broken.map(f => f.state))].sort().join(', '));

// Also pretty-print the entire file for editing
fs.writeFileSync(path.join(__dirname, 'facilities_data_pretty.json'), JSON.stringify(data, null, 2));
console.log('Wrote pretty-printed version to facilities_data_pretty.json');

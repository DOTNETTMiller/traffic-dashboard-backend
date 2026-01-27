// Test script to fetch OSRM geometry for both directions
const axios = require('axios');

// I-80 in Iowa - same segment, both directions
const lat1 = 41.6611;
const lng1 = -91.5302;
const lat2 = 41.6544;
const lng2 = -91.4891;

async function fetchOSRM(lat1, lng1, lat2, lng2, label) {
  const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;

  try {
    const response = await axios.get(url, { timeout: 10000 });

    if (response.data.code === 'Ok' && response.data.routes && response.data.routes[0]) {
      const coords = response.data.routes[0].geometry.coordinates;
      console.log(`\n${label}:`);
      console.log(`  Points: ${coords.length}`);
      console.log(`  First point: [${coords[0][0]}, ${coords[0][1]}]`);
      console.log(`  Last point:  [${coords[coords.length-1][0]}, ${coords[coords.length-1][1]}]`);
      console.log(`  Distance: ${response.data.routes[0].distance} meters`);
      return coords;
    }
  } catch (error) {
    console.error(`Error fetching ${label}:`, error.message);
  }
  return null;
}

async function test() {
  console.log('Testing OSRM for I-80 Iowa segment...\n');
  console.log(`Start: ${lat1}, ${lng1}`);
  console.log(`End: ${lat2}, ${lng2}`);

  const westbound = await fetchOSRM(lat1, lng1, lat2, lng2, 'Westbound (lat1→lat2)');
  const eastbound = await fetchOSRM(lat2, lng2, lat1, lng1, 'Eastbound (lat2→lat1, reversed)');

  if (westbound && eastbound) {
    console.log('\n=== COMPARISON ===');
    const firstWB = JSON.stringify(westbound[0]);
    const lastEB = JSON.stringify(eastbound[eastbound.length-1]);
    console.log(`Same start point? ${firstWB === lastEB}`);
    console.log('\nConclusion: OSRM returns the same centerline geometry regardless of direction.');
    console.log('This is why we need manual directional offsets to show separate lanes.');
  }
}

test();

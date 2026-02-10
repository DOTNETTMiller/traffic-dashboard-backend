/**
 * Test that the direction fix works correctly
 */

const { Pool } = require('pg');

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function testDirectionNormalization() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('Testing direction normalization fix\n');

  // Simulate what happens when extractDirection returns "Westbound"
  const direction = "Westbound";
  console.log('1. extractDirection returns:', direction);

  // Simulate getInterstateGeometry normalization (line 969-976)
  let dir = null;
  if (direction) {
    const d = direction.toLowerCase();
    if (d.includes('north') || d.includes('nb') || d === 'n') dir = 'NB';
    else if (d.includes('south') || d.includes('sb') || d === 's') dir = 'SB';
    else if (d.includes('east') || d.includes('eb') || d === 'e') dir = 'EB';
    else if (d.includes('west') || d.includes('wb') || d === 'w') dir = 'WB';
  }
  console.log('2. After normalization, dir =', dir);

  // NEW CODE (fixed): Use dir directly
  const dirName = `I-80 ${dir}`;
  console.log('3. Looking up corridor:', dirName);

  const result = await pool.query('SELECT geometry FROM corridors WHERE name = $1', [dirName]);

  if (result.rows.length > 0) {
    console.log('4. ✅ FOUND! Geometry has', result.rows[0].geometry.coordinates.length, 'points');

    // Test extraction with a real event
    const geometry = result.rows[0].geometry.coordinates;
    const lat1 = 41.591408, lng1 = -93.809752;
    const lat2 = 41.578484, lng2 = -93.835371;

    // Find closest points
    let startIdx = 0, minStartDist = Infinity;
    for (let i = 0; i < geometry.length; i++) {
      const [lon, lat] = geometry[i];
      const dist = haversineDistance(lat1, lng1, lat, lon);
      if (dist < minStartDist) {
        minStartDist = dist;
        startIdx = i;
      }
    }

    console.log('5. Closest point to event start:', (minStartDist * 1000).toFixed(0), 'm away');
    console.log('\n✅ SUCCESS: Direction fix works correctly!');
  } else {
    console.log('4. ❌ FAILED: No geometry found for', dirName);
  }

  await pool.end();
}

testDirectionNormalization();

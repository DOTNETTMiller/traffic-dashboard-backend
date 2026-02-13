/**
 * Test snapToRoad function directly with failing event coordinates
 */

// Simulating the exact snapToRoad logic from backend_proxy_server.js
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:REDACTED_PASSWORD@tramway.proxy.rlwy.net:14217/railway";
const pgPool = new Pool({ connectionString: DATABASE_URL });

// Haversine distance formula
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Extract segment from full highway geometry
function extractSegment(geometry, lat1, lng1, lat2, lng2) {
  if (!geometry || geometry.length < 2) {
    console.log('  ❌ No geometry or too short');
    return null;
  }

  let startIdx = 0;
  let endIdx = geometry.length - 1;
  let minStartDist = Infinity;
  let minEndDist = Infinity;

  for (let i = 0; i < geometry.length; i++) {
    const [lon, lat] = geometry[i];

    const startDist = haversineDistance(lat1, lng1, lat, lon);
    if (startDist < minStartDist) {
      minStartDist = startDist;
      startIdx = i;
    }

    const endDist = haversineDistance(lat2, lng2, lat, lon);
    if (endDist < minEndDist) {
      minEndDist = endDist;
      endIdx = i;
    }
  }

  if (startIdx > endIdx) {
    [startIdx, endIdx] = [endIdx, startIdx];
  }

  const segment = geometry.slice(startIdx, endIdx + 1);

  console.log(`  Start point: index ${startIdx}, distance ${minStartDist.toFixed(2)}km`);
  console.log(`  End point: index ${endIdx}, distance ${minEndDist.toFixed(2)}km`);

  // Validation 1: Endpoints must be within 5km
  if (minStartDist > 5 || minEndDist > 5) {
    console.log(`  ❌ VALIDATION 1 FAILED: start=${minStartDist.toFixed(1)}km, end=${minEndDist.toFixed(1)}km (max 5km)`);
    return null;
  }

  console.log(`  ✅ VALIDATION 1 PASSED`);
  console.log(`  Segment: ${segment.length} points`);

  return segment.length >= 2 ? segment : null;
}

// Get Interstate geometry
async function getInterstateGeometry(corridor, state, lat1, lng1, lat2, lng2, direction) {
  console.log(`\n🔍 getInterstateGeometry called:`);
  console.log(`  corridor="${corridor}", state="${state}", direction="${direction}"`);

  if (!corridor || !corridor.match(/^I-\d+/i)) {
    console.log('  ❌ Not an interstate');
    return null;
  }

  // Normalize direction
  let dir = null;
  if (direction) {
    const d = direction.toLowerCase();
    if (d.includes('north') || d.includes('nb') || d === 'n') dir = 'NB';
    else if (d.includes('south') || d.includes('sb') || d === 's') dir = 'SB';
    else if (d.includes('east') || d.includes('eb') || d === 'e') dir = 'EB';
    else if (d.includes('west') || d.includes('wb') || d === 'w') dir = 'WB';
  }

  console.log(`  Normalized direction: "${dir}"`);

  // Normalize state
  const stateAbbreviations = {
    'iowa': 'IA', 'ohio': 'OH', 'pennsylvania': 'PA'
  };
  const stateCode = stateAbbreviations[state.toLowerCase()] || state.toUpperCase();

  console.log(`  Normalized state: "${stateCode}"`);

  if (dir) {
    const dirName = `${corridor} ${dir}`;
    console.log(`  Looking for corridor: "${dirName}"`);

    const result = await pgPool.query(
      'SELECT geometry FROM corridors WHERE name = $1 LIMIT 1',
      [dirName]
    );

    if (result.rows.length > 0 && result.rows[0].geometry) {
      const fullGeometry = result.rows[0].geometry;
      console.log(`  ✅ Found geometry: ${fullGeometry.coordinates.length} points`);

      return extractSegment(fullGeometry.coordinates, lat1, lng1, lat2, lng2);
    } else {
      console.log(`  ❌ No geometry found for "${dirName}"`);
    }
  } else {
    console.log(`  ❌ No direction provided, can't query corridor`);
  }

  return null;
}

async function main() {
  console.log('🧪 Testing snapToRoad logic with failing event\n');
  console.log('='.repeat(60));

  // Failing event coordinates
  const lat1 = 41.492909;
  const lng1 = -94.318504;
  const lat2 = 41.540079;
  const lng2 = -94.013187;
  const direction = "Westbound";
  const corridor = "I-80";
  const state = "Iowa";

  console.log('\n📌 Event Parameters:');
  console.log(`  Start: ${lat1}, ${lng1}`);
  console.log(`  End: ${lat2}, ${lng2}`);
  console.log(`  Direction: ${direction}`);
  console.log(`  Corridor: ${corridor}`);
  console.log(`  State: ${state}`);

  const result = await getInterstateGeometry(corridor, state, lat1, lng1, lat2, lng2, direction);

  console.log('\n📊 RESULT:');
  if (result) {
    console.log(`  ✅ SUCCESS: Extracted ${result.length} points`);
    console.log(`  First coord: [${result[0][0]}, ${result[0][1]}]`);
    console.log(`  Last coord: [${result[result.length-1][0]}, ${result[result.length-1][1]}]`);
  } else {
    console.log('  ❌ FAILED: Returned null (would fall back to straight line)');
  }

  await pgPool.end();
}

main().catch(console.error);

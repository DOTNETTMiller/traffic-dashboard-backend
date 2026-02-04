const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const HPMS_API = 'https://geo.dot.gov/server/rest/services/Hosted/HPMS_Interstates/FeatureServer/0/query';

/**
 * Test different sequencing approaches for I-90
 */
async function testHPMSSequencing() {
  console.log('\n🔍 Testing HPMS Sequencing Approaches for I-90\n');
  console.log('='.repeat(80));

  try {
    // Fetch all I-90 features
    const response = await axios.get(HPMS_API, {
      params: {
        where: 'route_number = 90',
        outFields: '*',
        returnGeometry: true,
        f: 'json',
        outSR: 4326 // WGS84
      }
    });

    const features = response.data.features;
    console.log(`\n✓ Fetched ${features.length} I-90 features\n`);

    // Group by direction indicators in route_id
    const eastbound = [];
    const westbound = [];
    const unclear = [];

    for (const feature of features) {
      const routeId = feature.attributes.route_id || '';
      const routeName = (feature.attributes.route_name || '').toUpperCase();

      // Check for direction indicators
      const isEastbound = routeId.includes('E') || routeId.includes('EB') ||
                         routeName.includes('90E') || routeId.endsWith('-I');
      const isWestbound = routeId.includes('W') || routeId.includes('WB') ||
                         routeName.includes('90W') || routeId.endsWith('-D');

      if (isEastbound && !isWestbound) {
        eastbound.push(feature);
      } else if (isWestbound && !isEastbound) {
        westbound.push(feature);
      } else {
        unclear.push(feature);
      }
    }

    console.log(`📊 Direction Classification:`);
    console.log(`   Eastbound: ${eastbound.length} features`);
    console.log(`   Westbound: ${westbound.length} features`);
    console.log(`   Unclear: ${unclear.length} features\n`);

    // For unclear features, try to determine direction from geometry
    for (const feature of unclear) {
      const paths = feature.geometry.paths;
      if (paths && paths.length > 0) {
        const firstPoint = paths[0][0];
        const lastPoint = paths[0][paths[0].length - 1];

        // If path goes generally west to east, it's eastbound
        if (lastPoint[0] > firstPoint[0]) {
          eastbound.push(feature);
        } else {
          westbound.push(feature);
        }
      }
    }

    console.log(`📊 After geometric classification:`);
    console.log(`   Eastbound: ${eastbound.length} features`);
    console.log(`   Westbound: ${westbound.length} features\n`);

    // Test sequencing eastbound segments
    console.log('🔄 Testing Eastbound Sequencing...\n');
    await testSequencing(eastbound, 'east', 'I-90 EB');

    console.log('\n🔄 Testing Westbound Sequencing...\n');
    await testSequencing(westbound, 'west', 'I-90 WB');

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Sequencing test complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Test different sequencing methods
 */
async function testSequencing(features, direction, corridorName) {
  if (features.length === 0) {
    console.log(`   ⚠️  No features to sequence`);
    return;
  }

  // Method 1: Sort by route_id alphanumerically
  const byRouteId = [...features].sort((a, b) => {
    const idA = a.attributes.route_id || '';
    const idB = b.attributes.route_id || '';
    return direction === 'east' ? idA.localeCompare(idB) : idB.localeCompare(idA);
  });

  // Method 2: Sort by first coordinate (westernmost to easternmost)
  const byCoordinate = [...features].sort((a, b) => {
    const pathsA = a.geometry.paths;
    const pathsB = b.geometry.paths;
    if (!pathsA || !pathsB) return 0;

    const lonA = pathsA[0][0][0];
    const lonB = pathsB[0][0][0];

    return direction === 'east' ? lonA - lonB : lonB - lonA;
  });

  // Method 3: Extract numeric portions of route_id and sort
  const byNumeric = [...features].sort((a, b) => {
    const idA = a.attributes.route_id || '';
    const idB = b.attributes.route_id || '';

    // Extract first numeric sequence
    const numA = parseInt(idA.match(/\d+/)?.[0] || '0', 10);
    const numB = parseInt(idB.match(/\d+/)?.[0] || '0', 10);

    return direction === 'east' ? numA - numB : numB - numA;
  });

  // Analyze each method
  console.log(`   Method 1 - Sort by route_id alphanumerically:`);
  const gaps1 = analyzeSequence(byRouteId);

  console.log(`\n   Method 2 - Sort by longitude (${direction === 'east' ? 'west→east' : 'east→west'}):`);
  const gaps2 = analyzeSequence(byCoordinate);

  console.log(`\n   Method 3 - Sort by numeric route_id:`);
  const gaps3 = analyzeSequence(byNumeric);

  // Choose best method (fewest large gaps)
  let bestMethod = byCoordinate;
  let bestMethodName = 'coordinate-based';
  let bestGaps = gaps2;

  if (gaps1.largeGapCount < bestGaps.largeGapCount) {
    bestMethod = byRouteId;
    bestMethodName = 'route_id alphanumeric';
    bestGaps = gaps1;
  }

  if (gaps3.largeGapCount < bestGaps.largeGapCount) {
    bestMethod = byNumeric;
    bestMethodName = 'numeric route_id';
    bestGaps = gaps3;
  }

  console.log(`\n   ✅ Best method: ${bestMethodName} (${bestGaps.largeGapCount} large gaps)\n`);

  // Merge segments from best method
  const merged = mergeSegments(bestMethod);

  if (merged && merged.length > 0) {
    const geometry = {
      type: 'LineString',
      coordinates: merged
    };

    // Update database
    const result = await pool.query(
      `UPDATE corridors
       SET geometry = $1, updated_at = NOW()
       WHERE name = $2
       RETURNING id`,
      [JSON.stringify(geometry), corridorName]
    );

    if (result.rows.length > 0) {
      console.log(`   ✅ Updated ${corridorName} (${merged.length} points)`);
    } else {
      console.log(`   ⚠️  No corridor found: ${corridorName}`);
    }
  }
}

/**
 * Analyze gaps in a sequence
 */
function analyzeSequence(features) {
  let maxGap = 0;
  let largeGapCount = 0;
  const LARGE_GAP_THRESHOLD = 0.5; // degrees

  for (let i = 1; i < features.length; i++) {
    const prevPaths = features[i - 1].geometry.paths;
    const currPaths = features[i].geometry.paths;

    if (!prevPaths || !currPaths) continue;

    const prevEnd = prevPaths[0][prevPaths[0].length - 1];
    const currStart = currPaths[0][0];

    const gap = Math.sqrt(
      Math.pow(currStart[0] - prevEnd[0], 2) +
      Math.pow(currStart[1] - prevEnd[1], 2)
    );

    if (gap > maxGap) maxGap = gap;
    if (gap > LARGE_GAP_THRESHOLD) largeGapCount++;
  }

  console.log(`      Max gap: ${maxGap.toFixed(4)}°`);
  console.log(`      Large gaps (>0.5°): ${largeGapCount}`);

  return { maxGap, largeGapCount };
}

/**
 * Merge feature segments into continuous path
 */
function mergeSegments(features) {
  const allCoords = [];

  for (const feature of features) {
    const paths = feature.geometry.paths;
    if (!paths) continue;

    for (const path of paths) {
      // Skip duplicate consecutive points
      for (const coord of path) {
        if (allCoords.length === 0) {
          allCoords.push(coord);
        } else {
          const prev = allCoords[allCoords.length - 1];
          if (Math.abs(coord[0] - prev[0]) > 0.0001 || Math.abs(coord[1] - prev[1]) > 0.0001) {
            allCoords.push(coord);
          }
        }
      }
    }
  }

  return allCoords;
}

// Run test
testHPMSSequencing().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

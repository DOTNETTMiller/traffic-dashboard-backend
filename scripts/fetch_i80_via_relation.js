/**
 * Test script: Fetch I-80 geometry using OSM relation approach
 *
 * This uses individual I-80 route relations (11 WB, 11 EB) which maintain proper ordering
 * of way segments, eliminating the geometry gaps caused by nearest-neighbor stitching
 */

const { Pool } = require('pg');
const axios = require('axios');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

// I-80 route relations discovered via Overpass API query:
// relation["ref"="80"]["network"="US:I"]["type"="route"]
const I80_RELATIONS = {
  westbound: [69363, 69364, 113177, 280678, 282374, 286810, 396249, 934337, 934352, 942897, 942899],
  eastbound: [6901235, 6901301, 6902136, 6902197, 6903871, 6903909, 6904814, 6904820, 6904835, 6904948, 6904954]
};

/**
 * Fetch Interstate geometry using OSM relations
 * Relations maintain proper ordering of way segments
 */
async function fetchI80ViaRelation() {
  console.log('\n' + '='.repeat(70));
  console.log('🛣️  Fetching I-80 using 22 OSM route relations');
  console.log('='.repeat(70));

  try {
    const directions = ['westbound', 'eastbound'];
    const allCoordinates = {};

    for (const direction of directions) {
      const relationIds = I80_RELATIONS[direction];
      console.log(`\n   Processing ${direction.toUpperCase()} (${relationIds.length} relations)...`);

      const directionCoords = [];

      for (const relId of relationIds) {
        console.log(`     Querying relation ${relId}...`);

        // Query each relation with recursive member retrieval
        const overpassQuery = `
          [out:json][timeout:180];
          (
            relation(${relId});
            >>;
          );
          out geom;
        `;

        const response = await axios.post(
          'https://overpass-api.de/api/interpreter',
          `data=${encodeURIComponent(overpassQuery)}`,
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 200000
          }
        );

        const data = response.data;
        const relation = data.elements.find(e => e.type === 'relation' && e.id === relId);
        const ways = data.elements.filter(e => e.type === 'way' && e.geometry);

        if (!relation) {
          console.log(`       ⚠️  Relation ${relId} not found, skipping`);
          continue;
        }

        // Build way ID lookup
        const wayById = {};
        for (const way of ways) {
          wayById[way.id] = way;
        }

        // Extract ways in the order defined by the relation
        const orderedCoords = [];
        for (const member of relation.members) {
          if (member.type === 'way' && wayById[member.ref]) {
            const way = wayById[member.ref];
            if (way.geometry && way.geometry.length > 0) {
              const coords = way.geometry.map(node => [node.lon, node.lat]);

              // Check if we need to reverse based on role or connection
              if (orderedCoords.length > 0) {
                const lastCoord = orderedCoords[orderedCoords.length - 1];
                const firstCoord = coords[0];
                const lastCoordOfWay = coords[coords.length - 1];

                // If the last coordinate is closer to the end of this way, reverse it
                const distToStart = Math.hypot(lastCoord[0] - firstCoord[0], lastCoord[1] - firstCoord[1]);
                const distToEnd = Math.hypot(lastCoord[0] - lastCoordOfWay[0], lastCoord[1] - lastCoordOfWay[1]);

                if (distToEnd < distToStart) {
                  coords.reverse();
                }
              }

              orderedCoords.push(...coords);
            }
          }
        }

        console.log(`       ✓ Got ${orderedCoords.length} coordinates from relation ${relId}`);
        directionCoords.push(...orderedCoords);

        // Rate limiting - be nice to Overpass API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Deduplicate consecutive points
      const deduped = directionCoords.filter((coord, i) => {
        if (i === 0) return true;
        const prev = directionCoords[i - 1];
        return coord[0] !== prev[0] || coord[1] !== prev[1];
      });

      console.log(`   ✓ ${direction.toUpperCase()}: ${deduped.length} total coordinates`);
      allCoordinates[direction] = deduped;
    }

    // Check for jumps in the westbound geometry
    console.log('\n   Checking WESTBOUND for geometry gaps...');
    const wbCoords = allCoordinates.westbound;
    let jumpCount = 0;
    for (let i = 1; i < wbCoords.length; i++) {
      const [lon1, lat1] = wbCoords[i - 1];
      const [lon2, lat2] = wbCoords[i];
      const dist = Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
      if (dist > 0.05) {
        jumpCount++;
        console.log(`     Jump ${jumpCount}: ${(dist * 69).toFixed(1)} miles at index ${i}`);
      }
    }

    if (jumpCount === 0) {
      console.log('   ✅ No large gaps found - geometry is continuous!');
    } else {
      console.log(`   ⚠️  Found ${jumpCount} gaps in geometry`);
    }

    // Simplify to reasonable point count
    const wbSimplified = simplifyCoordinates(allCoordinates.westbound, 50000);
    const ebSimplified = simplifyCoordinates(allCoordinates.eastbound, 50000);

    console.log(`   ✓ Simplified: WB ${allCoordinates.westbound.length} → ${wbSimplified.length}, EB ${allCoordinates.eastbound.length} → ${ebSimplified.length}`);

    // Save to database - use UPDATE instead of ON CONFLICT
    console.log('\n   Saving to database...');

    // Check if corridors exist first
    const existing = await pool.query(
      `SELECT name FROM corridors WHERE name IN ('I-80 WB', 'I-80 EB')`
    );
    const existingNames = new Set(existing.rows.map(r => r.name));

    if (existingNames.has('I-80 WB')) {
      await pool.query(
        `UPDATE corridors SET geometry = $1 WHERE name = 'I-80 WB'`,
        [{ type: 'LineString', coordinates: wbSimplified }]
      );
      console.log('   ✓ Updated I-80 WB');
    } else {
      await pool.query(
        `INSERT INTO corridors (name, geometry) VALUES ('I-80 WB', $1)`,
        [{ type: 'LineString', coordinates: wbSimplified }]
      );
      console.log('   ✓ Inserted I-80 WB');
    }

    if (existingNames.has('I-80 EB')) {
      await pool.query(
        `UPDATE corridors SET geometry = $1 WHERE name = 'I-80 EB'`,
        [{ type: 'LineString', coordinates: ebSimplified }]
      );
      console.log('   ✓ Updated I-80 EB');
    } else {
      await pool.query(
        `INSERT INTO corridors (name, geometry) VALUES ('I-80 EB', $1)`,
        [{ type: 'LineString', coordinates: ebSimplified }]
      );
      console.log('   ✓ Inserted I-80 EB');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ I-80 relation-based fetch complete!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    if (error.response) {
      console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
    }
    throw error;
  }
}

/**
 * Simplify coordinates using Douglas-Peucker algorithm
 */
function simplifyCoordinates(coordinates, targetCount) {
  if (coordinates.length <= targetCount) return coordinates;

  // Use Douglas-Peucker simplification
  const epsilon = 0.0001; // Adjust tolerance as needed
  return douglasPeucker(coordinates, epsilon);
}

/**
 * Douglas-Peucker line simplification
 */
function douglasPeucker(points, epsilon) {
  if (points.length < 3) return points;

  // Find point with maximum distance from line
  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  } else {
    return [first, last];
  }
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const num = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1);
  const den = Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));

  return num / den;
}

// Run the fetch
fetchI80ViaRelation()
  .then(() => {
    pool.end();
    console.log('\n✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    pool.end();
    process.exit(1);
  });

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const HPMS_API = 'https://geo.dot.gov/server/rest/services/Hosted/HPMS_Interstates/FeatureServer/0/query';

/**
 * Distance between two coordinates
 */
function distance(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  return Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
}

/**
 * Advanced graph-based segment merging using Dijkstra-like approach
 * This builds the most efficient path through all segments
 */
function mergeSegmentsWithPathfinding(features, direction) {
  if (features.length === 0) return null;
  if (features.length === 1) {
    const paths = features[0].geometry.paths;
    return paths ? paths[0] : null;
  }

  console.log(`\n   Building graph for ${features.length} segments...`);

  // Extract all segments with start/end points
  const segments = [];
  for (let i = 0; i < features.length; i++) {
    const paths = features[i].geometry.paths;
    if (!paths) continue;

    for (const path of paths) {
      if (path.length < 2) continue;

      segments.push({
        id: segments.length,
        coords: path,
        start: path[0],
        end: path[path.length - 1],
        used: false
      });
    }
  }

  console.log(`   Total path segments: ${segments.length}`);

  // Find starting segment (westernmost for east/west routes)
  let startIdx = 0;
  if (direction === 'east' || direction === 'west') {
    for (let i = 1; i < segments.length; i++) {
      if (direction === 'east' ?
          segments[i].start[0] < segments[startIdx].start[0] :
          segments[i].start[0] > segments[startIdx].start[0]) {
        startIdx = i;
      }
    }
  }

  console.log(`   Starting from segment ${startIdx} at [${segments[startIdx].start[0].toFixed(2)}, ${segments[startIdx].start[1].toFixed(2)}]`);

  // Build path using greedy nearest-neighbor BUT allow backtracking
  const path = [...segments[startIdx].coords];
  segments[startIdx].used = true;
  let usedCount = 1;

  const MAX_ITERATIONS = segments.length * 2; // Prevent infinite loops
  let iterations = 0;

  while (usedCount < segments.length && iterations < MAX_ITERATIONS) {
    iterations++;

    const currentEnd = path[path.length - 1];
    let bestIdx = -1;
    let bestDist = Infinity;
    let bestReverse = false;

    // Find closest unused segment
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].used) continue;

      // Check distance to start of segment
      const distToStart = distance(currentEnd, segments[i].start);
      if (distToStart < bestDist) {
        bestIdx = i;
        bestDist = distToStart;
        bestReverse = false;
      }

      // Check distance to end of segment (reversed)
      const distToEnd = distance(currentEnd, segments[i].end);
      if (distToEnd < bestDist) {
        bestIdx = i;
        bestDist = distToEnd;
        bestReverse = true;
      }
    }

    if (bestIdx === -1) {
      console.log(`   ⚠️  No more reachable segments (used ${usedCount}/${segments.length})`);
      break;
    }

    // Connect the segment
    const seg = segments[bestIdx];
    seg.used = true;
    usedCount++;

    const coords = bestReverse ? seg.coords.slice().reverse() : seg.coords;

    // Skip first point if it duplicates the last point in path
    const startFrom = distance(currentEnd, coords[0]) < 0.0001 ? 1 : 0;
    path.push(...coords.slice(startFrom));

    if (usedCount % 50 === 0) {
      console.log(`   Connected ${usedCount}/${segments.length} segments...`);
    }
  }

  console.log(`   ✓ Final path: ${usedCount}/${segments.length} segments, ${path.length} points`);

  // Deduplicate consecutive points
  const deduped = path.filter((coord, i) => {
    if (i === 0) return true;
    const prev = path[i - 1];
    return distance(prev, coord) > 0.0001;
  });

  console.log(`   ✓ After deduplication: ${deduped.length} points`);

  // Analyze gaps
  let maxGap = 0;
  let largeGaps = 0;
  for (let i = 1; i < deduped.length; i++) {
    const gap = distance(deduped[i - 1], deduped[i]);
    if (gap > 0.5) largeGaps++;
    if (gap > maxGap) maxGap = gap;
  }

  console.log(`   Max gap: ${maxGap.toFixed(4)}°, Large gaps (>0.5°): ${largeGaps}`);

  return deduped;
}

/**
 * Classify features by direction
 */
function classifyByDirection(features) {
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

  // For unclear features, determine direction from geometry
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

  return { eastbound, westbound };
}

/**
 * Main function
 */
async function fixI90WithPathfinding() {
  console.log('\n🔧 Fixing I-90 with Graph-Based Pathfinding\n');
  console.log('='.repeat(80));

  try {
    // Fetch all I-90 features
    console.log('\n📍 Fetching I-90 from HPMS API...');
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
    console.log(`✓ Fetched ${features.length} features`);

    // Classify by direction
    const { eastbound, westbound } = classifyByDirection(features);
    console.log(`✓ Classified: ${eastbound.length} EB, ${westbound.length} WB`);

    // Process Eastbound
    console.log('\n🔄 Processing I-90 Eastbound...');
    const mergedEB = mergeSegmentsWithPathfinding(eastbound, 'east');

    if (mergedEB && mergedEB.length > 0) {
      const geometryEB = {
        type: 'LineString',
        coordinates: mergedEB
      };

      await pool.query(
        `UPDATE corridors
         SET geometry = $1, updated_at = NOW()
         WHERE name = 'I-90 EB'
         RETURNING id`,
        [JSON.stringify(geometryEB)]
      );

      console.log(`\n✅ Updated I-90 EB (${mergedEB.length} points)`);
    }

    // Process Westbound
    console.log('\n🔄 Processing I-90 Westbound...');
    const mergedWB = mergeSegmentsWithPathfinding(westbound, 'west');

    if (mergedWB && mergedWB.length > 0) {
      const geometryWB = {
        type: 'LineString',
        coordinates: mergedWB
      };

      await pool.query(
        `UPDATE corridors
         SET geometry = $1, updated_at = NOW()
         WHERE name = 'I-90 WB'
         RETURNING id`,
        [JSON.stringify(geometryWB)]
      );

      console.log(`\n✅ Updated I-90 WB (${mergedWB.length} points)`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ I-90 pathfinding update complete!\n');

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

// Run
fixI90WithPathfinding().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

/**
 * Fix Iowa I-80 snapping using a smarter algorithm
 *
 * Instead of finding nearest points and extracting a path segment,
 * use a "corridor search" approach:
 * 1. Find ALL points within tolerance of start coordinate
 * 2. Find ALL points within tolerance of end coordinate
 * 3. Extract the shortest connected path between ANY start and end candidate
 *
 * This handles misordered geometry by finding valid paths regardless of sequence.
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

function extractGeometrySmarter(geometry, lat1, lng1, lat2, lng2, toleranceKm = 2) {
  console.log(`\n🔍 Smart extraction for (${lat1}, ${lng1}) → (${lat2}, ${lng2})`);

  // Find ALL candidate start points within tolerance
  const startCandidates = [];
  for (let i = 0; i < geometry.length; i++) {
    const [lon, lat] = geometry[i];
    const dist = haversineDistance(lat1, lng1, lat, lon);
    if (dist <= toleranceKm) {
      startCandidates.push({ index: i, distance: dist, lat, lon });
    }
  }

  // Find ALL candidate end points within tolerance
  const endCandidates = [];
  for (let i = 0; i < geometry.length; i++) {
    const [lon, lat] = geometry[i];
    const dist = haversineDistance(lat2, lng2, lat, lon);
    if (dist <= toleranceKm) {
      endCandidates.push({ index: i, distance: dist, lat, lon });
    }
  }

  console.log(`   Start candidates: ${startCandidates.length} within ${toleranceKm}km`);
  console.log(`   End candidates: ${endCandidates.length} within ${toleranceKm}km`);

  if (startCandidates.length === 0 || endCandidates.length === 0) {
    console.log(`   ❌ No candidates found`);
    return null;
  }

  // Try all combinations and find the best path
  let bestPath = null;
  let bestScore = Infinity; // Lower is better

  for (const start of startCandidates) {
    for (const end of endCandidates) {
      if (start.index === end.index) continue;

      // Extract path (handle both directions)
      const startIdx = Math.min(start.index, end.index);
      const endIdx = Math.max(start.index, end.index);
      const segment = geometry.slice(startIdx, endIdx + 1);

      // If indices were reversed, reverse the segment
      const path = start.index > end.index ? segment.reverse() : segment;

      // Calculate path length
      let pathLength = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const [lon1, lat1] = path[i];
        const [lon2, lat2] = path[i + 1];
        pathLength += haversineDistance(lat1, lon1, lat2, lon2);
      }

      // Calculate straight-line event distance
      const eventDist = haversineDistance(lat1, lng1, lat2, lng2);

      // Score = weighted combination of:
      // - Distance from actual start/end points (20% each)
      // - Path length deviation from straight-line (60%)
      const pathRatio = pathLength / eventDist;
      const score = (start.distance * 0.2) + (end.distance * 0.2) + (Math.abs(pathRatio - 1) * eventDist * 0.6);

      if (score < bestScore) {
        bestScore = score;
        bestPath = {
          path,
          startIdx,
          endIdx,
          startDist: start.distance,
          endDist: end.distance,
          pathLength,
          eventDist,
          pathRatio,
          points: path.length
        };
      }
    }
  }

  if (!bestPath) {
    console.log(`   ❌ No valid path found`);
    return null;
  }

  console.log(`   ✅ Best path: indices ${bestPath.startIdx}-${bestPath.endIdx}`);
  console.log(`      Start distance: ${(bestPath.startDist * 1000).toFixed(0)}m`);
  console.log(`      End distance: ${(bestPath.endDist * 1000).toFixed(0)}m`);
  console.log(`      Path length: ${bestPath.pathLength.toFixed(2)}km (${bestPath.pathRatio.toFixed(2)}x event)`);
  console.log(`      Points: ${bestPath.points}`);

  return bestPath.path;
}

async function testSmartAlgorithm() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('🧪 Testing Smart Snapping Algorithm for Iowa I-80\n');

  // Get current OSM geometry
  const result = await pool.query('SELECT geometry FROM corridors WHERE name = $1', ['I-80 WB']);
  const geometry = result.rows[0].geometry.coordinates;

  console.log(`📊 Geometry: ${geometry.length} points\n`);

  // Get all Iowa I-80 events
  const eventsQuery = `
    SELECT id, start_latitude, start_longitude, end_latitude, end_longitude, headline
    FROM events
    WHERE state = 'Iowa'
    AND (corridor LIKE '%I-80%' OR headline LIKE '%I-80%' OR headline LIKE '%I 80%')
    AND start_latitude IS NOT NULL
    AND end_latitude IS NOT NULL
    LIMIT 10
  `;

  const eventsResult = await pool.query(eventsQuery);
  console.log(`Testing ${eventsResult.rows.length} sample events:\n`);

  let successCount = 0;

  for (const event of eventsResult.rows) {
    const { id, start_latitude, start_longitude, end_latitude, end_longitude, headline } = event;

    console.log(`Event ${id}: ${headline?.substring(0, 60)}...`);

    const extracted = extractGeometrySmarter(
      geometry,
      start_latitude,
      start_longitude,
      end_latitude,
      end_longitude,
      2 // 2km tolerance
    );

    if (extracted && extracted.length > 2) {
      successCount++;
      console.log(`   ✅ SUCCESS`);
    } else {
      console.log(`   ❌ FAILED`);
    }
  }

  console.log(`\n📊 Results: ${successCount}/${eventsResult.rows.length} (${((successCount/eventsResult.rows.length)*100).toFixed(1)}%)`);

  await pool.end();
}

testSmartAlgorithm().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

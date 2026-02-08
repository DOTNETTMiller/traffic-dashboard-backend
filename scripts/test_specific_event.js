/**
 * Test the specific event from the screenshot
 * Event: IO-IADOT-10092520214WB
 * Start: 41.591408, -93.809752
 * End: 41.578484, -93.835371
 * Distance: 1.60 miles (2.57 km)
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway";

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function extractSegment(geometry, lat1, lng1, lat2, lng2) {
  if (!geometry || geometry.length < 2) {
    return null;
  }

  const eventDistance = haversineDistance(lat1, lng1, lat2, lng2);

  // Step 1: Find closest point to event start
  let startIdx = 0;
  let minStartDist = Infinity;

  for (let i = 0; i < geometry.length; i++) {
    const [lon, lat] = geometry[i];
    const startDist = haversineDistance(lat1, lng1, lat, lon);
    if (startDist < minStartDist) {
      minStartDist = startDist;
      startIdx = i;
    }
  }

  // Step 2: Search forward from startIdx to find end point
  // Limit search window to 3x event distance
  const maxSearchDistance = eventDistance * 3;
  let endIdx = startIdx;
  let minEndDist = Infinity;
  let searchedDistance = 0;

  console.log(`\n🔍 Searching forward from index ${startIdx}...`);

  for (let i = startIdx; i < geometry.length - 1 && searchedDistance < maxSearchDistance; i++) {
    const [lon, lat] = geometry[i];

    const endDist = haversineDistance(lat2, lng2, lat, lon);
    if (endDist < minEndDist) {
      minEndDist = endDist;
      endIdx = i;
    }

    if (i < geometry.length - 1) {
      const [lon1, lat1] = geometry[i];
      const [lon2, lat2] = geometry[i + 1];
      searchedDistance += haversineDistance(lat1, lon1, lat2, lon2);
    }
  }

  console.log(`   Searched ${searchedDistance.toFixed(2)} km forward, best end match at index ${endIdx} (${minEndDist.toFixed(3)} km away)`);

  // If we didn't find a good match going forward, try searching backward
  if (minEndDist > 5 || endIdx === startIdx) {
    console.log(`   🔍 Searching backward from index ${startIdx}...`);
    searchedDistance = 0;
    for (let i = startIdx; i > 0 && searchedDistance < maxSearchDistance; i--) {
      const [lon, lat] = geometry[i];

      const endDist = haversineDistance(lat2, lng2, lat, lon);
      if (endDist < minEndDist) {
        minEndDist = endDist;
        endIdx = i;
      }

      if (i > 0) {
        const [lon1, lat1] = geometry[i];
        const [lon2, lat2] = geometry[i - 1];
        searchedDistance += haversineDistance(lat1, lon1, lat2, lon2);
      }
    }
    console.log(`   Searched ${searchedDistance.toFixed(2)} km backward, best end match at index ${endIdx} (${minEndDist.toFixed(3)} km away)`);
  }

  // Ensure start comes before end
  if (startIdx > endIdx) {
    [startIdx, endIdx] = [endIdx, startIdx];
  }

  // Extract segment
  const segment = geometry.slice(startIdx, endIdx + 1);

  // Calculate segment path length
  let segmentPathLength = 0;
  for (let i = 0; i < segment.length - 1; i++) {
    const [lon1, lat1] = segment[i];
    const [lon2, lat2] = segment[i + 1];
    segmentPathLength += haversineDistance(lat1, lon1, lat2, lon2);
  }

  console.log(`\n📍 Segment Analysis:`);
  console.log(`   Start point distance from highway: ${minStartDist.toFixed(3)} km`);
  console.log(`   End point distance from highway: ${minEndDist.toFixed(3)} km`);
  console.log(`   Event straight-line distance: ${eventDistance.toFixed(3)} km (${(eventDistance * 0.621371).toFixed(2)} miles)`);
  console.log(`   Segment path length: ${segmentPathLength.toFixed(3)} km (${(segmentPathLength * 0.621371).toFixed(2)} miles)`);
  console.log(`   Segment points: ${segment.length}`);
  console.log(`   Path/Event ratio: ${(segmentPathLength / eventDistance).toFixed(2)}x`);

  // Validation 1: Endpoints must be reasonably close to highway
  const is2PointEvent = eventDistance > 0.5;
  const maxDistanceThreshold = is2PointEvent ? 15 : 5;

  if (minStartDist > maxDistanceThreshold || minEndDist > maxDistanceThreshold) {
    console.log(`   ❌ REJECTED: Endpoints too far from highway (threshold: ${maxDistanceThreshold} km)`);
    return null;
  }

  // Validation 3: Segment path length should be reasonable
  const maxPathMultiplier = eventDistance < 5 ? 2.5 : 1.5;
  const maxReasonablePathLength = eventDistance * maxPathMultiplier;

  if (segmentPathLength > maxReasonablePathLength && eventDistance > 1) {
    console.log(`   ❌ REJECTED: Path too long (max: ${maxReasonablePathLength.toFixed(2)} km = ${maxPathMultiplier}x event distance)`);
    return null;
  }

  console.log(`   ✅ PASSED: Segment is valid`);
  return segment;
}

async function main() {
  console.log('🧪 Testing Event: IO-IADOT-10092520214WB\n');

  const lat1 = 41.591408;
  const lng1 = -93.809752;
  const lat2 = 41.578484;
  const lng2 = -93.835371;

  console.log('📍 Event Coordinates:');
  console.log(`   Start: ${lat1}, ${lng1}`);
  console.log(`   End: ${lat2}, ${lng2}`);

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Get I-80 WB geometry
    const result = await pool.query(
      "SELECT geometry FROM corridors WHERE name = $1",
      ['I-80 WB']
    );

    if (result.rows.length === 0) {
      console.log('\n❌ I-80 WB geometry not found in database');
      return;
    }

    const geometry = result.rows[0].geometry.coordinates;
    console.log(`\n✅ I-80 WB geometry: ${geometry.length} points`);

    // Test extraction
    const segment = extractSegment(geometry, lat1, lng1, lat2, lng2);

    if (segment) {
      console.log(`\n✅ SUCCESS: Event should snap to Interstate geometry`);
      console.log(`   Would display ${segment.length} points`);
    } else {
      console.log(`\n❌ FAILURE: Event will fall back to straight line`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main();

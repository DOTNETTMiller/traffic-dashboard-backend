/**
 * Sort I-80 geometry into proper sequential order
 *
 * Problem: OSM Overpass API returns I-80 geometry with points jumbled
 * - Geometry has 874km jumps between consecutive points
 * - Points jump from Iowa to Wyoming and back
 *
 * Solution: Use nearest-neighbor algorithm to sort points into a continuous path
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

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

function sortGeometryByProximity(geometry) {
  console.log('🔄 Sorting geometry using nearest-neighbor algorithm...\n');

  if (geometry.length === 0) return [];

  const sorted = [];
  const remaining = [...geometry];

  // Start with first point
  sorted.push(remaining.shift());

  let progressInterval = Math.floor(geometry.length / 20); // Report every 5%

  while (remaining.length > 0) {
    const lastPoint = sorted[sorted.length - 1];
    const [lastLon, lastLat] = lastPoint;

    // Find closest remaining point
    let closestIdx = 0;
    let closestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const [lon, lat] = remaining[i];
      const dist = haversineDistance(lastLat, lastLon, lat, lon);

      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    // Add closest point to sorted array
    sorted.push(remaining[closestIdx]);
    remaining.splice(closestIdx, 1);

    // Progress report
    if (sorted.length % progressInterval === 0) {
      const progress = ((sorted.length / geometry.length) * 100).toFixed(0);
      console.log(`   ${progress}% complete (${sorted.length}/${geometry.length} points)`);
    }
  }

  console.log('   ✅ 100% complete\n');
  return sorted;
}

async function main() {
  console.log('🛣️  Sorting I-80 Geometry into Sequential Order\n');

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Get current WB geometry
    const wbResult = await pool.query('SELECT geometry FROM corridors WHERE name = $1', ['I-80 WB']);

    if (wbResult.rows.length === 0) {
      console.log('❌ I-80 WB geometry not found');
      return;
    }

    const geometry = wbResult.rows[0].geometry.coordinates;
    console.log('📊 Original Geometry:');
    console.log('   Points:', geometry.length);

    // Check for large jumps in original
    let largeJumps = 0;
    for (let i = 0; i < Math.min(geometry.length - 1, 1000); i++) {
      const [lon1, lat1] = geometry[i];
      const [lon2, lat2] = geometry[i + 1];
      const dist = haversineDistance(lat1, lon1, lat2, lon2);
      if (dist > 50) largeJumps++;
    }
    console.log('   Large jumps (>50km) in first 1000 points:', largeJumps);
    console.log('');

    // Sort the geometry
    const sortedGeometry = sortGeometryByProximity(geometry);

    // Check for large jumps in sorted
    console.log('📊 Sorted Geometry:');
    console.log('   Points:', sortedGeometry.length);

    let sortedJumps = 0;
    let maxJump = 0;
    for (let i = 0; i < Math.min(sortedGeometry.length - 1, 1000); i++) {
      const [lon1, lat1] = sortedGeometry[i];
      const [lon2, lat2] = sortedGeometry[i + 1];
      const dist = haversineDistance(lat1, lon1, lat2, lon2);
      if (dist > 50) sortedJumps++;
      if (dist > maxJump) maxJump = dist;
    }
    console.log('   Large jumps (>50km) in first 1000 points:', sortedJumps);
    console.log('   Max jump in first 1000 points:', maxJump.toFixed(2), 'km');
    console.log('');

    // Calculate total path length
    let totalLength = 0;
    for (let i = 0; i < sortedGeometry.length - 1; i++) {
      const [lon1, lat1] = sortedGeometry[i];
      const [lon2, lat2] = sortedGeometry[i + 1];
      totalLength += haversineDistance(lat1, lon1, lat2, lon2);
    }
    console.log('   Total path length:', totalLength.toFixed(2), 'km (', (totalLength * 0.621371).toFixed(2), 'mi)');
    console.log('');

    // Update database
    console.log('💾 Updating database...\n');

    const sortedGeoJSON = {
      type: 'LineString',
      coordinates: sortedGeometry
    };

    await pool.query(
      'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
      [sortedGeoJSON, 'I-80 WB']
    );
    console.log('   ✅ Updated I-80 WB');

    // Update EB (reversed)
    const reversedGeometry = {
      type: 'LineString',
      coordinates: [...sortedGeometry].reverse()
    };

    await pool.query(
      'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
      [reversedGeometry, 'I-80 EB']
    );
    console.log('   ✅ Updated I-80 EB (reversed)');

    console.log('\n✅ Success! I-80 geometry is now in sequential order');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart Railway backend service');
    console.log('   2. Events should now snap correctly with simple algorithm');
    console.log('   3. Can remove complex windowed search logic');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main();

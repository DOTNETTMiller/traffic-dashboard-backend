// Diagnose why 2-point events don't snap to Interstate geometry
const { Pool } = require('pg');
const axios = require('axios');

const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:FE11Bg4EgEfdD4E46CD3c2CdAF1E5DDC@tramway.proxy.rlwy.net:14217/railway";
const API_URL = "https://corridor-communication-dashboard-production.up.railway.app/api/events?state=Iowa";

// Haversine distance formula (in kilometers)
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // 1. Fetch a 2-point event from the API
    console.log('📡 Fetching Iowa I-80 events from API...\n');
    const response = await axios.get(API_URL);
    const events = response.data.events || response.data;
    const twoPointEvents = events.filter(e =>
      e.corridor &&
      e.corridor.includes('I-80') &&
      e.geometry?.coordinates?.length === 2
    );

    console.log(`Found ${twoPointEvents.length} two-point I-80 events\n`);

    if (twoPointEvents.length === 0) {
      console.log('✅ No 2-point events found! Problem may be solved.');
      return;
    }

    // Pick the first one
    const event = twoPointEvents[0];
    console.log('🔍 Analyzing event:', event.id);
    console.log('   Corridor:', event.corridor);
    console.log('   Direction:', event.direction);
    console.log('   Coordinates:', event.geometry.coordinates);
    console.log('   Geometry Source:', event.geometry.geometrySource);
    console.log();

    // Extract coordinates
    const [lng1, lat1] = event.geometry.coordinates[0];
    const [lng2, lat2] = event.geometry.coordinates[1];

    console.log(`   Start point: ${lat1}, ${lng1}`);
    console.log(`   End point: ${lat2}, ${lng2}`);
    console.log();

    // 2. Check if I-80 WB/EB geometry exists in database
    const dirAbbrev = event.direction?.toLowerCase().includes('west') ? 'WB' :
                      event.direction?.toLowerCase().includes('east') ? 'EB' :
                      event.direction?.toLowerCase().includes('north') ? 'NB' :
                      event.direction?.toLowerCase().includes('south') ? 'SB' : null;

    if (!dirAbbrev) {
      console.log('❌ Could not determine direction abbreviation from:', event.direction);
      return;
    }

    const corridorName = `${event.corridor} ${dirAbbrev}`;
    console.log(`🔍 Looking for corridor: "${corridorName}"\n`);

    const corridorResult = await pool.query(
      `SELECT name, jsonb_array_length(geometry->'coordinates') as coord_count
       FROM corridors
       WHERE name = $1`,
      [corridorName]
    );

    if (corridorResult.rows.length === 0) {
      console.log(`❌ PROBLEM: Corridor "${corridorName}" not found in database!`);
      console.log('   This is why events fall back to straight lines.\n');

      // Check what corridors DO exist
      const allCorridors = await pool.query(
        `SELECT name FROM corridors WHERE name LIKE 'I-80%' ORDER BY name`
      );
      console.log('   Available I-80 corridors:');
      allCorridors.rows.forEach(row => console.log(`   - ${row.name}`));
      return;
    }

    const corridor = corridorResult.rows[0];
    console.log(`✅ Found corridor: "${corridor.name}"`);
    console.log(`   Coordinates: ${corridor.coord_count} points\n`);

    // 3. Fetch the geometry and test extractSegment logic
    const geomResult = await pool.query(
      `SELECT geometry FROM corridors WHERE name = $1`,
      [corridorName]
    );

    const fullGeometry = geomResult.rows[0].geometry;
    const coordinates = fullGeometry.coordinates;

    console.log(`🔍 Testing geometry extraction:\n`);

    // Find closest points to start and end
    let startIdx = 0;
    let endIdx = coordinates.length - 1;
    let minStartDist = Infinity;
    let minEndDist = Infinity;

    for (let i = 0; i < coordinates.length; i++) {
      const [lon, lat] = coordinates[i];

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

    console.log(`   Closest start point: index ${startIdx}, distance ${minStartDist.toFixed(2)}km`);
    console.log(`   Closest end point: index ${endIdx}, distance ${minEndDist.toFixed(2)}km`);
    console.log();

    // Check validation 1: 5km threshold
    if (minStartDist > 5 || minEndDist > 5) {
      console.log(`❌ VALIDATION 1 FAILED: Endpoints too far from highway`);
      console.log(`   Start distance: ${minStartDist.toFixed(2)}km (max 5km)`);
      console.log(`   End distance: ${minEndDist.toFixed(2)}km (max 5km)`);
      console.log(`   This is why the event uses straight line geometry!\n`);

      console.log(`💡 SOLUTION: Increase the distance threshold in extractSegment() from 5km to ${Math.max(minStartDist, minEndDist).toFixed(0)}km`);
      return;
    }

    console.log(`✅ VALIDATION 1 PASSED: Both endpoints within 5km`);

    // Ensure start comes before end
    if (startIdx > endIdx) {
      [startIdx, endIdx] = [endIdx, startIdx];
      console.log(`   Swapped indices: ${startIdx} -> ${endIdx}`);
    }

    // Extract segment
    const segment = coordinates.slice(startIdx, endIdx + 1);
    console.log(`   Extracted segment: ${segment.length} points\n`);

    // Calculate event distance
    const eventDistance = haversineDistance(lat1, lng1, lat2, lng2);
    console.log(`   Event distance (straight line): ${eventDistance.toFixed(2)}km`);

    // Calculate segment path length
    let segmentPathLength = 0;
    for (let i = 0; i < segment.length - 1; i++) {
      const [lon1, lat1_seg] = segment[i];
      const [lon2, lat2_seg] = segment[i + 1];
      segmentPathLength += haversineDistance(lat1_seg, lon1, lat2_seg, lon2);
    }
    console.log(`   Segment path length (along highway): ${segmentPathLength.toFixed(2)}km\n`);

    // Check validation 4 (currently disabled)
    const maxAllowedLength = Math.max(eventDistance * 5, 50);
    if (segmentPathLength > maxAllowedLength) {
      console.log(`⚠️  VALIDATION 4 (DISABLED): Segment too long`);
      console.log(`   Segment length: ${segmentPathLength.toFixed(2)}km`);
      console.log(`   Max allowed: ${maxAllowedLength.toFixed(2)}km (event * 5 or 50km)`);
      console.log(`   This validation is currently disabled, so it should NOT cause failure.\n`);
    } else {
      console.log(`✅ VALIDATION 4: Segment length acceptable`);
    }

    // Check validation 5 (currently disabled)
    const percentageOfHighway = (segment.length / coordinates.length) * 100;
    if (segment.length > coordinates.length * 0.3) {
      console.log(`⚠️  VALIDATION 5 (DISABLED): Segment uses too much of highway`);
      console.log(`   Segment points: ${segment.length}`);
      console.log(`   Total highway points: ${coordinates.length}`);
      console.log(`   Percentage: ${percentageOfHighway.toFixed(1)}% (max 30%)`);
      console.log(`   This validation is currently disabled, so it should NOT cause failure.\n`);
    } else {
      console.log(`✅ VALIDATION 5: Segment uses ${percentageOfHighway.toFixed(1)}% of highway (under 30%)`);
    }

    // Final check
    if (segment.length >= 2) {
      console.log(`\n✅ Segment should be returned: ${segment.length} points`);
      console.log(`\n❓ WHY IS THIS EVENT STILL SHOWING 2 POINTS?`);
      console.log(`   Check backend logs for snapToRoad calls for event: ${event.id}`);
    } else {
      console.log(`\n❌ Segment would be rejected: only ${segment.length} points`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  } finally {
    await pool.end();
  }
}

main();

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  try {
    console.log('Manual test of I-80 Iowa Segment geometry lookup\n');
    console.log('=================================================\n');

    // Actual coordinates from Iowa I-80 event
    const lat1 = 41.65917;
    const lng1 = -93.52709;
    const lat2 = 41.653878;
    const lng2 = -93.563052;

    console.log('Event coordinates:');
    console.log(`  Start: ${lat1}, ${lng1}`);
    console.log(`  End:   ${lat2}, ${lng2}`);
    console.log('');

    // Query for I-80 Iowa Segment
    const result = await pool.query(
      `SELECT name, geometry FROM corridors WHERE name = $1 LIMIT 1`,
      ['I-80 Iowa Segment']
    );

    if (result.rows.length === 0) {
      console.log('❌ "I-80 Iowa Segment" NOT FOUND in database');
      await pool.end();
      return;
    }

    console.log(`✅ Found corridor: ${result.rows[0].name}`);

    const geometry = result.rows[0].geometry;

    if (!geometry || !geometry.coordinates) {
      console.log('❌ No geometry.coordinates found');
      await pool.end();
      return;
    }

    const coords = geometry.coordinates;
    console.log(`   Total points: ${coords.length}`);
    console.log('');

    // Inspect first 10 and last 10 coordinates
    console.log('First 10 coordinates:');
    for (let i = 0; i < Math.min(10, coords.length); i++) {
      const [lng, lat] = coords[i];
      console.log(`  ${i}: [${lng}, ${lat}]`);
    }
    console.log('');

    if (coords.length > 20) {
      console.log(`Last 10 coordinates:`);
      for (let i = Math.max(0, coords.length - 10); i < coords.length; i++) {
        const [lng, lat] = coords[i];
        console.log(`  ${i}: [${lng}, ${lat}]`);
      }
      console.log('');
    }

    // Check if coordinates are in Iowa bounds
    // Iowa approximate bounds: lat 40.4-43.5, lng -96.6 to -90.1
    console.log('Checking if coordinates are in Iowa bounds...');
    let inBounds = 0;
    let outOfBounds = 0;
    let outOfBoundsExamples = [];

    for (let i = 0; i < coords.length; i++) {
      const [lng, lat] = coords[i];
      if (lat >= 40.4 && lat <= 43.5 && lng >= -96.6 && lng <= -90.1) {
        inBounds++;
      } else {
        outOfBounds++;
        if (outOfBoundsExamples.length < 5) {
          outOfBoundsExamples.push({ index: i, lng, lat });
        }
      }
    }

    console.log(`  In bounds: ${inBounds}/${coords.length}`);
    console.log(`  Out of bounds: ${outOfBounds}/${coords.length}`);

    if (outOfBounds > 0) {
      console.log('\n  ⚠️  Out-of-bounds examples:');
      outOfBoundsExamples.forEach(({ index, lng, lat }) => {
        console.log(`    Point ${index}: [${lng}, ${lat}]`);
      });
    }
    console.log('');

    // Check if coordinates are sequential (look for jumps)
    console.log('Checking for non-sequential jumps (>0.5 degrees)...');
    let largeJumps = [];

    for (let i = 1; i < coords.length; i++) {
      const [lng1, lat1] = coords[i - 1];
      const [lng2, lat2] = coords[i];
      const dist = Math.sqrt(Math.pow(lng2 - lng1, 2) + Math.pow(lat2 - lat1, 2));

      if (dist > 0.5) {
        if (largeJumps.length < 10) {
          largeJumps.push({
            from: i - 1,
            to: i,
            dist: dist.toFixed(4),
            fromCoord: [lng1, lat1],
            toCoord: [lng2, lat2]
          });
        }
      }
    }

    if (largeJumps.length > 0) {
      console.log(`  ⚠️  Found ${largeJumps.length} large jumps:`);
      largeJumps.forEach(({ from, to, dist, fromCoord, toCoord }) => {
        console.log(`    Point ${from} → ${to}: distance ${dist}°`);
        console.log(`      From: [${fromCoord[0]}, ${fromCoord[1]}]`);
        console.log(`      To:   [${toCoord[0]}, ${toCoord[1]}]`);
      });
      console.log('\n  ❌ GEOMETRY APPEARS SCRAMBLED/OUT-OF-ORDER');
    } else {
      console.log('  ✅ No large jumps detected - coordinates appear sequential');
    }
    console.log('');

    // Now test if event coordinates would find a match
    console.log('Testing if event coordinates would find a match...');
    console.log(`Looking for closest points to start: [${lng1}, ${lat1}]`);

    let closestStartIdx = -1;
    let closestStartDist = Infinity;

    for (let i = 0; i < coords.length; i++) {
      const [lng, lat] = coords[i];
      const dist = Math.sqrt(Math.pow(lng - lng1, 2) + Math.pow(lat - lat1, 2));
      if (dist < closestStartDist) {
        closestStartDist = dist;
        closestStartIdx = i;
      }
    }

    if (closestStartIdx !== -1) {
      const [closestLng, closestLat] = coords[closestStartIdx];
      console.log(`  Closest point: index ${closestStartIdx}`);
      console.log(`    Coordinates: [${closestLng}, ${closestLat}]`);
      console.log(`    Distance: ${closestStartDist.toFixed(6)}° (~${(closestStartDist * 69).toFixed(2)} miles)`);

      if (closestStartDist > 0.1) {
        console.log('    ⚠️  Distance is quite large - event location may not match Interstate geometry');
      }
    }

    await pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();

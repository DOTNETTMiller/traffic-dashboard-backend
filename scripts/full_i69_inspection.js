const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fullI69Inspection() {
  try {
    const result = await pool.query(`
      SELECT geometry->'coordinates' as coords
      FROM corridors
      WHERE name = 'I-69 SB'
    `);

    const coords = result.rows[0].coords;
    console.log(`\n🔍 Full I-69 SB Geometry Analysis`);
    console.log(`Total points: ${coords.length}`);
    console.log('='.repeat(80));

    // Check ALL consecutive point distances
    let largeJumps = [];
    let maxDist = 0;
    let avgDist = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const dist = Math.sqrt(
        Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2)
      );

      avgDist += dist;
      if (dist > maxDist) maxDist = dist;

      // Flag jumps > 0.1 degrees (~7 miles)
      if (dist > 0.1) {
        largeJumps.push({
          from: i,
          to: i + 1,
          dist: dist,
          p1: p1,
          p2: p2
        });
      }
    }

    avgDist = avgDist / (coords.length - 1);

    console.log(`\nDistance statistics:`);
    console.log(`  Average: ${avgDist.toFixed(6)} degrees (~${(avgDist * 69).toFixed(2)} miles)`);
    console.log(`  Maximum: ${maxDist.toFixed(6)} degrees (~${(maxDist * 69).toFixed(2)} miles)`);
    console.log(`\nLarge jumps found (>0.1 degrees / ~7 miles): ${largeJumps.length}`);

    if (largeJumps.length > 0) {
      console.log('\n⚠️  PROBLEMATIC JUMPS:');
      largeJumps.forEach((jump, idx) => {
        console.log(`\n  ${idx + 1}. Points [${jump.from}] → [${jump.to}]: ${jump.dist.toFixed(4)}° (~${(jump.dist * 69).toFixed(1)} mi)`);
        console.log(`     From: [${jump.p1[0].toFixed(6)}, ${jump.p1[1].toFixed(6)}]`);
        console.log(`     To:   [${jump.p2[0].toFixed(6)}, ${jump.p2[1].toFixed(6)}]`);
      });
    }

    // Also check if coordinates are monotonically changing in expected direction
    console.log(`\n📍 Endpoint check:`);
    console.log(`  Start: [${coords[0][0].toFixed(6)}, ${coords[0][1].toFixed(6)}]`);
    console.log(`  End:   [${coords[coords.length-1][0].toFixed(6)}, ${coords[coords.length-1][1].toFixed(6)}]`);
    console.log(`  Change: Δlng=${(coords[coords.length-1][0] - coords[0][0]).toFixed(4)}, Δlat=${(coords[coords.length-1][1] - coords[0][1]).toFixed(4)}`);

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fullI69Inspection();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkAllGeometries() {
  try {
    // Get all full-resolution directional corridors
    const result = await pool.query(`
      SELECT
        id,
        name,
        geometry->'coordinates' as coords
      FROM corridors
      WHERE geometry IS NOT NULL
        AND jsonb_array_length(geometry->'coordinates') > 5000
        AND name ~ '(EB|WB|NB|SB)$'
      ORDER BY name
    `);

    console.log(`\n🔍 Checking ${result.rows.length} full-resolution corridors for geometry corruption\n`);
    console.log('='.repeat(80));

    const corrupted = [];

    for (const row of result.rows) {
      const coords = row.coords;
      const totalPoints = coords.length;

      let largeJumps = 0;
      let maxDist = 0;

      // Check for jumps > 0.1 degrees (~7 miles)
      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const dist = Math.sqrt(
          Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2)
        );

        if (dist > maxDist) maxDist = dist;
        if (dist > 0.1) largeJumps++;
      }

      const jumpPct = (largeJumps / totalPoints * 100).toFixed(1);
      const status = largeJumps > 10 ? '❌ CORRUPTED' : '✅ OK';

      console.log(`${status} ${row.name.padEnd(25)} ${String(totalPoints).padStart(6)} pts, ${String(largeJumps).padStart(4)} jumps (${jumpPct}%), max: ${(maxDist * 69).toFixed(0)} mi`);

      if (largeJumps > 10) {
        corrupted.push({
          name: row.name,
          id: row.id,
          points: totalPoints,
          jumps: largeJumps,
          maxDist: (maxDist * 69).toFixed(0)
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`  Total corridors checked: ${result.rows.length}`);
    console.log(`  Corrupted geometries: ${corrupted.length}`);

    if (corrupted.length > 0) {
      console.log(`\n⚠️  CORRUPTED CORRIDORS (need to be re-fetched):`);
      corrupted.forEach((c, idx) => {
        console.log(`  ${idx + 1}. ${c.name}: ${c.jumps} bad jumps, max distance ${c.maxDist} mi`);
      });
    }

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkAllGeometries();

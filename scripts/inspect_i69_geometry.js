const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspectI69() {
  try {
    const result = await pool.query(`
      SELECT
        name,
        jsonb_array_length(geometry->'coordinates') as point_count,
        geometry->'coordinates'->0 as first_point,
        geometry->'coordinates'->1 as second_point,
        geometry->'coordinates'->2 as third_point,
        geometry->'coordinates'->10 as tenth_point,
        geometry->'coordinates'->100 as hundredth_point,
        geometry->'coordinates'->-3 as third_last,
        geometry->'coordinates'->-2 as second_last,
        geometry->'coordinates'->-1 as last_point
      FROM corridors
      WHERE name = 'I-69 SB'
    `);

    console.log('\n🔍 I-69 SB Geometry Inspection:\n');
    console.log('='.repeat(80));

    const row = result.rows[0];
    console.log(`Total points: ${row.point_count}`);
    console.log(`\nFirst few points:`);
    console.log(`  [0]: ${JSON.stringify(row.first_point)}`);
    console.log(`  [1]: ${JSON.stringify(row.second_point)}`);
    console.log(`  [2]: ${JSON.stringify(row.third_point)}`);
    console.log(`  [10]: ${JSON.stringify(row.tenth_point)}`);
    console.log(`  [100]: ${JSON.stringify(row.hundredth_point)}`);

    console.log(`\nLast few points:`);
    console.log(`  [-3]: ${JSON.stringify(row.third_last)}`);
    console.log(`  [-2]: ${JSON.stringify(row.second_last)}`);
    console.log(`  [-1]: ${JSON.stringify(row.last_point)}`);

    // Check for distance between consecutive points
    const geom = await pool.query(`
      SELECT geometry->'coordinates' as coords
      FROM corridors
      WHERE name = 'I-69 SB'
    `);

    const coords = geom.rows[0].coords;

    console.log('\n📏 Distance checks (looking for big jumps):');
    for (let i = 0; i < Math.min(20, coords.length - 1); i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const dist = Math.sqrt(
        Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2)
      );
      if (dist > 1) { // More than ~70 miles jump
        console.log(`  Point ${i} to ${i+1}: HUGE JUMP ${dist.toFixed(4)} degrees (~${(dist * 69).toFixed(0)} miles)`);
        console.log(`    ${JSON.stringify(p1)} -> ${JSON.stringify(p2)}`);
      }
    }

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

inspectI69();

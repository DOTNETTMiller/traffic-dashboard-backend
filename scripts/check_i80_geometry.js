const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkGeometry() {
  try {
    const result = await pool.query(`
      SELECT
        name,
        jsonb_array_length(geometry->'coordinates') as point_count,
        geometry->'coordinates'->0 as first_point,
        geometry->'coordinates'->1 as second_point,
        geometry->'coordinates'->-1 as last_point
      FROM corridors
      WHERE name LIKE 'I-80%'
      ORDER BY name
    `);

    console.log('\n📊 I-80 Corridor Geometry Check:\n');
    result.rows.forEach(row => {
      console.log(`${row.name}:`);
      console.log(`  Points: ${row.point_count}`);
      console.log(`  First: ${JSON.stringify(row.first_point)}`);
      console.log(`  Second: ${JSON.stringify(row.second_point)}`);
      console.log(`  Last: ${JSON.stringify(row.last_point)}`);
      console.log('');
    });

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkGeometry();

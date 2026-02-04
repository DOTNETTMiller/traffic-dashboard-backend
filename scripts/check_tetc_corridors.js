const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTETCCorridors() {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        CASE
          WHEN geometry IS NULL THEN 'NULL'
          WHEN geometry->>'type' IS NULL THEN 'INVALID JSON'
          ELSE geometry->>'type'
        END as geom_type,
        CASE
          WHEN geometry->'coordinates' IS NULL THEN 0
          ELSE jsonb_array_length(geometry->'coordinates')
        END as point_count,
        geometry->'coordinates'->0 as first_point,
        geometry->'coordinates'->-1 as last_point,
        bounds
      FROM corridors
      ORDER BY name
      LIMIT 50
    `);

    console.log('\n📊 Corridor Geometry Check:\n');
    console.log('Total corridors:', result.rows.length);
    console.log('='.repeat(80));

    result.rows.forEach(row => {
      console.log(`\n${row.name}`);
      if (row.description) console.log(`  Description: ${row.description}`);
      console.log(`  Geometry Type: ${row.geom_type}`);
      console.log(`  Points: ${row.point_count}`);
      if (row.first_point) {
        console.log(`  First: ${JSON.stringify(row.first_point)}`);
        console.log(`  Last: ${JSON.stringify(row.last_point)}`);
      }
      if (row.bounds) {
        console.log(`  Bounds: ${JSON.stringify(row.bounds)}`);
      }
    });

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkTETCCorridors();

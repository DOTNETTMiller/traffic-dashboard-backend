const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    console.log('Checking I-80 corridors in database...\n');

    const result = await pool.query(`
      SELECT name, jsonb_array_length(geometry->'coordinates') as points
      FROM corridors
      WHERE name LIKE '%I-80%' OR name LIKE '%I 80%'
      ORDER BY name
    `);

    console.log(`Found ${result.rows.length} I-80 corridors:\n`);
    for (const row of result.rows) {
      console.log(`  ${row.name}: ${row.points} points`);
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

check();

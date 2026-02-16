/**
 * Test Database Connection
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

async function testConnection() {
  console.log('Testing database connection...');

  try {
    const result = await pool.query('SELECT NOW() as current_time, current_database() as database');
    console.log('SUCCESS: Connected to database');
    console.log('  Database:', result.rows[0].database);

    const tableCheck = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'corridors') as table_exists");

    if (tableCheck.rows[0].table_exists) {
      console.log('SUCCESS: corridors table exists');

      const dataCheck = await pool.query("SELECT name, CASE WHEN geometry IS NOT NULL THEN jsonb_array_length(geometry->'coordinates') ELSE 0 END as point_count FROM corridors WHERE name LIKE 'I-80%' OR name LIKE 'I-35%' ORDER BY name");

      if (dataCheck.rows.length > 0) {
        console.log('\nExisting Interstate data:');
        dataCheck.rows.forEach(row => {
          console.log('  ' + row.name + ': ' + row.point_count + ' points');
        });
      } else {
        console.log('\nNo existing I-80 or I-35 data found');
      }

    } else {
      console.error('ERROR: corridors table does not exist');
      process.exit(1);
    }

    console.log('\nREADY: You can now run build_interstate_polylines.js');

  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();

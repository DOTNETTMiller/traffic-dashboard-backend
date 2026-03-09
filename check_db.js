const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
  try {
    console.log('\n📊 Checking database schema...\n');

    // Check tables
    const tables = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log('Existing tables (' + tables.rows.length + '):');
    tables.rows.forEach(row => console.log('  - ' + row.tablename));

    // Check if PostGIS is installed
    const postgis = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'postgis'
      ) as installed
    `);

    console.log('\nPostGIS installed:', postgis.rows[0].installed);

    // Check if pg_cron is installed
    const pgcron = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
      ) as installed
    `);

    console.log('pg_cron installed:', pgcron.rows[0].installed);

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

checkDatabase();

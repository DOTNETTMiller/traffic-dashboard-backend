/**
 * Manually add New Jersey and Oklahoma feeds to production database
 * This bypasses the git authentication issues
 */

const { Pool } = require('pg');

async function addFeeds() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('Adding New Jersey and Oklahoma to production database...\n');

  try {
    // Check if states table exists (old schema)
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'states'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ States table does not exist - production needs new code deployed');
      process.exit(1);
    }

    // Add New Jersey (if not exists)
    const njCheck = await pool.query("SELECT * FROM states WHERE state_key = 'NJ'");
    if (njCheck.rows.length === 0) {
      await pool.query(`
        INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled)
        VALUES ('NJ', 'New Jersey DOT', 'https://511nj.org/feeds/wzdx', 'WZDx', 'geojson', true)
      `);
      console.log('✅ Added New Jersey to production');
    } else {
      console.log('✓ New Jersey already exists');
    }

    // Add Oklahoma (if not exists)
    const okCheck = await pool.query("SELECT * FROM states WHERE state_key = 'OK'");
    if (okCheck.rows.length === 0) {
      await pool.query(`
        INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled)
        VALUES ('OK', 'Oklahoma DOT', 'https://oktraffic.org/api/Geojsons/workzones?&access_token=feOPynfHRJ5sdx8tf3IN5yOsGz89TAUuzHsN3V0jo1Fg41LcpoLhIRltaTPmDngD', 'WZDx', 'geojson', true)
      `);
      console.log('✅ Added Oklahoma to production');
    } else {
      console.log('✓ Oklahoma already exists');
    }

    await pool.end();
    console.log('\n✅ Done! Restart the backend to load the new feeds.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('\nNote: If you get "relation does not exist" error, production is still running old code.');
    console.log('You need to deploy the latest code to Railway first.');
    process.exit(1);
  }
}

addFeeds();

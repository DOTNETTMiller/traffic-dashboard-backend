const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);

    // Test simple query
    const result = await pool.query('SELECT NOW()');
    console.log('✓ Connection successful');
    console.log('Server time:', result.rows[0].now);

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'corridor_service_quality_latest'
      ORDER BY ordinal_position
    `);

    console.log('\n✓ Table columns:');
    tableCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Check current data
    const dataCheck = await pool.query(`
      SELECT corridor_id,
             geometry IS NULL as geo_null,
             bounds IS NULL as bounds_null,
             pg_typeof(geometry) as geo_type,
             pg_typeof(bounds) as bounds_type
      FROM corridor_service_quality_latest
      LIMIT 3
    `);

    console.log('\n✓ Current corridor data:');
    dataCheck.rows.forEach(row => {
      console.log(`  - ${row.corridor_id}: geometry=${row.geo_null ? 'NULL' : 'has data'} (type: ${row.geo_type}), bounds=${row.bounds_null ? 'NULL' : 'has data'} (type: ${row.bounds_type})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testConnection();

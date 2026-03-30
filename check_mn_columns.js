// Check data_feeds table structure
const { Pool } = require('pg');

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
  try {
    // Get table structure
    const columns = await pgPool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'data_feeds'
      ORDER BY ordinal_position;
    `);

    console.log('\ndata_feeds table columns:');
    console.table(columns.rows);

    // Get a sample Minnesota event
    const sample = await pgPool.query(`
      SELECT *
      FROM data_feeds
      WHERE state = 'MN'
      LIMIT 1;
    `);

    if (sample.rows.length > 0) {
      console.log('\nSample MN event columns:');
      console.log(Object.keys(sample.rows[0]));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pgPool.end();
  }
}

checkColumns();

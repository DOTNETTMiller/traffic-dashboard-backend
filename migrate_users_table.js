const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Adding missing columns to users table...');

    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT');
    console.log('✅ Added full_name column');

    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS organization TEXT');
    console.log('✅ Added organization column');

    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_messages BOOLEAN DEFAULT TRUE');
    console.log('✅ Added notify_on_messages column');

    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_high_severity BOOLEAN DEFAULT TRUE');
    console.log('✅ Added notify_on_high_severity column');

    console.log('\n✅ Migration complete!');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await pool.end();
  }
}

migrate();

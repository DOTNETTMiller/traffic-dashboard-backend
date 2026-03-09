const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration(filename) {
  console.log('\n' + '='.repeat(60));
  console.log('Running: ' + filename);
  console.log('='.repeat(60));

  const sql = fs.readFileSync(filename, 'utf8');

  try {
    await pool.query(sql);
    console.log('✅ Migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error.stack);
    return false;
  }
}

async function main() {
  const migrations = [
    'migrations/create_border_geofencing.sql',
    'migrations/create_auto_dms_activation.sql',
    'migrations/create_ttri_metrics.sql'
  ];

  console.log('\n🚀 Starting migration process...\n');

  let success = 0;
  let failed = 0;

  for (const migration of migrations) {
    const result = await runMigration(migration);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary:');
  console.log('✅ Successful: ' + success);
  console.log('❌ Failed: ' + failed);
  console.log('='.repeat(60) + '\n');

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

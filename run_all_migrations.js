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
    // Don't show full stack for cleaner output
    return false;
  }
}

async function main() {
  // Run all migrations in dependency order
  const migrations = [
    'migrations/add_freight_impact_tagging.sql',
    'migrations/create_event_archive.sql',
    'migrations/create_dms_messaging.sql',
    'migrations/create_diversion_route_protocol.sql',
    'migrations/create_closure_approval_workflow.sql',
    'migrations/create_border_geofencing.sql',
    'migrations/create_auto_dms_activation.sql',
    'migrations/create_ttri_metrics.sql'
  ];

  console.log('\n🚀 Running ALL CCAI migrations in order...\n');

  let success = 0;
  let failed = 0;
  const failedMigrations = [];

  for (const migration of migrations) {
    const result = await runMigration(migration);
    if (result) {
      success++;
    } else {
      failed++;
      failedMigrations.push(migration);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary:');
  console.log('✅ Successful: ' + success);
  console.log('❌ Failed: ' + failed);
  if (failedMigrations.length > 0) {
    console.log('\nFailed migrations:');
    failedMigrations.forEach(m => console.log('  - ' + m));
  }
  console.log('='.repeat(60) + '\n');

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

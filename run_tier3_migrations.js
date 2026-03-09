const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration(filename, name) {
  console.log('\n' + '='.repeat(60));
  console.log('Running: ' + name);
  console.log('File: ' + filename);
  console.log('='.repeat(60));

  const sql = fs.readFileSync(filename, 'utf8');

  try {
    const result = await pool.query(sql);
    console.log('✅ Migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('   Error detail:', error.detail || 'N/A');
    return false;
  }
}

async function main() {
  console.log('\n🚀 Running TIER 3 CCAI migrations...\n');
  console.log('This will implement the 4 most complex CCAI use cases:\n');
  console.log('  UC #3:  Cross-State CCTV Sharing');
  console.log('  UC #8:  Coordinated Amber Alert Protocol');
  console.log('  UC #12: Minimum Interstate Data Exchange Layer');
  console.log('  UC #19: Interstate Digital Twin Pilot\n');

  const migrations = [
    { file: 'migrations/create_cctv_sharing.sql', name: 'UC #3: CCTV Sharing' },
    { file: 'migrations/create_amber_alert_protocol.sql', name: 'UC #8: Amber Alert Protocol' },
    { file: 'migrations/create_data_exchange_layer.sql', name: 'UC #12: Data Exchange Layer' },
    { file: 'migrations/create_digital_twin.sql', name: 'UC #19: Digital Twin Pilot' }
  ];

  let success = 0;
  let failed = 0;

  for (const migration of migrations) {
    const result = await runMigration(migration.file, migration.name);
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
  console.log('='.repeat(60));

  if (success === 4) {
    console.log('\n🎉 ALL TIER 3 MIGRATIONS COMPLETED! 🎉');
    console.log('\nCCAI Alignment Update:');
    console.log('Before: 10/20 use cases (50%)');
    console.log('After:  14/20 use cases (70%)');
    console.log('\n4 remaining use cases to reach 100%:');
    console.log('  UC #9:  Queue Warning Synchronization');
    console.log('  UC #13: Lane Closure Visibility Feed');
    console.log('  UC #16: Weather Status Exchange Feed');
    console.log('  UC #17: Multi-State Work Zone Synchronization');
  }

  console.log('\n');

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

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
    console.error('❌ Migration failed:', error.message || error);
    console.error('   Code:', error.code || 'No code');
    console.error('   Detail:', error.detail || 'No additional details');
    console.error('   Hint:', error.hint || 'No hint available');
    console.error('   Stack:', error.stack);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Running IPAWS Audit Log Migration (PostgreSQL)...\n');

  const result = await runMigration('migrations/create_ipaws_audit_log_lightweight_pg.sql');

  if (result) {
    console.log('\n✅ IPAWS audit log table created successfully!');
    console.log('   Table: ipaws_alert_log_lite');
    console.log('   Views: ipaws_active_alerts_lite, ipaws_compliance_lite');
  } else {
    console.log('\n❌ Migration failed. Please check the error above.');
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  console.log('\n✅ Verifying CCAI Feature Migrations\n');
  console.log('='.repeat(60));

  try {
    // Check border_notifications config
    const borderConfig = await pool.query('SELECT * FROM border_proximity_config');
    console.log('\n📍 Border Geofencing Configuration:');
    console.log('   Distance threshold:', borderConfig.rows[0].distance_threshold_miles, 'miles');
    console.log('   Auto-notify enabled:', borderConfig.rows[0].auto_notify_enabled);
    console.log('   Severity threshold:', borderConfig.rows[0].notification_severity_threshold);

    // Check auto_dms_rules
    const dmsRules = await pool.query('SELECT COUNT(*) as count, COUNT(*) FILTER (WHERE enabled = true) as enabled FROM auto_dms_rules');
    console.log('\n🚨 Auto-DMS Rules:');
    console.log('   Total rules:', dmsRules.rows[0].count);
    console.log('   Enabled rules:', dmsRules.rows[0].enabled);

    // List top 5 rules by priority
    const topRules = await pool.query('SELECT rule_name, priority, event_severity FROM auto_dms_rules WHERE enabled = true ORDER BY priority DESC LIMIT 5');
    console.log('\n   Top 5 Rules:');
    topRules.rows.forEach((rule, i) => {
      console.log(`   ${i + 1}. ${rule.rule_name} (priority: ${rule.priority}, severity: ${rule.event_severity})`);
    });

    // Check TTRI tables
    const ttriObs = await pool.query('SELECT COUNT(*) as count FROM travel_time_observations');
    const ttriMetrics = await pool.query('SELECT COUNT(*) as count FROM ttri_metrics');
    console.log('\n📊 TTRI System:');
    console.log('   Travel time observations:', ttriObs.rows[0].count);
    console.log('   TTRI metrics (monthly):', ttriMetrics.rows[0].count);

    // Check border notifications table
    const borderNot = await pool.query('SELECT COUNT(*) as count FROM border_notifications');
    console.log('\n📬 Border Notifications:');
    console.log('   Notifications logged:', borderNot.rows[0].count);

    console.log('\n' + '='.repeat(60));
    console.log('✅ All CCAI feature tables verified successfully!');
    console.log('='.repeat(60) + '\n');

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

verify();

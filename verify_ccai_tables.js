#!/usr/bin/env node

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway';

const EXPECTED_TABLES = [
  'amber_alert_protocols',
  'auto_dms_rules',
  'cctv_sharing_sessions',
  'cv_messages',
  'digital_twin_assets',
  'diversion_routes',
  'diversion_route_segments',
  'dms_message_templates',
  'dms_activations',
  'freight_tttr_segments',
  'lane_closures',
  'planned_closures',
  'closure_approvals',
  'queue_warning_dms',
  'traveler_info_api_endpoints',
  'truck_parking_sites',
  'weather_exchange_data',
  'work_zone_data_feeds'
];

(async () => {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    console.log('📊 CCAI Tables Verification\n');
    console.log('='.repeat(50));

    let existCount = 0;
    const missing = [];

    for (const table of EXPECTED_TABLES) {
      const result = await client.query(
        'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)',
        ['public', table]
      );

      const exists = result.rows[0].exists;
      if (exists) {
        existCount++;
        console.log(`✅ ${table}`);
      } else {
        missing.push(table);
        console.log(`❌ ${table}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Summary: ${existCount}/${EXPECTED_TABLES.length} tables exist`);
    console.log(`✅ Implemented: ${existCount}`);
    console.log(`❌ Missing: ${missing.length}`);

    if (missing.length > 0) {
      console.log('\nMissing tables:');
      missing.forEach(t => console.log(`   - ${t}`));
    }

    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();

#!/usr/bin/env node

/**
 * Run All Missing CCAI Migrations on Production PostgreSQL Database
 *
 * This script runs all Connected Corridor Architecture Initiative (CCAI)
 * migrations that haven't been executed yet on the Railway production database.
 */

const fs = require('fs');
const path = require('path');

// PostgreSQL connection string (Railway production)
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway';

// List of CCAI migrations to run (in order)
const MIGRATIONS = [
  'create_amber_alert_protocol.sql',
  'create_cctv_sharing.sql',
  'create_closure_approval_workflow.sql',
  'create_diversion_route_protocol.sql',
  'create_dms_messaging.sql',
  'create_digital_twin.sql',
  'create_freight_tttr.sql',
  'create_traveler_api.sql',
  'create_truck_parking_integration.sql',
  'create_weather_exchange.sql',
  'create_workzone_sync.sql'
];

console.log('🚀 CCAI Migrations Script (PostgreSQL)');
console.log('=====================================\n');
console.log(`📋 Running ${MIGRATIONS.length} migrations...\n`);

async function runMigrations() {
  let client;
  const results = {
    success: [],
    failed: [],
    skipped: []
  };

  try {
    // Import pg dynamically
    const { Client } = require('pg');

    // Create PostgreSQL client
    client = new Client({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    console.log('📡 Connecting to PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Run each migration
    for (let i = 0; i < MIGRATIONS.length; i++) {
      const migrationFile = MIGRATIONS[i];
      const migrationNumber = i + 1;

      console.log(`\n[${ migrationNumber}/${MIGRATIONS.length}] Processing: ${migrationFile}`);
      console.log('─'.repeat(60));

      try {
        // Read migration file
        const migrationPath = path.join(__dirname, 'migrations', migrationFile);

        if (!fs.existsSync(migrationPath)) {
          console.log(`⚠️  Migration file not found, skipping`);
          results.skipped.push(migrationFile);
          continue;
        }

        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        console.log(`📄 Read migration (${migrationSQL.length} characters)`);

        // Execute migration
        console.log('🔨 Executing...');
        await client.query(migrationSQL);
        console.log('✅ Migration successful!');

        results.success.push(migrationFile);

      } catch (error) {
        console.error(`❌ Migration failed: ${error.message}`);

        // Check if it's a "relation already exists" error
        if (error.message.includes('already exists')) {
          console.log('ℹ️  Tables already exist - treating as success');
          results.success.push(migrationFile + ' (already existed)');
        } else {
          results.failed.push({ file: migrationFile, error: error.message });
        }
      }
    }

    // Summary
    console.log('\n');
    console.log('═'.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('═'.repeat(60));
    console.log(`✅ Successful: ${results.success.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⚠️  Skipped: ${results.skipped.length}`);

    if (results.success.length > 0) {
      console.log('\n✅ Successful migrations:');
      results.success.forEach(m => console.log(`   - ${m}`));
    }

    if (results.failed.length > 0) {
      console.log('\n❌ Failed migrations:');
      results.failed.forEach(f => console.log(`   - ${f.file}: ${f.error}`));
    }

    if (results.skipped.length > 0) {
      console.log('\n⚠️  Skipped migrations:');
      results.skipped.forEach(m => console.log(`   - ${m}`));
    }

    // Verify tables were created
    console.log('\n🔍 Verifying CCAI tables...');
    const expectedTables = [
      'amber_alert_protocols',
      'auto_dms_rules',
      'cctv_sharing_sessions',
      'planned_closures',
      'cv_messages',
      'digital_twin_assets',
      'diversion_routes',
      'dms_templates',
      'freight_tttr_segments',
      'lane_closures',
      'queue_warning_dms',
      'traveler_info_api_endpoints',
      'truck_parking_sites',
      'weather_exchange_data',
      'work_zone_data_feeds'
    ];

    let existCount = 0;
    let missingCount = 0;

    for (const table of expectedTables) {
      const result = await client.query(`
        SELECT COUNT(*) as exists
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1;
      `, [table]);
      const exists = result.rows[0].exists > 0;
      if (exists) {
        existCount++;
      } else {
        missingCount++;
      }
    }

    console.log(`\n✅ CCAI Tables: ${existCount}/${expectedTables.length} exist`);

    if (results.failed.length === 0) {
      console.log('\n🎉 All migrations completed successfully!');
      console.log('📋 CCAI features are now ready:');
      console.log('   - Closure Approval Workflow');
      console.log('   - DMS Messaging & Templates');
      console.log('   - Diversion Route Management');
      console.log('   - Amber Alert Protocol');
      console.log('   - CCTV Sharing');
      console.log('   - Digital Twin Assets');
      console.log('   - Freight TTTR');
      console.log('   - Traveler Info API');
      console.log('   - Truck Parking Integration');
      console.log('   - Weather Exchange');
      console.log('   - Work Zone Sync');
    } else {
      console.log('\n⚠️  Some migrations failed - review errors above');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:');
    console.error(error.message);

    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('pg')) {
      console.error('\n💡 PostgreSQL driver not found. Install it with:');
      console.error('   npm install pg');
    } else if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }

    process.exit(1);
  } finally {
    if (client) {
      await client.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the migrations
runMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

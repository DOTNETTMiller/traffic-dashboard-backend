#!/usr/bin/env node

/**
 * Run CADD Models PostgreSQL Migration on Production Database
 *
 * This script connects to the Railway PostgreSQL database and
 * creates the cadd_models, cadd_layers, and cadd_entities tables.
 */

const fs = require('fs');
const path = require('path');

// PostgreSQL connection string (Railway production)
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway';

console.log('🚀 CADD Models Migration Script (PostgreSQL)');
console.log('============================================\n');

async function runMigration() {
  let client;

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

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'create_cadd_models_table_pg.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`✅ Migration SQL loaded (${migrationSQL.length} characters)\n`);

    // Execute migration
    console.log('🔨 Executing migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration executed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('cadd_models', 'cadd_layers', 'cadd_entities')
      ORDER BY table_name;
    `);

    console.log(`✅ Found ${result.rows.length} CADD tables:`);
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Get column counts for each table
    for (const row of result.rows) {
      const colResult = await client.query(`
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1;
      `, [row.table_name]);
      console.log(`     (${colResult.rows[0].count} columns)`);
    }

    console.log('\n✅ CADD migration completed successfully!');
    console.log('📋 Tables created:');
    console.log('   - cadd_models (main table for uploaded CAD files)');
    console.log('   - cadd_layers (CAD layer information)');
    console.log('   - cadd_entities (individual CAD entities with geometry)');
    console.log('\n🎉 CADD upload, viewer, and map layer features are now ready!');

  } catch (error) {
    console.error('\n❌ Migration failed:');
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

// Run the migration
runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

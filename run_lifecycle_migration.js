#!/usr/bin/env node

/**
 * Run event lifecycle migration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('\n📊 Running event_lifecycle migration...\n');

  try {
    const migrationPath = path.join(__dirname, 'migrations/create_event_lifecycle.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration SQL...');
    await pgPool.query(sql);

    console.log('✅ Migration completed successfully!');

    // Check table structure
    const tableCheck = await pgPool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'event_lifecycle'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Table structure:');
    console.table(tableCheck.rows);

    // Check view
    const viewCheck = await pgPool.query(`
      SELECT * FROM event_lifecycle_stats
      LIMIT 1;
    `);

    console.log('\n✅ View event_lifecycle_stats is working');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pgPool.end();
  }
}

runMigration();

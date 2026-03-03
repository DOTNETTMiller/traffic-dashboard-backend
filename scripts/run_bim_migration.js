/**
 * Run BIM Infrastructure Database Migration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🔧 Running BIM infrastructure migration...\n');

    const sql = fs.readFileSync(
      path.join(__dirname, '../migrations/create_bim_infrastructure.sql'),
      'utf8'
    );

    await pool.query(sql);

    console.log('✅ BIM infrastructure table created successfully!');
    console.log('✅ Indexes and triggers created');
    console.log('✅ V2X and AV views created\n');

    // Verify table creation
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'bim_infrastructure'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Table Schema:');
    console.log('─'.repeat(60));
    result.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(30)} ${row.data_type}`);
    });

    await pool.end();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

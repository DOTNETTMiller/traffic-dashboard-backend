#!/usr/bin/env node
/**
 * Apply TETC Data Quality migrations to production PostgreSQL database
 *
 * Usage:
 *   node scripts/apply_tetc_migrations.js
 *
 * Make sure DATABASE_URL is set in your environment (Railway provides this automatically)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    console.error('For Railway: railway run node scripts/apply_tetc_migrations.js');
    process.exit(1);
  }

  console.log('🐘 Connecting to PostgreSQL database...');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Step 1: Apply schema migration
    console.log('\n📋 Applying schema migration...');
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/add_data_quality_schema_pg.sql'),
      'utf8'
    );
    await client.query(schemaSQL);
    console.log('✅ Schema migration applied');

    // Step 2: Apply TETC data migration
    console.log('\n📊 Applying TETC data migration...');
    const tetcSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/tetc_data_quality_pg.sql'),
      'utf8'
    );
    await client.query(tetcSQL);
    console.log('✅ TETC data migration applied');

    // Step 3: Verify data
    console.log('\n🔍 Verifying data...');
    const corridorCount = await client.query('SELECT COUNT(*) FROM corridors');
    const feedCount = await client.query('SELECT COUNT(*) FROM data_feeds');
    const scoreCount = await client.query('SELECT COUNT(*) FROM quality_scores');

    console.log(`\n📈 Migration Summary:`);
    console.log(`   - Corridors: ${corridorCount.rows[0].count}`);
    console.log(`   - Data Feeds: ${feedCount.rows[0].count}`);
    console.log(`   - Quality Scores: ${scoreCount.rows[0].count}`);

    // Step 4: Show sample data
    console.log('\n📊 Sample Quality Scores:');
    const sampleScores = await client.query(`
      SELECT corridor_name, service_display_name, dqi, letter_grade
      FROM corridor_service_quality_latest
      ORDER BY dqi DESC
      LIMIT 5
    `);

    sampleScores.rows.forEach(row => {
      console.log(`   - ${row.corridor_name} / ${row.service_display_name}: DQI ${row.dqi} (${row.letter_grade})`);
    });

    console.log('\n✅ All migrations applied successfully!');
    console.log('🚀 TETC Data Grading is now live on your production site');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigrations();

#!/usr/bin/env node

/**
 * Migrate vendor data from SQLite to PostgreSQL
 * This script copies TETC vendor quality score data to the main database
 */

const Database = require('better-sqlite3');
const path = require('path');
const { Pool } = require('pg');

async function migrateVendorData() {
  console.log('🔄 Migrating vendor data to PostgreSQL...\n');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  DATABASE_URL not set - running in local mode');
    console.log('✅ No migration needed (will use SQLite traffic_data.db)');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Create vendor tables in PostgreSQL
    console.log('📋 Creating vendor tables in PostgreSQL...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tetc_vendors (
        id TEXT PRIMARY KEY,
        vendor_name TEXT NOT NULL,
        vendor_type TEXT,
        data_categories TEXT,
        website_url TEXT,
        tetc_profile_url TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_evaluations (
        id TEXT PRIMARY KEY,
        vendor_id TEXT NOT NULL,
        evaluation_name TEXT,
        evaluation_date DATE,
        methodology_ref TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES tetc_vendors(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_quality_scores (
        id SERIAL PRIMARY KEY,
        evaluation_id TEXT NOT NULL,
        dqi REAL,
        letter_grade TEXT,
        acc_score REAL,
        cov_score REAL,
        tim_score REAL,
        std_score REAL,
        gov_score REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (evaluation_id) REFERENCES vendor_evaluations(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_capabilities (
        id SERIAL PRIMARY KEY,
        vendor_id TEXT NOT NULL,
        data_category TEXT,
        FOREIGN KEY (vendor_id) REFERENCES tetc_vendors(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_score_votes (
        id SERIAL PRIMARY KEY,
        evaluation_id TEXT NOT NULL,
        vote_type TEXT CHECK (vote_type IN ('helpful', 'not_helpful')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (evaluation_id) REFERENCES vendor_evaluations(id)
      )
    `);

    // Create view
    await pool.query(`
      CREATE OR REPLACE VIEW vendor_quality_latest AS
      SELECT
        v.id as vendor_id,
        v.vendor_name,
        v.vendor_type,
        v.data_categories,
        v.website_url,
        v.tetc_profile_url,
        ve.id as evaluation_id,
        ve.evaluation_name,
        ve.evaluation_date,
        ve.methodology_ref,
        vqs.dqi,
        vqs.letter_grade,
        vqs.acc_score,
        vqs.cov_score,
        vqs.tim_score,
        vqs.std_score,
        vqs.gov_score,
        vqs.created_at as last_scored
      FROM tetc_vendors v
      JOIN vendor_evaluations ve ON v.id = ve.vendor_id
      JOIN vendor_quality_scores vqs ON ve.id = vqs.evaluation_id
      WHERE v.is_active = 1
        AND vqs.id IN (
          SELECT MAX(vqs2.id)
          FROM vendor_quality_scores vqs2
          JOIN vendor_evaluations ve2 ON vqs2.evaluation_id = ve2.id
          WHERE ve2.vendor_id = v.id
        )
    `);

    console.log('✅ Vendor tables created\n');

    // Load data from SQLite
    console.log('📦 Loading vendor data from SQLite...');
    const sqliteDb = new Database(path.join(__dirname, '..', 'traffic_data.db'), { readonly: true });

    const vendors = sqliteDb.prepare('SELECT * FROM tetc_vendors').all();
    const evaluations = sqliteDb.prepare('SELECT * FROM vendor_evaluations').all();
    const scores = sqliteDb.prepare('SELECT * FROM vendor_quality_scores').all();

    console.log(`   Found ${vendors.length} vendors`);
    console.log(`   Found ${evaluations.length} evaluations`);
    console.log(`   Found ${scores.length} quality scores\n`);

    // Insert vendors
    console.log('💾 Inserting vendors...');
    for (const vendor of vendors) {
      await pool.query(`
        INSERT INTO tetc_vendors (id, vendor_name, vendor_type, data_categories, website_url, tetc_profile_url, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          vendor_name = EXCLUDED.vendor_name,
          vendor_type = EXCLUDED.vendor_type,
          data_categories = EXCLUDED.data_categories,
          website_url = EXCLUDED.website_url,
          tetc_profile_url = EXCLUDED.tetc_profile_url,
          is_active = EXCLUDED.is_active
      `, [vendor.id, vendor.vendor_name, vendor.vendor_type, vendor.data_categories, vendor.website_url, vendor.tetc_profile_url, vendor.is_active, vendor.created_at]);
    }

    // Insert evaluations
    console.log('💾 Inserting evaluations...');
    for (const eval of evaluations) {
      await pool.query(`
        INSERT INTO vendor_evaluations (id, vendor_id, evaluation_name, evaluation_date, methodology_ref, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          vendor_id = EXCLUDED.vendor_id,
          evaluation_name = EXCLUDED.evaluation_name,
          evaluation_date = EXCLUDED.evaluation_date,
          methodology_ref = EXCLUDED.methodology_ref
      `, [eval.id, eval.vendor_id, eval.evaluation_name, eval.evaluation_date, eval.methodology_ref, eval.created_at]);
    }

    // Insert scores
    console.log('💾 Inserting quality scores...');
    for (const score of scores) {
      await pool.query(`
        INSERT INTO vendor_quality_scores (evaluation_id, dqi, letter_grade, acc_score, cov_score, tim_score, std_score, gov_score, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING
      `, [score.evaluation_id, score.dqi, score.letter_grade, score.acc_score, score.cov_score, score.tim_score, score.std_score, score.gov_score, score.created_at]);
    }

    sqliteDb.close();

    console.log('\n✅ Vendor data migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
migrateVendorData().catch(err => {
  console.error(err);
  process.exit(1);
});

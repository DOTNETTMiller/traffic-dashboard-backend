#!/usr/bin/env node

/**
 * Seed vendor data directly into PostgreSQL
 * This script doesn't require SQLite - data is embedded
 */

const { Pool } = require('pg');

// Embedded vendor data
const vendorData = {
  vendors: [
    {id: "vendor-carto", vendor_name: "CARTO", vendor_type: "geospatial_analytics", data_categories: '["Analytics","Visualization"]', website_url: "https://carto.com", tetc_profile_url: "https://tetcoalition.org/tdm/", is_active: 1},
    {id: "vendor-streetlight", vendor_name: "StreetLight Data", vendor_type: "analytics", data_categories: '["Origin-Destination","Volume"]', website_url: "https://www.streetlightdata.com", tetc_profile_url: "https://tetcoalition.org/tdm/", is_active: 1},
    {id: "vendor-iteris", vendor_name: "Iteris", vendor_type: "traffic_management", data_categories: '["Travel Time & Speed","Volume"]', website_url: "https://www.iteris.com", tetc_profile_url: "https://tetcoalition.org/tdm/", is_active: 1},
    {id: "vendor-inrix", vendor_name: "INRIX", vendor_type: "probe_data", data_categories: '["Travel Time & Speed","Origin-Destination","Freight","Waypoint","Volume","Conflation"]', website_url: "https://inrix.com", tetc_profile_url: "https://tetcoalition.org/wp-content/uploads/2015/02/INRIX-About-Us.pdf", is_active: 1},
    {id: "vendor-here", vendor_name: "HERE Technologies", vendor_type: "probe_data", data_categories: '["Travel Time & Speed"]', website_url: "https://www.here.com", tetc_profile_url: "https://tetcoalition.org/wp-content/uploads/2015/02/HERE-About-Us.pdf", is_active: 1},
    {id: "vendor-replica", vendor_name: "Replica", vendor_type: "tdm_provider", data_categories: '["Volume","Origin-Destination"]', website_url: null, tetc_profile_url: null, is_active: 1},
    {id: "vendor-airsage", vendor_name: "AirSage", vendor_type: "analytics", data_categories: '["Origin-Destination"]', website_url: "https://airsage.com", tetc_profile_url: "https://tetcoalition.org/tdm/", is_active: 1},
    {id: "vendor-geotab", vendor_name: "Geotab", vendor_type: "fleet_telematics", data_categories: '["Origin-Destination","Freight","Volume"]', website_url: "https://www.geotab.com", tetc_profile_url: "https://tetcoalition.org/tdm/", is_active: 1}
  ],
  evaluations: [
    {id: "eval-b5588439664db11c", vendor_id: "vendor-carto", evaluation_name: "TETC Coalition Official Validation", evaluation_date: "2025-01-15", methodology_ref: "https://tetcoalition.org/data-marketplace/validation/"},
    {id: "eval-b3626d71e1e5a81c", vendor_id: "vendor-streetlight", evaluation_name: "TETC Coalition Official Validation", evaluation_date: "2025-01-15", methodology_ref: "https://tetcoalition.org/data-marketplace/validation/"},
    {id: "eval-4bf5f491686b0923", vendor_id: "vendor-iteris", evaluation_name: "TETC Coalition Official Validation", evaluation_date: "2025-01-15", methodology_ref: "https://tetcoalition.org/data-marketplace/validation/"},
    {id: "eval-e26380bd6aab9067", vendor_id: "vendor-inrix", evaluation_name: "TETC Coalition Official Validation", evaluation_date: "2025-01-15", methodology_ref: "https://tetcoalition.org/data-marketplace/validation/"},
    {id: "eval-8674c82bdf455a53", vendor_id: "vendor-here", evaluation_name: "TETC Coalition Official Validation", evaluation_date: "2025-01-15", methodology_ref: "https://tetcoalition.org/data-marketplace/validation/"},
    {id: "eval-e94b4047b33a92a5", vendor_id: "vendor-replica", evaluation_name: "TETC Coalition Official Validation", evaluation_date: "2025-01-15", methodology_ref: "https://tetcoalition.org/data-marketplace/validation/"},
    {id: "eval-a55e7cbc05ecf604", vendor_id: "vendor-airsage", evaluation_name: "TETC Coalition Official Validation", evaluation_date: "2025-01-15", methodology_ref: "https://tetcoalition.org/data-marketplace/validation/"},
    {id: "eval-0f1094b3455be5d4", vendor_id: "vendor-geotab", evaluation_name: "TETC Coalition Official Validation", evaluation_date: "2025-01-15", methodology_ref: "https://tetcoalition.org/data-marketplace/validation/"}
  ],
  scores: [
    {evaluation_id: "eval-b5588439664db11c", dqi: 96, letter_grade: "A", acc_score: 95, cov_score: 95, tim_score: 100, std_score: 100, gov_score: 85},
    {evaluation_id: "eval-b3626d71e1e5a81c", dqi: 94, letter_grade: "A", acc_score: 95, cov_score: 90, tim_score: 90, std_score: 100, gov_score: 95},
    {evaluation_id: "eval-4bf5f491686b0923", dqi: 93, letter_grade: "A", acc_score: 85, cov_score: 95, tim_score: 95, std_score: 100, gov_score: 90},
    {evaluation_id: "eval-e26380bd6aab9067", dqi: 87, letter_grade: "B", acc_score: 85, cov_score: 95, tim_score: 75, std_score: 85, gov_score: 95},
    {evaluation_id: "eval-8674c82bdf455a53", dqi: 86, letter_grade: "B", acc_score: 90, cov_score: 95, tim_score: 70, std_score: 80, gov_score: 95},
    {evaluation_id: "eval-e94b4047b33a92a5", dqi: 81, letter_grade: "B", acc_score: 75, cov_score: 100, tim_score: 60, std_score: 90, gov_score: 80},
    {evaluation_id: "eval-a55e7cbc05ecf604", dqi: 79, letter_grade: "C", acc_score: 85, cov_score: 60, tim_score: 70, std_score: 90, gov_score: 90},
    {evaluation_id: "eval-0f1094b3455be5d4", dqi: 71, letter_grade: "C", acc_score: 60, cov_score: 40, tim_score: 80, std_score: 90, gov_score: 90}
  ]
};

async function seedVendorData() {
  console.log('🌱 Seeding vendor data into PostgreSQL...\n');

  if (!process.env.DATABASE_URL) {
    console.log('⚠️  DATABASE_URL not set - skipping seed');
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Create tables
    console.log('📋 Creating vendor tables...');

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
      CREATE TABLE IF NOT EXISTS vendor_score_votes (
        id SERIAL PRIMARY KEY,
        evaluation_id TEXT NOT NULL,
        vote_type TEXT CHECK (vote_type IN ('up', 'down')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (evaluation_id) REFERENCES vendor_evaluations(id)
      )
    `);

    console.log('✅ Tables created\n');

    // Check if data already exists
    const vendorCount = await pool.query('SELECT COUNT(*) FROM tetc_vendors');
    if (parseInt(vendorCount.rows[0].count) > 0) {
      console.log(`✅ Vendor data already seeded (${vendorCount.rows[0].count} vendors)`);
      await pool.end();
      return;
    }

    // Insert vendors
    console.log('💾 Inserting vendors...');
    for (const vendor of vendorData.vendors) {
      await pool.query(
        `INSERT INTO tetc_vendors (id, vendor_name, vendor_type, data_categories, website_url, tetc_profile_url, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [vendor.id, vendor.vendor_name, vendor.vendor_type, vendor.data_categories, vendor.website_url, vendor.tetc_profile_url, vendor.is_active]
      );
    }
    console.log(`   ✓ ${vendorData.vendors.length} vendors inserted`);

    // Insert evaluations
    console.log('💾 Inserting evaluations...');
    for (const eval of vendorData.evaluations) {
      await pool.query(
        `INSERT INTO vendor_evaluations (id, vendor_id, evaluation_name, evaluation_date, methodology_ref)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [eval.id, eval.vendor_id, eval.evaluation_name, eval.evaluation_date, eval.methodology_ref]
      );
    }
    console.log(`   ✓ ${vendorData.evaluations.length} evaluations inserted`);

    // Insert scores
    console.log('💾 Inserting quality scores...');
    for (const score of vendorData.scores) {
      await pool.query(
        `INSERT INTO vendor_quality_scores (evaluation_id, dqi, letter_grade, acc_score, cov_score, tim_score, std_score, gov_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [score.evaluation_id, score.dqi, score.letter_grade, score.acc_score, score.cov_score, score.tim_score, score.std_score, score.gov_score]
      );
    }
    console.log(`   ✓ ${vendorData.scores.length} quality scores inserted`);

    // Create view
    console.log('📊 Creating vendor_quality_latest view...');
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
    console.log('   ✓ View created\n');

    console.log('✅ Vendor data seeding completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run seeding
if (require.main === module) {
  seedVendorData().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = seedVendorData;

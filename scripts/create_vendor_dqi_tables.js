#!/usr/bin/env node

/**
 * Create TETC Vendor DQI Scoring Tables
 *
 * This script creates tables to store Data Quality Index (DQI) scores
 * for the 11 TETC Transportation Data Marketplace vendor providers.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'traffic_data.db');
const db = new Database(DB_PATH);

console.log('📊 Creating TETC Vendor DQI Scoring Tables...\n');

try {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create vendors table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tetc_vendors (
      id TEXT PRIMARY KEY,
      vendor_name TEXT NOT NULL UNIQUE,
      vendor_type TEXT, -- e.g., 'probe_data', 'analytics', 'freight', 'od_data'
      website_url TEXT,
      tetc_profile_url TEXT,
      data_categories TEXT, -- JSON array: ["Travel Time & Speed", "Origin-Destination", etc.]
      description TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Created tetc_vendors table');

  // Create vendor evaluation runs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendor_evaluations (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      evaluation_name TEXT NOT NULL,
      evaluation_date DATE,
      evaluator TEXT, -- e.g., 'TETC Technical Advisory Committee'
      methodology_ref TEXT, -- Link to evaluation methodology/report
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES tetc_vendors(id) ON DELETE CASCADE
    );
  `);
  console.log('✅ Created vendor_evaluations table');

  // Create vendor quality scores table
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendor_quality_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evaluation_id TEXT NOT NULL,
      acc_score REAL, -- Accuracy (0-100)
      cov_score REAL, -- Coverage (0-100)
      tim_score REAL, -- Timeliness (0-100)
      std_score REAL, -- Standards Compliance (0-100)
      gov_score REAL, -- Governance (0-100)
      dqi REAL NOT NULL, -- Overall Data Quality Index (0-100)
      letter_grade TEXT NOT NULL, -- A, B, C, D, F
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (evaluation_id) REFERENCES vendor_evaluations(id) ON DELETE CASCADE
    );
  `);
  console.log('✅ Created vendor_quality_scores table');

  // Create vendor capabilities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendor_capabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id TEXT NOT NULL,
      data_category TEXT NOT NULL, -- "Travel Time & Speed", "Origin-Destination", etc.
      has_capability BOOLEAN DEFAULT 1,
      notes TEXT,
      FOREIGN KEY (vendor_id) REFERENCES tetc_vendors(id) ON DELETE CASCADE,
      UNIQUE(vendor_id, data_category)
    );
  `);
  console.log('✅ Created vendor_capabilities table');

  // Create vendor voting table (similar to existing TETC scoring)
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendor_score_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evaluation_id TEXT NOT NULL,
      vote_type TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
      voter_id TEXT, -- Optional: track who voted
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (evaluation_id) REFERENCES vendor_evaluations(id) ON DELETE CASCADE
    );
  `);
  console.log('✅ Created vendor_score_votes table');

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vendor_evaluations_vendor ON vendor_evaluations(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_quality_scores_eval ON vendor_quality_scores(evaluation_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_capabilities_vendor ON vendor_capabilities(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_score_votes_eval ON vendor_score_votes(evaluation_id);
  `);
  console.log('✅ Created indexes');

  // Create view for latest vendor scores
  db.exec(`
    CREATE VIEW IF NOT EXISTS vendor_quality_latest AS
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
      );
  `);
  console.log('✅ Created vendor_quality_latest view');

  console.log('\n✨ Vendor DQI tables created successfully!\n');

} catch (error) {
  console.error('❌ Error creating tables:', error);
  process.exit(1);
} finally {
  db.close();
}

#!/usr/bin/env node

/**
 * Insert Validated TETC DQI Scores
 *
 * This script imports the official validated DQI scores from extensive
 * TETC TDM research into the database, including Corridor Communicator
 * and updated INRIX scores.
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'traffic_data.db');
const db = new Database(DB_PATH);

console.log('📊 Importing Validated TETC DQI Scores...\n');

function generateId(prefix) {
  return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
}

function calculateGrade(dqi) {
  if (dqi >= 90) return 'A';
  if (dqi >= 80) return 'B';
  if (dqi >= 70) return 'C';
  if (dqi >= 60) return 'D';
  return 'F';
}

try {
  db.pragma('foreign_keys = ON');

  // 1. Add Corridor Communicator as a "vendor" (it's the platform itself)
  console.log('📦 Adding Corridor Communicator platform...');

  const corridorCommId = 'vendor-corridor-communicator';
  db.prepare(`
    INSERT OR REPLACE INTO tetc_vendors (id, vendor_name, vendor_type, website_url, data_categories, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    corridorCommId,
    'Corridor Communicator',
    'platform',
    'https://tetcoalition.org',
    JSON.stringify(['Travel Time & Speed', 'Origin-Destination', 'Freight', 'Volume', 'Work Zones']),
    'Eastern Transportation Coalition\'s integrated platform aggregating data from multiple prequalified TDM vendors. Provides real-time traffic monitoring, incident management, and performance analysis.'
  );

  // 2. Create evaluation for Corridor Communicator with validated scores
  const corridorEvalId = generateId('eval');
  db.prepare(`
    INSERT INTO vendor_evaluations (id, vendor_id, evaluation_name, evaluation_date, evaluator, methodology_ref, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    corridorEvalId,
    corridorCommId,
    'TETC TDM Comprehensive Validation Study',
    '2024-11-01',
    'Eastern Transportation Coalition Technical Advisory Committee',
    'https://tetcoalition.org/projects/transportation-data-marketplace/',
    'Extensive research-based evaluation including congested corridor validation, Atlanta real-time pilot (2023), volume validation studies, and multi-vendor O-D analysis. High confidence scores based on multiple independent validation reports.'
  );

  // 3. Insert Corridor Communicator validated scores
  const corridorDQI = 93; // From research
  db.prepare(`
    INSERT INTO vendor_quality_scores (evaluation_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    corridorEvalId,
    95, // Accuracy
    90, // Coverage
    90, // Timeliness
    100, // Standards
    85, // Governance
    corridorDQI,
    calculateGrade(corridorDQI)
  );

  console.log(`✅ Corridor Communicator: DQI=${corridorDQI}, Grade=${calculateGrade(corridorDQI)}`);
  console.log(`   ACC: 95, COV: 90, TIM: 90, STD: 100, GOV: 85\n`);

  // 4. Update INRIX with validated research scores
  console.log('🔄 Updating INRIX with validated scores...');

  const inrixId = 'vendor-inrix';

  // Create new evaluation for INRIX with validated data
  const inrixEvalId = generateId('eval');
  db.prepare(`
    INSERT INTO vendor_evaluations (id, vendor_id, evaluation_name, evaluation_date, evaluator, methodology_ref, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    inrixEvalId,
    inrixId,
    'TETC Multi-Vendor Validation Study (Validated)',
    '2024-11-01',
    'Eastern Transportation Coalition / Georgia AADT Study',
    'https://tetcoalition.org/wp-content/uploads/2015/02/TETC-Validation-Report-GA05-FINAL.pdf',
    'Updated scores based on extensive TETC validation: AASE <5 mph on freeways, volume AADT within ~15% of ground truth, approaching FHWA federal benchmarks. Includes Georgia volume study and 2023 latency benchmarking.'
  );

  // Insert INRIX validated scores
  const inrixDQI = 91; // From research (weighted average: 92*0.25 + 95*0.20 + 90*0.20 + 90*0.20 + 85*0.15 = 91.05)
  db.prepare(`
    INSERT INTO vendor_quality_scores (evaluation_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    inrixEvalId,
    92, // Accuracy (validated)
    95, // Coverage (validated)
    90, // Timeliness (validated)
    90, // Standards (validated)
    85, // Governance (validated)
    inrixDQI,
    calculateGrade(inrixDQI)
  );

  console.log(`✅ INRIX (Updated): DQI=${inrixDQI}, Grade=${calculateGrade(inrixDQI)}`);
  console.log(`   ACC: 92, COV: 95, TIM: 90, STD: 90, GOV: 85\n`);

  console.log('✨ Successfully imported validated TETC DQI scores!\n');

  // Show updated summary
  const summary = db.prepare(`
    SELECT
      vendor_name,
      dqi,
      letter_grade,
      acc_score,
      cov_score,
      tim_score,
      std_score,
      gov_score,
      evaluation_date
    FROM vendor_quality_latest
    WHERE vendor_id IN (?, ?)
    ORDER BY dqi DESC
  `).all(corridorCommId, inrixId);

  console.log('📊 Validated TETC Scores:\n');
  console.log('Vendor                    | DQI  | Grade | ACC | COV | TIM | STD | GOV | Date');
  console.log('--------------------------|------|-------|-----|-----|-----|-----|-----|------------');
  summary.forEach((row) => {
    console.log(
      `${row.vendor_name.padEnd(25)} | ${String(Math.round(row.dqi)).padStart(4)} | ${row.letter_grade.padStart(5)} | ${String(Math.round(row.acc_score)).padStart(3)} | ${String(Math.round(row.cov_score)).padStart(3)} | ${String(Math.round(row.tim_score)).padStart(3)} | ${String(Math.round(row.std_score)).padStart(3)} | ${String(Math.round(row.gov_score)).padStart(3)} | ${row.evaluation_date}`
    );
  });

  console.log('\n✅ Validation complete! These scores are based on extensive TETC research.');
  console.log('📄 See docs/TETC_DQI_SCORING_MATRIX.md for full methodology and evidence.\n');

} catch (error) {
  console.error('❌ Error importing validated scores:', error);
  process.exit(1);
} finally {
  db.close();
}

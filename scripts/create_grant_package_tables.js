#!/usr/bin/env node

/**
 * Create Grant Package Builder Tables
 *
 * This script creates database tables for comprehensive grant application
 * package preparation, including funding opportunities, cost estimates,
 * support letters, state splits, and best practices.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'states.db');
const db = new Database(DB_PATH);

console.log('🏗️  Creating Grant Package Builder Tables...\n');

try {
  db.pragma('foreign_keys = ON');

  // 1. Federal Funding Programs Database
  console.log('📦 Creating grant_funding_programs table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS grant_funding_programs (
      id TEXT PRIMARY KEY,
      program_name TEXT NOT NULL,
      program_type TEXT NOT NULL, -- discretionary, formula, block, pooled_fund
      agency TEXT NOT NULL, -- FHWA, FTA, NHTSA, etc.

      -- Eligibility
      eligible_project_types TEXT, -- JSON array: ["V2X", "ITS", "Safety", "Freight"]
      equipment_types TEXT, -- JSON array: ["RSU", "DMS", "Camera", "Fiber"]

      -- Funding Details
      typical_award_min INTEGER, -- minimum award amount
      typical_award_max INTEGER, -- maximum award amount
      match_requirement REAL, -- e.g., 0.20 for 80/20 match
      max_federal_share REAL, -- e.g., 0.80 for 80% federal

      -- Application Details
      application_deadline TEXT,
      deadline_type TEXT, -- annual, rolling, quarterly
      notice_of_funding_url TEXT,

      -- Requirements
      planning_requirement BOOLEAN DEFAULT 0, -- requires planning study
      radit_requirement BOOLEAN DEFAULT 0, -- requires RAD-IT architecture
      benefit_cost_requirement BOOLEAN DEFAULT 0, -- requires BCR analysis

      -- Historical Data
      fy2024_funding INTEGER,
      fy2025_funding INTEGER,
      historical_success_rate REAL, -- 0.0 to 1.0

      -- Metadata
      description TEXT,
      key_priorities TEXT, -- JSON array
      scoring_criteria TEXT, -- JSON object
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log('✅ grant_funding_programs table created\n');

  // 2. Cost Estimator Items
  console.log('📦 Creating cost_estimator_items table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_estimator_items (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL, -- equipment, installation, operations, maintenance
      item_type TEXT NOT NULL, -- RSU, DMS, Camera, Fiber, etc.
      item_name TEXT NOT NULL,

      -- Cost Details
      unit_cost_min INTEGER,
      unit_cost_max INTEGER,
      unit_cost_typical INTEGER,
      unit_of_measure TEXT, -- each, linear_foot, square_foot

      -- Lifecycle Costs
      installation_factor REAL, -- multiplier of equipment cost
      annual_operations_factor REAL, -- annual % of capital
      annual_maintenance_factor REAL, -- annual % of capital
      useful_life_years INTEGER,

      -- Additional Costs
      communication_cost_annual INTEGER, -- for cellular/network
      software_licensing_annual INTEGER,

      -- Metadata
      notes TEXT,
      source TEXT, -- AASHTO, FHWA, industry average
      last_updated TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log('✅ cost_estimator_items table created\n');

  // 3. Support Letter Templates
  console.log('📦 Creating support_letter_templates table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_letter_templates (
      id TEXT PRIMARY KEY,
      letter_type TEXT NOT NULL, -- dot_director, governor, partner_state, mpo, private_sector, congressional
      grant_type TEXT, -- SMART, RAISE, ATCMTD, generic

      -- Template Content
      subject_line TEXT,
      salutation TEXT,
      opening_paragraph TEXT,
      body_template TEXT, -- with {{placeholders}}
      closing_paragraph TEXT,
      signature_block TEXT,

      -- Customization Fields
      required_fields TEXT, -- JSON array: ["projectTitle", "stateKey", "fundingAmount"]
      optional_fields TEXT, -- JSON array

      -- Metadata
      description TEXT,
      usage_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log('✅ support_letter_templates table created\n');

  // 4. Best Management Practices
  console.log('📦 Creating best_management_practices table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS best_management_practices (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL, -- procurement, deployment, operations, maintenance, data_management, interoperability
      subcategory TEXT,
      title TEXT NOT NULL,

      -- Content
      description TEXT,
      detailed_guidance TEXT, -- markdown format

      -- Applicability
      equipment_types TEXT, -- JSON array
      project_phases TEXT, -- JSON array: ["planning", "procurement", "deployment", "operations"]

      -- Resources
      template_files TEXT, -- JSON array of file paths
      reference_urls TEXT, -- JSON array
      case_studies TEXT, -- JSON array

      -- Standards & Compliance
      relevant_standards TEXT, -- JSON array: ["NTCIP 1201", "ARC-IT 10.0"]
      compliance_requirements TEXT, -- JSON array

      -- Metadata
      source TEXT, -- AASHTO, FHWA, state DOT
      last_reviewed TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log('✅ best_management_practices table created\n');

  // 5. Generated Grant Packages (tracking)
  console.log('📦 Creating grant_packages table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS grant_packages (
      id TEXT PRIMARY KEY,
      state_key TEXT NOT NULL,
      user_email TEXT,

      -- Package Details
      grant_type TEXT NOT NULL,
      project_title TEXT,
      funding_requested INTEGER,
      is_pooled_fund BOOLEAN DEFAULT 0,
      pooled_fund_states TEXT, -- JSON array

      -- Generated Components
      narrative_generated BOOLEAN DEFAULT 0,
      support_letters_generated BOOLEAN DEFAULT 0,
      cost_estimate_generated BOOLEAN DEFAULT 0,
      state_splits_generated BOOLEAN DEFAULT 0,

      -- Export Tracking
      export_formats TEXT, -- JSON array: ["docx", "pdf", "radit-xml"]
      last_exported TEXT,

      -- Metadata
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),

      FOREIGN KEY (state_key) REFERENCES states(state_key)
    )
  `);
  console.log('✅ grant_packages table created\n');

  // Create indexes
  console.log('🔍 Creating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_funding_program_type ON grant_funding_programs(program_type);
    CREATE INDEX IF NOT EXISTS idx_funding_agency ON grant_funding_programs(agency);
    CREATE INDEX IF NOT EXISTS idx_funding_deadline ON grant_funding_programs(application_deadline);

    CREATE INDEX IF NOT EXISTS idx_cost_category ON cost_estimator_items(category);
    CREATE INDEX IF NOT EXISTS idx_cost_item_type ON cost_estimator_items(item_type);

    CREATE INDEX IF NOT EXISTS idx_letter_type ON support_letter_templates(letter_type);
    CREATE INDEX IF NOT EXISTS idx_letter_grant_type ON support_letter_templates(grant_type);

    CREATE INDEX IF NOT EXISTS idx_bmp_category ON best_management_practices(category);

    CREATE INDEX IF NOT EXISTS idx_package_state ON grant_packages(state_key);
    CREATE INDEX IF NOT EXISTS idx_package_grant_type ON grant_packages(grant_type);
  `);
  console.log('✅ Indexes created\n');

  console.log('✨ Grant Package Builder schema created successfully!\n');
  console.log('📋 Tables created:');
  console.log('   - grant_funding_programs (federal funding opportunities)');
  console.log('   - cost_estimator_items (equipment & lifecycle costs)');
  console.log('   - support_letter_templates (automated letter generation)');
  console.log('   - best_management_practices (guidance & standards)');
  console.log('   - grant_packages (tracking generated packages)\n');

} catch (error) {
  console.error('❌ Error creating grant package tables:', error);
  process.exit(1);
} finally {
  db.close();
}

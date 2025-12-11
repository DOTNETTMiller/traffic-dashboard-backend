#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'dot_communicator.db');
const db = new Database(DB_PATH);

console.log('🏗️  Creating Digital Infrastructure tables...\n');

try {
  db.pragma('foreign_keys = ON');

  // Note: These tables will also be created in PostgreSQL when deployed to Railway
  // The backend_proxy_server.js handles PostgreSQL table creation automatically

  // Table 1: IFC Models (uploaded files)
  console.log('📦 Creating ifc_models table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ifc_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      file_size INTEGER,
      ifc_schema TEXT,
      project_name TEXT,
      uploaded_by TEXT,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      state_key TEXT,
      latitude REAL,
      longitude REAL,
      route TEXT,
      milepost REAL,
      extraction_status TEXT DEFAULT 'pending',
      extraction_log TEXT,
      total_elements INTEGER DEFAULT 0,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Created ifc_models table');

  // Table 2: Infrastructure Elements (extracted from IFC)
  console.log('📦 Creating infrastructure_elements table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS infrastructure_elements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER,
      ifc_guid TEXT,
      ifc_type TEXT NOT NULL,
      element_name TEXT,
      element_description TEXT,
      category TEXT,

      latitude REAL,
      longitude REAL,
      elevation REAL,
      length REAL,
      width REAL,
      height REAL,
      clearance REAL,

      operational_purpose TEXT,
      its_relevance TEXT,
      v2x_applicable INTEGER DEFAULT 0,
      av_critical INTEGER DEFAULT 0,

      has_manufacturer INTEGER DEFAULT 0,
      has_model INTEGER DEFAULT 0,
      has_install_date INTEGER DEFAULT 0,
      has_clearance INTEGER DEFAULT 0,
      has_coordinates INTEGER DEFAULT 0,
      compliance_score INTEGER DEFAULT 0,

      properties TEXT,
      geometry_data TEXT,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (model_id) REFERENCES ifc_models(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ Created infrastructure_elements table');

  // Table 3: Infrastructure Gap Analysis
  console.log('📦 Creating infrastructure_gaps table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS infrastructure_gaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      element_id INTEGER,
      model_id INTEGER,
      gap_type TEXT NOT NULL,
      gap_category TEXT,
      severity TEXT,

      missing_property TEXT,
      required_for TEXT,
      its_use_case TEXT,
      standards_reference TEXT,
      idm_recommendation TEXT,
      ids_requirement TEXT,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (element_id) REFERENCES infrastructure_elements(id) ON DELETE CASCADE,
      FOREIGN KEY (model_id) REFERENCES ifc_models(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ Created infrastructure_gaps table');

  // Table 4: Standards Mapping
  console.log('📦 Creating infrastructure_standards table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS infrastructure_standards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ifc_type TEXT NOT NULL,
      ifc_property TEXT,
      its_application TEXT,
      operational_need TEXT,
      v2x_use_case TEXT,
      av_requirement TEXT,
      standard_reference TEXT,
      idm_section TEXT,
      ids_requirement TEXT,
      priority TEXT,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Created infrastructure_standards table');

  // Create indexes for performance
  console.log('📑 Creating indexes...');
  db.exec('CREATE INDEX IF NOT EXISTS idx_infra_elements_model ON infrastructure_elements(model_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_infra_elements_type ON infrastructure_elements(ifc_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_infra_gaps_element ON infrastructure_gaps(element_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_infra_gaps_model ON infrastructure_gaps(model_id)');
  console.log('✅ Created indexes');

  console.log('\n🎉 Digital Infrastructure tables created successfully!');
  db.close();
  process.exit(0);
} catch (error) {
  console.error('❌ Error creating tables:', error);
  db.close();
  process.exit(1);
}

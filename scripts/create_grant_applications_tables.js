#!/usr/bin/env node

/**
 * Create Grant Applications Tables
 *
 * Support system for federal/state grant applications with automated
 * data package generation from existing traffic, ITS, and safety data.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'states.db');
const db = new Database(DB_PATH);

console.log('💰 Creating Grant Applications Tables...\n');

try {
  db.pragma('foreign_keys = ON');

  // 1. Grant Applications table
  console.log('📦 Creating grant_applications table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS grant_applications (
      id TEXT PRIMARY KEY,
      state_key TEXT NOT NULL,

      -- Grant Information
      grant_program TEXT NOT NULL, -- RAISE, INFRA, IIJA, BUILD, PROTECT, etc.
      grant_year INTEGER NOT NULL,
      application_title TEXT NOT NULL,
      project_description TEXT,

      -- Funding
      requested_amount REAL,
      matching_funds REAL,
      total_project_cost REAL,

      -- Corridors/Routes
      primary_corridor TEXT,
      affected_routes TEXT, -- JSON array of routes
      geographic_scope TEXT, -- state, regional, national

      -- Application Status
      status TEXT DEFAULT 'draft', -- draft, submitted, awarded, denied, withdrawn
      submission_date TEXT,
      award_date TEXT,
      award_amount REAL,

      -- Documents
      proposal_document_path TEXT,
      proposal_document_name TEXT,
      proposal_uploaded_at TEXT,

      -- Metadata
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),

      FOREIGN KEY (state_key) REFERENCES states(state_key)
    )
  `);
  console.log('✅ grant_applications table created\n');

  // 2. Grant Supporting Data table - links applications to system data
  console.log('📦 Creating grant_supporting_data table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS grant_supporting_data (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,

      -- Data Type
      data_type TEXT NOT NULL, -- incident, equipment, v2x_gaps, parking, bridge, safety
      data_source TEXT NOT NULL,

      -- Filters Applied
      date_range_start TEXT,
      date_range_end TEXT,
      corridor_filter TEXT,
      severity_filter TEXT,

      -- Statistics Generated
      summary_stats TEXT, -- JSON object with key metrics

      -- Export
      exported BOOLEAN DEFAULT FALSE,
      export_format TEXT, -- csv, xlsx, json, pdf
      export_path TEXT,

      included_in_package BOOLEAN DEFAULT TRUE,

      created_at TEXT DEFAULT (datetime('now')),

      FOREIGN KEY (application_id) REFERENCES grant_applications(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ grant_supporting_data table created\n');

  // 3. Grant Justifications table - key talking points
  console.log('📦 Creating grant_justifications table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS grant_justifications (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,

      justification_category TEXT NOT NULL, -- safety, mobility, economic, environmental
      justification_text TEXT NOT NULL,
      supporting_data_ids TEXT, -- JSON array of supporting_data IDs

      priority INTEGER, -- Display order

      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),

      FOREIGN KEY (application_id) REFERENCES grant_applications(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ grant_justifications table created\n');

  // 4. Grant Metrics table - auto-calculated from system data
  console.log('📦 Creating grant_metrics table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS grant_metrics (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,

      -- Safety Metrics
      total_incidents INTEGER,
      high_severity_incidents INTEGER,
      fatalities INTEGER,
      injuries INTEGER,
      crash_rate REAL, -- crashes per million VMT

      -- Traffic Metrics
      average_daily_traffic INTEGER,
      truck_percentage REAL,
      congestion_hours_per_day REAL,

      -- Infrastructure Gaps
      v2x_coverage_gaps INTEGER,
      missing_its_equipment INTEGER,
      bridge_clearance_issues INTEGER,
      truck_parking_shortage INTEGER, -- spaces needed

      -- Economic Impact
      estimated_delay_cost_annual REAL,
      freight_volume_annual REAL, -- tons
      economic_corridor_value REAL,

      -- Existing Infrastructure
      cameras_deployed INTEGER,
      dms_deployed INTEGER,
      rsu_deployed INTEGER,
      sensors_deployed INTEGER,

      -- Data Quality (from TETC)
      data_quality_score REAL, -- DQI score

      calculation_date TEXT DEFAULT (datetime('now')),
      calculation_notes TEXT,

      FOREIGN KEY (application_id) REFERENCES grant_applications(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ grant_metrics table created\n');

  // 5. Grant Templates table
  console.log('📦 Creating grant_templates table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS grant_templates (
      id TEXT PRIMARY KEY,
      template_name TEXT NOT NULL,
      grant_program TEXT NOT NULL,

      -- Template Content
      required_sections TEXT, -- JSON array of section names
      data_requirements TEXT, -- JSON object mapping sections to data types

      -- Scoring Criteria (from program guidance)
      scoring_criteria TEXT, -- JSON object with criteria and weights

      template_active BOOLEAN DEFAULT TRUE,

      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log('✅ grant_templates table created\n');

  // 6. Grant Data Packages table - exported bundles
  console.log('📦 Creating grant_data_packages table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS grant_data_packages (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,

      package_name TEXT NOT NULL,
      package_type TEXT, -- supplemental, exhibits, appendix

      -- Contents
      included_data_types TEXT, -- JSON array of data types
      file_count INTEGER,
      total_size_bytes INTEGER,

      -- Export
      export_format TEXT, -- zip, pdf, folder
      export_path TEXT,
      generated_at TEXT DEFAULT (datetime('now')),

      -- Status
      status TEXT DEFAULT 'pending', -- pending, generating, completed, failed
      error_message TEXT,

      FOREIGN KEY (application_id) REFERENCES grant_applications(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ grant_data_packages table created\n');

  console.log('🔍 Creating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_grants_state ON grant_applications(state_key);
    CREATE INDEX IF NOT EXISTS idx_grants_program ON grant_applications(grant_program);
    CREATE INDEX IF NOT EXISTS idx_grants_status ON grant_applications(status);
    CREATE INDEX IF NOT EXISTS idx_grants_year ON grant_applications(grant_year);

    CREATE INDEX IF NOT EXISTS idx_supporting_data_app ON grant_supporting_data(application_id);
    CREATE INDEX IF NOT EXISTS idx_supporting_data_type ON grant_supporting_data(data_type);

    CREATE INDEX IF NOT EXISTS idx_justifications_app ON grant_justifications(application_id);
    CREATE INDEX IF NOT EXISTS idx_justifications_category ON grant_justifications(justification_category);

    CREATE INDEX IF NOT EXISTS idx_metrics_app ON grant_metrics(application_id);

    CREATE INDEX IF NOT EXISTS idx_packages_app ON grant_data_packages(application_id);
    CREATE INDEX IF NOT EXISTS idx_packages_status ON grant_data_packages(status);
  `);
  console.log('✅ Indexes created\n');

  // Create views
  console.log('📊 Creating views...');

  // View: Grant applications with metrics summary
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_grant_applications_summary AS
    SELECT
      ga.id,
      ga.state_key,
      ga.grant_program,
      ga.grant_year,
      ga.application_title,
      ga.requested_amount,
      ga.status,
      gm.total_incidents,
      gm.high_severity_incidents,
      gm.v2x_coverage_gaps,
      gm.data_quality_score,
      (SELECT COUNT(*) FROM grant_supporting_data WHERE application_id = ga.id) as attached_datasets,
      ga.created_at,
      ga.updated_at
    FROM grant_applications ga
    LEFT JOIN grant_metrics gm ON ga.id = gm.application_id
    ORDER BY ga.created_at DESC
  `);

  // View: Grant success rates by program
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_grant_success_rates AS
    SELECT
      grant_program,
      grant_year,
      COUNT(*) as total_applications,
      SUM(CASE WHEN status = 'awarded' THEN 1 ELSE 0 END) as awarded,
      SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied,
      AVG(CASE WHEN status = 'awarded' THEN requested_amount END) as avg_award_amount,
      SUM(CASE WHEN status = 'awarded' THEN award_amount ELSE 0 END) as total_funding_secured
    FROM grant_applications
    GROUP BY grant_program, grant_year
    ORDER BY grant_year DESC, grant_program
  `);

  console.log('✅ Views created\n');

  // Insert default grant templates
  console.log('📝 Creating default grant templates...');

  const templates = [
    {
      id: 'template-raise-2025',
      name: 'RAISE Grant 2025',
      program: 'RAISE',
      sections: ['Safety', 'State of Good Repair', 'Economic Competitiveness', 'Environmental Sustainability', 'Quality of Life', 'Innovation', 'Partnership'],
      requirements: {
        safety: ['incident', 'safety'],
        economic: ['traffic', 'freight', 'delay_cost'],
        infrastructure: ['equipment', 'v2x_gaps'],
        innovation: ['data_quality', 'v2x']
      },
      criteria: {
        safety: 20,
        state_of_good_repair: 15,
        economic: 20,
        environmental: 15,
        quality_of_life: 10,
        innovation: 10,
        partnership: 10
      }
    },
    {
      id: 'template-infra-2025',
      name: 'INFRA Grant 2025',
      program: 'INFRA',
      sections: ['Project Description', 'Project Location', 'Grant Funds and Sources', 'Selection Criteria'],
      requirements: {
        economic: ['freight', 'traffic', 'delay_cost'],
        safety: ['incident', 'crash_rate'],
        innovation: ['its_equipment', 'v2x']
      },
      criteria: {
        support_economic_vitality: 25,
        leveraging_federal_funding: 20,
        innovation: 15,
        partnership: 15,
        performance_accountability: 25
      }
    },
    {
      id: 'template-protect-2025',
      name: 'PROTECT Grant 2025',
      program: 'PROTECT',
      sections: ['Project Description', 'Resilience Improvement', 'Vulnerability Assessment', 'Cost-Benefit'],
      requirements: {
        vulnerability: ['incident', 'bridge', 'safety'],
        resilience: ['equipment', 'monitoring'],
        economic: ['traffic', 'freight']
      },
      criteria: {
        resilience_improvement: 30,
        vulnerable_populations: 20,
        cost_effectiveness: 25,
        innovation: 15,
        partnership: 10
      }
    }
  ];

  const templateStmt = db.prepare(`
    INSERT OR IGNORE INTO grant_templates (
      id, template_name, grant_program, required_sections,
      data_requirements, scoring_criteria
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const template of templates) {
    templateStmt.run(
      template.id,
      template.name,
      template.program,
      JSON.stringify(template.sections),
      JSON.stringify(template.requirements),
      JSON.stringify(template.criteria)
    );
  }

  console.log(`✅ Created ${templates.length} default grant templates\n`);

  console.log('✨ Grant Applications schema created successfully!\n');
  console.log('📋 Tables created:');
  console.log('   - grant_applications (main application tracking)');
  console.log('   - grant_supporting_data (dataset attachments)');
  console.log('   - grant_justifications (key talking points)');
  console.log('   - grant_metrics (auto-calculated statistics)');
  console.log('   - grant_templates (RAISE, INFRA, PROTECT, etc.)');
  console.log('   - grant_data_packages (export bundles)');
  console.log('\n📊 Views created:');
  console.log('   - v_grant_applications_summary');
  console.log('   - v_grant_success_rates');
  console.log('\n🎯 Default templates: RAISE, INFRA, PROTECT\n');

} catch (error) {
  console.error('❌ Error creating grant tables:', error);
  process.exit(1);
} finally {
  db.close();
}

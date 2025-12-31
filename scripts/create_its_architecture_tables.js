/**
 * Create ITS Architecture Documentation Tables
 *
 * Implements RAD-IT-like functionality for documenting regional/corridor
 * ITS architectures directly within the DOT Corridor Communicator.
 *
 * Based on FHWA Regional ITS Architecture requirements (23 CFR 940.9)
 */

const db = require('../database');

async function createITSArchitectureTables() {
  console.log('Creating ITS Architecture Documentation tables...\n');

  try {
    // ========================================================================
    // STAKEHOLDERS
    // ========================================================================
    // Organizations with roles in the corridor ITS architecture
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS arch_stakeholders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        abbreviation TEXT,
        type TEXT NOT NULL,
        -- Types: state_dot, local_agency, transit, emergency, private, federal
        jurisdiction TEXT,
        primary_contact TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        roles TEXT,
        -- JSON array: ["Traffic Management", "Emergency Response", "Transit Operations"]
        description TEXT,
        website TEXT,
        active BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created arch_stakeholders table');

    // ========================================================================
    // ELEMENTS (ITS Systems/Subsystems)
    // ========================================================================
    // Physical and logical ITS components
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS arch_elements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        element_type TEXT NOT NULL,
        -- Types: center, field, vehicle, traveler, support
        category TEXT,
        -- Categories: Traffic Management, Transit, Emergency, Maintenance, etc.
        stakeholder_id INTEGER,
        description TEXT,
        location TEXT,
        latitude REAL,
        longitude REAL,
        status TEXT DEFAULT 'planned',
        -- planned, existing, deployed, retired
        installation_date TEXT,
        vendor TEXT,
        model TEXT,
        software_version TEXT,
        standards TEXT,
        -- JSON array of applicable standards
        capabilities TEXT,
        -- JSON array of system capabilities
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stakeholder_id) REFERENCES arch_stakeholders(id)
      )
    `);
    console.log('✓ Created arch_elements table');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_elements_stakeholder
      ON arch_elements(stakeholder_id)
    `);

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_elements_type
      ON arch_elements(element_type)
    `);

    // ========================================================================
    // INTERFACES (Data Flows Between Elements)
    // ========================================================================
    // Information exchanges between ITS systems
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS arch_interfaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        source_element_id INTEGER NOT NULL,
        destination_element_id INTEGER NOT NULL,
        description TEXT,
        data_type TEXT,
        -- Types: real-time, archived, control, status, etc.
        information_flows TEXT,
        -- JSON array of specific data items exchanged
        protocol TEXT,
        -- Communication protocol: HTTP, NTCIP, TMDD, SAE J2735, etc.
        standards TEXT,
        -- JSON array of applicable standards
        security_classification TEXT,
        -- public, sensitive, classified
        frequency TEXT,
        -- continuous, on-request, periodic, event-driven
        bandwidth_requirements TEXT,
        latency_requirements TEXT,
        status TEXT DEFAULT 'planned',
        -- planned, implemented, operational, deprecated
        implementation_notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_element_id) REFERENCES arch_elements(id),
        FOREIGN KEY (destination_element_id) REFERENCES arch_elements(id)
      )
    `);
    console.log('✓ Created arch_interfaces table');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_interfaces_source
      ON arch_interfaces(source_element_id)
    `);

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_interfaces_destination
      ON arch_interfaces(destination_element_id)
    `);

    // ========================================================================
    // SERVICE PACKAGES
    // ========================================================================
    // ITS service packages from ARC-IT
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS arch_service_packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        package_id TEXT NOT NULL UNIQUE,
        -- e.g., "TM01", "CVO01"
        name TEXT NOT NULL,
        category TEXT,
        -- Traffic Management, Commercial Vehicle Operations, etc.
        description TEXT,
        user_needs TEXT,
        -- JSON array of user needs addressed
        requirements TEXT,
        -- JSON array of functional requirements
        standards TEXT,
        -- JSON array of applicable standards
        active BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created arch_service_packages table');

    // ========================================================================
    // ELEMENT-SERVICE PACKAGE MAPPING
    // ========================================================================
    // Which service packages are supported by which elements
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS arch_element_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        element_id INTEGER NOT NULL,
        service_package_id INTEGER NOT NULL,
        role TEXT,
        -- provider, consumer, or both
        implementation_status TEXT DEFAULT 'planned',
        -- planned, partial, complete
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (element_id) REFERENCES arch_elements(id),
        FOREIGN KEY (service_package_id) REFERENCES arch_service_packages(id),
        UNIQUE(element_id, service_package_id)
      )
    `);
    console.log('✓ Created arch_element_services table');

    // ========================================================================
    // STANDARDS
    // ========================================================================
    // ITS standards referenced in the architecture
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS arch_standards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        standard_id TEXT NOT NULL UNIQUE,
        -- e.g., "SAE J2735", "NTCIP 1218"
        name TEXT NOT NULL,
        organization TEXT,
        -- SAE, AASHTO, IEEE, ISO, etc.
        category TEXT,
        -- Message Sets, Protocols, Data Dictionaries, etc.
        version TEXT,
        description TEXT,
        document_url TEXT,
        purchase_url TEXT,
        scope TEXT,
        -- What it covers
        related_standards TEXT,
        -- JSON array of related standard IDs
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created arch_standards table');

    // ========================================================================
    // AGREEMENTS
    // ========================================================================
    // Interagency agreements and MOUs
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS arch_agreements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        agreement_type TEXT,
        -- MOU, MOA, SLA, Data Sharing Agreement, etc.
        stakeholder_ids TEXT NOT NULL,
        -- JSON array of stakeholder IDs involved
        description TEXT,
        scope TEXT,
        effective_date TEXT,
        expiration_date TEXT,
        status TEXT DEFAULT 'draft',
        -- draft, pending, active, expired, terminated
        document_path TEXT,
        -- Path to PDF or document file
        key_provisions TEXT,
        -- JSON array of key agreement points
        contact_person TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created arch_agreements table');

    // ========================================================================
    // PROJECTS
    // ========================================================================
    // ITS deployment projects
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS arch_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        project_id TEXT UNIQUE,
        -- Agency project number
        description TEXT,
        stakeholder_id INTEGER,
        project_type TEXT,
        -- deployment, upgrade, maintenance, study
        service_packages TEXT,
        -- JSON array of service package IDs
        elements_deployed TEXT,
        -- JSON array of element IDs being deployed/modified
        scope TEXT,
        budget REAL,
        funding_sources TEXT,
        -- JSON array: [{source: "FHWA", amount: 500000}]
        start_date TEXT,
        completion_date TEXT,
        status TEXT DEFAULT 'planned',
        -- planned, design, construction, operational, complete
        project_manager TEXT,
        contact_email TEXT,
        systems_engineering_required BOOLEAN DEFAULT 1,
        se_documentation_path TEXT,
        grant_application_id INTEGER,
        -- Link to grant applications table if exists
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stakeholder_id) REFERENCES arch_stakeholders(id)
      )
    `);
    console.log('✓ Created arch_projects table');

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_projects_stakeholder
      ON arch_projects(stakeholder_id)
    `);

    // ========================================================================
    // OPERATIONAL CONCEPTS
    // ========================================================================
    // How the ITS systems will operate and interact
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS arch_operational_concepts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        -- Normal Operations, Incident Management, Emergency, Maintenance, etc.
        description TEXT,
        stakeholders_involved TEXT,
        -- JSON array of stakeholder IDs
        elements_involved TEXT,
        -- JSON array of element IDs
        process_flow TEXT,
        -- Detailed step-by-step process
        triggers TEXT,
        -- What initiates this operational scenario
        data_flows TEXT,
        -- JSON array of interface IDs used
        success_criteria TEXT,
        performance_metrics TEXT,
        -- JSON array of measurable outcomes
        contingencies TEXT,
        -- Backup procedures
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created arch_operational_concepts table');

    // ========================================================================
    // FUNCTIONAL REQUIREMENTS
    // ========================================================================
    // System requirements and capabilities
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS arch_functional_requirements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requirement_id TEXT NOT NULL UNIQUE,
        element_id INTEGER,
        service_package_id INTEGER,
        requirement_text TEXT NOT NULL,
        category TEXT,
        -- Data Collection, Data Processing, Communication, etc.
        priority TEXT,
        -- critical, high, medium, low
        verification_method TEXT,
        -- test, analysis, demonstration, inspection
        verification_status TEXT DEFAULT 'not_verified',
        -- not_verified, verified, failed
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (element_id) REFERENCES arch_elements(id),
        FOREIGN KEY (service_package_id) REFERENCES arch_service_packages(id)
      )
    `);
    console.log('✓ Created arch_functional_requirements table');

    // ========================================================================
    // ARCHITECTURE METADATA
    // ========================================================================
    // Overall architecture information
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS arch_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        architecture_name TEXT NOT NULL,
        version TEXT DEFAULT '1.0',
        geographic_scope TEXT,
        -- e.g., "I-80 Corridor: Iowa, Nebraska, Ohio"
        time_horizon TEXT,
        -- e.g., "2025-2030"
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active',
        -- draft, active, archived
        maintainer_stakeholder_id INTEGER,
        description TEXT,
        vision_statement TEXT,
        goals TEXT,
        -- JSON array of high-level goals
        scope_document_path TEXT,
        certification_date TEXT,
        -- FHWA compliance certification date
        next_review_date TEXT,
        notes TEXT,
        FOREIGN KEY (maintainer_stakeholder_id) REFERENCES arch_stakeholders(id)
      )
    `);
    console.log('✓ Created arch_metadata table');

    // Insert default architecture metadata
    await db.runAsync(`
      INSERT OR IGNORE INTO arch_metadata (
        architecture_name,
        geographic_scope,
        time_horizon,
        vision_statement
      ) VALUES (
        'DOT Corridor Communicator ITS Architecture',
        'I-80 and I-35 Corridors: Iowa, Nebraska, Ohio, Kansas, Minnesota, Indiana, Utah, Nevada, New Jersey',
        '2025-2030',
        'Enabling seamless, multi-state coordination of Intelligent Transportation Systems to improve safety, mobility, and operational efficiency across major freight corridors.'
      )
    `);
    console.log('✓ Initialized arch_metadata');

    console.log('\n✅ All ITS Architecture tables created successfully!\n');

  } catch (error) {
    console.error('❌ Error creating ITS Architecture tables:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createITSArchitectureTables()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { createITSArchitectureTables };

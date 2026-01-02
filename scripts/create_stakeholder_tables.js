/**
 * Create Stakeholder Management Tables
 *
 * Tracks stakeholders, agencies, and communication for regional ITS architecture
 * and grant application coordination
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'states.db');
const db = new Database(DB_PATH);

console.log('📋 Creating stakeholder management tables...\n');

try {
  // Stakeholders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stakeholders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_name TEXT NOT NULL,
      organization_type TEXT,
      contact_name TEXT,
      contact_title TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip_code TEXT,
      role TEXT,
      involvement_level TEXT,
      interests TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Created stakeholders table');

  // Stakeholder engagements/communications
  db.exec(`
    CREATE TABLE IF NOT EXISTS stakeholder_engagements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stakeholder_id INTEGER,
      engagement_type TEXT,
      engagement_date TEXT,
      subject TEXT,
      notes TEXT,
      outcome TEXT,
      follow_up_required INTEGER DEFAULT 0,
      follow_up_date TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stakeholder_id) REFERENCES stakeholders(id)
    )
  `);

  console.log('✅ Created stakeholder_engagements table');

  // Project stakeholder mapping (for regional architecture projects)
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_stakeholders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT,
      project_name TEXT,
      stakeholder_id INTEGER,
      role_in_project TEXT,
      responsibilities TEXT,
      funding_contribution REAL,
      equipment_contribution TEXT,
      commitment_level TEXT,
      added_date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stakeholder_id) REFERENCES stakeholders(id)
    )
  `);

  console.log('✅ Created project_stakeholders table');

  // Insert example stakeholders
  const exampleStakeholders = [
    {
      organization_name: 'Iowa Department of Transportation',
      organization_type: 'State DOT',
      contact_name: 'Transportation Director',
      contact_title: 'ITS Program Manager',
      contact_email: 'its@iowadot.gov',
      contact_phone: '515-239-1101',
      city: 'Ames',
      state: 'IA',
      role: 'Lead Agency',
      involvement_level: 'Primary',
      interests: 'Statewide ITS architecture, V2X deployment, work zone safety'
    },
    {
      organization_name: 'Des Moines MPO',
      organization_type: 'Metropolitan Planning Organization',
      contact_name: 'MPO Director',
      contact_title: 'Planning Director',
      city: 'Des Moines',
      state: 'IA',
      role: 'Planning Partner',
      involvement_level: 'Secondary',
      interests: 'Urban traffic management, transit integration, bicycle/pedestrian safety'
    },
    {
      organization_name: 'Iowa State Patrol',
      organization_type: 'Law Enforcement',
      contact_name: 'Colonel',
      contact_title: 'Commander',
      city: 'Des Moines',
      state: 'IA',
      role: 'Safety Partner',
      involvement_level: 'Secondary',
      interests: 'Incident management, public safety, CAD integration'
    },
    {
      organization_name: 'Federal Highway Administration - Iowa Division',
      organization_type: 'Federal Agency',
      contact_name: 'FHWA Iowa Division Administrator',
      contact_title: 'Division Administrator',
      city: 'Ames',
      state: 'IA',
      role: 'Federal Oversight',
      involvement_level: 'Oversight',
      interests: 'Grant compliance, federal standards, safety improvements'
    },
    {
      organization_name: 'University of Iowa - Institute for Transportation',
      organization_type: 'Research Institution',
      contact_name: 'Institute Director',
      contact_title: 'Research Director',
      city: 'Iowa City',
      state: 'IA',
      role: 'Research Partner',
      involvement_level: 'Supporting',
      interests: 'CV/AV research, data analytics, technology evaluation'
    },
    {
      organization_name: 'Iowa League of Cities',
      organization_type: 'Municipal Association',
      city: 'Des Moines',
      state: 'IA',
      role: 'Municipal Coordination',
      involvement_level: 'Supporting',
      interests: 'Local traffic signals, municipal CAD, parking management'
    }
  ];

  const insertStmt = db.prepare(`
    INSERT INTO stakeholders (
      organization_name, organization_type, contact_name, contact_title,
      contact_email, contact_phone, city, state, role, involvement_level, interests
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  exampleStakeholders.forEach(stakeholder => {
    insertStmt.run(
      stakeholder.organization_name,
      stakeholder.organization_type,
      stakeholder.contact_name || null,
      stakeholder.contact_title || null,
      stakeholder.contact_email || null,
      stakeholder.contact_phone || null,
      stakeholder.city,
      stakeholder.state,
      stakeholder.role,
      stakeholder.involvement_level,
      stakeholder.interests
    );
    inserted++;
  });

  console.log(`✅ Inserted ${inserted} example stakeholders\n`);

  // Insert example engagement records
  const exampleEngagements = [
    {
      stakeholder_id: 1,
      engagement_type: 'Meeting',
      engagement_date: '2024-11-15',
      subject: 'Regional ITS Architecture Update Discussion',
      notes: 'Discussed updates to regional architecture including new V2X deployments and WZDx integration. Reviewed equipment inventory and compliance status.',
      outcome: 'Agreement to update architecture documentation by Q1 2025',
      follow_up_required: 1,
      follow_up_date: '2025-01-15'
    },
    {
      stakeholder_id: 4,
      engagement_type: 'Email',
      engagement_date: '2024-12-01',
      subject: 'SMART Grant Application Support',
      notes: 'FHWA provided feedback on draft SMART grant application. Requested additional V2X deployment cost estimates and benefit-cost analysis.',
      outcome: 'Revised application submitted with requested details',
      follow_up_required: 0
    },
    {
      stakeholder_id: 2,
      engagement_type: 'Workshop',
      engagement_date: '2024-10-20',
      subject: 'MPO-DOT Coordination Workshop',
      notes: 'Joint workshop to align urban and statewide ITS strategies. Discussed signal timing coordination and adaptive signal control.',
      outcome: 'Established quarterly coordination meetings',
      follow_up_required: 1,
      follow_up_date: '2025-01-20'
    }
  ];

  const engagementStmt = db.prepare(`
    INSERT INTO stakeholder_engagements (
      stakeholder_id, engagement_type, engagement_date, subject, notes, outcome, follow_up_required, follow_up_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let engagementsInserted = 0;
  exampleEngagements.forEach(engagement => {
    engagementStmt.run(
      engagement.stakeholder_id,
      engagement.engagement_type,
      engagement.engagement_date,
      engagement.subject,
      engagement.notes,
      engagement.outcome,
      engagement.follow_up_required,
      engagement.follow_up_date || null
    );
    engagementsInserted++;
  });

  console.log(`✅ Inserted ${engagementsInserted} example engagements\n`);

  console.log('✅ Stakeholder management tables created successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - ${inserted} stakeholder organizations`);
  console.log(`   - ${engagementsInserted} engagement records`);
  console.log('   - Ready for regional architecture coordination\n');

} catch (error) {
  console.error('❌ Error creating stakeholder tables:', error);
  process.exit(1);
}

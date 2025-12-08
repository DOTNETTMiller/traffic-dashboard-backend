/**
 * Create Support Letter Templates Table
 *
 * Creates the support_letter_templates table in the database for
 * automated letter of support generation.
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'dot_communicator.db');
const db = new Database(dbPath);

try {
  console.log('📦 Creating support_letter_templates table...\n');

  db.exec(`
    CREATE TABLE IF NOT EXISTS support_letter_templates (
      id TEXT PRIMARY KEY,
      letter_type TEXT NOT NULL, -- dot_director, governor, partner_state, mpo, private_sector, congressional
      grant_type TEXT, -- SMART, RAISE, ATCMTD, INFRA, PROTECT, generic

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

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_letter_type ON support_letter_templates(letter_type);
    CREATE INDEX IF NOT EXISTS idx_letter_grant_type ON support_letter_templates(grant_type);
  `);

  console.log('✅ support_letter_templates table created successfully\n');
  console.log('📊 Table structure:');
  console.log('   - id: Unique identifier');
  console.log('   - letter_type: Type of letter (DOT Director, Governor, etc.)');
  console.log('   - grant_type: Grant program (SMART, RAISE, etc.)');
  console.log('   - Template content fields (subject, salutation, body, closing, signature)');
  console.log('   - required_fields/optional_fields: JSON arrays of template variables');
  console.log('   - description/usage_notes: Documentation\n');

  db.close();
} catch (error) {
  console.error('❌ Error creating table:', error);
  process.exit(1);
}

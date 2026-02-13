/**
 * Create ifc_models table in PostgreSQL with BYTEA file storage
 * This sets up the infrastructure for database-backed IFC file storage
 */

const { Pool } = require('pg');

async function createTable() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('🏗️  Creating IFC models infrastructure\n');

  try {
    // Create ifc_models table with file_data BYTEA column
    console.log('📦 Creating ifc_models table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ifc_models (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        file_path TEXT,
        file_size INTEGER,
        ifc_schema TEXT,
        project_name TEXT,
        uploaded_by TEXT,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        state_key TEXT,
        latitude REAL,
        longitude REAL,
        route TEXT,
        milepost REAL,
        extraction_status TEXT DEFAULT 'pending',
        extraction_log TEXT,
        total_elements INTEGER DEFAULT 0,
        metadata TEXT,
        file_data BYTEA,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ ifc_models table created\n');

    // Create ifc_elements table
    console.log('📦 Creating ifc_elements table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ifc_elements (
        id SERIAL PRIMARY KEY,
        model_id INTEGER REFERENCES ifc_models(id) ON DELETE CASCADE,
        express_id INTEGER,
        ifc_type TEXT,
        ifc_class TEXT,
        name TEXT,
        description TEXT,
        global_id TEXT,
        object_type TEXT,
        tag TEXT,
        properties TEXT,
        geometry_type TEXT,
        has_geometry BOOLEAN DEFAULT false,
        v2x_applicable BOOLEAN DEFAULT false,
        av_critical BOOLEAN DEFAULT false,
        extracted_properties TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ ifc_elements table created\n');

    // Create ifc_gaps table
    console.log('📦 Creating ifc_gaps table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ifc_gaps (
        id SERIAL PRIMARY KEY,
        model_id INTEGER REFERENCES ifc_models(id) ON DELETE CASCADE,
        element_id INTEGER REFERENCES ifc_elements(id) ON DELETE CASCADE,
        property_name TEXT NOT NULL,
        required_for TEXT,
        severity TEXT DEFAULT 'medium',
        recommendation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ ifc_gaps table created\n');

    // Create indexes for better query performance
    console.log('🔧 Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ifc_elements_model_id ON ifc_elements(model_id);
      CREATE INDEX IF NOT EXISTS idx_ifc_elements_v2x ON ifc_elements(v2x_applicable);
      CREATE INDEX IF NOT EXISTS idx_ifc_elements_av ON ifc_elements(av_critical);
      CREATE INDEX IF NOT EXISTS idx_ifc_gaps_model_id ON ifc_gaps(model_id);
      CREATE INDEX IF NOT EXISTS idx_ifc_gaps_element_id ON ifc_gaps(element_id);
    `);
    console.log('✅ Indexes created\n');

    // Check current tables
    const result = await pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename LIKE 'ifc%'
      ORDER BY tablename
    `);

    console.log('📊 IFC Infrastructure Tables:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.tablename}`);
    });

    await pool.end();
    console.log('\n✅ IFC models infrastructure ready!');
    console.log('\nNext steps:');
    console.log('  1. Deploy updated code to Railway');
    console.log('  2. Upload IFC files through the UI');
    console.log('  3. Files will be stored in database and persist across redeploys');

  } catch (err) {
    console.error('❌ Error creating tables:', err.message);
    console.error(err);
    await pool.end();
    process.exit(1);
  }
}

createTable();

#!/usr/bin/env node

/**
 * Load additional IFC files (models 18 and 19) into database
 */

const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
});

const NEW_IFC_FILES = [
  {
    id: 18,
    filename: 'Aastho_IFC4.3 Bridge(Orginal Allplan Export).ifc',
    filepath: '/Users/mattmiller/Downloads/Aastho_IFC4.3 Bridge(Orginal Allplan Export).ifc',
    description: 'AASHTO IFC 4.3 Bridge Model - Original Allplan Export'
  },
  {
    id: 19,
    filename: 'OBM_16080108_HRGreen_0322_18651_Z10.ifc',
    filepath: '/Users/mattmiller/Downloads/OBM_16080108_HRGreen_0322_18651_Z10.ifc',
    description: 'HRGreen Bridge Model OBM_16080108'
  }
];

async function main() {
  console.log('🔄 Loading additional IFC files into database...\n');

  // First, check current schema and models
  console.log('📋 Checking current database state...');
  const schemaResult = await pool.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_name = 'ifc_models'
     ORDER BY ordinal_position`
  );

  console.log('Columns in ifc_models table:');
  schemaResult.rows.forEach(row => {
    console.log(`  ${row.column_name}: ${row.data_type}`);
  });

  const currentModels = await pool.query('SELECT id, filename, extraction_status FROM ifc_models ORDER BY id');
  console.log(`\nCurrent models in database: ${currentModels.rows.length}`);
  currentModels.rows.forEach(row => {
    console.log(`  ID ${row.id}: ${row.filename} - ${row.extraction_status || 'no status'}`);
  });

  console.log('\n📂 Processing new IFC files...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const file of NEW_IFC_FILES) {
    try {
      console.log(`Processing: ${file.filename} (ID: ${file.id})`);

      // Check if file exists
      if (!fs.existsSync(file.filepath)) {
        console.log(`   ❌ File not found at: ${file.filepath}`);
        errorCount++;
        continue;
      }

      // Read file as buffer
      const fileBuffer = fs.readFileSync(file.filepath);
      const fileSizeKB = (fileBuffer.length / 1024).toFixed(2);
      const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
      console.log(`   📏 File size: ${fileSizeKB} KB (${fileSizeMB} MB)`);

      // Check if model ID already exists
      const existingCheck = await pool.query('SELECT id FROM ifc_models WHERE id = $1', [file.id]);

      if (existingCheck.rows.length > 0) {
        console.log(`   ℹ️  Model ID ${file.id} exists, updating with file data...`);

        // Update existing record
        const result = await pool.query(
          `UPDATE ifc_models
           SET file_data = $1,
               file_path = $2,
               file_size = $3,
               extraction_status = 'completed',
               updated_at = NOW()
           WHERE id = $4
           RETURNING id, filename`,
          [fileBuffer, file.filepath, fileBuffer.length, file.id]
        );

        console.log(`   ✅ Updated existing model`);
      } else {
        console.log(`   ℹ️  Model ID ${file.id} doesn't exist, creating new record...`);

        // Insert new record
        const result = await pool.query(
          `INSERT INTO ifc_models (id, filename, file_path, file_data, file_size, extraction_status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'completed', NOW(), NOW())
           RETURNING id, filename`,
          [file.id, file.filename, file.filepath, fileBuffer, fileBuffer.length]
        );

        console.log(`   ✅ Created new model`);
      }

      successCount++;
    } catch (error) {
      console.error(`   ❌ Error loading ${file.filename}:`, error.message);
      errorCount++;
    }

    console.log('');
  }

  console.log('📊 Summary:');
  console.log(`   ✅ Successfully loaded: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📦 Total processed: ${NEW_IFC_FILES.length}`);

  // Verify all models
  console.log('\n🔍 Verifying all models in database...');
  const allModels = await pool.query(
    `SELECT id, filename, extraction_status,
            CASE WHEN file_data IS NOT NULL THEN 'YES' ELSE 'NO' END as has_file_data,
            LENGTH(file_data) as file_data_size
     FROM ifc_models
     ORDER BY id`
  );

  console.log(`\nTotal models: ${allModels.rows.length}`);
  allModels.rows.forEach(row => {
    const sizeKB = row.file_data_size ? (row.file_data_size / 1024).toFixed(2) : '0';
    const sizeMB = row.file_data_size ? (row.file_data_size / 1024 / 1024).toFixed(2) : '0';
    console.log(`   ID ${row.id}: ${row.filename}`);
    console.log(`      Status: ${row.extraction_status || 'NULL'}`);
    console.log(`      Has file_data: ${row.has_file_data} (${sizeKB} KB / ${sizeMB} MB)`);
  });

  await pool.end();
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

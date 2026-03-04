#!/usr/bin/env node

/**
 * Load IFC files from OneDrive folder into database as BYTEA blobs
 * This fixes the BIM model viewer by ensuring files are stored in the database
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
});

const IFC_FILES = [
  {
    id: 11,
    filename: '200006B12_ABUT1_Rebar.ifc',
    filepath: '/Users/mattmiller/Downloads/OneDrive_2_3-2-2026/200006B12_ABUT1_Rebar.ifc'
  },
  {
    id: 12,
    filename: '200006B12_ABUT2_Rebar.ifc',
    filepath: '/Users/mattmiller/Downloads/OneDrive_2_3-2-2026/200006B12_ABUT2_Rebar.ifc'
  },
  {
    id: 13,
    filename: 'Roadway Corridor and Features Example-TxDOT_v2.ifc',
    filepath: '/Users/mattmiller/Downloads/OneDrive_2_3-2-2026/Roadway Corridor and Features Example-TxDOT_v2.ifc'
  },
  {
    id: 17,
    filename: '_200006B12_STR1-Primary Bridge Model.ifc',
    filepath: '/Users/mattmiller/Downloads/OneDrive_2_3-2-2026/_200006B12_STR1-Primary Bridge Model.ifc'
  }
];

async function loadIFCFilesToDatabase() {
  console.log('🔄 Loading IFC files into database...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const file of IFC_FILES) {
    try {
      console.log(`📂 Processing: ${file.filename} (ID: ${file.id})`);

      // Check if file exists
      if (!fs.existsSync(file.filepath)) {
        console.log(`   ❌ File not found at: ${file.filepath}`);
        errorCount++;
        continue;
      }

      // Read file as buffer
      const fileBuffer = fs.readFileSync(file.filepath);
      const fileSizeKB = (fileBuffer.length / 1024).toFixed(2);
      console.log(`   📏 File size: ${fileSizeKB} KB`);

      // Update database with file data
      const result = await pool.query(
        `UPDATE ifc_models
         SET file_data = $1,
             file_path = $2,
             file_size = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, filename`,
        [fileBuffer, file.filepath, fileBuffer.length, file.id]
      );

      if (result.rowCount > 0) {
        console.log(`   ✅ Successfully loaded into database`);
        successCount++;
      } else {
        console.log(`   ⚠️  Model ID ${file.id} not found in database`);
        errorCount++;
      }

    } catch (error) {
      console.error(`   ❌ Error loading ${file.filename}:`, error.message);
      errorCount++;
    }

    console.log(''); // blank line
  }

  console.log('📊 Summary:');
  console.log(`   ✅ Successfully loaded: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📦 Total processed: ${IFC_FILES.length}`);

  // Verify loaded files
  console.log('\n🔍 Verifying database contents...');
  const verification = await pool.query(
    `SELECT id, filename,
            CASE WHEN file_data IS NOT NULL THEN 'YES' ELSE 'NO' END as has_file_data,
            LENGTH(file_data) as file_data_size,
            file_path
     FROM ifc_models
     WHERE id IN ($1, $2, $3, $4)
     ORDER BY id`,
    [11, 12, 13, 17]
  );

  console.log('\nDatabase Status:');
  verification.rows.forEach(row => {
    const sizeKB = row.file_data_size ? (row.file_data_size / 1024).toFixed(2) : '0';
    console.log(`   ID ${row.id}: ${row.filename}`);
    console.log(`      Has file_data: ${row.has_file_data} (${sizeKB} KB)`);
    console.log(`      File path: ${row.file_path || 'NULL'}`);
  });

  await pool.end();
  console.log('\n✅ Done!');
}

// Run the script
loadIFCFilesToDatabase().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

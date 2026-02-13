/**
 * Migrate IFC file storage from filesystem to PostgreSQL database
 * This solves the issue of files vanishing on Railway redeployments
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function migrateIFCStorage() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('📦 Migrating IFC file storage to database\n');

  try {
    // Step 1: Add file_data column to ifc_models table (if not exists)
    console.log('🔧 Adding file_data BYTEA column to ifc_models table...');
    await pool.query(`
      ALTER TABLE ifc_models
      ADD COLUMN IF NOT EXISTS file_data BYTEA
    `);
    console.log('✅ Column added\n');

    // Step 2: Check for existing IFC files on filesystem and migrate them
    console.log('🔍 Checking for existing IFC files on filesystem...');

    const models = await pool.query('SELECT id, file_path, filename FROM ifc_models WHERE file_data IS NULL');
    console.log(`Found ${models.rows.length} models without file data in database\n`);

    if (models.rows.length === 0) {
      console.log('✅ All models already have file data in database');
      await pool.end();
      return;
    }

    // Step 3: Migrate each file from filesystem to database
    let migrated = 0;
    let notFound = 0;

    for (const model of models.rows) {
      const possiblePaths = [
        model.file_path,
        path.join(__dirname, '..', 'uploads', 'ifc', path.basename(model.file_path)),
        path.join(__dirname, '..', 'uploads', path.basename(model.file_path))
      ];

      let fileData = null;
      let foundPath = null;

      // Try to find the file in possible locations
      for (const filePath of possiblePaths) {
        try {
          await fs.access(filePath);
          fileData = await fs.readFile(filePath);
          foundPath = filePath;
          break;
        } catch (err) {
          // File not found at this path, try next
          continue;
        }
      }

      if (fileData) {
        // Store file in database
        await pool.query(
          'UPDATE ifc_models SET file_data = $1 WHERE id = $2',
          [fileData, model.id]
        );
        console.log(`✅ Migrated: ${model.filename} (${(fileData.length / 1024 / 1024).toFixed(2)} MB) from ${foundPath}`);
        migrated++;
      } else {
        console.log(`⚠️  File not found: ${model.filename} (ID: ${model.id})`);
        notFound++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Migrated: ${migrated} files`);
    console.log(`   ⚠️  Not found: ${notFound} files`);

    if (notFound > 0) {
      console.log(`\n⚠️  WARNING: ${notFound} files could not be found on filesystem.`);
      console.log(`   These models will need to be re-uploaded through the UI.`);
    }

    await pool.end();
    console.log('\n✅ Migration complete!');

  } catch (err) {
    console.error('❌ Migration error:', err.message);
    console.error(err);
    await pool.end();
    process.exit(1);
  }
}

migrateIFCStorage();

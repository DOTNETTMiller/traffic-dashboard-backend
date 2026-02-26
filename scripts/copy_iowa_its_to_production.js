/**
 * Copy Iowa ITS Equipment from Local SQLite to Production PostgreSQL
 *
 * This script exports Iowa ITS equipment from the local states.db and
 * imports it into the production PostgreSQL database on Railway.
 */

const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  console.log('Usage: DATABASE_URL="your-postgres-url" node scripts/copy_iowa_its_to_production.js');
  process.exit(1);
}

async function copyIowaITSToProduction() {
  // Connect to local SQLite database
  const dbPath = path.join(__dirname, '..', 'states.db');
  const sqliteDb = new Database(dbPath, { readonly: true });

  // Connect to PostgreSQL
  const pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Starting Iowa ITS Equipment migration to production...\n');

    // Get all Iowa ITS equipment from SQLite
    const iowaEquipment = sqliteDb.prepare(`
      SELECT * FROM its_equipment WHERE state_key = 'ia'
    `).all();

    console.log(`📊 Found ${iowaEquipment.length} Iowa ITS equipment items in local database`);

    if (iowaEquipment.length === 0) {
      console.log('⚠️  No Iowa equipment to migrate');
      return;
    }

    // Create table if it doesn't exist
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS its_equipment (
        id TEXT PRIMARY KEY,
        state_key TEXT NOT NULL,
        equipment_type TEXT NOT NULL,
        equipment_subtype TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        elevation REAL,
        location_description TEXT,
        route TEXT,
        milepost REAL,
        manufacturer TEXT,
        model TEXT,
        serial_number TEXT,
        installation_date TEXT,
        status TEXT DEFAULT 'active',
        arc_its_id TEXT,
        arc_its_category TEXT,
        arc_its_function TEXT,
        arc_its_interface TEXT,
        rsu_id TEXT,
        rsu_mode TEXT,
        communication_range INTEGER,
        supported_protocols TEXT,
        dms_type TEXT,
        display_technology TEXT,
        message_capacity INTEGER,
        camera_type TEXT,
        resolution TEXT,
        field_of_view INTEGER,
        stream_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Table structure verified\n');

    // Delete existing Iowa equipment
    const deleteResult = await pgPool.query(`
      DELETE FROM its_equipment WHERE state_key = 'ia'
    `);
    console.log(`🗑️  Deleted ${deleteResult.rowCount} existing Iowa records\n`);

    // Insert equipment in batches
    const BATCH_SIZE = 100;
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < iowaEquipment.length; i += BATCH_SIZE) {
      const batch = iowaEquipment.slice(i, i + BATCH_SIZE);

      const values = [];
      const placeholders = [];

      batch.forEach((item, idx) => {
        const baseIdx = idx * 11; // 11 fields including stream_url, notes, location_description

        placeholders.push(`(
          $${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4},
          $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7}, $${baseIdx + 8},
          $${baseIdx + 9}, $${baseIdx + 10}, $${baseIdx + 11}
        )`);

        values.push(
          item.id,
          item.state_key,
          item.equipment_type,
          item.equipment_subtype,
          item.latitude,
          item.longitude,
          item.status || 'active',
          item.stream_url || null,
          item.notes || null,
          item.location_description || null,
          new Date()
        );
      });

      try {
        const insertQuery = `
          INSERT INTO its_equipment (
            id, state_key, equipment_type, equipment_subtype,
            latitude, longitude, status, stream_url, notes,
            location_description, updated_at
          ) VALUES ${placeholders.join(', ')}
          ON CONFLICT (id) DO UPDATE SET
            equipment_type = EXCLUDED.equipment_type,
            equipment_subtype = EXCLUDED.equipment_subtype,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            status = EXCLUDED.status,
            stream_url = EXCLUDED.stream_url,
            notes = EXCLUDED.notes,
            location_description = EXCLUDED.location_description,
            updated_at = EXCLUDED.updated_at
        `;

        await pgPool.query(insertQuery, values);
        imported += batch.length;

        process.stdout.write(`\r📥 Progress: ${imported}/${iowaEquipment.length} (${Math.round(imported/iowaEquipment.length*100)}%)`);
      } catch (err) {
        console.error(`\n❌ Error importing batch starting at ${i}:`, err.message);
        failed += batch.length;
      }
    }

    console.log(`\n\n✅ Migration complete!`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${iowaEquipment.length}\n`);

    // Verify import
    const verifyResult = await pgPool.query(`
      SELECT COUNT(*) as count, equipment_type
      FROM its_equipment
      WHERE state_key = 'ia'
      GROUP BY equipment_type
      ORDER BY count DESC
    `);

    console.log('📊 Iowa ITS Equipment in Production:');
    verifyResult.rows.forEach(row => {
      console.log(`   ${row.equipment_type}: ${row.count}`);
    });

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    sqliteDb.close();
    await pgPool.end();
  }
}

// Run migration
copyIowaITSToProduction()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

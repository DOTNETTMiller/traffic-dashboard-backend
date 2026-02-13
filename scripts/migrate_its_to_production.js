const Database = require('better-sqlite3');
const { Pool } = require('pg');

/**
 * Migrate ITS equipment data from local SQLite to production PostgreSQL
 */

async function migrate() {
  console.log('🚀 Migrating ITS Equipment to Production PostgreSQL\n');

  // Open local SQLite database
  const sqlite = new Database('states.db', { readonly: true });

  // Connect to production PostgreSQL
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL ||
      'postgres://postgres:REDACTED_PASSWORD@tramway.proxy.rlwy.net:14217/railway'
  });

  try {
    // Get all ITS equipment from SQLite
    const equipment = sqlite.prepare('SELECT * FROM its_equipment').all();

    console.log(`📦 Found ${equipment.length} ITS equipment records in local database\n`);

    if (equipment.length === 0) {
      console.log('⚠️  No data to migrate');
      return;
    }

    // Show sample
    console.log('Sample record:');
    console.log(JSON.stringify(equipment[0], null, 2));
    console.log('');

    console.log('🔄 Migrating to PostgreSQL...\n');

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of equipment) {
      try {
        // Try to insert, on conflict update
        const query = `
          INSERT INTO its_equipment (
            id, equipment_id, equipment_type, description,
            latitude, longitude, state_key, corridor,
            milepost, status, last_updated, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            equipment_id = EXCLUDED.equipment_id,
            equipment_type = EXCLUDED.equipment_type,
            description = EXCLUDED.description,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            state_key = EXCLUDED.state_key,
            corridor = EXCLUDED.corridor,
            milepost = EXCLUDED.milepost,
            status = EXCLUDED.status,
            last_updated = EXCLUDED.last_updated,
            metadata = EXCLUDED.metadata
        `;

        const values = [
          item.id,
          item.equipment_id,
          item.equipment_type,
          item.description,
          item.latitude,
          item.longitude,
          item.state_key,
          item.corridor,
          item.milepost,
          item.status || 'active',
          item.last_updated || new Date().toISOString(),
          item.metadata ? JSON.stringify(item.metadata) : null
        ];

        const result = await pgPool.query(query, values);

        if (result.rowCount > 0) {
          inserted++;
          if (inserted % 100 === 0) {
            console.log(`  ✓ Migrated ${inserted}/${equipment.length}...`);
          }
        }
      } catch (err) {
        console.error(`  ❌ Error migrating record ${item.id}:`, err.message);
        skipped++;
      }
    }

    console.log('\n✅ Migration complete!');
    console.log(`   Inserted/Updated: ${inserted}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${equipment.length}\n`);

    // Verify
    const countResult = await pgPool.query('SELECT COUNT(*) as count FROM its_equipment');
    console.log(`📊 Production database now has ${countResult.rows[0].count} ITS equipment records`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    sqlite.close();
    await pgPool.end();
  }
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});

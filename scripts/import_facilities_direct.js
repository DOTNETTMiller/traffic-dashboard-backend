// Import facilities directly to production database using database adapter
const Database = require('../database.js');
const fs = require('fs');

const db = new Database.constructor();

async function importFacilities() {
  console.log('\n📥 Importing parking facilities to production database...\n');

  await db.init();

  // Read local facilities
  const facilities = db.db.prepare(`
    SELECT facility_id, site_id, state, avg_capacity,
           latitude, longitude
    FROM parking_facilities
    ORDER BY state, facility_id
  `).all();

  console.log(`Found ${facilities.length} local facilities to import\n`);

  // Clear existing production data (if using PostgreSQL)
  if (process.env.DATABASE_URL || process.env.PGDATABASE) {
    console.log('🗑️  Clearing existing production facilities...');
    await db.runAsync('DELETE FROM parking_facilities');
  }

  // Insert facilities in batches
  let imported = 0;
  const batchSize = 50;

  for (let i = 0; i < facilities.length; i += batchSize) {
    const batch = facilities.slice(i, i + batchSize);

    for (const f of batch) {
      try {
        await db.runAsync(
          `INSERT INTO parking_facilities
           (facility_id, site_id, state, capacity, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (facility_id) DO UPDATE SET
             site_id = EXCLUDED.site_id,
             state = EXCLUDED.state,
             capacity = EXCLUDED.capacity,
             latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude`,
          [f.facility_id, f.site_id, f.state, f.avg_capacity || 0, f.latitude || 0, f.longitude || 0]
        );
        imported++;
      } catch (err) {
        console.error(`Error importing ${f.facility_id}:`, err.message);
      }
    }

    console.log(`✅ Imported batch ${Math.floor(i / batchSize) + 1}: ${imported}/${facilities.length} facilities`);
  }

  // Count by state in production
  const stateCountsQuery = `
    SELECT state, COUNT(*) as count
    FROM parking_facilities
    GROUP BY state
    ORDER BY state
  `;

  const stateCounts = await db.allAsync(stateCountsQuery);

  console.log('\n📊 Production facilities by state:');
  stateCounts.forEach(row => {
    console.log(`  ${row.state}: ${row.count}`);
  });

  console.log(`\n✅ Import complete: ${imported} facilities\n`);
  process.exit(0);
}

importFacilities().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

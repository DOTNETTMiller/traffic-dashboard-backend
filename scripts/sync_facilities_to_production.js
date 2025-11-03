// Export facilities from local SQLite and prepare for PostgreSQL import
const Database = require('../database.js');
const fs = require('fs');

const db = new Database.constructor();

async function exportFacilities() {
  console.log('\n📤 Exporting parking facilities for production sync...\n');

  await db.init();

  // Get all facilities from local database
  const facilities = db.db.prepare(`
    SELECT facility_id, site_id, state, avg_capacity,
           latitude, longitude
    FROM parking_facilities
    ORDER BY state, facility_id
  `).all();

  console.log(`Found ${facilities.length} facilities\n`);

  // Count by state
  const byState = {};
  facilities.forEach(f => {
    byState[f.state] = (byState[f.state] || 0) + 1;
  });

  console.log('Facilities by state:');
  Object.entries(byState).sort().forEach(([state, count]) => {
    console.log(`  ${state}: ${count}`);
  });
  console.log();

  // Generate PostgreSQL INSERT statements
  const sqlStatements = [];

  // First, clear existing data
  sqlStatements.push(`-- Clear existing parking facilities
TRUNCATE TABLE parking_facilities CASCADE;`);

  // Generate INSERT statements in batches
  const batchSize = 50;
  for (let i = 0; i < facilities.length; i += batchSize) {
    const batch = facilities.slice(i, i + batchSize);

    const values = batch.map(f => {
      return `(
        '${f.facility_id}',
        '${f.site_id}',
        '${f.state}',
        ${f.avg_capacity || 0},
        ${f.latitude || 0},
        ${f.longitude || 0}
      )`;
    }).join(',\n  ');

    sqlStatements.push(`
-- Batch ${Math.floor(i / batchSize) + 1} (${batch.length} facilities)
INSERT INTO parking_facilities
  (facility_id, site_id, state, capacity, latitude, longitude)
VALUES
  ${values};
`);
  }

  // Write to file
  const sqlContent = sqlStatements.join('\n\n');
  const outputFile = 'scripts/import_facilities_to_production.sql';
  fs.writeFileSync(outputFile, sqlContent);

  console.log(`✅ Generated SQL file: ${outputFile}`);
  console.log(`📝 Total statements: ${sqlStatements.length}`);
  console.log(`\nTo apply to production:`);
  console.log(`  railway run psql $DATABASE_URL < ${outputFile}`);
  console.log();
}

exportFacilities().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

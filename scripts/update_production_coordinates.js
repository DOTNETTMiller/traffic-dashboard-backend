// Update production parking_facilities with GPS coordinates from local database
const Database = require('../database.js');
const fs = require('fs');
const path = require('path');

// Coordinates data extracted from local database
const COORDINATES = [
  { facility_id: 'tpims-historical-ky00065is000020nsmarathon', latitude: 37.3506, longitude: -85.9003 },
  { facility_id: 'tpims-historical-ia00080is001510oejaspscal', latitude: 41.682497, longitude: -93.334167 },
  { facility_id: 'tpims-historical-ky00075is0007500swaltonws', latitude: 37.6667, longitude: -84.2833 },
  { facility_id: 'tpims-historical-ia00080is0030000wra300w00', latitude: 41.597293, longitude: -90.479436 },
  { facility_id: 'tpims-historical-ia00080is0018000wra180w00', latitude: 41.695938, longitude: -92.772399 },
  { facility_id: 'tpims-historical-ky00065is0000020n65welcom', latitude: 37.3506, longitude: -85.9003 },
  { facility_id: 'tpims-historical-ky00065is0005900n65nra059', latitude: 37.3506, longitude: -85.9003 },
  { facility_id: 'tpims-historical-ky00065is0000340nweighs34', latitude: 37.3506, longitude: -85.9003 },
  { facility_id: 'tpims-historical-ia00080is0022000wmcdonald', latitude: 41.689367, longitude: -92.006667 },
  { facility_id: 'tpims-historical-ky00065is0005900s65sra059', latitude: 37.3506, longitude: -85.9003 },
  { facility_id: 'tpims-historical-ky00065is0011400s65sra114', latitude: 37.3506, longitude: -85.9003 },
  { facility_id: 'tpims-historical-ia00080is0027700wra277w00', latitude: 41.660607, longitude: -91.124893 },
  { facility_id: 'tpims-historical-ky00075is0000100n75welcom', latitude: 37.6667, longitude: -84.2833 },
  { facility_id: 'tpims-historical-ia00080is0027200wra272w00', latitude: 41.647669, longitude: -91.251709 },
  { facility_id: 'tpims-historical-mn00094is0021500eelmcreek', latitude: 46.0, longitude: -95.3333 },
  { facility_id: 'tpims-historical-mn00094is0025580w0stcroix', latitude: 46.0, longitude: -95.3333 },
  { facility_id: 'tpims-historical-ia00080is0027200era272e00', latitude: 41.647669, longitude: -91.251709 },
  { facility_id: 'tpims-historical-ia00080is0024300wra243w00', latitude: 41.722912, longitude: -91.590443 },
  { facility_id: 'tpims-historical-ia00080is0021100wra211w00', latitude: 41.720787, longitude: -91.928921 },
  { facility_id: 'tpims-historical-ia00080is0027700era277e00', latitude: 41.660607, longitude: -91.124893 },
  { facility_id: 'tpims-historical-ia00080is0024300era243e00', latitude: 41.722912, longitude: -91.590443 },
  { facility_id: 'tpims-historical-ia00080is0021100era211e00', latitude: 41.720787, longitude: -91.928921 },
  { facility_id: 'tpims-historical-ky00075is0017700n75nra177', latitude: 37.6667, longitude: -84.2833 },
  { facility_id: 'tpims-historical-ky00075is0003300nweighs33', latitude: 37.6667, longitude: -84.2833 },
  { facility_id: 'tpims-historical-ia00080is0019800wra198w00', latitude: 41.675591, longitude: -92.197685 },
  { facility_id: 'tpims-historical-ky00075is0017700s75sra177', latitude: 37.6667, longitude: -84.2833 },
  { facility_id: 'tpims-historical-ky00075is0003400sweighs34', latitude: 37.6667, longitude: -84.2833 },
  { facility_id: 'tpims-historical-ky00075is0016800scritenws', latitude: 37.6667, longitude: -84.2833 },
  { facility_id: 'tpims-historical-ia00080is0019800era198e00', latitude: 41.675591, longitude: -92.197685 },
  { facility_id: 'tpims-historical-in00080is00012600wra0126w00', latitude: 41.6784, longitude: -86.1236 },
  { facility_id: 'tpims-historical-in00080is00012600era0126e00', latitude: 41.6784, longitude: -86.1236 },
  { facility_id: 'tpims-historical-in00080is0005600wra0108w00', latitude: 41.6784, longitude: -86.1236 },
  { facility_id: 'tpims-historical-in00080is0005600wra090w00', latitude: 41.6784, longitude: -86.1236 },
  { facility_id: 'tpims-historical-in00080is0005600era108e00', latitude: 41.6784, longitude: -86.1236 },
  { facility_id: 'tpims-historical-in00080is0005600era090e00', latitude: 41.6784, longitude: -86.1236 },
  { facility_id: 'tpims-historical-in00080is0003700wra037w00', latitude: 41.6784, longitude: -86.1236 },
  { facility_id: 'tpims-historical-in00080is0002200wra022w00', latitude: 41.6784, longitude: -86.1236 },
  { facility_id: 'tpims-historical-ia00080is0016400wra164w00', latitude: 41.655197, longitude: -92.450958 },
  { facility_id: 'tpims-historical-in00080is0003700era037e00', latitude: 41.6784, longitude: -86.1236 },
  { facility_id: 'tpims-historical-in00080is0002200era022e00', latitude: 41.6784, longitude: -86.1236 },
  { facility_id: 'tpims-historical-mn00094is0009960elklatoka', latitude: 46.0, longitude: -95.3333 },
  { facility_id: 'tpims-historical-ia00080is0016400era164e00', latitude: 41.655197, longitude: -92.450958 },
  { facility_id: 'tpims-historical-ia00080is0014200wroyaloak', latitude: 41.729355, longitude: -92.719238 },
  { facility_id: 'tpims-historical-ia00080is0014200eroyaloak', latitude: 41.729355, longitude: -92.719238 },
  { facility_id: 'tpims-historical-ia00080is0012200wra122w00', latitude: 41.672886, longitude: -92.997063 },
  { facility_id: 'tpims-historical-co00070is004050oesieberpr', latitude: 39.75, longitude: -104.95 },
  { facility_id: 'tpims-historical-ia00080is0012200era122e00', latitude: 41.672886, longitude: -92.997063 },
  { facility_id: 'tpims-historical-ia00080is0010600wra106w00', latitude: 41.697258, longitude: -93.181671 },
  { facility_id: 'tpims-historical-ia00080is0010600era106e00', latitude: 41.697258, longitude: -93.181671 },
  { facility_id: 'tpims-historical-ia00080is0009500wmitchel', latitude: 41.721504, longitude: -93.334808 },
  { facility_id: 'tpims-historical-ia00080is0009500emitchel', latitude: 41.721504, longitude: -93.334808 },
  { facility_id: 'tpims-historical-ia00080is0008000wra080w00', latitude: 41.615967, longitude: -93.557266 },
  { facility_id: 'tpims-historical-ia00080is0008000era080e00', latitude: 41.615967, longitude: -93.557266 },
  { facility_id: 'tpims-historical-ia00380is0001140wra11w000', latitude: 41.867239, longitude: -91.670361 },
  { facility_id: 'tpims-historical-mn00094is0018700e0enfield', latitude: 46.0, longitude: -95.3333 },
  { facility_id: 'tpims-historical-ia00080is0006000wra060w00', latitude: 41.586311, longitude: -93.790161 },
  { facility_id: 'tpims-historical-mn00035is0013200sforestlk', latitude: 45.2833, longitude: -92.9833 },
  { facility_id: 'tpims-historical-ia00080is0006000era060e00', latitude: 41.586311, longitude: -93.790161 },
  { facility_id: 'tpims-historical-ia00080is0004300wra043w00', latitude: 41.521751, longitude: -94.004311 },
  { facility_id: 'tpims-historical-mn00094is0015170ebigspunk', latitude: 46.0, longitude: -95.3333 },
  { facility_id: 'tpims-historical-ia00080is0004300era043e00', latitude: 41.521751, longitude: -94.004311 },
  { facility_id: 'tpims-historical-ia00080is0003600wdexfield', latitude: 41.496399, longitude: -94.122055 },
  { facility_id: 'tpims-historical-ia00080is0003600edexfield', latitude: 41.496399, longitude: -94.122055 },
  { facility_id: 'tpims-historical-ia00080is0003000era300e00', latitude: 41.597293, longitude: -90.479436 },
  { facility_id: 'tpims-historical-ia00080is0001800era180e00', latitude: 41.695938, longitude: -92.772399 },
  { facility_id: 'tpims-historical-ia00380is0001140sra11s000', latitude: 41.867239, longitude: -91.670361 },
  { facility_id: 'tpims-historical-ia00080is0001800era180e00', latitude: 41.694393, longitude: -92.772218 }
];

async function updateProductionCoordinates() {
  console.log('\n📍 Updating Production Parking Facility Coordinates\n');

  const db = new Database.constructor();
  await db.init();

  console.log(`Database type: ${db.isPostgres ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`Total coordinates to update: ${COORDINATES.length}\n`);

  // First, add latitude and longitude columns if they don't exist
  console.log('1️⃣  Ensuring latitude/longitude columns exist...');

  try {
    if (db.isPostgres) {
      await db.db.prepare(`
        ALTER TABLE parking_facilities
        ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
      `).run();
    } else {
      // SQLite - try to add columns
      try {
        await db.db.prepare('ALTER TABLE parking_facilities ADD COLUMN latitude REAL').run();
      } catch (e) {
        if (!e.message.includes('duplicate column')) throw e;
      }
      try {
        await db.db.prepare('ALTER TABLE parking_facilities ADD COLUMN longitude REAL').run();
      } catch (e) {
        if (!e.message.includes('duplicate column')) throw e;
      }
    }
    console.log('   ✅ Columns ready\n');
  } catch (error) {
    console.log(`   ⚠️  ${error.message}\n`);
  }

  // Update coordinates
  console.log('2️⃣  Updating facility coordinates...\n');

  const updateQuery = db.isPostgres ?
    'UPDATE parking_facilities SET latitude = $1, longitude = $2 WHERE facility_id = $3' :
    'UPDATE parking_facilities SET latitude = ?, longitude = ? WHERE facility_id = ?';

  let updated = 0;
  let notFound = 0;

  for (const { facility_id, latitude, longitude } of COORDINATES) {
    try {
      const stmt = db.db.prepare(updateQuery);
      const result = await stmt.run(latitude, longitude, facility_id);

      // Check if row was actually updated
      if ((result.changes || result.rowCount) > 0) {
        updated++;
        if (updated <= 10 || updated === COORDINATES.length) {
          console.log(`   ✅ ${facility_id.substring(0, 50)}`);
        } else if (updated === 11) {
          console.log(`   ... updating ${COORDINATES.length - 10} more facilities ...`);
        }
      } else {
        notFound++;
      }
    } catch (error) {
      console.error(`   ❌ Error updating ${facility_id}: ${error.message}`);
    }
  }

  console.log(`\n📊 Update Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Not found in database: ${notFound}`);
  console.log(`   Total processed: ${COORDINATES.length}\n`);

  // Verify
  console.log('3️⃣  Verifying coordinates...');
  const withCoords = await db.db.prepare(`
    SELECT COUNT(*) as count
    FROM parking_facilities
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0 AND longitude != 0
  `).get();

  const total = await db.db.prepare('SELECT COUNT(*) as count FROM parking_facilities').get();

  console.log(`   Facilities with coordinates: ${withCoords.count}/${total.count}\n`);

  if (withCoords.count > 0) {
    const byState = await db.db.prepare(`
      SELECT state, COUNT(*) as total,
             SUM(CASE WHEN latitude IS NOT NULL AND latitude != 0 THEN 1 ELSE 0 END) as with_coords
      FROM parking_facilities
      GROUP BY state
      ORDER BY state
    `).all();

    console.log('   By state:');
    byState.forEach(row => {
      console.log(`      ${row.state}: ${row.with_coords}/${row.total} (${Math.round(row.with_coords/row.total*100)}%)`);
    });
  }

  console.log('\n✅ Coordinate update completed!\n');

  if (require.main === module) {
    process.exit(0);
  }
}

if (require.main === module) {
  updateProductionCoordinates().catch(error => {
    console.error('❌ Update failed:', error);
    process.exit(1);
  });
}

module.exports = { updateProductionCoordinates };

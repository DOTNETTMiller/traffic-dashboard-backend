// Update parking facility coordinates from camera GIS data
const Database = require('../database.js');

// Camera-equipped facilities with precise GPS coordinates from Iowa DOT GIS
const CAMERA_FACILITIES = [
  {
    facility_id: 'tpims-historical-ia00080is0030000wra300w00',
    name: 'I-80 EB MM 300 (Davenport)',
    latitude: 41.59596,
    longitude: -90.491053
  },
  {
    facility_id: 'tpims-historical-ia00080is0018000era180e00',
    name: 'I-80 EB MM 180 (Grinnell)',
    latitude: 41.694153,
    longitude: -92.773646
  },
  {
    facility_id: 'tpims-historical-ia00080is0014800wra148w00',
    name: 'I-80 EB MM 148 (Mitchellville)',
    latitude: 41.679979,
    longitude: -93.394699
  },
  {
    facility_id: 'tpims-historical-ia00080is0026800wra268w00',
    name: 'I-80 WB MM 268 (Wilton)',
    latitude: 41.645429,
    longitude: -91.086291
  },
  {
    facility_id: 'tpims-historical-ia00080is0018000wra180w00',
    name: 'I-80 WB MM 180 (Grinnell)',
    latitude: 41.696185,
    longitude: -92.772749
  },
  {
    facility_id: 'tpims-historical-ia00080is0001900wra19w000',
    name: 'I-80 WB MM 19 (Underwood)',
    latitude: 41.403845,
    longitude: -95.658712
  },
  {
    facility_id: 'tpims-historical-ia00035is0012000nra120n00',
    name: 'I-35 NB MM 120 (Story City)',
    latitude: 42.128125,
    longitude: -93.553536
  },
  {
    facility_id: 'tpims-historical-ia00035is0012000sra120s00',
    name: 'I-35 SB MM 119 (Story City)',
    latitude: 42.110185,
    longitude: -93.556607
  }
];

async function updateCameraFacilityCoordinates() {
  console.log('\n📍 Updating Camera-Equipped Facility Coordinates from GIS Data\n');

  const db = new Database.constructor();
  await db.init();

  console.log(`Database type: ${db.isPostgres ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`Camera facilities to update: ${CAMERA_FACILITIES.length}\n`);

  // Ensure columns exist
  console.log('1️⃣  Ensuring latitude/longitude columns exist...');
  try {
    if (db.isPostgres) {
      await db.db.prepare(`
        ALTER TABLE parking_facilities
        ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
      `).run();
    } else {
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

  // Update coordinates from camera GIS data
  console.log('2️⃣  Updating facility coordinates from camera GIS data...\n');

  const updateQuery = db.isPostgres
    ? 'UPDATE parking_facilities SET latitude = $1, longitude = $2 WHERE facility_id = $3'
    : 'UPDATE parking_facilities SET latitude = ?, longitude = ? WHERE facility_id = ?';

  let updated = 0;
  let notFound = 0;

  for (const { facility_id, name, latitude, longitude } of CAMERA_FACILITIES) {
    try {
      const stmt = db.db.prepare(updateQuery);
      const result = await stmt.run(latitude, longitude, facility_id);

      if ((result.changes || result.rowCount) > 0) {
        updated++;
        console.log(`   ✅ ${name}`);
        console.log(`      ${facility_id}`);
        console.log(`      Coordinates: ${latitude}, ${longitude}\n`);
      } else {
        notFound++;
        console.log(`   ⚠️  NOT FOUND: ${name}`);
        console.log(`      ${facility_id}\n`);
      }
    } catch (error) {
      console.error(`   ❌ Error updating ${facility_id}: ${error.message}\n`);
    }
  }

  console.log(`\n📊 Update Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Not found in database: ${notFound}`);
  console.log(`   Total processed: ${CAMERA_FACILITIES.length}\n`);

  // Verify
  console.log('3️⃣  Verifying camera facility coordinates...\n');

  for (const { facility_id, name } of CAMERA_FACILITIES) {
    const facility = await db.db.prepare(`
      SELECT latitude, longitude FROM parking_facilities WHERE facility_id = ?
    `).get(facility_id);

    if (facility && facility.latitude && facility.longitude) {
      console.log(`   ✅ ${name}: ${facility.latitude}, ${facility.longitude}`);
    } else {
      console.log(`   ❌ ${name}: Missing or invalid coordinates`);
    }
  }

  console.log('\n✅ Camera facility coordinate update completed!\n');

  if (require.main === module) {
    process.exit(0);
  }
}

if (require.main === module) {
  updateCameraFacilityCoordinates().catch(error => {
    console.error('❌ Update failed:', error);
    process.exit(1);
  });
}

module.exports = { updateCameraFacilityCoordinates };

// Add small coordinate offsets to facilities at identical locations
// This separates NB/SB or EB/WB facilities at the same mile marker
const Database = require('../database.js');

const db = new Database.constructor();

async function addOffsets() {
  console.log('\n📍 Adding coordinate offsets for co-located facilities...\n');

  await db.init();

  // Find facilities with duplicate coordinates
  const duplicates = db.db.prepare(`
    SELECT latitude, longitude, GROUP_CONCAT(facility_id, '|') as facilities, COUNT(*) as count
    FROM parking_facilities
    WHERE latitude <> 0 AND longitude <> 0
    GROUP BY latitude, longitude
    HAVING COUNT(*) > 1
  `).all();

  console.log(`Found ${duplicates.length} locations with multiple facilities\n`);

  let offsetCount = 0;

  for (const dup of duplicates) {
    const facilityIds = dup.facilities.split('|');
    const baseLatitude = dup.latitude;
    const baseLongitude = dup.longitude;

    // Apply small offsets in a circular pattern
    // Offset by ~50 meters (~0.0005 degrees)
    const offsetDistance = 0.0005;
    const angleStep = (2 * Math.PI) / facilityIds.length;

    facilityIds.forEach((facilityId, index) => {
      if (index === 0) return; // Keep first one at original location

      const angle = angleStep * index;
      const latOffset = Math.sin(angle) * offsetDistance;
      const lonOffset = Math.cos(angle) * offsetDistance;

      const newLat = baseLatitude + latOffset;
      const newLon = baseLongitude + lonOffset;

      db.db.prepare(`
        UPDATE parking_facilities
        SET latitude = ?, longitude = ?
        WHERE facility_id = ?
      `).run(newLat, newLon, facilityId);

      offsetCount++;
    });

    console.log(`  Offset ${facilityIds.length} facilities at (${baseLatitude}, ${baseLongitude})`);
  }

  console.log(`\n✅ Applied offsets to ${offsetCount} facilities\n`);
}

addOffsets();

// Apply coordinate offsets to production database
// This separates facilities at identical locations
const Database = require('../database.js');

const db = new Database.constructor();

async function applyOffsets() {
  console.log('\n📍 Applying coordinate offsets for production...\n');

  await db.init();

  // Find facilities with duplicate coordinates
  const duplicates = db.db.prepare(`
    SELECT latitude, longitude, GROUP_CONCAT(facility_id, '|') as facilities, COUNT(*) as count
    FROM parking_facilities
    WHERE latitude <> 0 AND longitude <> 0
    GROUP BY latitude, longitude
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `).all();

  console.log(`Found ${duplicates.length} locations with multiple facilities\n`);

  if (duplicates.length === 0) {
    console.log('✅ No duplicate coordinates found - offsets already applied!\n');
    return;
  }

  let offsetCount = 0;

  for (const dup of duplicates) {
    const facilityIds = dup.facilities.split('|');
    const baseLatitude = dup.latitude;
    const baseLongitude = dup.longitude;

    console.log(`  Processing ${facilityIds.length} facilities at (${baseLatitude}, ${baseLongitude})`);

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
  }

  console.log(`\n✅ Applied offsets to ${offsetCount} facilities\n`);

  // Verify results
  const remaining = db.db.prepare(`
    SELECT COUNT(*) as count
    FROM (
      SELECT latitude, longitude
      FROM parking_facilities
      WHERE latitude <> 0 AND longitude <> 0
      GROUP BY latitude, longitude
      HAVING COUNT(*) > 1
    )
  `).get();

  console.log(`Remaining duplicate locations: ${remaining.count}\n`);
}

applyOffsets().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

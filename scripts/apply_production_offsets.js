// Apply coordinate offsets to production database
// This separates facilities at identical locations
const Database = require('../database.js');

const db = new Database.constructor();

async function applyOffsets() {
  console.log('\n📍 Applying coordinate offsets for production...\n');

  await db.init();

  // Find facilities with duplicate coordinates
  // Use STRING_AGG for PostgreSQL instead of GROUP_CONCAT for SQLite
  const duplicatesQuery = `
    SELECT latitude, longitude,
           STRING_AGG(facility_id, '|') as facilities,
           COUNT(*) as count
    FROM parking_facilities
    WHERE latitude <> 0 AND longitude <> 0
    GROUP BY latitude, longitude
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  const duplicates = await db.allAsync(duplicatesQuery);

  console.log(`Found ${duplicates.length} locations with multiple facilities\n`);

  if (duplicates.length === 0) {
    console.log('✅ No duplicate coordinates found - offsets already applied!\n');
    process.exit(0);
  }

  let offsetCount = 0;

  for (const dup of duplicates) {
    const facilityIds = dup.facilities.split('|');
    const baseLatitude = parseFloat(dup.latitude);
    const baseLongitude = parseFloat(dup.longitude);

    console.log(`  Processing ${facilityIds.length} facilities at (${baseLatitude}, ${baseLongitude})`);

    // Apply small offsets in a circular pattern
    // Offset by ~50 meters (~0.0005 degrees)
    const offsetDistance = 0.0005;
    const angleStep = (2 * Math.PI) / facilityIds.length;

    for (let index = 0; index < facilityIds.length; index++) {
      if (index === 0) continue; // Keep first one at original location

      const facilityId = facilityIds[index];
      const angle = angleStep * index;
      const latOffset = Math.sin(angle) * offsetDistance;
      const lonOffset = Math.cos(angle) * offsetDistance;

      const newLat = baseLatitude + latOffset;
      const newLon = baseLongitude + lonOffset;

      await db.runAsync(
        `UPDATE parking_facilities
         SET latitude = $1, longitude = $2
         WHERE facility_id = $3`,
        [newLat, newLon, facilityId]
      );

      offsetCount++;
    }
  }

  console.log(`\n✅ Applied offsets to ${offsetCount} facilities\n`);

  // Verify results
  const remainingQuery = `
    SELECT COUNT(*) as count
    FROM (
      SELECT latitude, longitude
      FROM parking_facilities
      WHERE latitude <> 0 AND longitude <> 0
      GROUP BY latitude, longitude
      HAVING COUNT(*) > 1
    ) AS duplicates
  `;

  const remaining = await db.getAsync(remainingQuery);

  console.log(`Remaining duplicate locations: ${remaining.count}\n`);
  process.exit(0);
}

applyOffsets().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

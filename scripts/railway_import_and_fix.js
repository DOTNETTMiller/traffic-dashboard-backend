#!/usr/bin/env node
// Run facilities import and coordinate fixes directly in Railway environment
// Usage: railway run node scripts/railway_import_and_fix.js

const Database = require('../database.js');
const fs = require('fs');
const path = require('path');

const db = new Database.constructor();

async function main() {
  console.log('\n🚀 Starting facility import and coordinate fixes...\n');

  try {
    await db.init();
    console.log('✅ Database connected\n');

    // Read facilities data
    const facilitiesPath = path.join(__dirname, 'facilities_data.json');
    const facilitiesData = JSON.parse(fs.readFileSync(facilitiesPath, 'utf8'));
    console.log(`📦 Loaded ${facilitiesData.length} facilities from JSON\n`);

    // Clear existing facilities
    console.log('🗑️  Clearing existing facilities...');
    await db.runAsync('DELETE FROM parking_facilities');
    console.log('✅ Cleared\n');

    // Import facilities
    console.log('📥 Importing facilities...');
    let imported = 0;
    for (const f of facilitiesData) {
      try {
        await db.runAsync(
          `INSERT INTO parking_facilities
           (facility_id, site_id, state, capacity, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [f.facility_id, f.site_id, f.state, f.capacity || 0, f.latitude || 0, f.longitude || 0]
        );
        imported++;
        if (imported % 25 === 0) {
          console.log(`  Progress: ${imported}/${facilitiesData.length}`);
        }
      } catch (err) {
        console.error(`  ⚠️  Error importing ${f.facility_id}:`, err.message);
      }
    }
    console.log(`✅ Imported ${imported} facilities\n`);

    // Get counts by state
    const stateCounts = await db.allAsync(`
      SELECT state, COUNT(*) as count
      FROM parking_facilities
      GROUP BY state
      ORDER BY state
    `);
    console.log('📊 Facilities by state:');
    stateCounts.forEach(row => {
      console.log(`  ${row.state}: ${row.count}`);
    });
    console.log();

    // Apply coordinate offsets
    console.log('📍 Applying coordinate offsets...');
    const duplicates = await db.allAsync(`
      SELECT latitude, longitude,
             STRING_AGG(facility_id, '|') as facilities,
             COUNT(*) as count
      FROM parking_facilities
      WHERE latitude <> 0 AND longitude <> 0
      GROUP BY latitude, longitude
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    console.log(`  Found ${duplicates.length} locations with multiple facilities`);

    let offsetCount = 0;
    for (const dup of duplicates) {
      const facilityIds = dup.facilities.split('|');
      const baseLatitude = parseFloat(dup.latitude);
      const baseLongitude = parseFloat(dup.longitude);

      const offsetDistance = 0.0005; // ~50 meters
      const angleStep = (2 * Math.PI) / facilityIds.length;

      for (let index = 1; index < facilityIds.length; index++) {
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

    console.log(`✅ Applied offsets to ${offsetCount} facilities\n`);
    console.log('🎉 All done! Facilities imported and coordinates fixed.\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

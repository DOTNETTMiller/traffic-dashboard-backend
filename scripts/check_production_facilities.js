#!/usr/bin/env node
// Query production database to see what facilities currently exist
// Usage: railway run node scripts/check_production_facilities.js

const Database = require('../database.js');
const db = new Database.constructor();

async function checkFacilities() {
  console.log('\n🔍 Checking production facilities...\n');

  try {
    await db.init();
    console.log('✅ Database connected\n');

    // Get all facilities
    const allFacilities = await db.allAsync(`
      SELECT facility_id, site_id, state, capacity, latitude, longitude
      FROM parking_facilities
      ORDER BY state, facility_id
    `);

    console.log(`📊 Total facilities in production: ${allFacilities.length}\n`);

    // Count by state
    const stateCounts = await db.allAsync(`
      SELECT state, COUNT(*) as count
      FROM parking_facilities
      GROUP BY state
      ORDER BY state
    `);

    console.log('Facilities by state:');
    stateCounts.forEach(row => {
      console.log(`  ${row.state}: ${row.count}`);
    });
    console.log();

    // Show Iowa facilities specifically
    const iowaFacilities = allFacilities.filter(f => f.state === 'IA');
    console.log(`🌽 Iowa facilities (${iowaFacilities.length}):`);
    iowaFacilities.forEach(f => {
      console.log(`  ${f.facility_id} - Site: ${f.site_id} - Coords: (${f.latitude}, ${f.longitude})`);
    });
    console.log();

    // Check for facilities with zero coordinates
    const zeroCoords = allFacilities.filter(f => f.latitude === 0 || f.longitude === 0);
    if (zeroCoords.length > 0) {
      console.log(`⚠️  Facilities with zero coordinates: ${zeroCoords.length}`);
      zeroCoords.forEach(f => {
        console.log(`  ${f.facility_id} (${f.state}) - (${f.latitude}, ${f.longitude})`);
      });
      console.log();
    }

    // Check for duplicate coordinates
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

    if (duplicates.length > 0) {
      console.log(`📍 Locations with multiple facilities: ${duplicates.length}`);
      duplicates.forEach(dup => {
        console.log(`  (${dup.latitude}, ${dup.longitude}) - ${dup.count} facilities: ${dup.facilities}`);
      });
      console.log();
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

checkFacilities();

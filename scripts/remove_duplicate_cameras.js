#!/usr/bin/env node

/**
 * Remove Duplicate Iowa Cameras
 *
 * Removes duplicate cameras at the same location, keeping the newer
 * ITS_Assets_GDB versions with better data quality
 */

const db = require('../database');

console.log('🔍 Finding duplicate camera locations...\n');

// Find all duplicate camera locations
const duplicateLocations = db.db.prepare(`
  SELECT latitude, longitude, COUNT(*) as count
  FROM its_equipment
  WHERE state_key = 'ia' AND equipment_type = 'camera'
  GROUP BY latitude, longitude
  HAVING count > 1
`).all();

console.log(`📊 Found ${duplicateLocations.length} locations with duplicate cameras\n`);

let totalRemoved = 0;
let keptNew = 0;
let keptOld = 0;

// Process each duplicate location
duplicateLocations.forEach(({ latitude, longitude, count }) => {
  // Get all cameras at this location
  const cameras = db.db.prepare(`
    SELECT id, data_source, stream_url, location_description
    FROM its_equipment
    WHERE state_key = 'ia'
      AND equipment_type = 'camera'
      AND latitude = ?
      AND longitude = ?
    ORDER BY data_source DESC NULLS LAST
  `).all(latitude, longitude);

  // Keep the first one (ITS_Assets_GDB if it exists, otherwise the old one)
  const keepCamera = cameras[0];
  const removeCamera = cameras[1];

  if (cameras.length === 2 && removeCamera) {
    // Delete the duplicate
    const result = db.db.prepare(`
      DELETE FROM its_equipment WHERE id = ?
    `).run(removeCamera.id);

    if (result.changes > 0) {
      totalRemoved++;
      if (keepCamera.data_source === 'ITS_Assets_GDB') {
        keptNew++;
        console.log(`  ✅ Removed old: ${removeCamera.id}`);
        console.log(`     Kept new: ${keepCamera.id} (${keepCamera.location_description})`);
      } else {
        keptOld++;
        console.log(`  ⚠️  Removed: ${removeCamera.id} (kept old format, no newer version available)`);
      }
    }
  }
});

console.log(`\n📊 Cleanup Summary:`);
console.log(`   🗑️  Removed: ${totalRemoved} duplicate cameras`);
console.log(`   ✅ Kept newer ITS_Assets_GDB versions: ${keptNew}`);
console.log(`   ⚠️  Kept older versions (no newer available): ${keptOld}`);

// Verify final counts
const finalCount = db.db.prepare(`
  SELECT COUNT(*) as count
  FROM its_equipment
  WHERE state_key = 'ia' AND equipment_type = 'camera'
`).get();

const finalDuplicates = db.db.prepare(`
  SELECT COUNT(*) as count
  FROM (
    SELECT latitude, longitude, COUNT(*) as c
    FROM its_equipment
    WHERE state_key = 'ia' AND equipment_type = 'camera'
    GROUP BY latitude, longitude
    HAVING c > 1
  )
`).get();

console.log(`\n📈 Final Camera Count: ${finalCount.count}`);
console.log(`   Remaining duplicates: ${finalDuplicates.count} locations\n`);

console.log('✅ Duplicate camera cleanup complete!\n');

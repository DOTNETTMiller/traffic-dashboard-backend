#!/usr/bin/env node

/**
 * Sync ITS Equipment to Sensor Inventory
 *
 * Copies Iowa ITS equipment data from its_equipment table to sensor_inventory
 * for use by the sensor dashboard
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'states.db');
const db = new Database(DB_PATH);

console.log('🔄 Syncing ITS equipment to sensor inventory...\n');

try {
  // Get all Iowa equipment that should be sensors
  const equipment = db.prepare(`
    SELECT
      id,
      equipment_type,
      equipment_subtype,
      latitude,
      longitude,
      route,
      milepost,
      location_description,
      status,
      sensor_type,
      measurement_types,
      notes
    FROM its_equipment
    WHERE state_key = 'ia'
      AND (
        equipment_type = 'sensor'
        OR sensor_type IS NOT NULL
        OR equipment_subtype IN ('rwis', 'traffic', 'bridge', 'weather')
      )
  `).all();

  console.log(`📋 Found ${equipment.length} equipment items to sync\n`);

  // Clear existing sensor inventory (or use INSERT OR REPLACE)
  const clearStmt = db.prepare('DELETE FROM sensor_inventory');
  clearStmt.run();
  console.log('✅ Cleared existing sensor inventory\n');

  // Insert statement
  const insertStmt = db.prepare(`
    INSERT INTO sensor_inventory (
      sensor_id,
      sensor_name,
      sensor_type,
      latitude,
      longitude,
      roadway,
      milepost,
      location_description,
      status,
      capabilities
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;

  equipment.forEach(eq => {
    // Determine sensor type
    const sensorType = eq.sensor_type || eq.equipment_subtype || eq.equipment_type || 'unknown';

    // Generate sensor name from ID and location
    const sensorName = eq.notes?.match(/Detector ID: (.+)/)?.[1] || eq.id;

    // Parse measurement types if available
    let capabilities = null;
    if (eq.measurement_types) {
      try {
        const measurements = JSON.parse(eq.measurement_types);
        capabilities = JSON.stringify({ measurements });
      } catch (e) {
        // ignore parse errors
      }
    }

    insertStmt.run(
      eq.id,
      sensorName,
      sensorType,
      eq.latitude,
      eq.longitude,
      eq.route || eq.location_description,
      eq.milepost,
      eq.location_description,
      eq.status || 'active',
      capabilities,
    );

    inserted++;

    if (inserted % 100 === 0) {
      console.log(`  Synced ${inserted}/${equipment.length} sensors...`);
    }
  });

  console.log(`\n✨ Sync Complete!\n`);
  console.log(`📊 Results:`);
  console.log(`   ✅ Synced: ${inserted} sensors\n`);

  // Show summary by type
  const summary = db.prepare(`
    SELECT sensor_type, COUNT(*) as count
    FROM sensor_inventory
    GROUP BY sensor_type
    ORDER BY count DESC
  `).all();

  console.log('📋 Sensor Inventory by Type:');
  summary.forEach(row => {
    console.log(`   ${row.sensor_type}: ${row.count}`);
  });

  console.log('\n✅ Sensor inventory ready for dashboard!\n');

} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
} finally {
  db.close();
}

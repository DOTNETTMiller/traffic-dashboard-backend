#!/usr/bin/env node

/**
 * Import Iowa ITS Equipment from processed GeoJSON
 *
 * This script imports the 925 Iowa sensors from the previously uploaded
 * and processed GDB file into the its_equipment table.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'states.db');
const GEOJSON_PATH = path.join(__dirname, '..', 'temp', 'ITS_Assets_Export_20251008_102814.gdb_output.geojson');

console.log('📥 Importing Iowa ITS Equipment from GeoJSON...\n');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

try {
  // Read the GeoJSON file
  console.log(`📂 Reading: ${path.basename(GEOJSON_PATH)}`);
  const geojsonContent = fs.readFileSync(GEOJSON_PATH, 'utf8');
  const geojson = JSON.parse(geojsonContent);

  console.log(`✅ Found ${geojson.features.length} features\n`);

  // Prepare insert statement
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO its_equipment (
      id, state_key, equipment_type, equipment_subtype,
      latitude, longitude, location_description, route, milepost,
      status,
      sensor_type, measurement_types,
      data_source, uploaded_by, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  let imported = 0;
  let failed = 0;
  const errors = [];

  // Process each feature
  for (let i = 0; i < geojson.features.length; i++) {
    const feature = geojson.features[i];
    const props = feature.properties || {};
    const coords = feature.geometry?.coordinates;
    const detectorId = props.detector_id || '';

    if (!coords || coords.length < 2) {
      errors.push(`Feature ${i}: Missing coordinates`);
      failed++;
      continue;
    }

    const [lon, lat] = coords;

    try {
      // Detect equipment type from properties
      let equipmentType = 'sensor'; // default
      let sensorType = props.detector_type || 'unknown';

      // Check if it's a specific type based on detector_id patterns
      if (detectorId.includes('RWIS') || detectorId.includes('WX')) {
        sensorType = 'rwis';
      } else if (detectorId.includes('CAM')) {
        equipmentType = 'camera';
      } else if (detectorId.includes('DMS')) {
        equipmentType = 'dms';
      }

      // Build measurement types array
      const measurements = [];
      if (props.avg_speed !== undefined) measurements.push('speed');
      if (props.total_count !== undefined) measurements.push('volume');
      if (props.total_occupancy !== undefined) measurements.push('occupancy');

      // Generate unique ID
      const id = `IA-${detectorId || `sensor-${i}`}-${Date.now().toString(36)}`.replace(/\s+/g, '-');

      // Insert into database
      insertStmt.run(
        id,
        'ia', // state_key (lowercase to match states table)
        equipmentType,
        sensorType, // equipment_subtype
        lat,
        lon,
        props.route_designator || props.routeId || null,
        props.route_designator || null,
        props.measure || null,
        props.status || 'active',
        sensorType,
        measurements.length > 0 ? JSON.stringify(measurements) : null,
        'ITS_Assets_Export_20251008_102814.gdb', // data_source
        'Iowa DOT', // uploaded_by
        `Detector ID: ${detectorId || 'N/A'}` // notes
      );

      imported++;

      if ((i + 1) % 100 === 0) {
        console.log(`  Processed ${i + 1}/${geojson.features.length} features...`);
      }

    } catch (error) {
      errors.push(`Feature ${i} (${detectorId}): ${error.message}`);
      failed++;
    }
  }

  // Log upload to history
  const historyStmt = db.prepare(`
    INSERT INTO gis_upload_history (
      id, state_key, file_name, file_type, file_size,
      records_total, records_imported, records_failed,
      uploaded_by, upload_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `);

  const historyId = `upload-${Date.now()}`;
  historyStmt.run(
    historyId,
    'ia',
    'ITS_Assets_Export_20251008_102814.gdb',
    'gdb',
    null, // file_size
    geojson.features.length,
    imported,
    failed,
    'Iowa DOT',
    'completed'
  );

  console.log(`\n✨ Import Complete!\n`);
  console.log(`📊 Results:`);
  console.log(`   ✅ Imported: ${imported}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (errors.length > 0 && errors.length <= 10) {
    console.log(`\n⚠️  Errors:`);
    errors.forEach(err => console.log(`   - ${err}`));
  } else if (errors.length > 10) {
    console.log(`\n⚠️  ${errors.length} errors (showing first 10):`);
    errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
  }

  // Show summary
  const summary = db.prepare(`
    SELECT
      equipment_type,
      COUNT(*) as count
    FROM its_equipment
    WHERE state_key = 'ia'
    GROUP BY equipment_type
  `).all();

  console.log(`\n📋 Iowa Equipment Summary:`);
  summary.forEach(row => {
    console.log(`   ${row.equipment_type}: ${row.count}`);
  });

} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
} finally {
  db.close();
}

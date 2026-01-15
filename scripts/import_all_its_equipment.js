#!/usr/bin/env node

/**
 * Import All ITS Equipment from Iowa DOT Geodatabase
 *
 * Imports cameras, DMS, and RWIS stations from ITS_Assets geodatabase
 */

const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../database');

const GDB_PATH = '/tmp/ITS_Assets_Export_20251008_102814.gdb';
const TEMP_DIR = '/tmp';

console.log('🚀 Importing all ITS equipment from geodatabase...\n');

// Layer configurations
const layers = [
  {
    name: 'Traffic_Cameras',
    equipmentType: 'camera',
    idField: 'COMMON_ID',
    descField: 'Desc_',
    routeField: 'Route'
  },
  {
    name: 'Digital_Message_Signs__DMS____Active',
    equipmentType: 'dms',
    idField: 'OBJECTID',
    descField: null,
    routeField: null
  },
  {
    name: 'Road_Weather_Information_System__RWIS____Traffic_Data',
    equipmentType: 'sensor',
    subtype: 'rwis',
    idField: 'OBJECTID',
    descField: null,
    routeField: null
  }
];

let totalImported = 0;
let totalSkipped = 0;

// Process each layer
layers.forEach(layerConfig => {
  console.log(`\n📡 Processing ${layerConfig.name}...`);

  // Convert to GeoJSON
  const outputPath = `${TEMP_DIR}/${layerConfig.equipmentType}_${Date.now()}.geojson`;

  try {
    execSync(`ogr2ogr -f GeoJSON -t_srs EPSG:4326 "${outputPath}" "${GDB_PATH}" "${layerConfig.name}"`, {
      stdio: 'ignore'
    });

    const geojson = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    console.log(`   Found ${geojson.features.length} ${layerConfig.equipmentType} features`);

    let imported = 0;
    let skipped = 0;

    // Import each feature
    geojson.features.forEach((feature, idx) => {
      const props = feature.properties;
      const geom = feature.geometry;

      if (!geom || geom.type !== 'Point' || !geom.coordinates) {
        skipped++;
        return;
      }

      const [lon, lat] = geom.coordinates;

      // Generate equipment ID
      let equipmentId;
      if (layerConfig.idField && props[layerConfig.idField]) {
        equipmentId = `IA-${layerConfig.equipmentType.toUpperCase()}-${props[layerConfig.idField]}`;
      } else {
        equipmentId = `IA-${layerConfig.equipmentType.toUpperCase()}-${crypto.randomUUID().substring(0, 8)}`;
      }

      // Check if already exists
      const existing = db.db.prepare('SELECT id FROM its_equipment WHERE id = ?').get(equipmentId);
      if (existing) {
        skipped++;
        return;
      }

      // Prepare equipment record
      const equipment = {
        id: equipmentId,
        state_key: 'ia',
        equipment_type: layerConfig.equipmentType,
        equipment_subtype: layerConfig.subtype || null,
        latitude: lat,
        longitude: lon,
        location_description: props[layerConfig.descField] || props.Desc_ || props.location || null,
        route: props[layerConfig.routeField] || props.Route || null,
        status: 'active',
        data_source: 'ITS_Assets_GDB'
      };

      // Equipment type-specific fields
      if (layerConfig.equipmentType === 'camera') {
        equipment.stream_url = props.VideoURL || props.VideoURL_HB || props.VideoURL_HD || null;
        equipment.camera_type = props.Type || 'fixed';
      }

      // Insert into database
      try {
        const stmt = db.db.prepare(`
          INSERT INTO its_equipment (
            id, state_key, equipment_type, equipment_subtype, latitude, longitude,
            location_description, route, status, stream_url, camera_type, data_source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          equipment.id,
          equipment.state_key,
          equipment.equipment_type,
          equipment.equipment_subtype,
          equipment.latitude,
          equipment.longitude,
          equipment.location_description,
          equipment.route,
          equipment.status,
          equipment.stream_url || null,
          equipment.camera_type || null,
          equipment.data_source
        );

        imported++;
        if (imported <= 5 || imported % 200 === 0) {
          console.log(`   ✅ ${equipmentId} @ ${equipment.location_description || `${lat.toFixed(4)}, ${lon.toFixed(4)}`}`);
        }
      } catch (err) {
        if (!err.message.includes('UNIQUE constraint')) {
          console.error(`   ❌ Error importing ${equipmentId}:`, err.message);
        }
        skipped++;
      }
    });

    console.log(`   📊 ${layerConfig.equipmentType}: ${imported} imported, ${skipped} skipped`);
    totalImported += imported;
    totalSkipped += skipped;

    // Cleanup
    fs.unlinkSync(outputPath);

  } catch (error) {
    console.error(`   ❌ Error processing ${layerConfig.name}:`, error.message);
  }
});

console.log(`\n✅ Import Complete!`);
console.log(`   Total Imported: ${totalImported} devices`);
console.log(`   Total Skipped: ${totalSkipped} (already exist or invalid)`);
console.log(`\n📊 Current Equipment Count:`);

const counts = db.db.prepare(`
  SELECT equipment_type, COUNT(*) as count
  FROM its_equipment
  WHERE state_key = 'ia'
  GROUP BY equipment_type
`).all();

counts.forEach(row => {
  console.log(`   ${row.equipment_type}: ${row.count}`);
});

const total = db.db.prepare(`SELECT COUNT(*) as count FROM its_equipment WHERE state_key = 'ia'`).get();
console.log(`   TOTAL: ${total.count}\n`);

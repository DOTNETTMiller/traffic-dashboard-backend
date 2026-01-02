// Initialize volume data from bundled sources
// This ensures data files are available on Railway's persistent volume

const fs = require('fs');
const path = require('path');

function initVolumeData() {
  console.log('\n🔄 Initializing volume data...\n');

  const bundledFile = path.join(__dirname, '../bundled_data/truck_parking_patterns.json');
  const volumeDir = path.join(__dirname, '../data');
  const volumeFile = path.join(volumeDir, 'truck_parking_patterns.json');

  // Create data directory if needed
  if (!fs.existsSync(volumeDir)) {
    console.log(`📁 Creating data directory: ${volumeDir}`);
    fs.mkdirSync(volumeDir, { recursive: true });
  }

  // Check if file exists on volume
  if (fs.existsSync(volumeFile)) {
    const stats = fs.statSync(volumeFile);
    console.log(`✅ Data file already exists on volume (${(stats.size/1024).toFixed(2)} KB)`);
  } else {
    // Copy bundled file to volume
    if (!fs.existsSync(bundledFile)) {
      console.error(`❌ Bundled file not found: ${bundledFile}`);
      process.exit(1);
    }

    console.log(`📦 Copying bundled data to volume...`);
    console.log(`   From: ${bundledFile}`);
    console.log(`   To: ${volumeFile}`);

    fs.copyFileSync(bundledFile, volumeFile);

    const stats = fs.statSync(volumeFile);
    console.log(`✅ Data file copied successfully (${(stats.size/1024).toFixed(2)} KB)\n`);
  }

  // Initialize sensor data
  initSensorData();
}

async function initSensorData() {
  console.log('\n🛰️  Initializing sensor data...\n');

  try {
    const db = require('../database');

    // First, ensure sensor and ITS equipment tables exist
    console.log('📋 Ensuring sensor and ITS equipment tables exist...\n');

    // Create sensor tables
    const { createSensorTables } = require('./create_sensor_tables');
    await createSensorTables();

    // Create its_equipment table (inline to avoid module loading issues)
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS its_equipment (
        id TEXT PRIMARY KEY,
        state_key TEXT NOT NULL,
        equipment_type TEXT NOT NULL,
        equipment_subtype TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        location_description TEXT,
        route TEXT,
        milepost REAL,
        status TEXT DEFAULT 'active',
        sensor_type TEXT,
        measurement_types TEXT,
        data_source TEXT,
        uploaded_by TEXT,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `);
    console.log('✅ Created its_equipment table');

    // Check if sensor inventory is already populated
    const sensorCount = await db.all('SELECT COUNT(*) as count FROM sensor_inventory', []);
    const count = parseInt(sensorCount[0]?.count || 0);

    if (count > 0) {
      console.log(`✅ Sensor inventory already populated (${count} sensors)\n`);
      return;
    }

    console.log('📦 Loading bundled Iowa sensor data...\n');

    const bundledSensorFile = path.join(__dirname, '../bundled_data/iowa_sensors.geojson');

    if (!fs.existsSync(bundledSensorFile)) {
      console.warn(`⚠️  Bundled sensor file not found: ${bundledSensorFile}`);
      console.warn('   Sensors can be imported via upload interface\n');
      return;
    }

    // Load and parse GeoJSON
    const geojsonContent = fs.readFileSync(bundledSensorFile, 'utf8');
    const geojson = JSON.parse(geojsonContent);

    console.log(`📋 Found ${geojson.features.length} sensor features\n`);

    let imported = 0;

    // Import sensors to its_equipment table
    for (let i = 0; i < geojson.features.length; i++) {
      const feature = geojson.features[i];
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates;
      const detectorId = props.detector_id || '';

      if (!coords || coords.length < 2) {
        continue;
      }

      const [lon, lat] = coords;

      // Detect equipment type from properties
      let equipmentType = 'sensor';
      let sensorType = props.detector_type || 'unknown';

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

      const now = new Date().toISOString();
      await db.runAsync(`
        INSERT OR REPLACE INTO its_equipment (
          id, state_key, equipment_type, equipment_subtype,
          latitude, longitude, location_description, route, milepost,
          status, sensor_type, measurement_types,
          data_source, uploaded_by, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        'ia',
        equipmentType,
        sensorType,
        lat,
        lon,
        props.route_designator || props.routeId || null,
        props.route_designator || null,
        props.measure || null,
        props.status || 'active',
        sensorType,
        measurements.length > 0 ? JSON.stringify(measurements) : null,
        'iowa_sensors.geojson',
        'System Init',
        `Detector ID: ${detectorId || 'N/A'}`,
        now,
        now
      ]);

      imported++;

      if ((i + 1) % 100 === 0) {
        console.log(`  Imported ${i + 1}/${geojson.features.length} sensors...`);
      }
    }

    console.log(`\n✅ Imported ${imported} sensors to ITS equipment\n`);

    // Sync to sensor_inventory
    console.log('🔄 Syncing to sensor inventory...\n');

    const equipment = await db.all(`
      SELECT
        id, equipment_type, equipment_subtype,
        latitude, longitude, route, milepost,
        location_description, status, sensor_type,
        measurement_types, notes
      FROM its_equipment
      WHERE state_key = 'ia'
        AND (equipment_type = 'sensor' OR sensor_type IS NOT NULL
             OR equipment_subtype IN ('rwis', 'traffic', 'bridge', 'weather'))
    `, []);

    for (const eq of equipment) {
      const sensorType = eq.sensor_type || eq.equipment_subtype || eq.equipment_type || 'unknown';
      const sensorName = eq.notes?.match(/Detector ID: (.+)/)?.[1] || eq.id;

      let capabilities = null;
      if (eq.measurement_types) {
        try {
          const measurements = JSON.parse(eq.measurement_types);
          capabilities = JSON.stringify({ measurements });
        } catch (e) {
          // ignore parse errors
        }
      }

      await db.runAsync(`
        INSERT OR REPLACE INTO sensor_inventory (
          sensor_id, sensor_name, sensor_type,
          latitude, longitude, roadway, milepost,
          location_description, status, capabilities
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        eq.id,
        sensorName,
        sensorType,
        eq.latitude,
        eq.longitude,
        eq.route || eq.location_description,
        eq.milepost,
        eq.location_description,
        eq.status || 'active',
        capabilities
      ]);
    }

    const finalCount = await db.all('SELECT COUNT(*) as count FROM sensor_inventory', []);
    console.log(`\n✅ Sensor initialization complete! ${finalCount[0]?.count || 0} sensors ready\n`);

  } catch (error) {
    console.error('❌ Error initializing sensor data:', error);
    console.warn('⚠️  Continuing without sensor data. Sensors can be imported via upload interface.\n');
  }
}

if (require.main === module) {
  (async () => {
    try {
      await initVolumeData();
    } catch (error) {
      console.error('❌ Failed to initialize volume data:', error);
      process.exit(1);
    }
  })();
}

module.exports = { initVolumeData };

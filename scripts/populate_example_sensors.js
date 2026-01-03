/**
 * Populate Example Sensors
 *
 * Creates sample RWIS, traffic, and bridge sensors for testing
 * Based on common Colorado I-70 mountain corridor deployment
 */

const db = require('../database');

const EXAMPLE_SENSORS = [
  // RWIS Sensors
  {
    sensor_id: 'RWIS-I70-MM145',
    sensor_name: 'I-70 Eisenhower Tunnel East',
    sensor_type: 'rwis',
    latitude: 39.6783,
    longitude: -105.9078,
    elevation: 11158,
    roadway: 'I-70',
    direction: 'EB',
    milepost: 145.0,
    location_description: 'Eisenhower Tunnel East Portal',
    manufacturer: 'Vaisala',
    model: 'DST111',
    capabilities: {
      temperature: true,
      friction: true,
      precipitation: true,
      visibility: true,
      wind: true
    },
    status: 'active',
    owner: 'CDOT'
  },
  {
    sensor_id: 'RWIS-I70-MM216',
    sensor_name: 'I-70 Vail Pass Summit',
    sensor_type: 'rwis',
    latitude: 39.5333,
    longitude: -106.2167,
    elevation: 10662,
    roadway: 'I-70',
    direction: 'WB',
    milepost: 216.0,
    location_description: 'Vail Pass Summit',
    manufacturer: 'Vaisala',
    model: 'DST111',
    capabilities: {
      temperature: true,
      friction: true,
      precipitation: true,
      visibility: true,
      wind: true
    },
    status: 'active',
    owner: 'CDOT'
  },
  {
    sensor_id: 'RWIS-I70-MM259',
    sensor_name: 'I-70 Glenwood Canyon',
    sensor_type: 'rwis',
    latitude: 39.5989,
    longitude: -107.3003,
    elevation: 5900,
    roadway: 'I-70',
    direction: 'WB',
    milepost: 259.0,
    location_description: 'Glenwood Canyon',
    manufacturer: 'Vaisala',
    model: 'DST111',
    capabilities: {
      temperature: true,
      friction: true,
      visibility: true,
      wind: true
    },
    status: 'active',
    owner: 'CDOT'
  },

  // Traffic Sensors
  {
    sensor_id: 'TRAFFIC-I70-MM201',
    sensor_name: 'I-70 MM 201 Loop Detector',
    sensor_type: 'traffic',
    latitude: 39.7392,
    longitude: -105.0000,
    roadway: 'I-70',
    direction: 'EB',
    milepost: 201.0,
    location_description: 'I-70 EB approaching Denver',
    manufacturer: 'Wavetronix',
    model: 'SmartSensor HD',
    capabilities: {
      volume: true,
      speed: true,
      occupancy: true,
      classification: true
    },
    status: 'active',
    owner: 'CDOT'
  },
  {
    sensor_id: 'TRAFFIC-I25-MM200',
    sensor_name: 'I-25 MM 200 Radar Detector',
    sensor_type: 'traffic',
    latitude: 39.6100,
    longitude: -104.9500,
    roadway: 'I-25',
    direction: 'NB',
    milepost: 200.0,
    location_description: 'I-25 NB Castle Rock',
    manufacturer: 'Wavetronix',
    model: 'SmartSensor Matrix',
    capabilities: {
      volume: true,
      speed: true,
      occupancy: true
    },
    status: 'active',
    owner: 'CDOT'
  },

  // Bridge Sensors
  {
    sensor_id: 'BRIDGE-US6-CLEAR-CREEK',
    sensor_name: 'Clear Creek Bridge Height Monitor',
    sensor_type: 'bridge',
    latitude: 39.7547,
    longitude: -105.2211,
    elevation: 5400,
    roadway: 'US-6',
    direction: 'WB',
    milepost: 259.5,
    location_description: 'Clear Creek Canyon Bridge',
    manufacturer: 'Trigg',
    model: 'OHS-1000',
    capabilities: {
      height_detection: true,
      over_height_alarm: true,
      ice_detection: true
    },
    status: 'active',
    owner: 'CDOT'
  },
  {
    sensor_id: 'BRIDGE-I70-EAGLE-RIVER',
    sensor_name: 'Eagle River Bridge Monitor',
    sensor_type: 'bridge',
    latitude: 39.6458,
    longitude: -106.3772,
    elevation: 7400,
    roadway: 'I-70',
    direction: 'WB',
    milepost: 147.2,
    location_description: 'Eagle River Bridge Gypsum',
    manufacturer: 'Bridge Diagnostics Inc',
    model: 'BDI-STS',
    capabilities: {
      structural_health: true,
      strain_monitoring: true,
      ice_detection: true,
      water_level: true
    },
    status: 'active',
    owner: 'CDOT'
  }
];

async function populateExampleSensors() {
  console.log('Populating example sensors...\n');

  try {
    let inserted = 0;
    let skipped = 0;

    for (const sensor of EXAMPLE_SENSORS) {
      try {
        // Check if sensor exists
        const existing = await db.db.prepare(`
          SELECT id FROM sensor_inventory WHERE sensor_id = ?
        `).get(sensor.sensor_id);

        if (existing) {
          console.log(`⏭️  Skipped: ${sensor.sensor_name} (already exists)`);
          skipped++;
          continue;
        }

        // Insert sensor
        await db.runAsync(`
          INSERT INTO sensor_inventory (
            sensor_id, sensor_name, sensor_type,
            latitude, longitude, elevation,
            roadway, direction, milepost, location_description,
            manufacturer, model,
            capabilities,
            status, owner
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          sensor.sensor_id,
          sensor.sensor_name,
          sensor.sensor_type,
          sensor.latitude,
          sensor.longitude,
          sensor.elevation,
          sensor.roadway,
          sensor.direction,
          sensor.milepost,
          sensor.location_description,
          sensor.manufacturer,
          sensor.model,
          JSON.stringify(sensor.capabilities),
          sensor.status,
          sensor.owner
        ]);

        console.log(`✓ Added: ${sensor.sensor_name} (${sensor.sensor_type})`);
        inserted++;

      } catch (error) {
        console.error(`❌ Error adding ${sensor.sensor_id}:`, error.message);
      }
    }

    console.log(`\n✅ Population complete!`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total sensors: ${inserted + skipped}`);

    // Display summary
    const summary = await db.db.prepare(`
      SELECT sensor_type, COUNT(*) as count
      FROM sensor_inventory
      GROUP BY sensor_type
    `).all();

    console.log(`\n📊 Sensor Inventory Summary:`);
    summary.forEach(row => {
      console.log(`   ${row.sensor_type}: ${row.count} sensor(s)`);
    });

  } catch (error) {
    console.error('❌ Error populating sensors:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  populateExampleSensors()
    .then(() => {
      console.log('\nDone!');
      console.log('\n💡 Next steps:');
      console.log('   1. Configure data_feed_url for each sensor');
      console.log('   2. Start sensor polling: npm start');
      console.log('   3. Monitor via dashboard: http://localhost:3001\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { populateExampleSensors };

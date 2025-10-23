// Import Iowa rest areas from ArcGIS REST API
const Database = require('../database.js');
const https = require('https');

const db = new Database.constructor();

const IOWA_REST_AREAS_URL = 'https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Rest_Area_View/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson';

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function importIowaRestAreas() {
  console.log('📍 Fetching Iowa rest areas from ArcGIS...');

  try {
    const geojson = await fetchJSON(IOWA_REST_AREAS_URL);

    if (!geojson.features || !Array.isArray(geojson.features)) {
      console.error('❌ Invalid GeoJSON structure');
      return;
    }

    console.log(`✅ Retrieved ${geojson.features.length} rest areas`);

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const feature of geojson.features) {
      try {
        const props = feature.properties;
        const coords = feature.geometry?.coordinates;

        if (!coords || coords.length !== 2) {
          skipped++;
          continue;
        }

        const [longitude, latitude] = coords;
        const truckSpaces = parseInt(props.NUM_TRUCK_PARKING) || 0;

        // Skip if no truck parking
        if (truckSpaces === 0) {
          skipped++;
          continue;
        }

        const facilityId = `iowa-${props.INVENTORY_ID || props.OBJECTID}`.toLowerCase();
        const facilityName = props.REST_AREAS || props.ADDRESS || 'Iowa Rest Area';

        // Build amenities list
        const amenities = [];
        if (props.RESTROOMS === 'Yes') amenities.push('Restrooms');
        if (props.WIFI === 'Yes') amenities.push('WiFi');
        if (props.VENDING === 'Yes') amenities.push('Vending');
        if (props.PICNIC_AREA === 'Yes') amenities.push('Picnic Area');
        if (props.PET_AREA === 'Yes') amenities.push('Pet Area');
        if (props.RV_DUMP === 'Yes') amenities.push('RV Dump');
        if (props.FAMILY_RESTROOM === 'Yes') amenities.push('Family Restroom');

        const facilityData = {
          facilityId: facilityId,
          facilityName: facilityName,
          state: 'IA',
          latitude: latitude,
          longitude: longitude,
          address: props.ADDRESS || null,
          totalSpaces: truckSpaces,
          truckSpaces: truckSpaces,
          amenities: amenities.length > 0 ? amenities.join(', ') : null,
          facilityType: 'Rest Area'
        };

        const result = db.addParkingFacility(facilityData);

        if (result.success) {
          // Add initial availability prediction
          const available = Math.floor(truckSpaces * (0.4 + Math.random() * 0.4)); // 40-80% available
          db.addParkingAvailability({
            facilityId: facilityId,
            availableSpaces: available,
            occupiedSpaces: truckSpaces - available,
            isPrediction: true,
            predictionConfidence: 0.5
          });

          imported++;
          console.log(`  ✅ ${facilityName} (${truckSpaces} truck spaces)`);
        } else {
          failed++;
        }

      } catch (error) {
        failed++;
        console.error(`  ❌ Error processing facility:`, error.message);
      }
    }

    console.log(`\n📊 Import Results:`);
    console.log(`  ✅ Imported: ${imported} facilities`);
    console.log(`  ⏭️  Skipped: ${skipped} (no truck parking)`);
    console.log(`  ❌ Failed: ${failed}`);

  } catch (error) {
    console.error('❌ Failed to import Iowa rest areas:', error.message);
  }
}

// Run import
importIowaRestAreas().then(() => {
  console.log('✅ Import complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});

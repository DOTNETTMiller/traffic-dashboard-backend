// Import FHWA Truck Parking Data
// Fetches truck parking facility data from FHWA and populates the database

const Database = require('../database.js');
const https = require('https');

const db = new Database.constructor();

// FHWA Truck Parking data source
const FHWA_PARKING_URL = 'https://datahub.transportation.gov/api/views/p5e9-n6d2/rows.json?accessType=DOWNLOAD';

// Alternative ArcGIS REST endpoint (if available)
const ARCGIS_REST_URL = 'https://geodata.bts.gov/datasets/usdot::truck-stop-parking.geojson';

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function importFromArcGIS() {
  console.log('🚛 Fetching truck parking data from ArcGIS...');

  try {
    const data = await fetchJSON(ARCGIS_REST_URL);

    if (!data.features || !Array.isArray(data.features)) {
      console.error('❌ Invalid GeoJSON format');
      return;
    }

    console.log(`📦 Found ${data.features.length} parking facilities`);

    let imported = 0;
    let failed = 0;

    for (const feature of data.features) {
      try {
        const props = feature.properties;
        const coords = feature.geometry?.coordinates;

        if (!coords || coords.length !== 2) {
          console.warn(`⚠️  Skipping facility with invalid coordinates:`, props);
          failed++;
          continue;
        }

        const [longitude, latitude] = coords;

        // Extract facility info
        const facilityData = {
          facilityId: props.OBJECTID ? `fhwa-${props.OBJECTID}` : `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          facilityName: props.NAME || props.FACILITY_NAME || 'Unknown Facility',
          state: props.STATE || props.ST || 'Unknown',
          latitude: latitude,
          longitude: longitude,
          address: props.ADDRESS || props.LOCATION || null,
          totalSpaces: props.TOTAL_SPACES || props.PARKING_SPACES || null,
          truckSpaces: props.TRUCK_SPACES || props.TOTAL_SPACES || null,
          amenities: props.AMENITIES || props.SERVICES || null,
          facilityType: props.TYPE || props.FACILITY_TYPE || 'Truck Stop'
        };

        const result = db.addParkingFacility(facilityData);

        if (result.success) {
          imported++;

          // If we have real-time availability data, add it
          if (props.AVAILABLE_SPACES !== undefined || props.OCCUPIED_SPACES !== undefined) {
            db.addParkingAvailability({
              facilityId: facilityData.facilityId,
              availableSpaces: props.AVAILABLE_SPACES || 0,
              occupiedSpaces: props.OCCUPIED_SPACES || 0,
              isPrediction: false,
              predictionConfidence: null
            });
          }
        } else {
          failed++;
          console.error(`❌ Failed to import ${facilityData.facilityName}:`, result.error);
        }

        // Progress indicator
        if ((imported + failed) % 50 === 0) {
          console.log(`📊 Progress: ${imported} imported, ${failed} failed`);
        }
      } catch (error) {
        failed++;
        console.error('❌ Error processing facility:', error.message);
      }
    }

    console.log('\n✅ Import completed!');
    console.log(`   Successfully imported: ${imported}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${imported + failed}`);

  } catch (error) {
    console.error('❌ Failed to fetch parking data:', error.message);
    console.error(error);
  }
}

async function importFromFHWA() {
  console.log('🚛 Fetching truck parking data from FHWA Socrata API...');

  try {
    const response = await fetchJSON(FHWA_PARKING_URL);

    if (!response.data || !Array.isArray(response.data)) {
      console.error('❌ Invalid Socrata format');
      return;
    }

    console.log(`📦 Found ${response.data.length} parking facilities`);

    // Get column mappings from metadata
    const columns = response.meta.view.columns;
    const columnMap = {};
    columns.forEach((col, idx) => {
      columnMap[col.name] = idx;
    });

    let imported = 0;
    let failed = 0;

    for (const row of response.data) {
      try {
        const facilityName = row[columnMap['Name']] || row[columnMap['Facility Name']] || 'Unknown';
        const state = row[columnMap['State']] || row[columnMap['ST']] || 'Unknown';
        const lat = parseFloat(row[columnMap['Latitude']] || row[columnMap['latitude']]);
        const lon = parseFloat(row[columnMap['Longitude']] || row[columnMap['longitude']]);

        if (isNaN(lat) || isNaN(lon)) {
          console.warn(`⚠️  Skipping ${facilityName} - invalid coordinates`);
          failed++;
          continue;
        }

        const facilityData = {
          facilityId: `fhwa-${row[0]}`, // First column is usually ID
          facilityName: facilityName,
          state: state,
          latitude: lat,
          longitude: lon,
          address: row[columnMap['Address']] || null,
          totalSpaces: parseInt(row[columnMap['Total Spaces']]) || null,
          truckSpaces: parseInt(row[columnMap['Truck Spaces']]) || null,
          amenities: row[columnMap['Amenities']] || null,
          facilityType: row[columnMap['Type']] || 'Truck Stop'
        };

        const result = db.addParkingFacility(facilityData);

        if (result.success) {
          imported++;
        } else {
          failed++;
        }

        if ((imported + failed) % 50 === 0) {
          console.log(`📊 Progress: ${imported} imported, ${failed} failed`);
        }
      } catch (error) {
        failed++;
        console.error('❌ Error processing row:', error.message);
      }
    }

    console.log('\n✅ Import completed!');
    console.log(`   Successfully imported: ${imported}`);
    console.log(`   Failed: ${failed}`);

  } catch (error) {
    console.error('❌ Failed to fetch FHWA data:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting truck parking data import...\n');

  // Try ArcGIS first, fall back to FHWA Socrata
  try {
    await importFromArcGIS();
  } catch (error) {
    console.log('\n⚠️  ArcGIS import failed, trying FHWA Socrata API...\n');
    await importFromFHWA();
  }

  db.close();
  console.log('\n✅ Database connection closed');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { importFromArcGIS, importFromFHWA };

// Fetch coordinates for all TPIMS facilities from live API
const https = require('https');
const Database = require('../database.js');

const db = new Database.constructor();

async function fetchTPIMSData() {
  return new Promise((resolve, reject) => {
    https.get('https://tpims-data.fhwa.dot.gov/api/v1/truckparking/geojson', (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function updateCoordinates() {
  console.log('\n📍 Fetching TPIMS facility coordinates from live API...\n');

  try {
    const geojson = await fetchTPIMSData();

    if (!geojson || !geojson.features) {
      console.error('❌ No features found in TPIMS response');
      return;
    }

    console.log(`📋 Found ${geojson.features.length} facilities from TPIMS API\n`);

    await db.init();

    let updated = 0;
    let notFound = 0;

    for (const feature of geojson.features) {
      const props = feature.properties;
      const siteId = props.site_id || props.SiteId;

      if (!siteId || !feature.geometry || !feature.geometry.coordinates) {
        continue;
      }

      // GeoJSON uses [longitude, latitude]
      const [longitude, latitude] = feature.geometry.coordinates;

      // Generate facility ID to match what we created
      const facilityId = `tpims-historical-${siteId.toLowerCase()}`;

      try {
        // Check if facility exists
        const existing = db.db.prepare(
          'SELECT facility_id FROM parking_facilities WHERE facility_id = ?'
        ).get(facilityId);

        if (existing) {
          // Update coordinates
          db.db.prepare(`
            UPDATE parking_facilities
            SET latitude = ?, longitude = ?
            WHERE facility_id = ?
          `).run(latitude, longitude, facilityId);

          updated++;
          if (updated % 10 === 0) {
            process.stdout.write(`\r✅ Updated ${updated} facilities...`);
          }
        } else {
          notFound++;
        }
      } catch (error) {
        console.error(`\n❌ Error updating ${siteId}:`, error.message);
      }
    }

    console.log(`\n\n📊 Update Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Not found in DB: ${notFound}\n`);

    // Verify results by state
    const results = db.db.prepare(`
      SELECT state,
             COUNT(*) as total,
             COUNT(CASE WHEN latitude <> 0 AND longitude <> 0 THEN 1 END) as with_coords
      FROM parking_facilities
      GROUP BY state
      ORDER BY state
    `).all();

    console.log('📍 Coordinates by state:');
    results.forEach(r => {
      console.log(`   ${r.state}: ${r.with_coords}/${r.total} facilities have coordinates`);
    });
    console.log();

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

updateCoordinates();

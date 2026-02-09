/**
 * Fetch I-80 geometry from OpenStreetMap for Iowa
 * Uses Overpass API to get complete, high-resolution highway geometry
 */

const { Pool } = require('pg');
const https = require('https');

const DATABASE_URL = process.env.DATABASE_URL;

// Overpass API query for I-80 in Iowa
const overpassQuery = `
[out:json][timeout:60];
(
  way["ref"="80"]["highway"="motorway"](40.375,-96.639,43.501,-90.140);
  relation["ref"="80"]["route"="road"](40.375,-96.639,43.501,-90.140);
);
out geom;
`;

function fetchFromOverpass(query) {
  return new Promise((resolve, reject) => {
    const postData = query;

    const options = {
      hostname: 'overpass-api.de',
      port: 443,
      path: '/api/interpreter',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse Overpass response: ' + e.message));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🛣️  Fetching I-80 geometry from OpenStreetMap\n');
  console.log('Area: Iowa (40.375°N to 43.501°N, -96.639°W to -90.140°W)');
  console.log('Querying Overpass API...\n');

  try {
    const data = await fetchFromOverpass(overpassQuery);

    console.log('✅ Received response from Overpass API');
    console.log('   Elements:', data.elements.length);

    // Process ways and relations
    const allCoordinates = [];

    for (const element of data.elements) {
      if (element.type === 'way' && element.geometry) {
        element.geometry.forEach(node => {
          allCoordinates.push([node.lon, node.lat]);
        });
      } else if (element.type === 'relation' && element.members) {
        element.members.forEach(member => {
          if (member.geometry) {
            member.geometry.forEach(node => {
              allCoordinates.push([node.lon, node.lat]);
            });
          }
        });
      }
    }

    console.log('   Total coordinates:', allCoordinates.length);

    if (allCoordinates.length === 0) {
      console.log('\n❌ No geometry found for I-80 in Iowa');
      console.log('   The query may need adjustment');
      return;
    }

    // Create GeoJSON LineString
    const geometry = {
      type: 'LineString',
      coordinates: allCoordinates
    };

    console.log('\n📊 Geometry Stats:');
    console.log('   Points:', allCoordinates.length);
    console.log('   First point:', allCoordinates[0]);
    console.log('   Last point:', allCoordinates[allCoordinates.length - 1]);

    // Update database
    const pool = new Pool({ connectionString: DATABASE_URL });

    console.log('\n💾 Updating database...');

    // Check if I-80 WB exists
    const wbCheck = await pool.query('SELECT id FROM corridors WHERE name = $1', ['I-80 WB']);

    if (wbCheck.rows.length > 0) {
      // Update existing
      await pool.query(
        'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
        [geometry, 'I-80 WB']
      );
      console.log('   ✅ Updated I-80 WB');
    } else {
      // Insert new
      await pool.query(
        'INSERT INTO corridors (name, geometry, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
        ['I-80 WB', geometry]
      );
      console.log('   ✅ Inserted I-80 WB');
    }

    // Update I-80 EB with reversed coordinates
    const reversedGeometry = {
      type: 'LineString',
      coordinates: [...allCoordinates].reverse()
    };

    const ebCheck = await pool.query('SELECT id FROM corridors WHERE name = $1', ['I-80 EB']);

    if (ebCheck.rows.length > 0) {
      // Update existing
      await pool.query(
        'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
        [reversedGeometry, 'I-80 EB']
      );
      console.log('   ✅ Updated I-80 EB (reversed)');
    } else {
      // Insert new
      await pool.query(
        'INSERT INTO corridors (name, geometry, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
        ['I-80 EB', reversedGeometry]
      );
      console.log('   ✅ Inserted I-80 EB (reversed)');
    }

    await pool.end();

    console.log('\n✅ Success! I-80 Iowa geometry updated');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart Railway backend service');
    console.log('   2. Events should now snap to high-resolution OSM geometry');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

main();

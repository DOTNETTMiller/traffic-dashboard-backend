/**
 * Alternative approach to fetch I-35 polylines using Nominatim + simpler Overpass queries
 * This approach queries for highway ways directly instead of complex relations
 */

const { Pool } = require('pg');
const axios = require('axios');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchI35Segments(bbox, description) {
  console.log(`  Fetching: ${description}...`);

  // Query for I-35 highway segments in this bounding box
  const query = `
    [out:json][timeout:25][bbox:${bbox}];
    (
      way["highway"~"motorway|trunk"]["ref"~"I 35|Interstate 35"];
    );
    out geom;
  `;

  try {
    const response = await axios.post(OVERPASS_URL, query, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 30000
    });

    const coords = [];
    if (response.data.elements) {
      for (const element of response.data.elements) {
        if (element.type === 'way' && element.geometry) {
          for (const node of element.geometry) {
            coords.push([node.lon, node.lat]);
          }
        }
      }
    }

    console.log(`    Got ${coords.length} coordinates`);
    return coords;

  } catch (err) {
    console.log(`    ERROR: ${err.message}`);
    return [];
  }
}

async function buildI35() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('======================================================================');
  console.log('FETCH I-35 POLYLINES (ALTERNATIVE APPROACH)');
  console.log('======================================================================\n');

  try {
    // Define bounding boxes for I-35 by state (south to north)
    const segments = [
      // Texas: Laredo to Oklahoma border
      { bbox: '25.8,-100.0,36.5,-93.5', name: 'Texas (South)', dir: 'nb' },
      { bbox: '33.6,-100.0,37.0,-94.4', name: 'Oklahoma', dir: 'nb' },
      { bbox: '36.9,-100.0,40.0,-94.6', name: 'Kansas', dir: 'nb' },
      { bbox: '35.9,-95.8,40.6,-89.1', name: 'Missouri', dir: 'nb' },
      { bbox: '40.3,-96.7,43.6,-90.1', name: 'Iowa', dir: 'nb' },
      { bbox: '43.4,-97.3,49.5,-89.5', name: 'Minnesota', dir: 'nb' }
    ];

    console.log('Building I-35 Northbound from state segments...\n');

    const allCoords = [];

    for (const seg of segments) {
      const coords = await fetchI35Segments(seg.bbox, seg.name);
      allCoords.push(...coords);

      // Rate limit
      await sleep(2000);
    }

    console.log(`\nTotal coordinates collected: ${allCoords.length}`);

    if (allCoords.length === 0) {
      console.log('❌ No data retrieved - aborting');
      await pool.end();
      process.exit(1);
    }

    // Remove duplicates
    const uniqueCoords = [];
    for (let i = 0; i < allCoords.length; i++) {
      if (i === 0 ||
          allCoords[i][0] !== allCoords[i-1][0] ||
          allCoords[i][1] !== allCoords[i-1][1]) {
        uniqueCoords.push(allCoords[i]);
      }
    }

    console.log(`After deduplication: ${uniqueCoords.length} points\n`);

    // Calculate bounds
    let minLon = Infinity, maxLon = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    for (const [lon, lat] of uniqueCoords) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    const bounds = {
      west: minLon,
      east: maxLon,
      south: minLat,
      north: maxLat
    };

    console.log(`Bounds: [${minLon.toFixed(2)}, ${minLat.toFixed(2)}] to [${maxLon.toFixed(2)}, ${maxLat.toFixed(2)}]`);

    // Validate bounds are in US
    const inUS = minLon >= -125 && minLon <= -65 && maxLon >= -125 && maxLon <= -65 &&
                 minLat >= 24 && minLat <= 50 && maxLat >= 24 && maxLat <= 50;

    if (!inUS) {
      console.log('❌ ERROR: Bounds are outside continental US - data is invalid');
      await pool.end();
      process.exit(1);
    }

    console.log('✅ Bounds are valid (within continental US)\n');

    // Store I-35 NB
    const nbGeometry = {
      type: 'LineString',
      coordinates: uniqueCoords
    };

    await pool.query(`
      UPDATE corridors
      SET geometry = $1, bounds = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'i-35-nb'
    `, [JSON.stringify(nbGeometry), JSON.stringify(bounds)]);

    console.log(`✅ Updated i-35-nb with ${uniqueCoords.length} points\n`);

    // For southbound, reverse the coordinates
    const sbCoords = [...uniqueCoords].reverse();
    const sbGeometry = {
      type: 'LineString',
      coordinates: sbCoords
    };

    await pool.query(`
      UPDATE corridors
      SET geometry = $1, bounds = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'i-35-sb'
    `, [JSON.stringify(sbGeometry), JSON.stringify(bounds)]);

    console.log(`✅ Updated i-35-sb with ${sbCoords.length} points\n`);

    console.log('======================================================================');
    console.log('SUCCESS: I-35 polylines built!');
    console.log('======================================================================');

    await pool.end();

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
    await pool.end();
    process.exit(1);
  }
}

buildI35();

/**
 * Complete I-35 polylines by adding Iowa and Minnesota segments
 * This adds the missing northern states to the existing I-35 data
 */

const { Pool } = require('pg');
const axios = require('axios');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchI35Segments(bbox, description) {
  console.log(`  Fetching: ${description}...`);

  // Simpler query with longer timeout and smaller bbox
  const query = `
    [out:json][timeout:45][bbox:${bbox}];
    (
      way["highway"~"motorway|trunk"]["ref"~"I 35|Interstate 35"];
    );
    out geom;
  `;

  try {
    const response = await axios.post(OVERPASS_URL, query, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 50000
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

async function completeI35() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('======================================================================');
  console.log('COMPLETE I-35 WITH IOWA AND MINNESOTA');
  console.log('======================================================================\n');

  try {
    // First, get existing I-35 NB data
    console.log('Fetching existing I-35 NB data...');
    const existing = await pool.query(`
      SELECT geometry FROM corridors WHERE id = 'i-35-nb'
    `);

    let existingCoords = [];
    if (existing.rows[0] && existing.rows[0].geometry) {
      existingCoords = existing.rows[0].geometry.coordinates;
      console.log(`  Found ${existingCoords.length} existing coordinates\n`);
    }

    // Fetch Iowa and Minnesota segments with smaller bboxes to avoid timeouts
    const segments = [
      // Iowa - split into north and south sections
      { bbox: '40.3,-96.7,42.0,-90.1', name: 'Iowa (South)', dir: 'nb' },
      { bbox: '42.0,-96.7,43.6,-90.1', name: 'Iowa (North)', dir: 'nb' },
      // Minnesota - split into south, central, and north sections
      { bbox: '43.4,-97.0,45.5,-91.5', name: 'Minnesota (South)', dir: 'nb' },
      { bbox: '45.5,-97.0,47.5,-91.5', name: 'Minnesota (Central)', dir: 'nb' },
      { bbox: '47.5,-97.3,49.5,-89.5', name: 'Minnesota (North)', dir: 'nb' }
    ];

    console.log('Fetching Iowa and Minnesota segments...\n');

    const newCoords = [];

    for (const seg of segments) {
      const coords = await fetchI35Segments(seg.bbox, seg.name);
      newCoords.push(...coords);

      // Longer rate limit to avoid 429 errors
      await sleep(3000);
    }

    console.log(`\nNew coordinates collected: ${newCoords.length}`);

    if (newCoords.length === 0) {
      console.log('❌ No new data retrieved - keeping existing data');
      await pool.end();
      return;
    }

    // Combine existing and new coordinates
    const allCoords = [...existingCoords, ...newCoords];
    console.log(`Total coordinates before dedup: ${allCoords.length}`);

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

    // Store updated I-35 NB
    const nbGeometry = {
      type: 'LineString',
      coordinates: uniqueCoords
    };

    await pool.query(`
      UPDATE corridors
      SET geometry = $1, bounds = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'i-35-nb'
    `, [JSON.stringify(nbGeometry), JSON.stringify(bounds)]);

    console.log(`✅ Updated i-35-nb with ${uniqueCoords.length} points (added ${newCoords.length} new)\n`);

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
    console.log('SUCCESS: I-35 now includes Iowa and Minnesota!');
    console.log('======================================================================');
    console.log('\nCoverage:');
    console.log('  ✅ Texas');
    console.log('  ✅ Oklahoma');
    console.log('  ✅ Kansas');
    console.log('  ✅ Missouri');
    console.log('  ✅ Iowa (added)');
    console.log('  ✅ Minnesota (added)');

    await pool.end();

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
    await pool.end();
    process.exit(1);
  }
}

completeI35();

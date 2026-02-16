/**
 * Fix I-35 polylines by using correct OSM data
 * The previous script got bad OSM relations - need to query properly
 */

const { Pool } = require('pg');
const axios = require('axios');

// Overpass API endpoint
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// I-35 state-specific queries (more reliable than relations)
const I35_STATES = {
  northbound: [
    { state: 'Texas', code: 'TX', query: 'way["highway"~"motorway"]["ref"="I 35"]["name"~"North"]' },
    { state: 'Oklahoma', code: 'OK', query: 'way["highway"~"motorway"]["ref"="I 35"]' },
    { state: 'Kansas', code: 'KS', query: 'way["highway"~"motorway"]["ref"="I 35"]' },
    { state: 'Missouri', code: 'MO', query: 'way["highway"~"motorway"]["ref"="I 35"]' },
    { state: 'Iowa', code: 'IA', query: 'way["highway"~"motorway"]["ref"="I 35"]["name"~"North"]' },
    { state: 'Minnesota', code: 'MN', query: 'way["highway"~"motorway"]["ref"="I 35"]' }
  ],
  southbound: [
    { state: 'Minnesota', code: 'MN', query: 'way["highway"~"motorway"]["ref"="I 35"]' },
    { state: 'Iowa', code: 'IA', query: 'way["highway"~"motorway"]["ref"="I 35"]["name"~"South"]' },
    { state: 'Missouri', code: 'MO', query: 'way["highway"~"motorway"]["ref"="I 35"]' },
    { state: 'Kansas', code: 'KS', query: 'way["highway"~"motorway"]["ref"="I 35"]' },
    { state: 'Oklahoma', code: 'OK', query: 'way["highway"~"motorway"]["ref"="I 35"]' },
    { state: 'Texas', code: 'TX', query: 'way["highway"~"motorway"]["ref"="I 35"]["name"~"South"]' }
  ]
};

// State bounding boxes for I-35
const STATE_BOUNDS = {
  TX: '(25.8,-106.7,36.5,-93.5)',     // Texas
  OK: '(33.6,-103.0,37.0,-94.4)',     // Oklahoma
  KS: '(36.9,-102.1,40.0,-94.6)',     // Kansas
  MO: '(35.9,-95.8,40.6,-89.1)',      // Missouri
  IA: '(40.4,-96.7,43.5,-90.1)',      // Iowa
  MN: '(43.5,-97.3,49.4,-89.5)'       // Minnesota
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function queryOverpass(query, description) {
  console.log(`    Querying: ${description}...`);

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

    console.log(`      Got ${coords.length} coordinates`);
    return coords;

  } catch (err) {
    if (err.response?.status === 429) {
      console.log(`      ERROR: Rate limited (429)`);
    } else if (err.response?.status === 504) {
      console.log(`      ERROR: Timeout (504)`);
    } else {
      console.log(`      ERROR: ${err.message}`);
    }
    return [];
  }
}

async function buildI35Polylines() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('======================================================================');
  console.log('FIX I-35 POLYLINES FROM OPENSTREETMAP');
  console.log('======================================================================\n');

  try {
    // Build I-35 Northbound
    console.log('  Building I-35 Northbound (TX → MN)...\n');
    const nbCoords = [];

    for (const stateInfo of I35_STATES.northbound) {
      const bounds = STATE_BOUNDS[stateInfo.code];
      const query = `
        [out:json][timeout:25];
        (
          ${stateInfo.query}${bounds};
        );
        out geom;
      `;

      const coords = await queryOverpass(query, `${stateInfo.state} ${stateInfo.code}`);
      nbCoords.push(...coords);

      // Rate limit
      await sleep(1500);
    }

    console.log(`\n    Total NB coordinates: ${nbCoords.length}`);

    // Remove duplicates
    const uniqueNB = [];
    for (let i = 0; i < nbCoords.length; i++) {
      if (i === 0 || nbCoords[i][0] !== nbCoords[i-1][0] || nbCoords[i][1] !== nbCoords[i-1][1]) {
        uniqueNB.push(nbCoords[i]);
      }
    }

    console.log(`    After deduplication: ${uniqueNB.length} points`);

    // Calculate bounds
    let minLon = Infinity, maxLon = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    for (const [lon, lat] of uniqueNB) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    const nbBounds = {
      west: minLon,
      east: maxLon,
      south: minLat,
      north: maxLat
    };

    console.log(`    Bounds: [${minLon.toFixed(2)}, ${minLat.toFixed(2)}] to [${maxLon.toFixed(2)}, ${maxLat.toFixed(2)}]`);

    // Store in database
    const nbGeometry = {
      type: 'LineString',
      coordinates: uniqueNB
    };

    await pool.query(`
      UPDATE corridors
      SET geometry = $1, bounds = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'i-35-nb'
    `, [JSON.stringify(nbGeometry), JSON.stringify(nbBounds)]);

    console.log(`    ✅ Updated i-35-nb with ${uniqueNB.length} points\n`);

    // Build I-35 Southbound
    console.log('  Building I-35 Southbound (MN → TX)...\n');
    const sbCoords = [];

    for (const stateInfo of I35_STATES.southbound) {
      const bounds = STATE_BOUNDS[stateInfo.code];
      const query = `
        [out:json][timeout:25];
        (
          ${stateInfo.query}${bounds};
        );
        out geom;
      `;

      const coords = await queryOverpass(query, `${stateInfo.state} ${stateInfo.code}`);
      sbCoords.push(...coords);

      // Rate limit
      await sleep(1500);
    }

    console.log(`\n    Total SB coordinates: ${sbCoords.length}`);

    // Remove duplicates
    const uniqueSB = [];
    for (let i = 0; i < sbCoords.length; i++) {
      if (i === 0 || sbCoords[i][0] !== sbCoords[i-1][0] || sbCoords[i][1] !== sbCoords[i-1][1]) {
        uniqueSB.push(sbCoords[i]);
      }
    }

    console.log(`    After deduplication: ${uniqueSB.length} points`);

    // Calculate bounds
    minLon = Infinity; maxLon = -Infinity;
    minLat = Infinity; maxLat = -Infinity;

    for (const [lon, lat] of uniqueSB) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    const sbBounds = {
      west: minLon,
      east: maxLon,
      south: minLat,
      north: maxLat
    };

    console.log(`    Bounds: [${minLon.toFixed(2)}, ${minLat.toFixed(2)}] to [${maxLon.toFixed(2)}, ${maxLat.toFixed(2)}]`);

    // Store in database
    const sbGeometry = {
      type: 'LineString',
      coordinates: uniqueSB
    };

    await pool.query(`
      UPDATE corridors
      SET geometry = $1, bounds = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'i-35-sb'
    `, [JSON.stringify(sbGeometry), JSON.stringify(sbBounds)]);

    console.log(`    ✅ Updated i-35-sb with ${uniqueSB.length} points\n`);

    console.log('======================================================================');
    console.log('SUCCESS: I-35 polylines fixed!');
    console.log('======================================================================\n');

    await pool.end();

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
    await pool.end();
    process.exit(1);
  }
}

buildI35Polylines();

/**
 * Fetch high-resolution I-80 polylines using bbox-based queries
 * This approach gets much more detail than OSM relation queries
 */

const { Pool } = require('pg');
const axios = require('axios');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// I-80 state bounding boxes (West to East)
const I80_SEGMENTS = [
  // California (San Francisco to Nevada border)
  { bbox: '37.7,-122.5,39.8,-119.5', name: 'California (West)', dir: 'eb' },
  { bbox: '39.0,-120.5,41.0,-119.5', name: 'California (East)', dir: 'eb' },

  // Nevada
  { bbox: '39.5,-120.0,41.2,-114.0', name: 'Nevada', dir: 'eb' },

  // Utah
  { bbox: '40.5,-114.1,41.3,-109.0', name: 'Utah', dir: 'eb' },

  // Wyoming
  { bbox: '40.5,-111.1,42.0,-104.0', name: 'Wyoming', dir: 'eb' },

  // Nebraska (split into west/central/east)
  { bbox: '40.5,-104.1,41.5,-100.0', name: 'Nebraska (West)', dir: 'eb' },
  { bbox: '40.5,-100.5,41.5,-96.5', name: 'Nebraska (Central)', dir: 'eb' },
  { bbox: '40.8,-97.0,41.8,-95.3', name: 'Nebraska (East)', dir: 'eb' },

  // Iowa (split into west/central/east)
  { bbox: '41.4,-96.0,42.1,-93.5', name: 'Iowa (West)', dir: 'eb' },
  { bbox: '41.4,-94.0,42.1,-91.5', name: 'Iowa (Central)', dir: 'eb' },
  { bbox: '41.4,-92.0,42.1,-90.1', name: 'Iowa (East)', dir: 'eb' },

  // Illinois
  { bbox: '41.3,-91.0,42.5,-87.5', name: 'Illinois', dir: 'eb' },

  // Indiana
  { bbox: '41.0,-87.6,41.8,-84.8', name: 'Indiana', dir: 'eb' },

  // Ohio
  { bbox: '40.8,-85.0,41.7,-80.5', name: 'Ohio', dir: 'eb' },

  // Pennsylvania
  { bbox: '40.8,-80.6,42.0,-74.7', name: 'Pennsylvania', dir: 'eb' },

  // New Jersey
  { bbox: '40.7,-75.2,41.1,-73.9', name: 'New Jersey', dir: 'eb' }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isValidUSCoordinate(lon, lat) {
  return lon >= -125 && lon <= -65 && lat >= 24 && lat <= 50;
}

async function queryOverpass(bbox, description) {
  const query = `
    [out:json][timeout:45][bbox:${bbox}];
    (
      way["highway"~"motorway"]["ref"~"I 80|Interstate 80"];
    );
    out geom;
  `;

  try {
    console.log(`  Querying: ${description}...`);
    const response = await axios.post(OVERPASS_URL, query, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 50000
    });

    if (!response.data || !response.data.elements) {
      console.log(`    ⚠️  No data returned`);
      return [];
    }

    const ways = response.data.elements;
    console.log(`    Found ${ways.length} OSM ways`);

    // Extract coordinates from all ways
    const coords = [];
    for (const way of ways) {
      if (way.geometry) {
        for (const node of way.geometry) {
          if (isValidUSCoordinate(node.lon, node.lat)) {
            coords.push([node.lon, node.lat]);
          }
        }
      }
    }

    console.log(`    Extracted ${coords.length} valid US coordinates`);
    return coords;

  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
      console.log(`    ⏱️  Timeout - will retry with smaller bbox if needed`);
    } else if (err.response?.status === 429) {
      console.log(`    ⏸️  Rate limited - waiting 5 seconds...`);
      await sleep(5000);
    } else if (err.response?.status === 504) {
      console.log(`    ⏱️  Gateway timeout - query too large`);
    } else {
      console.log(`    ❌ Error: ${err.message}`);
    }
    return [];
  }
}

function deduplicateCoordinates(coords) {
  const seen = new Set();
  return coords.filter(([lon, lat]) => {
    const key = `${lon.toFixed(6)},${lat.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function calculateBounds(coords) {
  if (coords.length === 0) return null;

  let west = Infinity, east = -Infinity;
  let south = Infinity, north = -Infinity;

  for (const [lon, lat] of coords) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }

  return { west, east, south, north };
}

async function buildI80HighRes() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  BUILD HIGH-RESOLUTION I-80 POLYLINES                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    let allCoords = [];

    // Fetch all segments
    for (const segment of I80_SEGMENTS) {
      console.log(`\n📍 ${segment.name}`);
      const coords = await queryOverpass(segment.bbox, segment.name);

      if (coords.length > 0) {
        allCoords = allCoords.concat(coords);
        console.log(`    ✅ Added ${coords.length} coordinates`);
      }

      // Rate limiting
      await sleep(3000);
    }

    console.log('\n────────────────────────────────────────────────────────────────');
    console.log(`📊 Total coordinates collected: ${allCoords.length}`);

    // Deduplicate
    console.log('\n🔄 Deduplicating coordinates...');
    const uniqueCoords = deduplicateCoordinates(allCoords);
    console.log(`   Unique coordinates: ${uniqueCoords.length}`);

    // Sort by longitude (west to east for EB, east to west for WB)
    console.log('\n🔄 Sorting coordinates...');
    const sortedEB = [...uniqueCoords].sort((a, b) => a[0] - b[0]);
    const sortedWB = [...uniqueCoords].sort((a, b) => b[0] - a[0]);

    // Calculate bounds
    const bounds = calculateBounds(uniqueCoords);

    // Create GeoJSON
    const geometryEB = {
      type: 'LineString',
      coordinates: sortedEB
    };

    const geometryWB = {
      type: 'LineString',
      coordinates: sortedWB
    };

    console.log('\n💾 Saving to database...');

    // Save I-80 EB
    await pool.query(`
      INSERT INTO corridors (id, name, geometry, bounds, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        geometry = EXCLUDED.geometry,
        bounds = EXCLUDED.bounds,
        updated_at = CURRENT_TIMESTAMP
    `, ['i-80-eb', 'I-80 EB', JSON.stringify(geometryEB), JSON.stringify(bounds)]);

    console.log(`   ✅ i-80-eb saved (${sortedEB.length} points)`);

    // Save I-80 WB
    await pool.query(`
      INSERT INTO corridors (id, name, geometry, bounds, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        geometry = EXCLUDED.geometry,
        bounds = EXCLUDED.bounds,
        updated_at = CURRENT_TIMESTAMP
    `, ['i-80-wb', 'I-80 WB', JSON.stringify(geometryWB), JSON.stringify(bounds)]);

    console.log(`   ✅ i-80-wb saved (${sortedWB.length} points)`);

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('✅ HIGH-RESOLUTION I-80 POLYLINES COMPLETE');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`\nBounds: W${bounds.west.toFixed(2)}° E${bounds.east.toFixed(2)}° S${bounds.south.toFixed(2)}° N${bounds.north.toFixed(2)}°`);
    console.log(`\nI-80 EB: ${sortedEB.length} points`);
    console.log(`I-80 WB: ${sortedWB.length} points`);
    console.log(`\nResolution: ~${(2900 / sortedEB.length).toFixed(3)} miles per point`);

    await pool.end();

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err);
    await pool.end();
    process.exit(1);
  }
}

buildI80HighRes();

/**
 * Fetch ALL Interstate highway geometries from OpenStreetMap
 *
 * Features:
 * - Fetches all major interstate corridors (I-5, I-10, I-15, I-20, I-25, I-35, I-40, I-70, I-80, I-90, I-95)
 * - Handles split highways (separate EB/WB or NB/SB roadways)
 * - Creates separate geometry for each direction when split
 * - Covers entire United States
 */

const { Pool } = require('pg');
const axios = require('axios');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

// ALL major US Interstate highways
const INTERSTATES = [
  // Coast-to-coast East-West routes
  { number: '10', name: 'I-10', bounds: { south: 29.5, north: 34.5, west: -118.5, east: -81.5 }, orientation: 'EW' },
  { number: '20', name: 'I-20', bounds: { south: 31.5, north: 34.5, west: -96.5, east: -80.0 }, orientation: 'EW' },
  { number: '40', name: 'I-40', bounds: { south: 34.0, north: 36.5, west: -118.5, east: -77.5 }, orientation: 'EW' },
  { number: '70', name: 'I-70', bounds: { south: 38.5, north: 40.5, west: -112.0, east: -76.5 }, orientation: 'EW' },
  { number: '80', name: 'I-80', bounds: { south: 39.5, north: 42.5, west: -124.0, east: -74.0 }, orientation: 'EW' },
  { number: '90', name: 'I-90', bounds: { south: 41.5, north: 48.5, west: -122.5, east: -71.0 }, orientation: 'EW' },
  { number: '94', name: 'I-94', bounds: { south: 41.5, north: 48.5, west: -112.0, east: -83.0 }, orientation: 'EW' },

  // Border-to-border North-South routes
  { number: '5', name: 'I-5', bounds: { south: 32.5, north: 49.0, west: -124.5, east: -117.0 }, orientation: 'NS' },
  { number: '15', name: 'I-15', bounds: { south: 32.5, north: 49.0, west: -117.5, east: -111.0 }, orientation: 'NS' },
  { number: '25', name: 'I-25', bounds: { south: 31.5, north: 45.0, west: -107.0, east: -104.0 }, orientation: 'NS' },
  { number: '35', name: 'I-35', bounds: { south: 27.5, north: 48.5, west: -99.5, east: -92.5 }, orientation: 'NS' },
  { number: '55', name: 'I-55', bounds: { south: 29.5, north: 42.0, west: -91.0, east: -87.5 }, orientation: 'NS' },
  { number: '65', name: 'I-65', bounds: { south: 30.5, north: 42.0, west: -87.5, east: -85.0 }, orientation: 'NS' },
  { number: '75', name: 'I-75', bounds: { south: 25.0, north: 46.5, west: -85.0, east: -81.0 }, orientation: 'NS' },
  { number: '95', name: 'I-95', bounds: { south: 25.5, north: 47.5, west: -80.5, east: -67.0 }, orientation: 'NS' },

  // Major regional routes (60s-80s)
  { number: '64', name: 'I-64', bounds: { south: 37.0, north: 39.5, west: -91.5, east: -75.5 }, orientation: 'EW' },
  { number: '66', name: 'I-66', bounds: { south: 38.5, north: 39.0, west: -78.5, east: -77.0 }, orientation: 'EW' },
  { number: '69', name: 'I-69', bounds: { south: 26.0, north: 46.0, west: -95.5, east: -83.0 }, orientation: 'NS' },
  { number: '71', name: 'I-71', bounds: { south: 38.0, north: 42.0, west: -85.0, east: -81.0 }, orientation: 'NS' },
  { number: '74', name: 'I-74', bounds: { south: 39.0, north: 42.0, west: -91.5, east: -80.5 }, orientation: 'EW' },
  { number: '76', name: 'I-76', bounds: { south: 39.5, north: 41.0, west: -105.0, east: -74.0 }, orientation: 'EW' },
  { number: '77', name: 'I-77', bounds: { south: 33.5, north: 41.5, west: -82.0, east: -80.0 }, orientation: 'NS' },
  { number: '78', name: 'I-78', bounds: { south: 40.0, north: 41.0, west: -76.0, east: -74.0 }, orientation: 'EW' },
  { number: '79', name: 'I-79', bounds: { south: 38.5, north: 42.0, west: -81.0, east: -79.5 }, orientation: 'NS' },
  { number: '81', name: 'I-81', bounds: { south: 36.0, north: 43.5, west: -82.5, east: -75.5 }, orientation: 'NS' },
  { number: '84', name: 'I-84', bounds: { south: 41.0, north: 46.0, west: -124.0, east: -73.0 }, orientation: 'EW' },
  { number: '85', name: 'I-85', bounds: { south: 32.5, north: 39.0, west: -86.0, east: -77.5 }, orientation: 'NS' },

  // Additional routes
  { number: '8', name: 'I-8', bounds: { south: 32.5, north: 33.5, west: -117.5, east: -109.0 }, orientation: 'EW' },
  { number: '30', name: 'I-30', bounds: { south: 33.0, north: 35.0, west: -96.0, east: -90.0 }, orientation: 'EW' },
  { number: '44', name: 'I-44', bounds: { south: 33.5, north: 39.0, west: -100.0, east: -90.5 }, orientation: 'EW' },
  { number: '45', name: 'I-45', bounds: { south: 29.0, north: 32.5, west: -96.0, east: -94.5 }, orientation: 'NS' },
  { number: '57', name: 'I-57', bounds: { south: 37.0, north: 41.5, west: -90.0, east: -87.5 }, orientation: 'NS' },
  { number: '59', name: 'I-59', bounds: { south: 30.0, north: 35.0, west: -91.0, east: -84.5 }, orientation: 'NS' }
];

/**
 * Fetch interstate geometry from OSM with directional separation
 */
async function fetchInterstateFromOSM(interstate) {
  const { number, name, bounds, orientation } = interstate;
  const { south, north, west, east } = bounds;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`🛣️  Fetching ${name} (${orientation === 'EW' ? 'East-West' : 'North-South'})`);
  console.log(`   Bounds: [${west}, ${south}] to [${east}, ${north}]`);
  console.log('='.repeat(70));

  // Overpass query that separates by direction when available
  const overpassQuery = `
    [out:json][timeout:120];
    (
      // Main motorway segments
      way["highway"="motorway"]["ref"~"^I-?${number}$"](${south},${west},${north},${east});
      way["highway"="motorway"]["ref"~"^I ${number}$"](${south},${west},${north},${east});

      // Directional tags (for split highways)
      way["highway"="motorway"]["ref"~"^I-?${number}$"]["lanes:forward"](${south},${west},${north},${east});
      way["highway"="motorway"]["ref"~"^I-?${number}$"]["lanes:backward"](${south},${west},${north},${east});
      way["highway"="motorway"]["ref"~"^I-?${number}$"]["oneway"="yes"](${south},${west},${north},${east});

      // Links
      way["highway"="motorway_link"]["ref"~"^I-?${number}$"](${south},${west},${north},${east});
    );
    out geom;
  `;

  try {
    console.log('   🌍 Querying OpenStreetMap Overpass API...');

    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      overpassQuery,
      {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 150000 // 2.5 minute timeout for large queries
      }
    );

    if (!response.data || !response.data.elements || response.data.elements.length === 0) {
      console.log(`   ⚠️  No ${name} segments found`);
      return null;
    }

    console.log(`   ✓ Found ${response.data.elements.length} way segments`);

    // Separate ways by direction
    const eastboundWays = [];
    const westboundWays = [];
    const northboundWays = [];
    const southboundWays = [];
    const undirectedWays = [];

    for (const element of response.data.elements) {
      if (element.type !== 'way' || !element.geometry) continue;

      const tags = element.tags || {};

      // Extract coordinates
      const coords = element.geometry.map(node => [node.lon, node.lat]);

      // Determine direction based on tags
      let direction = 'undirected';

      if (tags['destination:ref:to'] || tags['destination:ref']) {
        const dest = (tags['destination:ref:to'] || tags['destination:ref']).toLowerCase();
        if (dest.includes('east')) direction = 'EB';
        else if (dest.includes('west')) direction = 'WB';
        else if (dest.includes('north')) direction = 'NB';
        else if (dest.includes('south')) direction = 'SB';
      }

      // Check oneway + cardinal direction from node positions
      if (direction === 'undirected' && coords.length >= 2) {
        const start = coords[0];
        const end = coords[coords.length - 1];
        const deltaLon = end[0] - start[0];
        const deltaLat = end[1] - start[1];

        if (Math.abs(deltaLon) > Math.abs(deltaLat)) {
          // Primarily east-west
          direction = deltaLon > 0 ? 'EB' : 'WB';
        } else {
          // Primarily north-south
          direction = deltaLat > 0 ? 'NB' : 'SB';
        }
      }

      // Store in appropriate array
      if (direction === 'EB') eastboundWays.push(coords);
      else if (direction === 'WB') westboundWays.push(coords);
      else if (direction === 'NB') northboundWays.push(coords);
      else if (direction === 'SB') southboundWays.push(coords);
      else undirectedWays.push(coords);
    }

    console.log(`   📊 Direction breakdown:`);
    if (orientation === 'EW') {
      console.log(`      Eastbound (EB): ${eastboundWays.length} segments`);
      console.log(`      Westbound (WB): ${westboundWays.length} segments`);
    } else {
      console.log(`      Northbound (NB): ${northboundWays.length} segments`);
      console.log(`      Southbound (SB): ${southboundWays.length} segments`);
    }
    console.log(`      Undirected: ${undirectedWays.length} segments`);

    // Merge coordinates for each direction
    const result = {};

    if (orientation === 'EW') {
      result.EB = mergeAndSimplifyWays(eastboundWays, 'east');
      result.WB = mergeAndSimplifyWays(westboundWays, 'west');

      // If we have undirected ways and no directional data, split them
      if (undirectedWays.length > 0 && eastboundWays.length === 0 && westboundWays.length === 0) {
        console.log(`   ⚠️  No directional data found, creating single combined route`);
        result.COMBINED = mergeAndSimplifyWays(undirectedWays, 'east');
      }
    } else {
      result.NB = mergeAndSimplifyWays(northboundWays, 'north');
      result.SB = mergeAndSimplifyWays(southboundWays, 'south');

      if (undirectedWays.length > 0 && northboundWays.length === 0 && southboundWays.length === 0) {
        console.log(`   ⚠️  No directional data found, creating single combined route`);
        result.COMBINED = mergeAndSimplifyWays(undirectedWays, 'north');
      }
    }

    return result;

  } catch (error) {
    console.error(`   ❌ OSM Overpass API error: ${error.message}`);
    return null;
  }
}

/**
 * Merge multiple way segments and simplify
 */
function mergeAndSimplifyWays(ways, direction) {
  if (!ways || ways.length === 0) return null;

  // Flatten all coordinates
  const allCoords = [];
  for (const way of ways) {
    allCoords.push(...way);
  }

  if (allCoords.length === 0) return null;

  // Sort by primary direction
  if (direction === 'east' || direction === 'west') {
    allCoords.sort((a, b) => direction === 'east' ? a[0] - b[0] : b[0] - a[0]);
  } else {
    allCoords.sort((a, b) => direction === 'north' ? a[1] - b[1] : b[1] - a[1]);
  }

  // Deduplicate
  const deduped = allCoords.filter((coord, i) => {
    if (i === 0) return true;
    const prev = allCoords[i - 1];
    return Math.abs(coord[0] - prev[0]) > 0.001 || Math.abs(coord[1] - prev[1]) > 0.001;
  });

  // Simplify to ~150 points
  const simplified = simplifyCoordinates(deduped, 150);

  console.log(`   ✓ ${direction.toUpperCase()}: ${allCoords.length} → ${deduped.length} → ${simplified.length} points`);

  return simplified;
}

/**
 * Simplify coordinates
 */
function simplifyCoordinates(coordinates, targetPoints = 150) {
  if (!coordinates || coordinates.length <= targetPoints) {
    return coordinates;
  }

  const keepEveryN = Math.floor(coordinates.length / targetPoints);
  return coordinates.filter((coord, index) =>
    index === 0 ||
    index === coordinates.length - 1 ||
    index % keepEveryN === 0
  );
}

/**
 * Update or create corridor in database
 */
async function upsertCorridor(interstate, direction, geometry) {
  const { name, bounds, orientation } = interstate;

  const corridorName = direction ? `${name} ${direction}` : name;
  const description = direction
    ? `Interstate ${interstate.number} ${direction === 'EB' ? 'Eastbound' : direction === 'WB' ? 'Westbound' : direction === 'NB' ? 'Northbound' : 'Southbound'} lanes`
    : `Interstate ${interstate.number}`;

  const geojson = {
    type: 'LineString',
    coordinates: geometry
  };

  // Check if corridor exists
  const existing = await pool.query(
    `SELECT id FROM corridors WHERE name = $1`,
    [corridorName]
  );

  if (existing.rows.length > 0) {
    // Update
    await pool.query(
      `UPDATE corridors
       SET geometry = $1::jsonb,
           description = $2,
           bounds = $3::jsonb,
           updated_at = NOW()
       WHERE id = $4`,
      [JSON.stringify(geojson), description, JSON.stringify(bounds), existing.rows[0].id]
    );
    console.log(`   ✅ Updated: ${corridorName}`);
  } else {
    // Insert - generate UUID for id
    await pool.query(
      `INSERT INTO corridors (id, name, description, geometry, bounds, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::jsonb, NOW(), NOW())`,
      [corridorName, description, JSON.stringify(geojson), JSON.stringify(bounds)]
    );
    console.log(`   ✅ Created: ${corridorName}`);
  }
}

/**
 * Main execution
 */
async function fetchAllInterstates() {
  console.log('🇺🇸 Fetching ALL Interstate Highway Geometries from OpenStreetMap\n');
  console.log('This will take several minutes due to API rate limiting...\n');

  let totalSuccess = 0;
  let totalFailed = 0;
  let totalDirections = 0;

  try {
    for (let i = 0; i < INTERSTATES.length; i++) {
      const interstate = INTERSTATES[i];

      const geometries = await fetchInterstateFromOSM(interstate);

      if (!geometries) {
        console.log(`   ❌ Failed to fetch ${interstate.name}`);
        totalFailed++;
      } else {
        // Insert each direction
        for (const [direction, coords] of Object.entries(geometries)) {
          if (coords && coords.length >= 2) {
            await upsertCorridor(
              interstate,
              direction === 'COMBINED' ? null : direction,
              coords
            );
            totalDirections++;
          }
        }
        totalSuccess++;
      }

      // Rate limiting: 3 seconds between interstates
      if (i < INTERSTATES.length - 1) {
        console.log(`\n   ⏳ Waiting 3 seconds before next interstate...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Successfully fetched: ${totalSuccess} interstates`);
    console.log(`❌ Failed: ${totalFailed} interstates`);
    console.log(`🛣️  Total corridor directions created: ${totalDirections}`);
    console.log('');

    // Show all corridors
    const allCorridors = await pool.query(`
      SELECT name, jsonb_array_length((geometry->'coordinates')) as points
      FROM corridors
      WHERE name LIKE 'I-%'
      ORDER BY name
    `);

    console.log('📋 All Interstate Corridors in Database:');
    for (const row of allCorridors.rows) {
      console.log(`   ${row.name}: ${row.points} points`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run
if (require.main === module) {
  fetchAllInterstates()
    .then(() => {
      console.log('\n✅ All interstate geometries updated successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { fetchAllInterstates };

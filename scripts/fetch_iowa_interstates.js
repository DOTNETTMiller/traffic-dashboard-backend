#!/usr/bin/env node

/**
 * Fetch Interstate geometries specifically for Iowa
 * I-35, I-80, I-29, I-380
 */

const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Iowa-specific Interstate bounds (smaller regions to avoid OSM timeouts)
const IOWA_INTERSTATES = [
  {
    number: 35,
    name: 'I-35',
    orientation: 'North-South',
    // Iowa portion of I-35
    bounds: {
      minLon: -94.0,
      minLat: 40.5,
      maxLon: -93.0,
      maxLat: 43.5
    }
  },
  {
    number: 80,
    name: 'I-80',
    orientation: 'East-West',
    // Iowa portion of I-80
    bounds: {
      minLon: -96.5,
      minLat: 41.0,
      maxLon: -90.0,
      maxLat: 42.0
    }
  },
  {
    number: 29,
    name: 'I-29',
    orientation: 'North-South',
    // Iowa portion of I-29
    bounds: {
      minLon: -96.5,
      minLat: 40.5,
      maxLon: -95.5,
      maxLat: 43.5
    }
  },
  {
    number: 380,
    name: 'I-380',
    orientation: 'North-South',
    // Iowa I-380 (Cedar Rapids to Waterloo)
    bounds: {
      minLon: -92.0,
      minLat: 41.5,
      maxLon: -91.5,
      maxLat: 42.5
    }
  }
];

async function fetchFromOSM(interstate) {
  console.log(`\n======================================================================`);
  console.log(`🛣️  Fetching ${interstate.name} (${interstate.orientation}) - Iowa portion`);
  console.log(`   Bounds: [${interstate.bounds.minLon}, ${interstate.bounds.minLat}] to [${interstate.bounds.maxLon}, ${interstate.bounds.maxLat}]`);
  console.log(`======================================================================`);

  const query = `
    [out:json][timeout:60];
    way["highway"="motorway"]["ref"~"^${interstate.number}$"]
       (${interstate.bounds.minLat},${interstate.bounds.minLon},${interstate.bounds.maxLat},${interstate.bounds.maxLon});
    out geom;
  `;

  try {
    console.log('   🌍 Querying OpenStreetMap Overpass API...');
    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      query,
      {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 60000
      }
    );

    const ways = response.data.elements || [];

    if (ways.length === 0) {
      console.log(`   ⚠️  No ${interstate.name} segments found in Iowa`);
      return null;
    }

    console.log(`   ✓ Found ${ways.length} way segments`);

    // Separate by direction based on oneway tags and geometry
    const eastboundWays = [];
    const westboundWays = [];
    const northboundWays = [];
    const southboundWays = [];

    for (const way of ways) {
      const tags = way.tags || {};
      const oneway = tags.oneway;
      const lanes = tags.lanes;

      // Extract direction from tags or geometry
      let direction = null;

      if (tags['oneway:direction']) {
        direction = tags['oneway:direction'].toUpperCase();
      } else if (oneway === 'yes' || oneway === '1' || oneway === 'true') {
        // Analyze geometry to determine direction
        if (way.geometry && way.geometry.length >= 2) {
          const start = way.geometry[0];
          const end = way.geometry[way.geometry.length - 1];
          const dLon = end.lon - start.lon;
          const dLat = end.lat - start.lat;

          if (interstate.orientation === 'East-West') {
            direction = dLon > 0 ? 'EAST' : 'WEST';
          } else {
            direction = dLat > 0 ? 'NORTH' : 'SOUTH';
          }
        }
      }

      if (direction === 'EAST') eastboundWays.push(way);
      else if (direction === 'WEST') westboundWays.push(way);
      else if (direction === 'NORTH') northboundWays.push(way);
      else if (direction === 'SOUTH') southboundWays.push(way);
    }

    console.log(`   📊 Direction breakdown:`);
    if (interstate.orientation === 'East-West') {
      console.log(`      Eastbound (EB): ${eastboundWays.length} segments`);
      console.log(`      Westbound (WB): ${westboundWays.length} segments`);
    } else {
      console.log(`      Northbound (NB): ${northboundWays.length} segments`);
      console.log(`      Southbound (SB): ${southboundWays.length} segments`);
    }

    const results = [];

    if (interstate.orientation === 'East-West') {
      if (eastboundWays.length > 0) {
        const geom = buildGeometry(eastboundWays);
        if (geom) {
          await saveGeometry(interstate.name, 'EB', geom);
          results.push({ direction: 'EB', points: geom.length });
        }
      }

      if (westboundWays.length > 0) {
        const geom = buildGeometry(westboundWays);
        if (geom) {
          await saveGeometry(interstate.name, 'WB', geom);
          results.push({ direction: 'WB', points: geom.length });
        }
      }
    } else {
      if (northboundWays.length > 0) {
        const geom = buildGeometry(northboundWays);
        if (geom) {
          await saveGeometry(interstate.name, 'NB', geom);
          results.push({ direction: 'NB', points: geom.length });
        }
      }

      if (southboundWays.length > 0) {
        const geom = buildGeometry(southboundWays);
        if (geom) {
          await saveGeometry(interstate.name, 'SB', geom);
          results.push({ direction: 'SB', points: geom.length });
        }
      }
    }

    return results;

  } catch (error) {
    console.log(`   ❌ OSM Overpass API error: ${error.message}`);
    return null;
  }
}

function buildGeometry(ways) {
  if (ways.length === 0) return null;

  // Extract all coordinates from all ways
  const allCoords = [];
  for (const way of ways) {
    if (way.geometry) {
      for (const node of way.geometry) {
        allCoords.push([node.lon, node.lat]);
      }
    }
  }

  if (allCoords.length < 2) return null;

  // Remove duplicates
  const uniqueCoords = [];
  for (let i = 0; i < allCoords.length; i++) {
    const coord = allCoords[i];
    const isDuplicate = i > 0 &&
      coord[0] === allCoords[i - 1][0] &&
      coord[1] === allCoords[i - 1][1];

    if (!isDuplicate) {
      uniqueCoords.push(coord);
    }
  }

  return uniqueCoords;
}

async function saveGeometry(corridor, direction, coordinates) {
  const wkt = `LINESTRING(${coordinates.map(c => `${c[0]} ${c[1]}`).join(', ')})`;

  await pool.query(
    `INSERT INTO interstate_geometries (corridor, direction, geometry)
     VALUES ($1, $2, ST_GeomFromText($3, 4326))
     ON CONFLICT (corridor, direction)
     DO UPDATE SET
       geometry = ST_GeomFromText($3, 4326),
       updated_at = NOW()`,
    [corridor, direction, wkt]
  );

  console.log(`   ✅ Saved: ${corridor} ${direction} (${coordinates.length} points)`);
}

async function fetchAllIowaInterstates() {
  console.log('==========================================================================');
  console.log('🌽 Fetching Iowa Interstate Highway Geometries from OpenStreetMap');
  console.log('==========================================================================\n');

  const results = [];

  for (const interstate of IOWA_INTERSTATES) {
    const result = await fetchFromOSM(interstate);
    if (result) {
      results.push({ interstate: interstate.name, directions: result });
    }

    // Rate limiting
    console.log('   ⏳ Waiting 3 seconds before next interstate...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n==========================================================================');
  console.log('📊 Summary');
  console.log('==========================================================================');

  for (const result of results) {
    console.log(`✅ ${result.interstate}:`);
    for (const dir of result.directions) {
      console.log(`   ${dir.direction}: ${dir.points.toLocaleString()} points`);
    }
  }

  console.log('\n==========================================================================');
  console.log('✅ Iowa Interstate Fetch Complete!');
  console.log('==========================================================================\n');
}

if (require.main === module) {
  fetchAllIowaInterstates()
    .then(() => pool.end())
    .catch(error => {
      console.error('Fatal error:', error);
      pool.end();
      process.exit(1);
    });
}

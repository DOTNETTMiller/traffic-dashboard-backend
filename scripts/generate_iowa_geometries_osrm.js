#!/usr/bin/env node

/**
 * Generate Interstate geometries for Iowa using OSRM routing
 *
 * Since OSM Overpass API is timing out, we'll use OSRM to route between
 * major interchange points along each Interstate to get accurate geometries
 */

const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Major interchanges/endpoints for Iowa Interstates
const IOWA_INTERSTATES = {
  'I-80': {
    orientation: 'EB/WB',
    waypoints: [
      // West to East across Iowa
      [-95.9308, 41.2619], // Council Bluffs (I-29/I-80)
      [-95.0442, 41.2567], // Atlantic area
      [-94.3616, 41.5910], // Des Moines (I-35/I-80)
      [-93.7077, 41.7322], // Grinnell area
      [-92.4747, 41.6560], // Iowa City area
      [-91.5276, 41.5892], // West Liberty area
      [-90.5753, 41.5236]  // Davenport (I-80 end at IL border)
    ]
  },
  'I-35': {
    orientation: 'NB/SB',
    waypoints: [
      // South to North through Iowa
      [-93.5138, 40.5855], // Missouri border
      [-93.5744, 40.8089], // Lamoni area
      [-93.6321, 41.0289], // Osceola area
      [-93.7099, 41.3582], // Indianola area
      [-93.6225, 41.6014], // Des Moines (I-80/I-35)
      [-93.5747, 41.7356], // Ankeny area
      [-93.6186, 42.0359], // Ames area
      [-93.5358, 42.4803], // Iowa Falls area
      [-93.5021, 42.9976], // Mason City area
      [-93.4978, 43.4843]  // Minnesota border
    ]
  },
  'I-29': {
    orientation: 'NB/SB',
    waypoints: [
      // South to North along western Iowa
      [-95.8398, 40.7423], // Missouri border
      [-95.7698, 40.9156], // Hamburg area
      [-95.8439, 41.1484], // Nebraska City area
      [-95.9308, 41.2619], // Council Bluffs (I-29/I-80)
      [-96.0494, 41.5156], // Missouri Valley area
      [-96.0989, 41.9644], // Onawa area
      [-96.3458, 42.4856], // Sioux City area
      [-96.3764, 42.7359], // South Dakota border
    ]
  },
  'I-380': {
    orientation: 'NB/SB',
    waypoints: [
      // South to North
      [-91.6748, 41.6608], // Cedar Rapids (I-380 south end at I-80)
      [-91.7089, 41.9844], // Center Point area
      [-92.3439, 42.4908]  // Waterloo (I-380 north end)
    ]
  }
};

async function getOSRMRoute(waypoints) {
  // Build OSRM query
  const coords = waypoints.map(w => `${w[0]},${w[1]}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const response = await axios.get(url, { timeout: 30000 });

    if (response.data.routes && response.data.routes.length > 0) {
      const geometry = response.data.routes[0].geometry;
      return geometry.coordinates; // Already in [lng, lat] format
    }

    return null;
  } catch (error) {
    console.error(`   ❌ OSRM error: ${error.message}`);
    return null;
  }
}

async function saveGeometry(corridor, direction, coordinates) {
  const wkt = `LINESTRING(${coordinates.map(c => `${c[0]} ${c[1]}`).join(', ')})`;

  // Delete existing if present
  await pool.query(
    `DELETE FROM interstate_geometries WHERE corridor = $1 AND direction = $2`,
    [corridor, direction]
  );

  // Insert new geometry (Iowa specific)
  await pool.query(
    `INSERT INTO interstate_geometries (corridor, state, direction, geometry)
     VALUES ($1, $2, $3, ST_GeomFromText($4, 4326))`,
    [corridor, 'IA', direction, wkt]
  );

  const miles = await pool.query(
    `SELECT ST_Length(geometry::geography) / 1609.34 as miles
     FROM interstate_geometries
     WHERE corridor = $1 AND direction = $2`,
    [corridor, direction]
  );

  console.log(`   ✅ Saved: ${corridor} ${direction} (${coordinates.length.toLocaleString()} points, ${Math.round(miles.rows[0].miles)} miles)`);
}

async function generateIowaInterstates() {
  console.log('==========================================================================');
  console.log('🌽 Generating Iowa Interstate Geometries using OSRM Routing');
  console.log('==========================================================================\n');

  const results = [];

  for (const [corridor, config] of Object.entries(IOWA_INTERSTATES)) {
    console.log(`\n======================================================================`);
    console.log(`🛣️  Generating ${corridor} (${config.orientation})`);
    console.log(`   Waypoints: ${config.waypoints.length}`);
    console.log(`======================================================================`);

    // Generate route geometry
    console.log('   🗺️  Routing via OSRM...');
    const geometry = await getOSRMRoute(config.waypoints);

    if (!geometry || geometry.length < 2) {
      console.log(`   ❌ Failed to generate geometry for ${corridor}`);
      continue;
    }

    console.log(`   ✓ Generated geometry with ${geometry.length.toLocaleString()} points`);

    // For East-West: save as EB and WB (reversed)
    // For North-South: save as NB and SB (reversed)
    if (config.orientation === 'EB/WB') {
      // Save eastbound (original direction)
      await saveGeometry(corridor, 'EB', geometry);

      // Save westbound (reversed)
      const reversed = [...geometry].reverse();
      await saveGeometry(corridor, 'WB', reversed);

      results.push({ corridor, directions: ['EB', 'WB'], points: geometry.length });
    } else {
      // Save northbound (original direction)
      await saveGeometry(corridor, 'NB', geometry);

      // Save southbound (reversed)
      const reversed = [...geometry].reverse();
      await saveGeometry(corridor, 'SB', reversed);

      results.push({ corridor, directions: ['NB', 'SB'], points: geometry.length });
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n==========================================================================');
  console.log('📊 Summary');
  console.log('==========================================================================');

  for (const result of results) {
    console.log(`✅ ${result.corridor}: ${result.directions.join(', ')} (${result.points.toLocaleString()} points each)`);
  }

  console.log('\n==========================================================================');
  console.log('✅ Iowa Interstate Generation Complete!');
  console.log('==========================================================================\n');
}

if (require.main === module) {
  generateIowaInterstates()
    .then(() => pool.end())
    .catch(error => {
      console.error('Fatal error:', error);
      pool.end();
      process.exit(1);
    });
}

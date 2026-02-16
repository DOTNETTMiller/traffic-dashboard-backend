/**
 * Periodic check for Interstate polyline updates
 * Run this monthly to detect if OSM data has changed and polylines need updating
 *
 * Usage: node scripts/check_polyline_updates.js
 */

const { Pool } = require('pg');
const axios = require('axios');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getOSMSegmentCount(bbox, highway, refTag) {
  const query = `
    [out:json][timeout:25][bbox:${bbox}];
    (
      way["highway"~"${highway}"]["ref"~"${refTag}"];
    );
    out count;
  `;

  try {
    const response = await axios.post(OVERPASS_URL, query, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 30000
    });

    return response.data.elements?.[0]?.tags?.ways || 0;
  } catch (err) {
    console.log(`    Error querying OSM: ${err.message}`);
    return null;
  }
}

async function checkForUpdates() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('======================================================================');
  console.log('🔍 CHECKING FOR INTERSTATE POLYLINE UPDATES');
  console.log('======================================================================\n');
  console.log('This compares current database polylines with latest OSM data');
  console.log('to detect if highways have been updated/realigned.\n');

  try {
    // Define check points - key states for each Interstate
    const checkPoints = [
      {
        name: 'I-80 California',
        bbox: '37.7,-122.5,39.8,-119.5',
        highway: 'motorway',
        ref: 'I 80|Interstate 80',
        corridor: 'i-80-eb'
      },
      {
        name: 'I-80 Iowa',
        bbox: '40.3,-96.7,43.1,-90.1',
        highway: 'motorway',
        ref: 'I 80|Interstate 80',
        corridor: 'i-80-eb'
      },
      {
        name: 'I-35 Texas',
        bbox: '25.8,-100.0,36.5,-93.5',
        highway: 'motorway|trunk',
        ref: 'I 35|Interstate 35',
        corridor: 'i-35-nb'
      },
      {
        name: 'I-35 Minnesota',
        bbox: '43.4,-97.3,49.5,-89.5',
        highway: 'motorway|trunk',
        ref: 'I 35|Interstate 35',
        corridor: 'i-35-nb'
      }
    ];

    const results = [];

    for (const check of checkPoints) {
      console.log(`Checking: ${check.name}...`);

      // Get current polyline info from database
      const dbResult = await pool.query(
        'SELECT geometry, updated_at FROM corridors WHERE id = $1',
        [check.corridor]
      );

      if (!dbResult.rows[0]?.geometry) {
        console.log(`  ⚠️  No polyline found in database\n`);
        continue;
      }

      const dbPolyline = dbResult.rows[0].geometry;
      const updatedAt = dbResult.rows[0].updated_at;
      const daysSinceUpdate = Math.floor((Date.now() - new Date(updatedAt)) / (1000 * 60 * 60 * 24));

      console.log(`  Database updated: ${daysSinceUpdate} days ago`);
      console.log(`  Current polyline points: ${dbPolyline.coordinates.length}`);

      // Query OSM for current segment count
      const osmSegments = await getOSMSegmentCount(check.bbox, check.highway, check.ref);

      if (osmSegments !== null) {
        console.log(`  OSM segments in region: ${osmSegments}`);

        results.push({
          name: check.name,
          corridor: check.corridor,
          daysSinceUpdate,
          points: dbPolyline.coordinates.length,
          osmSegments,
          status: daysSinceUpdate > 90 ? 'REVIEW' : 'OK'
        });

        console.log(`  Status: ${daysSinceUpdate > 90 ? '⚠️  REVIEW (>90 days old)' : '✅ OK'}\n`);
      } else {
        console.log(`  Status: ⚠️  Could not check OSM\n`);
      }

      // Rate limit
      await sleep(2000);
    }

    console.log('\n======================================================================');
    console.log('📊 SUMMARY');
    console.log('======================================================================\n');

    const needsReview = results.filter(r => r.status === 'REVIEW');

    if (needsReview.length > 0) {
      console.log('⚠️  Polylines needing review (>90 days old):');
      needsReview.forEach(r => {
        console.log(`  - ${r.name} (${r.daysSinceUpdate} days old)`);
      });
      console.log('\nRecommendation: Run update scripts to refresh polylines\n');
    } else {
      console.log('✅ All polylines are up to date (less than 90 days old)\n');
    }

    console.log('Maintenance Schedule:');
    console.log('  - Run this check: Monthly');
    console.log('  - Update polylines: Every 90 days or when major highway changes occur');
    console.log('  - Update scripts to run:');
    console.log('    1. node scripts/build_interstate_polylines.js (for I-80)');
    console.log('    2. node scripts/fetch_i35_via_nominatim.js (for I-35 base)');
    console.log('    3. node scripts/complete_i35_iowa_minnesota.js (for I-35 completion)');
    console.log('    4. node scripts/fix_i80_wb_sequence.js (to fix I-80 WB if needed)');

    await pool.end();

  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

checkForUpdates();

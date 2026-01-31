/**
 * Fetch actual I-80 geometry from OpenStreetMap using Overpass API
 *
 * This script downloads the real Interstate 80 highway geometry and
 * updates the corridors table with accurate road-following polylines
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

/**
 * Fetch I-80 geometry from OpenStreetMap Overpass API
 *
 * Query filters for highway=motorway with ref="I 80"
 */
async function fetchI80FromOSM(stateBounds) {
  const { south, north, west, east } = stateBounds;

  // Overpass API query for I-80 within bounds
  const overpassQuery = `
    [out:json][timeout:60];
    (
      way["highway"="motorway"]["ref"~"I-?80"];
      way["highway"="motorway_link"]["ref"~"I-?80"];
    )(${south},${west},${north},${east});
    out geom;
  `;

  try {
    console.log(`   🌍 Querying OpenStreetMap Overpass API...`);

    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      overpassQuery,
      {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 90000 // 90 second timeout
      }
    );

    if (!response.data || !response.data.elements || response.data.elements.length === 0) {
      console.log(`   ⚠️  No I-80 segments found in this region`);
      return null;
    }

    console.log(`   ✓ Found ${response.data.elements.length} I-80 way segments`);

    // Convert OSM ways to coordinates
    const allCoordinates = [];

    for (const element of response.data.elements) {
      if (element.type === 'way' && element.geometry) {
        for (const node of element.geometry) {
          // OSM returns [lat, lon], we need [lon, lat] for GeoJSON
          allCoordinates.push([node.lon, node.lat]);
        }
      }
    }

    if (allCoordinates.length === 0) {
      console.log(`   ⚠️  No valid coordinates extracted`);
      return null;
    }

    console.log(`   ✓ Extracted ${allCoordinates.length} coordinate points`);

    // Sort coordinates west to east for proper line direction
    allCoordinates.sort((a, b) => a[0] - b[0]);

    // Remove duplicate consecutive points
    const deduplicated = allCoordinates.filter((coord, index) => {
      if (index === 0) return true;
      const prev = allCoordinates[index - 1];
      return coord[0] !== prev[0] || coord[1] !== prev[1];
    });

    console.log(`   ✓ Deduplicated to ${deduplicated.length} unique points`);

    return deduplicated;

  } catch (error) {
    console.error(`   ❌ OSM Overpass API error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
    }
    return null;
  }
}

/**
 * Simplify coordinates by keeping every Nth point
 */
function simplifyCoordinates(coordinates, targetPoints = 100) {
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
 * Main function to update corridor geometries
 */
async function updateCorridorGeometries() {
  console.log('🛣️  Fetching I-80 geometry from OpenStreetMap...\n');

  try {
    // Get all I-80 corridors from database
    const corridorsResult = await pool.query(`
      SELECT
        id,
        name,
        description,
        bounds
      FROM corridors
      WHERE name LIKE '%I-80%' OR name LIKE '%Interstate 80%'
      ORDER BY id
    `);

    console.log(`📊 Found ${corridorsResult.rows.length} I-80 corridor(s) to update\n`);

    let successCount = 0;
    let failCount = 0;

    for (const corridor of corridorsResult.rows) {
      console.log(`\n🔧 Processing: ${corridor.name}`);
      console.log(`   Description: ${corridor.description || 'N/A'}`);

      if (!corridor.bounds) {
        console.log(`   ⚠️  Skipping - no bounds defined`);
        failCount++;
        continue;
      }

      console.log(`   Bounds: [${corridor.bounds.west.toFixed(3)}, ${corridor.bounds.south.toFixed(3)}] to [${corridor.bounds.east.toFixed(3)}, ${corridor.bounds.north.toFixed(3)}]`);

      // Fetch OSM data for this corridor segment
      const coordinates = await fetchI80FromOSM(corridor.bounds);

      if (!coordinates || coordinates.length < 2) {
        console.log(`   ❌ Failed to fetch valid geometry`);
        failCount++;
        continue;
      }

      // Simplify to ~100 points for optimal rendering performance
      const simplified = simplifyCoordinates(coordinates, 100);
      console.log(`   ✓ Simplified from ${coordinates.length} to ${simplified.length} points`);

      // Create GeoJSON LineString
      const geometry = {
        type: 'LineString',
        coordinates: simplified
      };

      // Update database
      await pool.query(
        `UPDATE corridors
         SET geometry = $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(geometry), corridor.id]
      );

      console.log(`   ✅ Database updated successfully`);
      successCount++;

      // Rate limiting - wait 2 seconds between requests to be respectful to Overpass API
      if (corridorsResult.rows.length > 1) {
        console.log(`   ⏳ Waiting 2 seconds before next request...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${successCount} corridor(s)`);
    console.log(`❌ Failed: ${failCount} corridor(s)`);
    console.log(`📝 Total processed: ${corridorsResult.rows.length} corridor(s)`);
    console.log('');

    // Verify final state
    const verifyResult = await pool.query(`
      SELECT
        id,
        name,
        jsonb_array_length((geometry->'coordinates')) as point_count
      FROM corridors
      WHERE name LIKE '%I-80%' OR name LIKE '%Interstate 80%'
      ORDER BY id
    `);

    console.log('📊 Final geometry state:');
    for (const row of verifyResult.rows) {
      console.log(`   - ${row.name}: ${row.point_count} points`);
    }
    console.log('');

    if (successCount > 0) {
      console.log('✅ I-80 corridor geometries updated with real OpenStreetMap data!');
      console.log('   The map will now display accurate highway routes.');
    } else {
      console.log('⚠️  No corridors were updated. Check bounds and corridor names.');
    }

  } catch (error) {
    console.error('\n❌ Error updating corridor geometries:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  updateCorridorGeometries()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { updateCorridorGeometries, fetchI80FromOSM };

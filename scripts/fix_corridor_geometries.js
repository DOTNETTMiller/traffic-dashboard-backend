/**
 * Fix fragmented TETC corridor geometries using OSRM road-following routes
 *
 * Replaces straight-line or fragmented corridor geometries with proper
 * road-following paths from OSRM routing engine
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

// Use public OSRM instance (free, no API key needed)
const OSRM_BASE_URL = 'https://router.project-osrm.org';

/**
 * Get road-following geometry between two points using OSRM
 */
async function getOSRMRoute(startLon, startLat, endLon, endLat) {
  try {
    const url = `${OSRM_BASE_URL}/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;

    const response = await axios.get(url, { timeout: 10000 });

    if (response.data.code === 'Ok' && response.data.routes && response.data.routes.length > 0) {
      return response.data.routes[0].geometry.coordinates;
    }

    return null;
  } catch (error) {
    console.error(`   ⚠️  OSRM routing failed: ${error.message}`);
    return null;
  }
}

/**
 * Simplify coordinates by keeping every Nth point
 */
function simplifyCoordinates(coordinates, keepEveryN = 3) {
  if (!coordinates || coordinates.length < 10) return coordinates;

  return coordinates.filter((coord, index) =>
    index === 0 ||
    index === coordinates.length - 1 ||
    index % keepEveryN === 0
  );
}

async function fixCorridorGeometries() {
  console.log('🔧 Fixing TETC corridor geometries with OSRM road-following routes...\n');

  try {
    // Step 1: Check current geometry fragmentation
    const corridorsCheck = await pool.query(`
      SELECT
        id,
        name,
        description,
        geometry,
        bounds
      FROM corridors
      WHERE geometry IS NOT NULL
      ORDER BY id
    `);

    console.log(`📊 Found ${corridorsCheck.rows.length} corridors to fix\n`);

    // Step 2: Fix each corridor using OSRM routing
    let fixedCount = 0;
    let skippedCount = 0;

    for (const corridor of corridorsCheck.rows) {
      console.log(`🛣️  Processing: ${corridor.name}`);

      // Extract start and end points from bounds
      const bounds = corridor.bounds;
      if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
        console.log(`   ⚠️  Skipping - no bounds defined`);
        skippedCount++;
        continue;
      }

      // Use bounds to define corridor endpoints (west to east for I-80)
      const startLon = bounds.west;
      const startLat = (bounds.north + bounds.south) / 2;
      const endLon = bounds.east;
      const endLat = (bounds.north + bounds.south) / 2;

      console.log(`   📍 Route: [${startLon.toFixed(3)}, ${startLat.toFixed(3)}] → [${endLon.toFixed(3)}, ${endLat.toFixed(3)}]`);

      // Get OSRM route
      const routeCoordinates = await getOSRMRoute(startLon, startLat, endLon, endLat);

      if (!routeCoordinates || routeCoordinates.length < 2) {
        console.log(`   ⚠️  OSRM route failed, keeping existing geometry`);
        skippedCount++;
        continue;
      }

      console.log(`   ✓ OSRM returned ${routeCoordinates.length} points`);

      // Simplify to reduce point density (keep every 5th point for smoother rendering)
      const simplified = simplifyCoordinates(routeCoordinates, 5);
      console.log(`   ✓ Simplified to ${simplified.length} points`);

      // Update corridor geometry
      const newGeometry = {
        type: 'LineString',
        coordinates: simplified
      };

      await pool.query(
        `UPDATE corridors SET geometry = $1::jsonb WHERE id = $2`,
        [JSON.stringify(newGeometry), corridor.id]
      );

      fixedCount++;
      console.log(`   ✅ Updated successfully\n`);

      // Add small delay to avoid overwhelming OSRM
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Fixed: ${fixedCount} corridors`);
    console.log(`   ⚠️  Skipped: ${skippedCount} corridors`);
    console.log(`   📝 Total: ${corridorsCheck.rows.length} corridors`);
    console.log('');

    // Step 3: Verify final state
    const finalCheck = await pool.query(`
      SELECT
        COUNT(*) as total,
        AVG(jsonb_array_length((geometry->'coordinates')))::int as avg_points,
        MIN(jsonb_array_length((geometry->'coordinates'))) as min_points,
        MAX(jsonb_array_length((geometry->'coordinates'))) as max_points
      FROM corridors
      WHERE geometry IS NOT NULL
    `);

    const stats = finalCheck.rows[0];
    console.log('📊 Final geometry statistics:');
    console.log(`   Total corridors: ${stats.total}`);
    console.log(`   Average points: ${stats.avg_points}`);
    console.log(`   Range: ${stats.min_points} - ${stats.max_points} points`);
    console.log('');

    console.log('✅ Corridor geometry optimization complete!');
    console.log('   Corridors now use OSRM road-following routes for accurate visualization.');

  } catch (error) {
    console.error('❌ Error fixing corridor geometries:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  fixCorridorGeometries()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { fixCorridorGeometries };

/**
 * Check for Interstate Corridor Geometry Updates
 *
 * This script compares current corridor geometries in the database with
 * the latest data from OpenStreetMap to detect when routes have been updated.
 *
 * Use cases:
 * - Detect new construction/realignments
 * - Find route improvements in OSM data
 * - Schedule periodic updates
 * - Monitor data freshness
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
 * Fetch latest OSM metadata for an interstate
 */
async function fetchOSMMetadata(interstate, bounds) {
  const { south, north, west, east } = bounds;

  // Query just for metadata (no geometry, much faster)
  const overpassQuery = `
    [out:json][timeout:30];
    (
      way["highway"="motorway"]["ref"~"^I-?${interstate}$"](${south},${west},${north},${east});
    );
    out tags;
  `;

  try {
    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      overpassQuery,
      {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 45000
      }
    );

    if (!response.data || !response.data.elements) {
      return null;
    }

    // Extract last modified dates from OSM way elements
    const elements = response.data.elements;
    const timestamps = elements
      .map(el => el.timestamp)
      .filter(t => t)
      .map(t => new Date(t));

    if (timestamps.length === 0) {
      return null;
    }

    // Get the most recent modification
    const latestModification = new Date(Math.max(...timestamps));

    return {
      wayCount: elements.length,
      latestModification,
      elements: elements.length
    };

  } catch (error) {
    console.error(`   ⚠️  OSM metadata fetch failed: ${error.message}`);
    return null;
  }
}

/**
 * Calculate geometry similarity score (0-100)
 */
function calculateGeometrySimilarity(geom1, geom2) {
  if (!geom1 || !geom2) return 0;

  const coords1 = geom1.coordinates || [];
  const coords2 = geom2.coordinates || [];

  if (coords1.length === 0 || coords2.length === 0) return 0;

  // Compare point counts
  const countRatio = Math.min(coords1.length, coords2.length) / Math.max(coords1.length, coords2.length);

  // Sample and compare coordinates
  const sampleSize = Math.min(10, coords1.length, coords2.length);
  let matchingPoints = 0;

  for (let i = 0; i < sampleSize; i++) {
    const idx1 = Math.floor(i * coords1.length / sampleSize);
    const idx2 = Math.floor(i * coords2.length / sampleSize);

    const [lon1, lat1] = coords1[idx1];
    const [lon2, lat2] = coords2[idx2];

    // Allow 0.01 degree tolerance (~1km)
    if (Math.abs(lon1 - lon2) < 0.01 && Math.abs(lat1 - lat2) < 0.01) {
      matchingPoints++;
    }
  }

  const pointMatchRatio = matchingPoints / sampleSize;

  // Weighted score
  return Math.round((countRatio * 0.3 + pointMatchRatio * 0.7) * 100);
}

/**
 * Check all corridors for updates
 */
async function checkCorridorUpdates(autoUpdate = false) {
  console.log('🔍 Checking Interstate Corridor Geometries for Updates\n');
  console.log(`Mode: ${autoUpdate ? 'AUTO-UPDATE' : 'CHECK ONLY'}\n`);

  try {
    // Get all interstate corridors from database
    const corridorsResult = await pool.query(`
      SELECT
        id,
        name,
        description,
        geometry,
        bounds,
        updated_at
      FROM corridors
      WHERE name LIKE 'I-%'
      ORDER BY name
    `);

    console.log(`📊 Found ${corridorsResult.rows.length} interstate corridors in database\n`);

    const results = {
      upToDate: [],
      needsUpdate: [],
      significant: [],
      failed: []
    };

    for (const corridor of corridorsResult.rows) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`🛣️  Checking: ${corridor.name}`);
      console.log(`   Last updated: ${corridor.updated_at ? new Date(corridor.updated_at).toLocaleString() : 'Unknown'}`);

      if (!corridor.bounds) {
        console.log(`   ⚠️  No bounds defined, skipping`);
        results.failed.push({ corridor: corridor.name, reason: 'No bounds' });
        continue;
      }

      // Extract interstate number
      const interstateMatch = corridor.name.match(/I-(\d+)/);
      if (!interstateMatch) {
        console.log(`   ⚠️  Cannot parse interstate number, skipping`);
        results.failed.push({ corridor: corridor.name, reason: 'Cannot parse' });
        continue;
      }

      const interstateNumber = interstateMatch[1];

      // Fetch latest OSM metadata
      console.log(`   🌍 Checking OpenStreetMap for changes...`);
      const osmMetadata = await fetchOSMMetadata(interstateNumber, corridor.bounds);

      if (!osmMetadata) {
        console.log(`   ❌ Failed to fetch OSM metadata`);
        results.failed.push({ corridor: corridor.name, reason: 'OSM fetch failed' });
        continue;
      }

      console.log(`   ✓ OSM has ${osmMetadata.wayCount} way segments`);
      console.log(`   ✓ Latest OSM modification: ${osmMetadata.latestModification.toLocaleString()}`);

      // Compare dates
      const dbDate = corridor.updated_at ? new Date(corridor.updated_at) : new Date(0);
      const osmDate = osmMetadata.latestModification;
      const daysSinceUpdate = Math.floor((osmDate - dbDate) / (1000 * 60 * 60 * 24));

      if (daysSinceUpdate <= 0) {
        console.log(`   ✅ UP TO DATE (OSM last modified ${Math.abs(daysSinceUpdate)} days before our data)`);
        results.upToDate.push({
          corridor: corridor.name,
          daysSinceUpdate,
          osmDate,
          dbDate
        });
      } else if (daysSinceUpdate <= 30) {
        console.log(`   ℹ️  Minor changes (${daysSinceUpdate} days old) - likely not significant`);
        results.upToDate.push({
          corridor: corridor.name,
          daysSinceUpdate,
          osmDate,
          dbDate
        });
      } else if (daysSinceUpdate <= 180) {
        console.log(`   ⚠️  NEEDS UPDATE (${daysSinceUpdate} days behind OSM)`);
        results.needsUpdate.push({
          corridor: corridor.name,
          daysSinceUpdate,
          osmDate,
          dbDate
        });
      } else {
        console.log(`   🔴 SIGNIFICANT UPDATE NEEDED (${daysSinceUpdate} days behind OSM)`);
        results.significant.push({
          corridor: corridor.name,
          daysSinceUpdate,
          osmDate,
          dbDate
        });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Summary report
    console.log('\n' + '='.repeat(70));
    console.log('📊 UPDATE CHECK SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Up to date: ${results.upToDate.length} corridors`);
    console.log(`⚠️  Needs update (30-180 days): ${results.needsUpdate.length} corridors`);
    console.log(`🔴 Significant update needed (>180 days): ${results.significant.length} corridors`);
    console.log(`❌ Failed to check: ${results.failed.length} corridors`);
    console.log('');

    if (results.needsUpdate.length > 0) {
      console.log('⚠️  CORRIDORS NEEDING UPDATE:');
      for (const item of results.needsUpdate) {
        console.log(`   - ${item.corridor}: ${item.daysSinceUpdate} days behind`);
      }
      console.log('');
    }

    if (results.significant.length > 0) {
      console.log('🔴 CORRIDORS NEEDING SIGNIFICANT UPDATE:');
      for (const item of results.significant) {
        console.log(`   - ${item.corridor}: ${item.daysSinceUpdate} days behind`);
      }
      console.log('');
    }

    if (results.failed.length > 0) {
      console.log('❌ CORRIDORS THAT FAILED TO CHECK:');
      for (const item of results.failed) {
        console.log(`   - ${item.corridor}: ${item.reason}`);
      }
      console.log('');
    }

    // Recommendations
    const totalNeedingUpdate = results.needsUpdate.length + results.significant.length;

    if (totalNeedingUpdate === 0) {
      console.log('✅ All corridors are up to date! No action needed.');
    } else if (totalNeedingUpdate <= 3) {
      console.log('💡 RECOMMENDATION: Update specific corridors');
      console.log('   Run: railway run node scripts/fetch_all_interstate_geometries.js');
    } else if (results.significant.length > 0) {
      console.log('💡 RECOMMENDATION: Full update needed for significant changes');
      console.log('   Run: railway run node scripts/fetch_all_interstate_geometries.js');
    } else {
      console.log('💡 RECOMMENDATION: Consider updating during next maintenance window');
      console.log('   Run: railway run node scripts/fetch_all_interstate_geometries.js');
    }

    console.log('');

    // Save check results to database
    await pool.query(`
      INSERT INTO corridor_update_checks (
        check_date,
        up_to_date_count,
        needs_update_count,
        significant_update_count,
        failed_count,
        results
      ) VALUES (NOW(), $1, $2, $3, $4, $5::jsonb)
      ON CONFLICT DO NOTHING
    `, [
      results.upToDate.length,
      results.needsUpdate.length,
      results.significant.length,
      results.failed.length,
      JSON.stringify(results)
    ]).catch(() => {
      // Table might not exist yet, that's OK
      console.log('ℹ️  Note: Install corridor_update_checks table to track history');
    });

    return results;

  } catch (error) {
    console.error('\n❌ Error checking corridor updates:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run
if (require.main === module) {
  const autoUpdate = process.argv.includes('--auto-update');

  checkCorridorUpdates(autoUpdate)
    .then((results) => {
      const totalNeedingUpdate = results.needsUpdate.length + results.significant.length;
      process.exit(totalNeedingUpdate > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error(error);
      process.exit(2);
    });
}

module.exports = { checkCorridorUpdates };

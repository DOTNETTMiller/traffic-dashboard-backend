const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// BTS North American Roads ArcGIS REST API endpoint
const BTS_API_BASE = 'https://geo.dot.gov/mapping/rest/services/NTAD/North_American_Roads/MapServer/0';

/**
 * Simplify coordinates using Douglas-Peucker algorithm
 */
function simplifyCoordinates(coords, maxPoints) {
  if (coords.length <= maxPoints) return coords;

  // Simple uniform sampling for now
  const step = Math.ceil(coords.length / maxPoints);
  const simplified = [];

  for (let i = 0; i < coords.length; i += step) {
    simplified.push(coords[i]);
  }

  // Always include the last point
  if (simplified[simplified.length - 1] !== coords[coords.length - 1]) {
    simplified.push(coords[coords.length - 1]);
  }

  return simplified;
}

/**
 * Fetch interstate geometry from BTS API
 */
async function fetchInterstateGeometry(routeNumber, direction) {
  try {
    // Map direction to SIGNT1 field value (directional suffix)
    const dirMap = {
      'east': 'E',
      'west': 'W',
      'north': 'N',
      'south': 'S'
    };

    // Query for the specific interstate route
    // SIGNT1 contains route number (e.g., "I-35")
    const where = `SIGNT1 = 'I-${routeNumber}' AND SIGN1 = '1'`;

    const params = {
      where,
      outFields: '*',
      f: 'geojson',
      returnGeometry: true,
      outSR: 4326 // WGS84
    };

    console.log(`   Querying BTS API for I-${routeNumber} ${direction.toUpperCase()}...`);

    const response = await axios.get(`${BTS_API_BASE}/query`, {
      params,
      timeout: 60000
    });

    if (!response.data || !response.data.features || response.data.features.length === 0) {
      console.log(`   ⚠️  No features found for I-${routeNumber}`);
      return null;
    }

    console.log(`   ✓ Found ${response.data.features.length} feature(s)`);

    // Collect all line segments
    const allCoords = [];

    for (const feature of response.data.features) {
      if (!feature.geometry || feature.geometry.type !== 'LineString') {
        continue;
      }

      const coords = feature.geometry.coordinates;
      if (coords && coords.length > 0) {
        allCoords.push(...coords);
      }
    }

    if (allCoords.length === 0) {
      console.log(`   ⚠️  No valid coordinates found`);
      return null;
    }

    console.log(`   ✓ Collected ${allCoords.length} total points`);

    // Sort by primary direction to create a continuous path
    if (direction === 'east' || direction === 'west') {
      allCoords.sort((a, b) => direction === 'east' ? a[0] - b[0] : b[0] - a[0]);
    } else {
      allCoords.sort((a, b) => direction === 'north' ? a[1] - b[1] : b[1] - a[1]);
    }

    // Deduplicate consecutive points
    const deduped = allCoords.filter((coord, i) => {
      if (i === 0) return true;
      const prev = allCoords[i - 1];
      return Math.abs(coord[0] - prev[0]) > 0.0001 || Math.abs(coord[1] - prev[1]) > 0.0001;
    });

    // Simplify to max 50,000 points
    const simplified = simplifyCoordinates(deduped, 50000);

    console.log(`   ✓ ${direction.toUpperCase()}: ${allCoords.length} → ${deduped.length} → ${simplified.length} points`);

    return {
      type: 'LineString',
      coordinates: simplified
    };

  } catch (error) {
    console.error(`   ❌ Error fetching I-${routeNumber} ${direction}: ${error.message}`);
    return null;
  }
}

/**
 * Update corridor geometry in database
 */
async function updateCorridorGeometry(routeNumber, direction, geometry) {
  const dirMap = {
    'east': 'EB',
    'west': 'WB',
    'north': 'NB',
    'south': 'SB'
  };

  const corridorName = `I-${routeNumber} ${dirMap[direction]}`;

  try {
    const result = await pool.query(
      `UPDATE corridors
       SET geometry = $1,
           updated_at = NOW()
       WHERE name = $2
       RETURNING id, name`,
      [JSON.stringify(geometry), corridorName]
    );

    if (result.rows.length > 0) {
      console.log(`   ✅ Updated ${corridorName} (${geometry.coordinates.length} points)`);
      return true;
    } else {
      console.log(`   ⚠️  No corridor found with name: ${corridorName}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Database error for ${corridorName}: ${error.message}`);
    return false;
  }
}

/**
 * Main function to fetch all interstate geometries from BTS
 */
async function fetchAllBTSInterstates() {
  console.log('\n🚀 Fetching Interstate Geometries from BTS North American Roads Dataset\n');
  console.log('='.repeat(80));

  // List of interstate routes to fetch
  const interstates = [
    5, 10, 15, 20, 25, 35, 40, 55, 64, 65,
    69, 70, 75, 77, 80, 81, 84, 90, 94, 95
  ];

  const directions = ['east', 'west', 'north', 'south'];

  let totalUpdated = 0;
  let totalFailed = 0;

  for (const routeNum of interstates) {
    console.log(`\n📍 Processing I-${routeNum}...`);

    for (const direction of directions) {
      const geometry = await fetchInterstateGeometry(routeNum, direction);

      if (geometry) {
        const success = await updateCorridorGeometry(routeNum, direction, geometry);
        if (success) {
          totalUpdated++;
        } else {
          totalFailed++;
        }
      } else {
        totalFailed++;
      }

      // Small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`  ✅ Successfully updated: ${totalUpdated} corridors`);
  console.log(`  ❌ Failed: ${totalFailed} corridors`);

  await pool.end();
}

// Run the script
fetchAllBTSInterstates().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

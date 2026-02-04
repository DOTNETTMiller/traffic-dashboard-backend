const { Pool } = require('pg');
const shapefile = require('shapefile');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const SHAPEFILE_PATH = '/Users/mattmiller/Downloads/NTAD_North_American_Roads_-6941702301048783378/North_American_Roads.shp';

/**
 * Simplify coordinates using uniform sampling
 */
function simplifyCoordinates(coords, maxPoints) {
  if (coords.length <= maxPoints) return coords;

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
 * Determine direction from road name or DIR field
 */
function determineDirection(roadname, dir) {
  const name = (roadname || '').toLowerCase();

  if (name.includes('east')) return 'east';
  if (name.includes('west')) return 'west';
  if (name.includes('north')) return 'north';
  if (name.includes('south')) return 'south';

  // If no direction in name, try to infer from geometry later
  return null;
}

/**
 * Group segments by route number and direction
 */
function groupSegments(interstateSegments) {
  const grouped = {};

  for (const segment of interstateSegments) {
    const key = `${segment.routeNum}-${segment.direction}`;

    if (!grouped[key]) {
      grouped[key] = {
        routeNum: segment.routeNum,
        direction: segment.direction,
        segments: []
      };
    }

    grouped[key].segments.push(segment.coords);
  }

  return Object.values(grouped);
}

/**
 * Merge segments for a single interstate direction
 */
function mergeSegments(segments, direction) {
  if (segments.length === 0) return null;
  if (segments.length === 1) return segments[0];

  // Flatten all coordinates
  const allCoords = [];
  for (const segment of segments) {
    allCoords.push(...segment);
  }

  // Sort by primary direction to create a continuous path
  if (direction === 'east' || direction === 'west') {
    allCoords.sort((a, b) => direction === 'east' ? a[0] - b[0] : b[0] - a[0]);
  } else if (direction === 'north' || direction === 'south') {
    allCoords.sort((a, b) => direction === 'north' ? a[1] - b[1] : b[1] - a[1]);
  }

  // Deduplicate consecutive points
  const deduped = allCoords.filter((coord, i) => {
    if (i === 0) return true;
    const prev = allCoords[i - 1];
    return Math.abs(coord[0] - prev[0]) > 0.0001 || Math.abs(coord[1] - prev[1]) > 0.0001;
  });

  return deduped;
}

/**
 * Update corridor geometry in database
 */
async function updateCorridorGeometry(routeNum, direction, geometry) {
  const dirMap = {
    'east': 'EB',
    'west': 'WB',
    'north': 'NB',
    'south': 'SB'
  };

  const corridorName = `I-${routeNum} ${dirMap[direction]}`;

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
 * Main function to import BTS Interstate geometries
 */
async function importBTSInterstates() {
  console.log('\n🚀 Importing Interstate Geometries from BTS Shapefile\n');
  console.log('='.repeat(80));
  console.log(`Reading: ${SHAPEFILE_PATH}\n`);

  const interstateSegments = [];
  let totalFeatures = 0;
  let interstateFeatures = 0;

  try {
    // Read the shapefile
    const source = await shapefile.open(SHAPEFILE_PATH);

    let result = await source.read();

    while (!result.done) {
      totalFeatures++;

      if (totalFeatures % 50000 === 0) {
        console.log(`   Processed ${totalFeatures} features, found ${interstateFeatures} interstate segments...`);
      }

      const feature = result.value;
      const props = feature.properties;

      // Filter for Interstate highways in the USA
      // ROADNUM field contains "IH##" format (e.g., "IH35", "IH90")
      // COUNTRY: 2 = USA
      if (props.COUNTRY === 2 && props.ROADNUM) {
        const roadNum = String(props.ROADNUM).trim();

        // Match Interstate Highway format: IH followed by numbers
        const match = /^IH(\d+)$/.exec(roadNum);
        if (match) {
          const routeNum = parseInt(match[1], 10);

          // Only process the Interstates we care about (major routes)
          if ([5, 10, 15, 20, 25, 35, 40, 55, 64, 65, 69, 70, 75, 77, 80, 81, 84, 90, 94, 95].includes(routeNum)) {
            const direction = determineDirection(props.ROADNAME, props.DIR);

            if (direction && feature.geometry && feature.geometry.type === 'LineString') {
              interstateFeatures++;

              interstateSegments.push({
                routeNum,
                direction,
                coords: feature.geometry.coordinates,
                roadname: props.ROADNAME
              });
            }
          }
        }
      }

      result = await source.read();
    }

    console.log(`\n✅ Finished reading shapefile`);
    console.log(`   Total features: ${totalFeatures}`);
    console.log(`   Interstate segments found: ${interstateFeatures}\n`);

    // Group segments by route and direction
    console.log('📦 Grouping segments by route and direction...\n');
    const grouped = groupSegments(interstateSegments);

    console.log(`Found ${grouped.length} unique Interstate directions:\n`);
    for (const group of grouped) {
      console.log(`   I-${group.routeNum} ${group.direction.toUpperCase()}: ${group.segments.length} segments`);
    }

    // Merge and update each Interstate
    console.log('\n🔄 Merging segments and updating database...\n');

    let updated = 0;
    let failed = 0;

    for (const group of grouped) {
      console.log(`\n📍 Processing I-${group.routeNum} ${group.direction.toUpperCase()}...`);

      const merged = mergeSegments(group.segments, group.direction);

      if (!merged || merged.length === 0) {
        console.log(`   ⚠️  Failed to merge segments`);
        failed++;
        continue;
      }

      const simplified = simplifyCoordinates(merged, 200000);

      console.log(`   ✓ Merged ${group.segments.length} segments: ${merged.length} → ${simplified.length} points`);

      const geometry = {
        type: 'LineString',
        coordinates: simplified
      };

      const success = await updateCorridorGeometry(group.routeNum, group.direction, geometry);

      if (success) {
        updated++;
      } else {
        failed++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Successfully updated: ${updated} corridors`);
    console.log(`  ❌ Failed: ${failed} corridors\n`);

  } catch (error) {
    console.error('\n❌ Error reading shapefile:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
importBTSInterstates().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

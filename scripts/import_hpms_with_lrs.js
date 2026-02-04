const { Pool } = require('pg');
const shapefile = require('shapefile');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// HPMS shapefile directory
const HPMS_DIR = '/Users/mattmiller/Downloads/HPMS';

// Interstate routes to process
// Primary East-West (Even): 10, 20, 40, 70, 80, 90
// Primary North-South (Odd): 5, 15, 35, 75, 95
// Full national network (major corridors)
const INTERSTATE_ROUTES = [
  5, 8, 10, 15, 20, 25, 29, 30, 35, 40, 44, 45,
  55, 57, 59, 64, 65, 66, 69, 70, 71, 74, 75, 76, 77, 78, 79,
  80, 81, 83, 84, 85, 90, 94, 95
];

/**
 * Calculate distance between two coordinates
 */
function distance(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  return Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
}

/**
 * Check if two coordinate arrays can be connected
 * Returns: { canConnect: boolean, reverse: boolean, distance: number }
 */
function canConnect(segment1Coords, segment2Coords, maxGap = 0.01) {
  const end1 = segment1Coords[segment1Coords.length - 1];
  const start2 = segment2Coords[0];
  const end2 = segment2Coords[segment2Coords.length - 1];

  // Check end1 -> start2 (normal)
  const distNormal = distance(end1, start2);
  if (distNormal < maxGap) {
    return { canConnect: true, reverse: false, distance: distNormal };
  }

  // Check end1 -> end2 (segment2 needs reversal)
  const distReverse = distance(end1, end2);
  if (distReverse < maxGap) {
    return { canConnect: true, reverse: true, distance: distReverse };
  }

  return { canConnect: false, reverse: false, distance: Math.min(distNormal, distReverse) };
}

/**
 * Bridge gaps between Route_IDs at state boundaries
 */
function bridgeStateGaps(routeGroups, maxGap = 0.05) {
  console.log(`\n   🔗 Bridging state-line gaps (max gap: ${maxGap}°)...`);

  // Sort route groups by average longitude (west to east)
  const sorted = Object.entries(routeGroups).map(([routeId, data]) => {
    const allCoords = data.coordinates.flat();
    const avgLon = allCoords.reduce((sum, c) => sum + c[0], 0) / allCoords.length;
    return { routeId, avgLon, ...data };
  }).sort((a, b) => a.avgLon - b.avgLon);

  const bridged = [];
  let currentChain = null;

  for (const group of sorted) {
    if (!currentChain) {
      // Start first chain
      currentChain = {
        routeIds: [group.routeId],
        coordinates: [...group.coordinates]
      };
    } else {
      // Try to connect to current chain
      const lastCoords = currentChain.coordinates[currentChain.coordinates.length - 1];
      const connection = canConnect(lastCoords, group.coordinates[0], maxGap);

      if (connection.canConnect) {
        console.log(`      ✓ Bridged ${currentChain.routeIds[currentChain.routeIds.length - 1]} → ${group.routeId} (gap: ${connection.distance.toFixed(4)}°)`);

        currentChain.routeIds.push(group.routeId);

        // Append all segments from this group
        for (const coords of group.coordinates) {
          const toAdd = connection.reverse ? coords.slice().reverse() : coords;
          // Skip first point if it's a duplicate
          const skipFirst = distance(lastCoords[lastCoords.length - 1], toAdd[0]) < 0.0001;
          currentChain.coordinates.push(skipFirst ? toAdd.slice(1) : toAdd);
        }
      } else {
        // Gap too large, save current chain and start new one
        console.log(`      ⚠️  Gap too large between ${currentChain.routeIds[currentChain.routeIds.length - 1]} and ${group.routeId}: ${connection.distance.toFixed(4)}°`);
        bridged.push(currentChain);

        currentChain = {
          routeIds: [group.routeId],
          coordinates: [...group.coordinates]
        };
      }
    }
  }

  // Don't forget the last chain
  if (currentChain) {
    bridged.push(currentChain);
  }

  console.log(`      → Created ${bridged.length} continuous chain(s)`);

  return bridged;
}

/**
 * Stitch Interstate segments using LRS milepoints
 */
async function stitchInterstate(routeNum, shapefilePath) {
  console.log(`\n📍 Processing I-${routeNum}...`);

  const routes = {}; // Map: Route_ID -> Array of segments

  try {
    const source = await shapefile.open(shapefilePath);
    let result;
    let segmentCount = 0;

    console.log(`   Reading shapefile...`);

    while (!(result = await source.read()).done) {
      const { properties: props, geometry } = result.value;

      // Filter: Interstate (F_System=1) and specific route number
      // Match by RouteID pattern (e.g., "090i" or "090d" for I-90)
      const fSystem = props.F_System || props.F_SYSTEM;
      const routeId = props.RouteID || props.Route_ID || props.ROUTE_ID;

      // RouteID format: "090i" or "090d" where 090 is the route number
      const routePattern = String(routeNum).padStart(3, '0'); // "90" -> "090"
      const isMatch = routeId && (routeId.startsWith(routePattern + 'i') || routeId.startsWith(routePattern + 'd'));

      if (fSystem === 1 && isMatch) {
        const beginPt = props.BeginPoint || props.Begin_Poin || props.BEGIN_POIN || props.Begin_Point;
        const endPt = props.EndPoint || props.End_Point || props.END_POINT;
        const coords = geometry?.coordinates || geometry?.geometry?.coordinates;

        // Skip features with null/empty geometry
        if (!coords || coords.length === 0) {
          continue;
        }

        if (!routes[routeId]) {
          routes[routeId] = [];
        }

        routes[routeId].push({
          begin: beginPt,
          end: endPt,
          coordinates: coords
        });

        segmentCount++;
      }
    }

    console.log(`   ✓ Found ${segmentCount} segments across ${Object.keys(routes).length} Route_IDs`);

    if (segmentCount === 0) {
      console.log(`   ⚠️  No data found for I-${routeNum}`);
      return null;
    }

    // Process each Route_ID (typically one per state)
    const routeGroups = {};

    for (const [routeId, segments] of Object.entries(routes)) {
      console.log(`\n   Processing Route_ID: ${routeId} (${segments.length} segments)`);

      // Sort by Begin_Point ascending
      const sorted = segments.sort((a, b) => a.begin - b.begin);

      // Stitch coordinates
      const stitched = [];
      for (let i = 0; i < sorted.length; i++) {
        const seg = sorted[i];
        // Skip segments with no coordinates or empty coordinate arrays
        if (!seg.coordinates || seg.coordinates.length === 0) continue;

        if (i === 0) {
          stitched.push([...seg.coordinates]);
        } else {
          // Check if segments connect
          const prevSegment = stitched[stitched.length - 1];
          if (!prevSegment || prevSegment.length === 0) {
            stitched.push([...seg.coordinates]);
            continue;
          }

          const prevEnd = prevSegment[prevSegment.length - 1];
          const currStart = seg.coordinates[0];

          // Validate coordinates exist before calculating distance
          if (!prevEnd || !currStart) {
            stitched.push([...seg.coordinates]);
            continue;
          }

          const gap = distance(prevEnd, currStart);

          if (gap < 0.01) {
            // Connected, append without first point
            stitched.push(seg.coordinates.slice(1));
          } else {
            // Gap detected, start new segment array
            console.log(`      ⚠️  Gap detected at milepoint ${seg.begin}: ${gap.toFixed(4)}°`);
            stitched.push([...seg.coordinates]);
          }
        }
      }

      routeGroups[routeId] = { segments: sorted, coordinates: stitched };
      console.log(`      ✓ Stitched into ${stitched.length} continuous segment(s)`);
    }

    // Bridge state-line gaps
    const bridged = bridgeStateGaps(routeGroups);

    return bridged;

  } catch (error) {
    console.error(`   ❌ Error processing I-${routeNum}: ${error.message}`);
    throw error;
  }
}

/**
 * Determine direction and update database
 */
async function processAndUpdate(routeNum, shapefilePath) {
  const chains = await stitchInterstate(routeNum, shapefilePath);

  if (!chains || chains.length === 0) {
    console.log(`   ⚠️  No chains created for I-${routeNum}`);
    return;
  }

  console.log(`\n   💾 Updating database...`);

  // Determine direction for each chain based on RouteID suffix
  for (let i = 0; i < chains.length; i++) {
    const chain = chains[i];

    // Flatten all coordinates
    const allCoords = chain.coordinates.flat();

    // Determine direction from RouteID suffix
    // RouteID format: "090i" (increasing/eastbound or northbound) or "090d" (decreasing/westbound or southbound)
    // Get the first RouteID from the chain to determine direction
    const firstRouteId = chain.routeIds[0];
    const isIncreasing = firstRouteId.endsWith('i');

    // Determine if this is an East-West or North-South interstate
    // For I-90: even number, runs East-West
    // For odd numbers: runs North-South
    const isEvenRoute = routeNum % 2 === 0;

    let direction;
    if (isEvenRoute) {
      // East-West Interstate
      direction = isIncreasing ? 'EB' : 'WB';
    } else {
      // North-South Interstate
      direction = isIncreasing ? 'NB' : 'SB';
    }

    const corridorName = `I-${routeNum} ${direction}`;

    // Strip Z-coordinates (elevation/measure) to save database space
    // Convert [lon, lat, z] to [lon, lat]
    const cleanCoords = allCoords.map(coord => [coord[0], coord[1]]);

    // Create GeoJSON
    const geometry = {
      type: 'LineString',
      coordinates: cleanCoords
    };

    // Update database
    const result = await pool.query(
      `UPDATE corridors
       SET geometry = $1, updated_at = NOW()
       WHERE name = $2
       RETURNING id`,
      [JSON.stringify(geometry), corridorName]
    );

    if (result.rows.length > 0) {
      console.log(`      ✅ Updated ${corridorName} (${allCoords.length} points, Route_IDs: ${chain.routeIds.join(', ')})`);
    } else {
      console.log(`      ⚠️  No corridor found: ${corridorName}`);
    }
  }
}

/**
 * Main function
 */
async function importHPMSWithLRS() {
  console.log('\n🚀 Importing Interstate Geometries from HPMS with LRS\n');
  console.log('='.repeat(80));
  console.log(`HPMS Directory: ${HPMS_DIR}\n`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (const routeNum of INTERSTATE_ROUTES) {
      const shapefilePath = `${HPMS_DIR}/i${routeNum}_segments.shp`;

      // Check if shapefile exists
      if (!fs.existsSync(shapefilePath)) {
        console.log(`\n⚠️  Skipping I-${routeNum}: Shapefile not found (${shapefilePath})`);
        skipped++;
        continue;
      }

      try {
        await processAndUpdate(routeNum, shapefilePath);
        processed++;
      } catch (error) {
        console.error(`\n❌ Failed to process I-${routeNum}: ${error.message}`);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 Import Summary:');
    console.log(`   Processed: ${processed}`);
    console.log(`   Skipped:   ${skipped}`);
    console.log(`   Failed:    ${failed}`);
    console.log('\n✅ HPMS import complete!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run
importHPMSWithLRS().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

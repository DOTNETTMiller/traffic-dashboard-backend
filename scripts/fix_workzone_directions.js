/**
 * Fix work zone directional assignments based on actual roadway geometry
 *
 * Problem: Work zones report incorrect direction (e.g., "WB" in description but
 * actually located on EB lanes). This script uses corridor geometry to determine
 * which actual roadway the event is closest to.
 *
 * Example: Iowa I-80 work zone says "WB" but is on the EB roadway → fix to "EB"
 */

const { Pool } = require('pg');

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
 * Calculate distance between a point and a line segment
 */
function pointToSegmentDistance(point, segmentStart, segmentEnd) {
  const [px, py] = point;
  const [x1, y1] = segmentStart;
  const [x2, y2] = segmentEnd;

  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find closest corridor to a point
 */
function findClosestCorridor(eventLon, eventLat, corridors) {
  let closestCorridor = null;
  let minDistance = Infinity;

  for (const corridor of corridors) {
    if (!corridor.geometry || !corridor.geometry.coordinates) continue;

    const coords = corridor.geometry.coordinates;

    // Check distance to each segment
    for (let i = 0; i < coords.length - 1; i++) {
      const dist = pointToSegmentDistance(
        [eventLon, eventLat],
        coords[i],
        coords[i + 1]
      );

      if (dist < minDistance) {
        minDistance = dist;
        closestCorridor = corridor;
      }
    }
  }

  return { corridor: closestCorridor, distance: minDistance };
}

/**
 * Extract direction from corridor name
 */
function getDirectionFromCorridorName(corridorName) {
  if (corridorName.includes(' EB')) return 'eastbound';
  if (corridorName.includes(' WB')) return 'westbound';
  if (corridorName.includes(' NB')) return 'northbound';
  if (corridorName.includes(' SB')) return 'southbound';
  return null;
}

/**
 * Main function to fix work zone directions
 */
async function fixWorkZoneDirections(dryRun = false) {
  console.log('🔧 Fixing Work Zone Directional Assignments\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  try {
    // Step 1: Get all directional corridors
    const corridorsResult = await pool.query(`
      SELECT
        id,
        name,
        description,
        geometry
      FROM corridors
      WHERE name LIKE '%EB' OR name LIKE '%WB' OR name LIKE '%NB' OR name LIKE '%SB'
      ORDER BY name
    `);

    console.log(`📊 Found ${corridorsResult.rows.length} directional corridors\n`);

    if (corridorsResult.rows.length === 0) {
      console.log('⚠️  No directional corridors found in database.');
      console.log('   Run fetch_all_interstate_geometries.js first to create split highway corridors.');
      return;
    }

    // Group corridors by interstate
    const corridorsByInterstate = {};
    for (const corridor of corridorsResult.rows) {
      const match = corridor.name.match(/^(I-\d+)/);
      if (match) {
        const interstate = match[1];
        if (!corridorsByInterstate[interstate]) {
          corridorsByInterstate[interstate] = [];
        }
        corridorsByInterstate[interstate].push(corridor);
      }
    }

    console.log('🛣️  Corridors by interstate:');
    for (const [interstate, corridors] of Object.entries(corridorsByInterstate)) {
      console.log(`   ${interstate}: ${corridors.map(c => c.name.split(' ').pop()).join(', ')}`);
    }
    console.log('');

    // Step 2: Get work zones with directional descriptions
    // Looking for events that mention direction in description or event_type
    const eventsResult = await pool.query(`
      SELECT
        id,
        title,
        description,
        event_type,
        road_name,
        direction,
        geometry
      FROM events
      WHERE (
        road_name LIKE 'I-%'
        OR road_name LIKE 'Interstate%'
      )
      AND geometry IS NOT NULL
      AND (
        description ~* '(eastbound|westbound|northbound|southbound|\\bEB\\b|\\bWB\\b|\\bNB\\b|\\bSB\\b)'
        OR event_type ~* '(eastbound|westbound|northbound|southbound)'
        OR direction IS NOT NULL
      )
      LIMIT 1000
    `);

    console.log(`📋 Found ${eventsResult.rows.length} work zone events with directional info\n`);

    if (eventsResult.rows.length === 0) {
      console.log('✅ No work zones found that need direction fixing');
      return;
    }

    // Step 3: Check each event
    let fixedCount = 0;
    let alreadyCorrect = 0;
    let noMatch = 0;

    for (const event of eventsResult.rows) {
      // Extract coordinates
      const coords = event.geometry?.coordinates;
      if (!coords || coords.length < 2) {
        noMatch++;
        continue;
      }

      const [eventLon, eventLat] = coords;

      // Determine which interstate this event is on
      const roadMatch = event.road_name.match(/I-?(\d+)/);
      if (!roadMatch) {
        noMatch++;
        continue;
      }

      const interstate = `I-${roadMatch[1]}`;
      const availableCorridors = corridorsByInterstate[interstate];

      if (!availableCorridors || availableCorridors.length === 0) {
        noMatch++;
        continue;
      }

      // Find closest corridor
      const { corridor, distance } = findClosestCorridor(eventLon, eventLat, availableCorridors);

      if (!corridor || distance > 0.01) { // ~1km threshold
        noMatch++;
        continue;
      }

      const actualDirection = getDirectionFromCorridorName(corridor.name);

      if (!actualDirection) {
        noMatch++;
        continue;
      }

      // Extract claimed direction from event
      let claimedDirection = null;

      const text = `${event.title} ${event.description} ${event.event_type} ${event.direction || ''}`.toLowerCase();

      if (text.includes('eastbound') || text.includes(' eb ') || text.includes('eb,')) {
        claimedDirection = 'eastbound';
      } else if (text.includes('westbound') || text.includes(' wb ') || text.includes('wb,')) {
        claimedDirection = 'westbound';
      } else if (text.includes('northbound') || text.includes(' nb ') || text.includes('nb,')) {
        claimedDirection = 'northbound';
      } else if (text.includes('southbound') || text.includes(' sb ') || text.includes('sb,')) {
        claimedDirection = 'southbound';
      }

      if (!claimedDirection) {
        noMatch++;
        continue;
      }

      // Check if it matches
      if (claimedDirection === actualDirection) {
        alreadyCorrect++;
        continue;
      }

      // MISMATCH FOUND!
      console.log(`\n🔴 MISMATCH FOUND:`);
      console.log(`   Event ID: ${event.id}`);
      console.log(`   Road: ${event.road_name}`);
      console.log(`   Title: ${event.title.substring(0, 60)}...`);
      console.log(`   Claimed Direction: ${claimedDirection.toUpperCase()}`);
      console.log(`   Actual Roadway: ${corridor.name}`);
      console.log(`   Actual Direction: ${actualDirection.toUpperCase()}`);
      console.log(`   Distance to roadway: ${(distance * 69).toFixed(2)} miles`);

      if (!dryRun) {
        // Update the direction field
        await pool.query(
          `UPDATE events
           SET direction = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [actualDirection, event.id]
        );
        console.log(`   ✅ Updated direction to: ${actualDirection}`);
        fixedCount++;
      } else {
        console.log(`   🔍 Would update direction to: ${actualDirection}`);
        fixedCount++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Already correct: ${alreadyCorrect} events`);
    console.log(`🔧 Fixed/Would fix: ${fixedCount} events`);
    console.log(`⚠️  No match/unclear: ${noMatch} events`);
    console.log(`📝 Total processed: ${eventsResult.rows.length} events`);
    console.log('');

    if (dryRun && fixedCount > 0) {
      console.log('💡 Run without --dry-run flag to apply these fixes');
    } else if (fixedCount > 0) {
      console.log('✅ Direction corrections applied successfully!');
    } else {
      console.log('✅ All work zone directions are already correct!');
    }

  } catch (error) {
    console.error('\n❌ Error fixing work zone directions:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');

  fixWorkZoneDirections(dryRun)
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { fixWorkZoneDirections };

#!/usr/bin/env node

/**
 * Fix Iowa DOT events by snapping to the correct directional carriageway
 * Uses bearing calculation from event points to determine correct direction
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Calculate bearing between two points in degrees
 * 0° = North, 90° = East, 180° = South, 270° = West
 */
function calculateBearing(lon1, lat1, lon2, lat2) {
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = Math.atan2(y, x);
  return (bearing * 180 / Math.PI + 360) % 360;
}

/**
 * Determine direction from bearing
 */
function bearingToDirection(bearing) {
  if (bearing >= 315 || bearing < 45) return 'NB';
  if (bearing >= 45 && bearing < 135) return 'EB';
  if (bearing >= 135 && bearing < 225) return 'SB';
  if (bearing >= 225 && bearing < 315) return 'WB';
  return null;
}

/**
 * Extract route number from corridor name
 */
function extractRoute(corridorName) {
  const match = corridorName.match(/I[-\s]?(\d+)/i);
  return match ? `I-${match[1]}` : null;
}

async function fixIowaEvents() {
  console.log('==========================================================================');
  console.log('🔧 Fixing Iowa DOT Events with Direction-Aware Snapping');
  console.log('   (Only events with exactly 2 points - start and end)');
  console.log('==========================================================================\n');

  try {
    // Get Iowa events with ONLY start/end coordinates (2 points exactly)
    // Exclude events that have full polyline geometries
    const eventsResult = await pool.query(`
      SELECT
        id,
        event_id,
        headline,
        route,
        direction as stated_direction,
        start_latitude,
        start_longitude,
        end_latitude,
        end_longitude,
        geometry,
        organization
      FROM events
      WHERE organization = 'Iowa DOT'
        AND start_latitude IS NOT NULL
        AND start_longitude IS NOT NULL
        AND end_latitude IS NOT NULL
        AND end_longitude IS NOT NULL
        AND ABS(start_latitude - end_latitude) + ABS(start_longitude - end_longitude) > 0.0001
        AND (
          geometry IS NULL
          OR geometry->>'type' IS NULL
          OR (
            geometry->>'type' = 'LineString'
            AND jsonb_array_length(geometry->'coordinates') = 2
          )
        )
      ORDER BY id
    `);

    console.log(`Found ${eventsResult.rows.length} Iowa events with exactly 2 points\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const event of eventsResult.rows) {
      const { id, event_id, headline, route, stated_direction,
              start_latitude, start_longitude, end_latitude, end_longitude } = event;

      // Calculate bearing from start to end
      const bearing = calculateBearing(
        start_longitude, start_latitude,
        end_longitude, end_latitude
      );

      const calculatedDirection = bearingToDirection(bearing);

      console.log(`Event ${id}: ${headline}`);
      console.log(`  Route: ${route || 'unknown'}`);
      console.log(`  Stated Direction: ${stated_direction || 'none'}`);
      console.log(`  Calculated Direction: ${calculatedDirection} (bearing: ${bearing.toFixed(1)}°)`);

      // Check if calculated direction matches stated direction
      if (stated_direction && calculatedDirection) {
        if (stated_direction.toUpperCase().includes(calculatedDirection)) {
          console.log(`  ✓ Direction matches - no fix needed\n`);
          skipped++;
          continue;
        } else {
          console.log(`  ⚠️  Direction mismatch! Should be ${calculatedDirection}`);

          // Update the direction and mark as corrected
          try {
            await pool.query(`
              UPDATE events
              SET direction = $1,
                  direction_corrected = true,
                  updated_at = NOW()
              WHERE id = $2
            `, [calculatedDirection, id]);

            console.log(`  ✅ Updated direction to ${calculatedDirection} (marked as corrected)\n`);
            fixed++;
          } catch (err) {
            console.log(`  ❌ Error updating: ${err.message}\n`);
            errors++;
          }
        }
      } else if (!stated_direction && calculatedDirection) {
        // No stated direction - add calculated one and mark as corrected
        try {
          await pool.query(`
            UPDATE events
            SET direction = $1,
                direction_corrected = true,
                updated_at = NOW()
            WHERE id = $2
          `, [calculatedDirection, id]);

          console.log(`  ✅ Added calculated direction: ${calculatedDirection} (marked as corrected)\n`);
          fixed++;
        } catch (err) {
          console.log(`  ❌ Error updating: ${err.message}\n`);
          errors++;
        }
      } else {
        console.log(`  ⊘ Could not determine direction\n`);
        skipped++;
      }
    }

    console.log('==========================================================================');
    console.log('Summary');
    console.log('==========================================================================');
    console.log(`  Fixed: ${fixed}`);
    console.log(`  Skipped (already correct): ${skipped}`);
    console.log(`  Errors: ${errors}`);
    console.log('');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  fixIowaEvents();
}

module.exports = { fixIowaEvents };

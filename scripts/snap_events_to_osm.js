#!/usr/bin/env node

/**
 * Snap 2-point Iowa events to actual OSM road geometry
 * Uses OSRM routing to get the actual Interstate path between start/end points
 */

const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Query OSRM for route between two points
 * Uses public OSRM server (car profile)
 */
function getOSRMRoute(startLon, startLat, endLon, endLat) {
  return new Promise((resolve, reject) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.code === 'Ok' && result.routes && result.routes[0]) {
            resolve(result.routes[0].geometry);
          } else {
            reject(new Error(`OSRM error: ${result.code || 'Unknown'}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse OSRM response: ${err.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Calculate bearing between two points
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
 * Sleep helper for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function snapEventsToOSM() {
  console.log('==========================================================================');
  console.log('🗺️  Snapping Iowa Events to OSM Road Network');
  console.log('   (Only 2-point events)');
  console.log('==========================================================================\n');

  try {
    // Get Iowa events with exactly 2 points
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
        geometry
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
      LIMIT 50
    `);

    console.log(`Found ${eventsResult.rows.length} Iowa events with 2 points\n`);

    let snapped = 0;
    let skipped = 0;
    let errors = 0;

    for (const event of eventsResult.rows) {
      const { id, event_id, headline, route, stated_direction,
              start_latitude, start_longitude, end_latitude, end_longitude } = event;

      console.log(`Event ${id}: ${headline}`);
      console.log(`  Route: ${route || 'unknown'}`);
      console.log(`  Start: ${start_latitude.toFixed(6)}, ${start_longitude.toFixed(6)}`);
      console.log(`  End: ${end_latitude.toFixed(6)}, ${end_longitude.toFixed(6)}`);

      // Calculate bearing
      const bearing = calculateBearing(
        start_longitude, start_latitude,
        end_longitude, end_latitude
      );
      const calculatedDirection = bearingToDirection(bearing);

      console.log(`  Bearing: ${bearing.toFixed(1)}° → ${calculatedDirection}`);

      try {
        // Get route from OSRM
        const geometry = await getOSRMRoute(
          start_longitude, start_latitude,
          end_longitude, end_latitude
        );

        console.log(`  ✓ Got route geometry: ${geometry.coordinates.length} points`);

        // Update event with new geometry and direction
        await pool.query(`
          UPDATE events
          SET geometry = $1::jsonb,
              direction = $2,
              direction_corrected = true,
              updated_at = NOW()
          WHERE id = $3
        `, [JSON.stringify(geometry), calculatedDirection, id]);

        console.log(`  ✅ Snapped to OSM road network (${calculatedDirection})\n`);
        snapped++;

        // Rate limit: 1 request per second to be nice to OSRM
        await sleep(1000);

      } catch (err) {
        console.log(`  ❌ Error snapping: ${err.message}\n`);
        errors++;
      }
    }

    console.log('==========================================================================');
    console.log('Summary');
    console.log('==========================================================================');
    console.log(`  Snapped to OSM: ${snapped}`);
    console.log(`  Skipped: ${skipped}`);
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
  snapEventsToOSM();
}

module.exports = { snapEventsToOSM };

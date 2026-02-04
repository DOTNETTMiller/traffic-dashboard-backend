const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const HPMS_API = 'https://geo.dot.gov/server/rest/services/Hosted/HPMS_Interstates/FeatureServer/0/query';

/**
 * Convert Web Mercator coordinates to WGS84 (lat/lon)
 */
function webMercatorToWGS84(x, y) {
  const lon = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (Math.atan(Math.exp(lat * (Math.PI / 180))) * 360) / Math.PI - 90;
  return [lon, lat];
}

/**
 * Fetch Interstate from HPMS API
 */
async function fetchHPMSInterstate(routeNumber) {
  console.log(`\n🔍 Fetching I-${routeNumber} from HPMS API...\n`);

  try {
    const response = await axios.get(HPMS_API, {
      params: {
        where: `route_number = ${routeNumber}`,
        outFields: '*',
        returnGeometry: true,
        f: 'json',
        outSR: 3857 // Web Mercator
      }
    });

    const features = response.data.features;
    console.log(`   ✓ Found ${features.length} features for I-${routeNumber}\n`);

    if (features.length === 0) {
      console.log(`   ⚠️  No data found for I-${routeNumber}`);
      return;
    }

    // Process each feature (may be multiple paths for different directions)
    for (const feature of features) {
      const attrs = feature.attributes;
      const geometry = feature.geometry;

      console.log(`   Route ID: ${attrs.route_id}`);
      console.log(`   Route Name: ${attrs.route_name || 'N/A'}`);
      console.log(`   Length: ${attrs.sum_area_length_miles?.toFixed(2) || 'N/A'} miles`);

      if (geometry && geometry.paths) {
        console.log(`   Paths: ${geometry.paths.length}`);

        // Convert each path to WGS84
        for (let pathIdx = 0; pathIdx < geometry.paths.length; pathIdx++) {
          const path = geometry.paths[pathIdx];
          const wgs84Coords = path.map(([x, y]) => webMercatorToWGS84(x, y));

          console.log(`   Path ${pathIdx + 1}: ${wgs84Coords.length} points`);
          console.log(`     Start: [${wgs84Coords[0][0].toFixed(4)}, ${wgs84Coords[0][1].toFixed(4)}]`);
          console.log(`     End: [${wgs84Coords[wgs84Coords.length - 1][0].toFixed(4)}, ${wgs84Coords[wgs84Coords.length - 1][1].toFixed(4)}]`);

          // Check for gaps
          let maxGap = 0;
          for (let i = 1; i < wgs84Coords.length; i++) {
            const [lon1, lat1] = wgs84Coords[i - 1];
            const [lon2, lat2] = wgs84Coords[i];
            const gap = Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
            if (gap > maxGap) maxGap = gap;
          }
          console.log(`     Max gap: ${maxGap.toFixed(6)}°`);

          // Create GeoJSON LineString
          const geoJSON = {
            type: 'LineString',
            coordinates: wgs84Coords
          };

          // Determine direction from route_id or path position
          // For now, let's assume first path is EB, second is WB (we'll refine this)
          const direction = pathIdx === 0 ? 'EB' : 'WB';
          const corridorName = `I-${routeNumber} ${direction}`;

          // Update database
          const result = await pool.query(
            `UPDATE corridors
             SET geometry = $1, updated_at = NOW()
             WHERE name = $2
             RETURNING id`,
            [JSON.stringify(geoJSON), corridorName]
          );

          if (result.rows.length > 0) {
            console.log(`     ✅ Updated ${corridorName}`);
          } else {
            console.log(`     ⚠️  No corridor found: ${corridorName}`);
          }
        }
      }

      console.log('');
    }

    console.log('✅ HPMS fetch completed!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    throw error;
  } finally {
    await pool.end();
  }
}

// Fetch I-90 as test
fetchHPMSInterstate(90).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

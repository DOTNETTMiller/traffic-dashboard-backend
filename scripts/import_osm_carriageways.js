#!/usr/bin/env node

/**
 * Import OSM motorway carriageways for Interstate highways
 * Queries by state bounding boxes to stay within Overpass limits
 */

const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// State bounding boxes (min_lat, min_lon, max_lat, max_lon)
const STATE_BOUNDS = {
  'CA': [32.5, -124.5, 42.0, -114.1],
  'TX': [25.8, -106.6, 36.5, -93.5],
  'FL': [24.4, -87.6, 31.0, -80.0],
  'NY': [40.5, -79.8, 45.0, -71.8],
  'PA': [39.7, -80.5, 42.3, -74.7],
  'IL': [37.0, -91.5, 42.5, -87.5],
  'OH': [38.4, -84.8, 42.3, -80.5],
  'MI': [41.7, -90.4, 48.3, -82.4],
  'GA': [30.4, -85.6, 35.0, -80.8],
  'NC': [33.8, -84.3, 36.6, -75.4],
  'VA': [36.5, -83.7, 39.5, -75.2],
  'MD': [37.9, -79.5, 39.7, -75.0],
  'WA': [45.5, -124.8, 49.0, -116.9],
  'MA': [41.2, -73.5, 42.9, -69.9],
  'AZ': [31.3, -114.8, 37.0, -109.0],
  'IN': [37.8, -88.1, 41.8, -84.8],
  'TN': [35.0, -90.3, 36.7, -81.6],
  'MO': [36.0, -95.8, 40.6, -89.1],
  'WI': [42.5, -92.9, 47.1, -86.2],
  'MN': [43.5, -97.2, 49.4, -89.5],
  'CO': [37.0, -109.1, 41.0, -102.0],
  'AL': [30.2, -88.5, 35.0, -84.9],
  'LA': [28.9, -94.0, 33.0, -88.8],
  'SC': [32.0, -83.4, 35.2, -78.5],
  'KY': [36.5, -89.6, 39.1, -81.9],
  'OR': [42.0, -124.6, 46.3, -116.5],
  'OK': [33.6, -103.0, 37.0, -94.4],
  'CT': [40.9, -73.7, 42.1, -71.8],
  'IA': [40.4, -96.6, 43.5, -90.1],
  'MS': [30.2, -91.7, 35.0, -88.1],
  'AR': [33.0, -94.6, 36.5, -89.6],
  'KS': [37.0, -102.1, 40.0, -94.6],
  'UT': [37.0, -114.1, 42.0, -109.0],
  'NV': [35.0, -120.0, 42.0, -114.0],
  'NM': [31.3, -109.1, 37.0, -103.0],
  'WV': [37.2, -82.6, 40.6, -77.7],
  'NE': [40.0, -104.1, 43.0, -95.3],
  'ID': [42.0, -117.2, 49.0, -111.0],
  'ME': [43.0, -71.1, 47.5, -66.9],
  'NH': [42.7, -72.6, 45.3, -70.6],
  'RI': [41.1, -71.9, 42.0, -71.1],
  'MT': [44.4, -116.1, 49.0, -104.0],
  'DE': [38.5, -75.8, 39.8, -75.0],
  'SD': [42.5, -104.1, 45.9, -96.4],
  'ND': [45.9, -104.1, 49.0, -96.6],
  'WY': [41.0, -111.1, 45.0, -104.0],
  'VT': [42.7, -73.4, 45.0, -71.5],
  'DC': [38.8, -77.1, 39.0, -76.9]
};

/**
 * Fetch OSM data from Overpass API with retry logic
 */
async function queryOverpass(query, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await _queryOverpassOnce(query);
      return result;
    } catch (err) {
      if (attempt === retries || !err.message.includes('429') && !err.message.includes('504')) {
        throw err;
      }
      // Exponential backoff: 2^attempt seconds
      const waitMs = Math.pow(2, attempt) * 1000;
      console.log(`   ⏳ Rate limited, waiting ${waitMs/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
}

function _queryOverpassOnce(query) {
  return new Promise((resolve, reject) => {
    const url = 'https://overpass-api.de/api/interpreter';
    const postData = `data=${encodeURIComponent(query)}`;

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 60000
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 429 || res.statusCode === 504) {
          reject(new Error(`Overpass returned ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Failed to parse Overpass response: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Overpass request timed out'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Build Overpass query for Interstate motorways in a bounding box
 * Filters specifically for Interstate highways to reduce noise
 */
function buildBboxQuery(state, bbox) {
  const [minLat, minLon, maxLat, maxLon] = bbox;
  return `
    [out:json][timeout:60][bbox:${minLat},${minLon},${maxLat},${maxLon}];
    (
      way["highway"="motorway"]["oneway"="yes"]["ref"~"^I[-\\s]?[0-9]+$"];
      way["highway"="motorway"]["oneway"="yes"]["network"="US:I"];
      way["highway"="motorway"]["oneway"="-1"]["ref"~"^I[-\\s]?[0-9]+$"];
      way["highway"="motorway"]["oneway"="-1"]["network"="US:I"];
    );
    out geom;
  `;
}

/**
 * Convert OSM way to PostGIS-compatible LineString
 */
function osmWayToLineString(way) {
  if (!way.geometry || way.geometry.length < 2) {
    return null;
  }
  const coords = way.geometry.map(node => [node.lon, node.lat]);
  return {
    type: 'LineString',
    coordinates: coords
  };
}

/**
 * Determine direction from overall bearing of the geometry
 */
function determineDirection(way) {
  if (!way.geometry || way.geometry.length < 2) {
    return null;
  }

  const start = way.geometry[0];
  const end = way.geometry[way.geometry.length - 1];

  const dx = end.lon - start.lon;
  const dy = end.lat - start.lat;

  // Calculate bearing (0° = North, 90° = East, etc.)
  const bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;

  // Classify into cardinal directions
  if (bearing >= 315 || bearing < 45) return 'NB';
  if (bearing >= 45 && bearing < 135) return 'EB';
  if (bearing >= 135 && bearing < 225) return 'SB';
  if (bearing >= 225 && bearing < 315) return 'WB';

  return null;
}

/**
 * Extract route number from OSM ref tag
 */
function extractRoute(ref) {
  if (!ref) return null;
  // Handle various formats: "I 80", "I-80", "I80"
  const match = ref.match(/I[-\s]?(\d+)/i);
  return match ? `I-${match[1]}` : null;
}

/**
 * Import carriageways for a single state
 */
async function importState(state, bbox) {
  console.log(`\n📍 Importing ${state}...`);

  try {
    const query = buildBboxQuery(state, bbox);
    const data = await queryOverpass(query);

    if (!data.elements || data.elements.length === 0) {
      console.log(`   ℹ️  No motorway data found`);
      return { imported: 0, skipped: 0 };
    }

    console.log(`   Found ${data.elements.length} way segments`);

    let imported = 0;
    let skipped = 0;

    for (const way of data.elements) {
      // Must have ref tag with Interstate number
      if (!way.tags || !way.tags.ref) {
        skipped++;
        continue;
      }

      const route = extractRoute(way.tags.ref);
      if (!route) {
        skipped++;
        continue;
      }

      const lineString = osmWayToLineString(way);
      if (!lineString) {
        skipped++;
        continue;
      }

      const direction = determineDirection(way);
      if (!direction) {
        skipped++;
        continue;
      }

      const corridorId = `${route.replace('-', '')}_${direction}_${state}`;
      const corridorName = `${route} ${direction === 'EB' ? 'Eastbound' : direction === 'WB' ? 'Westbound' : direction === 'NB' ? 'Northbound' : 'Southbound'}`;

      // Insert into corridors_snap
      try {
        await pool.query(`
          INSERT INTO corridors_snap (
            corridor_id,
            corridor_name,
            route,
            direction,
            state,
            geom4326,
            geom3857,
            length_m
          )
          VALUES (
            $1, $2, $3, $4, $5,
            ST_SetSRID(ST_GeomFromGeoJSON($6), 4326),
            ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326), 3857),
            ST_Length(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326), 3857))
          )
          ON CONFLICT (corridor_id) DO NOTHING
        `, [corridorId, corridorName, route, direction, state, JSON.stringify(lineString)]);

        imported++;
      } catch (dbErr) {
        console.error(`     ⚠️  DB error for ${corridorId}:`, dbErr.message);
        skipped++;
      }
    }

    console.log(`   ✅ Imported ${imported} segments, skipped ${skipped}`);
    return { imported, skipped };

  } catch (error) {
    console.error(`   ❌ Error importing ${state}:`, error.message);
    return { imported: 0, skipped: 0, error: error.message };
  }
}

/**
 * Ensure constraints exist
 */
async function ensureConstraints() {
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'corridors_snap_corridor_id_key'
        ) THEN
          ALTER TABLE corridors_snap ADD CONSTRAINT corridors_snap_corridor_id_key UNIQUE (corridor_id);
        END IF;
      END $$;
    `);
  } catch (err) {
    // Constraint might already exist
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('==========================================================================');
  console.log('🛣️  Importing OSM Motorway Carriageways by State');
  console.log('==========================================================================');
  console.log('');

  try {
    await ensureConstraints();

    let totalImported = 0;
    let totalSkipped = 0;
    const errors = [];

    const states = Object.keys(STATE_BOUNDS);
    console.log(`Will process ${states.length} states`);
    console.log('');

    for (const state of states) {
      const bbox = STATE_BOUNDS[state];
      const result = await importState(state, bbox);

      totalImported += result.imported || 0;
      totalSkipped += result.skipped || 0;

      if (result.error) {
        errors.push(`${state}: ${result.error}`);
      }

      // Rate limit: 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('');
    console.log('==========================================================================');
    console.log('✅ Import Complete');
    console.log('==========================================================================');
    console.log(`   Total segments imported: ${totalImported}`);
    console.log(`   Total segments skipped: ${totalSkipped}`);

    if (errors.length > 0) {
      console.log(`   Errors: ${errors.length}`);
      errors.forEach(err => console.log(`     - ${err}`));
    }

    console.log('');

    // Show summary
    const summary = await pool.query(`
      SELECT
        route,
        direction,
        COUNT(*) as segment_count,
        ROUND(SUM(length_m)::numeric / 1000, 1) as total_km
      FROM corridors_snap
      GROUP BY route, direction
      ORDER BY route, direction
    `);

    console.log('📊 Carriageway Summary:');
    console.log('');
    summary.rows.forEach(row => {
      console.log(`   ${row.route} ${row.direction}: ${row.segment_count} segments, ${row.total_km} km`);
    });

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
  main();
}

module.exports = { importState, queryOverpass };

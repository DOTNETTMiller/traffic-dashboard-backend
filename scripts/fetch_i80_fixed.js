/**
 * Fetch I-80 geometry with corrected OSM query
 * Uses broader query to catch all I-80 variations
 */

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// I-80 state segments - smaller chunks to avoid timeout
const I80_SEGMENTS = [
  { state: 'CA-West', bounds: { south: 37.5, north: 40.0, west: -122.5, east: -119.5 } },
  { state: 'CA-East', bounds: { south: 39.0, north: 42.0, west: -120.5, east: -119.5 } },
  { state: 'NV', bounds: { south: 39.5, north: 41.5, west: -120.0, east: -114.0 } },
  { state: 'UT', bounds: { south: 40.5, north: 41.5, west: -114.5, east: -109.0 } },
  { state: 'WY-West', bounds: { south: 41.0, north: 42.0, west: -111.5, east: -107.5 } },
  { state: 'WY-East', bounds: { south: 41.0, north: 42.0, west: -108.0, east: -104.0 } },
  { state: 'NE-West', bounds: { south: 40.5, north: 42.0, west: -104.5, east: -100.0 } },
  { state: 'NE-East', bounds: { south: 40.5, north: 42.0, west: -100.5, east: -95.3 } },
  { state: 'IA', bounds: { south: 41.3, north: 42.5, west: -96.0, east: -90.1 } },
  { state: 'IL', bounds: { south: 41.3, north: 42.2, west: -91.0, east: -87.5 } },
  { state: 'IN', bounds: { south: 41.3, north: 41.8, west: -87.6, east: -84.8 } },
  { state: 'OH', bounds: { south: 40.8, north: 41.8, west: -85.0, east: -80.5 } },
  { state: 'PA', bounds: { south: 40.8, north: 42.2, west: -80.6, east: -74.7 } },
  { state: 'NJ', bounds: { south: 40.5, north: 41.2, west: -75.5, east: -73.9 } }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function simplifyGeometry(coords, maxPoints = 50000) {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  return coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
}

async function fetchSegment(state, bounds) {
  const overpassUrl = 'https://overpass-api.de/api/interpreter';

  // Broader query - catch I-80 with various tagging schemes
  const query = `
    [out:json][timeout:60];
    (
      way["highway"="motorway"]["ref"="80"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      way["highway"="motorway"]["ref"="I 80"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      way["highway"="motorway"]["ref"="Interstate 80"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      way["highway"="motorway_link"]["ref"~"80"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    );
    out geom;
  `;

  console.log(`  🌍 Fetching I-80 in ${state}...`);

  try {
    const response = await axios.post(overpassUrl, query, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 60000
    });

    if (!response.data || !response.data.elements || response.data.elements.length === 0) {
      console.log(`  ⚠️  No I-80 data found in ${state}`);
      return null;
    }

    // Filter to only motorway (not motorway_link)
    const motorways = response.data.elements.filter(e => e.tags?.highway === 'motorway');

    console.log(`  ✓ Found ${motorways.length} way segments in ${state}`);
    return motorways;
  } catch (error) {
    if (error.response?.status === 429) {
      console.log(`  ⏳ Rate limited on ${state}, waiting 10 seconds...`);
      await sleep(10000);
      return null;
    } else if (error.response?.status === 504) {
      console.log(`  ⏳ Timeout on ${state}, skipping...`);
      return null;
    }
    throw error;
  }
}

function separateDirections(elements) {
  const eastbound = [];
  const westbound = [];

  for (const element of elements) {
    if (!element.geometry || element.geometry.length < 2) continue;

    // Check oneway tag
    if (element.tags?.oneway === 'yes' || element.tags?.oneway === '1') {
      // Use coordinate delta for direction
      const start = [element.geometry[0].lon, element.geometry[0].lat];
      const end = [element.geometry[element.geometry.length - 1].lon, element.geometry[element.geometry.length - 1].lat];
      const deltaLon = end[0] - start[0];

      if (deltaLon > 0) {
        eastbound.push(element);
      } else {
        westbound.push(element);
      }
    } else {
      // Bidirectional or unknown - add to both (will deduplicate later)
      eastbound.push(element);
      westbound.push(element);
    }
  }

  return { eastbound, westbound };
}

function mergeSegments(elements) {
  if (elements.length === 0) return [];

  const allCoords = [];

  for (const element of elements) {
    if (element.geometry) {
      for (const node of element.geometry) {
        allCoords.push([node.lon, node.lat]);
      }
    }
  }

  // Remove consecutive duplicates
  const uniqueCoords = [];
  for (let i = 0; i < allCoords.length; i++) {
    if (i === 0 ||
        Math.abs(allCoords[i][0] - allCoords[i-1][0]) > 0.00001 ||
        Math.abs(allCoords[i][1] - allCoords[i-1][1]) > 0.00001) {
      uniqueCoords.push(allCoords[i]);
    }
  }

  return uniqueCoords;
}

async function fetchI80() {
  console.log('🚀 Fetching I-80 Geometry (Segmented Query)\n');
  console.log('I-80: San Francisco, CA → Teaneck, NJ (2,900 miles)\n');
  console.log('='.repeat(70));

  const allEastbound = [];
  const allWestbound = [];
  let successCount = 0;

  // Fetch each segment with delays
  for (let i = 0; i < I80_SEGMENTS.length; i++) {
    const segment = I80_SEGMENTS[i];

    try {
      const elements = await fetchSegment(segment.state, segment.bounds);

      if (elements && elements.length > 0) {
        const { eastbound, westbound } = separateDirections(elements);
        allEastbound.push(...eastbound);
        allWestbound.push(...westbound);
        console.log(`  ✓ ${segment.state}: EB=${eastbound.length} ways, WB=${westbound.length} ways`);
        successCount++;
      }

      // Rate limiting - be polite to OSM
      if (i < I80_SEGMENTS.length - 1) {
        await sleep(3000); // 3 seconds between requests
      }
    } catch (error) {
      console.log(`  ❌ Error fetching ${segment.state}: ${error.message}`);
    }
  }

  console.log('='.repeat(70));
  console.log(`\n📊 Total segments collected from ${successCount}/${I80_SEGMENTS.length} regions:`);
  console.log(`   Eastbound: ${allEastbound.length} ways`);
  console.log(`   Westbound: ${allWestbound.length} ways\n`);

  if (allEastbound.length === 0 && allWestbound.length === 0) {
    console.log('❌ No I-80 data collected - OSM may use different tagging');
    console.log('\n💡 TIP: I-80 might already exist in your database from a previous fetch.');
    console.log('   Check with: SELECT name FROM corridors WHERE name LIKE \'I-80%\';');
    return;
  }

  // Merge and simplify
  console.log('🔧 Merging and simplifying geometry...\n');

  const ebCoords = mergeSegments(allEastbound);
  const wbCoords = mergeSegments(allWestbound);

  console.log(`   Raw coordinates: EB=${ebCoords.length}, WB=${wbCoords.length}`);

  const ebSimplified = simplifyGeometry(ebCoords);
  const wbSimplified = simplifyGeometry(wbCoords);

  console.log(`   Simplified: EB=${ebSimplified.length}, WB=${wbSimplified.length}\n`);

  // Create GeoJSON
  const corridors = [];

  if (ebSimplified.length >= 2) {
    corridors.push({
      name: 'I-80 EB',
      direction: 'EB',
      description: 'Interstate 80 Eastbound (CA/NV/UT/WY/NE/IA/IL/IN/OH/PA/NJ)',
      geometry: {
        type: 'LineString',
        coordinates: ebSimplified
      }
    });
  }

  if (wbSimplified.length >= 2) {
    corridors.push({
      name: 'I-80 WB',
      direction: 'WB',
      description: 'Interstate 80 Westbound (CA/NV/UT/WY/NE/IA/IL/IN/OH/PA/NJ)',
      geometry: {
        type: 'LineString',
        coordinates: wbSimplified
      }
    });
  }

  if (corridors.length === 0) {
    console.log('❌ Not enough coordinates to create corridors');
    return;
  }

  // Calculate bounds
  const allPoints = [...ebSimplified, ...wbSimplified];
  const lons = allPoints.map(p => p[0]);
  const lats = allPoints.map(p => p[1]);
  const bounds = {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats)
  };

  console.log('='.repeat(70));
  console.log('💾 Saving to database...\n');

  // Check if I-80 already exists
  const existing = await pool.query(
    `SELECT id, name FROM corridors WHERE name LIKE 'I-80%'`
  );

  const existingByName = {};
  for (const row of existing.rows) {
    existingByName[row.name] = row.id;
  }

  if (existing.rows.length > 0) {
    console.log('⚠️  I-80 corridors already exist in database:');
    for (const row of existing.rows) {
      console.log(`   - ${row.name}`);
    }
    console.log('\nUpdating existing I-80 records...\n');
  }

  // Insert or update corridors
  for (const corridor of corridors) {
    if (existingByName[corridor.name]) {
      // Update existing
      await pool.query(
        `UPDATE corridors
         SET description = $1, geometry = $2::jsonb, bounds = $3::jsonb, updated_at = NOW()
         WHERE name = $4`,
        [corridor.description, JSON.stringify(corridor.geometry), JSON.stringify(bounds), corridor.name]
      );
      console.log(`✅ Updated corridor: ${corridor.name} (${corridor.geometry.coordinates.length} points)`);
    } else {
      // Insert new
      await pool.query(
        `INSERT INTO corridors (id, name, description, geometry, bounds, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::jsonb, NOW(), NOW())`,
        [corridor.name, corridor.description, JSON.stringify(corridor.geometry), JSON.stringify(bounds)]
      );
      console.log(`✅ Created corridor: ${corridor.name} (${corridor.geometry.coordinates.length} points)`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ I-80 FETCH COMPLETE\n');
  console.log(`Created ${corridors.length} corridor records for I-80`);
  console.log('Corridors now follow actual I-80 route across 11 states\n');

  await pool.end();
}

// Run
fetchI80().catch(error => {
  console.error('Error:', error);
  pool.end();
  process.exit(1);
});

/**
 * Fetch I-80 geometry state-by-state to avoid OSM timeout
 * I-80 spans 11 states: CA, NV, UT, WY, NE, IA, IL, IN, OH, PA, NJ
 */

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// I-80 state segments with specific bounds
const I80_SEGMENTS = [
  { state: 'CA', bounds: { south: 37.0, north: 42.0, west: -124.0, east: -114.0 } },
  { state: 'NV', bounds: { south: 39.0, north: 42.0, west: -120.0, east: -114.0 } },
  { state: 'UT', bounds: { south: 40.0, north: 42.0, west: -114.5, east: -109.0 } },
  { state: 'WY', bounds: { south: 40.5, north: 42.0, west: -111.5, east: -104.0 } },
  { state: 'NE', bounds: { south: 40.0, north: 42.5, west: -104.5, east: -95.3 } },
  { state: 'IA', bounds: { south: 41.0, north: 43.0, west: -96.0, east: -90.1 } },
  { state: 'IL', bounds: { south: 41.0, north: 42.5, west: -91.0, east: -87.5 } },
  { state: 'IN', bounds: { south: 41.0, north: 42.0, west: -87.6, east: -84.8 } },
  { state: 'OH', bounds: { south: 40.5, north: 42.0, west: -85.0, east: -80.5 } },
  { state: 'PA', bounds: { south: 40.5, north: 42.5, west: -80.6, east: -74.7 } },
  { state: 'NJ', bounds: { south: 40.0, north: 41.5, west: -75.5, east: -73.9 } }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function simplifyGeometry(coords, maxPoints = 300) {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  return coords.filter((_, i) => i % step === 0);
}

async function fetchSegment(state, bounds) {
  const overpassUrl = 'https://overpass-api.de/api/interpreter';

  const query = `
    [out:json][timeout:90];
    way["highway"="motorway"]["ref"="80"]["network"="US:I"]
      (${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    out geom;
  `;

  console.log(`  🌍 Fetching I-80 in ${state}...`);

  const response = await axios.post(overpassUrl, query, {
    headers: { 'Content-Type': 'text/plain' },
    timeout: 90000
  });

  if (!response.data || !response.data.elements || response.data.elements.length === 0) {
    console.log(`  ⚠️  No I-80 data found in ${state}`);
    return null;
  }

  console.log(`  ✓ Found ${response.data.elements.length} way segments in ${state}`);
  return response.data.elements;
}

function separateDirections(elements) {
  const eastbound = [];
  const westbound = [];

  for (const element of elements) {
    if (!element.geometry || element.geometry.length < 2) continue;

    // Check tags first
    const destination = element.tags?.destination?.toLowerCase() || '';
    const lanes = element.tags?.lanes;

    if (destination.includes('east')) {
      eastbound.push(element);
      continue;
    } else if (destination.includes('west')) {
      westbound.push(element);
      continue;
    }

    // Use coordinate delta
    const start = [element.geometry[0].lon, element.geometry[0].lat];
    const end = [element.geometry[element.geometry.length - 1].lon, element.geometry[element.geometry.length - 1].lat];
    const deltaLon = end[0] - start[0];

    if (deltaLon > 0) {
      eastbound.push(element);
    } else {
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
        allCoords[i][0] !== allCoords[i-1][0] ||
        allCoords[i][1] !== allCoords[i-1][1]) {
      uniqueCoords.push(allCoords[i]);
    }
  }

  return uniqueCoords;
}

async function fetchI80() {
  console.log('🚀 Fetching I-80 Geometry (State-by-State)\n');
  console.log('I-80 spans 11 states: CA → NV → UT → WY → NE → IA → IL → IN → OH → PA → NJ\n');
  console.log('='.repeat(70));

  const allEastbound = [];
  const allWestbound = [];

  // Fetch each state segment
  for (const segment of I80_SEGMENTS) {
    try {
      const elements = await fetchSegment(segment.state, segment.bounds);

      if (elements) {
        const { eastbound, westbound } = separateDirections(elements);
        allEastbound.push(...eastbound);
        allWestbound.push(...westbound);
        console.log(`  ✓ ${segment.state}: EB=${eastbound.length} ways, WB=${westbound.length} ways`);
      }

      // Be polite to OSM API
      await sleep(2000);
    } catch (error) {
      console.log(`  ❌ Error fetching ${segment.state}: ${error.message}`);
    }
  }

  console.log('='.repeat(70));
  console.log(`\n📊 Total segments collected:`);
  console.log(`   Eastbound: ${allEastbound.length} ways`);
  console.log(`   Westbound: ${allWestbound.length} ways\n`);

  if (allEastbound.length === 0 && allWestbound.length === 0) {
    console.log('❌ No I-80 data collected');
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
    `SELECT name FROM corridors WHERE name LIKE 'I-80%'`
  );

  if (existing.rows.length > 0) {
    console.log('⚠️  I-80 corridors already exist in database:');
    for (const row of existing.rows) {
      console.log(`   - ${row.name}`);
    }
    console.log('\nDeleting existing I-80 records...');
    await pool.query(`DELETE FROM corridors WHERE name LIKE 'I-80%'`);
    console.log('✓ Deleted old I-80 records\n');
  }

  // Insert new corridors
  for (const corridor of corridors) {
    await pool.query(
      `INSERT INTO corridors (id, name, description, geometry, bounds, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::jsonb, NOW(), NOW())`,
      [corridor.name, corridor.description, JSON.stringify(corridor.geometry), JSON.stringify(bounds)]
    );
    console.log(`✅ Created corridor: ${corridor.name} (${corridor.geometry.coordinates.length} points)`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ I-80 FETCH COMPLETE\n');
  console.log(`Created ${corridors.length} corridor records for I-80`);
  console.log('Corridors now follow actual I-80 route from San Francisco to New York/New Jersey\n');

  await pool.end();
}

// Run
fetchI80().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

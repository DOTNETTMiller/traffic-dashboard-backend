/**
 * Fetch remaining failed interstates using state-by-state approach
 * Interstates: I-10, I-57, I-69, I-84, I-90, I-95
 */

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// State segments for each interstate to avoid timeouts
const INTERSTATE_SEGMENTS = {
  'I-10': {
    orientation: 'EW',
    segments: [
      { state: 'CA', bounds: { south: 32.5, north: 34.5, west: -118.0, east: -114.0 } },
      { state: 'AZ-West', bounds: { south: 32.5, north: 34.0, west: -115.0, east: -111.5 } },
      { state: 'AZ-East', bounds: { south: 32.0, north: 33.5, west: -112.0, east: -109.0 } },
      { state: 'NM', bounds: { south: 31.5, north: 33.0, west: -109.5, east: -103.0 } },
      { state: 'TX-West', bounds: { south: 29.5, north: 32.0, west: -107.0, east: -102.0 } },
      { state: 'TX-Central', bounds: { south: 29.0, north: 31.0, west: -102.5, east: -98.0 } },
      { state: 'TX-East', bounds: { south: 29.0, north: 30.5, west: -98.5, east: -94.0 } },
      { state: 'LA', bounds: { south: 29.5, north: 31.0, west: -94.0, east: -89.0 } },
      { state: 'MS', bounds: { south: 30.0, north: 31.5, west: -91.5, east: -88.5 } },
      { state: 'AL', bounds: { south: 30.0, north: 31.5, west: -88.5, east: -87.5 } },
      { state: 'FL', bounds: { south: 29.5, north: 31.0, west: -87.5, east: -81.5 } }
    ]
  },
  'I-57': {
    orientation: 'NS',
    segments: [
      { state: 'IL-South', bounds: { south: 37.0, north: 39.0, west: -90.0, east: -87.5 } },
      { state: 'IL-Central', bounds: { south: 39.0, north: 41.0, west: -90.0, east: -87.5 } },
      { state: 'IL-North', bounds: { south: 41.0, north: 42.5, west: -90.0, east: -87.5 } },
      { state: 'MO', bounds: { south: 36.5, north: 37.5, west: -90.5, east: -89.0 } }
    ]
  },
  'I-69': {
    orientation: 'NS',
    segments: [
      { state: 'MI', bounds: { south: 41.5, north: 43.0, west: -86.0, east: -82.5 } },
      { state: 'IN-North', bounds: { south: 40.5, north: 41.8, west: -87.5, east: -84.8 } },
      { state: 'IN-South', bounds: { south: 38.5, north: 40.5, west: -87.5, east: -84.8 } },
      { state: 'KY', bounds: { south: 36.5, north: 39.0, west: -89.5, east: -82.0 } },
      { state: 'TN', bounds: { south: 35.0, north: 36.7, west: -90.0, east: -81.5 } },
      { state: 'MS', bounds: { south: 30.0, north: 35.0, west: -91.5, east: -88.0 } },
      { state: 'TX', bounds: { south: 25.5, north: 30.0, west: -100.0, east: -93.5 } }
    ]
  },
  'I-84': {
    orientation: 'EW',
    segments: [
      { state: 'OR-West', bounds: { south: 45.0, north: 46.0, west: -123.0, east: -120.5 } },
      { state: 'OR-East', bounds: { south: 42.0, north: 46.0, west: -120.5, east: -116.5 } },
      { state: 'ID', bounds: { south: 42.5, north: 44.0, west: -117.5, east: -111.0 } },
      { state: 'UT', bounds: { south: 40.5, north: 42.0, west: -114.5, east: -109.5 } },
      { state: 'PA-East', bounds: { south: 40.0, north: 42.0, west: -77.0, east: -74.5 } },
      { state: 'NY', bounds: { south: 40.8, north: 42.5, west: -76.0, east: -73.5 } },
      { state: 'CT', bounds: { south: 41.0, north: 42.0, west: -73.7, east: -71.8 } },
      { state: 'MA', bounds: { south: 42.0, north: 42.7, west: -73.5, east: -71.0 } }
    ]
  },
  'I-90': {
    orientation: 'EW',
    segments: [
      { state: 'WA-West', bounds: { south: 46.5, north: 48.0, west: -123.0, east: -120.0 } },
      { state: 'WA-East', bounds: { south: 46.5, north: 49.0, west: -120.5, east: -117.0 } },
      { state: 'ID', bounds: { south: 46.5, north: 48.5, west: -117.5, east: -115.5 } },
      { state: 'MT', bounds: { south: 45.5, north: 49.0, west: -116.0, east: -104.0 } },
      { state: 'WY', bounds: { south: 44.0, north: 45.5, west: -111.5, east: -104.0 } },
      { state: 'SD', bounds: { south: 43.0, north: 46.0, west: -104.5, east: -96.5 } },
      { state: 'MN', bounds: { south: 43.5, north: 45.5, west: -97.0, east: -91.5 } },
      { state: 'WI', bounds: { south: 42.5, north: 44.0, west: -92.5, east: -87.8 } },
      { state: 'IL', bounds: { south: 41.5, north: 42.7, west: -90.5, east: -87.5 } },
      { state: 'IN', bounds: { south: 41.3, north: 42.0, west: -87.6, east: -84.8 } },
      { state: 'OH', bounds: { south: 41.0, north: 42.0, west: -85.0, east: -80.5 } },
      { state: 'PA', bounds: { south: 41.5, north: 42.5, west: -80.6, east: -79.0 } },
      { state: 'NY-West', bounds: { south: 42.0, north: 43.5, west: -79.5, east: -76.5 } },
      { state: 'NY-Central', bounds: { south: 42.5, north: 43.5, west: -76.5, east: -73.5 } },
      { state: 'NY-East', bounds: { south: 42.0, north: 43.0, west: -74.0, east: -71.0 } },
      { state: 'MA', bounds: { south: 42.0, north: 42.7, west: -73.5, east: -71.0 } }
    ]
  },
  'I-95': {
    orientation: 'NS',
    segments: [
      { state: 'ME', bounds: { south: 43.0, north: 47.5, west: -71.0, east: -66.5 } },
      { state: 'NH', bounds: { south: 42.7, north: 43.5, west: -72.0, east: -70.7 } },
      { state: 'MA', bounds: { south: 41.8, north: 42.9, west: -71.5, east: -70.6 } },
      { state: 'RI', bounds: { south: 41.3, north: 42.0, west: -71.9, east: -71.1 } },
      { state: 'CT', bounds: { south: 40.8, north: 42.0, west: -73.7, east: -71.8 } },
      { state: 'NY', bounds: { south: 40.5, north: 41.3, west: -74.3, east: -71.8 } },
      { state: 'NJ', bounds: { south: 39.0, north: 41.5, west: -75.5, east: -73.9 } },
      { state: 'PA', bounds: { south: 39.7, north: 40.3, west: -76.0, east: -74.7 } },
      { state: 'DE', bounds: { south: 38.4, north: 39.9, west: -75.8, east: -75.0 } },
      { state: 'MD', bounds: { south: 38.0, north: 39.8, west: -77.5, east: -75.0 } },
      { state: 'DC-VA-North', bounds: { south: 38.5, north: 39.0, west: -77.5, east: -76.9 } },
      { state: 'VA-Central', bounds: { south: 37.0, north: 38.8, west: -78.5, east: -76.5 } },
      { state: 'VA-South', bounds: { south: 36.5, north: 37.5, west: -78.0, east: -76.0 } },
      { state: 'NC', bounds: { south: 34.0, north: 36.8, west: -79.0, east: -75.5 } },
      { state: 'SC', bounds: { south: 32.0, north: 35.2, west: -82.0, east: -78.5 } },
      { state: 'GA', bounds: { south: 30.5, north: 35.0, west: -85.5, east: -80.8 } },
      { state: 'FL-North', bounds: { south: 29.0, north: 31.0, west: -82.0, east: -80.0 } },
      { state: 'FL-Central', bounds: { south: 27.0, north: 29.5, west: -81.5, east: -80.0 } },
      { state: 'FL-South', bounds: { south: 25.5, north: 27.5, west: -81.0, east: -80.0 } }
    ]
  }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function simplifyGeometry(coords, maxPoints = 50000) {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  return coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
}

async function fetchSegment(interstate, state, bounds) {
  const overpassUrl = 'https://overpass-api.de/api/interpreter';
  const interstateNum = interstate.replace('I-', '');

  const query = `
    [out:json][timeout:60];
    (
      way["highway"="motorway"]["ref"="${interstateNum}"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      way["highway"="motorway"]["ref"="I ${interstateNum}"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      way["highway"="motorway"]["ref"="Interstate ${interstateNum}"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    );
    out geom;
  `;

  console.log(`  🌍 Fetching ${interstate} in ${state}...`);

  try {
    const response = await axios.post(overpassUrl, query, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 60000
    });

    if (!response.data || !response.data.elements || response.data.elements.length === 0) {
      console.log(`  ⚠️  No ${interstate} data found in ${state}`);
      return null;
    }

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

function separateDirections(elements, orientation) {
  const direction1 = []; // EB or NB
  const direction2 = []; // WB or SB

  for (const element of elements) {
    if (!element.geometry || element.geometry.length < 2) continue;

    const start = [element.geometry[0].lon, element.geometry[0].lat];
    const end = [element.geometry[element.geometry.length - 1].lon, element.geometry[element.geometry.length - 1].lat];
    const deltaLon = end[0] - start[0];
    const deltaLat = end[1] - start[1];

    if (orientation === 'EW') {
      if (deltaLon > 0) {
        direction1.push(element); // Eastbound
      } else {
        direction2.push(element); // Westbound
      }
    } else { // NS
      if (deltaLat > 0) {
        direction1.push(element); // Northbound
      } else {
        direction2.push(element); // Southbound
      }
    }
  }

  return { direction1, direction2 };
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

async function fetchInterstate(interstate) {
  const config = INTERSTATE_SEGMENTS[interstate];
  if (!config) {
    console.log(`❌ No configuration for ${interstate}`);
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Processing: ${interstate}`);
  console.log('='.repeat(70));

  const allDirection1 = [];
  const allDirection2 = [];
  let successCount = 0;

  for (let i = 0; i < config.segments.length; i++) {
    const segment = config.segments[i];

    try {
      const elements = await fetchSegment(interstate, segment.state, segment.bounds);

      if (elements && elements.length > 0) {
        const { direction1, direction2 } = separateDirections(elements, config.orientation);
        allDirection1.push(...direction1);
        allDirection2.push(...direction2);

        const dir1Label = config.orientation === 'EW' ? 'EB' : 'NB';
        const dir2Label = config.orientation === 'EW' ? 'WB' : 'SB';
        console.log(`  ✓ ${segment.state}: ${dir1Label}=${direction1.length} ways, ${dir2Label}=${direction2.length} ways`);
        successCount++;
      }

      if (i < config.segments.length - 1) {
        await sleep(3000);
      }
    } catch (error) {
      console.log(`  ❌ Error fetching ${segment.state}: ${error.message}`);
    }
  }

  console.log('');
  console.log(`📊 Total segments collected from ${successCount}/${config.segments.length} regions:`);

  const dir1Label = config.orientation === 'EW' ? 'Eastbound' : 'Northbound';
  const dir2Label = config.orientation === 'EW' ? 'Westbound' : 'Southbound';
  console.log(`   ${dir1Label}: ${allDirection1.length} ways`);
  console.log(`   ${dir2Label}: ${allDirection2.length} ways\n`);

  if (allDirection1.length === 0 && allDirection2.length === 0) {
    console.log(`❌ No ${interstate} data collected`);
    return { success: false };
  }

  console.log('🔧 Merging and simplifying geometry...\n');

  const coords1 = mergeSegments(allDirection1);
  const coords2 = mergeSegments(allDirection2);

  console.log(`   Raw coordinates: ${dir1Label}=${coords1.length}, ${dir2Label}=${coords2.length}`);

  const simplified1 = simplifyGeometry(coords1);
  const simplified2 = simplifyGeometry(coords2);

  console.log(`   Simplified: ${dir1Label}=${simplified1.length}, ${dir2Label}=${simplified2.length}\n`);

  const corridors = [];
  const dir1Code = config.orientation === 'EW' ? 'EB' : 'NB';
  const dir2Code = config.orientation === 'EW' ? 'WB' : 'SB';

  if (simplified1.length >= 2) {
    corridors.push({
      name: `${interstate} ${dir1Code}`,
      direction: dir1Code,
      description: `Interstate ${interstate.replace('I-', '')} ${dir1Label}`,
      geometry: {
        type: 'LineString',
        coordinates: simplified1
      }
    });
  }

  if (simplified2.length >= 2) {
    corridors.push({
      name: `${interstate} ${dir2Code}`,
      direction: dir2Code,
      description: `Interstate ${interstate.replace('I-', '')} ${dir2Label}`,
      geometry: {
        type: 'LineString',
        coordinates: simplified2
      }
    });
  }

  if (corridors.length === 0) {
    console.log(`❌ Not enough coordinates to create corridors for ${interstate}`);
    return { success: false };
  }

  const allPoints = [...simplified1, ...simplified2];
  const lons = allPoints.map(p => p[0]);
  const lats = allPoints.map(p => p[1]);
  const bounds = {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats)
  };

  console.log('💾 Saving to database...\n');

  const existing = await pool.query(
    `SELECT id, name FROM corridors WHERE name LIKE $1`,
    [`${interstate}%`]
  );

  const existingByName = {};
  for (const row of existing.rows) {
    existingByName[row.name] = row.id;
  }

  if (existing.rows.length > 0) {
    console.log(`⚠️  ${interstate} corridors already exist in database:`);
    for (const row of existing.rows) {
      console.log(`   - ${row.name}`);
    }
    console.log('\nUpdating existing records...\n');
  }

  for (const corridor of corridors) {
    if (existingByName[corridor.name]) {
      await pool.query(
        `UPDATE corridors
         SET description = $1, geometry = $2::jsonb, bounds = $3::jsonb, updated_at = NOW()
         WHERE name = $4`,
        [corridor.description, JSON.stringify(corridor.geometry), JSON.stringify(bounds), corridor.name]
      );
      console.log(`✅ Updated corridor: ${corridor.name} (${corridor.geometry.coordinates.length} points)`);
    } else {
      await pool.query(
        `INSERT INTO corridors (id, name, description, geometry, bounds, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::jsonb, NOW(), NOW())`,
        [corridor.name, corridor.description, JSON.stringify(corridor.geometry), JSON.stringify(bounds)]
      );
      console.log(`✅ Created corridor: ${corridor.name} (${corridor.geometry.coordinates.length} points)`);
    }
  }

  console.log(`\n✅ ${interstate} COMPLETE - Created ${corridors.length} corridor records\n`);

  return { success: true, count: corridors.length };
}

async function main() {
  console.log('🚀 Fetching Remaining Interstates (State-by-State)\n');
  console.log('Interstates to process: I-10, I-57, I-69, I-84, I-90, I-95\n');

  const interstates = ['I-10', 'I-57', 'I-69', 'I-84', 'I-90', 'I-95'];
  const results = {
    success: [],
    failed: []
  };

  for (const interstate of interstates) {
    try {
      const result = await fetchInterstate(interstate);
      if (result && result.success) {
        results.success.push(interstate);
      } else {
        results.failed.push(interstate);
      }

      // Wait between interstates to avoid rate limiting
      await sleep(5000);
    } catch (error) {
      console.log(`❌ Fatal error processing ${interstate}: ${error.message}`);
      results.failed.push(interstate);
    }
  }

  console.log('='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Successfully fetched: ${results.success.length} interstates`);
  if (results.success.length > 0) {
    console.log(`   ${results.success.join(', ')}`);
  }
  console.log(`\n❌ Failed: ${results.failed.length} interstates`);
  if (results.failed.length > 0) {
    console.log(`   ${results.failed.join(', ')}`);
  }
  console.log('');

  await pool.end();
}

main().catch(error => {
  console.error('Fatal error:', error);
  pool.end();
  process.exit(1);
});

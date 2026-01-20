const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Map corridor IDs to OSM query parameters
const CORRIDOR_OSM_QUERIES = {
  'I95_Eastern': {
    query: 'way["highway"="motorway"]["ref"~"^I ?95$"](37,-80,45,-66);',
    description: 'I-95 Eastern Corridor (ME to FL)'
  },
  'I10_Southern': {
    query: 'way["highway"="motorway"]["ref"~"^I ?10$"](-90,25,-75,35);',
    description: 'I-10 Southern Corridor (FL to TX)'
  },
  'I80_Northern': {
    query: 'way["highway"="motorway"]["ref"~"^I ?80$"](35,-125,43,-70);',
    description: 'I-80 Northern Corridor (CA to NJ)'
  },
  'I5_West_Coast': {
    query: 'way["highway"="motorway"]["ref"~"^I ?5$"](32,-125,49,-120);',
    description: 'I-5 West Coast (CA to WA)'
  },
  'I76_PA': {
    query: 'way["highway"="motorway"]["ref"~"^I ?76$"](39.7,-80.5,41.5,-74.5);',
    description: 'I-76 Pennsylvania Turnpike'
  },
  'I70_Midwest': {
    query: 'way["highway"="motorway"]["ref"~"^I ?70$"](38,-105,40,-75);',
    description: 'I-70 Midwest Corridor (UT to MD)'
  },
  'I90_Northern': {
    query: 'way["highway"="motorway"]["ref"~"^I ?90$"](41,-125,48,-70);',
    description: 'I-90 Northern Corridor (WA to MA)'
  },
  'I35_Central': {
    query: 'way["highway"="motorway"]["ref"~"^I ?35$"](25,-100,49,-92);',
    description: 'I-35 Central Corridor (TX to MN)'
  }
};

async function fetchOSMGeometry(query) {
  const overpassUrl = 'https://overpass-api.de/api/interpreter';
  const overpassQuery = `[out:json][timeout:60];(${query});out geom;`;

  console.log(`   Querying Overpass API...`);

  const response = await fetch(overpassUrl, {
    method: 'POST',
    body: overpassQuery,
    headers: { 'Content-Type': 'text/plain' }
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.elements || data.elements.length === 0) {
    console.log(`   ⚠️  No OSM data found`);
    return null;
  }

  console.log(`   ✓ Found ${data.elements.length} OSM ways`);

  // Combine all ways into a single LineString
  const allCoordinates = [];

  for (const element of data.elements) {
    if (element.type === 'way' && element.geometry) {
      for (const node of element.geometry) {
        // OSM returns [lat, lon], we need [lon, lat] for GeoJSON
        allCoordinates.push([node.lon, node.lat]);
      }
    }
  }

  if (allCoordinates.length === 0) {
    console.log(`   ⚠️  No coordinates found in OSM data`);
    return null;
  }

  // Remove consecutive duplicates
  const dedupedCoords = allCoordinates.filter((coord, idx) => {
    if (idx === 0) return true;
    const prev = allCoordinates[idx - 1];
    return coord[0] !== prev[0] || coord[1] !== prev[1];
  });

  console.log(`   ✓ Extracted ${dedupedCoords.length} coordinate points`);

  // Create GeoJSON LineString
  const geometry = {
    type: 'LineString',
    coordinates: dedupedCoords
  };

  // Calculate bounding box
  const lons = dedupedCoords.map(c => c[0]);
  const lats = dedupedCoords.map(c => c[1]);

  const bounds = {
    west: Math.min(...lons),
    east: Math.max(...lons),
    south: Math.min(...lats),
    north: Math.max(...lats)
  };

  return { geometry, bounds };
}

async function populateCorridorGeometries() {
  console.log('🗺️  Populating TETC Corridor Geometries from OpenStreetMap\n');

  let successCount = 0;
  let failCount = 0;

  for (const [corridorId, config] of Object.entries(CORRIDOR_OSM_QUERIES)) {
    console.log(`\n📍 ${corridorId}: ${config.description}`);

    try {
      const result = await fetchOSMGeometry(config.query);

      if (!result) {
        console.log(`   ⚠️  Skipping (no data)`);
        failCount++;
        continue;
      }

      // Update database
      await pool.query(
        `UPDATE corridor_service_quality_latest
         SET geometry = $1::jsonb, bounds = $2::jsonb
         WHERE corridor_id = $3`,
        [JSON.stringify(result.geometry), JSON.stringify(result.bounds), corridorId]
      );

      console.log(`   ✅ Updated database with geometry and bounds`);
      successCount++;

      // Rate limiting: wait 2 seconds between requests to be nice to Overpass API
      if (Object.keys(CORRIDOR_OSM_QUERIES).indexOf(corridorId) < Object.keys(CORRIDOR_OSM_QUERIES).length - 1) {
        console.log(`   ⏳ Waiting 2s before next request...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n\n✅ Complete! ${successCount} corridors updated, ${failCount} failed\n`);

  await pool.end();
}

populateCorridorGeometries().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

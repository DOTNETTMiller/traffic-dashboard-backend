const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Map corridor IDs to OSM query parameters
// These IDs match the production database corridors
const CORRIDOR_OSM_QUERIES = {
  'I95_CORRIDOR': {
    query: 'way["highway"="motorway"]["ref"~"^I ?95$"](37,-80,45,-66);',
    description: 'I-95 Eastern Corridor (ME to FL)'
  },
  'I95_MD': {
    query: 'way["highway"="motorway"]["ref"~"^I ?95$"](38,-77,39.7,-75.5);',
    description: 'I-95 Maryland'
  },
  'I95_VA': {
    query: 'way["highway"="motorway"]["ref"~"^I ?95$"](36.5,-78,39,-76.3);',
    description: 'I-95 Virginia'
  },
  'I95_DE': {
    query: 'way["highway"="motorway"]["ref"~"^I ?95$"](38.4,-75.8,39.8,-75);',
    description: 'I-95 Delaware'
  },
  'I95_NJ': {
    query: 'way["highway"="motorway"]["ref"~"^I ?95$"](38.9,-75.6,41.4,-73.9);',
    description: 'I-95 New Jersey (NJ Turnpike)'
  },
  'I95_PA': {
    query: 'way["highway"="motorway"]["ref"~"^I ?95$"](39.7,-75.3,40.1,-74.9);',
    description: 'I-95 Pennsylvania'
  },
  'I76_PA': {
    query: 'way["highway"="motorway"]["ref"~"^I ?76$"](39.7,-80.5,41.5,-74.5);',
    description: 'I-76 Pennsylvania Turnpike'
  },
  'I80_IA': {
    query: 'way["highway"="motorway"]["ref"~"^I ?80$"](41.3,-96.5,42.5,-90.3);',
    description: 'I-80 Iowa Segment'
  }
};

// Douglas-Peucker line simplification algorithm
function simplifyLineString(coords, tolerance) {
  if (coords.length <= 2) return coords;

  function perpendicularDistance(point, lineStart, lineEnd) {
    const [x, y] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

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

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function douglasPeucker(coords, tolerance) {
    if (coords.length <= 2) return coords;

    let maxDistance = 0;
    let index = 0;

    for (let i = 1; i < coords.length - 1; i++) {
      const distance = perpendicularDistance(coords[i], coords[0], coords[coords.length - 1]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }

    if (maxDistance > tolerance) {
      const left = douglasPeucker(coords.slice(0, index + 1), tolerance);
      const right = douglasPeucker(coords.slice(index), tolerance);
      return left.slice(0, -1).concat(right);
    } else {
      return [coords[0], coords[coords.length - 1]];
    }
  }

  return douglasPeucker(coords, tolerance);
}

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

  // Simplify geometry using Douglas-Peucker algorithm
  // Tolerance of 0.001 degrees (~100m) maintains accuracy while reducing points
  const simplifiedCoords = simplifyLineString(dedupedCoords, 0.001);
  const simplificationRatio = Math.round((1 - simplifiedCoords.length / dedupedCoords.length) * 100);

  console.log(`   ✓ Simplified to ${simplifiedCoords.length} points (${simplificationRatio}% reduction)`);

  // Create GeoJSON LineString with simplified coordinates
  const geometry = {
    type: 'LineString',
    coordinates: simplifiedCoords
  };

  // Calculate bounding box
  const lons = simplifiedCoords.map(c => c[0]);
  const lats = simplifiedCoords.map(c => c[1]);

  const bounds = {
    west: Math.min(...lons),
    east: Math.max(...lons),
    south: Math.min(...lats),
    north: Math.max(...lats)
  };

  return {
    geometry,
    bounds,
    pointCount: simplifiedCoords.length,
    originalPointCount: dedupedCoords.length
  };
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

      // Update corridors table (not the VIEW)
      await pool.query(
        `UPDATE corridors
         SET geometry = $1::jsonb, bounds = $2::jsonb
         WHERE id = $3`,
        [JSON.stringify(result.geometry), JSON.stringify(result.bounds), corridorId]
      );

      console.log(`   ✅ Updated database: ${result.pointCount} points (${result.originalPointCount} original)`);
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

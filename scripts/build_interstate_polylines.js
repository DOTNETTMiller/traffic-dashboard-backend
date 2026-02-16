/**
 * Build Interstate Polylines from OpenStreetMap
 *
 * Fetches complete, high-resolution polylines for Interstate 80 (I-80) and
 * Interstate 35 (I-35) from OpenStreetMap and stores them in PostgreSQL.
 *
 * Features:
 * - Queries Overpass API for complete interstate route relations
 * - Builds continuous polylines from OSM way segments
 * - Handles multi-state routes properly
 * - Stores as GeoJSON LineString in the geometry jsonb column
 * - Calculates and stores bounds (min/max lat/lon)
 * - Updates existing corridors or creates new ones
 */

const { Pool } = require('pg');
const axios = require('axios');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

/**
 * Interstate route configurations
 * Each interstate has separate eastbound/westbound or northbound/southbound relations
 */
const INTERSTATE_CONFIGS = {
  'I-80': {
    displayName: 'Interstate 80',
    description: 'I-80 from San Francisco, CA to Teaneck, NJ',
    directions: {
      westbound: {
        name: 'I-80 WB',
        description: 'I-80 Westbound (East to West)',
        // OSM relation IDs for I-80 westbound segments
        relationIds: [69363, 69364, 113177, 280678, 282374, 286810, 396249, 934337, 934352, 942897, 942899]
      },
      eastbound: {
        name: 'I-80 EB',
        description: 'I-80 Eastbound (West to East)',
        // OSM relation IDs for I-80 eastbound segments
        relationIds: [6901235, 6901301, 6902136, 6902197, 6903871, 6903909, 6904814, 6904820, 6904835, 6904948, 6904954]
      }
    }
  },
  'I-35': {
    displayName: 'Interstate 35',
    description: 'I-35 from Laredo, TX to Duluth, MN',
    directions: {
      northbound: {
        name: 'I-35 NB',
        description: 'I-35 Northbound (South to North)',
        // OSM relation IDs for I-35 northbound segments
        // Query: relation["ref"="35"]["network"="US:I"]["type"="route"]["route"="road"]
        relationIds: [2706644, 2706645, 2706646, 6902062, 6902063]
      },
      southbound: {
        name: 'I-35 SB',
        description: 'I-35 Southbound (North to South)',
        // OSM relation IDs for I-35 southbound segments
        relationIds: [108028, 108029, 108030, 108031, 108032]
      }
    }
  }
};

/**
 * Fetch a single OSM relation and extract its geometry
 */
async function fetchRelationGeometry(relationId) {
  console.log(`    Querying OSM relation ${relationId}...`);

  const overpassQuery = `
    [out:json][timeout:180];
    (
      relation(${relationId});
      >>;
    );
    out geom;
  `;

  try {
    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      `data=${encodeURIComponent(overpassQuery)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 200000
      }
    );

    const data = response.data;
    const relation = data.elements.find(e => e.type === 'relation' && e.id === relationId);
    const ways = data.elements.filter(e => e.type === 'way' && e.geometry);

    if (!relation) {
      console.log(`      WARNING: Relation ${relationId} not found`);
      return [];
    }

    // Build way ID lookup
    const wayById = {};
    for (const way of ways) {
      wayById[way.id] = way;
    }

    // Extract ways in the order defined by the relation
    const orderedCoords = [];
    for (const member of relation.members) {
      if (member.type === 'way' && wayById[member.ref]) {
        const way = wayById[member.ref];
        if (way.geometry && way.geometry.length > 0) {
          const coords = way.geometry.map(node => [node.lon, node.lat]);

          // Check if we need to reverse based on connection to previous segment
          if (orderedCoords.length > 0) {
            const lastCoord = orderedCoords[orderedCoords.length - 1];
            const firstCoord = coords[0];
            const lastCoordOfWay = coords[coords.length - 1];

            // If the last coordinate is closer to the end of this way, reverse it
            const distToStart = Math.hypot(lastCoord[0] - firstCoord[0], lastCoord[1] - firstCoord[1]);
            const distToEnd = Math.hypot(lastCoord[0] - lastCoordOfWay[0], lastCoord[1] - lastCoordOfWay[1]);

            if (distToEnd < distToStart) {
              coords.reverse();
            }
          }

          orderedCoords.push(...coords);
        }
      }
    }

    console.log(`      Got ${orderedCoords.length} coordinates`);
    return orderedCoords;

  } catch (error) {
    console.error(`      ERROR querying relation ${relationId}: ${error.message}`);
    return [];
  }
}

/**
 * Fetch complete geometry for a direction by combining multiple relations
 */
async function fetchDirectionGeometry(directionConfig) {
  console.log(`  Processing ${directionConfig.name}...`);
  console.log(`    Fetching ${directionConfig.relationIds.length} OSM relations`);

  const allCoords = [];

  for (const relationId of directionConfig.relationIds) {
    const coords = await fetchRelationGeometry(relationId);
    allCoords.push(...coords);

    // Rate limiting - be nice to Overpass API
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Deduplicate consecutive identical points
  const deduped = allCoords.filter((coord, i) => {
    if (i === 0) return true;
    const prev = allCoords[i - 1];
    return coord[0] !== prev[0] || coord[1] !== prev[1];
  });

  console.log(`    Total coordinates: ${deduped.length} (after deduplication)`);
  return deduped;
}

/**
 * Check for large gaps in geometry
 */
function analyzeGeometryQuality(coords, name) {
  console.log(`    Analyzing geometry quality...`);

  let jumpCount = 0;
  const jumps = [];

  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    const dist = Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));

    // Flag gaps larger than ~3.5 miles (0.05 degrees)
    if (dist > 0.05) {
      jumpCount++;
      jumps.push({
        index: i,
        distance: (dist * 69).toFixed(1) // Rough conversion to miles
      });
    }
  }

  if (jumpCount === 0) {
    console.log(`    Quality: EXCELLENT - No gaps found, continuous geometry`);
  } else {
    console.log(`    Quality: WARNING - Found ${jumpCount} gaps:`);
    jumps.slice(0, 5).forEach(jump => {
      console.log(`      Gap at index ${jump.index}: ~${jump.distance} miles`);
    });
    if (jumps.length > 5) {
      console.log(`      ... and ${jumps.length - 5} more gaps`);
    }
  }

  return jumpCount;
}

/**
 * Calculate bounding box for coordinates
 */
function calculateBounds(coords) {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return {
    west: minLon,
    east: maxLon,
    south: minLat,
    north: maxLat
  };
}

/**
 * Simplify coordinates using Douglas-Peucker algorithm
 */
function simplifyCoordinates(coordinates, targetCount) {
  if (coordinates.length <= targetCount) {
    console.log(`    Simplification: Not needed (${coordinates.length} <= ${targetCount} points)`);
    return coordinates;
  }

  console.log(`    Simplifying from ${coordinates.length} to ~${targetCount} points...`);

  // Use Douglas-Peucker simplification with adaptive epsilon
  let epsilon = 0.0001;
  let result = douglasPeucker(coordinates, epsilon);

  // Adjust epsilon to get closer to target count
  let iterations = 0;
  while (result.length > targetCount * 1.2 && iterations < 10) {
    epsilon *= 1.5;
    result = douglasPeucker(coordinates, epsilon);
    iterations++;
  }

  console.log(`    Simplified to ${result.length} points (epsilon: ${epsilon.toFixed(6)})`);
  return result;
}

/**
 * Douglas-Peucker line simplification algorithm
 */
function douglasPeucker(points, epsilon) {
  if (points.length < 3) return points;

  // Find point with maximum distance from line
  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  } else {
    return [first, last];
  }
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const num = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1);
  const den = Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));

  return num / den;
}

/**
 * Store corridor geometry in database
 */
async function storeCorridorGeometry(name, description, geometry, bounds) {
  const id = name.toLowerCase().replace(/\s+/g, '-');

  // Check if corridor exists
  const existing = await pool.query(
    `SELECT id FROM corridors WHERE id = $1`,
    [id]
  );

  const geometryJson = { type: 'LineString', coordinates: geometry };

  if (existing.rows.length > 0) {
    // Update existing corridor
    await pool.query(
      `UPDATE corridors
       SET geometry = $1, bounds = $2, description = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [geometryJson, bounds, description, id]
    );
    console.log(`    Database: UPDATED corridor '${id}'`);
  } else {
    // Insert new corridor
    await pool.query(
      `INSERT INTO corridors (id, name, description, geometry, bounds, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, name, description, geometryJson, bounds]
    );
    console.log(`    Database: CREATED corridor '${id}'`);
  }
}

/**
 * Process a single interstate (both directions)
 */
async function processInterstate(interstateKey, config) {
  console.log('\n' + '='.repeat(70));
  console.log(`PROCESSING: ${config.displayName}`);
  console.log(`Description: ${config.description}`);
  console.log('='.repeat(70));

  const results = {};

  for (const [directionKey, directionConfig] of Object.entries(config.directions)) {
    console.log();

    // Fetch geometry from OSM
    const coords = await fetchDirectionGeometry(directionConfig);

    if (coords.length === 0) {
      console.log(`  ERROR: No coordinates fetched for ${directionConfig.name}`);
      continue;
    }

    // Analyze quality
    analyzeGeometryQuality(coords, directionConfig.name);

    // Calculate bounds
    const bounds = calculateBounds(coords);
    console.log(`    Bounds: [${bounds.west.toFixed(3)}, ${bounds.south.toFixed(3)}] to [${bounds.east.toFixed(3)}, ${bounds.north.toFixed(3)}]`);

    // Simplify if needed (target: 10000 points max for reasonable storage/rendering)
    const simplified = simplifyCoordinates(coords, 10000);

    // Store in database
    await storeCorridorGeometry(
      directionConfig.name,
      directionConfig.description,
      simplified,
      bounds
    );

    results[directionKey] = {
      name: directionConfig.name,
      originalPoints: coords.length,
      finalPoints: simplified.length,
      bounds
    };

    console.log(`  SUCCESS: ${directionConfig.name} stored with ${simplified.length} points`);
  }

  return results;
}

/**
 * Main execution function
 */
async function buildInterstatePolylines() {
  console.log('\n' + '='.repeat(70));
  console.log('BUILD INTERSTATE POLYLINES FROM OPENSTREETMAP');
  console.log('='.repeat(70));
  console.log('This script fetches complete, high-resolution Interstate geometries');
  console.log('from OpenStreetMap and stores them in the PostgreSQL database.');
  console.log('='.repeat(70));

  const allResults = {};

  try {
    // Process I-80
    allResults['I-80'] = await processInterstate('I-80', INTERSTATE_CONFIGS['I-80']);

    // Process I-35
    allResults['I-35'] = await processInterstate('I-35', INTERSTATE_CONFIGS['I-35']);

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    for (const [interstate, results] of Object.entries(allResults)) {
      console.log(`\n${interstate}:`);
      for (const [direction, data] of Object.entries(results)) {
        console.log(`  ${data.name}:`);
        console.log(`    Original points: ${data.originalPoints.toLocaleString()}`);
        console.log(`    Final points: ${data.finalPoints.toLocaleString()}`);
        console.log(`    Bounds: W${data.bounds.west.toFixed(2)} E${data.bounds.east.toFixed(2)} S${data.bounds.south.toFixed(2)} N${data.bounds.north.toFixed(2)}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('SUCCESS: All Interstate polylines built and stored!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\nERROR:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
}

// Execute the script
buildInterstatePolylines()
  .then(() => {
    pool.end();
    console.log('\nScript complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error.message);
    pool.end();
    process.exit(1);
  });

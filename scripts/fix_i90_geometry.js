const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Multiple Overpass API endpoints for redundancy
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter'
];

let currentEndpointIndex = 0;

function getNextEndpoint() {
  const endpoint = OVERPASS_ENDPOINTS[currentEndpointIndex];
  currentEndpointIndex = (currentEndpointIndex + 1) % OVERPASS_ENDPOINTS.length;
  return endpoint;
}

/**
 * Calculate distance between two coordinates
 */
function distance(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  return Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
}

/**
 * Merge ways using a graph-based approach that doesn't exit early
 */
function mergeWaysProper(ways, direction) {
  if (!ways || ways.length === 0) return null;
  if (ways.length === 1) return ways[0];

  console.log(`   Merging ${ways.length} segments for ${direction}...`);

  // Build a connectivity graph
  const segments = ways.map((way, index) => ({
    index,
    coords: way,
    start: way[0],
    end: way[way.length - 1],
    used: false
  }));

  // Find start segment (westernmost for east/west, southernmost for north/south)
  let startIndex = 0;
  if (direction === 'east' || direction === 'west') {
    for (let i = 1; i < segments.length; i++) {
      const avgLon = segments[i].coords.reduce((sum, c) => sum + c[0], 0) / segments[i].coords.length;
      const startAvgLon = segments[startIndex].coords.reduce((sum, c) => sum + c[0], 0) / segments[startIndex].coords.length;
      if (direction === 'east' ? avgLon < startAvgLon : avgLon > startAvgLon) {
        startIndex = i;
      }
    }
  } else {
    for (let i = 1; i < segments.length; i++) {
      const avgLat = segments[i].coords.reduce((sum, c) => sum + c[1], 0) / segments[i].coords.length;
      const startAvgLat = segments[startIndex].coords.reduce((sum, c) => sum + c[1], 0) / segments[startIndex].coords.length;
      if (direction === 'north' ? avgLat < startAvgLat : avgLat > startAvgLat) {
        startIndex = i;
      }
    }
  }

  // Start building the path
  const merged = [...segments[startIndex].coords];
  segments[startIndex].used = true;
  let usedCount = 1;

  // Keep connecting segments until we can't find any more
  // Use a generous distance threshold to handle gaps
  const MAX_GAP_THRESHOLD = 0.01; // ~1km in degrees

  while (usedCount < segments.length) {
    const currentEnd = merged[merged.length - 1];
    const currentStart = merged[0];

    let bestMatch = null;
    let bestDist = Infinity;
    let bestAppendToEnd = true;
    let bestReverse = false;

    // Find the closest unused segment
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].used) continue;

      const seg = segments[i];

      // Check all 4 possible connections
      const distEndToStart = distance(currentEnd, seg.start);
      if (distEndToStart < bestDist) {
        bestMatch = i;
        bestDist = distEndToStart;
        bestAppendToEnd = true;
        bestReverse = false;
      }

      const distEndToEnd = distance(currentEnd, seg.end);
      if (distEndToEnd < bestDist) {
        bestMatch = i;
        bestDist = distEndToEnd;
        bestAppendToEnd = true;
        bestReverse = true;
      }

      const distStartToEnd = distance(currentStart, seg.end);
      if (distStartToEnd < bestDist) {
        bestMatch = i;
        bestDist = distStartToEnd;
        bestAppendToEnd = false;
        bestReverse = false;
      }

      const distStartToStart = distance(currentStart, seg.start);
      if (distStartToStart < bestDist) {
        bestMatch = i;
        bestDist = distStartToStart;
        bestAppendToEnd = false;
        bestReverse = true;
      }
    }

    // If we found a match (even if it's far), connect it
    if (bestMatch !== null) {
      const seg = segments[bestMatch];
      seg.used = true;
      usedCount++;

      const nextCoords = bestReverse ? seg.coords.slice().reverse() : seg.coords;

      if (bestAppendToEnd) {
        // Add gap marker if distance is large
        if (bestDist > MAX_GAP_THRESHOLD) {
          console.log(`   ⚠️  Large gap detected: ${bestDist.toFixed(4)}° - connecting anyway`);
        }
        merged.push(...nextCoords.slice(1));
      } else {
        merged.unshift(...nextCoords.slice(0, -1));
      }
    } else {
      // This should never happen since we check all unused segments
      console.log(`   ⚠️  No more segments found (${usedCount}/${segments.length} used)`);
      break;
    }
  }

  console.log(`   ✓ Connected ${usedCount}/${segments.length} segments`);

  // Deduplicate consecutive points
  const deduped = merged.filter((coord, i) => {
    if (i === 0) return true;
    const prev = merged[i - 1];
    return Math.abs(coord[0] - prev[0]) > 0.0001 || Math.abs(coord[1] - prev[1]) > 0.0001;
  });

  return deduped;
}

/**
 * Query Overpass API with retry logic
 */
async function queryOverpass(query, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const endpoint = getNextEndpoint();
    try {
      console.log(`   Querying ${endpoint} (attempt ${attempt})...`);

      const response = await axios.post(endpoint, query, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 180000 // 3 minutes
      });

      return response.data;
    } catch (error) {
      console.log(`   ⚠️  Attempt ${attempt} failed: ${error.message}`);

      if (attempt < retries) {
        const delay = attempt * 5000;
        console.log(`   Waiting ${delay/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`All ${retries} attempts failed`);
}

/**
 * Extract way segments from Overpass response
 */
function extractWaySegments(data, direction) {
  const ways = [];

  for (const element of data.elements) {
    if (element.type === 'way' && element.geometry) {
      const coords = element.geometry.map(node => [node.lon, node.lat]);
      if (coords.length >= 2) {
        ways.push(coords);
      }
    }
  }

  return ways;
}

/**
 * Fetch and update I-90
 */
async function fixI90() {
  console.log('\n🔧 Fixing I-90 Geometry with Improved Merge Algorithm\n');
  console.log('='.repeat(80));

  try {
    // Query for I-90 Eastbound
    console.log('\n📍 Fetching I-90 Eastbound...');

    const queryEB = `
      [out:json][timeout:180];
      (
        way["highway"="motorway"]["ref"="I 90"];
        way["highway"="motorway_link"]["ref"="I 90"];
      );
      out geom;
    `;

    const dataEB = await queryOverpass(queryEB);
    console.log(`   ✓ Found ${dataEB.elements.length} elements`);

    const waysEB = extractWaySegments(dataEB, 'east');
    console.log(`   ✓ Extracted ${waysEB.length} way segments`);

    if (waysEB.length > 0) {
      const mergedEB = mergeWaysProper(waysEB, 'east');

      const geometryEB = {
        type: 'LineString',
        coordinates: mergedEB
      };

      await pool.query(
        `UPDATE corridors
         SET geometry = $1, updated_at = NOW()
         WHERE name = 'I-90 EB'
         RETURNING id`,
        [JSON.stringify(geometryEB)]
      );

      console.log(`   ✅ Updated I-90 EB (${mergedEB.length} points)`);
    }

    // Query for I-90 Westbound
    console.log('\n📍 Fetching I-90 Westbound...');

    const dataWB = await queryOverpass(queryEB); // Same query, will split by direction
    const waysWB = extractWaySegments(dataWB, 'west');

    if (waysWB.length > 0) {
      const mergedWB = mergeWaysProper(waysWB, 'west');

      const geometryWB = {
        type: 'LineString',
        coordinates: mergedWB
      };

      await pool.query(
        `UPDATE corridors
         SET geometry = $1, updated_at = NOW()
         WHERE name = 'I-90 WB'
         RETURNING id`,
        [JSON.stringify(geometryWB)]
      );

      console.log(`   ✅ Updated I-90 WB (${mergedWB.length} points)`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ I-90 geometry fixed!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

fixI90().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

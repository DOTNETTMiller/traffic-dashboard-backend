const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Try multiple Overpass API instances for better reliability
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter'
];

let currentEndpoint = 0;

function getNextEndpoint() {
  const endpoint = OVERPASS_ENDPOINTS[currentEndpoint];
  currentEndpoint = (currentEndpoint + 1) % OVERPASS_ENDPOINTS.length;
  return endpoint;
}

/**
 * Calculate distance between two coordinates
 */
function distance(coord1, coord2) {
  return Math.sqrt(
    Math.pow(coord2[0] - coord1[0], 2) + Math.pow(coord2[1] - coord1[1], 2)
  );
}

/**
 * Simplify coordinates using Douglas-Peucker algorithm
 */
function simplifyCoordinates(coords, maxPoints) {
  if (coords.length <= maxPoints) return coords;

  // Simple uniform sampling
  const step = Math.ceil(coords.length / maxPoints);
  const simplified = [];

  for (let i = 0; i < coords.length; i += step) {
    simplified.push(coords[i]);
  }

  // Always include the last point
  if (simplified[simplified.length - 1] !== coords[coords.length - 1]) {
    simplified.push(coords[coords.length - 1]);
  }

  return simplified;
}

/**
 * Merge multiple way segments and simplify (FIXED VERSION)
 */
function mergeAndSimplifyWays(ways, direction) {
  if (!ways || ways.length === 0) return null;
  if (ways.length === 1) {
    const simplified = simplifyCoordinates(ways[0], 50000);
    console.log(`   ✓ ${direction.toUpperCase()}: ${ways[0].length} → ${simplified.length} points (single segment)`);
    return simplified;
  }

  // Find the starting segment (westernmost for east, easternmost for west, etc.)
  let startSegmentIndex = 0;
  if (direction === 'east' || direction === 'west') {
    for (let i = 1; i < ways.length; i++) {
      const currentAvgLon = ways[i].reduce((sum, coord) => sum + coord[0], 0) / ways[i].length;
      const startAvgLon = ways[startSegmentIndex].reduce((sum, coord) => sum + coord[0], 0) / ways[startSegmentIndex].length;
      if (direction === 'east') {
        if (currentAvgLon < startAvgLon) startSegmentIndex = i;
      } else {
        if (currentAvgLon > startAvgLon) startSegmentIndex = i;
      }
    }
  } else {
    for (let i = 1; i < ways.length; i++) {
      const currentAvgLat = ways[i].reduce((sum, coord) => sum + coord[1], 0) / ways[i].length;
      const startAvgLat = ways[startSegmentIndex].reduce((sum, coord) => sum + coord[1], 0) / ways[startSegmentIndex].length;
      if (direction === 'north') {
        if (currentAvgLat < startAvgLat) startSegmentIndex = i;
      } else {
        if (currentAvgLat > startAvgLat) startSegmentIndex = i;
      }
    }
  }

  // Start with the first segment
  const merged = [...ways[startSegmentIndex]];
  const used = new Set([startSegmentIndex]);

  // Connect segments end-to-end by finding closest unused segment
  while (used.size < ways.length) {
    const currentEnd = merged[merged.length - 1];
    const currentStart = merged[0];

    let closestIndex = -1;
    let closestDist = Infinity;
    let appendToEnd = true;
    let reverseSegment = false;

    for (let i = 0; i < ways.length; i++) {
      if (used.has(i)) continue;

      const segmentStart = ways[i][0];
      const segmentEnd = ways[i][ways[i].length - 1];

      // Check all 4 connection possibilities
      const distEndToStart = distance(currentEnd, segmentStart);
      if (distEndToStart < closestDist) {
        closestDist = distEndToStart;
        closestIndex = i;
        appendToEnd = true;
        reverseSegment = false;
      }

      const distEndToEnd = distance(currentEnd, segmentEnd);
      if (distEndToEnd < closestDist) {
        closestDist = distEndToEnd;
        closestIndex = i;
        appendToEnd = true;
        reverseSegment = true;
      }

      const distStartToEnd = distance(currentStart, segmentEnd);
      if (distStartToEnd < closestDist) {
        closestDist = distStartToEnd;
        closestIndex = i;
        appendToEnd = false;
        reverseSegment = false;
      }

      const distStartToStart = distance(currentStart, segmentStart);
      if (distStartToStart < closestDist) {
        closestDist = distStartToStart;
        closestIndex = i;
        appendToEnd = false;
        reverseSegment = true;
      }
    }

    if (closestIndex === -1) break;

    used.add(closestIndex);
    const nextSegment = reverseSegment ? ways[closestIndex].slice().reverse() : ways[closestIndex];

    if (appendToEnd) {
      merged.push(...nextSegment.slice(1));
    } else {
      merged.unshift(...nextSegment.slice(0, -1));
    }
  }

  // Deduplicate consecutive points
  const deduped = merged.filter((coord, i) => {
    if (i === 0) return true;
    const prev = merged[i - 1];
    return Math.abs(coord[0] - prev[0]) > 0.0001 || Math.abs(coord[1] - prev[1]) > 0.0001;
  });

  const simplified = simplifyCoordinates(deduped, 50000);

  console.log(`   ✓ ${direction.toUpperCase()}: ${ways.length} segments, ${merged.length} → ${deduped.length} → ${simplified.length} points`);

  return simplified;
}

/**
 * Fetch interstate geometry from OSM with retry logic
 */
async function fetchInterstateGeometry(routeNumber, direction, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const endpoint = getNextEndpoint();
      console.log(`   Attempt ${attempt}/${retries} using ${endpoint}...`);

      const refMap = {
        'east': `I ${routeNumber} East`,
        'west': `I ${routeNumber} West`,
        'north': `I ${routeNumber} North`,
        'south': `I ${routeNumber} South`
      };

      const query = `
        [out:json][timeout:180];
        (
          way["ref"~"^I[ -]?${routeNumber}$"]["highway"~"motorway|trunk"];
          way["name"~"Interstate ${routeNumber}"]["highway"~"motorway|trunk"];
          relation["ref"~"^I[ -]?${routeNumber}$"]["route"="road"];
        );
        out geom;
      `;

      const response = await axios.post(endpoint, query, {
        timeout: 180000,
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      if (!response.data || !response.data.elements || response.data.elements.length === 0) {
        console.log(`   ⚠️  No data found (attempt ${attempt}/${retries})`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
          continue;
        }
        return null;
      }

      console.log(`   ✓ Found ${response.data.elements.length} elements`);

      // Extract ways from elements
      const ways = [];

      for (const element of response.data.elements) {
        if (element.type === 'way' && element.geometry) {
          const coords = element.geometry.map(node => [node.lon, node.lat]);
          if (coords.length > 0) {
            ways.push(coords);
          }
        } else if (element.type === 'relation' && element.members) {
          // Extract ways from relation members
          for (const member of element.members) {
            if (member.type === 'way' && member.geometry) {
              const coords = member.geometry.map(node => [node.lon, node.lat]);
              if (coords.length > 0) {
                ways.push(coords);
              }
            }
          }
        }
      }

      if (ways.length === 0) {
        console.log(`   ⚠️  No valid ways found (attempt ${attempt}/${retries})`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
          continue;
        }
        return null;
      }

      console.log(`   ✓ Extracted ${ways.length} way segments`);

      const simplified = mergeAndSimplifyWays(ways, direction);

      return simplified ? {
        type: 'LineString',
        coordinates: simplified
      } : null;

    } catch (error) {
      console.error(`   ❌ Attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt < retries) {
        console.log(`   ⏳ Waiting ${5 * attempt} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
      }
    }
  }

  return null;
}

/**
 * Update corridor geometry in database
 */
async function updateCorridorGeometry(routeNumber, direction, geometry) {
  const dirMap = {
    'east': 'EB',
    'west': 'WB',
    'north': 'NB',
    'south': 'SB'
  };

  const corridorName = `I-${routeNumber} ${dirMap[direction]}`;

  try {
    const result = await pool.query(
      `UPDATE corridors
       SET geometry = $1,
           updated_at = NOW()
       WHERE name = $2
       RETURNING id, name`,
      [JSON.stringify(geometry), corridorName]
    );

    if (result.rows.length > 0) {
      console.log(`   ✅ Updated ${corridorName} (${geometry.coordinates.length} points)`);
      return true;
    } else {
      console.log(`   ⚠️  No corridor found with name: ${corridorName}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Database error for ${corridorName}: ${error.message}`);
    return false;
  }
}

/**
 * Fetch only corrupted interstates
 */
async function fetchCorruptedInterstates() {
  console.log('\n🔧 Re-fetching Corrupted Interstate Geometries from OpenStreetMap\n');
  console.log('='.repeat(80));

  // List of corrupted interstates from check_all_geometries.js
  const corrupted = [
    { num: 10, dirs: ['east', 'west'] },
    { num: 15, dirs: ['north', 'south'] },
    { num: 35, dirs: ['north', 'south'] },
    { num: 40, dirs: ['east', 'west'] },
    { num: 55, dirs: ['north'] },
    { num: 69, dirs: ['north', 'south'] },
    { num: 70, dirs: ['east', 'west'] },
    { num: 75, dirs: ['north', 'south'] },
    { num: 80, dirs: ['east', 'west'] },
    { num: 81, dirs: ['north', 'south'] },
    { num: 84, dirs: ['east', 'west'] },
    { num: 90, dirs: ['east', 'west'] },
    { num: 94, dirs: ['east', 'west'] },
    { num: 95, dirs: ['north', 'south'] }
  ];

  let totalUpdated = 0;
  let totalFailed = 0;

  for (const interstate of corrupted) {
    console.log(`\n📍 Processing I-${interstate.num}...`);

    for (const direction of interstate.dirs) {
      const geometry = await fetchInterstateGeometry(interstate.num, direction);

      if (geometry) {
        const success = await updateCorridorGeometry(interstate.num, direction, geometry);
        if (success) {
          totalUpdated++;
        } else {
          totalFailed++;
        }
      } else {
        totalFailed++;
      }

      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`  ✅ Successfully updated: ${totalUpdated} corridors`);
  console.log(`  ❌ Failed: ${totalFailed} corridors`);

  await pool.end();
}

// Run the script
fetchCorruptedInterstates().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

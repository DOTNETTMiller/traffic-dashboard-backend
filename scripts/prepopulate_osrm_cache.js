#!/usr/bin/env node

/**
 * Pre-populate OSRM geometry cache
 *
 * This script fetches current FEU-G events and pre-populates the OSRM cache
 * so users never have to wait for road-snapping. Run this once, then the cache
 * persists forever in the database.
 *
 * Usage: node scripts/prepopulate_osrm_cache.js
 */

const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');

// Database connection
const dbPath = path.join(__dirname, '..', 'states.db');
const db = new Database(dbPath);

// Initialize cache table if it doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS osrm_geometry_cache (
    cache_key TEXT PRIMARY KEY,
    geometry TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`).run();

// Generate cache key (same as backend)
function getCacheKey(lat1, lng1, lat2, lng2, direction) {
  return `${lat1.toFixed(5)},${lng1.toFixed(5)}_${lat2.toFixed(5)},${lng2.toFixed(5)}_${direction || 'none'}`;
}

// Offset coordinates for direction (copied from backend)
function offsetCoordinates(coordinates, direction) {
  const offsetMeters = 10;
  const offsetDegrees = offsetMeters / 111320;
  let offsetMultiplier = 0;

  if (direction && typeof direction === 'string') {
    const dir = direction.toLowerCase();
    if (dir.includes('east') || dir.includes('eb') || dir === 'e') {
      offsetMultiplier = -1;
    } else if (dir.includes('west') || dir.includes('wb') || dir === 'w') {
      offsetMultiplier = 1;
    } else if (dir.includes('north') || dir.includes('nb') || dir === 'n') {
      offsetMultiplier = 1;
    } else if (dir.includes('south') || dir.includes('sb') || dir === 's') {
      offsetMultiplier = -1;
    }
  }

  if (offsetMultiplier === 0) return coordinates;

  return coordinates.map((coord, i) => {
    const [lng, lat] = coord;
    let bearing = 0;

    if (i < coordinates.length - 1) {
      const [nextLng, nextLat] = coordinates[i + 1];
      bearing = Math.atan2(nextLng - lng, nextLat - lat);
    } else if (i > 0) {
      const [prevLng, prevLat] = coordinates[i - 1];
      bearing = Math.atan2(lng - prevLng, lat - prevLat);
    }

    const perpBearing = bearing + (Math.PI / 2) * offsetMultiplier;
    const latOffset = Math.cos(perpBearing) * offsetDegrees;
    const lngOffset = Math.sin(perpBearing) * offsetDegrees;

    return [lng + lngOffset, lat + latOffset];
  });
}

// Fetch road-snapped geometry from OSRM
async function fetchOSRM(lat1, lng1, lat2, lng2, direction) {
  const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;

  try {
    const response = await axios.get(url, { timeout: 10000 });

    if (response.data.code === 'Ok' && response.data.routes?.[0]) {
      let coordinates = response.data.routes[0].geometry.coordinates;

      if (coordinates && coordinates.length > 0) {
        if (direction) {
          coordinates = offsetCoordinates(coordinates, direction);
        }
        return coordinates;
      }
    }
  } catch (error) {
    console.error(`❌ OSRM failed for ${lat1},${lng1} -> ${lat2},${lng2}:`, error.message);
  }

  return [[lng1, lat1], [lng2, lat2]]; // Fallback
}

// Main function
async function prepopulateCache() {
  console.log('🔄 Pre-populating OSRM geometry cache...\n');

  // Fetch current events from production API
  console.log('📡 Fetching current events from API...');
  const response = await axios.get('https://corridor-communication-dashboard-production.up.railway.app/api/events');
  const events = response.data.events || response.data;

  // Filter for FEU-G states (Iowa, Kansas, Minnesota, Nebraska, Indiana)
  const feuStates = ['Iowa', 'Kansas', 'Minnesota', 'Nebraska', 'Indiana'];
  const feuEvents = events.filter(e => feuStates.includes(e.state));

  console.log(`✅ Found ${feuEvents.length} FEU-G events\n`);

  // Extract unique route segments
  const segments = new Map();

  for (const event of feuEvents) {
    if (!event.geometry || event.geometry.coordinates.length !== 2) continue;

    const [start, end] = event.geometry.coordinates;
    const direction = event.direction || null;
    const key = getCacheKey(start[1], start[0], end[1], end[0], direction);

    if (!segments.has(key)) {
      segments.set(key, {
        lat1: start[1],
        lng1: start[0],
        lat2: end[1],
        lng2: end[0],
        direction
      });
    }
  }

  console.log(`📍 Found ${segments.size} unique route segments\n`);

  // Check how many are already cached
  let cached = 0;
  let toFetch = [];

  for (const [key, segment] of segments) {
    const exists = db.prepare('SELECT 1 FROM osrm_geometry_cache WHERE cache_key = ?').get(key);
    if (exists) {
      cached++;
    } else {
      toFetch.push({ key, ...segment });
    }
  }

  console.log(`✅ Already cached: ${cached}`);
  console.log(`🔄 Need to fetch: ${toFetch.length}\n`);

  if (toFetch.length === 0) {
    console.log('✅ Cache is already complete!');
    process.exit(0);
  }

  // Fetch missing segments with delay
  console.log('⏳ Fetching missing geometries from OSRM...');
  console.log(`   (${toFetch.length} requests × 200ms delay = ~${Math.ceil(toFetch.length * 0.2)}s)\n`);

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < toFetch.length; i++) {
    const segment = toFetch[i];

    process.stdout.write(`\r⏳ Progress: ${i + 1}/${toFetch.length}`);

    const geometry = await fetchOSRM(
      segment.lat1,
      segment.lng1,
      segment.lat2,
      segment.lng2,
      segment.direction
    );

    // Save to cache if road-snapped (more than 2 points)
    if (geometry.length > 2) {
      try {
        db.prepare('INSERT OR REPLACE INTO osrm_geometry_cache (cache_key, geometry) VALUES (?, ?)').run(
          segment.key,
          JSON.stringify(geometry)
        );
        successful++;
      } catch (error) {
        failed++;
      }
    } else {
      failed++;
    }

    // Delay between requests to avoid rate limiting
    if (i < toFetch.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`\n\n✅ Cache pre-population complete!`);
  console.log(`   ✓ Successful: ${successful}`);
  console.log(`   ✗ Failed: ${failed}`);
  console.log(`   📊 Total cached: ${cached + successful}/${segments.size}\n`);

  db.close();
}

// Run
prepopulateCache().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

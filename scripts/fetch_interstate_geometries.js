#!/usr/bin/env node

/**
 * Fetch Interstate Highway geometries from OpenStreetMap
 *
 * This script fetches actual interstate highway geometries from OSM's Overpass API
 * and stores them in the database for instant, accurate polyline rendering.
 *
 * Usage: node scripts/fetch_interstate_geometries.js
 */

const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');

// Database connection
const dbPath = path.join(__dirname, '..', 'states.db');
const db = new Database(dbPath);

// Initialize interstate geometries table
db.prepare(`
  CREATE TABLE IF NOT EXISTS interstate_geometries (
    corridor TEXT,
    state TEXT,
    direction TEXT,
    geometry TEXT NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (corridor, state, direction)
  )
`).run();

// FEU-G states and their interstates
const INTERSTATE_CORRIDORS = {
  'Iowa': ['I-29', 'I-35', 'I-80', 'I-280', 'I-380', 'I-680'],
  'Kansas': ['I-35', 'I-70', 'I-135', 'I-235', 'I-335', 'I-435', 'I-470', 'I-635', 'I-670'],
  'Minnesota': ['I-35', 'I-90', 'I-94', 'I-394', 'I-494', 'I-535', 'I-694'],
  'Nebraska': ['I-29', 'I-80', 'I-180', 'I-480', 'I-680'],
  'Indiana': ['I-64', 'I-65', 'I-69', 'I-70', 'I-74', 'I-80', 'I-90', 'I-94', 'I-164', 'I-265', 'I-465', 'I-469', 'I-865']
};

// State name to OSM relation mapping (approximate - may need adjustment)
const STATE_CODES = {
  'Iowa': 'IA',
  'Kansas': 'KS',
  'Minnesota': 'MN',
  'Nebraska': 'NE',
  'Indiana': 'IN'
};

/**
 * Fetch interstate geometry from Overpass API
 */
async function fetchInterstateGeometry(interstate, state) {
  const stateCode = STATE_CODES[state];

  // Overpass query to get highway geometry
  const query = `
    [out:json][timeout:25];
    area["ISO3166-2"="US-${stateCode}"]->.searchArea;
    (
      way["highway"="motorway"]["ref"="${interstate}"](area.searchArea);
      way["highway"="trunk"]["ref"="${interstate}"](area.searchArea);
    );
    out geom;
  `;

  try {
    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      query,
      {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 30000
      }
    );

    if (!response.data.elements || response.data.elements.length === 0) {
      console.log(`⚠️  No data found for ${interstate} in ${state}`);
      return null;
    }

    // Combine all way segments into a single geometry
    const coordinates = [];

    for (const element of response.data.elements) {
      if (element.type === 'way' && element.geometry) {
        for (const node of element.geometry) {
          coordinates.push([node.lon, node.lat]);
        }
      }
    }

    if (coordinates.length === 0) {
      return null;
    }

    // Remove duplicate consecutive points
    const unique = coordinates.filter((coord, i) => {
      if (i === 0) return true;
      const prev = coordinates[i - 1];
      return coord[0] !== prev[0] || coord[1] !== prev[1];
    });

    return unique;

  } catch (error) {
    console.error(`❌ Error fetching ${interstate} in ${state}:`, error.message);
    return null;
  }
}

/**
 * Split geometry into directional segments if possible
 */
function splitDirectionalGeometry(coordinates) {
  // For now, return both directions using the same geometry
  // In future, could use OSM direction tags or parallel way detection
  return {
    northbound: coordinates,
    southbound: [...coordinates].reverse(),
    eastbound: coordinates,
    westbound: [...coordinates].reverse()
  };
}

/**
 * Main function
 */
async function fetchAllInterstates() {
  console.log('🛣️  Fetching Interstate Highway geometries from OpenStreetMap...\n');

  let totalFetched = 0;
  let totalFailed = 0;

  for (const [state, interstates] of Object.entries(INTERSTATE_CORRIDORS)) {
    console.log(`\n📍 Processing ${state}...`);

    for (const interstate of interstates) {
      process.stdout.write(`   Fetching ${interstate}... `);

      const geometry = await fetchInterstateGeometry(interstate, state);

      if (geometry) {
        const directions = splitDirectionalGeometry(geometry);

        // Store each direction
        for (const [direction, coords] of Object.entries(directions)) {
          try {
            db.prepare(`
              INSERT OR REPLACE INTO interstate_geometries
              (corridor, state, direction, geometry, updated_at)
              VALUES (?, ?, ?, ?, strftime('%s', 'now'))
            `).run(
              interstate,
              state,
              direction,
              JSON.stringify(coords)
            );
          } catch (error) {
            console.error(`\n   ❌ Failed to store ${interstate} ${direction}:`, error.message);
            totalFailed++;
          }
        }

        console.log(`✅ (${geometry.length} points)`);
        totalFetched++;
      } else {
        console.log('❌ Failed');
        totalFailed++;
      }

      // Be nice to Overpass API - delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n\n✅ Interstate geometry fetch complete!');
  console.log(`   ✓ Successful: ${totalFetched}`);
  console.log(`   ✗ Failed: ${totalFailed}\n`);

  db.close();
}

// Run
fetchAllInterstates().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Harvest Interstate Geometries from State Event Feeds
 *
 * This script extracts high-quality multi-point geometries from state DOT event feeds
 * and uses them to populate/improve the interstate_geometries table.
 *
 * Strategy:
 * 1. Fetch events from all state feeds
 * 2. Filter for Interstate events with multi-point geometries (>2 points)
 * 3. Extract corridor + direction + geometry
 * 4. Deduplicate and merge with existing OSM data (keep highest resolution)
 * 5. Build incrementally over time as new events are published
 */

const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// State feed configurations from data_feeds table
const STATE_FEEDS = [
  {
    state: 'Iowa',
    code: 'IA',
    url: 'https://ia.carsprogram.org/hub/data/feu-g.xml',
    format: 'xml'
  },
  {
    state: 'Illinois',
    code: 'IL',
    url: 'https://www.travelmidwest.com/lmiga/feed.jsp',
    format: 'xml'
  },
  // Add more states as we discover feeds with good geometry data
];

/**
 * Parse coordinates from WKT LINESTRING
 */
function parseWKTLineString(wkt) {
  if (!wkt) return null;

  const match = wkt.match(/LINESTRING\s*\(([^)]+)\)/i);
  if (!match) return null;

  const coordPairs = match[1].split(',').map(pair => {
    const [lng, lat] = pair.trim().split(/\s+/).map(Number);
    return [lng, lat];
  });

  return coordPairs.length >= 2 ? coordPairs : null;
}

/**
 * Extract Interstate number and direction from event
 */
function extractCorridorInfo(event) {
  // Look for Interstate patterns in various fields
  const fields = [
    event.headline,
    event.description,
    event.route,
    event.start_road_name,
    event.end_road_name
  ].filter(Boolean).join(' ');

  // Match I-XX or Interstate XX patterns
  const interstateMatch = fields.match(/I-?(\d+)/i);
  if (!interstateMatch) return null;

  const number = interstateMatch[1];
  const corridor = `I-${number}`;

  // Determine direction
  let direction = null;
  if (event.direction) {
    const dir = event.direction.toUpperCase();
    if (dir.includes('EAST') || dir.includes('EB')) direction = 'EB';
    else if (dir.includes('WEST') || dir.includes('WB')) direction = 'WB';
    else if (dir.includes('NORTH') || dir.includes('NB')) direction = 'NB';
    else if (dir.includes('SOUTH') || dir.includes('SB')) direction = 'SB';
  }

  // If no explicit direction, infer from road name or description
  if (!direction) {
    const upperFields = fields.toUpperCase();
    if (upperFields.includes('EASTBOUND') || upperFields.includes(' EB ')) direction = 'EB';
    else if (upperFields.includes('WESTBOUND') || upperFields.includes(' WB ')) direction = 'WB';
    else if (upperFields.includes('NORTHBOUND') || upperFields.includes(' NB ')) direction = 'NB';
    else if (upperFields.includes('SOUTHBOUND') || upperFields.includes(' SB ')) direction = 'SB';
  }

  return { corridor, direction };
}

/**
 * Fetch and parse Iowa DOT feed
 */
async function fetchIowaEvents() {
  console.log('\n📍 Fetching Iowa DOT events...');

  try {
    const response = await axios.get('https://ia.carsprogram.org/hub/data/feu-g.xml', {
      timeout: 30000
    });

    const xml = await parseStringPromise(response.data);
    const features = xml?.FEU?.FEATURE || [];

    const events = features.map(feature => ({
      organization: 'Iowa DOT',
      route: feature.$.route,
      direction: feature.$.direction,
      headline: feature.$.headline,
      description: feature.$.description,
      geometry: feature.$.geometry,
      start_road_name: feature.$.start_road_name,
      end_road_name: feature.$.end_road_name
    }));

    console.log(`  ✓ Fetched ${events.length} Iowa events`);
    return events;

  } catch (error) {
    console.error(`  ❌ Iowa fetch failed: ${error.message}`);
    return [];
  }
}

/**
 * Fetch events from all state feeds
 */
async function fetchAllStateEvents() {
  const allEvents = [];

  // Fetch Iowa (we know this works)
  const iowaEvents = await fetchIowaEvents();
  allEvents.push(...iowaEvents);

  // TODO: Add more state feeds as we discover them

  return allEvents;
}

/**
 * Calculate geometry quality score (higher = better)
 */
function calculateQualityScore(coords) {
  if (!coords || coords.length < 2) return 0;

  // More points = higher quality
  let score = coords.length * 10;

  // Calculate total path length
  let totalDistance = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    totalDistance += Math.sqrt(dx * dx + dy * dy);
  }

  // Better point density = higher quality
  const pointDensity = coords.length / (totalDistance + 0.001);
  score += pointDensity * 1000;

  return score;
}

/**
 * Process events and extract usable Interstate geometries
 */
function processEvents(events) {
  const geometryMap = new Map(); // Key: "corridor-direction", Value: best geometry

  let processed = 0;
  let multiPoint = 0;
  let interstate = 0;
  let hasDirection = 0;
  let extracted = 0;

  for (const event of events) {
    processed++;

    // Parse geometry
    const coords = parseWKTLineString(event.geometry);
    if (!coords) continue;

    // Only interested in multi-point geometries (not straight lines)
    if (coords.length <= 2) continue;
    multiPoint++;

    // Extract Interstate corridor and direction
    const info = extractCorridorInfo(event);
    if (!info) continue;
    interstate++;

    if (!info.direction) continue;
    hasDirection++;

    const key = `${info.corridor}-${info.direction}`;
    const quality = calculateQualityScore(coords);

    // Keep the highest quality geometry for each corridor-direction
    const existing = geometryMap.get(key);
    if (!existing || quality > existing.quality) {
      geometryMap.set(key, {
        corridor: info.corridor,
        direction: info.direction,
        coordinates: coords,
        quality: quality,
        points: coords.length,
        source: event.organization
      });
      extracted++;
    }
  }

  console.log('\n📊 Processing Stats:');
  console.log(`  Total events: ${processed}`);
  console.log(`  Multi-point geometries: ${multiPoint} (${Math.round(multiPoint/processed*100)}%)`);
  console.log(`  Interstate events: ${interstate}`);
  console.log(`  With direction: ${hasDirection}`);
  console.log(`  Unique geometries extracted: ${extracted}`);

  return Array.from(geometryMap.values());
}

/**
 * Check if we already have geometry for this corridor-direction
 */
async function getExistingGeometry(corridor, direction) {
  const result = await pool.query(
    `SELECT
       ST_NumPoints(geometry) as points,
       ST_AsGeoJSON(geometry) as geojson
     FROM interstate_geometries
     WHERE corridor = $1 AND direction = $2`,
    [corridor, direction]
  );

  if (result.rows.length === 0) return null;

  const geojson = JSON.parse(result.rows[0].geojson);
  return {
    points: result.rows[0].points,
    coordinates: geojson.coordinates,
    quality: calculateQualityScore(geojson.coordinates)
  };
}

/**
 * Insert or update geometry in database
 */
async function upsertGeometry(geometry) {
  const existing = await getExistingGeometry(geometry.corridor, geometry.direction);

  if (existing) {
    // Compare quality - only update if new geometry is better
    if (geometry.quality <= existing.quality) {
      console.log(`  ⊘ ${geometry.corridor} ${geometry.direction}: Existing geometry is better (${existing.points} pts vs ${geometry.points} pts)`);
      return 'skipped';
    }

    console.log(`  ⬆️  ${geometry.corridor} ${geometry.direction}: Upgrading from ${existing.points} to ${geometry.points} points (${geometry.source})`);
  } else {
    console.log(`  ➕ ${geometry.corridor} ${geometry.direction}: New geometry with ${geometry.points} points (${geometry.source})`);
  }

  // Convert coordinates to PostGIS LineString
  const wkt = `LINESTRING(${geometry.coordinates.map(c => `${c[0]} ${c[1]}`).join(', ')})`;

  await pool.query(
    `INSERT INTO interstate_geometries (corridor, direction, geometry, data_source)
     VALUES ($1, $2, ST_GeomFromText($3, 4326), $4)
     ON CONFLICT (corridor, direction)
     DO UPDATE SET
       geometry = ST_GeomFromText($3, 4326),
       data_source = $4,
       updated_at = NOW()`,
    [geometry.corridor, geometry.direction, wkt, geometry.source]
  );

  return existing ? 'upgraded' : 'inserted';
}

/**
 * Main harvest function
 */
async function harvest() {
  console.log('==========================================================================');
  console.log('🌾 Harvesting Interstate Geometries from State Event Feeds');
  console.log('==========================================================================');

  try {
    // Fetch all state events
    const events = await fetchAllStateEvents();
    console.log(`\n✓ Total events fetched: ${events.length}`);

    // Process and extract Interstate geometries
    const geometries = processEvents(events);

    if (geometries.length === 0) {
      console.log('\n⊘ No usable Interstate geometries found');
      return;
    }

    // Insert/update database
    console.log('\n💾 Updating database...');
    let inserted = 0;
    let upgraded = 0;
    let skipped = 0;

    for (const geometry of geometries) {
      const result = await upsertGeometry(geometry);
      if (result === 'inserted') inserted++;
      else if (result === 'upgraded') upgraded++;
      else skipped++;
    }

    console.log('\n==========================================================================');
    console.log('📊 Harvest Summary');
    console.log('==========================================================================');
    console.log(`✅ New geometries added: ${inserted}`);
    console.log(`⬆️  Geometries upgraded: ${upgraded}`);
    console.log(`⊘ Skipped (existing better): ${skipped}`);
    console.log(`📦 Total processed: ${geometries.length}`);

    // Show final database state
    const summary = await pool.query(`
      SELECT
        corridor,
        COUNT(*) as directions,
        SUM(ST_NumPoints(geometry)) as total_points,
        MAX(data_source) as source
      FROM interstate_geometries
      GROUP BY corridor
      ORDER BY corridor
    `);

    console.log('\n📍 Current Interstate Coverage:');
    for (const row of summary.rows) {
      console.log(`  ${row.corridor}: ${row.directions} direction(s), ${row.total_points.toLocaleString()} points (${row.source})`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log('\n==========================================================================');
  console.log('✅ Harvest Complete!');
  console.log('==========================================================================\n');
}

if (require.main === module) {
  harvest();
}

module.exports = { harvest };

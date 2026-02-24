#!/usr/bin/env node

/**
 * Fix Iowa 2-Point Geometries Using Iowa DOT Road Network
 *
 * Replaces 2-point (start/end only) event geometries with detailed polylines
 * from Iowa DOT's official Road Network FeatureServer.
 *
 * Data Source: https://gis.iowadot.gov/agshost/rest/services/RAMS/Road_Network/FeatureServer/0
 */

const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'traffic_data.db');
const IOWA_ROAD_NETWORK_API = 'https://gis.iowadot.gov/agshost/rest/services/RAMS/Road_Network/FeatureServer/0/query';

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extract route number from various formats
 */
function extractRouteNumber(routeName) {
  if (!routeName) return null;

  // Match patterns like "I-80", "I80", "Interstate 80", "US 20", "IA 5"
  const patterns = [
    /I-?(\d+)/i,           // Interstate
    /US-?(\d+)/i,          // US Highway
    /IA-?(\d+)/i,          // Iowa Highway
    /INTERSTATE\s+(\d+)/i  // Full word
  ];

  for (const pattern of patterns) {
    const match = routeName.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Query Iowa DOT Road Network for route geometry
 */
async function queryIowaRoadNetwork(routeId, bbox = null) {
  try {
    const params = {
      where: `ROUTEID LIKE '%${routeId}%'`,
      outFields: 'ROUTEID,STATE_ROUTE_NAME_1,STATE_ROUTE_NAME_2,COUNTY_NUMBER',
      returnGeometry: true,
      f: 'geojson'
    };

    // Add bounding box if provided (helps filter to specific segment)
    if (bbox) {
      params.geometry = JSON.stringify({
        xmin: bbox.minLon,
        ymin: bbox.minLat,
        xmax: bbox.maxLon,
        ymax: bbox.maxLat,
        spatialReference: { wkid: 4326 }
      });
      params.geometryType = 'esriGeometryEnvelope';
      params.spatialRel = 'esriSpatialRelIntersects';
    }

    const response = await axios.get(IOWA_ROAD_NETWORK_API, {
      params,
      timeout: 30000
    });

    return response.data;
  } catch (error) {
    console.error(`   ❌ Error querying Iowa Road Network: ${error.message}`);
    return null;
  }
}

/**
 * Find best matching road segment for an event
 */
function findBestMatchingSegment(event, roadFeatures) {
  if (!roadFeatures || roadFeatures.length === 0) {
    return null;
  }

  const [startLon, startLat] = event.geometry.coordinates[0];
  const [endLon, endLat] = event.geometry.coordinates[event.geometry.coordinates.length - 1];

  let bestMatch = null;
  let bestScore = Infinity;

  for (const feature of roadFeatures) {
    if (!feature.geometry || !feature.geometry.coordinates) {
      continue;
    }

    const coords = feature.geometry.coordinates;
    if (coords.length < 2) {
      continue;
    }

    // Calculate distance from event start/end to segment start/end
    const segStart = coords[0];
    const segEnd = coords[coords.length - 1];

    const startToSegStart = calculateDistance(startLat, startLon, segStart[1], segStart[0]);
    const startToSegEnd = calculateDistance(startLat, startLon, segEnd[1], segEnd[0]);
    const endToSegStart = calculateDistance(endLat, endLon, segStart[1], segStart[0]);
    const endToSegEnd = calculateDistance(endLat, endLon, segEnd[1], segEnd[0]);

    // Score based on proximity (lower is better)
    const score = Math.min(
      startToSegStart + endToSegEnd, // Normal direction
      startToSegEnd + endToSegStart   // Reverse direction
    );

    if (score < bestScore && score < 5) { // Within 5km threshold
      bestScore = score;
      bestMatch = feature;
    }
  }

  return bestMatch;
}

/**
 * Fix 2-point geometries for Iowa events
 */
async function fixIowa2PointGeometries() {
  console.log('🚛 Fixing Iowa 2-Point Geometries\n');
  console.log('Data Source: Iowa DOT Road Network FeatureServer\n');

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  try {
    // Find all Iowa events with 2-point geometries
    const events = db.prepare(`
      SELECT
        id,
        corridor,
        direction,
        headline,
        description,
        geometry
      FROM cached_events
      WHERE state_key = 'ia'
        AND geometry IS NOT NULL
        AND json_array_length(json_extract(geometry, '$.coordinates')) = 2
    `).all();

    console.log(`📊 Found ${events.length} Iowa events with 2-point geometries\n`);

    if (events.length === 0) {
      console.log('✅ No 2-point events to fix!');
      db.close();
      return;
    }

    let fixed = 0;
    let failed = 0;
    let skipped = 0;

    for (const event of events) {
      try {
        const geometry = JSON.parse(event.geometry);
        const routeNumber = extractRouteNumber(event.corridor);

        if (!routeNumber) {
          console.log(`⏭️  Skipping ${event.id}: Cannot extract route number from "${event.corridor}"`);
          skipped++;
          continue;
        }

        console.log(`🔧 Processing ${event.id}: ${event.corridor} ${event.direction}`);
        console.log(`   Route: I-${routeNumber}`);

        // Create bounding box around event points (with buffer)
        const [startLon, startLat] = geometry.coordinates[0];
        const [endLon, endLat] = geometry.coordinates[1];

        const bbox = {
          minLat: Math.min(startLat, endLat) - 0.1,
          maxLat: Math.max(startLat, endLat) + 0.1,
          minLon: Math.min(startLon, endLon) - 0.1,
          maxLon: Math.max(startLon, endLon) + 0.1
        };

        // Query Iowa Road Network
        const roadData = await queryIowaRoadNetwork(routeNumber, bbox);

        if (!roadData || !roadData.features || roadData.features.length === 0) {
          console.log(`   ❌ No road geometry found`);
          failed++;
          continue;
        }

        console.log(`   ✓ Found ${roadData.features.length} road segments`);

        // Find best matching segment
        const bestMatch = findBestMatchingSegment(event, roadData.features);

        if (!bestMatch) {
          console.log(`   ❌ No suitable match found`);
          failed++;
          continue;
        }

        // Update event geometry
        const newGeometry = {
          type: 'LineString',
          coordinates: bestMatch.geometry.coordinates
        };

        db.prepare(`
          UPDATE cached_events
          SET
            geometry = ?,
            geometry_source = 'Iowa DOT Road Network FeatureServer'
          WHERE id = ?
        `).run(JSON.stringify(newGeometry), event.id);

        console.log(`   ✅ Fixed! Geometry updated from 2 points to ${newGeometry.coordinates.length} points\n`);
        fixed++;

        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`   ❌ Error processing ${event.id}: ${error.message}\n`);
        failed++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📍 Total: ${events.length}`);

    if (fixed > 0) {
      console.log('\n✨ Success! Iowa event geometries have been enhanced with detailed polylines.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    db.close();
  }
}

if (require.main === module) {
  fixIowa2PointGeometries();
}

module.exports = { fixIowa2PointGeometries, queryIowaRoadNetwork };

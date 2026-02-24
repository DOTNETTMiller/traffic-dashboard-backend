#!/usr/bin/env node

/**
 * Fix Iowa 2-Point Geometries Using Iowa DOT Road Network (PostgreSQL version)
 *
 * Replaces 2-point (start/end only) event geometries with detailed polylines
 * from Iowa DOT's official Road Network FeatureServer.
 *
 * Data Source: https://gis.iowadot.gov/agshost/rest/services/RAMS/Road_Network/FeatureServer/0
 */

const axios = require('axios');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const IOWA_ROAD_NETWORK_API = 'https://gis.iowadot.gov/agshost/rest/services/RAMS/Road_Network/FeatureServer/0/query';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

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
      f: 'geojson',
      outSR: 4326
    };

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

  const geometry = JSON.parse(event.geometry);
  const [startLon, startLat] = geometry.coordinates[0];
  const [endLon, endLat] = geometry.coordinates[geometry.coordinates.length - 1];

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

    const segStart = coords[0];
    const segEnd = coords[coords.length - 1];

    const startToSegStart = calculateDistance(startLat, startLon, segStart[1], segStart[0]);
    const startToSegEnd = calculateDistance(startLat, startLon, segEnd[1], segEnd[0]);
    const endToSegStart = calculateDistance(endLat, endLon, segStart[1], segStart[0]);
    const endToSegEnd = calculateDistance(endLat, endLon, segEnd[1], segEnd[0]);

    const score = Math.min(
      startToSegStart + endToSegEnd,
      startToSegEnd + endToSegStart
    );

    if (score < bestScore && score < 5) {
      bestScore = score;
      bestMatch = feature;
    }
  }

  return bestMatch;
}

/**
 * Validate geometry alignment with OSRM
 */
async function validateAlignmentWithOSRM(event, newGeometry) {
  try {
    const geometry = JSON.parse(event.geometry);
    const [startLon, startLat] = geometry.coordinates[0];
    const [endLon, endLat] = geometry.coordinates[1];

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
    const response = await axios.get(osrmUrl, { timeout: 5000 });

    if (response.data?.routes?.[0]?.geometry?.coordinates) {
      const osrmCoords = response.data.routes[0].geometry.coordinates;
      const stateDOTCoords = newGeometry.coordinates;

      const sampleSize = Math.min(5, Math.floor(osrmCoords.length / 2), Math.floor(stateDOTCoords.length / 2));
      let totalOffset = 0;
      let samples = 0;

      for (let i = 0; i < sampleSize; i++) {
        const osrmIdx = Math.floor((osrmCoords.length - 1) * i / (sampleSize - 1));
        const stateDOTIdx = Math.floor((stateDOTCoords.length - 1) * i / (sampleSize - 1));

        const offset = calculateDistance(
          osrmCoords[osrmIdx][1], osrmCoords[osrmIdx][0],
          stateDOTCoords[stateDOTIdx][1], stateDOTCoords[stateDOTIdx][0]
        );

        totalOffset += offset;
        samples++;
      }

      const avgOffset = (totalOffset / samples) * 1000;
      return {
        avgOffsetMeters: Math.round(avgOffset),
        aligned: avgOffset < 50
      };
    }
  } catch (error) {
    // OSRM check is optional
  }

  return { avgOffsetMeters: null, aligned: null };
}

/**
 * Fix 2-point geometries for Iowa events
 */
async function fixIowa2PointGeometries() {
  console.log('🚛 Fixing Iowa 2-Point Geometries\n');
  console.log('Data Source: Iowa DOT Road Network FeatureServer');
  console.log('Coordinate System: WGS84 (EPSG:4326) - matches OpenStreetMap\n');

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Find all Iowa events with 2-point geometries
    const result = await pool.query(`
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
        AND jsonb_array_length((geometry::jsonb)->'coordinates') = 2
    `);

    const events = result.rows;

    console.log(`📊 Found ${events.length} Iowa events with 2-point geometries\n`);

    if (events.length === 0) {
      console.log('✅ No 2-point events to fix!');
      await pool.end();
      return;
    }

    let fixed = 0;
    let failed = 0;
    let skipped = 0;
    let alignmentChecks = [];

    for (const event of events) {
      try {
        const routeNumber = extractRouteNumber(event.corridor);

        if (!routeNumber) {
          console.log(`⏭️  Skipping ${event.id}: Cannot extract route number from "${event.corridor}"`);
          skipped++;
          continue;
        }

        console.log(`🔧 Processing ${event.id}: ${event.corridor} ${event.direction}`);
        console.log(`   Route: I-${routeNumber}`);

        const geometry = JSON.parse(event.geometry);
        const [startLon, startLat] = geometry.coordinates[0];
        const [endLon, endLat] = geometry.coordinates[1];

        const bbox = {
          minLat: Math.min(startLat, endLat) - 0.1,
          maxLat: Math.max(startLat, endLat) + 0.1,
          minLon: Math.min(startLon, endLon) - 0.1,
          maxLon: Math.max(startLon, endLon) + 0.1
        };

        const roadData = await queryIowaRoadNetwork(routeNumber, bbox);

        if (!roadData || !roadData.features || roadData.features.length === 0) {
          console.log(`   ❌ No road geometry found`);
          failed++;
          continue;
        }

        console.log(`   ✓ Found ${roadData.features.length} road segments`);

        const bestMatch = findBestMatchingSegment(event, roadData.features);

        if (!bestMatch) {
          console.log(`   ❌ No suitable match found`);
          failed++;
          continue;
        }

        const newGeometry = {
          type: 'LineString',
          coordinates: bestMatch.geometry.coordinates
        };

        const alignment = await validateAlignmentWithOSRM(event, newGeometry);

        await pool.query(`
          UPDATE cached_events
          SET
            geometry = $1,
            geometry_source = 'Iowa DOT Road Network FeatureServer'
          WHERE id = $2
        `, [JSON.stringify(newGeometry), event.id]);

        if (alignment.avgOffsetMeters !== null) {
          const alignmentIcon = alignment.aligned ? '✅' : '⚠️';
          console.log(`   ${alignmentIcon} Alignment check: ${alignment.avgOffsetMeters}m avg offset from OSM`);
          alignmentChecks.push(alignment.avgOffsetMeters);
        }

        console.log(`   ✅ Fixed! Geometry updated from 2 points to ${newGeometry.coordinates.length} points\n`);
        fixed++;

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

    if (alignmentChecks.length > 0) {
      const avgOffset = Math.round(alignmentChecks.reduce((a, b) => a + b, 0) / alignmentChecks.length);
      const wellAligned = alignmentChecks.filter(o => o < 50).length;
      const alignmentPct = Math.round((wellAligned / alignmentChecks.length) * 100);

      console.log('\n🗺️  OpenStreetMap Alignment:');
      console.log(`   Average offset: ${avgOffset} meters`);
      console.log(`   Well-aligned (<50m): ${alignmentPct}% (${wellAligned}/${alignmentChecks.length})`);

      if (avgOffset < 20) {
        console.log('   ✅ Excellent alignment with OpenStreetMap!');
      } else if (avgOffset < 50) {
        console.log('   ✅ Good alignment with OpenStreetMap');
      } else {
        console.log('   ⚠️  Some offset detected - Iowa DOT survey data may differ from OSM');
        console.log('   ℹ️  This is normal - official survey data can be more accurate than crowdsourced OSM');
      }
    }

    if (fixed > 0) {
      console.log('\n✨ Success! Iowa event geometries have been enhanced with detailed polylines.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  fixIowa2PointGeometries();
}

module.exports = { fixIowa2PointGeometries };

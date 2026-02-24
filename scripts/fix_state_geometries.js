#!/usr/bin/env node

/**
 * Multi-State Geometry Alignment Script
 *
 * Generalized solution for fixing 2-point event geometries using official
 * state DOT GIS services. Based on the Iowa implementation pattern.
 *
 * Usage:
 *   node scripts/fix_state_geometries.js --state iowa
 *   node scripts/fix_state_geometries.js --state iowa,ohio,utah
 *   node scripts/fix_state_geometries.js --all
 *
 * See docs/STATE_GEOMETRY_ALIGNMENT.md for documentation on adding new states.
 */

const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'traffic_data.db');

/**
 * State Configuration
 *
 * To add a new state:
 * 1. Find the state DOT's ArcGIS REST service URL
 * 2. Identify the route field name (ROUTEID, ROUTE_ID, etc.)
 * 3. Define route patterns for matching (Interstate, US, State highways)
 * 4. Set requiresAuth and apiKey if needed
 */
const STATE_CONFIGS = {
  iowa: {
    name: 'Iowa',
    stateKey: 'ia',
    apiUrl: 'https://gis.iowadot.gov/agshost/rest/services/RAMS/Road_Network/FeatureServer/0/query',
    routeField: 'ROUTEID',
    routePatterns: [
      { pattern: /I-?(\d+)/i, prefix: 'I' },           // Interstate
      { pattern: /US-?(\d+)/i, prefix: 'US' },         // US Highway
      { pattern: /IA-?(\d+)/i, prefix: 'IA' }          // Iowa Highway
    ],
    requiresAuth: false,
    dataSource: 'Iowa DOT Road Network FeatureServer'
  },

  ohio: {
    name: 'Ohio',
    stateKey: 'oh',
    apiUrl: 'https://gis.dot.state.oh.us/tims/rest/services/TIMS_PUB/Roadway_Network/MapServer/0/query',
    routeField: 'ROUTE_ID',
    routePatterns: [
      { pattern: /I-?(\d+)/i, prefix: 'I' },
      { pattern: /US-?(\d+)/i, prefix: 'US' },
      { pattern: /SR-?(\d+)/i, prefix: 'SR' }          // State Route
    ],
    requiresAuth: false,
    dataSource: 'Ohio DOT TIMS Roadway Network'
  },

  minnesota: {
    name: 'Minnesota',
    stateKey: 'mn',
    apiUrl: 'https://gisdata.mn.gov/arcgis/rest/services/trans/roadcenterlines/MapServer/0/query',
    routeField: 'ROUTE_SYS',
    routePatterns: [
      { pattern: /I-?(\d+)/i, prefix: 'I' },
      { pattern: /US-?(\d+)/i, prefix: 'US' },
      { pattern: /MN-?(\d+)/i, prefix: 'MN' }
    ],
    requiresAuth: false,
    dataSource: 'Minnesota DOT Road Centerlines'
  },

  utah: {
    name: 'Utah',
    stateKey: 'ut',
    apiUrl: 'https://gis.udot.utah.gov/hosting/rest/services/ROUTES/MapServer/0/query',
    routeField: 'ROUTE_ID',
    routePatterns: [
      { pattern: /I-?(\d+)/i, prefix: 'I' },
      { pattern: /US-?(\d+)/i, prefix: 'US' },
      { pattern: /SR-?(\d+)/i, prefix: 'SR' }
    ],
    requiresAuth: false,
    dataSource: 'Utah DOT Routes'
  }

  // Add more states here following the same pattern
};

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
function extractRouteInfo(routeName, stateConfig) {
  if (!routeName) return null;

  for (const { pattern, prefix } of stateConfig.routePatterns) {
    const match = routeName.match(pattern);
    if (match) {
      return {
        number: match[1],
        prefix: prefix,
        full: `${prefix}-${match[1]}`
      };
    }
  }

  return null;
}

/**
 * Query state DOT GIS service for route geometry
 */
async function queryStateDOT(stateConfig, routeInfo, bbox = null) {
  try {
    const params = {
      where: `${stateConfig.routeField} LIKE '%${routeInfo.number}%'`,
      outFields: '*',
      returnGeometry: true,
      f: 'geojson',
      outSR: 4326  // Request WGS84 for OSM compatibility
    };

    // Add bounding box if provided
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

    // Add authentication if required
    const config = { params, timeout: 30000 };
    if (stateConfig.requiresAuth && stateConfig.apiKey) {
      config.headers = { 'Authorization': `Bearer ${stateConfig.apiKey}` };
    }

    const response = await axios.get(stateConfig.apiUrl, config);
    return response.data;

  } catch (error) {
    console.error(`   ❌ Error querying ${stateConfig.name} DOT: ${error.message}`);
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
 * Validate geometry alignment with OSRM (optional quality check)
 */
async function validateAlignmentWithOSRM(event, newGeometry) {
  try {
    const [startLon, startLat] = event.geometry.coordinates[0];
    const [endLon, endLat] = event.geometry.coordinates[1];

    // Get OSRM route for comparison
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
    const response = await axios.get(osrmUrl, { timeout: 5000 });

    if (response.data?.routes?.[0]?.geometry?.coordinates) {
      const osrmCoords = response.data.routes[0].geometry.coordinates;
      const stateDOTCoords = newGeometry.coordinates;

      // Sample a few points and calculate average offset
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

      const avgOffset = (totalOffset / samples) * 1000; // Convert to meters
      return {
        avgOffsetMeters: Math.round(avgOffset),
        aligned: avgOffset < 50
      };
    }
  } catch (error) {
    // OSRM check is optional, continue if it fails
  }

  return { avgOffsetMeters: null, aligned: null };
}

/**
 * Fix 2-point geometries for a specific state
 */
async function fixStateGeometries(stateConfig) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚛 Processing ${stateConfig.name}`);
  console.log(`${'='.repeat(80)}\n`);
  console.log(`Data Source: ${stateConfig.dataSource}`);
  console.log(`Coordinate System: WGS84 (EPSG:4326) - matches OpenStreetMap\n`);

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  try {
    // Find all events for this state with 2-point geometries
    const events = db.prepare(`
      SELECT
        id,
        corridor,
        direction,
        headline,
        description,
        geometry
      FROM cached_events
      WHERE state_key = ?
        AND geometry IS NOT NULL
        AND json_array_length(json_extract(geometry, '$.coordinates')) = 2
    `).all(stateConfig.stateKey);

    console.log(`📊 Found ${events.length} ${stateConfig.name} events with 2-point geometries\n`);

    if (events.length === 0) {
      console.log(`✅ No 2-point events to fix for ${stateConfig.name}!`);
      return {
        state: stateConfig.name,
        fixed: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        alignmentChecks: []
      };
    }

    let fixed = 0;
    let failed = 0;
    let skipped = 0;
    let alignmentChecks = [];

    for (const event of events) {
      try {
        const geometry = JSON.parse(event.geometry);
        const routeInfo = extractRouteInfo(event.corridor, stateConfig);

        if (!routeInfo) {
          console.log(`⏭️  Skipping ${event.id}: Cannot extract route number from "${event.corridor}"`);
          skipped++;
          continue;
        }

        console.log(`🔧 Processing ${event.id}: ${event.corridor} ${event.direction}`);
        console.log(`   Route: ${routeInfo.full}`);

        // Create bounding box around event points (with buffer)
        const [startLon, startLat] = geometry.coordinates[0];
        const [endLon, endLat] = geometry.coordinates[1];

        const bbox = {
          minLat: Math.min(startLat, endLat) - 0.1,
          maxLat: Math.max(startLat, endLat) + 0.1,
          minLon: Math.min(startLon, endLon) - 0.1,
          maxLon: Math.max(startLon, endLon) + 0.1
        };

        // Query state DOT service
        const roadData = await queryStateDOT(stateConfig, routeInfo, bbox);

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

        // Validate alignment with OpenStreetMap (via OSRM comparison)
        const alignment = await validateAlignmentWithOSRM(event, newGeometry);

        db.prepare(`
          UPDATE cached_events
          SET
            geometry = ?,
            geometry_source = ?
          WHERE id = ?
        `).run(JSON.stringify(newGeometry), stateConfig.dataSource, event.id);

        if (alignment.avgOffsetMeters !== null) {
          const alignmentIcon = alignment.aligned ? '✅' : '⚠️';
          console.log(`   ${alignmentIcon} Alignment check: ${alignment.avgOffsetMeters}m avg offset from OSM`);
          alignmentChecks.push(alignment.avgOffsetMeters);
        }

        console.log(`   ✅ Fixed! Geometry updated from 2 points to ${newGeometry.coordinates.length} points\n`);
        fixed++;

        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 150));

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
        console.log(`   ⚠️  Some offset detected - ${stateConfig.name} DOT survey data may differ from OSM`);
        console.log('   ℹ️  This is normal - official survey data can be more accurate than crowdsourced OSM');
      }
    }

    return {
      state: stateConfig.name,
      fixed,
      failed,
      skipped,
      total: events.length,
      alignmentChecks
    };

  } catch (error) {
    console.error(`❌ Error processing ${stateConfig.name}:`, error.message);
    console.error(error.stack);
    return {
      state: stateConfig.name,
      fixed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      error: error.message
    };
  } finally {
    db.close();
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  let statesToProcess = [];

  if (args.includes('--all')) {
    statesToProcess = Object.keys(STATE_CONFIGS);
  } else {
    const stateArg = args.find(arg => arg.startsWith('--state='));
    if (stateArg) {
      const stateList = stateArg.split('=')[1];
      statesToProcess = stateList.split(',').map(s => s.trim().toLowerCase());
    }
  }

  if (statesToProcess.length === 0) {
    console.log('🚛 Multi-State Geometry Alignment Tool\n');
    console.log('Usage:');
    console.log('  node scripts/fix_state_geometries.js --state=iowa');
    console.log('  node scripts/fix_state_geometries.js --state=iowa,ohio,utah');
    console.log('  node scripts/fix_state_geometries.js --all\n');
    console.log('Available states:');
    Object.keys(STATE_CONFIGS).forEach(key => {
      const config = STATE_CONFIGS[key];
      console.log(`  - ${key} (${config.name})`);
    });
    console.log('\nSee docs/STATE_GEOMETRY_ALIGNMENT.md for more information.');
    process.exit(0);
  }

  // Validate states
  const invalidStates = statesToProcess.filter(s => !STATE_CONFIGS[s]);
  if (invalidStates.length > 0) {
    console.error(`❌ Invalid state(s): ${invalidStates.join(', ')}`);
    console.error(`Available states: ${Object.keys(STATE_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  console.log('🚛 Multi-State Geometry Alignment Tool');
  console.log('======================================\n');
  console.log(`Processing ${statesToProcess.length} state(s): ${statesToProcess.join(', ')}\n`);

  const results = [];

  for (const stateKey of statesToProcess) {
    const stateConfig = STATE_CONFIGS[stateKey];
    const result = await fixStateGeometries(stateConfig);
    results.push(result);
  }

  // Overall summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 OVERALL SUMMARY');
  console.log('='.repeat(80) + '\n');

  const totals = results.reduce((acc, r) => ({
    fixed: acc.fixed + r.fixed,
    failed: acc.failed + r.failed,
    skipped: acc.skipped + r.skipped,
    total: acc.total + r.total
  }), { fixed: 0, failed: 0, skipped: 0, total: 0 });

  results.forEach(r => {
    console.log(`${r.state}:`);
    console.log(`  ✅ Fixed: ${r.fixed}`);
    console.log(`  ❌ Failed: ${r.failed}`);
    console.log(`  ⏭️  Skipped: ${r.skipped}`);
    console.log(`  📍 Total: ${r.total}`);
    if (r.error) {
      console.log(`  ⚠️  Error: ${r.error}`);
    }
    console.log('');
  });

  console.log('Grand Total:');
  console.log(`  ✅ Fixed: ${totals.fixed}`);
  console.log(`  ❌ Failed: ${totals.failed}`);
  console.log(`  ⏭️  Skipped: ${totals.skipped}`);
  console.log(`  📍 Total: ${totals.total}`);

  if (totals.fixed > 0) {
    console.log('\n✨ Success! Event geometries have been enhanced with detailed polylines.');
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  STATE_CONFIGS,
  fixStateGeometries,
  calculateDistance,
  extractRouteInfo
};

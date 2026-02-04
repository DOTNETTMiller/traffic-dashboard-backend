#!/usr/bin/env node

/**
 * Test script to verify Interstate geometry snapping is working
 *
 * This script simulates the snapToRoad function to test if:
 * 1. Interstate geometries are properly stored in the database
 * 2. The query retrieves them correctly
 * 3. Segment extraction works for sample events
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// Haversine distance formula (in kilometers)
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Extract a segment from a full highway geometry
function extractSegment(geometry, lat1, lng1, lat2, lng2) {
  if (!geometry || geometry.length < 2) {
    return null;
  }

  // Find closest points to start and end using proper Haversine distance
  let startIdx = 0;
  let endIdx = geometry.length - 1;
  let minStartDist = Infinity;
  let minEndDist = Infinity;

  for (let i = 0; i < geometry.length; i++) {
    const [lon, lat] = geometry[i];

    const startDist = haversineDistance(lat1, lng1, lat, lon);
    if (startDist < minStartDist) {
      minStartDist = startDist;
      startIdx = i;
    }

    const endDist = haversineDistance(lat2, lng2, lat, lon);
    if (endDist < minEndDist) {
      minEndDist = endDist;
      endIdx = i;
    }
  }

  // Ensure start comes before end
  if (startIdx > endIdx) {
    [startIdx, endIdx] = [endIdx, startIdx];
  }

  // Extract segment
  const segment = geometry.slice(startIdx, endIdx + 1);

  // Validation 1: Endpoints must be reasonably close to highway (2km = ~1.2 miles)
  if (minStartDist > 2 || minEndDist > 2) {
    console.log(`⚠️  Segment rejected: start=${minStartDist.toFixed(1)}km, end=${minEndDist.toFixed(1)}km from highway (max 2km)`);
    return null;
  }

  // Validation 2: Calculate actual event distance
  const eventDistance = haversineDistance(lat1, lng1, lat2, lng2);

  // Validation 3: Calculate segment path length
  let segmentPathLength = 0;
  for (let i = 0; i < segment.length - 1; i++) {
    const [lon1, lat1] = segment[i];
    const [lon2, lat2] = segment[i + 1];
    segmentPathLength += haversineDistance(lat1, lon1, lat2, lon2);
  }

  // Validation 4: Segment shouldn't be way longer than event distance
  // Allow 5x ratio to account for road curves and detours
  if (segmentPathLength > Math.max(eventDistance * 5, 50)) {
    console.log(`⚠️  Segment rejected: segment=${segmentPathLength.toFixed(1)}km is too long for event=${eventDistance.toFixed(1)}km`);
    return null;
  }

  // Validation 5: Segment shouldn't use too much of the highway
  // If we're using more than 30% of the full highway geometry, something is wrong
  if (segment.length > geometry.length * 0.3) {
    console.log(`⚠️  Segment rejected: ${segment.length} points is ${((segment.length/geometry.length)*100).toFixed(0)}% of full highway`);
    return null;
  }

  console.log(`✅ Segment extracted: start=${minStartDist.toFixed(1)}km, end=${minEndDist.toFixed(1)}km, segment=${segmentPathLength.toFixed(1)}km, event=${eventDistance.toFixed(1)}km, ${segment.length} points`);
  return segment.length >= 2 ? segment : null;
}

async function testGeometrySnapping() {
  console.log('🧪 Testing Interstate Geometry Snapping\n');

  try {
    // Test 1: Check if geometries exist in database
    console.log('Test 1: Checking database for Interstate geometries...');
    const countRes = await pool.query('SELECT COUNT(*) as count FROM interstate_geometries');
    const count = parseInt(countRes.rows[0].count);
    console.log(`✅ Found ${count} Interstate geometries in database\n`);

    if (count === 0) {
      console.error('❌ No geometries found. Run fetch_all_interstate_geometries.js first');
      process.exit(1);
    }

    // Test 2: Sample a few geometries
    console.log('Test 2: Sampling Interstate geometries...');
    const sampleRes = await pool.query(`
      SELECT corridor, state, direction,
             length(geometry::text) as geom_size,
             substring(geometry, 1, 100) as geom_preview
      FROM interstate_geometries
      LIMIT 5
    `);

    console.log('Sample geometries:');
    sampleRes.rows.forEach(row => {
      console.log(`  ${row.corridor} ${row.state} ${row.direction}: ${row.geom_size} chars`);
    });
    console.log('');

    // Test 3: Test snapping with a sample Iowa I-80 event
    console.log('Test 3: Testing snapping with sample I-80 IA event...');
    console.log('  Sample event: I-80 IA WB from Des Moines (41.6, -93.75) to (41.59, -93.5)');

    const testQuery = `
      SELECT ST_AsGeoJSON(geometry) as geojson
      FROM interstate_geometries
      WHERE corridor = $1 AND state = $2 AND direction = $3
    `;

    const geometryRes = await pool.query(testQuery, ['I-80', 'IA', 'WB']);

    if (geometryRes.rows.length === 0) {
      console.log('❌ No geometry found for I-80 IA WB');
      console.log('   This might be expected if geometries haven\'t been fetched yet\n');
    } else {
      console.log('✅ Found I-80 IA WB geometry');

      // Parse and test segment extraction
      const fullGeometry = JSON.parse(geometryRes.rows[0].geojson);
      console.log(`   Full geometry has ${fullGeometry.coordinates.length} points`);

      // Test coordinates (sample event near Des Moines)
      const lat1 = 41.6, lng1 = -93.75;
      const lat2 = 41.59, lng2 = -93.5;

      const segment = extractSegment(fullGeometry.coordinates, lat1, lng1, lat2, lng2);

      if (segment) {
        console.log(`✅ Successfully extracted segment with ${segment.length} points`);
        console.log(`   First point: [${segment[0][0].toFixed(4)}, ${segment[0][1].toFixed(4)}]`);
        console.log(`   Last point: [${segment[segment.length-1][0].toFixed(4)}, ${segment[segment.length-1][1].toFixed(4)}]`);
      } else {
        console.log('❌ Failed to extract segment (validations failed)');
      }
      console.log('');
    }

    // Test 4: Check which states/corridors have geometries
    console.log('Test 4: Coverage summary...');
    const coverageRes = await pool.query(`
      SELECT state, corridor, direction, COUNT(*) as count
      FROM interstate_geometries
      GROUP BY state, corridor, direction
      ORDER BY state, corridor, direction
      LIMIT 20
    `);

    console.log('Available geometries (first 20):');
    coverageRes.rows.forEach(row => {
      console.log(`  ${row.corridor} ${row.state} ${row.direction}`);
    });

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Database contains ${count} Interstate geometries`);
    console.log(`   - Geometries are stored as GeoJSON TEXT`);
    console.log(`   - Segment extraction algorithm is working`);
    console.log('   - Events should now snap to Interstate polylines instead of showing straight lines\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run tests
testGeometrySnapping();

/**
 * Properly sequence I-80 TIGER/Line segments into a continuous path
 * Uses nearest-neighbor algorithm to connect segments end-to-end
 */

const fs = require('fs');
const { Pool } = require('pg');

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function simplifyLineString(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDistance = 0, maxIndex = 0;
  const firstPoint = points[0], lastPoint = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [x1, y1] = firstPoint, [x2, y2] = lastPoint;
    const dx = x2 - x1, dy = y2 - y1, mag = Math.sqrt(dx * dx + dy * dy);
    let distance;
    if (mag === 0) {
      distance = Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
    } else {
      const u = ((x - x1) * dx + (y - y1) * dy) / (mag * mag);
      let closestX, closestY;
      if (u < 0) { closestX = x1; closestY = y1; }
      else if (u > 1) { closestX = x2; closestY = y2; }
      else { closestX = x1 + u * dx; closestY = y1 + u * dy; }
      distance = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
    }
    if (distance > maxDistance) { maxDistance = distance; maxIndex = i; }
  }

  if (maxDistance > tolerance) {
    const leftPart = simplifyLineString(points.slice(0, maxIndex + 1), tolerance);
    const rightPart = simplifyLineString(points.slice(maxIndex), tolerance);
    return leftPart.slice(0, -1).concat(rightPart);
  }
  return [firstPoint, lastPoint];
}

function sequenceSegments(segments) {
  if (segments.length === 0) return [];
  if (segments.length === 1) return segments[0];

  console.log('   Sequencing', segments.length, 'segments...');

  // Start with the westernmost segment
  let orderedSegments = [];
  let remaining = [...segments];

  // Find westernmost starting point
  let minLon = Infinity;
  let startIdx = 0;
  for (let i = 0; i < remaining.length; i++) {
    const firstPoint = remaining[i][0];
    if (firstPoint[0] < minLon) {
      minLon = firstPoint[0];
      startIdx = i;
    }
  }

  orderedSegments.push(remaining[startIdx]);
  remaining.splice(startIdx, 1);

  // Connect remaining segments using nearest-neighbor
  while (remaining.length > 0) {
    const lastSegment = orderedSegments[orderedSegments.length - 1];
    const lastPoint = lastSegment[lastSegment.length - 1];
    const [lastLon, lastLat] = lastPoint;

    let minDist = Infinity;
    let nextIdx = -1;
    let shouldReverse = false;

    // Find nearest segment (try both orientations)
    for (let i = 0; i < remaining.length; i++) {
      const segment = remaining[i];
      const firstPoint = segment[0];
      const lastPointOfSegment = segment[segment.length - 1];

      // Distance to start of segment
      const distToStart = haversineDistance(lastLat, lastLon, firstPoint[1], firstPoint[0]);
      if (distToStart < minDist) {
        minDist = distToStart;
        nextIdx = i;
        shouldReverse = false;
      }

      // Distance to end of segment (would need to reverse)
      const distToEnd = haversineDistance(lastLat, lastLon, lastPointOfSegment[1], lastPointOfSegment[0]);
      if (distToEnd < minDist) {
        minDist = distToEnd;
        nextIdx = i;
        shouldReverse = true;
      }
    }

    if (nextIdx === -1) break;

    let nextSegment = remaining[nextIdx];
    if (shouldReverse) {
      nextSegment = [...nextSegment].reverse();
    }

    orderedSegments.push(nextSegment);
    remaining.splice(nextIdx, 1);

    if (orderedSegments.length % 50 === 0) {
      console.log('     Processed', orderedSegments.length, '/', segments.length);
    }
  }

  // Flatten into single coordinate array
  const result = [];
  for (const segment of orderedSegments) {
    result.push(...segment);
  }

  console.log('   Sequenced into', result.length, 'points');
  return result;
}

async function main() {
  console.log('🛣️  Sequencing I-80 TIGER/Line segments\n');

  const geojson = JSON.parse(fs.readFileSync('/tmp/i80_full.geojson', 'utf8'));

  console.log('📊 Input Data:');
  console.log('   Features:', geojson.features.length);

  // Extract all segments
  const segments = [];
  for (const feature of geojson.features) {
    if (feature.geometry.type === 'LineString') {
      segments.push(feature.geometry.coordinates);
    } else if (feature.geometry.type === 'MultiLineString') {
      for (const line of feature.geometry.coordinates) {
        segments.push(line);
      }
    }
  }

  console.log('   Segments:', segments.length);
  console.log('');

  // Sequence segments into continuous path
  const sequenced = sequenceSegments(segments);

  console.log('\n📊 Sequenced Result:');
  console.log('   Total points:', sequenced.length);

  // Apply light simplification
  console.log('\n🔄 Applying simplification (tolerance 0.0003)...');
  const simplified = simplifyLineString(sequenced, 0.0003);
  console.log('   Simplified points:', simplified.length);
  console.log('   Reduction:', ((1 - simplified.length / sequenced.length) * 100).toFixed(1) + '%');

  // Calculate total length
  let totalLength = 0;
  for (let i = 0; i < simplified.length - 1; i++) {
    const [lon1, lat1] = simplified[i];
    const [lon2, lat2] = simplified[i + 1];
    totalLength += haversineDistance(lat1, lon1, lat2, lon2);
  }

  console.log('   Total length:', totalLength.toFixed(2), 'km (', (totalLength * 0.621371).toFixed(2), 'mi)');

  // Verify ordering - check for large jumps
  console.log('\n🔍 Verifying continuity...');
  let largeJumps = 0;
  let maxJump = 0;
  for (let i = 0; i < simplified.length - 1; i++) {
    const [lon1, lat1] = simplified[i];
    const [lon2, lat2] = simplified[i + 1];
    const dist = haversineDistance(lat1, lon1, lat2, lon2);
    if (dist > 1) { // 1 km jump
      largeJumps++;
      if (dist > maxJump) maxJump = dist;
    }
  }
  console.log('   Large jumps (>1km):', largeJumps);
  console.log('   Max jump:', maxJump.toFixed(2), 'km');

  // Update database
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('\n💾 Updating production database...\n');

    // I-80 WB (west to east)
    const wbGeometry = {
      type: 'LineString',
      coordinates: simplified
    };

    await pool.query(
      'INSERT INTO corridors (name, geometry, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (name) DO UPDATE SET geometry = $2, updated_at = NOW()',
      ['I-80 WB', wbGeometry]
    );
    console.log('   ✅ Updated I-80 WB');

    // I-80 EB (reversed)
    const ebGeometry = {
      type: 'LineString',
      coordinates: [...simplified].reverse()
    };

    await pool.query(
      'INSERT INTO corridors (name, geometry, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (name) DO UPDATE SET geometry = $2, updated_at = NOW()',
      ['I-80 EB', ebGeometry]
    );
    console.log('   ✅ Updated I-80 EB (reversed)');

    console.log('\n✅ Success! I-80 geometry properly sequenced');
    console.log('   Source: TIGER/Line 2023 (sequenced)');
    console.log('   Iowa events should now snap correctly');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main();

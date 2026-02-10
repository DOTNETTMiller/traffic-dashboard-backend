/**
 * Import full-resolution I-80 from TIGER/Line 2023
 * Apply light simplification (tolerance 0.0002) to keep smooth curves
 * while maintaining high accuracy for snapping
 */

const { Pool } = require('pg');
const fs = require('fs');

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

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function main() {
  console.log('🛣️  Importing full-resolution I-80 from TIGER/Line 2023\n');

  const geojson = JSON.parse(fs.readFileSync('/tmp/i80_full.geojson', 'utf8'));

  console.log('📊 Input Data:');
  console.log('   Features:', geojson.features.length);

  // Combine all segments into one array
  const allCoords = [];
  for (const feature of geojson.features) {
    if (feature.geometry.type === 'LineString') {
      allCoords.push(...feature.geometry.coordinates);
    } else if (feature.geometry.type === 'MultiLineString') {
      for (const line of feature.geometry.coordinates) {
        allCoords.push(...line);
      }
    }
  }

  console.log('   Total points (raw):', allCoords.length);

  // Sort west to east (I-80 generally runs east-west)
  allCoords.sort((a, b) => a[0] - b[0]);

  // Apply light simplification (tolerance 0.0002 = ~22 meters)
  // This removes tiny jags while keeping smooth curves
  console.log('\n🔄 Applying light simplification (tolerance 0.0002)...');
  const simplified = simplifyLineString(allCoords, 0.0002);

  console.log('   Simplified points:', simplified.length);
  console.log('   Reduction:', ((1 - simplified.length / allCoords.length) * 100).toFixed(1) + '%');

  // Calculate total length
  let totalLength = 0;
  for (let i = 0; i < simplified.length - 1; i++) {
    const [lon1, lat1] = simplified[i];
    const [lon2, lat2] = simplified[i + 1];
    totalLength += haversineDistance(lat1, lon1, lat2, lon2);
  }

  console.log('   Total length:', totalLength.toFixed(2), 'km (', (totalLength * 0.621371).toFixed(2), 'mi)');

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
      'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
      [wbGeometry, 'I-80 WB']
    );
    console.log('   ✅ Updated I-80 WB');

    // I-80 EB (reversed)
    const ebGeometry = {
      type: 'LineString',
      coordinates: [...simplified].reverse()
    };

    await pool.query(
      'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
      [ebGeometry, 'I-80 EB']
    );
    console.log('   ✅ Updated I-80 EB (reversed)');

    console.log('\n✅ Success! I-80 geometry updated with full resolution');
    console.log('   Source: US Census Bureau TIGER/Line 2023');
    console.log('   Lines will be smooth with excellent snapping coverage');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main();

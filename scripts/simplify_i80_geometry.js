/**
 * Simplify I-80 geometry using Douglas-Peucker algorithm
 * Reduces 7,456 points to ~500 points while maintaining visual accuracy
 */

const { Pool } = require('pg');

// Douglas-Peucker line simplification
function simplifyLineString(points, tolerance) {
  if (points.length <= 2) return points;

  // Find the point with maximum distance from line segment
  let maxDistance = 0;
  let maxIndex = 0;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], firstPoint, lastPoint);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const leftPart = simplifyLineString(points.slice(0, maxIndex + 1), tolerance);
    const rightPart = simplifyLineString(points.slice(maxIndex), tolerance);

    // Combine, removing duplicate point at junction
    return leftPart.slice(0, -1).concat(rightPart);
  } else {
    // All points between first and last can be removed
    return [firstPoint, lastPoint];
  }
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const dx = x2 - x1;
  const dy = y2 - y1;

  // Normalize
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) {
    return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
  }

  const u = ((x - x1) * dx + (y - y1) * dy) / (mag * mag);

  let closestX, closestY;
  if (u < 0) {
    closestX = x1;
    closestY = y1;
  } else if (u > 1) {
    closestX = x2;
    closestY = y2;
  } else {
    closestX = x1 + u * dx;
    closestY = y1 + u * dy;
  }

  return Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
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
  console.log('🔧 Simplifying I-80 Iowa Geometry\n');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Get current geometry
  const result = await pool.query(
    'SELECT geometry FROM corridors WHERE name = $1',
    ['I-80 WB']
  );

  if (result.rows.length === 0) {
    console.error('❌ I-80 WB not found in database');
    await pool.end();
    return;
  }

  const geometry = result.rows[0].geometry;
  const originalPoints = geometry.coordinates;
  console.log('📊 Original geometry:', originalPoints.length, 'points');

  // Calculate original path length
  let originalLength = 0;
  for (let i = 0; i < originalPoints.length - 1; i++) {
    const [lon1, lat1] = originalPoints[i];
    const [lon2, lat2] = originalPoints[i + 1];
    originalLength += haversineDistance(lat1, lon1, lat2, lon2);
  }
  console.log('   Total length:', originalLength.toFixed(2), 'km');

  // Simplify with tolerance of 0.0001 degrees (~11 meters at this latitude)
  console.log('\n🔄 Applying Douglas-Peucker simplification...');
  const tolerance = 0.0001; // ~11 meters
  const simplifiedPoints = simplifyLineString(originalPoints, tolerance);

  console.log('\n📊 Simplified geometry:', simplifiedPoints.length, 'points');
  console.log('   Reduction:', ((1 - simplifiedPoints.length / originalPoints.length) * 100).toFixed(1) + '%');

  // Calculate simplified path length
  let simplifiedLength = 0;
  for (let i = 0; i < simplifiedPoints.length - 1; i++) {
    const [lon1, lat1] = simplifiedPoints[i];
    const [lon2, lat2] = simplifiedPoints[i + 1];
    simplifiedLength += haversineDistance(lat1, lon1, lat2, lon2);
  }
  console.log('   Total length:', simplifiedLength.toFixed(2), 'km');
  console.log('   Length error:', ((Math.abs(simplifiedLength - originalLength) / originalLength) * 100).toFixed(3) + '%');

  // Update database
  console.log('\n💾 Updating database...');

  const wbGeometry = {
    type: 'LineString',
    coordinates: simplifiedPoints
  };

  await pool.query(
    'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
    [wbGeometry, 'I-80 WB']
  );
  console.log('   ✅ Updated I-80 WB');

  // Also update EB (reversed)
  const ebGeometry = {
    type: 'LineString',
    coordinates: [...simplifiedPoints].reverse()
  };

  await pool.query(
    'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
    [ebGeometry, 'I-80 EB']
  );
  console.log('   ✅ Updated I-80 EB');

  console.log('\n✅ Success! I-80 geometry simplified');
  console.log('   Lines should now render smoothly on the map');
  console.log('   Data size reduced by', ((1 - simplifiedPoints.length / originalPoints.length) * 100).toFixed(1) + '%');

  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

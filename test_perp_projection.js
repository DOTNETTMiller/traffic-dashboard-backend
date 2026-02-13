const { Pool } = require('pg');

// Haversine distance
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Perpendicular projection
function projectPointOntoSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dpx = px - x1;
  const dpy = py - y1;
  const segmentLengthSq = dx * dx + dy * dy;

  if (segmentLengthSq === 0) {
    return { lng: x1, lat: y1, t: 0 };
  }

  const t = Math.max(0, Math.min(1, (dpx * dx + dpy * dy) / segmentLengthSq));

  return {
    lng: x1 + t * dx,
    lat: y1 + t * dy,
    t: t
  };
}

function projectPointOntoLine(px, py, lineCoords) {
  let minDist = Infinity;
  let bestProjection = null;

  for (let i = 0; i < lineCoords.length - 1; i++) {
    const [x1, y1] = lineCoords[i];
    const [x2, y2] = lineCoords[i + 1];

    const projected = projectPointOntoSegment(px, py, x1, y1, x2, y2);
    const dist = haversineDistance(py, px, projected.lat, projected.lng);

    if (dist < minDist) {
      minDist = dist;
      bestProjection = {
        segmentIndex: i,
        t: projected.t,
        point: [projected.lng, projected.lat],
        distance: dist
      };
    }
  }

  return bestProjection;
}

async function test() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Real Iowa I-80 event coordinates
  const lat1 = 41.591408, lng1 = -93.809752;
  const lat2 = 41.578484, lng2 = -93.835371;

  console.log('Testing perpendicular projection with Iowa I-80 WB event:');
  console.log('Start:', lat1, lng1);
  console.log('End:', lat2, lng2);
  console.log('');

  const result = await pool.query("SELECT geometry FROM corridors WHERE name = 'I-80 WB'");
  const geometry = result.rows[0].geometry.coordinates;

  console.log('Geometry points:', geometry.length);
  console.log('');

  // Project start and end
  const startProj = projectPointOntoLine(lng1, lat1, geometry);
  const endProj = projectPointOntoLine(lng2, lat2, geometry);

  console.log('Start projection:');
  console.log('  Segment:', startProj.segmentIndex, ', t =', startProj.t.toFixed(3));
  console.log('  Distance:', (startProj.distance * 1000).toFixed(0), 'm');
  console.log('');

  console.log('End projection:');
  console.log('  Segment:', endProj.segmentIndex, ', t =', endProj.t.toFixed(3));
  console.log('  Distance:', (endProj.distance * 1000).toFixed(0), 'm');
  console.log('');

  // Build segment
  const startIdx = startProj.segmentIndex;
  const endIdx = endProj.segmentIndex;

  let segment;
  if (startIdx === endIdx) {
    segment = [startProj.point, endProj.point];
  } else if (startIdx < endIdx) {
    segment = [
      startProj.point,
      ...geometry.slice(startIdx + 1, endIdx + 1),
      endProj.point
    ];
  } else {
    segment = [
      endProj.point,
      ...geometry.slice(endIdx + 1, startIdx + 1),
      startProj.point
    ];
  }

  console.log('Segment built:', segment.length, 'points');
  console.log('Indices:', Math.min(startIdx, endIdx), 'to', Math.max(startIdx, endIdx));
  console.log('');

  // Calculate path length
  let pathLength = 0;
  for (let i = 0; i < segment.length - 1; i++) {
    const [lon1, lat1] = segment[i];
    const [lon2, lat2] = segment[i + 1];
    pathLength += haversineDistance(lat1, lon1, lat2, lon2);
  }

  const eventDist = haversineDistance(lat1, lng1, lat2, lng2);

  console.log('Event distance:', eventDist.toFixed(2), 'km');
  console.log('Path length:', pathLength.toFixed(2), 'km');
  console.log('Ratio:', (pathLength / eventDist).toFixed(2) + 'x');
  console.log('');

  // Validate
  const maxDist = 5;
  const pass1 = startProj.distance <= maxDist && endProj.distance <= maxDist;
  console.log('Validation 1 (distance <= 5km):', pass1 ? '✅ PASS' : '❌ FAIL');

  const maxRatio = eventDist < 10 ? 1.3 : 1.5;
  const pass3 = pathLength <= eventDist * maxRatio;
  console.log('Validation 3 (path <= ' + maxRatio + 'x):', pass3 ? '✅ PASS' : '❌ FAIL');

  if (pass1 && pass3) {
    console.log('');
    console.log('✅ EVENT WOULD GET CURVED GEOMETRY FROM DATABASE');
  } else {
    console.log('');
    console.log('⚠️  EVENT WOULD FALL BACK TO OSRM');
  }

  await pool.end();
}

test().catch(console.error);

/**
 * Find the absolute closest point on I-80 WB to the failing event
 */
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: DATABASE_URL });

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

async function main() {
  // Failing event coordinates
  const eventLat = 41.492909;
  const eventLng = -94.318504;

  console.log(`🔍 Finding closest I-80 WB point to event at ${eventLat}, ${eventLng}\n`);

  const result = await pool.query(`SELECT geometry FROM corridors WHERE name = 'I-80 WB'`);
  const coords = result.rows[0].geometry.coordinates;

  console.log(`Searching through ${coords.length} points...\n`);

  let minDist = Infinity;
  let minIdx = -1;
  let closestPoint = null;

  // Also track all points within 10km
  const nearby = [];

  for (let i = 0; i < coords.length; i++) {
    const [lon, lat] = coords[i];
    const dist = haversineDistance(eventLat, eventLng, lat, lon);

    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
      closestPoint = [lon, lat];
    }

    if (dist < 10) {
      nearby.push({ index: i, coord: [lon, lat], distance: dist });
    }
  }

  console.log(`✅ Closest point found:`);
  console.log(`   Index: ${minIdx}`);
  console.log(`   Coordinates: [${closestPoint[0]}, ${closestPoint[1]}]`);
  console.log(`   Distance: ${minDist.toFixed(2)} km`);
  console.log();

  if (minDist > 5) {
    console.log(`❌ Distance ${minDist.toFixed(2)}km exceeds 5km threshold`);
    console.log(`   Would need threshold of at least ${Math.ceil(minDist)}km`);
  } else {
    console.log(`✅ Distance within 5km threshold`);
  }

  console.log(`\n📍 All points within 10km (${nearby.length} found):`);
  nearby.sort((a, b) => a.distance - b.distance);
  nearby.slice(0, 10).forEach(p => {
    console.log(`   Index ${p.index}: [${p.coord[0].toFixed(6)}, ${p.coord[1].toFixed(6)}] - ${p.distance.toFixed(2)}km`);
  });

  await pool.end();
}

main().catch(console.error);

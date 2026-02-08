/**
 * Check how far ALL Iowa I-80 events are from the actual highway geometry
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway";

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
  console.log('📊 Analyzing Iowa I-80 Event Coordinate Quality\n');

  // Fetch Iowa events
  const eventsResponse = await fetch('https://corridor-communication-dashboard-production.up.railway.app/api/events?state=Iowa');
  const eventsData = await eventsResponse.json();

  const i80Events = eventsData.events.filter(e => e.corridor === 'I-80');

  console.log(`Found ${i80Events.length} I-80 events\n`);

  // Get I-80 geometry
  const pool = new Pool({ connectionString: DATABASE_URL });
  const wbResult = await pool.query('SELECT geometry FROM corridors WHERE name = $1', ['I-80 WB']);
  const ebResult = await pool.query('SELECT geometry FROM corridors WHERE name = $1', ['I-80 EB']);

  const wbGeometry = wbResult.rows[0].geometry.coordinates;
  const ebGeometry = ebResult.rows[0].geometry.coordinates;

  console.log(`I-80 WB: ${wbGeometry.length} points`);
  console.log(`I-80 EB: ${ebGeometry.length} points\n`);

  const results = [];

  for (const event of i80Events) {
    if (!event.geometry || !event.geometry.coordinates) continue;
    const coords = event.geometry.coordinates;
    const startLat = coords[0][1];
    const startLng = coords[0][0];
    const endLat = coords[coords.length - 1][1];
    const endLng = coords[coords.length - 1][0];

    // Choose geometry based on direction
    const geometry = event.direction.includes('West') || event.direction.includes('WB')
      ? wbGeometry
      : ebGeometry;

    // Find closest points
    let minStartDist = Infinity;
    let minEndDist = Infinity;

    for (let i = 0; i < geometry.length; i++) {
      const [lon, lat] = geometry[i];

      const startDist = haversineDistance(startLat, startLng, lat, lon);
      if (startDist < minStartDist) {
        minStartDist = startDist;
      }

      const endDist = haversineDistance(endLat, endLng, lat, lon);
      if (endDist < minEndDist) {
        minEndDist = endDist;
      }
    }

    results.push({
      id: event.id,
      type: event.eventType,
      direction: event.direction,
      startDist: minStartDist,
      endDist: minEndDist,
      maxDist: Math.max(minStartDist, minEndDist)
    });
  }

  await pool.end();

  // Sort by max distance
  results.sort((a, b) => a.maxDist - b.maxDist);

  console.log('📍 Distance from Highway (sorted by worst endpoint):\n');

  results.forEach((r, i) => {
    const startMeters = (r.startDist * 1000).toFixed(0);
    const endMeters = (r.endDist * 1000).toFixed(0);
    const status = r.maxDist < 0.5 ? '✅' : r.maxDist < 2 ? '⚠️ ' : '❌';

    console.log(`${status} ${r.type.padEnd(12)} Start: ${startMeters.padStart(5)}m  End: ${endMeters.padStart(5)}m  (${r.direction})`);
  });

  // Statistics
  const within500m = results.filter(r => r.maxDist < 0.5).length;
  const within2km = results.filter(r => r.maxDist < 2).length;
  const within5km = results.filter(r => r.maxDist < 5).length;

  console.log('\n📊 Statistics:');
  console.log(`   Within 500m: ${within500m}/${results.length} (${(within500m / results.length * 100).toFixed(1)}%)`);
  console.log(`   Within 2km:  ${within2km}/${results.length} (${(within2km / results.length * 100).toFixed(1)}%)`);
  console.log(`   Within 5km:  ${within5km}/${results.length} (${(within5km / results.length * 100).toFixed(1)}%)`);

  console.log('\n💡 Recommendation:');
  if (within500m > results.length * 0.8) {
    console.log('   Most events are within 500m - use strict threshold');
  } else if (within2km > results.length * 0.7) {
    console.log('   Most events are within 2km - use moderate threshold');
  } else {
    console.log('   Events are spread out - coordinates may have quality issues');
  }
}

main();

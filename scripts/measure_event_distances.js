const https = require('https');
const { Pool } = require('pg');

// Connect to production database
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Haversine distance in kilometers
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Find minimum distance from a point to a polyline
function minDistanceToPolyline(pointLon, pointLat, polylineCoords) {
  let minDist = Infinity;

  for (const coord of polylineCoords) {
    const [lon, lat] = coord;
    const dist = haversineDistance(pointLat, pointLon, lat, lon);
    if (dist < minDist) minDist = dist;
  }

  return minDist;
}

async function analyzeDistances() {
  try {
    // Get I-80 WB corridor geometry from database
    console.log('Fetching I-80 WB corridor geometry from database...');
    const corridorResult = await pgPool.query(
      'SELECT geometry FROM corridors WHERE name = $1',
      ['I-80 WB']
    );

    if (corridorResult.rows.length === 0) {
      console.log('❌ I-80 WB corridor not found in database');
      process.exit(1);
    }

    const corridorGeometry = corridorResult.rows[0].geometry;
    const corridorCoords = corridorGeometry.coordinates;
    console.log(`✅ Loaded I-80 WB with ${corridorCoords.length} coordinates\n`);

    // Fetch events from production API
    console.log('Fetching Iowa events from production API...');
    https.get('https://corridor-communication-dashboard-production.up.railway.app/api/events?state=Iowa', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        const json = JSON.parse(data);
        const i80Events = json.events.filter(e => e.corridor === 'I-80');

        // Filter to straight-line events only
        const straightEvents = i80Events.filter(e =>
          e.geometry?.coordinates && e.geometry.coordinates.length === 2
        );

        console.log(`Found ${straightEvents.length} straight-line I-80 events\n`);
        console.log('========================================');
        console.log('Distance Analysis for Straight-Line Events');
        console.log('========================================\n');

        const distanceRanges = {
          '0-2km': [],
          '2-3km': [],
          '3-4km': [],
          '4-5km': [],
          '5-10km': [],
          '>10km': []
        };

        straightEvents.forEach(event => {
          const coords = event.geometry.coordinates;
          const [startLon, startLat] = coords[0];
          const [endLon, endLat] = coords[coords.length - 1];

          // Calculate minimum distance from start and end points to corridor
          const startDist = minDistanceToPolyline(startLon, startLat, corridorCoords);
          const endDist = minDistanceToPolyline(endLon, endLat, corridorCoords);
          const maxDist = Math.max(startDist, endDist);

          // Categorize by distance range
          let range;
          if (maxDist <= 2) range = '0-2km';
          else if (maxDist <= 3) range = '2-3km';
          else if (maxDist <= 4) range = '3-4km';
          else if (maxDist <= 5) range = '4-5km';
          else if (maxDist <= 10) range = '5-10km';
          else range = '>10km';

          distanceRanges[range].push({
            headline: event.headline || 'N/A',
            startDist: startDist.toFixed(2),
            endDist: endDist.toFixed(2),
            maxDist: maxDist.toFixed(2)
          });
        });

        // Print summary
        const total = straightEvents.length;
        let wouldImprove = 0;

        console.log('Distance Range Summary:\n');

        Object.keys(distanceRanges).forEach(range => {
          const events = distanceRanges[range];
          const count = events.length;
          const pct = ((count / total) * 100).toFixed(1);

          // Events in 2-5km range will improve with new tolerance
          const improving = ['2-3km', '3-4km', '4-5km'].includes(range);
          if (improving) wouldImprove += count;

          const marker = improving ? '✅' : range === '0-2km' ? '✔️' : '❌';
          console.log(`${marker} ${range.padEnd(8)}: ${count.toString().padStart(2)} events (${pct.padStart(5)}%)`);

          // Show sample events for ranges that will improve
          if (improving && count > 0) {
            events.slice(0, 2).forEach(e => {
              console.log(`     - ${e.headline.substring(0, 60)}... (start: ${e.startDist}km, end: ${e.endDist}km)`);
            });
            if (count > 2) console.log(`     ... and ${count - 2} more`);
          }
        });

        console.log('\n========================================');
        console.log('Improvement Prediction');
        console.log('========================================\n');

        const currentWorking = distanceRanges['0-2km'].length;
        const afterFix = currentWorking + wouldImprove;
        const currentPct = ((currentWorking / total) * 100).toFixed(1);
        const afterPct = ((afterFix / total) * 100).toFixed(1);
        const improvementMultiplier = (afterFix / currentWorking).toFixed(1);

        console.log(`Current (2km tolerance):  ${currentWorking}/${total} events (${currentPct}%)`);
        console.log(`After fix (5km tolerance): ${afterFix}/${total} events (${afterPct}%)`);
        console.log(`\nImprovement: +${wouldImprove} events (${improvementMultiplier}x increase)\n`);

        // Check for outliers
        const outliers = distanceRanges['>10km'];
        if (outliers.length > 0) {
          console.log('⚠️  Warning: Events >10km from corridor may have geocoding issues:\n');
          outliers.forEach(e => {
            console.log(`   - ${e.headline.substring(0, 70)}`);
            console.log(`     Start: ${e.startDist}km, End: ${e.endDist}km from I-80 WB\n`);
          });
        }

        await pgPool.end();
      });
    }).on('error', (err) => {
      console.error('❌ Error fetching events:', err);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    await pgPool.end();
    process.exit(1);
  }
}

analyzeDistances();

const https = require('https');

// Fetch production events and show why they're not snapping
https.get('https://corridor-communication-dashboard-production.up.railway.app/api/events?state=Iowa', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const i80Events = json.events.filter(e => e.corridor === 'I-80');
    const straightEvents = i80Events.filter(e =>
      e.geometry?.coordinates && e.geometry.coordinates.length === 2
    );

    console.log('========================================');
    console.log('Debug: Why Events Aren\'t Snapping');
    console.log('========================================\n');
    console.log(`Total I-80 events: ${i80Events.length}`);
    console.log(`Straight-line events: ${straightEvents.length}\n`);

    // Group by direction
    const byDirection = {};
    straightEvents.forEach(e => {
      const dir = e.direction || 'Unknown';
      byDirection[dir] = (byDirection[dir] || 0) + 1;
    });

    console.log('Straight events by direction:');
    Object.entries(byDirection).forEach(([dir, count]) => {
      console.log(`  ${dir}: ${count}`);
    });
    console.log('');

    // Check geometry source
    const bySour = {};
    straightEvents.forEach(e => {
      const source = e.geometry?.geometrySource || 'unknown';
      bySour[source] = (bySour[source] || 0) + 1;
    });

    console.log('Geometry sources for straight events:');
    Object.entries(bySour).forEach(([source, count]) => {
      console.log(`  ${source}: ${count}`);
    });
    console.log('');

    // Show sample events
    console.log('Sample straight-line events:');
    straightEvents.slice(0, 5).forEach((e, i) => {
      console.log(`\nEvent ${i + 1}:`);
      console.log(`  Headline: ${e.headline || 'N/A'}`);
      console.log(`  Corridor: ${e.corridor}`);
      console.log(`  Direction: ${e.direction}`);
      console.log(`  Geometry Source: ${e.geometry?.geometrySource || 'N/A'}`);
      console.log(`  Start Coords: [${e.geometry.coordinates[0]}]`);
      console.log(`  End Coords: [${e.geometry.coordinates[1]}]`);
    });

    // Now check curved events
    const curvedEvents = i80Events.filter(e =>
      e.geometry?.coordinates && e.geometry.coordinates.length > 2
    );

    console.log('\n========================================');
    console.log(`Curved events (${curvedEvents.length}) by direction:`);
    const curvedByDir = {};
    curvedEvents.forEach(e => {
      const dir = e.direction || 'Unknown';
      curvedByDir[dir] = (curvedByDir[dir] || 0) + 1;
    });
    Object.entries(curvedByDir).forEach(([dir, count]) => {
      console.log(`  ${dir}: ${count}`);
    });

    if (curvedEvents.length > 0) {
      console.log('\nSample curved event:');
      const sample = curvedEvents[0];
      console.log(`  Headline: ${sample.headline || 'N/A'}`);
      console.log(`  Corridor: ${sample.corridor}`);
      console.log(`  Direction: ${sample.direction}`);
      console.log(`  Geometry Source: ${sample.geometry?.geometrySource || 'N/A'}`);
      console.log(`  Coordinates: ${sample.geometry.coordinates.length}`);
    }
  });
}).on('error', (err) => {
  console.error('Error:', err);
});

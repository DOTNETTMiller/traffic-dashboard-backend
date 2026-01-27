const https = require('https');

const url = process.argv[2] || 'http://localhost:3001/api/events';
const protocol = url.startsWith('https') ? https : require('http');

protocol.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const response = JSON.parse(data);
    const events = response.events || response;
    if (!events || events.length === 0) {
      console.log('No events returned from API');
      return;
    }

    const iowa = events.filter(e => e.state === 'Iowa');
    console.log(`Total events: ${events.length}`);
    console.log(`Iowa events: ${iowa.length}`);

    if (iowa.length > 0) {
      const withGeometry = iowa.filter(e => e.geometry && e.geometry.type === 'LineString');
      console.log(`Iowa events with LineString geometry: ${withGeometry.length}`);

      console.log('\nFirst 3 Iowa events:\n');
      iowa.slice(0, 3).forEach(e => {
        console.log('ID:', e.id);
        console.log('State:', e.state);
        console.log('Corridor:', e.corridor);
        console.log('Has Geometry:', e.geometry != null);
        if (e.geometry) {
          console.log('Geometry Type:', e.geometry.type);
          console.log('Geometry Source:', e.geometry.source);
          console.log('Coord Count:', e.geometry.coordinates ? e.geometry.coordinates.length : 0);
          if (e.geometry.coordinates && e.geometry.coordinates.length > 0) {
            console.log('First coord:', e.geometry.coordinates[0]);
            console.log('Last coord:', e.geometry.coordinates[e.geometry.coordinates.length - 1]);
          }
        }
        console.log('---');
      });
    }
  });
}).on('error', err => {
  console.error('Error:', err.message);
});

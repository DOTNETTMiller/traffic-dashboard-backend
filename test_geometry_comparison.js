const https = require('https');

https.get('https://corridor-communication-dashboard-production.up.railway.app/api/events', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const response = JSON.parse(data);
    const events = response.events || response;

    // Check Nevada (should have geometry)
    const nevada = events.filter(e => e.state === 'Nevada').slice(0, 2);
    console.log('=== NEVADA (should have polylines) ===');
    nevada.forEach(e => {
      console.log('ID:', e.id);
      console.log('Has geometry:', e.geometry != null);
      if (e.geometry) {
        console.log('Geometry type:', e.geometry.type);
        console.log('Coords:', e.geometry.coordinates ? e.geometry.coordinates.length : 0);
        console.log('Source:', e.geometry.source);
      }
      console.log('---');
    });

    // Check Iowa (should have geometry after deployment)
    const iowa = events.filter(e => e.state === 'Iowa').slice(0, 2);
    console.log('\n=== IOWA (FEU-G, should have polylines after deployment) ===');
    iowa.forEach(e => {
      console.log('ID:', e.id);
      console.log('Has geometry:', e.geometry != null);
      if (e.geometry) {
        console.log('Geometry type:', e.geometry.type);
        console.log('Coords:', e.geometry.coordinates ? e.geometry.coordinates.length : 0);
        console.log('Source:', e.geometry.source);
      }
      console.log('---');
    });

    // Summary
    const totalWithGeometry = events.filter(e => e.geometry && e.geometry.type === 'LineString').length;
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total events: ${events.length}`);
    console.log(`Events with LineString geometry: ${totalWithGeometry}`);
    console.log(`Iowa events: ${events.filter(e => e.state === 'Iowa').length}`);
    console.log(`Iowa with geometry: ${events.filter(e => e.state === 'Iowa' && e.geometry && e.geometry.type === 'LineString').length}`);
  });
}).on('error', err => {
  console.error('Error:', err.message);
});

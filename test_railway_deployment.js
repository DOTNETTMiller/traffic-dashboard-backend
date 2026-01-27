const axios = require('axios');

(async () => {
  try {
    // Test the production URL to check if new code is deployed
    const response = await axios.get('https://corridor-communication-dashboard-production.up.railway.app/api/events', { timeout: 30000 });
    const events = response.data.events || response.data;
    const iowa = events.filter(e => e.state === 'Iowa' && e.corridor === 'I-80' && e.geometry);

    console.log('Total Iowa I-80 events with geometry:', iowa.length);

    if (iowa.length > 0) {
      const event = iowa[0];
      console.log('\nFirst I-80 event with geometry:');
      console.log('ID:', event.id);
      console.log('Geometry coords:', event.geometry.coordinates ? event.geometry.coordinates.length : 0);
      console.log('Geometry source:', event.geometry.source);

      if (event.geometry.coordinates && event.geometry.coordinates.length > 10) {
        console.log('✅ SUCCESS! Polylines are road-snapped!');
      } else {
        console.log('❌ FAIL! Still showing straight lines (only 2 coords)');
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
})();

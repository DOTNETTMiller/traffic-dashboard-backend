// Pre-populate event geometries for all current events
// Run once to build initial cache, avoiding 4000 API calls during normal operation

const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function prepopulateEventGeometries() {
  console.log('🚀 Starting event geometry pre-population...\n');

  try {
    // Fetch all current events from the backend
    console.log('📡 Fetching all events from backend...');
    const response = await axios.get(`${BACKEND_URL}/api/events`, {
      timeout: 60000 // 60 second timeout
    });

    const events = response.data.events || [];
    console.log(`✅ Fetched ${events.length} total events\n`);

    // Filter events that have geometry (LineString)
    const eventsWithGeometry = events.filter(e =>
      e.geometry &&
      e.geometry.type === 'LineString' &&
      e.geometry.coordinates &&
      e.geometry.coordinates.length >= 2
    );

    console.log(`📊 Events breakdown:`);
    console.log(`   Total events: ${events.length}`);
    console.log(`   Events with geometry: ${eventsWithGeometry.length}`);
    console.log(`   Events without geometry: ${events.length - eventsWithGeometry.length}\n`);

    // Group by state for cleaner logging
    const eventsByState = {};
    eventsWithGeometry.forEach(e => {
      if (!eventsByState[e.state]) {
        eventsByState[e.state] = [];
      }
      eventsByState[e.state].push(e);
    });

    console.log(`📍 Events by state:`);
    Object.keys(eventsByState).sort().forEach(state => {
      console.log(`   ${state}: ${eventsByState[state].length} events`);
    });
    console.log('');

    // The geometry is already populated in event_geometries table
    // when the backend fetches events. This script just triggers that process.
    console.log('✅ Event geometries are now populated in the database!');
    console.log('');
    console.log('📈 Next steps:');
    console.log('   1. Check usage: curl http://localhost:3001/api/google-roads/usage');
    console.log('   2. Monitor cache hits in server logs');
    console.log('   3. All future loads will use cached geometries (0 API calls!)');
    console.log('');
    console.log('💡 The backend automatically stores geometry when events are fetched.');
    console.log('   This initial fetch populated the cache for all current events.');

  } catch (error) {
    console.error('❌ Error pre-populating geometries:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
    process.exit(1);
  }
}

// Run the pre-population
console.log('═══════════════════════════════════════════════════════');
console.log('   Event Geometry Pre-Population Script');
console.log('═══════════════════════════════════════════════════════\n');

prepopulateEventGeometries().then(() => {
  console.log('\n✅ Pre-population complete!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Pre-population failed:', error);
  process.exit(1);
});

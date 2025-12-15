// Fetch Ohio traffic events from OHGO Public API
// Fetches construction work zones and real-time incidents

const https = require('https');

const API_KEY = process.env.OHIO_API_KEY || 'b2ae1d02-2c34-4877-a7e6-9d917ad3c128';

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    };

    const request = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Failed to parse JSON from ${url}: ${error.message}`));
        }
      });
    });

    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error(`Request timeout for ${url}`));
    });
    request.end();
  });
}

// Map Ohio construction to WZDx-compatible event
function mapConstructionToEvent(item) {
  const workZone = item.workZones && item.workZones[0];
  const polyline = workZone?.polyline || [];

  // Use first point for coordinates
  const coords = polyline.length > 0
    ? polyline[0]
    : [item.longitude, item.latitude];
  const longitude = Array.isArray(coords) ? parseFloat(coords[0]) : parseFloat(item.longitude);
  const latitude = Array.isArray(coords) ? parseFloat(coords[1]) : parseFloat(item.latitude);

  return {
    id: `ohio-construction-${item.id}`,
    type: 'work-zone',
    source: 'Ohio OHGO API',
    headline: item.description || `Work Zone on ${item.routeName}`,
    description: item.description,
    severity: item.status === 'Closed' ? 'Major' : 'Minor',
    category: item.category || 'Road Work',
    state: 'OH',
    corridor: extractCorridor(item.routeName),
    location: item.location,
    direction: item.direction,
    roadStatus: item.status, // Open, Restricted, Closed
    coordinates: Array.isArray(coords) ? coords : [longitude, latitude],
    latitude,
    longitude,
    geometry: polyline.length > 1 ? {
      type: 'LineString',
      coordinates: polyline
    } : null,
    startDate: item.startDate,
    endDate: item.endDate,
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };
}

// Map Ohio incident to WZDx-compatible event
function mapIncidentToEvent(item) {
  // Determine severity from category and road status
  let severity = 'Minor';
  if (item.roadStatus === 'Closed') severity = 'Major';
  else if (item.roadStatus === 'Restricted') severity = 'Moderate';
  else if (item.category === 'Crash') severity = 'Moderate';

  const longitude = parseFloat(item.longitude);
  const latitude = parseFloat(item.latitude);

  return {
    id: `ohio-incident-${item.id}`,
    type: item.category === 'Crash' ? 'incident' : 'restriction',
    source: 'Ohio OHGO API',
    headline: `${item.category} on ${item.routeName}`,
    description: item.description,
    severity: severity,
    category: item.category,
    state: 'OH',
    corridor: extractCorridor(item.routeName),
    location: item.location,
    direction: item.direction,
    roadStatus: item.roadStatus, // Open, Restricted, Closed
    coordinates: [longitude, latitude],
    latitude,
    longitude,
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };
}

// Extract corridor from route name (e.g., "I-75" from "I-75 East")
function extractCorridor(routeName) {
  if (!routeName) return null;
  const match = routeName.match(/I-\d+|US-\d+|SR-\d+/);
  return match ? match[0] : routeName;
}

async function fetchOhioEvents() {
  console.log('🚦 Fetching Ohio traffic events...\n');

  const events = [];

  try {
    // Fetch construction work zones
    console.log('📍 Fetching construction work zones...');
    const constructionData = await fetchJSON('https://publicapi.ohgo.com/api/v1/construction');

    if (constructionData.results && Array.isArray(constructionData.results)) {
      console.log(`  ✅ Retrieved ${constructionData.results.length} work zones`);

      // Filter to active/open zones
      const activeZones = constructionData.results.filter(item => {
        const endDate = new Date(item.endDate);
        return endDate > new Date(); // Still active
      });

      console.log(`  ✅ ${activeZones.length} are currently active`);

      activeZones.forEach(item => {
        events.push(mapConstructionToEvent(item));
      });
    }

    // Fetch real-time incidents
    console.log('\n🚨 Fetching real-time incidents...');
    const incidentData = await fetchJSON('https://publicapi.ohgo.com/api/v1/incidents');

    if (incidentData.results && Array.isArray(incidentData.results)) {
      console.log(`  ✅ Retrieved ${incidentData.results.length} incidents`);

      incidentData.results.forEach(item => {
        events.push(mapIncidentToEvent(item));
      });
    }

    console.log(`\n📊 Total Ohio Events: ${events.length}`);
    console.log(`  Work Zones: ${events.filter(e => e.type === 'work-zone').length}`);
    console.log(`  Incidents: ${events.filter(e => e.type === 'incident').length}`);
    console.log(`  Restrictions: ${events.filter(e => e.type === 'restriction').length}`);

    // Show severity breakdown
    const severityCounts = {
      Major: events.filter(e => e.severity === 'Major').length,
      Moderate: events.filter(e => e.severity === 'Moderate').length,
      Minor: events.filter(e => e.severity === 'Minor').length
    };
    console.log(`\n📈 Severity Breakdown:`);
    console.log(`  Major: ${severityCounts.Major}`);
    console.log(`  Moderate: ${severityCounts.Moderate}`);
    console.log(`  Minor: ${severityCounts.Minor}`);

    return events;

  } catch (error) {
    console.error('❌ Error fetching Ohio events:', error.message);
    return [];
  }
}

// Export for use in backend
module.exports = { fetchOhioEvents };

// Run standalone if called directly
if (require.main === module) {
  fetchOhioEvents().then(events => {
    console.log(`\n✅ Fetched ${events.length} Ohio events`);

    // Show sample events
    console.log('\n📋 Sample Events:');
    events.slice(0, 5).forEach(event => {
      console.log(`\n  ${event.headline}`);
      console.log(`    Type: ${event.type} | Severity: ${event.severity}`);
      console.log(`    Location: ${event.location}`);
      console.log(`    Status: ${event.roadStatus}`);
    });

    process.exit(0);
  }).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

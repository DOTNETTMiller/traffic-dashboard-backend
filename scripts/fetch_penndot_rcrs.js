// Fetch Pennsylvania traffic events from PennDOT RCRS (Road Condition Reporting System)
// API Documentation: https://www.pa.gov/agencies/penndot/programs-and-doing-business/online-services/developer-resources-documentation-api.html

const https = require('https');

// PennDOT RCRS API endpoints
const RCRS_ENDPOINTS = {
  liveEvents: 'https://eventsdata.dot.pa.gov/liveEvents',
  plannedEvents: 'https://eventsdata.dot.pa.gov/plannedEvents'
};

// Get credentials from environment variables
const PENNDOT_USERNAME = process.env.PENNDOT_USERNAME;
const PENNDOT_PASSWORD = process.env.PENNDOT_PASSWORD;

async function fetchJSON(url, username, password) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    // Create Basic Auth header
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    };

    const request = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 401) {
          reject(new Error('Authentication failed - check PENNDOT_USERNAME and PENNDOT_PASSWORD'));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Failed to parse JSON from ${url}: ${error.message}`));
        }
      });
    });

    request.on('error', reject);
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error(`Request timeout for ${url}`));
    });
    request.end();
  });
}

// Map PennDOT RCRS event to our normalized event format
function mapRCRSToEvent(item, isPlanned = false) {
  // Extract key fields from RCRS event
  // Note: Field names are based on typical RCRS structure - may need adjustment
  const eventId = item.EventID || item.eventId || item.id;
  const eventType = item.EventType || item.eventType || item.type;
  const description = item.Description || item.description || '';
  const route = item.Route || item.route || item.roadway || '';
  const location = item.Location || item.location || '';
  const county = item.County || item.county || '';
  const latitude = parseFloat(item.Latitude || item.latitude || 0);
  const longitude = parseFloat(item.Longitude || item.longitude || 0);
  const startTime = item.StartTime || item.startTime || item.start;
  const endTime = item.EndTime || item.endTime || item.end;
  const status = item.Status || item.status || '';
  const severity = item.Severity || item.severity || '';
  const lanesClosed = item.LanesClosed || item.lanesClosed || '';
  const direction = item.Direction || item.direction || '';

  // Determine event type based on RCRS event type
  let type = 'incident';
  const eventTypeLower = (eventType || '').toLowerCase();

  if (eventTypeLower.includes('construction') || eventTypeLower.includes('work')) {
    type = 'work-zone';
  } else if (eventTypeLower.includes('closure') || eventTypeLower.includes('restriction')) {
    type = 'restriction';
  } else if (eventTypeLower.includes('weather') || eventTypeLower.includes('condition')) {
    type = 'weather';
  }

  // Determine severity
  let normalizedSeverity = 'Minor';
  const severityLower = (severity || '').toLowerCase();
  const statusLower = (status || '').toLowerCase();

  if (severityLower.includes('major') || statusLower.includes('closed') ||
      eventTypeLower.includes('closure')) {
    normalizedSeverity = 'Major';
  } else if (severityLower.includes('moderate') || severityLower.includes('medium') ||
             lanesClosed) {
    normalizedSeverity = 'Moderate';
  }

  // Extract corridor from route (e.g., "I-80" from "I-80 EB")
  const corridor = extractCorridor(route);

  // Build headline
  const headline = description || `${eventType} on ${route} at ${location}`;

  // Determine road status
  let roadStatus = 'Open';
  if (statusLower.includes('closed') || eventTypeLower.includes('closure')) {
    roadStatus = 'Closed';
  } else if (lanesClosed || eventTypeLower.includes('restriction')) {
    roadStatus = 'Restricted';
  }

  return {
    id: `penndot-rcrs-${eventId}`,
    type: type,
    source: isPlanned ? 'PennDOT RCRS (Planned)' : 'PennDOT RCRS',
    headline: headline,
    description: description,
    severity: normalizedSeverity,
    category: eventType || 'Road Event',
    state: 'PA',
    county: county || null,
    corridor: corridor,
    location: location || `${route} at ${location}`,
    direction: extractDirection(direction || route),
    lanesClosed: lanesClosed || null,
    roadStatus: roadStatus,
    coordinates: longitude && latitude ? [longitude, latitude] : null,
    startDate: startTime ? new Date(startTime).toISOString() : null,
    endDate: endTime ? new Date(endTime).toISOString() : null,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    rawData: item // Keep original for debugging
  };
}

// Extract corridor from route name (e.g., "I-80" from "I-80 EB")
function extractCorridor(routeName) {
  if (!routeName) return null;

  // Match interstate, US route, or PA route
  const match = routeName.match(/I-\d+|US-\d+|PA-\d+/i);
  if (match) return match[0].toUpperCase();

  // Try to extract just the route number
  const numberMatch = routeName.match(/(\d+)/);
  if (numberMatch) {
    if (routeName.toLowerCase().includes('i-') || routeName.toLowerCase().includes('interstate')) {
      return `I-${numberMatch[1]}`;
    }
    if (routeName.toLowerCase().includes('us-') || routeName.toLowerCase().includes('us route')) {
      return `US-${numberMatch[1]}`;
    }
    if (routeName.toLowerCase().includes('pa-') || routeName.toLowerCase().includes('route')) {
      return `PA-${numberMatch[1]}`;
    }
  }

  return routeName;
}

// Extract direction from direction string or route
function extractDirection(directionStr) {
  if (!directionStr) return null;

  const dir = directionStr.toUpperCase();
  if (dir.includes('N') && dir.includes('B')) return 'N'; // Northbound
  if (dir.includes('S') && dir.includes('B')) return 'S'; // Southbound
  if (dir.includes('E') && dir.includes('B')) return 'E'; // Eastbound
  if (dir.includes('W') && dir.includes('B')) return 'W'; // Westbound
  if (dir.includes('NORTH')) return 'N';
  if (dir.includes('SOUTH')) return 'S';
  if (dir.includes('EAST')) return 'E';
  if (dir.includes('WEST')) return 'W';

  return dir.charAt(0);
}

// Check if event is relevant (active or starting soon)
function isEventRelevant(event, isPlanned = false) {
  // Planned events are always relevant if they have future dates
  if (isPlanned) return true;

  // For live events, check if they have valid coordinates
  if (!event.Latitude && !event.latitude) return false;
  if (!event.Longitude && !event.longitude) return false;

  // Check if event has ended
  const endTime = event.EndTime || event.endTime || event.end;
  if (endTime) {
    const endDate = new Date(endTime);
    if (endDate < new Date()) return false; // Event has ended
  }

  return true;
}

async function fetchPennDOTRCRS() {
  console.log('🛣️  Fetching PennDOT RCRS road events...\n');

  // Check for credentials
  if (!PENNDOT_USERNAME || !PENNDOT_PASSWORD) {
    console.error('❌ Missing PennDOT credentials!');
    console.error('   Set PENNDOT_USERNAME and PENNDOT_PASSWORD environment variables');
    return [];
  }

  const allEvents = [];
  let liveCount = 0;
  let plannedCount = 0;

  // Fetch live events
  try {
    console.log('📍 Fetching live events...');
    const liveData = await fetchJSON(
      RCRS_ENDPOINTS.liveEvents,
      PENNDOT_USERNAME,
      PENNDOT_PASSWORD
    );

    // Handle different response structures
    let liveEvents = [];
    if (Array.isArray(liveData)) {
      liveEvents = liveData;
    } else if (liveData.values && Array.isArray(liveData.values)) {
      liveEvents = liveData.values;
    } else if (liveData.events && Array.isArray(liveData.events)) {
      liveEvents = liveData.events;
    }

    if (liveEvents.length > 0) {
      const relevantLive = liveEvents.filter(item => isEventRelevant(item, false));
      console.log(`  ✅ Retrieved ${liveEvents.length} live events, ${relevantLive.length} relevant`);

      relevantLive.forEach(item => {
        allEvents.push(mapRCRSToEvent(item, false));
      });
      liveCount = relevantLive.length;
    }
  } catch (error) {
    console.error(`  ❌ Failed to fetch live events: ${error.message}`);
  }

  // Fetch planned events
  try {
    console.log('📍 Fetching planned events...');
    const plannedData = await fetchJSON(
      RCRS_ENDPOINTS.plannedEvents,
      PENNDOT_USERNAME,
      PENNDOT_PASSWORD
    );

    // Handle different response structures
    let plannedEvents = [];
    if (Array.isArray(plannedData)) {
      plannedEvents = plannedData;
    } else if (plannedData.values && Array.isArray(plannedData.values)) {
      plannedEvents = plannedData.values;
    } else if (plannedData.events && Array.isArray(plannedData.events)) {
      plannedEvents = plannedData.events;
    }

    if (plannedEvents.length > 0) {
      const relevantPlanned = plannedEvents.filter(item => isEventRelevant(item, true));
      console.log(`  ✅ Retrieved ${plannedEvents.length} planned events, ${relevantPlanned.length} relevant`);

      relevantPlanned.forEach(item => {
        allEvents.push(mapRCRSToEvent(item, true));
      });
      plannedCount = relevantPlanned.length;
    }
  } catch (error) {
    console.error(`  ❌ Failed to fetch planned events: ${error.message}`);
  }

  console.log(`\n📊 Total PennDOT RCRS Events: ${allEvents.length}`);
  console.log(`  Live Events: ${liveCount}`);
  console.log(`  Planned Events: ${plannedCount}`);

  // Show type breakdown
  const typeCounts = {
    'work-zone': allEvents.filter(e => e.type === 'work-zone').length,
    'restriction': allEvents.filter(e => e.type === 'restriction').length,
    'incident': allEvents.filter(e => e.type === 'incident').length,
    'weather': allEvents.filter(e => e.type === 'weather').length
  };
  console.log(`\n📈 Event Type Breakdown:`);
  console.log(`  Work Zones: ${typeCounts['work-zone']}`);
  console.log(`  Restrictions: ${typeCounts['restriction']}`);
  console.log(`  Incidents: ${typeCounts['incident']}`);
  console.log(`  Weather: ${typeCounts['weather']}`);

  // Show severity breakdown
  const severityCounts = {
    Major: allEvents.filter(e => e.severity === 'Major').length,
    Moderate: allEvents.filter(e => e.severity === 'Moderate').length,
    Minor: allEvents.filter(e => e.severity === 'Minor').length
  };
  console.log(`\n⚠️  Severity Breakdown:`);
  console.log(`  Major: ${severityCounts.Major}`);
  console.log(`  Moderate: ${severityCounts.Moderate}`);
  console.log(`  Minor: ${severityCounts.Minor}`);

  // Show I-80 corridor events (primary focus)
  const i80Events = allEvents.filter(e => e.corridor && e.corridor.includes('I-80'));
  if (i80Events.length > 0) {
    console.log(`\n🛣️  I-80 Corridor Events: ${i80Events.length}`);
  }

  return allEvents;
}

// Export for use in backend
module.exports = { fetchPennDOTRCRS };

// Run standalone if called directly
if (require.main === module) {
  fetchPennDOTRCRS().then(events => {
    console.log(`\n✅ Fetched ${events.length} PennDOT RCRS events`);

    // Show sample events
    if (events.length > 0) {
      console.log('\n📋 Sample Events:');
      events.slice(0, 5).forEach(event => {
        console.log(`\n  ${event.headline}`);
        console.log(`    Type: ${event.type} | Severity: ${event.severity}`);
        console.log(`    Source: ${event.source}`);
        console.log(`    Location: ${event.location}`);
        console.log(`    Corridor: ${event.corridor || 'N/A'}`);
        console.log(`    Status: ${event.roadStatus}`);
        if (event.coordinates) {
          console.log(`    Coordinates: ${event.coordinates[1]}, ${event.coordinates[0]}`);
        }
      });
    }

    process.exit(0);
  }).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

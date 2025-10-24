// Fetch California traffic closures from Caltrans LCS (Lane Control System)
// Covers all 12 Caltrans districts with 5-minute update frequency

const https = require('https');

// All 12 Caltrans district LCS feeds
const CALTRANS_DISTRICTS = [
  { district: 1, name: 'District 1 (Eureka)' },
  { district: 2, name: 'District 2 (Redding)' },
  { district: 3, name: 'District 3 (Marysville)' },
  { district: 4, name: 'District 4 (Oakland)' },
  { district: 5, name: 'District 5 (San Luis Obispo)' },
  { district: 6, name: 'District 6 (Fresno)' },
  { district: 7, name: 'District 7 (Los Angeles)' },
  { district: 8, name: 'District 8 (San Bernardino)' },
  { district: 9, name: 'District 9 (Bishop)' },
  { district: 10, name: 'District 10 (Stockton)' },
  { district: 11, name: 'District 11 (San Diego)' },
  { district: 12, name: 'District 12 (Orange County)' }
];

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET'
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
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error(`Request timeout for ${url}`));
    });
    request.end();
  });
}

// Map Caltrans LCS closure to event format
function mapClosureToEvent(item, district) {
  const lcs = item.lcs;
  const closure = lcs.closure;
  const location = lcs.location;

  // Get coordinates from begin location
  const longitude = parseFloat(location.begin.beginLongitude);
  const latitude = parseFloat(location.begin.beginLatitude);

  // Build location description
  const route = location.begin.beginRoute;
  const locationName = location.begin.beginLocationName;
  const nearbyPlace = location.begin.beginNearbyPlace;
  const direction = location.travelFlowDirection;

  // Determine severity based on lanes closed and facility type
  let severity = 'Minor';
  const totalLanes = parseInt(closure.totalExistingLanes) || 0;
  const lanesClosed = closure.lanesClosed ? closure.lanesClosed.split(',').length : 0;

  if (closure.facility === 'Ramp' || closure.facility === 'Connector') {
    if (closure.typeOfClosure === 'Full') severity = 'Major';
    else severity = 'Moderate';
  } else if (totalLanes > 0) {
    const percentClosed = lanesClosed / totalLanes;
    if (percentClosed >= 0.5) severity = 'Major';
    else if (percentClosed >= 0.25) severity = 'Moderate';
  }

  // Build headline
  const facilityType = closure.facility === 'Mainline' ? 'Lane' : closure.facility;
  const closureType = closure.typeOfClosure === 'Full' ? 'Full Closure' : 'Lane Closure';
  const headline = `${closureType} on ${route} ${direction} near ${locationName}`;

  // Build description
  let description = `${closure.typeOfWork} on ${route} ${direction}`;
  if (closure.lanesClosed) {
    description += ` - Lanes ${closure.lanesClosed} of ${closure.totalExistingLanes} closed`;
  }
  if (nearbyPlace) {
    description += ` near ${nearbyPlace}`;
  }

  // Extract corridor from route (e.g., "I-5" from "I-5")
  const corridor = extractCorridor(route);

  return {
    id: `caltrans-lcs-${closure.closureID}-${closure.logNumber}`,
    type: closure.typeOfClosure === 'Full' ? 'restriction' : 'work-zone',
    source: 'Caltrans LCS',
    headline: headline,
    description: description,
    severity: severity,
    category: closure.typeOfWork,
    state: 'CA',
    district: `District ${district}`,
    corridor: corridor,
    location: `${route} ${direction} at ${locationName}`,
    direction: direction.charAt(0), // N, S, E, W
    facility: closure.facility,
    lanesClosed: closure.lanesClosed,
    totalLanes: closure.totalExistingLanes,
    roadStatus: closure.typeOfClosure === 'Full' ? 'Closed' : 'Restricted',
    coordinates: [longitude, latitude],
    startDate: `${closure.closureTimestamp.closureStartDate}T${closure.closureTimestamp.closureStartTime}`,
    endDate: closure.closureTimestamp.isClosureEndIndefinite === 'true' ? null :
      `${closure.closureTimestamp.closureEndDate}T${closure.closureTimestamp.closureEndTime}`,
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };
}

// Extract corridor from route name (e.g., "I-5" from "I-5")
// Only extract interstate routes (I-XX format) to match map filter
function extractCorridor(routeName) {
  if (!routeName) return null;

  // Only match interstate format
  const interstateMatch = routeName.match(/I-?\s*(\d+)/i);
  if (interstateMatch) {
    return `I-${interstateMatch[1]}`;
  }

  // If not an interstate, return null so it's filtered out by the map
  return null;
}

// Check if closure is currently active
function isClosureActive(closure) {
  const now = Math.floor(Date.now() / 1000); // Current time in epoch seconds
  const startEpoch = parseInt(closure.closureTimestamp.closureStartEpoch);
  const endEpoch = parseInt(closure.closureTimestamp.closureEndEpoch);

  // Skip if closure hasn't started yet (more than 1 hour in the future)
  if (startEpoch > now + 3600) return false;

  // Include if closure has started and hasn't ended
  if (startEpoch <= now && endEpoch >= now) return true;

  // Include if closure starts within the next hour
  if (startEpoch > now && startEpoch <= now + 3600) return true;

  return false;
}

async function fetchCaltransLCS() {
  console.log('🚦 Fetching Caltrans LCS closures from all 12 districts...\n');

  const allEvents = [];
  const districtStats = [];

  for (const districtInfo of CALTRANS_DISTRICTS) {
    try {
      const districtNum = districtInfo.district.toString().padStart(2, '0');
      const url = `https://cwwp2.dot.ca.gov/data/d${districtInfo.district}/lcs/lcsStatusD${districtNum}.json`;

      console.log(`📍 Fetching ${districtInfo.name}...`);
      const data = await fetchJSON(url);

      if (data.data && Array.isArray(data.data)) {
        // Filter for active closures only
        const activeClosures = data.data.filter(item =>
          item.lcs && item.lcs.closure && isClosureActive(item.lcs.closure)
        );

        console.log(`  ✅ Retrieved ${data.data.length} total closures, ${activeClosures.length} currently active`);

        activeClosures.forEach(item => {
          allEvents.push(mapClosureToEvent(item, districtInfo.district));
        });

        districtStats.push({
          district: districtInfo.district,
          name: districtInfo.name,
          total: data.data.length,
          active: activeClosures.length
        });
      }
    } catch (error) {
      console.error(`  ❌ Failed to fetch ${districtInfo.name}: ${error.message}`);
      districtStats.push({
        district: districtInfo.district,
        name: districtInfo.name,
        total: 0,
        active: 0,
        error: error.message
      });
    }
  }

  console.log(`\n📊 Total Caltrans LCS Events: ${allEvents.length}`);
  console.log(`  Full Closures: ${allEvents.filter(e => e.type === 'restriction').length}`);
  console.log(`  Lane Closures: ${allEvents.filter(e => e.type === 'work-zone').length}`);

  // Show severity breakdown
  const severityCounts = {
    Major: allEvents.filter(e => e.severity === 'Major').length,
    Moderate: allEvents.filter(e => e.severity === 'Moderate').length,
    Minor: allEvents.filter(e => e.severity === 'Minor').length
  };
  console.log(`\n📈 Severity Breakdown:`);
  console.log(`  Major: ${severityCounts.Major}`);
  console.log(`  Moderate: ${severityCounts.Moderate}`);
  console.log(`  Minor: ${severityCounts.Minor}`);

  // Show top districts
  console.log(`\n🏆 Top Districts by Active Closures:`);
  districtStats
    .sort((a, b) => b.active - a.active)
    .slice(0, 5)
    .forEach(d => {
      console.log(`  ${d.name}: ${d.active} active (${d.total} total)`);
    });

  return allEvents;
}

// Export for use in backend
module.exports = { fetchCaltransLCS };

// Run standalone if called directly
if (require.main === module) {
  fetchCaltransLCS().then(events => {
    console.log(`\n✅ Fetched ${events.length} active Caltrans LCS events`);

    // Show sample events
    console.log('\n📋 Sample Events:');
    events.slice(0, 5).forEach(event => {
      console.log(`\n  ${event.headline}`);
      console.log(`    Type: ${event.type} | Severity: ${event.severity}`);
      console.log(`    Location: ${event.location}`);
      console.log(`    Status: ${event.roadStatus} | Facility: ${event.facility}`);
      if (event.lanesClosed) {
        console.log(`    Lanes: ${event.lanesClosed} of ${event.totalLanes} closed`);
      }
    });

    process.exit(0);
  }).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

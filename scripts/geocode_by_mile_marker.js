// Geocode facilities using interstate mile markers
// Uses approximate coordinates for major interstate routes
const Database = require('../database.js');

const db = new Database.constructor();

// Interstate route endpoints and key points for interpolation
// Format: [state, highway, direction, startMM, endMM, startLat, startLon, endLat, endLon]
const interstateSegments = [
  // Kentucky I-65 (full extent through state)
  ['KY', '65', 'N', 0, 140, 36.6085, -86.4808, 38.2527, -85.7585],
  ['KY', '65', 'S', 0, 140, 36.6085, -86.4808, 38.2527, -85.7585],

  // Kentucky I-75 (full extent through state)
  ['KY', '75', 'N', 0, 192, 36.6085, -83.6682, 39.0839, -84.5120],
  ['KY', '75', 'S', 0, 192, 36.6085, -83.6682, 39.0839, -84.5120],

  // Indiana I-80/I-90
  ['IN', '80', 'E', 0, 156, 41.6037, -87.5244, 41.6764, -84.8059],
  ['IN', '80', 'W', 0, 156, 41.6037, -87.5244, 41.6764, -84.8059],
  ['IN', '90', 'E', 0, 156, 41.6037, -87.5244, 41.6764, -84.8059],
  ['IN', '90', 'W', 0, 156, 41.6037, -87.5244, 41.6764, -84.8059],

  // Minnesota I-94
  ['MN', '94', 'E', 0, 259, 46.7867, -96.7898, 44.9778, -92.9694],
  ['MN', '94', 'W', 0, 259, 46.7867, -96.7898, 44.9778, -92.9694],

  // Michigan I-94
  ['MI', '94', 'E', 0, 275, 41.8781, -86.2520, 42.3314, -83.0458],
  ['MI', '94', 'W', 0, 275, 41.8781, -86.2520, 42.3314, -83.0458],

  // Michigan I-23 (US-23)
  ['MI', '23', 'N', 0, 142, 41.8369, -83.3813, 46.0520, -84.3476],
  ['MI', '23', 'S', 0, 142, 41.8369, -83.3813, 46.0520, -84.3476],

  // Kansas I-70
  ['KS', '70', 'E', 0, 423, 39.0473, -102.0517, 39.1142, -94.7268],
  ['KS', '70', 'W', 0, 423, 39.0473, -102.0517, 39.1142, -94.7268],

  // Kansas I-35
  ['KS', '35', 'N', 0, 235, 37.0005, -95.8125, 39.9991, -95.1886],
  ['KS', '35', 'S', 0, 235, 37.0005, -95.8125, 39.9991, -95.1886],

  // Colorado I-70
  ['CO', '70', 'E', 0, 450, 39.0639, -108.5506, 39.7392, -104.9903],
  ['CO', '70', 'W', 0, 450, 39.0639, -108.5506, 39.7392, -104.9903],

  // Ohio I-80/I-90
  ['OH', '80', 'E', 0, 241, 41.5051, -84.7238, 41.6528, -80.5195],
  ['OH', '80', 'W', 0, 241, 41.5051, -84.7238, 41.6528, -80.5195],
  ['OH', '90', 'E', 0, 241, 41.5051, -84.7238, 41.6528, -80.5195],
  ['OH', '90', 'W', 0, 241, 41.5051, -84.7238, 41.6528, -80.5195],

  // New Mexico I-40
  ['NM', '40', 'E', 0, 373, 32.9983, -108.7452, 35.1856, -103.0633],
  ['NM', '40', 'W', 0, 373, 32.9983, -108.7452, 35.1856, -103.0633],

  // New Mexico I-25
  ['NM', '25', 'N', 0, 460, 31.7870, -106.6465, 37.0000, -104.6719],
  ['NM', '25', 'S', 0, 460, 31.7870, -106.6465, 37.0000, -104.6719],
];

// Parse site ID to extract route info
function parseSiteId(siteId) {
  // Format examples:
  // KY00065IS000020NSMARATHON - KY, I-65, MM 20, N
  // IN00080IS00012600WRA0126W00 - IN, I-80, MM 126, W
  // MI000I94WE0128MM0000PARMA0PR - MI, I-94, MM 128, E

  const stateMatch = siteId.match(/^([A-Z]{2})/);

  // Handle different format patterns
  let highwayMatch, mmMatch, dirMatch;

  // Format 1: STATE00HWY/IS/MMMMM/DIR
  if (siteId.includes('IS')) {
    highwayMatch = siteId.match(/^[A-Z]{2}0*(\d+)IS/);
    mmMatch = siteId.match(/IS0*(\d+)/);
    // Direction is the first N/S/E/W after the mile marker digits
    dirMatch = siteId.match(/IS\d+([NSEW])/);
  }
  // Format 2: STATEI##XX####MM (Michigan format)
  else if (siteId.match(/I\d+[NSEW]/)) {
    highwayMatch = siteId.match(/I(\d+)[NSEW]/);
    mmMatch = siteId.match(/[NSEW]E?(\d+)MM/);
    dirMatch = siteId.match(/I\d+([NSEW])/);
  }

  if (!stateMatch || !highwayMatch || !mmMatch) {
    console.log(`Failed to parse: ${siteId}`);
    return null;
  }

  const mileMarker = parseInt(mmMatch[1]);

  // Mile marker in hundreds (e.g., 7500 = MM 75)
  const adjustedMM = mileMarker > 500 ? Math.floor(mileMarker / 100) : mileMarker;

  return {
    state: stateMatch[1],
    highway: highwayMatch[1],
    mileMarker: adjustedMM,
    direction: dirMatch ? dirMatch[1] : null,
    original: siteId
  };
}

// Interpolate coordinates along interstate segment
function interpolateCoordinates(state, highway, direction, mileMarker) {
  // Find matching segment
  const segment = interstateSegments.find(seg =>
    seg[0] === state &&
    seg[1] === highway &&
    (seg[2] === direction || direction === null) &&
    mileMarker >= seg[3] &&
    mileMarker <= seg[4]
  );

  if (!segment) {
    return null;
  }

  const [, , , startMM, endMM, startLat, startLon, endLat, endLon] = segment;

  // Linear interpolation
  const ratio = (mileMarker - startMM) / (endMM - startMM);
  const latitude = startLat + (endLat - startLat) * ratio;
  const longitude = startLon + (endLon - startLon) * ratio;

  return { latitude, longitude };
}

async function geocodeFacilities() {
  console.log('\n📍 Geocoding facilities by interstate mile markers...\n');

  await db.init();

  // Get all facilities without coordinates
  const facilities = db.db.prepare(`
    SELECT facility_id, site_id, state
    FROM parking_facilities
    WHERE latitude = 0 AND longitude = 0
  `).all();

  console.log(`📋 Found ${facilities.length} facilities without coordinates\n`);

  let geocoded = 0;
  let failed = 0;

  for (const facility of facilities) {
    const routeInfo = parseSiteId(facility.site_id);

    if (!routeInfo) {
      failed++;
      continue;
    }

    const coords = interpolateCoordinates(
      routeInfo.state,
      routeInfo.highway,
      routeInfo.direction,
      routeInfo.mileMarker
    );

    if (coords) {
      db.db.prepare(`
        UPDATE parking_facilities
        SET latitude = ?, longitude = ?
        WHERE facility_id = ?
      `).run(coords.latitude, coords.longitude, facility.facility_id);

      geocoded++;
      if (geocoded === 1 || geocoded % 20 === 0) {
        process.stdout.write(`\r✅ Geocoded ${geocoded} facilities...`);
      }
    } else {
      if (failed < 5) {
        console.log(`❌ No route data: ${routeInfo.state} I-${routeInfo.highway} MM ${routeInfo.mileMarker} (${facility.site_id})`);
      }
      failed++;
    }
  }

  console.log(`\n\n📊 Geocoding Summary:`);
  console.log(`   Geocoded: ${geocoded}`);
  console.log(`   Failed: ${failed}\n`);

  // Show results by state
  const results = db.db.prepare(`
    SELECT state,
           COUNT(*) as total,
           COUNT(CASE WHEN latitude <> 0 AND longitude <> 0 THEN 1 END) as with_coords
    FROM parking_facilities
    GROUP BY state
    ORDER BY state
  `).all();

  console.log('📍 Coordinates by state:');
  results.forEach(r => {
    const pct = (r.with_coords / r.total * 100).toFixed(0);
    console.log(`   ${r.state}: ${r.with_coords}/${r.total} (${pct}%)`);
  });
  console.log();
}

geocodeFacilities();

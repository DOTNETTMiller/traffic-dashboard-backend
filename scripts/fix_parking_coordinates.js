#!/usr/bin/env node

/**
 * Fix Broken (0,0) Coordinates in Truck Parking Facilities
 *
 * Reads facilities from both the JSON file and database, identifies those with
 * missing or zero coordinates, decodes site_id to extract route/milepost info,
 * and uses interstate segment interpolation to compute corrected GPS coordinates.
 *
 * States with TPIMS live feeds (IL, IN) will self-correct via API fetches.
 * This script focuses on states WITHOUT live feeds: OH, MI, NM, KS, CO, MN, KY, and others.
 *
 * Usage:
 *   node scripts/fix_parking_coordinates.js              # Fix both JSON and DB
 *   node scripts/fix_parking_coordinates.js --json-only   # Fix only facilities_data.json
 *   node scripts/fix_parking_coordinates.js --db-only     # Fix only database
 *   node scripts/fix_parking_coordinates.js --dry-run     # Report only, no changes
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Interstate segment data for coordinate interpolation
// Format: [state, highway, startMM, endMM, startLat, startLon, endLat, endLon]
// Each segment represents a linear approximation of the route between two endpoints.
// ---------------------------------------------------------------------------
const INTERSTATE_SEGMENTS = [
  // Ohio I-80/I-90 (Ohio Turnpike - concurrent)
  ['OH', '80', 0, 241, 41.5051, -84.7238, 41.6528, -80.5195],
  ['OH', '90', 0, 241, 41.5051, -84.7238, 41.6528, -80.5195],
  // Ohio I-71
  ['OH', '71', 0, 248, 38.9936, -84.6327, 41.4689, -81.6937],
  // Ohio I-75
  ['OH', '75', 0, 211, 39.1011, -84.5120, 41.6142, -83.6109],
  // Ohio I-70
  ['OH', '70', 0, 225, 39.7567, -84.8127, 40.0636, -80.7233],
  // Ohio I-76
  ['OH', '76', 0, 93, 41.0783, -81.5199, 41.0923, -80.5186],
  // Ohio I-77
  ['OH', '77', 0, 177, 38.4263, -81.6302, 40.8510, -81.3765],

  // Michigan I-94
  ['MI', '94', 0, 275, 41.8781, -86.2520, 42.3314, -83.0458],
  // Michigan I-96
  ['MI', '96', 0, 192, 42.9634, -86.1776, 42.3223, -83.1763],
  // Michigan I-69
  ['MI', '69', 0, 199, 41.7257, -84.8060, 43.0067, -83.8467],
  // Michigan I-75
  ['MI', '75', 0, 395, 42.3061, -83.0544, 46.4929, -84.3633],
  // Michigan US-23
  ['MI', '23', 0, 142, 41.8369, -83.3813, 46.0520, -84.3476],

  // New Mexico I-40
  ['NM', '40', 0, 373, 35.7518, -108.7452, 35.1856, -103.0633],
  // New Mexico I-25
  ['NM', '25', 0, 460, 31.7870, -106.6465, 37.0000, -104.6719],
  // New Mexico I-10
  ['NM', '10', 0, 164, 32.3375, -108.9875, 32.2878, -106.6005],

  // Indiana I-80/I-90 (concurrent, Indiana Toll Road)
  ['IN', '80', 0, 156, 41.6037, -87.5244, 41.6764, -84.8059],
  ['IN', '90', 0, 156, 41.6037, -87.5244, 41.6764, -84.8059],
  // Indiana I-65
  ['IN', '65', 0, 262, 37.8956, -85.9485, 41.1575, -87.3351],
  // Indiana I-69
  ['IN', '69', 0, 355, 38.0511, -87.5709, 41.7257, -84.8060],
  // Indiana I-70
  ['IN', '70', 0, 156, 39.7676, -87.5317, 39.7270, -84.8184],

  // Kentucky I-65
  ['KY', '65', 0, 140, 36.6085, -86.4808, 38.2527, -85.7585],
  // Kentucky I-75
  ['KY', '75', 0, 192, 36.6085, -83.6682, 39.0839, -84.5120],
  // Kentucky I-64
  ['KY', '64', 0, 192, 38.0634, -85.7642, 38.3468, -82.5654],
  // Kentucky I-71
  ['KY', '71', 0, 77, 38.2588, -85.7377, 39.0741, -84.6566],

  // Minnesota I-94
  ['MN', '94', 0, 259, 46.7867, -96.7898, 44.9778, -92.9694],
  // Minnesota I-90
  ['MN', '90', 0, 276, 43.5050, -96.4543, 43.8478, -91.2836],
  // Minnesota I-35
  ['MN', '35', 0, 260, 43.5047, -93.5203, 46.7790, -92.1069],
  // Minnesota I-35W (Minneapolis segment)
  ['MN', '35W', 0, 44, 44.8502, -93.3180, 45.2379, -93.2618],
  // Minnesota I-35E (St. Paul segment)
  ['MN', '35E', 0, 44, 44.8502, -93.0870, 45.2379, -93.0870],

  // Kansas I-70
  ['KS', '70', 0, 423, 39.0473, -102.0517, 39.1142, -94.7268],
  // Kansas I-35
  ['KS', '35', 0, 235, 37.0005, -97.3125, 39.9991, -95.1886],

  // Colorado I-70
  ['CO', '70', 0, 450, 39.0639, -108.5506, 39.7392, -104.9903],
  // Colorado I-25
  ['CO', '25', 0, 299, 37.0005, -104.6523, 41.0000, -104.8203],
  // Colorado I-76
  ['CO', '76', 0, 187, 39.7786, -105.0054, 40.9661, -102.0527],

  // Illinois I-80
  ['IL', '80', 0, 163, 41.4906, -90.5613, 41.5224, -87.5250],
  // Illinois I-55
  ['IL', '55', 0, 294, 37.3895, -89.5239, 41.8825, -87.6445],
  // Illinois I-57
  ['IL', '57', 0, 358, 37.0500, -89.1750, 41.7100, -87.6267],
  // Illinois I-70
  ['IL', '70', 0, 156, 38.6290, -90.1485, 39.4642, -87.5317],
  // Illinois I-74
  ['IL', '74', 0, 221, 40.6928, -89.5890, 40.0508, -87.3312],
  // Illinois I-88
  ['IL', '88', 0, 140, 41.7568, -89.6880, 41.8530, -88.0619],
  // Illinois I-39
  ['IL', '39', 0, 122, 40.5142, -89.0048, 42.4978, -89.0340],

  // Iowa I-80
  ['IA', '80', 0, 306, 41.2575, -95.9282, 41.5867, -90.1878],
  // Iowa I-35
  ['IA', '35', 0, 218, 40.5954, -93.5557, 43.3979, -93.3649],
  // Iowa I-380
  ['IA', '380', 0, 72, 41.6556, -91.5302, 42.4980, -92.3296],

  // Wisconsin I-90/I-94 (concurrent section)
  ['WI', '90', 0, 187, 42.5017, -90.7260, 44.0817, -89.3200],
  ['WI', '94', 0, 340, 42.4887, -87.8000, 44.8143, -92.6300],
  // Wisconsin I-43
  ['WI', '43', 0, 192, 42.7251, -87.8100, 44.5147, -87.9900],
];

// ---------------------------------------------------------------------------
// Known facility coordinates from TPIMS Excel exports and verified sources
// These override interpolation results for better accuracy
// ---------------------------------------------------------------------------
const KNOWN_COORDINATES = {
  // Ohio facilities (no live TPIMS feed)
  'oh00080is0023300etpoh8023': { lat: 41.6419, lon: -80.6737 },  // OH I-80 MM 233 E
  'oh00080is0023300wtpoh8023': { lat: 41.6419, lon: -80.6737 },  // OH I-80 MM 233 W
  'oh00080is0017000etpoh8017': { lat: 41.5960, lon: -81.6000 },  // OH I-80 MM 170 E
  'oh00080is0017000wtpoh8017': { lat: 41.5960, lon: -81.6000 },  // OH I-80 MM 170 W
  'oh00080is0014000etpoh8014': { lat: 41.5720, lon: -82.1000 },  // OH I-80 MM 140 E
  'oh00080is0014000wtpoh8014': { lat: 41.5720, lon: -82.1000 },  // OH I-80 MM 140 W
  'oh00080is0011800etpoh8011': { lat: 41.5560, lon: -82.4500 },  // OH I-80 MM 118 E
  'oh00080is0011800wtpoh8011': { lat: 41.5560, lon: -82.4500 },  // OH I-80 MM 118 W
  'oh00080is0009100etpoh8009': { lat: 41.5380, lon: -82.9200 },  // OH I-80 MM 91 E
  'oh00080is0009100wtpoh8009': { lat: 41.5380, lon: -82.9200 },  // OH I-80 MM 91 W
  'oh00080is0006400etpoh8006': { lat: 41.5230, lon: -83.3700 },  // OH I-80 MM 64 E
  'oh00080is0006400wtpoh8006': { lat: 41.5230, lon: -83.3700 },  // OH I-80 MM 64 W
  'oh00080is0003900etpoh8003': { lat: 41.5120, lon: -83.7900 },  // OH I-80 MM 39 E
  'oh00080is0003900wtpoh8003': { lat: 41.5120, lon: -83.7900 },  // OH I-80 MM 39 W
  'oh00080is0002000etpoh8002': { lat: 41.5050, lon: -84.1200 },  // OH I-80 MM 20 E
  'oh00080is0002000wtpoh8002': { lat: 41.5050, lon: -84.1200 },  // OH I-80 MM 20 W
  'oh00071is0022000ntpoh7122': { lat: 40.9556, lon: -81.4421 },  // OH I-71 MM 220 N
  'oh00071is0022000stpoh7122': { lat: 40.9556, lon: -81.4421 },  // OH I-71 MM 220 S
  'oh00071is0017000ntpoh7117': { lat: 40.6400, lon: -82.2800 },  // OH I-71 MM 170 N
  'oh00071is0017000stpoh7117': { lat: 40.6400, lon: -82.2800 },  // OH I-71 MM 170 S
  'oh00071is0010000ntpoh7110': { lat: 40.2000, lon: -83.1600 },  // OH I-71 MM 100 N
  'oh00071is0010000stpoh7110': { lat: 40.2000, lon: -83.1600 },  // OH I-71 MM 100 S
  'oh00077is0012000ntpoh7712': { lat: 40.2700, lon: -81.5600 },  // OH I-77 MM 120 N
  'oh00077is0012000stpoh7712': { lat: 40.2700, lon: -81.5600 },  // OH I-77 MM 120 S
  'oh00070is0017900etpoh7017': { lat: 39.9730, lon: -82.0400 },  // OH I-70 MM 179 E
  'oh00070is0017900wtpoh7017': { lat: 39.9730, lon: -82.0400 },  // OH I-70 MM 179 W
  'oh00070is0009300etpoh7009': { lat: 39.8630, lon: -83.3800 },  // OH I-70 MM 93 E
  'oh00070is0009300wtpoh7009': { lat: 39.8630, lon: -83.3800 },  // OH I-70 MM 93 W
  'oh00075is0012000ntpoh7512': { lat: 40.7000, lon: -84.1500 },  // OH I-75 MM 120 N
  'oh00075is0012000stpoh7512': { lat: 40.7000, lon: -84.1500 },  // OH I-75 MM 120 S

  // Michigan facilities (no live TPIMS feed)
  'mi000i94we0029mm0000prima': { lat: 42.0680, lon: -86.4830 },  // MI I-94 MM 29 Primarr RA
  'mi000i94we0092mm0000arlen': { lat: 42.3200, lon: -85.6600 },  // MI I-94 MM 92 Arlene RA
  'mi000i94we0110mm0000pione': { lat: 42.3600, lon: -85.3500 },  // MI I-94 MM 110 Pioneer RA
  'mi000i94we0115mm000tp115e': { lat: 42.3750, lon: -85.2800 },  // MI I-94 MM 115 TP
  'mi000i94we0128mm0000parma': { lat: 42.4100, lon: -85.0600 },  // MI I-94 MM 128 Parma RA
  'mi000i94ew0029mm0000prima': { lat: 42.0680, lon: -86.4830 },  // MI I-94 MM 29 Primarr RA (EB)
  'mi000i94ew0092mm0000arlen': { lat: 42.3200, lon: -85.6600 },  // MI I-94 MM 92 Arlene RA (EB)
  'mi000i94ew0110mm0000pione': { lat: 42.3600, lon: -85.3500 },  // MI I-94 MM 110 Pioneer RA (EB)
  'mi000i94ew0128mm0000parma': { lat: 42.4100, lon: -85.0600 },  // MI I-94 MM 128 Parma RA (EB)

  // New Mexico facilities (no live TPIMS feed)
  'nm00040is0020000etpnm4020': { lat: 35.4537, lon: -106.3780 },  // NM I-40 MM 200 E Bernalillo area
  'nm00040is0020000wtpnm4020': { lat: 35.4537, lon: -106.3780 },  // NM I-40 MM 200 W
  'nm00040is0015000etpnm4015': { lat: 35.5590, lon: -107.1480 },  // NM I-40 MM 150 E Grants area
  'nm00040is0015000wtpnm4015': { lat: 35.5590, lon: -107.1480 },  // NM I-40 MM 150 W
  'nm00040is0010000etpnm4010': { lat: 35.6350, lon: -107.8800 },  // NM I-40 MM 100 E Gallup area
  'nm00040is0010000wtpnm4010': { lat: 35.6350, lon: -107.8800 },  // NM I-40 MM 100 W
  'nm00040is0028000etpnm4028': { lat: 35.2220, lon: -105.1150 },  // NM I-40 MM 280 E Santa Rosa area
  'nm00040is0028000wtpnm4028': { lat: 35.2220, lon: -105.1150 },  // NM I-40 MM 280 W
  'nm00040is0031000etpnm4031': { lat: 35.1960, lon: -104.6350 },  // NM I-40 MM 310 E Tucumcari area
  'nm00040is0031000wtpnm4031': { lat: 35.1960, lon: -104.6350 },  // NM I-40 MM 310 W
  'nm00025is0030000ntpnm2530': { lat: 34.4763, lon: -106.0731 },  // NM I-25 MM 300 N Socorro area
  'nm00025is0030000stpnm2530': { lat: 34.4763, lon: -106.0731 },  // NM I-25 MM 300 S
  'nm00025is0015000ntpnm2515': { lat: 32.7608, lon: -106.6700 },  // NM I-25 MM 150 N Las Cruces area
  'nm00025is0015000stpnm2515': { lat: 32.7608, lon: -106.6700 },  // NM I-25 MM 150 S
  'nm00010is0010000etpnm1010': { lat: 32.3292, lon: -107.7547 },  // NM I-10 MM 100 E Deming area
  'nm00010is0010000wtpnm1010': { lat: 32.3292, lon: -107.7547 },  // NM I-10 MM 100 W

  // Minnesota facilities (corrected from generic 46.0,-95.33 coordinates)
  'mn00094is0021500eelmcreek': { lat: 45.1430, lon: -93.4260 },  // MN I-94 MM 215 Elm Creek RA
  'mn00094is0025580w0stcroix': { lat: 45.0020, lon: -92.7650 },  // MN I-94 MM 256 St. Croix RA
  'mn00094is0009960elklatoka': { lat: 46.0330, lon: -95.4890 },  // MN I-94 MM 100 Lake Latoka RA
  'mn00094is0018700e0enfield': { lat: 45.3210, lon: -93.8640 },  // MN I-94 MM 187 Enfield RA
  'mn00094is0015170ebigspunk': { lat: 45.5420, lon: -94.4000 },  // MN I-94 MM 152 Big Spunk Lake RA
  'mn00035is0013200sforestlk': { lat: 45.2690, lon: -93.0050 },  // MN I-35 MM 132 Forest Lake RA
  'mn00035is0013200nforestlk': { lat: 45.2690, lon: -93.0050 },  // MN I-35 MM 132 Forest Lake RA (NB)
  'mn00090is0017800nblueeart': { lat: 43.6280, lon: -94.0880 },  // MN I-90 MM 178 Blue Earth RA
  'mn00090is0017800sblueeart': { lat: 43.6280, lon: -94.0880 },  // MN I-90 MM 178 Blue Earth RA

  // Kentucky (corrected from generic coordinates)
  'ky00065is000020nsmarathon': { lat: 36.7271, lon: -86.5600 },   // KY I-65 MM 20 N Marathon
  'ky00065is0000020n65welcom': { lat: 36.6230, lon: -86.5340 },   // KY I-65 MM 2 Welcome Center
  'ky00065is0005900n65nra059': { lat: 37.2590, lon: -85.9300 },   // KY I-65 MM 59 NB Rest Area
  'ky00065is0005900s65sra059': { lat: 37.2590, lon: -85.9300 },   // KY I-65 MM 59 SB Rest Area
  'ky00065is0000340nweighs34': { lat: 36.9260, lon: -86.4800 },   // KY I-65 MM 34 NB Weigh Station
  'ky00065is0011400s65sra114': { lat: 37.9190, lon: -85.7800 },   // KY I-65 MM 114 SB Rest Area
  'ky00075is0000100n75welcom': { lat: 36.6230, lon: -83.7160 },   // KY I-75 MM 1 Welcome Center
  'ky00075is0007500swaltonws': { lat: 37.6244, lon: -84.2850 },   // KY I-75 MM 75 Walton Weigh Sta
  'ky00075is0017700n75nra177': { lat: 39.0667, lon: -84.6167 },   // KY I-75 MM 177 NB Rest Area
  'ky00075is0017700s75sra177': { lat: 39.0667, lon: -84.6167 },   // KY I-75 MM 177 SB Rest Area
  'ky00075is0003300nweighs33': { lat: 37.0330, lon: -84.0830 },   // KY I-75 MM 33 NB Weigh Station
  'ky00075is0003400sweighs34': { lat: 37.0500, lon: -84.0830 },   // KY I-75 MM 34 SB Weigh Station
  'ky00075is0016800scritenws': { lat: 38.9500, lon: -84.5330 },   // KY I-75 MM 168 Crittenden WS
  'ky00075is0001000n75nr010r': { lat: 36.7330, lon: -83.7330 },   // KY I-75 MM 10 NB Rest Area
};

// ---------------------------------------------------------------------------
// site_id parsers
// ---------------------------------------------------------------------------

/**
 * Parse a TPIMS site_id to extract state, highway, milepost, and direction.
 *
 * Known formats:
 *   Standard:   ST0HWYISMMMMMDIRname   e.g. oh00080is0009100etpoh8009
 *   Michigan:   MI000IHWY_DIREMMMM     e.g. mi000i94we0029mm0000prima
 *   Kentucky:   KY0HWYISMMMMMDIRname   e.g. ky00065is000020nsmarathon
 */
function parseSiteId(siteId) {
  const id = siteId.toUpperCase();
  const stateMatch = id.match(/^([A-Z]{2})/);
  if (!stateMatch) return null;
  const state = stateMatch[1];

  let highway, mileMarker, direction;

  // Michigan format: MI000I94WE0029MM...
  if (id.match(/I\d+[NSEW]/)) {
    const hwMatch = id.match(/I(\d+)([NSEW])/);
    if (hwMatch) {
      highway = hwMatch[1];
      direction = hwMatch[2];
    }
    const mmMatch = id.match(/[NSEW]E?(\d{4})MM/);
    if (mmMatch) {
      mileMarker = parseInt(mmMatch[1]);
    }
  }
  // Standard format: XX0HWY[IS]MMMMM[DIR]
  else if (id.includes('IS')) {
    const hwMatch = id.match(/^[A-Z]{2}0*(\d+)IS/);
    if (hwMatch) highway = hwMatch[1];

    const mmMatch = id.match(/IS0*(\d+)/);
    if (mmMatch) {
      const raw = parseInt(mmMatch[1]);
      // Site IDs encode milepost in different scales:
      //   0009100 -> MM 91, 0023300 -> MM 233, 0005900 -> MM 59
      //   Some use 100s (e.g. 12600 -> MM 126), some use 10s (e.g. 20 -> MM 20)
      if (raw >= 10000) {
        mileMarker = Math.floor(raw / 100);
      } else if (raw >= 1000) {
        mileMarker = Math.floor(raw / 10);
      } else {
        mileMarker = raw;
      }
    }

    // Direction is the first letter after the milepost digits
    const dirMatch = id.match(/IS\d+([NSEW])/);
    if (dirMatch) direction = dirMatch[1];
  }

  if (!highway) return null;

  return {
    state,
    highway: highway.replace(/^0+/, '') || '0',
    mileMarker: mileMarker || 0,
    direction: direction || null,
    rawId: id
  };
}

/**
 * Interpolate GPS coordinates along an interstate segment given a mile marker.
 */
function interpolateCoordinates(state, highway, mileMarker) {
  // Find matching segment
  const segment = INTERSTATE_SEGMENTS.find(seg =>
    seg[0] === state &&
    seg[1] === highway &&
    mileMarker >= seg[2] &&
    mileMarker <= seg[3]
  );

  if (!segment) {
    // Try with leading zeros stripped
    const altSegment = INTERSTATE_SEGMENTS.find(seg =>
      seg[0] === state &&
      seg[1] === String(parseInt(highway)) &&
      mileMarker >= seg[2] &&
      mileMarker <= seg[3]
    );
    if (!altSegment) return null;
    const [, , startMM, endMM, startLat, startLon, endLat, endLon] = altSegment;
    const ratio = endMM > startMM ? (mileMarker - startMM) / (endMM - startMM) : 0;
    return {
      latitude: Math.round((startLat + (endLat - startLat) * ratio) * 10000) / 10000,
      longitude: Math.round((startLon + (endLon - startLon) * ratio) * 10000) / 10000
    };
  }

  const [, , startMM, endMM, startLat, startLon, endLat, endLon] = segment;
  const ratio = endMM > startMM ? (mileMarker - startMM) / (endMM - startMM) : 0;
  return {
    latitude: Math.round((startLat + (endLat - startLat) * ratio) * 10000) / 10000,
    longitude: Math.round((startLon + (endLon - startLon) * ratio) * 10000) / 10000
  };
}

/**
 * Get corrected coordinates for a facility with (0,0) coords.
 * First checks the known-coordinates table, then falls back to interpolation.
 */
function getFixedCoordinates(siteId) {
  const key = siteId.toLowerCase();

  // Check known coordinates first (hand-verified)
  if (KNOWN_COORDINATES[key]) {
    const kc = KNOWN_COORDINATES[key];
    return { latitude: kc.lat, longitude: kc.lon, source: 'known' };
  }

  // Fall back to site_id parsing + interpolation
  const parsed = parseSiteId(siteId);
  if (!parsed) return null;

  const coords = interpolateCoordinates(parsed.state, parsed.highway, parsed.mileMarker);
  if (!coords) return null;

  return { ...coords, source: 'interpolated' };
}

// ---------------------------------------------------------------------------
// JSON file update
// ---------------------------------------------------------------------------

function fixFacilitiesJson(dryRun = false) {
  const jsonPath = path.join(__dirname, 'facilities_data.json');

  if (!fs.existsSync(jsonPath)) {
    console.log('  facilities_data.json not found, skipping JSON update');
    return { fixed: 0, total: 0, unfixable: 0 };
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const facilities = Array.isArray(data) ? data : [];

  const broken = facilities.filter(f =>
    !f.latitude || !f.longitude || f.latitude === 0 || f.longitude === 0
  );

  console.log(`\n  JSON file: ${facilities.length} total facilities, ${broken.length} with (0,0) coordinates`);

  let fixed = 0;
  let unfixable = 0;
  const unfixableList = [];

  for (const facility of broken) {
    const siteId = facility.site_id || facility.facility_id?.replace('tpims-historical-', '') || '';
    const coords = getFixedCoordinates(siteId);

    if (coords) {
      if (!dryRun) {
        facility.latitude = coords.latitude;
        facility.longitude = coords.longitude;
      }
      console.log(`    FIXED  ${siteId.substring(0, 40).padEnd(40)} -> (${coords.latitude}, ${coords.longitude}) [${coords.source}]`);
      fixed++;
    } else {
      unfixable++;
      unfixableList.push(siteId);
    }
  }

  if (unfixableList.length > 0) {
    console.log(`\n  Could not fix ${unfixableList.length} facilities:`);
    for (const id of unfixableList) {
      const parsed = parseSiteId(id);
      const info = parsed ? `${parsed.state} I-${parsed.highway} MM ${parsed.mileMarker}` : 'unparseable';
      console.log(`    SKIP   ${id.substring(0, 40).padEnd(40)} (${info})`);
    }
  }

  if (!dryRun && fixed > 0) {
    fs.writeFileSync(jsonPath, JSON.stringify(facilities, null, 2));
    console.log(`\n  Wrote updated facilities_data.json (${fixed} coordinates fixed)`);
  }

  return { fixed, total: broken.length, unfixable };
}

// ---------------------------------------------------------------------------
// Database update
// ---------------------------------------------------------------------------

async function fixDatabase(dryRun = false) {
  let Database;
  try {
    Database = require('../database.js');
  } catch (e) {
    console.log('  Could not load database module, skipping DB update');
    return { fixed: 0, total: 0, unfixable: 0 };
  }

  const db = new Database.constructor();
  await db.init();

  // States without live TPIMS feeds (focus of this fix)
  // IL and IN have live feeds and will self-correct
  const noLiveFeedStates = ['OH', 'MI', 'NM', 'KS', 'CO', 'MN', 'KY', 'WI'];

  const facilities = db.db.prepare(`
    SELECT facility_id, site_id, state
    FROM parking_facilities
    WHERE (latitude IS NULL OR latitude = 0 OR longitude IS NULL OR longitude = 0)
  `).all();

  console.log(`\n  Database: ${facilities.length} facilities with (0,0) coordinates`);

  // Separate by live-feed vs no-live-feed
  const priorityFacilities = facilities.filter(f => noLiveFeedStates.includes(f.state));
  const liveFeedFacilities = facilities.filter(f => !noLiveFeedStates.includes(f.state));

  console.log(`    Priority (no live feed): ${priorityFacilities.length} in states: ${[...new Set(priorityFacilities.map(f => f.state))].sort().join(', ')}`);
  console.log(`    Live-feed states (will self-correct): ${liveFeedFacilities.length} in states: ${[...new Set(liveFeedFacilities.map(f => f.state))].sort().join(', ')}`);

  let fixed = 0;
  let unfixable = 0;

  // Fix all facilities, prioritizing non-live-feed states
  const allToFix = [...priorityFacilities, ...liveFeedFacilities];

  for (const facility of allToFix) {
    const siteId = facility.site_id || facility.facility_id?.replace('tpims-historical-', '') || '';
    const coords = getFixedCoordinates(siteId);

    if (coords) {
      if (!dryRun) {
        db.db.prepare(`
          UPDATE parking_facilities
          SET latitude = ?, longitude = ?
          WHERE facility_id = ?
        `).run(coords.latitude, coords.longitude, facility.facility_id);
      }
      fixed++;
    } else {
      unfixable++;
    }
  }

  // Report results by state
  if (!dryRun) {
    const results = db.db.prepare(`
      SELECT state,
             COUNT(*) as total,
             COUNT(CASE WHEN latitude <> 0 AND longitude <> 0 THEN 1 END) as with_coords
      FROM parking_facilities
      GROUP BY state
      ORDER BY state
    `).all();

    console.log('\n  Coordinates by state after fix:');
    for (const r of results) {
      const pct = (r.with_coords / r.total * 100).toFixed(0);
      const marker = r.with_coords < r.total ? ' <--' : '';
      console.log(`    ${r.state}: ${r.with_coords}/${r.total} (${pct}%)${marker}`);
    }
  }

  return { fixed, total: facilities.length, unfixable };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const jsonOnly = args.includes('--json-only');
  const dbOnly = args.includes('--db-only');

  console.log('\n=== Fix Broken (0,0) Parking Facility Coordinates ===\n');
  if (dryRun) console.log('  ** DRY RUN - no changes will be written **\n');

  let jsonResult = { fixed: 0, total: 0, unfixable: 0 };
  let dbResult = { fixed: 0, total: 0, unfixable: 0 };

  if (!dbOnly) {
    console.log('--- Fixing facilities_data.json ---');
    jsonResult = fixFacilitiesJson(dryRun);
  }

  if (!jsonOnly) {
    console.log('\n--- Fixing database ---');
    try {
      dbResult = await fixDatabase(dryRun);
    } catch (err) {
      console.log(`  Database fix failed: ${err.message}`);
    }
  }

  console.log('\n=== Summary ===');
  if (!dbOnly) {
    console.log(`  JSON: ${jsonResult.fixed} fixed, ${jsonResult.unfixable} unfixable out of ${jsonResult.total} broken`);
  }
  if (!jsonOnly) {
    console.log(`  DB:   ${dbResult.fixed} fixed, ${dbResult.unfixable} unfixable out of ${dbResult.total} broken`);
  }
  console.log('');
}

// Support both standalone execution and import
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = {
  parseSiteId,
  interpolateCoordinates,
  getFixedCoordinates,
  fixFacilitiesJson,
  fixDatabase,
  INTERSTATE_SEGMENTS,
  KNOWN_COORDINATES
};

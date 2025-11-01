// Estimate GPS coordinates for facilities based on highway and milepost
// Uses approximate calculations based on known interstate endpoints and routing
const Database = require('../database.js');

// Approximate coordinates for key interstate mileposts
// Based on known highway geometry - these are estimates
const HIGHWAY_COORDINATES = {
  // Indiana I-80 (concurrent with I-90, Indiana Toll Road)
  'IN-I80': {
    22: { lat: 41.5833, lon: -87.0625 },   // Mile 22 near Portage
    37: { lat: 41.6167, lon: -86.8333 },   // Mile 37
    56: { lat: 41.6667, lon: -86.5000 },   // Mile 56
    90: { lat: 41.6833, lon: -85.9667 },   // Mile 90 near Elkhart
    108: { lat: 41.7000, lon: -85.7000 },  // Mile 108
    126: { lat: 41.7333, lon: -85.3333 }   // Mile 126 near Angola
  },

  // Kentucky I-65
  'KY-I65': {
    2: { lat: 36.6167, lon: -86.5333 },    // Mile 2 near TN border
    20: { lat: 36.8000, lon: -86.5000 },   // Mile 20
    34: { lat: 36.9667, lon: -86.4667 },   // Mile 34 weigh station
    59: { lat: 37.2833, lon: -85.9167 },   // Mile 59 rest area
    114: { lat: 37.9000, lon: -85.7667 }   // Mile 114 rest area
  },

  // Kentucky I-75
  'KY-I75': {
    1: { lat: 36.5833, lon: -83.7167 },    // Mile 1 near TN border
    10: { lat: 36.7333, lon: -83.7333 },   // Mile 10 welcome center
    33: { lat: 37.0333, lon: -84.0833 },   // Mile 33 weigh station
    34: { lat: 37.0500, lon: -84.0833 },   // Mile 34 weigh station
    75: { lat: 37.6667, lon: -84.2833 },   // Mile 75 Walton weigh station
    168: { lat: 38.9500, lon: -84.5333 },  // Mile 168 Crittenden weigh station
    177: { lat: 39.0667, lon: -84.6167 }   // Mile 177 rest area
  },

  // Minnesota I-35
  'MN-I35': {
    132: { lat: 45.2833, lon: -92.9833 }   // Mile 132 Forest Lake rest area
  },

  // Minnesota I-94
  'MN-I94': {
    100: { lat: 46.0000, lon: -95.3333 },  // Mile 100 Lake Latoka rest area
    152: { lat: 45.5667, lon: -94.4333 },  // Mile 152 Big Spunk Lake rest area
    187: { lat: 45.3000, lon: -93.9000 },  // Mile 187 Enfield rest area
    215: { lat: 45.1167, lon: -93.4667 },  // Mile 215 Elm Creek rest area
    256: { lat: 44.9667, lon: -92.8000 }   // Mile 256 St. Croix rest area
  },

  // Michigan I-94
  'MI-I94': {
    29: { lat: 42.0667, lon: -86.5000 },   // Mile 29 Primarr rest area
    92: { lat: 42.3333, lon: -85.6667 },   // Mile 92 Arlene rest area
    110: { lat: 42.3667, lon: -85.3667 },  // Mile 110 Pioneer rest area
    115: { lat: 42.3833, lon: -85.3000 },  // Mile 115 truck parking
    128: { lat: 42.4167, lon: -85.0667 }   // Mile 128 Parma rest area
  },

  // Colorado I-70
  'CO-I70': {
    405: { lat: 39.7500, lon: -104.9500 }  // Mile 405 Siebert rest area (estimate)
  }
};

// Parse facility ID to extract state, highway, and milepost
function parseFacilityId(facilityId) {
  // Remove tpims-historical- prefix
  const id = facilityId.replace('tpims-historical-', '').toUpperCase();

  // Extract state (first 2 chars)
  const state = id.substring(0, 2);

  // Extract highway number (after state, before IS) - remove leading zeros
  const highwayMatch = id.match(/^[A-Z]{2}0*(\d+)IS/);
  const highway = highwayMatch ? highwayMatch[1] : null;

  // Extract milepost (various formats)
  const mileMatch = id.match(/(\d{3,4})[A-Z]/);
  let milepost = null;
  if (mileMatch) {
    // Convert to actual milepost (divide by 10 if needed)
    const rawMile = parseInt(mileMatch[1]);
    milepost = rawMile > 999 ? Math.floor(rawMile / 10) : rawMile;
  }

  return { state, highway, milepost, rawId: id };
}

// Estimate coordinates based on highway and milepost
function estimateCoordinates(state, highway, milepost) {
  const key = `${state}-I${highway}`;

  if (!HIGHWAY_COORDINATES[key]) {
    console.log(`   ⚠️  No coordinate data for ${key}`);
    return null;
  }

  const mileposts = HIGHWAY_COORDINATES[key];

  // Exact match
  if (mileposts[milepost]) {
    return mileposts[milepost];
  }

  // Find closest mileposts and interpolate
  const knownMiles = Object.keys(mileposts).map(Number).sort((a, b) => a - b);

  // Find surrounding mileposts
  let lowerMile = null;
  let upperMile = null;

  for (let i = 0; i < knownMiles.length; i++) {
    if (knownMiles[i] < milepost) {
      lowerMile = knownMiles[i];
    } else if (knownMiles[i] > milepost && upperMile === null) {
      upperMile = knownMiles[i];
      break;
    }
  }

  // If we have surrounding mileposts, interpolate
  if (lowerMile !== null && upperMile !== null) {
    const lowerCoord = mileposts[lowerMile];
    const upperCoord = mileposts[upperMile];
    const ratio = (milepost - lowerMile) / (upperMile - lowerMile);

    return {
      lat: lowerCoord.lat + (upperCoord.lat - lowerCoord.lat) * ratio,
      lon: lowerCoord.lon + (upperCoord.lon - lowerCoord.lon) * ratio
    };
  }

  // Use nearest milepost if interpolation not possible
  const nearest = knownMiles.reduce((prev, curr) =>
    Math.abs(curr - milepost) < Math.abs(prev - milepost) ? curr : prev
  );

  console.log(`   ℹ️  Using nearest milepost ${nearest} for ${milepost}`);
  return mileposts[nearest];
}

async function estimateFacilityCoordinates() {
  console.log('\n📍 Estimating Facility Coordinates from Highway Mileposts\n');

  const db = new Database.constructor();
  await db.init();

  // Get facilities without coordinates
  const facilities = await db.db.prepare(`
    SELECT facility_id, site_id, state
    FROM parking_facilities
    WHERE (latitude IS NULL OR latitude = 0 OR longitude IS NULL OR longitude = 0)
    AND state IN ('CO', 'IN', 'KY', 'MI', 'MN')
  `).all();

  console.log(`Found ${facilities.length} facilities needing coordinates\n`);

  const updateQuery = db.isPostgres ?
    `UPDATE parking_facilities SET latitude = $1, longitude = $2 WHERE facility_id = $3` :
    `UPDATE parking_facilities SET latitude = ?, longitude = ? WHERE facility_id = ?`;

  let updated = 0;
  let skipped = 0;

  for (const facility of facilities) {
    const parsed = parseFacilityId(facility.facility_id);
    console.log(`\n${facility.facility_id}`);
    console.log(`   State: ${parsed.state}, Highway: I-${parsed.highway}, Milepost: ${parsed.milepost}`);

    if (!parsed.highway || !parsed.milepost) {
      console.log(`   ⚠️  Could not parse milepost from facility ID`);
      skipped++;
      continue;
    }

    const coords = estimateCoordinates(parsed.state, parsed.highway, parsed.milepost);

    if (!coords) {
      console.log(`   ⚠️  No coordinate estimate available`);
      skipped++;
      continue;
    }

    // Round to 4 decimal places (~11m precision)
    const lat = Math.round(coords.lat * 10000) / 10000;
    const lon = Math.round(coords.lon * 10000) / 10000;

    const stmt = db.db.prepare(updateQuery);
    await stmt.run(lat, lon, facility.facility_id);

    console.log(`   ✅ Estimated: ${lat}, ${lon}`);
    updated++;
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${facilities.length}\n`);

  // Verify
  const withCoords = await db.db.prepare(`
    SELECT COUNT(*) as count
    FROM parking_facilities
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0 AND longitude != 0
  `).get();

  const total = await db.db.prepare('SELECT COUNT(*) as count FROM parking_facilities').get();

  console.log(`✅ ${withCoords.count}/${total.count} facilities now have coordinates\n`);

  if (require.main === module) {
    process.exit(0);
  }
}

if (require.main === module) {
  estimateFacilityCoordinates().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { estimateFacilityCoordinates };

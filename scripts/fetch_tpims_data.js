// Fetch real-time truck parking data from TPIMS feeds
// These feeds provide ground truth for validating predictions

const Database = require('../database.js');
const https = require('https');
const http = require('http');

const db = new Database.constructor();

// TPIMS data sources
// MAASTO partnership states use the same JSON format (Dynamic/Static)
// Indiana uses GeoJSON — handled by the preprocessor below
const TPIMS_FEEDS = [
  {
    name: 'TRIMARC TPIMS (Kentucky)',
    url: 'http://www.trimarc.org/dat/tpims/TPIMS_Dynamic.json',
    staticUrl: 'http://www.trimarc.org/dat/tpims/TPIMS_Static.json',
    state: 'KY',
    protocol: http
  },
  {
    name: 'Minnesota DOT TPIMS',
    url: 'http://iris.dot.state.mn.us/iris/TPIMS_dynamic',
    staticUrl: 'http://iris.dot.state.mn.us/iris/TPIMS_static',
    state: 'MN',
    protocol: http
  },
  {
    name: 'Ohio TPIMS',
    url: 'https://publicapi.ohgo.com/api/v1/truck-parking',
    state: 'OH',
    protocol: https,
    requiresApiKey: true,
    headers: {
      // Register at https://publicapi.ohgo.com/accounts/registration
      'Authorization': process.env.OHIO_API_KEY ? `Bearer ${process.env.OHIO_API_KEY}` : ''
    }
  },
  {
    name: 'Illinois TPIMS',
    url: 'https://truckparking.travelmidwest.com/TPIMS_Dynamic.json',
    staticUrl: 'https://truckparking.travelmidwest.com/TPIMS_Static.json',
    state: 'IL',
    protocol: https
  },
  {
    name: 'Indiana TPIMS',
    url: 'https://content.trafficwise.org/json/tpims.json',
    staticUrl: 'https://content.trafficwise.org/json/rest_area.json',
    state: 'IN',
    protocol: https,
    // Indiana returns GeoJSON FeatureCollection — preprocess into standard format
    preprocess: (data) => {
      if (!data || !data.features) return [];
      return data.features
        .filter(f => f.properties && f.geometry)
        .map(f => {
          const p = f.properties;
          const coords = f.geometry.coordinates || [0, 0];
          // Parse available spaces from message fields (e.g., "Spaces Available: 12")
          let available = 0;
          const msg = (p.message1 || '') + ' ' + (p.message2 || '') + ' ' + (p.message3 || '');
          const spaceMatch = msg.match(/(\d+)\s*(?:spaces?|spots?|available)/i);
          if (spaceMatch) available = parseInt(spaceMatch[1]);
          // Also check TPIMS sub-object in static data
          const tpims = p.tpims || {};
          return {
            siteId: p.device_nbr || p.title || f.id,
            name: p.title || tpims.city || 'Unknown',
            latitude: coords[1] || tpims.latitude,
            longitude: coords[0] || tpims.longitude,
            capacity: tpims.capacity || parseInt(p.capacity) || 0,
            reportedAvailable: tpims.spaces_available ?? available,
            address: tpims.address || p.route || '',
            type: 'Rest Area',
            amenities: p.amenities || tpims.amenities || null
          };
        });
    }
  },
  {
    name: 'Kansas TPIMS',
    url: 'https://tpims.ksdot.gov/api/dynamic',
    staticUrl: 'https://tpims.ksdot.gov/api/static',
    state: 'KS',
    protocol: https,
    requiresApiKey: true,
    headers: {
      // Register at https://tpims.ksdot.gov/account/register
      'Cookie': process.env.KS_TPIMS_COOKIE || ''
    }
  },
  {
    name: 'Wisconsin TPIMS',
    url: 'https://511wi.gov/api/TPIMS_Dynamic?format=Json',
    staticUrl: 'https://511wi.gov/api/TPIMS_Static?format=Json',
    state: 'WI',
    protocol: https,
    requiresApiKey: true,
    headers: {
      // Register at https://511wi.gov/developers/doc and request API key
    },
    // Append API key to URL if available
    getUrl: () => {
      const key = process.env.WI_TPIMS_KEY;
      if (!key) return null;
      return `https://511wi.gov/api/TPIMS_Dynamic?format=Json&key=${key}`;
    }
  }
];

async function fetchJSON(url, protocol = https, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers
    };

    const request = protocol.request(options, (res) => {
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

    request.on('error', (error) => {
      reject(new Error(`HTTP request failed for ${url}: ${error.message}`));
    });

    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error(`Request timeout for ${url}`));
    });

    request.end();
  });
}

async function fetchTPIMSFeed(feed) {
  console.log(`\n🚛 Fetching ${feed.name}...`);

  // Determine the URL (some feeds have dynamic URL builders)
  const url = feed.getUrl ? feed.getUrl() : feed.url;

  // Check if API key is required but missing
  if (feed.requiresApiKey && !url) {
    console.warn(`  ⚠️  ${feed.name} requires credentials. Set the appropriate env variable.`);
    return { imported: 0, updated: 0, failed: 0 };
  }

  try {
    const data = await fetchJSON(url, feed.protocol, feed.headers || {});

    console.log(`✅ Retrieved data from ${feed.name}`);

    let sites;

    // If feed has a custom preprocessor (e.g., Indiana GeoJSON), use it
    if (feed.preprocess) {
      sites = feed.preprocess(data);
    }
    // Check if data is directly an array (TRIMARC/MAASTO format)
    else if (Array.isArray(data)) {
      sites = data;
    }
    // Or check if data has nested structure
    else if (typeof data === 'object') {
      sites = data.results || data.tpims_data || data.sites || data.facilities || data.parking_sites || [];

      // If still not an array, try to find any array in the object
      if (!Array.isArray(sites)) {
        const possibleArrays = Object.values(data).filter(v => Array.isArray(v));
        if (possibleArrays.length > 0) {
          sites = possibleArrays[0];
        }
      }
    }

    if (!Array.isArray(sites)) {
      console.warn(`⚠️  Unknown data structure from ${feed.name}`);
      console.log('Data structure:', JSON.stringify(data, null, 2).substring(0, 500));
      return { imported: 0, updated: 0, failed: 0 };
    }

    // Also fetch static data if available (for coordinates, capacity, amenities)
    if (feed.staticUrl && !feed.requiresApiKey) {
      try {
        const staticData = await fetchJSON(feed.staticUrl, feed.protocol, feed.headers || {});
        const staticSites = Array.isArray(staticData) ? staticData :
          (staticData?.features || staticData?.results || staticData?.sites || []);

        // Merge static data into dynamic sites (by siteId)
        if (Array.isArray(staticSites)) {
          const staticMap = new Map();
          for (const ss of staticSites) {
            const id = ss.siteId || ss.site_id || ss.Id || ss.properties?.siteId;
            if (id) staticMap.set(id, ss);
          }
          for (const site of sites) {
            const id = site.siteId || site.site_id || site.Id;
            const ss = staticMap.get(id);
            if (ss) {
              // Fill in missing fields from static data
              // Handle nested location object (Illinois format: { location: { latitude, longitude, streetAdr } })
              const loc = ss.location || {};
              if (!site.latitude && (ss.latitude || ss.Latitude || loc.latitude)) site.latitude = ss.latitude || ss.Latitude || loc.latitude;
              if (!site.longitude && (ss.longitude || ss.Longitude || loc.longitude)) site.longitude = ss.longitude || ss.Longitude || loc.longitude;
              if (!site.name && (ss.name || ss.Name)) site.name = ss.name || ss.Name;
              if (!site.capacity && (ss.capacity || ss.Capacity)) site.capacity = ss.capacity || ss.Capacity;
              if (!site.address && (ss.streetAdr || ss.address || loc.streetAdr)) site.address = ss.streetAdr || ss.address || loc.streetAdr;
              if (!site.amenities && ss.amenities) site.amenities = ss.amenities;
              if (!site.relevantHighway && ss.relevantHighway) site.relevantHighway = ss.relevantHighway;
              if (!site.directionOfTravel && ss.directionOfTravel) site.directionOfTravel = ss.directionOfTravel;
              if (!site.referencePost && ss.referencePost) site.referencePost = ss.referencePost;
            }
          }
          console.log(`  📋 Merged static data for ${staticMap.size} sites`);
        }
      } catch (staticErr) {
        console.warn(`  ⚠️  Could not fetch static data: ${staticErr.message}`);
      }
    }

    return processSites(sites, feed);

  } catch (error) {
    console.error(`❌ Failed to fetch ${feed.name}:`, error.message);
    return { imported: 0, updated: 0, failed: 0 };
  }
}

function processSites(sites, feed) {
  console.log(`📦 Processing ${sites.length} sites from ${feed.name}`);

  let imported = 0;
  let updated = 0;
  let failed = 0;

  for (const site of sites) {
    try {
      // Extract facility information
      // TPIMS fields vary, try common field names
      const facilityId = site.Id || site.siteId || site.site_id || site.id || site.facility_id || site.name?.replace(/\s+/g, '-').toLowerCase();
      const facilityName = site.location || site.Location || site.Description || site.site_name || site.name || site.facility_name || facilityId;
      const latitude = parseFloat(site.Latitude || site.lat || site.latitude || site.y || 0);
      const longitude = parseFloat(site.Longitude || site.lon || site.longitude || site.long || site.x || 0);

      if (!facilityId) {
        console.warn(`⚠️  Skipping site with missing ID`);
        failed++;
        continue;
      }

      // Skip sites without coordinates for now
      // (TRIMARC doesn't provide coordinates, only availability updates)
      if (isNaN(latitude) || isNaN(longitude) || (latitude === 0 && longitude === 0)) {
        // For now, skip sites without coordinates
        // TODO: Match against a static facility database with coordinates
        failed++;
        continue;
      }

      // Availability data - handle different field names and formats
      const totalSpaces = parseInt(site.Capacity || site.capacity || site.total_spaces || site.total_truck_spaces || 0);

      // reportedAvailable can be "LOW", "HIGH", or a number
      let availableSpaces = 0;
      const reported = site.ReportedAvailable || site.reportedAvailable || site.available_spaces || site.spaces_available || site.available;
      if (typeof reported === 'string') {
        if (reported === 'LOW' || reported.toLowerCase() === 'low') {
          availableSpaces = Math.floor(totalSpaces * 0.1); // Assume 10% when LOW
        } else if (reported === 'HIGH' || reported.toLowerCase() === 'high') {
          availableSpaces = Math.floor(totalSpaces * 0.9); // Assume 90% when HIGH
        } else {
          availableSpaces = parseInt(reported) || 0;
        }
      } else {
        availableSpaces = parseInt(reported) || 0;
      }
      const occupiedSpaces = parseInt(site.occupied_spaces || site.spaces_occupied || (totalSpaces - availableSpaces) || 0);

      // Add/update facility
      const facilityData = {
        facilityId: `tpims-${feed.state.toLowerCase()}-${facilityId}`,
        facilityName: facilityName,
        state: feed.state,
        latitude: latitude,
        longitude: longitude,
        address: site.Address || site.address || site.location || null,
        totalSpaces: totalSpaces || null,
        truckSpaces: totalSpaces || null,
        amenities: site.amenities || null,
        facilityType: site.type || 'Rest Area'
      };

      const facilityResult = db.addParkingFacility(facilityData);

      if (facilityResult.success) {
        // Add real-time availability data
        const availabilityResult = db.addParkingAvailability({
          facilityId: facilityData.facilityId,
          availableSpaces: availableSpaces,
          occupiedSpaces: occupiedSpaces,
          isPrediction: false, // This is real data!
          predictionConfidence: null
        });

        if (availabilityResult.success) {
          updated++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }

    } catch (error) {
      failed++;
      console.error(`❌ Error processing site:`, error.message);
    }
  }

  console.log(`\n${feed.name} Results:`);
  console.log(`  ✅ Facilities updated: ${updated}`);
  console.log(`  ❌ Failed: ${failed}`);

  return { imported, updated, failed };
}

async function validatePredictions() {
  console.log('\n🔍 Validating predictions against real-time data...\n');

  const facilities = db.getParkingFacilities();
  let validationResults = {
    total: 0,
    accurate: 0,
    errors: []
  };

  for (const facility of facilities) {
    // Get latest actual data (not prediction)
    const history = db.getParkingHistory(facility.facilityId, 1);
    const actual = history.find(h => !h.isPrediction);

    if (!actual) continue;

    // Get latest prediction made before this actual data
    const predictions = history.filter(h =>
      h.isPrediction &&
      new Date(h.timestamp) < new Date(actual.timestamp)
    );

    if (predictions.length === 0) continue;

    const prediction = predictions[0];

    // Calculate accuracy
    const error = Math.abs(prediction.availableSpaces - actual.availableSpaces);
    const percentError = actual.availableSpaces > 0
      ? (error / actual.availableSpaces) * 100
      : 0;

    // Record accuracy in database for machine learning
    db.recordPredictionAccuracy(
      facility.facilityId,
      prediction.availableSpaces,
      actual.availableSpaces,
      false // No way to know if event was nearby from historical data
    );

    validationResults.total++;

    if (percentError < 20) { // Within 20% is considered accurate
      validationResults.accurate++;
    }

    validationResults.errors.push({
      facilityId: facility.facilityId,
      facilityName: facility.facilityName,
      predicted: prediction.availableSpaces,
      actual: actual.availableSpaces,
      error: error,
      percentError: percentError.toFixed(1)
    });
  }

  if (validationResults.total > 0) {
    const accuracy = (validationResults.accurate / validationResults.total * 100).toFixed(1);

    console.log(`\n📊 Prediction Validation Results:`);
    console.log(`  Total comparisons: ${validationResults.total}`);
    console.log(`  Accurate predictions: ${validationResults.accurate}`);
    console.log(`  Overall accuracy: ${accuracy}%`);
    console.log(`\n  Top errors:`);

    validationResults.errors
      .sort((a, b) => b.percentError - a.percentError)
      .slice(0, 5)
      .forEach(e => {
        console.log(`    ${e.facilityName}: predicted ${e.predicted}, actual ${e.actual} (${e.percentError}% error)`);
      });
  } else {
    console.log('  No predictions to validate yet');
  }

  // Update occupancy patterns based on latest real data
  console.log('\n📈 Updating occupancy patterns from validated data...');
  const patternResult = db.updateOccupancyPatterns();
  if (patternResult.success && patternResult.patternsUpdated > 0) {
    console.log(`  ✅ Updated ${patternResult.patternsUpdated} time-based patterns`);
  }

  return validationResults;
}

async function main() {
  console.log('🚀 Starting TPIMS data fetch...\n');

  const allResults = {
    imported: 0,
    updated: 0,
    failed: 0
  };

  // Fetch all TPIMS feeds
  for (const feed of TPIMS_FEEDS) {
    const results = await fetchTPIMSFeed(feed);
    allResults.imported += results.imported;
    allResults.updated += results.updated;
    allResults.failed += results.failed;
  }

  console.log('\n\n📈 Overall Results:');
  console.log(`  Total facilities updated: ${allResults.updated}`);
  console.log(`  Failed: ${allResults.failed}`);

  // Validate predictions if we have data
  if (allResults.updated > 0) {
    await validatePredictions();
  }

  db.close();
  console.log('\n✅ Database connection closed');
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    db.close();
    process.exit(1);
  });
}

module.exports = { fetchTPIMSFeed, validatePredictions };

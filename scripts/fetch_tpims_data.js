// Fetch real-time truck parking data from TPIMS feeds
// These feeds provide ground truth for validating predictions

const Database = require('../database.js');
const https = require('https');
const http = require('http');

const db = new Database.constructor();

// TPIMS data sources
const TPIMS_FEEDS = [
  {
    name: 'TRIMARC TPIMS',
    url: 'http://www.trimarc.org/dat/tpims/TPIMS_Dynamic.json',
    state: 'KY', // Kentucky
    protocol: http
  },
  {
    name: 'Minnesota DOT TPIMS',
    url: 'http://iris.dot.state.mn.us/iris/TPIMS_dynamic',
    state: 'MN',
    protocol: http
  }
];

async function fetchJSON(url, protocol = https) {
  return new Promise((resolve, reject) => {
    const request = protocol.get(url, (res) => {
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
  });
}

async function fetchTPIMSFeed(feed) {
  console.log(`\n🚛 Fetching ${feed.name}...`);

  try {
    const data = await fetchJSON(feed.url, feed.protocol);

    console.log(`✅ Retrieved data from ${feed.name}`);

    // Parse TPIMS data structure
    // TPIMS typically has an array of sites with parking info
    const sites = data.tpims_data || data.sites || data.facilities || [];

    if (!Array.isArray(sites) && typeof data === 'object') {
      // Some feeds might have nested structure
      const possibleArrays = Object.values(data).filter(v => Array.isArray(v));
      if (possibleArrays.length > 0) {
        return processSites(possibleArrays[0], feed);
      }
    }

    if (!Array.isArray(sites)) {
      console.warn(`⚠️  Unknown data structure from ${feed.name}`);
      console.log('Data structure:', JSON.stringify(data, null, 2).substring(0, 500));
      return { imported: 0, updated: 0, failed: 0 };
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
      const facilityId = site.site_id || site.id || site.facility_id || site.name?.replace(/\s+/g, '-').toLowerCase();
      const facilityName = site.site_name || site.name || site.facility_name || `Unknown Site ${facilityId}`;
      const latitude = parseFloat(site.lat || site.latitude || site.y);
      const longitude = parseFloat(site.lon || site.longitude || site.long || site.x);

      if (!facilityId || isNaN(latitude) || isNaN(longitude)) {
        console.warn(`⚠️  Skipping site with missing data:`, site.site_name || site.name || 'Unknown');
        failed++;
        continue;
      }

      // Availability data
      const totalSpaces = parseInt(site.total_spaces || site.capacity || site.total_truck_spaces || 0);
      const availableSpaces = parseInt(site.available_spaces || site.spaces_available || site.available || 0);
      const occupiedSpaces = parseInt(site.occupied_spaces || site.spaces_occupied || (totalSpaces - availableSpaces) || 0);

      // Add/update facility
      const facilityData = {
        facilityId: `tpims-${feed.state.toLowerCase()}-${facilityId}`,
        facilityName: facilityName,
        state: feed.state,
        latitude: latitude,
        longitude: longitude,
        address: site.address || site.location || null,
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

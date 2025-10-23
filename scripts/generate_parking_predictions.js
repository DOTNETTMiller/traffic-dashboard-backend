// Generate truck parking availability predictions
// Uses historical patterns + nearby events to predict availability

const Database = require('../database.js');
const https = require('https');
const http = require('http');

const db = new Database.constructor();

// Haversine distance calculation (in miles)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Fetch events from backend API
async function fetchNearbyEvents() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/events',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          resolve([]); // Return empty array if parse fails
        }
      });
    });

    req.on('error', () => resolve([])); // Return empty array on error
    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });
    req.end();
  });
}

async function generatePredictions() {
  console.log('🔮 Generating parking availability predictions...\n');

  try {
    // Step 1: Update occupancy patterns from historical data
    console.log('📊 Updating occupancy patterns from historical data...');
    const patternResult = db.updateOccupancyPatterns();
    if (patternResult.success) {
      console.log(`  ✅ Updated ${patternResult.patternsUpdated} patterns\n`);
    } else {
      console.log(`  ⚠️  No patterns updated (need at least 3 samples per time slot)\n`);
    }

    // Step 2: Fetch nearby events
    console.log('🚦 Fetching traffic events...');
    const allEvents = await fetchNearbyEvents();
    console.log(`  ✅ Found ${allEvents.length} active events\n`);

    // Step 3: Generate predictions for each facility
    console.log('🎯 Generating predictions...\n');
    const facilities = db.getParkingFacilities();
    let predictionsGenerated = 0;
    let predictionsWithEvents = 0;

    for (const facility of facilities) {
      // Find nearby events (within 50 miles)
      const nearbyEvents = allEvents
        .filter(event => {
          if (!event.coordinates) return false;
          const [lon, lat] = event.coordinates;
          const distance = calculateDistance(
            facility.latitude,
            facility.longitude,
            lat,
            lon
          );
          return distance <= 50;
        })
        .map(event => {
          const [lon, lat] = event.coordinates;
          return {
            ...event,
            distance: calculateDistance(
              facility.latitude,
              facility.longitude,
              lat,
              lon
            )
          };
        })
        .sort((a, b) => a.distance - b.distance);

      // Generate prediction
      const prediction = db.getPredictedAvailability(
        facility.facilityId,
        null, // Use current time
        nearbyEvents
      );

      if (prediction) {
        // Add prediction to database
        db.addParkingAvailability({
          facilityId: facility.facilityId,
          availableSpaces: prediction.predictedAvailable,
          occupiedSpaces: prediction.predictedOccupied,
          isPrediction: true,
          predictionConfidence: prediction.confidence
        });

        predictionsGenerated++;
        if (nearbyEvents.length > 0) {
          predictionsWithEvents++;
        }

        // Log interesting predictions
        if (nearbyEvents.length > 0 || !prediction.hasPattern) {
          const status = prediction.hasPattern ? '📈 Pattern-based' : '📊 Baseline';
          const eventInfo = nearbyEvents.length > 0
            ? ` (${nearbyEvents.length} events nearby)`
            : '';

          console.log(`  ${status} ${facility.facilityName}: ${prediction.predictedAvailable}/${prediction.totalSpaces} available (${Math.round(prediction.confidence * 100)}% confidence)${eventInfo}`);

          if (nearbyEvents.length > 0) {
            nearbyEvents.slice(0, 2).forEach(event => {
              console.log(`    🚧 ${event.headline} (${Math.round(event.distance)} mi away)`);
            });
          }
        }
      }
    }

    console.log(`\n✅ Generated ${predictionsGenerated} predictions`);
    if (predictionsWithEvents > 0) {
      console.log(`  🚦 ${predictionsWithEvents} predictions adjusted for nearby events`);
    }

    // Step 4: Show prediction accuracy stats (if we have any validation data)
    const accuracyStats = db.getPredictionAccuracyStats(null, 7);
    if (accuracyStats.length > 0) {
      console.log('\n📈 Prediction Accuracy (Last 7 Days):');
      accuracyStats.forEach(stat => {
        console.log(`  ${stat.facilityId}: ${stat.accuracyRate}% accurate (${stat.totalPredictions} predictions, avg error: ${stat.avgPercentError}%)`);
      });
    }

  } catch (error) {
    console.error('❌ Error generating predictions:', error.message);
  }
}

// Main execution
if (require.main === module) {
  generatePredictions().then(() => {
    console.log('\n✅ Prediction generation complete');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { generatePredictions };

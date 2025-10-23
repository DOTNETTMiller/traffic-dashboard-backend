// Truck Parking Availability Prediction Engine
// Uses historical data and time patterns to predict parking availability

const Database = require('./database.js');

class ParkingPredictor {
  constructor(db) {
    this.db = db;
  }

  /**
   * Predict parking availability for a facility
   * @param {string} facilityId - The facility ID
   * @param {Date} targetTime - Time to predict for (defaults to now)
   * @returns {Object} Prediction with confidence score
   */
  predictAvailability(facilityId, targetTime = new Date()) {
    // Get historical data for the past 7 days
    const history = this.db.getParkingHistory(facilityId, 24 * 7);

    if (history.length === 0) {
      return {
        success: false,
        error: 'No historical data available for prediction'
      };
    }

    // Extract time-based patterns
    const hour = targetTime.getHours();
    const dayOfWeek = targetTime.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Filter historical data for similar time periods
    const similarTimeData = history.filter(record => {
      const recordTime = new Date(record.timestamp);
      const recordHour = recordTime.getHours();
      const recordDayOfWeek = recordTime.getDay();
      const recordIsWeekend = recordDayOfWeek === 0 || recordDayOfWeek === 6;

      // Match within +/- 2 hours and same weekend/weekday category
      return Math.abs(recordHour - hour) <= 2 && recordIsWeekend === isWeekend;
    });

    if (similarTimeData.length === 0) {
      // Fall back to overall average
      return this.predictFromOverallAverage(history);
    }

    // Calculate average availability for similar time periods
    const avgAvailable = similarTimeData.reduce((sum, r) => sum + r.availableSpaces, 0) / similarTimeData.length;
    const avgOccupied = similarTimeData.reduce((sum, r) => sum + r.occupiedSpaces, 0) / similarTimeData.length;

    // Calculate standard deviation for confidence score
    const variance = similarTimeData.reduce((sum, r) => {
      return sum + Math.pow(r.availableSpaces - avgAvailable, 2);
    }, 0) / similarTimeData.length;
    const stdDev = Math.sqrt(variance);

    // Confidence score: higher when variance is low and sample size is good
    const sampleSizeScore = Math.min(similarTimeData.length / 20, 1); // Max at 20 samples
    const varianceScore = Math.max(0, 1 - (stdDev / avgAvailable)); // Lower variance = higher score
    const confidence = (sampleSizeScore * 0.5 + varianceScore * 0.5);

    return {
      success: true,
      prediction: {
        availableSpaces: Math.round(avgAvailable),
        occupiedSpaces: Math.round(avgOccupied),
        confidence: parseFloat(confidence.toFixed(2)),
        basedOnSamples: similarTimeData.length,
        predictedFor: targetTime.toISOString(),
        model: 'time-pattern-based'
      }
    };
  }

  /**
   * Fallback prediction using overall historical average
   */
  predictFromOverallAverage(history) {
    const avgAvailable = history.reduce((sum, r) => sum + r.availableSpaces, 0) / history.length;
    const avgOccupied = history.reduce((sum, r) => sum + r.occupiedSpaces, 0) / history.length;

    return {
      success: true,
      prediction: {
        availableSpaces: Math.round(avgAvailable),
        occupiedSpaces: Math.round(avgOccupied),
        confidence: 0.3, // Low confidence for overall average
        basedOnSamples: history.length,
        model: 'overall-average'
      }
    };
  }

  /**
   * Predict availability for all facilities
   * @returns {Array} Predictions for all facilities
   */
  predictAllFacilities(targetTime = new Date()) {
    const facilities = this.db.getParkingFacilities();
    const predictions = [];

    for (const facility of facilities) {
      const prediction = this.predictAvailability(facility.facilityId, targetTime);

      if (prediction.success) {
        predictions.push({
          facilityId: facility.facilityId,
          facilityName: facility.facilityName,
          state: facility.state,
          latitude: facility.latitude,
          longitude: facility.longitude,
          truckSpaces: facility.truckSpaces,
          ...prediction.prediction
        });
      }
    }

    return predictions;
  }

  /**
   * Generate predictions and save to database
   * This should be run periodically (e.g., every hour)
   */
  generateAndStorePredictions() {
    console.log('🔮 Generating parking availability predictions...');

    const predictions = this.predictAllFacilities();
    let stored = 0;
    let failed = 0;

    for (const pred of predictions) {
      const result = this.db.addParkingAvailability({
        facilityId: pred.facilityId,
        availableSpaces: pred.availableSpaces,
        occupiedSpaces: pred.occupiedSpaces,
        isPrediction: true,
        predictionConfidence: pred.confidence
      });

      if (result.success) {
        stored++;
      } else {
        failed++;
        console.error(`❌ Failed to store prediction for ${pred.facilityName}`);
      }
    }

    console.log(`✅ Stored ${stored} predictions, ${failed} failed`);
    return { stored, failed, total: predictions.length };
  }

  /**
   * Analyze utilization patterns for a facility
   * Returns insights about peak times, average occupancy, etc.
   */
  analyzeUtilizationPattern(facilityId, days = 7) {
    const history = this.db.getParkingHistory(facilityId, days * 24);

    if (history.length === 0) {
      return { error: 'No data available' };
    }

    // Group by hour of day
    const hourlyData = Array(24).fill(null).map(() => ({ samples: [], total: 0 }));

    history.forEach(record => {
      const time = new Date(record.timestamp);
      const hour = time.getHours();
      hourlyData[hour].samples.push(record.occupiedSpaces);
      hourlyData[hour].total += record.occupiedSpaces;
    });

    // Calculate hourly averages
    const hourlyAverages = hourlyData.map((data, hour) => ({
      hour,
      avgOccupied: data.samples.length > 0 ? data.total / data.samples.length : 0,
      samples: data.samples.length
    }));

    // Find peak hours (top 3)
    const peakHours = [...hourlyAverages]
      .sort((a, b) => b.avgOccupied - a.avgOccupied)
      .slice(0, 3)
      .map(h => h.hour);

    // Overall statistics
    const totalOccupied = history.reduce((sum, r) => sum + r.occupiedSpaces, 0);
    const avgOccupancy = totalOccupied / history.length;

    return {
      facilityId,
      analysisWindow: `${days} days`,
      totalDataPoints: history.length,
      avgOccupancy: Math.round(avgOccupancy),
      peakHours,
      hourlyAverages: hourlyAverages.filter(h => h.samples > 0)
    };
  }

  /**
   * Find available parking near a location
   * @param {number} latitude
   * @param {number} longitude
   * @param {number} radiusKm - Search radius in kilometers
   * @param {number} minAvailable - Minimum available spaces needed
   */
  findAvailableNearby(latitude, longitude, radiusKm = 50, minAvailable = 1) {
    const allAvailability = this.db.getLatestParkingAvailability();

    // Calculate distance and filter
    const nearby = allAvailability
      .map(facility => {
        const distance = this.calculateDistance(
          latitude, longitude,
          facility.latitude, facility.longitude
        );

        return { ...facility, distance };
      })
      .filter(f => f.distance <= radiusKm && f.availableSpaces >= minAvailable)
      .sort((a, b) => a.distance - b.distance);

    return nearby;
  }

  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
}

// Export for use in other modules
module.exports = ParkingPredictor;

// CLI usage
if (require.main === module) {
  const db = new Database.constructor();
  const predictor = new ParkingPredictor(db);

  const command = process.argv[2];

  switch (command) {
    case 'predict':
      const facilityId = process.argv[3];
      if (!facilityId) {
        console.error('Usage: node parking_prediction.js predict <facilityId>');
        process.exit(1);
      }
      const result = predictor.predictAvailability(facilityId);
      console.log(JSON.stringify(result, null, 2));
      break;

    case 'predict-all':
      predictor.generateAndStorePredictions();
      break;

    case 'analyze':
      const analyzeFacilityId = process.argv[3];
      if (!analyzeFacilityId) {
        console.error('Usage: node parking_prediction.js analyze <facilityId>');
        process.exit(1);
      }
      const analysis = predictor.analyzeUtilizationPattern(analyzeFacilityId);
      console.log(JSON.stringify(analysis, null, 2));
      break;

    case 'nearby':
      const lat = parseFloat(process.argv[3]);
      const lon = parseFloat(process.argv[4]);
      const radius = parseFloat(process.argv[5]) || 50;
      if (isNaN(lat) || isNaN(lon)) {
        console.error('Usage: node parking_prediction.js nearby <lat> <lon> [radius]');
        process.exit(1);
      }
      const nearby = predictor.findAvailableNearby(lat, lon, radius);
      console.log(JSON.stringify(nearby, null, 2));
      break;

    default:
      console.log('Available commands:');
      console.log('  predict <facilityId>        - Predict availability for a facility');
      console.log('  predict-all                 - Generate predictions for all facilities');
      console.log('  analyze <facilityId>        - Analyze utilization patterns');
      console.log('  nearby <lat> <lon> [radius] - Find available parking nearby');
      break;
  }

  db.close();
}

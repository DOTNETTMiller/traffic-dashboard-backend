// Truck Parking Prediction Service
// Uses historical patterns to predict parking availability

const fs = require('fs');
const path = require('path');

class TruckParkingService {
  constructor() {
    this.patterns = null;
    this.facilities = null;
    this.loaded = false;
  }

  // Load patterns from processed historical data
  loadPatterns() {
    try {
      const dataPath = path.join(__dirname, 'data/truck_parking_patterns.json');

      if (!fs.existsSync(dataPath)) {
        console.log('⚠️  No parking patterns file found. Run: node scripts/process_truck_parking_historical.js');
        return false;
      }

      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      this.facilities = new Map(data.facilities.map(f => [f.facilityId, f]));

      // Index patterns by facility and time
      this.patterns = new Map();
      for (const pattern of data.patterns) {
        const key = `${pattern.facilityId}-${pattern.dayOfWeek}-${pattern.hour}`;
        this.patterns.set(key, pattern);
      }

      this.loaded = true;
      console.log(`✅ Loaded ${this.facilities.size} parking facilities with ${this.patterns.size} time-based patterns`);
      return true;

    } catch (error) {
      console.error('❌ Error loading parking patterns:', error.message);
      return false;
    }
  }

  // Get prediction for a specific facility at a specific time
  predictAvailability(facilityId, targetTime = new Date()) {
    if (!this.loaded) {
      return {
        success: false,
        error: 'Parking prediction service not initialized'
      };
    }

    const facility = this.facilities.get(facilityId);
    if (!facility) {
      return {
        success: false,
        error: 'Facility not found'
      };
    }

    const dayOfWeek = targetTime.getDay();
    const hour = targetTime.getHours();

    // Try exact match first
    let pattern = this.patterns.get(`${facilityId}-${dayOfWeek}-${hour}`);

    // If no exact match, try adjacent hours
    if (!pattern) {
      const prevHour = hour === 0 ? 23 : hour - 1;
      const nextHour = hour === 23 ? 0 : hour + 1;

      pattern = this.patterns.get(`${facilityId}-${dayOfWeek}-${prevHour}`) ||
               this.patterns.get(`${facilityId}-${dayOfWeek}-${nextHour}`);
    }

    if (!pattern) {
      return {
        success: false,
        error: 'No historical pattern available for this time'
      };
    }

    // Calculate predicted available spaces
    const predictedAvailable = Math.round(pattern.capacity * (1 - pattern.avgOccupancyRate));

    // Calculate confidence based on sample count
    let confidence = 'low';
    if (pattern.sampleCount >= 100) confidence = 'high';
    else if (pattern.sampleCount >= 30) confidence = 'medium';

    // Determine status
    let status = 'available';
    if (pattern.avgOccupancyRate > 0.9) status = 'full';
    else if (pattern.avgOccupancyRate > 0.7) status = 'limited';

    return {
      success: true,
      prediction: {
        facilityId,
        siteId: facility.siteId,
        state: facility.state,
        capacity: pattern.capacity,
        predictedAvailable,
        predictedOccupied: pattern.capacity - predictedAvailable,
        occupancyRate: pattern.avgOccupancyRate,
        status,
        confidence,
        sampleCount: pattern.sampleCount,
        predictedFor: targetTime.toISOString(),
        dayOfWeek,
        hour
      }
    };
  }

  // Get predictions for all facilities
  predictAll(targetTime = new Date()) {
    if (!this.loaded) {
      return { success: false, error: 'Service not initialized' };
    }

    const predictions = [];
    const alerts = [];

    for (const [facilityId] of this.facilities) {
      const result = this.predictAvailability(facilityId, targetTime);
      if (result.success) {
        predictions.push(result.prediction);

        // Check for low parking availability (5 or fewer spaces)
        if (result.prediction.predictedAvailable <= 5 && result.prediction.predictedAvailable >= 0) {
          alerts.push({
            facilityId: result.prediction.facilityId,
            facilityName: result.prediction.siteId,
            state: result.prediction.state,
            availableSpaces: result.prediction.predictedAvailable,
            severity: result.prediction.predictedAvailable === 0 ? 'critical' : 'warning',
            message: result.prediction.predictedAvailable === 0
              ? `🅿️ PARKING FULL at ${result.prediction.siteId}`
              : `🅿️ PARKING LIMITED at ${result.prediction.siteId} - Only ${result.prediction.predictedAvailable} space${result.prediction.predictedAvailable === 1 ? '' : 's'} available`,
            timestamp: targetTime.toISOString()
          });
        }
      }
    }

    return {
      success: true,
      predictions,
      alerts,
      predictedFor: targetTime.toISOString(),
      count: predictions.length,
      alertCount: alerts.length
    };
  }

  // Get facilities near a location
  getFacilitiesNear(latitude, longitude, radiusMiles = 50) {
    if (!this.loaded) {
      return { success: false, error: 'Service not initialized' };
    }

    const results = [];

    for (const [facilityId, facility] of this.facilities) {
      // For now, return all facilities since we don't have coordinates yet
      // TODO: Add coordinate matching from TruckStopsExport.xlsx

      const prediction = this.predictAvailability(facilityId);
      if (prediction.success) {
        results.push({
          ...facility,
          ...prediction.prediction,
          distance: null // Will be calculated when coordinates are added
        });
      }
    }

    return {
      success: true,
      facilities: results,
      count: results.length
    };
  }

  // Get facilities by state
  getFacilitiesByState(state) {
    if (!this.loaded) {
      return { success: false, error: 'Service not initialized' };
    }

    const results = [];

    for (const [facilityId, facility] of this.facilities) {
      if (facility.state === state.toUpperCase()) {
        const prediction = this.predictAvailability(facilityId);
        if (prediction.success) {
          results.push({
            ...facility,
            ...prediction.prediction
          });
        }
      }
    }

    return {
      success: true,
      state,
      facilities: results,
      count: results.length
    };
  }

  // Get summary statistics
  getSummary() {
    if (!this.loaded) {
      return { success: false, error: 'Service not initialized' };
    }

    const statesCount = new Map();
    for (const facility of this.facilities.values()) {
      statesCount.set(facility.state, (statesCount.get(facility.state) || 0) + 1);
    }

    return {
      success: true,
      totalFacilities: this.facilities.size,
      totalPatterns: this.patterns.size,
      states: Array.from(statesCount.entries()).map(([state, count]) => ({
        state,
        facilityCount: count
      }))
    };
  }
}

// Singleton instance
const parkingService = new TruckParkingService();

module.exports = parkingService;

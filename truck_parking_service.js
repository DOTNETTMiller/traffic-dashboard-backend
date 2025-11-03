// Truck Parking Prediction Service
// Uses historical patterns to predict parking availability
// Data is loaded from SQLite database for reliable Railway deployments

const Database = require('./database.js');

class TruckParkingService {
  constructor() {
    this.patterns = null;
    this.facilities = null;
    this.loaded = false;
    this.db = null;
  }

  // Load patterns from database
  async loadPatterns() {
    try {
      console.log(`📂 Loading parking patterns from database...`);

      // Use the shared database instance
      if (!this.db) {
        this.db = Database; // Use the singleton instance
        if (Database.init) {
          await Database.init();
        }
      }

      // Load facilities
      const facilitiesRows = await this.db.db.prepare(`
        SELECT facility_id, site_id, state, avg_capacity, total_samples, latitude, longitude
        FROM parking_facilities
      `).all();

      console.log(`📦 Loaded ${facilitiesRows.length} facilities from database`);

      this.facilities = new Map();
      for (const row of facilitiesRows) {
        this.facilities.set(row.facility_id, {
          facilityId: row.facility_id,
          siteId: row.site_id,
          state: row.state,
          avgCapacity: row.avg_capacity,
          totalSamples: row.total_samples,
          latitude: row.latitude,
          longitude: row.longitude
        });
      }

      // Load patterns
      const patternsRows = await this.db.db.prepare(`
        SELECT facility_id, day_of_week, hour, avg_occupancy_rate, sample_count, capacity
        FROM parking_patterns
      `).all();

      console.log(`📦 Loaded ${patternsRows.length} patterns from database`);

      // Index patterns by facility and time
      this.patterns = new Map();
      for (const row of patternsRows) {
        const key = `${row.facility_id}-${row.day_of_week}-${row.hour}`;
        this.patterns.set(key, {
          facilityId: row.facility_id,
          dayOfWeek: row.day_of_week,
          hour: row.hour,
          avgOccupancyRate: row.avg_occupancy_rate,
          sampleCount: row.sample_count,
          capacity: row.capacity
        });
      }

      this.loaded = true;

      if (this.facilities.size === 0) {
        console.log('⚠️  No parking facilities found in database. Run: node scripts/migrate_parking_to_db.js');
        return true; // Still return true, service is "loaded" just with no data
      } else {
        console.log(`✅ Loaded ${this.facilities.size} parking facilities with ${this.patterns.size} time-based patterns`);
      }

      return true;

    } catch (error) {
      console.error('❌ Error loading parking patterns from database:', error.message);
      // If tables don't exist, service is still "loaded" just with no data
      this.loaded = true;
      this.facilities = new Map();
      this.patterns = new Map();
      return false;
    }
  }

  // Calculate generic occupancy rate based on time of day and day of week
  calculateGenericOccupancy(dayOfWeek, hour) {
    // Weekend (Friday evening through Sunday) typically has higher occupancy
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;

    // Peak hours: evening/night (6pm-6am) when truckers rest
    const isPeakHours = hour >= 18 || hour <= 6;

    // Base occupancy rates
    let occupancyRate = 0.5; // Default 50%

    if (isWeekend) {
      if (isPeakHours) {
        occupancyRate = 0.75; // 75% on weekend nights
      } else {
        occupancyRate = 0.60; // 60% on weekend days
      }
    } else {
      if (isPeakHours) {
        occupancyRate = 0.65; // 65% on weeknight rest hours
      } else {
        occupancyRate = 0.45; // 45% on weekday daytime
      }
    }

    return occupancyRate;
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

    // If still no pattern, use generic prediction based on time of day
    if (!pattern) {
      const genericOccupancy = this.calculateGenericOccupancy(dayOfWeek, hour);
      const capacity = facility.avgCapacity || 0;
      const predictedAvailable = Math.round(capacity * (1 - genericOccupancy));

      let status = 'available';
      if (genericOccupancy > 0.9) status = 'full';
      else if (genericOccupancy > 0.7) status = 'limited';

      return {
        success: true,
        prediction: {
          facilityId,
          siteId: facility.siteId,
          state: facility.state,
          latitude: facility.latitude,
          longitude: facility.longitude,
          capacity,
          predictedAvailable,
          predictedOccupied: capacity - predictedAvailable,
          occupancyRate: genericOccupancy,
          status,
          confidence: 'low',
          sampleCount: 0,
          predictedFor: targetTime.toISOString(),
          dayOfWeek,
          hour,
          note: 'Generic prediction based on typical patterns (no historical data)'
        }
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
        latitude: facility.latitude,
        longitude: facility.longitude,
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

    // Handle case where no facilities are loaded
    if (this.facilities.size === 0) {
      return {
        success: true,
        predictions: [],
        alerts: [],
        predictedFor: targetTime.toISOString(),
        count: 0,
        alertCount: 0,
        warning: 'No parking facilities loaded. Data may need to be populated.'
      };
    }

    const predictions = [];
    const alerts = [];

    for (const [facilityId, facility] of this.facilities) {
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

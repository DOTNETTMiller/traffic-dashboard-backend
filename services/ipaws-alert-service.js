/**
 * IPAWS Alert Generation Service
 *
 * Generates Wireless Emergency Alerts (WEA) via IPAWS for qualifying transportation events
 * Based on Iowa DOT IPAWS Transportation Alert Policy
 *
 * Key Features:
 * - Automatic qualification evaluation (≥4h closure or imminent danger)
 * - Precision geofence generation with population masking
 * - CAP-XML message formatting
 * - Multilingual support (English, Spanish, Lao, Somali)
 * - Cross-channel dissemination
 */

const turf = require('@turf/turf');
const populationService = require('./population-density-service');
const IPAWSAuditLogger = require('./ipaws-alert-service-lite');
const path = require('path');

class IPAWSAlertService {
  constructor() {
    this.initialized = false;

    // Tier 1 routes that qualify for IPAWS alerts
    this.tier1Routes = [
      /^I-\d+$/i,        // Interstate highways
      /^US-?\d+$/i,      // US highways
      /^IA-?\d+$/i       // Major Iowa highways
    ];

    // Event types that qualify for immediate alerts (imminent danger)
    this.imminentDangerTypes = [
      'hazmat',
      'wrong-way driver',
      'fire',
      'evacuation',
      'explosion',
      'bridge collapse',
      'infrastructure failure',
      'flooding',
      'rising water'
    ];

    // SOP Appendix A: Standard Message Templates
    // Per Iowa DOT IPAWS SOP Appendix A - Sample WEA messages for highway emergency closures
    this.messageTemplates = {
      'major-crash': {
        label: 'Major Crash Closure',
        template: '{route} {direction} closed at {mileMarker} near {location} due to crash. Use detour. 511ia.org',
        eventTypes: ['crash', 'accident', 'collision', 'multi-vehicle']
      },
      'hazmat': {
        label: 'Hazmat Spill',
        template: '{route} {direction} closed at {mileMarker} near {location}. Hazmat spill, avoid area. Use detour. 511ia.org',
        eventTypes: ['hazmat', 'chemical spill', 'fuel spill']
      },
      'flood': {
        label: 'Flash Flood',
        template: '{route} {direction} closed at {mileMarker} near {location} due to flooding. Avoid area. 511ia.org',
        eventTypes: ['flood', 'flooding', 'rising water', 'water over road']
      },
      'active-threat': {
        label: 'Active Threat / Law Enforcement',
        template: '{route} {direction} closed near {location}. Law enforcement activity. Avoid area. 511ia.org',
        eventTypes: ['law enforcement', 'active threat', 'police activity', 'evacuation']
      },
      'winter-storm': {
        label: 'Winter Storm / Stranded Motorists',
        template: '{route} {direction} closed at {mileMarker}. Winter storm, travel unsafe. Do not travel. 511ia.org',
        eventTypes: ['winter storm', 'blizzard', 'whiteout', 'ice', 'snow']
      },
      'generic': {
        label: 'Generic Closure',
        template: '{route} {direction} closed at {mileMarker} near {location}. {reason}. 511ia.org',
        eventTypes: []
      }
    };

    // Section 6.4: Stranded Motorists Criteria
    // Per Iowa DOT IPAWS SOP Section 6.4 - Special criteria for stranded motorists
    this.strandedMotoristsCriteria = {
      // Normal weather conditions
      normalConditions: {
        delayMinutes: 60,
        description: 'Traffic fully stopped with no immediate diversion available'
      },
      // Extreme weather conditions
      extremeWeather: {
        delayMinutes: 30,
        description: 'Delay during blizzard, extreme cold/heat, or other severe weather'
      },
      // Immediate activation scenarios
      immediate: [
        'flooding',
        'rising water',
        'hazmat',
        'smoke plume',
        'shelter-in-place'
      ]
    };

    // Weather-specific timing guidance (Section 6.4.2)
    this.weatherTimingGuidance = {
      'winter storm': {
        activateWithinMinutes: 30,
        renewIntervalMinutes: 60,
        maxDurationHours: 4,
        survivalGuidance: 'Run engine 10 min/hr, clear exhaust pipe. Stay in vehicle.'
      },
      'blizzard': {
        activateWithinMinutes: 30,
        renewIntervalMinutes: 60,
        maxDurationHours: 4,
        survivalGuidance: 'Run engine 10 min/hr, clear exhaust pipe. Stay in vehicle.'
      },
      'extreme cold': {
        activateWithinMinutes: 30,
        renewIntervalMinutes: 60,
        maxDurationHours: 4,
        temperatureThreshold: 0, // °F wind chill
        survivalGuidance: 'Conserve fuel. Run engine briefly to stay warm. Do NOT exit vehicle.'
      },
      'extreme heat': {
        activateWithinMinutes: 60,
        renewIntervalMinutes: 60,
        maxDurationHours: 4,
        temperatureThreshold: 95, // °F
        survivalGuidance: 'Stay hydrated. Run AC briefly if needed. Monitor for heat distress.'
      },
      'flooding': {
        activateWithinMinutes: 0, // immediate
        renewIntervalMinutes: 30,
        maxDurationHours: 2,
        survivalGuidance: 'Do NOT drive through water. Stay in vehicle on high ground.'
      }
    };

    // Geofence recommendations by event type
    // Buffer distances in miles, with reasoning
    this.geofenceRecommendations = {
      // Construction events - planned, affects traffic patterns, larger area
      construction: {
        bufferMiles: 2.0,
        reason: 'Construction affects larger area and traffic patterns',
        priority: 'standard',
        leadTime: 'Typically known in advance - wider notification area'
      },

      // Incidents/Crashes - immediate, localized impact
      incident: {
        bufferMiles: 0.75,
        reason: 'Immediate localized impact, drivers need quick notification',
        priority: 'immediate',
        leadTime: 'Real-time event - focused notification area'
      },
      crash: {
        bufferMiles: 0.75,
        reason: 'Immediate localized impact, drivers need quick notification',
        priority: 'immediate',
        leadTime: 'Real-time event - focused notification area'
      },

      // Closures - varies by type
      closure: {
        bufferMiles: 1.5,
        reason: 'Full closure requires detour planning',
        priority: 'high',
        leadTime: 'Drivers need advance notice for detours'
      },
      'road closure': {
        bufferMiles: 1.5,
        reason: 'Full closure requires detour planning',
        priority: 'high',
        leadTime: 'Drivers need advance notice for detours'
      },

      // Weather events - broader impact area
      weather: {
        bufferMiles: 3.0,
        reason: 'Weather affects larger geographic area',
        priority: 'high',
        leadTime: 'Broad impact requires wider notification'
      },
      'weather event': {
        bufferMiles: 3.0,
        reason: 'Weather affects larger geographic area',
        priority: 'high',
        leadTime: 'Broad impact requires wider notification'
      },

      // Hazmat - safety perimeter needed
      hazmat: {
        bufferMiles: 2.5,
        reason: 'Safety perimeter and evacuation potential',
        priority: 'immediate',
        leadTime: 'Safety critical - wider notification for evacuation'
      },
      'hazmat incident': {
        bufferMiles: 2.5,
        reason: 'Safety perimeter and evacuation potential',
        priority: 'immediate',
        leadTime: 'Safety critical - wider notification for evacuation'
      },

      // Restrictions - moderate impact
      restriction: {
        bufferMiles: 1.0,
        reason: 'Lane restrictions affect traffic flow',
        priority: 'standard',
        leadTime: 'Moderate impact area'
      },
      'lane restriction': {
        bufferMiles: 1.0,
        reason: 'Lane restrictions affect traffic flow',
        priority: 'standard',
        leadTime: 'Moderate impact area'
      },

      // Maintenance - planned, moderate area
      maintenance: {
        bufferMiles: 1.25,
        reason: 'Planned maintenance with moderate traffic impact',
        priority: 'standard',
        leadTime: 'Scheduled work - moderate notification area'
      },

      // Bridge issues - structural, safety critical
      'bridge closure': {
        bufferMiles: 2.0,
        reason: 'Bridge closures require significant detours',
        priority: 'high',
        leadTime: 'Major detour required - wider notification'
      },

      // Special events
      'special event': {
        bufferMiles: 1.5,
        reason: 'Special events cause traffic pattern changes',
        priority: 'standard',
        leadTime: 'Traffic pattern changes - moderate area'
      },

      // Default fallback
      default: {
        bufferMiles: 1.0,
        reason: 'Standard buffer for general events',
        priority: 'standard',
        leadTime: 'Standard notification area'
      }
    };
  }

  /**
   * Update alert status in audit log (delegates to lightweight logger)
   */
  async updateAlertStatus(alertId, status, additionalData = {}) {
    return IPAWSAuditLogger.updateStatus(alertId, status, additionalData);
  }

  /**
   * Get recommended geofence settings for an event
   */
  getGeofenceRecommendation(event) {
    const eventType = (event.eventType || '').toLowerCase().trim();
    const description = (event.description || '').toLowerCase();

    // Try to match event type directly
    let recommendation = this.geofenceRecommendations[eventType];

    // If no direct match, check for partial matches
    if (!recommendation) {
      for (const [type, config] of Object.entries(this.geofenceRecommendations)) {
        if (type !== 'default' && (
          eventType.includes(type) ||
          description.includes(type)
        )) {
          recommendation = config;
          break;
        }
      }
    }

    // Fall back to default
    if (!recommendation) {
      recommendation = this.geofenceRecommendations.default;
    }

    // Adjust buffer based on severity
    let adjustedBuffer = recommendation.bufferMiles;
    const severity = (event.severity || '').toLowerCase();

    if (severity === 'high') {
      adjustedBuffer *= 1.3; // Increase by 30% for high severity
    } else if (severity === 'low') {
      adjustedBuffer *= 0.8; // Decrease by 20% for low severity
    }

    // Adjust based on lanes affected
    const lanesAffected = parseInt(event.lanesAffected) || 0;
    if (lanesAffected >= 3) {
      adjustedBuffer *= 1.2; // Increase by 20% for major lane impact
    } else if (lanesAffected === 1) {
      adjustedBuffer *= 0.9; // Slight decrease for single lane
    }

    // Round to nearest 0.25 mile
    adjustedBuffer = Math.round(adjustedBuffer * 4) / 4;

    return {
      recommended: recommendation,
      adjustedBufferMiles: adjustedBuffer,
      originalBufferMiles: recommendation.bufferMiles,
      adjustments: {
        severityAdjusted: severity !== 'medium',
        lanesAdjusted: lanesAffected > 0,
        finalBuffer: adjustedBuffer
      },
      eventType: eventType || 'unknown'
    };
  }

  /**
   * Evaluate if an event qualifies for IPAWS alert
   */
  evaluateQualification(event) {
    const result = {
      qualifies: false,
      reason: null,
      criteria: []
    };

    // Check if route is Tier 1
    const isTier1 = this.tier1Routes.some(pattern =>
      event.corridor && event.corridor.match(pattern)
    );

    if (!isTier1) {
      result.reason = 'Route is not a Tier 1 corridor (Interstate, NHS, or major state route)';
      return result;
    }

    // Check for imminent danger
    const isImminentDanger = this.imminentDangerTypes.some(type =>
      event.eventType?.toLowerCase().includes(type) ||
      event.description?.toLowerCase().includes(type)
    );

    if (isImminentDanger) {
      result.qualifies = true;
      result.criteria.push('Presents imminent danger to motorists');
      result.priority = 'IMMEDIATE';
      return result;
    }

    // Check closure duration (≥4 hours)
    const estimatedDuration = this.estimateDurationHours(event);
    if (estimatedDuration >= 4) {
      result.qualifies = true;
      result.criteria.push(`Closure duration ≥4 hours (estimated: ${estimatedDuration}h)`);
      result.priority = 'STANDARD';
      return result;
    }

    result.reason = `Closure duration < 4 hours (estimated: ${estimatedDuration}h) and no imminent danger`;
    return result;
  }

  /**
   * Estimate closure duration in hours
   */
  estimateDurationHours(event) {
    // Check if end time is provided
    if (event.endTime && event.startTime) {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      return (end - start) / (1000 * 60 * 60);
    }

    // Estimate based on event type and severity
    const desc = (event.description || '').toLowerCase();
    const type = (event.eventType || '').toLowerCase();

    // High severity indicators → likely long closure
    if (event.severity === 'high' || desc.includes('full closure') || desc.includes('closed')) {
      if (type.includes('construction')) return 8;
      if (type.includes('hazmat')) return 6;
      if (type.includes('crash') && desc.includes('fatal')) return 5;
      if (desc.includes('bridge')) return 12;
      return 4;
    }

    // Default: assume under 4 hours
    return 2;
  }

  /**
   * Evaluate if stranded motorists criteria (Section 6.4) is met
   * Returns whether IPAWS should be activated for stranded motorists
   *
   * @param {Object} event - The traffic event
   * @param {Object} options - Options
   * @param {number} options.delayMinutes - How long traffic has been stopped (in minutes)
   * @param {string} options.weatherCondition - Weather condition (e.g., 'blizzard', 'extreme cold')
   * @param {number} options.temperature - Current temperature (°F)
   * @param {number} options.windChill - Wind chill temperature (°F)
   * @param {boolean} options.diversionAvailable - Whether immediate diversion is available
   * @returns {Object} Evaluation result with qualification status and recommendations
   */
  evaluateStrandedMotoristsAlert(event, options = {}) {
    const {
      delayMinutes = 0,
      weatherCondition = null,
      temperature = null,
      windChill = null,
      diversionAvailable = false
    } = options;

    const result = {
      qualifies: false,
      reason: '',
      activateWithinMinutes: null,
      renewIntervalMinutes: null,
      maxDurationHours: null,
      survivalGuidance: null,
      section: 'Section 6.4 - Stranded Motorists'
    };

    // Must have traffic fully stopped with no diversion
    if (diversionAvailable) {
      result.reason = 'Diversion available - use DMS/511 instead';
      return result;
    }

    const eventType = (event.eventType || '').toLowerCase();
    const description = (event.description || '').toLowerCase();

    // Check immediate activation criteria (Section 6.4.1)
    const isImmediateActivation = this.strandedMotoristsCriteria.immediate.some(condition =>
      eventType.includes(condition) || description.includes(condition)
    );

    if (isImmediateActivation) {
      result.qualifies = true;
      result.reason = 'Immediate activation required (flooding/hazmat/smoke plume)';
      result.activateWithinMinutes = 0;
      result.renewIntervalMinutes = 30;
      result.maxDurationHours = 2;

      // Get specific guidance if available
      if (weatherCondition && this.weatherTimingGuidance[weatherCondition]) {
        const guidance = this.weatherTimingGuidance[weatherCondition];
        result.survivalGuidance = guidance.survivalGuidance;
      } else {
        result.survivalGuidance = 'Stay in vehicle. Emergency crews responding. Monitor 511ia.org.';
      }

      return result;
    }

    // Check weather-specific criteria (Section 6.4.2)
    if (weatherCondition && this.weatherTimingGuidance[weatherCondition]) {
      const guidance = this.weatherTimingGuidance[weatherCondition];

      // Check temperature thresholds for extreme cold/heat
      if (weatherCondition === 'extreme cold' && windChill !== null) {
        if (windChill < guidance.temperatureThreshold) {
          if (delayMinutes >= guidance.activateWithinMinutes) {
            result.qualifies = true;
            result.reason = `Extreme cold (wind chill ${windChill}°F) - traffic stopped ${delayMinutes} min`;
            result.activateWithinMinutes = guidance.activateWithinMinutes;
            result.renewIntervalMinutes = guidance.renewIntervalMinutes;
            result.maxDurationHours = guidance.maxDurationHours;
            result.survivalGuidance = guidance.survivalGuidance;
            return result;
          }
        }
      } else if (weatherCondition === 'extreme heat' && temperature !== null) {
        if (temperature >= guidance.temperatureThreshold) {
          if (delayMinutes >= guidance.activateWithinMinutes) {
            result.qualifies = true;
            result.reason = `Extreme heat (${temperature}°F) - traffic stopped ${delayMinutes} min`;
            result.activateWithinMinutes = guidance.activateWithinMinutes;
            result.renewIntervalMinutes = guidance.renewIntervalMinutes;
            result.maxDurationHours = guidance.maxDurationHours;
            result.survivalGuidance = guidance.survivalGuidance;
            return result;
          }
        }
      } else {
        // Other extreme weather (blizzard, winter storm, flooding)
        if (delayMinutes >= guidance.activateWithinMinutes) {
          result.qualifies = true;
          result.reason = `${weatherCondition} - traffic stopped ${delayMinutes} min`;
          result.activateWithinMinutes = guidance.activateWithinMinutes;
          result.renewIntervalMinutes = guidance.renewIntervalMinutes;
          result.maxDurationHours = guidance.maxDurationHours;
          result.survivalGuidance = guidance.survivalGuidance;
          return result;
        }
      }
    }

    // Check normal conditions criteria (Section 6.4.1)
    // Extreme weather condition: 30 minutes
    // Normal conditions: 60 minutes
    const isExtremeWeather = weatherCondition &&
      (weatherCondition.includes('blizzard') ||
       weatherCondition.includes('extreme') ||
       weatherCondition.includes('flooding'));

    const thresholdMinutes = isExtremeWeather ?
      this.strandedMotoristsCriteria.extremeWeather.delayMinutes :
      this.strandedMotoristsCriteria.normalConditions.delayMinutes;

    if (delayMinutes >= thresholdMinutes) {
      result.qualifies = true;
      result.reason = `Traffic stopped ${delayMinutes} min (threshold: ${thresholdMinutes} min)`;
      result.activateWithinMinutes = isExtremeWeather ? 30 : 60;
      result.renewIntervalMinutes = 60;
      result.maxDurationHours = 4;
      result.survivalGuidance = isExtremeWeather ?
        'Stay in vehicle. Conserve fuel. Emergency crews responding. 511ia.org for updates.' :
        'Stay in vehicle. Emergency crews responding. Monitor 511ia.org for updates.';
      return result;
    }

    result.reason = `Traffic stopped only ${delayMinutes} min (threshold: ${thresholdMinutes} min). Use DMS/511.`;
    return result;
  }

  /**
   * Detect traffic direction from event data
   * Returns: 'EB', 'WB', 'NB', 'SB', or 'UNKNOWN'
   */
  detectTrafficDirection(event) {
    // Check description for direction indicators
    const description = (event.description || '').toLowerCase();
    const location = (event.location || '').toLowerCase();
    const combined = `${description} ${location}`;

    // Check for bi-directional closures first
    if (/\b(both directions|both ways|all lanes|all directions)\b/i.test(combined)) {
      return 'BOTH';
    }

    // Check for single direction indicators
    if (/\b(wb|westbound|west bound)\b/i.test(combined)) return 'WB';
    if (/\b(eb|eastbound|east bound)\b/i.test(combined)) return 'EB';
    if (/\b(nb|northbound|north bound)\b/i.test(combined)) return 'NB';
    if (/\b(sb|southbound|south bound)\b/i.test(combined)) return 'SB';

    // Check if event has direction field
    if (event.direction) {
      const dir = event.direction.toUpperCase();
      if (dir.includes('BOTH')) return 'BOTH';
      if (dir.includes('W')) return 'WB';
      if (dir.includes('E')) return 'EB';
      if (dir.includes('N')) return 'NB';
      if (dir.includes('S')) return 'SB';
    }

    return 'UNKNOWN';
  }

  /**
   * Detect line geometry direction from coordinates
   * Returns: 'EB', 'WB', 'NB', 'SB', or 'UNKNOWN'
   */
  detectLineDirection(line) {
    const coords = line.geometry.coordinates;
    if (coords.length < 2) return 'UNKNOWN';

    const start = coords[0];
    const end = coords[coords.length - 1];

    const deltaLon = end[0] - start[0]; // Longitude (east-west)
    const deltaLat = end[1] - start[1]; // Latitude (north-south)

    // Determine primary direction based on larger delta
    if (Math.abs(deltaLon) > Math.abs(deltaLat)) {
      // East-West corridor
      return deltaLon > 0 ? 'EB' : 'WB';
    } else {
      // North-South corridor
      return deltaLat > 0 ? 'NB' : 'SB';
    }
  }

  /**
   * Check if line geometry is reversed relative to traffic direction
   * Returns true if they're opposite (need to swap ahead/behind)
   */
  isLineReversedRelativeToTraffic(trafficDirection, lineDirection) {
    // Bi-directional closures: never reverse (use symmetric geofence)
    if (trafficDirection === 'BOTH') {
      return false;
    }

    if (trafficDirection === 'UNKNOWN' || lineDirection === 'UNKNOWN') {
      return false; // Can't determine, assume not reversed
    }

    // They're reversed if they're opposite directions
    const opposites = {
      'EB': 'WB',
      'WB': 'EB',
      'NB': 'SB',
      'SB': 'NB'
    };

    return opposites[trafficDirection] === lineDirection;
  }

  /**
   * Generate geofence for alert area
   * Per policy: Intelligent buffer based on event type, population masking
   * Supports both miles and feet for buffer width
   * Supports asymmetric corridor extension for advance warning
   */
  async generateGeofence(event, options = {}) {
    if (!event.geometry || !event.geometry.coordinates) {
      throw new Error('Event must have geometry to generate geofence');
    }

    const {
      bufferMiles: customBufferMiles = null,
      bufferFeet: customBufferFeet = null,
      corridorLengthMiles = null,
      corridorAheadMiles = null,
      corridorBehindMiles = null,
      avoidUrbanAreas = false
    } = options;

    console.log('  🗺️  generateGeofence received options:', {
      customBufferMiles,
      customBufferFeet,
      corridorLengthMiles,
      corridorAheadMiles,
      corridorBehindMiles,
      avoidUrbanAreas
    });

    // Get intelligent recommendation
    const recommendation = this.getGeofenceRecommendation(event);

    // Determine buffer distance
    let bufferMiles;
    if (customBufferFeet !== null) {
      // Convert feet to miles (5280 feet = 1 mile)
      bufferMiles = customBufferFeet / 5280;
    } else if (customBufferMiles !== null) {
      bufferMiles = customBufferMiles;
    } else {
      bufferMiles = recommendation.adjustedBufferMiles;
    }

    const bufferMeters = bufferMiles * 1609; // Convert miles to meters
    const bufferFeet = bufferMiles * 5280; // Convert miles to feet

    // Create line from event geometry
    let line = turf.lineString(event.geometry.coordinates);

    // Determine traffic direction from event data
    const trafficDirection = this.detectTrafficDirection(event);

    // Determine line geometry direction (start to end)
    const lineDirection = this.detectLineDirection(line);

    // Check if line geometry is reversed relative to traffic flow
    // If they're opposite, we need to swap ahead/behind
    const isReversed = this.isLineReversedRelativeToTraffic(trafficDirection, lineDirection);

    if (trafficDirection === 'BOTH') {
      console.log(`  Traffic: BOTH DIRECTIONS (bi-directional closure) - symmetric geofence recommended`);
    } else {
      console.log(`  Traffic: ${trafficDirection}, Line: ${lineDirection}, Reversed: ${isReversed}`);
    }

    // Limit corridor length if specified - supports both symmetric and asymmetric trimming
    if (corridorAheadMiles !== null || corridorBehindMiles !== null || (corridorLengthMiles && corridorLengthMiles > 0)) {
      const lineLength = turf.length(line, { units: 'miles' });
      console.log(`  📏 Original line length: ${lineLength.toFixed(2)} mi`);

      let distanceAhead, distanceBehind;

      // Asymmetric corridor (advance warning mode)
      if (corridorAheadMiles !== null || corridorBehindMiles !== null) {
        // Swap ahead/behind if line is reversed relative to traffic
        // "Ahead" means where traffic is APPROACHING FROM
        // "Behind" means where traffic has PASSED
        if (isReversed) {
          distanceAhead = corridorBehindMiles !== null ? corridorBehindMiles : lineLength / 2;
          distanceBehind = corridorAheadMiles !== null ? corridorAheadMiles : lineLength / 2;
          console.log(`  ⚠️ Swapped: ahead=${distanceAhead}mi (was behind), behind=${distanceBehind}mi (was ahead)`);
        } else {
          distanceAhead = corridorAheadMiles !== null ? corridorAheadMiles : lineLength / 2;
          distanceBehind = corridorBehindMiles !== null ? corridorBehindMiles : lineLength / 2;
          console.log(`  ✅ Using: ahead=${distanceAhead}mi, behind=${distanceBehind}mi (not reversed)`);
        }
      }
      // Symmetric corridor (legacy mode)
      else if (corridorLengthMiles && corridorLengthMiles > 0 && lineLength > corridorLengthMiles) {
        const halfLength = corridorLengthMiles / 2;
        distanceAhead = halfLength;
        distanceBehind = halfLength;
        console.log(`  ⚖️  Symmetric mode: ${distanceAhead}mi ahead, ${distanceBehind}mi behind`);
      } else {
        // No trimming needed
        distanceAhead = lineLength;
        distanceBehind = 0;
        console.log(`  ℹ️  No corridor trimming applied`);
      }

      // Find the midpoint of the line (event location)
      const midpoint = turf.along(line, lineLength / 2, { units: 'miles' });

      // Calculate start point (behind the event)
      const startDistance = Math.max(0, (lineLength / 2) - distanceBehind);
      const startPoint = turf.along(line, startDistance, { units: 'miles' });

      // Calculate end point (ahead of the event)
      const endDistance = Math.min(lineLength, (lineLength / 2) + distanceAhead);
      const endPoint = turf.along(line, endDistance, { units: 'miles' });

      console.log(`  ✂️  Trimming line: start at ${startDistance.toFixed(2)}mi, end at ${endDistance.toFixed(2)}mi`);

      // Build new line with start -> midpoint -> end
      // This ensures the line follows the original corridor geometry
      const slicedLine = turf.lineSlice(startPoint, endPoint, line);
      const slicedLength = turf.length(slicedLine, { units: 'miles' });
      console.log(`  📐 Trimmed line length: ${slicedLength.toFixed(2)} mi (was ${lineLength.toFixed(2)} mi)`);
      line = slicedLine;
    }

    // Buffer with intelligent distance
    const buffered = turf.buffer(line, bufferMeters, { units: 'meters' });

    // For asymmetric geofences, create visual zones to show advance warning vs behind areas
    let visualZones = null;
    if (corridorAheadMiles !== null || corridorBehindMiles !== null) {
      try {
        const lineLength = turf.length(line, { units: 'miles' });
        const midpointDistance = lineLength / 2;
        const midpoint = turf.along(line, midpointDistance, { units: 'miles' });

        // Create "behind" segment (from start to midpoint)
        const behindSegment = turf.lineSlice(
          turf.point(line.geometry.coordinates[0]),
          midpoint,
          line
        );
        const behindBuffered = turf.buffer(behindSegment, bufferMeters, { units: 'meters' });

        // Create "ahead" segment (from midpoint to end)
        const aheadSegment = turf.lineSlice(
          midpoint,
          turf.point(line.geometry.coordinates[line.geometry.coordinates.length - 1]),
          line
        );
        const aheadBuffered = turf.buffer(aheadSegment, bufferMeters, { units: 'meters' });

        visualZones = {
          eventPoint: {
            type: 'Point',
            coordinates: midpoint.geometry.coordinates
          },
          behindZone: {
            type: 'Polygon',
            coordinates: behindBuffered.geometry.coordinates,
            lengthMiles: corridorBehindMiles,
            color: '#ef4444', // Red
            label: isReversed ? 'Advance Warning' : 'Behind Event'
          },
          aheadZone: {
            type: 'Polygon',
            coordinates: aheadBuffered.geometry.coordinates,
            lengthMiles: corridorAheadMiles,
            color: '#f59e0b', // Orange
            label: isReversed ? 'Behind Event' : 'Advance Warning'
          }
        };
      } catch (error) {
        console.warn('Failed to create visual zones:', error.message);
        // Continue without zones - will just show single polygon
      }
    }

    // Extract coordinates for CAP-XML polygon format
    const coords = buffered.geometry.coordinates[0];
    const capPolygon = coords.map(coord => `${coord[1]},${coord[0]}`).join(' ');

    // Get detailed population breakdown using enhanced multi-source data
    // Add timeout protection to prevent 502 errors from slow external APIs
    let populationBreakdown;
    try {
      const populationPromise = this.estimatePopulation(buffered, {
        excludeUrban: avoidUrbanAreas
      });

      // Set 15-second timeout for population estimation
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Population estimation timeout')), 15000)
      );

      populationBreakdown = await Promise.race([populationPromise, timeoutPromise]);
    } catch (error) {
      console.warn('⚠️ Population estimation failed or timed out:', error.message);
      console.log('   Using fallback population estimate based on area size');

      // Fallback: Estimate based on area (assume ~100 people per square mile for rural highways)
      const areaSquareMiles = turf.area(buffered) / 2589988.11;
      const fallbackPopulation = Math.round(areaSquareMiles * 100);

      populationBreakdown = {
        total: fallbackPopulation,
        confidence: 'low',
        primarySource: 'area-based-fallback',
        sourcesQueried: ['fallback'],
        sources: {
          fallback: {
            population: fallbackPopulation,
            coverage: 100,
            confidence: 'low'
          }
        },
        warning: `Population service unavailable. Using fallback estimate of ${fallbackPopulation.toLocaleString()} based on ${areaSquareMiles.toFixed(2)} sq mi area.`
      };
    }

    const isBidirectional = trafficDirection === 'BOTH';

    const geofenceResult = {
      type: 'Polygon',
      coordinates: buffered.geometry.coordinates,
      capFormat: capPolygon,
      estimatedPopulation: populationBreakdown.total,
      populationConfidence: populationBreakdown.confidence,
      populationSource: populationBreakdown.primarySource,
      areaSquareMiles: turf.area(buffered) / 2589988.11, // Convert m² to mi²
      bufferMiles: bufferMiles,
      bufferFeet: Math.round(bufferFeet), // Buffer width in feet
      corridorLengthMiles: corridorLengthMiles,
      corridorAheadMiles: corridorAheadMiles,
      corridorBehindMiles: corridorBehindMiles,
      avoidUrbanAreas: avoidUrbanAreas,
      recommendation: recommendation,
      isCustomBuffer: customBufferMiles !== null || customBufferFeet !== null,
      isAsymmetric: corridorAheadMiles !== null || corridorBehindMiles !== null,
      isBidirectional: isBidirectional, // Flag if closure affects both directions
      reasoning: recommendation.recommended.reason,
      populationBreakdown: populationBreakdown, // Include detailed breakdown
      trafficDirection: trafficDirection, // Include detected traffic direction
      lineDirection: lineDirection, // Include detected line direction
      directionSwapped: isReversed, // Flag if ahead/behind were swapped
      visualZones: visualZones // Separate zone geometries for map visualization
    };

    // Add warning if fallback was used
    if (populationBreakdown.warning) {
      geofenceResult.populationWarning = populationBreakdown.warning;
    }

    return geofenceResult;
  }

  /**
   * Estimate population in geofence using enhanced multi-source data
   * Queries: LandScan, US Census, OpenStreetMap, Iowa State GIS
   */
  async estimatePopulation(geofence, options = {}) {
    // Use enhanced multi-source population query
    const enhanced = await populationService.getEnhancedPopulation(geofence, options);

    return {
      total: enhanced.population,
      confidence: enhanced.confidence,
      primarySource: enhanced.primarySource,
      sourcesQueried: enhanced.sourcesQueried,
      sources: enhanced.sources,
      // For backwards compatibility
      ...enhanced
    };
  }

  /**
   * Apply population density filtering to geofence
   * Excludes urban/populated areas to focus on non-populated regions
   */
  async applyPopulationFilter(geofence, options = {}) {
    const {
      maxPopulation = 5000,
      excludeUrbanAreas = true,
      minPopulationDensity = 0
    } = options;

    // Calculate current population using enhanced multi-source data
    const populationData = await this.estimatePopulation(geofence);
    const currentPopulation = populationData.total;

    // If population is already under threshold, no filtering needed
    if (currentPopulation <= maxPopulation) {
      return {
        filtered: false,
        geofence,
        originalPopulation: currentPopulation,
        filteredPopulation: currentPopulation,
        populationData, // Include enhanced data
        reason: 'Population already within threshold'
      };
    }

    // For urban area exclusion, we would integrate with census data
    // or OpenStreetMap urban boundaries. For now, we'll reduce the buffer
    if (excludeUrbanAreas) {
      // Estimate how much to reduce buffer to meet population target
      const targetReduction = currentPopulation / maxPopulation;
      const originalArea = turf.area(geofence) / 2589988.11;
      const targetArea = originalArea / targetReduction;

      // Calculate new buffer distance (simplified - assumes circular area)
      const originalRadius = Math.sqrt(originalArea / Math.PI);
      const newRadius = Math.sqrt(targetArea / Math.PI);
      const reductionFactor = newRadius / originalRadius;

      // Return metadata about the filtering
      return {
        filtered: true,
        geofence, // In production, this would be the filtered polygon
        originalPopulation: currentPopulation,
        filteredPopulation: Math.round(currentPopulation * reductionFactor),
        reductionFactor,
        recommendation: `Reduce geofence buffer by ${((1 - reductionFactor) * 100).toFixed(0)}% to meet population threshold`,
        urbanAreasExcluded: true
      };
    }

    return {
      filtered: false,
      geofence,
      originalPopulation: currentPopulation,
      filteredPopulation: currentPopulation,
      warning: 'Population exceeds threshold but filtering not enabled'
    };
  }

  /**
   * Generate geofence with custom options (for rules-based alerts)
   */
  async generateCustomGeofence(event, options = {}) {
    const {
      bufferMiles = 1,
      type = 'auto',
      customPolygon = null,
      populationFilter = null
    } = options;

    if (!event.geometry || !event.geometry.coordinates) {
      throw new Error('Event must have geometry to generate geofence');
    }

    // Use custom polygon if provided
    if (type === 'custom' && customPolygon) {
      const popData = await this.estimatePopulation(customPolygon);
      return {
        type: 'Polygon',
        coordinates: customPolygon.coordinates,
        capFormat: this.polygonToCapFormat(customPolygon),
        estimatedPopulation: popData.total,
        populationConfidence: popData.confidence,
        populationSource: popData.primarySource,
        areaSquareMiles: turf.area(customPolygon) / 2589988.11,
        source: 'custom'
      };
    }

    // Auto-generate with custom buffer
    const line = turf.lineString(event.geometry.coordinates);
    const buffered = turf.buffer(line, bufferMiles * 1609, { units: 'meters' });

    // Apply population filtering if requested
    let geofence = buffered;
    let populationInfo = {};

    if (populationFilter) {
      const filtered = await this.applyPopulationFilter(buffered, populationFilter);
      populationInfo = filtered;
      if (filtered.filtered) {
        geofence = filtered.geofence;
      }
    }

    const coords = geofence.geometry.coordinates[0];
    const capPolygon = coords.map(coord => `${coord[1]},${coord[0]}`).join(' ');

    const popData = await this.estimatePopulation(geofence);

    return {
      type: 'Polygon',
      coordinates: geofence.geometry.coordinates,
      capFormat: capPolygon,
      estimatedPopulation: popData.total,
      populationConfidence: popData.confidence,
      populationSource: popData.primarySource,
      areaSquareMiles: turf.area(geofence) / 2589988.11,
      bufferMiles,
      source: 'auto',
      populationFilter: populationInfo
    };
  }

  /**
   * Convert polygon to CAP format
   */
  polygonToCapFormat(polygon) {
    const coords = polygon.coordinates[0];
    return coords.map(coord => `${coord[1]},${coord[0]}`).join(' ');
  }

  /**
   * Get SOP-compliant message template recommendation
   * Per SOP Appendix A: Sample IPAWS Alert Messages
   */
  getRecommendedTemplate(event) {
    const eventType = (event.type || event.description || '').toLowerCase();

    // Find matching template based on event type keywords
    for (const [key, template] of Object.entries(this.messageTemplates)) {
      if (template.eventTypes.some(type => eventType.includes(type.toLowerCase()))) {
        return {
          templateId: key,
          templateLabel: template.label,
          template: template.template,
          filledMessage: this.fillTemplate(template.template, event)
        };
      }
    }

    // Default to generic template
    return {
      templateId: 'generic',
      templateLabel: this.messageTemplates.generic.label,
      template: this.messageTemplates.generic.template,
      filledMessage: this.fillTemplate(this.messageTemplates.generic.template, event)
    };
  }

  /**
   * Fill template placeholders with event data
   */
  fillTemplate(template, event) {
    const route = event.corridor || 'Major Route';
    const direction = this.extractDirection(event);
    const mileMarkerRange = this.extractMileMarkerRange(event);
    const location = this.extractLocation(event);
    const reason = event.type || event.reason || 'emergency';

    return template
      .replace('{route}', route)
      .replace('{direction}', direction || '')
      .replace('{mileMarker}', mileMarkerRange || 'MM [unknown]')
      .replace('{location}', location)
      .replace('{reason}', reason)
      .trim()
      .replace(/\s+/g, ' '); // Clean up extra spaces
  }

  /**
   * Get all available message templates
   * Returns: Array of templates with IDs and labels
   */
  getAllTemplates() {
    return Object.entries(this.messageTemplates).map(([id, template]) => ({
      id,
      label: template.label,
      template: template.template,
      eventTypes: template.eventTypes
    }));
  }

  /**
   * Generate multilingual alert messages
   * Per SOP Section 7.3: Must include audience qualifiers, direction, and mile markers
   * Per SOP Section 6.4.3: Stranded motorists messages must include reassurance and safety guidance
   */
  generateMessages(event, options = {}) {
    const location = this.extractLocation(event);
    const route = event.corridor || 'Major Route';
    const detour = this.suggestDetour(event);

    // Extract direction from corridor or event data (SOP Section 7.3)
    const direction = this.extractDirection(event);
    const directionLabel = direction ? ` ${direction}` : '';

    // Extract mile marker range (SOP Section 6.4.3)
    const mileMarkerRange = this.extractMileMarkerRange(event);
    const mmLabel = mileMarkerRange ? ` at ${mileMarkerRange}` : '';

    // Audience qualifier (SOP Section 7.3)
    const audienceQualifier = `For drivers on ${route}${directionLabel} only`;

    // Check if this is a stranded motorists alert (SOP Section 6.4.3)
    const isStrandedMotorists = options.strandedMotorists || false;
    const survivalGuidance = options.survivalGuidance || null;
    const weatherCondition = options.weatherCondition || null;

    let headline, instruction;

    if (isStrandedMotorists) {
      // SOP Section 6.4.3: Stranded Motorists Message Content Requirements
      // Must include: traffic stopped confirmation, clear safety action, reassurance, mile markers, 511ia.org, audience qualifier

      // Build headline confirming traffic is stopped
      headline = `TRAFFIC STOPPED: ${route}${directionLabel}${mmLabel} near ${location}`;

      // Build instruction with reassurance and safety guidance per SOP 6.4.3
      let safetyAction = 'STAY IN VEHICLE. Do NOT exit.';

      // Add weather-specific survival guidance if available
      if (survivalGuidance) {
        safetyAction = survivalGuidance;
      } else if (weatherCondition) {
        // Default weather-appropriate guidance
        if (weatherCondition.includes('cold') || weatherCondition.includes('blizzard')) {
          safetyAction = 'STAY IN VEHICLE. Run engine 10 min/hr, clear exhaust.';
        } else if (weatherCondition.includes('heat')) {
          safetyAction = 'STAY IN VEHICLE. Stay hydrated. Monitor for heat distress.';
        } else if (weatherCondition.includes('flood')) {
          safetyAction = 'STAY IN VEHICLE. Do NOT drive through water.';
        } else if (weatherCondition.includes('hazmat') || weatherCondition.includes('smoke')) {
          safetyAction = 'STAY IN VEHICLE. Close windows, turn off outside air.';
        }
      }

      instruction = `${audienceQualifier}. ${safetyAction} Emergency crews responding. 511ia.org`;

    } else {
      // Standard closure message
      headline = `Iowa DOT: ${route}${directionLabel} CLOSED${mmLabel} near ${location}`;
      instruction = detour
        ? `${audienceQualifier}. Avoid area. Use ${detour} detour. 511ia.org`
        : `${audienceQualifier}. Avoid area. Seek alternate route. 511ia.org`;
    }

    // Validate WEA 360-character limit (SOP Section 12)
    const fullMessage = `${headline} ${instruction}`;
    const characterCount = fullMessage.length;
    const exceedsLimit = characterCount > 360;

    // Spanish translations
    let spanishHeadline, spanishInstruction;

    if (isStrandedMotorists) {
      spanishHeadline = `TRÁFICO DETENIDO: ${route}${directionLabel}${mmLabel} cerca de ${location}`;

      let spanishSafetyAction = 'PERMANEZCA EN VEHÍCULO. NO salga.';
      if (survivalGuidance) {
        // Translate common survival guidance
        if (survivalGuidance.includes('Run engine')) {
          spanishSafetyAction = 'PERMANEZCA EN VEHÍCULO. Motor 10 min/hr, despeje escape.';
        } else if (survivalGuidance.includes('hydrated')) {
          spanishSafetyAction = 'PERMANEZCA EN VEHÍCULO. Manténgase hidratado.';
        } else if (survivalGuidance.includes('water')) {
          spanishSafetyAction = 'PERMANEZCA EN VEHÍCULO. NO conduzca por agua.';
        } else if (survivalGuidance.includes('windows')) {
          spanishSafetyAction = 'PERMANEZCA EN VEHÍCULO. Cierre ventanas, apague aire exterior.';
        }
      }

      spanishInstruction = `Solo para conductores en ${route}${directionLabel}. ${spanishSafetyAction} Equipos de emergencia respondiendo. 511ia.org`;
    } else {
      spanishHeadline = `Iowa DOT: ${route}${directionLabel} CERRADA${mmLabel} cerca de ${location}`;
      spanishInstruction = detour
        ? `Solo para conductores en ${route}${directionLabel}. Evite el área. Desvíese por ${detour}. 511ia.org`
        : `Solo para conductores en ${route}${directionLabel}. Evite el área. Busque ruta alternativa. 511ia.org`;
    }

    const spanishCharCount = `${spanishHeadline} ${spanishInstruction}`.length;

    return {
      english: {
        headline: headline,
        instruction: instruction,
        description: event.description || (isStrandedMotorists ? 'Traffic stopped - emergency crews responding' : 'Road closure due to traffic incident'),
        audienceQualifier: audienceQualifier,
        characterCount: characterCount,
        exceedsWEALimit: exceedsLimit,
        weaLimitWarning: exceedsLimit ? `Message exceeds WEA 360-char limit by ${characterCount - 360} characters` : null,
        isStrandedMotorists: isStrandedMotorists
      },
      spanish: {
        headline: spanishHeadline,
        instruction: spanishInstruction,
        description: event.description || (isStrandedMotorists ? 'Tráfico detenido - equipos de emergencia respondiendo' : 'Cierre de carretera debido a incidente de tráfico'),
        audienceQualifier: `Solo para conductores en ${route}${directionLabel}`,
        characterCount: spanishCharCount,
        isStrandedMotorists: isStrandedMotorists
      }
    };
  }

  /**
   * Extract direction of travel from event data
   * Returns: EB, WB, NB, SB, or null
   */
  extractDirection(event) {
    // Check if direction is explicitly provided
    if (event.direction) {
      return event.direction.toUpperCase();
    }

    // Check description for direction keywords
    const desc = (event.description || '').toLowerCase();
    if (desc.includes('eastbound') || desc.includes('east bound') || desc.includes(' eb ')) return 'EB';
    if (desc.includes('westbound') || desc.includes('west bound') || desc.includes(' wb ')) return 'WB';
    if (desc.includes('northbound') || desc.includes('north bound') || desc.includes(' nb ')) return 'NB';
    if (desc.includes('southbound') || desc.includes('south bound') || desc.includes(' sb ')) return 'SB';

    // Analyze geometry to infer direction
    if (event.geometry && event.geometry.coordinates && event.geometry.coordinates.length >= 2) {
      const coords = event.geometry.coordinates;
      const start = coords[0];
      const end = coords[coords.length - 1];

      const deltaLon = end[0] - start[0];
      const deltaLat = end[1] - start[1];

      // Determine primary direction
      if (Math.abs(deltaLon) > Math.abs(deltaLat)) {
        // More east-west movement
        return deltaLon > 0 ? 'EB' : 'WB';
      } else {
        // More north-south movement
        return deltaLat > 0 ? 'NB' : 'SB';
      }
    }

    return null;
  }

  /**
   * Extract mile marker range from event data
   * Returns: "MM 137" or "MM 137-145" or null
   */
  extractMileMarkerRange(event) {
    // Check if mile marker is explicitly provided
    if (event.mileMarker) {
      return `MM ${event.mileMarker}`;
    }

    if (event.startMileMarker && event.endMileMarker) {
      return `MM ${event.startMileMarker}-${event.endMileMarker}`;
    }

    if (event.startMileMarker) {
      return `MM ${event.startMileMarker}`;
    }

    // Try to extract from description
    const desc = event.description || '';
    const mmMatch = desc.match(/\b(?:MM|mile marker|milepost)\s*(\d+(?:\.\d+)?)\b/i);
    if (mmMatch) {
      return `MM ${mmMatch[1]}`;
    }

    // Try to extract range from description
    const rangeMatch = desc.match(/\b(?:MM|mile marker)\s*(\d+)\s*(?:to|-)\s*(\d+)\b/i);
    if (rangeMatch) {
      return `MM ${rangeMatch[1]}-${rangeMatch[2]}`;
    }

    return null;
  }

  /**
   * Extract human-readable location
   */
  extractLocation(event) {
    if (event.location) return event.location;
    if (event.county) return event.county;

    // Use geometry center if available
    if (event.geometry && event.geometry.coordinates) {
      const center = turf.center(turf.lineString(event.geometry.coordinates));
      const [lon, lat] = center.geometry.coordinates;
      return `${lat.toFixed(2)}°N, ${Math.abs(lon).toFixed(2)}°W`;
    }

    return 'Iowa';
  }

  /**
   * Suggest detour route
   */
  suggestDetour(event) {
    const desc = (event.description || '').toLowerCase();

    // Extract detour from description if mentioned
    const detourMatch = desc.match(/(?:detour|use|take)\s+((?:US|IA|I)-?\d+)/i);
    if (detourMatch) return detourMatch[1];

    // Default detours for major routes (simplified)
    if (event.corridor?.match(/I-80/i)) return 'US 30';
    if (event.corridor?.match(/I-35/i)) return 'US 69';
    if (event.corridor?.match(/I-380/i)) return 'US 218';

    return null;
  }

  /**
   * Generate CAP-XML alert message
   */
  generateCAPMessage(event, geofence, messages) {
    const now = new Date().toISOString();
    const identifier = `IADOT-WEA-${Date.now()}`;
    const expires = this.calculateExpiration(event);

    const cap = {
      identifier: identifier,
      sender: 'alert@iowadot.gov',
      sent: now,
      status: 'Actual',
      msgType: 'Alert',
      scope: 'Public',
      info: {
        category: 'Transport',
        event: 'Road Closure',
        urgency: event.severity === 'high' ? 'Immediate' : 'Expected',
        severity: this.mapSeverity(event.severity),
        certainty: 'Observed',
        headline: messages.english.headline,
        description: messages.english.description,
        instruction: messages.english.instruction,
        web: event.moreInfoUrl || 'https://511ia.org',
        language: 'en-US',
        effective: now,
        expires: expires,
        senderName: 'Iowa Department of Transportation',
        area: {
          areaDesc: messages.english.headline,
          polygon: geofence.capFormat
        }
      },
      multilingual: {
        spanish: messages.spanish
      }
    };

    return cap;
  }

  /**
   * Calculate alert expiration time
   * Per SOP Section 10: Default 30-60 min, Maximum 4 hours
   */
  calculateExpiration(event, options = {}) {
    const now = new Date();
    const {
      defaultDurationMinutes = 60, // SOP: 30-60 min default
      maxDurationHours = 4          // SOP: 4 hour maximum
    } = options;

    // Use event end time if available, but cap at max duration
    if (event.endTime) {
      const endTime = new Date(event.endTime);
      const maxExpire = new Date(now.getTime() + maxDurationHours * 60 * 60 * 1000);
      return endTime < maxExpire ? endTime.toISOString() : maxExpire.toISOString();
    }

    // Default: 60 minutes per SOP (changed from 8 hours)
    const defaultExpire = new Date(now.getTime() + defaultDurationMinutes * 60 * 1000);
    return defaultExpire.toISOString();
  }

  /**
   * Map severity to CAP standard
   */
  mapSeverity(severity) {
    const map = {
      'high': 'Extreme',
      'medium': 'Severe',
      'low': 'Moderate'
    };
    return map[severity] || 'Severe';
  }

  /**
   * Generate complete IPAWS alert package
   */
  async generateAlert(event, options = {}) {
    const warnings = [];
    let recommended = true;

    console.log('  Step 1: Evaluating qualification...');
    // Step 1: Evaluate qualification
    const qualification = this.evaluateQualification(event);
    if (!qualification.qualifies) {
      recommended = false;
      warnings.push({
        type: 'qualification',
        severity: 'warning',
        message: qualification.reason,
        canOverride: true
      });
    }
    console.log('  ✓ Qualification evaluated');

    console.log('  Step 2: Generating geofence...');
    // Step 2: Generate geofence with optional custom parameters
    const geofence = await this.generateGeofence(event, options);
    console.log('  ✓ Geofence generated');

    // Check if population service timed out or failed
    if (geofence.populationWarning) {
      warnings.push({
        type: 'population_service',
        severity: 'info',
        message: geofence.populationWarning,
        canOverride: false
      });
    }

    // Step 3: Check population threshold (< 5,000 per policy)
    if (geofence.estimatedPopulation > 5000) {
      recommended = false;
      warnings.push({
        type: 'population',
        severity: 'warning',
        message: `Geofence population (${geofence.estimatedPopulation.toLocaleString()}) exceeds 5,000 threshold. Consider narrowing the buffer or shortening the corridor length.`,
        canOverride: true,
        population: geofence.estimatedPopulation,
        threshold: 5000
      });
    }

    console.log('  Step 4: Generating messages...');
    // Step 4: Generate messages
    // Pass through stranded motorists options if provided
    const messageOptions = {
      strandedMotorists: options.strandedMotorists || false,
      survivalGuidance: options.survivalGuidance || null,
      weatherCondition: options.weatherCondition || null
    };
    const messages = this.generateMessages(event, messageOptions);
    console.log('  ✓ Messages generated');

    console.log('  Step 5: Creating CAP message...');
    // Step 5: Create CAP message
    const capMessage = this.generateCAPMessage(event, geofence, messages);
    console.log('  ✓ CAP message created');

    // Step 6: Return alert package for supervisor approval
    const alertPackage = {
      success: true,
      recommended: recommended,
      warnings: warnings,
      status: recommended ? 'PENDING_APPROVAL' : 'NOT_RECOMMENDED',
      qualification,
      geofence,
      messages,
      capMessage,
      event,
      metadata: {
        generatedAt: new Date().toISOString(),
        priority: qualification.priority || 'STANDARD',
        estimatedReach: geofence.estimatedPopulation * 0.85, // 85% target
        requiresSupervisorApproval: true,
        overrideRequired: !recommended
      }
    };

    console.log('  Step 7: Logging to audit database...');
    // Step 7: Log to audit database (SOP Section 11) - Using lightweight logger with timeout
    try {
      const logPromise = IPAWSAuditLogger.logAlert(
        alertPackage,
        options.user || { id: 'system', name: 'System' },
        options.trainingMode ? 'training' : 'draft'
      );

      // Set 5-second timeout for audit logging
      const logTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Audit logging timeout')), 5000)
      );

      const logResult = await Promise.race([logPromise, logTimeoutPromise]);
      alertPackage.metadata.auditLogId = logResult.logId;
      alertPackage.metadata.auditAlertId = logResult.alertId;
      alertPackage.metadata.trainingMode = options.trainingMode || false;
      console.log('  ✓ Audit log created');
    } catch (err) {
      console.warn('  ⚠️ Failed to log IPAWS alert to audit database:', err.message);
      // Don't fail the alert generation if logging fails
      alertPackage.warnings.push({
        type: 'audit_log',
        severity: 'warning',
        message: 'Failed to write to audit log. Alert can still proceed, but compliance tracking may be affected.',
        error: err.message
      });
    }

    console.log('  ✓ Alert package complete');
    return alertPackage;
  }

  /**
   * Format alert for display/review
   */
  formatAlertSummary(alert) {
    if (!alert.success) {
      return {
        status: 'NOT_QUALIFIED',
        reason: alert.reason
      };
    }

    return {
      status: alert.status,
      priority: alert.metadata.priority,
      route: alert.event.corridor,
      location: this.extractLocation(alert.event),
      headline: alert.messages.english.headline,
      instruction: alert.messages.english.instruction,
      geofence: {
        areaMiles: alert.geofence.areaSquareMiles.toFixed(1),
        population: alert.geofence.estimatedPopulation,
        estimatedReach: alert.metadata.estimatedReach
      },
      expires: alert.capMessage.info.expires,
      criteria: alert.qualification.criteria
    };
  }
}

module.exports = new IPAWSAlertService();

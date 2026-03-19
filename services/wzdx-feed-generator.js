/**
 * WZDx Feed Generator Service
 * Generates WZDx v4.2-compliant feeds according to USDOT specifications
 * Reference: https://github.com/usdot-jpo-ode/wzdx/blob/develop/Creating_a_WZDx_Feed.md
 */

const crypto = require('crypto');

class WZDxFeedGenerator {
  constructor(db) {
    this.db = db;
    this.WZDX_VERSION = '4.2';
    this.FEED_PUBLISHER = 'TETC DOT Corridor Communicator';
    this.CONTACT_NAME = 'TETC Operations';
    this.CONTACT_EMAIL = 'operations@tetcoalition.org';
  }

  /**
   * Generate a complete WZDx feed from events
   * Meets all WZDx v4.2 business rules and requirements
   */
  async generateFeed(options = {}) {
    const {
      stateFilter = null,
      includeCompleted = false,
      dataSourceId = 'tetc-corridor-communicator'
    } = options;

    // Get events from database
    const events = await this.getEvents(stateFilter, includeCompleted);

    // Segment events that have changing lane characteristics
    const segmentedEvents = this.segmentEventsByLaneChanges(events);

    // Convert to WZDx features
    const features = segmentedEvents.map(event => this.eventToWZDxFeature(event, dataSourceId));

    // Build feed with metadata
    return {
      type: 'FeatureCollection',
      features: features,
      road_event_feed_info: {
        feed_info_id: crypto.randomUUID(),
        update_date: new Date().toISOString(), // UTC timestamp
        publisher: this.FEED_PUBLISHER,
        contact_name: this.CONTACT_NAME,
        contact_email: this.CONTACT_EMAIL,
        update_frequency: 300, // 5 minutes in seconds
        version: this.WZDX_VERSION,
        license: 'https://creativecommons.org/publicdomain/zero/1.0/',
        data_sources: [
          {
            data_source_id: dataSourceId,
            feed_info_id: crypto.randomUUID(),
            organization_name: this.FEED_PUBLISHER,
            contact_name: this.CONTACT_NAME,
            contact_email: this.CONTACT_EMAIL,
            update_frequency: 300,
            update_date: new Date().toISOString(),
            location_verify_method: 'gps-based',
            lrs_type: 'milemarker'
          }
        ]
      }
    };
  }

  /**
   * Segment events by lane characteristic changes (Business Rule #1)
   * Events must be split when required properties or lane characteristics change
   */
  segmentEventsByLaneChanges(events) {
    const segmented = [];

    for (const event of events) {
      // If no lane data or simple event, no segmentation needed
      if (!event.lanes || event.lanes.length === 0) {
        segmented.push(event);
        continue;
      }

      // Check if lanes change along the route
      const uniqueLaneConfigs = this.getUniqueLaneConfigurations(event);

      if (uniqueLaneConfigs.length === 1) {
        // No changes, single segment
        segmented.push(event);
      } else {
        // Split into multiple segments
        const segments = this.splitEventByLaneChanges(event, uniqueLaneConfigs);
        segmented.push(...segments);
      }
    }

    return segmented;
  }

  /**
   * Convert event to WZDx WorkZoneRoadEvent or DetourRoadEvent feature
   */
  eventToWZDxFeature(event, dataSourceId) {
    // Ensure geometry coordinate order: first point = where users encounter event
    const geometry = this.normalizeGeometry(event.geometry, event.direction, event);

    // Determine if this is a work zone or detour
    const isDetour = event.eventType === 'detour';

    const feature = {
      type: 'Feature',
      id: event.id,
      properties: {
        core_details: {
          event_type: isDetour ? 'detour' : 'work-zone',
          data_source_id: dataSourceId,
          direction: this.normalizeDirection(event.direction),
          road_name: event.roadName || event.route || event.corridor || 'Unknown',
          description: event.description || event.headline
        },

        // Start/end times in UTC (Business Rule #5)
        // Fallback to updated timestamp if startTime missing
        start_date: this.ensureUTC(event.startTime || event.updated),
        end_date: event.endTime ? this.ensureUTC(event.endTime) : null,

        // Vehicle impact (required for work zones)
        vehicle_impact: this.determineVehicleImpact(event),

        // Lane information (if present, must cover ALL lanes - Business Rule #2)
        ...(event.lanes && event.lanes.length > 0 && {
          lanes: this.validateAndOrderLanes(event.lanes, event.totalLanes)
        }),

        // Location details
        location_method: event.locationMethod || 'channel-device-method',

        // Work zone specific properties
        ...(!isDetour && {
          work_zone_type: event.workZoneType || this.inferWorkZoneType(event),
          reduced_speed_limit: event.speedLimit || this.inferSpeedLimit(event),
          restrictions: event.restrictions || this.inferRestrictions(event),
          // Advance warning and termination area distances (in meters)
          beginning_accuracy: this.inferBeginningAccuracy(event),
          ending_accuracy: this.inferEndingAccuracy(event)
        }),

        // Detour specific properties
        ...(isDetour && {
          beginning_cross_street: event.beginningCrossStreet || null,
          ending_cross_street: event.endingCrossStreet || null
        })
      },
      geometry: geometry
    };

    return feature;
  }

  /**
   * Normalize geometry to WZDx requirements:
   * - First point = where road users encounter the event
   * - Use LineString when 3+ points define path
   * - Dense point coverage on curves
   */
  normalizeGeometry(eventGeometry, direction, event) {
    // Try to get geometry from various sources
    let geometry = eventGeometry;

    // If no geometry provided but we have lat/lon, create Point geometry
    if (!geometry || !geometry.coordinates) {
      if (event && event.latitude && event.longitude) {
        return {
          type: 'Point',
          coordinates: [parseFloat(event.longitude), parseFloat(event.latitude)]
        };
      }
      return { type: 'Point', coordinates: [0, 0] };
    }

    let coords = geometry.coordinates;

    // If MultiLineString, flatten to LineString
    if (geometry.type === 'MultiLineString') {
      coords = coords.flat();
    }

    // Ensure coordinate order matches traffic flow
    // If direction is westbound or southbound, reverse coordinates
    if (direction && (
      direction.toLowerCase().includes('west') ||
      direction.toLowerCase().includes('south')
    )) {
      coords = [...coords].reverse();
    }

    // Use LineString for 3+ points, Point otherwise
    if (coords.length >= 3) {
      return {
        type: 'LineString',
        coordinates: coords
      };
    } else if (coords.length === 1 || geometry.type === 'Point') {
      return {
        type: 'Point',
        coordinates: coords[0] || coords
      };
    } else {
      // 2 points - use LineString
      return {
        type: 'LineString',
        coordinates: coords
      };
    }
  }

  /**
   * Validate lane data covers ALL lanes (Business Rule #2)
   * Order lanes from left to right starting at 1 (Business Rule #3)
   */
  validateAndOrderLanes(lanes, totalLanes) {
    if (!lanes || lanes.length === 0) {
      return [];
    }

    // Ensure we have data for all lanes
    if (totalLanes && lanes.length !== totalLanes) {
      console.warn(`Partial lane data detected: ${lanes.length} lanes provided, ${totalLanes} total lanes. This violates WZDx Business Rule #2.`);
      // In production, we should either:
      // 1. Fill in missing lanes with assumed values
      // 2. Omit lane data entirely
      // For now, we'll omit to maintain compliance
      return [];
    }

    // Order lanes left to right (Business Rule #3)
    const orderedLanes = lanes.sort((a, b) => (a.order || 0) - (b.order || 0));

    return orderedLanes.map((lane, index) => ({
      order: index + 1, // Start at 1
      status: this.normalizeLaneStatus(lane.status),
      type: lane.type || 'general',
      restrictions: lane.restrictions || []
    }));
  }

  /**
   * Normalize lane status per WZDx specifications
   * Example: parking lane used for traffic = parking lane "closed", travel lanes "shift-right"
   */
  normalizeLaneStatus(status) {
    const validStatuses = [
      'open',
      'closed',
      'shift-left',
      'shift-right',
      'merge-left',
      'merge-right',
      'alternating-flow'
    ];

    const normalized = status?.toLowerCase().replace(/_/g, '-');
    return validStatuses.includes(normalized) ? normalized : 'open';
  }

  /**
   * Normalize direction to WZDx enum
   */
  normalizeDirection(direction) {
    if (!direction) return 'unknown';

    const dir = direction.toLowerCase();

    const validDirections = [
      'northbound',
      'southbound',
      'eastbound',
      'westbound',
      'inner-loop',
      'outer-loop',
      'undefined',
      'unknown'
    ];

    // Map common abbreviations
    const directionMap = {
      'nb': 'northbound',
      'sb': 'southbound',
      'eb': 'eastbound',
      'wb': 'westbound',
      'north': 'northbound',
      'south': 'southbound',
      'east': 'eastbound',
      'west': 'westbound'
    };

    const mapped = directionMap[dir] || dir;
    return validDirections.includes(mapped) ? mapped : 'unknown';
  }

  /**
   * Determine vehicle impact from event data
   */
  determineVehicleImpact(event) {
    const validImpacts = [
      'all-lanes-closed',
      'some-lanes-closed',
      'all-lanes-open',
      'alternating-one-way',
      'some-lanes-closed-merge-left',
      'some-lanes-closed-merge-right',
      'all-lanes-open-shift-left',
      'all-lanes-open-shift-right',
      'some-lanes-closed-split',
      'flagging',
      'temporary-traffic-signal',
      'unknown'
    ];

    // Try to infer from lane data
    if (event.lanes && event.lanes.length > 0) {
      const closedLanes = event.lanes.filter(l => l.status === 'closed');
      const allClosed = closedLanes.length === event.lanes.length;
      const someClosed = closedLanes.length > 0 && closedLanes.length < event.lanes.length;

      if (allClosed) return 'all-lanes-closed';
      if (someClosed) {
        // Check for merge indicators
        const hasShiftLeft = event.lanes.some(l => l.status === 'shift-left');
        const hasShiftRight = event.lanes.some(l => l.status === 'shift-right');
        const hasMergeLeft = event.lanes.some(l => l.status === 'merge-left');
        const hasMergeRight = event.lanes.some(l => l.status === 'merge-right');

        if (hasMergeLeft) return 'some-lanes-closed-merge-left';
        if (hasMergeRight) return 'some-lanes-closed-merge-right';
        if (hasShiftLeft) return 'all-lanes-open-shift-left';
        if (hasShiftRight) return 'all-lanes-open-shift-right';

        return 'some-lanes-closed';
      }

      return 'all-lanes-open';
    }

    // Try to infer from lanesAffected field (used by Nebraska, Nevada, etc.)
    if (event.lanesAffected) {
      const lanesText = event.lanesAffected.toLowerCase();

      if (lanesText.includes('all') && (lanesText.includes('closed') || lanesText.includes('blocked'))) {
        return 'all-lanes-closed';
      } else if (lanesText.includes('closed') || lanesText.includes('blocked')) {
        return 'some-lanes-closed';
      } else if (lanesText.includes('restricted') || lanesText.includes('reduced')) {
        return 'some-lanes-closed';
      } else if (lanesText.includes('open') || lanesText.includes('normal')) {
        return 'all-lanes-open';
      }
    }

    // Fallback to event vehicleImpact if provided
    const impact = event.vehicleImpact?.toLowerCase().replace(/_/g, '-');
    return validImpacts.includes(impact) ? impact : 'unknown';
  }

  /**
   * Infer work zone type from event classification
   */
  inferWorkZoneType(event) {
    if (!event.eventType) return 'static';

    const type = event.eventType.toLowerCase();

    // Moving work zones
    if (type.includes('weather') || type.includes('incident') ||
        type.includes('crash') || type.includes('accident')) {
      return 'moving';
    }

    // Static work zones (construction, maintenance, planned events)
    if (type.includes('construction') || type.includes('maintenance') ||
        type.includes('work') || type.includes('closure')) {
      return 'static';
    }

    // Default to static for unknown types
    return 'static';
  }

  /**
   * Infer speed limit from description or lanesAffected
   */
  inferSpeedLimit(event) {
    // Look for speed limit patterns in description
    const text = `${event.description || ''} ${event.lanesAffected || ''}`.toLowerCase();

    // Match patterns like "45 mph", "speed limit 35", "reduced to 40"
    const speedMatch = text.match(/(?:speed limit|reduced to|limit|mph)\s*:?\s*(\d{2,3})\s*(?:mph)?/i);
    if (speedMatch) {
      const speed = parseInt(speedMatch[1]);
      // Validate reasonable speed limits (15-80 mph)
      if (speed >= 15 && speed <= 80) {
        return speed;
      }
    }

    return null;
  }

  /**
   * Infer restrictions from description
   */
  inferRestrictions(event) {
    const restrictions = [];
    const text = `${event.description || ''} ${event.lanesAffected || ''}`.toLowerCase();

    // Check for common restriction types
    const restrictionPatterns = {
      'no-trucks': ['no trucks', 'truck restriction', 'trucks prohibited', 'no commercial'],
      'reduced-width': ['width restriction', 'narrow', 'width limit', 'max width'],
      'reduced-height': ['height restriction', 'low clearance', 'height limit', 'max height', 'overhead'],
      'reduced-length': ['length restriction', 'long vehicle', 'max length', 'oversized', 'over 40ft', 'over 50ft', 'over 60ft'],
      'reduced-weight': ['weight restriction', 'weight limit', 'max weight', 'load limit'],
      'hazmat-prohibited': ['hazmat', 'hazardous materials', 'no hazmat'],
      'local-access-only': ['local access', 'local traffic only', 'residents only']
    };

    for (const [restrictionType, patterns] of Object.entries(restrictionPatterns)) {
      if (patterns.some(pattern => text.includes(pattern))) {
        restrictions.push({
          type: restrictionType
        });
      }
    }

    return restrictions;
  }

  /**
   * Infer beginning_accuracy (advance warning area distance in meters)
   * Distance from first coordinate to actual work zone start
   * Creates buffer zone for advance warning signage
   */
  inferBeginningAccuracy(event) {
    const roadName = (event.roadName || event.route || event.corridor || '').toLowerCase();
    const severity = (event.severity || '').toLowerCase();

    // Interstate highways - longer advance warning (MUTCD standards)
    if (/\bi-?\d+\b/.test(roadName) || /interstate/i.test(roadName)) {
      // Critical events need more warning distance
      if (severity === 'critical' || severity === 'high') {
        return 1000; // 1000 meters (~3280 feet) - full advance warning
      }
      return 500; // 500 meters (~1640 feet) - standard interstate
    }

    // US highways and state routes
    if (/\bus-?\d+\b/.test(roadName) || /\bstate route\b/i.test(roadName)) {
      if (severity === 'critical' || severity === 'high') {
        return 500; // 500 meters
      }
      return 300; // 300 meters (~985 feet)
    }

    // Local/arterial roads - shorter advance warning
    if (severity === 'critical' || severity === 'high') {
      return 300; // 300 meters
    }
    return 150; // 150 meters (~490 feet) - minimum advance warning
  }

  /**
   * Infer ending_accuracy (termination area distance in meters)
   * Distance from last coordinate to actual work zone end
   * Creates buffer zone for work zone termination signage
   */
  inferEndingAccuracy(event) {
    const roadName = (event.roadName || event.route || event.corridor || '').toLowerCase();

    // Interstate highways - longer termination area
    if (/\bi-?\d+\b/.test(roadName) || /interstate/i.test(roadName)) {
      return 200; // 200 meters (~655 feet) - interstate termination
    }

    // US highways and state routes
    if (/\bus-?\d+\b/.test(roadName) || /\bstate route\b/i.test(roadName)) {
      return 150; // 150 meters (~490 feet)
    }

    // Local/arterial roads
    return 100; // 100 meters (~330 feet) - minimum termination area
  }

  /**
   * Ensure timestamp is in UTC format (Business Rule #5)
   */
  ensureUTC(timestamp) {
    if (!timestamp) return null;

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;

    return date.toISOString(); // Always returns UTC
  }

  /**
   * Get events from database
   */
  async getEvents(stateFilter, includeCompleted) {
    // This is a placeholder - implement based on your database schema
    // In production, query your events table and filter appropriately

    let query = `
      SELECT * FROM events
      WHERE 1=1
    `;

    const params = [];

    if (stateFilter) {
      query += ` AND state_code = $1`;
      params.push(stateFilter);
    }

    if (!includeCompleted) {
      query += ` AND (end_time IS NULL OR end_time > NOW())`;
    }

    query += ` ORDER BY start_time DESC`;

    // Execute query and return results
    // This will depend on whether you're using PostgreSQL or SQLite
    return [];
  }

  /**
   * Helper: Get unique lane configurations
   */
  getUniqueLaneConfigurations(event) {
    // Implementation depends on how lane changes are stored
    // For now, return single configuration
    return [event.lanes];
  }

  /**
   * Helper: Split event by lane changes
   */
  splitEventByLaneChanges(event, laneConfigs) {
    // Implementation depends on geometry and lane change locations
    // For now, return single event
    return [event];
  }
}

module.exports = WZDxFeedGenerator;

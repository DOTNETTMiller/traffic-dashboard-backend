/**
 * V2X Message to GeoJSON Converter
 *
 * Converts SAE J2735 messages (BSM, TIM, SPaT, MAP, PSM, etc.) to GeoJSON format
 * for visualization in mapping applications
 *
 * Based on jpo-geojsonconverter principles from USDOT ITS JPO ODE
 */

class GeoJSONConverter {
  /**
   * Convert BSM (Basic Safety Message) to GeoJSON
   */
  static bsmToGeoJSON(bsm) {
    const lat = bsm.coreData?.lat || bsm.latitude;
    const lon = bsm.coreData?.long || bsm.coreData?.lon || bsm.longitude;

    if (!lat || !lon) {
      throw new Error('BSM missing required coordinates');
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      },
      properties: {
        messageType: 'BSM',
        vehicleId: bsm.coreData?.id || bsm.id,
        speed: bsm.coreData?.speed,
        heading: bsm.coreData?.heading,
        acceleration: bsm.coreData?.accelSet,
        brakeStatus: bsm.coreData?.brakes,
        vehicleSize: bsm.coreData?.size,
        vehicleType: bsm.coreData?.type,
        timestamp: bsm.metadata?.odeReceivedAt || bsm.timestamp,
        secMark: bsm.coreData?.secMark
      }
    };
  }

  /**
   * Convert TIM (Traveler Information Message) to GeoJSON
   */
  static timToGeoJSON(tim) {
    const position = tim.position || tim.coordinates;
    const lat = position?.lat || tim.latitude;
    const lon = position?.long || position?.lon || tim.longitude;

    if (!lat || !lon) {
      throw new Error('TIM missing required coordinates');
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      },
      properties: {
        messageType: 'TIM',
        packetId: tim.packetID || tim.id,
        startTime: tim.startTime,
        endTime: tim.endTime,
        eventType: tim.itis?.codes?.[0] || tim.eventType,
        description: tim.content || tim.description,
        priority: tim.priority,
        region: tim.regions,
        timestamp: tim.timestamp
      }
    };
  }

  /**
   * Convert SPaT (Signal Phase and Timing) to GeoJSON
   */
  static spatToGeoJSON(spat) {
    const lat = spat.latitude;
    const lon = spat.longitude;

    if (!lat || !lon) {
      throw new Error('SPaT missing required coordinates');
    }

    // Get all signal states for this intersection
    const signalStates = (spat.intersections || []).flatMap(intersection =>
      (intersection.states || []).map(state => ({
        signalGroup: state.signalGroup,
        eventState: state.state,
        timing: state.timing
      }))
    );

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      },
      properties: {
        messageType: 'SPaT',
        intersectionId: spat.intersection_id || spat.intersectionId,
        intersectionName: spat.intersection_name || spat.name,
        timestamp: spat.timestamp,
        minuteOfYear: spat.minute_of_year,
        signalStates: signalStates,
        revision: spat.revision
      }
    };
  }

  /**
   * Convert MAP (Intersection Geometry) to GeoJSON
   */
  static mapToGeoJSON(map) {
    const lat = map.latitude;
    const lon = map.longitude;

    if (!lat || !lon) {
      throw new Error('MAP missing required coordinates');
    }

    // Create lane geometries
    const lanes = (map.lanes || []).map(lane => {
      const nodes = JSON.parse(lane.node_list || '[]');
      const coordinates = nodes.map(node => [
        lon + (node.offsetX || 0) / 111320,  // Approximate degrees per meter at equator
        lat + (node.offsetY || 0) / 110540
      ]);

      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coordinates.length > 0 ? coordinates : [[lon, lat]]
        },
        properties: {
          laneId: lane.lane_id,
          laneType: lane.lane_type,
          ingress: lane.ingress,
          egress: lane.egress,
          maneuvers: lane.maneuvers,
          connects_to: lane.connects_to
        }
      };
    });

    // Create feature collection for the intersection
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lon, lat]
          },
          properties: {
            messageType: 'MAP',
            intersectionId: map.intersection_id,
            intersectionName: map.intersection_name,
            laneCount: map.lanes?.length || 0,
            revision: map.revision
          }
        },
        ...lanes
      ]
    };
  }

  /**
   * Convert PSM (Personal Safety Message) to GeoJSON
   */
  static psmToGeoJSON(psm) {
    const lat = psm.latitude;
    const lon = psm.longitude;

    if (!lat || !lon) {
      throw new Error('PSM missing required coordinates');
    }

    // If path history exists, create a line string
    const pathHistory = psm.path_history ? JSON.parse(psm.path_history) : null;
    const geometry = pathHistory && pathHistory.length > 0
      ? {
          type: 'LineString',
          coordinates: pathHistory.map(p => [p.lon, p.lat])
        }
      : {
          type: 'Point',
          coordinates: [lon, lat]
        };

    return {
      type: 'Feature',
      geometry,
      properties: {
        messageType: 'PSM',
        basicType: psm.basic_type,
        userType: psm.user_type,
        speed: psm.speed,
        heading: psm.heading,
        clusterSize: psm.cluster_size,
        eventResponderType: psm.event_responder_type,
        timestamp: psm.created_at
      }
    };
  }

  /**
   * Convert SRM (Signal Request Message) to GeoJSON
   */
  static srmToGeoJSON(srm) {
    const lat = srm.latitude;
    const lon = srm.longitude;

    if (!lat || !lon) {
      return null; // SRM may not always have coordinates
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      },
      properties: {
        messageType: 'SRM',
        requestId: srm.request_id,
        intersectionId: srm.intersection_id,
        requesterType: srm.requester_type,
        requestType: srm.request_type,
        priorityLevel: srm.priority_level,
        status: srm.status,
        eta: {
          minute: srm.eta_minute,
          second: srm.eta_second
        },
        timestamp: srm.created_at
      }
    };
  }

  /**
   * Convert any V2X message to GeoJSON
   */
  static toGeoJSON(message, messageType) {
    try {
      switch (messageType.toUpperCase()) {
        case 'BSM':
          return this.bsmToGeoJSON(message);
        case 'TIM':
          return this.timToGeoJSON(message);
        case 'SPAT':
          return this.spatToGeoJSON(message);
        case 'MAP':
          return this.mapToGeoJSON(message);
        case 'PSM':
          return this.psmToGeoJSON(message);
        case 'SRM':
          return this.srmToGeoJSON(message);
        default:
          throw new Error(`Unsupported message type: ${messageType}`);
      }
    } catch (error) {
      console.error(`Error converting ${messageType} to GeoJSON:`, error.message);
      return null;
    }
  }

  /**
   * Convert multiple messages to GeoJSON FeatureCollection
   */
  static toFeatureCollection(messages, messageType) {
    const features = messages
      .map(msg => this.toGeoJSON(msg, messageType))
      .filter(f => f !== null);

    return {
      type: 'FeatureCollection',
      features: Array.isArray(features[0]?.features)
        ? features.flatMap(f => f.features)
        : features
    };
  }

  /**
   * Create a combined GeoJSON from mixed message types
   */
  static createCombinedGeoJSON(messageGroups) {
    const allFeatures = [];

    for (const [messageType, messages] of Object.entries(messageGroups)) {
      const features = messages
        .map(msg => this.toGeoJSON(msg, messageType))
        .filter(f => f !== null);

      if (Array.isArray(features[0]?.features)) {
        allFeatures.push(...features.flatMap(f => f.features));
      } else {
        allFeatures.push(...features);
      }
    }

    return {
      type: 'FeatureCollection',
      features: allFeatures,
      metadata: {
        generatedAt: new Date().toISOString(),
        messageTypes: Object.keys(messageGroups),
        totalFeatures: allFeatures.length
      }
    };
  }

  /**
   * Convert work zone event to GeoJSON (for WZDx compatibility)
   */
  static wzdxToGeoJSON(event) {
    const geometry = event.geometry || event.coordinates;

    if (!geometry) {
      return null;
    }

    return {
      type: 'Feature',
      id: event.id,
      geometry: geometry,
      properties: {
        messageType: 'WZDx',
        eventType: event.core_details?.event_type || event.eventType,
        roadName: event.core_details?.road_names?.[0] || event.corridor,
        direction: event.core_details?.direction || event.direction,
        startDate: event.core_details?.start_date || event.startTime,
        endDate: event.core_details?.end_date || event.endTime,
        description: event.core_details?.description || event.description,
        workersPresent: event.core_details?.workers_present,
        reducedSpeedLimit: event.core_details?.reduced_speed_limit_kph
      }
    };
  }
}

module.exports = GeoJSONConverter;

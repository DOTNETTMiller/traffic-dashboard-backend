/**
 * TIM (Traveler Information Message) Generator
 *
 * ARC-IT Service Packages:
 * - TM22: Dynamic Roadway Warning (V2I via RSU)
 * - TM18: Roadway Warning
 * - WZ05: Work Zone Traveler Information
 *
 * Implements SAE J2735 TIM format for V2X broadcast via RSU
 * Maps sensor data and events to standardized TIM messages
 */

const crypto = require('crypto');

// ITIS (International Traveler Information Systems) Codes
// Standard codes for common travel conditions
const ITIS_CODES = {
  // Weather-related (5889-6143)
  ICE_ON_ROADWAY: 5889,
  BRIDGE_ICE: 5890,
  SNOW_ON_ROADWAY: 5891,
  WET_ROADWAY: 5892,
  SLIPPERY_ROADWAY: 5893,
  LOW_VISIBILITY: 5902,
  FOG: 5903,
  HEAVY_RAIN: 5904,
  HEAVY_SNOW: 5905,
  HIGH_WINDS: 5906,

  // Work Zone (513-768)
  ROAD_WORK: 513,
  ROAD_WORK_AHEAD: 514,
  CONSTRUCTION: 515,
  WORKERS_ON_ROADWAY: 516,
  LANE_CLOSED: 517,
  LANES_CLOSED: 518,
  REDUCED_LANES: 519,
  SHOULDER_WORK: 520,

  // Incidents (769-1024)
  ACCIDENT: 769,
  VEHICLE_STOPPED: 770,
  STALLED_VEHICLE: 771,
  INCIDENT: 772,
  INCIDENT_AHEAD: 773,
  DEBRIS_ON_ROADWAY: 774,
  WRONG_WAY_DRIVER: 775,

  // Speed/Traffic (257-512)
  SLOW_TRAFFIC: 257,
  HEAVY_TRAFFIC: 258,
  TRAFFIC_CONGESTION: 259,
  SPEED_LIMIT_REDUCED: 260,
  REDUCE_SPEED: 261,

  // Advisories (1-256)
  CAUTION: 1,
  WARNING: 2,
  DANGER: 3,
  EMERGENCY: 4
};

class TIMGenerator {
  constructor() {
    this.messageCounter = 0;
  }

  /**
   * Generate TIM from traffic event
   * ARC-IT Flow: incident information → roadway information system data
   */
  async generateTIMFromEvent(event) {
    const severity = this.calculateSeverity(event);
    const itisCodes = this.getITISCodesForEvent(event);
    const region = this.createRegionFromEvent(event);

    return {
      msgCnt: this.getNextMessageCount(),
      timeStamp: this.getJ2735Timestamp(),
      packetID: this.generatePacketID(),
      urlB: null, // Optional URL for more info
      dataFrames: [{
        sspTimRights: 0,
        frameType: {
          advisory: severity <= 2 ? {} : null,
          roadSignage: severity > 2 ? {} : null
        },
        msgId: {
          roadSignID: {
            position: region.anchorPosition,
            viewAngle: '1111111111111111', // All directions
            mutcdCode: this.getMUTCDCode(event)
          }
        },
        startYear: new Date().getFullYear(),
        startTime: this.getMinuteOfYear(),
        duratonTime: this.calculateDuration(event),
        priority: severity,
        sspLocationRights: 0,
        regions: [region],
        sspMsgRights1: 0,
        sspMsgRights2: 0,
        content: {
          advisory: {
            item: [{
              itis: itisCodes
            }]
          }
        },
        url: null
      }]
    };
  }

  /**
   * Generate TIM from sensor data
   * ARC-IT Flow: environmental sensor data → roadway information system data
   */
  async generateTIMFromSensor(sensorData, sensorLocation) {
    const warningType = this.determineSensorWarning(sensorData);

    if (!warningType) {
      return null; // No warning needed
    }

    const itisCodes = this.getITISCodesForSensor(warningType, sensorData);
    const region = this.createRegionFromLocation(sensorLocation, 2); // 2 mile warning zone

    return {
      msgCnt: this.getNextMessageCount(),
      timeStamp: this.getJ2735Timestamp(),
      packetID: this.generatePacketID(),
      dataFrames: [{
        frameType: {
          roadSignage: {} // Environmental warnings use road signage frame
        },
        msgId: {
          roadSignID: {
            position: region.anchorPosition,
            viewAngle: '1111111111111111',
            mutcdCode: this.getMUTCDCodeForSensor(warningType)
          }
        },
        startYear: new Date().getFullYear(),
        startTime: this.getMinuteOfYear(),
        duratonTime: 60, // Environmental warnings last 60 minutes by default
        priority: this.getSensorWarningPriority(warningType, sensorData),
        regions: [region],
        content: {
          advisory: {
            item: [{
              itis: itisCodes
            }]
          }
        }
      }]
    };
  }

  /**
   * Generate TIM from WZDx work zone
   * ARC-IT Service Package: WZ05 - Work Zone Traveler Information
   */
  async generateTIMFromWorkZone(workZone) {
    const itisCodes = this.getITISCodesForWorkZone(workZone);
    const region = this.createRegionFromGeometry(workZone.geometry);

    return {
      msgCnt: this.getNextMessageCount(),
      timeStamp: this.getJ2735Timestamp(),
      packetID: this.generatePacketID(),
      dataFrames: [{
        frameType: {
          roadSignage: {}
        },
        msgId: {
          roadSignID: {
            position: region.anchorPosition,
            viewAngle: '1111111111111111',
            mutcdCode: 'W20-1' // Work zone warning
          }
        },
        startYear: new Date(workZone.properties.start_date).getFullYear(),
        startTime: this.dateToMinuteOfYear(new Date(workZone.properties.start_date)),
        duratonTime: this.calculateWorkZoneDuration(workZone),
        priority: this.getWorkZonePriority(workZone),
        regions: [region],
        content: {
          advisory: {
            item: [{
              itis: itisCodes,
              text: workZone.properties.core_details?.description
            }]
          }
        }
      }]
    };
  }

  /**
   * Determine sensor warning type based on readings
   */
  determineSensorWarning(sensorData) {
    const type = sensorData.type?.toLowerCase();

    // RWIS (Road Weather Information System)
    if (type === 'rwis' || type === 'weather') {
      // Ice conditions
      if (sensorData.pavement_temp <= 32 && sensorData.moisture) {
        return 'ice';
      }
      if (sensorData.friction < 0.4) {
        return 'slippery';
      }
      // Low visibility
      if (sensorData.visibility < 500) { // feet
        return 'low_visibility';
      }
      // High winds
      if (sensorData.wind_speed > 40) { // mph
        return 'high_winds';
      }
    }

    // Traffic sensors
    if (type === 'traffic') {
      if (sensorData.speed < 30 && sensorData.volume > 500) {
        return 'congestion';
      }
    }

    return null;
  }

  /**
   * Get ITIS codes for traffic event
   */
  getITISCodesForEvent(event) {
    const codes = [];
    const desc = event.description?.toLowerCase() || '';
    const type = event.event_type?.toLowerCase() || '';

    // Incident types
    if (desc.includes('accident') || desc.includes('crash')) {
      codes.push(ITIS_CODES.ACCIDENT);
    } else if (desc.includes('stalled') || desc.includes('disabled')) {
      codes.push(ITIS_CODES.STALLED_VEHICLE);
    } else if (desc.includes('debris')) {
      codes.push(ITIS_CODES.DEBRIS_ON_ROADWAY);
    } else if (desc.includes('wrong way')) {
      codes.push(ITIS_CODES.WRONG_WAY_DRIVER);
      codes.push(ITIS_CODES.DANGER);
    }

    // Work zones
    if (type.includes('construction') || desc.includes('construction')) {
      codes.push(ITIS_CODES.CONSTRUCTION);
    } else if (type.includes('work') || desc.includes('road work')) {
      codes.push(ITIS_CODES.ROAD_WORK_AHEAD);
    }

    // Lane closures
    if (desc.includes('lane closed') || desc.includes('lane closure')) {
      codes.push(ITIS_CODES.LANE_CLOSED);
    }

    // Default incident code if no specific match
    if (codes.length === 0) {
      codes.push(ITIS_CODES.INCIDENT_AHEAD);
    }

    return codes;
  }

  /**
   * Get ITIS codes for sensor warnings
   */
  getITISCodesForSensor(warningType, sensorData) {
    const codes = [];

    switch (warningType) {
      case 'ice':
        codes.push(ITIS_CODES.ICE_ON_ROADWAY);
        codes.push(ITIS_CODES.SLIPPERY_ROADWAY);
        codes.push(ITIS_CODES.REDUCE_SPEED);
        break;

      case 'slippery':
        codes.push(ITIS_CODES.SLIPPERY_ROADWAY);
        codes.push(ITIS_CODES.REDUCE_SPEED);
        break;

      case 'low_visibility':
        codes.push(ITIS_CODES.LOW_VISIBILITY);
        if (sensorData.fog) codes.push(ITIS_CODES.FOG);
        codes.push(ITIS_CODES.REDUCE_SPEED);
        break;

      case 'high_winds':
        codes.push(ITIS_CODES.HIGH_WINDS);
        codes.push(ITIS_CODES.CAUTION);
        break;

      case 'congestion':
        codes.push(ITIS_CODES.TRAFFIC_CONGESTION);
        codes.push(ITIS_CODES.SLOW_TRAFFIC);
        break;
    }

    return codes;
  }

  /**
   * Get ITIS codes for work zone
   */
  getITISCodesForWorkZone(workZone) {
    const codes = [];
    const props = workZone.properties;
    const core = props.core_details || {};

    // Work zone type
    if (core.event_type === 'work-zone') {
      codes.push(ITIS_CODES.ROAD_WORK_AHEAD);
    }

    // Worker presence
    if (props.worker_presence?.are_workers_present) {
      codes.push(ITIS_CODES.WORKERS_ON_ROADWAY);
      codes.push(ITIS_CODES.CAUTION);
    }

    // Lane closures
    if (props.vehicle_impact?.includes('some-lanes-closed')) {
      codes.push(ITIS_CODES.LANES_CLOSED);
    } else if (props.vehicle_impact?.includes('all-lanes-closed')) {
      codes.push(ITIS_CODES.LANES_CLOSED);
    }

    // Speed reduction
    if (props.reduced_speed_limit_kph) {
      codes.push(ITIS_CODES.SPEED_LIMIT_REDUCED);
    }

    return codes;
  }

  /**
   * Create geographic region from event
   */
  createRegionFromEvent(event) {
    return {
      name: `Event_${event.id}`,
      regulatorID: 0,
      segmentID: event.id,
      anchorPosition: {
        lat: event.latitude * 10000000, // J2735 format: degrees * 10^7
        long: event.longitude * 10000000,
        elevation: 0
      },
      laneWidth: 366, // 12 feet in cm
      directionality: 3, // Both directions
      closedPath: false,
      direction: this.getCompassDirection(event),
      description: {
        path: {
          offset: {
            xy: [{
              nodes: [
                { delta: { 'node-LatLon': { lon: 0, lat: 0 } } },
                { delta: { 'node-LatLon': { lon: 0, lat: 5000 } } } // 500m ahead
              ]
            }]
          }
        }
      }
    };
  }

  /**
   * Create region from sensor location with warning radius
   */
  createRegionFromLocation(location, radiusMiles) {
    const radiusMeters = radiusMiles * 1609.34;
    const latOffset = (radiusMeters / 111000) * 10000000; // Rough conversion

    return {
      name: `Sensor_${location.id}`,
      regulatorID: 0,
      segmentID: location.id || 0,
      anchorPosition: {
        lat: location.latitude * 10000000,
        long: location.longitude * 10000000,
        elevation: location.elevation || 0
      },
      laneWidth: 366,
      directionality: 3,
      closedPath: false,
      description: {
        path: {
          offset: {
            xy: [{
              nodes: [
                { delta: { 'node-LatLon': { lon: 0, lat: 0 } } },
                { delta: { 'node-LatLon': { lon: 0, lat: latOffset } } }
              ]
            }]
          }
        }
      }
    };
  }

  /**
   * Create region from WZDx GeoJSON geometry
   */
  createRegionFromGeometry(geometry) {
    const coords = geometry.coordinates;
    let anchorLat, anchorLon;

    if (geometry.type === 'LineString') {
      anchorLat = coords[0][1];
      anchorLon = coords[0][0];
    } else if (geometry.type === 'Point') {
      anchorLat = coords[1];
      anchorLon = coords[0];
    }

    return {
      name: 'WorkZone',
      regulatorID: 0,
      segmentID: 0,
      anchorPosition: {
        lat: anchorLat * 10000000,
        long: anchorLon * 10000000,
        elevation: 0
      },
      laneWidth: 366,
      directionality: 3,
      closedPath: false
    };
  }

  /**
   * Calculate severity (0-7, where 7 is most severe)
   */
  calculateSeverity(event) {
    const desc = event.description?.toLowerCase() || '';

    if (desc.includes('fatality') || desc.includes('wrong way')) return 7;
    if (desc.includes('injury') || desc.includes('fire')) return 6;
    if (desc.includes('accident') || desc.includes('crash')) return 5;
    if (desc.includes('stalled') || desc.includes('debris')) return 4;
    if (desc.includes('construction') || desc.includes('lane closed')) return 3;
    if (desc.includes('slow traffic')) return 2;

    return 3; // Default moderate severity
  }

  /**
   * Get sensor warning priority
   */
  getSensorWarningPriority(warningType, sensorData) {
    switch (warningType) {
      case 'ice': return 6; // High priority
      case 'slippery': return 5;
      case 'low_visibility': return 5;
      case 'high_winds': return 4;
      case 'congestion': return 3;
      default: return 3;
    }
  }

  /**
   * Get work zone priority
   */
  getWorkZonePriority(workZone) {
    const props = workZone.properties;

    if (props.worker_presence?.are_workers_present) return 6;
    if (props.vehicle_impact?.includes('all-lanes-closed')) return 5;
    if (props.vehicle_impact?.includes('some-lanes-closed')) return 4;

    return 3;
  }

  /**
   * Calculate message duration in minutes
   */
  calculateDuration(event) {
    // Default 2 hours for incidents
    return 120;
  }

  /**
   * Calculate work zone duration
   */
  calculateWorkZoneDuration(workZone) {
    const start = new Date(workZone.properties.start_date);
    const end = new Date(workZone.properties.end_date);

    const durationMs = end - start;
    const durationMinutes = Math.floor(durationMs / 60000);

    // Cap at maximum TIM duration (32767 minutes ~= 22 days)
    return Math.min(durationMinutes, 32767);
  }

  /**
   * Get MUTCD (Manual on Uniform Traffic Control Devices) sign code
   */
  getMUTCDCode(event) {
    const desc = event.description?.toLowerCase() || '';

    if (desc.includes('accident')) return 'W1-6'; // Incident ahead
    if (desc.includes('work') || desc.includes('construction')) return 'W20-1'; // Road work
    if (desc.includes('lane closed')) return 'W20-5'; // Lane closed
    if (desc.includes('detour')) return 'M4-8'; // Detour

    return 'W1-1'; // Generic warning
  }

  /**
   * Get MUTCD code for sensor warning
   */
  getMUTCDCodeForSensor(warningType) {
    switch (warningType) {
      case 'ice': return 'W8-5'; // Icy conditions
      case 'slippery': return 'W8-5'; // Slippery when wet
      case 'low_visibility': return 'W8-15'; // Low visibility
      case 'high_winds': return 'W8-14'; // High winds
      default: return 'W1-1'; // Generic warning
    }
  }

  /**
   * Get compass direction from event
   */
  getCompassDirection(event) {
    const dir = event.direction?.toLowerCase() || '';

    if (dir.includes('north')) return '0000000000000001'; // North
    if (dir.includes('south')) return '0000000000000100'; // South
    if (dir.includes('east')) return '0000000000000010'; // East
    if (dir.includes('west')) return '0000000000001000'; // West

    return '1111111111111111'; // All directions
  }

  /**
   * Generate unique packet ID
   */
  generatePacketID() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Get next message count
   */
  getNextMessageCount() {
    this.messageCounter = (this.messageCounter + 1) % 128;
    return this.messageCounter;
  }

  /**
   * Get J2735 timestamp (minutes since epoch)
   */
  getJ2735Timestamp() {
    return Math.floor(Date.now() / 60000);
  }

  /**
   * Get minute of year (J2735 format)
   */
  getMinuteOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    return Math.floor(diff / 60000);
  }

  /**
   * Convert date to minute of year
   */
  dateToMinuteOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / 60000);
  }
}

// Export singleton
const timGenerator = new TIMGenerator();

module.exports = {
  timGenerator,
  TIMGenerator,
  ITIS_CODES
};

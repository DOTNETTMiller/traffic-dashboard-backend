// CIFS (Connected Infrastructure Feed System) Service
// Handles TIM (Traveler Information Message) and CV-TIM (Connected Vehicle TIM) formats
// Integrates with USDOT connected vehicle infrastructure

const crypto = require('crypto');

class CIFSService {
  constructor(db) {
    this.db = db;
  }

  // ============================================================================
  // TIM (Traveler Information Message) Parser
  // ============================================================================

  /**
   * Parse TIM message
   * TIM format is used for broadcasting traveler information to connected vehicles
   * Based on SAE J2735 standard
   */
  parseTIM(timMessage) {
    if (!timMessage || typeof timMessage !== 'object') {
      throw new Error('Invalid TIM message format');
    }

    // Extract TIM core fields
    const {
      msgCnt = 0,
      timeStamp,
      packetID,
      urlB,
      dataFrames = []
    } = timMessage;

    const parsedFrames = dataFrames.map(frame => this.parseTIMDataFrame(frame));

    return {
      message_type: 'TIM',
      message_count: msgCnt,
      timestamp: timeStamp,
      packet_id: packetID,
      url: urlB,
      data_frames: parsedFrames,
      total_frames: dataFrames.length
    };
  }

  /**
   * Parse TIM Data Frame
   * Contains the actual traveler information content
   */
  parseTIMDataFrame(dataFrame) {
    const {
      sspTimRights,
      frameType,
      msgId,
      startTime,
      duratonTime,
      priority,
      sspLocationRights,
      regions = [],
      sspMsgContent,
      content,
      url
    } = dataFrame;

    return {
      ssp_tim_rights: sspTimRights,
      frame_type: frameType,
      message_id: msgId?.roadSignID || null,
      start_time: startTime,
      duration: duratonTime,
      priority: priority,
      ssp_location_rights: sspLocationRights,
      regions: regions.map(r => this.parseTIMRegion(r)),
      content: this.parseTIMContent(content),
      url: url
    };
  }

  /**
   * Parse TIM Geographic Region
   * Defines where the message applies
   */
  parseTIMRegion(region) {
    const {
      name,
      regulatorID,
      segmentID,
      anchorPosition,
      laneWidth,
      directionality,
      closedPath,
      description,
      path,
      circle
    } = region;

    // Parse anchor position (reference point)
    let coordinates = null;
    if (anchorPosition) {
      coordinates = {
        latitude: anchorPosition.lat / 10000000, // Convert from 1/10th microdegree
        longitude: anchorPosition.long / 10000000,
        elevation: anchorPosition.elevation
      };
    }

    // Parse path/shape
    let geometry = null;
    if (path?.scale && path?.type && path?.nodes) {
      geometry = this.parseTIMPath(path, coordinates);
    } else if (circle) {
      geometry = this.parseTIMCircle(circle, coordinates);
    }

    return {
      name: name,
      regulator_id: regulatorID,
      segment_id: segmentID,
      anchor_position: coordinates,
      lane_width: laneWidth,
      directionality: directionality,
      closed_path: closedPath,
      description: description,
      geometry: geometry
    };
  }

  /**
   * Parse TIM Path (polyline)
   */
  parseTIMPath(path, anchorPosition) {
    const { scale, type, nodes = [] } = path;

    if (!anchorPosition) {
      return null;
    }

    const coordinates = nodes.map(node => {
      // Offsets are in scale units
      const latOffset = (node.delta?.['node-LatLon']?.lat || 0) / scale;
      const lonOffset = (node.delta?.['node-LatLon']?.lon || 0) / scale;

      return [
        anchorPosition.longitude + lonOffset / 10000000,
        anchorPosition.latitude + latOffset / 10000000
      ];
    });

    // Add anchor position as first point if not included
    if (coordinates.length === 0 ||
        (coordinates[0][0] !== anchorPosition.longitude ||
         coordinates[0][1] !== anchorPosition.latitude)) {
      coordinates.unshift([anchorPosition.longitude, anchorPosition.latitude]);
    }

    return {
      type: 'LineString',
      coordinates: coordinates
    };
  }

  /**
   * Parse TIM Circle (radial region)
   */
  parseTIMCircle(circle, anchorPosition) {
    if (!anchorPosition) {
      return null;
    }

    const { center, radius, units } = circle;

    // Convert radius to meters based on units
    let radiusMeters = radius;
    if (units === 'feet') {
      radiusMeters = radius * 0.3048;
    } else if (units === 'miles') {
      radiusMeters = radius * 1609.34;
    } else if (units === 'kilometers') {
      radiusMeters = radius * 1000;
    }

    return {
      type: 'Point',
      coordinates: [anchorPosition.longitude, anchorPosition.latitude],
      radius_meters: radiusMeters
    };
  }

  /**
   * Parse TIM Content (the actual message)
   */
  parseTIMContent(content) {
    if (!content) return null;

    const {
      advisory = [],
      workZone = [],
      genericSign = [],
      speedLimit = [],
      exitService = []
    } = content;

    return {
      advisories: advisory.map(a => this.parseTIMAdvisory(a)),
      work_zones: workZone.map(w => this.parseTIMWorkZone(w)),
      generic_signs: genericSign,
      speed_limits: speedLimit,
      exit_services: exitService
    };
  }

  /**
   * Parse TIM Advisory (incidents, conditions, etc.)
   */
  parseTIMAdvisory(advisory) {
    const {
      item = [],
      SEQUENCE = []
    } = advisory;

    const items = item.length > 0 ? item : SEQUENCE;

    return items.map(i => ({
      itis_code: i.itis || null,
      text: i.text || null,
      description: this.translateITISCode(i.itis)
    }));
  }

  /**
   * Parse TIM Work Zone information
   */
  parseTIMWorkZone(workZone) {
    return {
      items: workZone.item || [],
      data: workZone
    };
  }

  /**
   * Translate ITIS (International Traveler Information System) code to description
   */
  translateITISCode(code) {
    const itis = {
      513: 'Accident',
      514: 'Major accident',
      515: 'Injury accident',
      516: 'Fatal accident',
      517: 'Minor accident',
      518: 'Multi-vehicle accident',
      769: 'Road work',
      770: 'Bridge work',
      771: 'Resurfacing work',
      772: 'Road construction',
      1025: 'Road closed',
      1026: 'Lane closed',
      1027: 'Shoulder closed',
      1028: 'Exit closed',
      1281: 'Slow traffic',
      1282: 'Heavy traffic',
      1283: 'Traffic congestion',
      1284: 'Stop and go traffic',
      1537: 'Hazardous driving conditions',
      1538: 'Weather conditions',
      1539: 'Ice on roadway',
      1540: 'Water on roadway',
      1541: 'Snow on roadway',
      1793: 'Reduced visibility',
      1794: 'Fog',
      1795: 'Smoke',
      1796: 'Heavy rain',
      1797: 'Heavy snow',
      2049: 'High winds',
      2050: 'Severe weather',
      2051: 'Storm warning'
    };

    return itis[code] || `ITIS Code ${code}`;
  }

  // ============================================================================
  // CV-TIM (Connected Vehicle TIM) Parser
  // ============================================================================

  /**
   * Parse CV-TIM message
   * CV-TIM is a connected vehicle specific format based on TIM
   * Includes additional connected vehicle fields
   */
  parseCVTIM(cvTimMessage) {
    if (!cvTimMessage || typeof cvTimMessage !== 'object') {
      throw new Error('Invalid CV-TIM message format');
    }

    // Parse base TIM structure
    const baseTIM = this.parseTIM(cvTimMessage);

    // Add CV-specific fields
    const {
      rsuID,
      rsuLocation,
      transmissionMode,
      psid,
      dsrcMsgID,
      deliveryStart,
      deliveryStop,
      deliveryInterval,
      signature,
      snmpProtocol
    } = cvTimMessage;

    return {
      ...baseTIM,
      message_type: 'CV-TIM',
      rsu_id: rsuID,
      rsu_location: rsuLocation ? {
        latitude: rsuLocation.lat / 10000000,
        longitude: rsuLocation.long / 10000000,
        elevation: rsuLocation.elevation
      } : null,
      transmission_mode: transmissionMode,
      psid: psid,
      dsrc_message_id: dsrcMsgID,
      delivery_start: deliveryStart,
      delivery_stop: deliveryStop,
      delivery_interval: deliveryInterval,
      signature: signature,
      snmp_protocol: snmpProtocol
    };
  }

  // ============================================================================
  // WZDx Conversion
  // ============================================================================

  /**
   * Convert TIM/CV-TIM to WZDx format
   * Allows integration with existing WZDx-based systems
   */
  convertToWZDx(parsedMessage) {
    const isCV = parsedMessage.message_type === 'CV-TIM';
    const frames = parsedMessage.data_frames || [];

    const wzdxEvents = [];

    frames.forEach((frame, frameIndex) => {
      frame.regions?.forEach((region, regionIndex) => {
        const event = {
          type: 'Feature',
          id: `${parsedMessage.message_type}-${parsedMessage.packet_id || 'unknown'}-${frameIndex}-${regionIndex}`,
          properties: {
            // Core WZDx fields
            core_details: {
              event_type: this.determinEventType(frame.content),
              data_source_id: isCV ? parsedMessage.rsu_id : 'TIM-broadcast',
              road_names: [region.name || 'Unknown'],
              direction: this.mapDirectionality(region.directionality)
            },

            // Start/end times
            start_date: frame.start_time || parsedMessage.timestamp || new Date().toISOString(),
            end_date: frame.duration ?
              new Date(new Date(frame.start_time).getTime() + frame.duration * 1000).toISOString() :
              null,

            // Location
            location_description: region.description,

            // Additional TIM data
            tim_data: {
              message_id: frame.message_id,
              priority: frame.priority,
              content: frame.content,
              itis_codes: this.extractITISCodes(frame.content)
            },

            // CV-TIM specific data
            ...(isCV && {
              cv_tim_data: {
                rsu_id: parsedMessage.rsu_id,
                rsu_location: parsedMessage.rsu_location,
                transmission_mode: parsedMessage.transmission_mode,
                dsrc_message_id: parsedMessage.dsrc_message_id
              }
            })
          },
          geometry: region.geometry || {
            type: 'Point',
            coordinates: region.anchor_position ?
              [region.anchor_position.longitude, region.anchor_position.latitude] :
              [0, 0]
          }
        };

        wzdxEvents.push(event);
      });
    });

    return {
      feed_info: {
        publisher: 'DOT Corridor Communicator',
        version: '4.0',
        data_sources: [{
          data_source_id: isCV ? 'cv-tim-feed' : 'tim-feed',
          feed_format: parsedMessage.message_type,
          update_date: parsedMessage.timestamp || new Date().toISOString()
        }]
      },
      type: 'FeatureCollection',
      features: wzdxEvents
    };
  }

  /**
   * Determine WZDx event type from TIM content
   */
  determinEventType(content) {
    if (!content) return 'incident';

    if (content.work_zones && content.work_zones.length > 0) {
      return 'work-zone';
    } else if (content.advisories && content.advisories.length > 0) {
      const codes = this.extractITISCodes(content);

      // Accident codes (513-518)
      if (codes.some(c => c >= 513 && c <= 518)) return 'accident';

      // Road work codes (769-800)
      if (codes.some(c => c >= 769 && c <= 800)) return 'work-zone';

      // Road closure codes (1025-1030)
      if (codes.some(c => c >= 1025 && c <= 1030)) return 'restriction';

      // Weather codes (1537-1600)
      if (codes.some(c => c >= 1537 && c <= 1600)) return 'weather-condition';

      return 'incident';
    }

    return 'incident';
  }

  /**
   * Extract all ITIS codes from content
   */
  extractITISCodes(content) {
    if (!content) return [];

    const codes = [];

    content.advisories?.forEach(advisory => {
      advisory.forEach(item => {
        if (item.itis_code) codes.push(item.itis_code);
      });
    });

    return codes;
  }

  /**
   * Map TIM directionality to WZDx direction
   */
  mapDirectionality(directionality) {
    const map = {
      0: 'unknown',
      1: 'northbound',
      2: 'southbound',
      3: 'eastbound',
      4: 'westbound',
      5: 'both-directions'
    };

    return map[directionality] || 'unknown';
  }

  // ============================================================================
  // Database Operations
  // ============================================================================

  /**
   * Store TIM/CV-TIM message in database
   */
  async storeTIMMessage(parsedMessage, sourceType = 'TIM', sourceId = null) {
    try {
      // Convert to WZDx for consistency
      const wzdxFeed = this.convertToWZDx(parsedMessage);

      // Store each event
      const eventIds = [];
      for (const feature of wzdxFeed.features) {
        const result = await this.db.runAsync(
          `INSERT INTO plugin_events
           (provider_id, event_data, event_type, state_code, latitude, longitude,
            start_time, end_time, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            sourceId || 0, // provider_id (0 for system/TIM feeds)
            JSON.stringify(feature),
            feature.properties.core_details.event_type,
            null, // state_code - to be determined from geometry
            feature.geometry.coordinates[1], // latitude
            feature.geometry.coordinates[0], // longitude
            feature.properties.start_date,
            feature.properties.end_date
          ]
        );

        eventIds.push(result.lastID);
      }

      return {
        success: true,
        message_type: parsedMessage.message_type,
        events_stored: eventIds.length,
        event_ids: eventIds
      };
    } catch (error) {
      console.error('Error storing TIM message:', error);
      throw error;
    }
  }

  /**
   * Get TIM/CV-TIM messages
   */
  async getTIMMessages(filters = {}) {
    const {
      message_type,
      start_date,
      end_date,
      state_code,
      limit = 100,
      offset = 0
    } = filters;

    let query = `
      SELECT
        event_id,
        event_data,
        event_type,
        state_code,
        latitude,
        longitude,
        start_time,
        end_time,
        created_at
      FROM plugin_events
      WHERE provider_id = 0
    `;

    const params = [];

    if (message_type) {
      query += ` AND json_extract(event_data, '$.properties.tim_data') IS NOT NULL`;
    }

    if (start_date) {
      query += ` AND start_time >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND start_time <= ?`;
      params.push(end_date);
    }

    if (state_code) {
      query += ` AND state_code = ?`;
      params.push(state_code);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const messages = await this.db.allAsync(query, params);

    return messages.map(msg => ({
      ...msg,
      event_data: JSON.parse(msg.event_data)
    }));
  }

  /**
   * Delete expired TIM messages
   */
  async cleanupExpiredTIMMessages() {
    const result = await this.db.runAsync(
      `DELETE FROM plugin_events
       WHERE provider_id = 0
       AND end_time IS NOT NULL
       AND datetime(end_time) < datetime('now')`,
      []
    );

    return {
      deleted_count: result.changes
    };
  }

  // ============================================================================
  // CIFS Feed Integration
  // ============================================================================

  /**
   * Subscribe to CIFS feed
   * Registers this system to receive TIM/CV-TIM broadcasts
   */
  async subscribeToCIFSFeed(feedConfig) {
    const {
      feed_url,
      feed_type, // 'TIM' or 'CV-TIM'
      region,
      polling_interval = 60, // seconds
      authentication
    } = feedConfig;

    // Store feed configuration
    const result = await this.db.runAsync(
      `INSERT INTO plugin_data_feeds
       (provider_id, feed_name, feed_url, feed_format, polling_interval,
        authentication_type, authentication_data, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        0, // System provider
        `CIFS ${feed_type} Feed - ${region}`,
        feed_url,
        feed_type,
        polling_interval,
        authentication?.type || null,
        authentication ? JSON.stringify(authentication.data) : null,
        1 // enabled
      ]
    );

    return {
      feed_id: result.lastID,
      feed_type: feed_type,
      polling_interval: polling_interval
    };
  }

  /**
   * Poll CIFS feed for new messages
   */
  async pollCIFSFeed(feedId) {
    // Get feed config
    const feed = await this.db.getAsync(
      `SELECT * FROM plugin_data_feeds WHERE feed_id = ?`,
      [feedId]
    );

    if (!feed || !feed.enabled) {
      throw new Error('Feed not found or disabled');
    }

    // Fetch from feed URL (implementation depends on feed provider)
    // This is a placeholder - actual implementation would use fetch/axios
    const messages = await this.fetchCIFSMessages(feed);

    // Process each message
    const results = [];
    for (const message of messages) {
      try {
        const parsed = feed.feed_format === 'CV-TIM' ?
          this.parseCVTIM(message) :
          this.parseTIM(message);

        const stored = await this.storeTIMMessage(parsed, feed.feed_format, 0);
        results.push(stored);
      } catch (error) {
        console.error('Error processing TIM message:', error);
      }
    }

    return {
      feed_id: feedId,
      messages_processed: results.length,
      results: results
    };
  }

  /**
   * Fetch messages from CIFS feed
   * Placeholder - actual implementation depends on feed provider API
   */
  async fetchCIFSMessages(feed) {
    // This would implement actual HTTP fetch logic
    // For now, return empty array
    console.log(`Fetching from ${feed.feed_url}...`);
    return [];
  }
}

module.exports = CIFSService;

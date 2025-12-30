/**
 * Data Privacy Filter Module
 *
 * Implements jpo-cvdp-style privacy protection for V2X messages:
 * - Geofencing: Filter messages based on sensitive locations
 * - PII Redaction: Remove or anonymize personally identifiable information
 * - Field-level filtering: Configurable field suppression based on privacy rules
 *
 * Based on USDOT ITS JPO Connected Vehicle Data Privacy (jpo-cvdp) principles
 */

const Database = require('better-sqlite3');
const path = require('path');

class PrivacyFilter {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'v2x_extended.db');
    this.db = null;
    this.geofences = [];
    this.privacyRules = [];
    this.init();
  }

  init() {
    try {
      this.db = new Database(this.dbPath);
      this.loadGeofences();
      this.loadPrivacyRules();
      console.log('🔒 Privacy Filter initialized with', this.geofences.length, 'geofences and', this.privacyRules.length, 'rules');
    } catch (error) {
      console.error('Error initializing privacy filter:', error);
    }
  }

  loadGeofences() {
    try {
      const stmt = this.db.prepare('SELECT * FROM privacy_geofences WHERE enabled = 1');
      this.geofences = stmt.all();
    } catch (error) {
      console.error('Error loading geofences:', error);
      this.geofences = [];
    }
  }

  loadPrivacyRules() {
    try {
      const stmt = this.db.prepare('SELECT * FROM privacy_rules WHERE enabled = 1 ORDER BY priority ASC');
      this.privacyRules = stmt.all();
    } catch (error) {
      console.error('Error loading privacy rules:', error);
      this.privacyRules = [];
    }
  }

  /**
   * Check if a point is within a geofence
   */
  isInGeofence(lat, lon, geofence) {
    if (geofence.fence_type === 'circle') {
      return this.isInCircle(lat, lon, geofence.center_lat, geofence.center_lon, geofence.radius_meters);
    } else if (geofence.fence_type === 'polygon') {
      try {
        const polygon = JSON.parse(geofence.polygon_points);
        return this.isInPolygon(lat, lon, polygon);
      } catch (error) {
        console.error('Error parsing polygon:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Check if point is within circle using Haversine distance
   */
  isInCircle(lat, lon, centerLat, centerLon, radiusMeters) {
    const R = 6371000; // Earth radius in meters
    const φ1 = lat * Math.PI / 180;
    const φ2 = centerLat * Math.PI / 180;
    const Δφ = (centerLat - lat) * Math.PI / 180;
    const Δλ = (centerLon - lon) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
             Math.cos(φ1) * Math.cos(φ2) *
             Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance <= radiusMeters;
  }

  /**
   * Check if point is inside polygon using ray casting algorithm
   */
  isInPolygon(lat, lon, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lat, yi = polygon[i].lon;
      const xj = polygon[j].lat, yj = polygon[j].lon;

      const intersect = ((yi > lon) !== (yj > lon))
        && (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Apply geofencing to a message
   */
  applyGeofencing(message, messageType) {
    const lat = message.latitude || message.lat;
    const lon = message.longitude || message.lon || message.long;

    if (!lat || !lon) {
      return {filtered: false, reason: null};
    }

    for (const geofence of this.geofences) {
      // Check if this geofence applies to this message type
      if (geofence.applies_to !== 'all' && !geofence.applies_to.includes(messageType)) {
        continue;
      }

      if (this.isInGeofence(lat, lon, geofence)) {
        return {
          filtered: true,
          reason: `Message within ${geofence.name} geofence`,
          action: geofence.filter_level,
          geofence: geofence.name
        };
      }
    }

    return {filtered: false, reason: null};
  }

  /**
   * Redact PII fields from a message
   */
  redactPII(message, messageType) {
    const redactedMessage = {...message};
    const redactions = [];

    for (const rule of this.privacyRules) {
      // Check if rule applies to this message type
      const messageTypes = JSON.parse(rule.message_types);
      if (!messageTypes.includes('all') && !messageTypes.includes(messageType)) {
        continue;
      }

      // Apply field patterns
      const patterns = JSON.parse(rule.field_patterns);
      for (const pattern of patterns) {
        if (this.matchesPattern(message, pattern)) {
          const action = rule.action;

          if (action === 'remove') {
            delete redactedMessage[pattern];
            redactions.push({field: pattern, action: 'removed'});
          } else if (action === 'redact') {
            redactedMessage[pattern] = '[REDACTED]';
            redactions.push({field: pattern, action: 'redacted'});
          } else if (action === 'anonymize') {
            redactedMessage[pattern] = this.anonymize(redactedMessage[pattern], pattern);
            redactions.push({field: pattern, action: 'anonymized'});
          } else if (action === 'precision_reduce') {
            if (pattern === 'latitude' || pattern === 'longitude' || pattern === 'lat' || pattern === 'lon' || pattern === 'long') {
              redactedMessage[pattern] = this.reducePrecision(redactedMessage[pattern]);
              redactions.push({field: pattern, action: 'precision_reduced'});
            }
          }
        }
      }
    }

    return {
      message: redactedMessage,
      redactions,
      piiFiltered: redactions.length > 0
    };
  }

  /**
   * Check if a field matches a pattern
   */
  matchesPattern(message, pattern) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return Object.keys(message).some(key => regex.test(key));
    }
    return message.hasOwnProperty(pattern);
  }

  /**
   * Anonymize a value based on field type
   */
  anonymize(value, fieldName) {
    if (fieldName.includes('id') || fieldName.includes('Id') || fieldName.includes('ID')) {
      // Generate a deterministic but anonymized ID
      const hash = this.simpleHash(value.toString());
      return `anon_${hash.substring(0, 8)}`;
    }

    if (fieldName.includes('ip') || fieldName === 'ipAddress') {
      // Mask last octet of IP
      const parts = value.toString().split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
      }
    }

    return '[ANONYMIZED]';
  }

  /**
   * Reduce coordinate precision (to ~10-100m accuracy)
   */
  reducePrecision(coord, decimals = 4) {
    if (typeof coord !== 'number') {
      coord = parseFloat(coord);
    }
    return Math.round(coord * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  /**
   * Simple hash function for anonymization
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Main filter function - applies all privacy rules
   */
  filterMessage(message, messageType, options = {}) {
    const result = {
      originalMessage: message,
      filteredMessage: null,
      blocked: false,
      reason: null,
      geofenceResult: null,
      piiRedactions: [],
      timestamp: new Date().toISOString()
    };

    // Step 1: Check geofencing
    const geofilter = this.applyGeofencing(message, messageType);
    result.geofenceResult = geofilter;

    if (geofilter.filtered) {
      if (geofilter.action === 'block') {
        result.blocked = true;
        result.reason = geofilter.reason;
        return result;
      } else if (geofilter.action === 'redact') {
        // Will be handled in PII redaction step
      }
    }

    // Step 2: Apply PII redaction
    const {message: redactedMessage, redactions, piiFiltered} = this.redactPII(message, messageType);
    result.filteredMessage = redactedMessage;
    result.piiRedactions = redactions;

    // Step 3: Remove path history for enhanced privacy (configurable)
    if (options.stripPathHistory) {
      delete result.filteredMessage.path_history;
      delete result.filteredMessage.pathHistory;
      delete result.filteredMessage.crumbData;
    }

    return result;
  }

  /**
   * Bulk filter messages
   */
  filterMessages(messages, messageType, options = {}) {
    const results = {
      total: messages.length,
      blocked: 0,
      filtered: 0,
      passed: 0,
      messages: []
    };

    for (const message of messages) {
      const result = this.filterMessage(message, messageType, options);

      if (result.blocked) {
        results.blocked++;
      } else if (result.piiRedactions.length > 0 || result.geofenceResult.filtered) {
        results.filtered++;
        results.messages.push(result.filteredMessage);
      } else {
        results.passed++;
        results.messages.push(message);
      }
    }

    return results;
  }

  /**
   * Add a geofence
   */
  addGeofence(geofence) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO privacy_geofences (
          name, fence_type, geometry, center_lat, center_lon,
          radius_meters, polygon_points, filter_level, applies_to, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        geofence.name,
        geofence.fence_type,
        geofence.geometry,
        geofence.center_lat || null,
        geofence.center_lon || null,
        geofence.radius_meters || null,
        geofence.polygon_points ? JSON.stringify(geofence.polygon_points) : null,
        geofence.filter_level || 'redact',
        geofence.applies_to || 'all',
        geofence.enabled !== false ? 1 : 0
      );

      this.loadGeofences();
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error adding geofence:', error);
      throw error;
    }
  }

  /**
   * Add a privacy rule
   */
  addPrivacyRule(rule) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO privacy_rules (
          rule_name, message_types, field_patterns, action, priority, enabled
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        rule.rule_name,
        JSON.stringify(rule.message_types),
        JSON.stringify(rule.field_patterns),
        rule.action,
        rule.priority || 100,
        rule.enabled !== false ? 1 : 0
      );

      this.loadPrivacyRules();
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error adding privacy rule:', error);
      throw error;
    }
  }

  /**
   * Get statistics on privacy filtering
   */
  getStats(days = 7) {
    try {
      const stmt = this.db.prepare(`
        SELECT
          message_type,
          SUM(count) as total_messages,
          SUM(privacy_filtered) as filtered_messages,
          SUM(bytes_processed) as total_bytes
        FROM v2x_message_stats
        WHERE date >= date('now', '-' || ? || ' days')
        GROUP BY message_type
      `);

      return stmt.all(days);
    } catch (error) {
      console.error('Error getting privacy stats:', error);
      return [];
    }
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = PrivacyFilter;

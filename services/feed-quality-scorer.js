#!/usr/bin/env node

/**
 * Feed Quality Scorer - Phase 1: Data Quality & Accountability Foundation
 *
 * Calculates 7-dimension quality scores for individual data feeds:
 * 1. Completeness - Required fields populated (end time, description, geometry, severity, lanes)
 * 2. Freshness - How up-to-date is the data (update latency, stale events)
 * 3. Accuracy - Geometry validation, schema compliance
 * 4. Availability - Feed uptime and reliability (fetch success/failure)
 * 5. Standardization - WZDx compliance, ITIS codes, valid event types
 * 6. Timeliness - Future-dated events, event age distribution, staleness
 * 7. Usability - Contact info, restrictions, work zone types
 *
 * Overall score (DQI: Data Quality Index) is a weighted average of all dimensions.
 * Letter grades (A-F) assigned based on score ranges.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'traffic_data.db');

class FeedQualityScorer {
  constructor() {
    this.db = null;

    // Dimension weights (must sum to 1.0)
    this.weights = {
      completeness: 0.20,    // 20% - Core data fields
      freshness: 0.15,       // 15% - Data recency
      accuracy: 0.20,        // 20% - Data correctness
      availability: 0.15,    // 15% - Feed reliability
      standardization: 0.15, // 15% - Format compliance
      timeliness: 0.10,      // 10% - Temporal validity
      usability: 0.05        // 5%  - Actionable details
    };
  }

  getDb() {
    if (!this.db) {
      this.db = new Database(DB_PATH);
      this.db.pragma('journal_mode = WAL');
    }
    return this.db;
  }

  /**
   * Calculate quality metrics for a specific feed
   * @param {string} feedKey - feed_key from data_feeds table
   * @param {Array} events - Array of event objects for this feed
   * @returns {Object} Quality metrics object
   */
  calculateFeedQuality(feedKey, events) {
    if (!events || events.length === 0) {
      return this.getEmptyMetrics(feedKey);
    }

    // Calculate all 7 dimensions
    const completeness = this.calculateCompleteness(events);
    const freshness = this.calculateFreshness(events);
    const accuracy = this.calculateAccuracy(events);
    const availability = this.calculateAvailability(feedKey);
    const standardization = this.calculateStandardization(events);
    const timeliness = this.calculateTimeliness(events);
    const usability = this.calculateUsability(events);

    // Calculate weighted overall score (0-100)
    const overallScore = (
      completeness.completeness_score * this.weights.completeness +
      freshness.freshness_score * this.weights.freshness +
      accuracy.accuracy_score * this.weights.accuracy +
      availability.availability_score * this.weights.availability +
      standardization.standardization_score * this.weights.standardization +
      timeliness.timeliness_score * this.weights.timeliness +
      usability.usability_score * this.weights.usability
    );

    const letterGrade = this.getLetterGrade(overallScore);

    return {
      feed_key: feedKey,
      total_events: events.length,
      ...completeness,
      ...freshness,
      ...accuracy,
      ...availability,
      ...standardization,
      ...timeliness,
      ...usability,
      overall_quality_score: Math.round(overallScore * 10) / 10,
      letter_grade: letterGrade
    };
  }

  /**
   * DIMENSION 1: Completeness (0-100)
   * Measures presence of required and optional fields
   */
  calculateCompleteness(events) {
    let eventsWithEndTime = 0;
    let eventsWithDescription = 0;
    let eventsWithGeometry = 0;
    let eventsWithSeverity = 0;
    let eventsWithLanesAffected = 0;

    for (const event of events) {
      // End time
      if (event.endTime || event.endDate || event.end_time) {
        eventsWithEndTime++;
      }

      // Description (must be substantial)
      const desc = event.description || '';
      if (desc && desc.length > 20) {
        eventsWithDescription++;
      }

      // Geometry
      if ((event.latitude && event.longitude) || (event.lat && event.lon)) {
        eventsWithGeometry++;
      }

      // Severity
      if (event.severity || event.impact) {
        eventsWithSeverity++;
      }

      // Lanes affected
      if (event.lanesAffected || event.lanes_affected || event.lanes) {
        eventsWithLanesAffected++;
      }
    }

    const total = events.length;

    // Calculate component scores with weights:
    // End time (30%), Description (25%), Geometry (25%), Severity (15%), Lanes (5%)
    const endTimeScore = (eventsWithEndTime / total) * 100;
    const descriptionScore = (eventsWithDescription / total) * 100;
    const geometryScore = (eventsWithGeometry / total) * 100;
    const severityScore = (eventsWithSeverity / total) * 100;
    const lanesScore = (eventsWithLanesAffected / total) * 100;

    const completenessScore = (
      endTimeScore * 0.30 +
      descriptionScore * 0.25 +
      geometryScore * 0.25 +
      severityScore * 0.15 +
      lanesScore * 0.05
    );

    return {
      events_with_end_time: eventsWithEndTime,
      events_with_description: eventsWithDescription,
      events_with_geometry: eventsWithGeometry,
      events_with_severity: eventsWithSeverity,
      events_with_lanes_affected: eventsWithLanesAffected,
      completeness_score: Math.round(completenessScore * 10) / 10
    };
  }

  /**
   * DIMENSION 2: Freshness (0-100)
   * Measures how up-to-date the data is
   */
  calculateFreshness(events) {
    const now = Date.now();
    let totalLatency = 0;
    let maxStaleHours = 0;
    let eventsUpdatedLastHour = 0;
    let validEvents = 0;

    for (const event of events) {
      const updated = event.lastUpdated || event.updated || event.last_updated;
      if (!updated) continue;

      const updatedTime = new Date(updated).getTime();
      if (isNaN(updatedTime)) continue;

      const ageMs = now - updatedTime;
      const ageHours = ageMs / (1000 * 60 * 60);
      const ageSeconds = ageMs / 1000;

      totalLatency += ageSeconds;
      if (ageHours > maxStaleHours) {
        maxStaleHours = ageHours;
      }

      if (ageHours <= 1) {
        eventsUpdatedLastHour++;
      }

      validEvents++;
    }

    const avgLatencySeconds = validEvents > 0 ? totalLatency / validEvents : 0;

    // Freshness scoring tiers:
    // < 15 min: 100 points
    // 15-60 min: 90 points
    // 1-4 hours: 70 points
    // 4-12 hours: 50 points
    // 12-24 hours: 30 points
    // > 24 hours: 10 points
    let freshnessScore = 10;
    if (avgLatencySeconds < 900) {           // < 15 minutes
      freshnessScore = 100;
    } else if (avgLatencySeconds < 3600) {   // < 1 hour
      freshnessScore = 90;
    } else if (avgLatencySeconds < 14400) {  // < 4 hours
      freshnessScore = 70;
    } else if (avgLatencySeconds < 43200) {  // < 12 hours
      freshnessScore = 50;
    } else if (avgLatencySeconds < 86400) {  // < 24 hours
      freshnessScore = 30;
    }

    return {
      avg_update_latency_seconds: Math.round(avgLatencySeconds),
      max_stale_event_hours: Math.round(maxStaleHours * 10) / 10,
      events_updated_last_hour: eventsUpdatedLastHour,
      freshness_score: freshnessScore
    };
  }

  /**
   * DIMENSION 3: Accuracy (0-100)
   * Measures data validity and schema compliance
   */
  calculateAccuracy(events) {
    let geometryPass = 0;
    let geometryFail = 0;
    let schemaValid = 0;
    let schemaInvalid = 0;

    for (const event of events) {
      // Validate geometry
      const lat = event.latitude || event.lat;
      const lon = event.longitude || event.lon;

      if (this.isValidGeometry(lat, lon)) {
        geometryPass++;
      } else {
        geometryFail++;
      }

      // Validate schema (basic required fields)
      if (this.isSchemaValid(event)) {
        schemaValid++;
      } else {
        schemaInvalid++;
      }
    }

    const total = events.length;
    const geometryScore = (geometryPass / total) * 100;
    const schemaScore = (schemaValid / total) * 100;

    // Weighted accuracy score (geometry 60%, schema 40%)
    const accuracyScore = (geometryScore * 0.6 + schemaScore * 0.4);

    return {
      geometry_validation_pass: geometryPass,
      geometry_validation_fail: geometryFail,
      schema_valid: schemaValid,
      schema_invalid: schemaInvalid,
      accuracy_score: Math.round(accuracyScore * 10) / 10
    };
  }

  /**
   * DIMENSION 4: Availability (0-100)
   * Measures feed uptime and reliability
   */
  calculateAvailability(feedKey) {
    // TODO: Track actual fetch success/failure in a separate table
    // For now, estimate based on feed existence and recent data
    const db = this.getDb();

    try {
      const feed = db.prepare('SELECT * FROM data_feeds WHERE id = ?').get(feedKey);

      if (!feed || !feed.is_active) {
        return {
          fetch_success_count: 0,
          fetch_failure_count: 100,
          uptime_percentage: 0,
          availability_score: 0
        };
      }

      // If feed is active, assume good availability for now
      // TODO: Implement actual fetch tracking
      return {
        fetch_success_count: 100,
        fetch_failure_count: 0,
        uptime_percentage: 100,
        availability_score: 100
      };
    } catch (err) {
      console.error('Error checking feed availability:', err);
      return {
        fetch_success_count: 0,
        fetch_failure_count: 0,
        uptime_percentage: 50,
        availability_score: 50
      };
    }
  }

  /**
   * DIMENSION 5: Standardization (0-100)
   * Measures compliance with WZDx, ITIS codes, and standard event types
   */
  calculateStandardization(events) {
    let wzdxCompliantEvents = 0;
    let hasValidITISCodes = 0;
    let hasValidEventTypes = 0;

    // Standard event types from WZDx/ITIS
    const validEventTypes = [
      'work-zone', 'incident', 'restriction', 'closure', 'construction',
      'roadwork', 'accident', 'congestion', 'weather', 'hazard',
      'maintenance', 'special-event', 'detour', 'lane-closure'
    ];

    // Common ITIS codes (subset)
    const validITISCodes = [
      '1025', '1026', '1027', '1028', '1029', // Lane closures
      '1793', '1794', '1795', // Road closures
      '5377', '5378', // Construction/maintenance
      '769', '770', '771'  // Accidents
    ];

    for (const event of events) {
      // Check WZDx compliance (basic heuristic)
      // WZDx-compliant events should have: type, geometry, start_date, direction
      const hasType = event.eventType || event.event_type || event.type;
      const hasGeometry = (event.latitude && event.longitude) || (event.geometry);
      const hasStartDate = event.startDate || event.start_date || event.startTime;
      const hasDirection = event.direction || event.heading;

      if (hasType && hasGeometry && hasStartDate && hasDirection) {
        wzdxCompliantEvents++;
      }

      // Check ITIS codes
      const itisCode = event.itisCode || event.itis_code;
      if (itisCode && validITISCodes.includes(String(itisCode))) {
        hasValidITISCodes++;
      }

      // Check event types
      const eventType = (event.eventType || event.event_type || event.type || '').toLowerCase();
      if (validEventTypes.some(valid => eventType.includes(valid))) {
        hasValidEventTypes++;
      }
    }

    const total = events.length;
    const wzdxScore = (wzdxCompliantEvents / total) * 100;
    const itisScore = (hasValidITISCodes / total) * 100;
    const typeScore = (hasValidEventTypes / total) * 100;

    // Weighted standardization score (WZDx 40%, ITIS 30%, Types 30%)
    const standardizationScore = (
      wzdxScore * 0.40 +
      itisScore * 0.30 +
      typeScore * 0.30
    );

    return {
      wzdx_compliant_events: wzdxCompliantEvents,
      has_valid_itis_codes: hasValidITISCodes,
      has_valid_event_types: hasValidEventTypes,
      standardization_score: Math.round(standardizationScore * 10) / 10
    };
  }

  /**
   * DIMENSION 6: Timeliness (0-100)
   * Measures temporal validity of events
   */
  calculateTimeliness(events) {
    const now = Date.now();
    let eventsFutureDated = 0;
    let eventsPast30Days = 0;
    let eventsStaleOver7Days = 0;

    for (const event of events) {
      const startDate = event.startDate || event.start_date || event.startTime;
      const updated = event.lastUpdated || event.updated || event.last_updated;

      // Check future-dated events
      if (startDate) {
        const startTime = new Date(startDate).getTime();
        if (!isNaN(startTime) && startTime > now) {
          eventsFutureDated++;
        }
      }

      // Check events from last 30 days
      if (startDate) {
        const startTime = new Date(startDate).getTime();
        const ageDays = (now - startTime) / (1000 * 60 * 60 * 24);
        if (!isNaN(ageDays) && ageDays <= 30) {
          eventsPast30Days++;
        }
      }

      // Check stale events (not updated in 7+ days)
      if (updated) {
        const updatedTime = new Date(updated).getTime();
        const ageDays = (now - updatedTime) / (1000 * 60 * 60 * 24);
        if (!isNaN(ageDays) && ageDays > 7) {
          eventsStaleOver7Days++;
        }
      }
    }

    const total = events.length;

    // Scoring logic:
    // - Recent events (< 30 days): Good
    // - Few stale events: Good
    // - Few future-dated events: Good (some planning is OK)
    const recentRatio = eventsPast30Days / total;
    const staleRatio = eventsStaleOver7Days / total;
    const futureRatio = eventsFutureDated / total;

    let timelinessScore = 100;

    // Penalize if too many events are old (not updated recently)
    if (recentRatio < 0.5) {
      timelinessScore -= 30;
    } else if (recentRatio < 0.7) {
      timelinessScore -= 15;
    }

    // Penalize stale events
    if (staleRatio > 0.3) {
      timelinessScore -= 30;
    } else if (staleRatio > 0.15) {
      timelinessScore -= 15;
    }

    // Slight penalty for too many future events (might be placeholders)
    if (futureRatio > 0.2) {
      timelinessScore -= 10;
    }

    timelinessScore = Math.max(0, timelinessScore);

    return {
      events_future_dated: eventsFutureDated,
      events_past_30_days: eventsPast30Days,
      events_stale_over_7_days: eventsStaleOver7Days,
      timeliness_score: timelinessScore
    };
  }

  /**
   * DIMENSION 7: Usability (0-100)
   * Measures actionable details for travelers
   */
  calculateUsability(events) {
    let eventsWithContactInfo = 0;
    let eventsWithRestrictions = 0;
    let eventsWithWorkZoneType = 0;

    for (const event of events) {
      // Contact info
      if (event.contact || event.contact_name || event.contact_email || event.phone) {
        eventsWithContactInfo++;
      }

      // Restrictions (lane closures, detours, speed limits)
      if (event.restrictions || event.lanesAffected || event.detour || event.speed_limit) {
        eventsWithRestrictions++;
      }

      // Work zone type detail
      if (event.workZoneType || event.work_zone_type || event.subtype) {
        eventsWithWorkZoneType++;
      }
    }

    const total = events.length;
    const contactScore = (eventsWithContactInfo / total) * 100;
    const restrictionScore = (eventsWithRestrictions / total) * 100;
    const typeScore = (eventsWithWorkZoneType / total) * 100;

    // Weighted usability score (Restrictions 50%, Type 30%, Contact 20%)
    const usabilityScore = (
      restrictionScore * 0.50 +
      typeScore * 0.30 +
      contactScore * 0.20
    );

    return {
      events_with_contact_info: eventsWithContactInfo,
      events_with_restrictions: eventsWithRestrictions,
      events_with_work_zone_type: eventsWithWorkZoneType,
      usability_score: Math.round(usabilityScore * 10) / 10
    };
  }

  /**
   * Helper: Validate geometry coordinates
   */
  isValidGeometry(lat, lon) {
    if (!lat || !lon) return false;
    if (isNaN(lat) || isNaN(lon)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lon < -180 || lon > 180) return false;

    // Check if in reasonable North America bounds (loose check)
    if (lat < 15 || lat > 72) return false;
    if (lon < -170 || lon > -50) return false;

    return true;
  }

  /**
   * Helper: Validate basic schema compliance
   */
  isSchemaValid(event) {
    // Must have: type, description, location (state/corridor/geometry)
    if (!event.eventType && !event.event_type && !event.type) return false;
    if (!event.description || event.description.length < 5) return false;
    if (!event.state && !event.corridor) return false;

    return true;
  }

  /**
   * Convert numeric score (0-100) to letter grade
   */
  getLetterGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Get empty metrics object for feeds with no data
   */
  getEmptyMetrics(feedKey) {
    return {
      feed_key: feedKey,
      total_events: 0,
      events_with_end_time: 0,
      events_with_description: 0,
      events_with_geometry: 0,
      events_with_severity: 0,
      events_with_lanes_affected: 0,
      completeness_score: 0,
      avg_update_latency_seconds: 0,
      max_stale_event_hours: 0,
      events_updated_last_hour: 0,
      freshness_score: 0,
      geometry_validation_pass: 0,
      geometry_validation_fail: 0,
      schema_valid: 0,
      schema_invalid: 0,
      accuracy_score: 0,
      fetch_success_count: 0,
      fetch_failure_count: 0,
      uptime_percentage: 0,
      availability_score: 0,
      wzdx_compliant_events: 0,
      has_valid_itis_codes: 0,
      has_valid_event_types: 0,
      standardization_score: 0,
      events_future_dated: 0,
      events_past_30_days: 0,
      events_stale_over_7_days: 0,
      timeliness_score: 0,
      events_with_contact_info: 0,
      events_with_restrictions: 0,
      events_with_work_zone_type: 0,
      usability_score: 0,
      overall_quality_score: 0,
      letter_grade: 'F'
    };
  }

  /**
   * Store quality metrics in database
   */
  storeQualityMetrics(metrics) {
    const db = this.getDb();

    // Get provider and state info from feed
    const feed = db.prepare(`
      SELECT df.*, c.state_key
      FROM data_feeds df
      LEFT JOIN corridors c ON c.id = df.corridor_id
      WHERE df.id = ?
    `).get(metrics.feed_key);

    if (!feed) {
      console.warn(`Feed not found: ${metrics.feed_key}`);
      return;
    }

    const insert = db.prepare(`
      INSERT INTO data_quality_metrics (
        feed_key,
        provider_name,
        state_key,
        timestamp,
        total_events,
        events_with_end_time,
        events_with_description,
        events_with_geometry,
        events_with_severity,
        events_with_lanes_affected,
        completeness_score,
        avg_update_latency_seconds,
        max_stale_event_hours,
        events_updated_last_hour,
        freshness_score,
        geometry_validation_pass,
        geometry_validation_fail,
        schema_valid,
        schema_invalid,
        accuracy_score,
        fetch_success_count,
        fetch_failure_count,
        uptime_percentage,
        availability_score,
        wzdx_compliant_events,
        has_valid_itis_codes,
        has_valid_event_types,
        standardization_score,
        events_future_dated,
        events_past_30_days,
        events_stale_over_7_days,
        timeliness_score,
        events_with_contact_info,
        events_with_restrictions,
        events_with_work_zone_type,
        usability_score,
        overall_quality_score,
        letter_grade
      ) VALUES (
        ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    try {
      insert.run(
        metrics.feed_key,
        feed.provider_name,
        feed.state_key,
        metrics.total_events,
        metrics.events_with_end_time,
        metrics.events_with_description,
        metrics.events_with_geometry,
        metrics.events_with_severity,
        metrics.events_with_lanes_affected,
        metrics.completeness_score,
        metrics.avg_update_latency_seconds,
        metrics.max_stale_event_hours,
        metrics.events_updated_last_hour,
        metrics.freshness_score,
        metrics.geometry_validation_pass,
        metrics.geometry_validation_fail,
        metrics.schema_valid,
        metrics.schema_invalid,
        metrics.accuracy_score,
        metrics.fetch_success_count,
        metrics.fetch_failure_count,
        metrics.uptime_percentage,
        metrics.availability_score,
        metrics.wzdx_compliant_events,
        metrics.has_valid_itis_codes,
        metrics.has_valid_event_types,
        metrics.standardization_score,
        metrics.events_future_dated,
        metrics.events_past_30_days,
        metrics.events_stale_over_7_days,
        metrics.timeliness_score,
        metrics.events_with_contact_info,
        metrics.events_with_restrictions,
        metrics.events_with_work_zone_type,
        metrics.usability_score,
        metrics.overall_quality_score,
        metrics.letter_grade
      );
      console.log(`✅ Stored quality metrics for feed: ${metrics.feed_key} (Score: ${metrics.overall_quality_score}, Grade: ${metrics.letter_grade})`);
    } catch (err) {
      console.error(`Error storing metrics for ${metrics.feed_key}:`, err.message);
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = new FeedQualityScorer();

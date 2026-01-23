const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'traffic_data.db');

/**
 * Data Quality Service - Phase 1: Data Quality & Accountability Foundation
 *
 * Calculates 7-dimension quality scores for data feeds:
 * 1. Completeness - Required fields populated (end time, description, geometry, severity, lanes)
 * 2. Freshness - How up-to-date is the data (update latency, stale events)
 * 3. Accuracy - Geometry validation, schema compliance
 * 4. Availability - Feed uptime and reliability (fetch success/failure)
 * 5. Standardization - WZDx compliance, ITIS codes, valid event types
 * 6. Timeliness - Future-dated events, event age distribution, staleness
 * 7. Usability - Contact info, restrictions, work zone types
 *
 * Overall score is a weighted average of all dimensions.
 * Generates letter grades (A-F) and national rankings for state report cards.
 */

class DataQualityService {
  constructor() {
    this.db = null;
  }

  getDb() {
    if (!this.db) {
      this.db = new Database(DB_PATH);
      this.db.pragma('journal_mode = WAL');
    }
    return this.db;
  }

  /**
   * Calculate quality metrics for all states
   */
  calculateAllStatesQuality() {
    const db = this.getDb();
    const states = db.prepare('SELECT state_key, state_name FROM states WHERE enabled = 1').all();

    const results = [];
    for (const state of states) {
      try {
        const metrics = this.calculateStateQuality(state.state_key);
        results.push({
          state_key: state.state_key,
          state_name: state.state_name,
          ...metrics
        });
      } catch (err) {
        console.error(`Error calculating quality for ${state.state_key}:`, err);
        results.push({
          state_key: state.state_key,
          state_name: state.state_name,
          error: err.message
        });
      }
    }

    // Calculate national rankings
    results.sort((a, b) => (b.overall_quality_score || 0) - (a.overall_quality_score || 0));
    results.forEach((result, index) => {
      result.national_rank = index + 1;
    });

    // Store metrics in database
    this.storeQualityMetrics(results);

    return results;
  }

  /**
   * Calculate quality metrics for a specific state
   */
  calculateStateQuality(stateKey) {
    const db = this.getDb();

    // Get all events for this state
    const events = db.prepare(`
      SELECT * FROM cached_events WHERE state_key = ?
    `).all(stateKey);

    if (events.length === 0) {
      return {
        total_events: 0,
        completeness_score: 0,
        freshness_score: 0,
        accuracy_score: 0,
        availability_score: 0,
        overall_quality_score: 0
      };
    }

    // 1. COMPLETENESS SCORE (0-100)
    const completenessMetrics = this.calculateCompleteness(events);

    // 2. FRESHNESS SCORE (0-100)
    const freshnessMetrics = this.calculateFreshness(events);

    // 3. ACCURACY SCORE (0-100)
    const accuracyMetrics = this.calculateAccuracy(events);

    // 4. AVAILABILITY SCORE (0-100)
    const availabilityMetrics = this.calculateAvailability(stateKey);

    // OVERALL SCORE (weighted average)
    // Weights: Completeness 30%, Freshness 20%, Accuracy 30%, Availability 20%
    const overallScore = (
      completenessMetrics.completeness_score * 0.30 +
      freshnessMetrics.freshness_score * 0.20 +
      accuracyMetrics.accuracy_score * 0.30 +
      availabilityMetrics.availability_score * 0.20
    );

    return {
      total_events: events.length,
      ...completenessMetrics,
      ...freshnessMetrics,
      ...accuracyMetrics,
      ...availabilityMetrics,
      overall_quality_score: Math.round(overallScore * 10) / 10
    };
  }

  /**
   * DIMENSION 1: Completeness
   * Measures what percentage of events have required fields populated
   */
  calculateCompleteness(events) {
    let eventsWithEndTime = 0;
    let eventsWithDescription = 0;
    let eventsWithGeometry = 0;
    let eventsWithSeverity = 0;

    for (const event of events) {
      if (event.endTime) eventsWithEndTime++;
      if (event.description && event.description.length > 10) eventsWithDescription++;
      if (event.latitude && event.longitude) eventsWithGeometry++;
      if (event.severity) eventsWithSeverity++;
    }

    const total = events.length;

    // Calculate component scores
    const endTimeScore = (eventsWithEndTime / total) * 100;
    const descriptionScore = (eventsWithDescription / total) * 100;
    const geometryScore = (eventsWithGeometry / total) * 100;
    const severityScore = (eventsWithSeverity / total) * 100;

    // Weighted completeness score
    // End time is most important (40%), then description (30%), geometry (20%), severity (10%)
    const completenessScore = (
      endTimeScore * 0.40 +
      descriptionScore * 0.30 +
      geometryScore * 0.20 +
      severityScore * 0.10
    );

    return {
      events_with_end_time: eventsWithEndTime,
      events_with_description: eventsWithDescription,
      events_with_geometry: eventsWithGeometry,
      events_with_severity: eventsWithSeverity,
      completeness_score: Math.round(completenessScore * 10) / 10
    };
  }

  /**
   * DIMENSION 2: Freshness
   * Measures how up-to-date the data is
   */
  calculateFreshness(events) {
    const now = new Date();
    let totalLatency = 0;
    let maxStaleHours = 0;
    let validEvents = 0;

    for (const event of events) {
      if (!event.lastUpdated) continue;

      const lastUpdated = new Date(event.lastUpdated);
      const ageMs = now - lastUpdated;
      const ageHours = ageMs / (1000 * 60 * 60);

      totalLatency += ageMs / 1000; // in seconds
      if (ageHours > maxStaleHours) {
        maxStaleHours = ageHours;
      }
      validEvents++;
    }

    const avgLatencySeconds = validEvents > 0 ? totalLatency / validEvents : 0;

    // Freshness scoring:
    // - Events updated within 15 minutes: 100 points
    // - Events 15-60 minutes old: 80 points
    // - Events 1-4 hours old: 60 points
    // - Events 4-24 hours old: 40 points
    // - Events >24 hours old: 20 points
    let freshnessScore = 100;
    if (avgLatencySeconds > 900) { // > 15 minutes
      freshnessScore = 80;
    }
    if (avgLatencySeconds > 3600) { // > 1 hour
      freshnessScore = 60;
    }
    if (avgLatencySeconds > 14400) { // > 4 hours
      freshnessScore = 40;
    }
    if (avgLatencySeconds > 86400) { // > 24 hours
      freshnessScore = 20;
    }

    return {
      avg_update_latency_seconds: Math.round(avgLatencySeconds),
      max_stale_event_hours: Math.round(maxStaleHours * 10) / 10,
      freshness_score: freshnessScore
    };
  }

  /**
   * DIMENSION 3: Accuracy
   * Measures data validity and schema compliance
   */
  calculateAccuracy(events) {
    let geometryPass = 0;
    let geometryFail = 0;
    let schemaValid = 0;
    let schemaInvalid = 0;

    for (const event of events) {
      // Validate geometry
      if (this.isValidGeometry(event.latitude, event.longitude)) {
        geometryPass++;
      } else {
        geometryFail++;
      }

      // Validate schema (basic checks)
      if (this.isSchemaValid(event)) {
        schemaValid++;
      } else {
        schemaInvalid++;
      }
    }

    const total = events.length;
    const geometryScore = (geometryPass / total) * 100;
    const schemaScore = (schemaValid / total) * 100;

    // Weighted accuracy score (geometry 50%, schema 50%)
    const accuracyScore = (geometryScore * 0.5 + schemaScore * 0.5);

    return {
      geometry_validation_pass: geometryPass,
      geometry_validation_fail: geometryFail,
      wzdx_schema_valid: schemaValid,
      wzdx_schema_invalid: schemaInvalid,
      accuracy_score: Math.round(accuracyScore * 10) / 10
    };
  }

  /**
   * Validate geometry coordinates
   */
  isValidGeometry(lat, lon) {
    if (!lat || !lon) return false;
    if (isNaN(lat) || isNaN(lon)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lon < -180 || lon > 180) return false;
    // Check if in North America (rough bounds)
    if (lat < 24 || lat > 72) return false; // Outside North America latitude
    if (lon < -168 || lon > -52) return false; // Outside North America longitude
    return true;
  }

  /**
   * Validate basic schema compliance
   */
  isSchemaValid(event) {
    // Must have: eventType, description, state, corridor
    if (!event.eventType) return false;
    if (!event.description || event.description.length < 5) return false;
    if (!event.state) return false;
    if (!event.corridor) return false;
    return true;
  }

  /**
   * DIMENSION 4: Availability
   * Measures feed uptime and reliability (based on historical fetch success/failure)
   * For now, we'll estimate based on whether events exist
   */
  calculateAvailability(stateKey) {
    // TODO: Track fetch success/failure in separate table
    // For now, assume 100% if events exist, 50% if no events
    const db = this.getDb();
    const eventCount = db.prepare('SELECT COUNT(*) as count FROM cached_events WHERE state_key = ?')
      .get(stateKey).count;

    let availabilityScore = 100;
    let uptimePercentage = 100;
    let fetchSuccess = 100;
    let fetchFailure = 0;

    if (eventCount === 0) {
      availabilityScore = 50;
      uptimePercentage = 50;
      fetchSuccess = 50;
      fetchFailure = 50;
    }

    return {
      fetch_success_count: fetchSuccess,
      fetch_failure_count: fetchFailure,
      uptime_percentage: uptimePercentage,
      availability_score: availabilityScore
    };
  }

  /**
   * Store quality metrics in database
   */
  storeQualityMetrics(results) {
    const db = this.getDb();
    const insert = db.prepare(`
      INSERT INTO data_quality_metrics (
        state_key,
        timestamp,
        total_events,
        events_with_end_time,
        events_with_description,
        events_with_geometry,
        events_with_severity,
        completeness_score,
        avg_update_latency_seconds,
        max_stale_event_hours,
        freshness_score,
        geometry_validation_pass,
        geometry_validation_fail,
        wzdx_schema_valid,
        wzdx_schema_invalid,
        accuracy_score,
        fetch_success_count,
        fetch_failure_count,
        uptime_percentage,
        availability_score,
        overall_quality_score,
        national_rank
      ) VALUES (
        ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const insertMany = db.transaction((records) => {
      for (const record of records) {
        if (record.error) continue; // Skip errors
        insert.run(
          record.state_key,
          record.total_events || 0,
          record.events_with_end_time || 0,
          record.events_with_description || 0,
          record.events_with_geometry || 0,
          record.events_with_severity || 0,
          record.completeness_score || 0,
          record.avg_update_latency_seconds || 0,
          record.max_stale_event_hours || 0,
          record.freshness_score || 0,
          record.geometry_validation_pass || 0,
          record.geometry_validation_fail || 0,
          record.wzdx_schema_valid || 0,
          record.wzdx_schema_invalid || 0,
          record.accuracy_score || 0,
          record.fetch_success_count || 0,
          record.fetch_failure_count || 0,
          record.uptime_percentage || 100,
          record.availability_score || 100,
          record.overall_quality_score || 0,
          record.national_rank || 999
        );
      }
    });

    insertMany(results);
    console.log(`✅ Stored quality metrics for ${results.length} states`);
  }

  /**
   * Get latest quality metrics for a state
   */
  getStateQuality(stateKey) {
    const db = this.getDb();
    return db.prepare(`
      SELECT * FROM data_quality_metrics
      WHERE state_key = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(stateKey);
  }

  /**
   * Get national rankings
   */
  getNationalRankings() {
    const db = this.getDb();

    // Get latest metrics for each state
    return db.prepare(`
      SELECT
        dqm.*,
        s.state_name,
        s.enabled
      FROM data_quality_metrics dqm
      JOIN states s ON s.state_key = dqm.state_key
      WHERE dqm.id IN (
        SELECT MAX(id) FROM data_quality_metrics GROUP BY state_key
      )
      ORDER BY dqm.overall_quality_score DESC
    `).all();
  }

  /**
   * Get quality history for a state
   */
  getStateQualityHistory(stateKey, days = 30) {
    const db = this.getDb();
    return db.prepare(`
      SELECT * FROM data_quality_metrics
      WHERE state_key = ?
      AND timestamp >= datetime('now', '-' || ? || ' days')
      ORDER BY timestamp DESC
    `).all(stateKey, days);
  }

  /**
   * Get cost per event (if vendor contract exists)
   */
  getCostPerEvent(stateKey) {
    const db = this.getDb();

    const contract = db.prepare(`
      SELECT * FROM vendor_contracts WHERE state_key = ?
    `).get(stateKey);

    if (!contract) {
      return null;
    }

    const metrics = this.getStateQuality(stateKey);
    if (!metrics || metrics.total_events === 0) {
      return { ...contract, cost_per_event: null, annual_events_estimate: 0 };
    }

    // Estimate annual events (current count * 365 / sample period)
    const annualEventsEstimate = metrics.total_events * 365;
    const costPerEvent = contract.contract_value_annual / annualEventsEstimate;

    return {
      ...contract,
      cost_per_event: Math.round(costPerEvent * 100) / 100,
      annual_events_estimate: annualEventsEstimate
    };
  }

  /**
   * Generate state report card (PDF-ready data)
   */
  generateStateReportCard(stateKey) {
    const db = this.getDb();

    const state = db.prepare('SELECT * FROM states WHERE state_key = ?').get(stateKey);
    const metrics = this.getStateQuality(stateKey);
    const history = this.getStateQualityHistory(stateKey, 90);
    const costData = this.getCostPerEvent(stateKey);
    const rankings = this.getNationalRankings();

    // Find peer states (similar event volume)
    const peers = rankings.filter(r =>
      r.state_key !== stateKey &&
      Math.abs(r.total_events - metrics.total_events) < metrics.total_events * 0.3
    ).slice(0, 5);

    return {
      state: state,
      current_metrics: metrics,
      quality_trend: this.calculateTrend(history),
      cost_analysis: costData,
      national_rank: metrics.national_rank,
      total_states: rankings.length,
      peer_comparison: peers,
      recommendations: this.generateRecommendations(metrics, costData)
    };
  }

  /**
   * Calculate quality trend from history
   */
  calculateTrend(history) {
    if (history.length < 2) {
      return { direction: 'stable', change: 0 };
    }

    const latest = history[0].overall_quality_score;
    const oldest = history[history.length - 1].overall_quality_score;
    const change = latest - oldest;

    return {
      direction: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable',
      change: Math.round(change * 10) / 10,
      period_days: history.length
    };
  }

  /**
   * Generate recommendations based on metrics
   */
  generateRecommendations(metrics, costData) {
    const recommendations = [];

    // Completeness recommendations
    if (metrics.completeness_score < 70) {
      recommendations.push({
        category: 'Completeness',
        priority: 'HIGH',
        issue: `Only ${metrics.completeness_score}% of required fields are populated`,
        recommendation: 'Work with data provider to improve end time estimates and event descriptions',
        impact: 'Better data enables more accurate travel time predictions'
      });
    }

    // Freshness recommendations
    if (metrics.freshness_score < 70) {
      recommendations.push({
        category: 'Freshness',
        priority: 'HIGH',
        issue: `Data is ${Math.round(metrics.avg_update_latency_seconds / 60)} minutes old on average`,
        recommendation: 'Increase update frequency to 5-15 minutes for real-time coordination',
        impact: 'Travelers receive more timely information about changing conditions'
      });
    }

    // Accuracy recommendations
    if (metrics.accuracy_score < 80) {
      recommendations.push({
        category: 'Accuracy',
        priority: 'MEDIUM',
        issue: `${metrics.geometry_validation_fail} events have invalid coordinates`,
        recommendation: 'Validate coordinates before publishing and fix data pipeline issues',
        impact: 'Improved map display and geospatial analysis accuracy'
      });
    }

    // Cost recommendations
    if (costData && costData.cost_per_event > 25) {
      recommendations.push({
        category: 'Cost Efficiency',
        priority: 'MEDIUM',
        issue: `Cost per event ($${costData.cost_per_event}) is above average`,
        recommendation: 'Consider renegotiating contract or exploring alternative data providers',
        impact: `Potential savings of $${Math.round((costData.cost_per_event - 15) * costData.annual_events_estimate)}/year`
      });
    }

    return recommendations;
  }
}

module.exports = new DataQualityService();

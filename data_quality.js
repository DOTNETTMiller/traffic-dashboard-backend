// Data Quality & Provenance Tracking Module
// Addresses FHWA feedback on data trustworthiness and quality assurance

class DataQualityTracker {
  constructor() {
    this.feedMetrics = new Map();
    this.eventQualityCache = new Map();
  }

  /**
   * Calculate quality score for an individual event
   * @param {Object} event - Event object
   * @param {Object} metadata - Feed metadata (source, timestamp, etc.)
   * @returns {Object} Quality assessment
   */
  assessEventQuality(event, metadata = {}) {
    const scores = {
      completeness: this.calculateCompleteness(event),
      freshness: this.calculateFreshness(metadata.timestamp || event.updated),
      accuracy: this.calculateAccuracy(event),
      overall: 0
    };

    // Weighted average: Completeness 40%, Freshness 30%, Accuracy 30%
    scores.overall = Math.round(
      scores.completeness * 0.4 +
      scores.freshness * 0.3 +
      scores.accuracy * 0.3
    );

    return {
      scores,
      level: this.getQualityLevel(scores.overall),
      issues: this.identifyIssues(event, scores),
      provenance: {
        source: metadata.source || event.state || 'unknown',
        sourceUrl: metadata.sourceUrl,
        collectedAt: metadata.timestamp || new Date().toISOString(),
        transformer: 'DOT-Corridor-Communicator-v1.0',
        validationStatus: scores.overall >= 70 ? 'PASSED' : 'WARNING'
      }
    };
  }

  /**
   * Calculate completeness score (0-100)
   * Based on presence of required and optional fields
   */
  calculateCompleteness(event) {
    const requiredFields = [
      'id', 'eventType', 'state', 'location',
      'latitude', 'longitude', 'description'
    ];

    const optionalFields = [
      'startDate', 'endDate', 'severity', 'direction',
      'lanesAffected', 'road', 'corridor'
    ];

    let score = 0;

    // Required fields: 60 points total
    const requiredPresent = requiredFields.filter(field => {
      const value = event[field];
      return value !== null && value !== undefined && value !== '';
    }).length;
    score += (requiredPresent / requiredFields.length) * 60;

    // Optional fields: 30 points total
    const optionalPresent = optionalFields.filter(field => {
      const value = event[field];
      return value !== null && value !== undefined && value !== '';
    }).length;
    score += (optionalPresent / optionalFields.length) * 30;

    // Geocoding quality: 10 points
    if (this.hasValidGeocoding(event)) {
      score += 10;
    }

    return Math.round(score);
  }

  /**
   * Calculate freshness score (0-100)
   * Based on age of data
   */
  calculateFreshness(timestamp) {
    if (!timestamp) return 0;

    const now = new Date();
    const dataTime = new Date(timestamp);
    const ageMinutes = (now - dataTime) / (1000 * 60);

    if (ageMinutes < 5) return 100;
    if (ageMinutes < 15) return 80;
    if (ageMinutes < 60) return 60;
    if (ageMinutes < 360) return 40; // 6 hours
    if (ageMinutes < 1440) return 20; // 24 hours
    return 10;
  }

  /**
   * Calculate accuracy score (0-100)
   * Based on geocoding confidence and data consistency
   */
  calculateAccuracy(event) {
    let score = 50; // Base score

    // Geocoding accuracy
    if (this.hasValidGeocoding(event)) {
      score += 30;
    }

    // Consistency checks
    if (this.hasConsistentData(event)) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Check if event has valid geocoding
   */
  hasValidGeocoding(event) {
    const lat = parseFloat(event.latitude);
    const lon = parseFloat(event.longitude);

    // Valid coordinates for US (rough bounds)
    return !isNaN(lat) && !isNaN(lon) &&
           lat >= 24 && lat <= 72 &&  // Alaska to Florida
           lon >= -180 && lon <= -65; // Alaska to Maine
  }

  /**
   * Check data consistency
   */
  hasConsistentData(event) {
    // Event type should match description
    if (event.eventType && event.description) {
      const desc = event.description.toLowerCase();
      const type = event.eventType.toLowerCase();

      // Basic consistency check
      if (type.includes('closure') && !desc.includes('close')) return false;
      if (type.includes('construction') && !desc.includes('construction') && !desc.includes('work')) return false;
    }

    // Start date should be before end date
    if (event.startDate && event.endDate) {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      if (start > end) return false;
    }

    return true;
  }

  /**
   * Get quality level label
   */
  getQualityLevel(score) {
    if (score >= 90) return 'EXCELLENT';
    if (score >= 75) return 'GOOD';
    if (score >= 60) return 'FAIR';
    if (score >= 40) return 'POOR';
    return 'CRITICAL';
  }

  /**
   * Identify specific quality issues
   */
  identifyIssues(event, scores) {
    const issues = [];

    if (scores.completeness < 70) {
      issues.push('Missing required fields');
    }

    if (scores.freshness < 60) {
      issues.push('Stale data (>1 hour old)');
    }

    if (!this.hasValidGeocoding(event)) {
      issues.push('Invalid or missing coordinates');
    }

    if (!this.hasConsistentData(event)) {
      issues.push('Data consistency check failed');
    }

    if (scores.overall < 60) {
      issues.push('Overall quality below acceptable threshold');
    }

    return issues;
  }

  /**
   * Track feed-level metrics
   */
  updateFeedMetrics(feedKey, eventCount, successCount, avgQuality, timestamp) {
    const existing = this.feedMetrics.get(feedKey) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalEvents: 0,
      qualityScores: [],
      uptimeChecks: [],
      lastUpdate: null
    };

    existing.totalRequests++;
    existing.successfulRequests += successCount > 0 ? 1 : 0;
    existing.failedRequests += successCount === 0 ? 1 : 0;
    existing.totalEvents += eventCount;
    existing.qualityScores.push(avgQuality);
    existing.uptimeChecks.push({ timestamp, success: successCount > 0 });
    existing.lastUpdate = timestamp;

    // Keep only last 100 quality scores and 1000 uptime checks
    if (existing.qualityScores.length > 100) {
      existing.qualityScores = existing.qualityScores.slice(-100);
    }
    if (existing.uptimeChecks.length > 1000) {
      existing.uptimeChecks = existing.uptimeChecks.slice(-1000);
    }

    this.feedMetrics.set(feedKey, existing);
  }

  /**
   * Get feed health report
   */
  getFeedHealth(feedKey, timeWindowHours = 24) {
    const metrics = this.feedMetrics.get(feedKey);
    if (!metrics) {
      return {
        feedKey,
        status: 'NO_DATA',
        uptime: 0,
        avgQuality: 0,
        avgAge: null
      };
    }

    const cutoff = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
    const recentChecks = metrics.uptimeChecks.filter(c =>
      new Date(c.timestamp) > cutoff
    );

    const uptime = recentChecks.length > 0
      ? (recentChecks.filter(c => c.success).length / recentChecks.length) * 100
      : 0;

    const avgQuality = metrics.qualityScores.length > 0
      ? metrics.qualityScores.reduce((a, b) => a + b, 0) / metrics.qualityScores.length
      : 0;

    const avgAge = metrics.lastUpdate
      ? (Date.now() - new Date(metrics.lastUpdate)) / (1000 * 60)
      : null;

    return {
      feedKey,
      status: this.getFeedStatus(uptime, avgQuality, avgAge),
      uptime: Math.round(uptime * 10) / 10,
      avgQuality: Math.round(avgQuality),
      avgAge: avgAge ? Math.round(avgAge * 10) / 10 : null,
      totalEvents: metrics.totalEvents,
      lastUpdate: metrics.lastUpdate,
      reliability: this.calculateReliability(uptime, avgQuality)
    };
  }

  /**
   * Determine overall feed status
   */
  getFeedStatus(uptime, avgQuality, avgAge) {
    if (uptime < 50 || avgQuality < 40) return 'CRITICAL';
    if (uptime < 80 || avgQuality < 60) return 'DEGRADED';
    if (avgAge && avgAge > 60) return 'STALE';
    if (uptime >= 95 && avgQuality >= 85) return 'EXCELLENT';
    return 'OPERATIONAL';
  }

  /**
   * Calculate reliability score (0-100)
   */
  calculateReliability(uptime, avgQuality) {
    return Math.round(uptime * 0.5 + avgQuality * 0.5);
  }

  /**
   * Get all feed health reports
   */
  getAllFeedHealth(timeWindowHours = 24) {
    const reports = [];

    for (const [feedKey] of this.feedMetrics) {
      reports.push(this.getFeedHealth(feedKey, timeWindowHours));
    }

    return reports.sort((a, b) => b.reliability - a.reliability);
  }

  /**
   * Detect anomalies in feed data
   */
  detectAnomalies(feedKey, currentEventCount) {
    const metrics = this.feedMetrics.get(feedKey);
    if (!metrics) return [];

    const anomalies = [];

    // Sudden spike in events
    const avgEvents = metrics.totalEvents / metrics.totalRequests;
    if (currentEventCount > avgEvents * 3) {
      anomalies.push({
        type: 'UNUSUAL_VOLUME',
        severity: 'WARNING',
        message: `Event count (${currentEventCount}) is 3x higher than average (${Math.round(avgEvents)})`
      });
    }

    // Feed going silent
    const timeSinceUpdate = metrics.lastUpdate
      ? (Date.now() - new Date(metrics.lastUpdate)) / (1000 * 60)
      : Infinity;

    if (timeSinceUpdate > 60) {
      anomalies.push({
        type: 'FEED_SILENT',
        severity: 'CRITICAL',
        message: `No updates received for ${Math.round(timeSinceUpdate)} minutes`
      });
    }

    // Quality degradation
    const recentQuality = metrics.qualityScores.slice(-10);
    const avgRecentQuality = recentQuality.reduce((a, b) => a + b, 0) / recentQuality.length;
    if (avgRecentQuality < 60) {
      anomalies.push({
        type: 'QUALITY_DEGRADATION',
        severity: 'WARNING',
        message: `Recent quality average (${Math.round(avgRecentQuality)}) below threshold`
      });
    }

    return anomalies;
  }
}

// Export singleton instance
const dataQualityTracker = new DataQualityTracker();
module.exports = dataQualityTracker;

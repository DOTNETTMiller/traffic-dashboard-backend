/**
 * Data Quality Monitor
 *
 * Tracks data quality improvements as states adopt better standards.
 * Logs when states start using preferred field names and detects new capabilities.
 */

const fs = require('fs');
const path = require('path');

const QUALITY_LOG_PATH = path.join(__dirname, '../logs/data-quality-trends.jsonl');

class DataQualityMonitor {
  constructor() {
    this.sessionMetrics = {};
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(QUALITY_LOG_PATH);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Track which fields a state is providing and in what format
   */
  trackStateFieldUsage(stateName, events) {
    if (!events || events.length === 0) return;

    const fieldUsage = {
      state: stateName,
      timestamp: new Date().toISOString(),
      totalEvents: events.length,
      fieldCoverage: {},
      preferredFieldUsage: {},
      newFieldsDetected: []
    };

    const PREFERRED_FIELDS = {
      eventType: 'event_type',
      startTime: 'start_date',
      endTime: 'end_date',
      corridor: 'road_names',
      lanesAffected: 'vehicle_impact',
      severity: 'event_status',
      roadStatus: 'road_event_status'
    };

    // Count field usage across all events
    const fieldCounts = {};
    const preferredFieldCounts = {};

    events.forEach(event => {
      // Check original raw event if available
      const rawEvent = event._rawEvent || event;

      Object.keys(rawEvent).forEach(field => {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      });

      // Check if using preferred WZDx field names
      Object.entries(PREFERRED_FIELDS).forEach(([concept, preferredName]) => {
        if (rawEvent[preferredName] !== undefined) {
          preferredFieldCounts[concept] = (preferredFieldCounts[concept] || 0) + 1;
        }
      });
    });

    // Calculate coverage percentages
    Object.entries(fieldCounts).forEach(([field, count]) => {
      fieldUsage.fieldCoverage[field] = {
        count,
        percentage: ((count / events.length) * 100).toFixed(1)
      };
    });

    // Calculate preferred field usage
    Object.entries(preferredFieldCounts).forEach(([concept, count]) => {
      fieldUsage.preferredFieldUsage[concept] = {
        usingPreferred: true,
        count,
        percentage: ((count / events.length) * 100).toFixed(1)
      };
    });

    // Detect improvements
    this.detectImprovements(stateName, fieldUsage);

    // Store for session
    this.sessionMetrics[stateName] = fieldUsage;

    // Append to log file
    this.appendToLog(fieldUsage);

    return fieldUsage;
  }

  /**
   * Detect if a state has improved their data quality
   */
  detectImprovements(stateName, currentMetrics) {
    const previousMetrics = this.loadPreviousMetrics(stateName);

    if (!previousMetrics) {
      console.log(`📊 ${stateName}: First quality baseline established`);
      return;
    }

    const improvements = [];
    const regressions = [];

    // Check if they started using preferred field names
    Object.entries(currentMetrics.preferredFieldUsage).forEach(([concept, current]) => {
      const previous = previousMetrics.preferredFieldUsage?.[concept];

      if (!previous && current.usingPreferred) {
        improvements.push(`🎉 ${stateName} now using WZDx standard field for ${concept}!`);
      }
    });

    // Check for new fields
    Object.keys(currentMetrics.fieldCoverage).forEach(field => {
      if (!previousMetrics.fieldCoverage?.[field]) {
        improvements.push(`📈 ${stateName} added new field: ${field}`);
      }
    });

    // Check for removed fields (regression)
    Object.keys(previousMetrics.fieldCoverage || {}).forEach(field => {
      if (!currentMetrics.fieldCoverage[field]) {
        regressions.push(`⚠️  ${stateName} no longer providing: ${field}`);
      }
    });

    // Log improvements
    if (improvements.length > 0) {
      console.log(`\n✅ DATA QUALITY IMPROVEMENTS DETECTED:`);
      improvements.forEach(msg => console.log(`   ${msg}`));
    }

    if (regressions.length > 0) {
      console.log(`\n⚠️  DATA QUALITY REGRESSIONS:`);
      regressions.forEach(msg => console.log(`   ${msg}`));
    }

    return { improvements, regressions };
  }

  /**
   * Load previous metrics for comparison
   */
  loadPreviousMetrics(stateName) {
    if (!fs.existsSync(QUALITY_LOG_PATH)) return null;

    try {
      const lines = fs.readFileSync(QUALITY_LOG_PATH, 'utf8').split('\n').filter(l => l.trim());

      // Find most recent entry for this state (reading backwards)
      for (let i = lines.length - 1; i >= 0; i--) {
        const entry = JSON.parse(lines[i]);
        if (entry.state === stateName) {
          return entry;
        }
      }
    } catch (error) {
      console.error('Error loading previous metrics:', error.message);
    }

    return null;
  }

  /**
   * Append metrics to log file
   */
  appendToLog(metrics) {
    try {
      fs.appendFileSync(QUALITY_LOG_PATH, JSON.stringify(metrics) + '\n');
    } catch (error) {
      console.error('Error appending to quality log:', error.message);
    }
  }

  /**
   * Generate quality report for all states
   */
  generateQualityReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      states: [],
      summary: {
        totalStates: 0,
        statesUsingWZDxStandards: 0,
        averageFieldCoverage: 0
      }
    };

    Object.entries(this.sessionMetrics).forEach(([stateName, metrics]) => {
      const preferredFieldCount = Object.keys(metrics.preferredFieldUsage || {}).length;
      const totalFieldCount = Object.keys(metrics.fieldCoverage).length;

      report.states.push({
        state: stateName,
        totalEvents: metrics.totalEvents,
        totalFields: totalFieldCount,
        preferredFields: preferredFieldCount,
        standardsCompliance: preferredFieldCount > 3 ? 'Good' : preferredFieldCount > 0 ? 'Partial' : 'Custom'
      });

      if (preferredFieldCount > 3) {
        report.summary.statesUsingWZDxStandards++;
      }
    });

    report.summary.totalStates = report.states.length;

    // Sort by standards compliance
    report.states.sort((a, b) => b.preferredFields - a.preferredFields);

    return report;
  }

  /**
   * Check if a state has adopted WZDx standards
   */
  isUsingWZDxStandards(stateName) {
    const metrics = this.sessionMetrics[stateName];
    if (!metrics) return false;

    const preferredFieldCount = Object.keys(metrics.preferredFieldUsage || {}).length;
    return preferredFieldCount >= 4; // Using at least 4 preferred field names
  }

  /**
   * Get trending data for a state over time
   */
  getStateTrend(stateName, days = 30) {
    if (!fs.existsSync(QUALITY_LOG_PATH)) return [];

    try {
      const lines = fs.readFileSync(QUALITY_LOG_PATH, 'utf8').split('\n').filter(l => l.trim());
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const trend = lines
        .map(line => JSON.parse(line))
        .filter(entry => entry.state === stateName && new Date(entry.timestamp) >= cutoffDate)
        .map(entry => ({
          timestamp: entry.timestamp,
          totalEvents: entry.totalEvents,
          preferredFields: Object.keys(entry.preferredFieldUsage || {}).length,
          totalFields: Object.keys(entry.fieldCoverage).length
        }));

      return trend;
    } catch (error) {
      console.error('Error loading state trend:', error.message);
      return [];
    }
  }

  /**
   * Recommend actions for states with low quality
   */
  generateRecommendations(stateName) {
    const metrics = this.sessionMetrics[stateName];
    if (!metrics) return [];

    const recommendations = [];
    const preferredFields = metrics.preferredFieldUsage || {};

    const CRITICAL_FIELDS = {
      eventType: { preferred: 'event_type', importance: 'Required for event classification' },
      startTime: { preferred: 'start_date', importance: 'Required for temporal awareness' },
      corridor: { preferred: 'road_names', importance: 'Required for location routing' },
      lanesAffected: { preferred: 'vehicle_impact', importance: 'Required for impact assessment' }
    };

    Object.entries(CRITICAL_FIELDS).forEach(([concept, info]) => {
      if (!preferredFields[concept]) {
        recommendations.push({
          field: concept,
          preferredName: info.preferred,
          importance: info.importance,
          action: `Add "${info.preferred}" field to feed to comply with WZDx v4.x standard`
        });
      }
    });

    return recommendations;
  }
}

// Singleton instance
const monitor = new DataQualityMonitor();

module.exports = monitor;

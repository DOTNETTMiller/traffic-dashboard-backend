const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'traffic_data.db');

/**
 * Feed Tracking Service
 *
 * Tracks feed fetch success/failure for data quality monitoring
 */
class FeedTrackingService {
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
   * Log a feed fetch attempt
   * @param {string} stateKey - State identifier
   * @param {string} feedType - Type of feed ('events', 'incidents', etc.)
   * @param {boolean} success - Whether the fetch succeeded
   * @param {number} responseTimeMs - Response time in milliseconds
   * @param {number} eventCount - Number of events fetched
   * @param {string} errorMessage - Error message if failed
   * @param {number} httpStatus - HTTP status code
   */
  logFetchAttempt(stateKey, feedType, success, responseTimeMs = null, eventCount = 0, errorMessage = null, httpStatus = null) {
    const db = this.getDb();

    try {
      // Insert fetch history record
      db.prepare(`
        INSERT INTO feed_fetch_history (
          state_key, feed_type, success, response_time_ms,
          event_count, error_message, http_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        stateKey,
        feedType,
        success ? 1 : 0,
        responseTimeMs,
        eventCount,
        errorMessage,
        httpStatus
      );

      // Update availability summary
      this.updateAvailabilitySummary(stateKey);
    } catch (error) {
      console.error(`Error logging fetch attempt for ${stateKey}:`, error);
    }
  }

  /**
   * Update availability summary for a state
   * Calculates 24h, 7d, and 30d uptime percentages
   */
  updateAvailabilitySummary(stateKey) {
    const db = this.getDb();

    try {
      // Calculate uptime for different time periods
      const uptime24h = this.calculateUptime(stateKey, 24);
      const uptime7d = this.calculateUptime(stateKey, 24 * 7);
      const uptime30d = this.calculateUptime(stateKey, 24 * 30);

      // Get total stats
      const stats = db.prepare(`
        SELECT
          COUNT(*) as total_fetches,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_fetches,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_fetches,
          AVG(CASE WHEN success = 1 THEN response_time_ms ELSE NULL END) as avg_response_time
        FROM feed_fetch_history
        WHERE state_key = ?
      `).get(stateKey);

      // Get last success and failure timestamps
      const lastSuccess = db.prepare(`
        SELECT fetch_timestamp
        FROM feed_fetch_history
        WHERE state_key = ? AND success = 1
        ORDER BY fetch_timestamp DESC
        LIMIT 1
      `).get(stateKey);

      const lastFailure = db.prepare(`
        SELECT fetch_timestamp
        FROM feed_fetch_history
        WHERE state_key = ? AND success = 0
        ORDER BY fetch_timestamp DESC
        LIMIT 1
      `).get(stateKey);

      // Calculate consecutive failures
      const consecutiveFailures = this.getConsecutiveFailures(stateKey);

      // Upsert summary
      db.prepare(`
        INSERT INTO feed_availability_summary (
          state_key, total_fetches, successful_fetches, failed_fetches,
          uptime_percentage_24h, uptime_percentage_7d, uptime_percentage_30d,
          avg_response_time_ms, last_success_timestamp, last_failure_timestamp,
          consecutive_failures, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(state_key) DO UPDATE SET
          total_fetches = excluded.total_fetches,
          successful_fetches = excluded.successful_fetches,
          failed_fetches = excluded.failed_fetches,
          uptime_percentage_24h = excluded.uptime_percentage_24h,
          uptime_percentage_7d = excluded.uptime_percentage_7d,
          uptime_percentage_30d = excluded.uptime_percentage_30d,
          avg_response_time_ms = excluded.avg_response_time_ms,
          last_success_timestamp = excluded.last_success_timestamp,
          last_failure_timestamp = excluded.last_failure_timestamp,
          consecutive_failures = excluded.consecutive_failures,
          last_updated = CURRENT_TIMESTAMP
      `).run(
        stateKey,
        stats.total_fetches || 0,
        stats.successful_fetches || 0,
        stats.failed_fetches || 0,
        uptime24h,
        uptime7d,
        uptime30d,
        Math.round(stats.avg_response_time || 0),
        lastSuccess?.fetch_timestamp || null,
        lastFailure?.fetch_timestamp || null,
        consecutiveFailures
      );
    } catch (error) {
      console.error(`Error updating availability summary for ${stateKey}:`, error);
    }
  }

  /**
   * Calculate uptime percentage for a given time period
   * @param {string} stateKey - State identifier
   * @param {number} hours - Number of hours to look back
   * @returns {number} Uptime percentage (0-100)
   */
  calculateUptime(stateKey, hours) {
    const db = this.getDb();

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful
      FROM feed_fetch_history
      WHERE state_key = ?
        AND fetch_timestamp >= datetime('now', '-' || ? || ' hours')
    `).get(stateKey, hours);

    if (!stats.total || stats.total === 0) {
      return 100; // No data = assume available
    }

    return Math.round((stats.successful / stats.total) * 100);
  }

  /**
   * Get consecutive failure count
   * @param {string} stateKey - State identifier
   * @returns {number} Number of consecutive failures
   */
  getConsecutiveFailures(stateKey) {
    const db = this.getDb();

    const recentAttempts = db.prepare(`
      SELECT success
      FROM feed_fetch_history
      WHERE state_key = ?
      ORDER BY fetch_timestamp DESC
      LIMIT 20
    `).all(stateKey);

    let consecutiveFailures = 0;
    for (const attempt of recentAttempts) {
      if (attempt.success === 0) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    return consecutiveFailures;
  }

  /**
   * Get availability metrics for a state
   * @param {string} stateKey - State identifier
   * @returns {Object} Availability metrics
   */
  getAvailabilityMetrics(stateKey) {
    const db = this.getDb();

    const summary = db.prepare(`
      SELECT *
      FROM feed_availability_summary
      WHERE state_key = ?
    `).get(stateKey);

    if (!summary) {
      return {
        uptime_percentage_24h: 100,
        uptime_percentage_7d: 100,
        uptime_percentage_30d: 100,
        total_fetches: 0,
        successful_fetches: 0,
        failed_fetches: 0,
        avg_response_time_ms: 0,
        consecutive_failures: 0
      };
    }

    return summary;
  }

  /**
   * Get recent fetch history for a state
   * @param {string} stateKey - State identifier
   * @param {number} limit - Number of records to return
   * @returns {Array} Recent fetch attempts
   */
  getRecentFetchHistory(stateKey, limit = 50) {
    const db = this.getDb();

    return db.prepare(`
      SELECT *
      FROM feed_fetch_history
      WHERE state_key = ?
      ORDER BY fetch_timestamp DESC
      LIMIT ?
    `).all(stateKey, limit);
  }

  /**
   * Clean up old fetch history (keep last 90 days)
   */
  cleanupOldHistory() {
    const db = this.getDb();

    try {
      const result = db.prepare(`
        DELETE FROM feed_fetch_history
        WHERE fetch_timestamp < datetime('now', '-90 days')
      `).run();

      console.log(`🗑️  Cleaned up ${result.changes} old fetch history records`);
    } catch (error) {
      console.error('Error cleaning up fetch history:', error);
    }
  }
}

module.exports = FeedTrackingService;

/**
 * Event Lifecycle Management Service
 *
 * Manages event lifecycle including:
 * - Tracking when events first appear in feeds
 * - Tracking when events are last seen in feeds
 * - Validating end times against feed presence
 * - Automatically extending end times for events still in feeds
 * - Only removing events when confirmed gone from source
 * - Persisting tracking data to database
 */

const EventEmitter = require('events');

class EventLifecycleManager extends EventEmitter {
  constructor(pgPool = null) {
    super();

    // Map of event ID -> tracking info
    this.eventTracking = new Map();

    // Default end time extension (2 hours)
    this.defaultExtensionHours = 2;

    // How long after last seen before we consider an event ended (30 minutes)
    this.removalDelayMinutes = 30;

    // Database connection pool (optional - falls back to memory-only)
    this.pgPool = pgPool;

    // Track if we've loaded from database
    this.loadedFromDatabase = false;

    // Batch save to avoid too many DB writes
    this.savePending = false;
    this.saveTimeout = null;
  }

  /**
   * Process a batch of events from a feed refresh
   * @param {Array} freshEvents - Events from the current feed fetch
   * @param {String} source - Source identifier (e.g., 'IA', 'MN', 'OH')
   * @returns {Object} - Processing results
   */
  processFeedRefresh(freshEvents, source) {
    const now = new Date();
    const currentEventIds = new Set(freshEvents.map(e => e.id));
    const results = {
      new: 0,
      updated: 0,
      endTimeExtended: 0,
      stillActive: 0,
      markedForRemoval: 0,
      removed: 0
    };

    // Load from database on first run
    if (!this.loadedFromDatabase && this.pgPool) {
      // Don't await - will populate gradually
      this.loadFromDatabase().catch(err => {
        console.error('Error loading lifecycle data:', err);
      });
    }

    // Process events from current feed
    for (const event of freshEvents) {
      const tracking = this.eventTracking.get(event.id);

      if (!tracking) {
        // New event - first time we've seen it
        this.eventTracking.set(event.id, {
          id: event.id,
          source,
          firstSeen: now,
          lastSeen: now,
          seenCount: 1,
          originalEndTime: event.endTime || null,
          currentEndTime: event.endTime || this.estimateEndTime(event, now),
          extensionCount: 0,
          hasNativeEndTime: !!event.endTime
        });
        results.new++;
      } else {
        // Existing event - update tracking
        tracking.lastSeen = now;
        tracking.seenCount++;
        results.updated++;

        // Check if we need to extend end time
        if (this.shouldExtendEndTime(tracking, event, now)) {
          const newEndTime = this.extendEndTime(tracking.currentEndTime, now);
          console.log(`⏰ Extending end time for ${event.id}: ${tracking.currentEndTime} → ${newEndTime} (still in feed)`);

          tracking.currentEndTime = newEndTime;
          tracking.extensionCount++;
          event.endTime = newEndTime; // Update the event object
          event._endTimeExtended = true;
          event._extensionReason = 'Event still present in source feed';
          results.endTimeExtended++;
        }

        results.stillActive++;
      }
    }

    // Check for events that may have ended (not in current feed)
    for (const [eventId, tracking] of this.eventTracking.entries()) {
      if (tracking.source === source && !currentEventIds.has(eventId)) {
        const minutesSinceLastSeen = (now - tracking.lastSeen) / 1000 / 60;

        if (minutesSinceLastSeen >= this.removalDelayMinutes) {
          // Event hasn't been seen for long enough - mark for removal
          console.log(`🗑️  Event ${eventId} not seen for ${minutesSinceLastSeen.toFixed(1)} min - removing from tracking`);
          this.eventTracking.delete(eventId);
          results.removed++;

          // Emit event for external handling
          this.emit('event-ended', {
            eventId,
            lastSeen: tracking.lastSeen,
            source: tracking.source,
            minutesSinceLastSeen: minutesSinceLastSeen.toFixed(1)
          });
        } else {
          // Recently disappeared - give it more time (might come back in next refresh)
          results.markedForRemoval++;
        }
      }
    }

    // Schedule database save
    this.scheduleSave();

    return results;
  }

  /**
   * Check if an event's end time should be extended
   * @param {Object} tracking - Event tracking info
   * @param {Object} event - Current event data
   * @param {Date} now - Current time
   * @returns {Boolean}
   */
  shouldExtendEndTime(tracking, event, now) {
    if (!tracking.currentEndTime) return false;

    const endTime = new Date(tracking.currentEndTime);
    const hoursUntilEnd = (endTime - now) / 1000 / 60 / 60;

    // Extend if end time is within next hour and event is still in feed
    if (hoursUntilEnd < 1 && hoursUntilEnd > 0) {
      return true;
    }

    // Extend if end time has already passed and event is still in feed
    if (hoursUntilEnd <= 0) {
      return true;
    }

    return false;
  }

  /**
   * Extend an end time by default extension period
   * @param {String} currentEndTime - Current end time (ISO string)
   * @param {Date} now - Current time
   * @returns {String} - New end time (ISO string)
   */
  extendEndTime(currentEndTime, now) {
    const current = new Date(currentEndTime);
    const extended = new Date(current);

    // If end time is in the past, extend from now
    if (current < now) {
      extended.setTime(now.getTime() + (this.defaultExtensionHours * 60 * 60 * 1000));
    } else {
      // Otherwise extend from current end time
      extended.setTime(current.getTime() + (this.defaultExtensionHours * 60 * 60 * 1000));
    }

    return extended.toISOString();
  }

  /**
   * Estimate end time for event without native end time
   * @param {Object} event - Event object
   * @param {Date} now - Current time
   * @returns {String} - Estimated end time (ISO string)
   */
  estimateEndTime(event, now) {
    // Base estimate: 4 hours from now
    let hours = 4;

    // Adjust based on event type
    if (event.eventType === 'Incident') {
      hours = 2; // Incidents typically clear faster
    } else if (event.eventType === 'Construction') {
      hours = 8; // Construction typically lasts longer
    } else if (event.eventType === 'Weather') {
      hours = 6; // Weather events can be extended
    }

    // Adjust based on severity
    if (event.severity === 'high' || event.lanesAffected?.toLowerCase().includes('closed')) {
      hours *= 1.5; // High severity events may take longer to clear
    }

    const estimated = new Date(now);
    estimated.setTime(now.getTime() + (hours * 60 * 60 * 1000));
    return estimated.toISOString();
  }

  /**
   * Enrich events array with lifecycle tracking data
   * @param {Array} events - Events to enrich
   * @returns {Array} - Enriched events
   */
  enrichEvents(events) {
    return events.map(event => {
      const tracking = this.eventTracking.get(event.id);

      if (!tracking) {
        return event; // Not tracked yet
      }

      return {
        ...event,
        endTime: tracking.currentEndTime,
        _lifecycle: {
          firstSeen: tracking.firstSeen,
          lastSeen: tracking.lastSeen,
          seenCount: tracking.seenCount,
          extensionCount: tracking.extensionCount,
          hasNativeEndTime: tracking.hasNativeEndTime,
          isEstimated: !tracking.hasNativeEndTime
        }
      };
    });
  }

  /**
   * Filter out events that should be removed (haven't been seen recently)
   * @param {Array} events - All cached events
   * @param {Date} now - Current time
   * @returns {Array} - Filtered events (only active ones)
   */
  filterActiveEvents(events, now = new Date()) {
    return events.filter(event => {
      const tracking = this.eventTracking.get(event.id);

      // If not tracked, include it (will be tracked on next refresh)
      if (!tracking) return true;

      // Check if event has been missing from feed for too long
      const minutesSinceLastSeen = (now - tracking.lastSeen) / 1000 / 60;

      if (minutesSinceLastSeen > this.removalDelayMinutes) {
        console.log(`🚫 Filtering out event ${event.id} (not seen for ${minutesSinceLastSeen.toFixed(1)} min)`);
        return false;
      }

      return true;
    });
  }

  /**
   * Get tracking statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    const stats = {
      totalTracked: this.eventTracking.size,
      bySource: {},
      withNativeEndTime: 0,
      withEstimatedEndTime: 0,
      extended: 0,
      averageSeenCount: 0
    };

    let totalSeenCount = 0;

    for (const tracking of this.eventTracking.values()) {
      // By source
      if (!stats.bySource[tracking.source]) {
        stats.bySource[tracking.source] = 0;
      }
      stats.bySource[tracking.source]++;

      // End time types
      if (tracking.hasNativeEndTime) {
        stats.withNativeEndTime++;
      } else {
        stats.withEstimatedEndTime++;
      }

      // Extensions
      if (tracking.extensionCount > 0) {
        stats.extended++;
      }

      totalSeenCount += tracking.seenCount;
    }

    stats.averageSeenCount = stats.totalTracked > 0
      ? (totalSeenCount / stats.totalTracked).toFixed(1)
      : 0;

    return stats;
  }

  /**
   * Load tracking data from database
   * @returns {Promise<Number>} - Number of events loaded
   */
  async loadFromDatabase() {
    if (!this.pgPool) {
      console.log('⚠️  No database pool - running in memory-only mode');
      return 0;
    }

    try {
      const result = await this.pgPool.query(`
        SELECT
          event_id,
          source,
          first_seen,
          last_seen,
          seen_count,
          original_end_time,
          current_end_time,
          extension_count,
          has_native_end_time
        FROM event_lifecycle
        WHERE last_seen > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        ORDER BY last_seen DESC
      `);

      let loaded = 0;
      for (const row of result.rows) {
        this.eventTracking.set(row.event_id, {
          id: row.event_id,
          source: row.source,
          firstSeen: row.first_seen,
          lastSeen: row.last_seen,
          seenCount: row.seen_count,
          originalEndTime: row.original_end_time ? row.original_end_time.toISOString() : null,
          currentEndTime: row.current_end_time ? row.current_end_time.toISOString() : null,
          extensionCount: row.extension_count,
          hasNativeEndTime: row.has_native_end_time
        });
        loaded++;
      }

      this.loadedFromDatabase = true;
      console.log(`📂 Loaded ${loaded} event lifecycle records from database`);
      return loaded;
    } catch (error) {
      console.error('❌ Error loading lifecycle data from database:', error.message);
      return 0;
    }
  }

  /**
   * Save tracking data to database (batched)
   * @returns {Promise<void>}
   */
  async saveToDatabase() {
    if (!this.pgPool) return;

    // Clear any pending save timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    if (this.savePending) {
      return; // Already saving
    }

    this.savePending = true;

    try {
      const entries = Array.from(this.eventTracking.values());

      if (entries.length === 0) {
        this.savePending = false;
        return;
      }

      // Use batch upsert for performance
      const values = [];
      const params = [];
      let paramIndex = 1;

      for (const tracking of entries) {
        values.push(`(
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++}
        )`);

        params.push(
          tracking.id,
          tracking.source,
          tracking.firstSeen,
          tracking.lastSeen,
          tracking.seenCount,
          tracking.originalEndTime,
          tracking.currentEndTime,
          tracking.extensionCount,
          tracking.hasNativeEndTime
        );
      }

      const query = `
        INSERT INTO event_lifecycle (
          event_id, source, first_seen, last_seen, seen_count,
          original_end_time, current_end_time, extension_count, has_native_end_time
        ) VALUES ${values.join(', ')}
        ON CONFLICT (event_id) DO UPDATE SET
          last_seen = EXCLUDED.last_seen,
          seen_count = EXCLUDED.seen_count,
          current_end_time = EXCLUDED.current_end_time,
          extension_count = EXCLUDED.extension_count
      `;

      await this.pgPool.query(query, params);
      console.log(`💾 Saved ${entries.length} event lifecycle records to database`);
    } catch (error) {
      console.error('❌ Error saving lifecycle data to database:', error.message);
    } finally {
      this.savePending = false;
    }
  }

  /**
   * Schedule a batched save (debounced to avoid too many writes)
   */
  scheduleSave() {
    if (!this.pgPool) return;

    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Save after 10 seconds of inactivity
    this.saveTimeout = setTimeout(() => {
      this.saveToDatabase().catch(err => {
        console.error('Error in scheduled save:', err);
      });
    }, 10000);
  }

  /**
   * Clean up old expired events from database
   * @returns {Promise<Number>} - Number of events cleaned up
   */
  async cleanupExpired() {
    if (!this.pgPool) return 0;

    try {
      const result = await this.pgPool.query(`
        SELECT cleanup_expired_event_lifecycle() as deleted_count
      `);

      const deletedCount = result.rows[0]?.deleted_count || 0;
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} expired event lifecycle records`);
      }
      return deletedCount;
    } catch (error) {
      console.error('❌ Error cleaning up expired lifecycle data:', error.message);
      return 0;
    }
  }

  /**
   * Clear tracking data (for testing or reset)
   */
  reset() {
    this.eventTracking.clear();
  }
}

// Create singleton instance without database (will be initialized later)
const lifecycleManager = new EventLifecycleManager();

module.exports = lifecycleManager;
module.exports.EventLifecycleManager = EventLifecycleManager;

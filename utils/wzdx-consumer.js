/**
 * WZDx Feed Consumer
 *
 * Fetches, validates, and stores Work Zone Data Exchange (WZDx) feeds
 * from state DOT sources.
 */

const axios = require('axios');
const db = require('../database');
const { validator } = require('./wzdx-validator');

class WZDxConsumer {
  constructor() {
    this.timeout = 30000; // 30 second timeout for feed fetches
  }

  /**
   * Fetch a WZDx feed from URL
   */
  async fetchFeed(url) {
    try {
      console.log(`Fetching WZDx feed: ${url}`);

      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'Accept': 'application/geo+json, application/json',
          'User-Agent': 'DOT-Corridor-Communicator/1.0'
        }
      });

      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers
      };
    } catch (error) {
      console.error(`Error fetching WZDx feed from ${url}:`, error.message);
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  /**
   * Parse and extract work zone features from WZDx feed
   */
  parseWZDxFeed(feed) {
    if (!feed || feed.type !== 'FeatureCollection') {
      throw new Error('Invalid WZDx feed: must be a GeoJSON FeatureCollection');
    }

    const features = feed.features || [];
    const feedInfo = feed.properties?.feed_info || {};
    const dataSource = feed.properties?.feed_info?.data_sources?.[0] || {};

    return {
      feedInfo,
      dataSource,
      features,
      featureCount: features.length
    };
  }

  /**
   * Extract work zone data from a WZDx feature
   */
  extractWorkZoneData(feature, sourceInfo = {}) {
    const props = feature.properties || {};
    const coreDetails = props.core_details || {};

    // Extract geometry
    const geometry = feature.geometry;
    const coordinates = geometry?.coordinates;

    // Calculate bounding box for spatial queries
    let bbox = null;
    if (coordinates && Array.isArray(coordinates)) {
      if (geometry.type === 'LineString') {
        const lons = coordinates.map(c => c[0]);
        const lats = coordinates.map(c => c[1]);
        bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
      }
    }

    return {
      // Core identification
      feature_id: props.road_event_id || props.id || `wzdx-${Date.now()}-${Math.random()}`,

      // Road information
      road_name: coreDetails.road_names?.[0],
      road_number: this.extractRoadNumber(coreDetails.road_names),
      direction: coreDetails.direction,
      beginning_milepost: props.beginning_milepost,
      ending_milepost: props.ending_milepost,
      beginning_cross_street: props.beginning_cross_street,
      ending_cross_street: props.ending_cross_street,

      // Event classification
      event_type: coreDetails.event_type,
      event_status: coreDetails.event_status,
      vehicle_impact: props.vehicle_impact,

      // Temporal
      start_date: props.start_date,
      end_date: props.end_date,
      is_start_date_verified: props.is_start_date_verified || false,
      is_end_date_verified: props.is_end_date_verified || false,
      is_end_date_all_day: props.is_end_date_all_day || false,

      // Work zone details
      work_zone_type: props.work_zone_type,
      reduced_speed_limit: props.reduced_speed_limit_kph
        ? Math.round(props.reduced_speed_limit_kph * 0.621371) // Convert km/h to mph
        : null,
      restrictions: JSON.stringify(props.restrictions || []),
      description: coreDetails.description,
      creation_date: props.creation_date,
      update_date: props.update_date,

      // Lane information
      lanes: JSON.stringify(props.lanes || []),
      beginning_accuracy: props.beginning_accuracy,
      ending_accuracy: props.ending_accuracy,

      // Location method
      location_method: props.location_method,

      // Spatial data
      geometry: JSON.stringify(geometry),
      bbox: bbox ? JSON.stringify(bbox) : null,

      // Relationships
      relationship: JSON.stringify(props.relationship || {}),

      // Types of work
      types_of_work: JSON.stringify(props.types_of_work || []),

      // Worker presence
      worker_presence: JSON.stringify(props.worker_presence || {}),

      // Source tracking
      source_feed_url: sourceInfo.feedUrl,
      source_feed_name: sourceInfo.feedName,
      source_state: sourceInfo.state,
      data_source_id: sourceInfo.dataSourceId,
      last_updated_source: new Date().toISOString(),

      // Validation
      wzdx_version: sourceInfo.wzdxVersion || '4.2',
      is_valid: true,
      validation_errors: null,

      // Full feature
      wzdx_feature_json: JSON.stringify(feature),

      // Metadata
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Extract road number from road names (e.g., "I-80" from ["Interstate 80"])
   */
  extractRoadNumber(roadNames) {
    if (!roadNames || !Array.isArray(roadNames) || roadNames.length === 0) {
      return null;
    }

    const roadName = roadNames[0];

    // Try to extract standard highway numbers
    const patterns = [
      /I-?(\d+)/i,           // Interstate: "I-80" or "I80"
      /US-?(\d+)/i,          // US Highway: "US-50"
      /SR-?(\d+)/i,          // State Route: "SR-1"
      /Route\s+(\d+)/i,      // "Route 66"
      /Highway\s+(\d+)/i     // "Highway 101"
    ];

    for (const pattern of patterns) {
      const match = roadName.match(pattern);
      if (match) {
        return roadName; // Return full matched name
      }
    }

    return roadName; // Return as-is if no pattern matched
  }

  /**
   * Store work zone in database (insert or update)
   */
  async storeWorkZone(workZoneData) {
    try {
      // Check if this feature already exists
      const existing = await db.db.prepare(`
        SELECT id FROM wzdx_work_zones WHERE feature_id = ?
      `).get(workZoneData.feature_id);

      if (existing) {
        // Update existing
        await db.runAsync(`
          UPDATE wzdx_work_zones SET
            road_name = ?,
            road_number = ?,
            direction = ?,
            beginning_milepost = ?,
            ending_milepost = ?,
            beginning_cross_street = ?,
            ending_cross_street = ?,
            event_type = ?,
            event_status = ?,
            vehicle_impact = ?,
            start_date = ?,
            end_date = ?,
            is_start_date_verified = ?,
            is_end_date_verified = ?,
            is_end_date_all_day = ?,
            work_zone_type = ?,
            reduced_speed_limit = ?,
            restrictions = ?,
            description = ?,
            creation_date = ?,
            update_date = ?,
            lanes = ?,
            beginning_accuracy = ?,
            ending_accuracy = ?,
            location_method = ?,
            geometry = ?,
            bbox = ?,
            relationship = ?,
            types_of_work = ?,
            worker_presence = ?,
            source_feed_url = ?,
            source_feed_name = ?,
            source_state = ?,
            data_source_id = ?,
            last_updated_source = ?,
            wzdx_version = ?,
            is_valid = ?,
            validation_errors = ?,
            wzdx_feature_json = ?,
            updated_at = ?
          WHERE feature_id = ?
        `, [
          workZoneData.road_name,
          workZoneData.road_number,
          workZoneData.direction,
          workZoneData.beginning_milepost,
          workZoneData.ending_milepost,
          workZoneData.beginning_cross_street,
          workZoneData.ending_cross_street,
          workZoneData.event_type,
          workZoneData.event_status,
          workZoneData.vehicle_impact,
          workZoneData.start_date,
          workZoneData.end_date,
          workZoneData.is_start_date_verified ? 1 : 0,
          workZoneData.is_end_date_verified ? 1 : 0,
          workZoneData.is_end_date_all_day ? 1 : 0,
          workZoneData.work_zone_type,
          workZoneData.reduced_speed_limit,
          workZoneData.restrictions,
          workZoneData.description,
          workZoneData.creation_date,
          workZoneData.update_date,
          workZoneData.lanes,
          workZoneData.beginning_accuracy,
          workZoneData.ending_accuracy,
          workZoneData.location_method,
          workZoneData.geometry,
          workZoneData.bbox,
          workZoneData.relationship,
          workZoneData.types_of_work,
          workZoneData.worker_presence,
          workZoneData.source_feed_url,
          workZoneData.source_feed_name,
          workZoneData.source_state,
          workZoneData.data_source_id,
          workZoneData.last_updated_source,
          workZoneData.wzdx_version,
          workZoneData.is_valid ? 1 : 0,
          workZoneData.validation_errors,
          workZoneData.wzdx_feature_json,
          workZoneData.updated_at,
          workZoneData.feature_id
        ]);

        return { action: 'updated', feature_id: workZoneData.feature_id };
      } else {
        // Insert new
        await db.runAsync(`
          INSERT INTO wzdx_work_zones (
            feature_id, road_name, road_number, direction,
            beginning_milepost, ending_milepost,
            beginning_cross_street, ending_cross_street,
            event_type, event_status, vehicle_impact,
            start_date, end_date,
            is_start_date_verified, is_end_date_verified, is_end_date_all_day,
            work_zone_type, reduced_speed_limit, restrictions,
            description, creation_date, update_date,
            lanes, beginning_accuracy, ending_accuracy, location_method,
            geometry, bbox,
            relationship, types_of_work, worker_presence,
            source_feed_url, source_feed_name, source_state, data_source_id,
            last_updated_source,
            wzdx_version, is_valid, validation_errors, wzdx_feature_json,
            updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
        `, [
          workZoneData.feature_id, workZoneData.road_name, workZoneData.road_number,
          workZoneData.direction, workZoneData.beginning_milepost, workZoneData.ending_milepost,
          workZoneData.beginning_cross_street, workZoneData.ending_cross_street,
          workZoneData.event_type, workZoneData.event_status, workZoneData.vehicle_impact,
          workZoneData.start_date, workZoneData.end_date,
          workZoneData.is_start_date_verified ? 1 : 0,
          workZoneData.is_end_date_verified ? 1 : 0,
          workZoneData.is_end_date_all_day ? 1 : 0,
          workZoneData.work_zone_type, workZoneData.reduced_speed_limit,
          workZoneData.restrictions, workZoneData.description,
          workZoneData.creation_date, workZoneData.update_date,
          workZoneData.lanes, workZoneData.beginning_accuracy, workZoneData.ending_accuracy,
          workZoneData.location_method, workZoneData.geometry, workZoneData.bbox,
          workZoneData.relationship, workZoneData.types_of_work, workZoneData.worker_presence,
          workZoneData.source_feed_url, workZoneData.source_feed_name, workZoneData.source_state,
          workZoneData.data_source_id, workZoneData.last_updated_source,
          workZoneData.wzdx_version, workZoneData.is_valid ? 1 : 0,
          workZoneData.validation_errors, workZoneData.wzdx_feature_json,
          workZoneData.updated_at
        ]);

        return { action: 'inserted', feature_id: workZoneData.feature_id };
      }
    } catch (error) {
      console.error('Error storing work zone:', error);
      throw error;
    }
  }

  /**
   * Process a WZDx feed: fetch, validate, and store
   */
  async processFeed(feedUrl, feedName, state) {
    const startTime = Date.now();
    const stats = {
      status: 'success',
      featuresProcessed: 0,
      featuresInserted: 0,
      featuresUpdated: 0,
      featuresFailed: 0,
      errors: []
    };

    try {
      // 1. Fetch feed
      const fetchResult = await this.fetchFeed(feedUrl);
      if (!fetchResult.success) {
        throw new Error(`Fetch failed: ${fetchResult.error}`);
      }

      const feed = fetchResult.data;

      // 2. Validate against WZDx schema
      const validation = await validator.validate(feed);
      console.log(validator.getValidationSummary(validation));

      if (!validation.valid) {
        console.warn(`Warning: Feed validation errors:`, validation.errors);
        // Continue processing anyway, but mark features as potentially invalid
      }

      // 3. Parse feed
      const { feedInfo, dataSource, features } = this.parseWZDxFeed(feed);

      console.log(`Processing ${features.length} features from ${feedName}...`);

      const sourceInfo = {
        feedUrl,
        feedName,
        state,
        dataSourceId: dataSource.data_source_id,
        wzdxVersion: feedInfo.version || '4.2'
      };

      // 4. Process each feature
      for (const feature of features) {
        stats.featuresProcessed++;

        try {
          const workZoneData = this.extractWorkZoneData(feature, sourceInfo);
          const result = await this.storeWorkZone(workZoneData);

          if (result.action === 'inserted') {
            stats.featuresInserted++;
          } else if (result.action === 'updated') {
            stats.featuresUpdated++;
          }
        } catch (error) {
          stats.featuresFailed++;
          stats.errors.push({
            feature_id: feature.properties?.road_event_id || 'unknown',
            error: error.message
          });
          console.error(`Failed to process feature:`, error.message);
        }
      }

      stats.durationMs = Date.now() - startTime;

      console.log(`✓ Processed ${feedName}:`);
      console.log(`  Inserted: ${stats.featuresInserted}`);
      console.log(`  Updated: ${stats.featuresUpdated}`);
      console.log(`  Failed: ${stats.featuresFailed}`);
      console.log(`  Duration: ${stats.durationMs}ms`);

      return stats;
    } catch (error) {
      stats.status = 'error';
      stats.errors.push({ error: error.message });
      stats.durationMs = Date.now() - startTime;

      console.error(`✗ Error processing ${feedName}:`, error.message);
      return stats;
    }
  }

  /**
   * Update all active WZDx feeds from database
   */
  async updateAllFeeds() {
    try {
      // Get all active feed sources
      const feeds = await db.db.prepare(`
        SELECT id, feed_url, feed_name, state_code, organization_name
        FROM wzdx_feed_sources
        WHERE active = 1 AND auto_update = 1
      `).all();

      console.log(`\nUpdating ${feeds.length} WZDx feeds...`);

      const results = [];
      for (const feed of feeds) {
        const stats = await this.processFeed(
          feed.feed_url,
          feed.feed_name || feed.organization_name,
          feed.state_code
        );

        results.push({
          feed_id: feed.id,
          ...stats
        });

        // Log to import_log table
        await this.logImport(feed.id, stats);

        // Update feed source status
        await this.updateFeedSourceStatus(feed.id, stats);
      }

      console.log(`\n✓ Feed update complete!`);
      return results;
    } catch (error) {
      console.error('Error updating feeds:', error);
      throw error;
    }
  }

  /**
   * Log import to database
   */
  async logImport(feedSourceId, stats) {
    try {
      await db.runAsync(`
        INSERT INTO wzdx_import_log (
          feed_source_id, status,
          features_processed, features_inserted, features_updated, features_failed,
          errors, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        feedSourceId,
        stats.status,
        stats.featuresProcessed,
        stats.featuresInserted,
        stats.featuresUpdated,
        stats.featuresFailed,
        JSON.stringify(stats.errors),
        stats.durationMs
      ]);
    } catch (error) {
      console.error('Error logging import:', error);
    }
  }

  /**
   * Update feed source status after fetch
   */
  async updateFeedSourceStatus(feedSourceId, stats) {
    try {
      const now = new Date().toISOString();
      const consecutiveFailures = stats.status === 'error'
        ? `consecutive_failures + 1`
        : 0;

      await db.runAsync(`
        UPDATE wzdx_feed_sources SET
          last_fetch_attempt = ?,
          last_successful_fetch = CASE WHEN ? = 'success' THEN ? ELSE last_successful_fetch END,
          last_fetch_status = ?,
          total_features_last_fetch = ?,
          valid_features_last_fetch = ?,
          consecutive_failures = ${consecutiveFailures},
          updated_at = ?
        WHERE id = ?
      `, [
        now,
        stats.status,
        now,
        stats.status,
        stats.featuresProcessed,
        stats.featuresInserted + stats.featuresUpdated,
        now,
        feedSourceId
      ]);
    } catch (error) {
      console.error('Error updating feed source status:', error);
    }
  }
}

module.exports = new WZDxConsumer();

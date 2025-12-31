/**
 * WZDx API Routes
 *
 * Serve Work Zone Data Exchange (WZDx) feeds and manage WZDx data sources.
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { validator, WZDX_VERSION } = require('../utils/wzdx-validator');
const wzdxConsumer = require('../utils/wzdx-consumer');

/**
 * GET /api/wzdx/feed
 * Export all work zones as a WZDx-compliant GeoJSON feed
 */
router.get('/feed', async (req, res) => {
  try {
    const { state, corridor, status, limit } = req.query;

    // Build query based on filters
    let query = 'SELECT * FROM wzdx_work_zones WHERE 1=1';
    const params = [];

    if (state) {
      query += ' AND source_state = ?';
      params.push(state);
    }

    if (corridor) {
      query += ' AND road_number LIKE ?';
      params.push(`%${corridor}%`);
    }

    if (status) {
      query += ' AND event_status = ?';
      params.push(status);
    }

    // Only include active work zones by default
    if (!status) {
      query += ' AND event_status IN (\'active\', \'pending\', \'planned\')';
    }

    query += ' ORDER BY start_date DESC';

    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
    }

    const workZones = await db.db.prepare(query).all(...params);

    // Build WZDx FeatureCollection
    const features = workZones.map(wz => {
      try {
        // Use stored GeoJSON feature if available
        if (wz.wzdx_feature_json) {
          return JSON.parse(wz.wzdx_feature_json);
        }

        // Otherwise build feature from database fields
        return {
          type: 'Feature',
          properties: {
            road_event_id: wz.feature_id,
            core_details: {
              event_type: wz.event_type,
              data_source_id: wz.data_source_id || 'dot-corridor-communicator',
              road_names: [wz.road_name || wz.road_number].filter(Boolean),
              direction: wz.direction,
              description: wz.description,
              event_status: wz.event_status
            },
            start_date: wz.start_date,
            end_date: wz.end_date,
            is_start_date_verified: Boolean(wz.is_start_date_verified),
            is_end_date_verified: Boolean(wz.is_end_date_verified),
            vehicle_impact: wz.vehicle_impact,
            reduced_speed_limit_kph: wz.reduced_speed_limit
              ? Math.round(wz.reduced_speed_limit * 1.60934) // mph to km/h
              : undefined,
            beginning_milepost: wz.beginning_milepost,
            ending_milepost: wz.ending_milepost,
            beginning_cross_street: wz.beginning_cross_street,
            ending_cross_street: wz.ending_cross_street,
            work_zone_type: wz.work_zone_type,
            location_method: wz.location_method,
            beginning_accuracy: wz.beginning_accuracy,
            ending_accuracy: wz.ending_accuracy,
            lanes: wz.lanes ? JSON.parse(wz.lanes) : undefined,
            restrictions: wz.restrictions ? JSON.parse(wz.restrictions) : undefined,
            types_of_work: wz.types_of_work ? JSON.parse(wz.types_of_work) : undefined,
            worker_presence: wz.worker_presence ? JSON.parse(wz.worker_presence) : undefined,
            relationship: wz.relationship ? JSON.parse(wz.relationship) : undefined,
            creation_date: wz.creation_date,
            update_date: wz.update_date || new Date().toISOString()
          },
          geometry: wz.geometry ? JSON.parse(wz.geometry) : null
        };
      } catch (error) {
        console.error(`Error building feature for ${wz.feature_id}:`, error);
        return null;
      }
    }).filter(Boolean);

    // Get unique data sources
    const dataSources = await db.db.prepare(`
      SELECT DISTINCT
        data_source_id,
        source_feed_name as organization_name,
        source_state,
        wzdx_version
      FROM wzdx_work_zones
      WHERE data_source_id IS NOT NULL
    `).all();

    const dataSourcesArray = dataSources.map(ds => ({
      data_source_id: ds.data_source_id || 'dot-corridor-communicator',
      organization_name: ds.organization_name || `${ds.source_state} DOT`,
      update_frequency: 300,  // 5 minutes
      update_date: new Date().toISOString()
    }));

    // If no sources, add our own
    if (dataSourcesArray.length === 0) {
      dataSourcesArray.push({
        data_source_id: 'dot-corridor-communicator',
        organization_name: 'DOT Corridor Communicator',
        update_frequency: 300,
        update_date: new Date().toISOString()
      });
    }

    // Build WZDx feed
    const feed = {
      type: 'FeatureCollection',
      features,
      properties: {
        feed_info: {
          update_date: new Date().toISOString(),
          publisher: 'DOT Corridor Communicator',
          contact_name: 'Corridor Administrator',
          contact_email: 'admin@corridor.local',
          update_frequency: 300,
          version: WZDX_VERSION,
          license: 'https://creativecommons.org/publicdomain/zero/1.0/',
          data_sources: dataSourcesArray
        }
      },
      bbox: calculateBoundingBox(features)
    };

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/geo+json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(feed);
  } catch (error) {
    console.error('Error generating WZDx feed:', error);
    res.status(500).json({ error: 'Failed to generate WZDx feed' });
  }
});

/**
 * GET /api/wzdx/feed/:state
 * Export work zones for a specific state
 */
router.get('/feed/:state', async (req, res) => {
  req.query.state = req.params.state.toUpperCase();
  return router.handle(req, res);
});

/**
 * POST /api/wzdx/validate
 * Validate a WZDx feed against the official schema
 */
router.post('/validate', async (req, res) => {
  try {
    const feed = req.body;

    if (!feed) {
      return res.status(400).json({ error: 'No feed provided in request body' });
    }

    const result = await validator.validate(feed);

    res.json({
      valid: result.valid,
      schema: result.schema,
      version: result.version,
      errors: result.errors,
      summary: validator.getValidationSummary(result)
    });
  } catch (error) {
    console.error('Error validating feed:', error);
    res.status(500).json({ error: 'Validation failed', message: error.message });
  }
});

/**
 * GET /api/wzdx/sources
 * Get all WZDx feed sources
 */
router.get('/sources', async (req, res) => {
  try {
    const sources = await db.db.prepare(`
      SELECT
        id,
        feed_url,
        feed_name,
        organization_name,
        state_code,
        wzdx_version,
        update_frequency,
        last_fetch_attempt,
        last_successful_fetch,
        last_fetch_status,
        consecutive_failures,
        is_valid_wzdx,
        total_features_last_fetch,
        valid_features_last_fetch,
        active,
        auto_update,
        created_at,
        updated_at
      FROM wzdx_feed_sources
      ORDER BY state_code, organization_name
    `).all();

    res.json(sources);
  } catch (error) {
    console.error('Error fetching feed sources:', error);
    res.status(500).json({ error: 'Failed to fetch feed sources' });
  }
});

/**
 * POST /api/wzdx/sources
 * Add a new WZDx feed source
 */
router.post('/sources', async (req, res) => {
  try {
    const {
      feed_url,
      feed_name,
      organization_name,
      state_code,
      wzdx_version,
      update_frequency,
      active,
      auto_update
    } = req.body;

    if (!feed_url) {
      return res.status(400).json({ error: 'feed_url is required' });
    }

    // Insert feed source
    await db.runAsync(`
      INSERT INTO wzdx_feed_sources (
        feed_url, feed_name, organization_name, state_code,
        wzdx_version, update_frequency, active, auto_update
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      feed_url,
      feed_name,
      organization_name,
      state_code,
      wzdx_version || WZDX_VERSION,
      update_frequency || 300,
      active !== false ? 1 : 0,
      auto_update !== false ? 1 : 0
    ]);

    res.json({ success: true, message: 'Feed source added' });
  } catch (error) {
    console.error('Error adding feed source:', error);
    res.status(500).json({ error: 'Failed to add feed source' });
  }
});

/**
 * POST /api/wzdx/update
 * Manually trigger an update of all WZDx feeds
 */
router.post('/update', async (req, res) => {
  try {
    // Run update in background
    wzdxConsumer.updateAllFeeds().catch(error => {
      console.error('Background WZDx update failed:', error);
    });

    res.json({
      success: true,
      message: 'WZDx feed update started in background'
    });
  } catch (error) {
    console.error('Error starting WZDx update:', error);
    res.status(500).json({ error: 'Failed to start update' });
  }
});

/**
 * POST /api/wzdx/update/:sourceId
 * Update a specific WZDx feed source
 */
router.post('/update/:sourceId', async (req, res) => {
  try {
    const { sourceId } = req.params;

    // Get feed source
    const source = await db.db.prepare(`
      SELECT feed_url, feed_name, state_code
      FROM wzdx_feed_sources
      WHERE id = ?
    `).get(sourceId);

    if (!source) {
      return res.status(404).json({ error: 'Feed source not found' });
    }

    // Process feed
    const stats = await wzdxConsumer.processFeed(
      source.feed_url,
      source.feed_name,
      source.state_code
    );

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error updating feed source:', error);
    res.status(500).json({ error: 'Failed to update feed source' });
  }
});

/**
 * GET /api/wzdx/statistics
 * Get WZDx statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    // Total work zones
    const totalResult = await db.db.prepare(`
      SELECT COUNT(*) as total FROM wzdx_work_zones
    `).get();

    // By state
    const byState = await db.db.prepare(`
      SELECT source_state as state, COUNT(*) as count
      FROM wzdx_work_zones
      GROUP BY source_state
      ORDER BY count DESC
    `).all();

    // By status
    const byStatus = await db.db.prepare(`
      SELECT event_status as status, COUNT(*) as count
      FROM wzdx_work_zones
      GROUP BY event_status
      ORDER BY count DESC
    `).all();

    // By type
    const byType = await db.db.prepare(`
      SELECT event_type as type, COUNT(*) as count
      FROM wzdx_work_zones
      GROUP BY event_type
      ORDER BY count DESC
    `).all();

    // Feed sources
    const feedSources = await db.db.prepare(`
      SELECT COUNT(*) as total FROM wzdx_feed_sources
    `).get();

    const activeSources = await db.db.prepare(`
      SELECT COUNT(*) as total FROM wzdx_feed_sources WHERE active = 1
    `).get();

    // Recent imports
    const recentImports = await db.db.prepare(`
      SELECT
        il.import_timestamp,
        il.status,
        il.features_processed,
        il.features_inserted,
        il.features_updated,
        fs.feed_name,
        fs.state_code
      FROM wzdx_import_log il
      JOIN wzdx_feed_sources fs ON il.feed_source_id = fs.id
      ORDER BY il.import_timestamp DESC
      LIMIT 10
    `).all();

    res.json({
      total_work_zones: totalResult.total,
      by_state: byState,
      by_status: byStatus,
      by_type: byType,
      feed_sources: {
        total: feedSources.total,
        active: activeSources.total
      },
      recent_imports: recentImports
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * Calculate bounding box for a set of features
 */
function calculateBoundingBox(features) {
  if (!features || features.length === 0) return null;

  let minLon = Infinity, minLat = Infinity;
  let maxLon = -Infinity, maxLat = -Infinity;

  for (const feature of features) {
    if (!feature.geometry || !feature.geometry.coordinates) continue;

    const coords = feature.geometry.coordinates;
    if (feature.geometry.type === 'LineString') {
      for (const [lon, lat] of coords) {
        minLon = Math.min(minLon, lon);
        minLat = Math.min(minLat, lat);
        maxLon = Math.max(maxLon, lon);
        maxLat = Math.max(maxLat, lat);
      }
    } else if (feature.geometry.type === 'Point') {
      const [lon, lat] = coords;
      minLon = Math.min(minLon, lon);
      minLat = Math.min(minLat, lat);
      maxLon = Math.max(maxLon, lon);
      maxLat = Math.max(maxLat, lat);
    }
  }

  if (!isFinite(minLon)) return null;

  return [minLon, minLat, maxLon, maxLat];
}

module.exports = router;

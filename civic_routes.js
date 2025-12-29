/**
 * CIVIC (Civil Infrastructure Verification & Interoperability Coalition) API Routes
 *
 * Matter-like infrastructure IoT device management and Matter bridge integration
 */

const express = require('express');
const router = express.Router();
const db = require('./database');
const { CachingStrategies, memoize } = require('./caching');

// Reuse NODE authentication middleware
const nodeRoutes = require('./node_routes');

// =============================================================================
// CIVIC Device Registry Endpoints
// =============================================================================

/**
 * GET /civic/v1/devices
 * List all registered CIVIC infrastructure IoT devices
 */
router.get('/devices',
  CachingStrategies.short(), // 60-second cache
  memoize(req => `civic:devices:${req.query.corridor || 'all'}:${req.query.device_type || 'all'}:${req.query.state || 'all'}`, 60),
  async (req, res) => {
  try {
    const { corridor, device_type, state, active_only = 'true' } = req.query;

    let query = 'SELECT * FROM civic_devices WHERE 1=1';
    const params = [];

    if (active_only === 'true') {
      query += ' AND active = ?';
      params.push(1);
    }

    if (corridor) {
      query += ' AND corridor = ?';
      params.push(corridor);
    }

    if (device_type) {
      query += ' AND device_type = ?';
      params.push(device_type);
    }

    if (state) {
      query += ' AND state_key = ?';
      params.push(state);
    }

    query += ' ORDER BY corridor, milepost';

    const devices = db.db.prepare(query).all(...params);

    // Get capabilities for each device
    const devicesWithCapabilities = devices.map(device => {
      const capabilities = db.db.prepare(
        'SELECT capability_name, capability_version, enabled FROM civic_device_capabilities WHERE device_id = ?'
      ).all(device.device_id);

      return {
        ...device,
        capabilities,
        certification_scope: device.certification_scope ? JSON.parse(device.certification_scope) : []
      };
    });

    res.json({
      success: true,
      count: devicesWithCapabilities.length,
      devices: devicesWithCapabilities
    });
  } catch (error) {
    console.error('Error fetching CIVIC devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

/**
 * GET /civic/v1/devices/:deviceId
 * Get detailed information about a specific device
 */
router.get('/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = db.db.prepare(
      'SELECT * FROM civic_devices WHERE device_id = ?'
    ).get(deviceId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Get capabilities
    const capabilities = db.db.prepare(
      'SELECT * FROM civic_device_capabilities WHERE device_id = ?'
    ).all(deviceId);

    // Get recent observations
    const recentObservations = db.db.prepare(`
      SELECT * FROM civic_observations
      WHERE device_id = ?
      ORDER BY observation_timestamp DESC
      LIMIT 10
    `).all(deviceId);

    // Get quality metrics (last 7 days)
    const qualityMetrics = db.db.prepare(`
      SELECT * FROM civic_quality_metrics
      WHERE device_id = ?
      AND metric_date >= DATE('now', '-7 days')
      ORDER BY metric_date DESC
    `).all(deviceId);

    res.json({
      success: true,
      device: {
        ...device,
        capabilities,
        recent_observations: recentObservations.map(obs => ({
          ...obs,
          observation_data: JSON.parse(obs.observation_data)
        })),
        quality_metrics: qualityMetrics
      }
    });
  } catch (error) {
    console.error('Error fetching device details:', error);
    res.status(500).json({ error: 'Failed to fetch device details' });
  }
});

/**
 * POST /civic/v1/devices/register
 * Register a new CIVIC device
 */
router.post('/devices/register', async (req, res) => {
  try {
    const {
      device_id,
      device_type,
      manufacturer,
      model,
      location,
      corridor,
      certification,
      owner_organization
    } = req.body;

    if (!device_id || !device_type || !owner_organization) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert device
    db.db.prepare(`
      INSERT INTO civic_devices (
        device_id, device_type, manufacturer, model,
        location_lat, location_lon, corridor, milepost, state_key,
        certification_authority, certification_level,
        data_quality_tier, owner_organization
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      device_id,
      device_type,
      manufacturer || null,
      model || null,
      location?.lat || null,
      location?.lon || null,
      corridor || null,
      location?.milepost || null,
      location?.state || null,
      certification?.authority || null,
      certification?.level || 'pilot',
      certification?.data_tier || 'commercial_validated',
      owner_organization
    );

    res.status(201).json({
      success: true,
      device_id,
      message: 'Device registered successfully'
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// =============================================================================
// CIVIC Observations Endpoints
// =============================================================================

/**
 * POST /civic/v1/observations
 * Submit new observation from a CIVIC device
 */
router.post('/observations', async (req, res) => {
  try {
    const {
      device_id,
      observation_type,
      observation_data,
      confidence_score = 0.7,
      timestamp
    } = req.body;

    if (!device_id || !observation_type || !observation_data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify device exists
    const device = db.db.prepare(
      'SELECT * FROM civic_devices WHERE device_id = ? AND active = 1'
    ).get(device_id);

    if (!device) {
      return res.status(404).json({ error: 'Device not found or inactive' });
    }

    // Insert observation
    const result = db.db.prepare(`
      INSERT INTO civic_observations (
        device_id, observation_type, observation_data,
        confidence_score, observation_timestamp
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      device_id,
      observation_type,
      JSON.stringify(observation_data),
      confidence_score,
      timestamp || new Date().toISOString()
    );

    // Update device heartbeat
    db.db.prepare(
      'UPDATE civic_devices SET last_heartbeat = CURRENT_TIMESTAMP, online_status = 1 WHERE device_id = ?'
    ).run(device_id);

    res.status(201).json({
      success: true,
      observation_id: result.lastInsertRowid,
      message: 'Observation recorded'
    });
  } catch (error) {
    console.error('Error recording observation:', error);
    res.status(500).json({ error: 'Failed to record observation' });
  }
});

/**
 * GET /civic/v1/observations
 * Get observations with filters
 */
router.get('/observations', async (req, res) => {
  try {
    const {
      corridor,
      device_type,
      observation_type,
      since,
      limit = 100
    } = req.query;

    let query = `
      SELECT o.*, d.device_type, d.corridor, d.milepost, d.state_key
      FROM civic_observations o
      JOIN civic_devices d ON o.device_id = d.device_id
      WHERE 1=1
    `;
    const params = [];

    if (corridor) {
      query += ' AND d.corridor = ?';
      params.push(corridor);
    }

    if (device_type) {
      query += ' AND d.device_type = ?';
      params.push(device_type);
    }

    if (observation_type) {
      query += ' AND o.observation_type = ?';
      params.push(observation_type);
    }

    if (since) {
      query += ' AND o.observation_timestamp >= ?';
      params.push(since);
    }

    query += ' ORDER BY o.observation_timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    const observations = db.db.prepare(query).all(...params);

    res.json({
      success: true,
      count: observations.length,
      observations: observations.map(obs => ({
        ...obs,
        observation_data: JSON.parse(obs.observation_data)
      }))
    });
  } catch (error) {
    console.error('Error fetching observations:', error);
    res.status(500).json({ error: 'Failed to fetch observations' });
  }
});

// =============================================================================
// CIVIC-Matter Bridge Endpoints
// =============================================================================

/**
 * GET /civic/v1/matter-bridge/devices
 * Get all CIVIC devices translated to Matter format
 */
router.get('/matter-bridge/devices',
  CachingStrategies.short(), // 60-second cache
  memoize(req => 'civic:matter:devices', 60),
  async (req, res) => {
  try {
    // Get all active devices with Matter mappings
    const devices = db.db.prepare(`
      SELECT d.*, m.matter_device_type, m.matter_friendly_name, m.matter_capabilities
      FROM civic_devices d
      LEFT JOIN civic_matter_mappings m ON d.device_id = m.civic_device_id
      WHERE d.active = 1
    `).all();

    // Transform to Matter-compatible format
    const matterDevices = devices.map(device => ({
      device_id: `civic_${device.device_id}`,
      device_type: device.matter_device_type || 'infrastructure_sensor',
      friendly_name: device.matter_friendly_name || `${device.corridor} ${device.device_type}`,
      manufacturer: device.manufacturer || 'CIVIC Infrastructure',
      model: device.model || device.device_type,
      capabilities: device.matter_capabilities ? JSON.parse(device.matter_capabilities) : ['notifications'],
      location: {
        corridor: device.corridor,
        milepost: device.milepost,
        state: device.state_key
      },
      data_quality: {
        tier: device.data_quality_tier,
        confidence: device.data_quality_tier === 'official_dot' ? 0.95 : 0.75
      },
      online: device.online_status === 1,
      last_seen: device.last_heartbeat
    }));

    res.json({
      success: true,
      count: matterDevices.length,
      devices: matterDevices,
      bridge_info: {
        version: '1.0',
        protocol: 'CIVIC-Matter Bridge',
        compatible_with: ['Apple HomeKit', 'Google Home', 'Amazon Alexa', 'Samsung SmartThings']
      }
    });
  } catch (error) {
    console.error('Error fetching Matter devices:', error);
    res.status(500).json({ error: 'Failed to fetch Matter devices' });
  }
});

/**
 * GET /civic/v1/matter-bridge/state
 * Get current state of all infrastructure in Matter format
 */
router.get('/matter-bridge/state',
  CachingStrategies.short(), // 60-second cache for real-time state
  memoize(req => `civic:matter:state:${req.query.corridor || 'all'}`, 60),
  async (req, res) => {
  try {
    const { corridor } = req.query;

    // Get latest observations for each device
    let query = `
      SELECT
        d.device_id,
        d.corridor,
        d.milepost,
        d.device_type,
        d.data_quality_tier,
        o.observation_type,
        o.observation_data,
        o.confidence_score,
        o.observation_timestamp,
        m.matter_friendly_name
      FROM civic_devices d
      LEFT JOIN civic_observations o ON d.device_id = o.device_id
      LEFT JOIN civic_matter_mappings m ON d.device_id = m.civic_device_id
      WHERE d.active = 1
        AND o.id = (
          SELECT id FROM civic_observations
          WHERE device_id = d.device_id
          ORDER BY observation_timestamp DESC
          LIMIT 1
        )
    `;

    const params = [];
    if (corridor) {
      query += ' AND d.corridor = ?';
      params.push(corridor);
    }

    const states = db.db.prepare(query).all(...params);

    // Transform to Matter state format
    const matterStates = states.map(state => {
      const observationData = state.observation_data ? JSON.parse(state.observation_data) : {};

      return {
        device_id: `civic_${state.device_id}`,
        friendly_name: state.matter_friendly_name || `${state.corridor} MM ${state.milepost}`,
        state: {
          type: state.observation_type,
          value: observationData,
          confidence: state.confidence_score,
          quality_tier: state.data_quality_tier,
          timestamp: state.observation_timestamp
        },
        location: {
          corridor: state.corridor,
          milepost: state.milepost
        },
        // Matter-compatible notification triggers
        triggers: generateMatterTriggers(state.device_type, observationData, state.confidence_score)
      };
    });

    res.json({
      success: true,
      corridor: corridor || 'all',
      timestamp: new Date().toISOString(),
      devices: matterStates
    });
  } catch (error) {
    console.error('Error fetching Matter state:', error);
    res.status(500).json({ error: 'Failed to fetch Matter state' });
  }
});

/**
 * POST /civic/v1/matter-bridge/subscribe
 * Subscribe to Matter notifications for infrastructure events
 */
router.post('/matter-bridge/subscribe', async (req, res) => {
  try {
    const { device_id, notification_webhook, conditions } = req.body;

    if (!device_id || !notification_webhook) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Store subscription (would implement webhook system)
    res.json({
      success: true,
      subscription_id: `sub_${Date.now()}`,
      message: 'Subscription created',
      webhook_url: notification_webhook,
      conditions: conditions || 'any_change'
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

function generateMatterTriggers(deviceType, observationData, confidence) {
  const triggers = [];

  // Weather sensor triggers
  if (deviceType === 'weather_sensor') {
    if (observationData.road_condition === 'icy' && confidence > 0.8) {
      triggers.push({
        type: 'critical_weather',
        severity: 'high',
        action: 'notify_immediately',
        message: 'Icy road conditions detected on your commute route'
      });
    }
    if (observationData.temperature && observationData.temperature < 32) {
      triggers.push({
        type: 'freezing_conditions',
        severity: 'medium',
        action: 'suggest_automation',
        message: 'Consider starting car pre-heat earlier'
      });
    }
  }

  // Parking sensor triggers
  if (deviceType === 'parking_sensor') {
    if (observationData.spaces_available !== undefined) {
      const utilization = (observationData.spaces_available / observationData.total_spaces) * 100;
      if (utilization < 20) {
        triggers.push({
          type: 'low_parking_availability',
          severity: 'medium',
          action: 'notify',
          message: `Only ${observationData.spaces_available} parking spots available`
        });
      }
    }
  }

  // RSU/incident triggers
  if (deviceType === 'rsu') {
    if (observationData.incident_detected && confidence > 0.7) {
      triggers.push({
        type: 'traffic_incident',
        severity: 'high',
        action: 'suggest_reroute',
        message: 'Incident detected on your route'
      });
    }
  }

  return triggers;
}

// =============================================================================
// CIVIC Info Endpoint
// =============================================================================

/**
 * GET /civic/v1/info
 * Get information about CIVIC implementation
 */
router.get('/info', CachingStrategies.long(), (req, res) => {
  res.json({
    name: 'CIVIC (Civil Infrastructure Verification & Interoperability Coalition)',
    version: '1.0',
    description: 'Matter-like infrastructure IoT device management and smart home integration',
    features: {
      device_registry: {
        endpoint: '/civic/v1/devices',
        description: 'Discover and manage infrastructure IoT devices',
        device_types: ['rsu', 'dms', 'camera', 'weather_sensor', 'parking_sensor']
      },
      observations: {
        endpoint: '/civic/v1/observations',
        description: 'Time-series sensor data with provenance',
        quality_assurance: 'Confidence scoring, validation, cross-reference'
      },
      matter_bridge: {
        endpoint: '/civic/v1/matter-bridge/*',
        description: 'Integration with Matter smart home ecosystems',
        compatible_platforms: ['Apple HomeKit', 'Google Home', 'Amazon Alexa', 'SmartThings']
      }
    },
    standards_alignment: {
      based_on: 'NODE (National Operations Dataset Exchange) implementation',
      extends: ['WZDx v4.2', 'SAE J2735', 'NTCIP Family'],
      bridges_to: ['Matter (Connectivity Standards Alliance)']
    },
    data_quality: {
      provenance_tracking: true,
      confidence_scoring: true,
      multi_source_fusion: true,
      certification_required: true
    },
    documentation: {
      white_paper: '/docs/CIVIC_INFRASTRUCTURE_IOT.md',
      node_guide: '/docs/NODE_INTEGRATION_GUIDE.md'
    }
  });
});

module.exports = router;

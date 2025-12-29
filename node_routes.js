/**
 * NODE (National Operations Dataset Exchange) API Routes
 *
 * This module implements bidirectional data exchange capabilities that align with
 * FHWA's NODE framework principles for public/private data interaction.
 */

const express = require('express');
const router = express.Router();
const db = require('./database');
const { CachingStrategies, memoize } = require('./caching');

// =============================================================================
// Middleware: API Key Authentication
// =============================================================================

/**
 * Middleware to verify API key for protected endpoints
 */
async function authenticateAPIKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Include API key in X-API-Key header or api_key query parameter'
    });
  }

  const verification = await db.verifyAPIKey(apiKey, req.path);

  if (!verification.valid) {
    return res.status(403).json({
      error: 'Invalid or expired API key',
      reason: verification.reason
    });
  }

  // Attach API key info to request for logging
  req.apiKeyInfo = verification;
  next();
}

/**
 * Middleware to log API usage
 */
function logAPIUsage(req, res, next) {
  const startTime = Date.now();

  // Intercept response to log after completion
  res.on('finish', async () => {
    const responseTime = Date.now() - startTime;
    const apiKeyId = req.apiKeyInfo ? req.apiKeyInfo.key_id : null;

    await db.logAPIUsage(
      apiKeyId,
      req.path,
      req.method,
      res.statusCode,
      responseTime,
      req.ip,
      req.get('user-agent'),
      res.statusCode >= 400 ? `HTTP ${res.statusCode}` : null
    );
  });

  next();
}

// =============================================================================
// WZDx Feed Publishing (NODE Core Feature)
// =============================================================================

/**
 * GET /api/v1/wzdx
 *
 * Publish aggregated corridor data as WZDx v4.2 feed for external consumption
 * This is the key bidirectional data exchange endpoint
 */
router.get('/wzdx',
  authenticateAPIKey,
  CachingStrategies.short(), // 60-second HTTP cache
  memoize(req => `wzdx:${req.query.corridor || 'all'}:${req.query.state || 'all'}:${req.query.bbox || 'none'}`, 60), // Server-side cache
  logAPIUsage,
  async (req, res) => {
  try {
    const { corridor, state, bbox } = req.query;

    // Get cached events with provenance metadata
    const filters = {};
    if (corridor) filters.corridor = corridor;
    if (state) filters.state_key = state.toLowerCase();
    if (bbox) {
      // TODO: Implement bounding box filtering
      // bbox format: minLon,minLat,maxLon,maxLat
    }

    const cachedEvents = await db.getCachedEvents(filters);

    // Transform to WZDx v4.2 format
    const wzdxFeed = {
      road_event_feed_info: {
        update_date: new Date().toISOString(),
        publisher: 'DOT Corridor Communicator',
        contact_name: 'NODE Integration Team',
        contact_email: 'node@corridor-communicator.org',
        version: '4.2',
        license: 'https://creativecommons.org/publicdomain/zero/1.0/',
        data_sources: [
          {
            data_source_id: 'corridor-communicator',
            organization_name: 'Multi-State Corridor Communicator',
            update_frequency: 60,
            update_date: new Date().toISOString()
          }
        ]
      },
      type: 'FeatureCollection',
      features: cachedEvents.map(event => transformToWZDx(event))
    };

    res.json(wzdxFeed);
  } catch (error) {
    console.error('Error generating WZDx feed:', error);
    res.status(500).json({ error: 'Failed to generate WZDx feed' });
  }
});

/**
 * Transform cached event to WZDx v4.2 Feature
 */
function transformToWZDx(event) {
  // If event_data already contains WZDx format, use it
  if (event.event_data && event.event_data.type === 'Feature') {
    // Enhance with provenance metadata
    return {
      ...event.event_data,
      properties: {
        ...event.event_data.properties,
        data_quality: {
          confidence_score: event.confidence_score,
          source_type: event.source_type,
          source_name: event.source_name,
          last_verified: event.last_verified
        }
      }
    };
  }

  // Otherwise, construct WZDx feature from scratch
  return {
    id: event.event_id,
    type: 'Feature',
    properties: {
      core_details: {
        event_type: event.event_type || 'incident',
        data_source_id: event.source_id,
        road_names: event.corridor ? [event.corridor] : [],
        direction: event.event_data?.direction || 'unknown'
      },
      start_date: event.start_time,
      end_date: event.end_time,
      description: event.event_data?.description,
      severity: event.severity,
      // NODE-specific metadata
      data_quality: {
        confidence_score: event.confidence_score,
        source_type: event.source_type,
        source_name: event.source_name,
        validation_status: event.validation_status,
        last_verified: event.last_verified
      }
    },
    geometry: {
      type: 'Point',
      coordinates: [event.longitude, event.latitude]
    }
  };
}

// =============================================================================
// Data Contribution Endpoints (Private Sector Integration)
// =============================================================================

/**
 * POST /api/v1/contribute/probe-data
 *
 * Accept probe data from commercial fleet operators
 */
router.post('/contribute/probe-data', authenticateAPIKey, logAPIUsage, async (req, res) => {
  try {
    const {
      vehicle_type,
      timestamp,
      location,
      speed,
      event_type, // 'hard_braking', 'sudden_stop', 'slow_traffic'
      metadata
    } = req.body;

    // Validate required fields
    if (!location || !location.lat || !location.lon) {
      return res.status(400).json({ error: 'Location coordinates required' });
    }

    // Create contribution record
    const result = await db.createContribution({
      contributor_id: req.apiKeyInfo.key_id,
      contribution_type: 'probe_data',
      data: { vehicle_type, timestamp, speed, event_type, metadata },
      latitude: location.lat,
      longitude: location.lon,
      location_accuracy_meters: location.accuracy || null,
      confidence_score: 0.4 // Commercial probe data has moderate confidence
    });

    if (result.success) {
      res.status(201).json({
        success: true,
        contribution_id: result.contribution_id,
        message: 'Probe data received and queued for validation'
      });
    } else {
      res.status(500).json({ error: 'Failed to record contribution' });
    }
  } catch (error) {
    console.error('Error accepting probe data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/contribute/incident
 *
 * Accept incident reports from external sources
 */
router.post('/contribute/incident', authenticateAPIKey, logAPIUsage, async (req, res) => {
  try {
    const {
      description,
      location,
      incident_type,
      severity,
      timestamp,
      source_confidence // How confident is the reporter?
    } = req.body;

    if (!location || !description) {
      return res.status(400).json({ error: 'Location and description required' });
    }

    const result = await db.createContribution({
      contributor_id: req.apiKeyInfo.key_id,
      contribution_type: 'incident_report',
      data: { description, incident_type, severity, timestamp, source_confidence },
      latitude: location.lat,
      longitude: location.lon,
      location_accuracy_meters: location.accuracy || null,
      confidence_score: Math.min(source_confidence || 0.3, 0.5) // Cap external confidence
    });

    if (result.success) {
      res.status(201).json({
        success: true,
        contribution_id: result.contribution_id,
        message: 'Incident report received. It will be reviewed and may appear in feeds after validation.'
      });
    } else {
      res.status(500).json({ error: 'Failed to record contribution' });
    }
  } catch (error) {
    console.error('Error accepting incident report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/contribute/parking-status
 *
 * Accept truck parking status updates from rest area operators or fleets
 */
router.post('/contribute/parking-status', authenticateAPIKey, logAPIUsage, async (req, res) => {
  try {
    const {
      facility_id,
      location,
      spaces_available,
      total_spaces,
      timestamp,
      amenities
    } = req.body;

    if (!facility_id || !location || spaces_available === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.createContribution({
      contributor_id: req.apiKeyInfo.key_id,
      contribution_type: 'parking_status',
      data: { facility_id, spaces_available, total_spaces, timestamp, amenities },
      latitude: location.lat,
      longitude: location.lon,
      confidence_score: 0.7 // Facility operators have high confidence
    });

    if (result.success) {
      res.status(201).json({
        success: true,
        contribution_id: result.contribution_id,
        message: 'Parking status updated'
      });
    } else {
      res.status(500).json({ error: 'Failed to update parking status' });
    }
  } catch (error) {
    console.error('Error accepting parking status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// API Key Management (Admin Endpoints)
// =============================================================================

/**
 * POST /api/v1/admin/api-keys
 *
 * Create a new API key (admin only)
 * TODO: Add admin authentication
 */
router.post('/admin/api-keys', async (req, res) => {
  try {
    const {
      name,
      organization,
      contact_email,
      key_type,
      tier,
      rate_limit_per_hour,
      allowed_endpoints,
      expires_in_days
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await db.createAPIKey({
      name,
      organization,
      contact_email,
      key_type: key_type || 'public',
      tier: tier || 'basic',
      rate_limit_per_hour: rate_limit_per_hour || 1000,
      allowed_endpoints: allowed_endpoints || ['*'],
      expires_in_days
    });

    if (result.success) {
      res.status(201).json({
        success: true,
        ...result,
        warning: 'Store this API key securely. It will not be shown again.'
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/admin/api-keys
 *
 * List all API keys (admin only, without revealing actual keys)
 */
router.get('/admin/api-keys', async (req, res) => {
  try {
    const keys = await db.getAllAPIKeys();
    res.json({ success: true, api_keys: keys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// Public Documentation Endpoint
// =============================================================================

/**
 * GET /api/v1/node
 *
 * NODE implementation information and capabilities
 */
router.get('/node', CachingStrategies.long(), (req, res) => {
  res.json({
    name: 'DOT Corridor Communicator NODE Implementation',
    version: '1.0.0',
    description: 'Bidirectional operational data exchange aligned with FHWA NODE framework principles',
    capabilities: {
      data_publishing: {
        wzdx_feed: {
          endpoint: '/api/v1/wzdx',
          version: '4.2',
          update_frequency_seconds: 60,
          authentication: 'api_key'
        },
        formats_supported: ['WZDx 4.2', 'GeoJSON'],
        data_types: ['work-zones', 'incidents', 'road-conditions', 'restrictions']
      },
      data_contribution: {
        probe_data: {
          endpoint: '/api/v1/contribute/probe-data',
          accepted_from: ['commercial_fleets', 'navigation_providers']
        },
        incident_reports: {
          endpoint: '/api/v1/contribute/incident',
          accepted_from: ['crowdsource', 'commercial', 'government']
        },
        parking_status: {
          endpoint: '/api/v1/contribute/parking-status',
          accepted_from: ['facility_operators', 'fleets']
        }
      },
      data_provenance: {
        confidence_scores: true,
        source_tracking: true,
        quality_validation: true
      },
      authentication: {
        method: 'API key (X-API-Key header or api_key parameter)',
        tiers: ['public', 'commercial', 'research', 'government'],
        rate_limits: {
          basic: '1,000 requests/hour',
          standard: '10,000 requests/hour',
          premium: '100,000 requests/hour',
          unlimited: 'No limit'
        }
      }
    },
    documentation: {
      getting_started: '/docs/NODE_INTEGRATION_GUIDE.md',
      api_reference: '/docs/NODE_API_REFERENCE.md',
      developer_portal: '/developer'
    },
    contact: {
      organization: 'DOT Corridor Communicator',
      email: 'node@corridor-communicator.org',
      support: 'Contact your system administrator'
    }
  });
});

module.exports = router;

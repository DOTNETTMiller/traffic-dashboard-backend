// Plugin System Service
// Handles third-party data provider integration (Inrix, Here, Waze, TomTom, etc.)

const crypto = require('crypto');

class PluginService {
  constructor(db) {
    this.db = db;
  }

  // Generate secure API key for provider
  generateApiKey(providerName) {
    const hash = crypto.randomBytes(32).toString('hex');
    return `${providerName.toLowerCase().replace(/\s+/g, '')}_live_${hash}`;
  }

  // Register new plugin provider
  async registerProvider(providerData) {
    const {
      provider_name,
      display_name,
      contact_email,
      contact_name,
      website_url,
      logo_url,
      description,
      data_types = [],
      coverage_states = [],
      status = 'trial',
      settings = {}
    } = providerData;

    // Validate required fields
    if (!provider_name || !display_name || !contact_email) {
      throw new Error('Missing required fields: provider_name, display_name, contact_email');
    }

    // Generate API key
    const apiKey = this.generateApiKey(provider_name);

    // Calculate trial expiration (30 days)
    const trialExpires = new Date();
    trialExpires.setDate(trialExpires.getDate() + 30);

    try {
      const result = await this.db.runAsync(
        `INSERT INTO plugin_providers
        (provider_name, display_name, api_key, contact_email, contact_name,
         website_url, logo_url, description, data_types, coverage_states,
         status, trial_expires_at, settings)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          provider_name,
          display_name,
          apiKey,
          contact_email,
          contact_name || null,
          website_url || null,
          logo_url || null,
          description || null,
          JSON.stringify(data_types),
          JSON.stringify(coverage_states),
          status,
          trialExpires.toISOString(),
          JSON.stringify(settings)
        ]
      );

      return {
        provider_id: result.lastID,
        api_key: apiKey,
        trial_expires_at: trialExpires.toISOString(),
        status: status
      };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        throw new Error('Provider name or API key already exists');
      }
      throw error;
    }
  }

  // Verify API key and get provider
  async verifyApiKey(apiKey) {
    const provider = await this.db.getAsync(
      `SELECT * FROM plugin_providers WHERE api_key = ? AND status IN ('active', 'trial')`,
      [apiKey]
    );

    if (!provider) {
      return null;
    }

    // Check trial expiration
    if (provider.status === 'trial' && provider.trial_expires_at) {
      const expiresAt = new Date(provider.trial_expires_at);
      if (expiresAt < new Date()) {
        await this.db.runAsync(
          `UPDATE plugin_providers SET status = 'inactive' WHERE provider_id = ?`,
          [provider.provider_id]
        );
        return null;
      }
    }

    return {
      provider_id: provider.provider_id,
      provider_name: provider.provider_name,
      display_name: provider.display_name,
      status: provider.status,
      data_types: JSON.parse(provider.data_types || '[]'),
      coverage_states: JSON.parse(provider.coverage_states || '[]')
    };
  }

  // Submit plugin event (WZDx format)
  async submitEvent(providerId, eventData) {
    const {
      feed_id,
      event_data,
      state_code,
      latitude,
      longitude,
      start_time,
      end_time,
      expires_at
    } = eventData;

    // Validate WZDx event structure
    if (!event_data || !event_data.type) {
      throw new Error('Invalid WZDx event data: missing type');
    }

    // Determine event type from WZDx data
    const eventType = event_data.type || 'unknown';

    // Extract coordinates from WZDx geometry if not provided
    let eventLat = latitude;
    let eventLon = longitude;

    if (!eventLat && event_data.geometry && event_data.geometry.coordinates) {
      const coords = event_data.geometry.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        [eventLon, eventLat] = coords; // GeoJSON uses [lon, lat]
      }
    }

    const result = await this.db.runAsync(
      `INSERT INTO plugin_events
      (provider_id, feed_id, event_data, event_type, state_code,
       latitude, longitude, start_time, end_time, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        providerId,
        feed_id || null,
        JSON.stringify(event_data),
        eventType,
        state_code || null,
        eventLat || null,
        eventLon || null,
        start_time || new Date().toISOString(),
        end_time || null,
        expires_at || null
      ]
    );

    // Track analytics
    await this.trackAnalytic(providerId, 'events_submitted', 1, state_code);

    return {
      event_id: result.lastID,
      created_at: new Date().toISOString()
    };
  }

  // Get plugin events with filtering
  async getEvents(filters = {}) {
    const {
      provider_id,
      state_code,
      event_type,
      start_date,
      end_date,
      limit = 100,
      offset = 0
    } = filters;

    let query = `SELECT
      e.event_id,
      e.provider_id,
      p.display_name as provider_name,
      e.event_data,
      e.event_type,
      e.state_code,
      e.latitude,
      e.longitude,
      e.start_time,
      e.end_time,
      e.created_at,
      e.expires_at
    FROM plugin_events e
    JOIN plugin_providers p ON e.provider_id = p.provider_id
    WHERE 1=1`;

    const params = [];

    if (provider_id) {
      query += ` AND e.provider_id = ?`;
      params.push(provider_id);
    }

    if (state_code) {
      query += ` AND e.state_code = ?`;
      params.push(state_code);
    }

    if (event_type) {
      query += ` AND e.event_type = ?`;
      params.push(event_type);
    }

    if (start_date) {
      query += ` AND e.start_time >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND e.start_time <= ?`;
      params.push(end_date);
    }

    // Don't return expired events
    query += ` AND (e.expires_at IS NULL OR e.expires_at > datetime('now'))`;

    query += ` ORDER BY e.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const events = await this.db.allAsync(query, params);

    return events.map(event => ({
      ...event,
      event_data: JSON.parse(event.event_data)
    }));
  }

  // Track analytics metric
  async trackAnalytic(providerId, metricType, metricValue, stateCode = null, metadata = null) {
    await this.db.runAsync(
      `INSERT INTO plugin_analytics
      (provider_id, metric_type, metric_value, state_code, metadata)
      VALUES (?, ?, ?, ?, ?)`,
      [
        providerId,
        metricType,
        metricValue,
        stateCode,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
  }

  // Calculate reliability score for corridor
  calculateReliabilityScore(travelTimeData) {
    if (!travelTimeData || travelTimeData.length === 0) {
      return null;
    }

    // Calculate Planning Time Index (PTI)
    const travelTimes = travelTimeData.map(d => d.travel_time);
    const freeFlowTime = Math.min(...travelTimes);
    const percentile95 = this.calculatePercentile(travelTimes, 95);
    const pti = percentile95 / freeFlowTime;

    // Calculate Buffer Time Index (BTI)
    const averageTime = travelTimes.reduce((a, b) => a + b, 0) / travelTimes.length;
    const bti = (percentile95 - averageTime) / averageTime;

    // Travel time variance
    const variance = travelTimes.reduce((sum, time) => {
      return sum + Math.pow(time - averageTime, 2);
    }, 0) / travelTimes.length;

    const travelTimeVariance = Math.sqrt(variance);

    // Reliability Score (0-100, higher is better)
    const reliabilityScore = Math.max(0, 100 - (travelTimeVariance / freeFlowTime * 100));

    return {
      reliability_score: Math.round(reliabilityScore * 10) / 10,
      planning_time_index: Math.round(pti * 100) / 100,
      buffer_time_index: Math.round(bti * 100) / 100,
      travel_time_variance: Math.round(travelTimeVariance * 10) / 10
    };
  }

  // Calculate safety score for corridor
  calculateSafetyScore(incidentData) {
    if (!incidentData || incidentData.length === 0) {
      return null;
    }

    // Incident frequency (incidents per day)
    const daysSpan = 30; // Assuming 30-day period
    const incidentFrequency = incidentData.length / daysSpan;

    // Severity weighting
    const severityWeights = {
      'minor': 1,
      'moderate': 3,
      'major': 5,
      'critical': 10
    };

    const totalSeverity = incidentData.reduce((sum, incident) => {
      const weight = severityWeights[incident.severity] || 1;
      return sum + weight;
    }, 0);

    const severityScore = totalSeverity / incidentData.length;

    // Hazard exposure time (hours)
    const totalExposureHours = incidentData.reduce((sum, incident) => {
      if (incident.start_time && incident.end_time) {
        const duration = new Date(incident.end_time) - new Date(incident.start_time);
        return sum + (duration / (1000 * 60 * 60)); // Convert to hours
      }
      return sum;
    }, 0);

    const avgExposureHours = totalExposureHours / incidentData.length;

    // Safety Score (0-100, higher is better)
    const safetyScore = Math.max(0, 100 - (
      (incidentFrequency * 0.4 * 10) +
      (severityScore * 0.35 * 5) +
      (avgExposureHours * 0.25 * 2)
    ));

    return {
      safety_score: Math.round(safetyScore * 10) / 10,
      incident_frequency: Math.round(incidentFrequency * 10) / 10,
      average_severity: Math.round(severityScore * 10) / 10,
      average_exposure_hours: Math.round(avgExposureHours * 10) / 10
    };
  }

  // Calculate congestion score
  calculateCongestionScore(speedData) {
    if (!speedData || speedData.length === 0) {
      return null;
    }

    const speeds = speedData.map(d => d.speed);
    const freeFlowSpeed = Math.max(...speeds);
    const averageSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

    // Speed reduction percentage
    const speedReduction = ((freeFlowSpeed - averageSpeed) / freeFlowSpeed) * 100;

    // Delay calculation (assuming 10-mile corridor)
    const corridorLength = 10; // miles
    const freeFlowTime = (corridorLength / freeFlowSpeed) * 60; // minutes
    const actualTime = (corridorLength / averageSpeed) * 60; // minutes
    const delayMinutes = actualTime - freeFlowTime;

    // Congestion Score (0-100, higher is better)
    const congestionScore = Math.max(0, 100 - speedReduction);

    return {
      congestion_score: Math.round(congestionScore * 10) / 10,
      speed_reduction_pct: Math.round(speedReduction * 10) / 10,
      average_delay_minutes: Math.round(delayMinutes * 10) / 10,
      average_speed: Math.round(averageSpeed * 10) / 10
    };
  }

  // Calculate data quality score
  calculateDataQualityScore(eventData) {
    if (!eventData || eventData.length === 0) {
      return null;
    }

    let wzdxCompliantCount = 0;
    let temporalAccuracySum = 0;
    let spatialAccuracySum = 0;

    eventData.forEach(event => {
      // Check WZDx compliance
      if (event.event_data && event.event_data.type && event.event_data.geometry) {
        wzdxCompliantCount++;
      }

      // Check temporal accuracy (data freshness)
      if (event.created_at) {
        const ageMinutes = (new Date() - new Date(event.created_at)) / (1000 * 60);
        const temporalScore = Math.max(0, 100 - (ageMinutes / 60 * 10)); // Degrade over 10 hours
        temporalAccuracySum += temporalScore;
      }

      // Check spatial accuracy (has valid coordinates)
      if (event.latitude && event.longitude) {
        spatialAccuracySum += 100;
      }
    });

    const wzdxCompliancePct = (wzdxCompliantCount / eventData.length) * 100;
    const temporalAccuracy = temporalAccuracySum / eventData.length;
    const spatialAccuracy = spatialAccuracySum / eventData.length;

    // Data Quality Score
    const dataQualityScore = (wzdxCompliancePct * 0.4) + (temporalAccuracy * 0.3) + (spatialAccuracy * 0.3);

    return {
      data_quality_score: Math.round(dataQualityScore * 10) / 10,
      wzdx_compliance_pct: Math.round(wzdxCompliancePct * 10) / 10,
      temporal_accuracy: Math.round(temporalAccuracy * 10) / 10,
      spatial_accuracy: Math.round(spatialAccuracy * 10) / 10
    };
  }

  // Calculate economic impact
  calculateEconomicImpact(delayData) {
    const VALUE_OF_TIME = 17.80; // USDOT value of time ($/hour)

    if (!delayData || delayData.length === 0) {
      return null;
    }

    const totalDelayHours = delayData.reduce((sum, d) => sum + d.delay_hours, 0);
    const totalVehicles = delayData.reduce((sum, d) => sum + d.vehicle_count, 0);
    const totalCost = totalDelayHours * VALUE_OF_TIME;

    return {
      total_delay_hours: Math.round(totalDelayHours),
      total_vehicles_affected: Math.round(totalVehicles),
      economic_impact_dollars: Math.round(totalCost),
      cost_per_vehicle: Math.round((totalCost / totalVehicles) * 100) / 100
    };
  }

  // Helper: Calculate percentile
  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Get corridor scores
  async getCorridorScores(corridorId, startDate, endDate) {
    // This would integrate with actual corridor data
    // For now, return a placeholder structure
    return {
      corridor_id: corridorId,
      period: {
        start: startDate,
        end: endDate
      },
      overall_score: null,
      metrics: {
        reliability: null,
        safety: null,
        congestion: null,
        data_quality: null,
        economic_impact: null
      },
      message: 'Corridor scoring requires integration with traffic data sources'
    };
  }

  // Compare providers for a corridor
  async compareProviders(corridorId, providerIds = []) {
    const query = `
      SELECT
        p.provider_id,
        p.display_name,
        COUNT(e.event_id) as event_count,
        AVG(
          CASE
            WHEN e.latitude IS NOT NULL AND e.longitude IS NOT NULL
            THEN 100 ELSE 0
          END
        ) as spatial_accuracy,
        COUNT(DISTINCT e.state_code) as state_coverage
      FROM plugin_providers p
      LEFT JOIN plugin_events e ON p.provider_id = e.provider_id
      WHERE p.status = 'active'
      ${providerIds.length > 0 ? 'AND p.provider_id IN (' + providerIds.map(() => '?').join(',') + ')' : ''}
      GROUP BY p.provider_id, p.display_name
      ORDER BY event_count DESC
    `;

    const providers = await this.db.allAsync(query, providerIds);

    return {
      corridor_id: corridorId,
      providers: providers.map(p => ({
        provider_id: p.provider_id,
        display_name: p.display_name,
        event_count: p.event_count || 0,
        spatial_accuracy: Math.round((p.spatial_accuracy || 0) * 10) / 10,
        state_coverage: p.state_coverage || 0
      }))
    };
  }
}

module.exports = PluginService;

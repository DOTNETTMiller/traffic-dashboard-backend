/**
 * RWIS (Road Weather Information System) Sensor Service
 *
 * ARC-IT Service Package: WX02 - Weather Information Processing and Distribution
 * ARC-IT Physical Object: Roadway Subsystem (Environmental Sensor Stations)
 *
 * Collects RWIS data, detects hazardous conditions, triggers V2X warnings
 */

const EventEmitter = require('events');
const axios = require('axios');
const db = require('../database');

class RWISSensorService extends EventEmitter {
  constructor() {
    super();
    this.pollingIntervalId = null;
    this.sensors = new Map();
  }

  /**
   * Start RWIS sensor monitoring
   */
  async start() {
    console.log('🌡️ Starting RWIS Sensor Service...');

    // Load sensor inventory
    await this.loadSensors();

    if (this.sensors.size === 0) {
      console.log('   ⚠️  No RWIS sensors configured');
      console.log('   💡 Add sensors to sensor_inventory table with type="rwis"');
      return;
    }

    console.log(`   ✓ Loaded ${this.sensors.size} RWIS sensors`);

    // Start polling
    this.startPolling();

    this.emit('started');
  }

  /**
   * Load RWIS sensors from database
   */
  async loadSensors() {
    try {
      const sensors = await db.db.prepare(`
        SELECT *
        FROM sensor_inventory
        WHERE sensor_type = 'rwis'
          AND status = 'active'
      `).all();

      sensors.forEach(sensor => {
        this.sensors.set(sensor.sensor_id, sensor);
      });

    } catch (error) {
      console.error('Error loading RWIS sensors:', error.message);
    }
  }

  /**
   * Start polling sensors
   */
  startPolling() {
    // Poll every 5 minutes (configurable per sensor)
    const defaultInterval = 5 * 60 * 1000;

    this.pollingIntervalId = setInterval(async () => {
      await this.pollAllSensors();
    }, defaultInterval);

    // Initial poll
    this.pollAllSensors();

    console.log('   ✓ Started sensor polling (every 5 minutes)');
  }

  /**
   * Poll all active RWIS sensors
   */
  async pollAllSensors() {
    console.log('📡 Polling RWIS sensors...');

    for (const [sensorId, sensor] of this.sensors) {
      try {
        await this.pollSensor(sensor);
      } catch (error) {
        console.error(`❌ Error polling ${sensorId}:`, error.message);
        await this.recordFailure(sensor);
      }
    }
  }

  /**
   * Poll individual sensor
   */
  async pollSensor(sensor) {
    if (!sensor.data_feed_url) {
      console.log(`   ⚠️  ${sensor.sensor_id}: No data feed URL configured`);
      return;
    }

    // Fetch sensor data
    const response = await axios.get(sensor.data_feed_url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'DOT-Corridor-Communicator/1.0'
      }
    });

    const sensorData = this.parseSensorData(response.data, sensor);

    // Store reading
    await this.storeReading(sensor.sensor_id, sensorData);

    // Analyze for warnings
    await this.analyzeReading(sensor, sensorData);

    console.log(`   ✓ ${sensor.sensor_id}: ${sensorData.pavement_temperature}°F, ` +
                `friction: ${sensorData.pavement_friction?.toFixed(2) || 'N/A'}`);
  }

  /**
   * Parse sensor data (override this based on your data format)
   */
  parseSensorData(rawData, sensor) {
    // Example parser - adapt to your RWIS data format
    // Common formats: NTCIP 1204, RWIS XML, custom JSON

    if (typeof rawData === 'string') {
      rawData = JSON.parse(rawData);
    }

    return {
      air_temperature: rawData.airTemp || rawData.air_temperature,
      dew_point: rawData.dewPoint || rawData.dew_point,
      relative_humidity: rawData.humidity || rawData.relative_humidity,

      precipitation_rate: rawData.precipRate || rawData.precipitation_rate || 0,
      precipitation_type: rawData.precipType || rawData.precipitation_type || 'none',

      pavement_temperature: rawData.surfaceTemp || rawData.pavement_temperature,
      subsurface_temperature: rawData.subTemp || rawData.subsurface_temperature,
      pavement_condition: rawData.surfaceCondition || rawData.pavement_condition || 'unknown',
      pavement_friction: rawData.friction || rawData.pavement_friction,

      visibility: rawData.visibility,
      fog: rawData.fog || false,

      wind_speed: rawData.windSpeed || rawData.wind_speed,
      wind_direction: rawData.windDir || rawData.wind_direction,
      wind_gust: rawData.windGust || rawData.wind_gust,

      freeze_point: rawData.freezePoint || 32
    };
  }

  /**
   * Store sensor reading in database
   */
  async storeReading(sensorId, reading) {
    const warningLevel = this.calculateWarningLevel(reading);
    const blackIceProbability = this.calculateBlackIceProbability(reading);

    await db.runAsync(`
      INSERT INTO rwis_readings (
        sensor_id, reading_timestamp,
        air_temperature, dew_point, relative_humidity,
        precipitation_rate, precipitation_type,
        pavement_temperature, subsurface_temperature,
        pavement_condition, pavement_friction, freeze_point,
        visibility, fog,
        wind_speed, wind_direction, wind_gust,
        black_ice_probability, warning_level,
        data_quality
      ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sensorId,
      reading.air_temperature,
      reading.dew_point,
      reading.relative_humidity,
      reading.precipitation_rate,
      reading.precipitation_type,
      reading.pavement_temperature,
      reading.subsurface_temperature,
      reading.pavement_condition,
      reading.pavement_friction,
      reading.freeze_point,
      reading.visibility,
      reading.fog ? 1 : 0,
      reading.wind_speed,
      reading.wind_direction,
      reading.wind_gust,
      blackIceProbability,
      warningLevel,
      'good'
    ]);

    // Update sensor last_reading timestamp
    await db.runAsync(`
      UPDATE sensor_inventory
      SET last_reading = datetime('now'),
          last_contact = datetime('now')
      WHERE sensor_id = ?
    `, [sensorId]);
  }

  /**
   * Analyze reading for warning conditions
   */
  async analyzeReading(sensor, reading) {
    const warnings = [];

    // Ice conditions
    if (reading.pavement_temperature <= 32 && reading.pavement_condition !== 'dry') {
      warnings.push({
        type: 'ice',
        severity: reading.pavement_temperature <= 28 ? 6 : 5,
        condition: 'Ice on roadway',
        description: `Pavement temp: ${reading.pavement_temperature}°F, ` +
                    `condition: ${reading.pavement_condition}`
      });
    }

    // Black ice risk
    const blackIceProb = this.calculateBlackIceProbability(reading);
    if (blackIceProb > 0.7) {
      warnings.push({
        type: 'black_ice',
        severity: 6,
        condition: 'High black ice probability',
        description: `Black ice probability: ${(blackIceProb * 100).toFixed(0)}%`
      });
    }

    // Low friction
    if (reading.pavement_friction && reading.pavement_friction < 0.4) {
      warnings.push({
        type: 'slippery',
        severity: 5,
        condition: 'Slippery roadway',
        description: `Friction coefficient: ${reading.pavement_friction.toFixed(2)}`
      });
    }

    // Low visibility
    if (reading.visibility && reading.visibility < 500) {
      warnings.push({
        type: 'low_visibility',
        severity: reading.visibility < 250 ? 5 : 4,
        condition: 'Low visibility',
        description: `Visibility: ${reading.visibility} feet`
      });
    }

    // Fog
    if (reading.fog) {
      warnings.push({
        type: 'fog',
        severity: 4,
        condition: 'Fog',
        description: 'Fog detected'
      });
    }

    // High winds
    if (reading.wind_speed && reading.wind_speed > 40) {
      warnings.push({
        type: 'high_winds',
        severity: reading.wind_speed > 55 ? 5 : 4,
        condition: 'High winds',
        description: `Wind speed: ${reading.wind_speed} mph`
      });
    }

    // Heavy snow
    if (reading.precipitation_type === 'snow' && reading.precipitation_rate > 0.5) {
      warnings.push({
        type: 'heavy_snow',
        severity: 5,
        condition: 'Heavy snow',
        description: `Snow rate: ${reading.precipitation_rate} in/hr`
      });
    }

    // Create sensor alerts and emit V2X warnings
    for (const warning of warnings) {
      await this.createAlert(sensor, warning, reading);
      this.emit('warning-detected', { sensor, warning, reading });
    }
  }

  /**
   * Calculate black ice probability
   */
  calculateBlackIceProbability(reading) {
    let probability = 0;

    // Pavement temp near or below freezing
    if (reading.pavement_temperature <= 32) {
      probability += 0.4;

      // Below 28°F - high risk
      if (reading.pavement_temperature <= 28) {
        probability += 0.2;
      }
    }

    // Dew point close to pavement temp (frost point)
    if (reading.dew_point && reading.pavement_temperature) {
      const spread = Math.abs(reading.pavement_temperature - reading.dew_point);
      if (spread < 5) {
        probability += 0.3;
      }
    }

    // Recent precipitation
    if (reading.pavement_condition === 'wet' || reading.pavement_condition === 'slush') {
      probability += 0.2;
    }

    // Clear/calm conditions (radiational cooling)
    if (reading.wind_speed < 5 && !reading.precipitation_rate) {
      probability += 0.1;
    }

    return Math.min(probability, 1.0);
  }

  /**
   * Calculate warning level
   */
  calculateWarningLevel(reading) {
    let maxLevel = 0;

    // Ice conditions
    if (reading.pavement_temperature <= 32) maxLevel = Math.max(maxLevel, 2);
    if (reading.pavement_temperature <= 28) maxLevel = Math.max(maxLevel, 3);

    // Low friction
    if (reading.pavement_friction && reading.pavement_friction < 0.4) {
      maxLevel = Math.max(maxLevel, 2);
    }
    if (reading.pavement_friction && reading.pavement_friction < 0.3) {
      maxLevel = Math.max(maxLevel, 3);
    }

    // Visibility
    if (reading.visibility < 500) maxLevel = Math.max(maxLevel, 2);
    if (reading.visibility < 250) maxLevel = Math.max(maxLevel, 3);

    // Wind
    if (reading.wind_speed > 40) maxLevel = Math.max(maxLevel, 2);
    if (reading.wind_speed > 55) maxLevel = Math.max(maxLevel, 3);

    return maxLevel;
  }

  /**
   * Create sensor alert
   */
  async createAlert(sensor, warning, reading) {
    // Check if similar alert already active
    const existing = await db.db.prepare(`
      SELECT id FROM sensor_alerts
      WHERE sensor_id = ?
        AND alert_type = ?
        AND status = 'active'
        AND started_at > datetime('now', '-30 minutes')
    `).get(sensor.sensor_id, warning.type);

    if (existing) {
      // Update existing alert
      await db.runAsync(`
        UPDATE sensor_alerts
        SET updated_at = datetime('now'),
            severity = ?
        WHERE id = ?
      `, [warning.severity, existing.id]);

      return;
    }

    // Create new alert
    await db.runAsync(`
      INSERT INTO sensor_alerts (
        sensor_id, alert_type, severity,
        condition, description,
        latitude, longitude, roadway, milepost,
        started_at, expires_at,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+2 hours'), 'active')
    `, [
      sensor.sensor_id,
      warning.type,
      warning.severity,
      warning.condition,
      warning.description,
      sensor.latitude,
      sensor.longitude,
      sensor.roadway,
      sensor.milepost
    ]);

    console.log(`   ⚠️  Alert created: ${warning.condition} at ${sensor.sensor_name}`);
  }

  /**
   * Record sensor failure
   */
  async recordFailure(sensor) {
    await db.runAsync(`
      UPDATE sensor_inventory
      SET last_contact = datetime('now')
      WHERE sensor_id = ?
    `, [sensor.sensor_id]);
  }

  /**
   * Get active warnings
   */
  async getActiveWarnings() {
    return await db.db.prepare(`
      SELECT sa.*, si.sensor_name, si.location_description
      FROM sensor_alerts sa
      JOIN sensor_inventory si ON sa.sensor_id = si.sensor_id
      WHERE sa.status = 'active'
        AND sa.expires_at > datetime('now')
      ORDER BY sa.severity DESC, sa.started_at DESC
    `).all();
  }

  /**
   * Stop service
   */
  stop() {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    console.log('🛑 RWIS Sensor Service stopped');
  }
}

// Export singleton
const rwisSensorService = new RWISSensorService();

module.exports = {
  rwisSensorService,
  RWISSensorService
};

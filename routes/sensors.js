/**
 * Sensor API Routes
 *
 * Manage sensor inventory, readings, and alerts
 * ARC-IT: Roadway Subsystem data access
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { rwisSensorService } = require('../services/rwis-sensor-service');
const { sensorIntegrationService } = require('../services/sensor-integration-service');

/**
 * GET /api/sensors - Get all sensors
 */
router.get('/', async (req, res) => {
  try {
    const { type, status } = req.query;

    let query = 'SELECT * FROM sensor_inventory WHERE 1=1';
    const params = [];

    if (type) {
      query += ' AND sensor_type = ?';
      params.push(type);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY roadway, milepost';

    const sensors = await db.db.prepare(query).all(...params);

    res.json(sensors);
  } catch (error) {
    console.error('Error fetching sensors:', error);
    res.status(500).json({ error: 'Failed to fetch sensors' });
  }
});

/**
 * POST /api/sensors - Add new sensor
 */
router.post('/', async (req, res) => {
  try {
    const {
      sensor_id, sensor_name, sensor_type,
      latitude, longitude, elevation,
      roadway, direction, milepost, location_description,
      manufacturer, model, serial_number,
      ip_address, data_feed_url, polling_interval,
      capabilities, owner, contact_email, notes
    } = req.body;

    if (!sensor_id || !sensor_type || !latitude || !longitude) {
      return res.status(400).json({
        error: 'sensor_id, sensor_type, latitude, and longitude are required'
      });
    }

    await db.runAsync(`
      INSERT INTO sensor_inventory (
        sensor_id, sensor_name, sensor_type,
        latitude, longitude, elevation,
        roadway, direction, milepost, location_description,
        manufacturer, model, serial_number,
        ip_address, data_feed_url, polling_interval,
        capabilities, owner, contact_email, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sensor_id, sensor_name, sensor_type,
      latitude, longitude, elevation,
      roadway, direction, milepost, location_description,
      manufacturer, model, serial_number,
      ip_address, data_feed_url, polling_interval || 300,
      JSON.stringify(capabilities || {}),
      owner, contact_email, notes
    ]);

    res.json({ success: true, message: 'Sensor added successfully' });
  } catch (error) {
    console.error('Error adding sensor:', error);
    res.status(500).json({ error: 'Failed to add sensor' });
  }
});

/**
 * GET /api/sensors/readings/rwis/:sensorId - Get RWIS readings
 */
router.get('/readings/rwis/:sensorId', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { limit = 100 } = req.query;

    const readings = await db.db.prepare(`
      SELECT *
      FROM rwis_readings
      WHERE sensor_id = ?
      ORDER BY reading_timestamp DESC
      LIMIT ?
    `).all(sensorId, parseInt(limit));

    res.json(readings);
  } catch (error) {
    console.error('Error fetching RWIS readings:', error);
    res.status(500).json({ error: 'Failed to fetch readings' });
  }
});

/**
 * GET /api/sensors/readings/latest - Get latest reading from all sensors
 */
router.get('/readings/latest', async (req, res) => {
  try {
    const { type } = req.query;

    let table = 'rwis_readings';
    if (type === 'traffic') table = 'traffic_readings';
    if (type === 'bridge') table = 'bridge_readings';

    const readings = await db.db.prepare(`
      SELECT r.*, s.sensor_name, s.roadway, s.milepost, s.location_description
      FROM ${table} r
      JOIN sensor_inventory s ON r.sensor_id = s.sensor_id
      WHERE r.reading_timestamp = (
        SELECT MAX(reading_timestamp)
        FROM ${table} r2
        WHERE r2.sensor_id = r.sensor_id
      )
      ORDER BY s.roadway, s.milepost
    `).all();

    res.json(readings);
  } catch (error) {
    console.error('Error fetching latest readings:', error);
    res.status(500).json({ error: 'Failed to fetch latest readings' });
  }
});

/**
 * GET /api/sensors/alerts - Get sensor alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const { status = 'active', severity } = req.query;

    let query = `
      SELECT sa.*, si.sensor_name, si.roadway, si.milepost, si.location_description
      FROM sensor_alerts sa
      JOIN sensor_inventory si ON sa.sensor_id = si.sensor_id
      WHERE sa.status = ?
    `;
    const params = [status];

    if (severity) {
      query += ' AND sa.severity >= ?';
      params.push(parseInt(severity));
    }

    query += ' ORDER BY sa.severity DESC, sa.started_at DESC';

    const alerts = await db.db.prepare(query).all(...params);

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * GET /api/sensors/dashboard - Get sensor dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Ensure database is initialized
    await db.init();

    // Total sensors by type
    const sensorsByType = await db.all(`
      SELECT sensor_type, COUNT(*) as count
      FROM sensor_inventory
      GROUP BY sensor_type
    `, []);

    // Active warnings
    const activeWarnings = await db.all(`
      SELECT alert_type, severity, COUNT(*) as count
      FROM sensor_alerts
      WHERE status = 'active'
      GROUP BY alert_type, severity
      ORDER BY severity DESC
    `, []);

    // Sensor health
    const healthSummary = await db.all(`
      SELECT
        status,
        COUNT(*) as count
      FROM sensor_inventory
      GROUP BY status
    `, []);

    // Recent critical readings (PostgreSQL compatible datetime)
    const criticalReadings = await db.all(`
      SELECT r.*, s.sensor_name, s.roadway, s.location_description
      FROM rwis_readings r
      JOIN sensor_inventory s ON r.sensor_id = s.sensor_id
      WHERE r.warning_level >= 2
        AND r.reading_timestamp::timestamp > NOW() - INTERVAL '1 hour'
      ORDER BY r.warning_level DESC, r.reading_timestamp DESC
      LIMIT 10
    `, []);

    // Calculate summary statistics
    const totalSensors = sensorsByType.reduce((sum, type) => sum + parseInt(type.count), 0);
    const activeSensors = healthSummary.find(h => h.status === 'active')?.count || 0;
    const activeAlerts = activeWarnings.reduce((sum, alert) => sum + parseInt(alert.count), 0);
    const criticalAlerts = activeWarnings.filter(a => a.severity === 'critical').reduce((sum, a) => sum + parseInt(a.count), 0);

    // Get TIM broadcast count from last 24h (PostgreSQL compatible)
    // Gracefully handle if table doesn't exist yet
    let timBroadcasts24h = { count: 0 };
    try {
      const timResult = await db.all(`
        SELECT COUNT(*) as count
        FROM tim_broadcast_log
        WHERE created_at::timestamp > NOW() - INTERVAL '24 hours'
      `, []);
      timBroadcasts24h = timResult[0] || { count: 0 };
    } catch (err) {
      console.log('TIM broadcast log table not yet created:', err.message);
    }

    // Get recent readings count (PostgreSQL compatible)
    let recentReadingsCount = { count: 0 };
    try {
      const readingsResult = await db.all(`
        SELECT COUNT(*) as count
        FROM rwis_readings
        WHERE reading_timestamp::timestamp > NOW() - INTERVAL '1 hour'
      `, []);
      recentReadingsCount = readingsResult[0] || { count: 0 };
    } catch (err) {
      console.log('RWIS readings table query error:', err.message);
    }

    // Get recent alerts for dashboard
    const recentAlerts = await db.all(`
      SELECT sa.*, si.sensor_name, si.roadway, si.milepost
      FROM sensor_alerts sa
      JOIN sensor_inventory si ON sa.sensor_id = si.sensor_id
      WHERE sa.status = 'active'
      ORDER BY sa.started_at DESC
      LIMIT 5
    `, []);

    res.json({
      summary: {
        total_sensors: totalSensors,
        active_sensors: parseInt(activeSensors) || 0,
        active_alerts: activeAlerts,
        critical_alerts: criticalAlerts,
        tim_broadcasts_24h: parseInt(timBroadcasts24h.count) || 0,
        recent_readings: parseInt(recentReadingsCount.count) || 0
      },
      sensor_types: sensorsByType,
      active_warnings: activeWarnings,
      health_summary: healthSummary,
      critical_readings: criticalReadings,
      recent_alerts: recentAlerts
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /api/sensors/status - Get sensor service status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await sensorIntegrationService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

/**
 * POST /api/sensors/poll - Manually trigger sensor poll
 */
router.post('/poll', async (req, res) => {
  try {
    // Trigger immediate poll
    rwisSensorService.pollAllSensors().catch(err => {
      console.error('Error in manual poll:', err);
    });

    res.json({
      success: true,
      message: 'Sensor poll triggered'
    });
  } catch (error) {
    console.error('Error triggering poll:', error);
    res.status(500).json({ error: 'Failed to trigger poll' });
  }
});

/**
 * POST /api/sensors/initialize - Manually initialize sensor system
 * (One-time setup for production deployment)
 */
router.post('/initialize', async (req, res) => {
  try {
    console.log('\n🛰️  Manual sensor initialization requested...\n');

    const { initVolumeData } = require('../scripts/init_volume_data');
    await initVolumeData();

    console.log('\n✅ Sensor initialization complete!\n');

    // Get sensor count
    const sensors = await db.all('SELECT COUNT(*) as count FROM sensor_inventory', []);
    const sensorCount = sensors[0]?.count || 0;

    res.json({
      success: true,
      message: 'Sensor system initialized successfully',
      sensors_loaded: sensorCount
    });
  } catch (error) {
    console.error('❌ Sensor initialization failed:', error);
    res.status(500).json({
      error: 'Failed to initialize sensors',
      details: error.message
    });
  }
});

module.exports = router;

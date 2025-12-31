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
    // Total sensors by type
    const sensorsByType = await db.db.prepare(`
      SELECT sensor_type, COUNT(*) as count
      FROM sensor_inventory
      GROUP BY sensor_type
    `).all();

    // Active warnings
    const activeWarnings = await db.db.prepare(`
      SELECT alert_type, severity, COUNT(*) as count
      FROM sensor_alerts
      WHERE status = 'active'
      GROUP BY alert_type, severity
      ORDER BY severity DESC
    `).all();

    // Sensor health
    const healthSummary = await db.db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM sensor_inventory
      GROUP BY status
    `).all();

    // Recent critical readings
    const criticalReadings = await db.db.prepare(`
      SELECT r.*, s.sensor_name, s.roadway, s.location_description
      FROM rwis_readings r
      JOIN sensor_inventory s ON r.sensor_id = s.sensor_id
      WHERE r.warning_level >= 2
        AND r.reading_timestamp > datetime('now', '-1 hour')
      ORDER BY r.warning_level DESC, r.reading_timestamp DESC
      LIMIT 10
    `).all();

    res.json({
      sensors_by_type: sensorsByType,
      active_warnings: activeWarnings,
      health_summary: healthSummary,
      critical_readings: criticalReadings
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

module.exports = router;

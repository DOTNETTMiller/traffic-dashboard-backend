/**
 * V2X API Routes
 * Endpoints for receiving and serving V2X data from ODE
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * POST /api/v2x/bsm
 * Receive Basic Safety Message from V2X consumer
 */
router.post('/bsm', async (req, res) => {
  try {
    const {
      timestamp,
      temporaryId,
      latitude,
      longitude,
      elevation,
      speed,
      heading,
      accuracy,
      transmission,
      brakeStatus,
      vehicleSize
    } = req.body;

    // Insert BSM data
    await db.runAsync(`
      INSERT OR REPLACE INTO v2x_bsm (
        timestamp, temporary_id, latitude, longitude, elevation,
        speed, heading, accuracy_semi_major, accuracy_semi_minor,
        transmission, brake_status, vehicle_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      timestamp,
      temporaryId,
      latitude,
      longitude,
      elevation,
      speed,
      heading,
      accuracy?.semiMajor,
      accuracy?.semiMinor,
      transmission,
      JSON.stringify(brakeStatus),
      JSON.stringify(vehicleSize)
    ]);

    // Update statistics
    await updateStatistics('BSM');

    res.json({ success: true, message: 'BSM stored successfully' });
  } catch (error) {
    console.error('Error storing BSM:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v2x/tim
 * Receive Traveler Information Message from V2X consumer
 */
router.post('/tim', async (req, res) => {
  try {
    const {
      timestamp,
      msgId,
      frameType,
      startTime,
      durationTime,
      priority,
      regions,
      content,
      sspTimRights
    } = req.body;

    await db.runAsync(`
      INSERT OR REPLACE INTO v2x_tim (
        timestamp, msg_id, frame_type, start_time, duration_time,
        priority, regions, content, ssp_tim_rights
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      timestamp,
      msgId,
      frameType,
      startTime,
      durationTime,
      priority,
      JSON.stringify(regions),
      JSON.stringify(content),
      sspTimRights
    ]);

    await updateStatistics('TIM');

    res.json({ success: true, message: 'TIM stored successfully' });
  } catch (error) {
    console.error('Error storing TIM:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v2x/spat
 * Receive Signal Phase and Timing from V2X consumer
 */
router.post('/spat', async (req, res) => {
  try {
    const {
      timestamp,
      intersectionId,
      status,
      moy,
      timeStamp,
      states
    } = req.body;

    await db.runAsync(`
      INSERT INTO v2x_spat (
        timestamp, intersection_id, status, moy, time_stamp, states
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      timestamp,
      intersectionId,
      JSON.stringify(status),
      moy,
      timeStamp,
      JSON.stringify(states)
    ]);

    await updateStatistics('SPaT');

    res.json({ success: true, message: 'SPaT stored successfully' });
  } catch (error) {
    console.error('Error storing SPaT:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v2x/map
 * Receive MAP data from V2X consumer
 */
router.post('/map', async (req, res) => {
  try {
    const {
      timestamp,
      intersectionId,
      refPoint,
      laneWidth,
      speedLimits,
      laneSet
    } = req.body;

    await db.runAsync(`
      INSERT OR REPLACE INTO v2x_map (
        timestamp, intersection_id, ref_point, lane_width, speed_limits, lane_set
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      timestamp,
      intersectionId,
      JSON.stringify(refPoint),
      laneWidth,
      JSON.stringify(speedLimits),
      JSON.stringify(laneSet)
    ]);

    await updateStatistics('MAP');

    res.json({ success: true, message: 'MAP stored successfully' });
  } catch (error) {
    console.error('Error storing MAP:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v2x/bsm
 * Retrieve Basic Safety Messages
 */
router.get('/bsm', async (req, res) => {
  try {
    const { limit = 100, since } = req.query;

    let query = 'SELECT * FROM v2x_bsm';
    const params = [];

    if (since) {
      query += ' WHERE timestamp > ?';
      params.push(since);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    const messages = await db.allAsync(query, params);

    res.json({
      success: true,
      count: messages.length,
      messages: messages.map(msg => ({
        ...msg,
        brakeStatus: safeJsonParse(msg.brake_status),
        vehicleSize: safeJsonParse(msg.vehicle_size)
      }))
    });
  } catch (error) {
    console.error('Error retrieving BSM:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v2x/tim
 * Retrieve Traveler Information Messages
 */
router.get('/tim', async (req, res) => {
  try {
    const { limit = 50, active = 'true' } = req.query;

    let query = 'SELECT * FROM v2x_tim';

    if (active === 'true') {
      query += ` WHERE datetime(start_time, '+' || duration_time || ' minutes') > datetime('now')`;
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';

    const messages = await db.allAsync(query, [parseInt(limit)]);

    res.json({
      success: true,
      count: messages.length,
      messages: messages.map(msg => ({
        ...msg,
        regions: safeJsonParse(msg.regions),
        content: safeJsonParse(msg.content)
      }))
    });
  } catch (error) {
    console.error('Error retrieving TIM:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v2x/spat/:intersectionId
 * Get latest SPaT data for an intersection
 */
router.get('/spat/:intersectionId', async (req, res) => {
  try {
    const { intersectionId } = req.params;

    const spat = await db.getAsync(`
      SELECT * FROM v2x_spat
      WHERE intersection_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `, [intersectionId]);

    if (!spat) {
      return res.status(404).json({
        success: false,
        error: 'No SPaT data found for this intersection'
      });
    }

    res.json({
      success: true,
      spat: {
        ...spat,
        status: safeJsonParse(spat.status),
        states: safeJsonParse(spat.states)
      }
    });
  } catch (error) {
    console.error('Error retrieving SPaT:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v2x/map/:intersectionId
 * Get MAP data for an intersection
 */
router.get('/map/:intersectionId', async (req, res) => {
  try {
    const { intersectionId } = req.params;

    const map = await db.getAsync(`
      SELECT * FROM v2x_map
      WHERE intersection_id = ?
    `, [intersectionId]);

    if (!map) {
      return res.status(404).json({
        success: false,
        error: 'No MAP data found for this intersection'
      });
    }

    res.json({
      success: true,
      map: {
        ...map,
        refPoint: safeJsonParse(map.ref_point),
        speedLimits: safeJsonParse(map.speed_limits),
        laneSet: safeJsonParse(map.lane_set)
      }
    });
  } catch (error) {
    console.error('Error retrieving MAP:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v2x/statistics
 * Get V2X message statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = await db.allAsync(`
      SELECT * FROM v2x_statistics
      ORDER BY message_type
    `);

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Error retrieving statistics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v2x/bsm/heatmap
 * Get BSM data for heatmap visualization
 */
router.get('/bsm/heatmap', async (req, res) => {
  try {
    const { since, limit = 1000 } = req.query;

    let query = 'SELECT latitude, longitude, speed FROM v2x_bsm';
    const params = [];

    if (since) {
      query += ' WHERE timestamp > ?';
      params.push(since);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    const points = await db.allAsync(query, params);

    res.json({
      success: true,
      count: points.length,
      points
    });
  } catch (error) {
    console.error('Error retrieving BSM heatmap:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper function to update message statistics
 */
async function updateStatistics(messageType) {
  await db.runAsync(`
    INSERT INTO v2x_statistics (message_type, count, last_received, first_received, updated_at)
    VALUES (?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(message_type) DO UPDATE SET
      count = count + 1,
      last_received = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `, [messageType]);
}

/**
 * Helper function to safely parse JSON
 */
function safeJsonParse(jsonString) {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return jsonString;
  }
}

module.exports = router;

/**
 * Unified Sensor Integration Service
 *
 * Integrates RWIS, traffic, and bridge sensors with V2X Warning Service
 * Monitors sensor data and automatically generates TIM messages for hazardous conditions
 *
 * ARC-IT Service Packages:
 * - WX02: Weather Information Processing and Distribution
 * - TM01: Infrastructure-Based Traffic Surveillance
 * - TM22: Dynamic Roadway Warning
 */

const EventEmitter = require('events');
const { rwisSensorService } = require('./rwis-sensor-service');
const { v2xWarningService } = require('./v2x-warning-service');
const db = require('../database');

class SensorIntegrationService extends EventEmitter {
  constructor() {
    super();
    this.services = [];
  }

  /**
   * Start all sensor services and V2X integration
   */
  async start() {
    console.log('\n🔧 Starting Sensor Integration Service...\n');

    // Start RWIS service
    await rwisSensorService.start();
    this.services.push(rwisSensorService);

    // Connect RWIS warnings to V2X
    this.connectRWISToV2X();

    // Start V2X warning service (if not already started)
    if (!v2xWarningService.enabled && v2xWarningService.getStatus) {
      await v2xWarningService.start();
    }

    console.log('\n✅ Sensor Integration Service started\n');
    this.emit('started');
  }

  /**
   * Connect RWIS sensor warnings to V2X broadcast
   */
  connectRWISToV2X() {
    rwisSensorService.on('warning-detected', async ({ sensor, warning, reading }) => {
      console.log(`🚨 RWIS Warning: ${warning.condition} at ${sensor.sensor_name}`);

      // Get sensor location
      const sensorLocation = {
        id: sensor.sensor_id,
        name: sensor.sensor_name,
        latitude: sensor.latitude,
        longitude: sensor.longitude,
        roadway: sensor.roadway,
        milepost: sensor.milepost
      };

      // Prepare sensor data for V2X
      const sensorData = {
        type: 'rwis',
        ...reading,
        warning_type: warning.type
      };

      // Trigger V2X broadcast
      try {
        await v2xWarningService.processSensorData(sensorData, sensorLocation);

        // Mark alert as TIM generated
        await this.markAlertBroadcast(sensor.sensor_id, warning.type);

      } catch (error) {
        console.error('❌ Error generating V2X warning:', error);
      }
    });

    console.log('   ✓ Connected RWIS warnings to V2X broadcast');
  }

  /**
   * Mark sensor alert as broadcast via TIM
   */
  async markAlertBroadcast(sensorId, alertType) {
    await db.runAsync(`
      UPDATE sensor_alerts
      SET tim_generated = 1
      WHERE sensor_id = ?
        AND alert_type = ?
        AND status = 'active'
    `, [sensorId, alertType]);
  }

  /**
   * Get integration status
   */
  async getStatus() {
    // Get sensor counts
    const sensorCounts = await db.db.prepare(`
      SELECT
        sensor_type,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
      FROM sensor_inventory
      GROUP BY sensor_type
    `).all();

    // Get active warnings
    const activeWarnings = await db.db.prepare(`
      SELECT COUNT(*) as count
      FROM sensor_alerts
      WHERE status = 'active'
    `).get();

    // Get TIM broadcast stats
    const timStats = await db.db.prepare(`
      SELECT COUNT(*) as count
      FROM sensor_alerts
      WHERE tim_generated = 1
        AND started_at > datetime('now', '-24 hours')
    `).get();

    return {
      sensors: sensorCounts,
      active_warnings: activeWarnings.count,
      tims_generated_24h: timStats.count,
      v2x_status: v2xWarningService.getStatus()
    };
  }

  /**
   * Stop all services
   */
  stop() {
    this.services.forEach(service => {
      if (service.stop) service.stop();
    });
    console.log('🛑 Sensor Integration Service stopped');
  }
}

// Export singleton
const sensorIntegrationService = new SensorIntegrationService();

module.exports = {
  sensorIntegrationService,
  SensorIntegrationService
};

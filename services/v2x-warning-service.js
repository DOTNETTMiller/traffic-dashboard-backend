/**
 * V2X Warning Service
 *
 * ARC-IT Service Package Implementation:
 * - TM22: Dynamic Roadway Warning (V2I via RSU)
 * - TM18: Roadway Warning
 * - WZ05: Work Zone Traveler Information
 * - WX02: Weather Information Processing and Distribution
 * - TM08: Traffic Incident Management System
 *
 * Integrates sensors, events, and work zones to generate
 * automated V2X warnings via RSU broadcast
 */

const EventEmitter = require('events');
const { timGenerator } = require('../utils/tim-generator');
const { rsuManager } = require('../utils/rsu-manager');
const db = require('../database');

class V2XWarningService extends EventEmitter {
  constructor() {
    super();
    this.enabled = false;
    this.activeWarnings = new Map(); // packetID -> warning metadata
  }

  /**
   * Start the V2X warning service
   */
  async start() {
    console.log('📡 Starting V2X Warning Service...');

    // Check ODE connectivity
    const odeStatus = await rsuManager.checkODEConnection();
    if (!odeStatus.connected) {
      console.log(`   ⚠️  ODE not connected (${odeStatus.error})`);
      console.log('   💡 Set ODE_BASE_URL environment variable to enable RSU broadcasts');
      this.enabled = false;
    } else {
      console.log(`   ✅ Connected to ODE: ${odeStatus.odeUrl}`);
      this.enabled = true;
    }

    console.log('   📋 ARC-IT Service Packages:');
    console.log('      • TM22: Dynamic Roadway Warning (V2I)');
    console.log('      • WZ05: Work Zone Traveler Information');
    console.log('      • WX02: Weather Information Distribution');

    this.emit('started');
  }

  /**
   * Process high-severity event and broadcast TIM
   * ARC-IT Flow: incident information → RSE
   */
  async processHighSeverityEvent(event) {
    if (!this.enabled) return;

    try {
      console.log(`🚨 Processing high-severity event: ${event.description}`);

      // Generate TIM message
      const tim = await timGenerator.generateTIMFromEvent(event);

      // Find nearby RSUs
      const rsus = await rsuManager.findNearbyRSUs({
        latitude: event.latitude,
        longitude: event.longitude
      }, 5); // 5 mile radius

      if (rsus.length === 0) {
        console.log('   ⚠️  No RSUs found in area - TIM not broadcast');
        return;
      }

      console.log(`   📡 Broadcasting to ${rsus.length} RSUs`);

      // Broadcast to RSUs
      const results = await rsuManager.broadcastToRSUs(tim, rsus);

      const successful = results.filter(r => r.success).length;
      console.log(`   ✅ Broadcast complete: ${successful}/${rsus.length} successful`);

      // Track active warning
      this.activeWarnings.set(tim.packetID, {
        type: 'event',
        source_id: event.id,
        tim,
        rsus: rsus.map(r => r.rsu_id),
        created_at: new Date()
      });

      this.emit('warning-broadcast', { event, tim, rsus, results });

    } catch (error) {
      console.error('❌ Error processing high-severity event:', error);
      this.emit('error', error);
    }
  }

  /**
   * Process sensor data and generate warnings
   * ARC-IT Flow: environmental sensor data → RSE
   */
  async processSensorData(sensorData, sensorLocation) {
    if (!this.enabled) return;

    try {
      // Generate TIM from sensor
      const tim = await timGenerator.generateTIMFromSensor(sensorData, sensorLocation);

      if (!tim) {
        // No warning condition detected
        return;
      }

      console.log(`🌡️ Sensor warning: ${sensorData.type} at ${sensorLocation.name}`);

      // Find nearby RSUs
      const rsus = await rsuManager.findNearbyRSUs(sensorLocation, 2); // 2 mile radius

      if (rsus.length === 0) {
        console.log('   ⚠️  No RSUs found - TIM not broadcast');
        return;
      }

      // Broadcast
      const results = await rsuManager.broadcastToRSUs(tim, rsus);

      const successful = results.filter(r => r.success).length;
      console.log(`   ✅ Sensor warning broadcast: ${successful}/${rsus.length} RSUs`);

      this.activeWarnings.set(tim.packetID, {
        type: 'sensor',
        source_id: sensorLocation.id,
        tim,
        rsus: rsus.map(r => r.rsu_id),
        created_at: new Date()
      });

      this.emit('warning-broadcast', { sensor: sensorData, location: sensorLocation, tim, rsus, results });

    } catch (error) {
      console.error('❌ Error processing sensor data:', error);
      this.emit('error', error);
    }
  }

  /**
   * Process WZDx work zone and broadcast warnings
   * ARC-IT Service Package: WZ05 - Work Zone Traveler Information
   * ARC-IT Flow: work zone information → RSE
   */
  async processWorkZone(workZone) {
    if (!this.enabled) return;

    try {
      const props = workZone.properties;
      const core = props.core_details || {};

      console.log(`🚧 Processing work zone: ${core.road_names?.join(', ')}`);

      // Generate TIM from work zone
      const tim = await timGenerator.generateTIMFromWorkZone(workZone);

      // Find RSUs along the work zone corridor
      let rsus = [];

      if (workZone.geometry.type === 'LineString') {
        const coords = workZone.geometry.coordinates;
        // Get all RSUs along the path
        for (const coord of coords) {
          const nearbyRSUs = await rsuManager.findNearbyRSUs({
            latitude: coord[1],
            longitude: coord[0]
          }, 1); // 1 mile from path

          nearbyRSUs.forEach(rsu => {
            if (!rsus.find(r => r.rsu_id === rsu.rsu_id)) {
              rsus.push(rsu);
            }
          });
        }
      } else if (workZone.geometry.type === 'Point') {
        rsus = await rsuManager.findNearbyRSUs({
          latitude: workZone.geometry.coordinates[1],
          longitude: workZone.geometry.coordinates[0]
        }, 2);
      }

      if (rsus.length === 0) {
        console.log('   ⚠️  No RSUs found along work zone - TIM not broadcast');
        return;
      }

      // Broadcast
      const results = await rsuManager.broadcastToRSUs(tim, rsus);

      const successful = results.filter(r => r.success).length;
      console.log(`   ✅ Work zone warning broadcast: ${successful}/${rsus.length} RSUs`);

      this.activeWarnings.set(tim.packetID, {
        type: 'workzone',
        source_id: props.road_event_id,
        tim,
        rsus: rsus.map(r => r.rsu_id),
        created_at: new Date()
      });

      this.emit('warning-broadcast', { workZone, tim, rsus, results });

    } catch (error) {
      console.error('❌ Error processing work zone:', error);
      this.emit('error', error);
    }
  }

  /**
   * Process all active work zones
   */
  async processActiveWorkZones() {
    if (!this.enabled) return;

    try {
      // Get all active work zones from WZDx database
      const workZones = await db.db.prepare(`
        SELECT *
        FROM wzdx_work_zones
        WHERE event_status IN ('active', 'pending')
          AND (end_date IS NULL OR end_date > datetime('now'))
        LIMIT 50
      `).all();

      console.log(`🚧 Processing ${workZones.length} active work zones for V2X broadcast...`);

      for (const wz of workZones) {
        // Convert database record back to WZDx feature
        const feature = wz.wzdx_feature_json
          ? JSON.parse(wz.wzdx_feature_json)
          : this.convertDBRecordToFeature(wz);

        await this.processWorkZone(feature);
      }

    } catch (error) {
      console.error('❌ Error processing work zones:', error);
    }
  }

  /**
   * Convert database work zone record to GeoJSON feature
   */
  convertDBRecordToFeature(wz) {
    return {
      type: 'Feature',
      properties: {
        road_event_id: wz.feature_id,
        core_details: {
          event_type: wz.event_type,
          road_names: [wz.road_name].filter(Boolean),
          direction: wz.direction,
          description: wz.description
        },
        start_date: wz.start_date,
        end_date: wz.end_date,
        vehicle_impact: wz.vehicle_impact,
        reduced_speed_limit_kph: wz.reduced_speed_limit,
        worker_presence: wz.worker_presence ? JSON.parse(wz.worker_presence) : null
      },
      geometry: wz.geometry ? JSON.parse(wz.geometry) : null
    };
  }

  /**
   * Get active warnings
   */
  getActiveWarnings() {
    return Array.from(this.activeWarnings.values());
  }

  /**
   * Clear expired warnings
   */
  clearExpiredWarnings() {
    const now = new Date();
    const expiredPackets = [];

    for (const [packetID, warning] of this.activeWarnings) {
      const age = (now - warning.created_at) / 1000 / 60; // minutes

      // Clear warnings older than their duration
      const duration = warning.tim.dataFrames[0]?.duratonTime || 120;
      if (age > duration) {
        expiredPackets.push(packetID);
      }
    }

    expiredPackets.forEach(id => this.activeWarnings.delete(id));

    if (expiredPackets.length > 0) {
      console.log(`🗑️  Cleared ${expiredPackets.length} expired warnings`);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      active_warnings: this.activeWarnings.size,
      ode_url: rsuManager.odeBaseUrl
    };
  }
}

// Export singleton
const v2xWarningService = new V2XWarningService();

module.exports = {
  v2xWarningService,
  V2XWarningService
};

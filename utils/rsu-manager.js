/**
 * RSU (Roadside Unit) Manager
 *
 * ARC-IT Physical Objects:
 * - Traffic Management Center (TMC) - This application
 * - Roadside Equipment (RSE) - The RSUs
 * - Connected Vehicle Roadside Equipment - RSU with V2X capability
 *
 * ARC-IT Information Flows:
 * - roadway information system data → RSE
 * - incident information → RSE
 * - work zone information → RSE
 * - driver information ← RSE (to vehicles)
 *
 * Integrates with USDOT ITS JPO ODE for TIM distribution
 */

const axios = require('axios');
const db = require('../database');

class RSUManager {
  constructor(odeConfig = {}) {
    this.odeBaseUrl = odeConfig.baseUrl || process.env.ODE_BASE_URL || 'http://localhost:8080';
    this.odeApiKey = odeConfig.apiKey || process.env.ODE_API_KEY;
    this.tmcId = odeConfig.tmcId || 'corridor-communicator-tmc';
  }

  /**
   * Send TIM message to ODE for RSU broadcast
   * ARC-IT Flow: TMC → ODE → RSU → Vehicle OBE
   */
  async depositTIM(tim, metadata = {}) {
    try {
      console.log('📡 Depositing TIM to ODE...');

      const timDeposit = {
        tim,
        metadata: {
          request: {
            rsus: metadata.rsus || [],
            snmp: {
              rsuid: metadata.rsuid || '00000083',
              msgid: 31, // TIM message ID
              mode: 1,   // Continuous broadcast
              channel: 178, // 5.9 GHz DSRC
              interval: 1,  // Broadcast interval (seconds)
              deliverystart: this.getDeliveryStart(tim),
              deliverystop: this.getDeliveryStop(tim),
              enable: 1,
              status: 4
            }
          },
          logFileName: `tim_${Date.now()}.json`
        }
      };

      const response = await axios.post(
        `${this.odeBaseUrl}/tim`,
        timDeposit,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(this.odeApiKey && { 'Authorization': `Bearer ${this.odeApiKey}` })
          },
          timeout: 10000
        }
      );

      console.log(`✅ TIM deposited successfully (${response.status})`);

      // Log to database
      await this.logTIMBroadcast(tim, metadata, 'success');

      return {
        success: true,
        responseCode: response.status,
        timId: tim.packetID
      };

    } catch (error) {
      console.error('❌ Failed to deposit TIM:', error.message);

      await this.logTIMBroadcast(tim, metadata, 'failed', error.message);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find RSUs near a geographic location
   * ARC-IT: RSE location query
   */
  async findNearbyRSUs(location, radiusMiles = 5) {
    try {
      const rsus = await db.db.prepare(`
        SELECT
          id,
          rsu_id,
          latitude,
          longitude,
          roadway,
          milepost,
          ipv4_address,
          status,
          capabilities
        FROM rsu_inventory
        WHERE status = 'active'
      `).all();

      // Filter by distance
      const nearbyRSUs = rsus.filter(rsu => {
        const distance = this.calculateDistance(
          location.latitude,
          location.longitude,
          rsu.latitude,
          rsu.longitude
        );
        return distance <= radiusMiles;
      });

      // Sort by distance
      nearbyRSUs.sort((a, b) => {
        const distA = this.calculateDistance(
          location.latitude, location.longitude,
          a.latitude, a.longitude
        );
        const distB = this.calculateDistance(
          location.latitude, location.longitude,
          b.latitude, b.longitude
        );
        return distA - distB;
      });

      return nearbyRSUs;

    } catch (error) {
      // RSU inventory table doesn't exist yet - return empty array
      console.warn('RSU inventory not available:', error.message);
      return [];
    }
  }

  /**
   * Find RSUs along a corridor/route
   * Useful for work zones that span multiple miles
   */
  async findRSUsAlongCorridor(corridor, startMilepost, endMilepost) {
    try {
      const rsus = await db.db.prepare(`
        SELECT *
        FROM rsu_inventory
        WHERE status = 'active'
          AND roadway = ?
          AND milepost >= ?
          AND milepost <= ?
        ORDER BY milepost ASC
      `).all(corridor, startMilepost, endMilepost);

      return rsus;

    } catch (error) {
      console.warn('RSU inventory query failed:', error.message);
      return [];
    }
  }

  /**
   * Get RSU by ID
   */
  async getRSU(rsuId) {
    try {
      const rsu = await db.db.prepare(`
        SELECT * FROM rsu_inventory WHERE rsu_id = ?
      `).get(rsuId);

      return rsu;
    } catch (error) {
      return null;
    }
  }

  /**
   * Broadcast TIM to specific RSUs
   * ARC-IT Service Package: TM22 - Dynamic Roadway Warning
   */
  async broadcastToRSUs(tim, rsus) {
    const results = [];

    for (const rsu of rsus) {
      const result = await this.depositTIM(tim, {
        rsus: [rsu.rsu_id],
        rsuid: rsu.rsu_id,
        ipv4: rsu.ipv4_address
      });

      results.push({
        rsu: rsu.rsu_id,
        success: result.success,
        error: result.error
      });
    }

    return results;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get delivery start time in J2735 format
   */
  getDeliveryStart(tim) {
    const dataFrame = tim.dataFrames[0];
    if (!dataFrame) return new Date().toISOString();

    const year = dataFrame.startYear || new Date().getFullYear();
    const minuteOfYear = dataFrame.startTime || 0;

    const startDate = new Date(year, 0, 0);
    startDate.setMinutes(startDate.getMinutes() + minuteOfYear);

    return startDate.toISOString();
  }

  /**
   * Get delivery stop time
   */
  getDeliveryStop(tim) {
    const dataFrame = tim.dataFrames[0];
    if (!dataFrame) {
      // Default 2 hours from now
      const stop = new Date();
      stop.setHours(stop.getHours() + 2);
      return stop.toISOString();
    }

    const startTime = new Date(this.getDeliveryStart(tim));
    const durationMinutes = dataFrame.duratonTime || 120;

    const stopTime = new Date(startTime);
    stopTime.setMinutes(stopTime.getMinutes() + durationMinutes);

    return stopTime.toISOString();
  }

  /**
   * Log TIM broadcast to database
   */
  async logTIMBroadcast(tim, metadata, status, errorMessage = null) {
    try {
      await db.runAsync(`
        INSERT INTO tim_broadcast_log (
          packet_id,
          message_count,
          timestamp,
          priority,
          rsus_targeted,
          status,
          error_message,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        tim.packetID,
        tim.msgCnt,
        tim.timeStamp,
        tim.dataFrames[0]?.priority || 0,
        JSON.stringify(metadata.rsus || []),
        status,
        errorMessage
      ]);
    } catch (error) {
      // Table might not exist yet - log to console instead
      console.log(`TIM Broadcast Log: ${status} - ${tim.packetID}`);
    }
  }

  /**
   * Get broadcast statistics
   */
  async getBroadcastStats(timeRangeHours = 24) {
    try {
      const stats = await db.db.prepare(`
        SELECT
          COUNT(*) as total_broadcasts,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          COUNT(DISTINCT packet_id) as unique_messages
        FROM tim_broadcast_log
        WHERE created_at >= datetime('now', '-${timeRangeHours} hours')
      `).get();

      return stats;
    } catch (error) {
      return {
        total_broadcasts: 0,
        successful: 0,
        failed: 0,
        unique_messages: 0
      };
    }
  }

  /**
   * Get recent broadcasts
   */
  async getRecentBroadcasts(limit = 50) {
    try {
      const broadcasts = await db.db.prepare(`
        SELECT *
        FROM tim_broadcast_log
        ORDER BY created_at DESC
        LIMIT ?
      `).all(limit);

      return broadcasts;
    } catch (error) {
      return [];
    }
  }

  /**
   * Check ODE connectivity
   */
  async checkODEConnection() {
    try {
      const response = await axios.get(`${this.odeBaseUrl}/tim/count`, {
        timeout: 5000,
        headers: this.odeApiKey ? { 'Authorization': `Bearer ${this.odeApiKey}` } : {}
      });

      return {
        connected: true,
        status: response.status,
        odeUrl: this.odeBaseUrl
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        odeUrl: this.odeBaseUrl
      };
    }
  }
}

// Export singleton with environment config
const rsuManager = new RSUManager({
  baseUrl: process.env.ODE_BASE_URL,
  apiKey: process.env.ODE_API_KEY,
  tmcId: 'corridor-communicator-tmc'
});

module.exports = {
  rsuManager,
  RSUManager
};

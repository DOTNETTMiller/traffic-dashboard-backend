/**
 * LIGHTWEIGHT IPAWS Audit Logging
 *
 * Simplified version that stores data as JSON instead of 50+ individual columns
 * Captures only what SOP Section 11 requires:
 * - User, time, content, channels, polygons, incident reference
 */

const db = require('../database');

class IPAWSAuditLogger {
  /**
   * Log IPAWS alert to lightweight audit database
   * Per SOP Section 11 - minimal compliance fields only
   */
  static async logAlert(alert, user = { id: 'system', name: 'System' }, status = 'draft') {
    try {
      const now = new Date().toISOString();
      const durationMinutes = alert.capMessage?.info?.expires
        ? Math.round((new Date(alert.capMessage.info.expires) - new Date(alert.capMessage.info.effective)) / (60 * 1000))
        : 60;

      // Store complex data as JSON
      const alertData = JSON.stringify({
        corridor: alert.event?.corridor,
        direction: alert.event?.direction,
        location: alert.event?.location || alert.event?.county,
        mileMarker: alert.event?.mileMarker || alert.event?.startMileMarker,
        eventType: alert.event?.eventType,
        severity: alert.event?.severity,
        headline: alert.messages?.english?.headline,
        instruction: alert.messages?.english?.instruction,
        headlineSpanish: alert.messages?.spanish?.headline,
        qualified: alert.qualification?.qualifies,
        qualificationReason: alert.qualification?.reason
      });

      const geofenceData = JSON.stringify({
        polygon: alert.geofence?.capFormat,
        buffer: alert.geofence?.bufferMiles,
        area: alert.geofence?.areaSquareMiles,
        population: alert.geofence?.estimatedPopulation,
        isAsymmetric: alert.geofence?.isAsymmetric,
        corridorAhead: alert.geofence?.corridorAheadMiles,
        corridorBehind: alert.geofence?.corridorBehindMiles
      });

      const sql = `
        INSERT INTO ipaws_alert_log_lite (
          alert_id, user_id, alert_data, geofence_data,
          channels, status, duration_minutes, sop_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        alert.capMessage?.identifier || `DRAFT-${Date.now()}`,
        user.id,
        alertData,
        geofenceData,
        'WEA', // Channels: WEA, EAS, Public
        status,
        durationMinutes,
        '2024-v1'
      ];

      const stmt = db.db.prepare(sql);
      const result = await stmt.run(...params);

      console.log(`✅ IPAWS alert logged (lightweight): ${params[0]} (ID: ${result.lastInsertRowid})`);
      return {
        logId: result.lastInsertRowid,
        alertId: params[0]
      };
    } catch (err) {
      console.error('Failed to log IPAWS alert:', err);
      // Don't throw - allow alert generation to continue even if logging fails
      return {
        logId: null,
        alertId: null,
        error: err.message
      };
    }
  }

  /**
   * Update alert status
   */
  static async updateStatus(alertId, status, additionalData = {}) {
    try {
      const updates = [`status = ?`];
      const params = [status];

      if (status === 'issued') {
        updates.push('issued_at = ?');
        params.push(new Date().toISOString());
      } else if (status === 'cancelled') {
        updates.push('cancelled_at = ?', 'cancellation_reason = ?');
        params.push(
          new Date().toISOString(),
          additionalData.cancellationReason || 'Operator cancelled'
        );
      }

      params.push(alertId);

      const sql = `UPDATE ipaws_alert_log_lite SET ${updates.join(', ')} WHERE alert_id = ?`;
      const stmt = db.db.prepare(sql);
      const result = await stmt.run(...params);

      console.log(`✅ IPAWS alert status updated (lightweight): ${alertId} → ${status}`);
      return { updated: result.changes > 0 };
    } catch (err) {
      console.error('Failed to update IPAWS alert status:', err);
      return { updated: false, error: err.message };
    }
  }

  /**
   * Get active alerts
   */
  static async getActiveAlerts() {
    try {
      const stmt = db.db.prepare(`
        SELECT
          alert_id,
          user_id,
          alert_data,
          geofence_data,
          status,
          issued_at,
          duration_minutes,
          created_at
        FROM ipaws_alert_log_lite
        WHERE status = 'issued'
          AND (cancelled_at IS NULL OR cancelled_at > datetime('now', '-4 hours'))
        ORDER BY created_at DESC
      `);

      const rows = await stmt.all();

      // Parse JSON data (handle both JSONB from PostgreSQL and TEXT from SQLite)
      return rows.map(row => ({
        ...row,
        alert_data: typeof row.alert_data === 'string' ? JSON.parse(row.alert_data || '{}') : row.alert_data,
        geofence_data: typeof row.geofence_data === 'string' ? JSON.parse(row.geofence_data || '{}') : row.geofence_data
      }));
    } catch (err) {
      console.error('Failed to get active alerts:', err);
      return [];
    }
  }

  /**
   * Export to HSEMD format (SOP Section 11 requirement)
   */
  static async exportToHSEMD(startDate, endDate) {
    try {
      const stmt = db.db.prepare(`
        SELECT
          alert_id,
          user_id,
          alert_data,
          geofence_data,
          channels,
          status,
          issued_at,
          cancelled_at,
          duration_minutes,
          created_at
        FROM ipaws_alert_log_lite
        WHERE created_at BETWEEN ? AND ?
        ORDER BY created_at DESC
      `);

      const rows = await stmt.all(startDate, endDate);

      // Parse JSON and format for HSEMD (handle both JSONB from PostgreSQL and TEXT from SQLite)
      return rows.map(row => {
        const alert = typeof row.alert_data === 'string' ? JSON.parse(row.alert_data || '{}') : row.alert_data;
        const geofence = typeof row.geofence_data === 'string' ? JSON.parse(row.geofence_data || '{}') : row.geofence_data;

        return {
          alertId: row.alert_id,
          user: row.user_id,
          timestamp: row.created_at,
          corridor: alert.corridor,
          location: alert.location,
          headline: alert.headline,
          population: geofence.population,
          status: row.status,
          duration: row.duration_minutes,
          issued: row.issued_at,
          cancelled: row.cancelled_at
        };
      });
    } catch (err) {
      console.error('Failed to export to HSEMD:', err);
      return [];
    }
  }
}

module.exports = IPAWSAuditLogger;

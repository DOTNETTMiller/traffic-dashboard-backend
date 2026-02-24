/**
 * Asset Health Monitoring Service
 *
 * Monitors ITS equipment health (CCTV, RSU, DMS, RWIS, Detectors)
 * Calculates health scores, detects failures, triggers alerts
 * Tracks historical performance and uptime
 */

const Database = require('better-sqlite3');
const path = require('path');

class AssetHealthMonitor {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', 'traffic_data.db');
    this.db = null;

    // Asset type specific health thresholds
    this.thresholds = {
      CCTV: {
        operational: 80,      // video_quality_score
        degraded: 50,
        uptimeTarget: 99.0
      },
      RSU: {
        operational: 95,      // message_success_rate
        degraded: 80,
        uptimeTarget: 99.5
      },
      DMS: {
        operational: 5,       // display_error_count (per day, lower is better)
        degraded: 20,
        uptimeTarget: 98.0
      },
      RWIS: {
        operational: 90,      // sensor_accuracy_score
        degraded: 70,
        uptimeTarget: 95.0
      },
      DETECTOR: {
        operational: 95,      // data transmission rate
        degraded: 80,
        uptimeTarget: 97.0
      }
    };
  }

  /**
   * Initialize database connection
   */
  connect() {
    if (!this.db) {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
    }
    return this.db;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Monitor health of a single asset
   */
  async monitorAsset(assetId) {
    this.connect();

    try {
      const asset = this.getAsset(assetId);
      if (!asset) {
        throw new Error(`Asset not found: ${assetId}`);
      }

      const health = await this.calculateAssetHealth(asset);
      this.updateAssetHealth(assetId, health);

      // Record history
      this.recordHealthHistory(assetId, health);

      // Trigger alerts if needed
      if (health.alert_triggered) {
        this.sendAlert(asset, health);
      }

      return health;
    } catch (error) {
      console.error(`Error monitoring asset ${assetId}:`, error);
      throw error;
    }
  }

  /**
   * Monitor all assets for a state
   */
  async monitorStateAssets(stateKey) {
    this.connect();

    const assets = this.db.prepare(`
      SELECT * FROM asset_health WHERE state_key = ?
    `).all(stateKey);

    const results = [];
    for (const asset of assets) {
      try {
        const health = await this.monitorAsset(asset.asset_id);
        results.push({ asset_id: asset.asset_id, success: true, health });
      } catch (error) {
        results.push({ asset_id: asset.asset_id, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Calculate health metrics for an asset
   */
  async calculateAssetHealth(asset) {
    const assetType = asset.asset_type;
    const threshold = this.thresholds[assetType];

    if (!threshold) {
      throw new Error(`Unknown asset type: ${assetType}`);
    }

    // Calculate uptime percentage (last 30 days)
    const uptime = this.calculateUptime(asset.asset_id, 30);

    // Get performance metric based on asset type
    let performanceMetric = 0;
    let status = 'OPERATIONAL';
    let alertTriggered = false;
    let alertType = null;

    switch (assetType) {
      case 'CCTV':
        performanceMetric = asset.video_quality_score || 0;
        if (performanceMetric < threshold.degraded) {
          status = 'DEGRADED';
          alertTriggered = true;
          alertType = 'DEGRADED';
        }
        if (!asset.last_online || this.isOffline(asset.last_online, 1)) {
          status = 'FAILED';
          alertTriggered = true;
          alertType = 'FAILURE';
        }
        break;

      case 'RSU':
        performanceMetric = asset.message_success_rate || 0;
        if (performanceMetric < threshold.degraded) {
          status = 'DEGRADED';
          alertTriggered = true;
          alertType = 'DEGRADED';
        }
        break;

      case 'DMS':
        performanceMetric = asset.display_error_count || 0;
        if (performanceMetric > threshold.degraded) {
          status = 'DEGRADED';
          alertTriggered = true;
          alertType = 'DEGRADED';
        }
        if (performanceMetric > threshold.operational * 3) {
          status = 'FAILED';
          alertTriggered = true;
          alertType = 'FAILURE';
        }
        break;

      case 'RWIS':
      case 'DETECTOR':
        performanceMetric = asset.sensor_accuracy_score || 0;
        if (performanceMetric < threshold.degraded) {
          status = 'DEGRADED';
          alertTriggered = true;
          alertType = 'DEGRADED';
        }
        break;
    }

    // Check uptime
    if (uptime < threshold.uptimeTarget - 5) {
      status = 'DEGRADED';
      alertTriggered = true;
      alertType = alertType || 'DEGRADED';
    }

    // Check maintenance due
    if (asset.next_maintenance_due) {
      const daysUntilMaintenance = this.getDaysUntil(asset.next_maintenance_due);
      if (daysUntilMaintenance <= 7 && daysUntilMaintenance >= 0) {
        alertTriggered = true;
        alertType = 'MAINTENANCE_DUE';
      }
    }

    // Check predictive failure
    if (asset.failure_probability_7d > 80) {
      alertTriggered = true;
      alertType = 'PREDICTED_FAILURE';
    }

    return {
      status,
      performance_metric: performanceMetric,
      uptime_percentage: uptime,
      alert_triggered: alertTriggered,
      alert_type: alertType,
      last_checked: new Date().toISOString()
    };
  }

  /**
   * Calculate uptime percentage for an asset
   */
  calculateUptime(assetId, days = 30) {
    const history = this.db.prepare(`
      SELECT status, timestamp
      FROM asset_health_history
      WHERE asset_id = ?
        AND timestamp >= datetime('now', '-' || ? || ' days')
      ORDER BY timestamp DESC
    `).all(assetId, days);

    if (history.length === 0) {
      return 100; // No history, assume operational
    }

    const operationalCount = history.filter(h => h.status === 'OPERATIONAL').length;
    return Math.round((operationalCount / history.length) * 100 * 10) / 10;
  }

  /**
   * Check if asset is offline
   */
  isOffline(lastOnline, hoursThreshold = 1) {
    if (!lastOnline) return true;
    const lastOnlineDate = new Date(lastOnline);
    const now = new Date();
    const hoursDiff = (now - lastOnlineDate) / (1000 * 60 * 60);
    return hoursDiff > hoursThreshold;
  }

  /**
   * Get days until a date
   */
  getDaysUntil(dateString) {
    const targetDate = new Date(dateString);
    const now = new Date();
    const diffTime = targetDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Get asset by ID
   */
  getAsset(assetId) {
    return this.db.prepare(`
      SELECT * FROM asset_health WHERE asset_id = ?
    `).get(assetId);
  }

  /**
   * Update asset health status
   */
  updateAssetHealth(assetId, health) {
    this.db.prepare(`
      UPDATE asset_health
      SET status = ?,
          uptime_percentage_30d = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE asset_id = ?
    `).run(health.status, health.uptime_percentage, assetId);
  }

  /**
   * Record health history
   */
  recordHealthHistory(assetId, health) {
    this.db.prepare(`
      INSERT INTO asset_health_history (
        asset_id, timestamp, status, performance_metric,
        uptime_percentage, alert_triggered, alert_type
      ) VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)
    `).run(
      assetId,
      health.status,
      health.performance_metric,
      health.uptime_percentage,
      health.alert_triggered ? 1 : 0,
      health.alert_type
    );
  }

  /**
   * Send alert (placeholder for notification system)
   */
  sendAlert(asset, health) {
    console.log(`🚨 ALERT: ${asset.asset_id} (${asset.asset_type})`);
    console.log(`   Status: ${health.status}`);
    console.log(`   Alert Type: ${health.alert_type}`);
    console.log(`   Performance: ${health.performance_metric}`);
    console.log(`   Uptime: ${health.uptime_percentage}%`);

    // Send notifications via all enabled channels
    try {
      const NotificationService = require('./notification-service');
      const notifier = new NotificationService();
      await notifier.sendAssetHealthAlert(health);
    } catch (error) {
      console.error('   ⚠️  Notification error:', error.message);
    }
  }

  /**
   * Get asset health dashboard for a state
   */
  getStateDashboard(stateKey) {
    this.connect();

    const assets = this.db.prepare(`
      SELECT * FROM asset_health WHERE state_key = ?
    `).all(stateKey);

    const summary = {
      total_assets: assets.length,
      operational: assets.filter(a => a.status === 'OPERATIONAL').length,
      degraded: assets.filter(a => a.status === 'DEGRADED').length,
      failed: assets.filter(a => a.status === 'FAILED').length,
      maintenance: assets.filter(a => a.status === 'MAINTENANCE').length
    };

    // Calculate overall health score
    const healthScores = assets.map(a => {
      if (a.status === 'OPERATIONAL') return 100;
      if (a.status === 'DEGRADED') return 60;
      if (a.status === 'FAILED') return 0;
      return 80; // MAINTENANCE
    });
    summary.overall_health_score = healthScores.length > 0
      ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length * 10) / 10
      : 0;

    // Group by type
    const byType = {};
    for (const asset of assets) {
      if (!byType[asset.asset_type]) {
        byType[asset.asset_type] = {
          total: 0,
          operational: 0,
          degraded: 0,
          failed: 0,
          maintenance: 0
        };
      }
      byType[asset.asset_type].total++;
      byType[asset.asset_type][asset.status.toLowerCase()]++;
    }

    // Calculate health score per type
    for (const type in byType) {
      const typeData = byType[type];
      const score = (
        (typeData.operational * 100) +
        (typeData.degraded * 60) +
        (typeData.maintenance * 80)
      ) / typeData.total;
      typeData.health_score = Math.round(score * 10) / 10;
    }

    // Get recent alerts
    const alerts = this.db.prepare(`
      SELECT ahh.*, ah.asset_type, ah.corridor
      FROM asset_health_history ahh
      JOIN asset_health ah ON ah.asset_id = ahh.asset_id
      WHERE ah.state_key = ?
        AND ahh.alert_triggered = 1
        AND ahh.timestamp >= datetime('now', '-7 days')
      ORDER BY ahh.timestamp DESC
      LIMIT 20
    `).all(stateKey);

    // Get upcoming maintenance
    const maintenanceDue = this.db.prepare(`
      SELECT ah.*, ms.scheduled_date, ms.maintenance_type, ms.priority
      FROM asset_health ah
      LEFT JOIN maintenance_schedule ms ON ms.asset_id = ah.asset_id
        AND ms.status = 'SCHEDULED'
      WHERE ah.state_key = ?
        AND ms.scheduled_date IS NOT NULL
        AND ms.scheduled_date >= date('now')
        AND ms.scheduled_date <= date('now', '+30 days')
      ORDER BY ms.scheduled_date ASC
    `).all(stateKey);

    return {
      state_key: stateKey,
      summary,
      by_type: byType,
      assets: assets.map(a => ({
        asset_id: a.asset_id,
        asset_type: a.asset_type,
        corridor: a.corridor,
        status: a.status,
        uptime_30d: a.uptime_percentage_30d,
        last_online: a.last_online
      })),
      alerts: alerts.map(a => ({
        asset_id: a.asset_id,
        asset_type: a.asset_type,
        corridor: a.corridor,
        alert_type: a.alert_type,
        timestamp: a.timestamp,
        performance_metric: a.performance_metric
      })),
      maintenance_due: maintenanceDue.map(m => ({
        asset_id: m.asset_id,
        asset_type: m.asset_type,
        corridor: m.corridor,
        scheduled_date: m.scheduled_date,
        maintenance_type: m.maintenance_type,
        priority: m.priority,
        days_until_due: this.getDaysUntil(m.scheduled_date)
      }))
    };
  }

  /**
   * Get detailed asset information
   */
  getAssetDetails(assetId) {
    this.connect();

    const asset = this.getAsset(assetId);
    if (!asset) {
      return null;
    }

    // Get history (last 30 days)
    const history = this.db.prepare(`
      SELECT * FROM asset_health_history
      WHERE asset_id = ?
        AND timestamp >= datetime('now', '-30 days')
      ORDER BY timestamp DESC
    `).all(assetId);

    // Get maintenance schedule
    const maintenance = this.db.prepare(`
      SELECT * FROM maintenance_schedule
      WHERE asset_id = ?
      ORDER BY scheduled_date DESC
      LIMIT 10
    `).all(assetId);

    return {
      asset,
      history,
      maintenance,
      current_uptime: this.calculateUptime(assetId, 30),
      days_since_maintenance: asset.last_maintenance_date
        ? Math.abs(this.getDaysUntil(asset.last_maintenance_date))
        : null
    };
  }
}

module.exports = AssetHealthMonitor;

/**
 * Predictive Maintenance AI Service
 *
 * Uses statistical analysis and machine learning techniques to predict
 * equipment failures and recommend maintenance actions.
 *
 * Phase 2.2: AI-powered failure prediction for ITS equipment
 */

const Database = require('better-sqlite3');
const path = require('path');

class PredictiveMaintenanceAI {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', 'traffic_data.db');
    this.db = null;

    // Cost estimates for maintenance (in USD)
    this.maintenanceCosts = {
      CCTV: {
        preventive: 500,
        corrective: 1500,
        emergency: 3500,
        replacement: 8000
      },
      RSU: {
        preventive: 800,
        corrective: 2500,
        emergency: 6000,
        replacement: 15000
      },
      DMS: {
        preventive: 1200,
        corrective: 3500,
        emergency: 8000,
        replacement: 25000
      },
      RWIS: {
        preventive: 1000,
        corrective: 3000,
        emergency: 7000,
        replacement: 20000
      },
      DETECTOR: {
        preventive: 300,
        corrective: 800,
        emergency: 2000,
        replacement: 4000
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
   * Calculate failure probability for an asset
   * Uses exponential degradation model based on:
   * - Age of equipment
   * - Recent failure history
   * - Performance degradation
   * - Uptime percentage
   * - Time since last maintenance
   */
  calculateFailureProbability(asset, daysAhead = 30) {
    this.connect();

    // Get historical failure data
    const failureHistory = this.db.prepare(`
      SELECT COUNT(*) as failure_count
      FROM asset_health_history
      WHERE asset_id = ?
        AND status = 'FAILED'
        AND timestamp >= datetime('now', '-90 days')
    `).get(asset.asset_id);

    // Calculate age factor (0-1, higher = older = more likely to fail)
    const ageFactor = Math.min(asset.age_years / 15, 1) || 0.3;

    // Calculate performance factor (0-1, higher = worse performance = more likely to fail)
    let performanceFactor = 0.5;
    if (asset.asset_type === 'CCTV' && asset.video_quality_score !== null) {
      performanceFactor = 1 - (asset.video_quality_score / 100);
    } else if (asset.asset_type === 'RSU' && asset.message_success_rate !== null) {
      performanceFactor = 1 - (asset.message_success_rate / 100);
    } else if (asset.asset_type === 'DMS' && asset.display_error_count !== null) {
      performanceFactor = Math.min(asset.display_error_count / 50, 1);
    } else if ((asset.asset_type === 'RWIS' || asset.asset_type === 'DETECTOR') && asset.sensor_accuracy_score !== null) {
      performanceFactor = 1 - (asset.sensor_accuracy_score / 100);
    }

    // Calculate uptime factor (0-1, higher = worse uptime = more likely to fail)
    const uptimeFactor = 1 - ((asset.uptime_percentage_30d || 100) / 100);

    // Calculate maintenance factor (0-1, higher = longer since maintenance = more likely to fail)
    let maintenanceFactor = 0.5;
    if (asset.last_maintenance_date) {
      const daysSinceMaintenance = Math.floor(
        (new Date() - new Date(asset.last_maintenance_date)) / (1000 * 60 * 60 * 24)
      );
      maintenanceFactor = Math.min(daysSinceMaintenance / 365, 1);
    } else {
      maintenanceFactor = 1; // Never maintained = high risk
    }

    // Calculate failure history factor
    const failureHistoryFactor = Math.min((failureHistory?.failure_count || 0) / 5, 1);

    // Weighted combination of factors
    const baseFailureProbability = (
      ageFactor * 0.25 +
      performanceFactor * 0.30 +
      uptimeFactor * 0.20 +
      maintenanceFactor * 0.15 +
      failureHistoryFactor * 0.10
    );

    // Time-based exponential growth (failures more likely as time passes)
    const timeMultiplier = 1 + (daysAhead / 30) * 0.5;
    const failureProbability = Math.min(baseFailureProbability * timeMultiplier, 0.95);

    return failureProbability;
  }

  /**
   * Generate maintenance recommendations for an asset
   */
  generateRecommendation(asset, failureProbability7d, failureProbability14d, failureProbability30d) {
    const costs = this.maintenanceCosts[asset.asset_type] || this.maintenanceCosts.DETECTOR;

    let recommendedAction = 'ROUTINE_INSPECTION';
    let recommendedActionByDate = null;
    let priority = 'NORMAL';
    let failureRiskLevel = 'LOW';

    // Determine risk level
    if (failureProbability30d > 0.7) {
      failureRiskLevel = 'CRITICAL';
      recommendedAction = 'IMMEDIATE_REPLACEMENT';
      recommendedActionByDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
      priority = 'IMMEDIATE';
    } else if (failureProbability14d > 0.5) {
      failureRiskLevel = 'HIGH';
      recommendedAction = 'EMERGENCY_MAINTENANCE';
      recommendedActionByDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week
      priority = 'URGENT';
    } else if (failureProbability7d > 0.4) {
      failureRiskLevel = 'MODERATE';
      recommendedAction = 'PREVENTIVE_MAINTENANCE';
      recommendedActionByDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 2 weeks
      priority = 'HIGH';
    } else if (failureProbability30d > 0.25) {
      failureRiskLevel = 'MODERATE';
      recommendedAction = 'SCHEDULED_MAINTENANCE';
      recommendedActionByDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 1 month
      priority = 'MEDIUM';
    }

    // Calculate ROI for preventive maintenance
    const preventiveCost = costs.preventive;
    const emergencyCost = costs.emergency;
    const expectedEmergencyCost = emergencyCost * failureProbability30d;
    const roiPreventiveMaintenance = expectedEmergencyCost / preventiveCost;

    return {
      asset_id: asset.asset_id,
      asset_type: asset.asset_type,
      asset_name: asset.asset_id, // Can be enhanced with actual names
      state_key: asset.state_key,
      corridor: asset.corridor,
      failure_probability_7d: failureProbability7d,
      failure_probability_14d: failureProbability14d,
      failure_probability_30d: failureProbability30d,
      failure_risk_level: failureRiskLevel,
      recommended_action: recommendedAction,
      recommended_action_by_date: recommendedActionByDate?.toISOString().split('T')[0],
      alert_priority: priority,
      preventive_maintenance_cost: preventiveCost,
      corrective_maintenance_cost: costs.corrective,
      emergency_repair_cost: emergencyCost,
      replacement_cost: costs.replacement,
      expected_emergency_cost: Math.round(expectedEmergencyCost),
      roi_preventive_maintenance: roiPreventiveMaintenance,
      cost_savings_potential: Math.round(expectedEmergencyCost - preventiveCost),
      predicted_at: new Date().toISOString()
    };
  }

  /**
   * Run predictive analysis for all assets in a state
   */
  predictStateAssets(stateKey) {
    this.connect();

    const assets = this.db.prepare(`
      SELECT * FROM asset_health
      WHERE state_key = ?
        AND status IN ('OPERATIONAL', 'DEGRADED')
    `).all(stateKey);

    const predictions = [];

    for (const asset of assets) {
      const prob7d = this.calculateFailureProbability(asset, 7);
      const prob14d = this.calculateFailureProbability(asset, 14);
      const prob30d = this.calculateFailureProbability(asset, 30);

      const recommendation = this.generateRecommendation(asset, prob7d, prob14d, prob30d);

      // Only include predictions with significant failure risk
      if (prob30d > 0.15) {
        predictions.push(recommendation);

        // Update the asset_health table with failure probabilities
        this.db.prepare(`
          UPDATE asset_health
          SET failure_probability_7d = ?,
              failure_probability_14d = ?,
              failure_probability_30d = ?,
              ai_recommendation = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE asset_id = ?
        `).run(
          Math.round(prob7d * 100),
          Math.round(prob14d * 100),
          Math.round(prob30d * 100),
          recommendation.recommended_action,
          asset.asset_id
        );
      }
    }

    // Sort by failure probability (highest first)
    predictions.sort((a, b) => b.failure_probability_30d - a.failure_probability_30d);

    return predictions;
  }

  /**
   * Get critical alerts (high-risk predictions)
   */
  getCriticalAlerts(stateKey = null) {
    this.connect();

    let query = `
      SELECT
        ah.*,
        CASE
          WHEN ah.failure_probability_30d > 70 THEN 'CRITICAL'
          WHEN ah.failure_probability_14d > 50 THEN 'HIGH'
          WHEN ah.failure_probability_7d > 40 THEN 'MODERATE'
          ELSE 'LOW'
        END as failure_risk_level,
        CASE
          WHEN ah.failure_probability_30d > 70 THEN 'IMMEDIATE'
          WHEN ah.failure_probability_14d > 50 THEN 'URGENT'
          WHEN ah.failure_probability_7d > 40 THEN 'HIGH'
          ELSE 'NORMAL'
        END as alert_priority
      FROM asset_health ah
      WHERE ah.failure_probability_30d > 40
    `;

    if (stateKey) {
      query += ` AND ah.state_key = ?`;
    }

    query += ` ORDER BY ah.failure_probability_30d DESC LIMIT 20`;

    const stmt = this.db.prepare(query);
    const results = stateKey ? stmt.all(stateKey) : stmt.all();

    return results.map(asset => ({
      asset_id: asset.asset_id,
      asset_type: asset.asset_type,
      asset_name: asset.asset_id,
      state_key: asset.state_key,
      corridor: asset.corridor,
      status: asset.status,
      failure_probability_7d: asset.failure_probability_7d / 100,
      failure_probability_14d: asset.failure_probability_14d / 100,
      failure_probability_30d: asset.failure_probability_30d / 100,
      failure_risk_level: asset.failure_risk_level,
      alert_priority: asset.alert_priority,
      recommended_action: asset.ai_recommendation
    }));
  }

  /**
   * Calculate total cost savings potential for a state
   */
  calculateCostSavings(stateKey) {
    this.connect();

    const assets = this.db.prepare(`
      SELECT asset_type, failure_probability_30d
      FROM asset_health
      WHERE state_key = ?
        AND failure_probability_30d > 15
    `).all(stateKey);

    let totalPreventiveCost = 0;
    let totalExpectedEmergencyCost = 0;

    for (const asset of assets) {
      const costs = this.maintenanceCosts[asset.asset_type] || this.maintenanceCosts.DETECTOR;
      const failureProbability = asset.failure_probability_30d / 100;

      totalPreventiveCost += costs.preventive;
      totalExpectedEmergencyCost += costs.emergency * failureProbability;
    }

    return {
      state_key: stateKey,
      assets_at_risk: assets.length,
      total_preventive_cost: Math.round(totalPreventiveCost),
      total_expected_emergency_cost: Math.round(totalExpectedEmergencyCost),
      total_savings_potential: Math.round(totalExpectedEmergencyCost - totalPreventiveCost),
      roi: totalExpectedEmergencyCost / totalPreventiveCost
    };
  }
}

module.exports = PredictiveMaintenanceAI;

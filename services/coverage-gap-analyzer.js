/**
 * Coverage Gap Analysis Engine
 *
 * Identifies gaps in ITS equipment coverage along corridors
 * Calculates priority scores based on traffic volume, incident rates
 * Recommends equipment placement and matches with grant programs
 *
 * Phase 2.3: Coverage Gap Analysis
 */

const Database = require('better-sqlite3');
const path = require('path');

class CoverageGapAnalyzer {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', 'traffic_data.db');
    this.db = null;

    // Equipment installation costs (in USD)
    this.installationCosts = {
      CCTV: 12000,
      RSU: 25000,
      DMS: 35000,
      RWIS: 30000,
      DETECTOR: 5000
    };

    // Recommended spacing between equipment (in miles)
    this.recommendedSpacing = {
      CCTV: 2.0,      // Every 2 miles
      RSU: 0.5,       // Every 0.5 miles
      DMS: 5.0,       // Every 5 miles
      RWIS: 10.0,     // Every 10 miles
      DETECTOR: 0.3   // Every 0.3 miles
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
   * Calculate distance between two lat/lon points (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Identify coverage gaps for a specific corridor
   */
  analyzeCorridor(stateKey, corridor) {
    this.connect();

    // Get all assets on this corridor
    const assets = this.db.prepare(`
      SELECT asset_id, asset_type, location_lat, location_lon
      FROM asset_health
      WHERE state_key = ?
        AND corridor = ?
        AND location_lat IS NOT NULL
        AND location_lon IS NOT NULL
      ORDER BY asset_type, location_lat, location_lon
    `).all(stateKey, corridor);

    // Group by asset type
    const assetsByType = {};
    for (const asset of assets) {
      if (!assetsByType[asset.asset_type]) {
        assetsByType[asset.asset_type] = [];
      }
      assetsByType[asset.asset_type].push(asset);
    }

    const gaps = [];

    // Analyze gaps for each asset type
    for (const assetType of Object.keys(this.recommendedSpacing)) {
      const typeAssets = assetsByType[assetType] || [];
      const recommendedSpacing = this.recommendedSpacing[assetType];

      // Check gaps between consecutive assets
      for (let i = 0; i < typeAssets.length - 1; i++) {
        const asset1 = typeAssets[i];
        const asset2 = typeAssets[i + 1];

        const distance = this.calculateDistance(
          asset1.location_lat, asset1.location_lon,
          asset2.location_lat, asset2.location_lon
        );

        if (distance > recommendedSpacing * 1.5) {
          // Gap detected
          const gap = {
            state_key: stateKey,
            corridor,
            asset_type: assetType,
            segment_start_lat: asset1.location_lat,
            segment_start_lon: asset1.location_lon,
            segment_end_lat: asset2.location_lat,
            segment_end_lon: asset2.location_lon,
            gap_distance_miles: Math.round(distance * 10) / 10,
            recommended_spacing_miles: recommendedSpacing,
            gap_severity: distance / recommendedSpacing // Higher = worse
          };

          gaps.push(gap);
        }
      }
    }

    return gaps;
  }

  /**
   * Calculate priority score for a coverage gap
   * Based on:
   * - Traffic volume (AADT)
   * - Incident count
   * - Gap severity (how much larger than recommended spacing)
   * - Response time impact
   */
  calculatePriorityScore(gap, trafficVolume = null, incidentCount = null, avgResponseTime = null) {
    let priorityScore = 0;

    // Gap severity factor (0-40 points)
    const severityScore = Math.min(gap.gap_severity * 10, 40);
    priorityScore += severityScore;

    // Traffic volume factor (0-30 points)
    if (trafficVolume) {
      const trafficScore = Math.min((trafficVolume / 100000) * 30, 30);
      priorityScore += trafficScore;
    } else {
      priorityScore += 15; // Default mid-value
    }

    // Incident count factor (0-20 points)
    if (incidentCount) {
      const incidentScore = Math.min((incidentCount / 10) * 20, 20);
      priorityScore += incidentScore;
    } else {
      priorityScore += 10; // Default mid-value
    }

    // Response time factor (0-10 points)
    if (avgResponseTime) {
      const responseScore = Math.min((avgResponseTime / 30) * 10, 10);
      priorityScore += responseScore;
    } else {
      priorityScore += 5; // Default mid-value
    }

    return Math.round(priorityScore);
  }

  /**
   * Recommend equipment for a gap
   */
  recommendEquipment(gap) {
    const recommendations = [];

    // Always recommend the missing equipment type
    recommendations.push(gap.asset_type);

    // Recommend complementary equipment based on gap characteristics
    if (gap.gap_distance_miles > 5) {
      // Large gap - recommend comprehensive coverage
      if (!recommendations.includes('CCTV')) recommendations.push('CCTV');
      if (!recommendations.includes('DMS') && gap.gap_distance_miles > 10) {
        recommendations.push('DMS');
      }
    }

    // For high-traffic corridors, recommend detectors
    if (gap.traffic_volume_aadt && gap.traffic_volume_aadt > 50000) {
      if (!recommendations.includes('DETECTOR')) recommendations.push('DETECTOR');
    }

    return recommendations;
  }

  /**
   * Match gaps with applicable grant programs
   */
  matchGrantPrograms(gap) {
    const grantPrograms = [];

    // Infrastructure Investment and Jobs Act (IIJA) programs
    if (gap.priority_score > 60) {
      grantPrograms.push('RAISE Grant (US DOT)');
      grantPrograms.push('INFRA Grant (Infrastructure for Rebuilding America)');
    }

    // Safety programs
    if (gap.incident_count_30d && gap.incident_count_30d > 5) {
      grantPrograms.push('Highway Safety Improvement Program (HSIP)');
    }

    // ITS-specific programs
    if (['RSU', 'CCTV', 'DMS'].includes(gap.asset_type)) {
      grantPrograms.push('Advanced Transportation Technologies and Innovation (ATTAIN)');
      grantPrograms.push('Congestion Mitigation and Air Quality Improvement (CMAQ)');
    }

    // Rural programs
    if (gap.traffic_volume_aadt && gap.traffic_volume_aadt < 10000) {
      grantPrograms.push('Rural Surface Transportation Grant Program');
    }

    // Always applicable
    grantPrograms.push('Surface Transportation Block Grant Program (STBG)');

    return grantPrograms;
  }

  /**
   * Analyze coverage gaps for an entire state
   */
  analyzeState(stateKey) {
    this.connect();

    // Get all corridors for the state
    const corridors = this.db.prepare(`
      SELECT DISTINCT corridor
      FROM asset_health
      WHERE state_key = ?
        AND corridor IS NOT NULL
    `).all(stateKey);

    const allGaps = [];

    for (const {corridor} of corridors) {
      const corridorGaps = this.analyzeCorridor(stateKey, corridor);
      allGaps.push(...corridorGaps);
    }

    // Enhance gaps with priority scoring and recommendations
    const enhancedGaps = allGaps.map(gap => {
      // In a production system, fetch real traffic/incident data
      // For now, use estimated values based on gap severity
      const estimatedTraffic = Math.round(50000 + Math.random() * 50000);
      const estimatedIncidents = Math.round(3 + (gap.gap_severity * 2));
      const estimatedResponseTime = Math.round(15 + (gap.gap_distance_miles * 2));

      const priorityScore = this.calculatePriorityScore(
        gap,
        estimatedTraffic,
        estimatedIncidents,
        estimatedResponseTime
      );

      const recommendedEquipment = this.recommendEquipment({
        ...gap,
        traffic_volume_aadt: estimatedTraffic
      });

      const grantPrograms = this.matchGrantPrograms({
        ...gap,
        priority_score: priorityScore,
        incident_count_30d: estimatedIncidents,
        traffic_volume_aadt: estimatedTraffic
      });

      const estimatedInstallationCost = recommendedEquipment.reduce((sum, eq) => {
        return sum + (this.installationCosts[eq] || 0);
      }, 0);

      // Calculate estimated ROI (based on incident reduction and response time improvement)
      const annualSavings = (estimatedIncidents * 12 * 5000) + // Incident cost reduction
                           (estimatedResponseTime * 365 * 100); // Response time value
      const estimatedAnnualROI = annualSavings / estimatedInstallationCost;

      return {
        id: null, // Will be set when stored
        state_key: gap.state_key,
        corridor: gap.corridor,
        segment_start_lat: gap.segment_start_lat,
        segment_start_lon: gap.segment_start_lon,
        segment_end_lat: gap.segment_end_lat,
        segment_end_lon: gap.segment_end_lon,
        gap_distance_miles: gap.gap_distance_miles,
        missing_asset_types: JSON.stringify([gap.asset_type]),
        incident_response_time_avg_minutes: estimatedResponseTime,
        incident_count_30d: estimatedIncidents,
        traffic_volume_aadt: estimatedTraffic,
        priority_score: priorityScore,
        recommended_equipment: JSON.stringify(recommendedEquipment),
        estimated_installation_cost: estimatedInstallationCost,
        estimated_annual_roi: Math.round(estimatedAnnualROI * 100) / 100,
        matching_grant_programs: JSON.stringify(grantPrograms),
        last_analyzed: new Date().toISOString(),
        status: 'IDENTIFIED'
      };
    });

    // Store gaps in database
    this.storeGaps(enhancedGaps);

    // Sort by priority (highest first)
    enhancedGaps.sort((a, b) => b.priority_score - a.priority_score);

    return enhancedGaps;
  }

  /**
   * Store coverage gaps in the database
   */
  storeGaps(gaps) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO asset_coverage_gaps (
        state_key, corridor,
        segment_start_lat, segment_start_lon,
        segment_end_lat, segment_end_lon,
        gap_distance_miles,
        missing_asset_types,
        incident_response_time_avg_minutes,
        incident_count_30d,
        traffic_volume_aadt,
        priority_score,
        recommended_equipment,
        estimated_installation_cost,
        estimated_annual_roi,
        matching_grant_programs,
        last_analyzed,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const gap of gaps) {
      stmt.run(
        gap.state_key,
        gap.corridor,
        gap.segment_start_lat,
        gap.segment_start_lon,
        gap.segment_end_lat,
        gap.segment_end_lon,
        gap.gap_distance_miles,
        gap.missing_asset_types,
        gap.incident_response_time_avg_minutes,
        gap.incident_count_30d,
        gap.traffic_volume_aadt,
        gap.priority_score,
        gap.recommended_equipment,
        gap.estimated_installation_cost,
        gap.estimated_annual_roi,
        gap.matching_grant_programs,
        gap.last_analyzed,
        gap.status
      );
    }
  }

  /**
   * Get coverage gaps for a state from database
   */
  getStateGaps(stateKey, minPriority = 0) {
    this.connect();

    const gaps = this.db.prepare(`
      SELECT * FROM asset_coverage_gaps
      WHERE state_key = ?
        AND priority_score >= ?
      ORDER BY priority_score DESC
      LIMIT 50
    `).all(stateKey, minPriority);

    return gaps.map(gap => ({
      ...gap,
      missing_asset_types: JSON.parse(gap.missing_asset_types || '[]'),
      recommended_equipment: JSON.parse(gap.recommended_equipment || '[]'),
      matching_grant_programs: JSON.parse(gap.matching_grant_programs || '[]')
    }));
  }

  /**
   * Get summary statistics for coverage gaps
   */
  getGapSummary(stateKey) {
    this.connect();

    const summary = this.db.prepare(`
      SELECT
        COUNT(*) as total_gaps,
        SUM(CASE WHEN priority_score >= 75 THEN 1 ELSE 0 END) as high_priority_gaps,
        SUM(CASE WHEN priority_score >= 50 AND priority_score < 75 THEN 1 ELSE 0 END) as medium_priority_gaps,
        SUM(CASE WHEN priority_score < 50 THEN 1 ELSE 0 END) as low_priority_gaps,
        ROUND(AVG(priority_score), 1) as avg_priority_score,
        SUM(estimated_installation_cost) as total_estimated_cost,
        ROUND(AVG(estimated_annual_roi), 2) as avg_roi
      FROM asset_coverage_gaps
      WHERE state_key = ?
    `).get(stateKey);

    return summary;
  }
}

module.exports = CoverageGapAnalyzer;

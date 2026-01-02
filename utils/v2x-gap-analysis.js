/**
 * V2X Deployment Gap Analysis
 *
 * Analyzes RSU coverage and identifies gaps in connected vehicle infrastructure
 * Recommends optimal placement for new RSU deployments
 */

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

/**
 * Analyze V2X coverage and identify gaps
 */
function analyzeV2XDeployment(equipment, options = {}) {
  const {
    rsuRange = 800, // Default RSU range in meters (DSRC/C-V2X typical range)
    targetCoveragePercent = 85,
    corridorWidth = 500 // Width of corridor to consider (meters)
  } = options;

  // Filter for RSU equipment
  const rsus = equipment.filter(eq =>
    eq.equipment_type === 'rsu' ||
    (eq.equipment_subtype && eq.equipment_subtype.toLowerCase().includes('rsu')) ||
    (eq.equipment_subtype && (eq.equipment_subtype.toLowerCase().includes('v2x') ||
                               eq.equipment_subtype.toLowerCase().includes('dsrc') ||
                               eq.equipment_subtype.toLowerCase().includes('c-v2x')))
  );

  // Group by route
  const rsusByRoute = {};
  rsus.forEach(rsu => {
    const route = rsu.route || 'Unknown Route';
    if (!rsusByRoute[route]) {
      rsusByRoute[route] = [];
    }
    rsusByRoute[route].push(rsu);
  });

  // Analyze each route
  const routeAnalysis = [];
  const gaps = [];
  let totalCoverageMeters = 0;
  let totalRouteMeters = 0;

  Object.keys(rsusByRoute).forEach(route => {
    const routeRSUs = rsusByRoute[route];

    // Sort RSUs by milepost if available, otherwise by latitude
    routeRSUs.sort((a, b) => {
      if (a.milepost && b.milepost) {
        return parseFloat(a.milepost) - parseFloat(b.milepost);
      }
      return (a.latitude || 0) - (b.latitude || 0);
    });

    // Calculate coverage for this route
    let coveredSegments = [];
    let routeGaps = [];

    routeRSUs.forEach((rsu, idx) => {
      // Each RSU covers rsuRange meters in each direction
      const coverage = {
        rsu: rsu.id,
        location: `${rsu.latitude?.toFixed(6)}, ${rsu.longitude?.toFixed(6)}`,
        milepost: rsu.milepost,
        coverageRadius: rsuRange
      };
      coveredSegments.push(coverage);

      // Check gap to next RSU
      if (idx < routeRSUs.length - 1) {
        const nextRSU = routeRSUs[idx + 1];
        const distance = calculateDistance(
          rsu.latitude, rsu.longitude,
          nextRSU.latitude, nextRSU.longitude
        );

        const gapDistance = distance - (2 * rsuRange); // Gap after coverage areas

        if (gapDistance > 0) {
          // There's a gap
          const midLat = (rsu.latitude + nextRSU.latitude) / 2;
          const midLon = (rsu.longitude + nextRSU.longitude) / 2;

          routeGaps.push({
            route,
            gapId: `${route}-gap-${idx + 1}`,
            startRSU: rsu.id,
            endRSU: nextRSU.id,
            gapDistance: Math.round(gapDistance),
            totalDistance: Math.round(distance),
            midpoint: {
              latitude: midLat,
              longitude: midLon
            },
            startMilepost: rsu.milepost,
            endMilepost: nextRSU.milepost,
            recommendedRSUs: Math.ceil(gapDistance / (2 * rsuRange)),
            priority: gapDistance > 5000 ? 'high' : gapDistance > 2000 ? 'medium' : 'low'
          });

          gaps.push(routeGaps[routeGaps.length - 1]);
        }

        totalRouteMeters += distance;
        totalCoverageMeters += Math.min(distance, 2 * rsuRange);
      }
    });

    // Calculate route-level statistics
    const routeLength = routeRSUs.length > 1 ?
      calculateTotalRouteLength(routeRSUs) : 0;

    const coveragePercent = routeLength > 0 ?
      Math.min(100, (routeRSUs.length * 2 * rsuRange / routeLength) * 100) : 0;

    routeAnalysis.push({
      route,
      rsuCount: routeRSUs.length,
      routeLength: Math.round(routeLength),
      coveragePercent: Math.round(coveragePercent),
      gaps: routeGaps.length,
      status: coveragePercent >= targetCoveragePercent ? 'adequate' :
              coveragePercent >= 50 ? 'partial' : 'insufficient'
    });
  });

  // Overall statistics
  const overallCoverage = totalRouteMeters > 0 ?
    (totalCoverageMeters / totalRouteMeters) * 100 : 0;

  // Cost estimates (typical RSU costs)
  const costPerRSU = {
    hardware: 25000, // $25k per RSU unit
    installation: 15000, // $15k installation and configuration
    annual_maintenance: 3000 // $3k/year maintenance
  };

  const totalRecommendedRSUs = gaps.reduce((sum, gap) => sum + gap.recommendedRSUs, 0);
  const deploymentCost = {
    hardware: totalRecommendedRSUs * costPerRSU.hardware,
    installation: totalRecommendedRSUs * costPerRSU.installation,
    total_capex: totalRecommendedRSUs * (costPerRSU.hardware + costPerRSU.installation),
    annual_opex: totalRecommendedRSUs * costPerRSU.annual_maintenance,
    rsu_count: totalRecommendedRSUs
  };

  return {
    summary: {
      total_rsus: rsus.length,
      routes_analyzed: Object.keys(rsusByRoute).length,
      coverage_percent: Math.round(overallCoverage),
      gaps_identified: gaps.length,
      recommended_deployments: totalRecommendedRSUs,
      deployment_cost: deploymentCost.total_capex
    },
    route_analysis: routeAnalysis,
    gaps: gaps.sort((a, b) => b.gapDistance - a.gapDistance), // Sort by largest gaps first
    deployment_recommendations: generateRecommendations(gaps, deploymentCost),
    cost_estimate: deploymentCost,
    coverage_config: {
      rsu_range_meters: rsuRange,
      target_coverage_percent: targetCoveragePercent,
      corridor_width_meters: corridorWidth
    }
  };
}

/**
 * Calculate total route length from RSU positions
 */
function calculateTotalRouteLength(rsus) {
  if (rsus.length < 2) return 0;

  let totalLength = 0;
  for (let i = 0; i < rsus.length - 1; i++) {
    totalLength += calculateDistance(
      rsus[i].latitude, rsus[i].longitude,
      rsus[i + 1].latitude, rsus[i + 1].longitude
    );
  }
  return totalLength;
}

/**
 * Generate deployment recommendations
 */
function generateRecommendations(gaps, costEstimate) {
  const recommendations = [];

  // Priority 1: Fill critical gaps (>5km)
  const criticalGaps = gaps.filter(g => g.priority === 'high');
  if (criticalGaps.length > 0) {
    recommendations.push({
      priority: 1,
      title: 'Fill Critical Coverage Gaps',
      description: `Deploy ${criticalGaps.reduce((sum, g) => sum + g.recommendedRSUs, 0)} RSUs to address ${criticalGaps.length} critical gaps exceeding 5km`,
      locations: criticalGaps.slice(0, 5).map(g => ({
        route: g.route,
        gap_distance: `${(g.gapDistance / 1000).toFixed(1)}km`,
        recommended_rsus: g.recommendedRSUs
      })),
      estimated_cost: criticalGaps.reduce((sum, g) => sum + (g.recommendedRSUs * 40000), 0)
    });
  }

  // Priority 2: Major corridors
  const routeGapCounts = {};
  gaps.forEach(g => {
    if (!routeGapCounts[g.route]) routeGapCounts[g.route] = 0;
    routeGapCounts[g.route]++;
  });

  const majorCorridors = Object.keys(routeGapCounts)
    .filter(route => routeGapCounts[route] >= 3)
    .sort((a, b) => routeGapCounts[b] - routeGapCounts[a]);

  if (majorCorridors.length > 0) {
    recommendations.push({
      priority: 2,
      title: 'Complete Major Corridor Coverage',
      description: `Focus on ${majorCorridors.length} major corridors with multiple gaps`,
      corridors: majorCorridors.slice(0, 5).map(route => ({
        route,
        gaps: routeGapCounts[route],
        status: 'needs_improvement'
      }))
    });
  }

  // Priority 3: Cost-effective improvements
  const quickWins = gaps.filter(g => g.recommendedRSUs === 1 && g.priority !== 'high');
  if (quickWins.length > 0) {
    recommendations.push({
      priority: 3,
      title: 'Quick Wins - Single RSU Deployments',
      description: `${quickWins.length} gaps can be filled with single RSU deployments`,
      estimated_cost: quickWins.length * 40000,
      locations: quickWins.slice(0, 10).map(g => ({
        route: g.route,
        location: `MP ${g.startMilepost || 'N/A'} - ${g.endMilepost || 'N/A'}`
      }))
    });
  }

  // Overall recommendation
  if (gaps.length > 0) {
    recommendations.push({
      priority: 4,
      title: 'Phased Deployment Strategy',
      description: `Implement V2X coverage in ${Math.ceil(gaps.length / 10)} phases over ${Math.ceil(gaps.length / 10) * 6} months`,
      phases: [
        { phase: 1, focus: 'Critical gaps and high-priority corridors', duration: '6 months' },
        { phase: 2, focus: 'Medium priority gaps and corridor completion', duration: '6 months' },
        { phase: 3, focus: 'Low priority gaps and redundancy', duration: '6 months' }
      ],
      total_budget: costEstimate.total_capex,
      annual_operations: costEstimate.annual_opex
    });
  }

  return recommendations;
}

module.exports = {
  analyzeV2XDeployment,
  calculateDistance
};

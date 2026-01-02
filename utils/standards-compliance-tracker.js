/**
 * Standards Compliance Tracker
 *
 * Tracks equipment compliance with ITS industry standards
 * Generates compliance scores and identifies gaps
 */

/**
 * ITS Standards Database
 * Maps equipment types to required industry standards
 */
const ITS_STANDARDS = {
  // Traffic Management Standards
  'dms': {
    standards: ['NTCIP 1203', 'NTCIP 1201', 'MULTI'],
    category: 'Traffic Management',
    description: 'Dynamic Message Signs'
  },
  'vms': {
    standards: ['NTCIP 1203', 'NTCIP 1201', 'MULTI'],
    category: 'Traffic Management',
    description: 'Variable Message Signs'
  },
  'cctv': {
    standards: ['NTCIP 1205', 'NTCIP 1201', 'ONVIF'],
    category: 'Traffic Management',
    description: 'Closed Circuit Television Cameras'
  },
  'camera': {
    standards: ['NTCIP 1205', 'NTCIP 1201', 'ONVIF'],
    category: 'Traffic Management',
    description: 'Traffic Cameras'
  },
  'tss': {
    standards: ['NTCIP 1204', 'NTCIP 1201'],
    category: 'Traffic Management',
    description: 'Traffic Signal System'
  },
  'ramp_meter': {
    standards: ['NTCIP 1207', 'NTCIP 1201'],
    category: 'Traffic Management',
    description: 'Ramp Metering System'
  },

  // Weather Monitoring Standards
  'rwis': {
    standards: ['NTCIP 1204', 'NTCIP 1201', 'RWIS'],
    category: 'Weather',
    description: 'Road Weather Information System'
  },
  'ess': {
    standards: ['NTCIP 1204', 'NTCIP 1201', 'ESS'],
    category: 'Weather',
    description: 'Environmental Sensor Station'
  },
  'weather_station': {
    standards: ['NTCIP 1204', 'NTCIP 1201'],
    category: 'Weather',
    description: 'Weather Monitoring Station'
  },

  // Connected Vehicle Standards
  'rsu': {
    standards: ['SAE J2735', 'SAE J2945', 'IEEE 1609.3', 'IEEE 1609.4', 'DSRC', 'C-V2X'],
    category: 'Connected Vehicle',
    description: 'Roadside Unit'
  },
  'v2x': {
    standards: ['SAE J2735', 'SAE J2945', 'IEEE 1609.3', 'IEEE 1609.4'],
    category: 'Connected Vehicle',
    description: 'Vehicle-to-Everything Communication'
  },
  'obu': {
    standards: ['SAE J2735', 'SAE J2945', 'IEEE 1609.3'],
    category: 'Connected Vehicle',
    description: 'On-Board Unit'
  },

  // Detection & Sensors
  'detector': {
    standards: ['NTCIP 1202', 'NTCIP 1201'],
    category: 'Detection',
    description: 'Traffic Detector'
  },
  'radar': {
    standards: ['NTCIP 1202', 'NTCIP 1201'],
    category: 'Detection',
    description: 'Radar Sensor'
  },
  'lidar': {
    standards: ['NTCIP 1202', 'NTCIP 1201'],
    category: 'Detection',
    description: 'LiDAR Sensor'
  },

  // Work Zone & Events
  'wz_sensor': {
    standards: ['WZDx', 'TMDD', 'IEEE 1512'],
    category: 'Work Zones',
    description: 'Work Zone Sensor'
  },
  'pcms': {
    standards: ['NTCIP 1203', 'WZDx'],
    category: 'Work Zones',
    description: 'Portable Changeable Message Sign'
  },

  // Gate & Access Control
  'gate': {
    standards: ['NTCIP 1213', 'NTCIP 1201'],
    category: 'Access Control',
    description: 'Highway Gate'
  },

  // HAR (Highway Advisory Radio)
  'har': {
    standards: ['IEEE 1512', 'TMDD'],
    category: 'Traveler Information',
    description: 'Highway Advisory Radio'
  }
};

/**
 * Required metadata fields for compliance
 */
const REQUIRED_FIELDS = {
  basic: [
    'id',
    'equipment_type',
    'latitude',
    'longitude'
  ],
  location: [
    'route',
    'milepost',
    'direction'
  ],
  operational: [
    'status',
    'last_updated',
    'install_date'
  ],
  technical: [
    'manufacturer',
    'model',
    'firmware_version',
    'ip_address'
  ],
  maintenance: [
    'maintenance_responsible',
    'warranty_expiration',
    'last_maintenance_date'
  ]
};

/**
 * Calculate compliance score for a single piece of equipment
 */
function calculateEquipmentCompliance(equipment) {
  let score = 0;
  let maxScore = 0;
  const issues = [];
  const metIssues = [];

  // Basic fields (30 points)
  REQUIRED_FIELDS.basic.forEach(field => {
    maxScore += 30 / REQUIRED_FIELDS.basic.length;
    if (equipment[field] && equipment[field] !== null && equipment[field] !== '') {
      score += 30 / REQUIRED_FIELDS.basic.length;
    } else {
      issues.push({
        field,
        category: 'basic',
        severity: 'critical',
        message: `Missing required field: ${field}`
      });
    }
  });

  // Location fields (25 points)
  REQUIRED_FIELDS.location.forEach(field => {
    maxScore += 25 / REQUIRED_FIELDS.location.length;
    if (equipment[field] && equipment[field] !== null && equipment[field] !== '') {
      score += 25 / REQUIRED_FIELDS.location.length;
    } else {
      issues.push({
        field,
        category: 'location',
        severity: 'high',
        message: `Missing location field: ${field}`
      });
    }
  });

  // Operational fields (20 points)
  REQUIRED_FIELDS.operational.forEach(field => {
    maxScore += 20 / REQUIRED_FIELDS.operational.length;
    if (equipment[field] && equipment[field] !== null && equipment[field] !== '') {
      score += 20 / REQUIRED_FIELDS.operational.length;
    } else {
      issues.push({
        field,
        category: 'operational',
        severity: 'medium',
        message: `Missing operational field: ${field}`
      });
    }
  });

  // Technical fields (15 points)
  REQUIRED_FIELDS.technical.forEach(field => {
    maxScore += 15 / REQUIRED_FIELDS.technical.length;
    if (equipment[field] && equipment[field] !== null && equipment[field] !== '') {
      score += 15 / REQUIRED_FIELDS.technical.length;
    } else {
      issues.push({
        field,
        category: 'technical',
        severity: 'low',
        message: `Missing technical field: ${field}`
      });
    }
  });

  // Maintenance fields (10 points)
  REQUIRED_FIELDS.maintenance.forEach(field => {
    maxScore += 10 / REQUIRED_FIELDS.maintenance.length;
    if (equipment[field] && equipment[field] !== null && equipment[field] !== '') {
      score += 10 / REQUIRED_FIELDS.maintenance.length;
    } else {
      issues.push({
        field,
        category: 'maintenance',
        severity: 'low',
        message: `Missing maintenance field: ${field}`
      });
    }
  });

  // Standards compliance check
  const equipmentType = equipment.equipment_type?.toLowerCase() ||
                         equipment.equipment_subtype?.toLowerCase() || '';

  let applicableStandards = [];
  let standardsCompliance = 'unknown';

  // Find matching standard
  for (const [type, config] of Object.entries(ITS_STANDARDS)) {
    if (equipmentType.includes(type)) {
      applicableStandards = config.standards;
      // Check if equipment has standards field populated
      if (equipment.standards && equipment.standards.length > 0) {
        standardsCompliance = 'documented';
      } else {
        standardsCompliance = 'undocumented';
        issues.push({
          field: 'standards',
          category: 'standards',
          severity: 'high',
          message: `Equipment should comply with: ${applicableStandards.join(', ')}`
        });
      }
      break;
    }
  }

  // Calculate final percentage
  const compliancePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  // Determine compliance level
  let complianceLevel = 'insufficient';
  if (compliancePercent >= 90) complianceLevel = 'excellent';
  else if (compliancePercent >= 75) complianceLevel = 'good';
  else if (compliancePercent >= 60) complianceLevel = 'adequate';
  else if (compliancePercent >= 40) complianceLevel = 'poor';

  return {
    equipment_id: equipment.id,
    equipment_type: equipment.equipment_type,
    compliance_percent: compliancePercent,
    compliance_level: complianceLevel,
    score: Math.round(score),
    max_score: Math.round(maxScore),
    applicable_standards: applicableStandards,
    standards_compliance: standardsCompliance,
    issues: issues,
    fields_present: Object.keys(equipment).filter(k => equipment[k] !== null && equipment[k] !== '').length,
    total_fields: Object.keys(equipment).length
  };
}

/**
 * Analyze standards compliance for an equipment inventory
 */
function analyzeStandardsCompliance(equipment) {
  const complianceResults = equipment.map(eq => calculateEquipmentCompliance(eq));

  // Overall statistics
  const totalEquipment = complianceResults.length;
  const avgCompliance = totalEquipment > 0 ?
    Math.round(complianceResults.reduce((sum, r) => sum + r.compliance_percent, 0) / totalEquipment) : 0;

  // Group by compliance level
  const byLevel = {
    excellent: complianceResults.filter(r => r.compliance_level === 'excellent').length,
    good: complianceResults.filter(r => r.compliance_level === 'good').length,
    adequate: complianceResults.filter(r => r.compliance_level === 'adequate').length,
    poor: complianceResults.filter(r => r.compliance_level === 'poor').length,
    insufficient: complianceResults.filter(r => r.compliance_level === 'insufficient').length
  };

  // Group by equipment type
  const byType = {};
  complianceResults.forEach(r => {
    const type = r.equipment_type || 'unknown';
    if (!byType[type]) {
      byType[type] = {
        count: 0,
        avg_compliance: 0,
        total_compliance: 0
      };
    }
    byType[type].count++;
    byType[type].total_compliance += r.compliance_percent;
  });

  // Calculate averages for each type
  Object.keys(byType).forEach(type => {
    byType[type].avg_compliance = Math.round(byType[type].total_compliance / byType[type].count);
  });

  // Identify all applicable standards
  const allStandards = new Set();
  Object.values(ITS_STANDARDS).forEach(config => {
    config.standards.forEach(std => allStandards.add(std));
  });

  // Critical issues (critical & high severity)
  const criticalIssues = complianceResults
    .flatMap(r => r.issues.filter(i => i.severity === 'critical' || i.severity === 'high'))
    .reduce((acc, issue) => {
      const key = issue.field;
      if (!acc[key]) {
        acc[key] = { field: key, count: 0, severity: issue.severity };
      }
      acc[key].count++;
      return acc;
    }, {});

  const topIssues = Object.values(criticalIssues)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Standards coverage
  const standardsCoverage = {};
  complianceResults.forEach(r => {
    r.applicable_standards.forEach(std => {
      if (!standardsCoverage[std]) {
        standardsCoverage[std] = {
          standard: std,
          equipment_count: 0,
          documented: 0,
          undocumented: 0
        };
      }
      standardsCoverage[std].equipment_count++;
      if (r.standards_compliance === 'documented') {
        standardsCoverage[std].documented++;
      } else {
        standardsCoverage[std].undocumented++;
      }
    });
  });

  // Recommendations
  const recommendations = generateComplianceRecommendations(
    complianceResults,
    byLevel,
    topIssues,
    avgCompliance
  );

  return {
    summary: {
      total_equipment: totalEquipment,
      average_compliance: avgCompliance,
      compliant_equipment: byLevel.excellent + byLevel.good,
      non_compliant_equipment: byLevel.poor + byLevel.insufficient,
      needs_improvement: byLevel.adequate
    },
    compliance_distribution: byLevel,
    by_equipment_type: byType,
    standards_coverage: Object.values(standardsCoverage).sort((a, b) => b.equipment_count - a.equipment_count),
    top_issues: topIssues,
    all_standards: Array.from(allStandards).sort(),
    equipment_details: complianceResults.sort((a, b) => a.compliance_percent - b.compliance_percent),
    recommendations: recommendations
  };
}

/**
 * Generate compliance improvement recommendations
 */
function generateComplianceRecommendations(results, byLevel, topIssues, avgCompliance) {
  const recommendations = [];

  // Recommendation 1: Address critical missing fields
  if (topIssues.length > 0) {
    const criticalFields = topIssues.filter(i => i.severity === 'critical');
    if (criticalFields.length > 0) {
      recommendations.push({
        priority: 1,
        title: 'Complete Critical Metadata Fields',
        description: `${criticalFields.reduce((sum, i) => sum + i.count, 0)} equipment assets are missing critical information`,
        action: 'Populate required fields: ' + criticalFields.map(i => i.field).join(', '),
        impact: 'high',
        affected_equipment: criticalFields.reduce((sum, i) => sum + i.count, 0)
      });
    }
  }

  // Recommendation 2: Improve location data
  const locationIssues = topIssues.filter(i =>
    ['route', 'milepost', 'direction', 'latitude', 'longitude'].includes(i.field)
  );
  if (locationIssues.length > 0) {
    recommendations.push({
      priority: 2,
      title: 'Enhance Location Accuracy',
      description: 'Improve GPS coordinates, milepost, and route information for spatial analysis',
      action: 'Verify and update location data using GIS tools or field surveys',
      impact: 'high',
      affected_equipment: locationIssues.reduce((sum, i) => sum + i.count, 0)
    });
  }

  // Recommendation 3: Document standards compliance
  const undocumented = results.filter(r => r.standards_compliance === 'undocumented').length;
  if (undocumented > 0) {
    recommendations.push({
      priority: 3,
      title: 'Document Standards Compliance',
      description: `${undocumented} equipment assets have undocumented standards compliance`,
      action: 'Review equipment configurations and document applicable ITS standards (NTCIP, SAE, IEEE)',
      impact: 'medium',
      affected_equipment: undocumented
    });
  }

  // Recommendation 4: Improve poor performers
  if (byLevel.poor + byLevel.insufficient > 0) {
    recommendations.push({
      priority: 4,
      title: 'Address Low-Compliance Equipment',
      description: `${byLevel.poor + byLevel.insufficient} equipment assets have compliance scores below 60%`,
      action: 'Focus on improving metadata completeness for poorly documented assets',
      impact: 'medium',
      affected_equipment: byLevel.poor + byLevel.insufficient
    });
  }

  // Recommendation 5: Establish maintenance tracking
  const maintenanceIssues = topIssues.filter(i =>
    ['last_maintenance_date', 'warranty_expiration', 'maintenance_responsible'].includes(i.field)
  );
  if (maintenanceIssues.length > 0) {
    recommendations.push({
      priority: 5,
      title: 'Implement Maintenance Tracking',
      description: 'Many assets lack maintenance history and warranty information',
      action: 'Establish maintenance schedules and track service history',
      impact: 'low',
      affected_equipment: maintenanceIssues.reduce((sum, i) => sum + i.count, 0)
    });
  }

  // Recommendation 6: Overall quality improvement
  if (avgCompliance < 75) {
    recommendations.push({
      priority: 6,
      title: 'Systematic Quality Improvement',
      description: `Overall compliance average is ${avgCompliance}%, below the 75% target`,
      action: 'Implement data quality standards and regular audits',
      impact: 'high',
      affected_equipment: results.length
    });
  }

  return recommendations;
}

/**
 * Get standards information for a specific equipment type
 */
function getStandardsForEquipmentType(equipmentType) {
  const type = equipmentType.toLowerCase();

  for (const [key, config] of Object.entries(ITS_STANDARDS)) {
    if (type.includes(key)) {
      return config;
    }
  }

  return {
    standards: [],
    category: 'Unknown',
    description: 'Unknown equipment type'
  };
}

module.exports = {
  analyzeStandardsCompliance,
  calculateEquipmentCompliance,
  getStandardsForEquipmentType,
  ITS_STANDARDS,
  REQUIRED_FIELDS
};

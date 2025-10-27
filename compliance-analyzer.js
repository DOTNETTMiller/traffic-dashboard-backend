// Comprehensive Standards Compliance Analyzer
// Evaluates traffic events against SAE J2735, WZDx v4.x, and TMDD/ngTMDD standards

class ComplianceAnalyzer {
  constructor() {
    // Field weights for scoring
    this.fieldWeights = {
      // Critical fields (10 points each)
      id: 10,
      coordinates: 10,
      location: 10,
      startDate: 10,

      // Important fields (7 points each)
      type: 7,
      severity: 7,
      description: 7,
      state: 7,

      // Moderate fields (5 points each)
      endDate: 5,
      direction: 5,
      lanesClosed: 5,
      roadStatus: 5,

      // Optional fields (3 points each)
      corridor: 3,
      source: 3,
      category: 3
    };

    // Field name mappings - recognizes data in different formats
    this.fieldMappings = {
      startDate: ['startDate', 'start_date', 'startTime', 'start_time', 'start'],
      endDate: ['endDate', 'end_date', 'endTime', 'end_time', 'end'],
      type: ['type', 'eventType', 'event_type', 'category', 'event_category'],
      lanesClosed: ['lanesClosed', 'lanes_closed', 'lanesAffected', 'lanes_affected', 'closedLanes'],
      coordinates: ['coordinates', 'geometry.coordinates'],
      description: ['description', 'headline', 'summary', 'title'],
      severity: ['severity', 'impact', 'priority'],
      direction: ['direction', 'travelDirection', 'travel_direction'],
      roadStatus: ['roadStatus', 'road_status', 'status', 'roadway_status']
    };
  }

  // Helper: Get field value from event, trying multiple possible field names
  getFieldValue(event, standardFieldName) {
    const possibleNames = this.fieldMappings[standardFieldName] || [standardFieldName];

    for (const fieldName of possibleNames) {
      // Handle nested fields like "geometry.coordinates"
      if (fieldName.includes('.')) {
        const parts = fieldName.split('.');
        let value = event;
        for (const part of parts) {
          value = value?.[part];
          if (value === undefined) break;
        }
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      } else {
        const value = event[fieldName];
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }
    }

    // Special handling for coordinates from lat/lng
    if (standardFieldName === 'coordinates') {
      const lat = event.latitude || event.lat;
      const lng = event.longitude || event.lon || event.lng;
      if (lat !== undefined && lng !== undefined && lat !== 0 && lng !== 0) {
        return [lng, lat];  // GeoJSON format: [longitude, latitude]
      }
    }

    return null;
  }

  // Helper: Check if event has a field (in any variation)
  hasField(event, standardFieldName) {
    return this.getFieldValue(event, standardFieldName) !== null;
  }

  // Main analysis function for a state
  analyzeState(stateKey, stateName, events) {
    if (!events || events.length === 0) {
      return this.getEmptyStateAnalysis(stateKey, stateName);
    }

    const fieldAnalysis = this.analyzeFieldCompleteness(events);
    const wzdxScore = this.analyzeWZDxCompliance(events);
    const saeScore = this.analyzeSAEJ2735Compliance(events);
    const tmddScore = this.analyzeTMDDCompliance(events);

    // Calculate overall composite score
    const overallScore = this.calculateCompositeScore(wzdxScore, saeScore, tmddScore);

    // Generate action plan
    const actionPlan = this.generateActionPlan(fieldAnalysis, events);

    // C2C compliance
    const c2cCompliance = this.analyzeC2CCompliance(events);

    // Multi-standard compliance
    const multiStandardCompliance = this.analyzeMultiStandardCompliance(
      wzdxScore, saeScore, tmddScore, events
    );

    return {
      state: stateName,
      stateKey: stateKey,
      generatedAt: new Date().toISOString(),
      eventCount: events.length,
      currentFormat: this.detectCurrentFormat(events),
      overallScore: overallScore,
      multiStandardCompliance: multiStandardCompliance,
      c2cCompliance: c2cCompliance,
      fieldLevelAnalysis: this.generateFieldLevelAnalysis(events),
      categoryScores: this.generateCategoryScores(fieldAnalysis),
      actionPlan: actionPlan,
      improvementPotential: this.calculateImprovementPotential(actionPlan, overallScore),
      complianceGuideUrl: `/api/compliance/state/${stateKey}`
    };
  }

  // Analyze WZDx v4.x compliance
  analyzeWZDxCompliance(events) {
    const requiredFields = [
      'id', 'type', 'geometry', 'properties.road_names',
      'properties.direction', 'properties.start_date'
    ];

    let totalScore = 0;
    const violations = [];

    events.forEach(event => {
      let eventScore = 0;

      // Check core WZDx fields using normalized field access
      if (event.id) eventScore += 15;
      if (this.hasField(event, 'type')) eventScore += 10;
      if (this.hasField(event, 'coordinates')) eventScore += 15;
      if (event.location) eventScore += 10;
      if (this.hasField(event, 'direction')) eventScore += 10;
      if (this.hasField(event, 'startDate')) eventScore += 15;
      if (this.hasField(event, 'endDate')) eventScore += 10;
      if (this.hasField(event, 'roadStatus')) eventScore += 10;
      if (this.hasField(event, 'lanesClosed')) eventScore += 5;

      totalScore += eventScore;

      if (eventScore < 50) {
        violations.push({
          eventId: event.id,
          score: eventScore,
          missing: this.getMissingFields(event, requiredFields)
        });
      }
    });

    const avgScore = Math.round(totalScore / events.length);
    const percentage = Math.min(100, avgScore);

    return {
      percentage: percentage,
      grade: this.getLetterGrade(percentage),
      status: percentage >= 80 ? 'Compliant' : percentage >= 60 ? 'Partially Compliant' : 'Non-Compliant',
      violations: violations.slice(0, 10)
    };
  }

  // Analyze SAE J2735 compliance
  analyzeSAEJ2735Compliance(events) {
    let totalScore = 0;
    const violations = [];

    events.forEach(event => {
      let eventScore = 0;

      // SAE J2735 core message elements
      if (event.id) eventScore += 15; // msgID
      if (event.coordinates) eventScore += 20; // Position3D
      if (event.type) eventScore += 10; // itis codes
      if (event.severity) eventScore += 10; // priority
      if (event.startDate) eventScore += 15; // timeDetails
      if (event.description) eventScore += 10; // advisory message
      if (event.direction) eventScore += 10; // heading
      if (event.lanesClosed) eventScore += 10; // lane data

      totalScore += eventScore;

      if (eventScore < 60) {
        violations.push({
          eventId: event.id,
          score: eventScore
        });
      }
    });

    const avgScore = Math.round(totalScore / events.length);
    const percentage = Math.min(100, avgScore);

    return {
      percentage: percentage,
      grade: this.getLetterGrade(percentage),
      status: percentage >= 80 ? 'V2X Ready' : percentage >= 60 ? 'Partial Support' : 'Limited Support',
      violations: violations.slice(0, 10)
    };
  }

  // Analyze TMDD/ngTMDD compliance
  analyzeTMDDCompliance(events) {
    let totalScore = 0;
    const violations = [];

    events.forEach(event => {
      let eventScore = 0;

      // TMDD/ngTMDD required elements
      if (event.id) eventScore += 15; // organization-incident-id
      if (event.type) eventScore += 10; // event-type
      if (event.location) eventScore += 15; // event-locations
      if (event.startDate) eventScore += 15; // start-time
      if (event.severity) eventScore += 10; // event-severity
      if (event.state) eventScore += 10; // organization-id
      if (event.description) eventScore += 10; // event-description
      if (event.roadStatus) eventScore += 10; // event-status
      if (event.direction) eventScore += 5; // direction

      totalScore += eventScore;

      if (eventScore < 60) {
        violations.push({
          eventId: event.id,
          score: eventScore
        });
      }
    });

    const avgScore = Math.round(totalScore / events.length);
    const percentage = Math.min(100, avgScore);

    return {
      percentage: percentage,
      grade: this.getLetterGrade(percentage),
      status: percentage >= 80 ? 'C2C Ready' : percentage >= 60 ? 'Needs Enhancement' : 'Requires Work',
      violations: violations.slice(0, 10)
    };
  }

  // Calculate composite score across all standards
  calculateCompositeScore(wzdx, sae, tmdd) {
    // Weighted average: WZDx 40%, SAE 35%, TMDD 25%
    const percentage = Math.round(
      (wzdx.percentage * 0.4) +
      (sae.percentage * 0.35) +
      (tmdd.percentage * 0.25)
    );

    const grade = this.getLetterGrade(percentage);

    let rank, message;
    if (percentage >= 90) {
      rank = '🏆 Excellent - Multi-Standard Leader';
      message = 'Outstanding compliance across all standards';
    } else if (percentage >= 80) {
      rank = '⭐ Very Good - Production Ready';
      message = 'Strong compliance, minor improvements available';
    } else if (percentage >= 70) {
      rank = '✓ Good - Operational';
      message = 'Acceptable compliance, some gaps to address';
    } else if (percentage >= 60) {
      rank = '⚠ Fair - Needs Improvement';
      message = 'Basic compliance, significant gaps present';
    } else {
      rank = '❌ Poor - Action Required';
      message = 'Major compliance issues, immediate action needed';
    }

    return {
      percentage: percentage,
      grade: grade,
      rank: rank,
      message: message,
      breakdown: {
        wzdx: wzdx,
        sae: sae,
        tmdd: tmdd
      }
    };
  }

  // Analyze field completeness using normalized field access
  analyzeFieldCompleteness(events) {
    const fieldStats = {};

    Object.keys(this.fieldWeights).forEach(field => {
      fieldStats[field] = {
        present: 0,
        missing: 0,
        examples: []
      };
    });

    events.forEach(event => {
      Object.keys(this.fieldWeights).forEach(field => {
        // Use normalized field access to check for data in any format
        if (this.hasField(event, field)) {
          fieldStats[field].present++;
        } else {
          fieldStats[field].missing++;
          if (fieldStats[field].examples.length < 5) {
            fieldStats[field].examples.push(event.id);
          }
        }
      });
    });

    return fieldStats;
  }

  // Generate field-level violation analysis
  generateFieldLevelAnalysis(events) {
    const violations = [];
    const sampleEvent = events[0] || {};
    const feedType = sampleEvent.source?.includes('WZDx') ? 'WZDx' : 'TMDD';

    // Check for missing coordinates (using normalized field access)
    const missingCoords = events.filter(e => !this.hasField(e, 'coordinates'));
    if (missingCoords.length > events.length * 0.1) {
      violations.push({
        category: 'Missing Geographic Coordinates',
        severity: 'CRITICAL',
        count: missingCoords.length,
        specRequirement: feedType === 'WZDx' ?
          'WZDx v4.x requires geometry.coordinates for all features' :
          'TMDD requires event-location with latitude/longitude',
        impact: 'Events cannot be mapped or used for location-based queries',
        recommendation: 'Add latitude/longitude coordinates for all events',
        examples: missingCoords.slice(0, 5).map(e => ({
          eventId: e.id,
          location: e.location,
          missingFields: ['coordinates']
        }))
      });
    }

    // Check for missing timestamps
    const missingStart = events.filter(e => !e.startDate);
    if (missingStart.length > 0) {
      violations.push({
        category: 'Missing Start Time',
        severity: 'HIGH',
        count: missingStart.length,
        specRequirement: feedType === 'WZDx' ?
          'WZDx v4.x requires properties.start_date' :
          'TMDD requires event-element-details.update-time',
        impact: 'Cannot determine when events began or filter by time',
        recommendation: 'Include start_date/update_time for all events',
        examples: missingStart.slice(0, 5).map(e => ({
          eventId: e.id,
          location: e.location,
          missingFields: ['startDate']
        }))
      });
    }

    // Check for missing direction
    const missingDirection = events.filter(e => !e.direction);
    if (missingDirection.length > events.length * 0.2) {
      violations.push({
        category: 'Missing Travel Direction',
        severity: 'MEDIUM',
        count: missingDirection.length,
        specRequirement: feedType === 'WZDx' ?
          'WZDx v4.x recommends properties.direction for directional impacts' :
          'TMDD recommends event-lane.lane-roadway-direction',
        impact: 'Cannot determine which direction of travel is affected',
        recommendation: 'Add direction indicator (N/S/E/W or northbound/southbound)',
        examples: missingDirection.slice(0, 5).map(e => ({
          eventId: e.id,
          location: e.location,
          missingFields: ['direction']
        }))
      });
    }

    return {
      feedType: feedType,
      evaluationStandard: feedType === 'WZDx' ? 'WZDx v4.x Specification' : 'TMDD v3.1 / ngTMDD via C2C-MVT',
      summary: `Analyzed ${events.length} events and found ${violations.length} violation categories`,
      violationCategories: violations
    };
  }

  // Generate category-based scores
  generateCategoryScores(fieldStats) {
    return {
      essential: {
        name: 'Essential Information',
        fields: [
          {
            field: 'Event ID',
            status: fieldStats.id.present > fieldStats.id.missing ? 'PASS' : 'FAIL',
            score: Math.round((fieldStats.id.present / (fieldStats.id.present + fieldStats.id.missing)) * 100),
            currentPoints: fieldStats.id.present * this.fieldWeights.id,
            maxPoints: (fieldStats.id.present + fieldStats.id.missing) * this.fieldWeights.id,
            impact: 'Unique identifier for event tracking'
          },
          {
            field: 'Coordinates',
            status: fieldStats.coordinates.present > fieldStats.coordinates.missing ? 'PASS' : 'FAIL',
            score: Math.round((fieldStats.coordinates.present / (fieldStats.coordinates.present + fieldStats.coordinates.missing)) * 100),
            currentPoints: fieldStats.coordinates.present * this.fieldWeights.coordinates,
            maxPoints: (fieldStats.coordinates.present + fieldStats.coordinates.missing) * this.fieldWeights.coordinates,
            impact: 'Geographic location for mapping'
          },
          {
            field: 'Start Date',
            status: fieldStats.startDate.present > fieldStats.startDate.missing ? 'PASS' : 'FAIL',
            score: Math.round((fieldStats.startDate.present / (fieldStats.startDate.present + fieldStats.startDate.missing)) * 100),
            currentPoints: fieldStats.startDate.present * this.fieldWeights.startDate,
            maxPoints: (fieldStats.startDate.present + fieldStats.startDate.missing) * this.fieldWeights.startDate,
            impact: 'When event began'
          }
        ],
        totalScore: fieldStats.id.present * this.fieldWeights.id +
                    fieldStats.coordinates.present * this.fieldWeights.coordinates +
                    fieldStats.startDate.present * this.fieldWeights.startDate,
        maxScore: (fieldStats.id.present + fieldStats.id.missing) * this.fieldWeights.id +
                  (fieldStats.coordinates.present + fieldStats.coordinates.missing) * this.fieldWeights.coordinates +
                  (fieldStats.startDate.present + fieldStats.startDate.missing) * this.fieldWeights.startDate,
        percentage: 0
      },
      details: {
        name: 'Event Details',
        fields: [
          {
            field: 'Type',
            status: fieldStats.type.present > fieldStats.type.missing ? 'PASS' : 'FAIL',
            score: Math.round((fieldStats.type.present / (fieldStats.type.present + fieldStats.type.missing)) * 100),
            currentPoints: fieldStats.type.present * this.fieldWeights.type,
            maxPoints: (fieldStats.type.present + fieldStats.type.missing) * this.fieldWeights.type,
            impact: 'Event classification'
          },
          {
            field: 'Severity',
            status: fieldStats.severity.present > fieldStats.severity.missing ? 'PASS' : 'FAIL',
            score: Math.round((fieldStats.severity.present / (fieldStats.severity.present + fieldStats.severity.missing)) * 100),
            currentPoints: fieldStats.severity.present * this.fieldWeights.severity,
            maxPoints: (fieldStats.severity.present + fieldStats.severity.missing) * this.fieldWeights.severity,
            impact: 'Impact assessment'
          },
          {
            field: 'Description',
            status: fieldStats.description.present > fieldStats.description.missing ? 'PASS' : 'FAIL',
            score: Math.round((fieldStats.description.present / (fieldStats.description.present + fieldStats.description.missing)) * 100),
            currentPoints: fieldStats.description.present * this.fieldWeights.description,
            maxPoints: (fieldStats.description.present + fieldStats.description.missing) * this.fieldWeights.description,
            impact: 'Human-readable details'
          }
        ],
        totalScore: fieldStats.type.present * this.fieldWeights.type +
                    fieldStats.severity.present * this.fieldWeights.severity +
                    fieldStats.description.present * this.fieldWeights.description,
        maxScore: (fieldStats.type.present + fieldStats.type.missing) * this.fieldWeights.type +
                  (fieldStats.severity.present + fieldStats.severity.missing) * this.fieldWeights.severity +
                  (fieldStats.description.present + fieldStats.description.missing) * this.fieldWeights.description,
        percentage: 0
      }
    };
  }

  // Analyze C2C compliance
  analyzeC2CCompliance(events) {
    let score = 0;
    const recommendations = [];

    // Check critical C2C fields
    const hasIds = events.filter(e => e.id).length / events.length;
    const hasCoords = events.filter(e => e.coordinates && e.coordinates.length === 2).length / events.length;
    const hasTimestamps = events.filter(e => e.startDate).length / events.length;
    const hasLocation = events.filter(e => e.location).length / events.length;

    score += hasIds * 25;
    score += hasCoords * 25;
    score += hasTimestamps * 25;
    score += hasLocation * 25;

    if (hasIds < 0.9) {
      recommendations.push({
        field: 'Event ID',
        importance: 'CRITICAL',
        issue: `Only ${Math.round(hasIds * 100)}% of events have unique IDs`,
        solution: 'Add unique identifiers to all events for C2C tracking'
      });
    }

    if (hasCoords < 0.9) {
      recommendations.push({
        field: 'Geographic Coordinates',
        importance: 'CRITICAL',
        issue: `Only ${Math.round(hasCoords * 100)}% of events have coordinates`,
        solution: 'Include latitude/longitude for all events'
      });
    }

    const finalScore = Math.round(score);

    return {
      score: finalScore,
      grade: finalScore >= 80 ? 'PASS' : 'FAIL',
      message: finalScore >= 80 ?
        'Data meets C2C requirements for inter-agency communication' :
        `Score of ${finalScore}/100 - Improvements needed for C2C readiness`,
      validationTool: 'C2C-MVT Analysis',
      recommendations: recommendations
    };
  }

  // Analyze multi-standard compliance
  analyzeMultiStandardCompliance(wzdx, sae, tmdd, events) {
    const crossStandardRecommendations = [];

    // Find cross-standard improvement opportunities
    if (wzdx.percentage < 90 || sae.percentage < 90 || tmdd.percentage < 90) {
      const missingCoords = events.filter(e => !e.coordinates).length;
      if (missingCoords > 0) {
        crossStandardRecommendations.push({
          issue: 'Missing Coordinates',
          currentCoverage: `${Math.round((events.length - missingCoords) / events.length * 100)}%`,
          recommendation: 'Add latitude/longitude coordinates to all events',
          benefitsStandards: ['WZDx', 'SAE J2735', 'TMDD'],
          priority: 'CRITICAL',
          pointsGained: {
            wzdx: 15,
            sae: 20,
            tmdd: 15
          }
        });
      }
    }

    return {
      summary: {
        message: `Analyzed ${events.length} events across 3 industry standards`,
        eventsAnalyzed: events.length,
        evaluationDate: new Date().toISOString()
      },
      wzdx: wzdx,
      sae: sae,
      tmdd: tmdd,
      crossStandardRecommendations: crossStandardRecommendations,
      gradeRoadmap: {
        wzdx: {
          pointsNeeded: Math.max(0, 90 - wzdx.percentage),
          estimatedEffort: wzdx.percentage >= 80 ? 'Low (1-2 weeks)' : 'Medium (1-2 months)'
        },
        sae: {
          pointsNeeded: Math.max(0, 90 - sae.percentage),
          estimatedEffort: sae.percentage >= 80 ? 'Low (1-2 weeks)' : 'Medium (1-2 months)'
        },
        tmdd: {
          pointsNeeded: Math.max(0, 90 - tmdd.percentage),
          estimatedEffort: tmdd.percentage >= 80 ? 'Low (1-2 weeks)' : 'Medium (1-2 months)'
        }
      }
    };
  }

  // Generate actionable improvement plan
  generateActionPlan(fieldStats, events) {
    const immediate = [];
    const shortTerm = [];
    const longTerm = [];

    Object.entries(fieldStats).forEach(([field, stats]) => {
      const total = stats.present + stats.missing;
      const percentage = Math.round((stats.present / total) * 100);
      const weight = this.fieldWeights[field];

      if (percentage < 50 && weight >= 7) {
        immediate.push({
          field: field,
          currentScore: percentage,
          pointsGained: stats.missing * weight,
          impact: `Critical field missing in ${stats.missing} events`
        });
      } else if (percentage < 80 && weight >= 5) {
        shortTerm.push({
          field: field,
          currentScore: percentage,
          pointsGained: stats.missing * weight
        });
      } else if (percentage < 100) {
        longTerm.push({
          field: field,
          currentScore: percentage,
          pointsGained: stats.missing * weight
        });
      }
    });

    return {
      immediate: immediate.slice(0, 5),
      shortTerm: shortTerm.slice(0, 5),
      longTerm: longTerm.slice(0, 5)
    };
  }

  // Calculate improvement potential
  calculateImprovementPotential(actionPlan, overallScore) {
    const immediateGain = actionPlan.immediate.reduce((sum, item) => sum + item.pointsGained, 0);

    if (immediateGain > 0) {
      const potentialIncrease = Math.min(20, Math.round(immediateGain / 10));
      const newPercentage = Math.min(100, overallScore.percentage + potentialIncrease);

      return {
        immediateActions: actionPlan.immediate.length,
        potentialScoreIncrease: potentialIncrease,
        newGradeIfFixed: this.getLetterGrade(newPercentage),
        message: `Addressing ${actionPlan.immediate.length} critical issues could improve score by ${potentialIncrease} points`
      };
    }

    return {
      immediateActions: 0,
      potentialScoreIncrease: 0,
      newGradeIfFixed: overallScore.grade,
      message: 'No immediate critical issues found'
    };
  }

  // Detect current data format
  detectCurrentFormat(events) {
    const sample = events[0] || {};

    if (sample.source?.includes('WZDx')) {
      return 'WZDx v4.x (GeoJSON)';
    } else if (sample.source?.includes('TMDD')) {
      return 'TMDD/ngTMDD (XML/JSON)';
    } else {
      return 'Custom/Proprietary (JSON)';
    }
  }

  // Get letter grade from percentage
  getLetterGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  // Get missing fields for an event
  getMissingFields(event, requiredFields) {
    const missing = [];
    requiredFields.forEach(field => {
      const parts = field.split('.');
      let value = event;
      for (const part of parts) {
        if (!value || !value[part]) {
          missing.push(field);
          break;
        }
        value = value[part];
      }
    });
    return missing;
  }

  // Get empty analysis for states with no events
  getEmptyStateAnalysis(stateKey, stateName) {
    return {
      state: stateName,
      stateKey: stateKey,
      generatedAt: new Date().toISOString(),
      eventCount: 0,
      currentFormat: { apiType: 'Unknown', format: 'N/A' },
      overallScore: {
        percentage: 0,
        grade: 'N/A',
        rank: 'No Data',
        message: 'No events available for analysis'
      }
    };
  }
}

module.exports = ComplianceAnalyzer;

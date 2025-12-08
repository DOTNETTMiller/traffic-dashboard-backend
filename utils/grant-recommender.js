/**
 * Grant Recommendation Engine
 *
 * Analyzes project characteristics and recommends appropriate federal grant programs
 * and block funding opportunities.
 */

const GRANT_PROGRAMS = {
  SMART: {
    name: 'SMART Grant',
    fullName: 'Strengthening Mobility and Revolutionizing Transportation',
    matchScore: (project) => {
      let score = 0;

      // Technology keywords
      if (project.description?.match(/connected vehicle|v2x|automated|sensor|its|smart|technology/i)) score += 30;
      if (project.description?.match(/coordination|integration|data sharing/i)) score += 20;
      if (project.hasITSEquipment) score += 25;
      if (project.hasV2XGaps) score += 20;
      if (project.fundingRange >= 2000000 && project.fundingRange <= 15000000) score += 10;

      return Math.min(score, 100);
    },
    minAward: 2000000,
    maxAward: 15000000,
    matchRequired: 0.5,
    keyIndicators: ['ITS deployment', 'Connected vehicles', 'Automation', 'Coordination']
  },

  ATCMTD: {
    name: 'ATCMTD',
    fullName: 'Advanced Transportation & Congestion Management Technologies Deployment',
    matchScore: (project) => {
      let score = 0;

      if (project.description?.match(/traffic signal|congestion|traveler information|v2i|its/i)) score += 35;
      if (project.description?.match(/automated|pricing|optimization/i)) score += 25;
      if (project.hasITSEquipment) score += 30;
      if (project.fundingRange >= 2000000 && project.fundingRange <= 12000000) score += 10;

      return Math.min(score, 100);
    },
    minAward: 2000000,
    maxAward: 12000000,
    matchRequired: 0.5,
    keyIndicators: ['Traffic management', 'Congestion reduction', 'V2I', 'Signal optimization']
  },

  RAISE: {
    name: 'RAISE Grant',
    fullName: 'Rebuilding American Infrastructure with Sustainability and Equity',
    matchScore: (project) => {
      let score = 0;

      if (project.description?.match(/multimodal|safety|sustainability|equity|quality of life/i)) score += 30;
      if (project.description?.match(/economic|mobility|community|connectivity/i)) score += 20;
      if (project.geographicScope === 'regional' || project.geographicScope === 'multi-state') score += 15;
      if (project.hasIncidentData) score += 15;
      if (project.fundingRange >= 5000000 && project.fundingRange <= 25000000) score += 10;
      if (project.hasBCA) score += 10;

      return Math.min(score, 100);
    },
    minAward: 5000000,
    maxAward: 25000000,
    matchRequired: 0.2,
    keyIndicators: ['Multimodal', 'Safety', 'Sustainability', 'Community connectivity']
  },

  INFRA: {
    name: 'INFRA Grant',
    fullName: 'Infrastructure for Rebuilding America',
    matchScore: (project) => {
      let score = 0;

      if (project.description?.match(/freight|highway|corridor|infrastructure|multimodal/i)) score += 30;
      if (project.description?.match(/economic|competitiveness|safety/i)) score += 20;
      if (project.isFreightCorridor) score += 25;
      if (project.fundingRange >= 25000000) score += 20;
      if (project.hasBCA) score += 5;

      return Math.min(score, 100);
    },
    minAward: 25000000,
    maxAward: 100000000,
    matchRequired: 0.3,
    keyIndicators: ['Freight', 'Major infrastructure', 'Economic impact', 'Large scale']
  },

  PROTECT: {
    name: 'PROTECT Grant',
    fullName: 'Promoting Resilient Operations for Transformative, Efficient, and Cost-Saving Transportation',
    matchScore: (project) => {
      let score = 0;

      if (project.description?.match(/resilience|resilient|evacuation|disaster|emergency|flooding|weather/i)) score += 35;
      if (project.description?.match(/at-risk|vulnerable|climate|natural disaster/i)) score += 25;
      if (project.description?.match(/monitoring|real-time|sensor/i)) score += 20;
      if (project.hasBridgeData) score += 15;
      if (project.fundingRange >= 5000000 && project.fundingRange <= 50000000) score += 5;

      return Math.min(score, 100);
    },
    minAward: 5000000,
    maxAward: 50000000,
    matchRequired: 0.25, // Competitive grants
    keyIndicators: ['Resilience', 'Emergency management', 'Disaster protection', 'Monitoring']
  },

  FMCSA_ITD: {
    name: 'FMCSA IT-D',
    fullName: 'Commercial Motor Vehicle Information Technology and Data Grant',
    matchScore: (project) => {
      let score = 0;

      if (project.description?.match(/commercial vehicle|cmv|truck|freight|weigh station/i)) score += 40;
      if (project.description?.match(/safety data|electronic screening|credential|bypass/i)) score += 30;
      if (project.description?.match(/truck parking|parking availability|atri|parking infrastructure|rest area/i)) score += 25;
      if (project.hasTruckParkingData) score += 20;
      if (project.isFreightCorridor) score += 15;
      if (project.fundingRange >= 500000 && project.fundingRange <= 3000000) score += 10;

      return Math.min(score, 100);
    },
    minAward: 500000,
    maxAward: 3000000,
    matchRequired: 0.2,
    keyIndicators: ['Commercial vehicles', 'Freight safety', 'Truck parking', 'Weigh stations', 'CMV data', 'ATRI data integration']
  }
};

const BLOCK_GRANT_PROGRAMS = {
  HSIP: {
    name: 'Highway Safety Improvement Program (HSIP)',
    type: 'Formula/Block Grant',
    focus: 'Safety improvements at high-risk locations',
    matchScore: (project) => {
      let score = 0;
      if (project.description?.match(/safety|crash|fatality|injury|high-risk|hazard/i)) score += 40;
      if (project.hasIncidentData) score += 30;
      if (project.hasCrashData) score += 20;
      if (project.fundingRange <= 5000000) score += 10;
      return Math.min(score, 100);
    },
    administered: 'State DOT',
    noMatch: false,
    keyIndicators: ['Safety improvements', 'Crash reduction', 'Data-driven', 'Systemic safety']
  },

  CMAQ: {
    name: 'Congestion Mitigation and Air Quality (CMAQ)',
    type: 'Formula/Block Grant',
    focus: 'Projects that reduce congestion and improve air quality',
    matchScore: (project) => {
      let score = 0;
      if (project.description?.match(/congestion|air quality|emissions|traffic flow|transit/i)) score += 40;
      if (project.description?.match(/signal|optimization|its|transit/i)) score += 25;
      if (project.inNonAttainmentArea) score += 25;
      if (project.fundingRange <= 10000000) score += 10;
      return Math.min(score, 100);
    },
    administered: 'State DOT / MPO',
    noMatch: false,
    keyIndicators: ['Congestion relief', 'Air quality', 'Traffic management', 'Transit']
  },

  STBG: {
    name: 'Surface Transportation Block Grant (STBG)',
    type: 'Formula/Block Grant',
    focus: 'Flexible funding for roads, bridges, transit, and other projects',
    matchScore: (project) => {
      let score = 0;
      if (project.description?.match(/road|bridge|highway|infrastructure|pavement/i)) score += 30;
      if (project.description?.match(/its|traffic signal|pedestrian|bicycle/i)) score += 20;
      if (project.fundingRange <= 5000000) score += 15;
      // STBG is very flexible, so always somewhat relevant
      score += 20;
      return Math.min(score, 100);
    },
    administered: 'State DOT / MPO',
    noMatch: false,
    keyIndicators: ['Flexible use', 'Local projects', 'Infrastructure', 'Broad eligibility']
  },

  TAP: {
    name: 'Transportation Alternatives Program (TAP)',
    type: 'Set-Aside from STBG',
    focus: 'Bicycle/pedestrian facilities, trails, safe routes to school',
    matchScore: (project) => {
      let score = 0;
      if (project.description?.match(/pedestrian|bicycle|trail|sidewalk|safe routes|active transportation/i)) score += 50;
      if (project.description?.match(/multimodal|connectivity|non-motorized/i)) score += 25;
      if (project.fundingRange <= 2000000) score += 15;
      return Math.min(score, 100);
    },
    administered: 'State DOT / MPO',
    noMatch: false,
    keyIndicators: ['Active transportation', 'Pedestrian safety', 'Trails', 'Community connectivity']
  },

  '5339_BUS': {
    name: 'Bus and Bus Facilities (5339)',
    type: 'Formula/Competitive (FTA)',
    focus: 'Transit bus purchases, bus facilities, and related equipment',
    matchScore: (project) => {
      let score = 0;
      if (project.description?.match(/bus|transit|public transportation|fleet/i)) score += 45;
      if (project.description?.match(/facility|garage|maintenance|stop|shelter/i)) score += 25;
      if (project.description?.match(/electric|zero-emission|clean energy/i)) score += 20;
      return Math.min(score, 100);
    },
    administered: 'FTA / State Transit Agency',
    noMatch: false,
    keyIndicators: ['Bus transit', 'Fleet replacement', 'Facilities', 'Clean buses']
  }
};

/**
 * Analyze project and recommend grant programs
 */
function recommendGrants(projectData) {
  const {
    description = '',
    primaryCorridor = '',
    requestedAmount = 0,
    geographicScope = 'state',
    hasITSEquipment = false,
    hasIncidentData = false,
    hasBridgeData = false,
    hasCrashData = false,
    hasBCA = false,
    isFreightCorridor = false,
    hasV2XGaps = false,
    inNonAttainmentArea = false,
    hasTruckParkingData = false
  } = projectData;

  const project = {
    description,
    primaryCorridor,
    fundingRange: requestedAmount,
    geographicScope,
    hasITSEquipment,
    hasIncidentData,
    hasBridgeData,
    hasCrashData,
    hasBCA,
    isFreightCorridor,
    hasV2XGaps,
    inNonAttainmentArea,
    hasTruckParkingData
  };

  // Score competitive grants
  const competitiveScores = Object.entries(GRANT_PROGRAMS).map(([key, program]) => ({
    programKey: key,
    ...program,
    score: program.matchScore(project),
    type: 'competitive'
  }));

  // Score block grants
  const blockGrantScores = Object.entries(BLOCK_GRANT_PROGRAMS).map(([key, program]) => ({
    programKey: key,
    ...program,
    score: program.matchScore(project),
    type: 'block'
  }));

  // Combine and sort
  const allPrograms = [...competitiveScores, ...blockGrantScores]
    .sort((a, b) => b.score - a.score);

  // Categorize recommendations
  const recommendations = {
    topMatches: allPrograms.filter(p => p.score >= 60 && p.type === 'competitive').slice(0, 3),
    additionalCompetitive: allPrograms.filter(p => p.score >= 40 && p.score < 60 && p.type === 'competitive').slice(0, 2),
    blockGrants: allPrograms.filter(p => p.score >= 40 && p.type === 'block').slice(0, 3),
    allScores: allPrograms
  };

  return recommendations;
}

/**
 * Generate recommendation explanation
 */
function explainRecommendation(program, project) {
  const reasons = [];

  if (program.score >= 80) {
    reasons.push('Strong alignment with program objectives');
  } else if (program.score >= 60) {
    reasons.push('Good alignment with program objectives');
  } else {
    reasons.push('Moderate alignment with program objectives');
  }

  // Add specific reasons based on indicators
  program.keyIndicators.slice(0, 2).forEach(indicator => {
    if (project.description?.toLowerCase().includes(indicator.toLowerCase().split(' ')[0])) {
      reasons.push(`Matches "${indicator}" focus area`);
    }
  });

  // Funding range check
  if (program.minAward && program.maxAward) {
    if (project.fundingRange >= program.minAward && project.fundingRange <= program.maxAward) {
      reasons.push(`Request amount within typical award range`);
    } else if (project.fundingRange < program.minAward) {
      reasons.push(`⚠️ Request below typical minimum ($${(program.minAward / 1000000).toFixed(1)}M)`);
    } else if (project.fundingRange > program.maxAward) {
      reasons.push(`⚠️ Request above typical maximum ($${(program.maxAward / 1000000).toFixed(1)}M)`);
    }
  }

  return reasons;
}

module.exports = {
  recommendGrants,
  explainRecommendation,
  GRANT_PROGRAMS,
  BLOCK_GRANT_PROGRAMS
};

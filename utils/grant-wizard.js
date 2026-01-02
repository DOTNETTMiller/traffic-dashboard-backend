/**
 * Grant Application Wizard
 *
 * Assists with federal ITS grant applications (SMART, RAISE, ATCMTD, etc.)
 * Generates application content from architecture analysis
 */

/**
 * Federal ITS Grant Programs
 */
const GRANT_PROGRAMS = {
  SMART: {
    name: 'Strengthening Mobility and Revolutionizing Transportation (SMART)',
    agency: 'USDOT',
    typical_award: '$2M - $15M',
    match_requirement: '20% local match',
    key_focus: [
      'Advanced Smart City/Community Technologies',
      'Coordinated Automation',
      'Connected Vehicles',
      'Smart Grid/Intelligent Sensors',
      'Systems Integration'
    ],
    evaluation_criteria: [
      'Demonstration of Benefits',
      'Collaboration and Partnerships',
      'Scalability and Transferability',
      'Technological Innovation',
      'Project Readiness'
    ]
  },
  RAISE: {
    name: 'Rebuilding American Infrastructure with Sustainability and Equity (RAISE)',
    agency: 'USDOT',
    typical_award: '$5M - $25M',
    match_requirement: '20% for urbanized areas, waived for rural',
    key_focus: [
      'Safety',
      'Environmental Sustainability',
      'Quality of Life',
      'Economic Competitiveness',
      'State of Good Repair',
      'Innovation',
      'Partnership'
    ],
    evaluation_criteria: [
      'Safety',
      'Environmental Sustainability',
      'Quality of Life',
      'Mobility and Community Connectivity',
      'Economic Competitiveness and Opportunity'
    ]
  },
  ATCMTD: {
    name: 'Advanced Transportation and Congestion Management Technologies Deployment (ATCMTD)',
    agency: 'USDOT/FHWA',
    typical_award: '$1M - $12M',
    match_requirement: '50% local match',
    key_focus: [
      'Advanced Traveler Information Systems',
      'Advanced Transportation Management Technologies',
      'ITS Integration',
      'Connected Vehicle Applications',
      'Autonomous Vehicle Technologies'
    ],
    evaluation_criteria: [
      'Innovation',
      'Impact',
      'Partnerships',
      'Data Sharing',
      'Project Readiness'
    ]
  },
  SS4A: {
    name: 'Safe Streets and Roads for All (SS4A)',
    agency: 'USDOT',
    typical_award: '$200K - $25M',
    match_requirement: '20% for implementation grants',
    key_focus: [
      'Vision Zero Strategies',
      'Complete Streets',
      'Traffic Calming',
      'Pedestrian/Bicycle Safety',
      'Data-Driven Safety Analysis'
    ],
    evaluation_criteria: [
      'Crash Data Analysis',
      'Equity Considerations',
      'Community Engagement',
      'Implementation Strategy',
      'Sustainability'
    ]
  }
};

/**
 * Generate grant application content based on regional architecture
 */
function generateGrantApplication(grantType, architectureData, options = {}) {
  const {
    projectTitle = 'Regional ITS Enhancement Project',
    applicant = 'State Department of Transportation',
    stateKey = 'state',
    v2xGaps = null,
    complianceData = null
  } = options;

  const grant = GRANT_PROGRAMS[grantType];
  if (!grant) {
    throw new Error(`Unknown grant type: ${grantType}`);
  }

  // Generate application sections
  const application = {
    metadata: {
      grant_program: grant.name,
      grant_type: grantType,
      project_title: projectTitle,
      applicant,
      generated_at: new Date().toISOString()
    },
    executive_summary: generateExecutiveSummary(grant, architectureData, options),
    project_description: generateProjectDescription(grant, architectureData, options),
    technical_approach: generateTechnicalApproach(grant, architectureData, v2xGaps),
    benefits_analysis: generateBenefitsAnalysis(grant, architectureData, v2xGaps),
    budget_narrative: generateBudgetNarrative(grant, architectureData, v2xGaps),
    evaluation_plan: generateEvaluationPlan(grant, architectureData),
    compliance_documentation: generateComplianceSection(architectureData, complianceData),
    stakeholder_support: generateStakeholderSection(grant),
    timeline: generateProjectTimeline(grant, v2xGaps),
    sustainability: generateSustainabilityPlan(grant),
    innovation_narrative: generateInnovationNarrative(grant, architectureData, v2xGaps)
  };

  return application;
}

/**
 * Generate Executive Summary
 */
function generateExecutiveSummary(grant, archData, options) {
  const { projectTitle, applicant } = options;

  return {
    heading: 'Executive Summary',
    content: `
${applicant} seeks ${grant.typical_award} in ${grant.name} funding to deploy advanced ITS technologies across the regional transportation network.

The project will enhance ${archData.total_equipment || 0} existing ITS assets and deploy new infrastructure to address critical gaps in connected vehicle coverage, traffic management, and safety systems.

Our regional ITS architecture currently supports ${archData.service_package_count || 0} ARC-IT service packages with a ${archData.compliance_score || 0}% compliance score. This project will modernize infrastructure, improve interoperability, and advance toward Vision Zero safety goals.

**Project Highlights:**
- Deploy V2X infrastructure to close coverage gaps
- Upgrade ${archData.total_equipment} ITS assets to modern standards
- Implement advanced traffic management and safety systems
- Achieve ${grant.match_requirement} cost match through state/local partnership
- Generate measurable safety, mobility, and sustainability benefits

This project directly addresses ${grant.key_focus.length} of the program's key focus areas and aligns with all evaluation criteria.
    `.trim()
  };
}

/**
 * Generate Project Description
 */
function generateProjectDescription(grant, archData, options) {
  const sections = [];

  // Problem Statement
  sections.push({
    subsection: 'Problem Statement',
    content: `
The regional transportation network faces critical challenges:

**Infrastructure Gaps:** Analysis reveals ${archData.total_equipment} deployed ITS assets with a ${archData.compliance_score}% compliance score. Many systems operate on outdated protocols and lack modern connectivity.

**Safety Concerns:** Traditional infrastructure cannot provide real-time safety warnings or automated incident response that connected vehicle technologies enable.

**Data Integration:** ${archData.service_package_count} service packages operate with limited integration, preventing comprehensive network management and optimization.

**Technology Evolution:** Rapid advancement in V2X, AI, and IoT requires infrastructure modernization to support emerging mobility solutions.
    `.trim()
  });

  // Project Goals
  sections.push({
    subsection: 'Project Goals',
    content: `
This project will transform regional ITS infrastructure through:

1. **V2X Infrastructure Deployment:** Install roadside units (RSUs) to enable connected vehicle safety applications
2. **System Modernization:** Upgrade existing assets to support NTCIP, SAE J2735, and WZDx standards
3. **Network Integration:** Implement unified traffic management and data sharing platform
4. **Safety Enhancement:** Deploy advanced safety systems for vulnerable road users and incident management
5. **Sustainability:** Optimize traffic flow to reduce emissions and support clean transportation

**Quantifiable Outcomes:**
- 100% V2X corridor coverage on priority routes
- 95%+ standards compliance across all ITS assets
- 20% reduction in serious injury crashes
- 15% improvement in travel time reliability
- Real-time data sharing with partner agencies
    `.trim()
  });

  return {
    heading: 'Project Description',
    sections
  };
}

/**
 * Generate Technical Approach
 */
function generateTechnicalApproach(grant, archData, v2xGaps) {
  const recommendedRSUs = v2xGaps?.summary?.recommended_deployments || 0;
  const deploymentCost = v2xGaps?.cost_estimate?.total_capex || 0;

  return {
    heading: 'Technical Approach',
    content: `
**Architecture Analysis:**
Our ARC-IT 10.0 conformant regional architecture analysis identified ${archData.total_equipment} ITS assets across ${archData.service_package_count} service packages.

**V2X Deployment Strategy:**
Gap analysis recommends deploying ${recommendedRSUs} RSUs to achieve continuous V2X coverage. Deployment will prioritize:
- High-crash corridors and intersections
- Work zones and incident-prone areas
- Urban arterials and freeway systems
- Multimodal hubs and transit centers

**Standards Implementation:**
All systems will conform to:
- **NTCIP 1203/1205:** DMS and CCTV communications
- **SAE J2735/J2945:** V2X message sets and security
- **IEEE 1609.x:** DSRC/C-V2X protocols
- **WZDx:** Work zone data exchange
- **TMDD:** Traffic management data dictionary

**System Integration:**
Unified traffic management center will integrate:
- V2X roadside infrastructure
- Dynamic message signs and CCTV
- Traffic signal systems
- Weather monitoring (RWIS/ESS)
- CAD/911 incident data
- Transit vehicle location

**Data Platform:**
Open data architecture will enable:
- Real-time data sharing with partner agencies
- Public traveler information APIs
- Research data for university partners
- Performance measurement dashboards
    `.trim()
  };
}

/**
 * Generate Benefits Analysis
 */
function generateBenefitsAnalysis(grant, archData, v2xGaps) {
  const rsuCount = v2xGaps?.summary?.recommended_deployments || 0;

  return {
    heading: 'Benefits and Impact Analysis',
    sections: [
      {
        benefit: 'Safety Benefits',
        content: `
**Crash Reduction:**
- V2X safety applications: 20-30% reduction in target crash types
- Work zone safety: 15% reduction in work zone crashes
- Pedestrian/bicycle detection: 25% reduction in vulnerable user crashes

**Benefit-Cost Analysis:**
- Annual safety benefits: $${(rsuCount * 150000).toLocaleString()}
- System deployment cost: $${(v2xGaps?.cost_estimate?.total_capex || 0).toLocaleString()}
- B/C Ratio: 3.5:1 over 20-year analysis period
        `.trim()
      },
      {
        benefit: 'Mobility Benefits',
        content: `
**Travel Time Reliability:**
- 15% improvement in travel time reliability
- 10% reduction in recurring congestion
- 8% improvement in incident clearance time

**Economic Impact:**
- Annual time savings: $${(archData.total_equipment * 50000).toLocaleString()}
- Fuel savings: $${(archData.total_equipment * 25000).toLocaleString()}
- Emissions reduction: ${(archData.total_equipment * 100).toLocaleString()} tons CO2/year
        `.trim()
      },
      {
        benefit: 'Environmental Sustainability',
        content: `
**Emissions Reduction:**
- Optimized traffic flow: 8% reduction in vehicle emissions
- Reduced congestion: 5% fuel consumption improvement
- Support for electric vehicle infrastructure
- Real-time air quality monitoring integration

**Energy Efficiency:**
- Solar-powered RSU deployments
- LED message sign conversions
- Energy-efficient communications infrastructure
        `.trim()
      }
    ]
  };
}

/**
 * Generate Budget Narrative
 */
function generateBudgetNarrative(grant, archData, v2xGaps) {
  const rsuCost = v2xGaps?.cost_estimate?.total_capex || 0;
  const rsuCount = v2xGaps?.summary?.recommended_deployments || 0;
  const rsuOpex = v2xGaps?.cost_estimate?.annual_opex || 0;

  const systemUpgradeCost = archData.total_equipment * 5000;
  const integrationCost = 500000;
  const pmeCost = (rsuCost + systemUpgradeCost + integrationCost) * 0.15;

  const totalProject = rsuCost + systemUpgradeCost + integrationCost + pmeCost;

  return {
    heading: 'Budget Summary and Narrative',
    budget_table: [
      {
        category: 'V2X Infrastructure',
        description: `${rsuCount} RSUs with installation`,
        cost: rsuCost
      },
      {
        category: 'System Upgrades',
        description: `Modernize ${archData.total_equipment} existing ITS assets`,
        cost: systemUpgradeCost
      },
      {
        category: 'Systems Integration',
        description: 'Unified TMC and data platform',
        cost: integrationCost
      },
      {
        category: 'Project Management & Engineering',
        description: '15% of construction costs',
        cost: pmeCost
      }
    ],
    total_project_cost: totalProject,
    federal_request: totalProject * 0.8,
    local_match: totalProject * 0.2,
    annual_operations: rsuOpex,
    narrative: `
**Budget Justification:**

The project budget reflects industry-standard costs for ITS deployment. V2X infrastructure costs include complete RSU systems with DSRC/C-V2X radios, backhaul communications, power systems, and professional installation.

System upgrade costs cover firmware updates, protocol conversions, and equipment replacements necessary for standards compliance. Integration costs include software development, system testing, and cybersecurity measures.

**Cost Effectiveness:**
- Per-RSU cost: $${(rsuCost / rsuCount).toLocaleString()} (industry average: $40,000)
- Benefit-cost ratio: 3.5:1
- Annual operations: $${rsuOpex.toLocaleString()} (covered by existing maintenance budget)

**Local Match:**
The ${((totalProject * 0.2) / 1000000).toFixed(1)}M local match (${grant.match_requirement}) will be provided through state transportation funds and regional partner contributions.
    `.trim()
  };
}

/**
 * Generate Evaluation Plan
 */
function generateEvaluationPlan(grant, archData) {
  return {
    heading: 'Performance Measurement and Evaluation',
    content: `
**Key Performance Indicators (KPIs):**

1. **Safety Metrics:**
   - Crash frequency and severity (quarterly reporting)
   - V2X safety alert effectiveness
   - Work zone incident rates
   - Pedestrian/bicycle crash reduction

2. **Mobility Metrics:**
   - Travel time index and reliability
   - Incident detection and clearance time
   - Traffic flow efficiency
   - Transit on-time performance

3. **Technology Metrics:**
   - V2X coverage percentage
   - System uptime and availability
   - Standards compliance score
   - Connected vehicle penetration rate

4. **Data Sharing Metrics:**
   - API usage and data consumers
   - Real-time data feeds operational
   - Partner agency integration

**Evaluation Methodology:**
- Before/after analysis with control corridors
- Continuous automated data collection
- Annual stakeholder surveys
- Third-party program evaluation
- Quarterly progress reports to USDOT

**Data Management:**
All project data will be archived and made available for research through the USDOT ITS Public Data Hub per federal requirements.
    `.trim()
  };
}

/**
 * Generate Compliance Documentation Section
 */
function generateComplianceSection(archData, complianceData) {
  const avgCompliance = complianceData?.summary?.average_compliance || archData.compliance_score || 0;

  return {
    heading: 'Regional ITS Architecture and Standards Compliance',
    content: `
**ARC-IT Conformance:**
This project is based on a comprehensive regional ITS architecture analysis conforming to ARC-IT 10.0 standards and FHWA requirements (23 CFR 940.9).

**Current Architecture Status:**
- ${archData.total_equipment} ITS assets inventoried
- ${archData.service_package_count} ARC-IT service packages identified
- ${archData.standards_required?.length || 0} industry standards applicable
- ${avgCompliance}% current compliance score

**Standards Implementation:**
All new and upgraded systems will comply with applicable NTCIP, SAE, IEEE, and USDOT standards. The project will achieve 95%+ standards compliance across the regional architecture.

**Architecture Maintenance:**
The regional ITS architecture will be updated annually and made publicly available per federal requirements.
    `.trim()
  };
}

/**
 * Generate Stakeholder Support Section
 */
function generateStakeholderSection(grant) {
  return {
    heading: 'Stakeholder Collaboration and Support',
    content: `
**Project Partners:**
- State Department of Transportation (Lead Agency)
- Metropolitan Planning Organization
- State Highway Patrol
- County/Municipal Transportation Departments
- Transit Agencies
- FHWA Division Office
- University Research Partners

**Stakeholder Engagement:**
- Quarterly stakeholder coordination meetings
- Public outreach through MPO processes
- Technical working groups for implementation
- Letters of support from partner agencies (attached)

**Regional Coordination:**
This project aligns with the Metropolitan Transportation Plan, State Transportation Improvement Program, and regional safety action plans.
    `.trim()
  };
}

/**
 * Generate Project Timeline
 */
function generateProjectTimeline(grant, v2xGaps) {
  const phases = v2xGaps?.deployment_recommendations?.[0]?.phases?.length || 3;

  return {
    heading: 'Project Schedule',
    phases: [
      { phase: 'Planning & Design', duration: '6 months', tasks: ['Final design', 'Environmental clearance', 'Procurement'] },
      { phase: `Implementation Phase 1`, duration: '12 months', tasks: ['Priority corridors', 'High-crash locations', 'Initial integration'] },
      { phase: `Implementation Phase 2`, duration: '12 months', tasks: ['Secondary corridors', 'System upgrades', 'Full integration'] },
      { phase: 'Testing & Deployment', duration: '6 months', tasks: ['System testing', 'Staff training', 'Public launch'] }
    ],
    total_duration: '36 months',
    note: 'Project is shovel-ready with environmental clearances complete and stakeholder support secured.'
  };
}

/**
 * Generate Sustainability Plan
 */
function generateSustainabilityPlan(grant) {
  return {
    heading: 'Long-Term Sustainability',
    content: `
**Operations and Maintenance:**
Annual O&M costs will be integrated into existing state transportation maintenance budgets. Systems are designed for 20-year service life with routine maintenance.

**Financial Sustainability:**
- Equipment lifecycle replacement funded through state capital programs
- Staffing integrated into existing TMC operations
- Revenue neutral through crash reduction savings

**Technical Sustainability:**
- Standards-based open architecture ensures vendor independence
- Cybersecurity updates managed through existing IT security programs
- Technology refresh cycles aligned with industry best practices

**Institutional Sustainability:**
- Formal interagency agreements for data sharing
- Regional ITS steering committee for governance
- Documented standard operating procedures
    `.trim()
  };
}

/**
 * Generate Innovation Narrative
 */
function generateInnovationNarrative(grant, archData, v2xGaps) {
  return {
    heading: 'Innovation and Technology Leadership',
    content: `
**Innovative Elements:**

1. **Unified Data Platform:** First-of-its-kind regional integration of V2X, traffic management, CAD, and weather data enabling advanced analytics and machine learning applications.

2. **Open Architecture:** Standards-based API platform allowing third-party developers and researchers to build innovative traveler information and mobility applications.

3. **Advanced V2X Applications:** Deployment of cutting-edge safety applications including pedestrian detection, wrong-way driver alerts, and queue warning systems.

4. **Scalable Model:** Documentation and lessons learned will be shared nationally to support replication by other agencies.

**Technology Transfer:**
Project team will present findings at ITS America, TRB Annual Meeting, and regional conferences. All documentation will be published through USDOT ITS Knowledge Resources.
    `.trim()
  };
}

/**
 * Get grant program requirements
 */
function getGrantRequirements(grantType) {
  const grant = GRANT_PROGRAMS[grantType];
  if (!grant) {
    throw new Error(`Unknown grant type: ${grantType}`);
  }

  return {
    program: grant,
    required_sections: [
      'Executive Summary',
      'Project Description',
      'Technical Approach',
      'Benefits Analysis',
      'Budget Narrative',
      'Evaluation Plan',
      'Regional ITS Architecture Documentation',
      'Stakeholder Support Letters',
      'Project Timeline',
      'Sustainability Plan'
    ],
    page_limits: {
      SMART: 30,
      RAISE: 25,
      ATCMTD: 20,
      SS4A: 15
    }[grantType] || 25
  };
}

module.exports = {
  generateGrantApplication,
  getGrantRequirements,
  GRANT_PROGRAMS
};

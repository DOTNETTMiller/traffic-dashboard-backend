# Grant Package Builder - Implementation Roadmap

## Overview

The Grant Package Builder transforms the DOT Corridor Communicator from a data visualization platform into a **comprehensive federal grant preparation system**. This positions the platform as an essential tool for DOTs pursuing SMART, RAISE, ATCMTD, INFRA, and Pooled Fund grants.

**Strategic Value:**
- **Time Savings**: Reduces grant prep time from weeks to days
- **Competitive Advantage**: Professional, data-driven applications with 1M+ device inventory
- **Multi-State Coordination**: Streamlined pooled fund collaboration for I-80 Corridor Coalition
- **Standards Compliance**: Automated ARC-IT 10.0 and RAD-IT alignment

## Database Schema ✅ COMPLETE

**Tables Created** (via `scripts/create_grant_package_tables.js`):
- `grant_funding_programs` - Federal funding opportunities database
- `cost_estimator_items` - Equipment and lifecycle cost data
- `support_letter_templates` - Automated letter generation templates
- `best_management_practices` - Procurement, deployment, operations guidance
- `grant_packages` - Tracking for generated grant packages

## Feature 1: Federal Funding Opportunities Database

### Implementation Steps:

**1. Seed Data Script** (`scripts/populate_funding_programs.js`)

```javascript
// Sample funding programs to populate:
const fundingPrograms = [
  {
    id: 'smart-2025',
    program_name: 'SMART Grants',
    program_type: 'discretionary',
    agency: 'FHWA',
    eligible_project_types: JSON.stringify(['V2X', 'ITS', 'AV', 'Connected Infrastructure']),
    equipment_types: JSON.stringify(['RSU', 'DMS', 'Camera', 'Fiber', 'Edge Computing']),
    typical_award_min: 2000000,
    typical_award_max: 15000000,
    match_requirement: 0.20,
    max_federal_share: 0.80,
    application_deadline: '2025-04-15',
    deadline_type: 'annual',
    planning_requirement: true,
    radit_requirement: true,
    benefit_cost_requirement: true,
    fy2025_funding: 100000000,
    description: 'Strengthening Mobility and Revolutionizing Transportation Grant Program',
    key_priorities: JSON.stringify([
      'Coordinated automation',
      'Connected vehicles',
      'Intelligent sensor-based infrastructure',
      'Systems integration'
    ]),
    scoring_criteria: JSON.stringify({
      'Project Readiness': 20,
      'Innovation': 20,
      'Partnership': 15,
      'Benefit-Cost': 25,
      'Equity & Safety': 20
    })
  },
  {
    id: 'raise-2025',
    program_name: 'RAISE Grants',
    program_type: 'discretionary',
    agency: 'USDOT',
    eligible_project_types: JSON.stringify(['Highway', 'Freight', 'ITS', 'Multimodal']),
    typical_award_min: 1000000,
    typical_award_max: 25000000,
    match_requirement: 0.20,
    max_federal_share: 0.80,
    application_deadline: '2025-02-28',
    deadline_type: 'annual',
    benefit_cost_requirement: true,
    fy2025_funding: 1500000000,
    historical_success_rate: 0.12
  },
  {
    id: 'atcmtd-2025',
    program_name: 'ATCMTD',
    program_name_full: 'Advanced Transportation and Congestion Management Technologies Deployment',
    program_type: 'discretionary',
    agency: 'FHWA',
    eligible_project_types: JSON.stringify(['V2X', 'ITS', 'Smart Cities', 'Traffic Management']),
    typical_award_min: 3000000,
    typical_award_max: 12000000,
    match_requirement: 0.50,
    max_federal_share: 0.50,
    radit_requirement: true,
    fy2025_funding: 60000000
  },
  // Formula/Block Grants
  {
    id: 'hsip-annual',
    program_name: 'Highway Safety Improvement Program (HSIP)',
    program_type: 'formula',
    agency: 'FHWA',
    eligible_project_types: JSON.stringify(['Safety', 'ITS', 'Crash Reduction']),
    match_requirement: 0.10,
    max_federal_share: 0.90,
    deadline_type: 'rolling'
  },
  {
    id: 'cmaq-annual',
    program_name: 'Congestion Mitigation and Air Quality (CMAQ)',
    program_type: 'formula',
    agency: 'FHWA',
    eligible_project_types: JSON.stringify(['ITS', 'Traffic Flow', 'Emissions Reduction']),
    match_requirement: 0.20,
    max_federal_share: 0.80,
    deadline_type: 'rolling'
  }
];
```

**2. Backend API Endpoints** (add to `backend_proxy_server.js`):

```javascript
// Get all funding opportunities with optional filtering
app.get('/api/grants/funding-opportunities', async (req, res) => {
  const { projectType, equipmentType, minAward, maxAward, deadline } = req.query;

  let query = 'SELECT * FROM grant_funding_programs WHERE 1=1';
  const params = [];

  if (projectType) {
    query += ` AND eligible_project_types LIKE ?`;
    params.push(`%"${projectType}"%`);
  }

  if (equipmentType) {
    query += ` AND equipment_types LIKE ?`;
    params.push(`%"${equipmentType}"%`);
  }

  if (minAward) {
    query += ` AND typical_award_max >= ?`;
    params.push(parseInt(minAward));
  }

  if (deadline) {
    const sixMonthsOut = new Date();
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);
    query += ` AND application_deadline <= ?`;
    params.push(sixMonthsOut.toISOString().split('T')[0]);
  }

  query += ' ORDER BY application_deadline ASC';

  const opportunities = db.db.prepare(query).all(...params);
  res.json({ success: true, opportunities });
});

// Get funding opportunity details
app.get('/api/grants/funding-opportunities/:id', async (req, res) => {
  const opportunity = db.db.prepare(
    'SELECT * FROM grant_funding_programs WHERE id = ?'
  ).get(req.params.id);

  if (!opportunity) {
    return res.status(404).json({ success: false, error: 'Opportunity not found' });
  }

  res.json({ success: true, opportunity });
});
```

**3. Frontend Component** (`FundingOpportunities.jsx`):

Creates a searchable, filterable table showing:
- Program name and agency
- Award range
- Match requirements
- Application deadlines (with countdown timer)
- Eligibility quick-check based on current ITS inventory
- Direct links to NOFO documents

---

## Feature 2: Cost Estimator with ROI Calculator

### Implementation Steps:

**1. Seed Data Script** (`scripts/populate_cost_items.js`):

```javascript
const costItems = [
  // RSU/V2X Equipment
  {
    id: 'rsu-dsrc',
    category: 'equipment',
    item_type: 'RSU',
    item_name: 'DSRC Roadside Unit (5.9 GHz)',
    unit_cost_min: 12000,
    unit_cost_max: 25000,
    unit_cost_typical: 18000,
    unit_of_measure: 'each',
    installation_factor: 0.25,
    annual_operations_factor: 0.03,
    annual_maintenance_factor: 0.05,
    useful_life_years: 10,
    communication_cost_annual: 1200,
    software_licensing_annual: 500,
    notes: 'Includes antenna, backhaul capability, basic CV applications',
    source: 'AASHTO Connected Vehicle Deployment Coalition'
  },
  {
    id: 'rsu-cv2x',
    category: 'equipment',
    item_type: 'RSU',
    item_name: 'C-V2X Roadside Unit (5.9 GHz)',
    unit_cost_min: 15000,
    unit_cost_max: 30000,
    unit_cost_typical: 22000,
    unit_of_measure: 'each',
    installation_factor: 0.25,
    useful_life_years: 12
  },
  // DMS Signs
  {
    id: 'dms-small',
    category: 'equipment',
    item_type: 'DMS',
    item_name: 'DMS Sign - Small (3 lines)',
    unit_cost_min: 35000,
    unit_cost_max: 75000,
    unit_cost_typical: 55000,
    unit_of_measure: 'each',
    installation_factor: 0.30,
    annual_maintenance_factor: 0.08,
    useful_life_years: 15
  },
  {
    id: 'dms-large',
    category: 'equipment',
    item_type: 'DMS',
    item_name: 'DMS Sign - Large/Full Matrix',
    unit_cost_min: 100000,
    unit_cost_max: 200000,
    unit_cost_typical: 150000,
    unit_of_measure: 'each',
    installation_factor: 0.35,
    useful_life_years: 15
  },
  // Cameras
  {
    id: 'camera-fixed',
    category: 'equipment',
    item_type: 'Camera',
    item_name: 'CCTV Camera - Fixed',
    unit_cost_min: 8000,
    unit_cost_max: 20000,
    unit_cost_typical: 12000,
    unit_of_measure: 'each',
    installation_factor: 0.20,
    annual_maintenance_factor: 0.06,
    useful_life_years: 8
  },
  {
    id: 'camera-ptz',
    category: 'equipment',
    item_type: 'Camera',
    item_name: 'CCTV Camera - Pan/Tilt/Zoom',
    unit_cost_min: 15000,
    unit_cost_max: 35000,
    unit_cost_typical: 25000,
    unit_of_measure: 'each',
    installation_factor: 0.25,
    useful_life_years: 10
  },
  // Fiber Infrastructure
  {
    id: 'fiber-urban',
    category: 'equipment',
    item_type: 'Fiber',
    item_name: 'Fiber Optic Cable - Urban Installation',
    unit_cost_min: 75,
    unit_cost_max: 200,
    unit_cost_typical: 125,
    unit_of_measure: 'linear_foot',
    installation_factor: 1.5, // Installation is major cost for fiber
    annual_maintenance_factor: 0.02,
    useful_life_years: 25
  },
  {
    id: 'fiber-rural',
    category: 'equipment',
    item_type: 'Fiber',
    item_name: 'Fiber Optic Cable - Rural/Highway Installation',
    unit_cost_min: 40,
    unit_cost_max: 100,
    unit_cost_typical: 60,
    unit_of_measure: 'linear_foot',
    installation_factor: 1.2,
    useful_life_years: 25
  },
  // Weather Stations
  {
    id: 'rwis-full',
    category: 'equipment',
    item_type: 'Sensor',
    item_name: 'Road Weather Information System (RWIS) - Full Station',
    unit_cost_min: 75000,
    unit_cost_max: 150000,
    unit_cost_typical: 100000,
    unit_of_measure: 'each',
    installation_factor: 0.25,
    annual_operations_factor: 0.04,
    annual_maintenance_factor: 0.06,
    communication_cost_annual: 2400,
    useful_life_years: 12
  },
  // Operations/Soft Costs
  {
    id: 'tmc-integration',
    category: 'operations',
    item_type: 'Integration',
    item_name: 'TMC System Integration (per device)',
    unit_cost_min: 1000,
    unit_cost_max: 5000,
    unit_cost_typical: 2500,
    unit_of_measure: 'each'
  },
  {
    id: 'project-management',
    category: 'operations',
    item_type: 'Management',
    item_name: 'Project Management (% of construction)',
    unit_cost_typical: 0.10, // 10% of construction cost
    unit_of_measure: 'percentage'
  }
];
```

**2. Backend API Endpoints**:

```javascript
// Get cost estimator items
app.get('/api/grants/cost-items', async (req, res) => {
  const { category, itemType } = req.query;

  let query = 'SELECT * FROM cost_estimator_items WHERE 1=1';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (itemType) {
    query += ' AND item_type = ?';
    params.push(itemType);
  }

  const items = db.db.prepare(query).all(...params);
  res.json({ success: true, items });
});

// Calculate project cost estimate
app.post('/api/grants/calculate-cost', async (req, res) => {
  const { items, projectYears = 10 } = req.body;

  let totalCapital = 0;
  let totalInstallation = 0;
  let annualOperations = 0;
  let annualMaintenance = 0;

  const breakdown = items.map(item => {
    const costData = db.db.prepare(
      'SELECT * FROM cost_estimator_items WHERE id = ?'
    ).get(item.id);

    const qty = item.quantity || 1;
    const unitCost = item.customCost || costData.unit_cost_typical;

    const capitalCost = unitCost * qty;
    const installationCost = capitalCost * (costData.installation_factor || 0);
    const annualOps = capitalCost * (costData.annual_operations_factor || 0) +
                     (costData.communication_cost_annual || 0) * qty +
                     (costData.software_licensing_annual || 0) * qty;
    const annualMaint = capitalCost * (costData.annual_maintenance_factor || 0);

    totalCapital += capitalCost;
    totalInstallation += installationCost;
    annualOperations += annualOps;
    annualMaintenance += annualMaint;

    return {
      item_name: costData.item_name,
      quantity: qty,
      unit_cost: unitCost,
      capital_cost: capitalCost,
      installation_cost: installationCost,
      annual_operations: annualOps,
      annual_maintenance: annualMaint,
      lifecycle_cost_10yr: capitalCost + installationCost + (annualOps + annualMaint) * 10
    };
  });

  const summary = {
    capital_costs: totalCapital,
    installation_costs: totalInstallation,
    total_construction: totalCapital + totalInstallation,
    annual_operations: annualOperations,
    annual_maintenance: annualMaintenance,
    annual_total: annualOperations + annualMaintenance,
    lifecycle_10yr: totalCapital + totalInstallation + (annualOperations + annualMaintenance) * projectYears,

    // ROI Calculations (using FHWA benefit values)
    estimated_annual_benefits: {
      crash_reduction_value: totalCapital * 0.15, // Conservative 15% crash reduction value
      travel_time_savings: totalCapital * 0.12,
      emissions_reduction: totalCapital * 0.05
    }
  };

  summary.estimated_annual_benefits.total =
    summary.estimated_annual_benefits.crash_reduction_value +
    summary.estimated_annual_benefits.travel_time_savings +
    summary.estimated_annual_benefits.emissions_reduction;

  summary.benefit_cost_ratio =
    (summary.estimated_annual_benefits.total * projectYears) / summary.lifecycle_10yr;

  res.json({ success: true, breakdown, summary });
});
```

**3. Frontend Component** (`CostEstimator.jsx`):

Interactive cost calculator with:
- Equipment selection from catalog
- Quantity input
- Custom unit cost override
- Real-time cost calculations
- 10-year TCO projection
- Benefit-Cost Ratio (BCR) calculator
- Export to Excel for grant applications

---

## Feature 3: Support Letter Generator

### Implementation Steps:

**1. Seed Templates** (`scripts/populate_letter_templates.js`):

```javascript
const templates = [
  {
    id: 'dot-director-smart',
    letter_type: 'dot_director',
    grant_type: 'SMART',
    subject_line: 'Letter of Support - {{projectTitle}} SMART Grant Application',
    salutation: 'Dear Selection Committee:',
    opening_paragraph: `On behalf of the {{stateName}} Department of Transportation, I am pleased to provide this letter of support for {{projectTitle}}. This project represents a critical investment in our state's transportation infrastructure and aligns directly with the SMART Grant Program's objectives of advancing transportation technology and innovation.`,
    body_template: `{{stateName}} DOT has made significant investments in intelligent transportation systems, with {{totalITSDevices}} connected devices currently deployed across our highway network. This existing infrastructure provides a strong foundation for the proposed {{projectTitle}}.

The project will deploy {{proposedEquipment}} to enhance safety, mobility, and efficiency along {{corridorDescription}}. Our preliminary analysis indicates this deployment will:

• Reduce crashes by an estimated {{crashReduction}}%
• Improve travel time reliability by {{travelTimeImprovement}}%
• Support connected and automated vehicle deployment
• Enhance real-time traveler information

This project has been developed in coordination with our {{partnerAgencies}} and is consistent with our Regional ITS Architecture documented in RAD-IT. {{#if pooledFund}}As a member of the {{pooledFundName}}, we are committed to multi-state coordination and interoperability across state boundaries.{{/if}}

{{stateName}} DOT commits to providing the required {{matchPercentage}}% match ({{matchAmount}}) and will assume responsibility for long-term operations and maintenance.`,
    closing_paragraph: `We strongly support this application and believe {{projectTitle}} will deliver measurable benefits to our transportation system and traveling public. Please contact me if you require additional information.`,
    signature_block: `Sincerely,

{{directorName}}
Director
{{stateName}} Department of Transportation`,
    required_fields: JSON.stringify([
      'projectTitle', 'stateName', 'totalITSDevices', 'proposedEquipment',
      'corridorDescription', 'matchPercentage', 'matchAmount', 'directorName'
    ]),
    optional_fields: JSON.stringify([
      'crashReduction', 'travelTimeImprovement', 'partnerAgencies',
      'pooledFund', 'pooledFundName'
    ])
  },
  {
    id: 'partner-state-pooled',
    letter_type: 'partner_state',
    grant_type: 'generic',
    subject_line: 'Letter of Commitment - {{projectTitle}} Multi-State Partnership',
    opening_paragraph: `As {{partnerStateName}} DOT Director, I am writing to confirm our partnership and commitment to {{projectTitle}}, a multi-state initiative led by {{leadStateName}} DOT.`,
    body_template: `This regional project will deploy intelligent transportation systems across {{corridorMiles}} miles of {{corridorName}}, providing continuous coverage and interoperability across state boundaries.

{{partnerStateName}} commits to:

• Deploying {{partnerStateEquipment}} within our jurisdiction
• Contributing {{partnerMatchAmount}} in matching funds
• Coordinating operations with partner states through our Traffic Management Center
• Sharing real-time data and maintaining interoperable systems
• Supporting long-term operations and maintenance

Our state has already deployed {{partnerStateITSCount}} ITS devices, demonstrating our capability and commitment to advanced transportation technology. This regional approach will maximize benefits through:

• Seamless traveler information across state lines
• Coordinated incident response
• Continuous V2X connectivity for connected vehicles
• Shared best practices and operational efficiencies

We have participated in the development of the Regional ITS Architecture and our systems are ARC-IT 10.0 compliant to ensure interoperability.`,
    closing_paragraph: `{{partnerStateName}} DOT is fully committed to this partnership and the successful implementation of {{projectTitle}}.`,
    signature_block: `Respectfully,

{{partnerDirectorName}}
Director
{{partnerStateName}} Department of Transportation`
  }
];
```

**2. Backend API Endpoints**:

```javascript
// Get available letter templates
app.get('/api/grants/letter-templates', async (req, res) => {
  const { letterType, grantType } = req.query;

  let query = 'SELECT * FROM support_letter_templates WHERE 1=1';
  const params = [];

  if (letterType) {
    query += ' AND letter_type = ?';
    params.push(letterType);
  }

  if (grantType) {
    query += ' AND (grant_type = ? OR grant_type = "generic")';
    params.push(grantType);
  }

  const templates = db.db.prepare(query).all(...params);
  res.json({ success: true, templates });
});

// Generate support letter
app.post('/api/grants/generate-letter', async (req, res) => {
  const { templateId, data } = req.body;

  const template = db.db.prepare(
    'SELECT * FROM support_letter_templates WHERE id = ?'
  ).get(templateId);

  if (!template) {
    return res.status(404).json({ success: false, error: 'Template not found' });
  }

  // Simple template replacement (in production, use a proper template engine like Handlebars)
  let letter = `Subject: ${template.subject_line}\n\n`;
  letter += `${template.salutation}\n\n`;
  letter += `${template.opening_paragraph}\n\n`;
  letter += `${template.body_template}\n\n`;
  letter += `${template.closing_paragraph}\n\n`;
  letter += template.signature_block;

  // Replace placeholders
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    letter = letter.replace(regex, data[key]);
  });

  // Handle conditional blocks (basic implementation)
  letter = letter.replace(/{{#if \w+}}[\s\S]*?{{\/if}}/g, (match) => {
    // In production, implement proper conditional logic
    return match.includes('pooledFund') && data.pooledFund ?
      match.replace(/{{#if pooledFund}}|{{\/if}}/g, '') : '';
  });

  res.json({ success: true, letter, format: 'text/plain' });
});

// Generate letter as Word document (requires library)
app.post('/api/grants/generate-letter/docx', async (req, res) => {
  // Implementation with docx library
  // Creates formatted Word document with letterhead
});
```

**3. Frontend Component** (`SupportLetterGenerator.jsx`):

Wizard-style interface:
1. Select letter type (DOT Director, Governor, Partner State, etc.)
2. Choose grant program (auto-fills relevant details)
3. Fill in custom fields (project details, names, amounts)
4. Preview generated letter
5. Download as DOCX or PDF
6. Track which letters have been generated for the package

---

## Feature 4: Pooled Fund State Split Calculator

### Backend API Endpoints:

```javascript
// Calculate state funding splits for pooled fund
app.post('/api/grants/calculate-splits', async (req, res) => {
  const {
    totalProjectCost,
    federalShare, // 0.80 for 80%
    pooledFundStates, // ['NV', 'UT', 'WY', 'NE', 'IA']
    allocationMethod, // 'vmt', 'lane_miles', 'population', 'equal', 'custom'
    customWeights // optional: {NV: 0.25, UT: 0.20, ...}
  } = req.body;

  const federalAmount = totalProjectCost * federalShare;
  const stateMatchTotal = totalProjectCost - federalAmount;

  let stateAllocations = {};

  if (allocationMethod === 'equal') {
    const perState = stateMatchTotal / pooledFundStates.length;
    pooledFundStates.forEach(state => {
      stateAllocations[state] = perState;
    });
  } else if (allocationMethod === 'vmt') {
    // Get VMT data for each state on the corridor
    const vmtData = {}; // In production, query actual VMT data
    let totalVMT = 0;

    pooledFundStates.forEach(state => {
      // Example VMT (in production, query from database or external API)
      vmtData[state] = getStateVMT(state); // Placeholder
      totalVMT += vmtData[state];
    });

    pooledFundStates.forEach(state => {
      stateAllocations[state] = stateMatchTotal * (vmtData[state] / totalVMT);
    });
  } else if (allocationMethod === 'custom' && customWeights) {
    pooledFundStates.forEach(state => {
      stateAllocations[state] = stateMatchTotal * customWeights[state];
    });
  }

  // Calculate ITS equipment allocation (if applicable)
  const equipmentByState = {};
  for (const state of pooledFundStates) {
    const count = db.db.prepare(
      'SELECT COUNT(*) as count FROM its_equipment WHERE state_key = ?'
    ).get(state);
    equipmentByState[state] = count.count;
  }

  const response = {
    success: true,
    projectCost: {
      total: totalProjectCost,
      federal: federalAmount,
      stateMatch: stateMatchTotal
    },
    stateAllocations,
    equipmentDistribution: equipmentByState,
    breakdown: pooledFundStates.map(state => ({
      state,
      matchAmount: stateAllocations[state],
      matchPercentage: (stateAllocations[state] / stateMatchTotal) * 100,
      currentEquipment: equipmentByState[state]
    }))
  };

  res.json(response);
});
```

### Frontend Component (`StateSplitCalculator.jsx`):

Interactive calculator:
- Total project cost input
- Federal share slider (50% - 90%)
- Pooled fund state selection
- Allocation method selection (VMT, Lane-Miles, Equal, Custom)
- Real-time split calculations
- Visual pie chart of allocations
- Export to Excel table for grant application

---

## Feature 5: Best Management Practices Library

### Seed Data:

```javascript
const bestPractices = [
  {
    id: 'procurement-rsu-rfp',
    category: 'procurement',
    subcategory: 'V2X/RSU',
    title: 'Model RFP for Roadside Unit Procurement',
    description: 'Template procurement documents for RSU acquisition',
    detailed_guidance: `# RSU Procurement Best Practices

## Technical Specifications

### Minimum Requirements:
- SAE J2735 message support
- IEEE 1609.x protocol stack
- 5.9 GHz DSRC and/or C-V2X capability
- Minimum 300m communication range
- IP67 weatherproof rating
- -40°C to +74°C operating temperature

### Interoperability:
- OmniAir Certified
- ARC-IT 10.0 compliant
- NTCIP 1218 RSU MIB support
- SCMS security credential management

## Procurement Approach:

### Option 1: Performance-Based (Recommended)
- Specify functional requirements, not brands
- Require interoperability testing
- Include 5-year warranty and support

### Option 2: Design-Build
- Partner with system integrator
- Turnkey deployment including installation
- Lifecycle maintenance agreement

## Evaluation Criteria:
1. Technical compliance (40%)
2. Cost (25%)
3. Vendor experience (15%)
4. Warranty/Support (10%)
5. Delivery schedule (10%)

## Sample RFP Sections:
[Link to downloadable template]`,
    equipment_types: JSON.stringify(['RSU']),
    project_phases: JSON.stringify(['planning', 'procurement']),
    template_files: JSON.stringify(['/templates/rfp-rsu-template.docx']),
    reference_urls: JSON.stringify([
      'https://www.arc-it.net/',
      'https://www.itsstandards.eu/'
    ]),
    relevant_standards: JSON.stringify([
      'SAE J2735',
      'IEEE 1609.x',
      'NTCIP 1218',
      'ARC-IT 10.0'
    ]),
    source: 'AASHTO CV Deployment Coalition',
    last_reviewed: '2024-12-01'
  },
  {
    id: 'deployment-v2x-coverage',
    category: 'deployment',
    subcategory: 'V2X',
    title: 'V2X Coverage Planning and Gap Analysis',
    description: 'Methodology for planning RSU deployment to achieve target coverage',
    detailed_guidance: `# V2X Coverage Planning

## Planning Methodology:

### Step 1: Define Coverage Objectives
- Corridor length and priority segments
- Target applications (safety, mobility, environmental)
- Minimum overlap requirements (typically 300m)

### Step 2: Propagation Modeling
- Use RF propagation tools (e.g., Radio Mobile, SPLAT!)
- Account for terrain, urban density, vegetation
- Model both line-of-sight and non-line-of-sight

### Step 3: Site Selection
- Prioritize high-crash locations
- Consider existing infrastructure (signals, DMS, power)
- Evaluate backhaul options (fiber, cellular, microwave)

### Step 4: Gap Analysis
- Identify coverage gaps
- Prioritize gaps by safety/mobility impact
- Plan phased deployment

## Coverage Targets:
- Interstate highways: 90%+ coverage
- High-crash corridors: 95%+ coverage
- Urban arterials: 80%+ coverage

## Deployment Density:
- Rural interstate: 1 RSU per 0.5-1.0 mile
- Urban freeway: 1 RSU per 0.3-0.5 mile
- Signalized intersections: 1-2 RSUs per intersection`,
    equipment_types: JSON.stringify(['RSU']),
    project_phases: JSON.stringify(['planning', 'deployment'])
  }
];
```

### Backend API:

```javascript
app.get('/api/grants/best-practices', async (req, res) => {
  const { category, equipmentType, projectPhase } = req.query;

  let query = 'SELECT * FROM best_management_practices WHERE 1=1';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (equipmentType) {
    query += ' AND equipment_types LIKE ?';
    params.push(`%"${equipmentType}"%`);
  }

  if (projectPhase) {
    query += ' AND project_phases LIKE ?';
    params.push(`%"${projectPhase}"%`);
  }

  const practices = db.db.prepare(query).all(...params);
  res.json({ success: true, practices });
});
```

### Frontend Component (`BestPracticesLibrary.jsx`):

Searchable knowledge base:
- Category navigation (Procurement, Deployment, Operations, etc.)
- Full-text search
- Markdown rendering for detailed guidance
- Downloadable templates (RFPs, checklists, SOPs)
- Related standards cross-references
- Case studies from other states

---

## Frontend Integration: GrantPackageBuilder.jsx

### Component Structure:

```jsx
import React, { useState } from 'react';
import FundingOpportunities from './FundingOpportunities';
import CostEstimator from './CostEstimator';
import SupportLetterGenerator from './SupportLetterGenerator';
import StateSplitCalculator from './StateSplitCalculator';
import BestPracticesLibrary from './BestPracticesLibrary';

export default function GrantPackageBuilder({ user, authToken }) {
  const [activeTab, setActiveTab] = useState('opportunities');
  const [packageData, setPackageData] = useState({
    grantType: '',
    projectTitle: '',
    fundingRequested: 0,
    isPooledFund: false,
    pooledFundStates: []
  });

  return (
    <div className="grant-package-builder">
      <h2>📦 Grant Package Builder</h2>

      <div className="tabs">
        <button onClick={() => setActiveTab('opportunities')}>
          💰 Funding Opportunities
        </button>
        <button onClick={() => setActiveTab('cost')}>
          💵 Cost Estimator
        </button>
        <button onClick={() => setActiveTab('letters')}>
          📝 Support Letters
        </button>
        <button onClick={() => setActiveTab('splits')}>
          🤝 State Funding Splits
        </button>
        <button onClick={() => setActiveTab('practices')}>
          📚 Best Practices
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'opportunities' && (
          <FundingOpportunities onSelect={handleOpportunitySelect} />
        )}
        {activeTab === 'cost' && (
          <CostEstimator packageData={packageData} onUpdate={handleCostUpdate} />
        )}
        {activeTab === 'letters' && (
          <SupportLetterGenerator packageData={packageData} user={user} />
        )}
        {activeTab === 'splits' && (
          <StateSplitCalculator packageData={packageData} />
        )}
        {activeTab === 'practices' && (
          <BestPracticesLibrary />
        )}
      </div>

      <div className="package-summary">
        <h3>Package Status</h3>
        <ul>
          <li>✅ Narrative Generated</li>
          <li>✅ Cost Estimate Complete</li>
          <li>⏳ Support Letters (2 of 5)</li>
          <li>⏳ State Splits Pending</li>
        </ul>
        <button onClick={handleExportPackage}>
          📥 Export Complete Package
        </button>
      </div>
    </div>
  );
}
```

---

## Deployment Checklist

- [ ] Run database schema script
- [ ] Populate funding programs seed data
- [ ] Populate cost estimator items
- [ ] Populate letter templates
- [ ] Populate best management practices
- [ ] Implement backend API endpoints
- [ ] Create frontend components
- [ ] Add export functionality (DOCX, PDF, Excel)
- [ ] Test full grant package workflow
- [ ] Deploy to production
- [ ] Create user documentation

---

## Strategic Impact

### Time Savings:
- **Traditional Process**: 3-4 weeks per grant application
- **With Grant Package Builder**: 2-3 days

### Competitive Advantage:
- Professional, data-driven applications
- Comprehensive documentation (RAD-IT, cost estimates, support letters)
- Multi-state coordination made easy
- Standards compliance (ARC-IT 10.0, NTCIP)

### Market Differentiation:
- **Only platform** combining real-time traffic data, ITS inventory, AND grant preparation
- **1M+ device scale** demonstrates national leadership
- **Pooled fund support** enables unprecedented multi-state collaboration

---

## Next Steps

**Immediate (Phase 1):**
1. Populate seed data for all tables
2. Implement backend API endpoints
3. Create basic frontend components

**Near-term (Phase 2):**
4. Enhance AI narrative generator with cost/benefit integration
5. Add Word/PDF export functionality
6. Create comprehensive template library

**Future (Phase 3):**
7. Integration with grant.gov for automated submission
8. Historical grant performance tracking
9. AI-powered grant opportunity matching
10. Collaboration portal for multi-state teams

This roadmap provides a clear path to transforming the DOT Corridor Communicator into the **premier federal grant preparation platform** for state DOTs.

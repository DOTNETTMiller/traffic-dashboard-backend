/**
 * Populate Support Letter Templates
 *
 * Seeds the database with professional letter templates for various
 * grant programs and support letter types.
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'states.db');
const db = new Database(dbPath);

// Using String.raw to preserve {{placeholders}}
const templates = [
  {
    id: 'dot-director-smart',
    letter_type: 'dot_director',
    grant_type: 'SMART',
    subject_line: 'Letter of Support - {{projectTitle}} SMART Grant Application',
    salutation: 'Dear Selection Committee:',
    opening_paragraph: 'On behalf of the {{stateName}} Department of Transportation, I am pleased to provide this letter of support for {{projectTitle}}. This project represents a critical investment in our state\'s transportation infrastructure and aligns directly with the SMART Grant Program\'s objectives of advancing transportation technology and innovation.',
    body_template: '{{stateName}} DOT has made significant investments in intelligent transportation systems, with {{totalITSDevices}} connected devices currently deployed across our highway network. This existing infrastructure provides a strong foundation for the proposed {{projectTitle}}.\n\nThe project will deploy {{proposedEquipment}} to enhance safety, mobility, and efficiency along {{corridorDescription}}. Our preliminary analysis indicates this deployment will:\n\n• Reduce crashes by an estimated {{crashReduction}}%\n• Improve travel time reliability by {{travelTimeImprovement}}%\n• Support connected and automated vehicle deployment\n• Enhance real-time traveler information\n\nThis project has been developed in coordination with our partner agencies and is consistent with our Regional ITS Architecture documented in RAD-IT. {{pooledFundNote}}\n\n{{stateName}} DOT commits to providing the required {{matchPercentage}}% match (${{matchAmount}}) and will assume responsibility for long-term operations and maintenance.',
    closing_paragraph: 'We strongly support this application and believe {{projectTitle}} will deliver measurable benefits to our transportation system and traveling public. Please contact me if you require additional information.',
    signature_block: 'Sincerely,\n\n{{directorName}}\nDirector\n{{stateName}} Department of Transportation',
    required_fields: JSON.stringify(['projectTitle', 'stateName', 'totalITSDevices', 'proposedEquipment', 'corridorDescription', 'matchPercentage', 'matchAmount', 'directorName']),
    optional_fields: JSON.stringify(['crashReduction', 'travelTimeImprovement', 'pooledFundNote']),
    description: 'State DOT Director letter of support for SMART Grant applications',
    usage_notes: 'Use for connected vehicle, ITS, and transportation technology projects'
  },
  {
    id: 'dot-director-raise',
    letter_type: 'dot_director',
    grant_type: 'RAISE',
    subject_line: 'Letter of Support - {{projectTitle}} RAISE Grant Application',
    salutation: 'Dear RAISE Grant Selection Committee:',
    opening_paragraph: 'The {{stateName}} Department of Transportation enthusiastically supports {{projectTitle}} and respectfully requests consideration for a RAISE Grant. This project directly addresses critical transportation needs in our state and aligns with the program\'s merit criteria.',
    body_template: '{{projectTitle}} will improve safety, mobility, and economic competitiveness along {{corridorDescription}}, which serves {{annualTrafficVolume}} vehicles daily and is a critical {{corridorType}}.\n\nProject Benefits:\n\nSAFETY: Our analysis of {{incidentCount}} incidents over the past year indicates this project will reduce crashes by {{crashReduction}}% through {{safetyMeasures}}.\n\nECONOMIC IMPACT: The corridor supports ${{annualFreightValue}} in annual freight movement. Expected benefits include:\n• Reduced delay costs: ${{delaySavings}} annually\n• Improved freight reliability\n• Enhanced economic competitiveness\n\nEQUITY & SUSTAINABILITY: The project serves {{disadvantagedCommunities}} and incorporates sustainable design elements including {{sustainabilityFeatures}}.\n\nINNOVATION: Deployment of {{itsEquipment}} will provide real-time information, enhance coordination, and support emerging connected vehicle technologies.\n\n{{stateName}} DOT commits {{matchPercentage}}% (${{matchAmount}}) in matching funds and has secured commitments from {{partnerAgencies}}. Our state will be responsible for ongoing operations and maintenance.',
    closing_paragraph: 'This project represents a transformational investment in our transportation infrastructure. We respectfully request your favorable consideration and are available to provide any additional information.',
    signature_block: 'Respectfully,\n\n{{directorName}}\nDirector\n{{stateName}} Department of Transportation',
    required_fields: JSON.stringify(['projectTitle', 'stateName', 'corridorDescription', 'directorName', 'matchPercentage', 'matchAmount']),
    optional_fields: JSON.stringify(['annualTrafficVolume', 'corridorType', 'incidentCount', 'crashReduction', 'safetyMeasures', 'annualFreightValue', 'delaySavings', 'disadvantagedCommunities', 'sustainabilityFeatures', 'itsEquipment', 'partnerAgencies']),
    description: 'State DOT Director letter of support for RAISE Grant applications',
    usage_notes: 'Emphasizes safety, economic impact, equity, and sustainability'
  },
  {
    id: 'partner-state-pooled',
    letter_type: 'partner_state',
    grant_type: 'generic',
    subject_line: 'Letter of Commitment - {{projectTitle}} Multi-State Partnership',
    salutation: 'Dear Selection Committee:',
    opening_paragraph: 'As {{partnerStateName}} DOT Director, I am writing to confirm our partnership and commitment to {{projectTitle}}, a multi-state initiative led by {{leadStateName}} DOT.',
    body_template: 'This regional project will deploy intelligent transportation systems across {{corridorMiles}} miles of {{corridorName}}, providing continuous coverage and interoperability across state boundaries.\n\n{{partnerStateName}} COMMITMENTS:\n• Deploy {{partnerStateEquipment}} within our jurisdiction\n• Contribute ${{partnerMatchAmount}} in matching funds ({{partnerMatchPercentage}}% of partner state share)\n• Coordinate operations through our Traffic Management Center\n• Share real-time data and maintain interoperable systems\n• Support long-term operations and maintenance\n\nEXISTING INFRASTRUCTURE:\nOur state has already deployed {{partnerStateITSCount}} ITS devices, demonstrating our capability and commitment to advanced transportation technology.\n\nREGIONAL BENEFITS:\nThis coordinated approach will maximize benefits through:\n• Seamless traveler information across state lines\n• Coordinated incident response\n• Continuous V2X connectivity for connected vehicles\n• Shared best practices and operational efficiencies\n\nWe have participated in the development of the Regional ITS Architecture and our systems are ARC-IT 10.0 compliant to ensure interoperability.',
    closing_paragraph: '{{partnerStateName}} DOT is fully committed to this partnership and the successful implementation of {{projectTitle}}.',
    signature_block: 'Respectfully,\n\n{{partnerDirectorName}}\nDirector\n{{partnerStateName}} Department of Transportation',
    required_fields: JSON.stringify(['projectTitle', 'partnerStateName', 'leadStateName', 'corridorName', 'partnerMatchAmount', 'partnerDirectorName']),
    optional_fields: JSON.stringify(['corridorMiles', 'partnerStateEquipment', 'partnerMatchPercentage', 'partnerStateITSCount']),
    description: 'Partner state DOT commitment letter for multi-state/pooled fund projects',
    usage_notes: 'Use for any grant with multi-state coordination'
  },
  {
    id: 'governor-major-project',
    letter_type: 'governor',
    grant_type: 'generic',
    subject_line: 'Letter of Support - {{projectTitle}}',
    salutation: 'Dear Selection Committee:',
    opening_paragraph: 'As Governor of {{stateName}}, I am pleased to express my strong support for {{projectTitle}}. This project is a top priority for our administration and represents a critical investment in our state\'s transportation infrastructure and economic future.',
    body_template: '{{projectTitle}} aligns with our state\'s strategic priorities including economic development, safety, and quality of life for our citizens. The project will {{projectImpact}}.\n\nThis investment supports:\n• Economic Growth: The corridor serves {{economicImpact}}\n• Safety: Expected reduction of {{safetyBenefit}}\n• Innovation: Deployment of {{technologyBenefit}}\n• Regional Coordination: Partnership with {{partnerStates}}\n\nOur administration has prioritized this project in our state transportation plan and capital budget. {{stateName}} commits the required matching funds and will ensure successful project delivery through our Department of Transportation.\n\nI have directed our DOT to provide full support and cooperation to ensure this project\'s success.',
    closing_paragraph: 'I respectfully urge your favorable consideration of this application. {{projectTitle}} will deliver significant benefits to our state and the nation\'s transportation system.',
    signature_block: 'Sincerely,\n\n{{governorName}}\nGovernor\nState of {{stateName}}',
    required_fields: JSON.stringify(['projectTitle', 'stateName', 'governorName', 'projectImpact']),
    optional_fields: JSON.stringify(['economicImpact', 'safetyBenefit', 'technologyBenefit', 'partnerStates']),
    description: 'Governor letter of support for major transportation projects',
    usage_notes: 'Use for high-priority, large-scale projects requiring executive support'
  },
  {
    id: 'mpo-regional-support',
    letter_type: 'mpo',
    grant_type: 'generic',
    subject_line: 'Letter of Support - {{projectTitle}}',
    salutation: 'Dear Selection Committee:',
    opening_paragraph: 'The {{mpoName}} is pleased to provide this letter of support for {{projectTitle}}. This project has been identified as a priority in our Regional Transportation Plan and will significantly benefit our metropolitan area.',
    body_template: '{{projectTitle}} is consistent with our region\'s goals for {{regionalGoals}}. The project serves:\n• Population: {{populationServed}}\n• Daily Traffic: {{dailyTraffic}} vehicles\n• Economic Activity: ${{economicValue}} annually\n\nPLANNING CONSISTENCY:\nThis project is included in our:\n• Regional Transportation Plan ({{planYear}})\n• Transportation Improvement Program (TIP)\n• Regional ITS Architecture\n\nREGIONAL BENEFITS:\n• {{benefit1}}\n• {{benefit2}}\n• {{benefit3}}\n\nOur MPO has participated in project development and endorses this application. The project has strong support from our Policy Board representing {{jurisdictionCount}} local jurisdictions.',
    closing_paragraph: 'We strongly support this application and believe {{projectTitle}} will deliver significant benefits to our region.',
    signature_block: 'Sincerely,\n\n{{mpoDirectorName}}\nExecutive Director\n{{mpoName}}',
    required_fields: JSON.stringify(['projectTitle', 'mpoName', 'mpoDirectorName', 'regionalGoals']),
    optional_fields: JSON.stringify(['populationServed', 'dailyTraffic', 'economicValue', 'planYear', 'benefit1', 'benefit2', 'benefit3', 'jurisdictionCount']),
    description: 'Metropolitan Planning Organization letter of support',
    usage_notes: 'Use to demonstrate regional planning consistency and support'
  },
  {
    id: 'dot-director-fmcsa-itd',
    letter_type: 'dot_director',
    grant_type: 'FMCSA_ITD',
    subject_line: 'Letter of Support - {{projectTitle}} FMCSA CMV IT&D Grant Application',
    salutation: 'Dear FMCSA Selection Committee:',
    opening_paragraph: 'On behalf of the {{stateName}} Department of Transportation, I am pleased to provide this letter of support for {{projectTitle}}. This project will enhance commercial motor vehicle safety and efficiency through advanced information technology and data systems, directly supporting FMCSA\'s mission to reduce crashes, injuries, and fatalities involving large trucks and buses.',
    body_template: '{{stateName}} is a critical freight corridor state with {{annualTruckVolume}} commercial vehicles traveling our highways annually. This project will deploy {{proposedSystems}} to improve CMV safety, compliance, and operations.\n\nPROJECT COMPONENTS:\n\nDATA INTEGRATION: The project will integrate real-time data from:\n• Electronic screening systems at {{weighStationCount}} weigh stations\n• ATRI truck parking availability data for {{parkingFacilityCount}} facilities\n• Safety inspection records and violation data\n• Credential verification and bypass systems\n\nINFRASTRUCTURE IMPROVEMENTS:\n• {{truckParkingInfrastructure}}\n• Enhanced weigh station technology\n• Real-time parking availability systems\n• Driver notification and guidance systems\n\nSAFETY BENEFITS:\nOur analysis indicates this project will:\n• Reduce CMV-related crashes by {{crashReduction}}%\n• Improve HOS compliance through better parking availability\n• Reduce unsafe parking on highway shoulders and ramps\n• Enhance electronic screening efficiency by {{efficiencyImprovement}}%\n\nDATA SHARING: {{stateName}} commits to sharing all data collected through this project with FMCSA, participating states, and industry stakeholders. We will integrate with national systems including CVISN, e-Screening, and the National Truck Parking Information System.\n\n{{stateName}} DOT commits {{matchPercentage}}% (${{matchAmount}}) in matching funds and will ensure ongoing operations and data maintenance.',
    closing_paragraph: 'This project represents a significant advancement in commercial vehicle safety and efficiency for {{stateName}} and the national freight network. We respectfully request your favorable consideration.',
    signature_block: 'Respectfully,\n\n{{directorName}}\nDirector\n{{stateName}} Department of Transportation',
    required_fields: JSON.stringify(['projectTitle', 'stateName', 'proposedSystems', 'directorName', 'matchPercentage', 'matchAmount']),
    optional_fields: JSON.stringify(['annualTruckVolume', 'weighStationCount', 'parkingFacilityCount', 'truckParkingInfrastructure', 'crashReduction', 'efficiencyImprovement']),
    description: 'State DOT Director letter for FMCSA CMV IT&D Grant with truck parking focus',
    usage_notes: 'Use for FMCSA grants involving CMV data systems, weigh stations, parking availability, and ATRI data integration'
  }
];

try {
  console.log('📝 Populating support letter templates...\n');

  const insertStmt = db.prepare(
    'INSERT OR REPLACE INTO support_letter_templates ' +
    '(id, letter_type, grant_type, subject_line, salutation, opening_paragraph, body_template, closing_paragraph, signature_block, required_fields, optional_fields, description, usage_notes) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  let count = 0;
  for (const template of templates) {
    insertStmt.run(
      template.id,
      template.letter_type,
      template.grant_type,
      template.subject_line,
      template.salutation,
      template.opening_paragraph,
      template.body_template,
      template.closing_paragraph,
      template.signature_block,
      template.required_fields,
      template.optional_fields,
      template.description,
      template.usage_notes
    );
    console.log('✅ ' + template.id + ' - ' + template.description);
    count++;
  }

  console.log('\n✅ Successfully populated ' + count + ' letter templates\n');

  console.log('📊 Templates by Type:');
  const byType = db.prepare('SELECT letter_type, COUNT(*) as count FROM support_letter_templates GROUP BY letter_type').all();
  byType.forEach(function(row) {
    console.log('   - ' + row.letter_type + ': ' + row.count + ' templates');
  });

  console.log('\n📊 Templates by Grant Type:');
  const byGrant = db.prepare('SELECT grant_type, COUNT(*) as count FROM support_letter_templates GROUP BY grant_type').all();
  byGrant.forEach(function(row) {
    console.log('   - ' + (row.grant_type || 'generic') + ': ' + row.count + ' templates');
  });

  db.close();
} catch (error) {
  console.error('❌ Error populating templates:', error);
  process.exit(1);
}

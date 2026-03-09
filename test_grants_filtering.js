/**
 * Test grants filtering to ensure only ITS/digital infrastructure grants are returned
 */

const grantsService = require('./services/grants-service');

console.log('🧪 Testing Grants Filtering for ITS/Digital Infrastructure');
console.log('='.repeat(70));

// Test opportunities - simulating various grant types
const testGrants = [
  {
    id: 'TEST-001',
    title: 'Connected Vehicle Deployment Program',
    description: 'Fund deployment of connected vehicle technology and V2X infrastructure for intelligent transportation systems',
    category: 'Transportation Technology',
    agency: 'US DOT'
  },
  {
    id: 'TEST-002',
    title: 'Bridge Repair and Rehabilitation',
    description: 'Funding for bridge construction, concrete repair, and structural rehabilitation projects',
    category: 'Infrastructure',
    agency: 'FHWA'
  },
  {
    id: 'TEST-003',
    title: 'SMART Grant - Intelligent Transportation Technology',
    description: 'Deploy ITS equipment, traffic management center upgrades, and transportation data exchange systems',
    category: 'Transportation Technology',
    agency: 'US DOT'
  },
  {
    id: 'TEST-004',
    title: 'Pavement Resurfacing Initiative',
    description: 'Highway construction and asphalt resurfacing for roadway maintenance',
    category: 'Highway Maintenance',
    agency: 'State DOT'
  },
  {
    id: 'TEST-005',
    title: 'Work Zone Data Exchange (WZDx) Implementation',
    description: 'Support for real-time work zone data integration and multi-state coordination through WZDx standards',
    category: 'Data Systems',
    agency: 'US DOT'
  },
  {
    id: 'TEST-006',
    title: 'Disadvantaged Business Enterprise Capacity Building',
    description: 'Workforce development and small business set-aside for SDVOSB contractors',
    category: 'Business Development',
    agency: 'DOT'
  },
  {
    id: 'TEST-007',
    title: 'Traffic Management System Modernization',
    description: 'Upgrade traffic sensors, dynamic message signs, and TMC software for TSMO operations',
    category: 'ITS',
    agency: 'FHWA'
  },
  {
    id: 'TEST-008',
    title: 'Pedestrian and Bicycle Infrastructure',
    description: 'Sidewalk construction, curb ramps, and bicycle lane development',
    category: 'Active Transportation',
    agency: 'FHWA'
  },
  {
    id: 'TEST-009',
    title: 'ATCMTD - Advanced Transportation Technologies',
    description: 'Deploy connected automated vehicles (CAV), smart mobility solutions, and digital infrastructure',
    category: 'Transportation Technology',
    agency: 'US DOT'
  },
  {
    id: 'TEST-010',
    title: 'Stormwater Management and Drainage Systems',
    description: 'Environmental compliance for roadway drainage and stormwater infrastructure',
    category: 'Environment',
    agency: 'EPA'
  }
];

console.log('\n📊 Testing Grant Filtering\n');

// Score all test grants
const scored = grantsService.scoreOpportunities(testGrants, null, true);

console.log('✅ ACCEPTED GRANTS (Score ≥ 35, ITS/Digital Infrastructure):');
console.log('-'.repeat(70));
scored.forEach(grant => {
  console.log(`\n${grant.id}: ${grant.title}`);
  console.log(`   Score: ${grant.relevanceScore} | Relevance: ${grant.relevance} | Priority: ${grant.priority}`);
  console.log(`   Match Reasons: ${grant.matchReasons.join(', ')}`);
  if (grant.platformAlignment.capabilities.length > 0) {
    console.log(`   Platform Alignment: ${grant.platformAlignment.level} (${grant.platformAlignment.score}%)`);
    console.log(`   Capabilities: ${grant.platformAlignment.capabilities.join(', ')}`);
  }
});

console.log('\n\n❌ REJECTED GRANTS (Score < 35 or excluded):');
console.log('-'.repeat(70));
const rejected = testGrants.filter(g => !scored.find(s => s.id === g.id));
rejected.forEach(grant => {
  const scoredVersion = grantsService.scoreOpportunities([grant], null, true)[0];
  if (scoredVersion) {
    console.log(`\n${grant.id}: ${grant.title}`);
    console.log(`   Score: ${scoredVersion.relevanceScore} | Reason: ${scoredVersion.matchReasons.join(', ')}`);
  } else {
    console.log(`\n${grant.id}: ${grant.title}`);
    console.log(`   Score: 0 | Reason: Excluded by negative keywords`);
  }
});

console.log('\n\n' + '='.repeat(70));
console.log('📈 Summary:');
console.log(`   Total Grants Tested: ${testGrants.length}`);
console.log(`   Accepted (ITS/Digital): ${scored.length}`);
console.log(`   Rejected (Non-ITS): ${rejected.length}`);
console.log(`   Filter Accuracy: ${((scored.length / testGrants.length) * 100).toFixed(0)}% precision`);

console.log('\n✅ Expected Results:');
console.log('   Should ACCEPT: TEST-001, TEST-003, TEST-005, TEST-007, TEST-009');
console.log('   Should REJECT: TEST-002, TEST-004, TEST-006, TEST-008, TEST-010');

const expectedAccept = ['TEST-001', 'TEST-003', 'TEST-005', 'TEST-007', 'TEST-009'];
const actualAccepted = scored.map(g => g.id);
const correctlyAccepted = expectedAccept.filter(id => actualAccepted.includes(id));
const incorrectlyAccepted = actualAccepted.filter(id => !expectedAccept.includes(id));
const incorrectlyRejected = expectedAccept.filter(id => !actualAccepted.includes(id));

console.log('\n🎯 Test Results:');
console.log(`   ✅ Correctly Accepted: ${correctlyAccepted.length}/${expectedAccept.length}`);
if (incorrectlyAccepted.length > 0) {
  console.log(`   ⚠️  Incorrectly Accepted: ${incorrectlyAccepted.join(', ')}`);
}
if (incorrectlyRejected.length > 0) {
  console.log(`   ❌ Incorrectly Rejected: ${incorrectlyRejected.join(', ')}`);
}

if (correctlyAccepted.length === expectedAccept.length && incorrectlyAccepted.length === 0) {
  console.log('\n✅ ALL TESTS PASSED - Filtering is working correctly!\n');
} else {
  console.log('\n⚠️  TESTS NEED ADJUSTMENT - Review filtering logic\n');
}

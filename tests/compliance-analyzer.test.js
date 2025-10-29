const assert = require('node:assert/strict');
const path = require('node:path');

const ComplianceAnalyzer = require(path.join('..', 'compliance-analyzer'));

const analyzer = new ComplianceAnalyzer();

const hourFromNow = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const nowISO = () => new Date().toISOString();

const baseEvent = {
  id: 'evt-100',
  eventType: 'work-zone',
  type: 'work-zone',
  startTime: nowISO(),
  endTime: hourFromNow(),
  coordinates: [-75.1234, 39.9876],
  corridor: 'I-76',
  direction: 'northbound',
  lanesAffected: 'Lane 1',
  description: 'Work zone activity on I-76 near exit 12 with crews on site.',
  severity: 'medium',
  state: 'PA',
  roadStatus: 'restricted',
  lanesClosed: '1',
  source: 'WZDx Test Feed'
};

const normalizationEvent = {
  ...baseEvent,
  id: 'evt-200',
  direction: 'NB',          // should normalize to northbound
  severity: 'MAJOR',        // should normalize to high
  eventType: 'Construction',
  roadStatus: 'Closed',
  type: 'Construction'
};

const missingCriticalEvent = {
  ...baseEvent,
  id: 'evt-300',
  coordinates: null,        // drop critical field
  latitude: null,
  longitude: null
};

function testWZDxPasses() {
  const result = analyzer.analyzeWZDxCompliance([baseEvent]);
  assert.ok(result.percentage >= 95, `Expected high compliance, got ${result.percentage}`);
  assert.equal(result.grade, 'A', `Expected grade A, received ${result.grade}`);
  assert.equal(result.violations.length, 0, 'Expected zero WZDx violations for complete event');
}

function testCriticalFailureDropsGrade() {
  const result = analyzer.analyzeWZDxCompliance([missingCriticalEvent]);
  assert.notEqual(result.grade, 'A', 'Critical missing field should degrade grade');
  assert.ok(result.severityBreakdown.critical < 0.95, 'Critical coverage should drop when coordinates are missing');
  const coordinateViolation = result.violations.find(v => v.field === 'coordinates');
  assert.ok(coordinateViolation, 'Missing coordinates should be flagged as a violation');
}

function testNormalizationAcrossStandards() {
  const sae = analyzer.analyzeSAEJ2735Compliance([normalizationEvent]);
  assert.notEqual(sae.grade, 'F', 'Normalized SAE event should not fail outright');
  assert.ok(sae.percentage >= 70, `Expected SAE compliance >=70, got ${sae.percentage}`);

  const tmdd = analyzer.analyzeTMDDCompliance([normalizationEvent]);
  assert.notEqual(tmdd.grade, 'F', 'Normalized TMDD event should not fail outright');
  assert.ok(tmdd.percentage >= 70, `Expected TMDD compliance >=70, got ${tmdd.percentage}`);
}

(function run() {
  testWZDxPasses();
  testCriticalFailureDropsGrade();
  testNormalizationAcrossStandards();
  console.log('✅ Compliance Analyzer spec-based tests passed.');
})();

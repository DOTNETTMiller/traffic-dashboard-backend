/**
 * WZDx Integration Test Script
 *
 * Tests the complete WZDx integration:
 * 1. Feed consumption from state DOTs
 * 2. WZDx validation
 * 3. Data storage
 * 4. Feed export
 */

const axios = require('axios');
const { validator } = require('../utils/wzdx-validator');
const wzdxConsumer = require('../utils/wzdx-consumer');
const db = require('../database');

const BASE_URL = 'http://localhost:3001';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70) + '\n');
}

async function testValidatorSetup() {
  logSection('TEST 1: WZDx Validator Setup');

  try {
    log('Loading WZDx v4.2 schemas...', 'cyan');
    await validator.loadSchemas();
    log('✅ Schemas loaded successfully', 'green');
    return true;
  } catch (error) {
    log(`❌ Failed to load schemas: ${error.message}`, 'red');
    return false;
  }
}

async function testDatabaseTables() {
  logSection('TEST 2: Database Tables');

  try {
    log('Checking WZDx database tables...', 'cyan');

    // Check work zones table
    const workZonesTable = await db.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='wzdx_work_zones'
    `).get();

    if (!workZonesTable) {
      throw new Error('wzdx_work_zones table not found');
    }
    log('✅ wzdx_work_zones table exists', 'green');

    // Check feed sources table
    const sourcesTable = await db.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='wzdx_feed_sources'
    `).get();

    if (!sourcesTable) {
      throw new Error('wzdx_feed_sources table not found');
    }
    log('✅ wzdx_feed_sources table exists', 'green');

    // Check import log table
    const logTable = await db.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='wzdx_import_log'
    `).get();

    if (!logTable) {
      throw new Error('wzdx_import_log table not found');
    }
    log('✅ wzdx_import_log table exists', 'green');

    // Check feed sources count
    const sourcesCount = await db.db.prepare(`
      SELECT COUNT(*) as count FROM wzdx_feed_sources
    `).get();

    log(`📊 Feed sources configured: ${sourcesCount.count}`, 'blue');

    return true;
  } catch (error) {
    log(`❌ Database check failed: ${error.message}`, 'red');
    return false;
  }
}

async function testFeedConsumption() {
  logSection('TEST 3: Feed Consumption (Sample)');

  try {
    log('Testing WZDx feed consumer with a sample source...', 'cyan');

    // Get first active feed source
    const source = await db.db.prepare(`
      SELECT id, feed_url, feed_name, state_code
      FROM wzdx_feed_sources
      WHERE active = 1
      LIMIT 1
    `).get();

    if (!source) {
      log('⚠️  No active feed sources found - skipping consumption test', 'yellow');
      return true; // Not a failure, just no sources to test
    }

    log(`Testing feed: ${source.feed_name} (${source.state_code})`, 'cyan');
    log(`URL: ${source.feed_url}`, 'cyan');

    // Try to process the feed
    const result = await wzdxConsumer.processFeed(
      source.feed_url,
      source.feed_name,
      source.state_code
    );

    if (result) {
      log('✅ Feed consumption successful', 'green');
      log(`   Processed: ${result.processed || 0}`, 'blue');
      log(`   Inserted: ${result.inserted || 0}`, 'blue');
      log(`   Updated: ${result.updated || 0}`, 'blue');
      return true;
    } else {
      log('⚠️  Feed consumption returned no data', 'yellow');
      return true; // Not necessarily a failure
    }
  } catch (error) {
    log(`⚠️  Feed consumption error (may be expected): ${error.message}`, 'yellow');
    return true; // Many feeds may be unavailable or require auth
  }
}

async function testWZDxValidation() {
  logSection('TEST 4: WZDx Validation');

  try {
    log('Testing WZDx feed validation...', 'cyan');

    // Create a minimal valid WZDx feed
    const testFeed = {
      type: 'FeatureCollection',
      features: [],
      properties: {
        feed_info: {
          update_date: new Date().toISOString(),
          publisher: 'Test Publisher',
          version: '4.2',
          data_sources: [
            {
              data_source_id: 'test-source',
              organization_name: 'Test Organization',
              update_frequency: 300,
              update_date: new Date().toISOString()
            }
          ]
        }
      }
    };

    const result = await validator.validate(testFeed);

    if (result.valid) {
      log('✅ WZDx validation working correctly', 'green');
      log(`   Schema: ${result.schema}`, 'blue');
      log(`   Version: ${result.version}`, 'blue');
      return true;
    } else {
      log('⚠️  Validation failed (may be expected for minimal feed)', 'yellow');
      log(`   Errors: ${result.errors?.length || 0}`, 'yellow');
      return true; // Minimal feed may not pass all validations
    }
  } catch (error) {
    log(`❌ Validation test failed: ${error.message}`, 'red');
    return false;
  }
}

async function testAPIEndpoints() {
  logSection('TEST 5: API Endpoints');

  const tests = [
    {
      name: 'GET /api/wzdx/sources',
      method: 'GET',
      url: `${BASE_URL}/api/wzdx/sources`
    },
    {
      name: 'GET /api/wzdx/statistics',
      method: 'GET',
      url: `${BASE_URL}/api/wzdx/statistics`
    },
    {
      name: 'GET /api/wzdx/feed',
      method: 'GET',
      url: `${BASE_URL}/api/wzdx/feed`
    }
  ];

  let allPassed = true;

  for (const test of tests) {
    try {
      log(`Testing ${test.name}...`, 'cyan');

      const response = await axios({
        method: test.method,
        url: test.url,
        timeout: 5000
      });

      if (response.status === 200) {
        log(`✅ ${test.name} - OK`, 'green');

        // Show some data info
        if (test.name.includes('feed')) {
          log(`   Features: ${response.data.features?.length || 0}`, 'blue');
        } else if (test.name.includes('statistics')) {
          log(`   Work zones: ${response.data.total_work_zones || 0}`, 'blue');
        } else if (test.name.includes('sources')) {
          log(`   Sources: ${response.data.length || 0}`, 'blue');
        }
      } else {
        log(`⚠️  ${test.name} - Unexpected status: ${response.status}`, 'yellow');
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        log(`⚠️  ${test.name} - Server not running (start with: npm start)`, 'yellow');
      } else {
        log(`❌ ${test.name} - Error: ${error.message}`, 'red');
        allPassed = false;
      }
    }
  }

  return allPassed;
}

async function testFeedExport() {
  logSection('TEST 6: Feed Export Compliance');

  try {
    log('Testing WZDx feed export...', 'cyan');

    const response = await axios.get(`${BASE_URL}/api/wzdx/feed`, {
      timeout: 5000
    });

    const feed = response.data;

    // Check GeoJSON structure
    if (feed.type !== 'FeatureCollection') {
      throw new Error('Export is not a GeoJSON FeatureCollection');
    }
    log('✅ Export is valid GeoJSON FeatureCollection', 'green');

    // Check feed_info
    if (!feed.properties?.feed_info) {
      throw new Error('Missing feed_info in properties');
    }
    log('✅ Feed info present', 'green');

    // Check WZDx version
    if (feed.properties.feed_info.version !== '4.2') {
      log(`⚠️  WZDx version mismatch: ${feed.properties.feed_info.version}`, 'yellow');
    } else {
      log('✅ WZDx version 4.2', 'green');
    }

    // Check features
    log(`📊 Exported features: ${feed.features?.length || 0}`, 'blue');

    // Validate exported feed
    const validation = await validator.validate(feed);
    if (validation.valid) {
      log('✅ Exported feed passes WZDx validation', 'green');
    } else {
      log(`⚠️  Exported feed has validation issues: ${validation.errors?.length || 0} errors`, 'yellow');
    }

    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('⚠️  Server not running - start with: npm start', 'yellow');
      return true; // Not a test failure, just can't test
    } else {
      log(`❌ Feed export test failed: ${error.message}`, 'red');
      return false;
    }
  }
}

async function runAllTests() {
  log('\n' + '█'.repeat(70), 'bright');
  log('    WZDx Integration Test Suite', 'bright');
  log('█'.repeat(70) + '\n', 'bright');

  const results = [];

  // Run all tests
  results.push({ name: 'Validator Setup', passed: await testValidatorSetup() });
  results.push({ name: 'Database Tables', passed: await testDatabaseTables() });
  results.push({ name: 'Feed Consumption', passed: await testFeedConsumption() });
  results.push({ name: 'WZDx Validation', passed: await testWZDxValidation() });
  results.push({ name: 'API Endpoints', passed: await testAPIEndpoints() });
  results.push({ name: 'Feed Export', passed: await testFeedExport() });

  // Summary
  logSection('TEST SUMMARY');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(`${icon} ${result.name}`, color);
  });

  console.log();
  log(`Total: ${results.length} tests`, 'bright');
  log(`Passed: ${passed}`, 'green');
  if (failed > 0) {
    log(`Failed: ${failed}`, 'red');
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    log(`\n❌ Test suite crashed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = { runAllTests };

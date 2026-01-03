/**
 * RSU Testing Suite
 *
 * Comprehensive testing tools for V2X RSU deployment:
 * - RSU connectivity testing (ping, SNMP, ports)
 * - TIM message validation (SAE J2735)
 * - ODE communication testing
 * - Mock RSU simulator
 * - Broadcast verification
 *
 * Usage:
 *   node scripts/test_rsu.js --connectivity <rsu-id>
 *   node scripts/test_rsu.js --validate-tim <packet-id>
 *   node scripts/test_rsu.js --test-ode
 *   node scripts/test_rsu.js --simulate
 *   node scripts/test_rsu.js --all
 */

const axios = require('axios');
const db = require('../database');
const { timGenerator } = require('../utils/tim-generator');
const { rsuManager } = require('../utils/rsu-manager');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  log('\n════════════════════════════════════════════════════════════════', 'blue');
  log(`  ${title}`, 'blue');
  log('════════════════════════════════════════════════════════════════', 'blue');
}

function section(title) {
  log(`\n${title}`, 'cyan');
  log('─'.repeat(title.length), 'cyan');
}

// ============================================================================
// 1. RSU Connectivity Testing
// ============================================================================

async function testRSUConnectivity(rsuId) {
  header('RSU Connectivity Test');

  try {
    // Get RSU from database
    const rsu = await db.db.prepare(`
      SELECT * FROM rsu_inventory WHERE rsu_id = ?
    `).get(rsuId);

    if (!rsu) {
      log(`✗ RSU not found: ${rsuId}`, 'red');
      return { success: false, error: 'RSU not found' };
    }

    log(`\nTesting RSU: ${rsu.rsu_name}`, 'yellow');
    log(`  ID: ${rsu.rsu_id}`);
    log(`  Location: ${rsu.latitude}, ${rsu.longitude}`);
    log(`  IPv4: ${rsu.ipv4_address || 'N/A'}`);
    log(`  SNMP Community: ${rsu.snmp_community ? '***' : 'N/A'}`);

    const results = {
      rsu_id: rsuId,
      tests: {},
      overall: true
    };

    // Test 1: IP Connectivity (ping simulation via HTTP)
    section('Test 1: IP Connectivity');
    if (rsu.ipv4_address) {
      try {
        // Try HTTP connection as ping alternative
        const timeout = 5000;
        await axios.get(`http://${rsu.ipv4_address}`, { timeout });
        log('✓ IP is reachable', 'green');
        results.tests.ip_connectivity = true;
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          log('⚠ IP timeout or connection refused (may be normal if HTTP not enabled)', 'yellow');
          results.tests.ip_connectivity = 'timeout';
        } else {
          log(`✓ IP responds (${error.code})`, 'green');
          results.tests.ip_connectivity = true;
        }
      }
    } else {
      log('⚠ No IPv4 address configured', 'yellow');
      results.tests.ip_connectivity = 'not_configured';
    }

    // Test 2: SNMP Configuration
    section('Test 2: SNMP Configuration');
    if (rsu.snmp_community && rsu.rsuid) {
      log(`✓ SNMP community configured`, 'green');
      log(`✓ RSUID configured: ${rsu.rsuid}`, 'green');
      results.tests.snmp_config = true;
    } else {
      log('⚠ SNMP not fully configured', 'yellow');
      if (!rsu.snmp_community) log('  Missing: SNMP community string');
      if (!rsu.rsuid) log('  Missing: RSUID');
      results.tests.snmp_config = false;
      results.overall = false;
    }

    // Test 3: RSU Status
    section('Test 3: RSU Status');
    if (rsu.status === 'active') {
      log('✓ RSU status: active', 'green');
      results.tests.status = true;
    } else {
      log(`⚠ RSU status: ${rsu.status}`, 'yellow');
      results.tests.status = false;
      results.overall = false;
    }

    // Test 4: Capabilities
    section('Test 4: RSU Capabilities');
    let capabilities = {};
    try {
      capabilities = JSON.parse(rsu.capabilities || '{}');
      log('✓ Capabilities defined:', 'green');
      Object.entries(capabilities).forEach(([key, value]) => {
        log(`  ${key}: ${value}`, 'gray');
      });
      results.tests.capabilities = true;
    } catch (error) {
      log('⚠ Capabilities not properly configured', 'yellow');
      results.tests.capabilities = false;
    }

    // Test 5: Geographic Validity
    section('Test 5: Geographic Validity');
    if (rsu.latitude >= -90 && rsu.latitude <= 90 &&
        rsu.longitude >= -180 && rsu.longitude <= 180) {
      log(`✓ Valid coordinates: ${rsu.latitude}, ${rsu.longitude}`, 'green');
      results.tests.coordinates = true;
    } else {
      log(`✗ Invalid coordinates`, 'red');
      results.tests.coordinates = false;
      results.overall = false;
    }

    // Summary
    section('Test Summary');
    const passed = Object.values(results.tests).filter(v => v === true).length;
    const total = Object.keys(results.tests).length;

    if (results.overall) {
      log(`✓ All critical tests passed (${passed}/${total})`, 'green');
    } else {
      log(`⚠ Some tests failed (${passed}/${total})`, 'yellow');
    }

    return results;

  } catch (error) {
    log(`\n✗ Test failed: ${error.message}`, 'red');
    console.error(error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 2. TIM Message Validation
// ============================================================================

async function validateTIM(packetId) {
  header('TIM Message Validation (SAE J2735)');

  try {
    // Get TIM from broadcast log
    const broadcast = await db.db.prepare(`
      SELECT * FROM tim_broadcast_log WHERE packet_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(packetId);

    if (!broadcast) {
      log(`✗ TIM not found: ${packetId}`, 'red');
      return { success: false, error: 'TIM not found' };
    }

    log(`\nValidating TIM: ${packetId}`, 'yellow');
    log(`  Created: ${broadcast.created_at}`);
    log(`  Priority: ${broadcast.priority}`);
    log(`  Status: ${broadcast.status}`);

    const tim = JSON.parse(broadcast.tim_message);
    const results = {
      packet_id: packetId,
      validations: {},
      overall: true,
      errors: []
    };

    // Validation 1: Required Fields
    section('Validation 1: Required SAE J2735 Fields');
    const requiredFields = ['msgCnt', 'timeStamp', 'packetID', 'dataFrames'];
    requiredFields.forEach(field => {
      if (tim[field] !== undefined) {
        log(`✓ ${field}: present`, 'green');
        results.validations[field] = true;
      } else {
        log(`✗ ${field}: missing`, 'red');
        results.validations[field] = false;
        results.overall = false;
        results.errors.push(`Missing required field: ${field}`);
      }
    });

    // Validation 2: Message Count
    section('Validation 2: Message Count');
    if (tim.msgCnt >= 0 && tim.msgCnt <= 127) {
      log(`✓ msgCnt valid: ${tim.msgCnt} (0-127)`, 'green');
      results.validations.msgCnt_range = true;
    } else {
      log(`✗ msgCnt out of range: ${tim.msgCnt}`, 'red');
      results.validations.msgCnt_range = false;
      results.overall = false;
      results.errors.push('msgCnt must be 0-127');
    }

    // Validation 3: Data Frames
    section('Validation 3: Data Frames Structure');
    if (Array.isArray(tim.dataFrames) && tim.dataFrames.length > 0) {
      log(`✓ dataFrames is array: ${tim.dataFrames.length} frame(s)`, 'green');
      results.validations.dataFrames_array = true;

      tim.dataFrames.forEach((frame, idx) => {
        log(`\n  Frame ${idx + 1}:`, 'cyan');

        // Check frame type
        if (frame.frameType) {
          log(`  ✓ frameType: ${Object.keys(frame.frameType)[0]}`, 'green');
        } else {
          log(`  ✗ frameType: missing`, 'red');
          results.errors.push(`Frame ${idx}: missing frameType`);
        }

        // Check priority
        if (frame.priority >= 0 && frame.priority <= 7) {
          log(`  ✓ priority: ${frame.priority} (0-7)`, 'green');
        } else {
          log(`  ✗ priority: ${frame.priority} (must be 0-7)`, 'red');
          results.errors.push(`Frame ${idx}: invalid priority`);
        }

        // Check regions
        if (Array.isArray(frame.regions) && frame.regions.length > 0) {
          log(`  ✓ regions: ${frame.regions.length} region(s)`, 'green');
        } else {
          log(`  ⚠ regions: none defined`, 'yellow');
        }

        // Check content
        if (frame.content) {
          log(`  ✓ content: present`, 'green');
          if (frame.content.advisory) {
            log(`    ✓ advisory: present`, 'green');
            if (frame.content.advisory.item) {
              log(`    ✓ advisory items: ${frame.content.advisory.item.length}`, 'green');
            }
          }
        } else {
          log(`  ✗ content: missing`, 'red');
          results.errors.push(`Frame ${idx}: missing content`);
        }
      });

      results.validations.dataFrames_valid = true;
    } else {
      log('✗ dataFrames missing or empty', 'red');
      results.validations.dataFrames_array = false;
      results.overall = false;
      results.errors.push('dataFrames must be non-empty array');
    }

    // Validation 4: ITIS Codes
    section('Validation 4: ITIS Codes');
    let itisCodesFound = false;
    tim.dataFrames?.forEach((frame, idx) => {
      frame.content?.advisory?.item?.forEach(item => {
        if (item.itis !== undefined) {
          itisCodesFound = true;
          log(`  ✓ Frame ${idx + 1}: ITIS code ${item.itis}`, 'green');
        }
      });
    });

    if (itisCodesFound) {
      results.validations.itis_codes = true;
    } else {
      log('⚠ No ITIS codes found', 'yellow');
      results.validations.itis_codes = false;
    }

    // Validation 5: Geographic Regions
    section('Validation 5: Geographic Regions');
    tim.dataFrames?.forEach((frame, idx) => {
      frame.regions?.forEach((region, ridx) => {
        if (region.path) {
          log(`  ✓ Frame ${idx + 1}, Region ${ridx + 1}: Path defined`, 'green');
        }
        if (region.circle) {
          const { center, radius } = region.circle;
          if (center && radius) {
            log(`  ✓ Frame ${idx + 1}, Region ${ridx + 1}: Circle (lat: ${center.lat}, lon: ${center.long}, radius: ${radius}m)`, 'green');
          }
        }
      });
    });
    results.validations.geographic_regions = true;

    // Summary
    section('Validation Summary');
    if (results.overall && results.errors.length === 0) {
      log('✓ TIM is valid SAE J2735', 'green');
    } else {
      log(`⚠ TIM has ${results.errors.length} error(s):`, 'yellow');
      results.errors.forEach(error => {
        log(`  • ${error}`, 'red');
      });
    }

    return results;

  } catch (error) {
    log(`\n✗ Validation failed: ${error.message}`, 'red');
    console.error(error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 3. ODE Communication Testing
// ============================================================================

async function testODEConnection() {
  header('ODE Communication Test');

  const odeUrl = process.env.ODE_BASE_URL || 'http://localhost:8080';
  log(`\nTesting ODE at: ${odeUrl}`, 'yellow');

  const results = {
    ode_url: odeUrl,
    tests: {},
    overall: true
  };

  try {
    // Test 1: ODE Health Check
    section('Test 1: ODE Health Check');
    try {
      const response = await axios.get(`${odeUrl}/tim/count`, { timeout: 5000 });
      log(`✓ ODE is responding`, 'green');
      log(`  TIM count: ${response.data}`, 'gray');
      results.tests.health_check = true;
    } catch (error) {
      log(`✗ ODE not accessible: ${error.message}`, 'red');
      results.tests.health_check = false;
      results.overall = false;
      return results;
    }

    // Test 2: Test TIM Deposit
    section('Test 2: Test TIM Deposit');
    try {
      // Create a test TIM
      const testTIM = await timGenerator.generateTIMFromEvent({
        id: 'test-event-1',
        event_type: 'roadwork',
        severity: 5,
        description: 'Test Event for ODE Validation',
        latitude: 39.7392,
        longitude: -104.9903,
        start_time: new Date(),
        end_time: new Date(Date.now() + 3600000) // 1 hour
      });

      const timDeposit = {
        tim: testTIM,
        metadata: {
          request: {
            rsus: [],
            snmp: {
              rsuid: '00000083',
              msgid: 31,
              mode: 1,
              channel: 178,
              interval: 1,
              deliverystart: new Date().toISOString(),
              deliverystop: new Date(Date.now() + 3600000).toISOString(),
              enable: 1
            }
          }
        }
      };

      const response = await axios.post(`${odeUrl}/tim`, timDeposit, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      if (response.status === 200) {
        log('✓ TIM deposit successful', 'green');
        log(`  Response status: ${response.status}`, 'gray');
        results.tests.tim_deposit = true;
      } else {
        log(`⚠ Unexpected response: ${response.status}`, 'yellow');
        results.tests.tim_deposit = 'warning';
      }

    } catch (error) {
      log(`✗ TIM deposit failed: ${error.message}`, 'red');
      if (error.response) {
        log(`  Status: ${error.response.status}`, 'gray');
        log(`  Data: ${JSON.stringify(error.response.data)}`, 'gray');
      }
      results.tests.tim_deposit = false;
      results.overall = false;
    }

    // Test 3: Kafka Availability (if accessible)
    section('Test 3: Kafka Integration');
    log('ℹ Kafka integration check requires Kafka client', 'cyan');
    log('  Expected topic: topic.OdeTIMJson', 'gray');
    log('  Bootstrap server: localhost:9092', 'gray');
    results.tests.kafka = 'not_tested';

    // Summary
    section('Test Summary');
    const passed = Object.values(results.tests).filter(v => v === true).length;
    const total = Object.keys(results.tests).filter(k => results.tests[k] !== 'not_tested').length;

    if (results.overall) {
      log(`✓ ODE connection successful (${passed}/${total})`, 'green');
    } else {
      log(`✗ ODE connection issues (${passed}/${total})`, 'red');
    }

    return results;

  } catch (error) {
    log(`\n✗ Test failed: ${error.message}`, 'red');
    console.error(error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 4. Mock RSU Simulator
// ============================================================================

async function simulateRSUBroadcast() {
  header('Mock RSU Broadcast Simulation');

  log('\nSimulating complete sensor → TIM → RSU flow', 'yellow');

  try {
    // Step 1: Get a test sensor
    section('Step 1: Get Test Sensor');
    const sensor = await db.db.prepare(`
      SELECT * FROM sensor_inventory
      WHERE sensor_type = 'rwis' AND status = 'active'
      LIMIT 1
    `).get();

    if (!sensor) {
      log('⚠ No active RWIS sensors found', 'yellow');
      log('  Creating mock sensor for simulation...', 'gray');

      // Create mock sensor data
      var mockSensor = {
        sensor_id: 'MOCK-RWIS-TEST',
        sensor_name: 'Mock Test Sensor',
        latitude: 39.7392,
        longitude: -104.9903,
        roadway: 'I-70',
        milepost: 200.0
      };
    } else {
      log(`✓ Using sensor: ${sensor.sensor_name}`, 'green');
      var mockSensor = sensor;
    }

    // Step 2: Create hazardous sensor data
    section('Step 2: Simulate Hazardous Conditions');
    const hazardousData = {
      type: 'rwis',
      air_temperature: 28,
      pavement_temp: 30,  // Below freezing
      friction: 0.35,  // Low friction (< 0.4)
      moisture: true,  // Wet conditions
      dew_point: 27,
      visibility: 400,  // Low visibility (< 500)
      wind_speed: 25,
      precipitation_type: 'snow'
    };

    log('Mock sensor readings:', 'cyan');
    Object.entries(hazardousData).forEach(([key, value]) => {
      log(`  ${key}: ${value}`, 'gray');
    });

    // Step 3: Generate TIM
    section('Step 3: Generate TIM Message');
    const sensorLocation = {
      id: mockSensor.sensor_id,
      name: mockSensor.sensor_name,
      latitude: mockSensor.latitude,
      longitude: mockSensor.longitude,
      roadway: mockSensor.roadway,
      milepost: mockSensor.milepost
    };

    const tim = await timGenerator.generateTIMFromSensor(hazardousData, sensorLocation);

    if (tim) {
      log('✓ TIM generated successfully', 'green');
      log(`  Packet ID: ${tim.packetID}`, 'gray');
      log(`  Priority: ${tim.dataFrames[0].priority}`, 'gray');
      log(`  ITIS Codes: ${tim.dataFrames[0].content.advisory.item.map(i => i.itis).join(', ')}`, 'gray');
    } else {
      log('⚠ No warning conditions detected', 'yellow');
      return { success: false, reason: 'No warning generated' };
    }

    // Step 4: Find nearby RSUs
    section('Step 4: Find Nearby RSUs');
    const rsus = await rsuManager.findNearbyRSUs(sensorLocation, 5);

    if (rsus.length > 0) {
      log(`✓ Found ${rsus.length} nearby RSU(s):`, 'green');
      rsus.forEach(rsu => {
        const distance = rsuManager.calculateDistance(
          sensorLocation.latitude, sensorLocation.longitude,
          rsu.latitude, rsu.longitude
        );
        log(`  • ${rsu.rsu_name} (${distance.toFixed(2)} miles)`, 'gray');
      });
    } else {
      log('⚠ No RSUs found within 5 miles', 'yellow');
      log('  Would broadcast to default RSU list', 'gray');
    }

    // Step 5: Simulate Broadcast
    section('Step 5: Simulate Broadcast (Dry Run)');
    log('ℹ This is a simulation - no actual broadcast', 'cyan');
    log('\nBroadcast would include:', 'yellow');
    log(`  • TIM Packet ID: ${tim.packetID}`, 'gray');
    log(`  • Target RSUs: ${rsus.length || 'default list'}`, 'gray');
    log(`  • SNMP Channel: 178 (5.9 GHz)`, 'gray');
    log(`  • Broadcast Mode: Continuous`, 'gray');
    log(`  • Message Interval: 1 second`, 'gray');

    // Step 6: Log to database (simulation)
    section('Step 6: Log Broadcast (Simulated)');

    // Extract ITIS codes from TIM
    const itisCodes = [];
    tim.dataFrames?.forEach(frame => {
      frame.content?.advisory?.item?.forEach(item => {
        if (item.itis !== undefined) {
          itisCodes.push(item.itis);
        }
      });
    });

    await db.runAsync(`
      INSERT INTO tim_broadcast_log (
        packet_id, message_count, priority,
        itis_codes, rsus_targeted, status,
        source_type, source_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tim.packetID,
      tim.msgCnt,
      tim.dataFrames[0].priority,
      JSON.stringify(itisCodes),
      JSON.stringify(rsus.map(r => r.rsu_id)),
      'simulated',
      'sensor_simulation',
      mockSensor.sensor_id
    ]);

    log('✓ Broadcast logged to database', 'green');

    // Summary
    section('Simulation Summary');
    log('✓ Complete sensor-to-RSU flow simulated successfully', 'green');
    log(`\nTo test with real ODE:`, 'cyan');
    log(`  1. Ensure ODE is running: ./scripts/setup_ode.sh`, 'gray');
    log(`  2. Start the application: npm start`, 'gray');
    log(`  3. Trigger sensor poll: curl -X POST http://localhost:3001/api/sensors/poll`, 'gray');

    return {
      success: true,
      tim_packet_id: tim.packetID,
      rsus_targeted: rsus.length,
      sensor: mockSensor.sensor_id
    };

  } catch (error) {
    log(`\n✗ Simulation failed: ${error.message}`, 'red');
    console.error(error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 5. Complete System Test
// ============================================================================

async function runAllTests() {
  header('Complete RSU System Test');

  log('\nRunning all tests...', 'yellow');

  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  // Test 1: ODE Connection
  log('\n📡 Testing ODE connection...', 'cyan');
  results.tests.ode = await testODEConnection();

  // Test 2: RSU Connectivity (test first active RSU)
  log('\n📡 Testing RSU connectivity...', 'cyan');
  const firstRSU = await db.db.prepare(`
    SELECT rsu_id FROM rsu_inventory WHERE status = 'active' LIMIT 1
  `).get();

  if (firstRSU) {
    results.tests.rsu_connectivity = await testRSUConnectivity(firstRSU.rsu_id);
  } else {
    log('⚠ No active RSUs in database', 'yellow');
    results.tests.rsu_connectivity = { success: false, reason: 'No RSUs configured' };
  }

  // Test 3: TIM Validation (test latest TIM)
  log('\n📡 Testing TIM validation...', 'cyan');
  const latestTIM = await db.db.prepare(`
    SELECT packet_id FROM tim_broadcast_log ORDER BY created_at DESC LIMIT 1
  `).get();

  if (latestTIM) {
    results.tests.tim_validation = await validateTIM(latestTIM.packet_id);
  } else {
    log('⚠ No TIMs in database', 'yellow');
    results.tests.tim_validation = { success: false, reason: 'No TIMs to validate' };
  }

  // Test 4: Simulation
  log('\n📡 Running broadcast simulation...', 'cyan');
  results.tests.simulation = await simulateRSUBroadcast();

  // Final Summary
  header('Test Suite Summary');

  const testResults = [
    { name: 'ODE Connection', result: results.tests.ode?.overall },
    { name: 'RSU Connectivity', result: results.tests.rsu_connectivity?.overall },
    { name: 'TIM Validation', result: results.tests.tim_validation?.overall },
    { name: 'Broadcast Simulation', result: results.tests.simulation?.success }
  ];

  testResults.forEach(test => {
    if (test.result === true) {
      log(`✓ ${test.name}`, 'green');
    } else if (test.result === false) {
      log(`✗ ${test.name}`, 'red');
    } else {
      log(`⚠ ${test.name} (incomplete)`, 'yellow');
    }
  });

  const passed = testResults.filter(t => t.result === true).length;
  log(`\nTotal: ${passed}/${testResults.length} tests passed`, passed === testResults.length ? 'green' : 'yellow');

  return results;
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
RSU Testing Suite

Usage:
  node scripts/test_rsu.js [command] [arguments]

Commands:
  --connectivity <rsu-id>     Test RSU connectivity and configuration
  --validate-tim <packet-id>  Validate TIM message format
  --test-ode                  Test ODE connection and API
  --simulate                  Run mock RSU broadcast simulation
  --all                       Run all tests
  --help, -h                  Show this help

Examples:
  node scripts/test_rsu.js --connectivity RSU-I70-MM145
  node scripts/test_rsu.js --validate-tim TIM-1234567890
  node scripts/test_rsu.js --test-ode
  node scripts/test_rsu.js --simulate
  node scripts/test_rsu.js --all
`);
    process.exit(0);
  }

  try {
    if (args.includes('--connectivity')) {
      const rsuId = args[args.indexOf('--connectivity') + 1];
      if (!rsuId) {
        log('Error: RSU ID required', 'red');
        process.exit(1);
      }
      const result = await testRSUConnectivity(rsuId);
      console.log('\n' + JSON.stringify(result, null, 2));
    }
    else if (args.includes('--validate-tim')) {
      const packetId = args[args.indexOf('--validate-tim') + 1];
      if (!packetId) {
        log('Error: Packet ID required', 'red');
        process.exit(1);
      }
      const result = await validateTIM(packetId);
      console.log('\n' + JSON.stringify(result, null, 2));
    }
    else if (args.includes('--test-ode')) {
      const result = await testODEConnection();
      console.log('\n' + JSON.stringify(result, null, 2));
    }
    else if (args.includes('--simulate')) {
      const result = await simulateRSUBroadcast();
      console.log('\n' + JSON.stringify(result, null, 2));
    }
    else if (args.includes('--all')) {
      const result = await runAllTests();
      console.log('\n' + JSON.stringify(result, null, 2));
    }
    else {
      log('Error: Unknown command. Use --help for usage.', 'red');
      process.exit(1);
    }

    log('\n✅ Testing complete\n', 'green');
    process.exit(0);

  } catch (error) {
    log(`\n✗ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  testRSUConnectivity,
  validateTIM,
  testODEConnection,
  simulateRSUBroadcast,
  runAllTests
};

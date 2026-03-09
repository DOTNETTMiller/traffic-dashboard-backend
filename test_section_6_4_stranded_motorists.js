#!/usr/bin/env node
/**
 * Test IPAWS Section 6.4 - Stranded Motorists Criteria
 *
 * Demonstrates the new Iowa DOT IPAWS SOP Section 6.4 implementation
 * for alerting stranded motorists behind road closures.
 */

const ipaws = require('./services/ipaws-alert-service');

console.log('🧪 Testing IPAWS Section 6.4 - Stranded Motorists Criteria\n');
console.log('=' .repeat(80));

// Test scenarios from Iowa DOT IPAWS SOP Section 6.4
const testScenarios = [
  {
    name: 'Normal Conditions - Below Threshold',
    event: {
      eventType: 'crash',
      description: 'Multi-vehicle crash, full closure, no diversion available',
      routeName: 'I-80'
    },
    options: {
      delayMinutes: 45, // Below 60 minute threshold
      weatherCondition: null,
      diversionAvailable: false
    },
    expected: 'Does not qualify (below 60 min threshold)'
  },
  {
    name: 'Normal Conditions - Meets Threshold',
    event: {
      eventType: 'crash',
      description: 'Multi-vehicle crash, full closure, no diversion available',
      routeName: 'I-80'
    },
    options: {
      delayMinutes: 65, // Above 60 minute threshold
      weatherCondition: null,
      diversionAvailable: false
    },
    expected: 'Qualifies for IPAWS (≥60 min)'
  },
  {
    name: 'Blizzard - Meets Early Threshold',
    event: {
      eventType: 'weather event',
      description: 'Blizzard conditions, whiteout, full closure',
      routeName: 'I-35'
    },
    options: {
      delayMinutes: 35, // Above 30 minute threshold for blizzard
      weatherCondition: 'blizzard',
      diversionAvailable: false
    },
    expected: 'Qualifies for IPAWS (blizzard ≥30 min)'
  },
  {
    name: 'Extreme Cold - Wind Chill Below 0°F',
    event: {
      eventType: 'closure',
      description: 'Road closed due to drifting snow, extreme cold',
      routeName: 'I-80'
    },
    options: {
      delayMinutes: 40,
      weatherCondition: 'extreme cold',
      temperature: -5,
      windChill: -15, // Below 0°F threshold
      diversionAvailable: false
    },
    expected: 'Qualifies for IPAWS (extreme cold, wind chill -15°F)'
  },
  {
    name: 'Extreme Heat - 95°F+',
    event: {
      eventType: 'closure',
      description: 'Road closed due to buckled pavement',
      routeName: 'I-29'
    },
    options: {
      delayMinutes: 70,
      weatherCondition: 'extreme heat',
      temperature: 98, // Above 95°F threshold
      diversionAvailable: false
    },
    expected: 'Qualifies for IPAWS (extreme heat, 98°F)'
  },
  {
    name: 'Flooding - Immediate Activation',
    event: {
      eventType: 'flooding',
      description: 'Rising water near stopped vehicles',
      routeName: 'I-29'
    },
    options: {
      delayMinutes: 5, // Immediate activation
      weatherCondition: 'flooding',
      diversionAvailable: false
    },
    expected: 'Qualifies immediately (flooding)'
  },
  {
    name: 'Hazmat with Smoke Plume - Immediate Activation',
    event: {
      eventType: 'hazmat',
      description: 'Hazmat spill, smoke plume, shelter-in-place',
      routeName: 'I-80'
    },
    options: {
      delayMinutes: 10,
      weatherCondition: null,
      diversionAvailable: false
    },
    expected: 'Qualifies immediately (hazmat/smoke plume)'
  },
  {
    name: 'Diversion Available - No Alert Needed',
    event: {
      eventType: 'crash',
      description: 'Multi-vehicle crash, exit ramp available',
      routeName: 'I-80'
    },
    options: {
      delayMinutes: 90,
      weatherCondition: null,
      diversionAvailable: true // Diversion available
    },
    expected: 'Does not qualify (diversion available, use DMS/511)'
  }
];

// Run test scenarios
for (let i = 0; i < testScenarios.length; i++) {
  const scenario = testScenarios[i];

  console.log(`\n${i + 1}️⃣  ${scenario.name}`);
  console.log('─'.repeat(80));

  console.log(`Event: ${scenario.event.routeName} - ${scenario.event.description}`);
  console.log(`Delay: ${scenario.options.delayMinutes} minutes`);
  console.log(`Weather: ${scenario.options.weatherCondition || 'Normal conditions'}`);
  if (scenario.options.temperature) {
    console.log(`Temperature: ${scenario.options.temperature}°F`);
  }
  if (scenario.options.windChill) {
    console.log(`Wind Chill: ${scenario.options.windChill}°F`);
  }
  console.log(`Diversion Available: ${scenario.options.diversionAvailable ? 'Yes' : 'No'}`);

  // Evaluate against Section 6.4 criteria
  const result = ipaws.evaluateStrandedMotoristsAlert(scenario.event, scenario.options);

  console.log(`\n📋 Result:`);
  console.log(`   Qualifies for IPAWS: ${result.qualifies ? '✅ YES' : '❌ NO'}`);
  console.log(`   Reason: ${result.reason}`);
  console.log(`   Section: ${result.section}`);

  if (result.qualifies) {
    console.log(`\n⏰ Timing:`);
    console.log(`   Activate Within: ${result.activateWithinMinutes} minutes`);
    console.log(`   Renew Interval: ${result.renewIntervalMinutes} minutes`);
    console.log(`   Max Duration: ${result.maxDurationHours} hours`);

    console.log(`\n📢 Message Guidance:`);
    console.log(`   "${result.survivalGuidance}"`);
  }

  const passed = (result.qualifies && scenario.expected.includes('Qualifies')) ||
                 (!result.qualifies && scenario.expected.includes('not qualify'));

  console.log(`\n✓ Test ${passed ? 'PASSED' : 'FAILED'}: Expected "${scenario.expected}"`);
}

console.log('\n' + '='.repeat(80));
console.log('✅ SECTION 6.4 TESTING COMPLETE\n');

console.log('📚 Iowa DOT IPAWS SOP Section 6.4 - Key Criteria:\n');
console.log('  • Normal conditions: Activate after 60 minutes stopped');
console.log('  • Extreme weather: Activate after 30 minutes stopped');
console.log('  • Flooding/Hazmat: Immediate activation');
console.log('  • Extreme cold: <0°F wind chill, activate within 30–45 min');
console.log('  • Extreme heat: ≥95°F, activate after 60 minutes');
console.log('  • Default duration: 30–60 minutes (max 4 hours)');
console.log('  • Always include survival guidance and mile marker range');
console.log('  • Cancel promptly when traffic begins moving\n');

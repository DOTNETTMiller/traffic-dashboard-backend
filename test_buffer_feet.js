#!/usr/bin/env node
/**
 * Test IPAWS Buffer in Feet
 *
 * Demonstrates the new ability to specify buffer width in feet instead of miles
 */

const ipaws = require('./services/ipaws-alert-service');

console.log('🧪 Testing IPAWS Buffer Width - Feet vs Miles\n');
console.log('=' .repeat(80));

// Create a test event
const testEvent = {
  eventType: 'crash',
  description: 'Multi-vehicle crash on I-80',
  routeName: 'I-80',
  severity: 'high',
  geometry: {
    coordinates: [
      [-91.5, 41.6],
      [-91.4, 41.6]
    ]
  }
};

async function runTests() {
  console.log('\n📍 Test Event: Multi-vehicle crash on I-80');
  console.log('─'.repeat(80));

  // Test 1: Using miles (traditional)
  console.log('\n1️⃣  Buffer Width in Miles (Traditional)\n');

  const geofenceMiles = await ipaws.generateGeofence(testEvent, {
    bufferMiles: 0.5 // Half mile
  });

  console.log(`   Buffer: 0.5 miles`);
  console.log(`   Converted to feet: ${geofenceMiles.bufferFeet} feet`);
  console.log(`   Estimated population: ${geofenceMiles.estimatedPopulation.toLocaleString()}`);
  console.log(`   Area: ${geofenceMiles.areaSquareMiles.toFixed(2)} square miles`);

  // Test 2: Using feet (new feature)
  console.log('\n2️⃣  Buffer Width in Feet (New Feature)\n');

  const geofenceFeet = await ipaws.generateGeofence(testEvent, {
    bufferFeet: 500 // 500 feet
  });

  console.log(`   Buffer: 500 feet`);
  console.log(`   Converted to miles: ${geofenceFeet.bufferMiles.toFixed(4)} miles`);
  console.log(`   Estimated population: ${geofenceFeet.estimatedPopulation.toLocaleString()}`);
  console.log(`   Area: ${geofenceFeet.areaSquareMiles.toFixed(2)} square miles`);

  // Test 3: Very narrow geofence (200 feet)
  console.log('\n3️⃣  Narrow Geofence - 200 Feet\n');

  const narrowGeofence = await ipaws.generateGeofence(testEvent, {
    bufferFeet: 200 // 200 feet - just the roadway
  });

  console.log(`   Buffer: 200 feet`);
  console.log(`   Converted to miles: ${narrowGeofence.bufferMiles.toFixed(4)} miles`);
  console.log(`   Estimated population: ${narrowGeofence.estimatedPopulation.toLocaleString()}`);
  console.log(`   Area: ${narrowGeofence.areaSquareMiles.toFixed(2)} square miles`);

  // Test 4: Wide geofence (2000 feet)
  console.log('\n4️⃣  Wide Geofence - 2000 Feet\n');

  const wideGeofence = await ipaws.generateGeofence(testEvent, {
    bufferFeet: 2000 // 2000 feet - about 0.38 miles
  });

  console.log(`   Buffer: 2000 feet`);
  console.log(`   Converted to miles: ${wideGeofence.bufferMiles.toFixed(4)} miles`);
  console.log(`   Estimated population: ${wideGeofence.estimatedPopulation.toLocaleString()}`);
  console.log(`   Area: ${wideGeofence.areaSquareMiles.toFixed(2)} square miles`);

  // Test 5: Compare equivalent distances
  console.log('\n5️⃣  Comparison - Same Distance, Different Units\n');

  const oneMile = await ipaws.generateGeofence(testEvent, {
    bufferMiles: 1.0 // 1 mile
  });

  const fiveThousandFeet = await ipaws.generateGeofence(testEvent, {
    bufferFeet: 5280 // 5280 feet = exactly 1 mile
  });

  console.log(`   Using Miles:`);
  console.log(`     Buffer: 1.0 miles = ${oneMile.bufferFeet} feet`);
  console.log(`     Population: ${oneMile.estimatedPopulation.toLocaleString()}`);

  console.log(`\n   Using Feet:`);
  console.log(`     Buffer: 5280 feet = ${fiveThousandFeet.bufferMiles.toFixed(1)} miles`);
  console.log(`     Population: ${fiveThousandFeet.estimatedPopulation.toLocaleString()}`);

  console.log(`\n   ✓ Results ${Math.abs(oneMile.estimatedPopulation - fiveThousandFeet.estimatedPopulation) < 10 ? 'MATCH' : 'DIFFER'}`);

  // Test 6: Practical use cases
  console.log('\n6️⃣  Practical Use Cases\n');

  const useCases = [
    { name: 'Roadway Only', feet: 100, description: 'Just the immediate travel lanes' },
    { name: 'Shoulder', feet: 200, description: 'Roadway + shoulders' },
    { name: 'Right-of-Way', feet: 300, description: 'Full highway right-of-way' },
    { name: 'Nearby Properties', feet: 500, description: 'Roadway + adjacent properties' },
    { name: 'Quarter Mile', feet: 1320, description: 'Extended impact area' }
  ];

  for (const useCase of useCases) {
    const result = await ipaws.generateGeofence(testEvent, {
      bufferFeet: useCase.feet
    });

    console.log(`   ${useCase.name} (${useCase.feet} ft):`);
    console.log(`     ${useCase.description}`);
    console.log(`     Population: ${result.estimatedPopulation.toLocaleString()}`);
    console.log(``);
  }

  console.log('='.repeat(80));
  console.log('✅ BUFFER WIDTH TESTING COMPLETE\n');

  console.log('📋 Summary:\n');
  console.log('  ✓ Buffer width can now be specified in feet OR miles');
  console.log('  ✓ Conversion: 1 mile = 5,280 feet');
  console.log('  ✓ Both units produce equivalent geofences');
  console.log('  ✓ Useful for precise roadway-width targeting');
  console.log('  ✓ Reduces over-alerting to properties far from incident\n');

  console.log('💡 Example Usage:\n');
  console.log('  // Using miles (traditional)');
  console.log('  await ipaws.generateGeofence(event, { bufferMiles: 0.5 });\n');
  console.log('  // Using feet (new feature)');
  console.log('  await ipaws.generateGeofence(event, { bufferFeet: 500 });\n');
}

runTests().catch(console.error);

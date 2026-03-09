/**
 * Test Asymmetric Geofence Generation for Advance Warning
 *
 * This script tests the new advance warning mode that extends the geofence
 * further ahead of the event (in direction of travel) and less behind.
 */

const ipawsService = require('./services/ipaws-alert-service');

async function testAsymmetricGeofence() {
  console.log('🧪 Testing Asymmetric Geofence for Advance Warning\n');
  console.log('='.repeat(60));

  // Create a mock event with a polyline corridor (I-80 eastbound)
  const mockEvent = {
    id: 'test-001',
    corridor: 'I-80',
    location: 'Des Moines',
    county: 'Polk County',
    eventType: 'incident',
    severity: 'high',
    lanesAffected: 3,
    description: 'Multi-vehicle crash blocking eastbound lanes',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-93.65, 41.60],  // West
        [-93.64, 41.60],
        [-93.63, 41.60],
        [-93.62, 41.60],
        [-93.61, 41.60],
        [-93.60, 41.60],  // East
      ]
    }
  };

  console.log('\n📍 Test Event:');
  console.log(`   Route: ${mockEvent.corridor}`);
  console.log(`   Type: ${mockEvent.eventType}`);
  console.log(`   Description: ${mockEvent.description}`);
  console.log(`   Corridor: ${mockEvent.geometry.coordinates.length} points`);

  // Test 1: Default (no corridor trimming)
  console.log('\n\n1️⃣  DEFAULT GEOFENCE (Full corridor)');
  console.log('-'.repeat(60));
  try {
    const defaultGeofence = await ipawsService.generateGeofence(mockEvent, {});
    console.log(`   ✅ Area: ${defaultGeofence.areaSquareMiles.toFixed(2)} sq mi`);
    console.log(`   ✅ Buffer: ${defaultGeofence.bufferMiles.toFixed(2)} miles`);
    console.log(`   ✅ Population: ${defaultGeofence.estimatedPopulation.toLocaleString()}`);
    console.log(`   ✅ Asymmetric: ${defaultGeofence.isAsymmetric ? 'Yes' : 'No'}`);
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }

  // Test 2: Symmetric corridor (legacy mode)
  console.log('\n\n2️⃣  SYMMETRIC CORRIDOR (2 miles total, 1 mi each side)');
  console.log('-'.repeat(60));
  try {
    const symmetricGeofence = await ipawsService.generateGeofence(mockEvent, {
      corridorLengthMiles: 2.0
    });
    console.log(`   ✅ Area: ${symmetricGeofence.areaSquareMiles.toFixed(2)} sq mi`);
    console.log(`   ✅ Buffer: ${symmetricGeofence.bufferMiles.toFixed(2)} miles`);
    console.log(`   ✅ Population: ${symmetricGeofence.estimatedPopulation.toLocaleString()}`);
    console.log(`   ✅ Asymmetric: ${symmetricGeofence.isAsymmetric ? 'Yes' : 'No'}`);
    console.log(`   ✅ Corridor Length: ${symmetricGeofence.corridorLengthMiles} miles`);
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }

  // Test 3: Asymmetric corridor (advance warning mode)
  console.log('\n\n3️⃣  ASYMMETRIC CORRIDOR - Advance Warning Mode');
  console.log('   (5 miles ahead, 0.5 miles behind)');
  console.log('-'.repeat(60));
  try {
    const asymmetricGeofence = await ipawsService.generateGeofence(mockEvent, {
      corridorAheadMiles: 5.0,
      corridorBehindMiles: 0.5
    });
    console.log(`   ✅ Area: ${asymmetricGeofence.areaSquareMiles.toFixed(2)} sq mi`);
    console.log(`   ✅ Buffer: ${asymmetricGeofence.bufferMiles.toFixed(2)} miles`);
    console.log(`   ✅ Population: ${asymmetricGeofence.estimatedPopulation.toLocaleString()}`);
    console.log(`   ✅ Asymmetric: ${asymmetricGeofence.isAsymmetric ? 'Yes ✓' : 'No'}`);
    console.log(`   ✅ Ahead: ${asymmetricGeofence.corridorAheadMiles} miles`);
    console.log(`   ✅ Behind: ${asymmetricGeofence.corridorBehindMiles} miles`);
    console.log(`   💡 Total corridor: ${asymmetricGeofence.corridorAheadMiles + asymmetricGeofence.corridorBehindMiles} miles`);
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }

  // Test 4: Extreme advance warning (10 miles ahead, 0 miles behind)
  console.log('\n\n4️⃣  EXTREME ADVANCE WARNING');
  console.log('   (10 miles ahead, 0 miles behind)');
  console.log('-'.repeat(60));
  try {
    const extremeGeofence = await ipawsService.generateGeofence(mockEvent, {
      corridorAheadMiles: 10.0,
      corridorBehindMiles: 0
    });
    console.log(`   ✅ Area: ${extremeGeofence.areaSquareMiles.toFixed(2)} sq mi`);
    console.log(`   ✅ Buffer: ${extremeGeofence.bufferMiles.toFixed(2)} miles`);
    console.log(`   ✅ Population: ${extremeGeofence.estimatedPopulation.toLocaleString()}`);
    console.log(`   ✅ Ahead: ${extremeGeofence.corridorAheadMiles} miles`);
    console.log(`   ✅ Behind: ${extremeGeofence.corridorBehindMiles} miles`);
    console.log(`   💡 This provides maximum advance warning for approaching drivers`);
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!\n');
  console.log('📝 Summary:');
  console.log('   - Symmetric mode: Equal distance ahead/behind event');
  console.log('   - Asymmetric mode: More distance ahead for advance warning');
  console.log('   - Use asymmetric for incident alerts on high-speed corridors');
  console.log('   - Larger "ahead" distance = more warning time for drivers\n');
}

// Run tests
testAsymmetricGeofence().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

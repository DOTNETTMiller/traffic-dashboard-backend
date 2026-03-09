/**
 * Test geometry validator with 2-point LineString distance filtering
 */

const { validateAndFixGeometry } = require('./services/geometry-validator');

console.log('🧪 Testing Geometry Validator - 2-Point Distance Filtering\n');
console.log('='.repeat(60));

// Test 1: Short 2-point LineString (0.3 miles) → Should convert to Point
const shortEvent = {
  id: 'test-1',
  description: 'Short 2-point event',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-93.6091, 41.5868], // Des Moines area
      [-93.6050, 41.5880]  // ~0.3 miles away
    ]
  }
};

// Test 2: Long 2-point LineString (2.5 miles) → Should keep as LineString
const longEvent = {
  id: 'test-2',
  description: 'Long 2-point event',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-93.6091, 41.5868], // Des Moines area
      [-93.5700, 41.5900]  // ~2.5 miles away
    ]
  }
};

// Test 3: 3-point LineString → Should always keep as LineString
const multiPointEvent = {
  id: 'test-3',
  description: '3-point event',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-93.6091, 41.5868],
      [-93.6050, 41.5880],
      [-93.6000, 41.5900]
    ]
  }
};

// Test 4: Exactly 0.5 miles → Should convert to Point (≤ threshold)
const boundaryEvent = {
  id: 'test-4',
  description: 'Boundary case (0.5 mi)',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-93.6091, 41.5868],
      [-93.6020, 41.5910]  // ~0.5 miles
    ]
  }
};

// Test 5: Just over 0.5 miles → Should keep as LineString
const justOverEvent = {
  id: 'test-5',
  description: 'Just over threshold (0.6 mi)',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-93.6091, 41.5868],
      [-93.6000, 41.5915]  // ~0.6 miles
    ]
  }
};

function testEvent(event, expected) {
  console.log(`\n📍 TEST: ${event.description}`);
  console.log(`   Input: ${event.geometry.type} with ${event.geometry.coordinates.length} points`);

  const result = validateAndFixGeometry(event);

  if (!result) {
    console.log('   ❌ Result: Invalid (filtered out)');
    return;
  }

  console.log(`   ✅ Result: ${result.geometry.type}`);

  if (result._geometryFixed) {
    console.log(`   🔧 Fixed: ${result._fixReason}`);
    console.log(`   📏 Original distance: ${result._originalDistance?.toFixed(3)} miles`);
  }

  // Verify expectation
  if (result.geometry.type === expected) {
    console.log(`   ✅ PASS - Expected ${expected}, got ${result.geometry.type}`);
  } else {
    console.log(`   ❌ FAIL - Expected ${expected}, got ${result.geometry.type}`);
  }
}

testEvent(shortEvent, 'Point');       // Should convert to Point
testEvent(longEvent, 'LineString');   // Should keep as LineString
testEvent(multiPointEvent, 'LineString'); // Always LineString
testEvent(boundaryEvent, 'Point');    // Should convert (≤0.5)
testEvent(justOverEvent, 'LineString'); // Should keep (>0.5)

console.log('\n' + '='.repeat(60));
console.log('✅ Geometry validator testing complete!\n');
console.log('Summary:');
console.log('  • 2-point LineStrings ≤0.5 miles → Converted to Point');
console.log('  • 2-point LineStrings >0.5 miles → Kept as LineString');
console.log('  • 3+ point LineStrings → Always kept as LineString\n');

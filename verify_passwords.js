// Quick script to verify state passwords
const db = require('./database');

const TEST_PASSWORD = 'ccai2026';
const WRONG_PASSWORD = 'wrong';

console.log('🔍 Verifying state passwords...\n');

// Test a few states
const testStates = ['ohio', 'nevada', 'utah', 'co', 'fhwa'];

testStates.forEach(stateKey => {
  const correctResult = db.verifyStatePassword(stateKey, TEST_PASSWORD);
  const wrongResult = db.verifyStatePassword(stateKey, WRONG_PASSWORD);

  if (correctResult && !wrongResult) {
    console.log(`✅ ${stateKey} - Password verification working correctly`);
  } else {
    console.log(`❌ ${stateKey} - Password verification FAILED`);
  }
});

console.log('\n✅ Password verification complete!');
console.log(`📝 All states should use password: ${TEST_PASSWORD}`);

db.close();

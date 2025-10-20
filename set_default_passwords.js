// Script to set default passwords for all states
const db = require('./database');

const DEFAULT_PASSWORD = 'ccai2026';

console.log('🔐 Setting default password for all states...\n');

// Get all states
const states = db.getAllStates(false);

if (states.length === 0) {
  console.log('❌ No states found in database');
  process.exit(1);
}

// Set password for each state
states.forEach(state => {
  const result = db.setStatePassword(state.stateKey, DEFAULT_PASSWORD);
  if (result.success) {
    console.log(`✅ ${state.stateName} (${state.stateKey}) - password set`);
  } else {
    console.log(`❌ ${state.stateName} (${state.stateKey}) - failed: ${result.error}`);
  }
});

console.log(`\n✅ Default password set for ${states.length} states`);
console.log(`📝 Password: ${DEFAULT_PASSWORD}`);
console.log('\nAll states can now log in with this password.');

db.close();

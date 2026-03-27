// Script to add FHWA account for messaging
const db = require('./database');

const FHWA_PASSWORD = process.env.FHWA_PASSWORD || (() => { throw new Error('FHWA_PASSWORD environment variable required'); })();

console.log('🏛️  Adding FHWA account...\n');

// Add FHWA as a "state" (for messaging purposes)
const result = db.addState({
  stateKey: 'fhwa',
  stateName: 'Federal Highway Administration',
  apiUrl: 'https://fhwa.dot.gov', // Dummy URL - FHWA doesn't provide events
  apiType: 'Administrative',
  format: 'json',
  credentials: {}
});

if (result.success) {
  console.log('✅ FHWA account created');

  // Set password
  const passwordResult = db.setStatePassword('fhwa', FHWA_PASSWORD);

  if (passwordResult.success) {
    console.log('✅ FHWA password set');
    console.log('\n📋 FHWA Login Credentials:');
    console.log('   State: Federal Highway Administration');
    console.log('   Password: ' + FHWA_PASSWORD);
    console.log('\nFHWA can now log in and communicate with all states.');
  } else {
    console.log('❌ Failed to set password:', passwordResult.error);
  }
} else {
  if (result.error.includes('UNIQUE')) {
    console.log('⚠️  FHWA account already exists - updating password...');
    const passwordResult = db.setStatePassword('fhwa', FHWA_PASSWORD);

    if (passwordResult.success) {
      console.log('✅ FHWA password updated');
      console.log('\n📋 FHWA Login Credentials:');
      console.log('   State: Federal Highway Administration');
      console.log('   Password: ' + FHWA_PASSWORD);
    } else {
      console.log('❌ Failed to update password:', passwordResult.error);
    }
  } else {
    console.log('❌ Failed to create account:', result.error);
  }
}

db.close();

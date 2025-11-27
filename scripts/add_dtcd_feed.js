// Add DTCD (Digital Traffic Control Diary) feed
// WZDx v4.2 work zone feed

const Database = require('../database.js');
const db = new Database.constructor();

console.log('🗺️  Adding DTCD (Digital Traffic Control Diary) feed...\n');

const dtcdState = {
  stateKey: 'dtcd',
  stateName: 'Digital Traffic Control Diary',
  apiUrl: 'https://us-central1-digital-traffic-control-f1cc2.cloudfunctions.net/getWZDxFeed',
  apiType: 'WZDx',
  format: 'json'
};

try {
  // Check if DTCD already exists
  const existing = db.getState(dtcdState.stateKey);

  if (existing) {
    console.log(`⏭️  ${dtcdState.stateName} (${dtcdState.stateKey}) - already exists`);
    console.log(`   Current URL: ${existing.apiUrl}`);
    console.log('\n✅ Done! DTCD feed is already configured.');
  } else {
    const result = db.addState({
      stateKey: dtcdState.stateKey,
      stateName: dtcdState.stateName,
      apiUrl: dtcdState.apiUrl,
      apiType: dtcdState.apiType,
      format: dtcdState.format
    });

    if (result.success) {
      console.log(`✅ ${dtcdState.stateName} (${dtcdState.stateKey})`);
      console.log(`   API URL: ${dtcdState.apiUrl}`);
      console.log(`   Format: WZDx v4.2`);
      console.log(`   Type: Work Zone Data Exchange`);
      console.log('\n💡 Features:');
      console.log('   • Supports incremental polling with ?since=TIMESTAMP');
      console.log('   • No authentication required');
      console.log('   • Update frequency: 60 seconds');
      console.log('   • Webhook support available for push notifications');
      console.log('\n✅ DTCD feed added successfully!');
      console.log('   Restart the backend server to load the new feed.');
    } else {
      console.log(`❌ ${dtcdState.stateName} (${dtcdState.stateKey}) - ${result.error}`);
    }
  }
} catch (error) {
  console.error(`❌ Error adding DTCD feed: ${error.message}`);
}

db.close();

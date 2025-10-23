const Database = require('../database.js');
const db = new Database.constructor();

console.log('🗺️  Adding Oregon, Georgia, and Alaska...\n');

const additionalStates = [
  {
    stateKey: 'or',
    stateName: 'Oregon DOT (TripCheck)',
    apiUrl: 'https://apiportal.odot.state.or.us/tripcheck-data-api/v1',
    apiType: 'Custom JSON',
    format: 'json',
    credentials: {
      // Requires API key from https://apiportal.odot.state.or.us/
      // Documentation: https://www.tripcheck.com/pdfs/TripCheckAPI_Getting_Started_GuideV5.pdf
      apiKey: ''
    }
  },
  {
    stateKey: 'ga',
    stateName: 'Georgia DOT (511GA)',
    apiUrl: 'https://511ga.org/api/v2',
    apiType: 'Custom JSON',
    format: 'json',
    credentials: {
      // Requires developer key from 511ga.org/developers
      // Throttling: 10 calls per 60 seconds
      apiKey: ''
    }
  },
  {
    stateKey: 'ak',
    stateName: 'Alaska DOT (511AK)',
    apiUrl: 'https://511.alaska.gov/api/v2',
    apiType: 'Custom JSON',
    format: 'json'
  }
];

let added = 0;
let skipped = 0;

for (const state of additionalStates) {
  const existing = db.getState(state.stateKey);
  if (existing) {
    console.log(`⏭️  ${state.stateName} (${state.stateKey}) - already exists`);
    skipped++;
  } else {
    const result = db.addState({
      stateKey: state.stateKey,
      stateName: state.stateName,
      apiUrl: state.apiUrl,
      apiType: state.apiType,
      format: state.format,
      credentials: state.credentials || {}
    });
    if (result.success) {
      console.log(`✅ ${state.stateName} (${state.stateKey})`);
      if (state.credentials && state.credentials.apiKey === '') {
        console.log(`   ⚠️  Requires API key - see comments in script`);
      }
      added++;
    } else {
      console.log(`❌ ${state.stateName} - ${result.error}`);
    }
  }
}

console.log(`\n📊 Summary:`);
console.log(`   ✅ Added: ${added}`);
console.log(`   ⏭️  Skipped: ${skipped}`);

db.close();
console.log('\n✅ Done!');

// Add missing states from WZDx Feed Registry
// Based on https://datahub.transportation.gov/Roadways-and-Bridges/Work-Zone-Data-Exchange-WZDx-Feed-Registry/69qe-yiui

const Database = require('../database.js');
const db = new Database.constructor();

console.log('🗺️  Adding missing states from WZDx Feed Registry...\n');

// States that are in the WZDx registry but not yet configured
const missingStates = [
  {
    stateKey: 'la',
    stateName: 'Louisiana DOT',
    apiUrl: 'https://wzdx.e-dot.com/la_dot_d_feed_wzdx_v4.1.geojson',
    apiType: 'WZDx',
    format: 'json'
  },
  {
    stateKey: 'nm',
    stateName: 'New Mexico DOT',
    apiUrl: 'https://ai.blyncsy.io/wzdx/nmdot/feed',
    apiType: 'WZDx',
    format: 'json'
  },
  {
    stateKey: 'de',
    stateName: 'Delaware DOT',
    apiUrl: 'https://wzdx.e-dot.com/del_dot_feed_wzdx_v4.1.geojson',
    apiType: 'WZDx',
    format: 'json'
  },
  {
    stateKey: 'hi',
    stateName: 'Hawaii DOT',
    apiUrl: 'https://ai.blyncsy.io/wzdx/hidot/feed',
    apiType: 'WZDx',
    format: 'json'
  },
  {
    stateKey: 'ky',
    stateName: 'Kentucky Transportation Cabinet',
    apiUrl: 'https://storage.googleapis.com/kytc-its-2020/wzdx/kytc_wzdx.geojson',
    apiType: 'WZDx',
    format: 'json'
  },
  {
    stateKey: 'id',
    stateName: 'Idaho DOT',
    apiUrl: 'https://511.idaho.gov/api/wzdx',
    apiType: 'WZDx',
    format: 'json'
  },
  {
    stateKey: 'nps',
    stateName: 'National Park Service',
    apiUrl: 'https://developer.nps.gov/api/v1/roadevents',
    apiType: 'WZDx',
    format: 'json',
    credentials: {
      // Note: NPS API requires an API key
      // Get one at https://www.nps.gov/subjects/developer/get-started.htm
      apiKey: ''
    }
  },
  {
    stateKey: 'mi',
    stateName: 'Michigan DOT',
    apiUrl: '', // Marked as inactive in registry
    apiType: 'WZDx',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'scc-mo',
    stateName: 'St. Charles County, MO',
    apiUrl: 'https://scc.ridsi-dash.com:5000/wzdx.geojson',
    apiType: 'WZDx',
    format: 'json'
  }
];

// Updated URLs for existing states (some have newer endpoints)
const stateUpdates = [
  {
    stateKey: 'co',
    updates: {
      apiUrl: 'https://data.cotrip.org/api/v1/cwz',
      // Note: Requires API key - add ?apiKey=YOUR_KEY
    }
  },
  {
    stateKey: 'oh',
    updates: {
      apiUrl: 'https://publicapi.ohgo.com/api/work-zones/wzdx/4.2',
      // Note: Requires API key - add ?api-key=YOUR_KEY
    }
  },
  {
    stateKey: 'ca',
    updates: {
      apiUrl: 'https://api.511.org/traffic/wzdx',
      // Note: Requires API key - add ?api_key=YOUR_KEY
    }
  },
  {
    stateKey: 'tx',
    updates: {
      apiUrl: 'https://its.txdot.gov/ITS_WEB/FrontEnd/default.html',
      // Note: Texas has multiple feeds, main one above
      // Austin: https://data.austintexas.gov/download/d9mm-cjw9/application%2Fjson
    }
  }
];

let added = 0;
let updated = 0;
let skipped = 0;
let failed = 0;

// Add missing states
console.log('➕ Adding new states:\n');
for (const state of missingStates) {
  try {
    // Check if state already exists
    const existing = db.getState(state.stateKey);

    if (existing) {
      console.log(`⏭️  ${state.stateName} (${state.stateKey}) - already exists`);
      skipped++;
      continue;
    }

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
        console.log(`   ⚠️  Requires API key - feed disabled until configured`);
      }
      if (state.enabled === false) {
        console.log(`   ⚠️  Marked as inactive in WZDx registry`);
      }
      added++;
    } else {
      console.log(`❌ ${state.stateName} (${state.stateKey}) - ${result.error}`);
      failed++;
    }
  } catch (error) {
    console.error(`❌ ${state.stateName} - ${error.message}`);
    failed++;
  }
}

// Update existing states with new URLs (optional)
console.log('\n🔄 States with updated feed URLs available:\n');
for (const update of stateUpdates) {
  const existing = db.getState(update.stateKey);
  if (existing) {
    console.log(`ℹ️  ${existing.stateName} (${update.stateKey})`);
    console.log(`   Current: ${existing.apiUrl}`);
    console.log(`   Available: ${update.updates.apiUrl}`);

    // Uncomment to actually update:
    // const result = db.updateState(update.stateKey, update.updates);
    // if (result.success) updated++;
  }
}

console.log('\n📊 Summary:');
console.log(`   ✅ Added: ${added}`);
console.log(`   ⏭️  Skipped (already exist): ${skipped}`);
console.log(`   ℹ️  Updates available: ${stateUpdates.length} (not applied)`);
console.log(`   ❌ Failed: ${failed}`);

console.log('\n💡 Notes:');
console.log('   • Some feeds require API keys (Colorado, Ohio, California, NPS)');
console.log('   • Michigan DOT feed is inactive according to WZDx registry');
console.log('   • Kentucky uses Google Cloud Storage for their feed');
console.log('   • To update existing states with new URLs, uncomment the update code');
console.log('\n   Get API keys from:');
console.log('   • Colorado: https://www.cotrip.org/');
console.log('   • Ohio: https://publicapi.ohgo.com/');
console.log('   • California 511: https://511.org/open-data/token');
console.log('   • National Park Service: https://www.nps.gov/subjects/developer/get-started.htm');

db.close();
console.log('\n✅ Done!');

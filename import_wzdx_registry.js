// Import WZDx Feed Registry into Database
const axios = require('axios');
const db = require('./database.js');

const REGISTRY_URL = 'https://datahub.transportation.gov/resource/69qe-yiui.json?$limit=100';

// State name to abbreviation mappings
const STATE_TO_KEY = {
  'north carolina': 'nc',
  'oklahoma': 'ok',
  'colorado': 'co',
  'utah': 'ut',
  'iowa': 'ia',
  'florida': 'fl',
  'minnesota': 'mn',
  'maryland': 'md',
  'wisconsin': 'wi',
  'missouri': 'mo',
  'virginia': 'va',
  'pennsylvania': 'pa',
  'new york': 'ny',
  'texas': 'tx',
  'indiana': 'in',
  'kansas': 'ks',
  'nebraska': 'ne',
  'ohio': 'oh',
  'michigan': 'mi',
  'illinois': 'il',
  'california': 'ca',
  'arizona': 'az',
  'washington': 'wa',
  'oregon': 'or',
  'nevada': 'nv',
  'new jersey': 'nj',
  'massachusetts': 'ma',
  'connecticut': 'ct',
  'new mexico': 'nm',
  'hawaii': 'hi',
  'kentucky': 'ky',
  'delaware': 'de',
  'louisiana': 'la',
  'idaho': 'id'
};

async function importWZDxRegistry() {
  try {
    console.log('📥 Fetching WZDx Feed Registry...');
    const response = await axios.get(REGISTRY_URL);
    const feeds = response.data;

    console.log(`Found ${feeds.length} feeds in registry`);

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const feed of feeds) {
      // Skip if inactive or no feed URL
      if (!feed.active || !feed.url || !feed.url.url) {
        skipped++;
        continue;
      }

      // Get state name and key
      const stateName = feed.state?.toLowerCase();
      const stateKey = STATE_TO_KEY[stateName];

      if (!stateKey) {
        console.log(`⏭️  Skipping ${feed.feedname} (${stateName}) - unknown state`);
        skipped++;
        continue;
      }

      const feedUrl = feed.url.url;
      const fullStateName = feed.issuingorganization || stateName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      // Check if state already exists
      const existing = db.getState(stateKey);

      if (existing) {
        // Update with WZDx URL
        const result = db.updateState(stateKey, {
          apiUrl: feedUrl,
          apiType: 'WZDx',
          format: feed.format || 'geojson'
        });

        if (result.success) {
          console.log(`✅ Updated ${fullStateName} (${stateKey}) with WZDx v${feed.version}`);
          updated++;
        }
      } else {
        // Add new state
        const result = db.addState({
          stateKey: stateKey,
          stateName: fullStateName,
          apiUrl: feedUrl,
          apiType: 'WZDx',
          format: feed.format || 'geojson'
        });

        if (result.success) {
          console.log(`✅ Added ${fullStateName} (${stateKey}) - WZDx v${feed.version}`);
          added++;
        } else {
          console.log(`❌ Failed to add ${fullStateName}: ${result.error}`);
          skipped++;
        }
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`   Added: ${added}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total processed: ${feeds.length}`);

  } catch (error) {
    console.error('Error importing WZDx registry:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  importWZDxRegistry()
    .then(() => {
      console.log('\n✅ Import complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}

module.exports = { importWZDxRegistry };

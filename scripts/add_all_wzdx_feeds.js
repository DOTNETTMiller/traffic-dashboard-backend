/**
 * Add all available WZDx feeds from USDOT registry to the database
 *
 * This script fetches the official WZDx Feed Registry and adds all active
 * feeds to the database, excluding feeds that require API keys (unless we have them).
 */

const { Pool } = require('pg');
const https = require('https');

const WZDX_REGISTRY_URL = 'https://datahub.transportation.gov/resource/69qe-yiui.json?$limit=100&active=true';

// State name to abbreviation mapping
const STATE_ABBREV = {
  'arizona': 'AZ', 'california': 'CA', 'colorado': 'CO', 'delaware': 'DE',
  'florida': 'FL', 'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL',
  'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS', 'kentucky': 'KY',
  'louisiana': 'LA', 'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI',
  'minnesota': 'MN', 'missouri': 'MO', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'ohio': 'OH', 'oklahoma': 'OK',
  'pennsylvania': 'PA', 'texas': 'TX', 'utah': 'UT', 'virginia': 'VA',
  'washington': 'WA', 'wisconsin': 'WI'
};

// States that are already configured (we'll skip these)
const EXISTING_STATES = ['nevada', 'ohio', 'new jersey', 'iowa', 'kansas', 'nebraska', 'indiana', 'minnesota', 'utah', 'texas', 'illinois'];

async function fetchWZDxRegistry() {
  return new Promise((resolve, reject) => {
    https.get(WZDX_REGISTRY_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('🌐 Fetching WZDx Feed Registry...\n');

  const feeds = await fetchWZDxRegistry();
  console.log(`📊 Found ${feeds.length} active feeds in registry\n`);

  // Filter to state DOT feeds only (exclude counties, cities, etc.)
  const stateFeeds = feeds.filter(feed => {
    const state = (feed.state || '').toLowerCase();
    const org = (feed.issuingorganization || '').toLowerCase();

    // Skip if no state or already configured
    if (!state || EXISTING_STATES.includes(state)) return false;

    // Only include state DOTs (not counties, cities, etc.)
    if (org.includes('county') || org.includes('city') || state === 'n/a' || state === 'nps') return false;

    // Skip feeds requiring API keys we don't have
    if (feed.needapikey && !['ohio', 'texas', 'colorado', 'california', 'illinois', 'pennsylvania', 'virginia'].includes(state)) {
      console.log(`⏭️  Skipping ${state.toUpperCase()} - requires API key`);
      return false;
    }

    return true;
  });

  console.log(`✅ ${stateFeeds.length} new state feeds to add:\n`);

  let addedCount = 0;
  let errorCount = 0;

  for (const feed of stateFeeds) {
    const stateName = feed.state.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const stateKey = STATE_ABBREV[feed.state.toLowerCase()] || feed.state.substring(0, 2).toUpperCase();
    const url = feed.url?.url;
    const org = feed.issuingorganization;

    if (!url) {
      console.log(`❌ ${stateName}: No URL found`);
      errorCount++;
      continue;
    }

    console.log(`📍 Adding ${stateName} (${stateKey})...`);
    console.log(`   Provider: ${org}`);
    console.log(`   URL: ${url}`);
    console.log(`   Format: ${feed.format}, Version: ${feed.version}`);

    try {
      // Check if state already exists
      const existing = await pool.query(
        'SELECT * FROM states WHERE state_key = $1',
        [stateKey]
      );

      if (existing.rows.length > 0) {
        console.log(`   ⚠️  State ${stateKey} already exists in database, skipping\n`);
        continue;
      }

      // Insert new state
      await pool.query(`
        INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        stateKey,
        `${stateName} DOT`,
        url,
        'WZDx',
        feed.format === 'geojson' ? 'geojson' : 'json',
        true // enabled
      ]);

      console.log(`   ✅ Successfully added ${stateName}\n`);
      addedCount++;

    } catch (error) {
      console.log(`   ❌ Error adding ${stateName}: ${error.message}\n`);
      errorCount++;
    }
  }

  await pool.end();

  console.log('\n📊 Summary:');
  console.log(`   Added: ${addedCount} states`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total feeds in registry: ${feeds.length}`);
  console.log('\n✨ Done! Restart the backend to load the new feeds.');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

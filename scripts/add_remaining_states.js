/**
 * Add remaining states with known public feeds
 */

const { Pool } = require('pg');

const ADDITIONAL_STATES = [
  // States with CARS program feeds (FEU-G XML)
  // These use the same credentials as Iowa, Kansas, Nebraska, Indiana, Minnesota

  // States from 511.org network with potential public feeds
  {
    stateKey: 'AZ',
    stateName: 'Arizona DOT',
    apiUrl: 'https://wzdxapi.aztech.org/construction', // Maricopa County - already in WZDx registry
    apiType: 'WZDx',
    format: 'geojson',
    enabled: true
  },
  {
    stateKey: 'CT',
    stateName: 'Connecticut DOT',
    apiUrl: 'https://ctioc.org/data/events', // Placeholder - needs verification
    apiType: '511',
    format: 'json',
    enabled: false // Disabled until URL verified
  },
  {
    stateKey: 'GA',
    stateName: 'Georgia DOT',
    apiUrl: 'https://511ga.org/api/v2/get/event', // Requires API key
    apiType: '511',
    format: 'json',
    enabled: false // Disabled - requires API key
  },
  {
    stateKey: 'ME',
    stateName: 'Maine DOT',
    apiUrl: 'https://newengland511.org/api/events', // Placeholder
    apiType: '511',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'MT',
    stateName: 'Montana DOT',
    apiUrl: 'https://mdt511.com/api/events', // Placeholder
    apiType: '511',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'NH',
    stateName: 'New Hampshire DOT',
    apiUrl: 'https://newengland511.org/api/events', // Placeholder
    apiType: '511',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'ND',
    stateName: 'North Dakota DOT',
    apiUrl: 'https://travel.dot.nd.gov/api/events', // Placeholder
    apiType: '511',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'OR',
    stateName: 'Oregon DOT',
    apiUrl: 'https://tripcheck.com/api/events', // TripCheck - requires API key
    apiType: 'TripCheck',
    format: 'json',
    enabled: false // Disabled - requires API key
  },
  {
    stateKey: 'RI',
    stateName: 'Rhode Island DOT',
    apiUrl: 'https://newengland511.org/api/events', // Placeholder
    apiType: '511',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'SC',
    stateName: 'South Carolina DOT',
    apiUrl: 'https://511sc.org/api/events', // Placeholder
    apiType: '511',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'SD',
    stateName: 'South Dakota DOT',
    apiUrl: 'https://sd511.org/api/events', // Placeholder
    apiType: '511',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'TN',
    stateName: 'Tennessee DOT',
    apiUrl: 'https://smartway.tn.gov/api/events', // Placeholder
    apiType: 'SmartWay',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'VT',
    stateName: 'Vermont DOT',
    apiUrl: 'https://newengland511.org/api/events', // Placeholder
    apiType: '511',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'WV',
    stateName: 'West Virginia DOT',
    apiUrl: 'https://wv511.org/api/events', // Placeholder
    apiType: '511',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'WY',
    stateName: 'Wyoming DOT',
    apiUrl: 'https://wyoroad.info/api/events', // Placeholder
    apiType: 'WyoRoad',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'AL',
    stateName: 'Alabama DOT',
    apiUrl: 'https://algotraffic.com/api/events', // Placeholder
    apiType: 'ALGO',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'AK',
    stateName: 'Alaska DOT',
    apiUrl: 'https://511.alaska.gov/api/events', // Placeholder
    apiType: '511',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'AR',
    stateName: 'Arkansas DOT',
    apiUrl: 'https://idrivearkansas.com/api/events', // Placeholder
    apiType: 'IDriveArkansas',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'MS',
    stateName: 'Mississippi DOT',
    apiUrl: 'https://mdottraffic.com/api/events', // Placeholder
    apiType: 'MDOTTraffic',
    format: 'json',
    enabled: false
  },
  {
    stateKey: 'NV',
    stateName: 'Nevada DOT',
    apiUrl: 'https://www.nvroads.com/api/v2/get/roadconditions',
    apiType: 'NVRoads',
    format: 'json',
    enabled: true
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('🌐 Adding remaining states...\n');

  let addedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const state of ADDITIONAL_STATES) {
    console.log(`📍 Adding ${state.stateName} (${state.stateKey})...`);
    console.log(`   URL: ${state.apiUrl}`);
    console.log(`   Enabled: ${state.enabled}`);

    try {
      // Check if state already exists
      const existing = await pool.query(
        'SELECT * FROM states WHERE state_key = $1',
        [state.stateKey]
      );

      if (existing.rows.length > 0) {
        console.log(`   ⚠️  Already exists, skipping\n`);
        skippedCount++;
        continue;
      }

      // Insert new state
      await pool.query(`
        INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        state.stateKey,
        state.stateName,
        state.apiUrl,
        state.apiType,
        state.format,
        state.enabled
      ]);

      console.log(`   ✅ Successfully added ${state.stateName}\n`);
      addedCount++;

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
      errorCount++;
    }
  }

  await pool.end();

  console.log('\n📊 Summary:');
  console.log(`   Added: ${addedCount} states`);
  console.log(`   Skipped: ${skippedCount} (already exist)`);
  console.log(`   Errors: ${errorCount}`);
  console.log('\n✨ Done! Note: Some states are disabled and need verified feed URLs.');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

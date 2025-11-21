#!/usr/bin/env node
/**
 * Populate states in PostgreSQL database for State/Agency Affiliation dropdown
 * Run with: railway run node scripts/populate_states_postgres.js
 */

const { Client } = require('pg');

const states = [
  { stateKey: 'ia', stateName: 'Iowa DOT' },
  { stateKey: 'co', stateName: 'Colorado DOT' },
  { stateKey: 'fl', stateName: 'Florida DOT' },
  { stateKey: 'ky', stateName: 'Kentucky Transportation Cabinet' },
  { stateKey: 'mn', stateName: 'Minnesota DOT' },
  { stateKey: 'ma', stateName: 'Massachusetts DOT' },
  { stateKey: 'wa', stateName: 'Washington DOT' },
  { stateKey: 'il', stateName: 'Illinois DOT' },
  { stateKey: 'pa', stateName: 'Pennsylvania DOT' },
  { stateKey: 'wi', stateName: 'Wisconsin DOT' },
  { stateKey: 'oh', stateName: 'Ohio DOT' },
  { stateKey: 'ca', stateName: 'California DOT' },
  { stateKey: 'tx', stateName: 'Texas DOT' },
  { stateKey: 'ny', stateName: 'New York DOT' },
  { stateKey: 'nc', stateName: 'North Carolina DOT' },
  { stateKey: 'va', stateName: 'Virginia DOT' },
  { stateKey: 'ga', stateName: 'Georgia DOT' },
  { stateKey: 'mi', stateName: 'Michigan DOT' },
  { stateKey: 'la', stateName: 'Louisiana DOT' },
  { stateKey: 'nm', stateName: 'New Mexico DOT' },
  { stateKey: 'de', stateName: 'Delaware DOT' },
  { stateKey: 'hi', stateName: 'Hawaii DOT' },
  { stateKey: 'id', stateName: 'Idaho DOT' },
  { stateKey: 'fhwa', stateName: 'FHWA' }
];

async function populateStates() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    console.error('Run with: railway run node scripts/populate_states_postgres.js');
    process.exit(1);
  }

  console.log('🐘 Connecting to PostgreSQL database...');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    console.log('➕ Adding states to state_feeds table:\n');

    let added = 0;
    let skipped = 0;

    for (const state of states) {
      try {
        // Try to insert, skip if already exists
        const result = await client.query(`
          INSERT INTO state_feeds (stateKey, stateName, format, apiType)
          VALUES ($1, $2, 'json', 'WZDx')
          ON CONFLICT (stateKey) DO NOTHING
          RETURNING id
        `, [state.stateKey, state.stateName]);

        if (result.rowCount > 0) {
          console.log(`✅ ${state.stateName} (${state.stateKey})`);
          added++;
        } else {
          console.log(`⏭️  ${state.stateName} (${state.stateKey}) - already exists`);
          skipped++;
        }
      } catch (error) {
        console.error(`❌ ${state.stateName} - ${error.message}`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Added: ${added}`);
    console.log(`   ⏭️  Skipped (already exist): ${skipped}`);
    console.log(`   📝 Total states: ${states.length}`);

  } catch (error) {
    console.error('\n❌ Failed to populate states:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🐘 PostgreSQL connection closed');
  }
}

populateStates();

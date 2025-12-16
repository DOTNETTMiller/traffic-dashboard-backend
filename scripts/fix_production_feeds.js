#!/usr/bin/env node

/**
 * Migrate All State Feeds to Database
 *
 * This script migrates ALL state configurations from hardcoded API_CONFIG to the database.
 * It will INSERT if states don't exist, or UPDATE if they do.
 */

const path = require('path');

const states = [
  {stateKey: 'nv', stateName: 'Nevada', apiUrl: 'https://www.nvroads.com/api/v2/get/roadconditions', apiType: 'Nevada DOT', format: 'json'},
  {stateKey: 'oh', stateName: 'Ohio', apiUrl: 'https://publicapi.ohgo.com/api/v1/constructions', apiType: 'Ohio DOT', format: 'json'},
  {stateKey: 'nj', stateName: 'New Jersey', apiUrl: 'https://511nj.org/client/rest/rss/RSSAllNJActiveEvents', apiType: 'NJ 511', format: 'xml'},
  {stateKey: 'ia', stateName: 'Iowa', apiUrl: 'https://ia.carsprogram.org/hub/data/feu-g.xml', apiType: 'CARS', format: 'xml'},
  {stateKey: 'ks', stateName: 'Kansas', apiUrl: 'https://kscars.kandrive.gov/hub/data/feu-g.xml', apiType: 'CARS', format: 'xml'},
  {stateKey: 'ne', stateName: 'Nebraska', apiUrl: 'https://ne.carsprogram.org/hub/data/feu-g.xml', apiType: 'CARS', format: 'xml'},
  {stateKey: 'in', stateName: 'Indiana', apiUrl: 'https://inhub.carsprogram.org/data/feu-g.xml', apiType: 'CARS', format: 'xml'},
  {stateKey: 'mn', stateName: 'Minnesota', apiUrl: 'https://mn.carsprogram.org/hub/data/feu-g.xml', apiType: 'CARS', format: 'xml'},
  {stateKey: 'ut', stateName: 'Utah', apiUrl: 'https://udottraffic.utah.gov/wzdx/udot/v40/data', apiType: 'WZDx', format: 'json'},
  {stateKey: 'il', stateName: 'Illinois', apiUrl: 'https://travelmidwest.com/lmiga/incidents.json?path=GATEWAY.IL', apiType: 'Travel Midwest', format: 'json'},
  {stateKey: 'tx', stateName: 'Texas', apiUrl: 'https://api.drivetexas.org/api/conditions.wzdx.geojson', apiType: 'WZDx', format: 'geojson'},
  {stateKey: 'ok', stateName: 'Oklahoma', apiUrl: 'https://oktraffic.org/api/Geojsons/workzones?&access_token=feOPynfHRJ5sdx8tf3IN5yOsGz89TAUuzHsN3V0jo1Fg41LcpoLhIRltaTPmDngD', apiType: 'WZDx', format: 'geojson'},
  {stateKey: 'ca', stateName: 'California', apiUrl: 'https://cwwp2.dot.ca.gov/data/d*/lcsdata.json', apiType: 'Caltrans LCS', format: 'json'},
  {stateKey: 'pa', stateName: 'Pennsylvania', apiUrl: 'https://www.511pa.com/feeds/RoadConditions.xml', apiType: 'PennDOT RCRS', format: 'xml'}
];

async function runPostgres() {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to PostgreSQL database\n');

  let insertCount = 0;
  let updateCount = 0;

  for (const state of states) {
    try {
      const result = await client.query(`
        INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (state_key)
        DO UPDATE SET
          state_name = EXCLUDED.state_name,
          api_url = EXCLUDED.api_url,
          api_type = EXCLUDED.api_type,
          format = EXCLUDED.format,
          enabled = EXCLUDED.enabled,
          updated_at = CURRENT_TIMESTAMP
        RETURNING (xmax = 0) AS inserted;
      `, [state.stateKey, state.stateName, state.apiUrl, state.apiType, state.format]);

      if (result.rows[0].inserted) {
        insertCount++;
        console.log(`✅ Inserted: ${state.stateKey} - ${state.stateName}`);
      } else {
        updateCount++;
        console.log(`🔄 Updated: ${state.stateKey} - ${state.stateName}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${state.stateKey}:`, error.message);
    }
  }

  console.log(`\n📊 Migration complete:`);
  console.log(`   Inserted: ${insertCount} states`);
  console.log(`   Updated: ${updateCount} states`);

  // Verify
  const verify = await client.query(`
    SELECT state_key, state_name, api_type, enabled
    FROM states
    ORDER BY state_key
  `);
  console.log(`\n📋 Total states in database: ${verify.rows.length}`);
  console.log(`   Enabled: ${verify.rows.filter(r => r.enabled).length}`);

  await client.end();
}

function runSqlite() {
  const Database = require('better-sqlite3');
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'states.db');
  const db = new Database(dbPath);

  console.log(`Connected to SQLite database at ${dbPath}\n`);

  const stmt = db.prepare(`
    INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(state_key) DO UPDATE SET
      state_name = excluded.state_name,
      api_url = excluded.api_url,
      api_type = excluded.api_type,
      format = excluded.format,
      enabled = excluded.enabled
  `);

  for (const state of states) {
    try {
      stmt.run(state.stateKey, state.stateName, state.apiUrl, state.apiType, state.format);
      console.log(`✅ ${state.stateKey}: ${state.stateName}`);
    } catch (error) {
      console.error(`❌ Error processing ${state.stateKey}:`, error.message);
    }
  }

  // Verify
  const verify = db.prepare(`SELECT state_key, state_name, api_type, enabled FROM states ORDER BY state_key`).all();
  console.log(`\n📋 Total states in database: ${verify.length}`);
  console.log(`   Enabled: ${verify.filter(r => r.enabled).length}`);

  db.close();
}

async function run() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    console.log('Using PostgreSQL database\n');
    await runPostgres();
  } else {
    console.log('Using SQLite database\n');
    runSqlite();
  }
  console.log('\n✅ State feeds updated successfully!');
  console.log('🔄 Restart the backend service to apply changes.');
}

run().catch(error => {
  console.error('❌ Update failed:', error);
  process.exit(1);
});

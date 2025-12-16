#!/usr/bin/env node

/**
 * Fix Production State Feeds
 *
 * This script ensures TX and OK states exist in the database with correct configurations.
 * It will INSERT if they don't exist, or UPDATE if they do.
 */

const path = require('path');

async function runPostgres() {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to PostgreSQL database');

  // Texas - Official statewide Texas DOT WZDx feed
  // API key will be added by backend from TXDOT_API_KEY env var
  const txResult = await client.query(`
    INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
    VALUES ('tx', 'Texas', 'https://api.drivetexas.org/api/conditions.wzdx.geojson', 'WZDx', 'geojson', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (state_key)
    DO UPDATE SET
      api_url = EXCLUDED.api_url,
      api_type = EXCLUDED.api_type,
      format = EXCLUDED.format,
      enabled = EXCLUDED.enabled,
      updated_at = CURRENT_TIMESTAMP
    RETURNING state_key;
  `);
  console.log(`✅ Texas: ${txResult.rowCount > 0 ? 'Updated/Inserted' : 'No change'}`);

  // Oklahoma - Official statewide Oklahoma DOT WZDx feed (includes access token in URL)
  const okResult = await client.query(`
    INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
    VALUES ('ok', 'Oklahoma', 'https://oktraffic.org/api/Geojsons/workzones?&access_token=feOPynfHRJ5sdx8tf3IN5yOsGz89TAUuzHsN3V0jo1Fg41LcpoLhIRltaTPmDngD', 'WZDx', 'geojson', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (state_key)
    DO UPDATE SET
      api_url = EXCLUDED.api_url,
      api_type = EXCLUDED.api_type,
      format = EXCLUDED.format,
      enabled = EXCLUDED.enabled,
      updated_at = CURRENT_TIMESTAMP
    RETURNING state_key;
  `);
  console.log(`✅ Oklahoma: ${okResult.rowCount > 0 ? 'Updated/Inserted' : 'No change'}`);

  // Verify
  const verify = await client.query(`SELECT state_key, state_name, api_url, api_type, enabled FROM states WHERE state_key IN ('tx', 'ok') ORDER BY state_key`);
  console.log('\n📊 Current state configurations:');
  verify.rows.forEach(row => {
    console.log(`  ${row.state_key}: ${row.state_name} - ${row.api_type} - ${row.enabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`     URL: ${row.api_url}`);
  });

  await client.end();
}

function runSqlite() {
  const Database = require('better-sqlite3');
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'states.db');
  const db = new Database(dbPath);

  console.log(`Connected to SQLite database at ${dbPath}`);

  // Texas - Official statewide Texas DOT WZDx feed
  // API key will be added by backend from TXDOT_API_KEY env var
  const txStmt = db.prepare(`
    INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled)
    VALUES ('tx', 'Texas', 'https://api.drivetexas.org/api/conditions.wzdx.geojson', 'WZDx', 'geojson', 1)
    ON CONFLICT(state_key) DO UPDATE SET
      api_url = excluded.api_url,
      api_type = excluded.api_type,
      format = excluded.format,
      enabled = excluded.enabled
  `);
  const txResult = txStmt.run();
  console.log(`✅ Texas: ${txResult.changes > 0 ? 'Updated/Inserted' : 'No change'}`);

  // Oklahoma - Official statewide Oklahoma DOT WZDx feed (includes access token in URL)
  const okStmt = db.prepare(`
    INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled)
    VALUES ('ok', 'Oklahoma', 'https://oktraffic.org/api/Geojsons/workzones?&access_token=feOPynfHRJ5sdx8tf3IN5yOsGz89TAUuzHsN3V0jo1Fg41LcpoLhIRltaTPmDngD', 'WZDx', 'geojson', 1)
    ON CONFLICT(state_key) DO UPDATE SET
      api_url = excluded.api_url,
      api_type = excluded.api_type,
      format = excluded.format,
      enabled = excluded.enabled
  `);
  const okResult = okStmt.run();
  console.log(`✅ Oklahoma: ${okResult.changes > 0 ? 'Updated/Inserted' : 'No change'}`);

  // Verify
  const verify = db.prepare(`SELECT state_key, state_name, api_url, api_type, enabled FROM states WHERE state_key IN ('tx', 'ok') ORDER BY state_key`).all();
  console.log('\n📊 Current state configurations:');
  verify.forEach(row => {
    console.log(`  ${row.state_key}: ${row.state_name} - ${row.api_type} - ${row.enabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`     URL: ${row.api_url}`);
  });

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

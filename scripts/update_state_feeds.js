#!/usr/bin/env node

/**
 * Update State Feed Configurations
 *
 * This script updates Texas and Oklahoma feed configurations in the database.
 *
 * WHEN TO USE THIS SCRIPT:
 * - After deploying code changes that modify state feed configurations
 * - When you've added new state feed configs to the codebase but they don't appear in production
 * - To synchronize database configuration with code-based configuration
 *
 * WHY THIS IS NEEDED:
 * - The backend uses database-driven configuration (loadStatesFromDatabase() at startup)
 * - Database values OVERRIDE any code-based configurations in API_CONFIG
 * - Code changes to state feeds won't appear until the database is updated
 *
 * HOW TO USE:
 *
 * Local development:
 *   node scripts/update_state_feeds.js
 *
 * Production (Railway):
 *   railway ssh -s traffic-dashboard-backend -- node scripts/update_state_feeds.js
 *   railway up  # Restart to apply changes
 *
 * See DEPLOYMENT.md for more details on database-driven configuration.
 */

const path = require('path');

const updates = [
  {
    stateKey: 'tx',
    sql: `
      UPDATE states
      SET api_url = 'https://data.austintexas.gov/resource/d9mm-cjw9.geojson?$limit=50000',
          api_type = 'WZDx',
          format = 'geojson',
          updated_at = CURRENT_TIMESTAMP
      WHERE state_key = 'tx'
    `,
    sqliteSql: `
      UPDATE states
      SET api_url = 'https://data.austintexas.gov/resource/d9mm-cjw9.geojson?$limit=50000',
          api_type = 'WZDx',
          format = 'geojson'
      WHERE state_key = 'tx'
    `
  },
  {
    stateKey: 'ok',
    sql: `
      UPDATE states
      SET api_url = 'https://ok.carsprogram.org/hub/data/feu-g.xml',
          api_type = 'FEU-G',
          format = 'xml',
          updated_at = CURRENT_TIMESTAMP
      WHERE state_key = 'ok'
    `,
    sqliteSql: `
      UPDATE states
      SET api_url = 'https://ok.carsprogram.org/hub/data/feu-g.xml',
          api_type = 'FEU-G',
          format = 'xml'
      WHERE state_key = 'ok'
    `
  }
];

async function runPostgres() {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  for (const update of updates) {
    const result = await client.query(update.sql);
    console.log(`Updated ${update.stateKey}: ${result.rowCount} row(s) affected (PostgreSQL)`);
  }
  await client.end();
}

function runSqlite() {
  const Database = require('better-sqlite3');
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'states.db');
  const db = new Database(dbPath);
  for (const update of updates) {
    const info = db.prepare(update.sqliteSql).run();
    console.log(`Updated ${update.stateKey}: ${info.changes} row(s) affected (SQLite @ ${dbPath})`);
  }
  db.close();
}

async function run() {
  if (process.env.DATABASE_URL) {
    await runPostgres();
  } else {
    runSqlite();
  }
}

run().catch(error => {
  console.error('State update failed:', error);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * One-off helper script to update Texas and Oklahoma feed configurations
 * in the production PostgreSQL database (Railway).
 */

const { Client } = require('pg');

const updates = [
  {
    stateKey: 'tx',
    sql: `
      UPDATE states
      SET api_url = 'https://data.austintexas.gov/resource/d9mm-cjw9.geojson?$limit=50000',
          api_type = 'WZDx',
          format = 'geojson',
          updated_at = NOW()
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
          updated_at = NOW()
      WHERE state_key = 'ok'
    `
  }
];

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  for (const update of updates) {
    const result = await client.query(update.sql);
    console.log(`Updated ${update.stateKey}: ${result.rowCount} row(s) affected`);
  }

  await client.end();
}

run().catch(error => {
  console.error('State update failed:', error.message);
  process.exit(1);
});

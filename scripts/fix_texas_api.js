#!/usr/bin/env node

/**
 * Fix Texas API URL
 * The DriveTexas API requires authentication (401).
 * Switch to Austin's public WZDx feed which has 1,400+ events.
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_URL
  ? null  // Use PostgreSQL in production
  : path.join(__dirname, '..', 'states.db');

async function fixTexasAPI() {
  try {
    if (process.env.DATABASE_URL) {
      // PostgreSQL (production)
      const { Client } = require('pg');
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();

      console.log('🔧 Updating Texas API URL in PostgreSQL...');
      await client.query(`
        UPDATE states
        SET api_url = 'https://data.austintexas.gov/download/d9mm-cjw9',
            state_name = 'Texas (Austin)'
        WHERE state_key = 'tx'
      `);

      const result = await client.query(`
        SELECT state_key, state_name, api_url
        FROM states
        WHERE state_key = 'tx'
      `);

      console.log('✅ Texas API updated:', result.rows[0]);
      await client.end();
    } else {
      // SQLite (local)
      const db = new Database(dbPath);

      console.log('🔧 Updating Texas API URL in SQLite...');
      db.prepare(`
        UPDATE states
        SET api_url = 'https://data.austintexas.gov/download/d9mm-cjw9',
            state_name = 'Texas (Austin)'
        WHERE state_key = 'tx'
      `).run();

      const result = db.prepare(`
        SELECT state_key, state_name, api_url
        FROM states
        WHERE state_key = 'tx'
      `).get();

      console.log('✅ Texas API updated:', result);
      db.close();
    }
  } catch (error) {
    console.error('⚠️  Error updating Texas API:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  fixTexasAPI();
}

module.exports = { fixTexasAPI };

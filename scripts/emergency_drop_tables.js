#!/usr/bin/env node
/**
 * Emergency script to drop infrastructure tables
 * Must be run via: railway run node scripts/emergency_drop_tables.js
 */

const { Client } = require('pg');

async function emergencyDrop() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not set');
    process.exit(1);
  }

  console.log('Connecting to PostgreSQL...');
  console.log(`Using DATABASE_URL hostname: ${new URL(dbUrl).hostname}`);

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully!');

    console.log('Dropping infrastructure_gaps...');
    await client.query('DROP TABLE IF EXISTS infrastructure_gaps CASCADE');
    console.log('  Dropped');

    console.log('Dropping infrastructure_elements...');
    await client.query('DROP TABLE IF EXISTS infrastructure_elements CASCADE');
    console.log('  Dropped');

    console.log('Dropping ifc_models...');
    await client.query('DROP TABLE IF EXISTS ifc_models CASCADE');
    console.log('  Dropped');

    console.log('Dropping infrastructure_standards...');
    await client.query('DROP TABLE IF EXISTS infrastructure_standards CASCADE');
    console.log('  Dropped');

    console.log('\nSUCCESS: All infrastructure tables dropped!');
    console.log('The server should restart automatically and work correctly.');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('FAILED:', error.message);
    console.error('Full error:', error);
    await client.end();
    process.exit(1);
  }
}

emergencyDrop();

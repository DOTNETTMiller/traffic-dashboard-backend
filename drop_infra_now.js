#!/usr/bin/env node
const { Client } = require('pg');

async function dropNow() {
  // Get DATABASE_URL from Railway
  const { execSync } = require('child_process');
  const dbUrl = execSync('railway variables get DATABASE_URL 2>&1', { encoding: 'utf-8' }).trim();

  if (!dbUrl || dbUrl.includes('not found') || dbUrl.includes('Error')) {
    console.error('Could not get DATABASE_URL from Railway');
    console.error('Output was:', dbUrl);
    process.exit(1);
  }

  console.log('Got DATABASE_URL, connecting...');

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected!');

    console.log('Dropping infrastructure_gaps...');
    await client.query('DROP TABLE IF EXISTS infrastructure_gaps CASCADE');

    console.log('Dropping infrastructure_elements...');
    await client.query('DROP TABLE IF EXISTS infrastructure_elements CASCADE');

    console.log('Dropping ifc_models...');
    await client.query('DROP TABLE IF EXISTS ifc_models CASCADE');

    console.log('Dropping infrastructure_standards...');
    await client.query('DROP TABLE IF EXISTS infrastructure_standards CASCADE');

    console.log('\n✅ SUCCESS! All tables dropped.');
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

dropNow();

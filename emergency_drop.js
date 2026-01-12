#!/usr/bin/env node
/**
 * Emergency script to drop infrastructure tables via Railway run
 */

const { Client } = require('pg');

async function dropTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('Dropping infrastructure_gaps...');
    await client.query('DROP TABLE IF EXISTS infrastructure_gaps CASCADE');
    console.log('  ✅ Dropped infrastructure_gaps');

    console.log('Dropping infrastructure_elements...');
    await client.query('DROP TABLE IF EXISTS infrastructure_elements CASCADE');
    console.log('  ✅ Dropped infrastructure_elements');

    console.log('Dropping ifc_models...');
    await client.query('DROP TABLE IF EXISTS ifc_models CASCADE');
    console.log('  ✅ Dropped ifc_models');

    console.log('Dropping infrastructure_standards...');
    await client.query('DROP TABLE IF EXISTS infrastructure_standards CASCADE');
    console.log('  ✅ Dropped infrastructure_standards');

    console.log('\n✅ SUCCESS! All infrastructure tables dropped.');
    console.log('The server will restart automatically and should work now.');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

dropTables();

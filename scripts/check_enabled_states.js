#!/usr/bin/env node

const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const result = await client.query('SELECT state_key, state_name, enabled FROM states ORDER BY state_key');

  console.log('Current database state:');
  result.rows.forEach(r => {
    console.log(`  ${r.state_key}: ${r.state_name} - enabled: ${r.enabled}`);
  });

  console.log(`\nTotal: ${result.rows.length} states`);
  console.log(`Enabled: ${result.rows.filter(r => r.enabled).length}`);
  console.log(`Disabled: ${result.rows.filter(r => !r.enabled).length}`);

  await client.end();
  process.exit(0);
})();

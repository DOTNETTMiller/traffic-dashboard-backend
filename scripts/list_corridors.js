const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function listCorridors() {
  console.log('\n📋 Listing All Interstate Corridors\n');
  console.log('='.repeat(80));

  try {
    const result = await pool.query(`
      SELECT name
      FROM corridors
      WHERE name LIKE 'I-%'
      ORDER BY
        CAST(REGEXP_REPLACE(name, '[^0-9]', '', 'g') AS INTEGER),
        name
    `);

    console.log(`\nTotal Corridors: ${result.rows.length}\n`);

    // Group by route number
    const routes = {};
    for (const row of result.rows) {
      const match = row.name.match(/I-(\d+)/);
      if (match) {
        const routeNum = match[1];
        if (!routes[routeNum]) {
          routes[routeNum] = [];
        }
        routes[routeNum].push(row.name);
      }
    }

    // Print grouped
    const routeNums = Object.keys(routes).map(Number).sort((a, b) => a - b);
    for (const routeNum of routeNums) {
      console.log(`I-${routeNum}:`);
      for (const name of routes[routeNum]) {
        console.log(`  - ${name}`);
      }
    }

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

listCorridors().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

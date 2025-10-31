#!/usr/bin/env node
// Direct PostgreSQL database cleanup script
// Cleans both Pennsylvania and New Jersey databases

const { Client } = require('pg');

async function cleanupDatabase() {
  console.log('=====================================================');
  console.log(' Database Cleanup - Pennsylvania & New Jersey');
  console.log('=====================================================\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✓ Connected to PostgreSQL database\n');

    // PENNSYLVANIA CLEANUP
    console.log('=' * 60);
    console.log(' PENNSYLVANIA CLEANUP');
    console.log('=' * 60);

    // Get PA stats before cleanup
    const paBeforeQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE source LIKE '%PennDOT RCRS%') as legitimate,
        COUNT(*) FILTER (WHERE source NOT LIKE '%PennDOT RCRS%' OR source IS NULL) as polluted
      FROM events WHERE state = 'PA'
    `;
    const paBeforeResult = await client.query(paBeforeQuery);
    const paBefore = paBeforeResult.rows[0];

    console.log(`\nBefore cleanup:`);
    console.log(`  Total PA events: ${paBefore.total}`);
    console.log(`  Legitimate (PennDOT RCRS): ${paBefore.legitimate}`);
    console.log(`  Polluted: ${paBefore.polluted}`);

    // Delete polluted PA events
    const paDeleteQuery = `
      DELETE FROM events
      WHERE state = 'PA'
        AND (source NOT LIKE '%PennDOT RCRS%' OR source IS NULL)
    `;
    const paDeleteResult = await client.query(paDeleteQuery);
    console.log(`\n✓ Deleted ${paDeleteResult.rowCount} polluted PA events`);

    // Get PA stats after cleanup
    const paAfterQuery = `SELECT COUNT(*) as total FROM events WHERE state = 'PA'`;
    const paAfterResult = await client.query(paAfterQuery);
    console.log(`✓ Remaining PA events: ${paAfterResult.rows[0].total}\n`);

    // NEW JERSEY CLEANUP
    console.log('=' * 60);
    console.log(' NEW JERSEY CLEANUP');
    console.log('=' * 60);

    // Check if NJ has legitimate source (we need to figure this out first)
    const njSourceQuery = `
      SELECT source, COUNT(*) as count
      FROM events
      WHERE state = 'NJ'
      GROUP BY source
      ORDER BY count DESC
      LIMIT 10
    `;
    const njSourceResult = await client.query(njSourceQuery);

    console.log(`\nNew Jersey event sources:`);
    njSourceResult.rows.forEach(row => {
      console.log(`  - ${row.source || 'NULL'}: ${row.count} events`);
    });

    // For now, delete events from sources we KNOW are wrong
    const njDeleteQuery = `
      DELETE FROM events
      WHERE state = 'NJ'
        AND (
          source LIKE '%Ohio OHGO%' OR
          source LIKE '%Caltrans%' OR
          source LIKE '%PennDOT RCRS%'
        )
    `;
    const njDeleteResult = await client.query(njDeleteQuery);
    console.log(`\n✓ Deleted ${njDeleteResult.rowCount} polluted NJ events from other states`);

    // Get NJ stats after cleanup
    const njAfterQuery = `SELECT COUNT(*) as total FROM events WHERE state = 'NJ'`;
    const njAfterResult = await client.query(njAfterQuery);
    console.log(`✓ Remaining NJ events: ${njAfterResult.rows[0].total}\n`);

    console.log('=====================================================');
    console.log('✅ Database Cleanup Complete!');
    console.log('=====================================================\n');

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the cleanup
if (require.main === module) {
  cleanupDatabase()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { cleanupDatabase };

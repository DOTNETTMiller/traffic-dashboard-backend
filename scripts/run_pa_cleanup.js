#!/usr/bin/env node
// Execute Pennsylvania database cleanup on Railway PostgreSQL
// This script runs the SQL cleanup queries directly using the PostgreSQL adapter

const PostgreSQLAdapter = require('../database-pg-adapter');

async function runCleanup() {
  console.log('=====================================================');
  console.log('  Pennsylvania Database Cleanup Script');
  console.log('=====================================================\n');

  const db = new PostgreSQLAdapter(process.env.DATABASE_URL);

  try {
    await db.init();
    console.log('✓ Connected to PostgreSQL database\n');

    // BEFORE CLEANUP - Get stats
    console.log('📊 BEFORE CLEANUP:');
    console.log('─'.repeat(70));

    const beforeQuery = `
      SELECT
        COUNT(*) as total_pa_events,
        COUNT(*) FILTER (WHERE source LIKE '%PennDOT RCRS%') as legitimate_events,
        COUNT(*) FILTER (WHERE source NOT LIKE '%PennDOT RCRS%' AND source IS NOT NULL) as polluted_with_source,
        COUNT(*) FILTER (WHERE source IS NULL) as polluted_no_source
      FROM events
      WHERE state = 'PA'
    `;

    const beforeStats = await db.pool.query(beforeQuery);
    const before = beforeStats.rows[0];

    console.log(`  Total PA events: ${before.total_pa_events}`);
    console.log(`  Legitimate (PennDOT RCRS): ${before.legitimate_events}`);
    console.log(`  Polluted (with source): ${before.polluted_with_source}`);
    console.log(`  Polluted (no source): ${before.polluted_no_source}\n`);

    // Show breakdown by source
    console.log('📈 Breakdown by source:');
    const sourceQuery = `
      SELECT
        COALESCE(source, 'NULL/Unknown') as source,
        COUNT(*) as count
      FROM events
      WHERE state = 'PA'
      GROUP BY source
      ORDER BY count DESC
    `;

    const sourceStats = await db.pool.query(sourceQuery);
    sourceStats.rows.forEach(row => {
      console.log(`  ${row.source}: ${row.count} events`);
    });
    console.log();

    // Calculate events to delete
    const toDelete = parseInt(before.total_pa_events) - parseInt(before.legitimate_events);

    if (toDelete === 0) {
      console.log('✨ Database is already clean! No events to delete.\n');
      return;
    }

    console.log(`\n🗑️  Will DELETE ${toDelete} polluted events`);
    console.log(`✅ Will KEEP ${before.legitimate_events} legitimate PennDOT RCRS events\n`);

    // Proceed with cleanup
    console.log('🧹 Executing DELETE operation...');

    const deleteQuery = `
      DELETE FROM events
      WHERE state = 'PA'
        AND (source NOT LIKE '%PennDOT RCRS%' OR source IS NULL)
    `;

    const deleteResult = await db.pool.query(deleteQuery);
    console.log(`✓ Deleted ${deleteResult.rowCount} events\n`);

    // AFTER CLEANUP - Verify results
    console.log('📊 AFTER CLEANUP:');
    console.log('─'.repeat(70));

    const afterQuery = `
      SELECT
        COUNT(*) as total_pa_events,
        COUNT(*) FILTER (WHERE source LIKE '%PennDOT RCRS%') as penndot_events,
        COUNT(*) FILTER (WHERE coordinates IS NOT NULL) as events_with_coords
      FROM events
      WHERE state = 'PA'
    `;

    const afterStats = await db.pool.query(afterQuery);
    const after = afterStats.rows[0];

    console.log(`  Total PA events: ${after.total_pa_events}`);
    console.log(`  PennDOT RCRS events: ${after.penndot_events}`);
    console.log(`  Events with coordinates: ${after.events_with_coords}\n`);

    // Final verification - show remaining sources
    console.log('📈 Remaining sources:');
    const finalSourceStats = await db.pool.query(sourceQuery);
    finalSourceStats.rows.forEach(row => {
      console.log(`  ${row.source}: ${row.count} events`);
    });

    console.log('\n=====================================================');
    console.log('✅ Pennsylvania Database Cleanup Complete!');
    console.log('=====================================================\n');

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    await db.close();
  }
}

// Run the cleanup
if (require.main === module) {
  runCleanup()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runCleanup };

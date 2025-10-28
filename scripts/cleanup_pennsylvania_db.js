// Clean up Pennsylvania database by removing incorrectly labeled events
// Keeps only events from PennDOT RCRS API (the correct source)

const PostgreSQLAdapter = require('../database-pg-adapter');

async function cleanupPennsylvaniaEvents() {
  console.log('🧹 Cleaning up Pennsylvania events database...\n');

  const db = new PostgreSQLAdapter(process.env.DATABASE_URL);

  try {
    await db.init();

    // Get total count before cleanup
    const beforeStmt = db.prepare('SELECT COUNT(*) as count FROM events WHERE state = ?');
    const beforeResult = await beforeStmt.get('PA');
    const totalBefore = beforeResult?.count || 0;

    console.log(`📊 Before cleanup: ${totalBefore} events with state = 'PA'\n`);

    // Count events that will be kept (PennDOT RCRS events)
    const keepStmt = db.prepare(`
      SELECT COUNT(*) as count FROM events
      WHERE state = ? AND (source LIKE ? OR source LIKE ?)
    `);
    const keepResult = await keepStmt.get('PA', 'PennDOT RCRS%', '%PennDOT RCRS%');
    const toKeep = keepResult?.count || 0;

    console.log(`✅ Events to KEEP (PennDOT RCRS): ${toKeep}`);
    console.log(`❌ Events to DELETE (incorrectly labeled): ${totalBefore - toKeep}\n`);

    if (totalBefore - toKeep === 0) {
      console.log('✨ Database is already clean! No events to delete.');
      return;
    }

    // Delete events that are NOT from PennDOT RCRS
    const deleteStmt = db.prepare(`
      DELETE FROM events
      WHERE state = ?
      AND source NOT LIKE ?
      AND source NOT LIKE ?
    `);

    const result = await deleteStmt.run('PA', 'PennDOT RCRS%', '%PennDOT RCRS%');

    console.log(`🗑️  Deleted ${result.changes} incorrectly labeled events\n`);

    // Get final count
    const afterResult = await beforeStmt.get('PA');
    const totalAfter = afterResult?.count || 0;

    console.log('📊 After cleanup:');
    console.log(`  Total Pennsylvania events: ${totalAfter}`);
    console.log(`  All events are now from PennDOT RCRS ✅\n`);

    console.log('✅ Database cleanup completed successfully!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    await db.close();
  }
}

// Run if called directly
if (require.main === module) {
  cleanupPennsylvaniaEvents()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { cleanupPennsylvaniaEvents };

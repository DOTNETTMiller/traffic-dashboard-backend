// Clear event_geometries table to force re-fetch with new offset settings
// Run this after removing offsets to get fresh, accurate geometry

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'states.db');

function clearEventGeometries() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   Clear Event Geometries Cache');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const db = new Database(DB_PATH);

    // Count before deletion
    const before = db.prepare('SELECT COUNT(*) as count FROM event_geometries').get();
    console.log(`📊 Current cached geometries: ${before.count}\n`);

    if (before.count === 0) {
      console.log('✅ Cache is already empty, nothing to clear.');
      db.close();
      return;
    }

    // Show breakdown by source
    const bySource = db.prepare(`
      SELECT source, COUNT(*) as count
      FROM event_geometries
      GROUP BY source
    `).all();

    console.log('📋 Geometries by source:');
    bySource.forEach(row => {
      console.log(`   ${row.source}: ${row.count}`);
    });
    console.log('');

    // Delete all geometries
    const result = db.prepare('DELETE FROM event_geometries').run();
    console.log(`🗑️  Deleted ${result.changes} cached geometries\n`);

    // Verify deletion
    const after = db.prepare('SELECT COUNT(*) as count FROM event_geometries').get();
    console.log(`✅ Cache cleared! Remaining: ${after.count}\n`);

    db.close();

    console.log('💡 Next steps:');
    console.log('   1. Restart the backend: npm start');
    console.log('   2. Events will re-fetch geometry (without offsets)');
    console.log('   3. New geometry will snap to exact road centerlines');
    console.log('');

  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
    process.exit(1);
  }
}

clearEventGeometries();

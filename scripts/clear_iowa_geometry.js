// Clear Iowa event geometry cache to force re-fetch with Google Directions API
// This prioritizes Iowa events to get TRUE directional routing first

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'states.db');

function clearIowaGeometry() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   Clear Iowa Event Geometry Cache');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const db = new Database(DB_PATH);

    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='event_geometries'
    `).get();

    if (!tableExists) {
      console.log('⚠️  event_geometries table does not exist yet.');
      console.log('   This is expected if the backend hasn\'t been started with the new code.\n');
      console.log('💡 Next steps:');
      console.log('   1. Start/restart the backend: npm start');
      console.log('   2. Wait for events to be fetched (creates the table)');
      console.log('   3. Run this script again to clear Iowa geometry');
      db.close();
      return;
    }

    // Count Iowa geometries before deletion
    const before = db.prepare(`
      SELECT COUNT(*) as count
      FROM event_geometries
      WHERE state_key LIKE '%iowa%' OR state_key LIKE '%ia%'
    `).get();

    console.log(`📊 Iowa cached geometries: ${before.count}\n`);

    if (before.count === 0) {
      console.log('✅ No Iowa geometries in cache, nothing to clear.');
      db.close();
      return;
    }

    // Show breakdown by source for Iowa
    const bySource = db.prepare(`
      SELECT source, COUNT(*) as count
      FROM event_geometries
      WHERE state_key LIKE '%iowa%' OR state_key LIKE '%ia%'
      GROUP BY source
    `).all();

    console.log('📋 Iowa geometries by source:');
    bySource.forEach(row => {
      let emoji = '📍';
      if (row.source === 'google_directions') emoji = '✅';
      else if (row.source === 'google_roads') emoji = '⚠️';
      console.log(`   ${emoji} ${row.source}: ${row.count}`);
    });
    console.log('');

    // Delete Iowa geometries
    const result = db.prepare(`
      DELETE FROM event_geometries
      WHERE state_key LIKE '%iowa%' OR state_key LIKE '%ia%'
    `).run();

    console.log(`🗑️  Deleted ${result.changes} Iowa cached geometries\n`);

    // Verify deletion
    const after = db.prepare(`
      SELECT COUNT(*) as count
      FROM event_geometries
      WHERE state_key LIKE '%iowa%' OR state_key LIKE '%ia%'
    `).get();

    console.log(`✅ Iowa cache cleared! Remaining Iowa geometries: ${after.count}\n`);

    // Show total remaining geometries
    const totalRemaining = db.prepare('SELECT COUNT(*) as count FROM event_geometries').get();
    console.log(`📦 Total geometries still cached (other states): ${totalRemaining.count}\n`);

    db.close();

    console.log('💡 Next steps:');
    console.log('   1. Backend will automatically re-fetch Iowa events on next request');
    console.log('   2. Iowa events will use Google Directions API (TRUE directional routing)');
    console.log('   3. Watch logs for "✅ Using Google Directions API geometry"');
    console.log('   4. Iowa events will appear in CORRECT colors (not grey)');
    console.log('');

  } catch (error) {
    console.error('❌ Error clearing Iowa geometry:', error.message);
    process.exit(1);
  }
}

clearIowaGeometry();

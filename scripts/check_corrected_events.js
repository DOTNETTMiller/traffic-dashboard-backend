// Check which events have been corrected with Google Directions API
// vs older Roads API geometry

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'states.db');

function checkCorrectedEvents() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   Event Geometry Correction Status');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const db = new Database(DB_PATH);

    // Get breakdown by source
    const bySource = db.prepare(`
      SELECT
        source,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM event_geometries), 1) as percentage
      FROM event_geometries
      GROUP BY source
      ORDER BY count DESC
    `).all();

    console.log('📊 Event Geometry Sources:\n');
    bySource.forEach(row => {
      let emoji = '📍';
      let label = row.source;

      if (row.source === 'google_directions') {
        emoji = '✅';
        label = 'Google Directions API (TRUE directional routing)';
      } else if (row.source === 'google_roads') {
        emoji = '⚠️';
        label = 'Google Roads API (centerline only - needs update)';
      } else if (row.source === 'interstate') {
        emoji = '🛣️';
        label = 'Interstate geometries (pre-fetched)';
      } else if (row.source === 'osrm') {
        emoji = '🗺️';
        label = 'OSRM routing (legacy)';
      }

      console.log(`   ${emoji} ${label}`);
      console.log(`      ${row.count} events (${row.percentage}%)\n`);
    });

    // Get total counts
    const total = db.prepare('SELECT COUNT(*) as count FROM event_geometries').get();
    const corrected = db.prepare("SELECT COUNT(*) as count FROM event_geometries WHERE source = 'google_directions'").get();
    const needsUpdate = db.prepare("SELECT COUNT(*) as count FROM event_geometries WHERE source = 'google_roads'").get();

    console.log('─────────────────────────────────────────────────────\n');
    console.log(`📦 Total cached events: ${total.count}`);
    console.log(`✅ Corrected (Directions API): ${corrected.count}`);
    console.log(`⚠️  Needs update (Roads API): ${needsUpdate.count}\n`);

    if (needsUpdate.count > 0) {
      const percentage = ((corrected.count / total.count) * 100).toFixed(1);
      console.log(`📈 Progress: ${percentage}% of events have directional routing\n`);
    }

    // Sample events by source
    console.log('📋 Sample Events:\n');

    const directionsEvents = db.prepare(`
      SELECT event_id, state_key, direction, datetime(created_at, 'unixepoch') as created
      FROM event_geometries
      WHERE source = 'google_directions'
      ORDER BY created_at DESC
      LIMIT 3
    `).all();

    if (directionsEvents.length > 0) {
      console.log('✅ Recent Directions API events (corrected):');
      directionsEvents.forEach(e => {
        console.log(`   ${e.event_id.substring(0, 30)}... (${e.state_key}) - ${e.direction || 'no direction'}`);
      });
      console.log('');
    }

    const roadsEvents = db.prepare(`
      SELECT event_id, state_key, direction, datetime(created_at, 'unixepoch') as created
      FROM event_geometries
      WHERE source = 'google_roads'
      ORDER BY created_at DESC
      LIMIT 3
    `).all();

    if (roadsEvents.length > 0) {
      console.log('⚠️  Recent Roads API events (needs update):');
      roadsEvents.forEach(e => {
        console.log(`   ${e.event_id.substring(0, 30)}... (${e.state_key}) - ${e.direction || 'no direction'}`);
      });
      console.log('');
    }

    db.close();

    console.log('─────────────────────────────────────────────────────\n');
    console.log('💡 How to update old events:\n');
    console.log('   Option 1: Wait for events to expire naturally (7 days)');
    console.log('   Option 2: Clear cache to force re-fetch:');
    console.log('             node scripts/clear_event_geometries.js');
    console.log('   Option 3: Selectively delete Roads API events:');
    console.log('             sqlite3 states.db "DELETE FROM event_geometries WHERE source = \'google_roads\'"');
    console.log('');

  } catch (error) {
    console.error('❌ Error checking corrected events:', error.message);
    process.exit(1);
  }
}

checkCorrectedEvents();

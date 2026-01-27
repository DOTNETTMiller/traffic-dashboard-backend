// Check event geometries cache status
// Shows how many events have cached geometry vs need to be fetched

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'states.db');

async function checkEventGeometries() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   Event Geometries Cache Status');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const db = new Database(DB_PATH);

    // Get total cached geometries
    const totalCached = db.prepare('SELECT COUNT(*) as count FROM event_geometries').get();
    console.log(`📦 Total cached geometries: ${totalCached.count}\n`);

    // Get breakdown by source
    const bySource = db.prepare(`
      SELECT source, COUNT(*) as count
      FROM event_geometries
      GROUP BY source
      ORDER BY count DESC
    `).all();

    console.log('📊 Breakdown by source:');
    bySource.forEach(row => {
      console.log(`   ${row.source}: ${row.count} events`);
    });
    console.log('');

    // Get breakdown by state
    const byState = db.prepare(`
      SELECT state_key, COUNT(*) as count
      FROM event_geometries
      GROUP BY state_key
      ORDER BY count DESC
      LIMIT 10
    `).all();

    console.log('🗺️  Top 10 states by cached geometries:');
    byState.forEach(row => {
      console.log(`   ${row.state_key || 'unknown'}: ${row.count} events`);
    });
    console.log('');

    // Get age statistics
    const now = Math.floor(Date.now() / 1000);
    const ageStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        AVG(${now} - created_at) / 3600 as avg_age_hours,
        MIN(${now} - created_at) / 3600 as min_age_hours,
        MAX(${now} - created_at) / 3600 as max_age_hours
      FROM event_geometries
    `).get();

    if (ageStats.total > 0) {
      console.log('⏰ Cache age statistics:');
      console.log(`   Newest: ${ageStats.min_age_hours.toFixed(1)} hours old`);
      console.log(`   Average: ${ageStats.avg_age_hours.toFixed(1)} hours old`);
      console.log(`   Oldest: ${ageStats.max_age_hours.toFixed(1)} hours old`);
      console.log('');
    }

    // Sample some cached geometries
    const samples = db.prepare(`
      SELECT event_id, state_key, source, direction,
             LENGTH(geometry) as geom_size,
             datetime(created_at, 'unixepoch') as created
      FROM event_geometries
      ORDER BY created_at DESC
      LIMIT 5
    `).all();

    if (samples.length > 0) {
      console.log('📋 Recent cached geometries (sample):');
      samples.forEach(s => {
        console.log(`   ${s.event_id.substring(0, 20)}... (${s.state_key}) - ${s.source} - ${s.direction || 'no direction'}`);
        console.log(`      Geometry size: ${s.geom_size} bytes, Created: ${s.created}`);
      });
      console.log('');
    }

    // Check Google Roads API usage
    try {
      const today = new Date().toISOString().split('T')[0];
      const usage = db.prepare(`
        SELECT api_calls, cache_hits, cache_misses
        FROM google_roads_usage
        WHERE date = ?
      `).get(today);

      if (usage) {
        const totalRequests = usage.cache_hits + usage.cache_misses;
        const hitRate = totalRequests > 0 ? (usage.cache_hits / totalRequests * 100).toFixed(1) : 0;

        console.log('🌐 Google Roads API usage (today):');
        console.log(`   API calls made: ${usage.api_calls}`);
        console.log(`   Cache hits: ${usage.cache_hits}`);
        console.log(`   Cache misses: ${usage.cache_misses}`);
        console.log(`   Cache hit rate: ${hitRate}%`);
        console.log(`   Daily limit: 950 calls`);
        console.log(`   Remaining: ${950 - usage.api_calls} calls`);
        console.log('');
      }
    } catch (err) {
      // Table might not exist yet
    }

    db.close();

    console.log('✅ Cache status check complete!');
    console.log('');
    console.log('💡 Tips:');
    console.log('   - Geometries are cached automatically when events are fetched');
    console.log('   - Each event is only fetched once (subsequent loads use cache)');
    console.log('   - Old geometries (>7 days) are cleaned up automatically');
    console.log('');

  } catch (error) {
    console.error('❌ Error checking cache:', error.message);
    process.exit(1);
  }
}

checkEventGeometries();

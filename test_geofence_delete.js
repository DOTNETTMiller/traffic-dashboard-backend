// Test script to diagnose IPAWS geofence delete functionality
const { Pool } = require('pg');

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testGeofenceDelete() {
  console.log('\n🔍 Checking IPAWS Geofence Delete Functionality\n');
  console.log('='.repeat(60));

  try {
    // 1. Check if table exists
    console.log('\n1️⃣ Checking if event_geofences table exists...');
    const tableCheck = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'event_geofences'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Table event_geofences does NOT exist!');
      console.log('Creating table...\n');

      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS event_geofences (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(255) UNIQUE NOT NULL,
          geofence_geometry JSONB NOT NULL,
          population INTEGER,
          buffer_miles NUMERIC(10,2),
          override_population BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('✅ Table created successfully!\n');
    } else {
      console.log('✅ Table exists!\n');
    }

    // 2. Check table structure
    console.log('2️⃣ Table structure:');
    const structure = await pgPool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'event_geofences'
      ORDER BY ordinal_position;
    `);

    console.table(structure.rows);

    // 3. Check for saved geofences
    console.log('\n3️⃣ Checking for saved geofences...');
    const geofences = await pgPool.query(`
      SELECT event_id, population, buffer_miles, override_population, created_at
      FROM event_geofences
      ORDER BY created_at DESC;
    `);

    console.log(`Found ${geofences.rows.length} saved geofence(s):\n`);

    if (geofences.rows.length > 0) {
      console.table(geofences.rows);

      // 4. Test delete API structure
      console.log('\n4️⃣ Delete API endpoint format:');
      console.log(`   DELETE /api/events/{eventId}/geofence`);
      console.log('\nExample events with geofences:');
      geofences.rows.forEach(g => {
        console.log(`   • Event ID: ${g.event_id}`);
        console.log(`     DELETE ${process.env.API_URL || 'http://localhost:3001'}/api/events/${g.event_id}/geofence`);
      });
    } else {
      console.log('⚠️  No saved geofences found in database.');
      console.log('\nTo test delete functionality:');
      console.log('1. Create an IPAWS alert for an event');
      console.log('2. Click "Save IPAWS Geofence" in the event popup');
      console.log('3. The saved geofence will appear on the map with a red outline');
      console.log('4. Click the geofence polygon to see the popup with delete button');
    }

    // 5. Check frontend mapping
    console.log('\n5️⃣ Frontend geofence rendering:');
    console.log('   File: frontend/src/components/TrafficMap.jsx');
    console.log('   Lines: 916-1001 (Saved IPAWS Geofences rendering)');
    console.log('   Lines: 980-996 (Delete button in popup)');

    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnostic complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pgPool.end();
  }
}

testGeofenceDelete();

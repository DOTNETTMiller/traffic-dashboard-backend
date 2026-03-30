// Test the actual geofence API response structure
const { Pool } = require('pg');

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testGeofenceAPI() {
  console.log('\n🔍 Testing Geofence API Response Structure\n');

  try {
    const result = await pgPool.query(`
      SELECT event_id, geofence_geometry, population, buffer_miles, override_population, created_at, updated_at
      FROM event_geofences
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ No geofences found');
      return;
    }

    console.log('Raw database row:');
    console.log(JSON.stringify(result.rows[0], null, 2));

    // Simulate what the API returns
    const geofences = result.rows.map(row => ({
      eventId: row.event_id,
      geofence: row.geofence_geometry, // Already an object from JSONB
      population: row.population,
      bufferMiles: row.buffer_miles,
      overridePopulation: row.override_population,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    console.log('\n\nAPI Response structure:');
    console.log(JSON.stringify({ success: true, geofences }, null, 2));

    console.log('\n\nChecking coordinates structure:');
    const firstGeofence = geofences[0];
    console.log('geofence:', firstGeofence.geofence ? 'exists' : 'MISSING');
    console.log('geofence.coordinates:', firstGeofence.geofence?.coordinates ? 'exists' : 'MISSING');
    console.log('geofence.coordinates[0]:', firstGeofence.geofence?.coordinates?.[0] ? 'exists' : 'MISSING');
    console.log('Is array?:', Array.isArray(firstGeofence.geofence?.coordinates?.[0]));

    if (firstGeofence.geofence?.coordinates?.[0]) {
      console.log('\nFirst coordinate point:');
      console.log(JSON.stringify(firstGeofence.geofence.coordinates[0][0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pgPool.end();
  }
}

testGeofenceAPI();

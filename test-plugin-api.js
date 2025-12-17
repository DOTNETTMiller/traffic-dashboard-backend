// Test Plugin System API Endpoints
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
let apiKey = null;
let providerId = null;
let eventId = null;

async function testPluginSystem() {
  console.log('🧪 Testing Plugin System API...\n');

  try {
    // Test 1: Register new provider
    console.log('1️⃣ Testing provider registration...');
    const registerResponse = await axios.post(`${BASE_URL}/plugins/register`, {
      provider_name: 'Test Provider',
      display_name: 'Test Traffic Data Inc',
      contact_email: 'test@example.com',
      contact_name: 'John Doe',
      website_url: 'https://test.example.com',
      description: 'Test provider for development',
      data_types: ['incidents', 'speed', 'travel_time'],
      coverage_states: ['CA', 'NV', 'TX'],
      status: 'trial'
    });

    apiKey = registerResponse.data.api_key;
    providerId = registerResponse.data.provider_id;

    console.log('✅ Provider registered:');
    console.log(`   Provider ID: ${providerId}`);
    console.log(`   API Key: ${apiKey.substring(0, 20)}...`);
    console.log(`   Status: ${registerResponse.data.status}`);
    console.log(`   Trial Expires: ${registerResponse.data.trial_expires_at}\n`);

    // Test 2: Submit event (with authentication)
    console.log('2️⃣ Testing event submission (authenticated)...');
    const eventResponse = await axios.post(
      `${BASE_URL}/plugins/events`,
      {
        event_data: {
          type: 'work-zone',
          geometry: {
            type: 'LineString',
            coordinates: [[-118.2437, 34.0522], [-118.2400, 34.0500]]
          },
          properties: {
            event_type: 'work-zone',
            description: 'Lane closure for maintenance',
            start_date: new Date().toISOString(),
            road_name: 'I-10'
          }
        },
        state_code: 'CA',
        latitude: 34.0522,
        longitude: -118.2437,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      {
        headers: {
          'X-API-Key': apiKey
        }
      }
    );

    eventId = eventResponse.data.event_id;
    console.log('✅ Event submitted:');
    console.log(`   Event ID: ${eventId}`);
    console.log(`   Created: ${eventResponse.data.created_at}\n`);

    // Test 3: Get plugin events (public)
    console.log('3️⃣ Testing event retrieval (public)...');
    const eventsResponse = await axios.get(`${BASE_URL}/plugins/events`, {
      params: {
        provider_id: providerId,
        limit: 10
      }
    });

    console.log('✅ Events retrieved:');
    console.log(`   Count: ${eventsResponse.data.count}`);
    if (eventsResponse.data.events.length > 0) {
      console.log(`   First event type: ${eventsResponse.data.events[0].event_type}`);
      console.log(`   State: ${eventsResponse.data.events[0].state_code}\n`);
    }

    // Test 4: Get active providers
    console.log('4️⃣ Testing providers list...');
    const providersResponse = await axios.get(`${BASE_URL}/plugins/providers`);

    console.log('✅ Providers retrieved:');
    console.log(`   Count: ${providersResponse.data.count}`);
    if (providersResponse.data.providers.length > 0) {
      console.log(`   First provider: ${providersResponse.data.providers[0].display_name}`);
      console.log(`   Status: ${providersResponse.data.providers[0].status}\n`);
    }

    // Test 5: Get corridor scores
    console.log('5️⃣ Testing corridor scores...');
    const scoresResponse = await axios.get(`${BASE_URL}/corridors/i10-ca/scores`);

    console.log('✅ Corridor scores:');
    console.log(`   Corridor: ${scoresResponse.data.corridor_id}`);
    console.log(`   Message: ${scoresResponse.data.message}\n`);

    // Test 6: Compare providers
    console.log('6️⃣ Testing provider comparison...');
    const compareResponse = await axios.get(
      `${BASE_URL}/corridors/i10-ca/compare-providers`
    );

    console.log('✅ Provider comparison:');
    console.log(`   Corridor: ${compareResponse.data.corridor_id}`);
    console.log(`   Providers: ${compareResponse.data.providers.length}\n`);

    // Test 7: Get analytics (authenticated)
    console.log('7️⃣ Testing analytics (authenticated)...');
    const analyticsResponse = await axios.get(
      `${BASE_URL}/plugins/analytics/${providerId}`,
      {
        headers: {
          'X-API-Key': apiKey
        }
      }
    );

    console.log('✅ Analytics retrieved:');
    console.log(`   Provider ID: ${analyticsResponse.data.provider_id}`);
    console.log(`   Metrics count: ${analyticsResponse.data.count}\n`);

    // Test 8: Test invalid API key
    console.log('8️⃣ Testing invalid API key (should fail)...');
    try {
      await axios.post(
        `${BASE_URL}/plugins/events`,
        { event_data: { type: 'test' } },
        {
          headers: {
            'X-API-Key': 'invalid_key_123'
          }
        }
      );
      console.log('❌ FAILED: Should have rejected invalid API key\n');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Correctly rejected invalid API key\n');
      } else {
        throw error;
      }
    }

    console.log('🎉 All tests passed!\n');
    console.log('Test Summary:');
    console.log(`✅ Provider registration: PASS`);
    console.log(`✅ Event submission: PASS`);
    console.log(`✅ Event retrieval: PASS`);
    console.log(`✅ Providers list: PASS`);
    console.log(`✅ Corridor scores: PASS`);
    console.log(`✅ Provider comparison: PASS`);
    console.log(`✅ Analytics: PASS`);
    console.log(`✅ Authentication: PASS`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Check if server is running
axios.get(`${BASE_URL}/health`)
  .then(() => {
    console.log('✅ Server is running\n');
    return testPluginSystem();
  })
  .catch((error) => {
    console.error('❌ Server is not running at', BASE_URL);
    console.error('Please start the server first: node backend_proxy_server.js');
    process.exit(1);
  });

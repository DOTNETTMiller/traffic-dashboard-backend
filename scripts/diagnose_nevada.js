#!/usr/bin/env node

/**
 * Diagnose Nevada Data Fetching Issues
 */

const axios = require('axios');

async function diagnose() {
  console.log('🔍 Diagnosing Nevada Data Issue...\n');

  // 1. Check environment variable
  console.log('1️⃣ Checking Railway Environment Variable:');
  const apiKey = process.env.NEVADA_API_KEY;
  if (apiKey) {
    console.log(`   ✅ NEVADA_API_KEY is set (${apiKey.substring(0, 8)}...)\n`);
  } else {
    console.log('   ❌ NEVADA_API_KEY is NOT set locally');
    console.log('   ℹ️  This is expected if running locally - key is on Railway\n');
  }

  // 2. Test the API endpoint format
  console.log('2️⃣ Testing Nevada API Endpoint Format:');
  const url = 'https://www.nvroads.com/api/v2/get/roadconditions';
  console.log(`   URL: ${url}`);
  console.log(`   Auth Method: Query parameter (?key=...)\n`);

  if (apiKey) {
    console.log('3️⃣ Testing with API Key:');
    try {
      const response = await axios.get(url, {
        params: { key: apiKey },
        timeout: 10000
      });

      console.log(`   ✅ SUCCESS! Status: ${response.status}`);
      console.log(`   📊 Records returned: ${Array.isArray(response.data) ? response.data.length : 'Not an array'}`);

      if (Array.isArray(response.data) && response.data.length > 0) {
        const sample = response.data[0];
        console.log(`\n   Sample Event:`);
        console.log(`   - ID: ${sample.id}`);
        console.log(`   - Location: ${sample.location_description?.substring(0, 60)}...`);
        console.log(`   - Category: ${sample.event_category}`);
        console.log(`   - Routes: ${JSON.stringify(sample.routes)}`);
        console.log(`   - Coords: ${sample.start_latitude}, ${sample.start_longitude}`);
      }
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
    }
  }

  // 4. Check what the backend sees
  console.log('\n4️⃣ Checking Backend Configuration:');
  console.log('   Checking if backend can reach Railway API...');

  try {
    const backendUrl = process.env.PORT ?
      `http://localhost:${process.env.PORT}/api/events` :
      'http://localhost:3001/api/events';

    const response = await axios.get(backendUrl, { timeout: 5000 });
    const nevadaEvents = response.data.events?.filter(e =>
      e.state?.toLowerCase().includes('nevada') || e.stateKey === 'nevada'
    );

    console.log(`   ✅ Backend is running`);
    console.log(`   📊 Nevada events found: ${nevadaEvents?.length || 0}`);

    if (nevadaEvents && nevadaEvents.length > 0) {
      console.log(`   ✅ Nevada data IS populating!`);
      console.log(`   Sample: ${nevadaEvents[0].description?.substring(0, 60)}...`);
    } else {
      console.log(`   ❌ No Nevada events found in backend response`);
    }
  } catch (error) {
    console.log(`   ⚠️  Could not connect to backend: ${error.message}`);
    console.log(`   (Backend may not be running locally)`);
  }

  // 5. Recommendations
  console.log('\n📋 Recommendations:');

  if (!apiKey) {
    console.log('   • Verify NEVADA_API_KEY is set on Railway');
    console.log('     Run: railway variables');
  } else {
    console.log('   • Nevada API key is configured ✅');
  }

  console.log('   • Check Railway logs: railway logs --limit 100');
  console.log('   • Search for: "Nevada" or "nvroads"');
  console.log('   • Look for error messages about Nevada API');

  console.log('\n💡 Quick Fixes:');
  console.log('   1. Restart Railway service: railway restart');
  console.log('   2. Check logs immediately after: railway logs --follow');
  console.log('   3. Verify API key is valid at: https://www.nvroads.com/developers/doc');
  console.log('   4. Check if Nevada data appears in frontend after restart\n');
}

diagnose().catch(error => {
  console.error('Diagnostic error:', error);
  process.exit(1);
});

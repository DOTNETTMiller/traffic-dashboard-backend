#!/usr/bin/env node

/**
 * Test Nevada API Connection
 *
 * This script tests the Nevada DOT API to verify:
 * 1. API key is configured
 * 2. API endpoint is accessible
 * 3. Data is returned correctly
 */

const axios = require('axios');

async function testNevadaAPI() {
  console.log('🧪 Testing Nevada DOT API Connection...\n');

  // Check if API key is set
  const apiKey = process.env.NEVADA_API_KEY;

  if (!apiKey) {
    console.log('❌ NEVADA_API_KEY environment variable is not set\n');
    console.log('To fix this:');
    console.log('1. Get an API key from https://www.nvroads.com/developers/doc');
    console.log('2. Set it: export NEVADA_API_KEY=your_key_here');
    console.log('3. Run this script again\n');
    process.exit(1);
  }

  console.log(`✅ API Key is set (length: ${apiKey.length})\n`);

  // Test Road Conditions endpoint
  console.log('📡 Testing Road Conditions endpoint...');
  const roadConditionsUrl = 'https://www.nvroads.com/api/v2/get/roadconditions';

  try {
    const response = await axios.get(roadConditionsUrl, {
      params: { key: apiKey },
      timeout: 10000
    });

    if (response.status === 200) {
      console.log(`✅ Road Conditions API is working!`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Records returned: ${Array.isArray(response.data) ? response.data.length : 'N/A'}`);

      if (Array.isArray(response.data) && response.data.length > 0) {
        const sample = response.data[0];
        console.log(`\n   Sample Record:`);
        console.log(`   - ID: ${sample.id || 'N/A'}`);
        console.log(`   - Description: ${(sample.description || '').substring(0, 80)}...`);
        console.log(`   - Location: ${sample.location_description || 'N/A'}`);
        console.log(`   - Category: ${sample.event_category || 'N/A'}`);
        console.log(`   - Coordinates: ${sample.start_latitude}, ${sample.start_longitude}`);
      }
    }
  } catch (error) {
    console.log('❌ Road Conditions API failed');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data}`);

      if (error.response.status === 403 || error.response.data.includes('Invalid Key')) {
        console.log('\n⚠️  Your API key appears to be invalid or expired');
        console.log('   Please verify at: https://www.nvroads.com/developers/doc');
      }
    } else {
      console.log(`   Error: ${error.message}`);
    }
    process.exit(1);
  }

  // Test Truck Parking endpoint
  console.log('\n📡 Testing Truck Parking endpoint...');
  const truckParkingUrl = 'https://www.nvroads.com/api/v2/get/truckparking';

  try {
    const response = await axios.get(truckParkingUrl, {
      params: { key: apiKey },
      timeout: 10000
    });

    if (response.status === 200) {
      console.log(`✅ Truck Parking API is working!`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Facilities returned: ${Array.isArray(response.data) ? response.data.length : 'N/A'}`);
    }
  } catch (error) {
    console.log('⚠️  Truck Parking API failed (this may be expected if endpoint is unavailable)');
    console.log(`   Error: ${error.response?.status || error.message}`);
  }

  console.log('\n✅ Nevada API test complete!\n');
  console.log('Next steps:');
  console.log('1. Make sure NEVADA_API_KEY is set in your production environment');
  console.log('2. Restart your backend server');
  console.log('3. Nevada data should now populate in the dashboard\n');
}

testNevadaAPI().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

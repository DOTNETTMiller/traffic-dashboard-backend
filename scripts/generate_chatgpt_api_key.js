#!/usr/bin/env node
// Generate API Key for ChatGPT Database Access
// This script generates a secure API key that ChatGPT can use to access the database

const db = require('../database');

async function generateAPIKey() {
  try {
    // Initialize database if needed
    if (db.init) {
      await db.init();
    }

    console.log('\n🔑 Generating API Key for ChatGPT...\n');

    const description = 'ChatGPT API Access - Generated ' + new Date().toISOString();
    const apiKey = db.createAdminToken(description);

    if (!apiKey) {
      console.error('❌ Failed to generate API key');
      process.exit(1);
    }

    console.log('✅ API Key Generated Successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`API Key: ${apiKey}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Store this key securely. It cannot be retrieved again.\n');
    console.log('📝 How to use this key with ChatGPT:\n');
    console.log('1. Go to ChatGPT (https://chat.openai.com)');
    console.log('2. Create a new Custom GPT or use an existing one');
    console.log('3. In the GPT configuration, add these API endpoints:');
    console.log('   - Base URL: https://your-domain.com');
    console.log('   - Authentication: API Key');
    console.log('   - Header Name: X-API-Key');
    console.log(`   - API Key: ${apiKey}\n`);
    console.log('4. Configure the available endpoints (see documentation):\n');
    console.log('   GET /api/chatgpt/events - Get all traffic events');
    console.log('   GET /api/chatgpt/parking/facilities - Get parking facilities');
    console.log('   GET /api/chatgpt/states - Get list of states');
    console.log('   GET /api/chatgpt/docs - Get full API documentation\n');
    console.log('📖 For full documentation, visit:');
    console.log('   https://your-domain.com/api/chatgpt/docs');
    console.log('   (Include the X-API-Key header with your API key)\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating API key:', error);
    process.exit(1);
  }
}

generateAPIKey();

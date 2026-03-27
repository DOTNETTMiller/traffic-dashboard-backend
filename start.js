#!/usr/bin/env node

// Startup wrapper for Railway deployment
// Initializes volume data before starting the server

const { initVolumeData } = require('./scripts/init_volume_data.js');
const { fixTexasAPI } = require('./scripts/fix_texas_api.js');

async function start() {
  try {
    // Initialize volume data first
    initVolumeData();

    // Fix Texas API URL (one-time migration)
    await fixTexasAPI();

    // Start the main server directly (no child process — saves memory)
    console.log('🚀 Starting backend server...\n');
    require('./backend_proxy_server.js');

  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

start();

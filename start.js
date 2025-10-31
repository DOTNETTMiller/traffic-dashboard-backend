#!/usr/bin/env node

// Startup wrapper for Railway deployment
// Initializes volume data before starting the server

const { initVolumeData } = require('./scripts/init_volume_data.js');
const { spawn } = require('child_process');

async function start() {
  try {
    // Initialize volume data first
    initVolumeData();

    // Start the main server
    console.log('🚀 Starting backend server...\n');
    const server = spawn('node', ['backend_proxy_server.js'], {
      stdio: 'inherit',
      shell: true
    });

    server.on('error', (error) => {
      console.error('❌ Server failed to start:', error);
      process.exit(1);
    });

    server.on('exit', (code) => {
      process.exit(code || 0);
    });

  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

start();

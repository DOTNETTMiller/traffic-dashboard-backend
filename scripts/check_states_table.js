#!/usr/bin/env node

/**
 * Check States Table - Diagnostic Script
 *
 * This script checks the states table to see what's populated
 * and why the Feed Submission page might show empty.
 */

const db = require('../database');

async function checkStatesTable() {
  console.log('🔍 Checking States Table...\n');

  try {
    // Initialize database
    await db.init();

    // Get all states without credentials
    console.log('📊 Fetching all states from database...');
    const states = await db.getAllStates(false);

    console.log(`✅ Found ${states.length} states in database\n`);

    if (states.length === 0) {
      console.log('❌ No states found in database!');
      console.log('\n📋 Possible reasons:');
      console.log('   1. Database migrations not run');
      console.log('   2. States not populated after migration');
      console.log('   3. Wrong database being queried\n');
      console.log('💡 Solution:');
      console.log('   Run: node scripts/populate_states_postgres.js');
      return;
    }

    // Display states in a nice table
    console.log('State Key          | State Name                          | API Type     | Format | Enabled');
    console.log('-------------------|-------------------------------------|--------------|--------|--------');

    states.forEach(state => {
      const stateKey = (state.stateKey || '').padEnd(18);
      const stateName = (state.stateName || '').padEnd(35).substring(0, 35);
      const apiType = (state.apiType || 'N/A').padEnd(12);
      const format = (state.format || 'N/A').padEnd(6);
      const enabled = state.enabled ? '✅' : '❌';

      console.log(`${stateKey} | ${stateName} | ${apiType} | ${format} | ${enabled}`);
    });

    console.log(`\n📈 Statistics:`);
    console.log(`   Total: ${states.length}`);
    console.log(`   Enabled: ${states.filter(s => s.enabled).length}`);
    console.log(`   Disabled: ${states.filter(s => !s.enabled).length}`);

    // Group by API type
    const byApiType = states.reduce((acc, state) => {
      const type = state.apiType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📡 By API Type:');
    Object.entries(byApiType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });

    // Group by format
    const byFormat = states.reduce((acc, state) => {
      const format = state.format || 'Unknown';
      acc[format] = (acc[format] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📄 By Format:');
    Object.entries(byFormat)
      .sort((a, b) => b[1] - a[1])
      .forEach(([format, count]) => {
        console.log(`   ${format}: ${count}`);
      });

    console.log('\n✅ States table looks good!');
    console.log('   If Feed Submission page shows empty, check:');
    console.log('   1. Browser console for errors');
    console.log('   2. Network tab for /api/states/list response');
    console.log('   3. Backend logs for API errors\n');

  } catch (error) {
    console.error('❌ Error checking states table:', error);
    console.error('\n💡 This might indicate:');
    console.error('   - Database connection issue');
    console.error('   - Database not initialized');
    console.error('   - getAllStates method not working\n');
  } finally {
    process.exit(0);
  }
}

checkStatesTable();

#!/usr/bin/env node

/**
 * Filter out events with invalid geometries (2-point LineStrings, missing coords, etc.)
 * This runs on the in-memory event cache to fix production issues
 */

const axios = require('axios');

const API_BASE = process.env.API_BASE || 'https://corridor-communication-dashboard-production.up.railway.app';

async function analyzeAndFixGeometries() {
  console.log('🔍 Analyzing event geometries for issues...\n');

  try {
    // Fetch all events from API
    const response = await axios.get(`${API_BASE}/api/traffic/all-events`);
    const events = response.data;

    console.log(`📊 Total events: ${events.length}\n`);

    let invalidCount = 0;
    let twoPointCount = 0;
    let missingGeomCount = 0;
    let validCount = 0;

    const problematicEvents = [];

    for (const event of events) {
      const geom = event.geometry;

      // Check if geometry is missing
      if (!geom || !geom.coordinates) {
        missingGeomCount++;
        problematicEvents.push({
          id: event.id,
          state: event.state_key || event.stateKey,
          headline: event.headline?.substring(0, 60),
          issue: 'Missing geometry or coordinates'
        });
        continue;
      }

      // Check for 2-point LineStrings
      if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
        if (geom.coordinates.length === 2) {
          twoPointCount++;
          problematicEvents.push({
            id: event.id,
            state: event.state_key || event.stateKey,
            headline: event.headline?.substring(0, 60),
            issue: `2-point LineString (${JSON.stringify(geom.coordinates)})`
          });
          continue;
        }

        if (geom.coordinates.length < 2) {
          invalidCount++;
          problematicEvents.push({
            id: event.id,
            state: event.state_key || event.stateKey,
            headline: event.headline?.substring(0, 60),
            issue: `Invalid LineString with ${geom.coordinates.length} point(s)`
          });
          continue;
        }
      }

      validCount++;
    }

    console.log('📈 Analysis Results:');
    console.log(`  ✅ Valid geometries: ${validCount}`);
    console.log(`  ⚠️  2-point LineStrings: ${twoPointCount}`);
    console.log(`  ❌ Missing geometry: ${missingGeomCount}`);
    console.log(`  ❌ Invalid geometry: ${invalidCount}`);
    console.log(`  Total problematic: ${problematicEvents.length}\n`);

    if (problematicEvents.length > 0) {
      console.log('🔥 Problematic Events:\n');
      problematicEvents.slice(0, 20).forEach((event, i) => {
        console.log(`${i + 1}. ID: ${event.id}`);
        console.log(`   State: ${event.state}`);
        console.log(`   Headline: ${event.headline}...`);
        console.log(`   Issue: ${event.issue}`);
        console.log('');
      });

      if (problematicEvents.length > 20) {
        console.log(`... and ${problematicEvents.length - 20} more\n`);
      }

      console.log('\n💡 Recommended Actions:');
      console.log('1. These events need geometry fixes from their source feeds');
      console.log('2. Update backend to filter out 2-point LineStrings');
      console.log('3. Convert 2-point LineStrings to Point geometries');
      console.log('4. Add validation before displaying events\n');
    } else {
      console.log('✅ All geometries are valid!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

analyzeAndFixGeometries();

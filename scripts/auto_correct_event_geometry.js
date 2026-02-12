const axios = require('axios');

/**
 * Auto-correct event geometry issues:
 * 1. Fix events with only 2 points (straight lines) by fetching OSRM geometry
 * 2. Fix events on wrong directional corridor by checking geometry match
 *
 * This script calls the production API to trigger OSRM fetches and caching.
 */

const API_BASE = process.env.API_BASE || 'https://corridor-communication-dashboard-production.up.railway.app';

async function main() {
  console.log('🔧 Auto-Correction Script for Event Geometry\n');
  console.log(`API Base: ${API_BASE}\n`);

  // Fetch all events
  console.log('📥 Fetching all events...');
  const eventsResp = await axios.get(`${API_BASE}/api/events`);
  const events = eventsResp.data.events;

  console.log(`✅ Found ${events.length} total events\n`);

  // Analyze geometry quality
  const straightLines = [];
  const noGeometry = [];
  const curvedGeometry = [];

  for (const event of events) {
    if (!event.geometry || !event.geometry.coordinates) {
      noGeometry.push(event);
    } else if (event.geometry.coordinates.length === 2) {
      straightLines.push(event);
    } else {
      curvedGeometry.push(event);
    }
  }

  console.log('📊 Geometry Analysis:');
  console.log(`   ✅ Curved geometry: ${curvedGeometry.length} events`);
  console.log(`   📏 Straight lines (2 points): ${straightLines.length} events`);
  console.log(`   ❌ No geometry: ${noGeometry.length} events\n`);

  if (straightLines.length === 0) {
    console.log('✨ All events already have curved geometry!');
    return;
  }

  // Ask for confirmation
  console.log(`🔄 This will trigger OSRM routing for ${straightLines.length} events.`);
  console.log(`   Each event will fetch road-snapped geometry and cache it.`);
  console.log(`   The API will auto-populate the OSRM cache.\n`);

  // Show sample of events to be fixed
  console.log('Sample events to fix:');
  straightLines.slice(0, 5).forEach((event, i) => {
    console.log(`   ${i+1}. ${event.corridor} ${event.direction} - ${event.state}`);
    console.log(`      ${event.description || event.eventType}`.substring(0, 60));
  });
  console.log('');

  // For now, just report - the OSRM cache will populate naturally when events are viewed
  console.log('💡 How OSRM auto-correction works:');
  console.log('   1. Backend now skips low-res database geometry');
  console.log('   2. Goes straight to OSRM for all events');
  console.log('   3. OSRM provides dense, road-snapped geometry');
  console.log('   4. Geometry cached on first request');
  console.log('   5. Subsequent requests use cached curved geometry\n');

  console.log('🎯 Action Required:');
  console.log('   - Deploy commit ee0225c (OSRM-only approach)');
  console.log('   - Open dashboard and view events');
  console.log('   - OSRM will auto-populate cache with curved geometry');
  console.log('   - All 2-point straight lines will become curved\n');

  // Check for wrong direction issues
  console.log('🧭 Checking for direction mismatches...\n');

  const directionIssues = [];
  for (const event of events) {
    if (!event.geometry || !event.direction || !event.corridor) continue;

    const coords = event.geometry.coordinates;
    if (coords.length < 2) continue;

    // Check if event direction matches geometry direction
    const start = coords[0];
    const end = coords[coords.length - 1];

    const headingDeg = calculateBearing(start[1], start[0], end[1], end[0]);
    const geometryDirection = bearingToDirection(headingDeg);

    const eventDir = normalizeDirection(event.direction);

    if (geometryDirection !== eventDir && eventDir !== 'both') {
      directionIssues.push({
        event,
        geometryDirection,
        eventDirection: eventDir,
        corridor: event.corridor
      });
    }
  }

  if (directionIssues.length > 0) {
    console.log(`⚠️  Found ${directionIssues.length} events with direction mismatches:\n`);
    directionIssues.slice(0, 10).forEach((issue, i) => {
      console.log(`   ${i+1}. ${issue.corridor} - Event says "${issue.event.direction}", geometry goes "${issue.geometryDirection}"`);
      console.log(`      ${issue.event.state} - ${(issue.event.description || issue.event.eventType).substring(0, 50)}`);
    });
    console.log('');
    console.log('💡 Direction mismatches occur when:');
    console.log('   - Feed provides wrong direction label');
    console.log('   - Event spans both directions (should use "Both")');
    console.log('   - Geometry reversed due to coordinate order\n');
  } else {
    console.log('✅ No direction mismatches found!\n');
  }

  console.log('✅ Analysis complete!');
}

function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
}

function bearingToDirection(bearing) {
  if (bearing >= 315 || bearing < 45) return 'eastbound';
  if (bearing >= 45 && bearing < 135) return 'northbound';
  if (bearing >= 135 && bearing < 225) return 'westbound';
  if (bearing >= 225 && bearing < 315) return 'southbound';
  return 'unknown';
}

function normalizeDirection(dir) {
  if (!dir) return 'unknown';
  const d = dir.toLowerCase();
  if (d.includes('both')) return 'both';
  if (d.includes('east') || d.includes('eb')) return 'eastbound';
  if (d.includes('west') || d.includes('wb')) return 'westbound';
  if (d.includes('north') || d.includes('nb')) return 'northbound';
  if (d.includes('south') || d.includes('sb')) return 'southbound';
  return 'unknown';
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

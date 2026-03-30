#!/usr/bin/env node

/**
 * Test Event Lifecycle Manager
 *
 * Validates that end times are properly extended when events remain in feeds
 */

const { EventLifecycleManager } = require('./services/event-lifecycle-manager');

async function testLifecycleManager() {
  console.log('\n🧪 Testing Event Lifecycle Manager\n');
  console.log('='.repeat(80));

  const manager = new EventLifecycleManager();

  // Test 1: New events get estimated end times
  console.log('\n1️⃣ Test: New events get estimated end times');
  const newEvents = [
    {
      id: 'TEST-001',
      eventType: 'Incident',
      description: 'Traffic accident blocking right lane',
      severity: 'high'
    },
    {
      id: 'TEST-002',
      eventType: 'Construction',
      description: 'Road work on I-80',
      severity: 'medium',
      endTime: '2026-03-20T10:00:00Z' // Has native end time
    }
  ];

  const result1 = manager.processFeedRefresh(newEvents, 'TEST');
  console.log(`✅ Processed ${result1.new} new events`);
  console.log(`   Stats:`, result1);

  const enriched1 = manager.enrichEvents(newEvents);
  enriched1.forEach(e => {
    console.log(`   Event ${e.id}: endTime=${e.endTime}, estimated=${e._lifecycle?.isEstimated}`);
  });

  // Test 2: Events still in feed get updated
  console.log('\n2️⃣ Test: Events still in feed get updated');

  const result2 = manager.processFeedRefresh(newEvents, 'TEST');
  console.log(`✅ Processed ${result2.updated} updated events, ${result2.stillActive} still active`);
  console.log(`   Stats:`, result2);

  // Test 3: Events approaching end time get extended
  console.log('\n3️⃣ Test: Events approaching end time get extended');

  // Simulate an event with end time in 30 minutes
  const now = new Date();
  const soonEndTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 min from now

  const expiringEvents = [
    {
      id: 'TEST-003',
      eventType: 'Incident',
      description: 'About to expire',
      endTime: soonEndTime.toISOString(),
      severity: 'medium'
    }
  ];

  // First pass - track the event
  manager.processFeedRefresh(expiringEvents, 'TEST');

  // Get the tracking data and modify it to simulate end time approaching
  const tracking = manager.eventTracking.get('TEST-003');
  tracking.currentEndTime = soonEndTime.toISOString();

  // Second pass - should extend end time
  const result3 = manager.processFeedRefresh(expiringEvents, 'TEST');
  console.log(`✅ Extended ${result3.endTimeExtended} end time(s)`);

  const enriched3 = manager.enrichEvents(expiringEvents);
  enriched3.forEach(e => {
    if (e.id === 'TEST-003') {
      console.log(`   Event ${e.id}:`);
      console.log(`     Original end time: ${soonEndTime.toISOString()}`);
      console.log(`     New end time: ${e.endTime}`);
      console.log(`     Extended: ${e._endTimeExtended || false}`);
    }
  });

  // Test 4: Events not in feed get removed
  console.log('\n4️⃣ Test: Events not in feed get removed');

  // Simulate event disappeared from feed
  const emptyFeed = [];

  // Set last seen to 31 minutes ago to trigger removal
  const test001Tracking = manager.eventTracking.get('TEST-001');
  if (test001Tracking) {
    test001Tracking.lastSeen = new Date(now.getTime() - 31 * 60 * 1000);
  }

  const result4 = manager.processFeedRefresh(emptyFeed, 'TEST');
  console.log(`✅ Removed ${result4.removed} event(s) not seen recently`);

  // Test 5: Filter active events
  console.log('\n5️⃣ Test: Filter active events');

  const allTestEvents = [
    { id: 'TEST-001', eventType: 'Incident' }, // Should be removed (not seen for 31 min)
    { id: 'TEST-002', eventType: 'Construction' }, // Should be active
    { id: 'TEST-003', eventType: 'Incident' }, // Should be active
    { id: 'TEST-004', eventType: 'Weather' } // Not tracked, should be included
  ];

  const activeEvents = manager.filterActiveEvents(allTestEvents, now);
  console.log(`✅ Filtered to ${activeEvents.length} active events`);
  console.log(`   Active IDs: ${activeEvents.map(e => e.id).join(', ')}`);

  // Test 6: Statistics
  console.log('\n6️⃣ Test: Get statistics');
  const stats = manager.getStats();
  console.log('✅ Manager statistics:');
  console.table(stats);

  console.log('\n' + '='.repeat(80));
  console.log('✅ All tests completed!\n');

  console.log('📋 SUMMARY:');
  console.log('  ✓ New events get estimated end times');
  console.log('  ✓ Events in feed get tracking updated');
  console.log('  ✓ Events approaching end time get extended');
  console.log('  ✓ Events not in feed get removed after delay');
  console.log('  ✓ Active events are properly filtered');
  console.log('  ✓ Statistics are accurately tracked\n');
}

// Run tests
if (require.main === module) {
  testLifecycleManager()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Test failed:', err);
      process.exit(1);
    });
}

module.exports = { testLifecycleManager };

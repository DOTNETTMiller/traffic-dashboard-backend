#!/usr/bin/env node

/**
 * Test ARNOLD Enrichment Across Multiple States
 *
 * Tests segment stitching and enrichment for various Interstate corridors
 */

const arnoldService = require('./services/arnold-geometry-service');

// Sample 2-point events from various states
const testEvents = [
  {
    id: 'test-ut-i15',
    state: 'Utah',
    corridor: 'I-15',
    direction: 'Both',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-111.948756, 41.196646],  // Near Brigham City
        [-111.950000, 41.350000]   // North of Brigham City
      ]
    }
  },
  {
    id: 'test-ut-i80',
    state: 'Utah',
    corridor: 'I-80',
    direction: 'Westbound',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-111.900000, 40.750000],  // Near Salt Lake City
        [-112.050000, 40.750000]   // West of Salt Lake City
      ]
    }
  },
  {
    id: 'test-tx-i35',
    state: 'Texas',
    corridor: 'I-35',
    direction: 'Northbound',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-97.740000, 30.270000],  // Austin
        [-97.740000, 30.380000]   // North Austin
      ]
    }
  },
  {
    id: 'test-ca-i5',
    state: 'California',
    corridor: 'I-5',
    direction: 'Southbound',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.490000, 38.580000],  // Sacramento
        [-121.490000, 38.480000]   // South Sacramento
      ]
    }
  }
];

async function testArnoldEnrichment() {
  console.log('🧪 Testing ARNOLD Enrichment Across States\n');
  console.log('=' .repeat(80));

  const stateMap = {
    'Utah': 'ut',
    'Texas': 'tx',
    'California': 'ca'
  };

  for (const event of testEvents) {
    console.log(`\n📍 Testing: ${event.state} ${event.corridor} ${event.direction}`);
    console.log(`   Original: 2-point geometry`);

    try {
      const enriched = await arnoldService.enrichEventGeometry(event, stateMap[event.state]);

      if (enriched.geometry_source === 'FHWA ARNOLD') {
        const originalPoints = event.geometry.coordinates.length;
        const enrichedPoints = enriched.geometry.coordinates.length;
        console.log(`   ✅ SUCCESS: Enriched from ${originalPoints} to ${enrichedPoints} points`);
        console.log(`   📊 Geometry Source: ${enriched.geometry_source}`);
      } else if (enriched.geometry_source === 'Original Feed Geometry (offset)') {
        console.log(`   ⚠️  ARNOLD not available - Applied bidirectional offset`);
        console.log(`   📊 Geometry Source: ${enriched.geometry_source}`);
      } else {
        console.log(`   ℹ️  No enrichment - Geometry unchanged`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Test complete!\n');
}

if (require.main === module) {
  testArnoldEnrichment();
}

module.exports = { testArnoldEnrichment };

// Populate sample bridge and route restrictions for testing CV-TIM
// Run: node scripts/populate_sample_restrictions.js

const db = require('../database');

async function populateSampleRestrictions() {
  console.log('🌉 Populating sample bridge and route restrictions...\n');

  // Sample bridge restrictions (real-world examples)
  const bridges = [
    {
      bridgeId: 'I-80-CA-BAYBRIDGE',
      bridgeName: 'San Francisco-Oakland Bay Bridge',
      state: 'CA',
      corridor: 'I-80',
      milepost: 1.5,
      latitude: 37.8024,
      longitude: -122.3751,
      weightLimitKg: 36287, // 80,000 lbs
      heightLimitCm: 488, // 16 feet
      clearanceFeet: 16.0,
      restrictionNotes: 'Oversized vehicles require permit, no hazmat'
    },
    {
      bridgeId: 'I-35-TX-GUADALUPE',
      bridgeName: 'Guadalupe River Bridge',
      state: 'TX',
      corridor: 'I-35',
      milepost: 204.5,
      latitude: 29.7033,
      longitude: -97.8825,
      weightLimitKg: 34019, // 75,000 lbs (posted restriction)
      heightLimitCm: 427, // 14 feet
      clearanceFeet: 14.0,
      restrictionNotes: 'Weight restriction due to bridge condition'
    },
    {
      bridgeId: 'I-80-NE-PLATTE',
      bridgeName: 'North Platte River Bridge',
      state: 'NE',
      corridor: 'I-80',
      milepost: 126.8,
      latitude: 41.1375,
      longitude: -100.7647,
      weightLimitKg: 36287, // 80,000 lbs
      heightLimitCm: 518, // 17 feet
      clearanceFeet: 17.0,
      restrictionNotes: 'Standard clearance'
    },
    {
      bridgeId: 'I-10-TX-PECOS',
      bridgeName: 'Pecos River High Bridge',
      state: 'TX',
      corridor: 'I-10',
      milepost: 273.0,
      latitude: 30.3605,
      longitude: -101.6872,
      weightLimitKg: 36287, // 80,000 lbs
      heightLimitCm: 457, // 15 feet
      clearanceFeet: 15.0,
      restrictionNotes: 'High winds common, check conditions'
    },
    {
      bridgeId: 'I-90-NY-TAPPANZEE',
      bridgeName: 'Mario M. Cuomo Bridge (Tappan Zee)',
      state: 'NY',
      corridor: 'I-87',
      milepost: 11.0,
      latitude: 41.0731,
      longitude: -73.8842,
      weightLimitKg: 36287, // 80,000 lbs
      heightLimitCm: 488, // 16 feet
      clearanceFeet: 16.0,
      restrictionNotes: 'Oversized loads require Port Authority permit'
    }
  ];

  console.log(`Adding ${bridges.length} sample bridge restrictions...`);
  let bridgeCount = 0;
  for (const bridge of bridges) {
    const result = await db.addBridgeRestriction(bridge);
    if (result.success) {
      bridgeCount++;
      console.log(`  ✅ ${bridge.bridgeName} - ${bridge.state} ${bridge.corridor}`);
    } else {
      console.log(`  ❌ Failed: ${bridge.bridgeName} - ${result.error}`);
    }
  }

  // Sample route restrictions
  const routes = [
    {
      restrictionId: 'I-80-CA-TRUCKEE-LENGTH',
      state: 'CA',
      corridor: 'I-80',
      milepostStart: 180.0,
      milepostEnd: 195.0,
      latitude: 39.3276,
      longitude: -120.1833,
      restrictionType: 'length',
      lengthLimitCm: 1981, // 65 feet (mountain curves)
      weightLimitKg: null,
      heightLimitCm: null,
      hazmatRestricted: false,
      oversizeRestricted: true,
      restrictionNotes: 'Tight curves in Truckee area, 65ft length limit'
    },
    {
      restrictionId: 'I-70-CO-EISENHOWER-HAZMAT',
      state: 'CO',
      corridor: 'I-70',
      milepostStart: 205.0,
      milepostEnd: 218.0,
      latitude: 39.6785,
      longitude: -105.9286,
      restrictionType: 'hazmat',
      lengthLimitCm: null,
      weightLimitKg: null,
      heightLimitCm: null,
      hazmatRestricted: true,
      oversizeRestricted: false,
      restrictionNotes: 'Eisenhower Tunnel - Hazmat prohibited, must use US-6'
    },
    {
      restrictionId: 'I-15-UT-PARLEYS-HEIGHT',
      state: 'UT',
      corridor: 'I-80',
      milepostStart: 128.0,
      milepostEnd: 134.0,
      latitude: 40.6966,
      longitude: -111.6355,
      restrictionType: 'height',
      lengthLimitCm: null,
      weightLimitKg: null,
      heightLimitCm: 411, // 13.5 feet (Parley's Canyon)
      hazmatRestricted: false,
      oversizeRestricted: true,
      restrictionNotes: 'Parley\'s Canyon tunnels - 13\'6" clearance'
    },
    {
      restrictionId: 'I-35-TX-AUSTIN-WEIGHT',
      state: 'TX',
      corridor: 'I-35',
      milepostStart: 230.0,
      milepostEnd: 240.0,
      latitude: 30.2672,
      longitude: -97.7431,
      restrictionType: 'weight',
      lengthLimitCm: null,
      weightLimitKg: 32658, // 72,000 lbs (temporary restriction)
      heightLimitCm: null,
      hazmatRestricted: false,
      oversizeRestricted: false,
      restrictionNotes: 'Construction-related weight restriction through Austin'
    },
    {
      restrictionId: 'I-10-TX-ELPASO-OVERSIZE',
      state: 'TX',
      corridor: 'I-10',
      milepostStart: 20.0,
      milepostEnd: 30.0,
      latitude: 31.7619,
      longitude: -106.4850,
      restrictionType: 'oversize',
      lengthLimitCm: 2134, // 70 feet
      weightLimitKg: 36287, // 80,000 lbs
      heightLimitCm: 427, // 14 feet
      hazmatRestricted: false,
      oversizeRestricted: true,
      restrictionNotes: 'El Paso downtown - tight ramps, oversize requires routing'
    }
  ];

  console.log(`\nAdding ${routes.length} sample route restrictions...`);
  let routeCount = 0;
  for (const route of routes) {
    const result = await db.addRouteRestriction(route);
    if (result.success) {
      routeCount++;
      console.log(`  ✅ ${route.corridor} ${route.restrictionType} - ${route.state}`);
    } else {
      console.log(`  ❌ Failed: ${route.restrictionId} - ${result.error}`);
    }
  }

  console.log(`\n✅ Sample data populated successfully!`);
  console.log(`   Bridges: ${bridgeCount}/${bridges.length}`);
  console.log(`   Routes: ${routeCount}/${routes.length}`);
  console.log(`\n📊 Test by running:`);
  console.log(`   curl http://localhost:5020/api/convert/tim-cv | jq '.messages[0].commercialVehicle.restrictions'`);
}

// Run if called directly
if (require.main === module) {
  populateSampleRestrictions()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { populateSampleRestrictions };

/**
 * Populate WZDx Feed Sources
 *
 * Populates the wzdx_feed_sources table with known state DOT WZDx feeds
 * from the USDOT WZDx Feed Registry.
 *
 * Source: https://github.com/usdot-jpo-ode/wzdx/blob/main/feed-registry/
 */

const db = require('../database');

// Known WZDx v4.2 compatible feeds from state DOTs
// This list is based on the USDOT WZDx Feed Registry
const WZDX_FEEDS = [
  // Iowa DOT
  {
    feed_url: 'https://data.iowadot.gov/datasets/iowa::work-zone-traveler-information-map-wz-tim/api',
    feed_name: 'Iowa Work Zone TIM',
    organization_name: 'Iowa Department of Transportation',
    state_code: 'IA',
    wzdx_version: '4.2',
    update_frequency: 300, // 5 minutes
    active: 1,
    auto_update: 1
  },

  // Colorado DOT
  {
    feed_url: 'https://data.colorado.gov/resource/4g7d-xyh8.json',
    feed_name: 'Colorado Road Conditions',
    organization_name: 'Colorado Department of Transportation',
    state_code: 'CO',
    wzdx_version: '4.2',
    update_frequency: 300,
    active: 1,
    auto_update: 1
  },

  // Minnesota DOT
  {
    feed_url: 'https://www.dot.state.mn.us/tmc/trafficinfo/wzdx/wzdx.json',
    feed_name: 'Minnesota Work Zones',
    organization_name: 'Minnesota Department of Transportation',
    state_code: 'MN',
    wzdx_version: '4.2',
    update_frequency: 300,
    active: 1,
    auto_update: 1
  },

  // Massachusetts DOT
  {
    feed_url: 'https://api.mass.gov/traffic/workzones/v1',
    feed_name: 'MassDOT Work Zones',
    organization_name: 'Massachusetts Department of Transportation',
    state_code: 'MA',
    wzdx_version: '4.2',
    update_frequency: 300,
    active: 1,
    auto_update: 1
  },

  // Utah DOT
  {
    feed_url: 'https://udot.iteris-pems.com/wzdx/wzdx.json',
    feed_name: 'UDOT Work Zones',
    organization_name: 'Utah Department of Transportation',
    state_code: 'UT',
    wzdx_version: '4.2',
    update_frequency: 300,
    active: 1,
    auto_update: 1
  },

  // Kentucky Transportation Cabinet
  {
    feed_url: 'https://transportation.ky.gov/DistrictOne/OpenData/wzdx.json',
    feed_name: 'KYTC District 1 Work Zones',
    organization_name: 'Kentucky Transportation Cabinet',
    state_code: 'KY',
    wzdx_version: '4.2',
    update_frequency: 300,
    active: 1,
    auto_update: 1
  },

  // Michigan DOT
  {
    feed_url: 'https://mdotapi.state.mi.us/wzdx/v1/WorkZones',
    feed_name: 'Michigan Work Zones',
    organization_name: 'Michigan Department of Transportation',
    state_code: 'MI',
    wzdx_version: '4.2',
    update_frequency: 300,
    active: 1,
    auto_update: 1
  },

  // Florida DOT
  {
    feed_url: 'https://www.fl511.com/wzdx/wzdx.json',
    feed_name: 'Florida 511 Work Zones',
    organization_name: 'Florida Department of Transportation',
    state_code: 'FL',
    wzdx_version: '4.2',
    update_frequency: 300,
    active: 1,
    auto_update: 1
  },

  // Pennsylvania DOT
  {
    feed_url: 'https://www.511pa.com/wzdx/pa511.json',
    feed_name: 'Pennsylvania 511 Work Zones',
    organization_name: 'Pennsylvania Department of Transportation',
    state_code: 'PA',
    wzdx_version: '4.2',
    update_frequency: 300,
    active: 1,
    auto_update: 1
  },

  // Ohio DOT
  {
    feed_url: 'https://publicapi.ohgo.com/api/v1/wzdx',
    feed_name: 'OHGO Work Zones',
    organization_name: 'Ohio Department of Transportation',
    state_code: 'OH',
    wzdx_version: '4.2',
    update_frequency: 300,
    active: 1,
    auto_update: 1
  },

  // Oregon DOT
  {
    feed_url: 'https://www.tripcheck.com/api/wzdx/WorkZones',
    feed_name: 'TripCheck Work Zones',
    organization_name: 'Oregon Department of Transportation',
    state_code: 'OR',
    wzdx_version: '4.2',
    update_frequency: 300,
    active: 1,
    auto_update: 1
  },

  // Washington State DOT
  {
    feed_url: 'https://data.wsdot.wa.gov/workzone/wzdx.json',
    feed_name: 'WSDOT Work Zones',
    organization_name: 'Washington State Department of Transportation',
    state_code: 'WA',
    wzdx_version: '4.2',
    update_frequency: 300,
    active: 1,
    auto_update: 1
  }
];

async function populateWZDxFeeds() {
  console.log('Populating WZDx feed sources...\n');

  try {
    let inserted = 0;
    let skipped = 0;

    for (const feed of WZDX_FEEDS) {
      try {
        // Check if feed already exists
        const existing = await db.db.prepare(`
          SELECT id FROM wzdx_feed_sources WHERE feed_url = ?
        `).get(feed.feed_url);

        if (existing) {
          console.log(`⏭️  Skipped: ${feed.feed_name} (already exists)`);
          skipped++;
          continue;
        }

        // Insert feed
        await db.runAsync(`
          INSERT INTO wzdx_feed_sources (
            feed_url, feed_name, organization_name, state_code,
            wzdx_version, update_frequency, active, auto_update
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          feed.feed_url,
          feed.feed_name,
          feed.organization_name,
          feed.state_code,
          feed.wzdx_version,
          feed.update_frequency,
          feed.active,
          feed.auto_update
        ]);

        console.log(`✓ Added: ${feed.feed_name} (${feed.state_code})`);
        inserted++;
      } catch (error) {
        console.error(`❌ Error adding ${feed.feed_name}:`, error.message);
      }
    }

    console.log(`\n✅ Population complete!`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total sources: ${inserted + skipped}`);

    // Display summary
    const sources = await db.db.prepare(`
      SELECT COUNT(*) as count FROM wzdx_feed_sources
    `).get();

    const activeCount = await db.db.prepare(`
      SELECT COUNT(*) as count FROM wzdx_feed_sources WHERE active = 1
    `).get();

    const states = await db.db.prepare(`
      SELECT DISTINCT state_code FROM wzdx_feed_sources ORDER BY state_code
    `).all();

    console.log(`\n📊 WZDx Feed Registry Summary:`);
    console.log(`   Total feeds: ${sources.count}`);
    console.log(`   Active feeds: ${activeCount.count}`);
    console.log(`   States covered: ${states.map(s => s.state_code).join(', ')}`);

  } catch (error) {
    console.error('❌ Error populating WZDx feeds:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  populateWZDxFeeds()
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { populateWZDxFeeds, WZDX_FEEDS };

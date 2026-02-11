/**
 * Inspect FEU-G Iowa feed to identify all available fields
 * Particularly looking for route-designator, link-direction, link-alignment, linear-reference
 */

const https = require('https');
const xml2js = require('xml2js');

const IOWA_FEED_URL = 'https://ia.carsprogram.org/hub/data/feu-g.xml';

// Load credentials from environment
const username = process.env.CARS_USERNAME;
const password = process.env.CARS_PASSWORD;

if (!username || !password) {
  console.log('❌ Missing CARS_USERNAME or CARS_PASSWORD environment variables');
  console.log('Set these to access the Iowa FEU-G feed');
  process.exit(1);
}

async function fetchFeed() {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    const options = {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    };

    https.get(IOWA_FEED_URL, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  console.log('📡 Fetching Iowa FEU-G feed...\n');

  try {
    const xmlData = await fetchFeed();

    console.log('✅ Feed fetched successfully\n');
    console.log('📊 Parsing XML...\n');

    const parser = new xml2js.Parser({ explicitArray: true, mergeAttrs: false });
    const result = await parser.parseStringPromise(xmlData);

    const updates = result.FEUMessages?.['feu:full-event-update'];

    if (!updates || updates.length === 0) {
      console.log('❌ No FEU updates found');
      return;
    }

    console.log(`Found ${updates.length} FEU updates\n`);
    console.log('=' . repeat(80));
    console.log('Inspecting first event for FEU-G location fields:\n');

    const firstEvent = updates[0];
    const detail = firstEvent.details?.[0]?.detail?.[0];
    const locations = detail?.locations?.[0];
    const locationOnLink = locations?.location?.[0]?.['location-on-link']?.[0];

    if (!locationOnLink) {
      console.log('❌ No location-on-link found in first event');
      return;
    }

    console.log('📍 Location-on-Link Structure:');
    console.log(JSON.stringify(locationOnLink, null, 2));
    console.log('\n' + '='.repeat(80));

    // Extract and display key fields
    const routeDesignator = locationOnLink['route-designator']?.[0];
    const linkDirection = locationOnLink['link-direction']?.[0];
    const linkAlignment = locationOnLink['link-alignment']?.[0];
    const primaryLocation = locationOnLink['primary-location']?.[0];
    const linearReference = primaryLocation?.['linear-reference']?.[0];
    const geoLocation = primaryLocation?.['geo-location']?.[0];

    console.log('\n🔍 Extracted FEU-G Fields:\n');
    console.log(`route-designator: ${routeDesignator || 'NOT FOUND'}`);
    console.log(`link-direction: ${linkDirection || 'NOT FOUND'}`);
    console.log(`link-alignment: ${linkAlignment || 'NOT FOUND'}`);
    console.log(`linear-reference (mile marker): ${linearReference || 'NOT FOUND'}`);

    if (geoLocation) {
      const lat = parseInt(geoLocation.latitude?.[0]) / 1000000;
      const lng = parseInt(geoLocation.longitude?.[0]) / 1000000;
      console.log(`geo-location: ${lat}, ${lng}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 Field availability across all events:\n');

    let stats = {
      total: updates.length,
      hasRouteDesignator: 0,
      hasLinkDirection: 0,
      hasLinkAlignment: 0,
      hasLinearReference: 0,
      linkDirectionValues: {},
      linkAlignmentValues: {},
      routeDesignatorValues: {}
    };

    updates.forEach((update, idx) => {
      const detail = update.details?.[0]?.detail?.[0];
      const locations = detail?.locations?.[0];
      const locationOnLink = locations?.location?.[0]?.['location-on-link']?.[0];

      if (!locationOnLink) return;

      const route = locationOnLink['route-designator']?.[0];
      const direction = locationOnLink['link-direction']?.[0];
      const alignment = locationOnLink['link-alignment']?.[0];
      const linear = locationOnLink['primary-location']?.[0]?.['linear-reference']?.[0];

      if (route) {
        stats.hasRouteDesignator++;
        stats.routeDesignatorValues[route] = (stats.routeDesignatorValues[route] || 0) + 1;
      }
      if (direction) {
        stats.hasLinkDirection++;
        stats.linkDirectionValues[direction] = (stats.linkDirectionValues[direction] || 0) + 1;
      }
      if (alignment) {
        stats.hasLinkAlignment++;
        stats.linkAlignmentValues[alignment] = (stats.linkAlignmentValues[alignment] || 0) + 1;
      }
      if (linear) {
        stats.hasLinearReference++;
      }
    });

    console.log(`Total events: ${stats.total}`);
    console.log(`Events with route-designator: ${stats.hasRouteDesignator} (${(stats.hasRouteDesignator / stats.total * 100).toFixed(1)}%)`);
    console.log(`Events with link-direction: ${stats.hasLinkDirection} (${(stats.hasLinkDirection / stats.total * 100).toFixed(1)}%)`);
    console.log(`Events with link-alignment: ${stats.hasLinkAlignment} (${(stats.hasLinkAlignment / stats.total * 100).toFixed(1)}%)`);
    console.log(`Events with linear-reference: ${stats.hasLinearReference} (${(stats.hasLinearReference / stats.total * 100).toFixed(1)}%)`);

    console.log('\n📌 Route Designator Values:');
    Object.entries(stats.routeDesignatorValues)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([value, count]) => {
        console.log(`  ${value}: ${count} events`);
      });

    console.log('\n🧭 Link Direction Values:');
    Object.entries(stats.linkDirectionValues)
      .sort((a, b) => b[1] - a[1])
      .forEach(([value, count]) => {
        console.log(`  "${value}": ${count} events`);
      });

    console.log('\n🧭 Link Alignment Values:');
    Object.entries(stats.linkAlignmentValues)
      .sort((a, b) => b[1] - a[1])
      .forEach(([value, count]) => {
        console.log(`  "${value}": ${count} events`);
      });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Inspection complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();

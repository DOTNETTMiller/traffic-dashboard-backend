const axios = require('axios');

const HPMS_API = 'https://geo.dot.gov/server/rest/services/Hosted/HPMS_Interstates/FeatureServer/0/query';

async function analyzeFeatureGeography() {
  console.log('🔍 Analyzing I-90 feature geographic distribution...\n');

  try {
    const response = await axios.get(HPMS_API, {
      params: {
        where: 'route_number = 90',
        outFields: 'route_id,route_name',
        returnGeometry: true,
        f: 'json',
        outSR: 4326
      }
    });

    const features = response.data.features;

    // Group features by approximate longitude ranges (states)
    const grouped = {};

    for (const feature of features) {
      if (!feature.geometry || !feature.geometry.paths) continue;

      const allPoints = feature.geometry.paths.flat();
      const lons = allPoints.map(p => p[0]);
      const lats = allPoints.map(p => p[1]);

      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);

      const centerLon = (minLon + maxLon) / 2;

      const key = `lon_${Math.floor(centerLon / 5) * 5}`; // Group by 5° lon buckets

      if (!grouped[key]) {
        grouped[key] = {
          features: [],
          lonRange: [Infinity, -Infinity],
          latRange: [Infinity, -Infinity]
        };
      }

      grouped[key].features.push(feature.attributes.route_id);
      grouped[key].lonRange[0] = Math.min(grouped[key].lonRange[0], minLon);
      grouped[key].lonRange[1] = Math.max(grouped[key].lonRange[1], maxLon);
      grouped[key].latRange[0] = Math.min(grouped[key].latRange[0], minLat);
      grouped[key].latRange[1] = Math.max(grouped[key].latRange[1], maxLat);
    }

    console.log('Feature distribution by longitude:');
    console.log('===================================\n');

    const sorted = Object.entries(grouped).sort((a, b) => {
      return parseFloat(a[0].split('_')[1]) - parseFloat(b[0].split('_')[1]);
    });

    for (const [key, data] of sorted) {
      console.log(`${key}:`);
      console.log(`  Features: ${data.features.length}`);
      console.log(`  Lon range: [${data.lonRange[0].toFixed(2)}, ${data.lonRange[1].toFixed(2)}]`);
      console.log(`  Lat range: [${data.latRange[0].toFixed(2)}, ${data.latRange[1].toFixed(2)}]`);
      console.log(`  Sample route_ids: ${data.features.slice(0, 3).join(', ')}`);
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeFeatureGeography();

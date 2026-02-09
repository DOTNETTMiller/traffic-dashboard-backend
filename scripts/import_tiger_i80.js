/**
 * Import I-80 from TIGER/Line 2023 official Census data
 * This is the most authoritative source for Interstate geometry
 */

const { Pool } = require('pg');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL;

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function main() {
  console.log('🛣️  Importing I-80 from TIGER/Line 2023 Census Data\n');

  const geojson = JSON.parse(fs.readFileSync('/tmp/iowa_i80.geojson', 'utf8'));

  console.log('📊 Input Data:');
  console.log('   Features:', geojson.features.length);

  // Combine all segments into one array of coordinates
  const allCoords = [];
  for (const feature of geojson.features) {
    if (feature.geometry.type === 'LineString') {
      allCoords.push(...feature.geometry.coordinates);
    } else if (feature.geometry.type === 'MultiLineString') {
      for (const line of feature.geometry.coordinates) {
        allCoords.push(...line);
      }
    }
  }

  console.log('   Total points:', allCoords.length);

  // Sort coordinates west to east (westbound direction)
  // I-80 in Iowa goes roughly from -96.6°W to -90.1°W
  allCoords.sort((a, b) => a[0] - b[0]); // Sort by longitude

  // Calculate total length
  let totalLength = 0;
  for (let i = 0; i < allCoords.length - 1; i++) {
    const [lon1, lat1] = allCoords[i];
    const [lon2, lat2] = allCoords[i + 1];
    totalLength += haversineDistance(lat1, lon1, lat2, lon2);
  }

  console.log('   Total length:', totalLength.toFixed(2), 'km (', (totalLength * 0.621371).toFixed(2), 'mi)');
  console.log('   West point:', allCoords[0][1].toFixed(6), allCoords[0][0].toFixed(6));
  console.log('   East point:', allCoords[allCoords.length - 1][1].toFixed(6), allCoords[allCoords.length - 1][0].toFixed(6));

  // Update database
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('\n💾 Updating database...\n');

    // I-80 WB (west to east, which is the sorted order)
    const wbGeometry = {
      type: 'LineString',
      coordinates: allCoords
    };

    await pool.query(
      'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
      [wbGeometry, 'I-80 WB']
    );
    console.log('   ✅ Updated I-80 WB');

    // I-80 EB (reversed)
    const ebGeometry = {
      type: 'LineString',
      coordinates: [...allCoords].reverse()
    };

    await pool.query(
      'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
      [ebGeometry, 'I-80 EB']
    );
    console.log('   ✅ Updated I-80 EB (reversed)');

    console.log('\n✅ Success! I-80 Iowa geometry updated from TIGER/Line 2023');
    console.log('\n📝 Source: US Census Bureau TIGER/Line Shapefiles');
    console.log('   Year: 2023');
    console.log('   Dataset: Primary and Secondary Roads');
    console.log('   Authority: Official US Government data');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main();

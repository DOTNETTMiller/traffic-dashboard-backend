/**
 * Import I-80 and I-35 geometries from Google Maps KML files
 * These are already in sequential order from Google Directions
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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

function parseKML(kmlPath) {
  console.log(`\n📖 Reading ${path.basename(kmlPath)}...`);
  const content = fs.readFileSync(kmlPath, 'utf8');

  // Extract all coordinate sections
  const coordMatches = content.match(/<coordinates>([\s\S]*?)<\/coordinates>/g);

  if (!coordMatches) {
    console.log('   ❌ No coordinates found');
    return [];
  }

  console.log(`   Found ${coordMatches.length} coordinate sections`);

  const allCoordinates = [];

  for (const match of coordMatches) {
    // Remove tags and split by whitespace
    const coordText = match.replace(/<\/?coordinates>/g, '').trim();
    const coordLines = coordText.split(/\s+/);

    for (const line of coordLines) {
      if (!line.trim()) continue;

      // Parse lon,lat,elevation format
      const parts = line.split(',');
      if (parts.length >= 2) {
        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);

        if (!isNaN(lon) && !isNaN(lat)) {
          allCoordinates.push([lon, lat]);
        }
      }
    }
  }

  console.log(`   Parsed ${allCoordinates.length} total coordinates`);
  return allCoordinates;
}

function analyzeGeometry(geometry, name) {
  console.log(`\n📊 Analyzing ${name}:`);
  console.log(`   Points: ${geometry.length}`);

  if (geometry.length === 0) return;

  // Calculate total path length
  let totalLength = 0;
  let maxJump = 0;
  let largeJumps = 0;

  for (let i = 0; i < geometry.length - 1; i++) {
    const [lon1, lat1] = geometry[i];
    const [lon2, lat2] = geometry[i + 1];
    const dist = haversineDistance(lat1, lon1, lat2, lon2);

    totalLength += dist;
    if (dist > maxJump) maxJump = dist;
    if (dist > 50) largeJumps++;
  }

  console.log(`   Total length: ${totalLength.toFixed(2)} km (${(totalLength * 0.621371).toFixed(2)} mi)`);
  console.log(`   Max jump: ${maxJump.toFixed(2)} km`);
  console.log(`   Large jumps (>50km): ${largeJumps}`);
  console.log(`   First point: ${geometry[0][1].toFixed(6)}, ${geometry[0][0].toFixed(6)}`);
  console.log(`   Last point: ${geometry[geometry.length - 1][1].toFixed(6)}, ${geometry[geometry.length - 1][0].toFixed(6)}`);
}

async function main() {
  console.log('🛣️  Importing Interstate Geometries from Google Maps KML\n');

  const i80Path = '/Users/mattmiller/Downloads/I-80.kml';
  const i35Path = '/Users/mattmiller/Downloads/I-35.kml';

  // Parse KML files
  const i80Coords = parseKML(i80Path);
  const i35Coords = parseKML(i35Path);

  if (i80Coords.length === 0 && i35Coords.length === 0) {
    console.log('\n❌ No coordinates found in either file');
    return;
  }

  // Analyze geometries
  analyzeGeometry(i80Coords, 'I-80');
  analyzeGeometry(i35Coords, 'I-35');

  // Update database
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('\n💾 Updating database...\n');

    // I-80 WB
    if (i80Coords.length > 0) {
      const i80WB = {
        type: 'LineString',
        coordinates: i80Coords
      };

      await pool.query(
        'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
        [i80WB, 'I-80 WB']
      );
      console.log('   ✅ Updated I-80 WB');

      // I-80 EB (reversed)
      const i80EB = {
        type: 'LineString',
        coordinates: [...i80Coords].reverse()
      };

      await pool.query(
        'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
        [i80EB, 'I-80 EB']
      );
      console.log('   ✅ Updated I-80 EB (reversed)');
    }

    // I-35 NB
    if (i35Coords.length > 0) {
      const i35NB = {
        type: 'LineString',
        coordinates: i35Coords
      };

      await pool.query(
        'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
        [i35NB, 'I-35 NB']
      );
      console.log('   ✅ Updated I-35 NB');

      // I-35 SB (reversed)
      const i35SB = {
        type: 'LineString',
        coordinates: [...i35Coords].reverse()
      };

      await pool.query(
        'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
        [i35SB, 'I-35 SB']
      );
      console.log('   ✅ Updated I-35 SB (reversed)');
    }

    console.log('\n✅ Success! Interstate geometries updated from Google Maps KML');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart Railway backend service');
    console.log('   2. Events should now snap to high-quality Google Directions geometry');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main();

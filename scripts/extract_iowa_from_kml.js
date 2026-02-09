/**
 * Extract Iowa I-80 portion from Google Maps "there and back" KML
 *
 * The KML contains a round-trip route along I-80:
 * - Points 0-7500: Eastbound (NJ to CA)
 * - Points 7500-15000: Westbound (CA to NJ)
 *
 * We'll extract just the Iowa portions from each direction
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

function parseKML(kmlPath) {
  console.log(`\n📖 Reading ${kmlPath}...`);
  const content = fs.readFileSync(kmlPath, 'utf8');

  const coordMatch = content.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
  if (!coordMatch) {
    console.log('   ❌ No coordinates found');
    return [];
  }

  const coordText = coordMatch[1].trim();
  const lines = coordText.split(/\s+/).filter(l => l.trim());

  const coords = [];
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length >= 2) {
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lon) && !isNaN(lat)) {
        coords.push([lon, lat]);
      }
    }
  }

  console.log(`   Parsed ${coords.length} total points`);
  return coords;
}

function extractIowaPortion(coords) {
  console.log('\n🌽 Extracting Iowa portion...');

  // Iowa bounds
  const minLat = 40.375, maxLat = 43.501;
  const minLon = -96.639, maxLon = -90.140;

  // Find where route enters and exits Iowa
  let iowaSegments = [];
  let currentSegment = null;

  for (let i = 0; i < coords.length; i++) {
    const [lon, lat] = coords[i];
    const inIowa = (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon);

    if (inIowa) {
      if (!currentSegment) {
        // Starting new Iowa segment
        currentSegment = { start: i, end: i, coords: [] };
      }
      currentSegment.end = i;
      currentSegment.coords.push([lon, lat]);
    } else {
      if (currentSegment) {
        // Ending Iowa segment
        iowaSegments.push(currentSegment);
        currentSegment = null;
      }
    }
  }

  // Don't forget last segment
  if (currentSegment) {
    iowaSegments.push(currentSegment);
  }

  console.log(`\n   Found ${iowaSegments.length} Iowa segments:`);
  for (let i = 0; i < iowaSegments.length; i++) {
    const seg = iowaSegments[i];
    console.log(`   Segment ${i + 1}: indices ${seg.start}-${seg.end}, ${seg.coords.length} points`);
  }

  return iowaSegments;
}

function analyzeSegment(coords, name) {
  let totalLength = 0;
  let maxJump = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    const dist = haversineDistance(lat1, lon1, lat2, lon2);
    totalLength += dist;
    if (dist > maxJump) maxJump = dist;
  }

  console.log(`\n📊 ${name}:`);
  console.log(`   Points: ${coords.length}`);
  console.log(`   Length: ${totalLength.toFixed(2)} km (${(totalLength * 0.621371).toFixed(2)} mi)`);
  console.log(`   Max jump: ${maxJump.toFixed(2)} km`);
  console.log(`   First: ${coords[0][1].toFixed(6)}, ${coords[0][0].toFixed(6)}`);
  console.log(`   Last: ${coords[coords.length - 1][1].toFixed(6)}, ${coords[coords.length - 1][0].toFixed(6)}`);
}

async function main() {
  console.log('🛣️  Extracting Iowa I-80 from Google Maps KML\n');

  const i80Path = '/Users/mattmiller/Downloads/I-80.kml';
  const coords = parseKML(i80Path);

  if (coords.length === 0) {
    console.log('\n❌ No coordinates found');
    return;
  }

  const iowaSegments = extractIowaPortion(coords);

  if (iowaSegments.length !== 2) {
    console.log(`\n⚠️  Warning: Expected 2 segments (WB and EB), found ${iowaSegments.length}`);
    console.log('   Proceeding anyway...');
  }

  // Determine which is WB and which is EB based on direction of travel
  // WB goes west (longitude decreases), EB goes east (longitude increases)
  let wbSegment, ebSegment;

  for (const seg of iowaSegments) {
    const startLon = seg.coords[0][0];
    const endLon = seg.coords[seg.coords.length - 1][0];

    if (endLon < startLon) {
      // Longitude decreased = traveled west
      wbSegment = seg.coords;
      console.log(`\n   Westbound segment: ${seg.coords.length} points`);
    } else {
      // Longitude increased = traveled east
      ebSegment = seg.coords;
      console.log(`   Eastbound segment: ${seg.coords.length} points`);
    }
  }

  if (wbSegment) analyzeSegment(wbSegment, 'I-80 WB (Iowa)');
  if (ebSegment) analyzeSegment(ebSegment, 'I-80 EB (Iowa)');

  // Update database
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('\n💾 Updating database...\n');

    if (wbSegment) {
      await pool.query(
        'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
        [{ type: 'LineString', coordinates: wbSegment }, 'I-80 WB']
      );
      console.log('   ✅ Updated I-80 WB');
    }

    if (ebSegment) {
      await pool.query(
        'UPDATE corridors SET geometry = $1, updated_at = NOW() WHERE name = $2',
        [{ type: 'LineString', coordinates: ebSegment }, 'I-80 EB']
      );
      console.log('   ✅ Updated I-80 EB');
    }

    console.log('\n✅ Success! Iowa I-80 geometry updated from Google Maps KML');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart Railway backend service');
    console.log('   2. Events should snap to high-quality Google Maps geometry');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main();

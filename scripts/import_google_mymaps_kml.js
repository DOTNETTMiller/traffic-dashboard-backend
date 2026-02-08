/**
 * Import Interstate geometries from Google My Maps KML export
 *
 * INSTRUCTIONS:
 * 1. Go to https://www.google.com/maps/d/
 * 2. Create a new map
 * 3. Add directions layer for the Interstate (e.g., "San Francisco, CA to Teaneck, NJ" for I-80)
 * 4. Click three dots menu → Export to KML/KMZ
 * 5. Download the KML file
 * 6. Run this script: node scripts/import_google_mymaps_kml.js path/to/file.kml
 *
 * The script will:
 * - Parse the KML file
 * - Extract the route LineString coordinates
 * - Import to corridors table as "I-XX WB" and "I-XX EB"
 */

const { Pool } = require('pg');
const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

/**
 * Parse KML file and extract LineString coordinates
 */
function parseKML(kmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlContent, 'text/xml');

  // Find all LineString elements
  const lineStrings = doc.getElementsByTagName('LineString');
  const routes = [];

  for (let i = 0; i < lineStrings.length; i++) {
    const lineString = lineStrings[i];
    const coordsElement = lineString.getElementsByTagName('coordinates')[0];

    if (!coordsElement || !coordsElement.textContent) continue;

    // Parse coordinate string: "lon,lat,alt lon,lat,alt ..."
    const coordText = coordsElement.textContent.trim();
    const coordPairs = coordText.split(/\s+/);

    const coordinates = coordPairs
      .map(pair => {
        const [lon, lat, alt] = pair.split(',').map(parseFloat);
        if (isNaN(lon) || isNaN(lat)) return null;
        return [lon, lat];
      })
      .filter(coord => coord !== null);

    if (coordinates.length > 0) {
      routes.push(coordinates);
    }
  }

  return routes;
}

/**
 * Try to detect Interstate number from KML file
 */
function detectInterstate(kmlContent) {
  // Look for patterns like "I-80", "I 80", "Interstate 80"
  const patterns = [
    /I-(\d+)/i,
    /I\s+(\d+)/i,
    /Interstate\s+(\d+)/i,
    /I(\d+)/i
  ];

  for (const pattern of patterns) {
    const match = kmlContent.match(pattern);
    if (match) {
      return `I-${match[1]}`;
    }
  }

  return null;
}

async function importKML(kmlPath, interstateName) {
  console.log('\n' + '='.repeat(70));
  console.log('📍 Importing Google My Maps KML');
  console.log('='.repeat(70));

  try {
    // Read KML file
    console.log(`\n   Reading KML file: ${kmlPath}`);
    const kmlContent = fs.readFileSync(kmlPath, 'utf-8');

    // Detect Interstate number if not provided
    if (!interstateName) {
      interstateName = detectInterstate(kmlContent);
      if (!interstateName) {
        console.error('\n❌ Could not detect Interstate number from KML.');
        console.error('   Please provide it manually: node scripts/import_google_mymaps_kml.js file.kml I-80');
        process.exit(1);
      }
      console.log(`   ✓ Detected Interstate: ${interstateName}`);
    } else {
      console.log(`   ✓ Using Interstate: ${interstateName}`);
    }

    // Parse KML
    const routes = parseKML(kmlContent);

    if (routes.length === 0) {
      console.error('\n❌ No LineString coordinates found in KML file');
      console.error('   Make sure you created a "directions" layer in Google My Maps');
      process.exit(1);
    }

    console.log(`   ✓ Found ${routes.length} route(s)`);

    // Merge all routes into one continuous line
    const allCoords = [];
    for (const route of routes) {
      console.log(`     Route segment: ${route.length} coordinates`);
      allCoords.push(...route);
    }

    // Deduplicate consecutive identical points
    const deduped = allCoords.filter((coord, i) => {
      if (i === 0) return true;
      const prev = allCoords[i - 1];
      return coord[0] !== prev[0] || coord[1] !== prev[1];
    });

    console.log(`   ✓ Total coordinates: ${deduped.length}`);

    // Check for gaps
    let gapCount = 0;
    for (let i = 1; i < deduped.length; i++) {
      const [lon1, lat1] = deduped[i - 1];
      const [lon2, lat2] = deduped[i];
      const dist = Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));

      if (dist > 0.05) { // ~3.5 miles
        gapCount++;
        console.log(`     ⚠️  Gap ${gapCount}: ${(dist * 69).toFixed(1)} miles at coord ${i}`);
      }
    }

    if (gapCount === 0) {
      console.log('     ✅ No gaps found - continuous geometry!');
    }

    // Create WB and EB corridors
    const wbName = `${interstateName} WB`;
    const ebName = `${interstateName} EB`;

    const wbGeometry = { type: 'LineString', coordinates: deduped };
    const ebGeometry = { type: 'LineString', coordinates: [...deduped].reverse() };

    // Update database
    console.log('\n   Saving to database...');

    const existing = await pool.query(
      `SELECT name FROM corridors WHERE name IN ($1, $2)`,
      [wbName, ebName]
    );
    const existingNames = new Set(existing.rows.map(r => r.name));

    // Insert/Update WB
    if (existingNames.has(wbName)) {
      await pool.query(
        `UPDATE corridors SET geometry = $1 WHERE name = $2`,
        [wbGeometry, wbName]
      );
      console.log(`   ✓ Updated ${wbName}`);
    } else {
      const wbId = wbName.toLowerCase().replace(/\s+/g, '-');
      await pool.query(
        `INSERT INTO corridors (id, name, geometry) VALUES ($1, $2, $3)`,
        [wbId, wbName, wbGeometry]
      );
      console.log(`   ✓ Inserted ${wbName}`);
    }

    // Insert/Update EB
    if (existingNames.has(ebName)) {
      await pool.query(
        `UPDATE corridors SET geometry = $1 WHERE name = $2`,
        [ebGeometry, ebName]
      );
      console.log(`   ✓ Updated ${ebName}`);
    } else {
      const ebId = ebName.toLowerCase().replace(/\s+/g, '-');
      await pool.query(
        `INSERT INTO corridors (id, name, geometry) VALUES ($1, $2, $3)`,
        [ebId, ebName, ebGeometry]
      );
      console.log(`   ✓ Inserted ${ebName}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Google My Maps KML import complete!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage: node scripts/import_google_mymaps_kml.js <kml-file> [interstate-name]

Examples:
  node scripts/import_google_mymaps_kml.js ~/Downloads/I-80.kml
  node scripts/import_google_mymaps_kml.js ~/Downloads/route.kml I-80

Instructions:
  1. Go to https://www.google.com/maps/d/
  2. Create a new map
  3. Add a directions layer for the Interstate route
     Example for I-80: "San Francisco, CA" to "Teaneck, NJ"
  4. Click the three dots menu → Export to KML/KMZ
  5. Download and run this script with the KML file path
  `);
  process.exit(0);
}

const kmlPath = args[0];
const interstateName = args[1];

if (!fs.existsSync(kmlPath)) {
  console.error(`❌ File not found: ${kmlPath}`);
  process.exit(1);
}

// Run import
importKML(kmlPath, interstateName)
  .then(() => {
    pool.end();
    console.log('\n✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    pool.end();
    process.exit(1);
  });

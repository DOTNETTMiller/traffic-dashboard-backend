/**
 * Import TIGER/Line Interstate geometries
 *
 * Uses US Census Bureau TIGER/Line 2023 Primary Roads data
 * which provides continuous, gap-free Interstate geometries
 */

const { Pool } = require('pg');
const fs = require('fs');

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
 * Calculate distance between two coordinates
 */
function distance(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  return Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
}

/**
 * Merge all segments for an Interstate into a single continuous LineString
 * by intelligently chaining segments together based on proximity
 */
function mergeSegments(segments) {
  if (segments.length === 0) return [];
  if (segments.length === 1) return segments[0].geometry.coordinates;

  // Start with the first segment
  const chains = []; // Array of coordinate chains
  const used = new Set();

  // Create initial chains from all segments
  for (let i = 0; i < segments.length; i++) {
    chains.push({
      coords: [...segments[i].geometry.coordinates],
      startIdx: i,
      endIdx: i
    });
  }

  // Repeatedly merge chains until no more can be merged
  let merged = true;
  while (merged) {
    merged = false;

    for (let i = 0; i < chains.length; i++) {
      if (!chains[i]) continue;

      const chainA = chains[i];
      const startA = chainA.coords[0];
      const endA = chainA.coords[chainA.coords.length - 1];

      let bestMatch = null;
      let bestDist = 0.01; // ~0.7 miles threshold for connecting segments
      let bestConfig = null;

      for (let j = i + 1; j < chains.length; j++) {
        if (!chains[j]) continue;

        const chainB = chains[j];
        const startB = chainB.coords[0];
        const endB = chainB.coords[chainB.coords.length - 1];

        // Check all 4 possible connections
        const configs = [
          { dist: distance(endA, startB), type: 'end-start', reverse: false }, // A -> B
          { dist: distance(endA, endB), type: 'end-end', reverse: true },       // A -> reverse(B)
          { dist: distance(startA, startB), type: 'start-start', reverse: true }, // reverse(A) -> B
          { dist: distance(startA, endB), type: 'start-end', reverse: false }   // reverse(A) -> reverse(B) = B -> A
        ];

        for (const config of configs) {
          if (config.dist < bestDist) {
            bestDist = config.dist;
            bestMatch = j;
            bestConfig = config;
          }
        }
      }

      if (bestMatch !== null) {
        const chainB = chains[bestMatch];
        const newCoords = [];

        // Merge based on best configuration
        if (bestConfig.type === 'end-start') {
          newCoords.push(...chainA.coords, ...chainB.coords.slice(1));
        } else if (bestConfig.type === 'end-end') {
          newCoords.push(...chainA.coords, ...chainB.coords.slice(0, -1).reverse());
        } else if (bestConfig.type === 'start-start') {
          newCoords.push(...chainA.coords.reverse(), ...chainB.coords.slice(1));
        } else { // start-end
          newCoords.push(...chainB.coords, ...chainA.coords.slice(1));
        }

        // Replace chainA with merged chain
        chains[i] = {
          coords: newCoords,
          startIdx: Math.min(chainA.startIdx, chainB.startIdx),
          endIdx: Math.max(chainA.endIdx, chainB.endIdx)
        };

        // Remove chainB
        chains[bestMatch] = null;
        merged = true;
        break;
      }
    }

    // Clean up null entries
    if (merged) {
      chains.splice(0, chains.length, ...chains.filter(c => c !== null));
    }
  }

  // If we have multiple chains left, sort them by longitude (west to east)
  // and concatenate with gaps marked
  chains.sort((a, b) => a.coords[0][0] - b.coords[0][0]);

  const allCoords = [];
  for (let i = 0; i < chains.length; i++) {
    if (i > 0) {
      // There's a gap between chains - just concatenate them
      // The gap checker will report these
    }
    allCoords.push(...chains[i].coords);
  }

  // Deduplicate consecutive identical points
  const deduped = allCoords.filter((coord, i) => {
    if (i === 0) return true;
    const prev = allCoords[i - 1];
    return coord[0] !== prev[0] || coord[1] !== prev[1];
  });

  return deduped;
}

/**
 * Check for gaps in merged geometry
 */
function checkGaps(coords, name) {
  let gapCount = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    const dist = Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));

    // Flag gaps larger than ~3.5 miles (0.05 degrees ≈ 3.5 miles)
    if (dist > 0.05) {
      gapCount++;
      console.log(`     ⚠️  Gap ${gapCount}: ${(dist * 69).toFixed(1)} miles at coord ${i}`);
    }
  }

  if (gapCount === 0) {
    console.log(`     ✅ No gaps found - continuous geometry!`);
  }

  return gapCount;
}

async function importTigerInterstates() {
  console.log('\n' + '='.repeat(70));
  console.log('📍 Importing TIGER/Line Interstate Geometries');
  console.log('='.repeat(70));

  try {
    // Read the GeoJSON file
    console.log('\n   Reading TIGER/Line GeoJSON...');
    const geojson = JSON.parse(fs.readFileSync('/tmp/tiger_interstates.geojson', 'utf-8'));
    console.log(`   ✓ Loaded ${geojson.features.length} Interstate segments`);

    // Group by Interstate number
    const byInterstate = {};
    for (const feature of geojson.features) {
      const fullname = feature.properties.FULLNAME;
      if (!fullname) continue;

      // Extract Interstate number (e.g., "I- 80" -> "I-80")
      const match = fullname.match(/I-?\s*(\d+)/);
      if (!match) continue;

      const interstate = `I-${match[1]}`;
      if (!byInterstate[interstate]) {
        byInterstate[interstate] = [];
      }
      byInterstate[interstate].push(feature);
    }

    const interstateNames = Object.keys(byInterstate).sort((a, b) => {
      const numA = parseInt(a.split('-')[1]);
      const numB = parseInt(b.split('-')[1]);
      return numA - numB;
    });

    console.log(`\n   ✓ Found ${interstateNames.length} unique Interstates`);
    console.log(`   Processing: ${interstateNames.slice(0, 10).join(', ')}...`);

    // Process each Interstate
    for (const interstate of interstateNames) {
      const segments = byInterstate[interstate];
      console.log(`\n   ${interstate}:`);
      console.log(`     Segments: ${segments.length}`);

      // Merge all segments
      const coords = mergeSegments(segments);
      console.log(`     Merged coordinates: ${coords.length}`);

      // Check for gaps
      const gapCount = checkGaps(coords, interstate);

      // For major Interstates, create both WB and EB
      // WB = west-to-east, EB = east-to-west (reversed)
      const wbName = `${interstate} WB`;
      const ebName = `${interstate} EB`;

      const wbGeometry = { type: 'LineString', coordinates: coords };
      const ebGeometry = { type: 'LineString', coordinates: [...coords].reverse() };

      // Update database
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
      } else {
        const wbId = wbName.toLowerCase().replace(/\s+/g, '-');
        await pool.query(
          `INSERT INTO corridors (id, name, geometry) VALUES ($1, $2, $3)`,
          [wbId, wbName, wbGeometry]
        );
      }

      // Insert/Update EB
      if (existingNames.has(ebName)) {
        await pool.query(
          `UPDATE corridors SET geometry = $1 WHERE name = $2`,
          [ebGeometry, ebName]
        );
      } else {
        const ebId = ebName.toLowerCase().replace(/\s+/g, '-');
        await pool.query(
          `INSERT INTO corridors (id, name, geometry) VALUES ($1, $2, $3)`,
          [ebId, ebName, ebGeometry]
        );
      }

      console.log(`     ✅ Saved ${wbName} and ${ebName}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TIGER/Line import complete!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    throw error;
  }
}

// Run import
importTigerInterstates()
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

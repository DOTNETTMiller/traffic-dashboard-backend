/**
 * Fix I-80 WB polyline sequence
 * Currently it's reversed - needs to go East → West (NJ → CA)
 */

const { Pool } = require('pg');

async function fixI80WB() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('🔧 Fixing I-80 WB Polyline Sequence\n');

  try {
    // Get current I-80 WB data
    const result = await pool.query(`
      SELECT geometry, bounds FROM corridors WHERE id = 'i-80-wb'
    `);

    if (!result.rows[0]?.geometry) {
      console.log('❌ I-80 WB not found');
      await pool.end();
      process.exit(1);
    }

    const currentGeom = result.rows[0].geometry;
    const coords = currentGeom.coordinates;

    console.log(`Current I-80 WB:`);
    console.log(`  Points: ${coords.length}`);
    console.log(`  First: [${coords[0][0].toFixed(2)}, ${coords[0][1].toFixed(2)}]`);
    console.log(`  Last:  [${coords[coords.length-1][0].toFixed(2)}, ${coords[coords.length-1][1].toFixed(2)}]`);
    console.log(`  Direction: ${coords[0][0] > coords[coords.length-1][0] ? 'East→West ✅' : 'West→East ❌ WRONG'}\n`);

    // Reverse the coordinates
    console.log('Reversing coordinates...');
    const reversedCoords = [...coords].reverse();

    console.log(`\nReversed I-80 WB:`);
    console.log(`  Points: ${reversedCoords.length}`);
    console.log(`  First: [${reversedCoords[0][0].toFixed(2)}, ${reversedCoords[0][1].toFixed(2)}] (Should be ~New Jersey)`);
    console.log(`  Last:  [${reversedCoords[reversedCoords.length-1][0].toFixed(2)}, ${reversedCoords[reversedCoords.length-1][1].toFixed(2)}] (Should be ~California)`);
    console.log(`  Direction: ${reversedCoords[0][0] > reversedCoords[reversedCoords.length-1][0] ? 'East→West ✅ CORRECT' : 'West→East ❌ STILL WRONG'}\n`);

    // Update database
    const newGeometry = {
      type: 'LineString',
      coordinates: reversedCoords
    };

    await pool.query(`
      UPDATE corridors
      SET geometry = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'i-80-wb'
    `, [JSON.stringify(newGeometry)]);

    console.log('✅ I-80 WB sequence fixed!');
    console.log('   Now properly goes East → West (New Jersey → California)\n');

    await pool.end();

  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

fixI80WB();

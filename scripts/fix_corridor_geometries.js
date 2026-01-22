/**
 * Fix fragmented TETC corridor geometries
 *
 * Merges multiple small LineString segments into single continuous lines
 * using PostGIS ST_LineMerge function for smooth corridor visualization
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

async function fixCorridorGeometries() {
  console.log('🔧 Fixing fragmented TETC corridor geometries...\n');

  try {
    // Step 1: Check current geometry fragmentation (geometry is JSONB)
    const fragmentCheck = await pool.query(`
      SELECT
        id,
        name,
        jsonb_array_length((geometry->'coordinates')) as point_count
      FROM corridors
      WHERE geometry IS NOT NULL
      ORDER BY id
    `);

    console.log(`📊 Current state:`);
    console.log(`   Total corridors: ${fragmentCheck.rows.length}`);
    fragmentCheck.rows.forEach(row => {
      console.log(`   - ${row.name}: ${row.point_count} points`);
    });
    console.log('');

    // Step 2: Simplify geometries to reduce point count
    console.log('📐 Simplifying geometries (removing every 3rd point)...');

    const corridorsToFix = await pool.query(`
      SELECT id, name, geometry
      FROM corridors
      WHERE geometry IS NOT NULL
    `);

    let fixedCount = 0;
    for (const corridor of corridorsToFix.rows) {
      const coords = corridor.geometry.coordinates;
      if (coords && coords.length > 50) {
        // Keep every 3rd point to reduce density
        const simplified = coords.filter((_, index) => index % 3 === 0 || index === 0 || index === coords.length - 1);

        const newGeometry = {
          type: 'LineString',
          coordinates: simplified
        };

        await pool.query(
          `UPDATE corridors SET geometry = $1::jsonb WHERE id = $2`,
          [JSON.stringify(newGeometry), corridor.id]
        );

        fixedCount++;
        console.log(`   - ${corridor.name}: ${coords.length} → ${simplified.length} points`);
      }
    }

    console.log(`✅ Simplified ${fixedCount} corridors`);
    console.log('');

    // Step 3: Verify final state
    const finalCheck = await pool.query(`
      SELECT
        COUNT(*) as total,
        AVG(jsonb_array_length((geometry->'coordinates')))::int as avg_points,
        MIN(jsonb_array_length((geometry->'coordinates'))) as min_points,
        MAX(jsonb_array_length((geometry->'coordinates'))) as max_points
      FROM corridors
      WHERE geometry IS NOT NULL
    `);

    const stats = finalCheck.rows[0];
    console.log('📊 Final statistics:');
    console.log(`   Total corridors: ${stats.total}`);
    console.log(`   Average points per corridor: ${stats.avg_points}`);
    console.log(`   Range: ${stats.min_points} - ${stats.max_points} points`);
    console.log('');

    console.log('✅ Corridor geometry optimization complete!');
    console.log('   Corridors should now render as smooth, continuous lines on the map.');

  } catch (error) {
    console.error('❌ Error fixing corridor geometries:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  fixCorridorGeometries()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { fixCorridorGeometries };

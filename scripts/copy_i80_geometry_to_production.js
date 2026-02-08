/**
 * Copy I-80 WB/EB geometry from old database to production
 *
 * The old database has complete I-80 coverage including Iowa.
 * The production database is missing Iowa sections.
 */

const { Pool } = require('pg');

const OLD_DB = "postgres://postgres:FE11Bg4EgEfdD4E46CD3c2CdAF1E5DDC@tramway.proxy.rlwy.net:14217/railway";
const PROD_DB = "postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway";

async function main() {
  console.log('📦 Copying I-80 WB/EB Geometry to Production\n');
  console.log('='.repeat(60));

  const oldPool = new Pool({ connectionString: OLD_DB });
  const prodPool = new Pool({ connectionString: PROD_DB });

  try {
    // Get I-80 WB and EB from old database
    for (const dir of ['WB', 'EB']) {
      const corridorName = `I-80 ${dir}`;
      console.log(`\n📍 Processing ${corridorName}...`);

      const oldResult = await oldPool.query(
        'SELECT geometry FROM corridors WHERE name = $1',
        [corridorName]
      );

      if (oldResult.rows.length === 0) {
        console.log(`  ❌ Not found in old database, skipping`);
        continue;
      }

      const geometry = oldResult.rows[0].geometry;
      const pointCount = geometry.coordinates.length;

      console.log(`  ✅ Found in old DB: ${pointCount} points`);

      // Update in production
      const updateResult = await prodPool.query(
        `UPDATE corridors
         SET geometry = $1,
             updated_at = NOW()
         WHERE name = $2`,
        [geometry, corridorName]
      );

      if (updateResult.rowCount > 0) {
        console.log(`  ✅ Updated in production`);
      } else {
        console.log(`  ⚠️  Not found in production, inserting...`);
        await prodPool.query(
          `INSERT INTO corridors (name, geometry, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())`,
          [corridorName, geometry]
        );
        console.log(`  ✅ Inserted into production`);
      }

      // Verify
      const verifyResult = await prodPool.query(
        'SELECT jsonb_array_length(geometry->\'coordinates\') as count FROM corridors WHERE name = $1',
        [corridorName]
      );

      console.log(`  ✅ Verified: ${verifyResult.rows[0].count} points in production`);
    }

    console.log('\n✅ Copy complete!');
    console.log('\nNext step: Restart the backend to re-snap events with new geometry');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await oldPool.end();
    await prodPool.end();
  }
}

main();

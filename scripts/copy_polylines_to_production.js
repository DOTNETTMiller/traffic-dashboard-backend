/**
 * Copy Interstate polylines from Nozomi (dev) to Tramway (production)
 */

const { Pool } = require('pg');

const NOZOMI_URL = 'postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway';
const TRAMWAY_URL = 'postgres://postgres:FE11Bg4EgEfdD4E46CD3c2CdAF1E5DDC@tramway.proxy.rlwy.net:14217/railway';

async function copyToProduction() {
  const nozomiPool = new Pool({ connectionString: NOZOMI_URL, ssl: { rejectUnauthorized: false } });
  const tramwayPool = new Pool({ connectionString: TRAMWAY_URL, ssl: { rejectUnauthorized: false } });

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  COPY INTERSTATE POLYLINES TO PRODUCTION                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Fetch polylines from Nozomi
    console.log('📥 Fetching polylines from Nozomi (dev)...\n');

    const polylines = await nozomiPool.query(`
      SELECT id, name, geometry, bounds, updated_at
      FROM corridors
      WHERE id IN ('i-80-eb', 'i-80-wb', 'i-35-nb', 'i-35-sb')
      ORDER BY id
    `);

    if (polylines.rows.length === 0) {
      console.log('❌ No polylines found in Nozomi database');
      await nozomiPool.end();
      await tramwayPool.end();
      process.exit(1);
    }

    console.log(`Found ${polylines.rows.length} polylines:\n`);
    polylines.rows.forEach(row => {
      const points = row.geometry ? row.geometry.coordinates.length : 0;
      console.log(`  ${row.id}: ${points} points`);
    });

    console.log('\n📤 Copying to Tramway (production)...\n');

    for (const polyline of polylines.rows) {
      const points = polyline.geometry ? polyline.geometry.coordinates.length : 0;

      await tramwayPool.query(`
        INSERT INTO corridors (id, name, geometry, bounds, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          geometry = EXCLUDED.geometry,
          bounds = EXCLUDED.bounds,
          updated_at = CURRENT_TIMESTAMP
      `, [
        polyline.id,
        polyline.name,
        JSON.stringify(polyline.geometry),
        JSON.stringify(polyline.bounds)
      ]);

      console.log(`  ✅ ${polyline.id}: ${points} points copied`);
    }

    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('✅ All polylines copied to production!\n');

    console.log('Production is now ready to:');
    console.log('  • Snap I-80 events to curved geometry');
    console.log('  • Snap I-35 events to curved geometry');
    console.log('  • Display realistic highway paths on the map\n');

    await nozomiPool.end();
    await tramwayPool.end();

  } catch (err) {
    console.error('❌ Error copying polylines:', err.message);
    console.error(err);
    await nozomiPool.end();
    await tramwayPool.end();
    process.exit(1);
  }
}

copyToProduction();

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyI90Geometry() {
  console.log('\n🔍 Verifying I-90 Corridor Geometry (JSONB MultiLineString)\n');
  console.log('='.repeat(80));

  const result = await pool.query(`
    SELECT name, geometry->'type' as type, geometry->'coordinates' as coords
    FROM corridors
    WHERE name LIKE 'I-90%'
    ORDER BY name
  `);

  console.log('\n');
  for (const row of result.rows) {
    const type = row.type.replace(/"/g, ''); // Clean quotes from JSONB
    // MultiLineString coords are nested: [ [ [lon, lat], ... ], ... ]
    const allParts = type === 'MultiLineString' ? row.coords : [row.coords];
    const flattenedPoints = allParts.flat();

    if (flattenedPoints.length === 0) continue;

    const startPoint = flattenedPoints[0];
    const endPoint = flattenedPoints[flattenedPoints.length - 1];
    let totalMiles = 0;
    const R = 3958.8; // Earth's radius in miles

    for (const part of allParts) {
      for (let i = 0; i < part.length - 1; i++) {
        const [lon1, lat1] = part[i];
        const [lon2, lat2] = part[i+1];
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) *
                  Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
        totalMiles += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }
    }

    console.log(`${row.name}:`);
    console.log(`  Structure:   ${type}`);
    console.log(`  Segments:    ${allParts.length.toLocaleString()}`);
    console.log(`  Points:      ${flattenedPoints.length.toLocaleString()}`);
    console.log(`  Miles:       ${totalMiles.toFixed(2)} miles`);
    console.log(`  Start:       [${startPoint}]`);
    console.log(`  End:         [${endPoint}]`);
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('\n📝 Notes:');
  console.log('  - I-90 official length: 3,020 miles (FHWA)');
  console.log('  - Each direction should be ~3,020 miles');
  console.log('  - WB runs from Boston, MA to Seattle, WA');
  console.log('  - EB runs from Seattle, WA to Boston, MA');
  console.log('  - If mileage ~2,300 miles, missing toll/concurrency sections');
  console.log('');

  await pool.end();
}

verifyI90Geometry().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

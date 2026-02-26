const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const result = await pool.query(`
      SELECT
        state,
        COUNT(*) as total,
        COUNT(CASE WHEN geometry IS NOT NULL THEN 1 END) as with_geometry
      FROM state_messages
      WHERE state IN ('Kansas', 'Nebraska', 'Indiana', 'Minnesota', 'Iowa')
        AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY state
      ORDER BY state
    `);

    console.log('FEU-G State Events (last 24 hours):');
    console.log(JSON.stringify(result.rows, null, 2));

    for (const state of ['Iowa', 'Kansas', 'Nebraska', 'Minnesota']) {
      const sample = await pool.query(`
        SELECT id, state, description,
               COALESCE(geometry::text, 'NULL') as has_geometry,
               geometry->>'source' as geometry_source_label,
               geometry->>'geometrySource' as geometry_source_backend
        FROM state_messages
        WHERE state = $1
          AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 1
      `, [state]);

      if (sample.rows.length > 0) {
        const row = sample.rows[0];
        console.log('\n' + state + ' Sample Event:');
        console.log('  Description:', row.description ? row.description.substring(0, 60) + '...' : 'N/A');
        console.log('  Has geometry:', row.has_geometry !== 'NULL' ? 'YES' : 'NO');
        console.log('  Geometry source (label):', row.geometry_source_label || 'N/A');
        console.log('  Geometry source (backend):', row.geometry_source_backend || 'N/A');
      }
    }

    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();

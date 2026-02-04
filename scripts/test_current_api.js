const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testCurrentAPI() {
  try {
    // EXACT query from backend_proxy_server.js lines 11984-12004
    const query = `
      SELECT
        c.id,
        c.name,
        c.description,
        c.geometry,
        c.bounds,
        COUNT(DISTINCT df.id) as feed_count,
        ROUND(AVG(qs.dqi)::numeric, 1) as avg_dqi,
        ROUND(MIN(qs.dqi)::numeric, 1) as min_dqi,
        ROUND(MAX(qs.dqi)::numeric, 1) as max_dqi
      FROM corridors c
      LEFT JOIN data_feeds df ON c.id = df.corridor_id
      LEFT JOIN validation_runs vr ON df.id = vr.data_feed_id
      LEFT JOIN quality_scores qs ON vr.id = qs.validation_run_id
      WHERE c.geometry IS NOT NULL
        AND jsonb_array_length(c.geometry->'coordinates') > 5000
        AND c.name ~ '(EB|WB|NB|SB)$'
      GROUP BY c.id, c.name, c.description, c.geometry, c.bounds
      ORDER BY c.name
    `;

    const result = await pool.query(query);

    console.log('\n🎯 CURRENT API QUERY (>5000 pts + directional):\n');
    console.log('Total corridors returned:', result.rows.length);
    console.log('='.repeat(80));

    result.rows.forEach(row => {
      const pts = row.geometry?.coordinates?.length || 0;
      console.log(`${row.name.padEnd(30)} ${String(pts).padStart(6)} points`);
    });

    // Check for specific interstates the user mentioned
    console.log('\n' + '='.repeat(80));
    const i95 = result.rows.filter(r => r.name.includes('I-95'));
    console.log(`I-95 corridors: ${i95.length}`);
    i95.forEach(r => console.log(`  - ${r.name}: ${r.geometry?.coordinates?.length} points`));

    const i69 = result.rows.filter(r => r.name.includes('I-69'));
    console.log(`\nI-69 corridors: ${i69.length}`);
    i69.forEach(r => console.log(`  - ${r.name}: ${r.geometry?.coordinates?.length} points`));

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testCurrentAPI();

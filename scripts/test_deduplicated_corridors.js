const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testDeduplicated() {
  try {
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
        AND jsonb_array_length(c.geometry->'coordinates') > 1000
      GROUP BY c.id, c.name, c.description, c.geometry, c.bounds
      ORDER BY c.name
    `;

    const result = await pool.query(query);

    console.log('\n✅ DEDUPLICATED Corridors (>1000 points only):\n');
    console.log('Total corridors:', result.rows.length);
    console.log('='.repeat(80));

    result.rows.forEach(row => {
      const pts = row.geometry?.coordinates?.length || 0;
      console.log(`${row.name.padEnd(30)} ${String(pts).padStart(6)} points`);
    });

    // Check I-95 specifically
    console.log('\n' + '='.repeat(80));
    const i95 = result.rows.filter(r => r.name.includes('I-95'));
    console.log(`I-95 corridors shown: ${i95.length}`);
    i95.forEach(r => console.log(`  - ${r.name}: ${r.geometry?.coordinates?.length} points`));

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testDeduplicated();

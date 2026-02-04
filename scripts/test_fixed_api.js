const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testFixedAPI() {
  try {
    // NEW query (fixed) - shows ALL corridors with geometry
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
      GROUP BY c.id, c.name, c.description, c.geometry, c.bounds
      ORDER BY c.name
    `;

    const result = await pool.query(query);

    console.log('\n✅ FIXED API Response:\n');
    console.log('Total corridors with geometry:', result.rows.length);
    console.log('='.repeat(80));

    // Show I-80 specifically
    const i80corridors = result.rows.filter(r => r.name.includes('I-80'));
    console.log(`\nI-80 Corridors (${i80corridors.length}):`);
    i80corridors.forEach(row => {
      console.log(`  ${row.name}: ${row.geometry?.coordinates?.length || 0} points, ${row.feed_count} feeds`);
    });

    // Show I-35
    const i35corridors = result.rows.filter(r => r.name.includes('I-35'));
    console.log(`\nI-35 Corridors (${i35corridors.length}):`);
    i35corridors.forEach(row => {
      console.log(`  ${row.name}: ${row.geometry?.coordinates?.length || 0} points, ${row.feed_count} feeds`);
    });

    // Show summary
    console.log('\n' + '='.repeat(80));
    console.log('Summary by point count:');
    const sorted = result.rows.sort((a, b) => (b.geometry?.coordinates?.length || 0) - (a.geometry?.coordinates?.length || 0));
    sorted.slice(0, 10).forEach((row, idx) => {
      const pts = row.geometry?.coordinates?.length || 0;
      console.log(`  ${idx + 1}. ${row.name.padEnd(25)} ${String(pts).padStart(6)} points`);
    });

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testFixedAPI();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testAPI() {
  try {
    // Same query as the API endpoint
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
      GROUP BY c.id, c.name, c.description, c.geometry, c.bounds
      HAVING COUNT(DISTINCT df.id) > 0
      ORDER BY c.name
      LIMIT 10
    `;

    const result = await pool.query(query);

    console.log('\n📊 API Response Test (first 10 corridors with data feeds):\n');
    console.log('Total corridors with feeds:', result.rows.length);
    console.log('='.repeat(80));

    result.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. ${row.name}`);
      console.log(`   Feed count: ${row.feed_count}`);
      console.log(`   Geometry type: ${row.geometry?.type || 'NULL'}`);
      console.log(`   Point count: ${row.geometry?.coordinates?.length || 0}`);

      if (row.geometry?.coordinates?.length > 0) {
        const first = row.geometry.coordinates[0];
        const last = row.geometry.coordinates[row.geometry.coordinates.length - 1];
        console.log(`   First point: [${first[0]?.toFixed(4)}, ${first[1]?.toFixed(4)}]`);
        console.log(`   Last point: [${last[0]?.toFixed(4)}, ${last[1]?.toFixed(4)}]`);
      }
    });

    // Now check I-80 specifically
    console.log('\n\n='.repeat(80));
    console.log('Checking I-80 specifically:\n');

    const i80query = `
      SELECT
        c.name,
        c.geometry,
        COUNT(DISTINCT df.id) as feed_count
      FROM corridors c
      LEFT JOIN data_feeds df ON c.id = df.corridor_id
      WHERE c.name LIKE 'I-80%'
      GROUP BY c.id, c.name, c.geometry
    `;

    const i80result = await pool.query(i80query);
    i80result.rows.forEach(row => {
      console.log(`${row.name}:`);
      console.log(`   Feed count: ${row.feed_count}`);
      console.log(`   Point count: ${row.geometry?.coordinates?.length || 0}`);
    });

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testAPI();

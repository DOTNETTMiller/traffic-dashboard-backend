const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkGaps() {
  try {
    console.log('\n🔍 CHECKING GAP ANALYSIS DATA\n');

    // Check if infrastructure_gaps table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'infrastructure_gaps'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ infrastructure_gaps table does not exist');
      await pool.end();
      return;
    }

    // Get gap counts by model
    const gapCounts = await pool.query(`
      SELECT
        m.filename,
        m.id as model_id,
        COUNT(g.id) as gap_count,
        COUNT(DISTINCT g.gap_category) as gap_categories,
        SUM(CASE WHEN g.severity = 'high' THEN 1 ELSE 0 END) as high_severity,
        SUM(CASE WHEN g.severity = 'medium' THEN 1 ELSE 0 END) as medium_severity,
        SUM(CASE WHEN g.severity = 'low' THEN 1 ELSE 0 END) as low_severity
      FROM ifc_models m
      LEFT JOIN infrastructure_gaps g ON g.model_id = m.id
      GROUP BY m.id, m.filename
      ORDER BY m.id;
    `);

    console.log('📊 Gap Analysis by Model:\n');
    gapCounts.rows.forEach(row => {
      console.log(`📄 ${row.filename} (Model ID: ${row.model_id})`);
      console.log(`   Total Gaps: ${row.gap_count}`);
      console.log(`   Gap Categories: ${row.gap_categories}`);
      console.log(`   🔴 High: ${row.high_severity} | 🟡 Medium: ${row.medium_severity} | 🟢 Low: ${row.low_severity}`);
      console.log('');
    });

    // Show sample gaps
    const sampleGaps = await pool.query(`
      SELECT
        m.filename,
        g.gap_category,
        g.severity,
        g.missing_property,
        g.its_use_case,
        g.idm_recommendation
      FROM infrastructure_gaps g
      JOIN ifc_models m ON m.id = g.model_id
      LIMIT 5;
    `);

    if (sampleGaps.rows.length > 0) {
      console.log('\n📋 Sample Gaps:\n');
      sampleGaps.rows.forEach((gap, idx) => {
        console.log(`${idx + 1}. ${gap.filename}`);
        console.log(`   Category: ${gap.gap_category}`);
        console.log(`   Severity: ${gap.severity}`);
        console.log(`   Missing: ${gap.missing_property}`);
        console.log(`   Use Case: ${gap.its_use_case}`);
        if (gap.idm_recommendation) {
          console.log(`   IDM: ${gap.idm_recommendation.substring(0, 100)}...`);
        }
        console.log('');
      });
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

checkGaps();

/**
 * Check Infrastructure Elements Extracted from IFC Models
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkElements() {
  try {
    console.log('\n🔍 CHECKING IFC MODEL INFRASTRUCTURE ELEMENTS\n');
    console.log('='.repeat(80));

    // Get all models
    const modelsResult = await pool.query('SELECT id, filename, project_name, total_elements FROM ifc_models ORDER BY id');

    console.log(`\n📦 Found ${modelsResult.rows.length} IFC models:\n`);

    for (const model of modelsResult.rows) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📄 Model: ${model.filename}`);
      console.log(`   Project: ${model.project_name}`);
      console.log(`   Total Elements: ${model.total_elements}`);
      console.log(`   ID: ${model.id}`);

      // Check if elements exist for this model
      const elementsResult = await pool.query(`
        SELECT
          ifc_type,
          element_name,
          category,
          length,
          width,
          height,
          clearance,
          v2x_applicable,
          av_critical,
          properties
        FROM infrastructure_elements
        WHERE model_id = $1
        LIMIT 10
      `, [model.id]);

      if (elementsResult.rows.length > 0) {
        console.log(`\n   ✅ Found ${elementsResult.rows.length} sample elements:`);

        elementsResult.rows.forEach((elem, idx) => {
          console.log(`\n   ${idx + 1}. ${elem.ifc_type} - ${elem.element_name || 'Unnamed'}`);
          console.log(`      Category: ${elem.category || 'N/A'}`);
          if (elem.length) console.log(`      Length: ${elem.length}`);
          if (elem.width) console.log(`      Width: ${elem.width}`);
          if (elem.height) console.log(`      Height: ${elem.height}`);
          if (elem.clearance) console.log(`      Clearance: ${elem.clearance}`);
          console.log(`      V2X: ${elem.v2x_applicable ? '✓' : '✗'} | AV: ${elem.av_critical ? '✓' : '✗'}`);

          // Show some properties
          if (elem.properties) {
            const props = JSON.parse(elem.properties);
            const propKeys = Object.keys(props).slice(0, 5);
            if (propKeys.length > 0) {
              console.log(`      Properties: ${propKeys.join(', ')}${Object.keys(props).length > 5 ? '...' : ''}`);
            }
          }
        });

        // Get element type summary
        const typeSummary = await pool.query(`
          SELECT
            ifc_type,
            COUNT(*) as count,
            SUM(CASE WHEN v2x_applicable THEN 1 ELSE 0 END) as v2x_count,
            SUM(CASE WHEN av_critical THEN 1 ELSE 0 END) as av_count
          FROM infrastructure_elements
          WHERE model_id = $1
          GROUP BY ifc_type
          ORDER BY count DESC
        `, [model.id]);

        console.log(`\n   📊 Element Type Summary:`);
        typeSummary.rows.forEach(type => {
          console.log(`      ${type.ifc_type}: ${type.count} total (${type.v2x_count} V2X, ${type.av_count} AV)`);
        });

      } else {
        console.log(`\n   ⚠️  No infrastructure elements found in database`);
        console.log(`      This model may need to be processed to extract element data`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Check complete!\n');

    await pool.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkElements();

/**
 * Import BIM/IFC Files into Digital Infrastructure Database
 *
 * This script:
 * 1. Parses IFC files using the existing ifc-parser
 * 2. Loads infrastructure elements into the database
 * 3. Tags V2X and AV-applicable features
 * 4. Identifies gaps for ITS operations
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const IFCParser = require('../utils/ifc-parser');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway',
  ssl: { rejectUnauthorized: false }
});

async function importIFCFile(filePath, metadata = {}) {
  const filename = path.basename(filePath);
  console.log(`\n📄 Processing: ${filename}`);
  console.log('─'.repeat(80));

  try {
    // Parse infrastructure elements using existing parser
    console.log('🔍 Extracting infrastructure elements...');
    const parser = new IFCParser();
    const result = await parser.parseFile(filePath);

    const schema = result.schema || 'Unknown';
    const projectName = result.project || filename;

    // Insert IFC model record
    const modelResult = await pool.query(`
      INSERT INTO ifc_models (
        filename, file_size, ifc_schema, project_name,
        uploaded_by, state_key, latitude, longitude,
        route, milepost, extraction_status, total_elements,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      filename,
      fs.statSync(filePath).size,
      schema,
      projectName || filename,
      metadata.uploadedBy || 'system',
      metadata.stateKey || null,
      metadata.latitude || null,
      metadata.longitude || null,
      metadata.route || null,
      metadata.milepost || null,
      'completed',
      result.elements.length,
      JSON.stringify({ filePath, ...metadata })
    ]);

    const modelId = modelResult.rows[0].id;
    console.log(`✅ Created model record (ID: ${modelId})`);
    console.log(`📊 Found ${result.elements.length} infrastructure elements`);

    // Insert infrastructure elements
    let v2xCount = 0;
    let avCount = 0;

    for (const element of result.elements) {
      if (element.v2x_applicable) v2xCount++;
      if (element.av_critical) avCount++;

      await pool.query(`
        INSERT INTO infrastructure_elements (
          model_id, ifc_guid, ifc_type, element_name, element_description,
          category, latitude, longitude, elevation,
          length, width, height, clearance,
          operational_purpose, its_relevance,
          v2x_applicable, av_critical,
          has_manufacturer, has_model, has_install_date,
          has_clearance, has_coordinates, compliance_score,
          properties, geometry_data
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
        )
      `, [
        modelId,
        element.ifc_guid,
        element.ifc_type,
        element.element_name,
        element.element_description,
        element.category,
        element.latitude,
        element.longitude,
        element.elevation,
        element.length,
        element.width,
        element.height,
        element.clearance,
        element.operational_purpose,
        element.its_relevance,
        element.v2x_applicable,
        element.av_critical,
        element.has_manufacturer,
        element.has_model,
        element.has_install_date,
        element.has_clearance,
        element.has_coordinates,
        element.compliance_score,
        JSON.stringify(element.properties),
        JSON.stringify(element.geometry_data)
      ]);
    }

    console.log(`🚦 V2X-applicable elements: ${v2xCount}`);
    console.log(`🤖 AV-critical elements: ${avCount}`);

    // Analyze gaps
    console.log('\n🔬 Analyzing gaps for ITS operations...');
    const gaps = parser.identifyGaps(result.elements);

    // Insert gaps
    for (const gap of gaps) {
      await pool.query(`
        INSERT INTO infrastructure_gaps (
          element_id, model_id, gap_type, gap_category, severity,
          missing_property, required_for, its_use_case,
          standards_reference, idm_recommendation, ids_requirement
        )
        SELECT
          id, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        FROM infrastructure_elements
        WHERE model_id = $1 AND ifc_guid = $11
        LIMIT 1
      `, [
        modelId,
        gap.gap_type,
        gap.gap_category,
        gap.severity,
        gap.missing_property,
        gap.required_for,
        gap.its_use_case,
        gap.standards_reference,
        gap.idm_recommendation,
        gap.ids_requirement,
        gap.element_guid
      ]);
    }

    console.log(`⚠️  Identified ${gaps.length} gaps`);

    // Update model with gap count
    await pool.query(`
      UPDATE ifc_models
      SET extraction_log = $1
      WHERE id = $2
    `, [
      JSON.stringify({
        elements: result.elements.length,
        v2x: v2xCount,
        av: avCount,
        gaps: gaps.length,
        timestamp: new Date().toISOString()
      }),
      modelId
    ]);

    console.log('✅ Import complete!\n');

    return {
      modelId,
      elements: result.elements.length,
      v2x: v2xCount,
      av: avCount,
      gaps: gaps.length
    };

  } catch (error) {
    console.error(`❌ Error processing ${filename}:`, error.message);
    throw error;
  }
}

async function importDirectory(directory) {
  console.log('\n🏗️  BIM FILE IMPORTER');
  console.log('='.repeat(80));
  console.log(`📂 Directory: ${directory}\n`);

  const files = fs.readdirSync(directory).filter(f => f.endsWith('.ifc'));
  console.log(`🔍 Found ${files.length} IFC files\n`);

  const results = [];

  for (const file of files) {
    const filePath = path.join(directory, file);

    // Extract metadata from filename if possible
    const metadata = {};

    // Pennsylvania bridge files
    if (file.includes('200006B12')) {
      metadata.stateKey = 'PA';
      metadata.route = 'SR0006';
      metadata.latitude = 41.6819;
      metadata.longitude = -80.1656;
    }

    // Texas roadway file
    if (file.includes('TxDOT') || file.includes('FM1977')) {
      metadata.stateKey = 'TX';
      metadata.route = 'FM1977';
    }

    const result = await importIFCFile(filePath, metadata);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(80));

  const totals = results.reduce((acc, r) => ({
    elements: acc.elements + r.elements,
    v2x: acc.v2x + r.v2x,
    av: acc.av + r.av,
    gaps: acc.gaps + r.gaps
  }), { elements: 0, v2x: 0, av: 0, gaps: 0 });

  console.log(`\n📦 Total Files Imported: ${results.length}`);
  console.log(`🏗️  Total Infrastructure Elements: ${totals.elements}`);
  console.log(`🚦 V2X-Applicable: ${totals.v2x}`);
  console.log(`🤖 AV-Critical: ${totals.av}`);
  console.log(`⚠️  Total Gaps Identified: ${totals.gaps}\n`);

  await pool.end();
}

// Main execution
if (require.main === module) {
  const directory = process.argv[2] || '/Users/mattmiller/Downloads/OneDrive_2_3-2-2026';

  importDirectory(directory)
    .then(() => {
      console.log('✅ All files imported successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Import failed:', error);
      process.exit(1);
    });
}

module.exports = { importIFCFile, importDirectory };

#!/usr/bin/env node
/**
 * Reprocess IFC models to extract infrastructure elements and V2X/AV tagging
 * This script extracts elements from IFC files that were imported but not fully processed
 */

const IFCParser = require('../utils/ifc-parser');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function reprocessModel(modelId, filename, filePath) {
  try {
    console.log(`\n📦 Processing model ${modelId}: ${filename}`);
    console.log(`   File: ${filePath}`);

    // Parse the IFC file
    const parser = new IFCParser();
    const extractionResult = await parser.parseFile(filePath);

    console.log(`   ✅ Parsed ${extractionResult.statistics.total_entities} IFC entities`);
    console.log(`   ✅ Extracted ${extractionResult.elements.length} infrastructure elements`);

    // Count V2X and AV elements
    const v2xCount = extractionResult.elements.filter(e => e.v2x_applicable).length;
    const avCount = extractionResult.elements.filter(e => e.av_critical).length;

    console.log(`   📡 V2X applicable: ${v2xCount}`);
    console.log(`   🚗 AV critical: ${avCount}`);

    // Delete existing elements for this model
    await pool.query('DELETE FROM infrastructure_elements WHERE model_id = $1', [modelId]);
    console.log(`   🗑️  Cleared existing elements`);

    // Insert infrastructure elements with dimensional data
    const elementInsert = `
      INSERT INTO infrastructure_elements (
        model_id, ifc_guid, ifc_type, element_name, element_description,
        category, latitude, longitude, elevation,
        length, width, height, clearance,
        operational_purpose, its_relevance,
        v2x_applicable, av_critical,
        has_manufacturer, has_model, has_install_date,
        has_clearance, has_coordinates, compliance_score,
        properties, geometry_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
              $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
    `;

    let insertedCount = 0;
    let withDimensions = 0;

    for (const element of extractionResult.elements) {
      const params = [
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
        element.v2x_applicable ? 1 : 0,
        element.av_critical ? 1 : 0,
        element.has_manufacturer ? 1 : 0,
        element.has_model ? 1 : 0,
        element.has_install_date ? 1 : 0,
        element.has_clearance ? 1 : 0,
        element.has_coordinates ? 1 : 0,
        element.compliance_score || 0,
        JSON.stringify(element.properties),
        JSON.stringify(element.geometry_data)
      ];

      await pool.query(elementInsert, params);
      insertedCount++;

      // Count elements with dimensional data
      if (element.width || element.height || element.clearance || element.length) {
        withDimensions++;
      }
    }

    console.log(`   📏 ${withDimensions} elements have dimensional data (${Math.round(withDimensions/insertedCount*100)}%)`)

    console.log(`   ✅ Inserted ${insertedCount} elements`);

    // Generate gap analysis with IDM/IDS recommendations
    console.log(`   🔍 Analyzing gaps for ITS operations...`);
    const gaps = parser.identifyGaps(extractionResult.elements);
    console.log(`   ✅ Identified ${gaps.length} data gaps`);

    // Delete existing gaps for this model
    await pool.query('DELETE FROM infrastructure_gaps WHERE model_id = $1', [modelId]);

    // Insert gaps
    const gapInsert = `
      INSERT INTO infrastructure_gaps (
        model_id, gap_type, gap_category, severity,
        missing_property, required_for, its_use_case, standards_reference,
        idm_recommendation, ids_requirement
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    let gapsInserted = 0;
    for (const gap of gaps) {
      await pool.query(gapInsert, [
        modelId,
        gap.gap_type,
        gap.gap_category,
        gap.severity,
        gap.missing_property,
        gap.required_for,
        gap.its_use_case,
        gap.standards_reference,
        gap.idm_recommendation,
        gap.ids_requirement
      ]);
      gapsInserted++;
    }

    console.log(`   📊 Inserted ${gapsInserted} gaps with IDM/IDS recommendations`);

    // Update model with element counts
    await pool.query(
      `UPDATE ifc_models
       SET total_elements = $1,
           extraction_log = $2,
           extraction_status = 'completed',
           updated_at = NOW()
       WHERE id = $3`,
      [
        extractionResult.elements.length,
        JSON.stringify(extractionResult.extractionLog),
        modelId
      ]
    );

    console.log(`   ✅ Updated model record`);
    return {
      success: true,
      modelId,
      filename,
      elementsExtracted: extractionResult.elements.length,
      v2xCount,
      avCount,
      gapsIdentified: gapsInserted
    };

  } catch (error) {
    console.error(`   ❌ Error processing model ${modelId}:`, error.message);
    return {
      success: false,
      modelId,
      filename,
      error: error.message
    };
  }
}

async function main() {
  try {
    console.log('🚀 Reprocessing IFC models for infrastructure element extraction\n');

    // Get all models that have file_path set (reprocess all to extract dimensional data)
    const result = await pool.query(`
      SELECT id, filename, file_path, total_elements
      FROM ifc_models
      WHERE file_path IS NOT NULL
      ORDER BY id
    `);

    const models = result.rows;
    console.log(`Found ${models.length} models to process\n`);

    const results = [];
    for (const model of models) {
      const result = await reprocessModel(model.id, model.filename, model.file_path);
      results.push(result);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 PROCESSING SUMMARY');
    console.log('='.repeat(60));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\n✅ Successfully processed: ${successful.length}`);
    successful.forEach(r => {
      console.log(`   - ${r.filename}: ${r.elementsExtracted} elements (${r.v2xCount} V2X, ${r.avCount} AV) | ${r.gapsIdentified} gaps identified`);
    });

    if (failed.length > 0) {
      console.log(`\n❌ Failed: ${failed.length}`);
      failed.forEach(r => {
        console.log(`   - ${r.filename}: ${r.error}`);
      });
    }

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();

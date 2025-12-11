#!/usr/bin/env node

const IFCParser = require('../utils/ifc-parser');
const path = require('path');

async function testExtraction() {
  const ifcFile = process.argv[2] || '/Users/mattmiller/Downloads/Aastho_IFC4.3 Bridge(Orginal Allplan Export).ifc';

  console.log('🏗️  Digital Infrastructure - IFC Extraction Test\n');
  console.log(`📄 File: ${path.basename(ifcFile)}\n`);

  const parser = new IFCParser();

  try {
    const result = await parser.parseFile(ifcFile);

    console.log('=' .repeat(80));
    console.log('EXTRACTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`IFC Schema: ${result.schema}`);
    console.log(`Project: ${result.project}`);
    console.log(`Total Entities Parsed: ${result.statistics.total_entities}`);
    console.log(`Infrastructure Elements Extracted: ${result.elements.length}\n`);

    console.log('=' .repeat(80));
    console.log('ENTITY TYPE DISTRIBUTION (Top 20)');
    console.log('='.repeat(80));
    const topTypes = Object.entries(result.statistics.by_type).slice(0, 20);
    topTypes.forEach(([type, count]) => {
      console.log(`${type.padEnd(40)} ${count.toString().padStart(8)}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('EXTRACTED INFRASTRUCTURE ELEMENTS');
    console.log('='.repeat(80));

    // Group by type
    const byType = {};
    result.elements.forEach(el => {
      if (!byType[el.ifc_type]) byType[el.ifc_type] = [];
      byType[el.ifc_type].push(el);
    });

    Object.entries(byType).forEach(([type, elements]) => {
      console.log(`\n${type} (${elements.length} elements)`);
      console.log('-'.repeat(80));

      elements.slice(0, 3).forEach(el => {
        console.log(`  GUID: ${el.ifc_guid}`);
        console.log(`  Name: ${el.element_name || 'N/A'}`);
        console.log(`  Category: ${el.category}`);
        console.log(`  ITS Relevance: ${el.its_relevance}`);
        console.log(`  V2X Applicable: ${el.v2x_applicable ? 'Yes' : 'No'}`);
        console.log(`  AV Critical: ${el.av_critical ? 'Yes' : 'No'}`);
        console.log('');
      });

      if (elements.length > 3) {
        console.log(`  ... and ${elements.length - 3} more`);
      }
    });

    // Generate gap analysis
    console.log('\n' + '='.repeat(80));
    console.log('GAP ANALYSIS - ITS OPERATIONAL NEEDS');
    console.log('='.repeat(80));

    const gaps = parser.identifyGaps(result.elements);

    // Group gaps by severity
    const bySeverity = {
      high: gaps.filter(g => g.severity === 'high'),
      medium: gaps.filter(g => g.severity === 'medium')
    };

    console.log(`\nTotal Gaps Identified: ${gaps.length}`);
    console.log(`  High Severity (AV-Critical): ${bySeverity.high.length}`);
    console.log(`  Medium Severity: ${bySeverity.medium.length}\n`);

    // Show sample gaps
    console.log('HIGH SEVERITY GAPS (AV-Critical):');
    console.log('-'.repeat(80));
    bySeverity.high.slice(0, 5).forEach(gap => {
      console.log(`\n  Missing Property: ${gap.missing_property}`);
      console.log(`  Required For: ${gap.required_for}`);
      console.log(`  ITS Use Case: ${gap.its_use_case}`);
      console.log(`  Standards: ${gap.standards_reference}`);
      console.log(`\n  IDM Recommendation:`);
      console.log(`    ${gap.idm_recommendation}`);
      console.log(`\n  IDS Requirement:`);
      console.log(`    ${gap.ids_requirement}`);
    });

    if (bySeverity.high.length > 5) {
      console.log(`\n  ... and ${bySeverity.high.length - 5} more high-severity gaps`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('STANDARDS COMPLIANCE SUMMARY');
    console.log('='.repeat(80));

    const v2xElements = result.elements.filter(e => e.v2x_applicable);
    const avElements = result.elements.filter(e => e.av_critical);

    console.log(`\nV2X-Applicable Elements: ${v2xElements.length}`);
    console.log(`AV-Critical Elements: ${avElements.length}`);
    console.log(`\nElements Requiring Enhanced Properties for ITS Operations:`);
    console.log(`  - ${bySeverity.high.length} high-priority gaps (AV routing, safety)`);
    console.log(`  - ${bySeverity.medium.length} medium-priority gaps (optimization)`);

    console.log('\n' + '='.repeat(80));
    console.log('DIGITAL INFRASTRUCTURE MATURITY ASSESSMENT');
    console.log('='.repeat(80));

    const totalRequired = gaps.length;
    const percentComplete = totalRequired > 0 ? 0 : 100; // No elements have the required props yet

    console.log(`\nCurrent BIM Model provides: ${result.elements.length} infrastructure elements`);
    console.log(`ITS Operations require: ${totalRequired} additional properties`);
    console.log(`Digital Infrastructure Readiness: ${percentComplete}%`);
    console.log(`\nRecommendations:`);
    console.log(`  1. Implement IDM requirements for ITS-critical properties`);
    console.log(`  2. Add IDS validation rules to ensure data quality`);
    console.log(`  3. Include operational properties in BIM authoring workflows`);
    console.log(`  4. Integrate with V2X systems for real-time infrastructure data`);

    console.log('\n' + '='.repeat(80));
    console.log('EXTRACTION LOG');
    console.log('='.repeat(80));
    result.extractionLog.forEach(log => console.log(log));

    console.log('\n✅ Extraction complete!');
    console.log(`\nThis analysis demonstrates what BIM models currently provide vs.`);
    console.log(`what ITS operations actually need. Use this to inform IDM/IDS development.`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testExtraction();

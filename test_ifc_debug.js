#!/usr/bin/env node
/**
 * Debug script to test dimensional property extraction
 */

const IFCParser = require('./utils/ifc-parser');

async function testExtraction() {
  const parser = new IFCParser();

  // Test with the French Creek Bridge model
  const filePath = '/Users/mattmiller/Downloads/OneDrive_2_3-2-2026/_200006B12_STR1-Primary Bridge Model.ifc';

  console.log('Starting parse...');
  const result = await parser.parseFile(filePath);

  console.log(`\nExtracted ${result.elements.length} elements`);

  // Find elements with dimensional data
  const withDimensions = result.elements.filter(e =>
    e.width || e.height || e.length || e.clearance
  );

  console.log(`${withDimensions.length} have dimensional data`);

  // Show first few elements with details
  console.log('\nFirst 5 elements:');
  result.elements.slice(0, 5).forEach((e, idx) => {
    console.log(`\n${idx + 1}. ${e.ifc_type} - ${e.element_name || 'Unnamed'}`);
    console.log(`   GUID: ${e.ifc_guid}`);
    console.log(`   Width: ${e.width || 'null'}`);
    console.log(`   Height: ${e.height || 'null'}`);
    console.log(`   Length: ${e.length || 'null'}`);
    console.log(`   Clearance: ${e.clearance || 'null'}`);
    console.log(`   Properties keys: ${Object.keys(e.properties || {}).join(', ')}`);
  });

  // Show elements WITH dimensions if any
  if (withDimensions.length > 0) {
    console.log('\n\nElements WITH dimensions:');
    withDimensions.slice(0, 3).forEach((e, idx) => {
      console.log(`\n${idx + 1}. ${e.ifc_type} - ${e.element_name}`);
      console.log(`   Width: ${e.width}, Height: ${e.height}, Length: ${e.length}, Clearance: ${e.clearance}`);
    });
  }
}

testExtraction().catch(console.error);

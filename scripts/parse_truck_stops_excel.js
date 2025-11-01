// Parse truck stops Excel file to extract GPS coordinates
const xlsx = require('xlsx');
const path = require('path');

async function parseTruckStopsExcel() {
  try {
    const excelPath = path.join(__dirname, '../TruckStopsExport/TruckStopsExport.xlsx');
    console.log(`📂 Reading Excel file: ${excelPath}\n`);

    // Read the Excel file
    const workbook = xlsx.readFile(excelPath);

    console.log(`📋 Worksheets found: ${workbook.SheetNames.join(', ')}\n`);

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      console.log(`\n📊 Sheet: ${sheetName}`);
      console.log('='.repeat(50));

      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);

      console.log(`   Total rows: ${data.length}`);

      if (data.length > 0) {
        // Show column names
        console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);

        // Show first 3 rows as sample
        console.log('\n   Sample data:');
        data.slice(0, 3).forEach((row, idx) => {
          console.log(`\n   Row ${idx + 1}:`);
          for (const [key, value] of Object.entries(row)) {
            console.log(`     ${key}: ${value}`);
          }
        });

        // Check for coordinate columns
        const firstRow = data[0];
        const coordColumns = Object.keys(firstRow).filter(col =>
          col.toLowerCase().includes('lat') ||
          col.toLowerCase().includes('lon') ||
          col.toLowerCase().includes('coord')
        );

        if (coordColumns.length > 0) {
          console.log(`\n   ✅ Found coordinate columns: ${coordColumns.join(', ')}`);
        } else {
          console.log('\n   ⚠️  No obvious coordinate columns found');
        }

        // Check for state column
        const stateColumns = Object.keys(firstRow).filter(col =>
          col.toLowerCase().includes('state')
        );

        if (stateColumns.length > 0) {
          console.log(`   ✅ Found state column: ${stateColumns.join(', ')}`);

          // Count by state
          const stateCount = {};
          data.forEach(row => {
            const state = row[stateColumns[0]];
            if (state) {
              stateCount[state] = (stateCount[state] || 0) + 1;
            }
          });

          console.log('\n   📍 Facilities by state:');
          for (const [state, count] of Object.entries(stateCount).sort()) {
            console.log(`      ${state}: ${count}`);
          }
        }
      }
    }

    console.log('\n\n✅ Excel file parsed successfully\n');

  } catch (error) {
    console.error('❌ Error parsing Excel file:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  parseTruckStopsExcel();
}

module.exports = { parseTruckStopsExcel };

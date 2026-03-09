/**
 * Test CADD Parser
 * Tests DXF parsing and operational element extraction
 */

const CADDParser = require('./utils/cad-parser');
const fs = require('fs');
const path = require('path');

// Create a simple test DXF file
function createTestDXF() {
  const testDXF = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
9
$INSUNITS
70
1
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
0
62
7
6
Continuous
0
LAYER
2
TRAFFIC-SIGNAL
62
1
6
Continuous
0
LAYER
2
SIGN
62
3
6
Continuous
0
LAYER
2
CENTERLINE
62
2
6
Continuous
0
LAYER
2
DMS
62
4
6
Continuous
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
CENTERLINE
10
0.0
20
0.0
11
100.0
21
0.0
0
POINT
8
TRAFFIC-SIGNAL
10
25.0
20
10.0
0
POINT
8
SIGN
10
50.0
20
15.0
0
POINT
8
DMS
10
75.0
20
5.0
0
POLYLINE
8
CENTERLINE
66
1
10
0.0
20
0.0
0
VERTEX
8
CENTERLINE
10
0.0
20
0.0
0
VERTEX
8
CENTERLINE
10
50.0
20
5.0
0
VERTEX
8
CENTERLINE
10
100.0
20
0.0
0
SEQEND
0
TEXT
8
SIGN
10
50.0
20
15.0
40
2.0
1
SPEED LIMIT 55
0
ENDSEC
0
EOF
`;

  const testFilePath = path.join(__dirname, 'test_sample.dxf');
  fs.writeFileSync(testFilePath, testDXF);
  return testFilePath;
}

async function runTest() {
  console.log('🧪 Testing CADD Parser\n');
  console.log('='.repeat(70));

  // Create test DXF file
  console.log('\n📁 Creating test DXF file...');
  const testFile = createTestDXF();
  console.log(`   ✅ Created: ${testFile}`);

  // Parse the file
  console.log('\n🔍 Parsing DXF file...');
  const parser = new CADDParser();

  try {
    const result = await parser.parseFile(testFile);

    console.log('\n📊 Parsing Results:');
    console.log('='.repeat(70));

    console.log(`\n📄 File Format: ${result.format}`);
    console.log(`   CAD Version: ${result.metadata.version}`);
    console.log(`   Units: ${result.metadata.units}`);

    console.log(`\n🗂️  Layers: ${result.layers.length}`);
    result.layers.forEach(layer => {
      console.log(`   • ${layer.name} (${layer.entityCount} entities)`);
    });

    console.log(`\n📐 Entities: ${result.entities.length}`);
    const entityBreakdown = result.statistics.entityTypes;
    for (const [type, count] of Object.entries(entityBreakdown)) {
      console.log(`   • ${type}: ${count}`);
    }

    console.log(`\n🚦 ITS Equipment: ${result.itsEquipment.length}`);
    result.itsEquipment.forEach(equipment => {
      console.log(`   • ${equipment.type} on layer "${equipment.layer}"`);
      if (equipment.text) {
        console.log(`     Text: "${equipment.text}"`);
      }
    });

    console.log(`\n🛣️  Road Geometry: ${result.roadGeometry.length}`);
    result.roadGeometry.forEach(geom => {
      console.log(`   • ${geom.type} on layer "${geom.layer}"`);
    });

    console.log(`\n📈 Statistics:`);
    console.log(`   Total Entities: ${result.statistics.totalEntities}`);
    console.log(`   Total Layers: ${result.statistics.totalLayers}`);
    console.log(`   Total Blocks: ${result.statistics.totalBlocks}`);
    console.log(`   ITS Equipment: ${result.statistics.itsEquipment}`);
    console.log(`   Road Geometry: ${result.statistics.roadGeometry}`);
    console.log(`   Traffic Devices: ${result.statistics.trafficDevices}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ CADD Parser Test PASSED!\n');

    // Cleanup test file
    fs.unlinkSync(testFile);

    return result;

  } catch (error) {
    console.error('\n❌ Test FAILED:', error.message);
    console.error(error.stack);

    // Cleanup test file
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }

    throw error;
  }
}

// Run test
if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = { runTest };

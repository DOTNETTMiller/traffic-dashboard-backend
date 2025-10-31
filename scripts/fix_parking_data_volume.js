// Fix stale parking data on Railway persistent volume
// Deletes the old "fallback-empty" file and ensures real data is used

const fs = require('fs');
const path = require('path');

async function fixParkingDataVolume() {
  console.log('\n🔧 Fixing Parking Data Volume\n');

  const volumePath = path.join(__dirname, '../data/truck_parking_patterns.json');

  console.log(`📂 Checking file: ${volumePath}`);

  if (!fs.existsSync(volumePath)) {
    console.log('❌ File does not exist');
    return;
  }

  // Read the existing file
  const rawData = fs.readFileSync(volumePath, 'utf8');
  const data = JSON.parse(rawData);

  console.log(`📊 Current file size: ${rawData.length} bytes`);
  console.log(`📦 Facilities: ${data.facilities?.length || 0}`);
  console.log(`📦 Patterns: ${data.patterns?.length || 0}`);

  // Check if this is the fallback-empty file
  if (data.source === 'fallback-empty' || (data.facilities?.length === 0 && rawData.length < 1000)) {
    console.log('\n⚠️  Detected stale "fallback-empty" file from old deployment');
    console.log('🗑️  Deleting stale file...');

    fs.unlinkSync(volumePath);

    console.log('✅ Stale file deleted');
    console.log('\n💡 The real 772KB file from git will be used on next server restart');
    console.log('💡 To populate the database, run: node scripts/migrate_parking_to_db.js\n');
  } else {
    console.log('\n✅ File looks good - has real data');
    console.log(`   ${data.facilities.length} facilities, ${data.patterns.length} patterns\n`);
  }
}

if (require.main === module) {
  fixParkingDataVolume().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { fixParkingDataVolume };

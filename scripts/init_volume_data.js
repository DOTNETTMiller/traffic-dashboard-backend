// Initialize volume data from bundled sources
// This ensures data files are available on Railway's persistent volume

const fs = require('fs');
const path = require('path');

function initVolumeData() {
  console.log('\n🔄 Initializing volume data...\n');

  const bundledFile = path.join(__dirname, '../bundled_data/truck_parking_patterns.json');
  const volumeDir = path.join(__dirname, '../data');
  const volumeFile = path.join(volumeDir, 'truck_parking_patterns.json');

  // Create data directory if needed
  if (!fs.existsSync(volumeDir)) {
    console.log(`📁 Creating data directory: ${volumeDir}`);
    fs.mkdirSync(volumeDir, { recursive: true });
  }

  // Check if file exists on volume
  if (fs.existsSync(volumeFile)) {
    const stats = fs.statSync(volumeFile);
    console.log(`✅ Data file already exists on volume (${(stats.size/1024).toFixed(2)} KB)`);
    return;
  }

  // Copy bundled file to volume
  if (!fs.existsSync(bundledFile)) {
    console.error(`❌ Bundled file not found: ${bundledFile}`);
    process.exit(1);
  }

  console.log(`📦 Copying bundled data to volume...`);
  console.log(`   From: ${bundledFile}`);
  console.log(`   To: ${volumeFile}`);

  fs.copyFileSync(bundledFile, volumeFile);

  const stats = fs.statSync(volumeFile);
  console.log(`✅ Data file copied successfully (${(stats.size/1024).toFixed(2)} KB)\n`);
}

if (require.main === module) {
  try {
    initVolumeData();
  } catch (error) {
    console.error('❌ Failed to initialize volume data:', error);
    process.exit(1);
  }
}

module.exports = { initVolumeData };

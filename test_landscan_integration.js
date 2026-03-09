#!/usr/bin/env node
/**
 * Test LandScan Google Earth Engine Integration
 *
 * This script verifies that:
 * 1. Google Earth Engine package is installed
 * 2. PopulationDensityService initializes correctly
 * 3. LandScan integration is properly wired
 * 4. Configuration is correctly detected
 */

console.log('🧪 Testing LandScan Google Earth Engine Integration\n');

// Test 1: Check if Earth Engine package is available
console.log('1️⃣  Checking @google/earthengine package...');
try {
  const ee = require('@google/earthengine');
  console.log('   ✅ Package installed successfully');
  console.log(`   📦 Version: ${require('./node_modules/@google/earthengine/package.json').version}`);
} catch (error) {
  console.log('   ❌ Package not found:', error.message);
  console.log('   💡 Run: npm install --save @google/earthengine');
  process.exit(1);
}

// Test 2: Check PopulationDensityService
console.log('\n2️⃣  Checking PopulationDensityService...');
try {
  const service = require('./services/population-density-service');
  console.log('   ✅ Service loaded successfully (singleton instance)');

  // Check configuration
  console.log('\n3️⃣  Checking LandScan configuration...');
  const landscanConfig = service.dataSources.landscan;

  console.log('   Configuration:');
  console.log(`     GEE Service Account: ${landscanConfig.geeServiceAccount ? '✅ Set' : '⚠️  Not set'}`);
  console.log(`     GEE Private Key: ${landscanConfig.geePrivateKey ? '✅ Set' : '⚠️  Not set'}`);
  console.log(`     LandScan Enabled: ${landscanConfig.enabled ? '✅ Yes' : '❌ No'}`);

  if (!landscanConfig.enabled) {
    console.log('\n   ℹ️  To enable LandScan via Google Earth Engine:');
    console.log('      1. Follow setup guide: docs/LANDSCAN_GOOGLE_EARTH_ENGINE_SETUP.md');
    console.log('      2. Create Google Cloud service account');
    console.log('      3. Register with Earth Engine (free)');
    console.log('      4. Set environment variables:');
    console.log('         railway variables set GEE_SERVICE_ACCOUNT=your-service-account@project.iam.gserviceaccount.com');
    console.log('         railway variables set GEE_PRIVATE_KEY=your_base64_encoded_json');
  }

  // Check other data sources
  console.log('\n4️⃣  Checking other data sources...');
  console.log(`   Census API: ${service.dataSources.census.enabled ? '✅ Enabled' : '⚠️  Disabled'}`);
  console.log(`   OpenStreetMap: ${service.dataSources.osm.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Iowa State GIS: ${service.dataSources.stateGIS.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Estimation: ${service.dataSources.estimation.enabled ? '✅ Enabled' : '❌ Disabled'}`);

  // Test 3: Check Earth Engine initialization state
  console.log('\n5️⃣  Checking Earth Engine initialization...');
  if (landscanConfig.enabled) {
    console.log('   🔄 Earth Engine initialization triggered...');
    console.log('   ⏳ Waiting for initialization (this may take a few seconds)...');

    // Wait for initialization to complete
    setTimeout(() => {
      if (service.eeInitialized) {
        console.log('   ✅ Earth Engine initialized successfully!');
        console.log('   🎉 LandScan queries are ready!');
      } else if (service.eeInitializing) {
        console.log('   ⏳ Earth Engine still initializing...');
      } else {
        console.log('   ❌ Earth Engine initialization failed');
        console.log('   💡 Check your service account credentials');
      }

      console.log('\n' + '='.repeat(80));
      console.log('✅ INTEGRATION TEST COMPLETE');
      console.log('='.repeat(80));
      console.log('\nNext Steps:');

      if (landscanConfig.enabled && service.eeInitialized) {
        console.log('  ✅ LandScan is ready to use!');
        console.log('  📊 Run: node scripts/test_enhanced_population.js');
        console.log('  🎯 IPAWS alerts will now use LandScan data (very high confidence)');
      } else if (landscanConfig.enabled) {
        console.log('  ⚠️  LandScan enabled but initialization failed');
        console.log('  🔍 Check console output above for errors');
        console.log('  📖 Review: docs/LANDSCAN_GOOGLE_EARTH_ENGINE_SETUP.md');
      } else {
        console.log('  ℹ️  LandScan not configured (optional)');
        console.log('  📊 System will use Census + OSM + Iowa GIS (high confidence)');
        console.log('  🚀 To enable LandScan: docs/LANDSCAN_GOOGLE_EARTH_ENGINE_SETUP.md');
      }

      console.log('\n📚 Documentation:');
      console.log('  - Setup Guide: docs/LANDSCAN_GOOGLE_EARTH_ENGINE_SETUP.md');
      console.log('  - Integration Summary: LANDSCAN_INTEGRATION_COMPLETE.md');
      console.log('  - Enhanced Data Sources: docs/IPAWS_ENHANCED_DATA_SOURCES.md\n');
    }, 3000);
  } else {
    console.log('   ⏭️  Skipped (LandScan not configured)');

    console.log('\n' + '='.repeat(80));
    console.log('✅ INTEGRATION TEST COMPLETE');
    console.log('='.repeat(80));
    console.log('\nCurrent Status:');
    console.log('  ℹ️  LandScan not configured (optional)');
    console.log('  ✅ System will use Census + OSM + Iowa GIS');
    console.log('  🎯 Confidence: High (without LandScan)');
    console.log('\nTo Enable LandScan (Very High Confidence):');
    console.log('  📖 Follow guide: docs/LANDSCAN_GOOGLE_EARTH_ENGINE_SETUP.md');
    console.log('  ⏱️  Setup time: ~30 minutes');
    console.log('  💰 Cost: FREE for government use');
    console.log('  📊 Accuracy: ★★★★★ (1km resolution)\n');
  }

} catch (error) {
  console.log('   ❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}

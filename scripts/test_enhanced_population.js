#!/usr/bin/env node
/**
 * Test Enhanced Population Data Sources
 *
 * Demonstrates integration with:
 * - LandScan (Oak Ridge National Lab)
 * - US Census Bureau
 * - OpenStreetMap
 * - Iowa State GIS
 */

const populationService = require('../services/population-density-service');
const turf = require('@turf/turf');

// Test scenarios
const testScenarios = [
  {
    name: 'I-80 West of Iowa City (Rural Interstate)',
    description: 'Simulate crash on rural interstate - should have low population',
    center: [-91.8, 41.6], // West of Iowa City on I-80
    radius: 3, // miles
    expectedProfile: 'rural'
  },
  {
    name: 'Des Moines Metro (Urban)',
    description: 'Downtown Des Moines - should detect high urban population',
    center: [-93.6250, 41.5868], // Des Moines downtown
    radius: 5,
    expectedProfile: 'urban'
  },
  {
    name: 'Cedar Rapids Corridor (Suburban)',
    description: 'I-380 through Cedar Rapids - mixed urban/highway',
    center: [-91.6656, 41.9779],
    radius: 4,
    expectedProfile: 'suburban'
  }
];

async function testScenario(scenario) {
  console.log('\n' + '='.repeat(80));
  console.log(`📍 TESTING: ${scenario.name}`);
  console.log(`   ${scenario.description}`);
  console.log('='.repeat(80));

  // Create circular geofence
  const geofence = turf.circle(scenario.center, scenario.radius, { units: 'miles' });

  console.log(`\n🔹 Geofence: ${scenario.radius} mile radius around [${scenario.center}]`);

  // Test 1: Basic Estimation (always available)
  console.log('\n1️⃣  BASIC ESTIMATION (Fallback Method)');
  console.log('─'.repeat(60));
  const estimation = populationService.estimatePopulation(geofence);
  console.log(`   Total Population: ${estimation.total.toLocaleString()}`);
  console.log(`   Urban: ${estimation.urban.toLocaleString()} | Rural: ${estimation.rural.toLocaleString()}`);
  console.log(`   Density: ${Math.round(estimation.density)} people/sq mi`);
  console.log(`   Classification: ${estimation.classification}`);
  console.log(`   Area: ${estimation.areaSquareMiles.toFixed(2)} sq mi`);
  if (estimation.affectedCities.length > 0) {
    console.log(`   Affected Cities:`);
    estimation.affectedCities.forEach(city => {
      console.log(`     - ${city.name}: ${city.population.toLocaleString()} people (${city.overlapPercent.toFixed(1)}% overlap)`);
    });
  }

  // Test 2: Enhanced Multi-Source Query
  console.log('\n2️⃣  ENHANCED MULTI-SOURCE QUERY');
  console.log('─'.repeat(60));
  try {
    const enhanced = await populationService.getEnhancedPopulation(geofence);

    console.log(`   📊 Best Population Estimate: ${enhanced.population.toLocaleString()}`);
    console.log(`   🎯 Primary Source: ${enhanced.primarySource}`);
    console.log(`   ✅ Confidence: ${enhanced.confidence.toUpperCase()}`);
    console.log(`   📡 Sources Queried: ${enhanced.sourcesQueried}`);

    // Show detailed source results
    if (enhanced.sources.landscan) {
      console.log('\n   🛰️  LANDSCAN (Oak Ridge National Lab):');
      console.log(`      Total: ${enhanced.sources.landscan.total.toLocaleString()}`);
      console.log(`      Nighttime: ${enhanced.sources.landscan.nighttime?.toLocaleString() || 'N/A'}`);
      console.log(`      Daytime: ${enhanced.sources.landscan.daytime?.toLocaleString() || 'N/A'}`);
      console.log(`      Resolution: ${enhanced.sources.landscan.resolution}`);
    }

    if (enhanced.sources.census) {
      console.log('\n   🏛️  US CENSUS BUREAU:');
      console.log(`      Total: ${enhanced.sources.census.total.toLocaleString()}`);
      console.log(`      Tracts: ${enhanced.sources.census.tracts?.length || 0}`);
      if (enhanced.sources.census.tracts?.length > 0) {
        console.log(`      Sample Tracts:`);
        enhanced.sources.census.tracts.slice(0, 3).forEach(tract => {
          console.log(`        - ${tract.name}: ${tract.population.toLocaleString()} people`);
        });
      }
    }

    if (enhanced.sources.osm) {
      console.log('\n   🗺️  OPENSTREETMAP:');
      console.log(`      Urban Areas: ${enhanced.sources.osm.urbanAreas.length}`);
      console.log(`      Cities/Towns: ${enhanced.sources.osm.boundariesFound}`);
      console.log(`      Land Use Areas: ${enhanced.sources.osm.landUseAreas}`);
      if (enhanced.sources.osm.urbanAreas.length > 0) {
        console.log(`      Sample Areas:`);
        enhanced.sources.osm.urbanAreas.slice(0, 3).forEach(area => {
          const pop = area.population ? `${area.population.toLocaleString()} people` : 'population unknown';
          console.log(`        - ${area.name} (${area.type}): ${pop}`);
        });
      }
    }

    if (enhanced.sources.iowaGIS) {
      console.log('\n   🌾  IOWA STATE GIS:');
      console.log(`      Total Population: ${enhanced.sources.iowaGIS.totalPopulation.toLocaleString()}`);
      console.log(`      Municipalities: ${enhanced.sources.iowaGIS.municipalities.length}`);
      if (enhanced.sources.iowaGIS.municipalities.length > 0) {
        console.log(`      Affected Municipalities:`);
        enhanced.sources.iowaGIS.municipalities.forEach(muni => {
          console.log(`        - ${muni.name}, ${muni.county} County: ${muni.population.toLocaleString()} people`);
        });
      }
      if (enhanced.sources.iowaGIS.landUse) {
        console.log(`      Land Use:`);
        console.log(`        - Residential: ${Math.round(enhanced.sources.iowaGIS.landUse.residential).toLocaleString()} acres`);
        console.log(`        - Commercial: ${Math.round(enhanced.sources.iowaGIS.landUse.commercial).toLocaleString()} acres`);
        console.log(`        - Agricultural: ${Math.round(enhanced.sources.iowaGIS.landUse.agricultural).toLocaleString()} acres`);
      }
    }

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  // Test 3: Urban Area Identification
  console.log('\n3️⃣  URBAN AREA IDENTIFICATION & EXCLUSION');
  console.log('─'.repeat(60));
  const urbanAreas = populationService.identifyUrbanAreas(geofence);
  console.log(`   Found ${urbanAreas.length} urban areas within geofence`);

  if (urbanAreas.length > 0) {
    urbanAreas.forEach(urban => {
      console.log(`   - ${urban.name}:`);
      console.log(`     Population: ${urban.population.toLocaleString()}`);
      console.log(`     Density: ${Math.round(urban.density).toLocaleString()} people/sq mi`);
      console.log(`     Should Exclude: ${urban.shouldExclude ? 'YES' : 'NO'}`);
    });

    // Test urban exclusion
    const excluded = populationService.excludeUrbanAreas(geofence, 5000);
    console.log(`\n   📉 After Urban Exclusion (max 5,000 people):`);
    console.log(`      Excluded Cities: ${excluded.excluded.join(', ') || 'None'}`);
    console.log(`      New Population: ${excluded.population.total.toLocaleString()}`);
    console.log(`      Reduction: ${100 - excluded.reductionPercent}%`);
  } else {
    console.log(`   ✅ No urban areas detected - ideal for highway alert`);
  }

  // Validation
  console.log('\n4️⃣  VALIDATION');
  console.log('─'.repeat(60));
  const expectedLow = scenario.expectedProfile === 'rural';
  const expectedHigh = scenario.expectedProfile === 'urban';
  const actualDensity = estimation.density;

  if (expectedLow && actualDensity < 500) {
    console.log(`   ✅ PASS: Low density confirmed (${Math.round(actualDensity)} people/sq mi)`);
  } else if (expectedHigh && actualDensity > 2000) {
    console.log(`   ✅ PASS: High density confirmed (${Math.round(actualDensity)} people/sq mi)`);
  } else if (scenario.expectedProfile === 'suburban' && actualDensity >= 500 && actualDensity <= 2000) {
    console.log(`   ✅ PASS: Suburban density confirmed (${Math.round(actualDensity)} people/sq mi)`);
  } else {
    console.log(`   ⚠️  NOTICE: Density is ${Math.round(actualDensity)} people/sq mi (expected ${scenario.expectedProfile})`);
  }
}

async function main() {
  console.log('\n🧪 ENHANCED POPULATION DATA SOURCE TESTING\n');
  console.log('This script tests integration with:');
  console.log('  • LandScan Global (Oak Ridge National Lab)');
  console.log('  • US Census Bureau (Official Census Data)');
  console.log('  • OpenStreetMap (Community Geographic Data)');
  console.log('  • Iowa State GIS (Iowa-Specific Data)');
  console.log('  • Estimation (Fallback Method)\n');

  // Check configuration
  console.log('📋 CONFIGURATION:');
  console.log('─'.repeat(60));
  const config = populationService.dataSources;
  console.log(`   Census API: ${config.census.enabled ? '✅ Enabled' : '⚠️  Disabled (set CENSUS_API_KEY)'}`);
  console.log(`   LandScan: ${config.landscan.enabled ? '✅ Enabled' : '⚠️  Disabled (set LANDSCAN_API_KEY)'}`);
  console.log(`   OpenStreetMap: ${config.osm.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Iowa State GIS: ${config.stateGIS.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Estimation: ${config.estimation.enabled ? '✅ Enabled' : '❌ Disabled'}`);

  // Run test scenarios
  for (const scenario of testScenarios) {
    await testScenario(scenario);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ TESTING COMPLETE');
  console.log('='.repeat(80));
  console.log('\nNext Steps:');
  console.log('  1. Configure API keys in .env file for enhanced accuracy');
  console.log('  2. Review population estimates for your specific use cases');
  console.log('  3. Integrate enhanced data into IPAWS alert generation');
  console.log('\nFor more information: docs/IPAWS_ENHANCED_DATA_SOURCES.md\n');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testScenario };

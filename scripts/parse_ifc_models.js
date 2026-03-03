/**
 * IFC BIM Model Parser for DOT Corridor Communicator
 *
 * Extracts bridge and infrastructure data from IFC files
 * and maps them to the corridor dashboard
 */

const fs = require('fs');
const path = require('path');

class IFCParser {
  constructor() {
    this.models = [];
  }

  /**
   * Parse IFC file header for project metadata and coordinates
   */
  parseIFC(filePath) {
    console.log(`\n📄 Parsing IFC file: ${path.basename(filePath)}`);

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    const model = {
      fileName: path.basename(filePath),
      filePath: filePath,
      projectName: null,
      coordinates: {
        latitude: null,
        longitude: null,
        stateplane: {
          northing: null,
          easting: null
        }
      },
      location: {
        route: null,
        county: null,
        city: null,
        state: null,
        district: null
      },
      bridge: {
        name: null,
        spans: null,
        supports: null,
        averageDailyTraffic: null,
        designSpeed: null,
        postedSpeed: null,
        verticalClearance: null
      },
      crs: null,
      properties: {}
    };

    // Parse each line for relevant data
    for (const line of lines) {
      // Project name
      if (line.includes('IFCPROJECT')) {
        const match = line.match(/,'([^']+)',/);
        if (match) model.projectName = match[1];
      }

      // GPS Coordinates
      if (line.includes("IFCPROPERTYSINGLEVALUE('Latitude'")) {
        const match = line.match(/IFCREAL\(([-\d.]+)\)/);
        if (match) model.coordinates.latitude = parseFloat(match[1]);
      }
      if (line.includes("IFCPROPERTYSINGLEVALUE('Longitude'")) {
        const match = line.match(/IFCREAL\(([-\d.]+)\)/);
        if (match) model.coordinates.longitude = parseFloat(match[1]);
      }

      // State Plane Coordinates
      if (line.includes('IFCCARTESIANPOINT')) {
        const match = line.match(/IFCCARTESIANPOINT\(\(([-\d.]+),([-\d.]+),([-\d.]+)\)\)/);
        if (match && !model.coordinates.stateplane.easting) {
          model.coordinates.stateplane.easting = parseFloat(match[1]);
          model.coordinates.stateplane.northing = parseFloat(match[2]);
        }
      }

      // Coordinate Reference System
      if (line.includes('IFCPROJECTEDCRS')) {
        const match = line.match(/IFCPROJECTEDCRS\('([^']+)','([^']+)'/);
        if (match) {
          model.crs = {
            code: match[1],
            name: match[2]
          };
        }
      }

      // Location data
      if (line.includes("IFCPROPERTYSINGLEVALUE('Route'")) {
        const match = line.match(/IFCTEXT\('([^']+)'\)/);
        if (match) model.location.route = match[1];
      }
      if (line.includes("IFCPROPERTYSINGLEVALUE('County'")) {
        const match = line.match(/IFCTEXT\('([^']+)'\)/);
        if (match) model.location.county = match[1];
      }
      if (line.includes("IFCPROPERTYSINGLEVALUE('City/Village'")) {
        const match = line.match(/IFCTEXT\('([^']+)'\)/);
        if (match) model.location.city = match[1];
      }
      if (line.includes("IFCPROPERTYSINGLEVALUE('State'")) {
        const match = line.match(/IFCTEXT\('([^']+)'\)/);
        if (match) model.location.state = match[1];
      }
      if (line.includes("IFCPROPERTYSINGLEVALUE('District'")) {
        const match = line.match(/IFCTEXT\('([^']+)'\)/);
        if (match) model.location.district = match[1];
      }

      // Bridge data
      if (line.includes("IFCPROPERTYSINGLEVALUE('Name'") && line.includes('French')) {
        const match = line.match(/IFCTEXT\('([^']+)'\)/);
        if (match) model.bridge.name = match[1];
      }
      if (line.includes("IFCPROPERTYSINGLEVALUE('NumberOfSpans'")) {
        const match = line.match(/IFCINTEGER\((\d+)\)/);
        if (match) model.bridge.spans = parseInt(match[1]);
      }
      if (line.includes("IFCPROPERTYSINGLEVALUE('NumberOfSupports'")) {
        const match = line.match(/IFCINTEGER\((\d+)\)/);
        if (match) model.bridge.supports = parseInt(match[1]);
      }
      if (line.includes("IFCPROPERTYSINGLEVALUE('AverageDailyTraffic'")) {
        const match = line.match(/IFCINTEGER\((\d+)\)/);
        if (match) model.bridge.averageDailyTraffic = parseInt(match[1]);
      }
      if (line.includes("IFCPROPERTYSINGLEVALUE('DesignSpeed'")) {
        const match = line.match(/IFCINTEGER\((\d+)\)/);
        if (match) model.bridge.designSpeed = parseInt(match[1]);
      }
      if (line.includes("IFCPROPERTYSINGLEVALUE('Posted Speed")) {
        const match = line.match(/IFCREAL\(([\d.]+)\)/);
        if (match) model.bridge.postedSpeed = parseInt(match[1]);
      }
      if (line.includes("IFCPROPERTYSINGLEVALUE('MinimumVerticalClearance")) {
        const match = line.match(/IFCREAL\(([\d.]+)\)/);
        if (match) model.bridge.verticalClearance = parseFloat(match[1]);
      }
    }

    this.models.push(model);
    return model;
  }

  /**
   * Generate summary report
   */
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('BIM MODEL EXTRACTION REPORT');
    console.log('='.repeat(80));

    for (const model of this.models) {
      console.log(`\n📊 ${model.fileName}`);
      console.log('─'.repeat(80));

      console.log(`\n🏗️  PROJECT: ${model.projectName}`);

      if (model.bridge.name) {
        console.log(`\n🌉 BRIDGE:`);
        console.log(`   Name: ${model.bridge.name}`);
        console.log(`   Spans: ${model.bridge.spans || 'N/A'}`);
        console.log(`   Supports: ${model.bridge.supports || 'N/A'}`);
        console.log(`   ADT: ${model.bridge.averageDailyTraffic?.toLocaleString() || 'N/A'} vehicles/day`);
        console.log(`   Design Speed: ${model.bridge.designSpeed || 'N/A'} mph`);
        console.log(`   Posted Speed: ${model.bridge.postedSpeed || 'N/A'} mph`);
        console.log(`   Min Clearance: ${model.bridge.verticalClearance || 'N/A'} ft`);
      }

      console.log(`\n📍 LOCATION:`);
      console.log(`   Route: ${model.location.route || 'N/A'}`);
      console.log(`   City: ${model.location.city || 'N/A'}`);
      console.log(`   County: ${model.location.county || 'N/A'}`);
      console.log(`   State: ${model.location.state || 'N/A'}`);
      console.log(`   District: ${model.location.district || 'N/A'}`);

      console.log(`\n🗺️  COORDINATES:`);
      console.log(`   GPS: ${model.coordinates.latitude}, ${model.coordinates.longitude}`);
      console.log(`   State Plane: E ${model.coordinates.stateplane.easting}, N ${model.coordinates.stateplane.northing}`);
      console.log(`   CRS: ${model.crs?.name || 'N/A'} (${model.crs?.code || 'N/A'})`);
    }

    console.log('\n' + '='.repeat(80));
  }

  /**
   * Export to GeoJSON for mapping
   */
  exportToGeoJSON(outputPath) {
    const features = this.models
      .filter(m => m.coordinates.latitude && m.coordinates.longitude)
      .map(model => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [model.coordinates.longitude, model.coordinates.latitude]
        },
        properties: {
          type: 'BIM_Bridge',
          name: model.bridge.name || model.projectName,
          fileName: model.fileName,
          route: model.location.route,
          county: model.location.county,
          city: model.location.city,
          state: model.location.state,
          district: model.location.district,
          spans: model.bridge.spans,
          supports: model.bridge.supports,
          adt: model.bridge.averageDailyTraffic,
          designSpeed: model.bridge.designSpeed,
          postedSpeed: model.bridge.postedSpeed,
          clearance: model.bridge.verticalClearance,
          crs: model.crs?.code,
          stateplane: model.coordinates.stateplane
        }
      }));

    const geoJSON = {
      type: 'FeatureCollection',
      name: 'BIM_Models',
      crs: {
        type: 'name',
        properties: {
          name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
        }
      },
      features
    };

    fs.writeFileSync(outputPath, JSON.stringify(geoJSON, null, 2));
    console.log(`\n✅ Exported ${features.length} BIM models to ${outputPath}`);

    return geoJSON;
  }
}

// Main execution
if (require.main === module) {
  const parser = new IFCParser();

  // Parse all IFC files in the OneDrive directory
  const bimDir = '/Users/mattmiller/Downloads/OneDrive_2_3-2-2026';
  const files = fs.readdirSync(bimDir).filter(f => f.endsWith('.ifc'));

  console.log(`\n🔍 Found ${files.length} IFC files to parse\n`);

  for (const file of files) {
    try {
      parser.parseIFC(path.join(bimDir, file));
    } catch (error) {
      console.error(`❌ Error parsing ${file}:`, error.message);
    }
  }

  // Generate report
  parser.generateReport();

  // Export to GeoJSON
  const outputPath = path.join(__dirname, '../data/bim_models.geojson');
  parser.exportToGeoJSON(outputPath);

  console.log(`\n📍 To view on map: Add this GeoJSON to your TrafficMap component`);
  console.log(`   File: ${outputPath}\n`);
}

module.exports = IFCParser;

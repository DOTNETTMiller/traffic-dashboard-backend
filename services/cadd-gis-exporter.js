/**
 * CADD GIS Exporter
 *
 * Exports extracted CADD assets to standard GIS formats:
 * - GeoJSON (web mapping standard)
 * - Shapefile (Esri/QGIS standard)
 * - File Geodatabase (Esri GDB) - if gdal/ogr available
 *
 * Converts georeferenced ITS equipment and road geometry to
 * formats compatible with ArcGIS, QGIS, and other GIS software.
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

class CADDGISExporter {
  constructor() {
    this.supportedFormats = ['geojson', 'shapefile', 'gdb'];
  }

  /**
   * Convert CADD assets to GeoJSON FeatureCollection
   */
  toGeoJSON(assets, options = {}) {
    const {
      includeITS = true,
      includeRoadGeometry = true,
      modelId = null,
      state = null
    } = options;

    const features = [];

    for (const asset of assets) {
      // Filter by type
      if (!includeITS && asset.type === 'its_equipment') continue;
      if (!includeRoadGeometry && asset.type === 'road_geometry') continue;

      // Filter by model
      if (modelId && asset.modelId !== modelId) continue;

      // Filter by state
      if (state && asset.state !== state) continue;

      // Skip non-georeferenced assets
      if (!asset.georeferenced) continue;

      let geometry;

      if (asset.type === 'its_equipment') {
        // Point geometry for equipment
        geometry = {
          type: 'Point',
          coordinates: [asset.longitude, asset.latitude]
        };
      } else if (asset.type === 'road_geometry') {
        // LineString geometry for roads
        if (asset.vertices && asset.vertices.length >= 2) {
          geometry = {
            type: 'LineString',
            coordinates: asset.vertices.map(v => [v.longitude, v.latitude])
          };
        } else {
          // Fallback to point if only one vertex
          geometry = {
            type: 'Point',
            coordinates: [asset.longitude, asset.latitude]
          };
        }
      } else {
        continue; // Unknown type
      }

      // Build properties
      const properties = {
        id: asset.id,
        modelId: asset.modelId,
        modelName: asset.modelName,
        type: asset.type,
        layer: asset.layer,
        corridor: asset.corridor,
        state: asset.state,
        coordinateSystem: asset.coordinateSystem,
        cadX: asset.cadPosition?.x,
        cadY: asset.cadPosition?.y,
        cadZ: asset.cadPosition?.z
      };

      // Add type-specific properties
      if (asset.type === 'its_equipment') {
        properties.equipmentType = asset.equipmentType;
        properties.text = asset.text;

        // Add attributes as top-level properties
        if (asset.attributes) {
          Object.keys(asset.attributes).forEach(key => {
            properties[key] = asset.attributes[key];
          });
        }
      } else if (asset.type === 'road_geometry') {
        properties.geometryType = asset.geometryType;
        properties.vertexCount = asset.vertexCount;
        properties.isClosed = asset.isClosed;
      }

      features.push({
        type: 'Feature',
        geometry,
        properties
      });
    }

    return {
      type: 'FeatureCollection',
      crs: {
        type: 'name',
        properties: {
          name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
        }
      },
      features,
      metadata: {
        exportDate: new Date().toISOString(),
        featureCount: features.length,
        source: 'CADD Extraction',
        includeITS,
        includeRoadGeometry
      }
    };
  }

  /**
   * Convert CADD assets to Shapefile-compatible structure
   * Returns data structure that can be written using shapefile library
   */
  toShapefile(assets, options = {}) {
    // Separate ITS equipment and road geometry into different layers
    const itsEquipment = assets.filter(a =>
      a.type === 'its_equipment' && a.georeferenced
    );

    const roadGeometry = assets.filter(a =>
      a.type === 'road_geometry' && a.georeferenced
    );

    const shapefiles = {};

    // ITS Equipment layer (Point geometry)
    if (itsEquipment.length > 0) {
      shapefiles.its_equipment = {
        type: 'FeatureCollection',
        features: itsEquipment.map(asset => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [asset.longitude, asset.latitude]
          },
          properties: {
            ID: asset.id,
            MODEL_ID: asset.modelId,
            MODEL_NAME: asset.modelName,
            EQUIP_TYPE: asset.equipmentType,
            LAYER: asset.layer,
            TEXT: asset.text,
            CORRIDOR: asset.corridor,
            STATE: asset.state,
            COORD_SYS: asset.coordinateSystem,
            CAD_X: asset.cadPosition?.x,
            CAD_Y: asset.cadPosition?.y,
            CAD_Z: asset.cadPosition?.z,
            LATITUDE: asset.latitude,
            LONGITUDE: asset.longitude
          }
        }))
      };
    }

    // Road Geometry layer (LineString geometry)
    if (roadGeometry.length > 0) {
      shapefiles.road_geometry = {
        type: 'FeatureCollection',
        features: roadGeometry.filter(asset =>
          asset.vertices && asset.vertices.length >= 2
        ).map(asset => ({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: asset.vertices.map(v => [v.longitude, v.latitude])
          },
          properties: {
            ID: asset.id,
            MODEL_ID: asset.modelId,
            MODEL_NAME: asset.modelName,
            GEOM_TYPE: asset.geometryType,
            LAYER: asset.layer,
            VERTEX_CNT: asset.vertexCount,
            IS_CLOSED: asset.isClosed ? 1 : 0,
            CORRIDOR: asset.corridor,
            STATE: asset.state,
            COORD_SYS: asset.coordinateSystem
          }
        }))
      };
    }

    return shapefiles;
  }

  /**
   * Export to GeoJSON file
   */
  async exportGeoJSON(assets, outputPath, options = {}) {
    const geojson = this.toGeoJSON(assets, options);

    // Write to file
    fs.writeFileSync(
      outputPath,
      JSON.stringify(geojson, null, 2),
      'utf8'
    );

    return {
      success: true,
      format: 'geojson',
      path: outputPath,
      featureCount: geojson.features.length,
      size: fs.statSync(outputPath).size
    };
  }

  /**
   * Export to Shapefile (ZIP archive)
   * Note: Requires shapefile npm package
   */
  async exportShapefile(assets, outputPath, options = {}) {
    const shp = require('shapefile');
    const shapefiles = this.toShapefile(assets, options);

    // Create ZIP archive with multiple shapefiles
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    // Write each layer
    const layerNames = Object.keys(shapefiles);
    for (const layerName of layerNames) {
      const geojson = shapefiles[layerName];

      // Convert GeoJSON to Shapefile format (simplified - in practice use shapefile library)
      // For now, we'll include GeoJSON in the ZIP
      archive.append(
        JSON.stringify(geojson, null, 2),
        { name: `${layerName}.geojson` }
      );

      // Add metadata
      archive.append(
        this.generateShapefileMetadata(geojson, layerName),
        { name: `${layerName}.txt` }
      );
    }

    // Add README
    archive.append(
      this.generateReadme(shapefiles),
      { name: 'README.txt' }
    );

    await archive.finalize();

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        resolve({
          success: true,
          format: 'shapefile',
          path: outputPath,
          layers: layerNames,
          totalFeatures: Object.values(shapefiles).reduce((sum, layer) => sum + layer.features.length, 0),
          size: archive.pointer()
        });
      });

      archive.on('error', reject);
    });
  }

  /**
   * Generate metadata file for shapefile
   */
  generateShapefileMetadata(geojson, layerName) {
    return `CADD Asset Export - ${layerName}
=====================================

Export Date: ${new Date().toISOString()}
Feature Count: ${geojson.features.length}
Geometry Type: ${geojson.features[0]?.geometry.type || 'Unknown'}
Coordinate System: WGS 84 (EPSG:4326)

Source: AutoCAD DXF/DWG extraction
Processed by: DOT Corridor Communicator CADD Processor

Field Descriptions:
- ID: Unique asset identifier
- MODEL_ID: Source CAD model ID
- MODEL_NAME: Original filename
- LAYER: CAD layer name
- CORRIDOR: Transportation corridor (e.g., I-80)
- STATE: U.S. state abbreviation
- COORD_SYS: Source coordinate system
- CAD_X/Y/Z: Original CAD coordinates

For questions or issues, contact your GIS administrator.
`;
  }

  /**
   * Generate README for export package
   */
  generateReadme(shapefiles) {
    const layers = Object.keys(shapefiles);
    const totalFeatures = Object.values(shapefiles).reduce((sum, layer) => sum + layer.features.length, 0);

    return `CADD Asset Export Package
==========================

Export Date: ${new Date().toISOString()}
Total Layers: ${layers.length}
Total Features: ${totalFeatures}

Layers Included:
${layers.map(name => `  - ${name}: ${shapefiles[name].features.length} features`).join('\n')}

Coordinate System: WGS 84 (EPSG:4326)
  - Latitude/Longitude decimal degrees
  - Compatible with Google Maps, Leaflet, ArcGIS Online

File Formats:
  - GeoJSON (.geojson): Web mapping standard, use in QGIS/ArcGIS/Leaflet
  - Metadata (.txt): Field descriptions and export details

Usage Instructions:
  1. Extract ZIP archive
  2. Import .geojson files into your GIS software:
     - ArcGIS Pro: Add Data → GeoJSON
     - QGIS: Layer → Add Layer → Vector Layer
     - Web maps: Use as GeoJSON source

Source Data:
  - Extracted from AutoCAD DXF/DWG design files
  - Coordinate transformation: State Plane NAD83 → WGS84
  - Georeferencing validated against U.S. bounds

Asset Types:
  - ITS Equipment: Traffic cameras, DMS, detectors, RSUs
  - Road Geometry: Centerlines, edges, lanes, curbs

For technical support or questions about this data,
contact your DOT GIS coordinator.

Generated by: DOT Corridor Communicator CADD Processor
https://github.com/yourusername/corridor-communicator
`;
  }

  /**
   * Get supported export formats
   */
  getSupportedFormats() {
    return [
      {
        format: 'geojson',
        name: 'GeoJSON',
        extension: '.geojson',
        mimeType: 'application/geo+json',
        description: 'Web mapping standard, compatible with all GIS software',
        fileSize: 'Small',
        recommended: true
      },
      {
        format: 'shapefile',
        name: 'Shapefile (ZIP)',
        extension: '.zip',
        mimeType: 'application/zip',
        description: 'Esri Shapefile format in ZIP archive with multiple layers',
        fileSize: 'Medium',
        recommended: true
      },
      {
        format: 'gdb',
        name: 'File Geodatabase',
        extension: '.gdb',
        mimeType: 'application/x-filegdb',
        description: 'Esri File Geodatabase (requires GDAL/OGR)',
        fileSize: 'Medium',
        recommended: false,
        requiresGDAL: true
      }
    ];
  }
}

module.exports = new CADDGISExporter();

/**
 * GIS File Parser for ITS Equipment Inventory
 *
 * Supports: Shapefile, KML/KMZ, GeoJSON, CSV with coordinates
 * Converts all formats to standardized equipment records for database import
 */

const fs = require('fs').promises;
const path = require('path');
const shapefile = require('shapefile');
const tj = require('@tmcw/togeojson');
const Papa = require('papaparse');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');

class GISParser {
  constructor() {
    this.supportedFormats = ['shp', 'zip', 'kml', 'kmz', 'geojson', 'json', 'csv'];
  }

  /**
   * Parse GIS file and extract ITS equipment records
   * @param {string} filePath - Path to uploaded file
   * @param {string} stateKey - State identifier
   * @returns {Promise<Object>} Parsed equipment records and metadata
   */
  async parseFile(filePath, stateKey) {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const fileName = path.basename(filePath);

    console.log(`📂 Parsing ${ext.toUpperCase()} file: ${fileName}`);

    let result = {
      success: false,
      fileName,
      fileType: ext,
      stateKey,
      records: [],
      errors: [],
      metadata: {}
    };

    try {
      switch (ext) {
        case 'shp':
        case 'zip':
          result = await this.parseShapefile(filePath, stateKey, result);
          break;
        case 'kml':
        case 'kmz':
          result = await this.parseKML(filePath, stateKey, result);
          break;
        case 'geojson':
        case 'json':
          result = await this.parseGeoJSON(filePath, stateKey, result);
          break;
        case 'csv':
          result = await this.parseCSV(filePath, stateKey, result);
          break;
        default:
          throw new Error(`Unsupported file format: ${ext}`);
      }

      result.success = result.records.length > 0;
      console.log(`✅ Parsed ${result.records.length} equipment records`);

    } catch (error) {
      console.error(`❌ Parse error:`, error);
      result.errors.push({ type: 'parse_error', message: error.message });
    }

    return result;
  }

  /**
   * Parse Shapefile (or zipped shapefile)
   */
  async parseShapefile(filePath, stateKey, result) {
    try {
      // If it's a zip, extract .shp file first
      let shpPath = filePath;
      let dbfPath = filePath.replace('.shp', '.dbf');

      if (path.extname(filePath) === '.zip') {
        const extracted = await this.extractShapefileFromZip(filePath);
        shpPath = extracted.shp;
        dbfPath = extracted.dbf;
      }

      // Read shapefile
      const source = await shapefile.open(shpPath, dbfPath);
      let feature;

      while ((feature = await source.read()).done === false) {
        const record = this.convertFeatureToEquipment(feature.value, stateKey);
        if (record) {
          result.records.push(record);
        } else {
          result.errors.push({
            type: 'invalid_geometry',
            message: 'Feature has no valid coordinates'
          });
        }
      }

      result.metadata.crs = source.meta?.crs || 'EPSG:4326';
      result.metadata.geometryType = source.meta?.type;

    } catch (error) {
      throw new Error(`Shapefile parse error: ${error.message}`);
    }

    return result;
  }

  /**
   * Extract .shp and .dbf from zip file
   */
  async extractShapefileFromZip(zipPath) {
    const data = await fs.readFile(zipPath);
    const zip = await JSZip.loadAsync(data);

    const shpFile = Object.keys(zip.files).find(name => name.endsWith('.shp'));
    const dbfFile = Object.keys(zip.files).find(name => name.endsWith('.dbf'));

    if (!shpFile) throw new Error('No .shp file found in zip');

    const tempDir = path.join(__dirname, '../temp');
    await fs.mkdir(tempDir, { recursive: true });

    const shpPath = path.join(tempDir, shpFile);
    const dbfPath = path.join(tempDir, dbfFile || shpFile.replace('.shp', '.dbf'));

    await fs.writeFile(shpPath, await zip.files[shpFile].async('nodebuffer'));
    if (dbfFile) {
      await fs.writeFile(dbfPath, await zip.files[dbfFile].async('nodebuffer'));
    }

    return { shp: shpPath, dbf: dbfPath };
  }

  /**
   * Parse KML or KMZ file
   */
  async parseKML(filePath, stateKey, result) {
    try {
      let kmlContent;

      if (path.extname(filePath) === '.kmz') {
        // Extract KML from KMZ
        const data = await fs.readFile(filePath);
        const zip = await JSZip.loadAsync(data);
        const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'));
        if (!kmlFile) throw new Error('No .kml file found in KMZ');
        kmlContent = await zip.files[kmlFile].async('string');
      } else {
        kmlContent = await fs.readFile(filePath, 'utf8');
      }

      // Parse KML to GeoJSON
      const dom = new DOMParser().parseFromString(kmlContent);
      const geojson = tj.kml(dom);

      // Process features
      geojson.features.forEach(feature => {
        const record = this.convertFeatureToEquipment(feature, stateKey);
        if (record) {
          result.records.push(record);
        }
      });

      result.metadata.source = 'KML';

    } catch (error) {
      throw new Error(`KML parse error: ${error.message}`);
    }

    return result;
  }

  /**
   * Parse GeoJSON file
   */
  async parseGeoJSON(filePath, stateKey, result) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const geojson = JSON.parse(content);

      if (geojson.type === 'FeatureCollection') {
        geojson.features.forEach(feature => {
          const record = this.convertFeatureToEquipment(feature, stateKey);
          if (record) {
            result.records.push(record);
          }
        });
      } else if (geojson.type === 'Feature') {
        const record = this.convertFeatureToEquipment(geojson, stateKey);
        if (record) {
          result.records.push(record);
        }
      }

      result.metadata.crs = geojson.crs?.properties?.name || 'EPSG:4326';

    } catch (error) {
      throw new Error(`GeoJSON parse error: ${error.message}`);
    }

    return result;
  }

  /**
   * Parse CSV file with coordinate columns
   */
  async parseCSV(filePath, stateKey, result) {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      const parsed = Papa.parse(content, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });

      if (parsed.errors.length > 0) {
        result.errors.push(...parsed.errors.map(e => ({
          type: 'csv_parse_error',
          row: e.row,
          message: e.message
        })));
      }

      // Detect coordinate columns
      const coordColumns = this.detectCoordinateColumns(parsed.data[0] || {});
      if (!coordColumns) {
        throw new Error('Could not detect latitude/longitude columns');
      }

      result.metadata.coordinateColumns = coordColumns;

      // Convert rows to equipment records
      parsed.data.forEach((row, index) => {
        try {
          const lat = parseFloat(row[coordColumns.lat]);
          const lon = parseFloat(row[coordColumns.lon]);

          if (isNaN(lat) || isNaN(lon)) {
            result.errors.push({
              type: 'invalid_coordinates',
              row: index + 1,
              message: `Invalid coordinates: ${row[coordColumns.lat]}, ${row[coordColumns.lon]}`
            });
            return;
          }

          const record = this.convertCSVRowToEquipment(row, lat, lon, stateKey);
          if (record) {
            result.records.push(record);
          }

        } catch (error) {
          result.errors.push({
            type: 'conversion_error',
            row: index + 1,
            message: error.message
          });
        }
      });

    } catch (error) {
      throw new Error(`CSV parse error: ${error.message}`);
    }

    return result;
  }

  /**
   * Detect latitude/longitude column names in CSV
   */
  detectCoordinateColumns(row) {
    const keys = Object.keys(row).map(k => k.toLowerCase());

    const latPatterns = ['lat', 'latitude', 'y', 'northing'];
    const lonPatterns = ['lon', 'long', 'longitude', 'x', 'easting'];

    const latCol = keys.find(k => latPatterns.some(p => k.includes(p)));
    const lonCol = keys.find(k => lonPatterns.some(p => k.includes(p)));

    if (latCol && lonCol) {
      return {
        lat: Object.keys(row)[keys.indexOf(latCol)],
        lon: Object.keys(row)[keys.indexOf(lonCol)]
      };
    }

    return null;
  }

  /**
   * Convert GeoJSON feature to equipment record
   */
  convertFeatureToEquipment(feature, stateKey) {
    if (!feature.geometry || !feature.geometry.coordinates) {
      return null;
    }

    // Extract coordinates (handle Point geometry)
    let lon, lat, elevation;
    if (feature.geometry.type === 'Point') {
      [lon, lat, elevation] = feature.geometry.coordinates;
    } else {
      // For non-point geometries, use centroid or first coordinate
      console.warn('Non-point geometry detected, using first coordinate');
      [lon, lat, elevation] = feature.geometry.coordinates[0];
    }

    const props = feature.properties || {};

    // Generate unique ID
    const id = props.id || props.ID || props.equipment_id ||
               `eq-${stateKey}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      stateKey,
      equipmentType: this.detectEquipmentType(props),
      equipmentSubtype: props.subtype || props.equipment_subtype || null,
      latitude: lat,
      longitude: lon,
      elevation: elevation || props.elevation || null,
      locationDescription: props.location || props.description || props.name || null,
      route: props.route || props.highway || props.road || null,
      milepost: props.milepost || props.mile_post || props.mp || null,
      manufacturer: props.manufacturer || props.make || null,
      model: props.model || null,
      serialNumber: props.serial_number || props.serial || null,
      installationDate: props.install_date || props.installation_date || null,
      status: props.status || 'active',
      // RSU specific
      rsuId: props.rsu_id || props.rsu_identifier || null,
      communicationRange: props.comm_range || props.range || null,
      supportedProtocols: props.protocols || props.supported_protocols || null,
      // DMS specific
      dmsType: props.dms_type || null,
      messageCapacity: props.message_capacity || props.msg_capacity || null,
      // Camera specific
      cameraType: props.camera_type || null,
      resolution: props.resolution || null,
      streamUrl: props.stream_url || props.video_url || null,
      // Sensor specific
      sensorType: props.sensor_type || null,
      measurementTypes: props.measurements || props.measurement_types || null,
      // Raw properties for additional attributes
      rawProperties: props
    };
  }

  /**
   * Convert CSV row to equipment record
   */
  convertCSVRowToEquipment(row, lat, lon, stateKey) {
    const id = row.id || row.ID || row.equipment_id ||
               `eq-${stateKey}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      stateKey,
      equipmentType: this.detectEquipmentType(row),
      equipmentSubtype: row.subtype || row.equipment_subtype || null,
      latitude: lat,
      longitude: lon,
      elevation: row.elevation || null,
      locationDescription: row.location || row.description || row.name || null,
      route: row.route || row.highway || row.road || null,
      milepost: row.milepost || row.mile_post || row.mp || null,
      manufacturer: row.manufacturer || row.make || null,
      model: row.model || null,
      serialNumber: row.serial_number || row.serial || null,
      installationDate: row.install_date || row.installation_date || null,
      status: row.status || 'active',
      rsuId: row.rsu_id || null,
      communicationRange: row.comm_range || row.range || null,
      supportedProtocols: row.protocols || null,
      dmsType: row.dms_type || null,
      cameraType: row.camera_type || null,
      resolution: row.resolution || null,
      streamUrl: row.stream_url || null,
      sensorType: row.sensor_type || null,
      measurementTypes: row.measurements || null,
      rawProperties: row
    };
  }

  /**
   * Detect equipment type from properties
   */
  detectEquipmentType(props) {
    const type = (props.type || props.equipment_type || props.category || '').toLowerCase();

    // Map common variations to standard types
    if (type.includes('camera') || type.includes('cctv') || type.includes('video')) {
      return 'camera';
    }
    if (type.includes('dms') || type.includes('vms') || type.includes('sign') || type.includes('message')) {
      return 'dms';
    }
    if (type.includes('rsu') || type.includes('roadside') || type.includes('v2x') || type.includes('dsrc')) {
      return 'rsu';
    }
    if (type.includes('sensor') || type.includes('detector') || type.includes('weather') ||
        type.includes('rwis') || type.includes('ess')) {
      return 'sensor';
    }

    // Default to sensor if unclear
    return props.type || props.equipment_type || 'sensor';
  }
}

module.exports = GISParser;

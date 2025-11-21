/**
 * Web Feature Service (WFS) Client
 *
 * Connects to OGC WFS endpoints to fetch ITS equipment data in real-time.
 * Supports WFS 1.0.0, 1.1.0, and 2.0.0
 */

const axios = require('axios');
const { DOMParser } = require('@xmldom/xmldom');
const GISParser = require('./gis-parser');

class WFSClient {
  constructor(wfsUrl, options = {}) {
    this.wfsUrl = wfsUrl;
    this.version = options.version || '2.0.0';
    this.timeout = options.timeout || 30000;
    this.maxFeatures = options.maxFeatures || 1000;
    this.parser = new GISParser();
  }

  /**
   * Get WFS capabilities
   */
  async getCapabilities() {
    try {
      const response = await axios.get(this.wfsUrl, {
        params: {
          service: 'WFS',
          version: this.version,
          request: 'GetCapabilities'
        },
        timeout: this.timeout
      });

      const dom = new DOMParser().parseFromString(response.data, 'text/xml');

      // Extract feature types
      const featureTypes = [];
      const featureTypeList = dom.getElementsByTagName('FeatureType');

      for (let i = 0; i < featureTypeList.length; i++) {
        const ft = featureTypeList[i];
        const name = ft.getElementsByTagName('Name')[0]?.textContent;
        const title = ft.getElementsByTagName('Title')[0]?.textContent;

        if (name) {
          featureTypes.push({ name, title: title || name });
        }
      }

      return {
        success: true,
        version: this.version,
        featureTypes
      };

    } catch (error) {
      console.error('WFS GetCapabilities error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fetch features from WFS endpoint
   */
  async getFeatures(typeName, options = {}) {
    try {
      console.log(`📡 Fetching WFS features: ${typeName}`);

      const params = {
        service: 'WFS',
        version: this.version,
        request: 'GetFeature',
        typeName: typeName,
        outputFormat: 'application/json', // Try JSON first
        maxFeatures: options.maxFeatures || this.maxFeatures
      };

      // Add bbox filter if provided
      if (options.bbox) {
        params.bbox = options.bbox.join(',');
      }

      // Add CQL filter if provided
      if (options.filter) {
        params.CQL_FILTER = options.filter;
      }

      let response;
      try {
        // Try JSON output first
        response = await axios.get(this.wfsUrl, {
          params,
          timeout: this.timeout
        });

        // Check if we got JSON
        if (typeof response.data === 'object' && response.data.type === 'FeatureCollection') {
          return this.parseGeoJSONFeatures(response.data);
        }
      } catch (jsonError) {
        console.log('JSON format not supported, trying GML...');
      }

      // Fall back to GML
      params.outputFormat = 'GML3';
      response = await axios.get(this.wfsUrl, {
        params,
        timeout: this.timeout
      });

      return this.parseGMLFeatures(response.data);

    } catch (error) {
      console.error('WFS GetFeature error:', error.message);
      throw error;
    }
  }

  /**
   * Parse GeoJSON feature collection
   */
  parseGeoJSONFeatures(featureCollection) {
    const features = featureCollection.features || [];
    console.log(`✅ Parsed ${features.length} GeoJSON features`);

    return {
      success: true,
      features: features,
      count: features.length,
      format: 'GeoJSON'
    };
  }

  /**
   * Parse GML (Geography Markup Language) features
   */
  parseGMLFeatures(gmlData) {
    try {
      const dom = new DOMParser().parseFromString(gmlData, 'text/xml');
      const features = [];

      // Get all feature members
      const featureMembers = dom.getElementsByTagName('gml:featureMember');
      if (featureMembers.length === 0) {
        // Try without namespace
        const members = dom.getElementsByTagName('featureMember');
        for (let i = 0; i < members.length; i++) {
          const feature = this.parseGMLFeature(members[i]);
          if (feature) features.push(feature);
        }
      } else {
        for (let i = 0; i < featureMembers.length; i++) {
          const feature = this.parseGMLFeature(featureMembers[i]);
          if (feature) features.push(feature);
        }
      }

      console.log(`✅ Parsed ${features.length} GML features`);

      return {
        success: true,
        features: features.map(f => ({
          type: 'Feature',
          geometry: f.geometry,
          properties: f.properties
        })),
        count: features.length,
        format: 'GML'
      };

    } catch (error) {
      console.error('GML parse error:', error.message);
      throw error;
    }
  }

  /**
   * Parse individual GML feature
   */
  parseGMLFeature(featureMember) {
    try {
      // Extract properties
      const properties = {};
      const children = featureMember.childNodes[0]?.childNodes || [];

      for (let i = 0; i < children.length; i++) {
        const node = children[i];
        if (node.nodeType === 1) { // Element node
          const name = node.localName || node.tagName;

          // Skip geometry nodes
          if (name.toLowerCase().includes('geom') ||
              name.toLowerCase().includes('shape') ||
              name.toLowerCase().includes('location')) {
            continue;
          }

          properties[name] = node.textContent?.trim();
        }
      }

      // Extract geometry (simplified - handles Point geometry)
      const geometry = this.extractGMLGeometry(featureMember);

      return {
        geometry,
        properties
      };

    } catch (error) {
      console.error('Feature parse error:', error.message);
      return null;
    }
  }

  /**
   * Extract geometry from GML
   */
  extractGMLGeometry(featureMember) {
    // Look for Point geometry
    const pointNodes = featureMember.getElementsByTagName('gml:Point');
    if (pointNodes.length > 0) {
      const posNode = pointNodes[0].getElementsByTagName('gml:pos')[0];
      if (posNode) {
        const coords = posNode.textContent.trim().split(/\s+/).map(Number);
        return {
          type: 'Point',
          coordinates: coords.length === 2 ? [coords[1], coords[0]] : coords // lon, lat
        };
      }
    }

    // Look for coordinates without namespace
    const coordNodes = featureMember.getElementsByTagName('coordinates');
    if (coordNodes.length > 0) {
      const coords = coordNodes[0].textContent.trim().split(',').map(Number);
      return {
        type: 'Point',
        coordinates: coords
      };
    }

    // Default to null geometry
    return null;
  }

  /**
   * Sync WFS data to equipment inventory
   */
  async syncToInventory(typeName, stateKey, converter) {
    try {
      console.log(`🔄 Syncing WFS data for ${stateKey}...`);

      const result = await this.getFeatures(typeName);

      if (!result.success || result.features.length === 0) {
        return {
          success: false,
          error: 'No features retrieved',
          synced: 0
        };
      }

      // Convert features to equipment records
      const equipmentRecords = [];
      for (const feature of result.features) {
        const equipment = this.parser.convertFeatureToEquipment(feature, stateKey);
        if (equipment) {
          // Apply ARC-ITS conversion if converter provided
          const record = converter ? converter.convertToARCITS(equipment) : equipment;
          equipmentRecords.push(record);
        }
      }

      return {
        success: true,
        synced: equipmentRecords.length,
        total: result.features.length,
        records: equipmentRecords
      };

    } catch (error) {
      console.error('WFS sync error:', error.message);
      return {
        success: false,
        error: error.message,
        synced: 0
      };
    }
  }

  /**
   * Test WFS connection
   */
  async testConnection() {
    try {
      const capabilities = await this.getCapabilities();
      if (capabilities.success) {
        return {
          success: true,
          message: `Connected to WFS ${capabilities.version}`,
          featureTypes: capabilities.featureTypes.length,
          available: capabilities.featureTypes
        };
      } else {
        return {
          success: false,
          error: capabilities.error
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = WFSClient;

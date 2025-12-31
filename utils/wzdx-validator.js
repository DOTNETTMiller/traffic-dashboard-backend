/**
 * WZDx Schema Validator
 *
 * Validates Work Zone Data Exchange (WZDx) feeds against official USDOT schemas.
 * Supports WZDx v4.2 specification.
 *
 * Official WZDx Spec: https://github.com/usdot-jpo-ode/wzdx
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Optional dependencies - gracefully handle if not installed
let Ajv, addFormats;
try {
  Ajv = require('ajv');
  addFormats = require('ajv-formats');
} catch (error) {
  console.warn('⚠️  ajv/ajv-formats not available - WZDx validation disabled');
  Ajv = null;
  addFormats = null;
}

// WZDx v4.2 Schema URLs
const WZDX_VERSION = '4.2';
const SCHEMA_BASE_URL = `https://raw.githubusercontent.com/usdot-jpo-ode/wzdx/main/schemas/${WZDX_VERSION}`;

const SCHEMAS = {
  WorkZoneFeed: `${SCHEMA_BASE_URL}/WorkZoneFeed.json`,
  DeviceFeed: `${SCHEMA_BASE_URL}/DeviceFeed.json`,
  RoadEventFeature: `${SCHEMA_BASE_URL}/RoadEventFeature.json`
};

// Cache directory for schemas
const CACHE_DIR = path.join(__dirname, '../.cache/wzdx-schemas');

class WZDxValidator {
  constructor() {
    this.validationAvailable = Ajv !== null;
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      allowUnionTypes: true
    });
    addFormats(this.ajv);

    this.validators = {};
    this.schemasLoaded = false;
  }

  /**
   * Ensure cache directory exists
   */
  async ensureCacheDir() {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
      console.error('Error creating cache directory:', error);
    }
  }

  /**
   * Download schema from GitHub and cache locally
   */
  async downloadSchema(schemaName, url) {
    const cacheFile = path.join(CACHE_DIR, `${schemaName}.json`);

    try {
      // Try to load from cache first
      const cached = await fs.readFile(cacheFile, 'utf8');
      return JSON.parse(cached);
    } catch (error) {
      // Not in cache, download from GitHub
      console.log(`Downloading WZDx schema: ${schemaName} v${WZDX_VERSION}...`);

      try {
        const response = await axios.get(url, { timeout: 10000 });
        const schema = response.data;

        // Cache for future use
        await this.ensureCacheDir();
        await fs.writeFile(cacheFile, JSON.stringify(schema, null, 2));

        console.log(`✓ Cached ${schemaName} schema`);
        return schema;
      } catch (downloadError) {
        console.error(`Error downloading ${schemaName} schema:`, downloadError.message);
        throw new Error(`Failed to download WZDx ${schemaName} schema`);
      }
    }
  }

  /**
   * Load all WZDx schemas
   */
  async loadSchemas() {
    if (this.schemasLoaded) return;

    console.log(`Loading WZDx v${WZDX_VERSION} schemas...`);

    try {
      // Download and compile schemas
      for (const [schemaName, url] of Object.entries(SCHEMAS)) {
        const schema = await this.downloadSchema(schemaName, url);
        this.validators[schemaName] = this.ajv.compile(schema);
      }

      this.schemasLoaded = true;
      console.log(`✓ WZDx schemas loaded and compiled`);
    } catch (error) {
      console.error('Error loading WZDx schemas:', error);
      throw error;
    }
  }

  /**
   * Validate Work Zone Feed (FeatureCollection)
   */
  async validateWorkZoneFeed(feed) {
    await this.loadSchemas();

    const validator = this.validators.WorkZoneFeed;
    const valid = validator(feed);

    return {
      valid,
      errors: valid ? null : this.formatErrors(validator.errors),
      schema: 'WorkZoneFeed',
      version: WZDX_VERSION
    };
  }

  /**
   * Validate Device Feed (FeatureCollection)
   */
  async validateDeviceFeed(feed) {
    await this.loadSchemas();

    const validator = this.validators.DeviceFeed;
    const valid = validator(feed);

    return {
      valid,
      errors: valid ? null : this.formatErrors(validator.errors),
      schema: 'DeviceFeed',
      version: WZDX_VERSION
    };
  }

  /**
   * Validate a single Road Event Feature
   */
  async validateRoadEventFeature(feature) {
    await this.loadSchemas();

    const validator = this.validators.RoadEventFeature;
    const valid = validator(feature);

    return {
      valid,
      errors: valid ? null : this.formatErrors(validator.errors),
      schema: 'RoadEventFeature',
      version: WZDX_VERSION
    };
  }

  /**
   * Format validation errors for better readability
   */
  formatErrors(errors) {
    if (!errors || errors.length === 0) return null;

    return errors.map(error => ({
      path: error.instancePath || error.dataPath,
      message: error.message,
      keyword: error.keyword,
      params: error.params,
      data: error.data
    }));
  }

  /**
   * Validate any feed (auto-detect type)
   */
  async validate(feed) {
    if (!feed || typeof feed !== 'object') {
      return {
        valid: false,
        errors: [{ message: 'Feed must be a valid object' }],
        schema: 'unknown',
        version: WZDX_VERSION
      };
    }

    // Check if it's a FeatureCollection
    if (feed.type !== 'FeatureCollection') {
      return {
        valid: false,
        errors: [{ message: 'Feed must be a GeoJSON FeatureCollection' }],
        schema: 'unknown',
        version: WZDX_VERSION
      };
    }

    // Determine feed type from feed_info
    const feedInfo = feed.properties?.feed_info;
    if (!feedInfo) {
      return {
        valid: false,
        errors: [{ message: 'Missing feed_info in properties' }],
        schema: 'unknown',
        version: WZDX_VERSION
      };
    }

    // Check if this is a work zone feed or device feed
    // Work zone feeds have road event features
    // Device feeds have field device features
    if (feed.features && feed.features.length > 0) {
      const firstFeature = feed.features[0];
      const coreDetails = firstFeature.properties?.core_details;

      if (coreDetails?.event_type) {
        // Work zone feed
        return await this.validateWorkZoneFeed(feed);
      } else if (coreDetails?.device_type) {
        // Device feed
        return await this.validateDeviceFeed(feed);
      }
    }

    // Default to work zone feed validation
    return await this.validateWorkZoneFeed(feed);
  }

  /**
   * Get validation summary for reporting
   */
  getValidationSummary(result) {
    if (result.valid) {
      return `✓ Valid WZDx ${result.schema} v${result.version}`;
    } else {
      const errorCount = result.errors ? result.errors.length : 0;
      return `✗ Invalid WZDx ${result.schema} v${result.version} (${errorCount} errors)`;
    }
  }

  /**
   * Clear schema cache (for testing/updates)
   */
  async clearCache() {
    try {
      const files = await fs.readdir(CACHE_DIR);
      for (const file of files) {
        await fs.unlink(path.join(CACHE_DIR, file));
      }
      console.log('✓ WZDx schema cache cleared');
      this.schemasLoaded = false;
      this.validators = {};
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

// Export singleton instance
const validator = new WZDxValidator();

module.exports = {
  validator,
  WZDxValidator,
  WZDX_VERSION
};

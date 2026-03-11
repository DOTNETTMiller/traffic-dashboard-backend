/**
 * CADD File Processor
 *
 * Processes AutoCAD DXF/DWG files to extract:
 * - Road geometry (centerlines, edges, lanes)
 * - ITS equipment (cameras, DMS, detectors, RSUs)
 * - Traffic devices (signals, signs, beacons)
 * - Asset attributes and metadata
 *
 * Supports coordinate system transformation from state plane to WGS84
 */

const fs = require('fs');
const path = require('path');
const proj4 = require('proj4');

class CADDProcessor {
  constructor() {
    // U.S. bounding box for validation (continental U.S.)
    this.usBounds = {
      minLat: 24.5,   // Southern tip of Texas/Florida
      maxLat: 49.4,   // Northern border (Canada)
      minLon: -125.0, // West coast (Washington/Oregon)
      maxLon: -66.0   // East coast (Maine)
    };

    // Extended bounds for Alaska and Hawaii (if needed in future)
    this.usExtendedBounds = {
      alaska: { minLat: 51.0, maxLat: 71.5, minLon: -180.0, maxLon: -130.0 },
      hawaii: { minLat: 18.0, maxLat: 22.5, minLon: -160.0, maxLon: -154.0 }
    };

    // Iowa State Plane coordinate systems (NAD83, US Survey Feet)
    // Source: EPSG.io
    this.coordinateSystems = {
      'iowa-north': {
        proj4: '+proj=lcc +lat_1=43.26666666666667 +lat_2=42.06666666666667 +lat_0=41.5 +lon_0=-93.5 +x_0=1500000 +y_0=999999.9999898402 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:3421',
        name: 'Iowa North (NAD83 / US Feet)',
        counties: ['Lyon', 'Osceola', 'Dickinson', 'Emmet', 'Kossuth', 'Winnebago', 'Worth', 'Mitchell', 'Howard', 'Winneshiek', 'Allamakee']
      },
      'iowa-south': {
        proj4: '+proj=lcc +lat_1=41.78333333333333 +lat_2=40.61666666666667 +lat_0=40 +lon_0=-93.5 +x_0=500000.00001016 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:3422',
        name: 'Iowa South (NAD83 / US Feet)',
        counties: ['Fremont', 'Page', 'Taylor', 'Ringgold', 'Decatur', 'Wayne', 'Appanoose', 'Davis', 'Van Buren', 'Lee']
      },
      'wgs84': {
        proj4: '+proj=longlat +datum=WGS84 +no_defs',
        epsg: 'EPSG:4326',
        name: 'WGS 84'
      }
    };

    // Define WGS84 for proj4
    proj4.defs('WGS84', this.coordinateSystems.wgs84.proj4);
  }

  /**
   * Detect coordinate system from CAD file metadata or location
   */
  detectCoordinateSystem(caddModel) {
    // Check if explicitly specified
    if (caddModel.coordinate_system) {
      return caddModel.coordinate_system;
    }

    // Check county to determine north vs south zone
    if (caddModel.county) {
      const county = caddModel.county.trim();

      if (this.coordinateSystems['iowa-north'].counties.includes(county)) {
        return 'iowa-north';
      }
      if (this.coordinateSystems['iowa-south'].counties.includes(county)) {
        return 'iowa-south';
      }
    }

    // Check extents to guess coordinate system
    const minX = caddModel.extents_min_x;
    const minY = caddModel.extents_min_y;

    if (minX !== null && minY !== null) {
      // Iowa North zone X ranges: ~1,400,000 to ~1,900,000
      // Iowa South zone X ranges: ~100,000 to ~900,000
      if (minX > 1000000) {
        return 'iowa-north';
      } else if (minX < 1000000) {
        return 'iowa-south';
      }
    }

    // Default to Iowa North
    console.warn(`⚠️  Could not detect coordinate system for model ${caddModel.id}, defaulting to Iowa North`);
    return 'iowa-north';
  }

  /**
   * Validate that coordinates are within United States bounds
   */
  isWithinUSBounds(latitude, longitude) {
    // Check continental U.S. bounds
    if (latitude >= this.usBounds.minLat && latitude <= this.usBounds.maxLat &&
        longitude >= this.usBounds.minLon && longitude <= this.usBounds.maxLon) {
      return { valid: true, region: 'continental' };
    }

    // Check Alaska bounds
    const alaska = this.usExtendedBounds.alaska;
    if (latitude >= alaska.minLat && latitude <= alaska.maxLat &&
        longitude >= alaska.minLon && longitude <= alaska.maxLon) {
      return { valid: true, region: 'alaska' };
    }

    // Check Hawaii bounds
    const hawaii = this.usExtendedBounds.hawaii;
    if (latitude >= hawaii.minLat && latitude <= hawaii.maxLat &&
        longitude >= hawaii.minLon && longitude <= hawaii.maxLon) {
      return { valid: true, region: 'hawaii' };
    }

    return { valid: false, region: null };
  }

  /**
   * Transform coordinates from state plane to WGS84
   */
  transformToWGS84(x, y, sourceSystem = 'iowa-north') {
    try {
      const sourceDef = this.coordinateSystems[sourceSystem]?.proj4;
      if (!sourceDef) {
        throw new Error(`Unknown coordinate system: ${sourceSystem}`);
      }

      // Transform from state plane to WGS84
      const [lon, lat] = proj4(sourceDef, 'WGS84', [x, y]);

      // Validate coordinates are within U.S. bounds
      const boundsCheck = this.isWithinUSBounds(lat, lon);
      if (!boundsCheck.valid) {
        console.error(`❌ Transformed coordinates (${lat.toFixed(6)}, ${lon.toFixed(6)}) are OUTSIDE United States bounds!`);
        console.error(`   Original: (${x}, ${y}) in ${sourceSystem}`);
        console.error(`   This likely indicates incorrect coordinate system or invalid source data.`);
        return null;
      }

      return { latitude: lat, longitude: lon };
    } catch (error) {
      console.error(`Coordinate transformation failed for (${x}, ${y}):`, error.message);
      return null;
    }
  }

  /**
   * Extract and georeference ITS equipment from CADD model
   */
  extractITSEquipment(caddModel, extractionData) {
    const coordinateSystem = this.detectCoordinateSystem(caddModel);
    const equipment = [];

    if (!extractionData.itsEquipment) {
      return equipment;
    }

    for (const item of extractionData.itsEquipment) {
      if (item.geometry?.position) {
        const pos = item.geometry.position;

        // Transform to WGS84
        const coords = this.transformToWGS84(pos.x, pos.y, coordinateSystem);

        if (coords) {
          equipment.push({
            type: item.type || 'Unknown',
            layer: item.layer,
            text: item.text,
            attributes: item.attributes || {},
            cadPosition: { x: pos.x, y: pos.y, z: pos.z || 0 },
            latitude: coords.latitude,
            longitude: coords.longitude,
            georeferenced: true,
            coordinateSystem: coordinateSystem
          });
        } else {
          // Keep non-georeferenced item
          equipment.push({
            type: item.type || 'Unknown',
            layer: item.layer,
            text: item.text,
            attributes: item.attributes || {},
            cadPosition: { x: pos.x, y: pos.y, z: pos.z || 0 },
            latitude: null,
            longitude: null,
            georeferenced: false,
            coordinateSystem: coordinateSystem
          });
        }
      }
    }

    return equipment;
  }

  /**
   * Extract and georeference road geometry from CADD model
   */
  extractRoadGeometry(caddModel, extractionData) {
    const coordinateSystem = this.detectCoordinateSystem(caddModel);
    const geometry = [];

    if (!extractionData.roadGeometry) {
      return geometry;
    }

    for (const item of extractionData.roadGeometry) {
      if (item.geometry?.vertices && item.geometry.vertices.length > 0) {
        // Transform all vertices
        const geoVertices = [];
        let allTransformed = true;

        for (const vertex of item.geometry.vertices) {
          const coords = this.transformToWGS84(vertex.x, vertex.y, coordinateSystem);
          if (coords) {
            geoVertices.push({
              latitude: coords.latitude,
              longitude: coords.longitude,
              elevation: vertex.z || 0
            });
          } else {
            allTransformed = false;
            break;
          }
        }

        if (allTransformed && geoVertices.length > 0) {
          geometry.push({
            type: item.type || 'polyline',
            layer: item.layer,
            vertices: geoVertices,
            cadVertices: item.geometry.vertices,
            georeferenced: true,
            coordinateSystem: coordinateSystem,
            isClosed: item.geometry.isClosed || false,
            attributes: item.attributes || {}
          });
        } else {
          // Keep non-georeferenced geometry
          geometry.push({
            type: item.type || 'polyline',
            layer: item.layer,
            vertices: [],
            cadVertices: item.geometry.vertices,
            georeferenced: false,
            coordinateSystem: coordinateSystem,
            isClosed: item.geometry.isClosed || false,
            attributes: item.attributes || {}
          });
        }
      }
    }

    return geometry;
  }

  /**
   * Process complete CADD model
   */
  processModel(caddModel, extractionData) {
    console.log(`🔧 Processing CADD model: ${caddModel.original_filename}`);

    const coordinateSystem = this.detectCoordinateSystem(caddModel);
    console.log(`   Coordinate System: ${this.coordinateSystems[coordinateSystem].name}`);

    // Extract and georeference ITS equipment
    const itsEquipment = this.extractITSEquipment(caddModel, extractionData);
    const itsGeoreferenced = itsEquipment.filter(e => e.georeferenced).length;
    console.log(`   ITS Equipment: ${itsEquipment.length} total, ${itsGeoreferenced} georeferenced`);

    // Extract and georeference road geometry
    const roadGeometry = this.extractRoadGeometry(caddModel, extractionData);
    const roadGeoreferenced = roadGeometry.filter(g => g.georeferenced).length;
    console.log(`   Road Geometry: ${roadGeometry.length} total, ${roadGeoreferenced} georeferenced`);

    // Validate that coordinates are within U.S. bounds
    const totalElements = itsEquipment.length + roadGeometry.length;
    const totalGeoreferenced = itsGeoreferenced + roadGeoreferenced;
    const failedGeoreference = totalElements - totalGeoreferenced;

    // If we have elements but NONE were georeferenced, likely all are outside U.S.
    if (totalElements > 0 && totalGeoreferenced === 0) {
      throw new Error(
        `❌ VALIDATION FAILED: All ${totalElements} CADD elements are OUTSIDE United States bounds!\n\n` +
        `This indicates the file uses an incorrect coordinate system or contains international data.\n\n` +
        `Expected: Iowa State Plane coordinates (NAD83)\n` +
        `Detected System: ${this.coordinateSystems[coordinateSystem].name}\n\n` +
        `Please verify:\n` +
        `  1. File is for a U.S. location (Iowa)\n` +
        `  2. Coordinate system is correctly specified\n` +
        `  3. Design coordinates are in State Plane (not lat/lng or international system)`
      );
    }

    // If more than 50% failed to georeference, likely wrong coordinate system
    if (totalElements > 0 && failedGeoreference > totalElements * 0.5) {
      const percentFailed = Math.round((failedGeoreference / totalElements) * 100);
      throw new Error(
        `❌ VALIDATION FAILED: ${percentFailed}% of CADD elements (${failedGeoreference}/${totalElements}) are OUTSIDE United States bounds!\n\n` +
        `This indicates the file likely uses an incorrect coordinate system.\n\n` +
        `Detected System: ${this.coordinateSystems[coordinateSystem].name}\n` +
        `Georeferenced: ${totalGeoreferenced} elements (${100 - percentFailed}%)\n` +
        `Failed: ${failedGeoreference} elements (${percentFailed}%)\n\n` +
        `Please verify:\n` +
        `  1. File is for a U.S. location\n` +
        `  2. Correct coordinate system is specified (Iowa North/South)\n` +
        `  3. Coordinates are in State Plane format`
      );
    }

    // Warn if some elements are outside bounds
    if (failedGeoreference > 0) {
      console.warn(`⚠️  Warning: ${failedGeoreference}/${totalElements} elements could not be georeferenced (may be outside U.S. bounds)`);
    }

    return {
      coordinateSystem,
      itsEquipment,
      roadGeometry,
      stats: {
        itsTotal: itsEquipment.length,
        itsGeoreferenced,
        itsNeedingGeoreference: itsEquipment.length - itsGeoreferenced,
        roadTotal: roadGeometry.length,
        roadGeoreferenced,
        roadNeedingGeoreference: roadGeometry.length - roadGeoreferenced,
        totalElements,
        totalGeoreferenced,
        failedGeoreference,
        percentGeoreferenced: totalElements > 0 ? Math.round((totalGeoreferenced / totalElements) * 100) : 0
      }
    };
  }

  /**
   * Extract detailed asset data from ITS equipment
   */
  extractAssetData(equipment) {
    const assets = [];

    for (const item of equipment) {
      if (!item.georeferenced) continue;

      const asset = {
        assetId: null,  // To be assigned by asset management system
        assetType: this.normalizeAssetType(item.type),
        location: {
          latitude: item.latitude,
          longitude: item.longitude,
          elevation: item.cadPosition.z
        },
        attributes: {
          layer: item.layer,
          text: item.text,
          ...item.attributes
        },
        source: 'cadd_model',
        sourceLayer: item.layer,
        coordinateSystem: item.coordinateSystem,
        cadPosition: item.cadPosition
      };

      // Extract specific attributes based on type
      switch (asset.assetType) {
        case 'camera':
          asset.attributes.viewDirection = this.extractViewDirection(item.attributes);
          asset.attributes.mountHeight = this.extractMountHeight(item.attributes);
          break;

        case 'dms':
          asset.attributes.messageLines = this.extractDMSLines(item.attributes);
          asset.attributes.pixelDimensions = this.extractDMSDimensions(item.attributes);
          break;

        case 'detector':
          asset.attributes.detectorType = this.extractDetectorType(item.attributes);
          asset.attributes.coverage = this.extractDetectorCoverage(item.attributes);
          break;

        case 'rsu':
          asset.attributes.frequency = this.extractRSUFrequency(item.attributes);
          asset.attributes.range = this.extractRSURange(item.attributes);
          break;
      }

      assets.push(asset);
    }

    return assets;
  }

  normalizeAssetType(type) {
    const normalized = (type || '').toLowerCase().trim();
    if (normalized.includes('camera') || normalized.includes('cctv')) return 'camera';
    if (normalized.includes('dms') || normalized.includes('sign')) return 'dms';
    if (normalized.includes('detector') || normalized.includes('sensor')) return 'detector';
    if (normalized.includes('rsu') || normalized.includes('v2x')) return 'rsu';
    if (normalized.includes('signal')) return 'traffic_signal';
    if (normalized.includes('beacon')) return 'beacon';
    if (normalized.includes('flasher')) return 'flasher';
    return 'unknown';
  }

  extractViewDirection(attributes) {
    // Try to extract from common attribute names
    if (attributes.VIEW_DIR) return attributes.VIEW_DIR;
    if (attributes.DIRECTION) return attributes.DIRECTION;
    if (attributes.AZIMUTH) return parseFloat(attributes.AZIMUTH);
    return null;
  }

  extractMountHeight(attributes) {
    if (attributes.HEIGHT) return parseFloat(attributes.HEIGHT);
    if (attributes.MOUNT_HT) return parseFloat(attributes.MOUNT_HT);
    if (attributes.ELEVATION) return parseFloat(attributes.ELEVATION);
    return null;
  }

  extractDMSLines(attributes) {
    if (attributes.LINES) return parseInt(attributes.LINES);
    if (attributes.MESSAGE_LINES) return parseInt(attributes.MESSAGE_LINES);
    return 3; // Default
  }

  extractDMSDimensions(attributes) {
    if (attributes.WIDTH && attributes.HEIGHT) {
      return `${attributes.WIDTH}x${attributes.HEIGHT}`;
    }
    return null;
  }

  extractDetectorType(attributes) {
    if (attributes.DET_TYPE) return attributes.DET_TYPE;
    if (attributes.SENSOR_TYPE) return attributes.SENSOR_TYPE;
    return 'loop'; // Default
  }

  extractDetectorCoverage(attributes) {
    if (attributes.COVERAGE) return attributes.COVERAGE;
    if (attributes.LANES) return `${attributes.LANES} lanes`;
    return null;
  }

  extractRSUFrequency(attributes) {
    if (attributes.FREQUENCY) return attributes.FREQUENCY;
    if (attributes.FREQ) return attributes.FREQ;
    return '5.9 GHz'; // Default DSRC frequency
  }

  extractRSURange(attributes) {
    if (attributes.RANGE) return parseFloat(attributes.RANGE);
    if (attributes.RADIUS) return parseFloat(attributes.RADIUS);
    return 300; // Default 300m
  }
}

module.exports = new CADDProcessor();

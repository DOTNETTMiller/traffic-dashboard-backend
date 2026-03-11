/**
 * CADD File Processor
 *
 * Processes AutoCAD DXF/DWG files to extract:
 * - Road geometry (centerlines, edges, lanes)
 * - ITS equipment (cameras, DMS, detectors, RSUs)
 * - Traffic devices (signals, signs, beacons)
 * - Asset attributes and metadata
 *
 * Supports coordinate system transformation from State Plane to WGS84
 *
 * SUPPORTED STATES (NAD83 State Plane):
 * - Arizona (AZ): East zone
 * - California (CA): Zones 1, 3, 5
 * - Colorado (CO): North zone
 * - Florida (FL): North, East zones
 * - Georgia (GA): East zone
 * - Illinois (IL): East, West zones
 * - Iowa (IA): North, South zones
 * - Michigan (MI): North, South zones
 * - Minnesota (MN): North zone
 * - New Jersey (NJ): Single zone
 * - New York (NY): Long Island zone
 * - North Carolina (NC): Single zone
 * - Ohio (OH): North, South zones
 * - Oregon (OR): North zone
 * - Pennsylvania (PA): North, South zones
 * - Texas (TX): North, Central, South zones
 * - Virginia (VA): North zone
 * - Washington (WA): North zone
 * - Wisconsin (WI): North zone
 *
 * ALSO SUPPORTS:
 * - WGS84 lat/lng (for sign plans already georeferenced)
 * - Auto-detection of coordinate system from extents
 * - U.S. geographic bounds validation
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

    // U.S. State Plane coordinate systems (NAD83)
    // Source: EPSG.io and NIST SP 811
    // Format: proj4 definition strings for common State Plane zones
    this.coordinateSystems = {
      // Special: WGS84 (lat/lng) - for files already georeferenced
      'wgs84': {
        proj4: '+proj=longlat +datum=WGS84 +no_defs',
        epsg: 'EPSG:4326',
        name: 'WGS 84 (Latitude/Longitude)',
        isLatLng: true
      },

      // IOWA
      'iowa-north': {
        proj4: '+proj=lcc +lat_1=43.26666666666667 +lat_2=42.06666666666667 +lat_0=41.5 +lon_0=-93.5 +x_0=1500000 +y_0=999999.9999898402 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:3421',
        name: 'Iowa North (NAD83 / US Feet)',
        state: 'IA',
        counties: ['Lyon', 'Osceola', 'Dickinson', 'Emmet', 'Kossuth', 'Winnebago', 'Worth', 'Mitchell', 'Howard', 'Winneshiek', 'Allamakee']
      },
      'iowa-south': {
        proj4: '+proj=lcc +lat_1=41.78333333333333 +lat_2=40.61666666666667 +lat_0=40 +lon_0=-93.5 +x_0=500000.00001016 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:3422',
        name: 'Iowa South (NAD83 / US Feet)',
        state: 'IA',
        counties: ['Fremont', 'Page', 'Taylor', 'Ringgold', 'Decatur', 'Wayne', 'Appanoose', 'Davis', 'Van Buren', 'Lee']
      },

      // CALIFORNIA
      'california-1': {
        proj4: '+proj=lcc +lat_1=41.66666666666666 +lat_2=40 +lat_0=39.33333333333334 +lon_0=-122 +x_0=2000000.0001016 +y_0=500000.0001016 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2225',
        name: 'California Zone 1 (NAD83 / US Feet)',
        state: 'CA'
      },
      'california-3': {
        proj4: '+proj=lcc +lat_1=38.43333333333333 +lat_2=37.06666666666667 +lat_0=36.5 +lon_0=-120.5 +x_0=2000000.0001016 +y_0=500000.0001016 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2227',
        name: 'California Zone 3 (NAD83 / US Feet)',
        state: 'CA'
      },
      'california-5': {
        proj4: '+proj=lcc +lat_1=35.46666666666667 +lat_2=34.03333333333333 +lat_0=33.5 +lon_0=-118 +x_0=2000000.0001016 +y_0=500000.0001016 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2229',
        name: 'California Zone 5 (NAD83 / US Feet)',
        state: 'CA'
      },

      // TEXAS
      'texas-north': {
        proj4: '+proj=lcc +lat_1=36.18333333333333 +lat_2=34.65 +lat_0=34 +lon_0=-101.5 +x_0=200000.0001016 +y_0=1000000.0001016 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2275',
        name: 'Texas North (NAD83 / US Feet)',
        state: 'TX'
      },
      'texas-central': {
        proj4: '+proj=lcc +lat_1=32.13333333333333 +lat_2=30.11666666666667 +lat_0=29.66666666666667 +lon_0=-100.3333333333333 +x_0=700000.0001016 +y_0=3000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2277',
        name: 'Texas Central (NAD83 / US Feet)',
        state: 'TX'
      },
      'texas-south': {
        proj4: '+proj=lcc +lat_1=27.83333333333333 +lat_2=26.16666666666667 +lat_0=25.66666666666667 +lon_0=-98.5 +x_0=300000.0001016 +y_0=5000000.0001016 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2279',
        name: 'Texas South (NAD83 / US Feet)',
        state: 'TX'
      },

      // FLORIDA
      'florida-north': {
        proj4: '+proj=lcc +lat_1=30.75 +lat_2=29.58333333333333 +lat_0=29 +lon_0=-84.5 +x_0=600000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2238',
        name: 'Florida North (NAD83 / US Feet)',
        state: 'FL'
      },
      'florida-east': {
        proj4: '+proj=tmerc +lat_0=24.33333333333333 +lon_0=-81 +k=0.9999411764705882 +x_0=200000.0001016 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2236',
        name: 'Florida East (NAD83 / US Feet)',
        state: 'FL'
      },

      // NEW YORK
      'newyork-long-island': {
        proj4: '+proj=lcc +lat_1=41.03333333333333 +lat_2=40.66666666666666 +lat_0=40.16666666666666 +lon_0=-74 +x_0=300000.0000000001 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2263',
        name: 'New York Long Island (NAD83 / US Feet)',
        state: 'NY'
      },

      // PENNSYLVANIA
      'pennsylvania-north': {
        proj4: '+proj=lcc +lat_1=41.95 +lat_2=40.88333333333333 +lat_0=40.16666666666666 +lon_0=-77.75 +x_0=600000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2271',
        name: 'Pennsylvania North (NAD83 / US Feet)',
        state: 'PA'
      },
      'pennsylvania-south': {
        proj4: '+proj=lcc +lat_1=40.96666666666667 +lat_2=39.93333333333333 +lat_0=39.33333333333334 +lon_0=-77.75 +x_0=600000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2272',
        name: 'Pennsylvania South (NAD83 / US Feet)',
        state: 'PA'
      },

      // OHIO
      'ohio-north': {
        proj4: '+proj=lcc +lat_1=41.7 +lat_2=40.43333333333333 +lat_0=39.66666666666666 +lon_0=-82.5 +x_0=600000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:3734',
        name: 'Ohio North (NAD83 / US Feet)',
        state: 'OH'
      },
      'ohio-south': {
        proj4: '+proj=lcc +lat_1=40.03333333333333 +lat_2=38.73333333333333 +lat_0=38 +lon_0=-82.5 +x_0=600000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:3735',
        name: 'Ohio South (NAD83 / US Feet)',
        state: 'OH'
      },

      // ILLINOIS
      'illinois-east': {
        proj4: '+proj=tmerc +lat_0=36.66666666666666 +lon_0=-88.33333333333333 +k=0.9999749999999999 +x_0=300000.0000000001 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:3435',
        name: 'Illinois East (NAD83 / US Feet)',
        state: 'IL'
      },
      'illinois-west': {
        proj4: '+proj=tmerc +lat_0=36.66666666666666 +lon_0=-90.16666666666667 +k=0.9999411764705882 +x_0=700000.0001016 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:3436',
        name: 'Illinois West (NAD83 / US Feet)',
        state: 'IL'
      },

      // MICHIGAN
      'michigan-north': {
        proj4: '+proj=lcc +lat_1=47.08333333333334 +lat_2=45.48333333333333 +lat_0=44.78333333333333 +lon_0=-87 +x_0=8000000.000101599 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:6493',
        name: 'Michigan North (NAD83 / US Feet)',
        state: 'MI'
      },
      'michigan-south': {
        proj4: '+proj=lcc +lat_1=43.66666666666666 +lat_2=42.1 +lat_0=41.5 +lon_0=-84.36666666666666 +x_0=4000000.000101599 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:6495',
        name: 'Michigan South (NAD83 / US Feet)',
        state: 'MI'
      },

      // WISCONSIN
      'wisconsin-north': {
        proj4: '+proj=lcc +lat_1=46.76666666666667 +lat_2=45.56666666666667 +lat_0=45.16666666666666 +lon_0=-90 +x_0=600000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2289',
        name: 'Wisconsin North (NAD83 / US Feet)',
        state: 'WI'
      },

      // MINNESOTA
      'minnesota-north': {
        proj4: '+proj=lcc +lat_1=48.63333333333333 +lat_2=47.03333333333333 +lat_0=46.5 +lon_0=-93.09999999999999 +x_0=800000.0001016 +y_0=100000.0001016 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:26849',
        name: 'Minnesota North (NAD83 / US Feet)',
        state: 'MN'
      },

      // WASHINGTON
      'washington-north': {
        proj4: '+proj=lcc +lat_1=48.73333333333333 +lat_2=47.5 +lat_0=47 +lon_0=-120.8333333333333 +x_0=500000.0001016 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2285',
        name: 'Washington North (NAD83 / US Feet)',
        state: 'WA'
      },

      // OREGON
      'oregon-north': {
        proj4: '+proj=lcc +lat_1=46 +lat_2=44.33333333333334 +lat_0=43.66666666666666 +lon_0=-120.5 +x_0=2500000.0001424 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2269',
        name: 'Oregon North (NAD83 / US Feet)',
        state: 'OR'
      },

      // COLORADO
      'colorado-north': {
        proj4: '+proj=lcc +lat_1=40.78333333333333 +lat_2=39.71666666666667 +lat_0=39.33333333333334 +lon_0=-105.5 +x_0=914401.8288036576 +y_0=304800.6096012192 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2231',
        name: 'Colorado North (NAD83 / US Feet)',
        state: 'CO'
      },

      // ARIZONA
      'arizona-east': {
        proj4: '+proj=tmerc +lat_0=31 +lon_0=-110.1666666666667 +k=0.9999 +x_0=213360 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2222',
        name: 'Arizona East (NAD83 / US Feet)',
        state: 'AZ'
      },

      // VIRGINIA
      'virginia-north': {
        proj4: '+proj=lcc +lat_1=39.2 +lat_2=38.03333333333333 +lat_0=37.66666666666666 +lon_0=-78.5 +x_0=3500000.0001016 +y_0=2000000.0001016 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:3968',
        name: 'Virginia North (NAD83 / US Feet)',
        state: 'VA'
      },

      // NORTH CAROLINA
      'northcarolina': {
        proj4: '+proj=lcc +lat_1=36.16666666666666 +lat_2=34.33333333333334 +lat_0=33.75 +lon_0=-79 +x_0=609601.2192024384 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:3358',
        name: 'North Carolina (NAD83 / US Feet)',
        state: 'NC'
      },

      // GEORGIA
      'georgia-east': {
        proj4: '+proj=tmerc +lat_0=30 +lon_0=-82.16666666666667 +k=0.9999 +x_0=200000.0001016 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:2239',
        name: 'Georgia East (NAD83 / US Feet)',
        state: 'GA'
      },

      // NEW JERSEY
      'newjersey': {
        proj4: '+proj=tmerc +lat_0=38.83333333333334 +lon_0=-74.5 +k=0.9999 +x_0=150000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs',
        epsg: 'EPSG:3424',
        name: 'New Jersey (NAD83 / US Feet)',
        state: 'NJ'
      }
    };

    // Define WGS84 for proj4
    proj4.defs('WGS84', this.coordinateSystems.wgs84.proj4);
  }

  /**
   * Detect if coordinates are already in lat/lng (WGS84)
   */
  isLatLngCoordinates(extents) {
    const minX = extents.minX;
    const maxX = extents.maxX;
    const minY = extents.minY;
    const maxY = extents.maxY;

    if (minX === null || maxX === null || minY === null || maxY === null) {
      return false;
    }

    // Lat/lng characteristics:
    // - Latitude: -90 to 90 (U.S.: 24 to 50)
    // - Longitude: -180 to 180 (U.S.: -125 to -66)
    // - Values are typically small decimals (not large integers like State Plane)

    const isLat = minY >= -90 && maxY <= 90 && minY < maxY;
    const isLon = minX >= -180 && maxX <= 180 && minX < maxX;
    const isSmallRange = Math.abs(maxX - minX) < 50 && Math.abs(maxY - minY) < 50;

    return isLat && isLon && isSmallRange;
  }

  /**
   * Detect coordinate system from CAD file metadata or location
   */
  detectCoordinateSystem(caddModel) {
    // Check if explicitly specified
    if (caddModel.coordinate_system) {
      return caddModel.coordinate_system;
    }

    // Check if coordinates are already in lat/lng
    const extents = {
      minX: caddModel.extents_min_x,
      maxX: caddModel.extents_max_x,
      minY: caddModel.extents_min_y,
      maxY: caddModel.extents_max_y
    };

    if (this.isLatLngCoordinates(extents)) {
      console.log(`✅ Detected WGS84 lat/lng coordinates (no transformation needed)`);
      return 'wgs84';
    }

    // Try to detect from state
    const state = (caddModel.state || '').toUpperCase().trim();
    const county = (caddModel.county || '').trim();

    // State-specific detection with zone logic
    if (state === 'IA') {
      // Check Iowa county to determine north vs south zone
      if (county) {
        if (this.coordinateSystems['iowa-north'].counties.includes(county)) {
          return 'iowa-north';
        }
        if (this.coordinateSystems['iowa-south'].counties.includes(county)) {
          return 'iowa-south';
        }
      }

      // Check extents to guess zone
      const minX = extents.minX;
      if (minX !== null) {
        // Iowa North zone X ranges: ~1,400,000 to ~1,900,000
        // Iowa South zone X ranges: ~100,000 to ~900,000
        if (minX > 1000000) {
          return 'iowa-north';
        } else if (minX < 1000000) {
          return 'iowa-south';
        }
      }

      // Default to Iowa North
      console.warn(`⚠️  Could not determine Iowa zone, defaulting to Iowa North`);
      return 'iowa-north';
    }

    // Try to find matching state coordinate system
    for (const [key, system] of Object.entries(this.coordinateSystems)) {
      if (system.state === state && !key.includes('-')) {
        // Single-zone state (e.g., New Jersey, North Carolina)
        console.log(`✅ Detected ${system.name} based on state: ${state}`);
        return key;
      }
    }

    // For multi-zone states, default to north zone if available
    const northZone = `${state.toLowerCase()}-north`;
    if (this.coordinateSystems[northZone]) {
      console.warn(`⚠️  Multi-zone state ${state} detected, defaulting to north zone`);
      return northZone;
    }

    // Try to match by state alone (first match)
    for (const [key, system] of Object.entries(this.coordinateSystems)) {
      if (system.state === state) {
        console.warn(`⚠️  Using ${system.name} for state ${state}`);
        return key;
      }
    }

    // Last resort: try to detect from coordinate magnitude
    const minX = extents.minX;
    const minY = extents.minY;

    if (minX !== null && minY !== null) {
      // State Plane coordinates are typically 200,000 to 3,000,000 (feet)
      // UTM coordinates are typically 100,000 to 900,000 (meters)
      if (minX > 100000 && minX < 10000000) {
        console.warn(`⚠️  Coordinates appear to be State Plane, but state unknown. Defaulting to Iowa North.`);
        return 'iowa-north';
      }
    }

    throw new Error(
      `Unable to detect coordinate system for model ${caddModel.id || 'unknown'}.\n\n` +
      `Please specify the coordinate system explicitly:\n` +
      `  - State: ${state || 'NOT PROVIDED'}\n` +
      `  - County: ${county || 'NOT PROVIDED'}\n` +
      `  - Extents: (${extents.minX}, ${extents.minY}) to (${extents.maxX}, ${extents.maxY})\n\n` +
      `Provide the state (e.g., 'IA', 'CA', 'TX') or specific coordinate system when uploading.`
    );
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
   * Transform coordinates from state plane (or other system) to WGS84
   */
  transformToWGS84(x, y, sourceSystem = 'iowa-north') {
    try {
      const system = this.coordinateSystems[sourceSystem];
      if (!system) {
        throw new Error(`Unknown coordinate system: ${sourceSystem}`);
      }

      let lat, lon;

      // If already in WGS84 (lat/lng), no transformation needed
      if (system.isLatLng) {
        // Coordinates are already lat/lng
        // Convention: DXF files typically store lon, lat (X, Y)
        lon = x;
        lat = y;
      } else {
        // Transform from state plane to WGS84
        const sourceDef = system.proj4;
        [lon, lat] = proj4(sourceDef, 'WGS84', [x, y]);
      }

      // Validate coordinates are within U.S. bounds
      const boundsCheck = this.isWithinUSBounds(lat, lon);
      if (!boundsCheck.valid) {
        if (system.isLatLng) {
          console.error(`❌ Coordinates (${lat.toFixed(6)}, ${lon.toFixed(6)}) are OUTSIDE United States bounds!`);
          console.error(`   Source: Already in WGS84 lat/lng`);
        } else {
          console.error(`❌ Transformed coordinates (${lat.toFixed(6)}, ${lon.toFixed(6)}) are OUTSIDE United States bounds!`);
          console.error(`   Original: (${x}, ${y}) in ${sourceSystem}`);
        }
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

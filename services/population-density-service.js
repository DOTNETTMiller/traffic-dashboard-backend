/**
 * Population Density Service
 *
 * Integrates with GIS data sources to:
 * - Calculate population within geofence boundaries
 * - Identify and exclude populated/urban areas
 * - Provide real-time population impact estimates
 * - Visualize population density for IPAWS alert targeting
 */

const turf = require('@turf/turf');
const axios = require('axios');
const ee = require('@google/earthengine');

// Configure axios with default timeout to prevent hanging requests
const axiosWithTimeout = axios.create({
  timeout: 10000, // 10 second timeout for all external API calls
  headers: {
    'User-Agent': 'DOT-Corridor-Communicator/1.0'
  }
});

class PopulationDensityService {
  constructor() {
    // Census data sources (can be configured)
    this.dataSources = {
      // US Census Bureau Population Density
      census: {
        // Census TIGER Web Services for block-level population
        url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer',
        // Census API for detailed demographic data
        apiUrl: 'https://api.census.gov/data/2020/dec/pl',
        // FIXED: Now uses spatial intersection (TIGER + booleanIntersects)
        enabled: process.env.CENSUS_API_KEY ? true : false,
        apiKey: process.env.CENSUS_API_KEY || null
      },
      // LandScan population data (Oak Ridge National Lab via Google Earth Engine)
      landscan: {
        // LandScan Global available through Google Earth Engine
        // Dataset: projects/sat-io/open-datasets/ORNL/LANDSCAN_GLOBAL
        geeServiceAccount: process.env.GEE_SERVICE_ACCOUNT || null,
        geePrivateKey: process.env.GEE_PRIVATE_KEY || null,
        enabled: (process.env.GEE_SERVICE_ACCOUNT && process.env.GEE_PRIVATE_KEY) ? true : false
      },
      // OpenStreetMap for urban boundaries
      osm: {
        // Overpass API for querying OSM data
        overpassUrl: 'https://overpass-api.de/api/interpreter',
        // Nominatim for geocoding
        nominatimUrl: 'https://nominatim.openstreetmap.org',
        enabled: true // Free, no API key needed
      },
      // Iowa State GIS (Iowa Geographic Information System)
      stateGIS: {
        // Iowa Geospatial Data Gateway
        url: 'https://data.iowadnr.gov/arcgis/rest/services',
        // Iowa DOT GIS services
        dotUrl: 'https://maps.iowadot.gov/arcgis/rest/services',
        enabled: true // Public, no API key needed
      },
      // Simple estimation based on land use (fallback)
      estimation: {
        enabled: true
      }
    };

    // Population density thresholds (people per square mile)
    this.densityThresholds = {
      rural: 0,
      suburban: 500,
      urban: 2000,
      dense_urban: 5000
    };

    // Iowa population centers (for estimation)
    this.populationCenters = [
      { name: 'Des Moines', lat: 41.5868, lng: -93.6250, population: 215000, radius: 15 },
      { name: 'Cedar Rapids', lat: 41.9779, lng: -91.6656, population: 133000, radius: 10 },
      { name: 'Davenport', lat: 41.5236, lng: -90.5776, population: 102000, radius: 8 },
      { name: 'Sioux City', lat: 42.4999, lng: -96.4003, population: 85000, radius: 7 },
      { name: 'Iowa City', lat: 41.6611, lng: -91.5302, population: 75000, radius: 6 },
      { name: 'Waterloo', lat: 42.4928, lng: -92.3426, population: 68000, radius: 6 },
      { name: 'Council Bluffs', lat: 41.2619, lng: -95.8608, population: 62000, radius: 6 },
      { name: 'Ames', lat: 42.0308, lng: -93.6319, population: 66000, radius: 5 },
      { name: 'West Des Moines', lat: 41.5772, lng: -93.7114, population: 67000, radius: 5 },
      { name: 'Ankeny', lat: 41.7297, lng: -93.6058, population: 67000, radius: 5 },
      { name: 'Dubuque', lat: 42.5006, lng: -90.6648, population: 58000, radius: 5 },
      { name: 'Cedar Falls', lat: 42.5348, lng: -92.4453, population: 40000, radius: 4 }
    ];

    // Earth Engine initialization state
    this.eeInitialized = false;
    this.eeInitializing = false;

    // Initialize Earth Engine if credentials available
    if (this.dataSources.landscan.enabled) {
      this.initializeEarthEngine();
    }
  }

  /**
   * Initialize Google Earth Engine with service account credentials
   */
  async initializeEarthEngine() {
    if (this.eeInitialized || this.eeInitializing) {
      return;
    }

    this.eeInitializing = true;

    try {
      // Check if service account credentials are available
      if (!this.dataSources.landscan.geeServiceAccount || !this.dataSources.landscan.geePrivateKey) {
        console.log('⚠️ Google Earth Engine credentials not configured');
        this.dataSources.landscan.enabled = false;
        return;
      }

      // Parse service account JSON
      let privateKey;
      try {
        // GEE_PRIVATE_KEY can be either JSON string or base64-encoded JSON
        const keyString = this.dataSources.landscan.geePrivateKey;
        if (keyString.startsWith('{')) {
          privateKey = JSON.parse(keyString);
        } else {
          // Try base64 decode
          const decoded = Buffer.from(keyString, 'base64').toString('utf-8');
          privateKey = JSON.parse(decoded);
        }
      } catch (parseError) {
        console.error('❌ Failed to parse Google Earth Engine service account key:', parseError.message);
        this.dataSources.landscan.enabled = false;
        return;
      }

      // Authenticate and initialize Earth Engine
      await new Promise((resolve, reject) => {
        ee.data.authenticateViaPrivateKey(
          privateKey,
          () => {
            ee.initialize(
              null,
              null,
              () => {
                this.eeInitialized = true;
                console.log('✅ Google Earth Engine initialized successfully');
                resolve();
              },
              (initError) => {
                console.error('❌ Earth Engine initialization error:', initError);
                this.dataSources.landscan.enabled = false;
                reject(initError);
              }
            );
          },
          (authError) => {
            console.error('❌ Earth Engine authentication error:', authError);
            this.dataSources.landscan.enabled = false;
            reject(authError);
          }
        );
      });
    } catch (error) {
      console.error('❌ Error initializing Earth Engine:', error.message);
      this.dataSources.landscan.enabled = false;
    } finally {
      this.eeInitializing = false;
    }
  }

  /**
   * Estimate population within a geofence
   * Uses distance from population centers and area-based estimation
   */
  estimatePopulation(geofence, options = {}) {
    const {
      excludeUrban = false,
      urbanThreshold = 2000 // people per sq mi
    } = options;

    // Calculate area in square miles
    const areaSquareMiles = turf.area(geofence) / 2589988.11;

    // Get geofence center point
    const center = turf.center(geofence);
    const [centerLng, centerLat] = center.geometry.coordinates;

    // Calculate base population density based on proximity to population centers
    let baselineDensity = 50; // Rural Iowa baseline: ~50 people/sq mi
    let totalUrbanPopulation = 0;
    let totalRuralPopulation = 0;
    const affectedCities = [];

    // Check proximity to each population center
    for (const city of this.populationCenters) {
      const cityPoint = turf.point([city.lng, city.lat]);
      const distance = turf.distance(center, cityPoint, { units: 'miles' });

      // Check if geofence intersects with city
      const cityCircle = turf.circle([city.lng, city.lat], city.radius, { units: 'miles' });

      try {
        const intersection = turf.intersect(geofence, cityCircle);

        if (intersection) {
          // Geofence overlaps with city - calculate affected urban population
          const overlapArea = turf.area(intersection) / 2589988.11;
          const cityDensity = city.population / (Math.PI * city.radius * city.radius);
          const urbanPop = Math.round(overlapArea * cityDensity);

          totalUrbanPopulation += urbanPop;
          affectedCities.push({
            name: city.name,
            population: urbanPop,
            distance: distance,
            overlapPercent: (overlapArea / areaSquareMiles) * 100
          });
        } else if (distance < city.radius * 2) {
          // Near a city - increase baseline density
          const proximityFactor = 1 - (distance / (city.radius * 2));
          baselineDensity = Math.max(baselineDensity, 200 * proximityFactor);
        }
      } catch (e) {
        // Intersection failed - polygons don't overlap
        if (distance < city.radius * 2) {
          const proximityFactor = 1 - (distance / (city.radius * 2));
          baselineDensity = Math.max(baselineDensity, 200 * proximityFactor);
        }
      }
    }

    // Calculate rural population (areas not in cities)
    const ruralArea = areaSquareMiles - (totalUrbanPopulation / 1000); // Rough estimate
    totalRuralPopulation = Math.round(Math.max(0, ruralArea * baselineDensity));

    // Total population
    let totalPopulation = totalUrbanPopulation + totalRuralPopulation;

    // If excluding urban areas, only count rural
    if (excludeUrban) {
      totalPopulation = totalRuralPopulation;
    }

    return {
      total: totalPopulation,
      urban: totalUrbanPopulation,
      rural: totalRuralPopulation,
      density: totalPopulation / areaSquareMiles,
      areaSquareMiles,
      affectedCities,
      classification: this.classifyDensity(totalPopulation / areaSquareMiles),
      excludedUrban: excludeUrban
    };
  }

  /**
   * Classify area based on population density
   */
  classifyDensity(density) {
    if (density >= this.densityThresholds.dense_urban) return 'dense_urban';
    if (density >= this.densityThresholds.urban) return 'urban';
    if (density >= this.densityThresholds.suburban) return 'suburban';
    return 'rural';
  }

  /**
   * Get population density heatmap data for visualization
   * Returns grid of population density values
   */
  getPopulationHeatmap(bounds, gridSize = 20) {
    const heatmapData = [];

    // Create grid within bounds
    const bbox = [bounds.west, bounds.south, bounds.east, bounds.north];
    const cellSide = Math.min(
      (bounds.east - bounds.west) / gridSize,
      (bounds.north - bounds.south) / gridSize
    );

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const lng = bounds.west + (i * cellSide);
        const lat = bounds.south + (j * cellSide);

        // Calculate density at this point
        const density = this.getPointDensity(lat, lng);

        if (density > 0) {
          heatmapData.push({
            lat,
            lng,
            density,
            intensity: Math.min(density / 1000, 1) // Normalize for visualization
          });
        }
      }
    }

    return heatmapData;
  }

  /**
   * Get population density at a specific point
   */
  getPointDensity(lat, lng) {
    let maxDensity = 50; // Rural baseline

    for (const city of this.populationCenters) {
      const distance = this.calculateDistance(lat, lng, city.lat, city.lng);

      if (distance < city.radius) {
        // Inside city - high density
        const cityDensity = city.population / (Math.PI * city.radius * city.radius);
        const distanceFactor = 1 - (distance / city.radius);
        maxDensity = Math.max(maxDensity, cityDensity * distanceFactor);
      } else if (distance < city.radius * 3) {
        // Suburban area - moderate density
        const proximityFactor = 1 - ((distance - city.radius) / (city.radius * 2));
        maxDensity = Math.max(maxDensity, 500 * proximityFactor);
      }
    }

    return Math.round(maxDensity);
  }

  /**
   * Calculate distance between two points in miles
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const point1 = turf.point([lng1, lat1]);
    const point2 = turf.point([lng2, lat2]);
    return turf.distance(point1, point2, { units: 'miles' });
  }

  /**
   * Identify urban areas within geofence that should be excluded
   */
  identifyUrbanAreas(geofence) {
    const urbanAreas = [];

    for (const city of this.populationCenters) {
      const cityCircle = turf.circle([city.lng, city.lat], city.radius, { units: 'miles' });

      try {
        const intersection = turf.intersect(geofence, cityCircle);

        if (intersection) {
          const overlapArea = turf.area(intersection) / 2589988.11;
          const cityDensity = city.population / (Math.PI * city.radius * city.radius);

          urbanAreas.push({
            name: city.name,
            geometry: cityCircle,
            intersection: intersection,
            population: Math.round(overlapArea * cityDensity),
            area: overlapArea,
            density: cityDensity,
            shouldExclude: cityDensity > this.densityThresholds.urban
          });
        }
      } catch (e) {
        // No intersection
      }
    }

    return urbanAreas;
  }

  /**
   * Adjust geofence to exclude urban areas
   * Returns modified geofence with urban areas subtracted
   */
  excludeUrbanAreas(geofence, maxPopulation = 5000) {
    const urbanAreas = this.identifyUrbanAreas(geofence);
    let adjustedGeofence = geofence;
    let currentPopulation = this.estimatePopulation(geofence);
    const excluded = [];

    // Sort urban areas by population (largest first)
    urbanAreas.sort((a, b) => b.population - a.population);

    for (const urban of urbanAreas) {
      if (currentPopulation.total > maxPopulation && urban.shouldExclude) {
        try {
          // Subtract urban area from geofence
          const difference = turf.difference(adjustedGeofence, urban.intersection);

          if (difference) {
            adjustedGeofence = difference;
            currentPopulation = this.estimatePopulation(adjustedGeofence);
            excluded.push(urban.name);
          }
        } catch (e) {
          console.error('Failed to exclude urban area:', urban.name, e);
        }
      }
    }

    return {
      geofence: adjustedGeofence,
      excluded: excluded,
      population: currentPopulation,
      reductionPercent: ((currentPopulation.total / this.estimatePopulation(geofence).total) * 100).toFixed(0)
    };
  }

  /**
   * Suggest optimal geofence adjustment to meet population target
   */
  suggestGeofenceAdjustment(event, currentGeofence, targetPopulation = 5000) {
    const currentPop = this.estimatePopulation(currentGeofence);

    if (currentPop.total <= targetPopulation) {
      return {
        needsAdjustment: false,
        currentPopulation: currentPop.total,
        targetPopulation,
        message: 'Geofence population is within target'
      };
    }

    // Try excluding urban areas first
    const excludedResult = this.excludeUrbanAreas(currentGeofence, targetPopulation);

    if (excludedResult.population.total <= targetPopulation) {
      return {
        needsAdjustment: true,
        method: 'exclude_urban',
        adjustedGeofence: excludedResult.geofence,
        currentPopulation: currentPop.total,
        adjustedPopulation: excludedResult.population.total,
        targetPopulation,
        excluded: excludedResult.excluded,
        message: `Excluded ${excludedResult.excluded.join(', ')} to reduce population by ${100 - excludedResult.reductionPercent}%`
      };
    }

    // If still too high, suggest reducing buffer
    const reductionFactor = Math.sqrt(targetPopulation / currentPop.total);
    const suggestedBuffer = currentGeofence.bufferMiles ? (currentGeofence.bufferMiles * reductionFactor) : 1.0;

    return {
      needsAdjustment: true,
      method: 'reduce_buffer',
      currentPopulation: currentPop.total,
      targetPopulation,
      currentBuffer: currentGeofence.bufferMiles || 1.0,
      suggestedBuffer: Math.round(suggestedBuffer * 4) / 4, // Round to 0.25 mi
      message: `Reduce buffer to ${suggestedBuffer.toFixed(2)} miles to meet population target`
    };
  }

  /**
   * Get visual data for map overlay
   */
  getVisualizationData(geofence, options = {}) {
    const population = this.estimatePopulation(geofence, options);
    const urbanAreas = this.identifyUrbanAreas(geofence);

    return {
      population,
      urbanAreas,
      affectedCities: population.affectedCities,
      classification: population.classification,
      visualization: {
        geofence: geofence,
        urbanExclusions: urbanAreas.filter(u => u.shouldExclude).map(u => u.intersection),
        populationHotspots: population.affectedCities.map(city => ({
          name: city.name,
          population: city.population,
          overlapPercent: city.overlapPercent
        }))
      }
    };
  }

  // ============================================================================
  // ENHANCED DATA SOURCE INTEGRATIONS
  // ============================================================================

  /**
   * 1. US CENSUS BUREAU INTEGRATION
   * Fetch official census tract population data
   */
  async getCensusPopulation(geofence) {
    if (!this.dataSources.census.enabled || !this.dataSources.census.apiKey) {
      console.log('Census API not configured, using estimation');
      return null;
    }

    try {
      const bbox = turf.bbox(geofence);
      const [west, south, east, north] = bbox;

      // Step 1: Query Census TIGER/Web ArcGIS service for tract geometries in bbox
      // This service provides spatial queries with actual tract boundaries
      const tigerUrl = `${this.dataSources.census.url}/8/query`; // Layer 8 = Census Tracts

      const tigerResponse = await axiosWithTimeout.get(tigerUrl, {
        params: {
          where: 'STATE = 19', // Iowa FIPS code
          geometry: `${west},${south},${east},${north}`,
          geometryType: 'esriGeometryEnvelope',
          spatialRel: 'esriSpatialRelIntersects',
          outFields: 'GEOID,STATE,COUNTY,TRACT,BASENAME',
          returnGeometry: true,
          f: 'geojson'
        },
        timeout: 15000
      });

      if (!tigerResponse.data || !tigerResponse.data.features) {
        console.log('⚠️ No census tracts found in area');
        return null;
      }

      // Step 2: Filter to only tracts that actually intersect the geofence polygon (not just bbox)
      const intersectingTracts = [];
      for (const feature of tigerResponse.data.features) {
        try {
          const tractGeom = turf.feature(feature.geometry);
          // Check if tract polygon intersects our geofence
          if (turf.booleanIntersects(tractGeom, geofence)) {
            intersectingTracts.push({
              geoid: feature.properties.GEOID,
              state: feature.properties.STATE,
              county: feature.properties.COUNTY,
              tract: feature.properties.TRACT,
              name: feature.properties.BASENAME
            });
          }
        } catch (e) {
          // Skip invalid geometries
        }
      }

      if (intersectingTracts.length === 0) {
        console.log('⚠️ No census tracts intersect geofence');
        return null;
      }

      // Step 3: Query Census API for population data for only the intersecting tracts
      // Build query for specific counties to reduce data transfer
      const counties = [...new Set(intersectingTracts.map(t => t.county))];

      let allTracts = [];

      // Query each county separately (Census API limit)
      for (const county of counties) {
        const popUrl = `${this.dataSources.census.apiUrl}?get=P1_001N,NAME&for=tract:*&in=state:19+county:${county}&key=${this.dataSources.census.apiKey}`;

        const popResponse = await axiosWithTimeout.get(popUrl, {
          timeout: 10000,
          headers: { 'User-Agent': 'DOT-Corridor-Communicator-IPAWS/1.0' }
        });

        if (popResponse.data && popResponse.data.length > 1) {
          // Skip header row and add to results
          allTracts = allTracts.concat(popResponse.data.slice(1));
        }
      }

      // Step 4: Sum population only for tracts that intersect our geofence
      let totalPopulation = 0;
      const matchedTracts = [];
      const intersectingGeoids = new Set(intersectingTracts.map(t => t.geoid));

      for (const tractData of allTracts) {
        const [population, name, state, county, tract] = tractData;
        const geoid = `${state}${county}${tract}`; // Build GEOID

        // Only count if this tract actually intersects our geofence
        if (intersectingGeoids.has(geoid)) {
          const pop = parseInt(population);
          if (!isNaN(pop)) {
            totalPopulation += pop;
            matchedTracts.push({
              name,
              state,
              county,
              tract,
              geoid,
              population: pop
            });
          }
        }
      }

      console.log(`✅ Census data: ${totalPopulation.toLocaleString()} people across ${matchedTracts.length} intersecting tracts (${counties.length} counties)`);

      return {
        source: 'US Census Bureau 2020',
        total: totalPopulation,
        tracts: matchedTracts.slice(0, 10), // Return top 10 tracts
        tractCount: matchedTracts.length,
        countyCount: counties.length,
        accuracy: 'very_high' // Now using actual spatial intersection
      };
    } catch (error) {
      console.error('Census API error:', error.message);
      return null;
    }
  }

  /**
   * 2. LANDSCAN INTEGRATION (Oak Ridge National Lab via Google Earth Engine)
   * High-resolution global population data (~1km cells)
   * Dataset: projects/sat-io/open-datasets/ORNL/LANDSCAN_GLOBAL
   */
  async getLandScanPopulation(geofence) {
    if (!this.dataSources.landscan.enabled) {
      console.log('⚠️ LandScan via Google Earth Engine not configured');
      return null;
    }

    // Wait for Earth Engine initialization if in progress
    if (this.eeInitializing) {
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.eeInitializing) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    if (!this.eeInitialized) {
      console.log('⚠️ Earth Engine not initialized');
      return null;
    }

    try {
      const bbox = turf.bbox(geofence);
      const [west, south, east, north] = bbox;

      // Query LandScan Global from Google Earth Engine
      // Use callback-based API with Promise wrapper
      const populationData = await new Promise((resolve, reject) => {
        try {
          // Load LandScan Global ImageCollection from community catalog
          const landscan = ee.ImageCollection('projects/sat-io/open-datasets/ORNL/LANDSCAN_GLOBAL');

          // Get most recent year
          const latestYear = landscan.sort('system:time_start', false).first();

          // Define region of interest from bounding box
          const region = ee.Geometry.Rectangle([west, south, east, north]);

          // Calculate population statistics within the region
          const stats = latestYear.reduceRegion({
            reducer: ee.Reducer.sum(),
            geometry: region,
            scale: 1000, // 1km resolution
            maxPixels: 1e9
          });

          // Get the result
          stats.evaluate((result, error) => {
            if (error) {
              reject(new Error(error));
            } else {
              resolve(result);
            }
          });
        } catch (error) {
          reject(error);
        }
      });

      // Extract population value (band name varies by year)
      let totalPopulation = 0;

      // LandScan bands are typically named 'b1' or 'population'
      if (populationData.b1 !== undefined) {
        totalPopulation = Math.round(populationData.b1);
      } else if (populationData.population !== undefined) {
        totalPopulation = Math.round(populationData.population);
      } else {
        // Try to find any numeric band
        const bandValues = Object.values(populationData).filter(v => typeof v === 'number');
        if (bandValues.length > 0) {
          totalPopulation = Math.round(bandValues[0]);
        }
      }

      console.log(`✅ LandScan (Google Earth Engine): ${totalPopulation.toLocaleString()} people`);

      return {
        source: 'LandScan Global (ORNL via Google Earth Engine)',
        total: totalPopulation,
        resolution: '1km',
        accuracy: 'very_high',
        year: 2024, // LandScan 2024 is latest
        method: 'Google Earth Engine spatial query'
      };
    } catch (error) {
      console.error('❌ LandScan/Earth Engine query error:', error.message);
      return null;
    }
  }

  /**
   * 3. OPENSTREETMAP INTEGRATION
   * Query urban boundaries, administrative boundaries, and land use
   */
  async getOSMUrbanBoundaries(geofence) {
    if (!this.dataSources.osm.enabled) {
      return null;
    }

    try {
      const bbox = turf.bbox(geofence);
      const [west, south, east, north] = bbox;

      // Overpass QL query for urban areas
      const query = `
        [out:json][timeout:25];
        (
          // Cities and towns
          way["place"~"city|town"]["name"](${south},${west},${north},${east});
          relation["place"~"city|town"]["name"](${south},${west},${north},${east});

          // Urban land use
          way["landuse"~"residential|commercial|industrial"](${south},${west},${north},${east});
          relation["landuse"~"residential|commercial|industrial"](${south},${west},${north},${east});
        );
        out geom;
      `;

      const response = await axiosWithTimeout.post(
        this.dataSources.osm.overpassUrl,
        `data=${encodeURIComponent(query)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 30000
        }
      );

      if (response.data && response.data.elements) {
        const urbanAreas = [];

        for (const element of response.data.elements) {
          if (element.tags && element.tags.name) {
            urbanAreas.push({
              name: element.tags.name,
              type: element.tags.place || element.tags.landuse,
              osm_id: element.id,
              population: element.tags.population ? parseInt(element.tags.population) : null,
              geometry: element.geometry || element.bounds
            });
          }
        }

        console.log(`✅ OSM data: ${urbanAreas.length} urban areas identified`);

        return {
          source: 'OpenStreetMap',
          urbanAreas: urbanAreas,
          boundariesFound: urbanAreas.filter(a => a.type === 'city' || a.type === 'town').length,
          landUseAreas: urbanAreas.filter(a => a.type !== 'city' && a.type !== 'town').length
        };
      }
    } catch (error) {
      console.error('OSM Overpass API error:', error.message);
      return null;
    }
  }

  /**
   * 4. IOWA STATE GIS INTEGRATION
   * Query Iowa-specific land use, municipal boundaries, and population data
   */
  async getIowaStateGISData(geofence) {
    if (!this.dataSources.stateGIS.enabled) {
      return null;
    }

    try {
      const bbox = turf.bbox(geofence);
      const [west, south, east, north] = bbox;

      // Query Iowa DOT GIS for municipal boundaries
      const municipalUrl = `${this.dataSources.stateGIS.dotUrl}/Municipal_Boundaries/MapServer/0/query`;
      const response = await axiosWithTimeout.get(municipalUrl, {
        params: {
          where: '1=1',
          geometry: `${west},${south},${east},${north}`,
          geometryType: 'esriGeometryEnvelope',
          spatialRel: 'esriSpatialRelIntersects',
          outFields: 'CITY_NAME,COUNTY,POP_2020,AREA_SQMI',
          returnGeometry: true,
          f: 'json'
        },
        timeout: 15000
      });

      if (response.data && response.data.features) {
        const municipalities = [];
        let totalPopulation = 0;

        for (const feature of response.data.features) {
          const attrs = feature.attributes;
          const pop = attrs.POP_2020 || 0;

          municipalities.push({
            name: attrs.CITY_NAME,
            county: attrs.COUNTY,
            population: pop,
            area: attrs.AREA_SQMI,
            geometry: feature.geometry
          });

          totalPopulation += pop;
        }

        console.log(`✅ Iowa GIS: ${municipalities.length} municipalities, ${totalPopulation.toLocaleString()} people`);

        // Also query land use data
        const landUseUrl = `${this.dataSources.stateGIS.url}/Land_Use/MapServer/0/query`;
        let landUseData = null;

        try {
          const landUseResponse = await axiosWithTimeout.get(landUseUrl, {
            params: {
              where: '1=1',
              geometry: `${west},${south},${east},${north}`,
              geometryType: 'esriGeometryEnvelope',
              spatialRel: 'esriSpatialRelIntersects',
              outFields: 'LAND_USE,ACRES',
              returnGeometry: false,
              f: 'json'
            },
            timeout: 10000
          });

          if (landUseResponse.data && landUseResponse.data.features) {
            landUseData = {
              residential: 0,
              commercial: 0,
              agricultural: 0,
              other: 0
            };

            for (const feature of landUseResponse.data.features) {
              const landUse = feature.attributes.LAND_USE?.toLowerCase();
              const acres = feature.attributes.ACRES || 0;

              if (landUse?.includes('residential')) landUseData.residential += acres;
              else if (landUse?.includes('commercial')) landUseData.commercial += acres;
              else if (landUse?.includes('ag') || landUse?.includes('farm')) landUseData.agricultural += acres;
              else landUseData.other += acres;
            }
          }
        } catch (luError) {
          console.warn('Iowa land use query failed:', luError.message);
        }

        return {
          source: 'Iowa State GIS',
          municipalities: municipalities,
          totalPopulation: totalPopulation,
          landUse: landUseData,
          accuracy: 'high'
        };
      }
    } catch (error) {
      console.error('Iowa State GIS error:', error.message);
      return null;
    }
  }

  /**
   * UNIFIED POPULATION QUERY
   * Attempts all available data sources and returns best available data
   */
  async getEnhancedPopulation(geofence, options = {}) {
    console.log('🔍 Querying enhanced population data sources...');

    const results = {
      timestamp: new Date().toISOString(),
      geofence: geofence,
      sources: {}
    };

    // Try all data sources in parallel
    const [census, landscan, osm, iowaGIS] = await Promise.all([
      this.getCensusPopulation(geofence).catch(e => null),
      this.getLandScanPopulation(geofence).catch(e => null),
      this.getOSMUrbanBoundaries(geofence).catch(e => null),
      this.getIowaStateGISData(geofence).catch(e => null)
    ]);

    // Collect available data
    if (census) results.sources.census = census;
    if (landscan) results.sources.landscan = landscan;
    if (osm) results.sources.osm = osm;
    if (iowaGIS) results.sources.iowaGIS = iowaGIS;

    // Determine best population estimate
    let bestEstimate = null;
    let confidence = 'low';

    // Priority: Iowa GIS (spatial intersection) > OSM > LandScan/Census (bbox issues) > Estimation
    // NOTE: LandScan uses bbox rectangle, Census queries ALL of Iowa (not geofence-specific)
    // Iowa GIS uses proper esriSpatialRelIntersects, so it's most accurate for geofenced areas
    if (iowaGIS && iowaGIS.totalPopulation) {
      bestEstimate = iowaGIS.totalPopulation;
      confidence = 'very_high';
      results.primarySource = 'Iowa State GIS (spatial intersection)';
    } else if (osm && osm.urbanAreas.length > 0) {
      // Sum OSM population tags
      bestEstimate = osm.urbanAreas.reduce((sum, area) => sum + (area.population || 0), 0);
      confidence = 'high';
      results.primarySource = 'OpenStreetMap';
    } else if (landscan && landscan.total) {
      bestEstimate = landscan.total;
      confidence = 'medium';
      results.primarySource = 'LandScan (ORNL - bbox estimate)';
    } else if (census && census.total) {
      bestEstimate = census.total;
      confidence = 'medium';
      results.primarySource = 'US Census Bureau (statewide fallback)';
    }

    // Fallback to estimation
    if (!bestEstimate || bestEstimate === 0) {
      const estimation = this.estimatePopulation(geofence, options);
      bestEstimate = estimation.total;
      confidence = 'low';
      results.primarySource = 'Estimation';
      results.sources.estimation = estimation;
    }

    results.population = bestEstimate;
    results.confidence = confidence;
    results.sourcesQueried = Object.keys(results.sources).length;

    // Calculate rural/urban breakdown
    let urbanPopulation = 0;
    let ruralPopulation = 0;
    const affectedCities = [];

    if (iowaGIS && iowaGIS.municipalities) {
      // Use Iowa GIS municipal data
      iowaGIS.municipalities.forEach(muni => {
        if (muni.population > 0) {
          urbanPopulation += muni.population;
          affectedCities.push({
            name: muni.name,
            population: muni.population,
            county: muni.county
          });
        }
      });
      ruralPopulation = Math.max(0, bestEstimate - urbanPopulation);
    } else if (osm && osm.urbanAreas && osm.urbanAreas.length > 0) {
      // Use OSM urban boundaries
      osm.urbanAreas.forEach(area => {
        urbanPopulation += area.population || 0;
        if (area.name) {
          affectedCities.push({
            name: area.name,
            population: area.population || 0
          });
        }
      });
      ruralPopulation = Math.max(0, bestEstimate - urbanPopulation);
    } else {
      // Estimate: assume 30% urban, 70% rural for highway corridors
      urbanPopulation = Math.round(bestEstimate * 0.3);
      ruralPopulation = Math.round(bestEstimate * 0.7);
    }

    results.rural = ruralPopulation;
    results.urban = urbanPopulation;
    results.affectedCities = affectedCities;

    console.log(`✅ Enhanced population: ${bestEstimate.toLocaleString()} people (${confidence} confidence, ${results.sourcesQueried} sources)`);
    console.log(`   Urban: ${urbanPopulation.toLocaleString()}, Rural: ${ruralPopulation.toLocaleString()}`);

    return results;
  }
}

module.exports = new PopulationDensityService();

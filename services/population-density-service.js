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

class PopulationDensityService {
  constructor() {
    // Census data sources (can be configured)
    this.dataSources = {
      // US Census Bureau Population Density (example)
      census: {
        url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer',
        enabled: false
      },
      // LandScan population data
      landscan: {
        url: 'https://landscan.ornl.gov',
        enabled: false
      },
      // Simple estimation based on land use
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
}

module.exports = new PopulationDensityService();

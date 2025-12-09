/**
 * State Detector - Determines US state from lat/lon coordinates
 * Uses bounding boxes for all 50 states
 */

const STATE_BOUNDS = {
  AL: { minLat: 30.223, maxLat: 35.008, minLon: -88.473, maxLon: -84.889 },
  AK: { minLat: 51.214, maxLat: 71.365, minLon: -179.149, maxLon: -129.980 },
  AZ: { minLat: 31.332, maxLat: 37.004, minLon: -114.817, maxLon: -109.045 },
  AR: { minLat: 33.005, maxLat: 36.500, minLon: -94.618, maxLon: -89.644 },
  CA: { minLat: 32.534, maxLat: 42.010, minLon: -124.409, maxLon: -114.131 },
  CO: { minLat: 36.993, maxLat: 41.003, minLon: -109.060, maxLon: -102.041 },
  CT: { minLat: 40.980, maxLat: 42.050, minLon: -73.728, maxLon: -71.787 },
  DE: { minLat: 38.451, maxLat: 39.839, minLon: -75.789, maxLon: -75.049 },
  FL: { minLat: 24.523, maxLat: 31.001, minLon: -87.635, maxLon: -80.031 },
  GA: { minLat: 30.358, maxLat: 35.001, minLon: -85.605, maxLon: -80.840 },
  HI: { minLat: 18.911, maxLat: 28.402, minLon: -178.335, maxLon: -154.807 },
  ID: { minLat: 41.988, maxLat: 49.001, minLon: -117.243, maxLon: -111.044 },
  IL: { minLat: 36.970, maxLat: 42.508, minLon: -91.513, maxLon: -87.495 },
  IN: { minLat: 37.772, maxLat: 41.761, minLon: -88.098, maxLon: -84.784 },
  IA: { minLat: 40.375, maxLat: 43.501, minLon: -96.639, maxLon: -90.140 },
  KS: { minLat: 36.993, maxLat: 40.003, minLon: -102.052, maxLon: -94.588 },
  KY: { minLat: 36.497, maxLat: 39.147, minLon: -89.571, maxLon: -81.965 },
  LA: { minLat: 28.928, maxLat: 33.019, minLon: -94.043, maxLon: -88.817 },
  ME: { minLat: 42.978, maxLat: 47.460, minLon: -71.084, maxLon: -66.950 },
  MD: { minLat: 37.912, maxLat: 39.723, minLon: -79.487, maxLon: -75.049 },
  MA: { minLat: 41.237, maxLat: 42.887, minLon: -73.508, maxLon: -69.929 },
  MI: { minLat: 41.697, maxLat: 48.306, minLon: -90.418, maxLon: -82.419 },
  MN: { minLat: 43.500, maxLat: 49.384, minLon: -97.239, maxLon: -89.489 },
  MS: { minLat: 30.174, maxLat: 34.996, minLon: -91.655, maxLon: -88.098 },
  MO: { minLat: 35.996, maxLat: 40.613, minLon: -95.774, maxLon: -89.099 },
  MT: { minLat: 44.358, maxLat: 49.001, minLon: -116.049, maxLon: -104.040 },
  NE: { minLat: 40.000, maxLat: 43.001, minLon: -104.053, maxLon: -95.308 },
  NV: { minLat: 35.002, maxLat: 42.002, minLon: -120.006, maxLon: -114.040 },
  NH: { minLat: 42.697, maxLat: 45.306, minLon: -72.557, maxLon: -70.703 },
  NJ: { minLat: 38.928, maxLat: 41.357, minLon: -75.563, maxLon: -73.894 },
  NM: { minLat: 31.332, maxLat: 37.000, minLon: -109.050, maxLon: -103.002 },
  NY: { minLat: 40.496, maxLat: 45.016, minLon: -79.762, maxLon: -71.857 },
  NC: { minLat: 33.842, maxLat: 36.588, minLon: -84.322, maxLon: -75.461 },
  ND: { minLat: 45.935, maxLat: 49.000, minLon: -104.049, maxLon: -96.554 },
  OH: { minLat: 38.404, maxLat: 41.978, minLon: -84.820, maxLon: -80.519 },
  OK: { minLat: 33.620, maxLat: 37.002, minLon: -103.002, maxLon: -94.431 },
  OR: { minLat: 41.992, maxLat: 46.299, minLon: -124.566, maxLon: -116.463 },
  PA: { minLat: 39.720, maxLat: 42.269, minLon: -80.520, maxLon: -74.689 },
  RI: { minLat: 41.146, maxLat: 42.019, minLon: -71.862, maxLon: -71.120 },
  SC: { minLat: 32.034, maxLat: 35.216, minLon: -83.354, maxLon: -78.541 },
  SD: { minLat: 42.480, maxLat: 45.945, minLon: -104.058, maxLon: -96.436 },
  TN: { minLat: 34.983, maxLat: 36.678, minLon: -90.310, maxLon: -81.647 },
  TX: { minLat: 25.837, maxLat: 36.500, minLon: -106.646, maxLon: -93.508 },
  UT: { minLat: 37.000, maxLat: 42.002, minLon: -114.053, maxLon: -109.041 },
  VT: { minLat: 42.727, maxLat: 45.017, minLon: -73.438, maxLon: -71.465 },
  VA: { minLat: 36.541, maxLat: 39.466, minLon: -83.675, maxLon: -75.242 },
  WA: { minLat: 45.544, maxLat: 49.003, minLon: -124.763, maxLon: -116.916 },
  WV: { minLat: 37.202, maxLat: 40.638, minLon: -82.644, maxLon: -77.719 },
  WI: { minLat: 42.492, maxLat: 47.310, minLon: -92.889, maxLon: -86.763 },
  WY: { minLat: 40.995, maxLat: 45.006, minLon: -111.056, maxLon: -104.052 }
};

/**
 * Detect which US state contains the given coordinates
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string|null} Two-letter state code or null if not found
 */
function detectStateFromCoordinates(latitude, longitude) {
  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    return null;
  }

  for (const [stateKey, bounds] of Object.entries(STATE_BOUNDS)) {
    if (
      latitude >= bounds.minLat &&
      latitude <= bounds.maxLat &&
      longitude >= bounds.minLon &&
      longitude <= bounds.maxLon
    ) {
      return stateKey;
    }
  }

  return null;
}

/**
 * Batch detect states for multiple coordinate pairs
 * Returns a map of detected states with their counts
 * @param {Array<{latitude: number, longitude: number}>} coordinates
 * @returns {Object} Map of state codes to counts
 */
function detectStateDistribution(coordinates) {
  const distribution = {};

  for (const coord of coordinates) {
    const state = detectStateFromCoordinates(coord.latitude, coord.longitude);
    if (state) {
      distribution[state] = (distribution[state] || 0) + 1;
    } else {
      distribution['UNKNOWN'] = (distribution['UNKNOWN'] || 0) + 1;
    }
  }

  return distribution;
}

/**
 * Get the primary state from a batch of coordinates
 * (the state that contains the most equipment)
 * @param {Array<{latitude: number, longitude: number}>} coordinates
 * @returns {string|null} Two-letter state code or null
 */
function getPrimaryState(coordinates) {
  const distribution = detectStateDistribution(coordinates);

  let maxState = null;
  let maxCount = 0;

  for (const [state, count] of Object.entries(distribution)) {
    if (state !== 'UNKNOWN' && count > maxCount) {
      maxState = state;
      maxCount = count;
    }
  }

  return maxState;
}

module.exports = {
  detectStateFromCoordinates,
  detectStateDistribution,
  getPrimaryState,
  STATE_BOUNDS
};

/**
 * Geometry Validator and Fixer
 * Ensures all event geometries are valid for rendering
 * Converts or filters out problematic geometries
 */

const turf = require('@turf/turf');

/**
 * Calculate distance between two coordinates in miles
 * @param {Array} coord1 - [lon, lat]
 * @param {Array} coord2 - [lon, lat]
 * @returns {Number} - Distance in miles
 */
function calculateDistance(coord1, coord2) {
  const from = turf.point(coord1);
  const to = turf.point(coord2);
  return turf.distance(from, to, { units: 'miles' });
}

/**
 * Validate and fix event geometry
 * @param {Object} event - Event object with geometry
 * @returns {Object} - Event with fixed geometry, or null if unfixable
 */
function validateAndFixGeometry(event) {
  if (!event || !event.geometry) {
    return null; // No geometry - filter out
  }

  // Filter out events with no description AND no location (likely bad data)
  if ((!event.description || event.description.trim() === '') &&
      (!event.location || event.location.trim() === '')) {
    return null; // Invalid event - no content
  }

  // Filter out straight-line fallback geometries (unreliable)
  if (event.geometry.geometrySource === 'straight_line' ||
      event.geometry.geometrySource === 'straight') {
    return null; // Unreliable geometry source
  }

  const geom = event.geometry;

  // Handle Point geometry - always valid
  if (geom.type === 'Point') {
    if (Array.isArray(geom.coordinates) && geom.coordinates.length === 2) {
      return event; // Valid point
    }
    return null; // Invalid point
  }

  // Handle LineString geometry
  if (geom.type === 'LineString') {
    if (!Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
      return null; // Invalid LineString
    }

    // Convert ALL 2-point LineStrings to Points at midpoint
    // 2-point lines are straight lines with no road shape — show as marker instead
    if (geom.coordinates.length === 2) {
      const [start, end] = geom.coordinates;
      const midpoint = [
        (start[0] + end[0]) / 2,
        (start[1] + end[1]) / 2
      ];

      return {
        ...event,
        geometry: {
          type: 'Point',
          coordinates: midpoint
        },
        _geometryFixed: true,
        _originalGeometryType: 'LineString',
        _fixReason: 'Converted 2-point LineString to Point'
      };
    }

    // Valid LineString with 3+ points
    return event;
  }

  // Handle Polygon geometry
  if (geom.type === 'Polygon') {
    if (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0) {
      return null;
    }
    // Validate outer ring has at least 4 points (closed polygon)
    const outerRing = geom.coordinates[0];
    if (!Array.isArray(outerRing) || outerRing.length < 4) {
      return null;
    }
    return event; // Valid polygon
  }

  // Handle MultiPoint, MultiLineString, MultiPolygon
  if (geom.type.startsWith('Multi')) {
    if (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0) {
      return null;
    }
    return event; // Assume valid for now
  }

  // Unknown geometry type - filter out
  return null;
}

/**
 * Batch validate and fix geometries for an array of events
 * @param {Array} events - Array of event objects
 * @returns {Object} - { valid: [], invalid: [], fixed: [] }
 */
function batchValidateGeometries(events) {
  const valid = [];
  const invalid = [];
  const fixed = [];

  for (const event of events) {
    const fixedEvent = validateAndFixGeometry(event);

    if (fixedEvent === null) {
      invalid.push(event);
    } else if (fixedEvent._geometryFixed) {
      fixed.push(fixedEvent);
      valid.push(fixedEvent);
    } else {
      valid.push(fixedEvent);
    }
  }

  return { valid, invalid, fixed };
}

/**
 * Filter events to only valid geometries (convenience method)
 * @param {Array} events - Array of event objects
 * @returns {Array} - Array of events with valid geometries only
 */
function filterValidGeometries(events) {
  return events
    .map(event => validateAndFixGeometry(event))
    .filter(event => event !== null);
}

/**
 * Get stats about geometry validity
 * @param {Array} events - Array of event objects
 * @returns {Object} - Statistics object
 */
function getGeometryStats(events) {
  const result = batchValidateGeometries(events);

  return {
    total: events.length,
    valid: result.valid.length,
    invalid: result.invalid.length,
    fixed: result.fixed.length,
    validPercent: ((result.valid.length / events.length) * 100).toFixed(1),
    invalidPercent: ((result.invalid.length / events.length) * 100).toFixed(1),
    fixedPercent: ((result.fixed.length / events.length) * 100).toFixed(1)
  };
}

module.exports = {
  validateAndFixGeometry,
  batchValidateGeometries,
  filterValidGeometries,
  getGeometryStats
};

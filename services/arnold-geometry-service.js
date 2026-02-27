/**
 * ARNOLD (All Roads Network of Linear Referenced Data) Geometry Enrichment Service
 *
 * Enriches event geometries with detailed polylines from FHWA/BTS ARNOLD dataset.
 * ARNOLD provides national-level road network data via state-specific FeatureServers.
 *
 * Data Source: https://geodata.bts.gov/datasets/ARNOLD
 * API Pattern: https://geo.dot.gov/server/rest/services/Hosted/ARNOLD_{STATE}_{YEAR}/FeatureServer/0
 */

const axios = require('axios');

// State code mapping for ARNOLD API - All 48 mainland US states
const STATE_CODES = {
  // West Coast
  'ca': 'CA', 'or': 'OR', 'wa': 'WA',

  // Mountain West
  'az': 'AZ', 'co': 'CO', 'id': 'ID', 'mt': 'MT', 'nv': 'NV', 'nm': 'NM', 'ut': 'UT', 'wy': 'WY',

  // Southwest
  'ok': 'OK', 'tx': 'TX',

  // Midwest
  'il': 'IL', 'in': 'IN', 'mi': 'MI', 'oh': 'OH', 'wi': 'WI',
  'ia': 'IA', 'ks': 'KS', 'mn': 'MN', 'mo': 'MO', 'nd': 'ND', 'ne': 'NE', 'sd': 'SD',

  // South
  'al': 'AL', 'ar': 'AR', 'fl': 'FL', 'ga': 'GA', 'ky': 'KY', 'la': 'LA', 'ms': 'MS',
  'nc': 'NC', 'sc': 'SC', 'tn': 'TN', 'va': 'VA', 'wv': 'WV',

  // Northeast
  'ct': 'CT', 'de': 'DE', 'ma': 'MA', 'md': 'MD', 'me': 'ME', 'nh': 'NH',
  'nj': 'NJ', 'ny': 'NY', 'pa': 'PA', 'ri': 'RI', 'vt': 'VT'
};

// ARNOLD data year (latest available)
const ARNOLD_YEAR = '2019';

class ArnoldGeometryService {
  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Extract Interstate route number and convert to ARNOLD route_id format
   * Returns route_id pattern (e.g., "0015" for I-15, "0080" for I-80)
   */
  extractRouteId(corridor) {
    if (!corridor) return null;

    // Match Interstate patterns: I-15, I80, Interstate 15, etc.
    const patterns = [
      /I-?(\d+)/i,
      /INTERSTATE\s+(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = corridor.match(pattern);
      if (match) {
        const number = parseInt(match[1]);
        // ARNOLD uses zero-padded 4-digit route_id: I-15 -> "0015", I-80 -> "0080"
        return number.toString().padStart(4, '0');
      }
    }

    return null;
  }

  /**
   * Query ARNOLD FeatureServer for route geometry
   */
  async queryArnold(stateKey, routeId, bbox) {
    const stateCode = STATE_CODES[stateKey.toLowerCase()];
    if (!stateCode) {
      return null; // State not supported by ARNOLD
    }

    try {
      const apiUrl = `https://geo.dot.gov/server/rest/services/Hosted/ARNOLD_${stateCode}_${ARNOLD_YEAR}/FeatureServer/0/query`;

      const params = {
        where: `route_id LIKE '${routeId}%'`,
        outFields: 'route_id,natroute_i',
        returnGeometry: true,
        f: 'geojson',
        outSR: 4326
      };

      if (bbox) {
        params.geometry = JSON.stringify({
          xmin: bbox.minLon,
          ymin: bbox.minLat,
          xmax: bbox.maxLon,
          ymax: bbox.maxLat,
          spatialReference: { wkid: 4326 }
        });
        params.geometryType = 'esriGeometryEnvelope';
        params.spatialRel = 'esriSpatialRelIntersects';
      }

      const response = await axios.get(apiUrl, {
        params,
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      // Silently fail - ARNOLD enrichment is optional
      return null;
    }
  }

  /**
   * Extract direction code from event direction
   */
  getDirectionCode(direction) {
    if (!direction) return null;
    const dir = direction.toLowerCase();
    if (dir.includes('west') || dir.includes('wb')) return 'W';
    if (dir.includes('east') || dir.includes('eb')) return 'E';
    if (dir.includes('north') || dir.includes('nb')) return 'N';
    if (dir.includes('south') || dir.includes('sb')) return 'S';
    return null;
  }

  /**
   * Find best matching road segment for an event
   */
  findBestMatchingSegment(geometry, arnoldFeatures, event) {
    if (!arnoldFeatures || arnoldFeatures.length === 0) {
      return null;
    }

    const [startLon, startLat] = geometry.coordinates[0];
    const [endLon, endLat] = geometry.coordinates[geometry.coordinates.length - 1];

    let bestMatch = null;
    let bestScore = Infinity;

    for (const feature of arnoldFeatures) {
      if (!feature.geometry || !feature.geometry.coordinates) {
        continue;
      }

      const coords = feature.geometry.coordinates;
      if (coords.length < 2) {
        continue;
      }

      const segStart = coords[0];
      const segEnd = coords[coords.length - 1];

      const startToSegStart = this.calculateDistance(startLat, startLon, segStart[1], segStart[0]);
      const startToSegEnd = this.calculateDistance(startLat, startLon, segEnd[1], segEnd[0]);
      const endToSegStart = this.calculateDistance(endLat, endLon, segStart[1], segStart[0]);
      const endToSegEnd = this.calculateDistance(endLat, endLon, segEnd[1], segEnd[0]);

      // Score based on proximity (lower is better)
      const score = Math.min(
        startToSegStart + endToSegEnd,  // Normal direction
        startToSegEnd + endToSegStart    // Reverse direction
      );

      if (score < bestScore && score < 50) { // Within 50km threshold for long highway segments
        bestScore = score;
        bestMatch = feature;
      }
    }

    return bestMatch;
  }

  /**
   * Apply bidirectional offset for "Both" direction events
   * Creates two parallel offset lines to show both carriageways
   */
  applyBidirectionalOffset(coordinates, corridor) {
    const offsetMeters = 12; // Realistic separation for US Interstates
    const offsetDegrees = offsetMeters / 111320; // meters to degrees

    let direction1, direction2;

    // Determine directions based on Interstate numbering
    // East-West interstates (even last digit)
    if (corridor && corridor.match(/[02468]$/)) {
      direction1 = 'Eastbound';
      direction2 = 'Westbound';
    }
    // North-South interstates (odd last digit)
    else if (corridor && corridor.match(/[13579]$/)) {
      direction1 = 'Northbound';
      direction2 = 'Southbound';
    } else {
      // Unknown corridor - return centerline unchanged
      return { type: 'LineString', coordinates };
    }

    // Create offsets for both directions
    const offset1 = this.offsetCoordinatesForDirection(coordinates, direction1, offsetDegrees);
    const offset2 = this.offsetCoordinatesForDirection(coordinates, direction2, offsetDegrees);

    // Combine into a loop (direction1 forward + direction2 reversed)
    return {
      type: 'LineString',
      coordinates: [...offset1, ...offset2.reverse()]
    };
  }

  /**
   * Offset coordinates perpendicular to direction
   */
  offsetCoordinatesForDirection(coords, direction, offsetDegrees) {
    const dir = direction.toLowerCase();
    let latOffset = 0, lngOffset = 0;

    // US right-hand traffic patterns
    if (dir.includes('west')) {
      latOffset = offsetDegrees; // Westbound = north side
    } else if (dir.includes('east')) {
      latOffset = -offsetDegrees; // Eastbound = south side
    } else if (dir.includes('north')) {
      lngOffset = -offsetDegrees; // Northbound = west side
    } else if (dir.includes('south')) {
      lngOffset = offsetDegrees; // Southbound = east side
    }

    return coords.map(([lng, lat]) => [lng + lngOffset, lat + latOffset]);
  }

  /**
   * Enrich a single event's geometry using ARNOLD
   */
  async enrichEventGeometry(event, stateKey) {
    if (!event || !event.geometry) {
      return event; // Return unchanged if no geometry
    }

    const routeId = this.extractRouteId(event.corridor);
    if (!routeId) {
      return event; // Can't enrich without route info
    }

    try {
      const geometry = typeof event.geometry === 'string' ? JSON.parse(event.geometry) : event.geometry;

      // Use first and last coordinates regardless of how many points
      if (!geometry.coordinates || geometry.coordinates.length < 2) {
        return event; // Need at least start and end point
      }

      const [startLon, startLat] = geometry.coordinates[0];
      const [endLon, endLat] = geometry.coordinates[geometry.coordinates.length - 1];

      const bbox = {
        minLat: Math.min(startLat, endLat) - 0.15,
        maxLat: Math.max(startLat, endLat) + 0.15,
        minLon: Math.min(startLon, endLon) - 0.15,
        maxLon: Math.max(startLon, endLon) + 0.15
      };

      const arnoldData = await this.queryArnold(stateKey, routeId, bbox);

      if (!arnoldData || !arnoldData.features || arnoldData.features.length === 0) {
        // No ARNOLD geometry - apply bidirectional offset to original geometry if direction=Both
        if (event.direction && event.direction.toLowerCase().includes('both')) {
          const offsetGeometry = this.applyBidirectionalOffset(geometry.coordinates, event.corridor);
          return {
            ...event,
            geometry: offsetGeometry,
            geometry_source: 'Original Feed Geometry (offset)'
          };
        }
        return event;
      }

      const bestMatch = this.findBestMatchingSegment(geometry, arnoldData.features, event);

      if (!bestMatch) {
        // No matching segment - apply bidirectional offset to original geometry if direction=Both
        if (event.direction && event.direction.toLowerCase().includes('both')) {
          const offsetGeometry = this.applyBidirectionalOffset(geometry.coordinates, event.corridor);
          return {
            ...event,
            geometry: offsetGeometry,
            geometry_source: 'Original Feed Geometry (offset)'
          };
        }
        return event;
      }

      let finalGeometry = {
        type: 'LineString',
        coordinates: bestMatch.geometry.coordinates
      };

      // Apply bidirectional rendering for "Both" direction
      if (event.direction && event.direction.toLowerCase().includes('both')) {
        finalGeometry = this.applyBidirectionalOffset(finalGeometry.coordinates, event.corridor);
      }

      // Return event with enriched geometry
      return {
        ...event,
        geometry: finalGeometry,
        geometry_source: 'FHWA ARNOLD'
      };

    } catch (error) {
      // On error, return original event
      return event;
    }
  }

  /**
   * Enrich all events in an array for a given state
   */
  async enrichEvents(events, stateKey) {
    if (!events || events.length === 0) return events;

    // Check if state is supported by ARNOLD
    if (!STATE_CODES[stateKey.toLowerCase()]) {
      return events; // State not supported, return unchanged
    }

    const enrichedEvents = await Promise.all(
      events.map(event => this.enrichEventGeometry(event, stateKey))
    );

    return enrichedEvents;
  }
}

// Export singleton instance
module.exports = new ArnoldGeometryService();

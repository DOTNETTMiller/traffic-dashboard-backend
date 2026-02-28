/**
 * Iowa Geometry Enrichment Service
 *
 * Enriches Iowa event geometries with detailed polylines from Iowa DOT
 * All Routes FeatureServer. Automatically stores and cleans up expired geometries.
 */

const axios = require('axios');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const IOWA_ROAD_NETWORK_API = 'https://gis.iowadot.gov/agshost/rest/services/RAMS/All_Routes/FeatureServer/0/query';

class IowaGeometryService {
  constructor() {
    if (DATABASE_URL) {
      this.pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      this.initialized = false;
    }
  }

  /**
   * Initialize the service and ensure table exists
   */
  async init() {
    if (this.initialized || !this.pool) return;

    try {
      // Create event_geometries table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS event_geometries (
          event_id TEXT PRIMARY KEY,
          state_key TEXT NOT NULL,
          geometry TEXT NOT NULL,
          direction TEXT,
          source TEXT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          event_start_time BIGINT,
          event_end_time BIGINT
        )
      `);

      // Create index for cleanup queries
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_event_geometries_expiration
        ON event_geometries (event_end_time)
      `);

      this.initialized = true;
      console.log('✅ Iowa Geometry Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Iowa Geometry Service:', error.message);
    }
  }

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
   * Extract route number and prefix from various formats
   * Returns { number, prefix } where prefix is 'I', 'US', or 'IA'
   */
  extractRouteInfo(routeName) {
    if (!routeName) return null;

    const patterns = [
      { regex: /I-?(\d+)/i, prefix: 'I' },           // Interstate
      { regex: /US-?(\d+)/i, prefix: 'US' },         // US Highway
      { regex: /IA-?(\d+)/i, prefix: 'IA' },         // Iowa Highway
      { regex: /INTERSTATE\s+(\d+)/i, prefix: 'I' }  // Full word
    ];

    for (const pattern of patterns) {
      const match = routeName.match(pattern.regex);
      if (match) {
        return {
          number: parseInt(match[1]),
          prefix: pattern.prefix
        };
      }
    }

    return null;
  }

  /**
   * Query Iowa DOT All Routes for route geometry
   */
  async queryIowaRoadNetwork(routeInfo, bbox) {
    try {
      const params = {
        where: `OFFICIAL_ROUTE_NUMBER=${routeInfo.number} AND OFFICIAL_ROUTE_PREFIX='${routeInfo.prefix}'`,
        outFields: 'ROUTE_ID,ROUTE_NAME,OFFICIAL_ROUTE_NUMBER,OFFICIAL_ROUTE_PREFIX,OFFICIAL_ROUTE_DIRECTION,RAMP_CLASSIFICATION',
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

      const response = await axios.get(IOWA_ROAD_NETWORK_API, {
        params,
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      // Silently fail - we'll use the original geometry
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
  findBestMatchingSegment(geometry, roadFeatures, event) {
    if (!roadFeatures || roadFeatures.length === 0) {
      return null;
    }

    const [startLon, startLat] = geometry.coordinates[0];
    const [endLon, endLat] = geometry.coordinates[geometry.coordinates.length - 1];
    const eventDirection = this.getDirectionCode(event.direction);

    // Filter features: prefer mainline (not ramps), match direction
    const mainlineFeatures = roadFeatures.filter(f => {
      const props = f.properties || {};
      // Exclude ramps unless event specifically mentions ramp
      const isRamp = props.RAMP_CLASSIFICATION === 'Y';
      const eventIsRamp = event.description && event.description.toLowerCase().includes('ramp');
      if (isRamp && !eventIsRamp) return false;

      // Match direction if we have one
      if (eventDirection && props.OFFICIAL_ROUTE_DIRECTION) {
        return props.OFFICIAL_ROUTE_DIRECTION === eventDirection;
      }
      return true;
    });

    // Use mainline features if available, otherwise fall back to all features
    const featuresToSearch = mainlineFeatures.length > 0 ? mainlineFeatures : roadFeatures;

    let bestMatch = null;
    let bestScore = Infinity;

    for (const feature of featuresToSearch) {
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

      const score = Math.min(
        startToSegStart + endToSegEnd,
        startToSegEnd + endToSegStart
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

    // Return as MultiLineString with two separate parallel lines
    return {
      type: 'MultiLineString',
      coordinates: [offset1, offset2]
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

    // Ensure coordinates are numbers (parseFloat handles string coordinates from feed)
    return coords.map(([lng, lat]) => [parseFloat(lng) + lngOffset, parseFloat(lat) + latOffset]);
  }

  /**
   * Enrich a single Iowa event's geometry
   */
  async enrichEventGeometry(event) {
    if (!event || !event.geometry) {
      return event; // Return unchanged if no geometry
    }

    const routeInfo = this.extractRouteInfo(event.corridor);
    if (!routeInfo) {
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

      const roadData = await this.queryIowaRoadNetwork(routeInfo, bbox);

      if (!roadData || !roadData.features || roadData.features.length === 0) {
        // No Iowa DOT geometry - apply bidirectional offset to original geometry if direction=Both
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

      const bestMatch = this.findBestMatchingSegment(geometry, roadData.features, event);

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

      // Store enriched geometry in database
      if (this.pool && event.id) {
        await this.storeEnrichedGeometry(event, finalGeometry);
      }

      // Return event with enriched geometry
      return {
        ...event,
        geometry: finalGeometry,
        geometry_source: 'Iowa DOT All Routes'
      };

    } catch (error) {
      // On error, return original event
      return event;
    }
  }

  /**
   * Store enriched geometry in database
   */
  async storeEnrichedGeometry(event, geometry) {
    if (!this.pool) return;

    try {
      await this.init();

      const now = Date.now();
      const endTime = event.endTime ? new Date(event.endTime).getTime() : now + (24 * 60 * 60 * 1000); // Default 24h

      await this.pool.query(`
        INSERT INTO event_geometries (
          event_id, state_key, geometry, direction, source,
          created_at, updated_at, event_start_time, event_end_time
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (event_id) DO UPDATE SET
          geometry = EXCLUDED.geometry,
          updated_at = EXCLUDED.updated_at,
          event_end_time = EXCLUDED.event_end_time,
          source = EXCLUDED.source
      `, [
        event.id,
        'ia',
        JSON.stringify(geometry),
        event.direction,
        'Iowa DOT All Routes',
        now,
        now,
        event.startTime ? new Date(event.startTime).getTime() : now,
        endTime
      ]);
    } catch (error) {
      // Silently fail - geometry storage is non-critical
      console.error('Failed to store enriched geometry:', error.message);
    }
  }

  /**
   * Enrich all Iowa events in an array
   */
  async enrichIowaEvents(events) {
    if (!events || events.length === 0) return events;

    const enrichedEvents = await Promise.all(
      events.map(event => this.enrichEventGeometry(event))
    );

    return enrichedEvents;
  }

  /**
   * Clean up expired geometries
   */
  async cleanupExpiredGeometries() {
    if (!this.pool) return;

    try {
      await this.init();

      const now = Date.now();
      const result = await this.pool.query(`
        DELETE FROM event_geometries
        WHERE event_end_time < $1
      `, [now]);

      if (result.rowCount > 0) {
        console.log(`🧹 Cleaned up ${result.rowCount} expired Iowa geometries`);
      }
    } catch (error) {
      console.error('Failed to cleanup expired geometries:', error.message);
    }
  }

  /**
   * Get statistics
   */
  async getStats() {
    if (!this.pool) return null;

    try {
      await this.init();

      const result = await this.pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE event_end_time > $1) as active,
          COUNT(*) FILTER (WHERE event_end_time <= $1) as expired
        FROM event_geometries
        WHERE state_key = 'ia'
      `, [Date.now()]);

      return result.rows[0];
    } catch (error) {
      return null;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

// Export singleton instance
module.exports = new IowaGeometryService();

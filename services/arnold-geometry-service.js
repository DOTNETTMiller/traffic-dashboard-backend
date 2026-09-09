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
   * Per-run counters, in place of per-event logging.
   *
   * This service ran one console.log PER EVENT (up to eight of them), and Node's stdout to a
   * container pipe is a BLOCKING write. With a few thousand events the process spends its
   * time in write() instead of serving requests: the socket still accepts connections, so the
   * platform sees an open port while every HTTP request times out. That is what took the
   * dashboard down -- it was not a crash, and the logs are the cause rather than a clue.
   *
   * Counters here, one summary line at the end of the batch, and a couple of sampled examples
   * so a real problem is still diagnosable.
   */
  bump(key, sample) {
    if (!this.tally) this.tally = { samples: {} };
    this.tally[key] = (this.tally[key] || 0) + 1;
    if (sample && !this.tally.samples[key]) this.tally.samples[key] = sample;
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
   * Stitch multiple ARNOLD segments together into a continuous route
   * ARNOLD often returns many short 2-point segments that need to be combined
   */
  stitchSegments(segments, eventStart, eventEnd) {
    if (!segments || segments.length === 0) return null;
    if (segments.length === 1) return segments[0];

    // Calculate connectivity score for each segment to event endpoints
    const scoredSegments = segments.map(seg => {
      const coords = seg.geometry.coordinates;
      const segStart = coords[0];
      const segEnd = coords[coords.length - 1];

      const distToEventStart = Math.min(
        this.calculateDistance(eventStart[1], eventStart[0], segStart[1], segStart[0]),
        this.calculateDistance(eventStart[1], eventStart[0], segEnd[1], segEnd[0])
      );

      const distToEventEnd = Math.min(
        this.calculateDistance(eventEnd[1], eventEnd[0], segStart[1], segStart[0]),
        this.calculateDistance(eventEnd[1], eventEnd[0], segEnd[1], segEnd[0])
      );

      return {
        feature: seg,
        coords: coords,
        distToEventStart,
        distToEventEnd,
        totalDist: distToEventStart + distToEventEnd
      };
    });

    // Sort by proximity to event endpoints
    scoredSegments.sort((a, b) => a.totalDist - b.totalDist);

    // Start with closest segment to event endpoints
    const orderedCoords = [...scoredSegments[0].coords];
    const usedSegments = new Set([scoredSegments[0].feature]);

    // Iteratively add connected segments
    let addedSegment = true;
    while (addedSegment && usedSegments.size < segments.length) {
      addedSegment = false;

      for (const scored of scoredSegments) {
        if (usedSegments.has(scored.feature)) continue;

        const currentStart = orderedCoords[0];
        const currentEnd = orderedCoords[orderedCoords.length - 1];
        const segStart = scored.coords[0];
        const segEnd = scored.coords[scored.coords.length - 1];

        // Check if this segment connects to the start
        const distToStart = Math.min(
          this.calculateDistance(currentStart[1], currentStart[0], segStart[1], segStart[0]),
          this.calculateDistance(currentStart[1], currentStart[0], segEnd[1], segEnd[0])
        );

        // Check if this segment connects to the end
        const distToEnd = Math.min(
          this.calculateDistance(currentEnd[1], currentEnd[0], segStart[1], segStart[0]),
          this.calculateDistance(currentEnd[1], currentEnd[0], segEnd[1], segEnd[0])
        );

        const connectionThreshold = 0.5; // 500 meters - segments should be nearly adjacent

        if (distToEnd < connectionThreshold) {
          // Add to end
          const needsReverse = this.calculateDistance(currentEnd[1], currentEnd[0], segEnd[1], segEnd[0]) <
                               this.calculateDistance(currentEnd[1], currentEnd[0], segStart[1], segStart[0]);
          const coordsToAdd = needsReverse ? [...scored.coords].reverse() : scored.coords;
          orderedCoords.push(...coordsToAdd.slice(1)); // Skip first point to avoid duplication
          usedSegments.add(scored.feature);
          addedSegment = true;
        } else if (distToStart < connectionThreshold) {
          // Add to start
          const needsReverse = this.calculateDistance(currentStart[1], currentStart[0], segStart[1], segStart[0]) <
                               this.calculateDistance(currentStart[1], currentStart[0], segEnd[1], segEnd[0]);
          const coordsToAdd = needsReverse ? [...scored.coords].reverse() : scored.coords;
          orderedCoords.unshift(...coordsToAdd.slice(0, -1)); // Skip last point to avoid duplication
          usedSegments.add(scored.feature);
          addedSegment = true;
        }
      }
    }

    // Return stitched geometry
    return {
      geometry: {
        type: 'LineString',
        coordinates: orderedCoords
      },
      properties: scoredSegments[0].feature.properties,
      stitchedFrom: usedSegments.size
    };
  }

  /**
   * Find best matching road segment for an event
   * Now returns stitched segments if multiple segments are found
   */
  findBestMatchingSegment(geometry, arnoldFeatures, event) {
    if (!arnoldFeatures || arnoldFeatures.length === 0) {
      this.bump('noFeatures');
      return null;
    }

    const [startLon, startLat] = geometry.coordinates[0];
    const [endLon, endLat] = geometry.coordinates[geometry.coordinates.length - 1];

    // Filter segments that are reasonably close to event bbox
    const nearbySegments = [];

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

      // Relaxed threshold - accept segments within 100km (was 50km)
      if (score < 100) {
        nearbySegments.push({
          feature,
          score,
          coords: coords.length
        });
      }
    }

    if (nearbySegments.length === 0) {
      this.bump('noNearbySegment');
      return null;
    }

    // Sort by score
    nearbySegments.sort((a, b) => a.score - b.score);

    this.bump('nearbyFound');

    // If we have multiple short segments, try to stitch them together
    if (nearbySegments.length > 1 && nearbySegments[0].coords <= 5) {
      this.bump('stitchAttempted');
      const stitched = this.stitchSegments(
        nearbySegments.map(s => s.feature),
        [startLon, startLat],
        [endLon, endLat]
      );

      if (stitched && stitched.coordinates && stitched.coordinates.length > nearbySegments[0].coords) {
        this.bump('stitched');
        return stitched;
      } else {
        this.bump('stitchFailed');
      }
    }

    // Return best single segment
    this.bump('singleSegment');
    return nearbySegments[0].feature;
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
   * Enrich a single event's geometry using ARNOLD
   */
  async enrichEventGeometry(event, stateKey) {
    if (!event || !event.geometry) {
      this.bump('noGeometry');
      return event; // Return unchanged if no geometry
    }

    const routeId = this.extractRouteId(event.corridor);
    if (!routeId) {
      this.bump('noRouteId', String(event.corridor));
      return event; // Can't enrich without route info
    }

    this.bump('attempted');

    try {
      const geometry = typeof event.geometry === 'string' ? JSON.parse(event.geometry) : event.geometry;

      // Use first and last coordinates regardless of how many points
      if (!geometry.coordinates || geometry.coordinates.length < 2) {
        this.bump('insufficientCoords');
        return event; // Need at least start and end point
      }

      const [startLon, startLat] = geometry.coordinates[0];
      const [endLon, endLat] = geometry.coordinates[geometry.coordinates.length - 1];

      // (per-event start/end trace removed: see bump())

      const bbox = {
        minLat: Math.min(startLat, endLat) - 0.15,
        maxLat: Math.max(startLat, endLat) + 0.15,
        minLon: Math.min(startLon, endLon) - 0.15,
        maxLon: Math.max(startLon, endLon) + 0.15
      };

      const arnoldData = await this.queryArnold(stateKey, routeId, bbox);

      if (!arnoldData || !arnoldData.features || arnoldData.features.length === 0) {
        this.bump('apiNoFeatures');
        // No ARNOLD geometry - apply bidirectional offset to original geometry if direction=Both
        if (event.direction && event.direction.toLowerCase().includes('both')) {
          const offsetGeometry = this.applyBidirectionalOffset(geometry.coordinates, event.corridor);
          this.bump('offsetApplied');
          return {
            ...event,
            geometry: {
              ...offsetGeometry,
              geometrySource: 'Original Feed Geometry (offset)'
            }
          };
        }
        return event;
      }

      this.bump('apiFeatures');

      const bestMatch = this.findBestMatchingSegment(geometry, arnoldData.features, event);

      if (!bestMatch) {
        this.bump('noMatch');
        // No matching segment - apply bidirectional offset to original geometry if direction=Both
        if (event.direction && event.direction.toLowerCase().includes('both')) {
          const offsetGeometry = this.applyBidirectionalOffset(geometry.coordinates, event.corridor);
          this.bump('offsetApplied');
          return {
            ...event,
            geometry: {
              ...offsetGeometry,
              geometrySource: 'Original Feed Geometry (offset)'
            }
          };
        }
        return event;
      }

      let finalGeometry = {
        type: 'LineString',
        coordinates: bestMatch.geometry.coordinates
      };

      this.bump('enriched');

      // Apply bidirectional rendering for "Both" direction
      if (event.direction && event.direction.toLowerCase().includes('both')) {
        finalGeometry = this.applyBidirectionalOffset(finalGeometry.coordinates, event.corridor);
        this.bump('offsetApplied');
      }

      // Return event with enriched geometry
      return {
        ...event,
        geometry: {
          ...finalGeometry,
          geometrySource: 'FHWA ARNOLD'
        }
      };

    } catch (error) {
      console.error(`   [ARNOLD] Event ${event.id}: ERROR - ${error.message}`);
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

    this.tally = { samples: {} };

    // Bounded concurrency. This was Promise.all over EVERY event, so a few thousand events
    // opened a few thousand simultaneous ARNOLD requests -- which is its own way to stall the
    // loop and a good way to get rate-limited. Ten at a time keeps it quick without the pile-up.
    const enrichedEvents = new Array(events.length);
    const CONCURRENCY = 10;
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, events.length) }, async () => {
      while (cursor < events.length) {
        const i = cursor++;
        try {
          enrichedEvents[i] = await this.enrichEventGeometry(events[i], stateKey);
        } catch (e) {
          this.bump('errored', e.message);
          enrichedEvents[i] = events[i];
        }
      }
    }));

    // ONE line for the whole batch, whatever its size.
    const t = this.tally;
    const parts = Object.keys(t).filter(k => k !== 'samples' && t[k]).map(k => `${k}=${t[k]}`);
    if (parts.length) {
      const eg = t.samples.noRouteId ? ` (e.g. corridor "${t.samples.noRouteId}")` : '';
      console.log(`   [ARNOLD] ${stateKey}: ${events.length} events — ${parts.join(' ')}${eg}`);
    }

    return enrichedEvents;
  }
}

// Export singleton instance
module.exports = new ArnoldGeometryService();

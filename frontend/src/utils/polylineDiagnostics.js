/**
 * Polyline Diagnostics Utilities
 *
 * Provides diagnostic information about polyline geometries to help identify
 * issues with route accuracy and data quality.
 */

/**
 * Calculate distance between two coordinates in miles
 */
function distanceInMiles(coord1, coord2) {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  // Haversine formula for great-circle distance
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Analyze a polyline geometry and return diagnostic information
 */
export function analyzePolyline(geometry) {
  if (!geometry || geometry.type !== 'LineString' || !geometry.coordinates) {
    return null;
  }

  const coords = geometry.coordinates;

  if (coords.length < 2) {
    return {
      valid: false,
      issue: 'Not enough points (need at least 2)'
    };
  }

  // Calculate total distance
  let totalDistance = 0;
  const segments = [];

  for (let i = 1; i < coords.length; i++) {
    const segmentDist = distanceInMiles(coords[i-1], coords[i]);
    totalDistance += segmentDist;
    segments.push({
      from: i - 1,
      to: i,
      distance: segmentDist
    });
  }

  // Find longest segment (potential jump/error)
  const longestSegment = segments.reduce((max, seg) =>
    seg.distance > max.distance ? seg : max, segments[0]);

  // Detect potential issues
  const issues = [];

  // Check for very long jumps (>30 miles in one segment)
  if (longestSegment.distance > 30) {
    issues.push(`Large jump: ${longestSegment.distance.toFixed(1)} mi between points ${longestSegment.from} and ${longestSegment.to}`);
  }

  // Check for very short total distance (<0.1 miles)
  if (totalDistance < 0.1) {
    issues.push('Very short total distance - may be clustered points');
  }

  // Check for unrealistic total distance (>200 miles for single event)
  if (totalDistance > 200) {
    issues.push('Very long total distance - may span multiple states');
  }

  // Get start and end coordinates
  const startCoord = coords[0];
  const endCoord = coords[coords.length - 1];

  return {
    valid: issues.length === 0,
    pointCount: coords.length,
    totalDistance: totalDistance.toFixed(2),
    startCoordinate: {
      lat: startCoord[1].toFixed(6),
      lng: startCoord[0].toFixed(6)
    },
    endCoordinate: {
      lat: endCoord[1].toFixed(6),
      lng: endCoord[0].toFixed(6)
    },
    longestSegment: {
      distance: longestSegment.distance.toFixed(2),
      from: longestSegment.from,
      to: longestSegment.to
    },
    source: geometry.source || 'unknown',
    corrected: geometry.corrected || false,
    issues: issues
  };
}

/**
 * Format diagnostic information for display
 */
export function formatDiagnostics(diagnostics) {
  if (!diagnostics) {
    return 'No geometry data available';
  }

  if (!diagnostics.valid) {
    return diagnostics.issue || 'Invalid geometry';
  }

  const parts = [
    `📍 Start: ${diagnostics.startCoordinate.lat}, ${diagnostics.startCoordinate.lng}`,
    `📍 End: ${diagnostics.endCoordinate.lat}, ${diagnostics.endCoordinate.lng}`,
    `📏 Total Distance: ${diagnostics.totalDistance} miles`,
    `🔢 Points: ${diagnostics.pointCount}`,
    `📊 Longest Segment: ${diagnostics.longestSegment.distance} mi (${diagnostics.longestSegment.from} → ${diagnostics.longestSegment.to})`
  ];

  if (diagnostics.source && diagnostics.source !== 'unknown') {
    parts.push(`📡 Source: ${diagnostics.source}`);
  }

  if (diagnostics.corrected) {
    parts.push(`✨ Client-side corrected`);
  }

  if (diagnostics.issues.length > 0) {
    parts.push('');
    parts.push('⚠️ Potential Issues:');
    diagnostics.issues.forEach(issue => {
      parts.push(`  • ${issue}`);
    });
  }

  return parts.join('\n');
}

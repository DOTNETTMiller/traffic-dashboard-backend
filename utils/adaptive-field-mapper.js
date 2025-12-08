/**
 * Adaptive Field Mapper
 *
 * Future-proof field recognition that automatically adapts as states improve their data feeds.
 * Prioritizes standard WZDx/SAE field names over legacy formats.
 */

// Field priority order: Try standard names first, then common variations, then legacy
const FIELD_PRIORITY_MAP = {
  // Event identification
  id: [
    'id',                    // WZDx standard
    'event_id',
    'eventId',
    'feature_id',
    'guid'
  ],

  // Event type/classification
  eventType: [
    'event_type',            // WZDx v4.x standard
    'eventType',
    'type',
    'category',
    'event_category',
    'classification'
  ],

  // Timing - Start
  startTime: [
    'start_date',            // WZDx v4.x standard
    'startDate',
    'start_time',
    'startTime',
    'start',
    'beginning_date',
    'created_at',
    'event_update_time'      // Legacy fallback
  ],

  // Timing - End
  endTime: [
    'end_date',              // WZDx v4.x standard
    'endDate',
    'end_time',
    'endTime',
    'end',
    'ending_date',
    'estimated_end_date',
    'estimatedEndDate'
  ],

  // Location - Coordinates
  latitude: [
    'latitude',              // WZDx standard
    'lat',
    'start_latitude',
    'begin_latitude'
  ],

  longitude: [
    'longitude',             // WZDx standard
    'lon',
    'lng',
    'long',
    'start_longitude',
    'begin_longitude'
  ],

  // Location - Road identification
  corridor: [
    'road_names',            // WZDx v4.x standard (array)
    'road_name',
    'roadName',
    'route',
    'routeName',
    'highway',
    'location_description'   // Fallback
  ],

  // Direction
  direction: [
    'direction',             // WZDx standard
    'travel_direction',
    'travelDirection',
    'bearing'
  ],

  // Description
  description: [
    'description',           // WZDx standard
    'event_description',
    'headline',
    'summary',
    'title',
    'comments',
    'details'
  ],

  // Lane impact
  lanesAffected: [
    'vehicle_impact',        // WZDx v4.x standard
    'lanes',
    'impacted_lanes',
    'lanes_closed',
    'lanesClosed',
    'lanes_affected',
    'lanesAffected',
    'lanes_blocked',
    'lanesBlocked'
  ],

  // Severity/Impact
  severity: [
    'event_status',          // WZDx standard maps to severity
    'severity',
    'impact',
    'priority',
    'impact_level',
    'urgency'
  ],

  // Road status
  roadStatus: [
    'road_event_status',     // WZDx standard
    'roadStatus',
    'road_status',
    'status',
    'roadway_status'
  ],

  // Geographic identifiers
  state: [
    'state',
    'organization_id',
    'jurisdiction',
    'owner'
  ],

  county: [
    'county',
    'counties',
    'jurisdiction_name'
  ]
};

/**
 * Normalize field value based on field type
 */
const FIELD_NORMALIZERS = {
  direction: (value) => {
    if (!value) return null;
    const normalized = String(value).toLowerCase().trim();
    const directionMap = {
      'n': 'northbound', 'north': 'northbound', 'nb': 'northbound', 'northbound': 'northbound',
      's': 'southbound', 'south': 'southbound', 'sb': 'southbound', 'southbound': 'southbound',
      'e': 'eastbound', 'east': 'eastbound', 'eb': 'eastbound', 'eastbound': 'eastbound',
      'w': 'westbound', 'west': 'westbound', 'wb': 'westbound', 'westbound': 'westbound',
      'both': 'both', 'bi-directional': 'both'
    };
    return directionMap[normalized] || normalized;
  },

  severity: (value) => {
    if (!value) return 'medium';
    const normalized = String(value).toLowerCase().trim();
    const severityMap = {
      'high': 'high', 'severe': 'high', 'major': 'high', 'critical': 'high',
      'medium': 'medium', 'moderate': 'medium', 'normal': 'medium',
      'low': 'low', 'minor': 'low', 'minimal': 'low'
    };
    return severityMap[normalized] || 'medium';
  },

  roadStatus: (value) => {
    if (!value) return 'open';
    const normalized = String(value).toLowerCase().trim();
    const statusMap = {
      'open': 'open', 'active': 'open', 'normal': 'open',
      'closed': 'closed', 'closure': 'closed',
      'restricted': 'restricted', 'partial': 'restricted',
      'planned': 'planned'
    };
    return statusMap[normalized] || 'open';
  },

  eventType: (value) => {
    if (!value) return 'unknown';
    const normalized = String(value).toLowerCase().trim();
    // WZDx standard event types
    const typeMap = {
      'work-zone': 'work-zone',
      'work zone': 'work-zone',
      'construction': 'work-zone',
      'maintenance': 'work-zone',
      'incident': 'incident',
      'crash': 'incident',
      'accident': 'incident',
      'restriction': 'restriction',
      'detour': 'detour',
      'closure': 'restriction',
      'weather': 'weather',
      'special-event': 'special-event'
    };

    // Check for keyword matches
    for (const [keyword, standardType] of Object.entries(typeMap)) {
      if (normalized.includes(keyword)) {
        return standardType;
      }
    }

    return normalized;
  },

  corridor: (value) => {
    if (!value) return null;

    // If it's an array (WZDx v4.x road_names), take first element
    if (Array.isArray(value)) {
      value = value[0];
    }

    if (typeof value !== 'string') return null;

    // Extract interstate/highway identifier
    const interstateMatch = value.match(/I-?\s*\d{1,3}/i);
    if (interstateMatch) {
      return interstateMatch[0].replace(/\s+/g, '-').toUpperCase();
    }

    const usHighwayMatch = value.match(/US-?\s*\d{1,3}/i);
    if (usHighwayMatch) {
      return usHighwayMatch[0].replace(/\s+/g, '-').toUpperCase();
    }

    return value.trim();
  }
};

/**
 * Get field value with priority-based lookup
 * Prefers standard field names, falls back to variations
 */
function getFieldValue(event, standardFieldName, options = {}) {
  const { logUnknownFields = false, sourceId = 'unknown' } = options;

  const priorities = FIELD_PRIORITY_MAP[standardFieldName];
  if (!priorities) {
    console.warn(`⚠️  No field mapping defined for: ${standardFieldName}`);
    return null;
  }

  let usedField = null;
  let value = null;
  let preferredFieldUsed = true;

  // Try each field name in priority order
  for (let i = 0; i < priorities.length; i++) {
    const fieldName = priorities[i];

    // Support nested field access (e.g., "core_details.event_type")
    const fieldValue = getNestedValue(event, fieldName);

    if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
      // Skip empty strings
      if (typeof fieldValue === 'string' && fieldValue.trim() === '') {
        continue;
      }

      usedField = fieldName;
      value = fieldValue;
      preferredFieldUsed = (i === 0); // First in list is preferred
      break;
    }
  }

  // Special handling for coordinates
  if (standardFieldName === 'latitude' || standardFieldName === 'longitude') {
    if (value === null) {
      // Try extracting from geometry
      const coords = extractCoordinates(event);
      if (coords) {
        return standardFieldName === 'latitude' ? coords[1] : coords[0];
      }
    }
  }

  // Log when we use non-preferred fields (helps detect when states could improve)
  if (value !== null && !preferredFieldUsed && logUnknownFields) {
    console.log(`📋 ${sourceId}: Using fallback field "${usedField}" for ${standardFieldName} (prefer: "${priorities[0]}")`);
  }

  // Apply normalization if defined
  if (value !== null && FIELD_NORMALIZERS[standardFieldName]) {
    value = FIELD_NORMALIZERS[standardFieldName](value);
  }

  return value;
}

/**
 * Get nested field value (supports dot notation)
 */
function getNestedValue(obj, path) {
  if (!path) return undefined;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }

    // Handle array indexing like "road_names[0]"
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = current[key];
      if (Array.isArray(current)) {
        current = current[parseInt(index)];
      } else {
        return undefined;
      }
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Extract coordinates from various formats
 */
function extractCoordinates(event) {
  // Try GeoJSON geometry
  if (event.geometry?.coordinates) {
    const coords = event.geometry.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return coords; // [lon, lat]
    }
  }

  // Try direct coordinates array
  if (Array.isArray(event.coordinates) && event.coordinates.length >= 2) {
    return event.coordinates;
  }

  // Try lat/lon fields
  const lat = getFieldValue(event, 'latitude', { logUnknownFields: false });
  const lon = getFieldValue(event, 'longitude', { logUnknownFields: false });

  if (lat !== null && lon !== null) {
    return [parseFloat(lon), parseFloat(lat)];
  }

  return null;
}

/**
 * Normalize an entire event using priority-based field mapping
 */
function normalizeEvent(rawEvent, options = {}) {
  const {
    sourceId = 'unknown',
    stateName = 'Unknown',
    defaultEventType = 'work-zone',
    logUnknownFields = false
  } = options;

  const normalized = {
    // Core identification
    id: getFieldValue(rawEvent, 'id', { logUnknownFields, sourceId })
      || `${sourceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

    source: sourceId,
    state: getFieldValue(rawEvent, 'state', { logUnknownFields, sourceId }) || stateName,

    // Event classification
    eventType: getFieldValue(rawEvent, 'eventType', { logUnknownFields, sourceId }) || defaultEventType,
    severity: getFieldValue(rawEvent, 'severity', { logUnknownFields, sourceId }) || 'medium',
    roadStatus: getFieldValue(rawEvent, 'roadStatus', { logUnknownFields, sourceId }) || 'open',

    // Location
    corridor: getFieldValue(rawEvent, 'corridor', { logUnknownFields, sourceId }),
    direction: getFieldValue(rawEvent, 'direction', { logUnknownFields, sourceId }) || 'both',
    county: getFieldValue(rawEvent, 'county', { logUnknownFields, sourceId }),

    // Coordinates
    latitude: parseFloat(getFieldValue(rawEvent, 'latitude', { logUnknownFields, sourceId })) || null,
    longitude: parseFloat(getFieldValue(rawEvent, 'longitude', { logUnknownFields, sourceId })) || null,

    // Timing
    startTime: getFieldValue(rawEvent, 'startTime', { logUnknownFields, sourceId }),
    endTime: getFieldValue(rawEvent, 'endTime', { logUnknownFields, sourceId }),

    // Description
    description: getFieldValue(rawEvent, 'description', { logUnknownFields, sourceId }) || 'No description available',

    // Impact
    lanesAffected: getFieldValue(rawEvent, 'lanesAffected', { logUnknownFields, sourceId }),

    // Metadata
    updated: new Date().toISOString(),
    requiresCollaboration: false
  };

  // Construct coordinates array if we have lat/lon
  if (normalized.latitude && normalized.longitude) {
    normalized.coordinates = [normalized.longitude, normalized.latitude];
  }

  // Construct location string
  normalized.location = buildLocationString(normalized);

  // Validate critical fields
  if (!normalized.latitude || !normalized.longitude) {
    console.warn(`⚠️  Event missing coordinates: ${normalized.id}`);
    return null;
  }

  if (!normalized.corridor) {
    console.warn(`⚠️  Event missing corridor: ${normalized.id}`);
    return null;
  }

  return normalized;
}

/**
 * Build human-readable location string
 */
function buildLocationString(event) {
  const parts = [];

  if (event.corridor) {
    parts.push(event.corridor);
  }

  if (event.direction && event.direction !== 'both') {
    parts.push(event.direction);
  }

  if (event.county) {
    parts.push(`${event.county} County`);
  }

  return parts.join(' ') || 'Unknown location';
}

/**
 * Detect and log new field names that aren't in our mappings
 * This helps us discover when states add new standard fields
 */
function detectUnmappedFields(event, sourceId = 'unknown') {
  const allMappedFields = new Set();
  Object.values(FIELD_PRIORITY_MAP).forEach(priorities => {
    priorities.forEach(field => allMappedFields.add(field));
  });

  const unmappedFields = [];

  function checkObject(obj, prefix = '') {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (!allMappedFields.has(key) && !allMappedFields.has(fullKey)) {
        // Check if this looks like a standard WZDx field we should know about
        if (key.includes('_') || key.match(/^[a-z]+[A-Z]/)) {
          const value = obj[key];
          if (value !== null && value !== undefined && value !== '') {
            unmappedFields.push({ field: fullKey, sampleValue: String(value).substring(0, 50) });
          }
        }
      }

      // Don't recurse too deep
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && prefix.split('.').length < 2) {
        checkObject(obj[key], fullKey);
      }
    }
  }

  checkObject(event);

  if (unmappedFields.length > 0) {
    console.log(`🔍 ${sourceId}: Detected ${unmappedFields.length} unmapped fields that might be useful:`);
    unmappedFields.slice(0, 5).forEach(({ field, sampleValue }) => {
      console.log(`   - ${field}: "${sampleValue}"`);
    });
  }

  return unmappedFields;
}

module.exports = {
  getFieldValue,
  normalizeEvent,
  detectUnmappedFields,
  extractCoordinates,
  FIELD_PRIORITY_MAP,
  FIELD_NORMALIZERS
};

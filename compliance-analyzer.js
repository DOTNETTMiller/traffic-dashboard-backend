// Comprehensive Standards Compliance Analyzer
// Evaluates traffic events against SAE J2735, WZDx v4.x, and TMDD/ngTMDD standards

// Spec-based rubric describing mandated and optional data requirements per standard.
// This is the authoritative checklist used to align scoring logic with real specifications.
const STANDARD_REQUIREMENTS = {
  WZDx_v4: {
    label: 'Work Zone Data Exchange v4.0',
    reference: 'https://usdoti.github.io/codehub/docs/wzdx-feed-specification-4.0',
    requiredFields: [
      { field: 'id', specField: 'Feature.id', description: 'Unique event identifier', severity: 'critical' },
      { field: 'eventType', specField: 'coreDetails.event_type', description: 'WZDx event classification', severity: 'critical', enum: ['work-zone', 'work zone', 'closure', 'restriction', 'incident', 'construction', 'weather', 'special-event'] },
      { field: 'startTime', fallbackFields: ['startDate'], specField: 'coreDetails.start_date', description: 'Start time (ISO 8601)', severity: 'critical', format: 'ISO8601' },
      { field: 'coordinates', specField: 'geography.coordinates', description: 'Geospatial location (lat/long)', severity: 'critical', validator: 'coordinates' },
      { field: 'corridor', fallbackFields: ['location'], specField: 'coreDetails.road_names', description: 'Primary roadway/corridor', severity: 'high', minLength: 3 },
      { field: 'direction', specField: 'coreDetails.direction', description: 'Direction of travel', severity: 'high', enum: ['northbound','southbound','eastbound','westbound','both','unknown','n','s','e','w','nb','sb','eb','wb'] },
      { field: 'lanesAffected', fallbackFields: ['lanesClosed'], specField: 'impacts.lanes', description: 'Lane impact details', severity: 'high' },
      { field: 'description', specField: 'coreDetails.description', description: 'Human-readable description', severity: 'medium', minLength: 10 },
      { field: 'endTime', fallbackFields: ['endDate'], specField: 'coreDetails.end_date', description: 'Estimated end time', severity: 'medium', format: 'ISO8601', optional: true },
      { field: 'severity', specField: 'impacts.severity', description: 'Impact severity/priority', severity: 'medium', enum: ['high','medium','low','major','moderate','minor'] }
    ],
    optionalEnhancements: [
      { field: 'restrictions', description: 'Vehicle restrictions (height/weight)', benefit: 'Supports connected vehicle use cases' },
      { field: 'workerPresence', description: 'Structured worker presence data', benefit: 'Improves safety messaging' }
    ]
  },
  SAE_J2735_TIM: {
    label: 'SAE J2735 Traveler Information Message',
    reference: 'https://standards.sae.org/j2735_202011/',
    requiredFields: [
      { field: 'id', specField: 'TravelerInformation.packetID', description: 'TIM packet identifier', severity: 'critical' },
      { field: 'startTime', fallbackFields: ['startDate'], specField: 'TravelerDataFrame.startTime', description: 'Start time (ISO 8601)', severity: 'critical', format: 'ISO8601' },
      { field: 'endTime', fallbackFields: ['endDate'], specField: 'TravelerDataFrame.endTime', description: 'End time', severity: 'high', format: 'ISO8601', optional: true },
      { field: 'coordinates', specField: 'Position3D', description: 'Latitude/longitude', severity: 'critical', validator: 'coordinates' },
      { field: 'eventType', fallbackFields: ['type'], specField: 'Content.itis', description: 'ITIS-compatible event type', severity: 'high' },
      { field: 'severity', specField: 'TravelerDataFrame.priority', description: 'Priority (0-7 -> high/medium/low)', severity: 'high', enum: ['high','medium','low','major','moderate','minor'] },
      { field: 'description', specField: 'TravelerDataFrame.content', description: 'Advisory text', severity: 'high', minLength: 15 },
      { field: 'direction', specField: 'GeographicalPath.direction', description: 'Direction of travel', severity: 'medium', enum: ['northbound','southbound','eastbound','westbound','both','unknown','n','s','e','w','nb','sb','eb','wb'] },
      { field: 'lanesClosed', fallbackFields: ['lanesAffected'], specField: 'WorkZone.lanes', description: 'Lane closure details', severity: 'medium' },
      { field: 'roadStatus', fallbackFields: ['status'], specField: 'RoadClosure.status', description: 'Open/closed/restricted state', severity: 'medium', enum: ['open','closed','restricted','Open','Closed','Restricted'] }
    ],
    optionalEnhancements: [
      { field: 'detourRoute', description: 'Linked detour guidance', benefit: 'Enhances traveler routing' },
      { field: 'speedLimit', description: 'Regulatory/advisory speed', benefit: 'Improves CV applications' }
    ]
  },
  TMDD_ngC2C: {
    label: 'TMDD v3 / ngC2C MVT',
    reference: 'https://www.ite.org/technical-resources/topics/traffic-management-data-dictionary/',
    requiredFields: [
      { field: 'id', fallbackFields: ['eventId'], specField: 'tmdd:eventID', description: 'Event identifier', severity: 'critical' },
      { field: 'state', specField: 'tmdd:organization-id', description: 'Owning organization/state', severity: 'critical', minLength: 2 },
      { field: 'startTime', fallbackFields: ['startDate'], specField: 'tmdd:event-update-time', description: 'Event update/start time', severity: 'critical', format: 'ISO8601' },
      { field: 'roadStatus', specField: 'tmdd:event-status', description: 'Event status (open/closed/planned)', severity: 'high', enum: ['open','closed','planned','restricted','Active','active','Planned','Closed'] },
      { field: 'corridor', fallbackFields: ['location'], specField: 'tmdd:roadway-name', description: 'Roadway identifier', severity: 'high', minLength: 3 },
      { field: 'direction', specField: 'tmdd:direction', description: 'Direction of travel', severity: 'high', enum: ['northbound','southbound','eastbound','westbound','both','unknown','n','s','e','w','nb','sb','eb','wb'] },
      { field: 'lanesAffected', fallbackFields: ['lanesClosed'], specField: 'tmdd:lane-closure-status', description: 'Lane impact details', severity: 'high' },
      { field: 'severity', specField: 'tmdd:event-impact-level', description: 'Impact severity level', severity: 'medium', enum: ['high','medium','low','major','moderate','minor'] },
      { field: 'description', specField: 'tmdd:event-description', description: 'Narrative description', severity: 'medium', minLength: 10 },
      { field: 'coordinates', specField: 'tmdd:point', description: 'Spatial reference', severity: 'medium', validator: 'coordinates' }
    ],
    optionalEnhancements: [
      { field: 'detourRoute', description: 'Structured detour routing', benefit: 'Improves C2C coordination' },
      { field: 'contact', description: 'Incident command contact', benefit: 'Supports center-to-center escalation' }
    ]
  }
};

const SEVERITY_WEIGHTS = {
  critical: 0.6,
  high: 0.3,
  medium: 0.1
};

const DIRECTION_MAP = {
  n: 'northbound',
  north: 'northbound',
  nb: 'northbound',
  'north-bound': 'northbound',
  northbound: 'northbound',
  s: 'southbound',
  south: 'southbound',
  sb: 'southbound',
  'south-bound': 'southbound',
  southbound: 'southbound',
  e: 'eastbound',
  east: 'eastbound',
  eb: 'eastbound',
  'east-bound': 'eastbound',
  eastbound: 'eastbound',
  w: 'westbound',
  west: 'westbound',
  wb: 'westbound',
  'west-bound': 'westbound',
  westbound: 'westbound',
  both: 'both',
  'bi-directional': 'both',
  unknown: 'unknown'
};

const SEVERITY_NORMALIZATION = {
  high: 'high',
  severe: 'high',
  major: 'high',
  critical: 'high',
  urgent: 'high',
  medium: 'medium',
  moderate: 'medium',
  normal: 'medium',
  low: 'low',
  minor: 'low',
  informational: 'low',
  info: 'low'
};

const ROAD_STATUS_MAP = {
  open: 'open',
  opened: 'open',
  normal: 'open',
  closed: 'closed',
  closure: 'closed',
  restricted: 'restricted',
  restricteds: 'restricted',
  partial: 'restricted',
  planned: 'planned',
  active: 'open'
};

const EVENT_TYPE_SYNONYMS = [
  { keywords: ['construction', 'work', 'maintenance'], normalized: 'work-zone' },
  { keywords: ['closure', 'closed', 'detour'], normalized: 'closure' },
  { keywords: ['restriction'], normalized: 'restriction' },
  { keywords: ['incident', 'crash', 'accident', 'collision'], normalized: 'incident' },
  { keywords: ['weather', 'snow', 'ice', 'fog', 'rain'], normalized: 'weather' },
  { keywords: ['special'], normalized: 'special-event' }
];

const CANONICAL_FIELD_MAP = {
  id: 'id',
  eventType: 'eventType',
  type: 'eventType',
  event_type: 'eventType',
  category: 'eventType',
  startTime: 'startTime',
  startDate: 'startTime',
  start_date: 'startTime',
  endTime: 'endTime',
  endDate: 'endTime',
  end_date: 'endTime',
  description: 'description',
  lanesAffected: 'lanesAffected',
  lanesClosed: 'lanesAffected',
  severity: 'severity',
  priority: 'severity',
  direction: 'direction',
  roadStatus: 'roadStatus',
  status: 'roadStatus',
  coordinates: 'coordinates',
  corridor: 'corridor'
};

function resolveFieldValue(obj, path) {
  if (!path) return undefined;
  const segments = path.split('.');
  let current = obj;
  for (const segment of segments) {
    if (current === undefined || current === null) return undefined;
    const arrayMatch = segment.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      const arrayValue = current[key];
      if (!Array.isArray(arrayValue) || arrayValue.length <= index) {
        return undefined;
      }
      current = arrayValue[index];
    } else {
      current = current[segment];
    }
  }
  return current;
}

function getRequirementValue(event, requirement) {
  const fields = [requirement.field, ...(requirement.fallbackFields || [])];
  for (const field of fields) {
    if (!field) continue;
    if (field === 'coordinates') {
      if (Array.isArray(event.coordinates) && event.coordinates.length >= 2) {
        return event.coordinates;
      }
    }
    const value = resolveFieldValue(event, field);
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'string' && value.trim().length === 0) {
        continue;
      }
      return value;
    }
  }

  if (requirement.validator === 'coordinates' || requirement.field === 'coordinates') {
    const lat = event.latitude ?? resolveFieldValue(event, 'latitude');
    const lon = event.longitude ?? resolveFieldValue(event, 'longitude');
    if (lat !== undefined && lon !== undefined) {
      return [lon, lat];
    }
  }

  return null;
}

function getRawRequirementValue(event, requirement) {
  if (!event.rawFields) return null;
  const fields = [requirement.field, ...(requirement.fallbackFields || [])];
  for (const field of fields) {
    if (!field) continue;
    const canonical = CANONICAL_FIELD_MAP[field.split('.')[0]];
    if (canonical && Object.prototype.hasOwnProperty.call(event.rawFields, canonical)) {
      const fieldData = event.rawFields[canonical];
      // Use .raw value (what actually exists in feed), not .extracted or .normalized
      const value = fieldData?.raw ?? fieldData;
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
  }

  return null;
}

function normalizeDirection(value) {
  if (value === undefined || value === null) return '';
  const text = String(value).trim().toLowerCase();
  if (!text) return '';
  return DIRECTION_MAP[text] || text;
}

function normalizeSeverity(value) {
  if (value === undefined || value === null) return '';
  const text = String(value).trim().toLowerCase();
  if (!text) return '';
  return SEVERITY_NORMALIZATION[text] || text;
}

function normalizeRoadStatus(value) {
  if (value === undefined || value === null) return '';
  const text = String(value).trim().toLowerCase();
  if (!text) return '';
  return ROAD_STATUS_MAP[text] || text;
}

function normalizeEventType(value) {
  if (value === undefined || value === null) return '';
  const text = String(value).trim().toLowerCase();
  if (!text) return '';

  for (const synonym of EVENT_TYPE_SYNONYMS) {
    if (synonym.keywords.some(keyword => text.includes(keyword))) {
      return synonym.normalized;
    }
  }

  return text;
}

function validateCoordinates(event, rawValue) {
  let lon;
  let lat;

  if (Array.isArray(rawValue) && rawValue.length >= 2) {
    lon = parseFloat(rawValue[0]);
    lat = parseFloat(rawValue[1]);
  } else if (rawValue && typeof rawValue === 'object') {
    lon = parseFloat(rawValue.lon ?? rawValue.lng ?? rawValue.longitude);
    lat = parseFloat(rawValue.lat ?? rawValue.latitude);
  } else if (typeof rawValue === 'string' && rawValue.includes(',')) {
    const parts = rawValue.split(',').map(part => parseFloat(part.trim()));
    if (parts.length === 2) {
      lon = parts[0];
      lat = parts[1];
    }
  }

  if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && event) {
    const fallbackLat = parseFloat(event.latitude);
    const fallbackLon = parseFloat(event.longitude);
    if (Number.isFinite(fallbackLat) && Number.isFinite(fallbackLon)) {
      lat = fallbackLat;
      lon = fallbackLon;
    }
  }

  const isValid =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat !== 0 &&
    lon !== 0 &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180;

  return {
    passed: isValid,
    normalizedValue: isValid ? { lat, lon } : null,
    message: isValid ? null : 'Missing or invalid latitude/longitude'
  };
}

function matchesEnumeration(value, allowed) {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;

  const variants = new Set([
    normalized,
    normalized.replace(/\s+/g, '-'),
    normalized.replace(/-/g, ' ')
  ]);

  const allowedSet = new Set(allowed.map(item => item.toLowerCase()));

  for (const variant of variants) {
    if (allowedSet.has(variant)) {
      return true;
    }
  }

  return false;
}

function validateRequirementValue(event, requirement, value) {
  if (value === null || value === undefined || value === '') {
    return {
      passed: false,
      message: 'Value missing'
    };
  }

  if (requirement.validator === 'coordinates' || requirement.field === 'coordinates') {
    return validateCoordinates(event, value);
  }

  if (requirement.enum) {
    let normalizedValue = value;

    if (requirement.field === 'direction') {
      normalizedValue = normalizeDirection(value);
    } else if (requirement.field === 'severity') {
      normalizedValue = normalizeSeverity(value);
    } else if (requirement.field === 'roadStatus') {
      normalizedValue = normalizeRoadStatus(value);
    } else if (requirement.field === 'eventType') {
      normalizedValue = normalizeEventType(value);
    } else if (Array.isArray(value)) {
      normalizedValue = value[0];
    }

    const isMatch = matchesEnumeration(normalizedValue, requirement.enum);

    return {
      passed: isMatch,
      normalizedValue,
      message: isMatch ? null : `Value "${value}" is not in allowed set`
    };
  }

  if (requirement.format === 'ISO8601') {
    const candidate = Array.isArray(value) ? value[0] : value;
    const parsed = Date.parse(candidate);
    if (Number.isNaN(parsed)) {
      return {
        passed: false,
        message: `Value "${candidate}" is not a valid ISO 8601 timestamp`
      };
    }
  }

  if (requirement.minLength) {
    const candidate = String(value).trim();
    if (candidate.length < requirement.minLength) {
      return {
        passed: false,
        message: `Value too short (minimum ${requirement.minLength} characters required)`
      };
    }
  }

  return {
    passed: true,
    normalizedValue: value
  };
}

function computeStandardCompliance(events, spec, useRaw = false) {
  if (!events || events.length === 0) {
    return {
      weightedScore: 0,
      severityRatios: { critical: 0, high: 0, medium: 0 },
      totals: { critical: 0, high: 0, medium: 0 },
      passes: { critical: 0, high: 0, medium: 0 },
      violations: [],
      optionalMissing: [],
      fieldCoverage: []
    };
  }

  const required = spec.requiredFields.filter(req => !req.optional);
  const optional = spec.requiredFields.filter(req => req.optional);

  const severityCounts = required.reduce((acc, req) => {
    acc[req.severity] = (acc[req.severity] || 0) + 1;
    return acc;
  }, {});

  const perField = new Map();
  required.forEach(requirement => {
    perField.set(requirement.field, {
      requirement,
      passes: 0,
      total: 0,
      rawHits: 0,
      extractedHits: 0,
      normalizedHits: 0,
      rawSampleValid: null,
      rawSampleInvalid: null,
      extractedSampleValid: null,
      extractedSampleInvalid: null,
      normalizedSampleValid: null,
      normalizedSampleInvalid: null
    });
  });

  const totals = {
    critical: (severityCounts.critical || 0) * events.length,
    high: (severityCounts.high || 0) * events.length,
    medium: (severityCounts.medium || 0) * events.length
  };

  const passes = { critical: 0, high: 0, medium: 0 };
  const violations = [];
  const optionalMissingMap = new Map();

  events.forEach(event => {
    required.forEach(requirement => {
      const normalizedValue = getRequirementValue(event, requirement);
      const normalizedEval = validateRequirementValue(event, requirement, normalizedValue);

      // Get raw value (what actually exists in feed)
      const rawValue = useRaw ? getRawRequirementValue(event, requirement) : null;
      const rawContext = event.rawFields ? { ...event, ...event.rawFields } : event;
      const rawEval = validateRequirementValue(rawContext, requirement, rawValue !== null ? rawValue : normalizedValue);

      // Get extracted value (what we can parse from text)
      const extractedValue = event.rawFields?.[CANONICAL_FIELD_MAP[requirement.field.split('.')[0]]]?.extracted ?? null;
      const extractedEval = validateRequirementValue(event, requirement, extractedValue ?? normalizedValue);

      const fieldStat = perField.get(requirement.field);
      fieldStat.total += 1;

      // Track normalized (final) values
      if (normalizedEval.passed) {
        fieldStat.normalizedHits += 1;
        if (fieldStat.normalizedSampleValid === null && normalizedEval.normalizedValue !== undefined) {
          fieldStat.normalizedSampleValid = normalizedEval.normalizedValue;
        } else if (fieldStat.normalizedSampleValid === null && normalizedValue !== undefined) {
          fieldStat.normalizedSampleValid = normalizedValue;
        }
      } else if (fieldStat.normalizedSampleInvalid === null && normalizedValue !== undefined) {
        fieldStat.normalizedSampleInvalid = normalizedValue;
      }

      // Track extracted (parsed from text) values
      if (extractedEval.passed) {
        fieldStat.extractedHits += 1;
        if (fieldStat.extractedSampleValid === null && extractedValue !== null) {
          fieldStat.extractedSampleValid = extractedValue;
        }
      } else if (fieldStat.extractedSampleInvalid === null && extractedValue !== null) {
        fieldStat.extractedSampleInvalid = extractedValue;
      }

      // Track raw (actually exists in feed) values
      if (rawEval.passed) {
        fieldStat.rawHits += 1;
        if (fieldStat.rawSampleValid === null && rawEval.normalizedValue !== undefined) {
          fieldStat.rawSampleValid = rawEval.normalizedValue;
        } else if (fieldStat.rawSampleValid === null && rawValue !== null && rawValue !== undefined) {
          fieldStat.rawSampleValid = rawValue;
        }
      } else if (fieldStat.rawSampleInvalid === null && rawValue !== null && rawValue !== undefined) {
        fieldStat.rawSampleInvalid = rawValue;
      }

      const primaryEval = useRaw ? rawEval : normalizedEval;
      const primaryValue = useRaw ? (rawValue !== null ? rawValue : normalizedValue) : normalizedValue;

      if (primaryEval.passed) {
        passes[requirement.severity] += 1;
        fieldStat.passes += 1;
      } else {
        violations.push({
          eventId: event.id,
          state: event.state || null,
          field: requirement.field,
          specField: requirement.specField,
          severity: requirement.severity,
          description: requirement.description,
          message: primaryEval.message || 'Missing or invalid value',
          sampleValue: primaryValue,
          normalizedSample: normalizedEval.normalizedValue,
          rawSample: rawEval.normalizedValue,
          rawValue: rawValue !== null ? rawValue : normalizedValue
        });
      }
    });

    optional.forEach(requirement => {
      const normalizedValue = getRequirementValue(event, requirement);
      const normalizedEval = validateRequirementValue(event, requirement, normalizedValue);

      const rawValue = useRaw ? getRawRequirementValue(event, requirement) : null;
      const rawContext = event.rawFields ? { ...event, ...event.rawFields } : event;
      const rawEval = validateRequirementValue(rawContext, requirement, rawValue !== null ? rawValue : normalizedValue);

      const primaryEval = useRaw ? rawEval : normalizedEval;
      const primaryValue = useRaw ? (rawValue !== null ? rawValue : normalizedValue) : normalizedValue;

      if (!primaryEval.passed && !optionalMissingMap.has(requirement.field)) {
        optionalMissingMap.set(requirement.field, {
          field: requirement.field,
          specField: requirement.specField,
          description: requirement.description,
          message: primaryEval.message || 'Not provided',
          sampleEventId: event.id,
          rawSample: rawValue,
          normalizedSample: normalizedValue
        });
      }
    });
  });

  const severityRatios = {
    critical: totals.critical === 0 ? 1 : passes.critical / totals.critical,
    high: totals.high === 0 ? 1 : passes.high / totals.high,
    medium: totals.medium === 0 ? 1 : passes.medium / totals.medium
  };

  const weightedScore = Object.entries(SEVERITY_WEIGHTS).reduce((total, [severity, weight]) => {
    return total + (severityRatios[severity] * weight);
  }, 0);

  const fieldCoverage = Array.from(perField.values()).map(stat => {
    const coverage = stat.total === 0 ? 0 : stat.passes / stat.total;
    const rawCoverage = stat.total === 0 ? 0 : stat.rawHits / stat.total;
    const extractedCoverage = stat.total === 0 ? 0 : stat.extractedHits / stat.total;
    const normalizedCoverage = stat.total === 0 ? 0 : stat.normalizedHits / stat.total;

    return {
      field: stat.requirement.field,
      specField: stat.requirement.specField,
      description: stat.requirement.description,
      severity: stat.requirement.severity,
      coverage,
      coveragePercentage: Math.round(coverage * 100),
      rawCoverage,
      rawCoveragePercentage: Math.round(rawCoverage * 100),
      extractedCoverage,
      extractedCoveragePercentage: Math.round(extractedCoverage * 100),
      normalizedCoverage,
      normalizedCoveragePercentage: Math.round(normalizedCoverage * 100),
      sampleValue: stat.sampleValid,
      missingExample: stat.sampleInvalid,
      rawSampleValid: stat.rawSampleValid,
      rawSampleInvalid: stat.rawSampleInvalid,
      extractedSampleValid: stat.extractedSampleValid,
      extractedSampleInvalid: stat.extractedSampleInvalid,
      normalizedSampleValid: stat.normalizedSampleValid,
      normalizedSampleInvalid: stat.normalizedSampleInvalid
    };
  });

  return {
    weightedScore,
    severityRatios,
    totals,
    passes,
    violations,
    optionalMissing: Array.from(optionalMissingMap.values()),
    fieldCoverage
  };
}

function adjustGradeForCritical(baseGrade, criticalRatio) {
  if (criticalRatio >= 0.85) return baseGrade;
  if (criticalRatio >= 0.75) {
    if (baseGrade === 'A') return 'B';
    if (baseGrade === 'B') return 'C';
    return baseGrade;
  }
  if (criticalRatio >= 0.6) {
    if (['A', 'B'].includes(baseGrade)) return 'C';
    if (baseGrade === 'C') return 'D';
    return baseGrade;
  }
  return 'F';
}

function deriveStatus(percentage, criticalRatio, labels) {
  const defaults = {
    compliant: 'Compliant',
    partial: 'Partially Compliant',
    non: 'Non-Compliant'
  };

  const merged = { ...defaults, ...(labels || {}) };

  if (criticalRatio >= 0.9 && percentage >= 85) {
    return merged.compliant;
  }
  if (criticalRatio >= 0.75 && percentage >= 65) {
    return merged.partial;
  }
  return merged.non;
}

class ComplianceAnalyzer {
  constructor() {
    // Field weights for scoring
    this.fieldWeights = {
      // Critical fields (10 points each)
      id: 10,
      coordinates: 10,
      location: 10,
      startDate: 10,

      // Important fields (7 points each)
      type: 7,
      severity: 7,
      description: 7,
      state: 7,

      // Moderate fields (5 points each)
      endDate: 5,
      direction: 5,
      lanesClosed: 5,
      roadStatus: 5,

      // Optional fields (3 points each)
      corridor: 3,
      source: 3,
      category: 3
    };

    // Field name mappings - recognizes data in different formats
    this.fieldMappings = {
      startDate: ['startDate', 'start_date', 'startTime', 'start_time', 'start'],
      endDate: ['endDate', 'end_date', 'endTime', 'end_time', 'end'],
      type: ['type', 'eventType', 'event_type', 'category', 'event_category'],
      lanesClosed: ['lanesClosed', 'lanes_closed', 'lanesAffected', 'lanes_affected', 'closedLanes'],
      coordinates: ['coordinates', 'geometry.coordinates'],
      description: ['description', 'headline', 'summary', 'title'],
      severity: ['severity', 'impact', 'priority'],
      direction: ['direction', 'travelDirection', 'travel_direction'],
      roadStatus: ['roadStatus', 'road_status', 'status', 'roadway_status']
    };
  }

  // Helper: Get field value from event, trying multiple possible field names
  getFieldValue(event, standardFieldName) {
    const possibleNames = this.fieldMappings[standardFieldName] || [standardFieldName];

    for (const fieldName of possibleNames) {
      // Handle nested fields like "geometry.coordinates"
      if (fieldName.includes('.')) {
        const parts = fieldName.split('.');
        let value = event;
        for (const part of parts) {
          value = value?.[part];
          if (value === undefined) break;
        }
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      } else {
        const value = event[fieldName];
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }
    }

    // Special handling for coordinates from lat/lng
    if (standardFieldName === 'coordinates') {
      const lat = event.latitude || event.lat;
      const lng = event.longitude || event.lon || event.lng;
      if (lat !== undefined && lng !== undefined && lat !== 0 && lng !== 0) {
        return [lng, lat];  // GeoJSON format: [longitude, latitude]
      }
    }

    return null;
  }

  // Helper: Check if event has a field (in any variation)
  hasField(event, standardFieldName) {
    return this.getFieldValue(event, standardFieldName) !== null;
  }

  // Main analysis function for a state
  analyzeState(stateKey, stateName, events) {
    if (!events || events.length === 0) {
      return this.getEmptyStateAnalysis(stateKey, stateName);
    }

    const fieldAnalysis = this.analyzeFieldCompleteness(events);
    const dataCompletenessScore = this.calculateDataCompleteness(fieldAnalysis);
    const wzdxScore = this.analyzeWZDxCompliance(events);
    const saeScore = this.analyzeSAEJ2735Compliance(events);
    const tmddScore = this.analyzeTMDDCompliance(events);

    // Calculate overall composite score
    const overallScore = this.calculateCompositeScore(wzdxScore, saeScore, tmddScore);

    // Generate action plan
    const actionPlan = this.generateActionPlan(fieldAnalysis, events);

    // C2C compliance
    const c2cCompliance = this.analyzeC2CCompliance(events);

    // Multi-standard compliance
    const multiStandardCompliance = this.analyzeMultiStandardCompliance(
      wzdxScore, saeScore, tmddScore, events
    );

    return {
      state: stateName,
      stateKey: stateKey,
      generatedAt: new Date().toISOString(),
      eventCount: events.length,
      currentFormat: this.detectCurrentFormat(events),
      overallScore: overallScore,
      multiStandardCompliance: multiStandardCompliance,
      c2cCompliance: c2cCompliance,
      dataCompletenessScore,
      fieldLevelAnalysis: this.generateFieldLevelAnalysis(events),
      categoryScores: this.generateCategoryScores(fieldAnalysis),
      actionPlan: actionPlan,
      improvementPotential: this.calculateImprovementPotential(actionPlan, overallScore),
      complianceGuideUrl: `/api/compliance/state/${stateKey}`
    };
  }

  // Analyze WZDx v4.x compliance
  analyzeWZDxCompliance(events) {
    const spec = STANDARD_REQUIREMENTS.WZDx_v4;

    // Compute normalized compliance (default behavior)
    const normalizedEval = computeStandardCompliance(events, spec, false);
    let normalizedPercentage = Math.round(normalizedEval.weightedScore * 100);
    let normalizedGrade = this.getLetterGrade(normalizedPercentage);
    normalizedGrade = adjustGradeForCritical(normalizedGrade, normalizedEval.severityRatios.critical);
    const normalizedStatus = deriveStatus(normalizedPercentage, normalizedEval.severityRatios.critical, {
      compliant: 'Compliant',
      partial: 'Partially Compliant',
      non: 'Non-Compliant'
    });

    // Compute raw compliance (based on original feed data)
    const rawEval = computeStandardCompliance(events, spec, true);
    let rawPercentage = Math.round(rawEval.weightedScore * 100);
    let rawGrade = this.getLetterGrade(rawPercentage);
    rawGrade = adjustGradeForCritical(rawGrade, rawEval.severityRatios.critical);
    const rawStatus = deriveStatus(rawPercentage, rawEval.severityRatios.critical, {
      compliant: 'Compliant',
      partial: 'Partially Compliant',
      non: 'Non-Compliant'
    });

    return {
      // Primary scores (RAW - what feed actually provides)
      percentage: rawPercentage,
      grade: rawGrade,
      status: rawStatus,
      severityBreakdown: rawEval.severityRatios,
      fieldCoverage: rawEval.fieldCoverage,
      violations: rawEval.violations.slice(0, 15),
      optionalRecommendations: [
        ...rawEval.optionalMissing,
        ...(spec.optionalEnhancements || [])
      ].slice(0, 10),
      // Enhanced scores (with normalization/inference)
      enhanced: {
        percentage: normalizedPercentage,
        grade: normalizedGrade,
        status: normalizedStatus,
        severityBreakdown: normalizedEval.severityRatios,
        fieldCoverage: normalizedEval.fieldCoverage
      }
    };
  }

  // Analyze SAE J2735 compliance
  analyzeSAEJ2735Compliance(events) {
    const spec = STANDARD_REQUIREMENTS.SAE_J2735_TIM;

    // Compute normalized compliance (default behavior)
    const normalizedEval = computeStandardCompliance(events, spec, false);
    let normalizedPercentage = Math.round(normalizedEval.weightedScore * 100);
    let normalizedGrade = this.getLetterGrade(normalizedPercentage);
    normalizedGrade = adjustGradeForCritical(normalizedGrade, normalizedEval.severityRatios.critical);
    const normalizedStatus = deriveStatus(normalizedPercentage, normalizedEval.severityRatios.critical, {
      compliant: 'V2X Ready',
      partial: 'Partial Support',
      non: 'Limited Support'
    });

    // Compute raw compliance (based on original feed data)
    const rawEval = computeStandardCompliance(events, spec, true);
    let rawPercentage = Math.round(rawEval.weightedScore * 100);
    let rawGrade = this.getLetterGrade(rawPercentage);
    rawGrade = adjustGradeForCritical(rawGrade, rawEval.severityRatios.critical);
    const rawStatus = deriveStatus(rawPercentage, rawEval.severityRatios.critical, {
      compliant: 'V2X Ready',
      partial: 'Partial Support',
      non: 'Limited Support'
    });

    return {
      // Primary scores (RAW - what feed actually provides)
      percentage: rawPercentage,
      grade: rawGrade,
      status: rawStatus,
      severityBreakdown: rawEval.severityRatios,
      fieldCoverage: rawEval.fieldCoverage,
      violations: rawEval.violations.slice(0, 15),
      optionalRecommendations: [
        ...rawEval.optionalMissing,
        ...(spec.optionalEnhancements || [])
      ].slice(0, 10),
      // Enhanced scores (with normalization/inference)
      enhanced: {
        percentage: normalizedPercentage,
        grade: normalizedGrade,
        status: normalizedStatus,
        severityBreakdown: normalizedEval.severityRatios,
        fieldCoverage: normalizedEval.fieldCoverage
      }
    };
  }

  // Analyze TMDD/ngTMDD compliance
  analyzeTMDDCompliance(events) {
    const spec = STANDARD_REQUIREMENTS.TMDD_ngC2C;

    // Compute normalized compliance (default behavior)
    const normalizedEval = computeStandardCompliance(events, spec, false);
    let normalizedPercentage = Math.round(normalizedEval.weightedScore * 100);
    let normalizedGrade = this.getLetterGrade(normalizedPercentage);
    normalizedGrade = adjustGradeForCritical(normalizedGrade, normalizedEval.severityRatios.critical);
    const normalizedStatus = deriveStatus(normalizedPercentage, normalizedEval.severityRatios.critical, {
      compliant: 'C2C Ready',
      partial: 'Needs Enhancement',
      non: 'Requires Work'
    });

    // Compute raw compliance (based on original feed data)
    const rawEval = computeStandardCompliance(events, spec, true);
    let rawPercentage = Math.round(rawEval.weightedScore * 100);
    let rawGrade = this.getLetterGrade(rawPercentage);
    rawGrade = adjustGradeForCritical(rawGrade, rawEval.severityRatios.critical);
    const rawStatus = deriveStatus(rawPercentage, rawEval.severityRatios.critical, {
      compliant: 'C2C Ready',
      partial: 'Needs Enhancement',
      non: 'Requires Work'
    });

    return {
      // Primary scores (RAW - what feed actually provides)
      percentage: rawPercentage,
      grade: rawGrade,
      status: rawStatus,
      severityBreakdown: rawEval.severityRatios,
      fieldCoverage: rawEval.fieldCoverage,
      violations: rawEval.violations.slice(0, 15),
      optionalRecommendations: [
        ...rawEval.optionalMissing,
        ...(spec.optionalEnhancements || [])
      ].slice(0, 10),
      // Enhanced scores (with normalization/inference)
      enhanced: {
        percentage: normalizedPercentage,
        grade: normalizedGrade,
        status: normalizedStatus,
        severityBreakdown: normalizedEval.severityRatios,
        fieldCoverage: normalizedEval.fieldCoverage
      }
    };
  }

  // Calculate composite score across all standards
  calculateCompositeScore(wzdx, sae, tmdd) {
    // Weighted average: WZDx 40%, SAE 35%, TMDD 25%
    // Primary scores are now RAW (actual feed data)
    const percentage = Math.round(
      (wzdx.percentage * 0.4) +
      (sae.percentage * 0.35) +
      (tmdd.percentage * 0.25)
    );

    const grade = this.getLetterGrade(percentage);

    // Calculate enhanced composite score (with normalization)
    const enhancedPercentage = Math.round(
      (wzdx.enhanced.percentage * 0.4) +
      (sae.enhanced.percentage * 0.35) +
      (tmdd.enhanced.percentage * 0.25)
    );

    const enhancedGrade = this.getLetterGrade(enhancedPercentage);

    let rank, message;
    if (percentage >= 90) {
      rank = '🏆 Excellent - Multi-Standard Leader';
      message = 'Outstanding compliance across all standards';
    } else if (percentage >= 80) {
      rank = '⭐ Very Good - Production Ready';
      message = 'Strong compliance, minor improvements available';
    } else if (percentage >= 70) {
      rank = '✓ Good - Operational';
      message = 'Acceptable compliance, some gaps to address';
    } else if (percentage >= 60) {
      rank = '⚠ Fair - Needs Improvement';
      message = 'Basic compliance, significant gaps present';
    } else {
      rank = '❌ Poor - Action Required';
      message = 'Major compliance issues, immediate action needed';
    }

    return {
      percentage: percentage,
      grade: grade,
      rank: rank,
      message: message,
      breakdown: {
        wzdx: wzdx,
        sae: sae,
        tmdd: tmdd
      },
      enhanced: {
        percentage: enhancedPercentage,
        grade: enhancedGrade
      }
    };
  }

  // Analyze field completeness using normalized field access
  analyzeFieldCompleteness(events) {
    const fieldStats = {};

    Object.keys(this.fieldWeights).forEach(field => {
      fieldStats[field] = {
        present: 0,
        missing: 0,
        examples: []
      };
    });

    events.forEach(event => {
      Object.keys(this.fieldWeights).forEach(field => {
        // Use normalized field access to check for data in any format
        if (this.hasField(event, field)) {
          fieldStats[field].present++;
        } else {
          fieldStats[field].missing++;
          if (fieldStats[field].examples.length < 5) {
            fieldStats[field].examples.push(event.id);
          }
        }
      });
    });

    return fieldStats;
  }

  calculateDataCompleteness(fieldStats) {
    let earnedPoints = 0;
    let possiblePoints = 0;

    Object.entries(this.fieldWeights).forEach(([field, weight]) => {
      const stats = fieldStats[field];
      if (!stats) return;
      const total = stats.present + stats.missing;
      earnedPoints += stats.present * weight;
      possiblePoints += total * weight;
    });

    if (possiblePoints === 0) {
      return 0;
    }

    return Math.round((earnedPoints / possiblePoints) * 100);
  }

  // Generate field-level violation analysis
  generateFieldLevelAnalysis(events) {
    const violations = [];
    const sampleEvent = events[0] || {};
    const feedType = sampleEvent.source?.includes('WZDx') ? 'WZDx' : 'TMDD';

    // Check for missing coordinates (using normalized field access)
    const missingCoords = events.filter(e => !this.hasField(e, 'coordinates'));
    if (missingCoords.length > events.length * 0.1) {
      violations.push({
        category: 'Missing Geographic Coordinates',
        severity: 'CRITICAL',
        count: missingCoords.length,
        specRequirement: feedType === 'WZDx' ?
          'WZDx v4.x requires geometry.coordinates for all features' :
          'TMDD requires event-location with latitude/longitude',
        impact: 'Events cannot be mapped or used for location-based queries',
        recommendation: 'Add latitude/longitude coordinates for all events',
        examples: missingCoords.slice(0, 5).map(e => ({
          eventId: e.id,
          location: e.location,
          missingFields: ['coordinates']
        }))
      });
    }

    // Check for missing timestamps
    const missingStart = events.filter(e => !e.startDate);
    if (missingStart.length > 0) {
      violations.push({
        category: 'Missing Start Time',
        severity: 'HIGH',
        count: missingStart.length,
        specRequirement: feedType === 'WZDx' ?
          'WZDx v4.x requires properties.start_date' :
          'TMDD requires event-element-details.update-time',
        impact: 'Cannot determine when events began or filter by time',
        recommendation: 'Include start_date/update_time for all events',
        examples: missingStart.slice(0, 5).map(e => ({
          eventId: e.id,
          location: e.location,
          missingFields: ['startDate']
        }))
      });
    }

    // Check for missing direction
    const missingDirection = events.filter(e => !e.direction);
    if (missingDirection.length > events.length * 0.2) {
      violations.push({
        category: 'Missing Travel Direction',
        severity: 'MEDIUM',
        count: missingDirection.length,
        specRequirement: feedType === 'WZDx' ?
          'WZDx v4.x recommends properties.direction for directional impacts' :
          'TMDD recommends event-lane.lane-roadway-direction',
        impact: 'Cannot determine which direction of travel is affected',
        recommendation: 'Add direction indicator (N/S/E/W or northbound/southbound)',
        examples: missingDirection.slice(0, 5).map(e => ({
          eventId: e.id,
          location: e.location,
          missingFields: ['direction']
        }))
      });
    }

    return {
      feedType: feedType,
      evaluationStandard: feedType === 'WZDx' ? 'WZDx v4.x Specification' : 'TMDD v3.1 / ngTMDD via C2C-MVT',
      summary: `Analyzed ${events.length} events and found ${violations.length} violation categories`,
      violationCategories: violations
    };
  }

  // Generate category-based scores
  generateCategoryScores(fieldStats) {
    const scores = {
      essential: {
        name: 'Essential Information',
        fields: [
          {
            field: 'Event ID',
            status: fieldStats.id.present > fieldStats.id.missing ? 'PASS' : 'FAIL',
            score: Math.round((fieldStats.id.present / (fieldStats.id.present + fieldStats.id.missing)) * 100),
            currentPoints: fieldStats.id.present * this.fieldWeights.id,
            maxPoints: (fieldStats.id.present + fieldStats.id.missing) * this.fieldWeights.id,
            impact: 'Unique identifier for event tracking'
          },
          {
            field: 'Coordinates',
            status: fieldStats.coordinates.present > fieldStats.coordinates.missing ? 'PASS' : 'FAIL',
            score: Math.round((fieldStats.coordinates.present / (fieldStats.coordinates.present + fieldStats.coordinates.missing)) * 100),
            currentPoints: fieldStats.coordinates.present * this.fieldWeights.coordinates,
            maxPoints: (fieldStats.coordinates.present + fieldStats.coordinates.missing) * this.fieldWeights.coordinates,
            impact: 'Geographic location for mapping'
          },
          {
            field: 'Start Date',
            status: fieldStats.startDate.present > fieldStats.startDate.missing ? 'PASS' : 'FAIL',
            score: Math.round((fieldStats.startDate.present / (fieldStats.startDate.present + fieldStats.startDate.missing)) * 100),
            currentPoints: fieldStats.startDate.present * this.fieldWeights.startDate,
            maxPoints: (fieldStats.startDate.present + fieldStats.startDate.missing) * this.fieldWeights.startDate,
            impact: 'When event began'
          }
        ],
        totalScore: fieldStats.id.present * this.fieldWeights.id +
                    fieldStats.coordinates.present * this.fieldWeights.coordinates +
                    fieldStats.startDate.present * this.fieldWeights.startDate,
        maxScore: (fieldStats.id.present + fieldStats.id.missing) * this.fieldWeights.id +
                  (fieldStats.coordinates.present + fieldStats.coordinates.missing) * this.fieldWeights.coordinates +
                  (fieldStats.startDate.present + fieldStats.startDate.missing) * this.fieldWeights.startDate,
        percentage: 0
      },
      details: {
        name: 'Event Details',
        fields: [
          {
            field: 'Type',
            status: fieldStats.type.present > fieldStats.type.missing ? 'PASS' : 'FAIL',
            score: Math.round((fieldStats.type.present / (fieldStats.type.present + fieldStats.type.missing)) * 100),
            currentPoints: fieldStats.type.present * this.fieldWeights.type,
            maxPoints: (fieldStats.type.present + fieldStats.type.missing) * this.fieldWeights.type,
            impact: 'Event classification'
          },
          {
            field: 'Severity',
            status: fieldStats.severity.present > fieldStats.severity.missing ? 'PASS' : 'FAIL',
            score: Math.round((fieldStats.severity.present / (fieldStats.severity.present + fieldStats.severity.missing)) * 100),
            currentPoints: fieldStats.severity.present * this.fieldWeights.severity,
            maxPoints: (fieldStats.severity.present + fieldStats.severity.missing) * this.fieldWeights.severity,
            impact: 'Impact assessment'
          },
          {
            field: 'Description',
            status: fieldStats.description.present > fieldStats.description.missing ? 'PASS' : 'FAIL',
            score: Math.round((fieldStats.description.present / (fieldStats.description.present + fieldStats.description.missing)) * 100),
            currentPoints: fieldStats.description.present * this.fieldWeights.description,
            maxPoints: (fieldStats.description.present + fieldStats.description.missing) * this.fieldWeights.description,
            impact: 'Human-readable details'
          }
        ],
        totalScore: fieldStats.type.present * this.fieldWeights.type +
                    fieldStats.severity.present * this.fieldWeights.severity +
                    fieldStats.description.present * this.fieldWeights.description,
        maxScore: (fieldStats.type.present + fieldStats.type.missing) * this.fieldWeights.type +
                  (fieldStats.severity.present + fieldStats.severity.missing) * this.fieldWeights.severity +
                  (fieldStats.description.present + fieldStats.description.missing) * this.fieldWeights.description,
        percentage: 0
      }
    };

    Object.values(scores).forEach(category => {
      category.percentage = category.maxScore === 0
        ? 0
        : Math.round((category.totalScore / category.maxScore) * 100);
    });

    return scores;
  }

  // Analyze C2C compliance
  analyzeC2CCompliance(events) {
    let score = 0;
    const recommendations = [];

    // Check critical C2C fields
    const hasIds = events.filter(e => e.id).length / events.length;
    const hasCoords = events.filter(e => e.coordinates && e.coordinates.length === 2).length / events.length;
    const hasTimestamps = events.filter(e => e.startDate).length / events.length;
    const hasLocation = events.filter(e => e.location).length / events.length;

    score += hasIds * 25;
    score += hasCoords * 25;
    score += hasTimestamps * 25;
    score += hasLocation * 25;

    if (hasIds < 0.9) {
      recommendations.push({
        field: 'Event ID',
        importance: 'CRITICAL',
        issue: `Only ${Math.round(hasIds * 100)}% of events have unique IDs`,
        solution: 'Add unique identifiers to all events for C2C tracking'
      });
    }

    if (hasCoords < 0.9) {
      recommendations.push({
        field: 'Geographic Coordinates',
        importance: 'CRITICAL',
        issue: `Only ${Math.round(hasCoords * 100)}% of events have coordinates`,
        solution: 'Include latitude/longitude for all events'
      });
    }

    const finalScore = Math.round(score);

    return {
      score: finalScore,
      grade: finalScore >= 80 ? 'PASS' : 'FAIL',
      message: finalScore >= 80 ?
        'Data meets C2C requirements for inter-agency communication' :
        `Score of ${finalScore}/100 - Improvements needed for C2C readiness`,
      validationTool: 'C2C-MVT Analysis',
      recommendations: recommendations
    };
  }

  // Analyze multi-standard compliance
  analyzeMultiStandardCompliance(wzdx, sae, tmdd, events) {
    const crossStandardRecommendations = [];

    // Find cross-standard improvement opportunities
    if (wzdx.percentage < 90 || sae.percentage < 90 || tmdd.percentage < 90) {
      const missingCoords = events.filter(e => !e.coordinates).length;
      if (missingCoords > 0) {
        crossStandardRecommendations.push({
          issue: 'Missing Coordinates',
          currentCoverage: `${Math.round((events.length - missingCoords) / events.length * 100)}%`,
          recommendation: 'Add latitude/longitude coordinates to all events',
          benefitsStandards: ['WZDx', 'SAE J2735', 'TMDD'],
          priority: 'CRITICAL',
          pointsGained: {
            wzdx: 15,
            sae: 20,
            tmdd: 15
          }
        });
      }
    }

    return {
      summary: {
        message: `Analyzed ${events.length} events across 3 industry standards`,
        eventsAnalyzed: events.length,
        evaluationDate: new Date().toISOString()
      },
      wzdx: wzdx,
      sae: sae,
      tmdd: tmdd,
      crossStandardRecommendations: crossStandardRecommendations,
      gradeRoadmap: {
        wzdx: {
          pointsNeeded: Math.max(0, 90 - wzdx.percentage),
          estimatedEffort: wzdx.percentage >= 80 ? 'Low (1-2 weeks)' : 'Medium (1-2 months)'
        },
        sae: {
          pointsNeeded: Math.max(0, 90 - sae.percentage),
          estimatedEffort: sae.percentage >= 80 ? 'Low (1-2 weeks)' : 'Medium (1-2 months)'
        },
        tmdd: {
          pointsNeeded: Math.max(0, 90 - tmdd.percentage),
          estimatedEffort: tmdd.percentage >= 80 ? 'Low (1-2 weeks)' : 'Medium (1-2 months)'
        }
      }
    };
  }

  // Generate actionable improvement plan
  generateActionPlan(fieldStats, events) {
    const immediate = [];
    const shortTerm = [];
    const longTerm = [];

    Object.entries(fieldStats).forEach(([field, stats]) => {
      const total = stats.present + stats.missing;
      const percentage = Math.round((stats.present / total) * 100);
      const weight = this.fieldWeights[field];

      if (percentage < 50 && weight >= 7) {
        immediate.push({
          field: field,
          currentScore: percentage,
          pointsGained: stats.missing * weight,
          impact: `Critical field missing in ${stats.missing} events`
        });
      } else if (percentage < 80 && weight >= 5) {
        shortTerm.push({
          field: field,
          currentScore: percentage,
          pointsGained: stats.missing * weight
        });
      } else if (percentage < 100) {
        longTerm.push({
          field: field,
          currentScore: percentage,
          pointsGained: stats.missing * weight
        });
      }
    });

    return {
      immediate: immediate.slice(0, 5),
      shortTerm: shortTerm.slice(0, 5),
      longTerm: longTerm.slice(0, 5)
    };
  }

  // Calculate improvement potential
  calculateImprovementPotential(actionPlan, overallScore) {
    const immediateGain = actionPlan.immediate.reduce((sum, item) => sum + item.pointsGained, 0);

    if (immediateGain > 0) {
      const potentialIncrease = Math.min(20, Math.round(immediateGain / 10));
      const newPercentage = Math.min(100, overallScore.percentage + potentialIncrease);

      return {
        immediateActions: actionPlan.immediate.length,
        potentialScoreIncrease: potentialIncrease,
        newGradeIfFixed: this.getLetterGrade(newPercentage),
        message: `Addressing ${actionPlan.immediate.length} critical issues could improve score by ${potentialIncrease} points`
      };
    }

    return {
      immediateActions: 0,
      potentialScoreIncrease: 0,
      newGradeIfFixed: overallScore.grade,
      message: 'No immediate critical issues found'
    };
  }

  // Detect current data format
  detectCurrentFormat(events) {
    const sample = events[0] || {};

    if (sample.source?.includes('WZDx')) {
      return 'WZDx v4.x (GeoJSON)';
    } else if (sample.source?.includes('TMDD')) {
      return 'TMDD/ngTMDD (XML/JSON)';
    } else {
      return 'Custom/Proprietary (JSON)';
    }
  }

  // Get letter grade from percentage
  getLetterGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  // Get empty analysis for states with no events
  getEmptyStateAnalysis(stateKey, stateName) {
    return {
      state: stateName,
      stateKey: stateKey,
      generatedAt: new Date().toISOString(),
      eventCount: 0,
      currentFormat: { apiType: 'Unknown', format: 'N/A' },
      dataCompletenessScore: 0,
      overallScore: {
        percentage: 0,
        grade: 'N/A',
        rank: 'No Data',
        message: 'No events available for analysis'
      }
    };
  }
}

module.exports = ComplianceAnalyzer;
module.exports.STANDARD_REQUIREMENTS = STANDARD_REQUIREMENTS;

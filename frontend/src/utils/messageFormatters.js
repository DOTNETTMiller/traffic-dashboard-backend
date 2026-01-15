/**
 * Message Format Converters
 *
 * Converts raw event data into standardized message formats:
 * - SAE J2735 TIM (Traveler Information Message)
 * - CIFS (Common Incident Feed Specification)
 */

/**
 * Convert event to SAE J2735 TIM format
 */
export function formatAsTIM(event) {
  const timCode = getTIMCode(event);
  const severity = normalizeSeverity(event);
  const timeInfo = getTimeInfo(event);

  return {
    messageType: 'TIM',
    standard: 'SAE J2735',
    icon: '📡',
    color: '#3b82f6',
    data: {
      msgID: `TIM-${event.id}`,
      msgType: timCode.type,
      msgCode: timCode.code,
      priority: severity.priority,
      severity: severity.level,
      route: {
        roadName: event.corridor || 'Unknown Route',
        direction: event.direction || 'Both Directions'
      },
      location: {
        description: event.location,
        latitude: event.latitude,
        longitude: event.longitude,
        mileMarker: event.startMileMarker || null
      },
      content: {
        headline: `${event.eventType} on ${event.corridor || 'route'}`,
        description: event.description,
        lanesAffected: event.lanesAffected || 'Unknown'
      },
      timing: timeInfo,
      validity: {
        startTime: event.startTime || null,
        endTime: event.endTime || null,
        ongoing: !event.endTime
      }
    },
    formatted: formatTIMMessage(event, timCode, severity, timeInfo)
  };
}

/**
 * Convert event to CIFS format
 */
export function formatAsCIFS(event) {
  const cifsType = getCIFSType(event);
  const severity = normalizeSeverity(event);

  return {
    messageType: 'CIFS',
    standard: 'Common Incident Feed Specification',
    icon: '🚨',
    color: '#10b981',
    data: {
      id: `CIFS-${event.id}`,
      type: cifsType.type,
      subtype: cifsType.subtype,
      severity: severity.cifsLevel,
      verified: event.verified || false,
      status: getIncidentStatus(event),
      location: {
        street: event.corridor,
        crossStreet: null,
        city: null,
        state: event.state,
        latitude: parseFloat(event.latitude),
        longitude: parseFloat(event.longitude)
      },
      description: event.description,
      lanesAffected: parseLanesAffected(event.lanesAffected),
      direction: event.direction,
      reportedAt: event.startTime || new Date().toISOString(),
      updatedAt: event.lastUpdated || null,
      source: event.source || 'DOT Feed'
    },
    formatted: formatCIFSMessage(event, cifsType, severity)
  };
}

/**
 * Determine TIM message code based on event type
 */
function getTIMCode(event) {
  const type = (event.eventType || '').toLowerCase();
  const desc = (event.description || '').toLowerCase();

  // Road Work / Construction
  if (type.includes('construction') || desc.includes('construction')) {
    return { type: 'Road Work', code: 'TIM-01', itis: 769 };
  }

  // Road Closure
  if (type.includes('closure') || desc.includes('closed')) {
    return { type: 'Road Closure', code: 'TIM-02', itis: 1025 };
  }

  // Lane Closure
  if (desc.includes('lane') && (desc.includes('closed') || desc.includes('blocked'))) {
    return { type: 'Lane Closure', code: 'TIM-03', itis: 1281 };
  }

  // Incident
  if (type.includes('incident') || type.includes('accident') || desc.includes('crash')) {
    return { type: 'Incident', code: 'TIM-04', itis: 1537 };
  }

  // Weather
  if (type.includes('weather') || desc.includes('snow') || desc.includes('ice')) {
    return { type: 'Weather Alert', code: 'TIM-05', itis: 1793 };
  }

  // Traffic Delay
  if (desc.includes('delay') || desc.includes('congestion')) {
    return { type: 'Traffic Delay', code: 'TIM-06', itis: 2049 };
  }

  // General Advisory (default)
  return { type: 'General Advisory', code: 'TIM-00', itis: 513 };
}

/**
 * Determine CIFS incident type
 */
function getCIFSType(event) {
  const type = (event.eventType || '').toLowerCase();
  const desc = (event.description || '').toLowerCase();

  // Incident types
  if (type.includes('incident') || type.includes('accident') || desc.includes('crash')) {
    if (desc.includes('vehicle') && desc.includes('disabled')) {
      return { type: 'INCIDENT', subtype: 'DISABLED_VEHICLE' };
    }
    return { type: 'INCIDENT', subtype: 'ACCIDENT' };
  }

  // Construction
  if (type.includes('construction')) {
    return { type: 'CONSTRUCTION', subtype: 'ROAD_WORK' };
  }

  // Closure
  if (type.includes('closure')) {
    return { type: 'CLOSURE', subtype: 'ROAD_CLOSED' };
  }

  // Weather
  if (type.includes('weather')) {
    return { type: 'WEATHER', subtype: 'HAZARDOUS_CONDITIONS' };
  }

  // Event (default)
  return { type: 'EVENT', subtype: 'OTHER' };
}

/**
 * Normalize severity across formats
 */
function normalizeSeverity(event) {
  const severity = (event.severity || event.severityLevel || 'medium').toLowerCase();

  if (severity.includes('high') || severity.includes('major')) {
    return {
      level: 'High',
      priority: 1,
      cifsLevel: 'MAJOR',
      color: '#ef4444'
    };
  } else if (severity.includes('medium') || severity.includes('moderate')) {
    return {
      level: 'Medium',
      priority: 2,
      cifsLevel: 'MODERATE',
      color: '#f59e0b'
    };
  } else {
    return {
      level: 'Low',
      priority: 3,
      cifsLevel: 'MINOR',
      color: '#10b981'
    };
  }
}

/**
 * Get time-related information
 */
function getTimeInfo(event) {
  const now = new Date();
  const startTime = event.startTime ? new Date(event.startTime) : null;
  const endTime = event.endTime ? new Date(event.endTime) : null;

  return {
    startTime: startTime ? startTime.toISOString() : now.toISOString(),
    endTime: endTime ? endTime.toISOString() : null,
    duration: endTime && startTime ?
      Math.round((endTime - startTime) / (1000 * 60 * 60)) + ' hours' :
      'Unknown',
    isActive: !endTime || endTime > now
  };
}

/**
 * Get incident status
 */
function getIncidentStatus(event) {
  if (event.endTime && new Date(event.endTime) < new Date()) {
    return 'CLOSED';
  }
  if (event.status) {
    return event.status.toUpperCase();
  }
  return 'ACTIVE';
}

/**
 * Parse lanes affected into structured format
 */
function parseLanesAffected(lanesText) {
  if (!lanesText) return { total: null, blocked: null };

  const match = lanesText.match(/(\d+).*?(\d+)/);
  if (match) {
    return {
      total: parseInt(match[2]),
      blocked: parseInt(match[1])
    };
  }

  return {
    total: null,
    blocked: null,
    description: lanesText
  };
}

/**
 * Format TIM message as human-readable text
 */
function formatTIMMessage(event, timCode, severity, timeInfo) {
  const lines = [];

  lines.push(`TIM ${timCode.code}: ${timCode.type.toUpperCase()}`);
  lines.push(`Priority: ${severity.priority} (${severity.level})`);
  lines.push(`ITIS Code: ${timCode.itis}`);
  lines.push('');
  lines.push(`Route: ${event.corridor || 'Unknown'} ${event.direction || ''}`);
  lines.push(`Location: ${event.location}`);
  lines.push('');
  lines.push(`Message: ${event.description}`);
  lines.push(`Lanes: ${event.lanesAffected || 'Unknown'}`);
  lines.push('');

  if (timeInfo.startTime) {
    lines.push(`Valid From: ${new Date(timeInfo.startTime).toLocaleString()}`);
  }
  if (timeInfo.endTime) {
    lines.push(`Valid Until: ${new Date(timeInfo.endTime).toLocaleString()}`);
  } else {
    lines.push('Duration: Ongoing');
  }

  return lines.join('\n');
}

/**
 * Format CIFS message as human-readable text
 */
function formatCIFSMessage(event, cifsType, severity) {
  const lines = [];

  lines.push(`INCIDENT ${cifsType.type} - ${cifsType.subtype}`);
  lines.push(`Severity: ${severity.cifsLevel}`);
  lines.push(`Status: ${getIncidentStatus(event)}`);
  lines.push('');
  lines.push(`Location: ${event.corridor || 'Unknown Route'}`);
  lines.push(`State: ${event.state}`);
  lines.push(`Direction: ${event.direction || 'Unknown'}`);
  lines.push('');
  lines.push(`Description: ${event.description}`);

  const lanes = parseLanesAffected(event.lanesAffected);
  if (lanes.blocked && lanes.total) {
    lines.push(`Lanes Blocked: ${lanes.blocked} of ${lanes.total}`);
  } else if (lanes.description) {
    lines.push(`Lanes: ${lanes.description}`);
  }

  lines.push('');
  lines.push(`Reported: ${event.startTime ? new Date(event.startTime).toLocaleString() : 'Unknown'}`);
  lines.push(`Source: ${event.source || 'State DOT Feed'}`);

  return lines.join('\n');
}

/**
 * Determine if event is suitable for CV-TIM
 */
export function isCommercialVehicleRelevant(event) {
  const desc = (event.description || '').toLowerCase();

  return desc.includes('truck') ||
         desc.includes('commercial vehicle') ||
         desc.includes('weight') ||
         desc.includes('bridge') ||
         desc.includes('clearance') ||
         desc.includes('hazmat') ||
         desc.includes('oversize');
}

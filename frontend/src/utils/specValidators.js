/**
 * Per-spec validators for normalized event records.
 *
 * For each supported spec, defines:
 *   - the set of required fields (and what "present + valid" means for each)
 *   - the set of recommended fields (penalized if missing, but not required)
 *   - a small library of value validators (enum membership, ISO-8601 parsing,
 *     coordinate range, geometry shape) that the field rules compose from
 *
 * `validateAgainstSpec(event, spec)` returns:
 *   {
 *     spec,
 *     fields:  [ { name, label, present, value, status, message? } ],
 *     missing: [ { name, label, requirement, hint? } ],
 *     summary: { pass, warn, fail, missing }
 *   }
 *
 * Status legend per field:
 *   'pass'  — present + value passes spec rules
 *   'warn'  — present, but value is recommended-tier or out of preferred enum
 *   'fail'  — present but invalid (wrong type, out of range, unparsable)
 *   'na'    — field not required by this spec; shown for context only
 *
 * These validators are deliberately conservative: they encode the rules that
 * matter for operator-actionable feed validation, not full conformance to the
 * 1000+ pages of each spec. An operator viewing this table should be able to
 * spot the fix in seconds — that is the whole point.
 */

const DIRECTION_ENUM = new Set([
  'northbound', 'southbound', 'eastbound', 'westbound',
  'both', 'unknown', 'inner-loop', 'outer-loop'
]);

const SEVERITY_ENUM = new Set(['minor', 'moderate', 'major', 'medium', 'high', 'low']);

// WZDx v4.x event-type values that map to typed:work-zone / detour / restriction.
const WZDX_EVENT_TYPES = new Set([
  'work-zone', 'workzone', 'work zone',
  'detour', 'restriction', 'incident', 'construction', 'closure'
]);

function isFiniteNum(v) {
  if (v === null || v === undefined || v === '') return false;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n);
}

function isPresent(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function isParsableDate(v) {
  if (!isPresent(v)) return false;
  const ms = Date.parse(v);
  return !Number.isNaN(ms);
}

function isInLatRange(v) {
  return isFiniteNum(v) && parseFloat(v) >= -90 && parseFloat(v) <= 90;
}

function isInLngRange(v) {
  return isFiniteNum(v) && parseFloat(v) >= -180 && parseFloat(v) <= 180;
}

function inEnum(v, enumSet) {
  return isPresent(v) && enumSet.has(String(v).toLowerCase().trim());
}

function isLineString(geom) {
  return !!geom &&
    (geom.type === 'LineString' || geom.type === 'MultiLineString') &&
    Array.isArray(geom.coordinates) && geom.coordinates.length > 0;
}

function descLongEnough(v, min = 10) {
  return isPresent(v) && String(v).trim().length >= min;
}

/**
 * Field rule: { name, label, requirement: 'required'|'recommended'|'optional',
 *               check: (event) => 'pass'|'warn'|'fail',
 *               message?: (event, status) => string,
 *               valueOf?: (event) => any  // for display when raw field key differs }
 *
 * Default message is supplied when the rule omits one.
 */

const RULE_DEFS = {
  id: {
    name: 'id', label: 'Event ID', requirement: 'required',
    check: (e) => isPresent(e.id) ? 'pass' : 'fail',
    message: (_e, s) => s === 'fail' ? 'Required: every event must carry a stable unique ID.' : ''
  },
  eventType: {
    name: 'eventType', label: 'Event Type', requirement: 'required',
    check: (e) => isPresent(e.eventType) ? 'pass' : 'fail',
    message: (_e, s) => s === 'fail' ? 'Required: feed must classify the event.' : ''
  },
  eventTypeWZDx: {
    name: 'eventType', label: 'Event Type', requirement: 'required',
    check: (e) => {
      if (!isPresent(e.eventType)) return 'fail';
      return WZDX_EVENT_TYPES.has(String(e.eventType).toLowerCase().trim()) ? 'pass' : 'warn';
    },
    message: (e, s) => {
      if (s === 'fail') return 'Required.';
      if (s === 'warn') return `Value "${e.eventType}" not in WZDx core types (work-zone, detour, restriction).`;
      return '';
    }
  },
  description: {
    name: 'description', label: 'Description', requirement: 'recommended',
    check: (e) => {
      if (!isPresent(e.description)) return 'warn';
      return descLongEnough(e.description, 10) ? 'pass' : 'warn';
    },
    message: (_e, s) => s === 'warn' ? 'Recommended: at least 10 chars; operators need narrative for triage.' : ''
  },
  descriptionRequired: {
    name: 'description', label: 'Description', requirement: 'required',
    check: (e) => {
      if (!isPresent(e.description)) return 'fail';
      return descLongEnough(e.description, 10) ? 'pass' : 'warn';
    },
    message: (_e, s) => {
      if (s === 'fail') return 'Required: spec mandates a textual description.';
      if (s === 'warn') return 'Description is too short (<10 chars) for actionability.';
      return '';
    }
  },
  startTime: {
    name: 'startTime', label: 'Start Time', requirement: 'required',
    check: (e) => {
      if (!isPresent(e.startTime || e.startDate)) return 'fail';
      return isParsableDate(e.startTime || e.startDate) ? 'pass' : 'fail';
    },
    valueOf: (e) => e.startTime || e.startDate,
    message: (_e, s) => s === 'fail' ? 'Required: ISO-8601 timestamp.' : ''
  },
  endTime: {
    name: 'endTime', label: 'End Time', requirement: 'required',
    check: (e) => {
      if (!isPresent(e.endTime || e.endDate)) return 'fail';
      return isParsableDate(e.endTime || e.endDate) ? 'pass' : 'fail';
    },
    valueOf: (e) => e.endTime || e.endDate,
    message: (_e, s) => s === 'fail' ? 'Required: ISO-8601 timestamp; open-ended events confuse downstream consumers.' : ''
  },
  endTimeRecommended: {
    name: 'endTime', label: 'End Time', requirement: 'recommended',
    check: (e) => {
      if (!isPresent(e.endTime || e.endDate)) return 'warn';
      return isParsableDate(e.endTime || e.endDate) ? 'pass' : 'fail';
    },
    valueOf: (e) => e.endTime || e.endDate,
    message: (_e, s) => {
      if (s === 'warn') return 'Recommended: explicit end timestamp; without it, freshness logic must guess.';
      if (s === 'fail') return 'Value is not parsable as an ISO-8601 timestamp.';
      return '';
    }
  },
  latitude: {
    name: 'latitude', label: 'Latitude', requirement: 'required',
    check: (e) => {
      if (!isFiniteNum(e.latitude)) return 'fail';
      return isInLatRange(e.latitude) ? 'pass' : 'fail';
    },
    message: (e, s) => {
      if (s === 'fail' && !isFiniteNum(e.latitude)) return 'Required: numeric latitude.';
      if (s === 'fail') return 'Latitude must be between −90 and 90.';
      return '';
    }
  },
  longitude: {
    name: 'longitude', label: 'Longitude', requirement: 'required',
    check: (e) => {
      if (!isFiniteNum(e.longitude)) return 'fail';
      return isInLngRange(e.longitude) ? 'pass' : 'fail';
    },
    message: (e, s) => {
      if (s === 'fail' && !isFiniteNum(e.longitude)) return 'Required: numeric longitude.';
      if (s === 'fail') return 'Longitude must be between −180 and 180.';
      return '';
    }
  },
  geometryLine: {
    name: 'geometry', label: 'Geometry (LineString)', requirement: 'required',
    check: (e) => isLineString(e.geometry) ? 'pass' : 'fail',
    valueOf: (e) => e.geometry ? `${e.geometry.type} (${(e.geometry.coordinates || []).length} pts)` : null,
    message: (_e, s) => s === 'fail' ? 'Required: spec demands a LineString path along the affected segment, not a point.' : ''
  },
  geometryRecommended: {
    name: 'geometry', label: 'Geometry (LineString)', requirement: 'recommended',
    check: (e) => isLineString(e.geometry) ? 'pass' : 'warn',
    valueOf: (e) => e.geometry ? `${e.geometry.type} (${(e.geometry.coordinates || []).length} pts)` : null,
    message: (_e, s) => s === 'warn' ? 'Recommended: a LineString path improves map rendering and routing.' : ''
  },
  direction: {
    name: 'direction', label: 'Direction', requirement: 'required',
    check: (e) => {
      if (!isPresent(e.direction)) return 'fail';
      return inEnum(e.direction, DIRECTION_ENUM) ? 'pass' : 'warn';
    },
    message: (e, s) => {
      if (s === 'fail') return 'Required: cardinal direction or "both"/"unknown".';
      if (s === 'warn') return `Value "${e.direction}" not in standard direction enum.`;
      return '';
    }
  },
  directionRecommended: {
    name: 'direction', label: 'Direction', requirement: 'recommended',
    check: (e) => {
      if (!isPresent(e.direction)) return 'warn';
      return inEnum(e.direction, DIRECTION_ENUM) ? 'pass' : 'warn';
    },
    message: (e, s) => {
      if (s === 'warn' && !isPresent(e.direction)) return 'Recommended: cardinal direction or "both"/"unknown".';
      if (s === 'warn') return `Value "${e.direction}" not in standard direction enum.`;
      return '';
    }
  },
  state: {
    name: 'state', label: 'State', requirement: 'required',
    check: (e) => isPresent(e.state) ? 'pass' : 'fail',
    message: (_e, s) => s === 'fail' ? 'Required: state/jurisdiction.' : ''
  },
  severity: {
    name: 'severity', label: 'Severity', requirement: 'required',
    check: (e) => {
      if (!isPresent(e.severity)) return 'fail';
      return inEnum(e.severity, SEVERITY_ENUM) ? 'pass' : 'warn';
    },
    message: (e, s) => {
      if (s === 'fail') return 'Required: minor / moderate / major.';
      if (s === 'warn') return `Value "${e.severity}" not in standard severity enum.`;
      return '';
    }
  },
  severityRecommended: {
    name: 'severity', label: 'Severity', requirement: 'recommended',
    check: (e) => {
      if (!isPresent(e.severity)) return 'warn';
      return inEnum(e.severity, SEVERITY_ENUM) ? 'pass' : 'warn';
    },
    message: (e, s) => {
      if (s === 'warn' && !isPresent(e.severity)) return 'Recommended: minor / moderate / major.';
      if (s === 'warn') return `Value "${e.severity}" not in standard severity enum.`;
      return '';
    }
  },
  lanesAffected: {
    name: 'lanesAffected', label: 'Lanes Affected', requirement: 'required',
    check: (e) => isPresent(e.lanesAffected) ? 'pass' : 'fail',
    message: (_e, s) => s === 'fail' ? 'Required: which lanes are affected (or "all-lanes-closed").' : ''
  },
  lanesRecommended: {
    name: 'lanesAffected', label: 'Lanes Affected', requirement: 'recommended',
    check: (e) => isPresent(e.lanesAffected) ? 'pass' : 'warn',
    message: (_e, s) => s === 'warn' ? 'Recommended: lane impact informs CV/AV routing decisions.' : ''
  },
  corridor: {
    name: 'corridor', label: 'Corridor / Roadway', requirement: 'recommended',
    check: (e) => isPresent(e.corridor || e.location) ? 'pass' : 'warn',
    valueOf: (e) => e.corridor || e.location,
    message: (_e, s) => s === 'warn' ? 'Recommended: roadway designation (e.g., "I-94").' : ''
  }
};

/**
 * Build a field set for a spec by listing rule keys (in display order).
 * Recommended fields include 'description' and 'corridor' on most specs to
 * surface common feed gaps even when the spec itself doesn't require them.
 */
const SPECS = {
  wzdx: {
    label: 'WZDx v4.2',
    docUrl: 'https://github.com/usdot-jpo-ode/wzdx',
    rules: [
      'id', 'eventTypeWZDx', 'description', 'startTime', 'endTime',
      'latitude', 'longitude', 'geometryRecommended',
      'direction', 'state', 'lanesAffected', 'severityRecommended', 'corridor'
    ]
  },
  tmdd: {
    label: 'TMDD',
    docUrl: 'https://www.ite.org/technical-resources/standards/tmdd/',
    rules: [
      'id', 'eventType', 'descriptionRequired', 'startTime', 'endTimeRecommended',
      'latitude', 'longitude',
      'severity', 'directionRecommended', 'state', 'corridor', 'lanesRecommended'
    ]
  },
  sae: {
    label: 'SAE J2735 TIM',
    docUrl: 'https://www.sae.org/standards/content/j2735_202309/',
    rules: [
      'eventType', 'startTime', 'endTimeRecommended',
      'latitude', 'longitude', 'geometryLine',
      'severityRecommended', 'descriptionRequired',
      'directionRecommended', 'lanesRecommended'
    ]
  },
  cifs: {
    label: 'CIFS',
    docUrl: 'https://github.com/i95coalition/CIFS',
    rules: [
      'id', 'eventType', 'descriptionRequired', 'startTime', 'endTime',
      'latitude', 'longitude',
      'severity', 'direction', 'state', 'corridor', 'lanesRecommended'
    ]
  },
  cwz: {
    label: 'Connected Work Zone',
    docUrl: 'https://www.transportation.gov/av/data',
    rules: [
      'id', 'eventTypeWZDx', 'startTime', 'endTime',
      'latitude', 'longitude', 'geometryLine',
      'direction', 'lanesAffected', 'state',
      'description', 'severityRecommended'
    ]
  }
};

const SPEC_ORDER = ['wzdx', 'tmdd', 'sae', 'cifs', 'cwz'];

function validateAgainstSpec(event, specKey) {
  const spec = SPECS[specKey];
  if (!spec) return null;

  const fields = [];
  const missing = [];
  let pass = 0, warn = 0, fail = 0, missingCount = 0;

  for (const ruleKey of spec.rules) {
    const rule = RULE_DEFS[ruleKey];
    if (!rule) continue;

    const value = rule.valueOf ? rule.valueOf(event) : event[rule.name];
    const present = isPresent(value);
    const status = rule.check(event);
    const message = rule.message ? rule.message(event, status) : '';

    fields.push({
      name: rule.name,
      label: rule.label,
      requirement: rule.requirement,
      present,
      value,
      status,
      message
    });

    if (status === 'pass') pass++;
    else if (status === 'warn') warn++;
    else if (status === 'fail') fail++;

    // Required + absent → also surface in dedicated "missing" section.
    if (rule.requirement === 'required' && !present) {
      missing.push({
        name: rule.name,
        label: rule.label,
        requirement: rule.requirement,
        hint: rule.message ? rule.message(event, 'fail') : ''
      });
      missingCount++;
    }
  }

  return {
    spec: specKey,
    specLabel: spec.label,
    docUrl: spec.docUrl,
    fields,
    missing,
    summary: { pass, warn, fail, missing: missingCount }
  };
}

function listSpecs() {
  return SPEC_ORDER.map(k => ({ key: k, label: SPECS[k].label }));
}

export { validateAgainstSpec, listSpecs, SPEC_ORDER };

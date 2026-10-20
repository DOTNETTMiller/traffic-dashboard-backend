(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FeedCheck = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '0.1.0';
  const MAX_BYTES = 20 * 1024 * 1024;
  const MAX_RECORDS = 25000;
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const present = v => v !== undefined && v !== null && v !== '';
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const first = (...values) => values.find(present);
  const idValue = v => (typeof v === 'string' && v.trim() !== '') || (typeof v === 'number' && Number.isFinite(v));
  // Require a timezone: Date.parse alone accepts ambiguous local dates and normalizes Feb 30.
  function timestamp(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)) return NaN;
    const [y, m, d, h, min, sec] = v.slice(0, 19).split(/\D/).map(Number);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const zone = v.match(/([+-])(\d{2}):(\d{2})$/);
    if (m < 1 || m > 12 || d < 1 || d > days || h > 23 || min > 59 || sec > 59 || (zone && (+zone[2] > 23 || +zone[3] > 59))) return NaN;
    return Date.parse(v);
  }
  function geometryError(g) {
    if (!object(g)) return 'Supply a GeoJSON geometry object.';
    const position = p => Array.isArray(p) && p.length >= 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
    const line = a => Array.isArray(a) && a.length >= 2 && a.every(position);
    const ring = a => Array.isArray(a) && a.length >= 4 && a.every(position) && JSON.stringify(a[0]) === JSON.stringify(a[a.length - 1]);
    const polygon = a => Array.isArray(a) && a.length > 0 && a.every(ring);
    const many = (a, check) => Array.isArray(a) && a.length > 0 && a.every(check);
    const c = g.coordinates;
    const valid = {
      Point: () => position(c), MultiPoint: () => many(c, position),
      LineString: () => line(c), MultiLineString: () => many(c, line),
      Polygon: () => polygon(c), MultiPolygon: () => many(c, polygon),
      GeometryCollection: () => many(g.geometries, child => !geometryError(child))
    };
    return !Object.hasOwn(valid, g.type) ? 'Use a supported GeoJSON geometry type.' : valid[g.type]() ? null : 'Check coordinate nesting, numeric longitude/latitude ranges, minimum positions, and closed polygon rings.';
  }
  function sourceLabel(value) {
    try {
      const u = new URL(value);
      if (['http:', 'https:'].includes(u.protocol)) return u.origin + u.pathname;
    } catch (_) { /* file labels are allowed */ }
    return String(value || 'Untitled feed').slice(0, 240);
  }
  function parse(raw) {
    if (typeof raw !== 'string') throw new Error('Provide JSON text.');
    if (new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error('This edition supports files up to 20 MB.');
    try { return JSON.parse(raw.replace(/^\uFEFF/, '')); }
    catch (_) { throw new Error('This is not valid JSON. Check for trailing commas, an HTML error page, or an incomplete download.'); }
  }
  function hash(value) {
    // Stable field order avoids false changes caused only by JSON key ordering.
    function stable(v) {
      if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
      if (object(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
      return JSON.stringify(v);
    }
    const s = stable(value);
    let a = 2166136261;
    for (let i = 0; i < s.length; i++) a = Math.imul(a ^ s.charCodeAt(i), 16777619);
    return (a >>> 0).toString(16).padStart(8, '0');
  }
  function analyze(data, options = {}) {
    const now = options.now === undefined ? Date.now() : new Date(options.now).getTime();
    if (!Number.isFinite(now)) throw new Error('Invalid assessment time.');
    const settings = {
      feedMinutes: Number(options.feedMinutes ?? 60),
      eventHours: Number(options.eventHours ?? 24),
      expiredHours: Number(options.expiredHours ?? 1)
    };
    if (Object.values(settings).some(n => !Number.isFinite(n) || n <= 0 || n > 87600)) throw new Error('Thresholds must be positive numbers, at most 87,600.');
    let records, base, format;
    const infoKey = object(data) && object(data.feed_info) ? 'feed_info' : 'road_event_feed_info';
    const info = object(data) && object(data[infoKey]) ? data[infoKey] : {};
    if (object(data) && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      records = data.features; base = '$.features';
      format = Object.keys(info).length || records.some(r => object(r?.properties?.core_details)) ? 'WZDx-style GeoJSON' : 'GeoJSON';
    } else if (Array.isArray(data)) { records = data; base = '$'; format = 'Event JSON'; }
    else if (object(data) && Array.isArray(data.events)) { records = data.events; base = '$.events'; format = 'Event JSON'; }
    else throw new Error('Unsupported feed. Use a GeoJSON FeatureCollection, an array of event objects, or an object with an events array. XML and device feeds are outside this edition.');
    if (records.length > MAX_RECORDS) throw new Error('This edition supports up to 25,000 records per assessment.');
    const geojson = format !== 'Event JSON';
    const wzdx = format === 'WZDx-style GeoJSON';
    if (wzdx && records.some(r => present(r?.properties?.core_details?.device_type))) throw new Error('This appears to be a device feed. FeedCheck currently assesses road-event feeds.');
    const issues = [];
    const add = (severity, code, index, path, message, action, recordId = '') => issues.push({ severity, code, index, recordId: String(recordId), path, message, action });
    const feedIssue = (severity, code, path, message, action) => add(severity, code, null, path, message, action);
    if (!records.length) feedIssue('warning', 'EMPTY_FEED', base, 'The feed contains no records.', 'Confirm this is expected against the source system. An empty feed cannot establish event quality.');
    const feedDate = first(info.update_date, object(data) ? data.updated : undefined);
    if (!present(feedDate)) feedIssue('warning', 'FEED_TIME_MISSING', wzdx ? '$.' + infoKey + '.update_date' : '$.updated', 'Feed publication time is unavailable.', 'Publish an RFC 3339 update timestamp so consumers can assess feed freshness.');
    else {
      const t = timestamp(feedDate);
      if (!Number.isFinite(t)) feedIssue('error', 'FEED_TIME_INVALID', '$.' + (wzdx ? infoKey + '.update_date' : 'updated'), 'Feed publication timestamp is invalid or lacks a timezone.', 'Use a full timestamp such as 2026-10-17T15:00:00Z.');
      else if (t > now + 300000) feedIssue('warning', 'FEED_TIME_FUTURE', '$.' + (wzdx ? infoKey + '.update_date' : 'updated'), 'Feed publication time is more than five minutes in the future.', 'Verify the source clock and timezone.');
      else if (now - t > settings.feedMinutes * 60000) feedIssue('warning', 'FEED_STALE', '$.' + (wzdx ? infoKey + '.update_date' : 'updated'), 'Feed publication exceeds the ' + settings.feedMinutes + '-minute freshness threshold.', 'Check the publisher and compare with its documented refresh interval.');
    }
    const normalized = records.map((record, index) => {
      const r = object(record) ? record : {};
      const p = geojson ? (object(r.properties) ? r.properties : {}) : r;
      const core = object(p.core_details) ? p.core_details : p;
      return {
        index, raw: record, id: first(r.id, p.id, p.eventId),
        road: first(core.road_names, p.road, p.roadName, p.corridor),
        start: first(p.start_date, p.startDate, p.startTime, core.start_date),
        end: first(p.end_date, p.endDate, p.endTime, core.end_date),
        updated: first(core.update_date, p.updated, p.update_date, p.lastUpdated),
        geometry: geojson || present(p.geometry) ? r.geometry || p.geometry : (present(p.longitude) && present(p.latitude) ? { type: 'Point', coordinates: [p.longitude, p.latitude] } : null),
        type: first(core.event_type, p.eventType, p.type),
        fields: {
          start: present(p.start_date) ? 'start_date' : present(p.startDate) ? 'startDate' : present(p.startTime) ? 'startTime' : 'core_details.start_date',
          end: present(p.end_date) ? 'end_date' : present(p.endDate) ? 'endDate' : present(p.endTime) ? 'endTime' : 'core_details.end_date',
          updated: core !== p && present(core.update_date) ? 'core_details.update_date' : present(p.updated) ? 'updated' : present(p.update_date) ? 'update_date' : 'lastUpdated',
          road: present(core.road_names) ? (core !== p ? 'core_details.road_names' : 'road_names') : present(p.road) ? 'road' : present(p.roadName) ? 'roadName' : present(p.corridor) ? 'corridor' : (wzdx ? 'core_details.road_names' : 'road'),
          type: present(core.event_type) ? (core !== p ? 'core_details.event_type' : 'event_type') : present(p.eventType) ? 'eventType' : present(p.type) ? 'type' : (wzdx ? 'core_details.event_type' : 'eventType')
        }
      };
    });
    const ids = new Map();
    for (const r of normalized) if (idValue(r.id)) ids.set(String(r.id), (ids.get(String(r.id)) || 0) + 1);
    for (const r of normalized) {
      const path = base + '[' + r.index + ']';
      const pp = path + (geojson ? '.properties.' : '.');
      const issue = (severity, code, field, message, action) => add(severity, code, r.index, field.startsWith('$') ? field : pp + field, message, action, idValue(r.id) ? r.id : '(missing ID)');
      if (!object(r.raw)) { issue('error', 'RECORD_INVALID', path, 'Record is not an object.', 'Remove or replace this malformed record at the source.'); continue; }
      const rawProperties = geojson && object(r.raw.properties) ? r.raw.properties : r.raw;
      const idPath = present(r.raw.id) ? path + '.id' : (geojson && present(rawProperties.id)) ? pp + 'id' : present(rawProperties.eventId) ? pp + 'eventId' : path + '.id';
      if (geojson && r.raw.type !== 'Feature') issue('error', 'FEATURE_TYPE', path + '.type', 'Record is not a GeoJSON Feature.', 'Set type to Feature and verify its properties and geometry.');
      if (geojson && !object(r.raw.properties)) issue('error', 'PROPERTIES_INVALID', path + '.properties', 'Feature properties are missing or invalid.', 'Supply an object containing the event attributes.');
      if (!idValue(r.id)) issue('error', 'ID_MISSING', idPath, 'A stable event identifier is missing or invalid.', 'Assign a non-empty string or finite numeric ID that remains stable across updates.');
      else if (ids.get(String(r.id)) > 1) issue('error', 'ID_DUPLICATE', idPath, 'ID occurs ' + ids.get(String(r.id)) + ' times in this feed.', 'Assign unique IDs; check for duplicated source imports.');
      if (!(text(r.road) || (Array.isArray(r.road) && r.road.length > 0 && r.road.every(text)))) issue('warning', 'ROAD_MISSING', r.fields.road, 'A usable road name is missing.', 'Provide the affected road name or a non-empty array of road names.');
      if (!text(r.type)) issue('warning', 'EVENT_TYPE_MISSING', r.fields.type, 'Event classification is missing.', 'Publish a meaningful event type in the source feed.');
      if (!present(r.start)) issue('warning', 'START_MISSING', wzdx ? 'start_date' : 'startDate', 'Event start time is missing.', 'Publish the actual or planned start as a full timestamp with timezone.');
      const times = {};
      for (const field of ['start', 'end', 'updated']) {
        if (!present(r[field])) continue;
        times[field] = timestamp(r[field]);
        if (!Number.isFinite(times[field])) issue('error', 'TIME_INVALID', r.fields[field], field + ' timestamp is invalid or lacks a timezone.', 'Use an RFC 3339 timestamp with a valid calendar date and timezone.');
      }
      if (!present(r.updated)) issue('warning', 'UPDATE_MISSING', wzdx ? 'core_details.update_date' : 'updated', 'Event confirmation/update time is unavailable.', 'Publish when the source last updated or confirmed this event. Start time is not update time.');
      if (Number.isFinite(times.updated) && times.updated > now + 300000) issue('warning', 'UPDATE_FUTURE', r.fields.updated, 'Event update is more than five minutes in the future.', 'Verify source clocks and timezone conversion.');
      else if (Number.isFinite(times.updated) && now - times.updated > settings.eventHours * 3600000) issue('warning', 'EVENT_STALE', r.fields.updated, 'Event has not been confirmed within ' + settings.eventHours + ' hours.', 'Check whether the event is still current. Long-running events can be valid; this threshold is an operational review flag.');
      if (Number.isFinite(times.start) && Number.isFinite(times.end) && times.end < times.start) issue('error', 'TIME_ORDER', r.fields.end, 'End time precedes start time.', 'Correct the source dates or timezone conversion.');
      else if (Number.isFinite(times.end) && now - times.end > settings.expiredHours * 3600000) issue('warning', 'EVENT_ENDED', r.fields.end, 'Event ended more than ' + settings.expiredHours + ' hours ago.', 'Confirm whether retention is intentional. Remove or archive events according to the publisher’s lifecycle policy.');
      const geoError = geometryError(r.geometry);
      if (geoError) issue('error', 'GEOMETRY_INVALID', path + '.geometry', r.geometry ? 'Geometry cannot be interpreted reliably.' : 'Event geometry is missing.', geoError);
    }
    issues.sort((a, b) => (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1) || (a.index ?? -1) - (b.index ?? -1));
    const flagged = new Set(issues.filter(i => i.index !== null).map(i => i.index));
    const entries = normalized.map(r => ({ id: idValue(r.id) ? String(r.id) : null, fingerprint: hash(r.raw) }));
    return {
      product: 'PurposeBuilt FeedCheck', version: VERSION, assessedAt: new Date(now).toISOString(),
      source: sourceLabel(options.source), organization: String(options.organization || '').slice(0, 160),
      format, declaredVersion: String(info.version || 'Not declared'), settings,
      summary: { records: records.length, flagged: flagged.size, clear: records.length - flagged.size, errors: issues.filter(i => i.severity === 'error').length, warnings: issues.filter(i => i.severity === 'warning').length, feedFindings: issues.filter(i => i.index === null).length },
      issues, entries,
      scope: 'Operational checks only; not full schema certification, ground-truth verification, coverage measurement, or an uptime monitor.'
    };
  }
  function snapshot(report) {
    return { kind: 'purposebuilt-feedcheck-snapshot', version: 1, source: report.source, assessedAt: report.assessedAt, format: report.format, settings: report.settings, summary: report.summary, entries: report.entries };
  }
  function validateSnapshot(s) {
    if (!object(s) || s.kind !== 'purposebuilt-feedcheck-snapshot' || s.version !== 1 || !text(s.source) || !Number.isFinite(timestamp(s.assessedAt)) || !Array.isArray(s.entries) || s.entries.length > MAX_RECORDS || !s.entries.every(e => object(e) && (e.id === null || typeof e.id === 'string') && typeof e.fingerprint === 'string') || !object(s.summary) || !Number.isFinite(s.summary.records)) throw new Error('Choose a valid FeedCheck baseline snapshot JSON.');
    return s;
  }
  function compare(report, baseline) {
    validateSnapshot(baseline);
    if (report.source !== baseline.source) throw new Error('Baseline source differs. Use a baseline from the same feed, or assess both files using the same feed label.');
    const duplicateOrMissing = entries => entries.some(e => e.id === null) || new Set(entries.map(e => e.id)).size !== entries.length;
    if (duplicateOrMissing(report.entries) || duplicateOrMissing(baseline.entries)) throw new Error('Comparison needs unique, non-empty IDs in both assessments. Resolve ID findings first.');
    const previous = new Map(baseline.entries.map(e => [e.id, e.fingerprint]));
    const current = new Map(report.entries.map(e => [e.id, e.fingerprint]));
    return { previousAt: baseline.assessedAt, previousRecords: baseline.entries.length, added: report.entries.filter(e => !previous.has(e.id)).map(e => e.id), removed: baseline.entries.filter(e => !current.has(e.id)).map(e => e.id), changed: report.entries.filter(e => previous.has(e.id) && previous.get(e.id) !== e.fingerprint).map(e => e.id), unchanged: report.entries.filter(e => previous.get(e.id) === e.fingerprint).length, recordDelta: report.entries.length - baseline.entries.length };
  }
  function csv(report) {
    const cell = v => {
      let s = String(v ?? '');
      if (/^[\s\u0000-\u001f]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const rows = [['Source', 'Assessed at', 'Severity', 'Rule', 'Record ID', 'JSON path', 'Finding', 'Suggested action']];
    for (const i of report.issues) rows.push([report.source, report.assessedAt, i.severity, i.code, i.recordId, i.path, i.message, i.action]);
    return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
  }
  function sample(now = Date.now()) {
    const iso = hours => new Date(now + hours * 3600000).toISOString();
    const event = (id, road) => ({ type: 'Feature', id, properties: { core_details: { event_type: 'work-zone', road_names: [road], direction: 'eastbound', update_date: iso(-0.1) }, start_date: iso(-2), end_date: iso(8) }, geometry: { type: 'LineString', coordinates: [[-93.64, 41.59], [-93.62, 41.60]] } });
    const features = [event('FC-100', 'I-80'), event('FC-101', 'I-35'), event('FC-102', 'US-30'), event('FC-103', 'I-80'), event('FC-104', 'I-35'), event('FC-105', 'US-65')];
    features[1].properties.core_details.update_date = iso(-48);
    features[2].geometry.coordinates[1] = [-193.62, 41.60];
    features[3].properties.end_date = iso(-3);
    features[4].properties.core_details.road_names = [];
    return { type: 'FeatureCollection', feed_info: { version: '4.2', publisher: 'PurposeBuilt example data', update_date: iso(-0.1) }, features };
  }
  return { VERSION, MAX_BYTES, MAX_RECORDS, parse, analyze, snapshot, validateSnapshot, compare, csv, sample, sourceLabel, timestamp, geometryError };
});

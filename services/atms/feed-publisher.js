'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { normalize, hash } = require('./geometry');

const PROFILES = ['wzdx-4.2', 'cwz-1.0'];
const MAX_AGE = 15 * 60000;
const PAYLOAD = ['worker_presence', 'restrictions', 'reduced_speed_limit_kph', 'lanes', 'types_of_work'];
const FLAGS = ['is_start_date_verified', 'is_end_date_verified', 'is_start_position_verified', 'is_end_position_verified'];
const FIELDS = ['eventType', 'startDate', 'endDate', 'observedAt', 'vehicleImpact', 'locationMethod', 'workZoneType', 'publicDescription', 'uniformSegmentConfirmed', 'laneOrderConfirmed', 'totalLanes', 'verificationEvidence', ...FLAGS, ...PAYLOAD];
function sourceValues(raw) {
  const p = raw.properties || raw, c = p.core_details || {};
  const result = {};
  for (const [target, candidates] of Object.entries({ eventType: [c.event_type], startDate: [p.start_date, raw.startTime], endDate: [p.end_date, raw.endTime], vehicleImpact: [p.vehicle_impact], locationMethod: [p.location_method], workZoneType: [p.work_zone_type] })) {
    const value = candidates.find(v => v != null); if (value != null) result[target] = value;
  }
  for (const key of [...FLAGS, ...PAYLOAD]) if (Object.hasOwn(p, key) && p[key] != null) result[key] = p[key];
  return JSON.stringify(result).length <= 48000 ? result : {};
}
const validators = new Map();
function validator(profile) {
  if (!PROFILES.includes(profile)) throw new Error('Unsupported feed profile.');
  if (validators.has(profile)) return validators.get(profile);
  const dir = path.join(__dirname, 'standards');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: true }); addFormats(ajv);
  let root;
  for (const entry of manifest.files.filter(e => e.file.endsWith('.json') && (e.file.startsWith(profile + '/') || e.file.startsWith('geojson/')))) {
    const body = fs.readFileSync(path.join(dir, entry.file));
    if (createHash('sha256').update(body).digest('hex') !== entry.sha256) throw new Error('Pinned feed schema integrity check failed.');
    const schema = JSON.parse(body); ajv.addSchema(schema);
    if (entry.file === profile + '/WorkZoneFeed.json') root = schema.$id;
  }
  const validate = ajv.getSchema(root); if (!validate) throw new Error('Feed schema is unavailable.');
  validators.set(profile, validate); return validate;
}
const errors = validate => (validate.errors || []).slice(0, 25).map(e => `${e.instancePath || '/'} ${e.message}${e.params?.missingProperty ? ': ' + e.params.missingProperty : ''}`);
const utc = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));
const context = i => hash({ geometry: i.geometry, geometryEvidence: i.geometryEvidence, route: i.route, direction: i.direction, status: i.status });
function feature(incident, details, config) {
  const p = { core_details: { event_type: details.eventType, data_source_id: config.dataSourceId, road_names: [incident.route], direction: incident.direction, update_date: details.observedAt }, start_date: details.startDate, end_date: details.endDate };
  if (details.publicDescription) p.core_details.description = details.publicDescription;
  if (details.eventType === 'work-zone') {
    p.vehicle_impact = details.vehicleImpact; p.location_method = details.locationMethod;
    if (details.workZoneType) p.work_zone_type = details.workZoneType;
    for (const key of PAYLOAD) if (Object.hasOwn(details, key)) p[key] = details[key];
  }
  for (const key of FLAGS) p[key] = details[key] === true;
  return { type: 'Feature', id: incident.id, geometry: normalize(incident.geometry), properties: p };
}
function document(profile, config, features, now, training) {
  const info = { publisher: config.publisher, contact_name: config.contactName, contact_email: config.contactEmail, update_frequency: config.updateFrequency, update_date: now, version: profile === 'cwz-1.0' ? '1.0' : '4.2', license: config.license, data_sources: [{ data_source_id: config.dataSourceId, organization_name: config.sourceOrganization, update_frequency: config.updateFrequency, update_date: features.length ? features.map(f => f.properties.core_details.update_date).sort().at(-1) : config.emptyObservedAt }] };
  return { type: 'FeatureCollection', ...(profile === 'cwz-1.0' ? { feed_info: info } : { road_event_feed_info: info }), features, ...(training ? { x_training: true, x_notice: 'Synthetic training feed. Not for roadway operations.' } : {}) };
}
function configure(Operations, { requireRole, Fault }) {
  const reject = (status, message) => { throw new Fault(status, message); };
  const text = (v, label, max = 500) => typeof v === 'string' && v.trim().length >= 3 && v.length <= max ? v.trim() : reject(400, `${label} requires 3–${max} characters.`);
  Operations.prototype.saveFeedConfig = function (actor, input) {
    requireRole(actor, 'supervisor');
    const old = this.get(actor.agency, 'feed-config', 'publisher');
    if ((old?.version || 0) !== input.version) reject(409, 'Publisher settings changed. Refresh first.');
    const config = { id: 'publisher', publisher: text(input.publisher, 'Publisher'), contactName: text(input.contactName, 'Contact name'), contactEmail: text(input.contactEmail, 'Contact email'), license: text(input.license, 'License URL'), sourceOrganization: text(input.sourceOrganization, 'Source organization'), dataSourceId: text(input.dataSourceId, 'Data source ID', 120), updateFrequency: Number(input.updateFrequency) };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.contactEmail)) reject(400, 'Provide the actual public feed contact email.');
    try { if (!['https:', 'http:'].includes(new URL(config.license).protocol)) throw Error(); } catch { reject(400, 'Provide an HTTP(S) license URL authorized by the publisher.'); }
    if (!Number.isInteger(config.updateFrequency) || config.updateFrequency < 1 || config.updateFrequency > 900) reject(400, 'Declared update frequency must be 1–900 seconds.');
    if (input.emptyObservedAt) { if (!utc(input.emptyObservedAt)) reject(400, 'Empty-inventory observation must be a UTC timestamp.'); config.emptyObservedAt = input.emptyObservedAt; }
    const result = this.put(actor.agency, 'feed-config', config, old?.version);
    this.audit(actor, 'feed-publisher', 'feed.settings_saved', { configVersion: result.version }); return result;
  };
  Operations.prototype.saveFeedDetails = function (actor, id, input) {
    requireRole(actor, 'operator'); const incident = this.need(actor.agency, 'incident', id); this.owned(actor, incident);
    if (incident.status === 'closed') reject(409, 'Closed incidents cannot have their publication details edited.');
    if (input.incidentVersion !== incident.version) reject(409, 'Incident changed. Refresh before preparing publication.');
    const old = this.get(actor.agency, 'feed-details', id);
    if ((old?.version || 0) !== input.version) reject(409, 'Publication details changed. Refresh first.');
    const note = text(input.note, 'Publication evidence', 2000), details = { id, note, preparedBy: actor.id, preparedAt: this.iso() };
    for (const key of FIELDS) if (Object.hasOwn(input, key)) details[key] = input[key];
    if (!['work-zone', 'detour', 'excluded'].includes(details.eventType)) reject(400, 'Explicitly classify this event as work-zone, detour, or excluded.');
    if (FLAGS.some(key => Object.hasOwn(details, key) && typeof details[key] !== 'boolean')) reject(400, 'Verification flags must be booleans.');
    if (JSON.stringify(details).length > 48000) reject(400, 'Publication details exceed 48 KB.');
    const result = this.put(actor.agency, 'feed-details', details, old?.version);
    this.audit(actor, id, 'feed.details_saved', { detailsVersion: result.version, eventType: result.eventType, note }); return result;
  };
  Operations.prototype.previewFeed = function (actor, profile) {
    requireRole(actor, 'viewer'); if (!PROFILES.includes(profile)) reject(400, 'Select wzdx-4.2 or cwz-1.0.');
    const validate = validator(profile), config = this.get(actor.agency, 'feed-config', 'publisher'), globalIssues = [], rows = [], features = [];
    if (!config) globalIssues.push('Configure the actual publisher, source organization, public contact, license, and update frequency.');
    const schemaConfig = config || { publisher: '', contactName: '', contactEmail: 'missing@example.invalid', license: 'https://example.invalid', sourceOrganization: '', dataSourceId: 'missing', updateFrequency: 300 };
    const bySource = Object.create(null);
    for (const incident of this.list(actor.agency, 'incident')) {
      const details = this.get(actor.agency, 'feed-details', incident.id), issues = [], warnings = [];
      const sourceName = incident.source?.name || 'Operator report';
      const group = bySource[sourceName] ||= { source: sourceName, selected: 0, workZones: 0, ready: 0, held: 0, coverage: Object.fromEntries(PAYLOAD.map(k => [k, 0])) };
      const source = incident.sourceKey && this.get(actor.agency, 'event', incident.sourceKey);
      const row = { inactive: ['resolved', 'closed'].includes(incident.status), sourceValues: source?.feedSource || {}, context: context(incident), incidentId: incident.id, number: incident.number, title: incident.title, source: sourceName, incidentVersion: incident.version, details, issues, warnings, selected: !!details && details.eventType !== 'excluded' && !['resolved', 'closed'].includes(incident.status), ready: false };
      rows.push(row); if (!row.selected) continue; group.selected++;
      if (['resolved', 'closed'].includes(incident.status)) issues.push('Incident is resolved or closed. Withdraw it from the active feed.');
      else if (!['verified', 'responding', 'monitoring'].includes(incident.status)) issues.push('Verify the incident before publication.');
      if (!normalize(incident.geometry) || incident.geometry.type !== 'LineString') issues.push('Provide one continuous LineString. Split separate carriageways/events before publishing this profile.');
      if (incident.geometryEvidence?.status !== 'operator_reviewed') issues.push('Review the roadway geometry and affected limits.');
      if (incident.direction === 'both' || incident.direction === 'unknown') issues.push('Select a single travel direction and segment each direction separately.');
      const sourceEvent = incident.sourceKey && this.get(actor.agency, 'event', incident.sourceKey);
      if (sourceEvent && (!sourceEvent.present || this.now() - Date.parse(sourceEvent.observedAt) > this.sourceMaxAgeMs)) issues.push('Source observation is absent or stale. Reconcile the incident with a current observation.');
      if (sourceEvent && incident.geometryEvidence?.reviewedSourceFingerprint !== sourceEvent.geometryEvidence?.fingerprint) issues.push('Review the latest source location before publishing.');
      if (!utc(details.observedAt) || this.now() - Date.parse(details.observedAt) > MAX_AGE || Date.parse(details.observedAt) > this.now() + 60000) issues.push('Supply an actual observation time in UTC within the last 15 minutes. Saving a draft does not refresh an observation.');
      if (!utc(details.startDate) || !utc(details.endDate) || Date.parse(details.endDate) <= Date.parse(details.startDate)) issues.push('Supply valid UTC beginning and ending times, with ending after beginning.');
      if (utc(details.endDate) && Date.parse(details.endDate) <= this.now()) issues.push('Event end time has elapsed. Confirm completion or update its expected end.');
      if (details.is_start_date_verified === true && Date.parse(details.startDate) > this.now() || details.is_end_date_verified === true && Date.parse(details.endDate) > this.now()) issues.push('A future start or end cannot be claimed as already confirmed.');
      if (details.uniformSegmentConfirmed !== true) issues.push('Confirm required properties and lane configuration remain uniform across this segment; otherwise split the event.');
      if (FLAGS.some(k => details[k] === true) && (typeof details.verificationEvidence !== 'string' || details.verificationEvidence.trim().length < 3)) issues.push('True verification flags require explicit physical-position or time-confirmation evidence. Operator map review alone is insufficient.');
      if (Object.hasOwn(details, 'lanes')) {
        const lanes = details.lanes;
        if (!Array.isArray(lanes) || !Number.isInteger(details.totalLanes) || details.totalLanes < 1 || lanes.length !== details.totalLanes || lanes.some((l, index) => l?.order !== index + 1)) issues.push('Lane entries must cover every lane, consecutively ordered 1 through total lanes.');
        if (details.laneOrderConfirmed !== true) issues.push('Confirm lane order 1 is leftmost in the travel direction.');
      }
      if (details.eventType === 'work-zone') group.workZones++;
      if (details.eventType === 'work-zone') for (const key of PAYLOAD) { if (Object.hasOwn(details, key)) group.coverage[key]++; else warnings.push(`${key} is absent; no observation was invented.`); }
      const candidate = feature(incident, details, schemaConfig);
      if (!validate(document(profile, schemaConfig, [candidate], this.iso(), this.mode === 'training'))) issues.push(...errors(validate));
      row.ready = !issues.length;
      if (row.ready) { features.push(candidate); group.ready++; } else group.held++;
    }
    if (!features.length && (!utc(schemaConfig.emptyObservedAt) || this.now() - Date.parse(schemaConfig.emptyObservedAt) > MAX_AGE || Date.parse(schemaConfig.emptyObservedAt) > this.now() + 60000)) globalIssues.push('An empty feed requires a fresh, actual empty-inventory observation time in publisher settings.');
    const feed = document(profile, schemaConfig, features, this.iso(), this.mode === 'training');
    const schemaValid = validate(feed); if (!schemaValid) globalIssues.push(...errors(validate));
    return { previewHash: hash({ profile, config, rows: rows.map(r => ({ id: r.incidentId, context: r.context, detailsVersion: r.details?.version, ready: r.ready, selected: r.selected, issues: r.issues })), features }), profile, mode: this.mode, checkedAt: this.iso(), config, rows, sources: Object.values(bySource), inactiveCount: rows.filter(r => r.inactive).length, notSelectedCount: rows.filter(r => !r.selected && !r.inactive).length, readyCount: features.length, heldCount: rows.filter(r => r.selected && !r.ready).length, selectedCount: rows.filter(r => r.selected).length, globalIssues, schemaValid, feed, schema: { source: profile === 'wzdx-4.2' ? 'USDOT WZDx 4.2' : 'ITE CWZ schema archive, schemas/1.0', integrity: 'pinned SHA-256 files', validation: 'JSON Schema plus implemented publication checks; not a certification of all standard requirements' } };
  };
  Operations.prototype.publishFeed = function (actor, profile, input) {
    requireRole(actor, 'supervisor'); const preview = this.previewFeed(actor, profile);
    if (typeof input.note !== 'string' || input.note.trim().length < 3 || input.note.length > 2000) reject(400, 'Provide a publication decision note.');
    if (preview.globalIssues.length) reject(409, preview.globalIssues.join(' '));
    if (preview.heldCount && input.allowPartial !== true) reject(409, 'Selected records are held. Resolve them or explicitly authorize a partial feed.');
    if (!preview.readyCount && input.allowEmpty !== true) reject(409, 'No publishable records. Explicit empty-feed authorization is required.');
    if (input.previewHash !== preview.previewHash) reject(409, 'The preview changed. Validate and review it again before publishing.');
    const previous = this.get(actor.agency, 'feed-publication', profile);
    const included = preview.rows.filter(r => r.ready).map(r => ({ id: r.incidentId, incidentContext: context(this.need(actor.agency, 'incident', r.incidentId)), detailsVersion: r.details.version }));
    const validUntil = Math.min(this.now() + preview.config.updateFrequency * 1000, ...(preview.readyCount ? [] : [Date.parse(preview.config.emptyObservedAt) + MAX_AGE]), ...preview.rows.filter(r => r.ready).flatMap(r => [Date.parse(r.details.observedAt) + MAX_AGE, Date.parse(r.details.endDate)]));
    const result = this.put(actor.agency, 'feed-publication', { id: profile, feed: preview.feed, sha256: hash(preview.feed), configVersion: preview.config.version, included, selected: preview.rows.filter(r => r.selected).map(r => ({ id: r.incidentId, detailsVersion: r.details.version })), publishedBy: actor.id, publishedAt: this.iso(), validUntil: new Date(validUntil).toISOString(), heldCount: preview.heldCount, validation: { policyVersion: 1, schemaManifestSha256: createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'standards/manifest.json'))).digest('hex'), selectedCount: preview.selectedCount, readyCount: preview.readyCount, held: preview.rows.filter(r => r.selected && !r.ready).map(r => ({ id: r.incidentId, issues: r.issues })), sources: preview.sources }, note: input.note.trim(), withdrawn: false }, previous?.version);
    if (!this.get(actor.agency, 'feed-artifact', result.sha256)) this.put(actor.agency, 'feed-artifact', { ...result, id: result.sha256, profile });
    this.audit(actor, 'feed:' + profile, 'feed.published', { sha256: result.sha256, included: included.map(r => r.id), heldCount: preview.heldCount, allowPartial: input.allowPartial === true, allowEmpty: input.allowEmpty === true, note: result.note }); return result;
  };
  Operations.prototype.publishedFeed = function (agency, profile) {
    if (!PROFILES.includes(profile)) reject(400, 'Unsupported feed profile.');
    const record = this.get(agency, 'feed-publication', profile);
    if (!record || record.withdrawn) reject(503, 'No released feed is available.');
    if (hash(record.feed) !== record.sha256 || !validator(profile)(record.feed)) reject(503, 'Published artifact integrity or schema validation failed.');
    if (Date.parse(record.validUntil) <= this.now()) reject(503, 'Published feed is stale. Revalidate and release a current snapshot.');
    if (this.get(agency, 'feed-config', 'publisher')?.version !== record.configVersion) reject(503, 'Publisher configuration changed. Revalidate the feed.');
    for (const item of record.included) {
      const incident = this.get(agency, 'incident', item.id), details = this.get(agency, 'feed-details', item.id);
      if (!incident || context(incident) !== item.incidentContext || details?.version !== item.detailsVersion) reject(503, 'Published event changed. Revalidate before serving this snapshot.');
      const event = incident.sourceKey && this.get(agency, 'event', incident.sourceKey);
      if (event && (!event.present || this.now() - Date.parse(event.observedAt) > this.sourceMaxAgeMs || incident.geometryEvidence?.reviewedSourceFingerprint !== event.geometryEvidence?.fingerprint)) reject(503, 'Source evidence changed or became stale. Revalidate before serving this snapshot.');
    }
    return record;
  };
  Operations.prototype.withdrawFeed = function (actor, profile, input) {
    requireRole(actor, 'supervisor'); const record = this.need(actor.agency, 'feed-publication', profile);
    const note = text(input.note, 'Withdrawal note', 2000);
    const result = this.put(actor.agency, 'feed-publication', { ...record, withdrawn: true, withdrawalNote: note }, input.version);
    this.audit(actor, 'feed:' + profile, 'feed.withdrawn', { note }); return result;
  };
}
module.exports = { configure, validator, PROFILES, PAYLOAD, FLAGS, MAX_AGE, hash, context, sourceValues };

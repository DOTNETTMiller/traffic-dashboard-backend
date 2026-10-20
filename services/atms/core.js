'use strict';

const Database = require('better-sqlite3');
const { randomUUID, createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { normalize: normalizeGeometry, first: geometryAnchor, sourceGeometry, hash: geometryHash } = require('./geometry');

class Fault extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new Fault(status, message); };
const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}' : JSON.stringify(value);
const digest = value => createHash('sha256').update(stable(value)).digest('hex');
const text = (value, name, max = 500, min = 1) => {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) fail(400, `${name} must contain ${min}–${max} characters.`);
  return value.trim();
};
const choice = (value, values, name) => values.includes(value) ? value : fail(400, `Invalid ${name}.`);
const roles = { viewer: 0, operator: 1, supervisor: 2, system: 3 };
const requireRole = (actor, role) => {
  if (!actor?.id || !actor.agency || !Object.hasOwn(roles, actor.role)) fail(401, 'An individual operator identity and agency are required.');
  if (roles[actor.role] < roles[role]) fail(403, `${role} access is required.`);
};
const ACTIVE_COMMANDS = ['requested', 'approved', 'dispatching', 'acknowledged', 'verified', 'unknown', 'timed_out', 'expiry_unconfirmed'];
const stages = ['reported', 'verified', 'responding', 'monitoring', 'resolved', 'closed'];
const plans = {
  incident: [
    ['location', 'Verify location, direction, and lane impact', true],
    ['response', 'Confirm responder coordination', true],
    ['messaging', 'Review upstream traveler messaging', true],
    ['neighbors', 'Assess neighboring jurisdiction impacts', false],
    ['monitor', 'Review queue and secondary-crash exposure', true],
    ['clearance', 'Confirm roadway status before clearance', true]
  ],
  closure: [
    ['location', 'Verify closure limits and direction', true],
    ['response', 'Confirm responsible field contact', true],
    ['messaging', 'Review upstream messages and sign priorities', true],
    ['detour', 'Confirm detour authorization and restrictions', true],
    ['neighbors', 'Coordinate with affected neighboring agencies', true],
    ['clearance', 'Confirm reopening with the responsible authority', true]
  ]
};

class Operations {
  constructor({ filename = ':memory:', mode = 'live', now = () => Date.now(), sourceMaxAgeMs = 15 * 60000 } = {}) {
    this.mode = choice(mode, ['training', 'live'], 'workspace mode');
    this.now = now; this.sourceMaxAgeMs = sourceMaxAgeMs;
    if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
    this.db = new Database(filename);
    this.db.pragma('journal_mode = WAL'); this.db.pragma('foreign_keys = ON'); this.db.pragma('busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS atms_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS atms_entities (
        agency TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL,
        version INTEGER NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
        PRIMARY KEY(agency,kind,id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS atms_incident_source ON atms_entities(agency,json_extract(data,'$.sourceKey'))
        WHERE kind='incident' AND json_extract(data,'$.sourceKey') IS NOT NULL;
      CREATE TABLE IF NOT EXISTS atms_audit (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, agency TEXT NOT NULL, entity TEXT NOT NULL,
        at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, payload TEXT NOT NULL,
        previous_hash TEXT NOT NULL, hash TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS atms_audit_agency ON atms_audit(agency,seq);
      CREATE TRIGGER IF NOT EXISTS atms_audit_no_update BEFORE UPDATE ON atms_audit BEGIN SELECT RAISE(ABORT,'Audit records are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS atms_audit_no_delete BEFORE DELETE ON atms_audit BEGIN SELECT RAISE(ABORT,'Audit records are append-only'); END;
      CREATE TABLE IF NOT EXISTS atms_requests (agency TEXT NOT NULL, actor TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(agency,actor,key));
      CREATE TABLE IF NOT EXISTS atms_gateway_nonces (nonce TEXT PRIMARY KEY, at INTEGER NOT NULL);
    `);
    const storedMode = this.db.prepare('SELECT value FROM atms_meta WHERE key=?').get('mode');
    if (storedMode && storedMode.value !== mode) { this.db.close(); throw new Error('Training and live workspaces require separate databases.'); }
    this.db.prepare('INSERT OR IGNORE INTO atms_meta(key,value) VALUES (?,?)').run('mode', mode);
    this.db.pragma('user_version = 1');
    this.initCollections();
    this.initArchitecture();
    this.initDru();
    if (filename !== ':memory:') for (const file of [filename, filename + '-wal', filename + '-shm']) if (fs.existsSync(file)) fs.chmodSync(file, 0o600);
  }
  iso() { return new Date(this.now()).toISOString(); }
  system(agency) { return { id: 'atms-system', name: 'ATMS service', agency, role: 'system' }; }
  get(agency, kind, id) {
    const row = this.db.prepare('SELECT data FROM atms_entities WHERE agency=? AND kind=? AND id=?').get(agency, kind, id);
    return row ? JSON.parse(row.data) : null;
  }
  need(agency, kind, id) { return this.get(agency, kind, id) || fail(404, `${kind} not found in this agency.`); }
  list(agency, kind) { return this.db.prepare('SELECT data FROM atms_entities WHERE agency=? AND kind=? ORDER BY rowid DESC').all(agency, kind).map(r => JSON.parse(r.data)); }
  put(agency, kind, entity, expected) {
    const old = this.get(agency, kind, entity.id);
    if (old && (!Number.isInteger(expected) || expected !== old.version)) fail(409, 'This record changed. Refresh before applying your action.');
    const next = { ...entity, version: (old?.version || 0) + 1, updatedAt: this.iso() };
    this.db.prepare('INSERT INTO atms_entities(agency,kind,id,version,data) VALUES (?,?,?,?,?) ON CONFLICT(agency,kind,id) DO UPDATE SET version=excluded.version,data=excluded.data').run(agency, kind, next.id, next.version, JSON.stringify(next));
    return next;
  }
  audit(actor, entity, action, payload = {}) {
    const previous = this.db.prepare('SELECT hash FROM atms_audit WHERE agency=? ORDER BY seq DESC LIMIT 1').get(actor.agency)?.hash || 'GENESIS';
    const row = { agency: actor.agency, entity, at: this.iso(), actor: actor.id, action, payload, previousHash: previous };
    const hash = digest(row);
    this.db.prepare('INSERT INTO atms_audit(agency,entity,at,actor,action,payload,previous_hash,hash) VALUES (?,?,?,?,?,?,?,?)').run(row.agency, entity, row.at, actor.id, action, JSON.stringify(payload), previous, hash);
    return hash;
  }
  timeline(agency, entity, limit = 200) {
    const rows = entity ? this.db.prepare('SELECT * FROM atms_audit WHERE agency=? AND entity=? ORDER BY seq DESC LIMIT ?').all(agency, entity, limit) : this.db.prepare('SELECT * FROM atms_audit WHERE agency=? ORDER BY seq DESC LIMIT ?').all(agency, limit);
    return rows.map(r => ({ sequence: r.seq, at: r.at, actor: r.actor, action: r.action, entity: r.entity, payload: JSON.parse(r.payload), hash: r.hash, previousHash: r.previous_hash }));
  }
  verifyAudit(agency) {
    let previous = 'GENESIS', count = 0;
    for (const r of this.db.prepare('SELECT * FROM atms_audit WHERE agency=? ORDER BY seq').all(agency)) {
      const expected = digest({ agency, entity: r.entity, at: r.at, actor: r.actor, action: r.action, payload: JSON.parse(r.payload), previousHash: previous });
      if (r.previous_hash !== previous || r.hash !== expected) return { valid: false, checked: count, failedSequence: r.seq };
      previous = r.hash; count++;
    }
    return { valid: true, checked: count, head: previous, checkedAt: this.iso() };
  }
  mutation(actor, key, action, payload, fn) {
    requireRole(actor, 'operator');
    text(key, 'Idempotency key', 120, 8);
    const fingerprint = digest({ action, payload });
    return this.db.transaction(() => {
      const previous = this.db.prepare('SELECT * FROM atms_requests WHERE agency=? AND actor=? AND key=?').get(actor.agency, actor.id, key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) fail(409, 'This request key was already used for a different action.');
        return JSON.parse(previous.result);
      }
      const result = fn();
      this.db.prepare('INSERT INTO atms_requests VALUES (?,?,?,?,?)').run(actor.agency, actor.id, key, fingerprint, JSON.stringify(result));
      return result;
    }).immediate();
  }
  owned(actor, incident) {
    if (incident.owner?.id !== actor.id && roles[actor.role] < roles.supervisor) fail(403, 'Claim this incident or ask its owner or a supervisor to make this change.');
  }
  createIncident(actor, input) {
    requireRole(actor, 'operator');
    const latitude = Number(input.latitude), longitude = Number(input.longitude);
    if (![input.latitude, input.longitude].every(v => ['number', 'string'].includes(typeof v) && !(typeof v === 'string' && !v.trim())) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) fail(400, 'Provide valid latitude and longitude.');
    const kind = choice(input.kind || 'incident', ['incident', 'closure'], 'incident type');
    const incident = this.put(actor.agency, 'incident', {
      id: randomUUID(), number: 'PB-' + randomUUID().slice(0, 8).toUpperCase(),
      title: text(input.title, 'Title', 180), route: text(input.route, 'Route', 80),
      direction: choice(input.direction || 'unknown', ['northbound', 'southbound', 'eastbound', 'westbound', 'both', 'unknown'], 'direction'),
      jurisdiction: text(input.jurisdiction || actor.agency, 'Jurisdiction', 80),
      severity: choice(input.severity || 'moderate', ['critical', 'major', 'moderate', 'minor'], 'severity'), kind,
      latitude, longitude, status: 'reported', owner: null, handoff: null,
      createdAt: this.iso(), createdBy: actor.id, sourceKey: input.sourceKey || null,
      source: input.source || { name: 'Operator report', observedAt: this.iso() },
      description: text(input.description || input.title, 'Description', 4000),
      geometry: normalizeGeometry(input.geometry) || { type: 'Point', coordinates: [longitude, latitude] },
      geometryEvidence: input.geometryEvidence || { status: 'operator_supplied', source: actor.id, method: 'Operator report coordinates', observedAt: this.iso(), reviewedBy: null, reviewedAt: null, note: 'A point locates the report; it does not establish affected road limits.' },
      tasks: plans[kind].map(([id, title, required]) => ({ id, title, required, status: 'pending', note: '', completedBy: null, completedAt: null }))
    });
    this.audit(actor, incident.id, 'incident.created', { number: incident.number, title: incident.title, sourceKey: incident.sourceKey });
    return incident;
  }
  changeIncident(actor, id, input) {
    requireRole(actor, 'operator');
    const incident = this.need(actor.agency, 'incident', id), note = text(input.note, 'Operational note', 2000, 3);
    if (incident.version !== input.version) fail(409, 'This incident changed. Refresh before applying your action.');
    const action = choice(input.action, ['claim', 'transition', 'note', 'task', 'offer_handoff', 'accept_handoff', 'cancel_handoff'], 'incident action');
    if (action === 'claim') {
      if (['resolved', 'closed'].includes(incident.status)) fail(409, 'This incident is no longer active.');
      if (incident.owner && incident.owner.id !== actor.id && roles[actor.role] < roles.supervisor) fail(409, 'Another operator owns this incident. Use an accepted handoff.');
      incident.owner = { id: actor.id, name: actor.name }; incident.handoff = null;
    } else if (action === 'accept_handoff') {
      if (incident.handoff?.to !== actor.id) fail(403, 'This handoff is assigned to another operator.');
      incident.owner = { id: actor.id, name: actor.name }; incident.handoff = null;
    } else {
      this.owned(actor, incident);
      if (incident.status === 'closed') fail(409, 'Closed incidents cannot be edited.');
      if (action === 'transition') {
        const next = choice(input.status, stages, 'incident status');
        if (stages.indexOf(next) !== stages.indexOf(incident.status) + 1) fail(409, 'Advance one stage at a time so operational milestones remain explicit.');
        if (!incident.owner) fail(409, 'Assign an owner before advancing this incident.');
        if (next === 'resolved') {
          if (incident.tasks.some(t => t.required && t.status !== 'complete')) fail(409, 'Complete the required response tasks before resolving this incident.');
          if (this.list(actor.agency, 'command').some(c => c.incidentId === id && ACTIVE_COMMANDS.includes(c.status))) fail(409, 'Reconcile or clear outstanding device commands before resolving this incident.');
          incident.resolvedAt = this.iso();
        }
        if (next === 'closed') incident.closedAt = this.iso();
        incident.status = next;
      } else if (action === 'task') {
        if (['resolved', 'closed'].includes(incident.status)) fail(409, 'Response tasks are locked after resolution.');
        const task = incident.tasks.find(t => t.id === input.taskId) || fail(404, 'Response task not found.');
        task.status = choice(input.status, ['pending', 'complete'], 'task status'); task.note = note;
        task.completedBy = task.status === 'complete' ? actor.id : null; task.completedAt = task.status === 'complete' ? this.iso() : null;
      } else if (action === 'offer_handoff') {
        if (['resolved', 'closed'].includes(incident.status)) fail(409, 'Only active incidents can be handed off.');
        const to = text(input.to, 'Incoming operator ID', 160);
        if (to === actor.id) fail(400, 'Choose another operator for handoff.');
        incident.handoff = { to, from: actor.id, offeredAt: this.iso(), note };
      } else if (action === 'cancel_handoff') incident.handoff = null;
    }
    const result = this.put(actor.agency, 'incident', incident, input.version);
    this.audit(actor, id, 'incident.' + action, { note, status: incident.status, taskId: input.taskId || null, to: input.to || null });
    return result;
  }
  registerDevice(agency, input) {
    const previous = this.get(agency, 'device', input.id);
    const result = this.put(agency, 'device', { ...input, id: text(input.id, 'Device ID', 180), name: text(input.name, 'Device name', 180) }, previous?.version);
    return result;
  }
  controlReason(device, agency) {
    if (device.communicationFault) return device.communicationFault;
    if (this.mode === 'training' && device.driver !== 'simulator') return 'Only virtual training devices can be commanded here.';
    if (this.mode === 'live' && this.gatewayAvailable === false) return 'The agency control gateway is not connected to this service.';
    if (this.mode === 'live' && (device.driver !== 'gateway' || !device.controlEnabled)) return 'Read-only inventory. An authorized control gateway has not been configured.';
    if (this.mode === 'live' && (!agency || !this.installation(agency, device).ready)) return 'Installation acceptance is required for this device configuration.';
    const age = this.now() - Date.parse(device.observedAt);
    if (!Number.isFinite(age) || age < -300000 || age > 120000) return 'Recent device telemetry is required before issuing a command.';
    return null;
  }
  createCommand(actor, input) {
    requireRole(actor, 'operator');
    const incident = this.need(actor.agency, 'incident', input.incidentId);
    this.owned(actor, incident);
    if (['resolved', 'closed'].includes(incident.status)) fail(409, 'Commands require an active incident.');
    const device = this.need(actor.agency, 'device', input.deviceId);
    const reason = this.controlReason(device, actor.agency); if (reason) fail(409, reason);
    if (device.type !== 'dms') fail(400, 'This command workflow supports DMS only.');
    const operation = choice(input.operation || 'message', ['message', 'blank'], 'command operation');
    const template = input.templateId ? this.need(actor.agency, 'template', input.templateId) : null;
    const message = operation === 'blank' ? '' : text(template ? template.message : input.message, 'Sign message', 200).toUpperCase();
    const lines = message.split('\n');
    if (message && (!/^[A-Z0-9 .,!?/():+'\-\n]+$/.test(message) || lines.length > device.lines || lines.some(l => !l.trim() || l.length > device.columns))) fail(400, `Use plain text with up to ${device.lines} non-empty lines and ${device.columns} characters per line. MULTI markup is not accepted.`);
    const ttlMinutes = Number(input.ttlMinutes ?? 15);
    if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 60) fail(400, 'Command validity must be 1–60 minutes.');
    const priority = Number(input.priority ?? 3);
    if (!Number.isInteger(priority) || priority < 1 || priority > 5) fail(400, 'Priority must be 1–5.');
    if (priority === 1) requireRole(actor, 'supervisor');
    const command = this.put(actor.agency, 'command', {
      id: randomUUID(), incidentId: incident.id, deviceId: device.id, operation, message, priority, templateId: template?.id || null,
      status: 'requested', mode: this.mode, requestedBy: actor.id, requestedAt: this.iso(),
      reason: text(input.reason, 'Command reason', 1000, 3), expiresAt: new Date(this.now() + ttlMinutes * 60000).toISOString(),
      approvedBy: null, dispatchedAt: null, acknowledgedAt: null, verifiedAt: null
    });
    this.audit(actor, incident.id, 'command.requested', { commandId: command.id, deviceId: device.id, operation, message, priority, expiresAt: command.expiresAt });
    return command;
  }
  changeCommand(actor, id, input) {
    requireRole(actor, 'operator');
    const command = this.need(actor.agency, 'command', id);
    if (command.version !== input.version) fail(409, 'This command changed. Refresh before applying your action.');
    const action = choice(input.action, ['approve', 'reject', 'cancel'], 'command action');
    const note = text(input.note, 'Decision reason', 1000, 3);
    if (action === 'approve' || action === 'reject') {
      requireRole(actor, 'supervisor');
      if (command.requestedBy === actor.id) fail(403, 'A different supervisor must review this request.');
      if (command.status !== 'requested') fail(409, 'Only a pending request can be reviewed.');
      if (Date.parse(command.expiresAt) <= this.now()) fail(409, 'This request has expired. Create a new request.');
      if (action === 'approve') {
        const incident = this.need(actor.agency, 'incident', command.incidentId);
        if (!['verified', 'responding', 'monitoring'].includes(incident.status)) fail(409, 'Verify the incident before authorizing device control.');
        const reason = this.controlReason(this.need(actor.agency, 'device', command.deviceId), actor.agency); if (reason) fail(409, reason);
        const conflict = this.list(actor.agency, 'command').find(c => c.id !== id && c.deviceId === command.deviceId && ['approved', 'dispatching', 'acknowledged', 'unknown', 'timed_out', 'expiry_unconfirmed'].includes(c.status));
        if (conflict) fail(409, 'Reconcile the outstanding command on this device before approving another.');
        const displaying = this.list(actor.agency, 'command').find(c => c.deviceId === command.deviceId && c.status === 'verified');
        if (displaying && displaying.priority < command.priority && command.operation !== 'blank') fail(409, 'A higher-priority message is confirmed on this device.');
        if (displaying && command.operation === 'blank' && displaying.incidentId !== command.incidentId) fail(409, 'Blank the sign through the incident that owns its confirmed message.');
        command.status = 'approved'; command.approvedBy = actor.id; command.approvedAt = this.iso();
      } else command.status = 'rejected';
    } else {
      if (command.requestedBy !== actor.id) requireRole(actor, 'supervisor');
      if (!['requested', 'approved'].includes(command.status)) fail(409, 'Commands already handed to a gateway require reconciliation, not cancellation.');
      command.status = 'cancelled';
    }
    command.decisionNote = note;
    const result = this.put(actor.agency, 'command', command, input.version);
    this.audit(actor, command.incidentId, 'command.' + action, { commandId: id, note });
    return result;
  }
  serviceCommand(agency, command, changes, action) {
    const result = this.put(agency, 'command', { ...command, ...changes }, command.version);
    this.audit(this.system(agency), command.incidentId, action, { commandId: command.id, deviceId: command.deviceId, ...changes });
    return result;
  }
  recoverDispatches() {
    this.db.transaction(() => {
      for (const row of this.db.prepare("SELECT agency,data FROM atms_entities WHERE kind='command'").all()) {
        const command = JSON.parse(row.data);
        if (['dispatching', 'acknowledged'].includes(command.status) || (this.mode === 'live' && command.status === 'verified')) this.serviceCommand(row.agency, command, { status: 'unknown', failure: 'Service restarted with an outstanding field command. Fresh readback reconciliation is required; no automatic resend.' }, 'command.recovery_required');
      }
    }).immediate();
  }
  takeDispatches() {
    return this.db.transaction(() => {
      const out = [];
      for (const row of this.db.prepare("SELECT agency,data FROM atms_entities WHERE kind='command'").all()) {
        const c = JSON.parse(row.data), agency = row.agency, expired = Date.parse(c.expiresAt) <= this.now();
        if (expired && ['requested', 'approved'].includes(c.status)) this.serviceCommand(agency, c, { status: 'expired' }, 'command.expired_before_dispatch');
        else if (expired && c.status === 'verified') this.serviceCommand(agency, c, { status: 'expiry_unconfirmed', failure: 'Validity elapsed. Physical message clearance has not been confirmed.' }, 'command.expiry_unconfirmed');
        else if (['dispatching', 'acknowledged'].includes(c.status) && this.now() - Date.parse(c.dispatchedAt) > 30000) this.serviceCommand(agency, c, { status: 'timed_out', failure: 'No verified readback within 30 seconds. Inspect device state before any retry.' }, 'command.timed_out');
        else if (c.status === 'approved') {
          const device = this.need(agency, 'device', c.deviceId), reason = this.controlReason(device, agency);
          if (reason) this.serviceCommand(agency, c, { status: 'failed', failure: reason }, 'command.dispatch_blocked');
          else out.push({ agency, device, command: this.serviceCommand(agency, c, { status: 'dispatching', dispatchedAt: this.iso() }, 'command.dispatch_started') });
        }
      }
      return out;
    }).immediate();
  }
  gatewayEvent(agency, input, { simulation = false } = {}) {
    return this.db.transaction(() => {
      const command = this.need(agency, 'command', input.commandId);
      if (command.deviceId !== input.deviceId) fail(409, 'Gateway device does not match the command.');
      if (!['dispatching', 'acknowledged', 'unknown', 'timed_out', 'expiry_unconfirmed', ...(simulation && this.mode === 'training' ? ['simulated'] : [])].includes(command.status)) fail(409, 'Command is not awaiting gateway evidence.');
      if (simulation !== (this.mode === 'training')) fail(403, 'Training evidence cannot confirm live device state.');
      const observed = Date.parse(input.observedAt), dispatched = Date.parse(command.dispatchedAt);
      if (!Number.isFinite(observed) || observed < dispatched || observed > this.now() + 300000 || this.now() - observed > 300000) fail(400, 'Gateway evidence needs a recent observation after dispatch.');
      if (command.acknowledgedAt && observed < Date.parse(command.acknowledgedAt)) fail(409, 'Gateway evidence predates the accepted acknowledgment.');
      if (input.status === 'acknowledged') return this.serviceCommand(agency, command, { status: 'acknowledged', acknowledgedAt: input.observedAt }, 'command.gateway_acknowledged');
      if (input.status === 'failed') return this.serviceCommand(agency, command, { status: input.notApplied === true ? 'failed' : 'unknown', failure: text(input.reason, 'Gateway failure reason', 1000) }, 'command.gateway_failed');
      if (input.status !== 'readback' || input.evidence !== 'device-readback' || typeof input.message !== 'string') fail(400, 'Readback evidence and the actual displayed message are required.');
      const device = this.need(agency, 'device', command.deviceId);
      if (device.observedAt && observed < Date.parse(device.observedAt)) fail(409, 'A newer device observation is already stored.');
      this.put(agency, 'device', { ...device, observedAt: input.observedAt, displayedMessage: input.message }, device.version);
      if (input.message !== command.message) return this.serviceCommand(agency, command, { status: input.message === '' ? 'cleared' : 'unknown', failure: 'Device readback differs from the requested message.', readback: input.message }, 'command.readback_mismatch');
      for (const prior of this.list(agency, 'command')) {
        if (prior.id !== command.id && prior.deviceId === command.deviceId && (['verified', 'expiry_unconfirmed'].includes(prior.status) || (simulation && (prior.status === 'simulated' || prior.status === 'unknown' && prior.simulatedAt)))) this.serviceCommand(agency, prior, { status: 'superseded', supersededBy: command.id }, 'command.superseded_by_readback');
      }
      return this.serviceCommand(agency, command, { status: simulation ? 'simulated' : command.operation === 'blank' ? 'cleared' : 'verified', verifiedAt: simulation ? null : input.observedAt, simulatedAt: simulation ? this.iso() : null, readback: input.message, failure: null }, simulation ? 'command.simulated_result' : 'command.device_verified');
    }).immediate();
  }
  ingest(agency, { events, devices = [], observedAt, sourceName = 'Corridor Communicator', failedSources = 0, collections, eventsAvailable = true, eventsComplete = true, deviceObservedAt }) {
    if (!Array.isArray(events) || events.length > 25000 || !Array.isArray(devices) || devices.length > 25000) fail(400, 'Source batches support up to 25,000 events and devices.');
    const observed = Date.parse(observedAt);
    if (!Number.isFinite(observed) || observed > this.now() + 300000) fail(400, 'Source observation time is missing or invalid.');
    const system = this.system(agency);
    return this.db.transaction(() => {
      const previous = this.get(agency, 'source', 'corridor-communicator');
      if (eventsAvailable && previous && Date.parse(previous.observedAt) > observed) {
        if (!collections) fail(409, 'An older source snapshot cannot replace a newer one.');
        eventsAvailable = false;
      }
      const existing = this.list(agency, 'event'), seen = new Set(); let rejected = 0;
      for (const raw of eventsAvailable ? events : []) {
        const rawId = raw && (raw.id ?? raw.road_event_id);
        if (!raw || !['string', 'number'].includes(typeof rawId) || (typeof rawId === 'number' && !Number.isFinite(rawId)) || !String(rawId).trim() || String(rawId).length > 180) { rejected++; continue; }
        const sourceKey = `${String(raw.state || raw.stateKey || 'unknown')}:${String(rawId)}`;
        if (seen.has(sourceKey)) { rejected++; continue; } seen.add(sourceKey);
        const old = this.get(agency, 'event', sourceKey);
        const coordinate = value => !['number', 'string'].includes(typeof value) || (typeof value === 'string' && !value.trim()) ? NaN : Number(value);
        const spatial = sourceGeometry(raw, sourceName, observedAt);
        const point = geometryAnchor(spatial.geometry);
        const latitude = coordinate(raw.latitude ?? point?.[1]), longitude = coordinate(raw.longitude ?? point?.[0]);
        const event = {
          id: sourceKey, sourceId: String(rawId), title: String(raw.description || raw.headline || raw.eventType || 'Source-reported event').slice(0, 500),
          route: String(raw.corridor || raw.road || raw.route || raw.location || 'Unknown road').slice(0, 100),
          jurisdiction: String(raw.state || raw.stateKey || 'Unknown'), direction: String(raw.direction || 'unknown'),
          severity: /critical|severe/i.test(raw.severity) ? 'critical' : /major|high/i.test(raw.severity) ? 'major' : /minor|low/i.test(raw.severity) ? 'minor' : 'moderate',
          kind: /closure|closed/i.test(String(raw.eventType || raw.type)) ? 'closure' : 'incident',
          latitude: Number.isFinite(latitude) && Math.abs(latitude) <= 90 ? latitude : null,
          longitude: Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? longitude : null,
          observedAt, sourceUpdatedAt: raw.updated || raw.update_date || raw.lastUpdated || null, sourceName,
          present: true, incidentId: old?.incidentId || null
        };
        if (!spatial.geometry && event.latitude != null && event.longitude != null) {
          spatial.geometry = { type: 'Point', coordinates: [event.longitude, event.latitude] };
          spatial.geometryEvidence.status = 'source_reported';
          spatial.geometryEvidence.note = 'Source coordinates locate a report, not the affected road limits.';
        }
        spatial.geometryEvidence.fingerprint = geometryHash({ geometry: spatial.geometry, route: event.route, direction: event.direction });
        Object.assign(event, spatial);
        event.feedSource = require('./feed-publisher').sourceValues(raw);
        this.put(agency, 'event', event, old?.version);
      }
      for (const old of existing) if (eventsAvailable && eventsComplete && old.present && !seen.has(old.id)) this.put(agency, 'event', { ...old, present: false, missingSince: observedAt }, old.version);
      const captured = collections || [
        { sourceId: 'corridor-events', kind: 'events', status: failedSources ? 'partial' : events.length ? 'ok' : 'empty', collectedAt: this.iso(), sourceObservedAt: observedAt, payload: { events } },
        ...(devices.length || deviceObservedAt ? [{ sourceId: 'corridor-devices', kind: 'devices', status: devices.length ? 'ok' : 'empty', collectedAt: this.iso(), sourceObservedAt: deviceObservedAt || null, payload: { devices } }] : [])
      ];
      const collectionResults = this.recordCollections(agency, captured);
      const errorCount = Number.isInteger(failedSources) && failedSources > 0 ? failedSources : 0;
      const source = this.put(agency, 'source', { id: 'corridor-communicator', name: sourceName, observedAt: eventsAvailable ? observedAt : previous?.observedAt || null, importedAt: this.iso(), events: eventsAvailable ? seen.size : previous?.events || 0, eventsAvailable, rejected, failedSources: errorCount, devices: collectionResults.filter(c => c.kind === 'devices').reduce((n, c) => n + c.count, 0) }, previous?.version);
      this.audit(system, 'source:corridor-communicator', 'source.snapshot_imported', { observedAt, events: seen.size, rejected, failedSources: errorCount, devices: devices.length });
      return source;
    }).immediate();
  }
  promoteEvent(actor, id) {
    requireRole(actor, 'operator');
    const event = this.need(actor.agency, 'event', id);
    if (event.incidentId) return this.need(actor.agency, 'incident', event.incidentId);
    if (!event.present) fail(409, 'This event is absent from the latest source snapshot. Verify it before creating an operator report.');
    const age = this.now() - Date.parse(event.observedAt);
    if (age > this.sourceMaxAgeMs) fail(409, 'This source observation is stale. Refresh the source or create a verified operator report.');
    if (event.latitude == null || event.longitude == null) fail(400, 'The source event lacks usable coordinates. Create an operator report with a verified location.');
    const directions = { E: 'eastbound', W: 'westbound', N: 'northbound', S: 'southbound', EB: 'eastbound', WB: 'westbound', NB: 'northbound', SB: 'southbound' };
    const incident = this.createIncident(actor, { ...event, title: event.title.slice(0, 180), direction: directions[event.direction] || (['eastbound', 'westbound', 'northbound', 'southbound', 'both'].includes(event.direction) ? event.direction : 'unknown'), sourceKey: id, source: { name: event.sourceName, id: event.sourceId, observedAt: event.observedAt, sourceUpdatedAt: event.sourceUpdatedAt }, description: event.title });
    this.put(actor.agency, 'event', { ...event, incidentId: incident.id }, event.version);
    return incident;
  }
  alarms(agency) {
    const alarms = [], now = this.now(), add = (id, severity, title, detail, entityId) => alarms.push({ id, severity, title, detail, entityId, ...(this.get(agency, 'alarm', id) || {}), shelved: Date.parse(this.get(agency, 'alarm', id)?.shelvedUntil || '') > now });
    const source = this.get(agency, 'source', 'corridor-communicator');
    if (!source) add('source:missing', 'major', 'No source snapshot', 'Import Corridor Communicator observations to populate the source inbox.');
    else if (!Number.isFinite(Date.parse(source.observedAt)) || now - Date.parse(source.observedAt) > this.sourceMaxAgeMs) add('source:stale', 'major', 'Source snapshot is stale', 'Refreshing this screen does not make an old source observation current.');
    if (source?.events === 0) add('source:empty', 'major', 'Source snapshot contains no events', 'Verify publisher availability and coverage. An empty response does not establish that the roadway has no incidents.');
    if (source?.failedSources > 0) add('source:partial', 'major', 'Source snapshot has upstream feed errors', source.failedSources + ' upstream feeds reported errors. Review coverage in Corridor Communicator before relying on this snapshot.');
    for (const i of this.list(agency, 'incident').filter(i => !['resolved', 'closed'].includes(i.status))) {
      if (!i.owner) add('unowned:' + i.id, i.severity === 'critical' ? 'critical' : 'major', 'Incident needs an owner', i.title, i.id);
      if (i.handoff) add('handoff:' + i.id, 'moderate', 'Handoff awaiting acceptance', `${i.number} → ${i.handoff.to}`, i.id);
      const event = i.sourceKey && this.get(agency, 'event', i.sourceKey);
      if (event && !event.present) add('source-missing:' + i.id, 'major', 'Active incident absent from source', 'Source removal did not resolve the incident. Confirm roadway status.', i.id);
      if (!i.geometry || i.kind === 'closure' && i.geometryEvidence?.status !== 'operator_reviewed' || ['derived', 'missing'].includes(i.geometryEvidence?.status)) add('geometry:' + i.id, 'moderate', 'Incident geometry needs review', 'Confirm the affected roadway, travel direction, and beginning/end limits.', i.id);
      if (event && i.geometryEvidence?.reviewedSourceFingerprint && event.geometryEvidence?.fingerprint !== i.geometryEvidence.reviewedSourceFingerprint) add('geometry-changed:' + i.id, 'major', 'Source location changed after geometry review', 'The incident retains its reviewed geometry. Compare the new source location and record a fresh review.', i.id);
    }
    for (const m of this.list(agency, 'message')) if (!m.acknowledgedAt) add('message:' + m.id, 'moderate', 'Operational message awaiting acknowledgment', m.from + ' → ' + m.to, m.incidentId);
    for (const d of this.list(agency, 'device')) if (this.mode === 'live' && d.driver === 'gateway' && d.controlEnabled && !this.installation(agency, d).ready) add('installation:' + d.id, 'major', 'Installation acceptance required', d.name, d.id);
    for (const c of this.list(agency, 'command')) if (['failed', 'unknown', 'timed_out', 'expiry_unconfirmed'].includes(c.status)) add('command:' + c.id, c.status === 'expiry_unconfirmed' ? 'critical' : 'major', 'Device command needs reconciliation', `${c.deviceId}: ${c.failure || c.status}`, c.incidentId);
    for (const d of this.list(agency, 'device')) {
      if (d.communicationFault) add('device-communication:' + d.id, 'major', 'Controller observation unavailable or control blocked', d.name + ': ' + d.communicationFault, d.id);
      if (!d.inventory && (!d.observedAt || now - Date.parse(d.observedAt) > 5 * 60000)) add('device:' + d.id, 'moderate', 'Device telemetry is stale or unknown', d.name, d.id);
    }
    // Track alarm occurrences so an old acknowledgment never suppresses a new
    // occurrence of a condition that cleared and subsequently returned.
    return this.db.transaction(() => {
      const activeIds = new Set(alarms.map(a => a.id));
      const result = alarms.map(alarm => {
        let state = this.get(agency, 'alarm', alarm.id);
        if (!state || state.active === false) {
          state = this.put(agency, 'alarm', { id: alarm.id, active: true, occurrenceId: randomUUID(), raisedAt: this.iso(), acknowledgedAt: null, acknowledgedBy: null, shelvedUntil: null, note: '' }, state?.version);
          this.audit(this.system(agency), alarm.id, 'alarm.raised', { title: alarm.title, occurrenceId: state.occurrenceId });
        }
        return { ...alarm, ...state, shelved: Date.parse(state.shelvedUntil || '') > now };
      });
      for (const state of this.list(agency, 'alarm')) if (state.active && !activeIds.has(state.id)) {
        this.put(agency, 'alarm', { ...state, active: false, clearedAt: this.iso() }, state.version);
        this.audit(this.system(agency), state.id, 'alarm.condition_cleared', { occurrenceId: state.occurrenceId });
      }
      return result.sort((a, b) => ['critical', 'major', 'moderate'].indexOf(a.severity) - ['critical', 'major', 'moderate'].indexOf(b.severity));
    }).immediate();
  }
  acknowledgeAlarm(actor, id, input) {
    requireRole(actor, 'operator');
    if (!this.alarms(actor.agency).some(a => a.id === id)) fail(404, 'This alarm is no longer active.');
    const current = this.get(actor.agency, 'alarm', id);
    const note = text(input.note, 'Alarm note', 1000, 3);
    const minutes = Number(input.shelveMinutes || 0);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 60) fail(400, 'Shelving duration must be 0–60 minutes.');
    if (minutes) requireRole(actor, 'supervisor');
    const alarm = this.put(actor.agency, 'alarm', { ...current, id, acknowledgedBy: actor.id, acknowledgedAt: this.iso(), note, shelvedUntil: minutes ? new Date(this.now() + minutes * 60000).toISOString() : null }, current ? input.version : undefined);
    this.audit(actor, id, minutes ? 'alarm.shelved' : 'alarm.acknowledged', { note, minutes }); return alarm;
  }
  createHandoff(actor, input) {
    requireRole(actor, 'operator');
    const note = text(input.note, 'Shift briefing', 4000, 3);
    const incidents = this.list(actor.agency, 'incident').filter(i => !['resolved', 'closed'].includes(i.status));
    const commands = this.list(actor.agency, 'command').filter(c => ACTIVE_COMMANDS.includes(c.status));
    const handoff = this.put(actor.agency, 'shift', { id: randomUUID(), createdAt: this.iso(), from: actor.id, to: text(input.to, 'Incoming operator ID', 160), note, incidentIds: incidents.map(i => i.id), commandIds: commands.map(c => c.id), alarmCount: this.alarms(actor.agency).length, acceptedAt: null, acceptedBy: null });
    if (handoff.to === actor.id) fail(400, 'Choose a different incoming operator.');
    this.audit(actor, handoff.id, 'shift.offered', { to: handoff.to, incidents: incidents.length, outstandingCommands: commands.length, note }); return handoff;
  }
  acceptShift(actor, id, input) {
    requireRole(actor, 'operator');
    const shift = this.need(actor.agency, 'shift', id);
    if (shift.to !== actor.id) fail(403, 'This shift briefing is assigned to another operator.');
    if (shift.acceptedAt) fail(409, 'This shift briefing was already accepted.');
    const result = this.put(actor.agency, 'shift', { ...shift, acceptedAt: this.iso(), acceptedBy: actor.id, acceptanceNote: text(input.note, 'Acceptance note', 2000, 3) }, input.version);
    this.audit(actor, id, 'shift.accepted', { note: result.acceptanceNote }); return result;
  }
  workspace(actor) {
    requireRole(actor, 'viewer');
    const devices = this.list(actor.agency, 'device').map(d => ({ ...d, controllable: !this.controlReason(d, actor.agency), controlReason: this.controlReason(d, actor.agency), installation: this.installation(actor.agency, d) }));
    return { mode: this.mode, at: this.iso(), actor, stages, templates: this.list(actor.agency, 'template'), messages: this.list(actor.agency, 'message'), incidents: this.list(actor.agency, 'incident'), devices, commands: this.list(actor.agency, 'command'), events: this.eventPage(actor.agency, { limit: 100 }).rows, eventCount: this.eventPage(actor.agency, { limit: 1 }).total, sources: this.list(actor.agency, 'source'), alarms: this.alarms(actor.agency), shifts: this.list(actor.agency, 'shift'), audit: this.timeline(actor.agency, null, 100), capabilities: { roadNetwork: this.roadNetwork ? { source: this.roadNetwork.source, revision: this.roadNetwork.revision, segments: this.roadNetwork.features.length } : null, physicalControl: this.mode === 'live' && devices.some(d => d.controllable), simulation: this.mode === 'training' } };
  }
  eventPage(agency, { q = '', offset = 0, limit = 50 } = {}) {
    offset = Number(offset); limit = Number(limit);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200 || typeof q !== 'string' || q.length > 200) fail(400, 'Invalid source-page query.');
    const search = '%' + q.toLowerCase().replace(/[\\%_]/g, '\\$&') + '%';
    const filter = "agency=? AND kind='event' AND (lower(json_extract(data,'$.title')) LIKE ? ESCAPE '\\' OR lower(json_extract(data,'$.route')) LIKE ? ESCAPE '\\' OR lower(json_extract(data,'$.jurisdiction')) LIKE ? ESCAPE '\\' OR lower(json_extract(data,'$.sourceId')) LIKE ? ESCAPE '\\')";
    const values = [agency, search, search, search, search];
    const total = this.db.prepare('SELECT COUNT(*) AS n FROM atms_entities WHERE ' + filter).get(...values).n;
    const rows = this.db.prepare('SELECT data FROM atms_entities WHERE ' + filter + ' ORDER BY rowid DESC LIMIT ? OFFSET ?').all(...values, limit, offset).map(r => JSON.parse(r.data));
    return { total, offset, limit, rows };
  }
  incidentReport(actor, id) {
    requireRole(actor, 'viewer');
    const incident = this.need(actor.agency, 'incident', id);
    return { product: 'PurposeBuilt ATMS', mode: this.mode, exportedAt: this.iso(), agency: actor.agency, incident, feedDetails: this.get(actor.agency, 'feed-details', id), commands: this.list(actor.agency, 'command').filter(c => c.incidentId === id), messages: this.list(actor.agency, 'message').filter(m => m.incidentId === id), audit: this.timeline(actor.agency, id, 10000).reverse(), auditIntegrity: this.verifyAudit(actor.agency) };
  }
  seedTraining(agency = 'TRAINING') {
    if (this.mode !== 'training') fail(403, 'Training fixtures are prohibited in a live workspace.');
    if (this.list(agency, 'incident').length) {
      const offlineExample = this.get(agency, 'device', 'TRAIN-DMS-03');
      if (offlineExample && !offlineExample.trainingOffline) this.registerDevice(agency, { ...offlineExample, trainingOffline: true });
      return;
    }
    this.db.transaction(() => {
      const actor = { id: 'training.operator', name: 'Training operator', role: 'operator', agency };
      const now = this.iso();
      this.ingest(agency, { observedAt: now, sourceName: 'Synthetic training scenario', events: [
        { id: 'T-80-01', state: 'Iowa', corridor: 'I-80', direction: 'eastbound', eventType: 'closure', severity: 'high', description: 'TRAINING · Two-lane blockage east of Des Moines', latitude: 41.648, longitude: -93.48, updated: now },
        { id: 'T-35-02', state: 'Iowa', corridor: 'I-35', direction: 'southbound', eventType: 'incident', severity: 'moderate', description: 'TRAINING · Disabled truck on shoulder', latitude: 41.75, longitude: -93.58, updated: now },
        { id: 'T-80-03', state: 'Nebraska', corridor: 'I-80', direction: 'eastbound', eventType: 'incident', severity: 'minor', description: 'TRAINING · Debris reported near interchange', latitude: 41.24, longitude: -96.1, updated: now }
      ] });
      const incident = this.promoteEvent(actor, 'Iowa:T-80-01');
      this.changeIncident(actor, incident.id, { action: 'claim', version: incident.version, note: 'Training operator took responsibility for initial verification.' });
      this.promoteEvent(actor, 'Iowa:T-35-02');
      for (const [id, name, latitude, longitude, age] of [['TRAIN-DMS-01', 'I-80 EB · Upstream virtual sign', 41.628, -93.63, 0], ['TRAIN-DMS-02', 'I-35 SB · Virtual sign', 41.79, -93.6, 0], ['TRAIN-DMS-03', 'I-80 WB · Stale telemetry example', 41.64, -93.4, 3600000]]) this.registerDevice(agency, { id, name, type: 'dms', route: id === 'TRAIN-DMS-02' ? 'I-35' : 'I-80', latitude, longitude, driver: 'simulator', controlEnabled: true, trainingOffline: age > 0, lines: 3, columns: 18, displayedMessage: '', observedAt: new Date(this.now() - age).toISOString(), inventory: false });
      this.audit(this.system(agency), 'workspace', 'training.seeded', { fixture: 'I-80 / I-35 scenario', physicalDevices: false });
    }).immediate();
  }
  close() { this.db.close(); }
}
require('./readiness').install(Operations, { requireRole, Fault });
require('./collections').install(Operations, { requireRole, Fault });
require('./architecture').install(Operations, { requireRole, Fault });
require('./dru').install(Operations, { requireRole, Fault });
require('./video').install(Operations, { requireRole, Fault });
require('./geometry').install(Operations, { requireRole, Fault });
require('./feed-publisher').configure(Operations, { requireRole, Fault });
module.exports = { Operations, Fault, stable, digest, requireRole, ACTIVE_COMMANDS };

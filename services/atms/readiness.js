'use strict';
const { createHash, randomUUID } = require('node:crypto');

const CHECKS = [
  ['identity', 'Agency authorization, individual roles, and gateway authentication checked'],
  ['controller', 'Physical sign ID, direction, location, dimensions, and reserved slots verified'],
  ['readback', 'Approved test message and independent physical display readback witnessed'],
  ['expiry', 'Expiry, blanking, local override, and priority behavior witnessed'],
  ['recovery', 'Communication loss, uncertain delivery, and restart recovery exercised'],
  ['handover', 'Backup restore, operator training, support contact, and rollback documented']
];
const fingerprint = device => createHash('sha256').update(JSON.stringify(
  ['id', 'name', 'type', 'driver', 'controlEnabled', 'columns', 'lines', 'latitude', 'longitude', 'gatewayRevision', 'provisioningRevision'].map(k => device[k] ?? null)
)).digest('hex');

function install(Operations, { requireRole, Fault }) {
  const reject = (status, message) => { throw new Fault(status, message); };
  const text = (value, label, max = 2000) => typeof value === 'string' && value.trim().length >= 3 && value.length <= max ? value.trim() : reject(400, `${label} requires 3–${max} characters.`);
  Operations.prototype.installation = function (agency, device) {
    const record = this.get(agency, 'installation', device.id);
    return { deviceId: device.id, fingerprint: fingerprint(device), checks: CHECKS.map(([id, label]) => ({ id, label, ...(record?.fingerprint === fingerprint(device) ? record.checks[id] : null) })), record,
      ready: !!record?.acceptedAt && record.fingerprint === fingerprint(device) };
  };
  Operations.prototype.commission = function (actor, id, input) {
    requireRole(actor, 'operator');
    const device = this.need(actor.agency, 'device', id);
    if (!['gateway', 'simulator'].includes(device.driver)) reject(409, 'Public-feed inventory cannot be commissioned for control.');
    const current = this.get(actor.agency, 'installation', id);
    if ((current?.version || 0) !== input.version) reject(409, 'Installation changed. Refresh before recording evidence.');
    const hash = fingerprint(device);
    const record = current?.fingerprint === hash ? { ...current, checks: { ...current.checks } } : { id, fingerprint: hash, checks: {} };
    const note = text(input.note, 'Installation evidence');
    if (input.action === 'check') {
      if (!CHECKS.some(([key]) => key === input.checkId)) reject(400, 'Unknown commissioning check.');
      record.checks[input.checkId] = { note, by: actor.id, at: this.iso() };
      record.acceptedAt = null; record.acceptedBy = null;
    } else if (input.action === 'accept') {
      requireRole(actor, 'supervisor');
      if (!CHECKS.every(([key]) => record.checks[key])) reject(409, 'Record evidence for every commissioning check first.');
      if (Object.values(record.checks).some(c => c.by === actor.id)) reject(403, 'A separate supervisor must accept the installer evidence.');
      record.acceptedAt = this.iso(); record.acceptedBy = actor.id; record.acceptanceNote = note;
    } else if (input.action === 'revoke') {
      requireRole(actor, 'supervisor'); record.acceptedAt = null; record.acceptedBy = null; record.revocationNote = note;
    } else reject(400, 'Unknown installation action.');
    const result = this.put(actor.agency, 'installation', record, current?.version);
    this.audit(actor, id, 'installation.' + input.action, { checkId: input.checkId || null, note, fingerprint: hash, training: this.mode === 'training' });
    return result;
  };
  Operations.prototype.sendMessage = function (actor, input) {
    requireRole(actor, 'operator');
    const incident = this.need(actor.agency, 'incident', input.incidentId);
    const message = this.put(actor.agency, 'message', { id: randomUUID(), incidentId: incident.id, body: text(input.body, 'Message'), to: text(input.to, 'Recipient operator ID', 160), from: actor.id, createdAt: this.iso(), acknowledgedAt: null });
    this.audit(actor, incident.id, 'message.sent', { messageId: message.id, to: message.to, body: message.body });
    return message;
  };
  Operations.prototype.ackMessage = function (actor, id, input) {
    requireRole(actor, 'operator');
    const message = this.need(actor.agency, 'message', id);
    if (message.to !== actor.id) reject(403, 'Only the named recipient can acknowledge this message.');
    if (message.acknowledgedAt) reject(409, 'Message already acknowledged.');
    const result = this.put(actor.agency, 'message', { ...message, acknowledgedAt: this.iso(), acknowledgedBy: actor.id }, input.version);
    this.audit(actor, message.incidentId, 'message.acknowledged', { messageId: id }); return result;
  };
  Operations.prototype.saveTemplate = function (actor, input) {
    requireRole(actor, 'supervisor');
    const message = text(input.message, 'Sign wording', 200).toUpperCase();
    if (!/^[A-Z0-9 .,!?/():+'\-\n]+$/.test(message) || message.split('\n').some(line => !line.trim())) reject(400, 'Use non-empty plain-text sign lines.');
    const result = this.put(actor.agency, 'template', { id: randomUUID(), title: text(input.title, 'Template title', 100), message, guidance: text(input.guidance, 'Use conditions'), approvedBy: actor.id, approvedAt: this.iso() });
    this.audit(actor, result.id, 'template.approved', result); return result;
  };
}
module.exports = { install, CHECKS, fingerprint };

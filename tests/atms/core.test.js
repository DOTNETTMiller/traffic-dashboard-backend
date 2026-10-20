'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { commission } = require('./helpers.cjs');
const { Operations, requireRole } = require('../../services/atms/core');
const { Dispatcher, signature, verifyGateway } = require('../../services/atms/dispatcher');
const { actorFromUser, createRouter } = require('../../services/atms/router');
const { configuredGateway, provisionDevices } = require('../../services/atms/bootstrap');

const operator = { id: 'operator.one', name: 'Operator One', role: 'operator', agency: 'AGENCY-A' };
const second = { ...operator, id: 'operator.two', name: 'Operator Two' };
const supervisor = { ...operator, id: 'supervisor.one', name: 'Supervisor', role: 'supervisor' };
const observer = { ...operator, id: 'observer', role: 'viewer' };
const otherAgency = { ...operator, agency: 'AGENCY-B' };
const input = { title: 'Two lanes blocked on I-80', route: 'I-80', direction: 'eastbound', jurisdiction: 'Iowa', latitude: 41.6, longitude: -93.6, severity: 'major' };
function setup(t, mode = 'live', filename = ':memory:') {
  let clock = Date.parse('2026-10-17T15:00:00Z');
  const ops = new Operations({ mode, filename, now: () => clock });
  t.after(() => ops.close());
  return { ops, advance: ms => { clock += ms; }, now: () => clock };
}
function mutate(ops, actor, action, body, fn, key = randomUUID()) { return ops.mutation(actor, key, action, body, fn); }
function create(ops, actor = operator, body = input) { return mutate(ops, actor, 'create', body, () => ops.createIncident(actor, body)); }
function change(ops, actor, incident, body) { const data = { version: incident.version, note: 'Confirmed operational evidence.', ...body }; return mutate(ops, actor, 'change', data, () => ops.changeIncident(actor, incident.id, data)); }
function device(ops, mode = 'live') { const d = ops.registerDevice(operator.agency, { id: 'DMS-01', name: 'Upstream sign', driver: mode === 'training' ? 'simulator' : 'gateway', type: 'dms', controlEnabled: true, columns: 18, lines: 3, observedAt: ops.iso(), latitude: 41.6, longitude: -93.7 }); if (mode === 'live') commission(ops, operator, supervisor, d.id); return d; }
function commandFixture(ops, mode = 'live') {
  device(ops, mode);
  let incident = create(ops); incident = change(ops, operator, incident, { action: 'claim' });
  incident = change(ops, operator, incident, { action: 'transition', status: 'verified' });
  const body = { incidentId: incident.id, deviceId: 'DMS-01', message: 'INCIDENT AHEAD\nEXPECT DELAYS', reason: 'Verified upstream warning need.' };
  const command = mutate(ops, operator, 'command', body, () => ops.createCommand(operator, body));
  return { incident, command };
}
function approve(ops, command) { const body = { action: 'approve', version: command.version, note: 'Reviewed location, wording, and priority.' }; return mutate(ops, supervisor, 'approve', body, () => ops.changeCommand(supervisor, command.id, body)); }
const gatewayConfig = { agency: 'AGENCY-A', secret: 'test-secret-with-more-than-thirty-two-characters', url: 'https://gateway.example.test/commands' };
function evidence(ops, command, extras = {}) {
  const body = { commandId: command.id, deviceId: command.deviceId, status: 'readback', evidence: 'device-readback', message: command.message, observedAt: ops.iso(), nonce: randomUUID(), ...extras };
  const timestamp = String(ops.now());
  return { body, headers: { 'x-atms-timestamp': timestamp, 'x-atms-signature': signature(gatewayConfig.secret, timestamp, body) } };
}

test('training scenario persists explicit synthetic provenance and virtual devices', t => {
  const { ops } = setup(t, 'training'); ops.seedTraining();
  const w = ops.workspace({ ...operator, agency: 'TRAINING' });
  assert.equal(w.incidents.length, 2); assert.equal(w.events.length, 3);
  assert.ok(w.devices.every(d => d.driver === 'simulator')); assert.equal(w.capabilities.physicalControl, false);
  assert.ok(w.incidents.every(i => i.source.name === 'Synthetic training scenario'));
  assert.equal(ops.verifyAudit('TRAINING').valid, true);
  ops.seedTraining(); assert.equal(ops.list('TRAINING', 'incident').length, 2);
});
test('live workspaces cannot load training fixtures', t => { const { ops } = setup(t); assert.throws(() => ops.seedTraining(), /prohibited/); });
test('individual workspace membership is explicit, including viewers and administrators', () => {
  assert.throws(() => actorFromUser({ id: 1, username: 'unassigned', role: 'admin' }, { agency: 'A' }), /not been assigned/);
  assert.equal(actorFromUser({ id: 1, username: 'viewer', role: 'admin' }, { agency: 'A', viewers: ['viewer'] }).role, 'viewer');
  assert.equal(actorFromUser({ username: 'lead' }, { agency: 'A', supervisors: ['lead'] }).role, 'supervisor');
  assert.throws(() => requireRole({ ...operator, role: '__proto__' }, 'operator'), /identity/);
});
test('read-only observers cannot create or mutate operational records', t => {
  const { ops } = setup(t); assert.throws(() => create(ops, observer), /operator/);
  assert.throws(() => ops.createIncident(observer, input), /operator/);
});
test('incidents preserve agency isolation and reject missing coordinates', t => {
  const { ops } = setup(t); const i = create(ops);
  assert.throws(() => ops.need(otherAgency.agency, 'incident', i.id), /not found/);
  assert.equal(ops.workspace(otherAgency).incidents.length, 0);
  for (const value of [null, '', 'bad', 91]) assert.throws(() => create(ops, operator, { ...input, latitude: value }), /latitude/);
});
test('idempotent retries return the original result; changed payload conflicts', t => {
  const { ops } = setup(t), key = randomUUID();
  const fn = () => ops.createIncident(operator, input);
  const a = mutate(ops, operator, 'create', input, fn, key), b = mutate(ops, operator, 'create', input, fn, key);
  assert.equal(a.id, b.id); assert.equal(ops.list(operator.agency, 'incident').length, 1);
  assert.throws(() => mutate(ops, operator, 'create', { ...input, title: 'different' }, fn, key), /different action/);
});
test('optimistic concurrency prevents lost incident updates', t => {
  const { ops } = setup(t), i = create(ops);
  change(ops, operator, i, { action: 'claim' });
  assert.throws(() => change(ops, second, i, { action: 'claim' }), /changed/);
});
test('ownership cannot be taken by another operator without accepted handoff', t => {
  const { ops } = setup(t); let i = change(ops, operator, create(ops), { action: 'claim' });
  assert.throws(() => change(ops, second, i, { action: 'claim' }), /Another operator/);
  i = change(ops, operator, i, { action: 'offer_handoff', to: second.id });
  assert.equal(i.owner.id, operator.id);
  assert.throws(() => change(ops, supervisor, i, { action: 'accept_handoff' }), /another operator/);
  i = change(ops, second, i, { action: 'accept_handoff' });
  assert.equal(i.owner.id, second.id); assert.equal(i.handoff, null);
});
test('stage transitions require ownership, ordered milestones, and required tasks', t => {
  const { ops } = setup(t); let i = create(ops);
  assert.throws(() => change(ops, supervisor, i, { action: 'transition', status: 'verified' }), /owner/);
  i = change(ops, operator, i, { action: 'claim' });
  assert.throws(() => change(ops, operator, i, { action: 'transition', status: 'monitoring' }), /one stage/);
  for (const status of ['verified', 'responding', 'monitoring']) i = change(ops, operator, i, { action: 'transition', status });
  assert.throws(() => change(ops, operator, i, { action: 'transition', status: 'resolved' }), /required response/);
  for (const task of i.tasks.filter(t => t.required)) i = change(ops, operator, i, { action: 'task', taskId: task.id, status: 'complete' });
  i = change(ops, operator, i, { action: 'transition', status: 'resolved' });
  i = change(ops, operator, i, { action: 'transition', status: 'closed' });
  assert.ok(i.closedAt); assert.throws(() => change(ops, operator, i, { action: 'note' }), /Closed/);
});
test('failed transactions roll back entity writes and audit additions', t => {
  const { ops } = setup(t);
  assert.throws(() => mutate(ops, operator, 'invalid shift', {}, () => ops.createHandoff(operator, { to: operator.id, note: 'Self handoff must fail.' })), /different incoming/);
  assert.equal(ops.list(operator.agency, 'shift').length, 0); assert.equal(ops.timeline(operator.agency).length, 0);
});
test('source observation age is preserved and cannot be refreshed by a screen read', t => {
  const { ops, advance } = setup(t); const at = ops.iso();
  ops.ingest(operator.agency, { events: [], observedAt: at }); advance(16 * 60000);
  assert.equal(ops.workspace(operator).sources[0].observedAt, at);
  assert.ok(ops.alarms(operator.agency).some(a => a.id === 'source:stale'));
});
test('duplicate and malformed source IDs are counted without silently overwriting', t => {
  const { ops } = setup(t);
  const source = ops.ingest(operator.agency, { observedAt: ops.iso(), events: [null, { state: 'IA', id: 'same', description: 'One' }, { state: 'IA', id: 'same', description: 'Two' }] });
  assert.equal(source.events, 1); assert.equal(source.rejected, 2); assert.equal(ops.list(operator.agency, 'event')[0].title, 'One');
});
test('promoting source events is idempotent; source disappearance never closes an incident', t => {
  const { ops, advance } = setup(t);
  ops.ingest(operator.agency, { observedAt: ops.iso(), events: [{ ...input, id: 'source-1', state: 'IA', description: input.title }] });
  const i = mutate(ops, operator, 'promote', {}, () => ops.promoteEvent(operator, 'IA:source-1'));
  assert.equal(ops.promoteEvent(operator, 'IA:source-1').id, i.id);
  advance(1000); ops.ingest(operator.agency, { observedAt: ops.iso(), events: [] });
  assert.equal(ops.need(operator.agency, 'incident', i.id).status, 'reported');
  assert.ok(ops.alarms(operator.agency).some(a => a.id === 'source-missing:' + i.id));
});
test('stale source promotion and out-of-order source snapshots are rejected', t => {
  const { ops, advance } = setup(t); const first = ops.iso();
  ops.ingest(operator.agency, { observedAt: first, events: [{ ...input, id: 0, state: 'IA', description: input.title }] });
  advance(16 * 60000); assert.throws(() => ops.promoteEvent(operator, 'IA:0'), /stale/);
  ops.ingest(operator.agency, { observedAt: ops.iso(), events: [] });
  assert.throws(() => ops.ingest(operator.agency, { observedAt: first, events: [] }), /older source/);
});
test('public device inventories cannot acquire command authority through source fields', t => {
  const { ops } = setup(t);
  ops.ingest(operator.agency, { events: [], observedAt: ops.iso(), devices: [{ id: 'public', state: 'IA', deviceType: 'dms', coordinates: [-93, 41], driver: 'gateway', controlEnabled: true, updated: ops.iso() }] });
  const d = ops.list(operator.agency, 'device')[0]; assert.equal(d.driver, 'readonly'); assert.ok(ops.controlReason(d));
});
test('live devices require recent field telemetry before command creation', t => {
  const { ops, advance } = setup(t); const { incident } = commandFixture(ops);
  advance(121000);
  assert.throws(() => ops.createCommand(operator, { incidentId: incident.id, deviceId: 'DMS-01', message: 'TEST', reason: 'Review warning' }), /telemetry/);
});
test('plain-text sign capability and emergency priority constraints are enforced', t => {
  const { ops } = setup(t); const { incident } = commandFixture(ops);
  const body = { incidentId: incident.id, deviceId: 'DMS-01', reason: 'Testing formatting boundaries.' };
  for (const message of ['[pt10o]DANGER', 'X'.repeat(19), 'ONE\nTWO\nTHREE\nFOUR']) assert.throws(() => ops.createCommand(operator, { ...body, message }), /plain text/);
  assert.throws(() => ops.createCommand(operator, { ...body, message: 'TEST', priority: 1 }), /supervisor/);
  assert.throws(() => ops.createCommand(operator, { ...body, message: 'TEST', ttlMinutes: 0 }), /1–60/);
});
test('commands require independent supervisor approval; cancellation cannot conceal dispatch', t => {
  const { ops } = setup(t); const { command } = commandFixture(ops);
  assert.throws(() => ops.changeCommand({ ...operator, role: 'supervisor' }, command.id, { action: 'approve', version: command.version, note: 'Self approval attempt' }), /different supervisor/);
  assert.throws(() => ops.changeCommand(second, command.id, { action: 'approve', version: command.version, note: 'Operator approval attempt' }), /supervisor/);
  approve(ops, command); const [dispatch] = ops.takeDispatches();
  assert.throws(() => ops.changeCommand(operator, command.id, { action: 'cancel', version: dispatch.command.version, note: 'Cancel after dispatch' }), /reconciliation/);
});
test('conflicting queued commands on a device cannot both be approved', t => {
  const { ops } = setup(t); const { command, incident } = commandFixture(ops); approve(ops, command);
  const secondCommand = ops.createCommand(operator, { incidentId: incident.id, deviceId: 'DMS-01', message: 'ANOTHER MESSAGE', reason: 'Second request review.' });
  assert.throws(() => approve(ops, secondCommand), /outstanding command/);
});
test('HTTP gateway acceptance does not acknowledge or verify physical sign state', async t => {
  const { ops } = setup(t); const { command } = commandFixture(ops); approve(ops, command);
  let sent = 0; const dispatcher = new Dispatcher(ops, { gateway: gatewayConfig, send: async () => { sent++; } });
  await dispatcher.tick();
  const c = ops.need(operator.agency, 'command', command.id);
  assert.equal(sent, 1); assert.equal(c.status, 'dispatching'); assert.equal(c.verifiedAt, null); assert.equal(c.acknowledgedAt, null);
});
test('training dispatch produces a simulated result and never sends through a gateway', async t => {
  const { ops } = setup(t, 'training'); const { command } = commandFixture(ops, 'training'); approve(ops, command);
  let sent = false; const dispatcher = new Dispatcher(ops, { send: async () => { sent = true; } }); await dispatcher.tick();
  const c = ops.need(operator.agency, 'command', command.id);
  assert.equal(c.status, 'simulated'); assert.equal(c.verifiedAt, null); assert.ok(c.simulatedAt); assert.equal(sent, false);
});
test('signed gateway evidence verifies exact device readback and rejects replay', async t => {
  const { ops } = setup(t); const { command } = commandFixture(ops); approve(ops, command); ops.takeDispatches();
  const proof = evidence(ops, command);
  const result = verifyGateway(ops, gatewayConfig, proof.headers, proof.body);
  assert.equal(result.status, 'verified'); assert.ok(result.verifiedAt);
  assert.throws(() => verifyGateway(ops, gatewayConfig, proof.headers, proof.body), /already received/);
});
test('unsigned, tampered, wrong-device, and stale gateway evidence cannot verify commands', t => {
  const { ops, advance } = setup(t); const { command } = commandFixture(ops); approve(ops, command); ops.takeDispatches();
  const proof = evidence(ops, command);
  assert.throws(() => verifyGateway(ops, gatewayConfig, {}, proof.body), /signature/);
  assert.throws(() => verifyGateway(ops, gatewayConfig, proof.headers, { ...proof.body, message: 'TAMPERED' }), /signature/);
  const wrong = evidence(ops, command, { deviceId: 'another' }); assert.throws(() => verifyGateway(ops, gatewayConfig, wrong.headers, wrong.body), /does not match/);
  advance(301000); assert.throws(() => verifyGateway(ops, gatewayConfig, proof.headers, proof.body), /timestamp/);
  assert.notEqual(ops.need(operator.agency, 'command', command.id).status, 'verified');
});
test('mismatched nonblank readback stays uncertain; confirmed blank clears uncertainty', t => {
  const { ops } = setup(t); const { command } = commandFixture(ops); approve(ops, command); ops.takeDispatches();
  let p = evidence(ops, command, { message: 'UNEXPECTED MESSAGE' });
  assert.equal(verifyGateway(ops, gatewayConfig, p.headers, p.body).status, 'unknown');
  p = evidence(ops, command, { message: '' }); assert.equal(verifyGateway(ops, gatewayConfig, p.headers, p.body).status, 'cleared');
});
test('training evidence cannot mark a live command physically verified', t => {
  const { ops } = setup(t); const { command } = commandFixture(ops); approve(ops, command); ops.takeDispatches();
  assert.throws(() => ops.gatewayEvent(operator.agency, evidence(ops, command).body, { simulation: true }), /cannot confirm/);
});
test('timeout produces an alarm and no automatic resend', async t => {
  const { ops, advance } = setup(t); const { command } = commandFixture(ops); approve(ops, command);
  let count = 0; const d = new Dispatcher(ops, { gateway: gatewayConfig, send: async () => count++ });
  await d.tick(); advance(31000); await d.tick(); await d.tick();
  assert.equal(count, 1); assert.equal(ops.need(operator.agency, 'command', command.id).status, 'timed_out');
  assert.ok(ops.alarms(operator.agency).some(a => a.id === 'command:' + command.id));
});
test('restart recovery preserves uncertainty rather than replaying in-flight commands', t => {
  const { ops } = setup(t); const { command } = commandFixture(ops); approve(ops, command); ops.takeDispatches();
  ops.recoverDispatches(); assert.equal(ops.need(operator.agency, 'command', command.id).status, 'unknown'); assert.equal(ops.takeDispatches().length, 0);
});
test('expired pending requests are not dispatched, and verified-message expiry is unconfirmed', t => {
  const { ops, advance } = setup(t); const { command } = commandFixture(ops); approve(ops, command);
  advance(16 * 60000); assert.equal(ops.takeDispatches().length, 0); assert.equal(ops.need(operator.agency, 'command', command.id).status, 'expired');
});
test('confirmed live displays remain outstanding after their validity period', t => {
  const { ops, advance } = setup(t); const { command } = commandFixture(ops); approve(ops, command); ops.takeDispatches();
  const p = evidence(ops, command); verifyGateway(ops, gatewayConfig, p.headers, p.body);
  advance(16 * 60000); ops.takeDispatches();
  assert.equal(ops.need(operator.agency, 'command', command.id).status, 'expiry_unconfirmed');
});
test('signed telemetry can refresh only explicitly provisioned gateway devices', t => {
  const { ops } = setup(t); device(ops);
  const body = { kind: 'telemetry', deviceId: 'DMS-01', observedAt: ops.iso(), message: '', nonce: randomUUID() };
  const timestamp = String(ops.now()); const headers = { 'x-atms-timestamp': timestamp, 'x-atms-signature': signature(gatewayConfig.secret, timestamp, body) };
  assert.equal(verifyGateway(ops, gatewayConfig, headers, body).observedAt, body.observedAt);
  const wrong = { ...body, deviceId: 'unconfigured', nonce: randomUUID() };
  assert.throws(() => verifyGateway(ops, gatewayConfig, { ...headers, 'x-atms-signature': signature(gatewayConfig.secret, timestamp, wrong) }, wrong), /not found/);
});
test('command gateway delivery errors leave outcome uncertain', async t => {
  const { ops } = setup(t); const { command } = commandFixture(ops); approve(ops, command);
  const d = new Dispatcher(ops, { gateway: gatewayConfig, send: async () => { throw new Error('Connection lost after send'); } }); await d.tick();
  assert.equal(ops.need(operator.agency, 'command', command.id).status, 'unknown');
});
test('shift briefing acceptance is restricted to its intended incoming identity', t => {
  const { ops } = setup(t); create(ops);
  const shift = mutate(ops, operator, 'shift', {}, () => ops.createHandoff(operator, { to: second.id, note: 'Review upstream messages and open incidents.' }));
  assert.equal(shift.incidentIds.length, 1);
  assert.throws(() => ops.acceptShift(supervisor, shift.id, { version: shift.version, note: 'Wrong identity' }), /another operator/);
  const result = mutate(ops, second, 'accept', {}, () => ops.acceptShift(second, shift.id, { version: shift.version, note: 'Reviewed open incidents and priorities.' }));
  assert.equal(result.acceptedBy, second.id);
});
test('alarm acknowledgment and supervisor shelving preserve underlying conditions', t => {
  const { ops } = setup(t); create(ops); const alarm = ops.alarms(operator.agency).find(a => a.id.startsWith('unowned:'));
  assert.throws(() => ops.acknowledgeAlarm(operator, alarm.id, { note: 'Shelve attempt', shelveMinutes: 15 }), /supervisor/);
  const reviewed = mutate(ops, operator, 'alarm', {}, () => ops.acknowledgeAlarm(operator, alarm.id, { version: alarm.version, note: 'Reviewing assignment now.' }));
  assert.ok(ops.alarms(operator.agency).some(a => a.id === alarm.id && a.acknowledgedAt));
  const shelved = mutate(ops, supervisor, 'shelve', {}, () => ops.acknowledgeAlarm(supervisor, alarm.id, { version: reviewed.version, note: 'Coordinating assignment during shift.', shelveMinutes: 15 }));
  assert.ok(shelved.shelvedUntil); assert.equal(ops.alarms(operator.agency).find(a => a.id === alarm.id).shelved, true);
});
test('audit is append-only and tampering within the retained chain is detectable', t => {
  const { ops } = setup(t); create(ops); assert.equal(ops.verifyAudit(operator.agency).valid, true);
  assert.throws(() => ops.db.prepare('UPDATE atms_audit SET action=?').run('forged'), /append-only/);
  assert.throws(() => ops.db.prepare('DELETE FROM atms_audit').run(), /append-only/);
  ops.db.exec('DROP TRIGGER atms_audit_no_update'); ops.db.prepare('UPDATE atms_audit SET action=?').run('forged');
  assert.equal(ops.verifyAudit(operator.agency).valid, false);
});
test('reports include provenance, operational tasks, commands, and audit integrity', t => {
  const { ops } = setup(t); const { incident } = commandFixture(ops);
  const report = ops.incidentReport(operator, incident.id);
  assert.equal(report.mode, 'live'); assert.equal(report.commands.length, 1); assert.ok(report.incident.source); assert.ok(report.incident.tasks.length); assert.equal(report.auditIntegrity.valid, true);
  assert.throws(() => ops.incidentReport(otherAgency, incident.id), /not found/);
});
test('persistent mode metadata prevents training/live database crossover', t => {
  const filename = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atms-mode-')), 'test.sqlite');
  const a = new Operations({ filename, mode: 'training' }); a.close();
  assert.throws(() => new Operations({ filename, mode: 'live' }), /separate databases/);
});
test('gateway configuration requires HTTPS and an explicit agency and long secret', () => {
  assert.equal(configuredGateway({}), null);
  assert.throws(() => configuredGateway({ ATMS_GATEWAY_URL: 'http://example.test', ATMS_GATEWAY_SECRET: 'short' }), /requires HTTPS/);
  assert.throws(() => configuredGateway({ ATMS_GATEWAY_URL: 'https://example.test?key=secret', ATMS_GATEWAY_SECRET: 'x'.repeat(40), ATMS_AGENCY: 'A' }), /requires HTTPS/);
});

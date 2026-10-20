'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { commission } = require('./helpers.cjs');
const { Operations } = require('../../services/atms/core');
const { Dispatcher, signature, verifyGateway } = require('../../services/atms/dispatcher');
const actor = { id: 'operator', name: 'Operator', role: 'operator', agency: 'A' };
const supervisor = { ...actor, id: 'supervisor', role: 'supervisor' };
const initial = { title: 'Test incident', route: 'I-80', latitude: 41.6, longitude: -93.6 };
function setup(t, mode = 'live') {
  let time = Date.parse('2026-10-18T01:00:00Z');
  const ops = new Operations({ mode, now: () => time }); t.after(() => ops.close());
  return { ops, advance: ms => { time += ms; } };
}
function mutate(ops, user, fn) { return ops.mutation(user, randomUUID(), 'test', {}, fn); }
function create(ops) { return mutate(ops, actor, () => ops.createIncident(actor, initial)); }
function change(ops, i, action, extra = {}) { return mutate(ops, actor, () => ops.changeIncident(actor, i.id, { version: i.version, action, note: 'Test operational evidence', ...extra })); }
function liveCommand(ops) {
  let i = change(ops, create(ops), 'claim'); i = change(ops, i, 'transition', { status: 'verified' });
  ops.registerDevice('A', { id: 'SIGN', name: 'Sign', type: 'dms', driver: 'gateway', controlEnabled: true, observedAt: ops.iso(), lines: 3, columns: 18 });
  commission(ops, actor, supervisor, 'SIGN');
  const c = mutate(ops, actor, () => ops.createCommand(actor, { incidentId: i.id, deviceId: 'SIGN', message: 'INCIDENT AHEAD', reason: 'Test message' }));
  mutate(ops, supervisor, () => ops.changeCommand(supervisor, c.id, { action: 'approve', version: c.version, note: 'Reviewed synthetic evidence.' }));
  ops.takeDispatches(); return { i, c };
}
test('source search is paginated, treats wildcard characters literally, and isolates agencies', t => {
  const { ops } = setup(t);
  ops.ingest('A', { observedAt: ops.iso(), events: Array.from({ length: 125 }, (_, n) => ({ id: String(n), state: 'IA', corridor: n === 0 ? '100% route' : 'I-80', description: 'Report ' + n, latitude: 41, longitude: -93 })) });
  const a = ops.eventPage('A', { limit: 50 }), b = ops.eventPage('A', { offset: 50, limit: 50 });
  assert.equal(a.total, 125); assert.equal(a.rows.length, 50); assert.ok(!a.rows.some(x => b.rows.some(y => y.id === x.id)));
  assert.equal(ops.eventPage('A', { q: '%' }).total, 1); assert.equal(ops.eventPage('B').total, 0);
  assert.throws(() => ops.eventPage('A', { limit: 1000 }), /Invalid/);
});
test('empty and partially failed source batches raise review conditions', t => {
  const { ops } = setup(t);
  ops.ingest('A', { events: [], observedAt: ops.iso(), failedSources: 3 });
  const alarms = ops.alarms('A');
  assert.ok(alarms.some(a => a.id === 'source:empty'));
  assert.ok(alarms.some(a => a.id === 'source:partial'));
});
test('blank and nonnumeric source coordinates remain unknown instead of becoming 0,0', t => {
  const { ops } = setup(t);
  ops.ingest('A', { observedAt: ops.iso(), events: [{ id: 'blank', latitude: '', longitude: ' ' }, { id: 'bool', latitude: true, longitude: false }, { id: {}, latitude: 0, longitude: 0 }] });
  assert.equal(ops.list('A', 'event').length, 2);
  for (const e of ops.list('A', 'event')) { assert.equal(e.latitude, null); assert.equal(e.longitude, null); }
  assert.throws(() => ops.promoteEvent(actor, 'unknown:blank'), /coordinates/);
});
test('an alarm that clears and recurs receives a new unacknowledged occurrence', t => {
  const { ops, advance } = setup(t); ops.ingest('A', { events: [], observedAt: ops.iso() }); advance(16 * 60000);
  const a = ops.alarms('A').find(a => a.id === 'source:stale');
  mutate(ops, actor, () => ops.acknowledgeAlarm(actor, a.id, { version: a.version, note: 'Investigating publisher.' }));
  ops.ingest('A', { events: [], observedAt: ops.iso() }); assert.ok(!ops.alarms('A').some(a => a.id === 'source:stale'));
  advance(16 * 60000); const b = ops.alarms('A').find(a => a.id === 'source:stale');
  assert.notEqual(a.occurrenceId, b.occurrenceId); assert.equal(b.acknowledgedAt, null);
});
test('unverified incidents cannot authorize device commands', t => {
  const { ops } = setup(t); const i = change(ops, create(ops), 'claim');
  ops.registerDevice('A', { id: 'SIGN', name: 'Sign', type: 'dms', driver: 'gateway', controlEnabled: true, observedAt: ops.iso(), lines: 3, columns: 18 });
  commission(ops, actor, supervisor, 'SIGN');
  const c = mutate(ops, actor, () => ops.createCommand(actor, { incidentId: i.id, deviceId: 'SIGN', message: 'TEST', reason: 'Prepare a request.' }));
  assert.throws(() => mutate(ops, supervisor, () => ops.changeCommand(supervisor, c.id, { action: 'approve', version: c.version, note: 'Attempt before verification.' })), /Verify the incident/);
});
test('fresh signed telemetry that conflicts with a verified display invalidates certainty', t => {
  const { ops, advance } = setup(t); const { c } = liveCommand(ops);
  ops.gatewayEvent('A', { commandId: c.id, deviceId: c.deviceId, status: 'readback', evidence: 'device-readback', message: c.message, observedAt: ops.iso() });
  advance(1000);
  const gateway = { agency: 'A', secret: 'test-secret-that-is-longer-than-thirty-two-characters' };
  const body = { kind: 'telemetry', deviceId: 'SIGN', observedAt: ops.iso(), message: 'MANUAL OVERRIDE', nonce: randomUUID() };
  const timestamp = String(ops.now());
  verifyGateway(ops, gateway, { 'x-atms-timestamp': timestamp, 'x-atms-signature': signature(gateway.secret, timestamp, body) }, body);
  assert.equal(ops.need('A', 'command', c.id).status, 'unknown');
});
test('restart requires new readback for previously verified physical commands', t => {
  const { ops } = setup(t); const { c } = liveCommand(ops);
  ops.gatewayEvent('A', { commandId: c.id, deviceId: c.deviceId, status: 'readback', evidence: 'device-readback', message: c.message, observedAt: ops.iso() });
  ops.recoverDispatches(); assert.equal(ops.need('A', 'command', c.id).status, 'unknown');
});
test('an outstanding physical display blocks resolution after all required tasks are complete', t => {
  const { ops } = setup(t); let { i, c } = liveCommand(ops);
  ops.gatewayEvent('A', { commandId: c.id, deviceId: c.deviceId, status: 'readback', evidence: 'device-readback', message: c.message, observedAt: ops.iso() });
  for (const task of i.tasks.filter(t => t.required)) i = change(ops, i, 'task', { taskId: task.id, status: 'complete' });
  i = change(ops, i, 'transition', { status: 'responding' }); i = change(ops, i, 'transition', { status: 'monitoring' });
  assert.throws(() => change(ops, i, 'transition', { status: 'resolved' }), /outstanding device/);
});
test('simulator heartbeat preserves an intentionally offline device and its disabled control', async t => {
  const { ops, advance } = setup(t, 'training'); ops.seedTraining(); const d = new Dispatcher(ops);
  advance(3600000); await d.tick();
  assert.equal(ops.controlReason(ops.need('TRAINING', 'device', 'TRAIN-DMS-01')), null);
  assert.match(ops.controlReason(ops.need('TRAINING', 'device', 'TRAIN-DMS-03')), /telemetry/);
});
test('SQLite online backup restores operational records and the audit chain', async t => {
  const { ops } = setup(t); const i = create(ops);
  const destination = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atms-backup-')), 'snapshot.sqlite');
  await ops.db.backup(destination);
  const recovered = new Operations({ filename: destination, mode: 'live' }); t.after(() => recovered.close());
  assert.equal(recovered.need('A', 'incident', i.id).number, i.number); assert.equal(recovered.verifyAudit('A').valid, true);
  assert.equal(recovered.db.pragma('integrity_check', { simple: true }), 'ok');
});

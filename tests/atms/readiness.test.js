'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Operations } = require('../../services/atms/core');
const { commission } = require('./helpers.cjs');
const a = { id: 'installer', agency: 'A', role: 'operator' }, s = { ...a, id: 'reviewer', role: 'supervisor' };
function setup(t) { const ops = new Operations(); t.after(() => ops.close()); const d = ops.registerDevice('A', { id: 'DMS', name: 'Sign', type: 'dms', driver: 'gateway', controlEnabled: true, columns: 18, lines: 3, observedAt: ops.iso() }); return { ops, d }; }
test('live acceptance fails closed, requires complete evidence and a separate supervisor', t => {
  const { ops, d } = setup(t);
  assert.match(ops.controlReason(d, 'A'), /Installation/);
  assert.throws(() => ops.commission(s, d.id, { action: 'accept', note: 'Test acceptance', version: 0 }), /every/);
  commission(ops, a, s, d.id); assert.equal(ops.controlReason(d, 'A'), null);
  assert.throws(() => ops.commission(a, d.id, { action: 'accept', note: 'Test acceptance', version: 7 }), /supervisor/);
  assert.throws(() => ops.commission({ ...a, role: 'supervisor' }, d.id, { action: 'accept', note: 'Self acceptance', version: 7 }), /separate/);
  assert.equal(ops.installation('B', d).ready, false);
});
test('configuration changes and replaced evidence invalidate acceptance but telemetry does not', t => {
  const { ops, d } = setup(t); commission(ops, a, s, d.id);
  let next = ops.registerDevice('A', { ...d, observedAt: ops.iso(), displayedMessage: 'TEST' });
  assert.equal(ops.installation('A', next).ready, true);
  next = ops.registerDevice('A', { ...next, columns: 20 }); assert.equal(ops.installation('A', next).ready, false);
  commission(ops, a, s, d.id);
  ops.commission(a, d.id, { action: 'check', checkId: 'identity', note: 'Updated field record', version: ops.get('A', 'installation', d.id).version });
  assert.equal(ops.installation('A', next).ready, false);
  assert.equal(ops.verifyAudit('A').valid, true);
});
test('revocation between approval and dispatch prevents field delivery', t => {
  const { ops, d } = setup(t); commission(ops, a, s, d.id);
  let i = ops.createIncident(a, { title: 'Test incident', route: 'I-80', latitude: 41, longitude: -93 });
  i = ops.changeIncident(a, i.id, { action: 'claim', note: 'Claimed incident', version: i.version });
  i = ops.changeIncident(a, i.id, { action: 'transition', status: 'verified', note: 'Verified incident', version: i.version });
  const c = ops.createCommand(a, { incidentId: i.id, deviceId: d.id, message: 'TEST', reason: 'Test command' });
  ops.changeCommand(s, c.id, { action: 'approve', version: c.version, note: 'Reviewed command' });
  ops.commission(s, d.id, { action: 'revoke', version: 7, note: 'Field fault found' });
  assert.equal(ops.takeDispatches().length, 0); assert.equal(ops.need('A', 'command', c.id).status, 'failed');
});
test('incident messages acknowledge only the intended recipient and remain agency isolated', t => {
  const { ops } = setup(t); const i = ops.createIncident(a, { title: 'Test incident', route: 'I-80', latitude: 41, longitude: -93 });
  const m = ops.sendMessage(a, { incidentId: i.id, to: s.id, body: 'Please confirm closure limits.' });
  assert.throws(() => ops.ackMessage(a, m.id, { version: m.version }), /named recipient/);
  assert.throws(() => ops.ackMessage({ ...s, agency: 'B' }, m.id, { version: m.version }), /not found/);
  assert.ok(ops.ackMessage(s, m.id, { version: m.version }).acknowledgedAt);
  assert.throws(() => ops.ackMessage(s, m.id, { version: m.version }), /already/);
});
test('approved wording is server-resolved and still checked against sign dimensions', t => {
  const { ops, d } = setup(t); commission(ops, a, s, d.id);
  assert.throws(() => ops.saveTemplate(a, { title: 'Test', message: 'TEST', guidance: 'Test only' }), /supervisor/);
  const template = ops.saveTemplate(s, { title: 'Test', message: 'INCIDENT AHEAD', guidance: 'Use only after location verification.' });
  let i = ops.createIncident(a, { title: 'Test incident', route: 'I-80', latitude: 41, longitude: -93 });
  i = ops.changeIncident(a, i.id, { action: 'claim', version: i.version, note: 'Claimed incident' });
  const c = ops.createCommand(a, { incidentId: i.id, deviceId: d.id, templateId: template.id, message: 'TAMPERED', reason: 'Test template' });
  assert.equal(c.message, template.message); assert.equal(c.templateId, template.id);
  const wide = ops.saveTemplate(s, { title: 'Too wide', message: 'THIS MESSAGE IS TOO WIDE FOR THE SIGN', guidance: 'Test dimensions' });
  assert.throws(() => ops.createCommand(a, { incidentId: i.id, deviceId: d.id, templateId: wide.id, reason: 'Test dimensions' }), /plain text/);
});
test('preflight is read-only and reports incomplete installations without exposing secrets', () => {
  const { inspect } = require('../../products/atms/preflight.cjs');
  const report = inspect({ ATMS_MODE: 'live', ATMS_AGENCY: 'A', ATMS_JWT_SECRET: 'secret-that-must-not-appear-in-output', ATMS_GATEWAY_SECRET: 'secret-that-must-not-appear-in-output' });
  assert.equal(report.ready, false); assert.ok(report.checks.some(c => c.id === 'database' && !c.ok));
  assert.equal(JSON.stringify(report).includes('secret-that-must-not-appear'), false);
  assert.equal(report.checks.find(c => c.id === 'separate-secrets').ok, false);
});
test('provisioning detects gateway changes and disables devices removed from the manifest', t => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const { provisionDevices } = require('../../services/atms/bootstrap');
  const { ops } = setup(t);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atms-commission-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const config = path.join(dir, 'devices.json');
  fs.writeFileSync(config, JSON.stringify([{ id: 'DMS', name: 'Sign', type: 'dms', controlEnabled: true, columns: 18, lines: 3, latitude: 41, longitude: -93 }]));
  const env = { ATMS_DEVICE_CONFIG: config, ATMS_AGENCY: 'A' }, gateway = { agency: 'A', url: 'https://gateway.example/commands', secret: 'a'.repeat(32) };
  provisionDevices(ops, env, gateway); commission(ops, a, s, 'DMS');
  provisionDevices(ops, env, gateway); assert.equal(ops.installation('A', ops.get('A', 'device', 'DMS')).ready, true);
  provisionDevices(ops, env, { ...gateway, secret: 'b'.repeat(32) }); assert.equal(ops.installation('A', ops.get('A', 'device', 'DMS')).ready, false);
  fs.writeFileSync(config, '[]'); provisionDevices(ops, env, gateway); assert.equal(ops.get('A', 'device', 'DMS').controlEnabled, false);
});

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NtcipAdapter } = require('../../services/atms/ntcip/adapter');
const { runCompatibility, PROFILES, FIELD_REQUIREMENTS } = require('../../services/atms/ntcip/acceptance');
const { inspectController, benchConfig } = require('../../services/atms/ntcip/bench');
const { createEmulator } = require('../../services/atms/ntcip/emulator');

test('new and legacy peers pass the acceptance matrix without claiming field acceptance', { timeout: 30000 }, async () => {
  const report = await runCompatibility();
  assert.equal(report.result, 'passed', JSON.stringify(report.profiles.map(p => p.checks.filter(c => c.status === 'failed'))));
  assert.equal(report.synthetic, true);
  assert.equal(report.physicalInteroperability, 'not tested');
  assert.equal(report.profiles.length, PROFILES.length);
  assert.equal(report.checks, 48);
  assert.ok(report.profiles.every(p => p.fieldAcceptance.length === FIELD_REQUIREMENTS.length && p.fieldAcceptance.every(c => c.status === 'not tested' && c.evidence === null)));
  assert.equal(/community|authKey|privKey|training-only/.test(JSON.stringify(report)), false);
});
test('invalid security configuration never creates a session or downgrades', () => {
  const base = { host: '127.0.0.1', slot: 1, community: 'training' };
  for (const config of [
    { snmpVersion: 'auto' }, { snmpVersion: 1 }, { snmpVersion: '3' },
    { maxVarbinds: 0 }, { maxVarbinds: 17 },
    { snmpVersion: '3', user: { name: 'u', authProtocol: 'md5', authKey: 'long-test-auth', privProtocol: 'des', privKey: 'long-test-priv' } }
  ]) assert.throws(() => new NtcipAdapter({ ...base, ...config }));
});
test('truncated and substituted responses cannot masquerade as controller readback', async () => {
  // Exercise response validation independently of network implementation.
  for (const response of [[], [{ oid: 'unexpected', value: 4 }]]) {
    const fake = { session: { get: (_, callback) => callback(null, response) } };
    await assert.rejects(NtcipAdapter.prototype.request.call(fake, 'get', ['expected']));
  }
});
test('bench inspection only reads, excludes credentials and leaves field acceptance pending', async t => {
  const peer = await createEmulator({ snmpVersion: '1', maxVarbinds: 1 });
  t.after(() => peer.close());
  const input = { identity: { agency: 'TEST', deviceId: 'TEST-1', manufacturer: 'Synthetic', model: 'Local peer', firmware: 'test', ntcipEdition: '1203 v02 text subset' },
    controller: { host: '127.0.0.1', port: peer.port, slot: 1, snmpVersion: '1', communityEnv: 'TEST_CREDENTIAL' } };
  const report = await inspectController(input, { TEST_CREDENTIAL: peer.community });
  assert.equal(report.result, 'observed'); assert.equal(report.mode, 'read-only');
  assert.ok(peer.snapshot().trace.every(v => v.operation === 'GET'));
  assert.equal(peer.state.activations, 0);
  assert.ok(report.fieldAcceptance.every(v => v.status === 'not tested'));
  assert.equal(JSON.stringify(report).includes(peer.community), false);
  assert.equal(report.synthetic, undefined);
  assert.throws(() => benchConfig(input, {}), /credential environment variable/);
  assert.throws(() => benchConfig({ ...input, identity: { ...input.identity, firmware: '' } }), /identity/);
});
test('SNMPv3 wrong privacy key cannot read or activate', async t => {
  const peer = await createEmulator({ snmpVersion: '3' });
  const adapter = new NtcipAdapter({ host: '127.0.0.1', port: peer.port, slot: 1, snmpVersion: '3', timeout: 100,
    user: { ...peer.user, privKey: 'incorrect-privacy-key' } });
  t.after(async () => { adapter.close(); await peer.close(); });
  await assert.rejects(adapter.execute({ id: 'privacy-test', operation: 'message', message: 'TEST', priority: 3, expiresAt: new Date(Date.now() + 600000).toISOString() }), e => e.notApplied);
  assert.equal(peer.state.activations, 0);
});

'use strict';
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { NtcipAdapter } = require('./adapter');
const { createEmulator } = require('./emulator');

const PROFILES = Object.freeze([
  { id: 'legacy-v1', snmpVersion: '1', maxVarbinds: 1, lines: 3, columns: 18 },
  { id: 'installed-v2c', snmpVersion: '2c', maxVarbinds: 8, lines: 3, columns: 20 },
  { id: 'modern-v3', snmpVersion: '3', maxVarbinds: 8, lines: 4, columns: 24 }
]);
const FIELD_REQUIREMENTS = Object.freeze([
  'manufacturer-model-firmware-and-selected-mib-profile',
  'network-isolation-credentials-and-access-revocation',
  'reserved-slots-font-layout-and-expiry-blank-policy',
  'visible-display-matches-correlated-controller-readback',
  'local-control-higher-priority-and-other-manager-preserved',
  'lost-acknowledgment-no-replay-and-fresh-reconciliation',
  'power-cycle-partition-recovery-and-clock-behavior',
  'operator-approval-audit-and-agency-witness-signoff'
]);

async function runCompatibility() {
  const report = { schemaVersion: 1, startedAt: new Date().toISOString(), synthetic: true,
    physicalInteroperability: 'not tested', scope: 'NTCIP 1203 v02 character-matrix ASCII text subset',
    peers: { '1': 'independent bounded BER UDP peer', '2c': 'independent bounded BER UDP peer', '3': 'net-snmp USM agent; client and agent share security library' }, profiles: [] };
  for (const profile of PROFILES) {
    let clock = Date.now();
    const peer = await createEmulator({ ...profile, now: () => clock });
    const config = { host: '127.0.0.1', port: peer.port, community: peer.community, user: peer.user,
      snmpVersion: profile.snmpVersion, maxVarbinds: profile.maxVarbinds, slot: 1, timeout: 500, validationTimeout: 1500 };
    const adapter = new NtcipAdapter(config, { now: () => clock });
    const result = { ...profile, result: 'passed', checks: [], fieldAcceptance: FIELD_REQUIREMENTS.map(id => ({ id, status: 'not tested', evidence: null })) };
    report.profiles.push(result);
    const command = extra => ({ id: randomUUID(), operation: 'message', message: 'TEST ONLY\nEXPECT DELAYS', priority: 3, expiresAt: new Date(clock + 600000).toISOString(), ...extra });
    async function check(id, run) {
      peer.reset();
      const before = peer.state.activations;
      try {
        await run();
        result.checks.push({ id, status: 'passed', activations: peer.state.activations - before });
      } catch (error) {
        result.result = 'failed';
        result.checks.push({ id, status: 'failed', error: error.message, peerError: peer.state.lastError || null });
      }
    }
    try {
      await check('capability-discovery', async () => {
        const caps = await adapter.discover();
        assert.equal(caps.lines, profile.lines); assert.equal(caps.columns, profile.columns);
        assert.equal(caps.snmpVersion, profile.snmpVersion);
      });
      await check('activate-and-correlate-readback', async () => {
        const c = command(), before = peer.state.activations;
        const observation = await adapter.execute(c);
        assert.equal(observation.message, c.message); assert.equal(observation.owner, 'PB:' + c.id);
        assert.equal(peer.state.activations, before + 1);
      });
      await check('explicit-blank', async () => {
        await adapter.execute(command());
        assert.equal((await adapter.execute(command({ operation: 'blank', message: '' }))).message, '');
      });
      await check('controller-expiry', async () => {
        await adapter.execute(command()); clock += 600001;
        assert.equal((await adapter.read()).message, '');
        assert.equal((await adapter.read()).sourceMode, 14);
      });
      await check('overflow-and-unsupported-format-blocked', async () => {
        const before = peer.state.activations;
        for (const message of ['X'.repeat(profile.columns + 1), Array(profile.lines + 1).fill('X').join('\n'), '[g1]', 'CLOSÉ']) {
          await assert.rejects(adapter.execute(command({ message })), e => e.notApplied === true);
        }
        assert.equal(peer.state.activations, before);
      });
      await check('expired-command-blocked', async () => {
        const before = peer.state.activations;
        await assert.rejects(adapter.execute(command({ expiresAt: new Date(clock - 1).toISOString() })), e => e.notApplied === true);
        assert.equal(peer.state.activations, before);
      });
      await check('local-control-preserved', async () => {
        peer.setFault('local');
        await assert.rejects(adapter.execute(command()), e => e.notApplied && /local control/.test(e.message));
      });
      await check('higher-priority-preserved', async () => {
        peer.override(); await assert.rejects(adapter.execute(command()), /higher-priority/);
        assert.equal(peer.snapshot().message, 'LOCAL OVERRIDE');
      });
      await check('foreign-manager-slot-preserved', async () => {
        Object.assign(peer.state.slots.get(1), { owner: 'OTHER-MANAGER', status: 4 });
        await assert.rejects(adapter.execute(command()), /another manager/);
        assert.equal(peer.state.slots.get(1).owner, 'OTHER-MANAGER');
      });
      await check('active-slot-preserved', async () => {
        const c = command(); await adapter.execute(c);
        await assert.rejects(adapter.execute(command({ message: 'OTHER MESSAGE' })), /currently active/);
        assert.equal(peer.snapshot().message, c.message);
      });
      await check('controller-validation-blocked', async () => {
        const before = peer.state.activations;
        peer.setFault('validation'); await assert.rejects(adapter.execute(command()), e => e.notApplied === true);
        assert.equal(peer.state.activations, before);
      });
      await check('lost-ack-no-retry-fresh-reconciliation', async () => {
        const c = command(), before = peer.state.activations;
        peer.setFault('lost-ack'); await assert.rejects(adapter.execute(c), e => e.notApplied === false);
        assert.equal((await adapter.read()).owner, 'PB:' + c.id);
        assert.equal(peer.state.activations, before + 1);
      });
      await check('mismatch-never-confirmed', async () => {
        peer.setFault('mismatch'); await assert.rejects(adapter.execute(command()), e => !e.notApplied && /readback/.test(e.message));
      });
      await check('offline-never-confirmed', async () => {
        const before = peer.state.activations;
        peer.setFault('offline'); await assert.rejects(adapter.execute(command()), e => e.notApplied === true);
        assert.equal(peer.state.activations, before);
      });
      await check('wrong-credentials-rejected', async () => {
        const wrong = new NtcipAdapter({ ...config, timeout: 100, community: 'incorrect', user: peer.user && { ...peer.user, authKey: 'incorrect-auth-key' } });
        try { await assert.rejects(wrong.read()); } finally { wrong.close(); }
      });
      await check('no-protocol-downgrade', async () => {
        const wrong = new NtcipAdapter({ ...config, snmpVersion: profile.snmpVersion === '1' ? '2c' : '1', community: peer.community || 'incorrect', timeout: 100 });
        try { await assert.rejects(wrong.read()); } finally { wrong.close(); }
      });
    } finally { adapter.close(); await peer.close(); }
  }
  report.finishedAt = new Date().toISOString();
  report.result = report.profiles.every(p => p.result === 'passed') ? 'passed' : 'failed';
  report.checks = report.profiles.reduce((sum, p) => sum + p.checks.length, 0);
  report.sha256 = createHash('sha256').update(JSON.stringify(report)).digest('hex');
  return report;
}
module.exports = { PROFILES, FIELD_REQUIREMENTS, runCompatibility };

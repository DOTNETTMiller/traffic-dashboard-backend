'use strict';
const { createHash } = require('node:crypto');
const { createEmulator } = require('./emulator');
const { NtcipAdapter } = require('./adapter');
const { PROFILES } = require('./acceptance');
const { stable, Fault, requireRole } = require('../core');

class TrainingNtcipLab {
  constructor(ops) {
    if (ops.mode !== 'training') throw new Error('The protocol lab cannot run in a live workspace.');
    this.ops = ops; this.devices = new Map();
    ops.db.exec(`CREATE TABLE IF NOT EXISTS atms_ntcip_journal (
      command_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, state TEXT NOT NULL,
      result TEXT, at TEXT NOT NULL
    )`);
  }
  async start() {
    try {
      let profileIndex = 0;
      for (const device of this.ops.list('TRAINING', 'device')) {
        if (device.driver !== 'simulator') continue;
        const profile = PROFILES[profileIndex++ % PROFILES.length];
        const emulator = await createEmulator({ snmpVersion: profile.snmpVersion, maxVarbinds: profile.maxVarbinds, lines: device.lines, columns: device.columns, now: () => this.ops.now() });
        const adapter = new NtcipAdapter({ host: '127.0.0.1', port: emulator.port, community: emulator.community, user: emulator.user, snmpVersion: profile.snmpVersion, maxVarbinds: profile.maxVarbinds, slot: 1, timeout: 500 }, { now: () => this.ops.now() });
        if (device.trainingOffline) emulator.setFault('offline');
        this.devices.set(device.id, { emulator, adapter });
        this.ops.put('TRAINING', 'device', { ...device, protocol: `NTCIP 1203 / SNMPv${profile.snmpVersion} UDP emulator`, compatibilityProfile: profile.id, observedAt: null, communicationFault: 'Waiting for controller readback.' }, device.version);
      }
      await this.poll();
      return this;
    } catch (error) { await this.close(); throw error; }
  }
  async execute(command, device) {
    const entry = this.devices.get(device.id);
    if (!entry) throw new Error('No local emulator is provisioned for this sign.');
    const fingerprint = createHash('sha256').update(stable({ id: command.id, deviceId: command.deviceId, operation: command.operation, message: command.message, priority: command.priority, expiresAt: command.expiresAt })).digest('hex');
    const existing = this.ops.db.prepare('SELECT * FROM atms_ntcip_journal WHERE command_id=?').get(command.id);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('Command ID reused with a different payload.');
      // Even a completed result is not fresh readback. Never replay activation.
      throw new Error('Command already attempted; reconcile fresh controller readback.');
    }
    this.ops.db.prepare('INSERT INTO atms_ntcip_journal(command_id,fingerprint,state,at) VALUES (?,?,?,?)').run(command.id, fingerprint, 'started', this.ops.iso());
    try {
      // Alternate the two explicitly reserved slots; do not rewrite an active slot.
      const observed = await entry.adapter.read();
      entry.adapter.config.slot = observed.source.startsWith('040001') ? 2 : 1;
      const result = await entry.adapter.execute(command);
      const latest = this.ops.need('TRAINING', 'device', device.id);
      this.ops.put('TRAINING', 'device', { ...latest, commandTrace: entry.emulator.snapshot().trace.slice(-40) }, latest.version);
      this.ops.db.prepare('UPDATE atms_ntcip_journal SET state=?,result=? WHERE command_id=?').run('readback', JSON.stringify(result), command.id);
      return result;
    } catch (error) {
      const latest = this.ops.need('TRAINING', 'device', device.id);
      this.ops.put('TRAINING', 'device', { ...latest, commandTrace: entry.emulator.snapshot().trace.slice(-40) }, latest.version);
      this.ops.db.prepare('UPDATE atms_ntcip_journal SET state=?,result=? WHERE command_id=?').run(error.notApplied ? 'not_applied' : 'uncertain', JSON.stringify({ error: error.message }), command.id);
      throw error;
    }
  }
  async poll() {
    for (const [id, { emulator, adapter }] of this.devices) {
      let device = this.ops.need('TRAINING', 'device', id);
      try {
        const observation = await adapter.read();
        const caps = await adapter.discover();
        device = this.ops.put('TRAINING', 'device', { ...device, ...caps, displayedMessage: observation.message, observedAt: observation.observedAt, communicationFault: observation.mode !== 4 ? 'Controller local mode: central commands are blocked.' : null, protocolScenario: emulator.state.fault, controllerMode: observation.mode, controllerMinutesRemaining: observation.remaining, protocolTrace: emulator.snapshot().trace.slice(-24) }, device.version);
        for (const command of this.ops.list('TRAINING', 'command').filter(c => c.deviceId === id && ['simulated', 'dispatching', 'acknowledged', 'unknown', 'timed_out', 'expiry_unconfirmed'].includes(c.status))) {
          if (!this.ops.db.prepare('SELECT command_id FROM atms_ntcip_journal WHERE command_id=?').get(command.id)) continue;
          const matches = observation.message === command.message && (command.operation === 'blank' ? observation.source.startsWith('07') : observation.owner === 'PB:' + command.id && observation.sourceMode === 8);
          if (command.status === 'simulated' && matches) continue;
          if (!matches && observation.message === command.message) {
            if (command.status !== 'unknown') this.ops.serviceCommand('TRAINING', command, { status: 'unknown', failure: 'Matching text has a different controller owner/source. Command attribution is uncertain.' }, 'command.emulator_override');
            continue;
          }
          if (command.status === 'unknown' && command.readback === observation.message && !matches) continue;
          this.ops.gatewayEvent('TRAINING', { commandId: command.id, deviceId: id, status: 'readback', evidence: 'device-readback', message: observation.message, observedAt: observation.observedAt }, { simulation: true });
        }
      } catch (error) {
        const latest = this.ops.need('TRAINING', 'device', id);
        this.ops.put('TRAINING', 'device', { ...latest, communicationFault: 'Controller observation failed: ' + error.message, protocolScenario: emulator.state.fault }, latest.version);
        for (const command of this.ops.list('TRAINING', 'command').filter(c => c.deviceId === id && c.status === 'simulated')) this.ops.serviceCommand('TRAINING', command, { status: 'unknown', failure: 'Emulated controller observation is unavailable. Fresh readback is required.' }, 'command.emulator_observation_lost');
      }
    }
  }
  scenario(actor, id, input) {
    requireRole(actor, 'operator');
    if (actor.agency !== 'TRAINING') throw new Fault(403, 'This is a local training device.');
    const entry = this.devices.get(id);
    if (!entry) throw new Fault(404, 'Training controller not found.');
    if (input.action === 'override') entry.emulator.override('LOCAL OVERRIDE');
    else if (input.action === 'expire') entry.emulator.expire();
    else if (input.action === 'reset') entry.emulator.reset();
    else if (input.action === 'fault' && ['healthy', 'offline', 'local', 'validation', 'lost-ack', 'mismatch'].includes(input.fault)) entry.emulator.setFault(input.fault);
    else throw new Fault(400, 'Choose a supported emulator scenario.');
    this.ops.audit(actor, id, 'training.controller_scenario', { action: input.action, fault: input.fault || null });
    return { deviceId: id, action: input.action, fault: entry.emulator.state.fault };
  }
  async close() {
    for (const { adapter, emulator } of this.devices.values()) { adapter.close(); await emulator.close(); }
    this.devices.clear();
  }
}
module.exports = { TrainingNtcipLab };

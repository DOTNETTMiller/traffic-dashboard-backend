'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { NtcipAdapter } = require('../../services/atms/ntcip/adapter');
const { createEmulator } = require('../../services/atms/ntcip/emulator');
const { activation, crc16, toMulti, fromMulti, decodeMulti, OID, cell } = require('../../services/atms/ntcip/protocol');
const { Operations } = require('../../services/atms/core');
const { Dispatcher } = require('../../services/atms/dispatcher');
const { TrainingNtcipLab } = require('../../services/atms/ntcip/training-lab');

async function fixture(t) {
  let clock = Date.now();
  const emulator = await createEmulator({ now: () => clock });
  // Allow local scheduling delays when the suite runs beside builds/browser QA.
  // Retries remain disabled, so lost acknowledgments still cannot resend writes.
  const adapter = new NtcipAdapter({ host: '127.0.0.1', port: emulator.port, community: emulator.community, slot: 1, timeout: 1000, validationTimeout: 1500 }, { now: () => clock });
  t.after(async () => { adapter.close(); await emulator.close(); });
  const command = extra => ({ id: randomUUID(), operation: 'message', message: 'INCIDENT AHEAD\nEXPECT DELAYS', priority: 3, expiresAt: new Date(clock + 600000).toISOString(), ...extra });
  return { emulator, adapter, command, advance: ms => { clock += ms; } };
}
test('NTCIP activation octets and CRC match the published independent example', () => {
  assert.equal(crc16('[jp3]TEST [fl]Flashing[/fl]'), 0x95f9);
  // Encoding uses a ten-minute bounded duration, with the standard's other values.
  assert.equal(activation({ minutes: 10, priority: 55, memory: 4, slot: 5, crc: 0x95f9, sourceAddress: '103.8.9.10' }).toString('hex'), '000a3704000595f96708090a');
  assert.equal(toMulti('AHEAD\nSLOW'), 'AHEAD[nl]SLOW');
  assert.equal(fromMulti('AHEAD[nl]SLOW'), 'AHEAD\nSLOW');
  for (const text of ['[np]TEST', 'CLOSÉ', 'A\0B', '[nl]']) assert.throws(() => toMulti(text));
  assert.throws(() => fromMulti('[g1]'));
});
test('UDP SNMP discovers dimensions, validates, activates and independently reads current buffer', async t => {
  const { emulator, adapter, command } = await fixture(t);
  assert.equal((await adapter.discover()).columns, 18);
  const c = command(), result = await adapter.execute(c).catch(e => { throw new Error(e.message + ' / ' + emulator.state.lastError); });
  assert.equal(result.message, c.message); assert.equal(result.owner, 'PB:' + c.id);
  assert.equal(result.priority, 150); assert.equal(emulator.state.activations, 1);
  const trace = emulator.snapshot().trace;
  assert.ok(trace.some(x => x.operation === 'SET' && x.oid === cell(9)));
  assert.ok(trace.some(x => x.operation === 'SET' && x.oid === OID.activate));
  assert.ok(trace.some(x => x.operation === 'GET' && x.oid === cell(3, 5)));
});
test('dimension overflow, unsupported markup and expired validity never activate', async t => {
  const { emulator, adapter, command } = await fixture(t);
  for (const extra of [{ message: 'X'.repeat(19) }, { message: 'A\nB\nC\nD' }, { message: '[np]A' }, { expiresAt: new Date(Date.now() - 1000).toISOString() }]) {
    await assert.rejects(adapter.execute(command(extra)), e => e.notApplied === true);
  }
  assert.equal(emulator.state.activations, 0);
});
test('local mode and higher-priority field override are preserved', async t => {
  const { emulator, adapter, command } = await fixture(t);
  emulator.setFault('local'); await assert.rejects(adapter.execute(command()), /local control/);
  emulator.setFault('healthy'); emulator.override();
  await assert.rejects(adapter.execute(command()), /higher-priority/);
  assert.equal(emulator.snapshot().message, 'LOCAL OVERRIDE'); assert.equal(emulator.state.activations, 0);
});
test('controller validation failure does not activate, and an active slot is never overwritten', async t => {
  const { emulator, adapter, command } = await fixture(t);
  emulator.setFault('validation'); await assert.rejects(adapter.execute(command()), e => e.notApplied);
  assert.equal(emulator.state.activations, 0);
  emulator.setFault('healthy'); await adapter.execute(command());
  await assert.rejects(adapter.execute(command({ message: 'DIFFERENT' })), /currently active/);
  assert.equal(emulator.state.activations, 1);
});
test('lost activation acknowledgement remains uncertain without resending, but fresh GET can reconcile', async t => {
  const { emulator, adapter, command } = await fixture(t);
  const c = command(); emulator.setFault('lost-ack');
  await assert.rejects(adapter.execute(c), e => !e.notApplied);
  assert.equal(emulator.state.activations, 1);
  assert.equal((await adapter.read()).owner, 'PB:' + c.id);
  assert.equal(emulator.state.activations, 1);
});
test('readback mismatch is never a success', async t => {
  const { emulator, adapter, command } = await fixture(t);
  emulator.setFault('mismatch'); await assert.rejects(adapter.execute(command()), e => !e.notApplied && /readback/.test(e.message));
});
test('controller independently expires a message, and explicit blank uses blank-message encoding', async t => {
  const { emulator, adapter, command, advance } = await fixture(t);
  await adapter.execute(command()); advance(600001);
  assert.equal((await adapter.read()).message, ''); assert.equal((await adapter.read()).sourceMode, 14);
  await adapter.execute(command());
  const result = await adapter.execute(command({ operation: 'blank', message: '' }));
  assert.equal(result.message, ''); assert.ok(result.source.startsWith('07'));
  assert.equal(emulator.state.activations, 3);
});
test('wrong community and offline controller cannot provide telemetry', async t => {
  const { emulator, adapter } = await fixture(t);
  const unauthorized = new NtcipAdapter({ host: '127.0.0.1', port: emulator.port, community: 'wrong', slot: 1, timeout: 100 });
  t.after(() => unauthorized.close());
  await assert.rejects(unauthorized.read());
  emulator.setFault('offline'); await assert.rejects(adapter.read());
});
test('console dispatcher uses SNMP lab, durable deduplication, override detection and simulated evidence only', async t => {
  const ops = new Operations({ mode: 'training' }); ops.seedTraining();
  const lab = await new TrainingNtcipLab(ops).start();
  t.after(async () => { await lab.close(); ops.close(); });
  const dispatcher = new Dispatcher(ops, { trainingLab: lab });
  const actor = { id: 'training.operator', role: 'operator', name: 'Operator', agency: 'TRAINING' };
  const supervisor = { ...actor, id: 'training.supervisor', role: 'supervisor' };
  let incident = ops.createIncident(actor, { title: 'Protocol integration scenario', route: 'I-80', latitude: 41, longitude: -93 });
  incident = ops.changeIncident(actor, incident.id, { version: incident.version, action: 'claim', note: 'Claim for test.' });
  incident = ops.changeIncident(actor, incident.id, { version: incident.version, action: 'transition', status: 'verified', note: 'Verified for test.' });
  const c = ops.createCommand(actor, { incidentId: incident.id, deviceId: 'TRAIN-DMS-01', message: 'INCIDENT AHEAD', reason: 'Protocol test', ttlMinutes: 10 });
  ops.changeCommand(supervisor, c.id, { version: c.version, action: 'approve', note: 'Reviewed test message.' });
  await dispatcher.tick();
  assert.equal(ops.need('TRAINING', 'command', c.id).status, 'simulated');
  assert.equal(ops.need('TRAINING', 'command', c.id).verifiedAt, null);
  await assert.rejects(lab.execute(c, ops.need('TRAINING', 'device', c.deviceId)), /already attempted/);
  lab.scenario(actor, c.deviceId, { action: 'override' }); await lab.poll();
  assert.equal(ops.need('TRAINING', 'command', c.id).status, 'unknown');
  assert.equal(lab.devices.get(c.deviceId).emulator.state.activations, 1);
  assert.throws(() => lab.scenario({ ...actor, role: 'viewer' }, c.deviceId, { action: 'expire' }));
  lab.scenario(actor, c.deviceId, { action: 'reset' }); await lab.poll();
  assert.equal(ops.need('TRAINING', 'command', c.id).status, 'cleared');
  lab.scenario(actor, c.deviceId, { action: 'fault', fault: 'offline' }); await lab.poll();
  assert.ok(ops.controlReason(ops.need('TRAINING', 'device', c.deviceId)));
  assert.ok(ops.alarms('TRAINING').some(a => a.id === 'device-communication:' + c.deviceId));
  assert.equal(ops.verifyAudit('TRAINING').valid, true);
});

test('restarting the protocol lab reconciles blank controllers and never replays an attempted command', async t => {
  const ops = new Operations({ mode: 'training' }); ops.seedTraining();
  let lab = await new TrainingNtcipLab(ops).start();
  t.after(async () => { await lab.close(); ops.close(); });
  const command = { id: randomUUID(), deviceId: 'TRAIN-DMS-01', operation: 'message', message: 'TRAINING ONLY', priority: 3, expiresAt: new Date(Date.now() + 600000).toISOString() };
  await lab.execute(command, ops.need('TRAINING', 'device', command.deviceId));
  await lab.close(); lab = await new TrainingNtcipLab(ops).start();
  await assert.rejects(lab.execute(command, ops.need('TRAINING', 'device', command.deviceId)), /already attempted/);
  await assert.rejects(lab.execute({ ...command, message: 'OTHER MESSAGE' }, ops.need('TRAINING', 'device', command.deviceId)), /different payload/);
  assert.equal(lab.devices.get(command.deviceId).emulator.state.activations, 0);
  assert.equal(ops.need('TRAINING', 'device', command.deviceId).displayedMessage, '');
});

test('emulator rejects malformed BER, multi-varbind writes, and incorrect activation CRC', async t => {
  const { adapter, emulator, command } = await fixture(t);
  const { decodePacket } = require('../../services/atms/ntcip/emulator');
  for (const buffer of [Buffer.alloc(0), Buffer.from([0x30, 0x80]), Buffer.alloc(9000)]) assert.throws(() => decodePacket(buffer));
  const result = await adapter.execute(command());
  const wire = Buffer.from(result.activation, 'hex'); wire[7] ^= 1;
  await assert.rejects(adapter.set(OID.activate, wire, require('net-snmp').ObjectType.OctetString));
  assert.equal(emulator.state.activations, 1);
  await assert.rejects(adapter.request('set', [{ oid: cell(9, 4, 2), type: 2, value: 6 }, { oid: cell(8, 4, 2), type: 2, value: 255 }]));
  assert.equal(emulator.state.slots.get(2).status, 1);
});

// MULTI strings copied from Iowa DOT's public DMS_View feed (2026-10-20),
// unescaped as a controller holds them. Agency signs use layout tags that the
// write profile never produces; reading them must work without loosening verification.
const IOWA_MULTI = {
  twoPage: '[pt40o0][jp3][jl3][fo2]DELAYS[nl2][jl3][fo2]3 MILES[nl2][jl3][fo2]AHEAD[np][pt40o0][jp3][jl3][fo2]PREPARE[nl2][jl3][fo2]TO[nl2][jl3][fo2]STOP',
  onePage: '[jp3][jl3][fo1]RAMP TO I-80/35 E[nl3][jl3][fo1]CLOSING[nl3][jl3][fo1]TONIGHT 9PM-5AM',
  symbols: '[pt40o0][jp3][jl3][fo1]TEMP[nl][jl3][fo1]ROAD[nl][jl3][fo1]CLOSURES[np][pt40o0][jp3][jl3][fo1]10/26[nl][jl3][fo1]& 10/27[nl][jl3][fo1]9AM-3PM'
};

test('agency-formatted MULTI decodes to its words, page by page', () => {
  assert.deepEqual(decodeMulti(IOWA_MULTI.twoPage).pages, [['DELAYS', '3 MILES', 'AHEAD'], ['PREPARE', 'TO', 'STOP']]);
  assert.equal(decodeMulti(IOWA_MULTI.onePage).text, 'RAMP TO I-80/35 E\nCLOSING\nTONIGHT 9PM-5AM');
  assert.equal(decodeMulti(IOWA_MULTI.symbols).pages[1][1], '& 10/27');
  for (const multi of Object.values(IOWA_MULTI)) assert.equal(decodeMulti(multi).complete, true);
  assert.equal(decodeMulti('USE [[LEFT]] LANE').text, 'USE [LEFT] LANE');
  assert.equal(decodeMulti('').text, '');
});

test('content the controller substitutes is flagged, never guessed', () => {
  const d = decodeMulti('TRAVEL TIME[nl]DES MOINES [f8] MIN[np][g1]');
  assert.equal(d.complete, false);
  assert.deepEqual(d.unrenderable, ['[f8]', '[g1]']);
  assert.equal(decodeMulti('BROKEN [jl3').complete, false);
  // [hc] selects a glyph from the sign's own font, so its meaning is font-dependent.
  assert.deepEqual(decodeMulti('THIS IS [hc8A] A TEST').unrenderable, ['[hc8A]']);
  assert.deepEqual(decodeMulti('[mvcl100,1,10,SLOW]').unrenderable, ['[mvcl100,1,10,SLOW]']);
  assert.deepEqual(decodeMulti('[spacing2]X').unrenderable, ['[spacing2]']);
});

test('every NTCIP 1203 layout tag is dropped without losing words', () => {
  const d = decodeMulti('[cb1][pb0,0,0][cf255,255,0][cr1,1,10,10,255,0,0][fo2][jp3][jl3][pt30o5][sc2]SLOW[/sc][nl][fl5o5]DOWN[/fl][np][tr1,1,50,20]WORK ZONE');
  assert.equal(d.complete, true);
  assert.deepEqual(d.pages, [['SLOW', 'DOWN'], ['WORK ZONE']]);
});

test('reading an agency-formatted sign succeeds but can never verify a command', async () => {
  const peer = await createEmulator();
  try {
    peer.state.multi = IOWA_MULTI.onePage;
    const adapter = new NtcipAdapter({ host: '127.0.0.1', port: peer.port, community: peer.community, slot: 1, timeout: 500 });
    try {
      const observation = await adapter.read();
      assert.equal(observation.multi, IOWA_MULTI.onePage);
      assert.equal(observation.message, null);
      assert.equal(observation.display.text, 'RAMP TO I-80/35 E\nCLOSING\nTONIGHT 9PM-5AM');
      assert.notEqual(observation.message, 'RAMP TO I-80/35 E\nCLOSING\nTONIGHT 9PM-5AM');
    } finally { adapter.close(); }
  } finally { await peer.close(); }
});

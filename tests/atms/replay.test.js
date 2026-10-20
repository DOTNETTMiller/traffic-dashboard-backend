'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { walkToSnmprec, replay } = require('../../scripts/atms-replay-recording.cjs');

const rows = text => walkToSnmprec(text).trim().split('\n').map(line => line.split('|'));

test('snmpwalk output converts to sorted snmprec records with the right types', () => {
  const walk = [
    '.1.3.6.1.4.1.1206.4.2.3.6.1.0 = INTEGER: central(4)',
    '.1.3.6.1.4.1.1206.4.2.3.2.1.0 = INTEGER: 7',
    '.1.3.6.1.4.1.1206.4.2.3.6.15.0 = Hex-STRING: 07 00 01 00 00 ',
    '.1.3.6.1.4.1.1206.4.2.3.5.8.1.4.5.1 = ""',
    '.1.3.6.1.4.1.1206.4.2.3.5.8.1.3.5.1 = STRING: "[jl3]SAY \\"HI\\"[nl]NOW"',
    '.1.3.6.1.4.1.1206.4.2.3.10.0 = Timeticks: (12345) 0:02:03.45',
    '.1.3.6.1.4.1.1206.4.2.3.11.0 = Gauge32: 9',
    '.1.3.6.1.4.1.1206.4.2.3.12.0 = No Such Object available on this agent at this OID'
  ].join('\n');
  const r = rows(walk);
  assert.deepEqual(r.map(x => x[0]), [
    '1.3.6.1.4.1.1206.4.2.3.2.1.0', '1.3.6.1.4.1.1206.4.2.3.5.8.1.3.5.1', '1.3.6.1.4.1.1206.4.2.3.5.8.1.4.5.1',
    '1.3.6.1.4.1.1206.4.2.3.6.1.0', '1.3.6.1.4.1.1206.4.2.3.6.15.0', '1.3.6.1.4.1.1206.4.2.3.10.0', '1.3.6.1.4.1.1206.4.2.3.11.0'
  ]);
  const by = Object.fromEntries(r.map(([oid, tag, value]) => [oid, [tag, value]]));
  assert.deepEqual(by['1.3.6.1.4.1.1206.4.2.3.6.1.0'], ['2', '4']);
  assert.deepEqual(by['1.3.6.1.4.1.1206.4.2.3.6.15.0'], ['4x', '0700010000']);
  assert.deepEqual(by['1.3.6.1.4.1.1206.4.2.3.5.8.1.4.5.1'], ['4', '']);
  assert.equal(Buffer.from(by['1.3.6.1.4.1.1206.4.2.3.5.8.1.3.5.1'][1], 'hex').toString('latin1'), '[jl3]SAY "HI"[nl]NOW');
  assert.deepEqual(by['1.3.6.1.4.1.1206.4.2.3.10.0'], ['67', '12345']);
  assert.deepEqual(by['1.3.6.1.4.1.1206.4.2.3.11.0'], ['66', '9']);
});

test('wrapped hex and multi-line strings are joined, not truncated', () => {
  const r = rows([
    '.1.3.6.1.4.1.1206.4.2.3.5.8.1.3.4.1 = Hex-STRING: 5B 6A 6C 33 5D 41 42 43 44 45 46 47 48 49 4A 4B',
    '4C 4D 4E',
    '.1.3.6.1.4.1.1206.4.2.3.5.8.1.4.4.1 = STRING: "LINE ONE',
    'LINE TWO"'
  ].join('\n'));
  assert.equal(Buffer.from(r[0][2], 'hex').toString('latin1'), '[jl3]ABCDEFGHIJKLMN');
  assert.equal(Buffer.from(r[1][2], 'hex').toString('latin1'), 'LINE ONE\nLINE TWO');
});

test('unrecognised walk formats fail loudly instead of dropping values', () => {
  assert.throws(() => walkToSnmprec('.1.3.6.1.4.1.1206.4.2.3.2.1.0 = Opaque: Float: 1.5'), /unsupported type Opaque/);
  assert.throws(() => walkToSnmprec('.1.3.6.1.4.1.1206.4.2.3.2.1.0 = 7'), /unrecognized value/);
});

test('a missing snmpsim is reported, not crashed on', async () => {
  await assert.rejects(replay('.1.3.6.1.4.1.1206.4.2.3.2.1.0 = INTEGER: 7\n', { agency: 'T', deviceId: 'T', manufacturer: 'T', model: 'T', firmware: 'T', ntcipEdition: 'T' },
    { responder: '/nonexistent/snmpsim-command-responder' }), /Cannot start .*pip install snmpsim/);
});

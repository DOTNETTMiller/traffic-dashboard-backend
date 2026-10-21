'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const dgram = require('node:dgram');
const snmp = require('net-snmp');
const { NtcipAdapter } = require('../../services/atms/ntcip/adapter');
const { OID } = require('../../services/atms/ntcip/protocol');
const { createEmulator } = require('../../services/atms/ntcip/emulator');

// Request-id of a v1/v2c message: SEQUENCE { version, community, PDU { id ... } }.
function requestId(buf) {
  let i = 0;
  const len = () => { const b = buf[i++]; if (b < 128) return b; let n = 0; for (let k = 0; k < (b & 127); k++) n = n * 256 + buf[i++]; return n; };
  i++; len();                                   // message sequence
  for (let skip = 0; skip < 2; skip++) { i++; const n = len(); i += n; } // version, community
  i++; len();                                   // PDU
  i++; const n = len(); let id = 0;
  for (let k = 0; k < n; k++) id = id * 256 + buf[i++];
  return id;
}

// Stands in front of the emulator like Ledstar firmware that mangles ids above
// 127: those responses never match, which net-snmp treats as no response.
async function ledstarProxy(target) {
  const front = dgram.createSocket('udp4');
  const pending = new Map();
  const back = dgram.createSocket('udp4');
  back.on('message', msg => { const r = pending.get(requestId(msg)); if (r) front.send(msg, r.port, r.address); });
  front.on('message', (msg, rinfo) => {
    const id = requestId(msg);
    if (id <= 127) pending.set(id, rinfo);
    back.send(msg, target, '127.0.0.1');
  });
  await new Promise(r => front.bind(0, '127.0.0.1', r));
  return { port: front.address().port, close: () => { front.close(); back.close(); } };
}

test('request-ids stay within 1..127 so mangling firmware still answers', { timeout: 30000 }, async t => {
  const peer = await createEmulator({ snmpVersion: '2c' });
  const proxy = await ledstarProxy(peer.port);
  t.after(() => { proxy.close(); peer.close(); });

  const adapter = new NtcipAdapter({ host: '127.0.0.1', port: proxy.port, community: peer.community, slot: 1, snmpVersion: '2c' });
  t.after(() => adapter.session.close());
  for (let i = 0; i < 300; i++) { try { await adapter.get(OID.controlMode); } catch (e) { throw new Error(`request ${i}: ${e.message}`); } }

  // An unlimited net-snmp session times out against the same proxy.
  const raw = snmp.createSession('127.0.0.1', peer.community, { port: proxy.port, version: snmp.Version2c, retries: 0, timeout: 300 });
  t.after(() => raw.close());
  await assert.rejects(new Promise((resolve, reject) => raw.get([OID.controlMode], e => e ? reject(e) : resolve())), snmp.RequestTimedOutError);
});

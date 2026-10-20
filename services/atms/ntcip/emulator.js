'use strict';
const dgram = require('node:dgram');
const { Ber } = require('asn1-ber');
const { randomBytes } = require('node:crypto');
const { OID, cell, fromMulti, toMulti, messageId, decodeActivation, crc16 } = require('./protocol');

// Independent, bounded SNMPv1/v2c GET/SET implementation for the local text-profile
// emulator. Binary activation codes must never pass through string conversion.
function decodePacket(buffer) {
  if (buffer.length > 8192) throw new Error('Oversized packet.');
  const r = new Ber.Reader(buffer); r.readSequence();
  const version = r.readInt();
  if (![0, 1].includes(version)) throw new Error('Only SNMPv1/v2c is emulated by the BER peer.');
  const community = r.readString(); const operation = r.readSequence();
  if (![0xa0, 0xa3].includes(operation)) throw new Error('Only GET and SET are emulated.');
  const id = r.readInt(); r.readInt(); r.readInt(); r.readSequence();
  const end = r.offset + r.length, vars = [];
  while (r.offset < end && vars.length < 32) {
    r.readSequence(); const oid = r.readOID(), type = r.peek();
    if (![2, 4, 5].includes(type)) throw new Error('Unsupported object type.');
    const value = type === 2 ? r.readInt() : r.readString(type, true);
    vars.push({ oid, type, value });
  }
  if (r.offset !== end || !vars.length) throw new Error('Malformed varbind list.');
  return { version, community, operation, id, vars };
}
function encodePacket(request, vars, error = 0, errorIndex = 0) {
  const w = new Ber.Writer(); w.startSequence(); w.writeInt(request.version ?? 1); w.writeString(request.community);
  w.startSequence(0xa2); w.writeInt(request.id); w.writeInt(error); w.writeInt(errorIndex); w.startSequence();
  for (const v of vars) {
    w.startSequence(); w.writeOID(v.oid);
    if (v.type === 2) w.writeInt(v.value); else if (v.type === 4) w.writeBuffer(Buffer.from(v.value), 4); else w.writeNull();
    w.endSequence();
  }
  w.endSequence(); w.endSequence(); w.endSequence(); return w.buffer;
}
async function createEmulator({ port = 0, lines = 3, columns = 18, now = Date.now, minuteMs = 60000, community = randomBytes(24).toString('hex'), snmpVersion = '2c', maxVarbinds = 32 } = {}) {
  if (!['1', '2c', '3'].includes(snmpVersion)) throw new Error('Unknown lab SNMP version.');
  const state = { mode: 4, fault: 'healthy', multi: '', owner: '', priority: 1, source: messageId(7, 1, 0), sourceMode: 14, until: 0, activationState: 1, activateError: 2, validateError: 2, slots: new Map(), trace: [], activations: 0 };
  for (let i = 1; i <= 2; i++) state.slots.set(i, { multi: '', owner: '', crc: 0, beacon: 0, pixel: 0, priority: 1, status: 1 });
  const socket = snmpVersion === '3' ? null : dgram.createSocket('udp4');
  function expire() {
    if (state.until && now() >= state.until) {
      state.multi = ''; state.owner = ''; state.priority = 1; state.source = messageId(7, 1, 0); state.until = 0; state.sourceMode = 14;
    }
  }
  const constants = new Map(Object.entries({ characterHeight: 7, characterWidth: 5, height: lines * 7, width: columns * 5, maxMulti: 1024, slots: 2 }).map(([key, value]) => [OID[key], value]));
  function read(oid) {
    expire();
    if (constants.has(oid)) return constants.get(oid);
    const scalar = { [OID.controlMode]: state.mode, [OID.remaining]: state.until ? Math.max(0, Math.ceil((state.until - now()) / minuteMs)) : 0,
      [OID.source]: state.source, [OID.sourceMode]: state.sourceMode, [OID.endDuration]: messageId(7, 1, 0),
      [OID.validateError]: state.validateError, [OID.activateError]: state.activateError, [OID.activationState]: state.activationState,
      [OID.activate]: state.lastActivation || Buffer.alloc(12) };
    if (Object.hasOwn(scalar, oid)) return scalar[oid];
    const [col, memory, slot] = oid.split('.').slice(-3).map(Number);
    if (oid !== cell(col, memory, slot) || col < 1 || col > 9) throw new Error('Unknown object.');
    const row = memory === 5 && slot === 1 ? { multi: state.multi, owner: state.owner, priority: state.priority, crc: state.source.readUInt16BE(3), status: 4, beacon: 0, pixel: 0 } : memory === 4 ? state.slots.get(slot) : null;
    if (!row) throw new Error('Unknown message.');
    return [null, memory, slot, Buffer.from(row.multi), Buffer.from(row.owner), row.crc, row.beacon, row.pixel, row.priority, row.status][col];
  }
  function activate(value) {
    const a = decodeActivation(value); let row;
    state.activateError = 2;
    if (state.mode !== 4) state.activateError = 9;
    else if (a.priority < state.priority) state.activateError = 3;
    else if (a.minutes < 1 || a.minutes > 60) state.activateError = 1;
    else if (a.memory === 7 && a.slot >= 1 && a.slot <= 255 && a.crc === 0) row = { multi: '', owner: '', priority: a.slot };
    else if (a.memory !== 4 || !state.slots.has(a.slot)) state.activateError = 4;
    else { row = state.slots.get(a.slot); if (row.status !== 4) state.activateError = 6; else if (row.crc !== a.crc) state.activateError = 7; }
    if (state.activateError !== 2) throw new Error('Activation refused.');
    state.multi = row.multi; state.owner = row.owner; state.priority = row.priority;
    state.source = messageId(a.memory, a.slot, a.crc); state.sourceMode = 8;
    state.lastActivation = Buffer.from(value); state.until = now() + a.minutes * minuteMs; state.activations++;
    if (state.fault === 'mismatch') { state.multi = 'LOCAL OVERRIDE'; state.owner = 'local'; state.sourceMode = 2; }
  }
  function write(v) {
    expire();
    if (v.oid === OID.activate && v.type === 4) { activate(v.value); return; }
    const [col, memory, slot] = v.oid.split('.').slice(-3).map(Number);
    if (v.oid !== cell(col, memory, slot) || memory !== 4) throw new Error('Read-only or unknown object.');
    const row = state.slots.get(slot);
    if (!row || ![3, 4, 6, 7, 8, 9].includes(col) || v.type !== ([3, 4].includes(col) ? 4 : 2)) throw new Error('Invalid column or type.');
    if (col === 9) {
      if (v.value === 6) row.status = 2;
      else if (v.value === 7 && row.status === 2) {
        let valid = state.fault !== 'validation';
        try { const text = fromMulti(row.multi); valid &&= text.split('\n').length <= lines && text.split('\n').every(l => l.length <= columns); } catch { valid = false; }
        row.status = valid ? 4 : 5; state.validateError = valid ? 2 : 5;
        if (valid) row.crc = crc16(row.multi, row.beacon, row.pixel);
      } else if (v.value === 8) row.status = 1;
      else throw new Error('Invalid state transition.');
    } else {
      if (row.status !== 2) throw new Error('Message is not modifying.');
      if (col === 3 && v.value.length <= 1024) row.multi = v.value.toString('latin1');
      else if (col === 4 && v.value.length <= 255) row.owner = v.value.toString();
      else if (col === 6 && [0, 1].includes(v.value)) row.beacon = v.value;
      else if (col === 7 && [0, 1].includes(v.value)) row.pixel = v.value;
      else if (col === 8 && Number.isInteger(v.value) && v.value >= 1 && v.value <= 255) row.priority = v.value;
      else throw new Error('Invalid column value.');
    }
  }
  if (socket) socket.on('message', (buffer, remote) => {
    if (state.fault === 'offline' || remote.address !== '127.0.0.1') return;
    let request;
    try { request = decodePacket(buffer); } catch { return; }
    if (request.community !== community || request.version !== (snmpVersion === '1' ? 0 : 1)) return;
    if (request.vars.length > maxVarbinds) {
      socket.send(encodePacket(request, request.vars, 1, 0), remote.port, remote.address, () => {}); return;
    }
    // This limited profile deliberately accepts only single-varbind SETs.
    let error = request.operation === 0xa3 && request.vars.length !== 1 ? 5 : 0, errorIndex = error ? 1 : 0;
    const result = [];
    for (let i = 0; !error && i < request.vars.length; i++) {
      const v = request.vars[i];
      state.trace.push({ operation: request.operation === 0xa3 ? 'SET' : 'GET', oid: v.oid, snmpVersion, at: new Date(now()).toISOString() });
      if (state.trace.length > 200) state.trace.shift();
      try {
        if (request.operation === 0xa3) write(v);
        const value = request.operation === 0xa3 ? v.value : read(v.oid);
        result.push({ oid: v.oid, type: Number.isInteger(value) ? 2 : 4, value });
      } catch (e) { state.lastError = e.message; error = 5; errorIndex = i + 1; }
    }
    if (!error && request.operation === 0xa3 && request.vars[0].oid === OID.activate && state.fault === 'lost-ack') return;
    const response = encodePacket(request, error ? request.vars : result, error, errorIndex);
    socket.send(response, remote.port, remote.address, () => {});
  });
  const secure = snmpVersion === '3' ? await require('./secure-peer').createSecurePeer({ read, write, state, port, now, maxVarbinds }) : null;
  if (socket) await new Promise((resolve, reject) => { socket.once('error', reject); socket.bind(port, '127.0.0.1', resolve); });
  return {
    port: secure ? secure.port : socket.address().port, community: secure ? undefined : community, user: secure?.user, snmpVersion, state,
    setFault(fault) {
      if (!['healthy', 'offline', 'local', 'validation', 'lost-ack', 'mismatch'].includes(fault)) throw new Error('Unknown emulator fault.');
      state.fault = fault; state.mode = fault === 'local' ? 2 : 4;
    },
    override(message = 'LOCAL OVERRIDE') { state.multi = toMulti(message); state.owner = 'local'; state.sourceMode = 2; state.source = messageId(7, 1, 0); state.priority = 255; state.until = 0; },
    expire() { if (state.until) state.until = now(); expire(); },
    reset() {
      delete state.lastError;
      state.multi = ''; state.owner = ''; state.source = messageId(7, 1, 0); state.priority = 1;
      state.until = 0; state.sourceMode = 11; state.mode = 4; state.fault = 'healthy';
      for (const row of state.slots.values()) Object.assign(row, { multi: '', owner: '', crc: 0, beacon: 0, pixel: 0, priority: 1, status: 1 });
    },
    snapshot() { expire(); return { message: fromMulti(state.multi), fault: state.fault, mode: state.mode, activations: state.activations, trace: [...state.trace] }; },
    close() { if (secure) return secure.close(); return new Promise(resolve => { try { socket.close(resolve); } catch { resolve(); } }); }
  };
}
module.exports = { createEmulator, decodePacket, encodePacket };

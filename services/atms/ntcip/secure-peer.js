'use strict';
const snmp = require('net-snmp');
const dgram = require('node:dgram');
const { randomBytes } = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { OID, cell } = require('./protocol');

// Lab-only v3 agent. Security uses net-snmp on both ends; this is not an
// independent implementation of USM or evidence of manufacturer compatibility.
async function createSecurePeer({ read, write, state, port = 0, now = Date.now, maxVarbinds = 32 }) {
  if (!port) {
    const reservation = dgram.createSocket('udp4');
    try {
      await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.bind(0, '127.0.0.1', resolve); });
      port = reservation.address().port;
    } finally { await new Promise(resolve => reservation.close(resolve)); }
  }
  const user = { name: 'training-only', authProtocol: 'sha256', authKey: randomBytes(24).toString('hex'), privProtocol: 'aes', privKey: randomBytes(24).toString('hex') };
  let startupReject;
  const agent = snmp.createAgent({ address: '127.0.0.1', port, disableAuthorization: false, accessControlModelType: snmp.AccessControlModelType.Simple }, error => { if (error && startupReject) startupReject(error); });
  const authorizer = agent.getAuthorizer();
  const rawValues = new AsyncLocalStorage();
  authorizer.addUser({ ...user, level: snmp.SecurityLevel.authPriv, authProtocol: snmp.AuthProtocols.sha256, privProtocol: snmp.PrivProtocols.aes });
  authorizer.getAccessControlModel().setUserAccess(user.name, snmp.AccessLevel.ReadWrite);
  function handler(request) {
    if (state.fault === 'offline') return;
    const isSet = request.operation === snmp.PduType.SetRequest;
    if (request.testSet) { request.done(); return; }
    state.trace.push({ operation: isSet ? 'SET' : 'GET', oid: request.oid, snmpVersion: '3', at: new Date(now()).toISOString() });
    if (state.trace.length > 200) state.trace.shift();
    try {
      if (isSet) write({ oid: request.oid, type: request.setType, value: rawValues.getStore().get(request.oid) });
      else request.instanceNode.value = read(request.oid);
      if (isSet && request.oid === OID.activate && state.fault === 'lost-ack') return;
      request.done();
    } catch (error) {
      state.lastError = error.message;
      request.done({ errorStatus: snmp.ErrorStatus.GeneralError });
    }
  }
  const mib = agent.getMib();
  for (const [name, oid] of Object.entries(OID)) {
    const value = read(oid);
    mib.registerProvider({ name, oid: oid.slice(0, -2), type: snmp.MibProviderType.Scalar,
      scalarType: Number.isInteger(value) ? snmp.ObjectType.Integer : snmp.ObjectType.OctetString,
      maxAccess: snmp.MaxAccess[name === 'activate' ? 'read-write' : 'read-only'], handler });
    mib.setScalarValue(name, value);
  }
  const names = ['memory', 'slot', 'multi', 'owner', 'crc', 'beacon', 'pixel', 'priority', 'status'];
  mib.registerProvider({ name: 'messages', oid: cell(1, 4, 1).split('.').slice(0, -3).join('.'), type: snmp.MibProviderType.Table,
    tableColumns: names.map((name, i) => ({ name, number: i + 1, type: [2, 3].includes(i) ? snmp.ObjectType.OctetString : snmp.ObjectType.Integer, maxAccess: snmp.MaxAccess['read-write'] })),
    tableIndex: [{ columnName: 'memory' }, { columnName: 'slot' }], handler });
  for (const [memory, slot] of [[4, 1], [4, 2], [5, 1]]) mib.addTableRow('messages', names.map((_, i) => read(cell(i + 1, memory, slot))));
  agent.setBulkSetHandler(requests => requests.length > 1 ? snmp.ErrorStatus.GeneralError : snmp.ErrorStatus.NoError);
  // Enforce the configured packet limit before handlers can mutate the engine.
  const originalRequest = agent.request;
  agent.request = function (socket, message, remote) {
    if (remote.address !== '127.0.0.1' || message.pdu.varbinds.length > maxVarbinds) return;
    // net-snmp's MIB setter converts OctetStrings to UTF-8 strings. Capture
    // original octets before that conversion: activation contains binary CRC.
    const values = new Map(message.pdu.varbinds.map(v => [v.oid, Buffer.isBuffer(v.value) ? Buffer.from(v.value) : v.value]));
    return rawValues.run(values, () => originalRequest.call(this, socket, message, remote));
  };
  try {
    await new Promise((resolve, reject) => {
      startupReject = reject;
      const socket = Object.values(agent.listener.sockets)[0];
      socket.once('listening', resolve);
    });
    startupReject = null;
  } catch (error) { agent.close(); throw error; }
  return { port, user, close: () => new Promise(resolve => agent.close(resolve)) };
}
module.exports = { createSecurePeer };

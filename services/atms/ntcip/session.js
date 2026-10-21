'use strict';
const snmp = require('net-snmp');

// Some Ledstar firmware echoes request-ids above 127 as negative (-128, -127,
// ...). net-snmp silently drops a response whose id it did not send, so such a
// sign would look offline. net-snmp ids are random up to 1e8; keep them in
// 1..127 for every controller, as MnDOT IRIS did for all signs 2007-2023.
// Retries reuse their id; ids still awaiting a response are skipped.
const MAX_REQUEST_ID = 127;
function limitRequestIds(session) {
  let last = Math.floor(Math.random() * MAX_REQUEST_ID);
  const send = session.send;
  session.send = function (req, noWait) {
    if (!req.limitedId) {
      do last = last % MAX_REQUEST_ID + 1; while (this.reqs[last]);
      req.message.pdu.id = last;
      req.limitedId = true;
    }
    return send.call(this, req, noWait);
  };
  return session;
}

// Version is commissioned per controller. Never probe by downgrading security.
function createControllerSession(config) {
  const version = config.snmpVersion ?? '2c';
  const options = { port: config.port || 161, retries: 0, timeout: config.timeout || 1000, transport: 'udp4' };
  if (version === '1' || version === '2c') {
    if (typeof config.community !== 'string' || !config.community) throw new Error('A controller community is required.');
    return limitRequestIds(snmp.createSession(config.host, config.community, { ...options, version: version === '1' ? snmp.Version1 : snmp.Version2c }));
  }
  if (version !== '3') throw new Error('Supported SNMP versions are 1, 2c and 3.');
  const user = config.user;
  if (!user || !user.name || !['sha', 'sha256'].includes(user.authProtocol) || user.privProtocol !== 'aes' ||
      typeof user.authKey !== 'string' || user.authKey.length < 8 || typeof user.privKey !== 'string' || user.privKey.length < 8) {
    throw new Error('SNMPv3 requires a named authPriv user, SHA/SHA256 authentication, AES privacy and keys of at least eight characters.');
  }
  return snmp.createV3Session(config.host, {
    name: user.name, level: snmp.SecurityLevel.authPriv,
    authProtocol: snmp.AuthProtocols[user.authProtocol], authKey: user.authKey,
    privProtocol: snmp.PrivProtocols.aes, privKey: user.privKey
  }, { ...options, context: config.context || '' });
}
module.exports = { createControllerSession };

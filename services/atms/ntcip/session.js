'use strict';
const snmp = require('net-snmp');

// Version is commissioned per controller. Never probe by downgrading security.
function createControllerSession(config) {
  const version = config.snmpVersion ?? '2c';
  const options = { port: config.port || 161, retries: 0, timeout: config.timeout || 1000, transport: 'udp4' };
  if (version === '1' || version === '2c') {
    if (typeof config.community !== 'string' || !config.community) throw new Error('A controller community is required.');
    return snmp.createSession(config.host, config.community, { ...options, version: version === '1' ? snmp.Version1 : snmp.Version2c });
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

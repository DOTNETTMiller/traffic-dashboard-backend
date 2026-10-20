'use strict';
const { NtcipAdapter } = require('./adapter');
const { FIELD_REQUIREMENTS } = require('./acceptance');
function benchConfig(input, env = process.env) {
  const c = input.controller;
  if (!c || !['1', '2c', '3'].includes(c.snmpVersion)) throw new Error('An explicit commissioned SNMP version is required.');
  const secret = name => {
    if (typeof name !== 'string' || !name || !env[name]) throw new Error('A required controller credential environment variable is missing.');
    return env[name];
  };
  for (const key of ['agency', 'deviceId', 'manufacturer', 'model', 'firmware', 'ntcipEdition']) {
    if (typeof input.identity?.[key] !== 'string' || !input.identity[key].trim()) throw new Error('Controller identity and selected NTCIP edition must be recorded.');
  }
  return { host: c.host, port: c.port, slot: c.slot, snmpVersion: c.snmpVersion, maxVarbinds: c.maxVarbinds, timeout: 1500,
    context: c.context,
    ...(c.snmpVersion === '3' ? { user: { name: c.user?.name, authProtocol: c.user?.authProtocol, privProtocol: c.user?.privProtocol,
      authKey: secret(c.user?.authKeyEnv), privKey: secret(c.user?.privKeyEnv) } } : { community: secret(c.communityEnv) }) };
}
async function inspectController(input, env = process.env) {
  const config = benchConfig(input, env);
  const identity = Object.fromEntries(['agency', 'deviceId', 'manufacturer', 'model', 'firmware', 'ntcipEdition'].map(k => [k, input.identity[k]]));
  const report = { schemaVersion: 1, identity, environment: 'Operator-selected endpoint; physical equipment not established by this tool', mode: 'read-only', startedAt: new Date().toISOString(),
    physicalInteroperability: 'not accepted; read-only discovery is insufficient',
    fieldAcceptance: FIELD_REQUIREMENTS.map(id => ({ id, status: 'not tested', evidence: null })) };
  const adapter = new NtcipAdapter(config);
  try {
    report.capabilities = await adapter.discover();
    report.observation = await adapter.read();
    report.result = 'observed';
  } catch {
    // Protocol-library errors can contain sensitive remote details. Keep the
    // shareable report credential-free; investigate failed reads on-site.
    report.result = 'failed';
    report.error = 'Controller discovery/readback failed or capabilities are outside the selected text profile.';
  } finally { adapter.close(); }
  report.finishedAt = new Date().toISOString();
  return report;
}
module.exports = { benchConfig, inspectController };

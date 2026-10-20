'use strict';
// Replays a recording of a real sign controller and runs the read-only bench
// against it. The recording is plain Net-SNMP output that anyone with access to
// a sign can produce and email — no network access or credentials change hands:
//
//   snmpwalk -v2c -c <read-only community> -On <controller> 1.3.6.1.4.1.1206.4.2.3 > sign-walk.txt
//
// The walk is converted to snmpsim's .snmprec format and served on loopback by
// snmpsim-command-responder (pip install snmpsim), which answers with exactly
// the recorded values. A pass means the ATMS adapter understands that real
// controller's data; it says nothing about the controller's write behaviour.
//
//   node scripts/atms-replay-recording.cjs sign-walk.txt identity.json report.json
//   node scripts/atms-replay-recording.cjs --matrix [sign-walk.txt]   # every SNMP profile
//
// Requires: pip install snmpsim pysmi cryptography (cryptography is what lets
// snmpsim encrypt SNMPv3; without it every v3 read fails with a decryption error).
//
// identity.json holds the asset record ({ agency, deviceId, manufacturer, model,
// firmware, ntcipEdition }) so the report says which equipment was recorded.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { inspectController, benchConfig } = require('../services/atms/ntcip/bench');
const { NtcipAdapter } = require('../services/atms/ntcip/adapter');
const { OID } = require('../services/atms/ntcip/protocol');

// Net-SNMP value types → snmprec tags (RFC 1155/2578 BER types).
const TAGS = { INTEGER: '2', 'Gauge32': '66', 'Counter32': '65', 'Counter64': '70', 'Timeticks': '67', 'IpAddress': '64', OID: '6' };

function walkToSnmprec(text) {
  const records = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\.?((?:\d+\.)+\d+)\s+=\s+(.*)$/);
    if (!m) continue;
    const oid = m[1];
    let rest = m[2];
    if (/^No (Such|more)/i.test(rest)) continue;
    if (rest === '""') { records.push([oid, '4', '']); continue; }
    const typed = rest.match(/^([A-Za-z0-9-]+):\s?(.*)$/);
    if (!typed) throw new Error(`Line ${i + 1}: unrecognized value "${rest}". Record with plain snmpwalk -On output.`);
    const [, type, value] = typed;
    if (type === 'STRING') {
      // Quoted strings may continue over lines; join until the closing quote.
      let v = value;
      while (!/^".*"$/s.test(v) && i + 1 < lines.length) v += '\n' + lines[++i];
      const body = v.replace(/^"/, '').replace(/"$/, '').replace(/\\(["\\])/g, '$1');
      records.push([oid, '4x', Buffer.from(body, 'latin1').toString('hex')]);
    } else if (type === 'Hex-STRING') {
      let hex = value;
      // Long hex strings wrap onto following lines that contain only hex pairs.
      while (i + 1 < lines.length && /^\s*([0-9A-Fa-f]{2}\s*)+$/.test(lines[i + 1])) hex += ' ' + lines[++i];
      records.push([oid, '4x', hex.replace(/\s+/g, '').toLowerCase()]);
    } else if (type === 'INTEGER') {
      // Enumerations print as "central(4)"; keep the number.
      const n = value.match(/-?\d+(?=\)?\s*$)/);
      if (!n) throw new Error(`Line ${i + 1}: INTEGER without a number.`);
      records.push([oid, '2', n[0]]);
    } else if (type === 'Timeticks') {
      records.push([oid, '67', (value.match(/\((\d+)\)/) || [, value])[1]]);
    } else if (type === 'OID') {
      records.push([oid, '6', value.replace(/^\./, '')]);
    } else if (TAGS[type]) {
      records.push([oid, TAGS[type], value.trim()]);
    } else throw new Error(`Line ${i + 1}: unsupported type ${type}.`);
  }
  const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let k = 0; k < Math.max(x.length, y.length); k++) { if (x[k] === undefined) return -1; if (y[k] === undefined) return 1; if (x[k] !== y[k]) return x[k] - y[k]; } return 0; };
  records.sort((a, b) => cmp(a[0], b[0]));
  return records.map(r => r.join('|')).join('\n') + '\n';
}

const freePort = () => new Promise((resolve, reject) => {
  const s = require('node:dgram').createSocket('udp4');
  s.once('error', reject);
  s.bind(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

// `snmp` selects how the ATMS talks to the replayed controller: { version: '1' | '2c' | '3',
// maxVarbinds, v3: { authProtocol: 'sha' | 'sha256', privProtocol: 'aes' } }. snmpsim is an
// independent SNMP implementation (pysnmp), so v3 here checks the ATMS security code against
// an agent it was not written alongside.
async function replay(walkText, identity, { responder = process.env.SNMPSIM_RESPONDER || 'snmpsim-command-responder', snmp = {} } = {}) {
  const version = snmp.version || '2c';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atms-replay-'));
  const community = 'recording';
  const port = await freePort();
  fs.writeFileSync(path.join(dir, `${community}.snmprec`), walkToSnmprec(walkText));
  // snmpsim reads options after --v3-engine-id as that engine's configuration.
  const args = ['--cache-dir=' + path.join(dir, 'cache')];
  const env = { REPLAY_COMMUNITY: community };
  const controller = { host: '127.0.0.1', port, snmpVersion: version, slot: 1, maxVarbinds: snmp.maxVarbinds || 1 };
  if (version === '3') {
    const { randomBytes } = require('node:crypto');
    const auth = (snmp.v3 && snmp.v3.authProtocol) || 'sha';
    const priv = (snmp.v3 && snmp.v3.privProtocol) || 'aes';
    env.REPLAY_AUTH = randomBytes(12).toString('hex');
    env.REPLAY_PRIV = randomBytes(12).toString('hex');
    // snmpsim selects the data file by SNMPv3 context name.
    args.push('--v3-engine-id=auto', `--data-dir=${dir}`, '--v3-user=atms-replay', `--v3-auth-key=${env.REPLAY_AUTH}`, `--v3-auth-proto=${auth.toUpperCase()}`,
      `--v3-priv-key=${env.REPLAY_PRIV}`, `--v3-priv-proto=${priv.toUpperCase()}`);
    controller.context = community;
    controller.user = { name: 'atms-replay', authProtocol: auth, privProtocol: priv, authKeyEnv: 'REPLAY_AUTH', privKeyEnv: 'REPLAY_PRIV' };
  } else { args.push(`--data-dir=${dir}`); controller.communityEnv = 'REPLAY_COMMUNITY'; }
  args.push(`--agent-udpv4-endpoint=127.0.0.1:${port}`);
  const child = spawn(responder, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  let spawnError = null;
  child.on('error', error => { spawnError = error; });
  child.stderr.on('data', d => { stderr += d; });
  const exited = new Promise(resolve => child.once('exit', code => resolve(code)));
  try {
    // Ready means it answers a real request: snmpsim logs before it can serve,
    // and a cold Python start can outlast the bench's timeout.
    const probe = new NtcipAdapter({ ...benchConfig({ identity, controller }, env), timeout: 1000 });
    try {
      for (const deadline = Date.now() + 30000; ;) {
        if (spawnError) throw new Error(`Cannot start ${responder} (pip install snmpsim pysmi cryptography): ${spawnError.message}`);
        if (child.exitCode !== null) throw new Error(`snmpsim exited: ${stderr.slice(-400)}`);
        try { await probe.get(OID.characterHeight); break; }
        catch (error) { if (Date.now() > deadline) throw new Error(`snmpsim did not answer: ${error.message}`); await new Promise(r => setTimeout(r, 300)); }
      }
    } finally { probe.close(); }
    // Negative case: the controller is up and answering, but the ATMS holds the wrong secret.
    const used = snmp.wrongCredentials ? { ...env, REPLAY_COMMUNITY: 'not-the-community', ...(env.REPLAY_PRIV ? { REPLAY_PRIV: 'wrong-' + env.REPLAY_PRIV } : {}) } : env;
    const report = await inspectController({ identity, controller }, used);
    report.environment = 'Replay of a recorded controller walk; values are real, behaviour is snmpsim';
    return report;
  } finally {
    if (!spawnError) { child.kill(); await exited; }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Every SNMP profile the ATMS supports, against one recording, plus the two
// cases that must fail. Run before trusting a new recording or a dependency bump.
const MATRIX = [
  { name: 'SNMPv1', snmp: { version: '1' }, expect: 'observed' },
  { name: 'SNMPv2c', snmp: { version: '2c' }, expect: 'observed' },
  { name: 'SNMPv2c, 8 values per request', snmp: { version: '2c', maxVarbinds: 8 }, expect: 'observed' },
  { name: 'SNMPv3 SHA/AES', snmp: { version: '3', v3: { authProtocol: 'sha', privProtocol: 'aes' } }, expect: 'observed' },
  { name: 'SNMPv3 SHA-256/AES', snmp: { version: '3', v3: { authProtocol: 'sha256', privProtocol: 'aes' } }, expect: 'observed' },
  { name: 'SNMPv3 SHA-256/AES, 8 values per request', snmp: { version: '3', maxVarbinds: 8, v3: { authProtocol: 'sha256', privProtocol: 'aes' } }, expect: 'observed' },
  { name: 'SNMPv2c with the wrong community is refused', snmp: { version: '2c', wrongCredentials: true }, expect: 'failed' },
  { name: 'SNMPv3 with the wrong privacy key is refused', snmp: { version: '3', wrongCredentials: true, v3: { authProtocol: 'sha256', privProtocol: 'aes' } }, expect: 'failed' }
];

async function matrix(walkText, identity) {
  let failed = 0;
  let pages;
  for (const c of MATRIX) {
    let result;
    try {
      const report = await replay(walkText, identity, { snmp: c.snmp });
      result = report.result;
      if (result === 'observed') pages = report.observation.display.pages;
    } catch (error) { result = `error: ${error.message.split('\n')[0]}`; }
    const ok = result === c.expect;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name} — ${result}`);
  }
  if (pages) console.log(`\nRecorded sign shows: ${pages.map(p => p.join(' / ')).join('  ||  ')}`);
  console.log(`${MATRIX.length - failed}/${MATRIX.length} passed. snmpsim (pysnmp) is the agent; the ATMS adapter is the manager.`);
  return failed;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--matrix') {
    const walk = args[1] || path.join(__dirname, '../products/atms/fixtures/sample-sign-walk.txt');
    const identity = { agency: 'MATRIX', deviceId: path.basename(walk), manufacturer: 'recording', model: 'recording', firmware: 'recording', ntcipEdition: 'as recorded' };
    if (await matrix(fs.readFileSync(walk, 'utf8'), identity)) process.exitCode = 1;
    return;
  }
  const [walk, identityPath, output] = args;
  if (!walk || !identityPath || !output) throw new Error('Use <snmpwalk.txt> <identity.json> <new-report.json>, or --matrix [snmpwalk.txt].');
  const fd = fs.openSync(output, 'wx', 0o600);
  try {
    const report = await replay(fs.readFileSync(walk, 'utf8'), JSON.parse(fs.readFileSync(identityPath, 'utf8')));
    fs.writeFileSync(fd, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ result: report.result, report: output, capabilities: report.capabilities, message: report.observation?.display?.text ?? null }, null, 2));
    if (report.result !== 'observed') process.exitCode = 1;
  } finally { fs.closeSync(fd); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { walkToSnmprec, replay };

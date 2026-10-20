'use strict';
// Exercises scripts/atms-bench.cjs end to end against loopback emulators, as a
// separate process exactly as it runs in the field. Run it on the field laptop
// immediately before a real read-only inspection: a pass here means a field
// failure is the controller or network, not the tool.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { createEmulator } = require('../services/atms/ntcip/emulator');

const BENCH = path.join(__dirname, 'atms-bench.cjs');
// Async on purpose: a synchronous child would block the emulator in this process.
const bench = (cfg, out, env) => new Promise(resolve => execFile(process.execPath, [BENCH, '--config', cfg, '--output', out],
  { env: { ...process.env, ...env } }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr })));
const identity = deviceId => ({ agency: 'SELFTEST', deviceId, manufacturer: 'emulator', model: 'emulator', firmware: 'n/a', ntcipEdition: 'NTCIP 1203 (emulated)' });

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atms-bench-selftest-'));
  const results = [];
  const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };
  const cases = [
    { name: 'SNMPv1 healthy sign', version: '1', maxVarbinds: 1, expect: 'observed' },
    { name: 'SNMPv2c sign showing a local message', version: '2c', maxVarbinds: 1, message: 'ROAD WORK AHEAD', expect: 'observed' },
    { name: 'SNMPv3 (SHA/AES) healthy sign', version: '3', maxVarbinds: 8, expect: 'observed' },
    { name: 'SNMPv2c offline sign', version: '2c', maxVarbinds: 1, fault: 'offline', expect: 'failed' }
  ];
  try {
    for (const [i, c] of cases.entries()) {
      const emu = await createEmulator({ snmpVersion: c.version });
      try {
        if (c.fault) emu.setFault(c.fault);
        if (c.message) emu.override(c.message);
        const controller = { host: '127.0.0.1', port: emu.port, snmpVersion: c.version, slot: 1, maxVarbinds: c.maxVarbinds };
        let env;
        if (c.version === '3') {
          const u = emu.user;
          controller.user = { name: u.name, authProtocol: u.authProtocol, privProtocol: u.privProtocol, authKeyEnv: 'SELFTEST_AUTH', privKeyEnv: 'SELFTEST_PRIV' };
          env = { SELFTEST_AUTH: u.authKey, SELFTEST_PRIV: u.privKey };
        } else {
          controller.communityEnv = 'SELFTEST_COMMUNITY';
          env = { SELFTEST_COMMUNITY: emu.community };
        }
        const cfg = path.join(dir, `case-${i}.json`);
        const out = path.join(dir, `case-${i}-report.json`);
        fs.writeFileSync(cfg, JSON.stringify({ identity: identity(`SELFTEST-${i}`), controller }));
        await bench(cfg, out, env);
        const report = JSON.parse(fs.readFileSync(out, 'utf8'));
        const after = emu.snapshot();
        const text = JSON.stringify(report);
        check(c.name, report.result === c.expect, `result ${report.result}`);
        check(`${c.name}: no activation sent`, after.activations === 0);
        check(`${c.name}: report omits host and credentials`, !text.includes('127.0.0.1') && !Object.values(env).some(v => text.includes(v)));
        check(`${c.name}: report is owner-only`, (fs.statSync(out).mode & 0o077) === 0);
        if (c.message) {
          check(`${c.name}: readback matches display`, report.observation?.message === c.message, `read "${report.observation?.message}"`);
          check(`${c.name}: message left on the sign`, after.message === c.message);
        }
        if (i === 0) {
          const rerun = await bench(cfg, out, env);
          check('existing report is never overwritten', rerun.code !== 0 && /EEXIST/.test(rerun.stderr));
        }
      } finally { await emu.close(); }
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed. Emulator results only; this is not field evidence.`);
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

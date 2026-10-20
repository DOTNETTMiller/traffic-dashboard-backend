'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { runCompatibility } = require('../services/atms/ntcip/acceptance');
async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output' || !args[1])) throw new Error('Use --output <new-report.json>. This runner only targets local emulators.');
  const output = args.length ? path.resolve(args[1]) : path.resolve(__dirname, '../products/atms/runtime/interop-reports', new Date().toISOString().replaceAll(':', '-') + '.json');
  const report = await runCompatibility();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: report.result, checks: report.checks, profiles: report.profiles.map(p => ({ id: p.id, result: p.result, failures: p.checks.filter(c => c.status === 'failed') })), report: output, sha256: report.sha256, synthetic: true, physicalInteroperability: 'not tested' }, null, 2));
  if (report.result !== 'passed') process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

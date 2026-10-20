'use strict';
const fs = require('node:fs');
const { inspectController } = require('../services/atms/ntcip/bench');
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--config' || args[2] !== '--output') throw new Error('Use --config <controller.json> --output <new-report.json>. Only GET requests are sent.');
  // Reserve the output before contacting equipment, avoiding accidental reruns
  // when a report already exists. The config file can never be overwritten.
  const fd = fs.openSync(args[3], 'wx', 0o600);
  try {
    const report = await inspectController(JSON.parse(fs.readFileSync(args[1], 'utf8')));
    fs.writeFileSync(fd, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ result: report.result, report: args[3], mode: report.mode, physicalInteroperability: report.physicalInteroperability }));
    if (report.result === 'failed') process.exitCode = 1;
  } finally { fs.closeSync(fd); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { runExercise } = require('../services/atms/simulation/exercises');
const args = process.argv.slice(2);
const exerciseAt = args.indexOf('--exercise'), outputAt = args.indexOf('--output');
const exercise = exerciseAt < 0 ? 'all' : args[exerciseAt + 1];
const output = outputAt < 0 ? path.resolve(__dirname, '../products/atms/runtime/simulation-reports', new Date().toISOString().replaceAll(':', '-') + '.json') : path.resolve(args[outputAt + 1] || '');
if (!exercise || (outputAt >= 0 && !args[outputAt + 1])) throw new Error('Use --exercise <catalog-id|all> and --output <new-report.json>.');
async function main() {
  const report = await runExercise(exercise);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: report.result, checks: report.checks.length, wallDurationMs: report.wallDurationMs, report: output, sha256: report.sha256, error: report.error, synthetic: true, physicalInteroperability: 'not tested' }, null, 2));
  if (report.result !== 'passed') process.exitCode = 1;
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });

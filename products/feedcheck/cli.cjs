#!/usr/bin/env node
'use strict';
const fs = require('node:fs/promises');
const checker = require('./src/checker.js');
async function main() {
  const args = process.argv.slice(2), options = {};
  if (args.includes('--help') || args.length === 0) {
    console.log('PurposeBuilt FeedCheck\n\nnode cli.cjs --input feed.json [--source "Agency feed"] [--output report.json]\nnode cli.cjs --url https://agency.gov/feed.json [--format csv] [--output findings.csv]\n\nOptions:\n  --baseline snapshot.json   Compare IDs and content with a prior assessment\n  --snapshot snapshot.json   Save this assessment as a baseline\n  --feed-minutes 60          Feed freshness review threshold\n  --event-hours 24           Event confirmation review threshold\n  --expired-hours 1          Ended-event grace period\n  --fail-on error|warning    Exit 1 for errors, or for errors and warnings\n\nExit codes: 0 completed; 1 configured finding threshold met; 2 input or execution error.\nNode.js 20+ required. No dependencies.');
    return;
  }
  const allowed = new Set(['input', 'url', 'source', 'output', 'format', 'baseline', 'snapshot', 'feed-minutes', 'event-hours', 'expired-hours', 'fail-on']);
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i].slice(2);
    if (!args[i].startsWith('--') || !allowed.has(name) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Unknown or incomplete option: ' + args[i]);
    if (name in options) throw new Error('Repeated option: ' + args[i]);
    options[name] = args[i + 1];
  }
  if (!!options.input === !!options.url) throw new Error('Choose exactly one --input file or --url.');
  if (options.format && !['json', 'csv'].includes(options.format)) throw new Error('--format must be json or csv.');
  if (options['fail-on'] && !['error', 'warning'].includes(options['fail-on'])) throw new Error('--fail-on must be error or warning.');
  let raw;
  if (options.input) {
    const stat = await fs.stat(options.input);
    if (stat.size > checker.MAX_BYTES) throw new Error('Input exceeds 20 MB.');
    raw = await fs.readFile(options.input, 'utf8');
  } else {
    const url = new URL(options.url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use a public HTTP(S) URL without credentials, query parameters, or a fragment. Download authenticated feeds separately.');
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error' });
    if (!response.ok) throw new Error('Feed returned HTTP ' + response.status + '.');
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > checker.MAX_BYTES) throw new Error('Feed exceeds 20 MB.');
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  const report = checker.analyze(checker.parse(raw), { source: options.source || options.input || options.url, feedMinutes: options['feed-minutes'], eventHours: options['event-hours'], expiredHours: options['expired-hours'] });
  if (options.baseline) {
    const stat = await fs.stat(options.baseline);
    if (stat.size > checker.MAX_BYTES) throw new Error('Baseline exceeds 20 MB.');
    report.comparison = checker.compare(report, checker.parse(await fs.readFile(options.baseline, 'utf8')));
  }
  // Do not overwrite an input or the baseline by accident.
  const path = require('node:path');
  const outputs = [options.output, options.snapshot].filter(Boolean).map(p => path.resolve(p));
  const inputs = [options.input, options.baseline].filter(Boolean).map(p => path.resolve(p));
  if (new Set(outputs).size !== outputs.length || outputs.some(p => inputs.includes(p))) throw new Error('Output, snapshot, and input paths must be different.');
  if (options.snapshot) await fs.writeFile(options.snapshot, JSON.stringify(checker.snapshot(report), null, 2), { flag: 'wx' });
  const { entries, ...publicReport } = report;
  const result = options.format === 'csv' ? checker.csv(report) : JSON.stringify(publicReport, null, 2) + '\n';
  if (options.output) await fs.writeFile(options.output, result, { flag: 'wx' });
  else process.stdout.write(result);
  process.stderr.write(report.summary.records + ' records · ' + report.summary.errors + ' errors · ' + report.summary.warnings + ' warnings\n');
  if (options['fail-on'] && (report.summary.errors > 0 || (options['fail-on'] === 'warning' && report.summary.warnings > 0))) process.exitCode = 1;
}
main().catch(error => { console.error('FeedCheck: ' + error.message); process.exitCode = 2; });

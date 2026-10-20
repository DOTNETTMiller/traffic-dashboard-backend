'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = __dirname;
execFileSync(process.execPath, [path.join(root, 'build.cjs')], { stdio: 'inherit' });
// Use the parent project's existing archiver only at packaging time.
// Customers need no libraries to use either the HTML app or the CLI.
const archiver = require('archiver');
async function archive(name, files) {
  const target = path.join(root, 'dist', name);
  const output = fs.createWriteStream(target);
  const zip = archiver('zip', { zlib: { level: 9 } });
  const completion = new Promise((resolve, reject) => { output.on('close', resolve); output.on('error', reject); zip.on('error', reject); });
  zip.pipe(output);
  for (const [source, destination] of files) zip.file(path.join(root, source), { name: destination });
  await zip.finalize(); await completion;
  console.log(name + ' · ' + (fs.statSync(target).size / 1024).toFixed(1) + ' KB');
  return createHash('sha256').update(fs.readFileSync(target)).digest('hex') + '  ' + name;
}
(async () => {
  const customer = await archive('purposebuilt-feedcheck-local-v0.1.0.zip', [
    ['dist/feedcheck.html', 'feedcheck.html'], ['QUICKSTART.txt', 'QUICKSTART.txt'], ['cli.cjs', 'cli.cjs'], ['src/checker.js', 'src/checker.js']
  ]);
  const site = await archive('purposebuilt-feedcheck-site-v0.1.0.zip', [
    ['dist/site/index.html', 'feedcheck/index.html'], ['dist/site/demo.html', 'feedcheck/demo.html']
  ]);
  fs.writeFileSync(path.join(root, 'dist', 'SHA256SUMS.txt'), customer + '\n' + site + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });

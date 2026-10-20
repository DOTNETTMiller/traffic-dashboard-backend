'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { Operations } = require('../services/atms/core');
function main() {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--source-db', '--atms-db', '--agency', '--mode'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw new Error('Use --source-db <existing.db> --atms-db <workspace.sqlite> --agency <agency> --mode <training|live>.');
    options[args[i]] = args[i + 1];
  }
  if (Object.keys(options).length !== 4 || !/^[A-Za-z0-9_-]{1,80}$/.test(options['--agency']) || !['training', 'live'].includes(options['--mode'])) throw new Error('Explicit source database, ATMS database, agency and mode are required.');
  const sourceFile = fs.realpathSync(options['--source-db']);
  const destination = fs.existsSync(options['--atms-db']) ? fs.realpathSync(options['--atms-db']) : path.resolve(options['--atms-db']);
  if (sourceFile === destination) throw new Error('The source inventory database must be separate from the ATMS workspace.');
  const source = new Database(sourceFile, { readonly: true, fileMustExist: true });
  let rows;
  try { rows = source.prepare("SELECT * FROM its_equipment WHERE LOWER(state_key)='ia' ORDER BY id LIMIT 25001").all(); }
  finally { source.close(); }
  if (rows.length > 25000) throw new Error('Inventory exceeds the 25,000-record collection limit.');
  if (!rows.length) throw new Error('No Iowa inventory was found; no empty snapshot will be imported.');
  const ops = new Operations({ filename: destination, mode: options['--mode'] });
  try {
    const stream = ops.db.transaction(() => {
      const result = ops.recordCollections(options['--agency'], [{ sourceId: 'iowa-its-inventory', kind: 'inventory', status: 'ok',
        collectedAt: ops.iso(), sourceObservedAt: null,
        payload: { equipment: rows, total: rows.length, source: { kind: 'sqlite', file: path.basename(sourceFile), table: 'its_equipment', state: 'ia' } } }])[0];
      ops.audit(ops.system(options['--agency']), 'source:iowa-its-inventory', 'source.inventory_imported', { batchId: result.batchId, count: result.count, rejected: result.rejected });
      return result;
    }).immediate();
    const types = rows.reduce((out, row) => { const type = row.equipment_type + (row.equipment_subtype ? '/' + row.equipment_subtype : ''); out[type] = (out[type] || 0) + 1; return out; }, {});
    console.log(JSON.stringify({ source: 'Iowa ITS GIS-derived inventory', records: rows.length, types, agency: options['--agency'], mode: options['--mode'],
      accepted: stream.count, rejected: stream.rejected, batchId: stream.batchId, sha256: stream.sha256, inventoryOnly: true, fieldTelemetryEstablished: false }, null, 2));
  } finally { ops.close(); }
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }

'use strict';
const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const [source, destination] = process.argv.slice(2);
if (!source || !destination) { console.error('Usage: node products/atms/backup.cjs SOURCE.sqlite NEW-BACKUP.sqlite'); process.exit(2); }
if (fs.existsSync(destination) || path.resolve(source) === path.resolve(destination)) { console.error('Choose a new backup destination; existing files will not be overwritten.'); process.exit(2); }
const db = new Database(source, { readonly: true, fileMustExist: true });
db.backup(destination).then(() => {
  db.close();
  const backup = new Database(destination, { readonly: true });
  const check = backup.pragma('integrity_check', { simple: true });
  backup.close(); fs.chmodSync(destination, 0o600);
  if (check !== 'ok') throw new Error('Backup integrity check failed.');
  console.log('Verified SQLite snapshot written to ' + destination + '. Store it with an external audit checkpoint.');
}).catch(error => { console.error(error.message); process.exitCode = 1; });

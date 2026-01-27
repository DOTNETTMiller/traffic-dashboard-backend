const Database = require('better-sqlite3');
const db = new Database(process.env.DATABASE_URL || 'states.db');

const result = db.prepare('DELETE FROM cached_events').run();
console.log('Deleted', result.changes, 'cached events');

db.close();

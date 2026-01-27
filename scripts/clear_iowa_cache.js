#!/usr/bin/env node

/**
 * Clear Iowa cached events to force regeneration with new interstate geometry
 */

const Database = require('better-sqlite3');
const path = require('path');

// Database connection - support both SQLite and PostgreSQL
const dbPath = process.env.DATABASE_URL || path.join(__dirname, '..', 'states.db');
const db = new Database(dbPath);

console.log('🧹 Clearing Iowa cached events...\n');

try {
  const result = db.prepare('DELETE FROM cached_events WHERE state_key = ?').run('ia');
  console.log(`✅ Deleted ${result.changes} Iowa cached events`);
  console.log('\nIowa events will be regenerated with interstate geometry on next API call.');
} catch (error) {
  console.error('❌ Error clearing cache:', error.message);
  process.exit(1);
}

db.close();

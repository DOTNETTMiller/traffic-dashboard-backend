#!/usr/bin/env node

/**
 * Clean corrupted OSRM cache entries
 *
 * Removes cache entries where geometry is "undefined" or invalid JSON
 */

const Database = require('better-sqlite3');
const path = require('path');

// Database connection - support both SQLite and PostgreSQL
const dbPath = process.env.DATABASE_URL || path.join(__dirname, '..', 'states.db');
const db = new Database(dbPath);

console.log('🧹 Cleaning corrupted OSRM cache entries...\n');

// Find all cache entries
const allEntries = db.prepare('SELECT cache_key, geometry FROM osrm_geometry_cache').all();
console.log(`Found ${allEntries.length} total cache entries`);

let corruptedCount = 0;
const corruptedKeys = [];

// Check each entry for valid JSON
for (const entry of allEntries) {
  try {
    // Try to parse the geometry
    if (entry.geometry === 'undefined' || entry.geometry === 'null') {
      corruptedKeys.push(entry.cache_key);
      corruptedCount++;
    } else {
      const parsed = JSON.parse(entry.geometry);
      // Verify it's an array
      if (!Array.isArray(parsed)) {
        corruptedKeys.push(entry.cache_key);
        corruptedCount++;
      }
    }
  } catch (error) {
    // Invalid JSON
    corruptedKeys.push(entry.cache_key);
    corruptedCount++;
  }
}

console.log(`Found ${corruptedCount} corrupted entries`);

if (corruptedCount > 0) {
  // Delete corrupted entries
  const deleteStmt = db.prepare('DELETE FROM osrm_geometry_cache WHERE cache_key = ?');

  for (const key of corruptedKeys) {
    deleteStmt.run(key);
  }

  console.log(`✅ Deleted ${corruptedCount} corrupted cache entries`);
} else {
  console.log('✅ No corrupted entries found');
}

db.close();
console.log('\n✅ Cache cleanup complete!');

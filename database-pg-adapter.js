// PostgreSQL adapter that mimics better-sqlite3 API with sync-like interface
const { Pool } = require('pg');

class PostgreSQLAdapter {
  constructor(connectionString) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 30, // Maximum pool size (increased for concurrent geometry lookups)
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000, // Increased from 10s to 30s to handle peak load
    });
    this.initialized = false;
    this.initPromise = null;
    console.log('🐘 Connecting to PostgreSQL database...');
  }

  // Initialize must be called and awaited before using the database
  async init() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // Test connection
        const client = await this.pool.connect();
        console.log('🐘 Connected to PostgreSQL database');
        client.release();
        this.initialized = true;
      } catch (err) {
        console.error('❌ Failed to connect to PostgreSQL:', err.message);
        throw err;
      }
    })();

    return this.initPromise;
  }

  // Execute SQL without returning results (for CREATE TABLE, etc.)
  async execAsync(sql) {
    await this.init();

    // Split by semicolon to handle multiple statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      // Convert SQLite syntax to PostgreSQL
      const pgStatement = this.convertSQLiteToPostgreSQL(statement);
      await this.pool.query(pgStatement);
    }
  }

  // Synchronous-looking exec for backward compatibility (wraps async)
  exec(sql) {
    // This is a hack - we assume init() was already called
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Queue the statements
    const promise = (async () => {
      for (const statement of statements) {
        const pgStatement = this.convertSQLiteToPostgreSQL(statement);
        await this.pool.query(pgStatement);
      }
    })();

    // Store for later if needed
    this._lastExecPromise = promise;
  }

  // Wait for any pending exec operations
  async waitForPendingOps() {
    if (this._lastExecPromise) {
      await this._lastExecPromise;
      this._lastExecPromise = null;
    }
  }

  // Convert SQLite SQL to PostgreSQL SQL
  convertSQLiteToPostgreSQL(sql) {
    let converted = sql;

    // INTEGER PRIMARY KEY AUTOINCREMENT -> SERIAL PRIMARY KEY
    converted = converted.replace(
      /INTEGER PRIMARY KEY AUTOINCREMENT/gi,
      'SERIAL PRIMARY KEY'
    );

    // DATETIME -> TIMESTAMP
    converted = converted.replace(/DATETIME/gi, 'TIMESTAMP');

    // REAL -> DOUBLE PRECISION
    converted = converted.replace(/\bREAL\b/gi, 'DOUBLE PRECISION');

    // INSERT OR REPLACE -> INSERT ... ON CONFLICT ... DO UPDATE
    // Match: INSERT OR REPLACE INTO table_name (col1, col2) VALUES (?, ?)
    const insertOrReplaceMatch = converted.match(/INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (insertOrReplaceMatch) {
      const tableName = insertOrReplaceMatch[1];
      const columns = insertOrReplaceMatch[2].split(',').map(c => c.trim());
      const valuePlaceholders = insertOrReplaceMatch[3];

      // Assume first column is the primary key for ON CONFLICT
      const pkColumn = columns[0];

      // Build UPDATE SET clause for all columns except PK
      const updateSetClauses = columns.slice(1).map((col, idx) => {
        const placeholderNum = idx + 2; // Skip first placeholder (PK)
        return `${col} = $${placeholderNum}`;
      }).join(', ');

      converted = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${valuePlaceholders}) ON CONFLICT (${pkColumn}) DO UPDATE SET ${updateSetClauses}`;
    }

    return converted;
  }

  // Prepare a statement (returns an object with async run, get, all methods)
  prepare(sql) {
    const self = this;
    // Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, etc.)
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
    // Convert SQLite-specific syntax (INSERT OR REPLACE, etc.) to PostgreSQL
    pgSql = self.convertSQLiteToPostgreSQL(pgSql);

    return {
      // Run a statement (INSERT, UPDATE, DELETE) - returns Promise
      async run(...params) {
        await self.init();
        const res = await self.pool.query(pgSql, params);
        return {
          changes: res.rowCount,
          lastInsertRowid: res.rows[0]?.id
        };
      },

      // Get a single row - returns Promise
      async get(...params) {
        await self.init();
        const res = await self.pool.query(pgSql, params);
        return res.rows[0] || null;
      },

      // Get all rows - returns Promise
      async all(...params) {
        await self.init();
        const res = await self.pool.query(pgSql, params);
        return res.rows;
      }
    };
  }

  // Direct query method (for parameterized queries with $1, $2, etc.)
  async query(sql, params = []) {
    await this.init();
    return await this.pool.query(sql, params);
  }

  // Close the connection
  async close() {
    await this.pool.end();
    console.log('🐘 PostgreSQL connection closed');
  }
}

module.exports = PostgreSQLAdapter;

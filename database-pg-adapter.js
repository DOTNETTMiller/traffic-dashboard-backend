// PostgreSQL adapter that mimics better-sqlite3 API with sync-like interface
const { Pool } = require('pg');

class PostgreSQLAdapter {
  constructor(connectionString) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
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

    // BOOLEAN DEFAULT 0 -> BOOLEAN DEFAULT FALSE
    converted = converted.replace(/BOOLEAN\s+DEFAULT\s+0/gi, 'BOOLEAN DEFAULT FALSE');

    // BOOLEAN DEFAULT 1 -> BOOLEAN DEFAULT TRUE
    converted = converted.replace(/BOOLEAN\s+DEFAULT\s+1/gi, 'BOOLEAN DEFAULT TRUE');

    return converted;
  }

  // Prepare a statement (returns an object with async run, get, all methods)
  prepare(sql) {
    const self = this;
    // Convert SQLite syntax to PostgreSQL first
    let pgSql = this.convertSQLiteToPostgreSQL(sql);

    // Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, etc.)
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

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

  // Direct all() method for SELECT queries (used by sensor routes)
  async all(sql, params = []) {
    await this.init();
    // Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, etc.)
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    const res = await this.pool.query(pgSql, params);
    return res.rows;
  }

  // Direct runAsync() method for INSERT/UPDATE/DELETE (used by init scripts)
  async runAsync(sql, params = []) {
    await this.init();
    // Convert SQLite syntax to PostgreSQL
    let pgSql = this.convertSQLiteToPostgreSQL(sql);

    // Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, etc.)
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    const res = await this.pool.query(pgSql, params);
    return {
      changes: res.rowCount,
      lastInsertRowid: res.rows[0]?.id
    };
  }

  // Close the connection
  async close() {
    await this.pool.end();
    console.log('🐘 PostgreSQL connection closed');
  }
}

module.exports = PostgreSQLAdapter;

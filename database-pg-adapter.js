// PostgreSQL adapter that mimics better-sqlite3 API
const { Pool } = require('pg');
const deasync = require('deasync');

class PostgreSQLAdapter {
  constructor(connectionString) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    console.log('🐘 Connected to PostgreSQL database');
  }

  // Execute SQL without returning results (for CREATE TABLE, etc.)
  exec(sql) {
    // Split by semicolon to handle multiple statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Use deasync to make this synchronous
    let done = false;
    let error = null;

    Promise.all(statements.map(statement => {
      // Convert SQLite syntax to PostgreSQL
      let pgStatement = this.convertSQLiteToPostgreSQL(statement);
      return this.pool.query(pgStatement);
    })).then(() => {
      done = true;
    }).catch(err => {
      error = err;
      done = true;
    });

    // Block until promise resolves
    deasync.loopWhile(() => !done);

    if (error) throw error;
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

    // BOOLEAN columns are fine in PostgreSQL

    // Handle ON DELETE CASCADE - PostgreSQL supports this

    return converted;
  }

  // Prepare a statement (returns an object with run, get, all methods)
  prepare(sql) {
    const self = this;
    // Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, etc.)
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    return {
      // Run a statement (INSERT, UPDATE, DELETE)
      run(...params) {
        let done = false;
        let error = null;
        let result = null;

        self.pool.query(pgSql, params).then(res => {
          result = {
            changes: res.rowCount,
            lastInsertRowid: res.rows[0]?.id
          };
          done = true;
        }).catch(err => {
          error = err;
          done = true;
        });

        deasync.loopWhile(() => !done);
        if (error) throw error;
        return result;
      },

      // Get a single row
      get(...params) {
        let done = false;
        let error = null;
        let result = null;

        self.pool.query(pgSql, params).then(res => {
          result = res.rows[0] || null;
          done = true;
        }).catch(err => {
          error = err;
          done = true;
        });

        deasync.loopWhile(() => !done);
        if (error) throw error;
        return result;
      },

      // Get all rows
      all(...params) {
        let done = false;
        let error = null;
        let result = null;

        self.pool.query(pgSql, params).then(res => {
          result = res.rows;
          done = true;
        }).catch(err => {
          error = err;
          done = true;
        });

        deasync.loopWhile(() => !done);
        if (error) throw error;
        return result;
      }
    };
  }

  // Close the connection
  async close() {
    await this.pool.end();
    console.log('🐘 PostgreSQL connection closed');
  }
}

module.exports = PostgreSQLAdapter;

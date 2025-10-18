// State Configuration Database with Encrypted Credentials
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

// Database file location
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'states.db');

// Encryption key (should be stored in environment variable in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

class StateDatabase {
  constructor() {
    this.db = new Database(DB_PATH);
    this.initSchema();
  }

  // Create database schema
  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS states (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        state_key TEXT UNIQUE NOT NULL,
        state_name TEXT NOT NULL,
        api_url TEXT NOT NULL,
        api_type TEXT NOT NULL,
        format TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS state_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        state_key TEXT UNIQUE NOT NULL,
        credentials_encrypted TEXT,
        FOREIGN KEY (state_key) REFERENCES states(state_key) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS admin_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS state_passwords (
        state_key TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      );

      CREATE TABLE IF NOT EXISTS state_messages (
        id TEXT PRIMARY KEY,
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        event_id TEXT,
        priority TEXT DEFAULT 'normal',
        read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS event_comments (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        state_key TEXT NOT NULL,
        state_name TEXT NOT NULL,
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_state_key ON states(state_key);
      CREATE INDEX IF NOT EXISTS idx_enabled ON states(enabled);
      CREATE INDEX IF NOT EXISTS idx_message_to ON state_messages(to_state);
      CREATE INDEX IF NOT EXISTS idx_message_from ON state_messages(from_state);
      CREATE INDEX IF NOT EXISTS idx_event_comments ON event_comments(event_id);
    `);

    console.log('✅ Database schema initialized');
  }

  // Encryption utilities
  encrypt(text) {
    if (!text) return null;
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(text) {
    if (!text) return null;
    try {
      const algorithm = 'aes-256-cbc';
      const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
      const parts = text.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }

  // Add a new state
  addState(config) {
    const {
      stateKey,
      stateName,
      apiUrl,
      apiType,
      format,
      credentials = {}
    } = config;

    try {
      // Start transaction
      const insertState = this.db.prepare(`
        INSERT INTO states (state_key, state_name, api_url, api_type, format)
        VALUES (?, ?, ?, ?, ?)
      `);

      const insertCreds = this.db.prepare(`
        INSERT INTO state_credentials (state_key, credentials_encrypted)
        VALUES (?, ?)
      `);

      const transaction = this.db.transaction(() => {
        insertState.run(stateKey, stateName, apiUrl, apiType, format);

        if (Object.keys(credentials).length > 0) {
          const encrypted = this.encrypt(credentials);
          insertCreds.run(stateKey, encrypted);
        }
      });

      transaction();
      console.log(`✅ Added state: ${stateName} (${stateKey})`);
      return { success: true, stateKey };
    } catch (error) {
      console.error('Error adding state:', error);
      return { success: false, error: error.message };
    }
  }

  // Update a state
  updateState(stateKey, updates) {
    try {
      const fields = [];
      const values = [];

      if (updates.stateName) {
        fields.push('state_name = ?');
        values.push(updates.stateName);
      }
      if (updates.apiUrl) {
        fields.push('api_url = ?');
        values.push(updates.apiUrl);
      }
      if (updates.apiType) {
        fields.push('api_type = ?');
        values.push(updates.apiType);
      }
      if (updates.format) {
        fields.push('format = ?');
        values.push(updates.format);
      }
      if (updates.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(updates.enabled ? 1 : 0);
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(stateKey);

      if (fields.length > 1) { // More than just updated_at
        const sql = `UPDATE states SET ${fields.join(', ')} WHERE state_key = ?`;
        const stmt = this.db.prepare(sql);
        stmt.run(...values);
      }

      // Update credentials if provided
      if (updates.credentials) {
        const encrypted = this.encrypt(updates.credentials);
        const upsertCreds = this.db.prepare(`
          INSERT INTO state_credentials (state_key, credentials_encrypted)
          VALUES (?, ?)
          ON CONFLICT(state_key) DO UPDATE SET credentials_encrypted = excluded.credentials_encrypted
        `);
        upsertCreds.run(stateKey, encrypted);
      }

      console.log(`✅ Updated state: ${stateKey}`);
      return { success: true };
    } catch (error) {
      console.error('Error updating state:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete a state
  deleteState(stateKey) {
    try {
      const stmt = this.db.prepare('DELETE FROM states WHERE state_key = ?');
      stmt.run(stateKey);
      console.log(`✅ Deleted state: ${stateKey}`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting state:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all states
  getAllStates(includeCredentials = false) {
    try {
      const states = this.db.prepare(`
        SELECT s.*, c.credentials_encrypted
        FROM states s
        LEFT JOIN state_credentials c ON s.state_key = c.state_key
        WHERE s.enabled = 1
        ORDER BY s.state_name
      `).all();

      return states.map(state => {
        const credentials = includeCredentials && state.credentials_encrypted
          ? this.decrypt(state.credentials_encrypted)
          : null;

        return {
          stateKey: state.state_key,
          stateName: state.state_name,
          apiUrl: state.api_url,
          apiType: state.api_type,
          format: state.format,
          enabled: state.enabled === 1,
          createdAt: state.created_at,
          updatedAt: state.updated_at,
          ...(includeCredentials && credentials && { credentials })
        };
      });
    } catch (error) {
      console.error('Error getting states:', error);
      return [];
    }
  }

  // Get a single state
  getState(stateKey, includeCredentials = false) {
    try {
      const state = this.db.prepare(`
        SELECT s.*, c.credentials_encrypted
        FROM states s
        LEFT JOIN state_credentials c ON s.state_key = c.state_key
        WHERE s.state_key = ?
      `).get(stateKey);

      if (!state) return null;

      const credentials = includeCredentials && state.credentials_encrypted
        ? this.decrypt(state.credentials_encrypted)
        : null;

      return {
        stateKey: state.state_key,
        stateName: state.state_name,
        apiUrl: state.api_url,
        apiType: state.api_type,
        format: state.format,
        enabled: state.enabled === 1,
        createdAt: state.created_at,
        updatedAt: state.updated_at,
        ...(includeCredentials && credentials && { credentials })
      };
    } catch (error) {
      console.error('Error getting state:', error);
      return null;
    }
  }

  // Admin token management
  createAdminToken(description = 'Admin token') {
    const token = crypto.randomBytes(32).toString('hex');
    try {
      const stmt = this.db.prepare(`
        INSERT INTO admin_tokens (token, description)
        VALUES (?, ?)
      `);
      stmt.run(token, description);
      console.log(`✅ Created admin token: ${description}`);
      return token;
    } catch (error) {
      console.error('Error creating admin token:', error);
      return null;
    }
  }

  verifyAdminToken(token) {
    try {
      const result = this.db.prepare(`
        SELECT * FROM admin_tokens
        WHERE token = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `).get(token);
      return !!result;
    } catch (error) {
      console.error('Error verifying admin token:', error);
      return false;
    }
  }

  // Migration: Import existing API_CONFIG
  migrateFromConfig(apiConfig) {
    console.log('🔄 Migrating existing state configurations to database...');

    Object.entries(apiConfig).forEach(([stateKey, config]) => {
      // Check if state already exists
      const existing = this.getState(stateKey);
      if (existing) {
        console.log(`⏭️  Skipping ${config.name} (already exists)`);
        return;
      }

      // Extract credentials - handle API keys and basic auth
      const credentials = {};

      if (config.apiKey) {
        credentials.apiKey = config.apiKey;
      }
      if (config.username) {
        credentials.username = config.username;
      }
      if (config.password) {
        credentials.password = config.password;
      }

      // Determine API URL (prioritize specific endpoints)
      let apiUrl = config.wzdxUrl || config.eventsUrl || config.url || '';

      // Determine API type
      let apiType = 'Custom';
      if (config.wzdxUrl) {
        apiType = 'WZDx';
      } else if (config.eventsUrl?.includes('feu-g')) {
        apiType = 'FEU-G';
      } else if (config.eventsUrl?.includes('rss')) {
        apiType = 'RSS';
      } else if (config.format === 'json') {
        apiType = 'Custom JSON';
      }

      this.addState({
        stateKey,
        stateName: config.name,
        apiUrl: apiUrl,
        apiType: apiType,
        format: config.format || 'json',
        credentials: Object.keys(credentials).length > 0 ? credentials : undefined
      });
    });

    console.log('✅ Migration complete');
  }

  // State Authentication Methods
  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  setStatePassword(stateKey, password) {
    try {
      const passwordHash = this.hashPassword(password);
      const stmt = this.db.prepare(`
        INSERT INTO state_passwords (state_key, password_hash)
        VALUES (?, ?)
        ON CONFLICT(state_key) DO UPDATE SET password_hash = excluded.password_hash
      `);
      stmt.run(stateKey, passwordHash);
      console.log(`✅ Set password for state: ${stateKey}`);
      return { success: true };
    } catch (error) {
      console.error('Error setting state password:', error);
      return { success: false, error: error.message };
    }
  }

  verifyStatePassword(stateKey, password) {
    try {
      const passwordHash = this.hashPassword(password);
      const result = this.db.prepare(`
        SELECT * FROM state_passwords WHERE state_key = ? AND password_hash = ?
      `).get(stateKey, passwordHash);

      if (result) {
        // Update last login
        this.db.prepare(`
          UPDATE state_passwords SET last_login = CURRENT_TIMESTAMP WHERE state_key = ?
        `).run(stateKey);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error verifying state password:', error);
      return false;
    }
  }

  // Direct Messaging Methods
  sendMessage(messageData) {
    const { fromState, toState, subject, message, eventId = null, priority = 'normal' } = messageData;
    try {
      const id = crypto.randomBytes(16).toString('hex');
      const stmt = this.db.prepare(`
        INSERT INTO state_messages (id, from_state, to_state, subject, message, event_id, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, fromState, toState, subject, message, eventId, priority);
      console.log(`💬 Message sent from ${fromState} to ${toState}`);
      return { success: true, id };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  }

  getInbox(stateKey) {
    try {
      const messages = this.db.prepare(`
        SELECT * FROM state_messages
        WHERE to_state = ? OR to_state = 'ALL'
        ORDER BY created_at DESC
      `).all(stateKey);
      return messages;
    } catch (error) {
      console.error('Error getting inbox:', error);
      return [];
    }
  }

  getSentMessages(stateKey) {
    try {
      const messages = this.db.prepare(`
        SELECT * FROM state_messages
        WHERE from_state = ?
        ORDER BY created_at DESC
      `).all(stateKey);
      return messages;
    } catch (error) {
      console.error('Error getting sent messages:', error);
      return [];
    }
  }

  markMessageRead(messageId, stateKey) {
    try {
      const stmt = this.db.prepare(`
        UPDATE state_messages
        SET read = 1
        WHERE id = ? AND (to_state = ? OR to_state = 'ALL')
      `);
      stmt.run(messageId, stateKey);
      return { success: true };
    } catch (error) {
      console.error('Error marking message read:', error);
      return { success: false, error: error.message };
    }
  }

  getUnreadCount(stateKey) {
    try {
      const result = this.db.prepare(`
        SELECT COUNT(*) as count FROM state_messages
        WHERE (to_state = ? OR to_state = 'ALL') AND read = 0
      `).get(stateKey);
      return result.count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Event Comments Methods
  addEventComment(commentData) {
    const { eventId, stateKey, stateName, comment } = commentData;
    try {
      const id = crypto.randomBytes(16).toString('hex');
      const stmt = this.db.prepare(`
        INSERT INTO event_comments (id, event_id, state_key, state_name, comment)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(id, eventId, stateKey, stateName, comment);
      console.log(`💬 Comment added by ${stateName} on event ${eventId}`);
      return { success: true, id };
    } catch (error) {
      console.error('Error adding event comment:', error);
      return { success: false, error: error.message };
    }
  }

  getEventComments(eventId) {
    try {
      const comments = this.db.prepare(`
        SELECT * FROM event_comments
        WHERE event_id = ?
        ORDER BY created_at ASC
      `).all(eventId);
      return comments;
    } catch (error) {
      console.error('Error getting event comments:', error);
      return [];
    }
  }

  getAllEventComments() {
    try {
      const comments = this.db.prepare(`
        SELECT * FROM event_comments
        ORDER BY created_at DESC
      `).all();
      return comments;
    } catch (error) {
      console.error('Error getting all event comments:', error);
      return [];
    }
  }

  close() {
    this.db.close();
  }
}

// Export singleton instance
const db = new StateDatabase();
module.exports = db;

// State Configuration Database with Encrypted Credentials
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Detect database type
const IS_POSTGRES = !!process.env.DATABASE_URL;

let Database;
if (IS_POSTGRES) {
  console.log('🐘 Using PostgreSQL database');
  const PostgreSQLAdapter = require('./database-pg-adapter');
  Database = PostgreSQLAdapter;
} else {
  console.log('📁 Using SQLite database');
  Database = require('better-sqlite3');

  // Database file location (SQLite only)
  const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'states.db');

  // Ensure database directory exists (SQLite only)
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    console.log(`📁 Creating database directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }
  console.log(`🗄️  Database path: ${DB_PATH}`);
}

// Encryption key (should be stored in environment variable in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

const parseStateList = (value) => {
  if (!value) return [];
  try {
    if (value.trim().startsWith('[')) {
      return JSON.parse(value);
    }
    return value.split(',').map(s => s.trim()).filter(Boolean);
  } catch (error) {
    console.error('Error parsing state list:', error);
    return [];
  }
};

const serializeStateList = (list = []) => {
  if (!Array.isArray(list)) {
    return JSON.stringify([]);
  }
  return JSON.stringify(list.map(item => (typeof item === 'string' ? item.trim() : item)).filter(Boolean));
};

class StateDatabase {
  constructor() {
    if (IS_POSTGRES) {
      this.db = new Database(process.env.DATABASE_URL);
      this.isPostgres = true;
    } else {
      const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'states.db');
      this.db = new Database(DB_PATH);
      this.isPostgres = false;
      // Initialize schema immediately for SQLite
      this.initSchema();
    }
    this.initialized = false;
    this.initPromise = null;
  }

  // Async initialization for PostgreSQL
  async init() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (this.isPostgres) {
        // Initialize PostgreSQL connection first
        await this.db.init();

        // Then create schema (using async exec)
        await this.initSchemaAsync();

        console.log('✅ PostgreSQL database initialized');

        // Run health checks
        await this.healthCheck();
      } else {
        // Run health checks for SQLite
        await this.healthCheck();
      }
      this.initialized = true;
    })();

    return this.initPromise;
  }

  // Health check: verify critical tables exist
  async healthCheck() {
    console.log('🏥 Running database health check...');
    const requiredTables = [
      'states',
      'state_messages',
      'users',
      'truck_parking_facilities',
      'parking_availability',
      'user_state_subscriptions',
      'schema_migrations'
    ];

    const missingTables = [];

    for (const table of requiredTables) {
      try {
        if (this.isPostgres) {
          const result = await this.db.prepare(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_name = ?
            ) as exists
          `).get(table);
          if (!result || !result.exists) {
            missingTables.push(table);
          }
        } else {
          const result = await this.db.prepare(`
            SELECT name FROM sqlite_master WHERE type='table' AND name=?
          `).get(table);
          if (!result) {
            missingTables.push(table);
          }
        }
      } catch (error) {
        console.error(`❌ Error checking table ${table}:`, error.message);
        missingTables.push(table);
      }
    }

    if (missingTables.length > 0) {
      console.warn('⚠️  Warning: Missing tables:', missingTables.join(', '));
      console.warn('⚠️  Some features may not work correctly. Consider running migrations.');
    } else {
      console.log('✅ All critical tables present');
    }

    return {
      healthy: missingTables.length === 0,
      missingTables
    };
  }

  // Async version of initSchema for PostgreSQL
  async initSchemaAsync() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS states (
        id SERIAL PRIMARY KEY,
        state_key TEXT UNIQUE NOT NULL,
        state_name TEXT NOT NULL,
        api_url TEXT NOT NULL,
        api_type TEXT NOT NULL,
        format TEXT NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS state_credentials (
        id SERIAL PRIMARY KEY,
        state_key TEXT UNIQUE NOT NULL,
        credentials_encrypted TEXT,
        FOREIGN KEY (state_key) REFERENCES states(state_key) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS admin_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS state_passwords (
        state_key TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS state_messages (
        id TEXT PRIMARY KEY,
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        event_id TEXT,
        priority TEXT DEFAULT 'normal',
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS event_comments (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        state_key TEXT NOT NULL,
        state_name TEXT NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS interchanges (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        state_key TEXT NOT NULL,
        corridor TEXT,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        watch_radius_km DOUBLE PRECISION DEFAULT 15,
        notify_states TEXT NOT NULL,
        detour_message TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS detour_alerts (
        id SERIAL PRIMARY KEY,
        interchange_id INTEGER NOT NULL,
        event_id TEXT NOT NULL,
        event_state TEXT,
        event_corridor TEXT,
        event_location TEXT,
        event_description TEXT,
        severity TEXT,
        lanes_affected TEXT,
        notified_states TEXT,
        message TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        resolution_note TEXT,
        FOREIGN KEY (interchange_id) REFERENCES interchanges(id)
      );

      CREATE TABLE IF NOT EXISTS bridge_clearances (
        id SERIAL PRIMARY KEY,
        bridge_name TEXT NOT NULL,
        route TEXT NOT NULL,
        state_key TEXT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        clearance_feet DOUBLE PRECISION NOT NULL,
        clearance_meters DOUBLE PRECISION NOT NULL,
        direction TEXT,
        restriction_type TEXT DEFAULT 'vertical',
        watch_radius_km DOUBLE PRECISION DEFAULT 10,
        warning_message TEXT,
        active BOOLEAN DEFAULT TRUE,
        last_verified TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bridge_clearance_warnings (
        id SERIAL PRIMARY KEY,
        bridge_id INTEGER NOT NULL,
        event_id TEXT NOT NULL,
        event_state TEXT,
        event_description TEXT,
        distance_km DOUBLE PRECISION,
        message TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        FOREIGN KEY (bridge_id) REFERENCES bridge_clearances(id)
      );

      CREATE TABLE IF NOT EXISTS corridor_regulations (
        id SERIAL PRIMARY KEY,
        corridor TEXT NOT NULL,
        state_key TEXT NOT NULL,
        state_name TEXT NOT NULL,
        state_code TEXT NOT NULL,
        bounds_start_lat DOUBLE PRECISION,
        bounds_start_lng DOUBLE PRECISION,
        bounds_end_lat DOUBLE PRECISION,
        bounds_end_lng DOUBLE PRECISION,
        legal_single_axle INTEGER,
        legal_tandem_axle INTEGER,
        legal_tridem_axle INTEGER,
        legal_gvw INTEGER,
        permitted_single_axle INTEGER,
        permitted_tandem_axle INTEGER,
        permitted_tridem_axle INTEGER,
        max_length_ft DOUBLE PRECISION,
        max_width_ft DOUBLE PRECISION,
        max_height_ft DOUBLE PRECISION,
        permit_cost_data TEXT,
        requirements TEXT,
        color TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS feed_submissions (
        id SERIAL PRIMARY KEY,
        submitted_by INTEGER,
        submitter_username TEXT,
        state_key TEXT,
        state_name TEXT NOT NULL,
        api_url TEXT NOT NULL,
        api_type TEXT NOT NULL,
        format TEXT NOT NULL,
        notes TEXT,
        test_results TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        reviewed_by INTEGER,
        reviewer_username TEXT,
        review_notes TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        organization TEXT,
        state_key TEXT,
        role TEXT DEFAULT 'user',
        active BOOLEAN DEFAULT TRUE,
        notify_on_messages BOOLEAN DEFAULT TRUE,
        notify_on_high_severity BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_conversations (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        state_key TEXT,
        role TEXT NOT NULL,
        message TEXT NOT NULL,
        context_type TEXT,
        context_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS truck_parking_facilities (
        id SERIAL PRIMARY KEY,
        facility_id TEXT UNIQUE,
        facility_name TEXT NOT NULL,
        state TEXT NOT NULL,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        address TEXT,
        total_spaces INTEGER,
        truck_spaces INTEGER,
        amenities TEXT,
        facility_type TEXT DEFAULT 'Rest Area',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS parking_availability (
        id SERIAL PRIMARY KEY,
        facility_id TEXT NOT NULL,
        available_spaces INTEGER,
        occupied_spaces INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_prediction BOOLEAN DEFAULT FALSE,
        prediction_confidence DOUBLE PRECISION,
        FOREIGN KEY (facility_id) REFERENCES truck_parking_facilities(facility_id)
      );

      CREATE TABLE IF NOT EXISTS parking_occupancy_patterns (
        id SERIAL PRIMARY KEY,
        facility_id TEXT NOT NULL,
        day_of_week INTEGER NOT NULL,
        hour_of_day INTEGER NOT NULL,
        avg_occupancy_rate DOUBLE PRECISION NOT NULL,
        sample_count INTEGER DEFAULT 1,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(facility_id, day_of_week, hour_of_day),
        FOREIGN KEY (facility_id) REFERENCES truck_parking_facilities(facility_id)
      );

      CREATE TABLE IF NOT EXISTS parking_prediction_accuracy (
        id SERIAL PRIMARY KEY,
        facility_id TEXT NOT NULL,
        predicted_available INTEGER NOT NULL,
        actual_available INTEGER NOT NULL,
        error_magnitude INTEGER NOT NULL,
        percent_error DOUBLE PRECISION NOT NULL,
        event_nearby BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (facility_id) REFERENCES truck_parking_facilities(facility_id)
      );

      CREATE TABLE IF NOT EXISTS parking_ground_truth_observations (
        id SERIAL PRIMARY KEY,
        facility_id TEXT NOT NULL,
        camera_view TEXT NOT NULL,
        observed_count INTEGER NOT NULL,
        observed_total_capacity INTEGER,
        predicted_count INTEGER,
        predicted_occupancy_rate DOUBLE PRECISION,
        observer_notes TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (facility_id) REFERENCES truck_parking_facilities(facility_id)
      );

      CREATE TABLE IF NOT EXISTS user_state_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        state_key TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, state_key),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_parking_facility_id ON truck_parking_facilities(facility_id);
      CREATE INDEX IF NOT EXISTS idx_parking_state ON truck_parking_facilities(state);
      CREATE INDEX IF NOT EXISTS idx_parking_availability_facility ON parking_availability(facility_id);
      CREATE INDEX IF NOT EXISTS idx_parking_availability_timestamp ON parking_availability(timestamp);
      CREATE INDEX IF NOT EXISTS idx_occupancy_patterns_facility ON parking_occupancy_patterns(facility_id);
      CREATE INDEX IF NOT EXISTS idx_occupancy_patterns_time ON parking_occupancy_patterns(day_of_week, hour_of_day);
      CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_facility ON parking_prediction_accuracy(facility_id);
    `);
  }

  // Run database migrations for schema updates
  runMigrations() {
    try {
      // Check if users table exists
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").all();
      if (tables.length === 0) return; // Table doesn't exist yet, will be created by initSchema

      // Check if notification columns exist
      const columns = this.db.prepare("PRAGMA table_info(users)").all();
      const hasNotifyOnMessages = columns.some(col => col.name === 'notify_on_messages');
      const hasNotifyOnHighSeverity = columns.some(col => col.name === 'notify_on_high_severity');

      // Add missing columns
      if (!hasNotifyOnMessages) {
        console.log('🔄 Adding notify_on_messages column to users table...');
        this.db.exec('ALTER TABLE users ADD COLUMN notify_on_messages BOOLEAN DEFAULT 1');
        console.log('✅ Added notify_on_messages column');
      }

      if (!hasNotifyOnHighSeverity) {
        console.log('🔄 Adding notify_on_high_severity column to users table...');
        this.db.exec('ALTER TABLE users ADD COLUMN notify_on_high_severity BOOLEAN DEFAULT 1');
        console.log('✅ Added notify_on_high_severity column');
      }

      // Check for state_key column (older databases might not have it)
      const hasStateKey = columns.some(col => col.name === 'state_key');
      if (!hasStateKey) {
        console.log('🔄 Adding state_key column to users table...');
        this.db.exec('ALTER TABLE users ADD COLUMN state_key TEXT');
        console.log('✅ Added state_key column');
      }

      // Check if parking_ground_truth_observations table exists
      const groundTruthTables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='parking_ground_truth_observations'").all();
      if (groundTruthTables.length > 0) {
        // Check if observed_total_capacity column exists
        const groundTruthColumns = this.db.prepare("PRAGMA table_info(parking_ground_truth_observations)").all();
        const hasTotalCapacity = groundTruthColumns.some(col => col.name === 'observed_total_capacity');

        if (!hasTotalCapacity) {
          console.log('🔄 Adding observed_total_capacity column to parking_ground_truth_observations table...');
          this.db.exec('ALTER TABLE parking_ground_truth_observations ADD COLUMN observed_total_capacity INTEGER');
          console.log('✅ Added observed_total_capacity column');
        }
      }
    } catch (error) {
      console.error('⚠️  Migration error (will retry on next startup):', error.message);
    }
  }

  // Create database schema
  initSchema() {
    // Run migrations first
    this.runMigrations();

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

      CREATE TABLE IF NOT EXISTS interchanges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        state_key TEXT NOT NULL,
        corridor TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        watch_radius_km REAL DEFAULT 15,
        notify_states TEXT NOT NULL,
        detour_message TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS detour_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interchange_id INTEGER NOT NULL,
        event_id TEXT NOT NULL,
        event_state TEXT,
        event_corridor TEXT,
        event_location TEXT,
        event_description TEXT,
        severity TEXT,
        lanes_affected TEXT,
        notified_states TEXT,
        message TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        resolution_note TEXT,
        FOREIGN KEY (interchange_id) REFERENCES interchanges(id)
      );

      CREATE TABLE IF NOT EXISTS bridge_clearances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bridge_name TEXT NOT NULL,
        route TEXT NOT NULL,
        state_key TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        clearance_feet REAL NOT NULL,
        clearance_meters REAL NOT NULL,
        direction TEXT,
        restriction_type TEXT DEFAULT 'vertical',
        watch_radius_km REAL DEFAULT 10,
        warning_message TEXT,
        active BOOLEAN DEFAULT 1,
        last_verified DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bridge_clearance_warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bridge_id INTEGER NOT NULL,
        event_id TEXT NOT NULL,
        event_state TEXT,
        event_description TEXT,
        distance_km REAL,
        message TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        FOREIGN KEY (bridge_id) REFERENCES bridge_clearances(id)
      );

      CREATE TABLE IF NOT EXISTS corridor_regulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        corridor TEXT NOT NULL,
        state_key TEXT NOT NULL,
        state_name TEXT NOT NULL,
        state_code TEXT NOT NULL,
        bounds_start_lat REAL,
        bounds_start_lng REAL,
        bounds_end_lat REAL,
        bounds_end_lng REAL,
        legal_single_axle INTEGER,
        legal_tandem_axle INTEGER,
        legal_tridem_axle INTEGER,
        legal_gvw INTEGER,
        permitted_single_axle INTEGER,
        permitted_tandem_axle INTEGER,
        permitted_tridem_axle INTEGER,
        max_length_ft REAL,
        max_width_ft REAL,
        max_height_ft REAL,
        permit_cost_data TEXT,
        requirements TEXT,
        color TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS feed_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submitted_by INTEGER,
        submitter_username TEXT,
        submitter_email TEXT,
        feed_name TEXT NOT NULL,
        feed_url TEXT NOT NULL,
        format TEXT NOT NULL,
        api_type TEXT,
        state_key TEXT,
        credentials TEXT,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        admin_username TEXT,
        admin_note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME,
        FOREIGN KEY (submitted_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        organization TEXT,
        state_key TEXT,
        role TEXT DEFAULT 'user',
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        notify_on_messages BOOLEAN DEFAULT 1,
        notify_on_high_severity BOOLEAN DEFAULT 1,
        FOREIGN KEY (state_key) REFERENCES states(state_key)
      );

      CREATE TABLE IF NOT EXISTS truck_parking_facilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facility_id TEXT UNIQUE,
        facility_name TEXT NOT NULL,
        state TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        address TEXT,
        total_spaces INTEGER,
        truck_spaces INTEGER,
        amenities TEXT,
        facility_type TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS parking_availability (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facility_id TEXT NOT NULL,
        available_spaces INTEGER,
        occupied_spaces INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_prediction BOOLEAN DEFAULT 0,
        prediction_confidence REAL,
        FOREIGN KEY (facility_id) REFERENCES truck_parking_facilities(facility_id)
      );

      CREATE TABLE IF NOT EXISTS parking_occupancy_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facility_id TEXT NOT NULL,
        day_of_week INTEGER NOT NULL,
        hour_of_day INTEGER NOT NULL,
        avg_occupancy_rate REAL,
        sample_count INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(facility_id, day_of_week, hour_of_day),
        FOREIGN KEY (facility_id) REFERENCES truck_parking_facilities(facility_id)
      );

      CREATE TABLE IF NOT EXISTS parking_prediction_accuracy (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facility_id TEXT NOT NULL,
        predicted_available INTEGER,
        actual_available INTEGER,
        prediction_error INTEGER,
        percent_error REAL,
        event_nearby BOOLEAN DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (facility_id) REFERENCES truck_parking_facilities(facility_id)
      );

      CREATE TABLE IF NOT EXISTS parking_ground_truth_observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facility_id TEXT NOT NULL,
        camera_view TEXT NOT NULL,
        observed_count INTEGER NOT NULL,
        predicted_count INTEGER,
        predicted_occupancy_rate REAL,
        observer_notes TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (facility_id) REFERENCES truck_parking_facilities(facility_id)
      );

      CREATE TABLE IF NOT EXISTS chat_conversations (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        state_key TEXT,
        role TEXT NOT NULL,
        message TEXT NOT NULL,
        context_type TEXT,
        context_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS user_state_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        state_key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, state_key),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_state_key ON states(state_key);
      CREATE INDEX IF NOT EXISTS idx_enabled ON states(enabled);
      CREATE INDEX IF NOT EXISTS idx_message_to ON state_messages(to_state);
      CREATE INDEX IF NOT EXISTS idx_message_from ON state_messages(from_state);
      CREATE INDEX IF NOT EXISTS idx_event_comments ON event_comments(event_id);
      CREATE INDEX IF NOT EXISTS idx_interchanges_state ON interchanges(state_key);
      CREATE INDEX IF NOT EXISTS idx_interchanges_active ON interchanges(active);
      CREATE INDEX IF NOT EXISTS idx_detour_alert_status ON detour_alerts(status);
      CREATE INDEX IF NOT EXISTS idx_detour_alert_interchange ON detour_alerts(interchange_id);
      CREATE INDEX IF NOT EXISTS idx_feed_submissions_status ON feed_submissions(status);
      CREATE INDEX IF NOT EXISTS idx_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_parking_facility_id ON truck_parking_facilities(facility_id);
      CREATE INDEX IF NOT EXISTS idx_parking_state ON truck_parking_facilities(state);
      CREATE INDEX IF NOT EXISTS idx_parking_availability_facility ON parking_availability(facility_id);
      CREATE INDEX IF NOT EXISTS idx_parking_availability_timestamp ON parking_availability(timestamp);
      CREATE INDEX IF NOT EXISTS idx_occupancy_patterns_facility ON parking_occupancy_patterns(facility_id);
      CREATE INDEX IF NOT EXISTS idx_occupancy_patterns_time ON parking_occupancy_patterns(day_of_week, hour_of_day);
      CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_facility ON parking_prediction_accuracy(facility_id);
      CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_timestamp ON parking_prediction_accuracy(timestamp);
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
      // Gracefully handle decryption errors (likely due to ENCRYPTION_KEY mismatch)
      // Return null instead of crashing - credentials can be re-entered if needed
      if (!process.env.ENCRYPTION_KEY) {
        console.warn('⚠️  Decryption failed: ENCRYPTION_KEY not set in environment');
      } else {
        console.warn('⚠️  Decryption failed: credentials may have been encrypted with a different key');
      }
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

  setStateCredentials(stateKey, credentials = {}) {
    try {
      const encrypted = this.encrypt(credentials);
      const stmt = this.db.prepare(`
        INSERT INTO state_credentials (state_key, credentials_encrypted)
        VALUES (?, ?)
        ON CONFLICT(state_key) DO UPDATE SET credentials_encrypted = excluded.credentials_encrypted
      `);
      stmt.run(stateKey, encrypted);
      return { success: true };
    } catch (error) {
      console.error('Error setting state credentials:', error);
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
  async getAllStates(includeCredentials = false) {
    try {
      const states = await this.db.prepare(`
        SELECT s.*, c.credentials_encrypted
        FROM states s
        LEFT JOIN state_credentials c ON s.state_key = c.state_key
        WHERE s.enabled = true
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
  async createAdminToken(description = 'Admin token') {
    const token = crypto.randomBytes(32).toString('hex');
    try {
      if (this.isPostgres) {
        await this.db.query(`
          INSERT INTO admin_tokens (token, description)
          VALUES ($1, $2)
        `, [token, description]);
      } else {
        const stmt = this.db.prepare(`
          INSERT INTO admin_tokens (token, description)
          VALUES (?, ?)
        `);
        stmt.run(token, description);
      }
      console.log(`✅ Created admin token: ${description}`);
      return token;
    } catch (error) {
      console.error('Error creating admin token:', error);
      return null;
    }
  }

  async verifyAdminToken(token) {
    try {
      let result;
      if (this.isPostgres) {
        const queryResult = await this.db.query(`
          SELECT * FROM admin_tokens
          WHERE token = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `, [token]);
        result = queryResult.rows[0];
      } else {
        result = this.db.prepare(`
          SELECT * FROM admin_tokens
          WHERE token = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `).get(token);
      }
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
      const now = new Date().toISOString(); // UTC timestamp
      const stmt = this.db.prepare(`
        INSERT INTO state_messages (id, from_state, to_state, subject, message, event_id, priority, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, fromState, toState, subject, message, eventId, priority, now);
      console.log(`💬 Message sent from ${fromState} to ${toState}`);
      return { success: true, id, created_at: now };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  }

  async getInbox(stateKey) {
    try {
      const messages = await this.db.prepare(`
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

  async getSentMessages(stateKey) {
    try {
      const messages = await this.db.prepare(`
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
        WHERE (to_state = ? OR to_state = 'ALL') AND read = false
      `).get(stateKey);
      return result.count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Interchange Management
  async getActiveInterchanges() {
    try {
      const rows = await this.db.prepare(`
        SELECT * FROM interchanges WHERE active = true ORDER BY name
      `).all();
      return rows.map(row => ({
        id: row.id,
        name: row.name,
        stateKey: row.state_key,
        corridor: row.corridor,
        latitude: row.latitude,
        longitude: row.longitude,
        watchRadiusKm: row.watch_radius_km || 15,
        notifyStates: parseStateList(row.notify_states),
        detourMessage: row.detour_message,
        active: row.active === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error loading interchanges:', error);
      return [];
    }
  }

  getInterchanges() {
    try {
      const rows = this.db.prepare(`
        SELECT * FROM interchanges ORDER BY active DESC, name ASC
      `).all();
      return rows.map(row => ({
        id: row.id,
        name: row.name,
        stateKey: row.state_key,
        corridor: row.corridor,
        latitude: row.latitude,
        longitude: row.longitude,
        watchRadiusKm: row.watch_radius_km || 15,
        notifyStates: parseStateList(row.notify_states),
        detourMessage: row.detour_message,
        active: row.active === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error getting interchanges:', error);
      return [];
    }
  }

  createInterchange(data) {
    const {
      name,
      stateKey,
      corridor = null,
      latitude,
      longitude,
      watchRadiusKm = 15,
      notifyStates = [],
      detourMessage = null,
      active = true
    } = data;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        name,
        stateKey,
        corridor,
        latitude,
        longitude,
        watchRadiusKm,
        serializeStateList(notifyStates),
        detourMessage,
        active ? 1 : 0
      );
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      console.error('Error creating interchange:', error);
      return { success: false, error: error.message };
    }
  }

  updateInterchange(id, updates) {
    try {
      const fields = [];
      const values = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.stateKey !== undefined) {
        fields.push('state_key = ?');
        values.push(updates.stateKey);
      }
      if (updates.corridor !== undefined) {
        fields.push('corridor = ?');
        values.push(updates.corridor);
      }
      if (updates.latitude !== undefined) {
        fields.push('latitude = ?');
        values.push(updates.latitude);
      }
      if (updates.longitude !== undefined) {
        fields.push('longitude = ?');
        values.push(updates.longitude);
      }
      if (updates.watchRadiusKm !== undefined) {
        fields.push('watch_radius_km = ?');
        values.push(updates.watchRadiusKm);
      }
      if (updates.notifyStates !== undefined) {
        fields.push('notify_states = ?');
        values.push(serializeStateList(updates.notifyStates));
      }
      if (updates.detourMessage !== undefined) {
        fields.push('detour_message = ?');
        values.push(updates.detourMessage);
      }
      if (updates.active !== undefined) {
        fields.push('active = ?');
        values.push(updates.active ? 1 : 0);
      }

      if (fields.length === 0) {
        return { success: false, error: 'No fields to update' };
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      const sql = `UPDATE interchanges SET ${fields.join(', ')} WHERE id = ?`;
      values.push(id);
      const stmt = this.db.prepare(sql);
      stmt.run(...values);
      return { success: true };
    } catch (error) {
      console.error('Error updating interchange:', error);
      return { success: false, error: error.message };
    }
  }

  deleteInterchange(id) {
    try {
      const stmt = this.db.prepare(`DELETE FROM interchanges WHERE id = ?`);
      stmt.run(id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting interchange:', error);
      return { success: false, error: error.message };
    }
  }

  submitFeed(data) {
    const {
      submittedBy,
      submitterUsername,
      submitterEmail,
      feedName,
      feedUrl,
      format,
      apiType,
      stateKey,
      credentials = {},
      notes
    } = data;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO feed_submissions (
          submitted_by, submitter_username, submitter_email,
          feed_name, feed_url, format, api_type, state_key,
          credentials, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        submittedBy || null,
        submitterUsername || null,
        submitterEmail || null,
        feedName,
        feedUrl,
        format,
        apiType || null,
        stateKey ? stateKey.toLowerCase() : null,
        Object.keys(credentials || {}).length ? this.encrypt(credentials) : null,
        notes || null
      );

      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      console.error('Error submitting feed:', error);
      return { success: false, error: error.message };
    }
  }

  getFeedSubmissions(status = 'pending') {
    try {
      const rows = this.db.prepare(`
        SELECT * FROM feed_submissions
        ${status === 'all' ? '' : 'WHERE status = ?'}
        ORDER BY created_at DESC
      `).all(status === 'all' ? undefined : status);

      return rows.map(row => ({
        id: row.id,
        submittedBy: row.submitted_by,
        submitterUsername: row.submitter_username,
        submitterEmail: row.submitter_email,
        feedName: row.feed_name,
        feedUrl: row.feed_url,
        format: row.format,
        apiType: row.api_type,
        stateKey: row.state_key,
        credentials: row.credentials ? this.decrypt(row.credentials) : null,
        notes: row.notes,
        status: row.status,
        adminUsername: row.admin_username,
        adminNote: row.admin_note,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        approvedAt: row.approved_at
      }));
    } catch (error) {
      console.error('Error loading feed submissions:', error);
      return [];
    }
  }

  getFeedSubmission(id) {
    try {
      const row = this.db.prepare(`
        SELECT * FROM feed_submissions WHERE id = ?
      `).get(id);
      if (!row) return null;

      return {
        id: row.id,
        submittedBy: row.submitted_by,
        submitterUsername: row.submitter_username,
        submitterEmail: row.submitter_email,
        feedName: row.feed_name,
        feedUrl: row.feed_url,
        format: row.format,
        apiType: row.api_type,
        stateKey: row.state_key,
        credentials: row.credentials ? this.decrypt(row.credentials) : null,
        notes: row.notes,
        status: row.status,
        adminUsername: row.admin_username,
        adminNote: row.admin_note,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        approvedAt: row.approved_at
      };
    } catch (error) {
      console.error('Error getting feed submission:', error);
      return null;
    }
  }

  updateFeedSubmissionStatus(id, status, adminUsername = null, adminNote = null) {
    try {
      const stmt = this.db.prepare(`
        UPDATE feed_submissions
        SET status = ?, admin_username = ?, admin_note = ?,
            updated_at = CURRENT_TIMESTAMP,
            approved_at = CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END
        WHERE id = ?
      `);
      stmt.run(status, adminUsername, adminNote, status, id);
      return { success: true };
    } catch (error) {
      console.error('Error updating feed submission:', error);
      return { success: false, error: error.message };
    }
  }
  async getActiveDetourAlerts() {
    try {
      const rows = await this.db.prepare(`
        SELECT da.*, i.name as interchange_name, i.state_key as interchange_state,
               i.corridor as interchange_corridor, i.latitude, i.longitude, i.notify_states
        FROM detour_alerts da
        INNER JOIN interchanges i ON da.interchange_id = i.id
        WHERE da.status = 'active'
        ORDER BY da.created_at DESC
      `).all();
      return rows.map(row => ({
        id: row.id,
        interchangeId: row.interchange_id,
        interchangeName: row.interchange_name,
        interchangeState: row.interchange_state,
        interchangeCorridor: row.interchange_corridor,
        latitude: row.latitude,
        longitude: row.longitude,
        notifyStates: parseStateList(row.notify_states),
        eventId: row.event_id,
        eventState: row.event_state,
        eventCorridor: row.event_corridor,
        eventLocation: row.event_location,
        eventDescription: row.event_description,
        severity: row.severity,
        lanesAffected: row.lanes_affected,
        notifiedStates: parseStateList(row.notified_states),
        message: row.message,
        status: row.status,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at
      }));
    } catch (error) {
      console.error('Error loading detour alerts:', error);
      return [];
    }
  }

  getActiveDetourAlertByInterchange(interchangeId) {
    try {
      const row = this.db.prepare(`
        SELECT * FROM detour_alerts
        WHERE interchange_id = ? AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `).get(interchangeId);
      return row || null;
    } catch (error) {
      console.error('Error fetching detour alert:', error);
      return null;
    }
  }

  createDetourAlert(alert) {
    const {
      interchangeId,
      eventId,
      eventState,
      eventCorridor,
      eventLocation,
      eventDescription,
      severity,
      lanesAffected,
      notifiedStates = [],
      message
    } = alert;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO detour_alerts (
          interchange_id, event_id, event_state, event_corridor, event_location,
          event_description, severity, lanes_affected, notified_states, message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        interchangeId,
        eventId,
        eventState,
        eventCorridor,
        eventLocation,
        eventDescription,
        severity,
        lanesAffected,
        serializeStateList(notifiedStates),
        message
      );
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      console.error('Error creating detour alert:', error);
      return { success: false, error: error.message };
    }
  }

  resolveDetourAlert(alertId, resolutionNote = null) {
    try {
      // Get the alert to find the associated event_id
      const alert = this.db.prepare('SELECT event_id FROM detour_alerts WHERE id = ?').get(alertId);

      // Update the alert status
      const stmt = this.db.prepare(`
        UPDATE detour_alerts
        SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolution_note = ?
        WHERE id = ?
      `);
      stmt.run(resolutionNote, alertId);

      // Delete associated state messages for this event's detour advisory
      if (alert && alert.event_id) {
        const deleteStmt = this.db.prepare(`
          DELETE FROM state_messages
          WHERE event_id = ?
          AND subject LIKE '%Detour Advisory%'
          AND from_state = 'ADMIN'
        `);
        deleteStmt.run(alert.event_id);
      }

      return { success: true };
    } catch (error) {
      console.error('Error resolving detour alert:', error);
      return { success: false, error: error.message };
    }
  }

  // Event Comments Methods
  addEventComment(commentData) {
    const { eventId, stateKey, stateName, comment } = commentData;
    try {
      const id = crypto.randomBytes(16).toString('hex');
      const now = new Date().toISOString(); // UTC timestamp
      const stmt = this.db.prepare(`
        INSERT INTO event_comments (id, event_id, state_key, state_name, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, eventId, stateKey, stateName, comment, now);
      console.log(`💬 Comment added by ${stateName} on event ${eventId}`);
      return { success: true, id, created_at: now };
    } catch (error) {
      console.error('Error adding event comment:', error);
      return { success: false, error: error.message };
    }
  }

  async getEventComments(eventId) {
    try {
      const comments = await this.db.prepare(`
        SELECT * FROM event_comments
        WHERE event_id = ?
        ORDER BY created_at ASC
      `).all(eventId);
      return comments || [];
    } catch (error) {
      console.error('Error getting event comments:', error);
      return [];
    }
  }

  async getAllEventComments() {
    try {
      const comments = await this.db.prepare(`
        SELECT * FROM event_comments
        ORDER BY created_at DESC
      `).all();
      return Array.isArray(comments) ? comments : [];
    } catch (error) {
      console.error('Error getting all event comments:', error);
      return [];
    }
  }

  async getEventCommentsByState(stateKey) {
    try {
      const comments = await this.db.prepare(`
        SELECT * FROM event_comments
        WHERE state_key = ?
        ORDER BY created_at DESC
      `).all(stateKey);
      return comments;
    } catch (error) {
      console.error('Error getting event comments by state:', error);
      return [];
    }
  }

  deleteEventComment(commentId, stateKey) {
    try {
      // Only allow deletion if the comment belongs to this state
      const result = this.db.prepare(`
        DELETE FROM event_comments
        WHERE id = ? AND state_key = ?
      `).run(commentId, stateKey);

      if (result.changes > 0) {
        console.log(`🗑️  Deleted event comment ${commentId} by ${stateKey}`);
        return { success: true };
      } else {
        return { success: false, error: 'Comment not found or unauthorized' };
      }
    } catch (error) {
      console.error('Error deleting event comment:', error);
      return { success: false, error: error.message };
    }
  }

  deleteStateMessage(messageId, stateKey) {
    try {
      // Only allow deletion if the message was sent by this state
      const result = this.db.prepare(`
        DELETE FROM state_messages
        WHERE id = ? AND from_state = ?
      `).run(messageId, stateKey);

      if (result.changes > 0) {
        console.log(`🗑️  Deleted state message ${messageId} by ${stateKey}`);
        return { success: true };
      } else {
        return { success: false, error: 'Message not found or unauthorized' };
      }
    } catch (error) {
      console.error('Error deleting state message:', error);
      return { success: false, error: error.message };
    }
  }

  // User Management Methods
  async createUser(userData) {
    const { username, email, password, fullName = null, organization = null, stateKey = null, role = 'user' } = userData;
    try {
      const passwordHash = this.hashPassword(password);

      if (this.isPostgres) {
        const result = await this.db.query(`
          INSERT INTO users (username, email, password_hash, full_name, organization, state_key, role)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [username, email, passwordHash, fullName, organization, stateKey, role]);
        console.log(`✅ Created user: ${username} (${email}) - ${stateKey || 'no state affiliation'}`);
        return { success: true, userId: result.rows[0].id };
      } else {
        const stmt = this.db.prepare(`
          INSERT INTO users (username, email, password_hash, full_name, organization, state_key, role)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const result = await stmt.run(username, email, passwordHash, fullName, organization, stateKey, role);
        console.log(`✅ Created user: ${username} (${email}) - ${stateKey || 'no state affiliation'}`);
        return { success: true, userId: result.lastInsertRowid };
      }
    } catch (error) {
      console.error('Error creating user:', error);
      return { success: false, error: error.message };
    }
  }

  async verifyUserPassword(username, password) {
    try {
      const passwordHash = this.hashPassword(password);
      let user;

      if (this.isPostgres) {
        const result = await this.db.query(`
          SELECT * FROM users WHERE username = $1 AND password_hash = $2 AND active = true
        `, [username, passwordHash]);
        user = result.rows[0];
      } else {
        user = await this.db.prepare(`
          SELECT * FROM users WHERE username = ? AND password_hash = ? AND active = true
        `).get(username, passwordHash);
      }

      if (user) {
        // Update last login
        if (this.isPostgres) {
          await this.db.query(`
            UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1
          `, [user.id]);
        } else {
          await this.db.prepare(`
            UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
          `).run(user.id);
        }

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          organization: user.organization,
          stateKey: user.state_key,
          role: user.role
        };
      }
      return null;
    } catch (error) {
      console.error('Error verifying user password:', error);
      return null;
    }
  }

  async getUserByUsername(username) {
    try {
      const user = await this.db.prepare(`
        SELECT id, username, email, full_name, organization, state_key, role, active, created_at, last_login
        FROM users WHERE username = ?
      `).get(username);

      if (!user) return null;

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        organization: user.organization,
        stateKey: user.state_key,
        role: user.role,
        active: user.active === 1,
        createdAt: user.created_at,
        lastLogin: user.last_login
      };
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async getAllUsers() {
    try {
      const users = await this.db.prepare(`
        SELECT id, username, email, full_name, organization, role, active, created_at, last_login,
               state_key, notify_on_messages, notify_on_high_severity
        FROM users
        ORDER BY created_at DESC
      `).all();

      return users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        organization: user.organization,
        role: user.role,
        active: user.active === 1,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        stateKey: user.state_key,
        notifyOnMessages: user.notify_on_messages === 1,
        notifyOnHighSeverity: user.notify_on_high_severity === 1
      }));
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  async updateUser(userId, updates) {
    try {
      const fields = [];
      const values = [];

      if (updates.email) {
        fields.push('email = ?');
        values.push(updates.email);
      }
      if (updates.fullName !== undefined) {
        fields.push('full_name = ?');
        values.push(updates.fullName);
      }
      if (updates.organization !== undefined) {
        fields.push('organization = ?');
        values.push(updates.organization);
      }
      if (updates.role) {
        fields.push('role = ?');
        values.push(updates.role);
      }
      if (updates.stateKey !== undefined) {
        fields.push('state_key = ?');
        values.push(updates.stateKey || null);
      }
      if (updates.active !== undefined) {
        fields.push('active = ?');
        values.push(updates.active ? 1 : 0);
      }
      if (updates.password) {
        fields.push('password_hash = ?');
        values.push(this.hashPassword(updates.password));
      }
      if (updates.notifyOnMessages !== undefined) {
        fields.push('notify_on_messages = ?');
        values.push(updates.notifyOnMessages ? 1 : 0);
      }
      if (updates.notifyOnHighSeverity !== undefined) {
        fields.push('notify_on_high_severity = ?');
        values.push(updates.notifyOnHighSeverity ? 1 : 0);
      }

      if (fields.length === 0) {
        return { success: false, error: 'No fields to update' };
      }

      values.push(userId);
      const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = this.db.prepare(sql);
      await stmt.run(...values);

      return { success: true };
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserById(userId) {
    try {
      let user;
      if (this.isPostgres) {
        const result = await this.db.query(`
          SELECT id, username, email, full_name, organization, role, active, state_key,
                 notify_on_messages, notify_on_high_severity, created_at, last_login
          FROM users
          WHERE id = $1
        `, [userId]);
        user = result.rows[0];
      } else {
        user = await this.db.prepare(`
          SELECT id, username, email, full_name, organization, role, active, state_key,
                 notify_on_messages, notify_on_high_severity, created_at, last_login
          FROM users
          WHERE id = ?
        `).get(userId);
      }

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        organization: user.organization,
        role: user.role,
        active: this.isPostgres ? user.active : (user.active === 1),
        stateKey: user.state_key,
        notifyOnMessages: this.isPostgres ? user.notify_on_messages : (user.notify_on_messages === 1),
        notifyOnHighSeverity: this.isPostgres ? user.notify_on_high_severity : (user.notify_on_high_severity === 1),
        createdAt: user.created_at,
        lastLogin: user.last_login
      };
    } catch (error) {
      console.error('Error getting user by id:', error);
      return null;
    }
  }

  deleteUser(userId) {
    try {
      const result = this.db.prepare(`
        DELETE FROM users WHERE id = ?
      `).run(userId);

      if (result.changes > 0) {
        console.log(`🗑️  Deleted user id ${userId}`);
        return { success: true };
      }
      return { success: false, error: 'User not found' };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: error.message };
    }
  }

  // Get users who should receive message notifications for a state
  async getUsersForMessageNotification(stateKey) {
    try {
      // Get users subscribed to this state via subscriptions table
      const users = await this.db.prepare(`
        SELECT DISTINCT u.id, u.username, u.email, u.full_name, u.organization, u.state_key
        FROM users u
        INNER JOIN user_state_subscriptions s ON u.id = s.user_id
        WHERE s.state_key = ?
          AND u.active = 1
          AND u.notify_on_messages = 1
          AND u.email IS NOT NULL
      `).all(stateKey);

      return users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        organization: user.organization,
        stateKey: user.state_key
      }));
    } catch (error) {
      console.error('Error getting users for message notification:', error);
      return [];
    }
  }

  // Get users who should receive high-severity event notifications for a state
  async getUsersForHighSeverityNotification(stateKey) {
    try {
      const users = await this.db.prepare(`
        SELECT id, username, email, full_name, organization, state_key
        FROM users
        WHERE state_key = ?
          AND active = 1
          AND notify_on_high_severity = 1
          AND email IS NOT NULL
      `).all(stateKey);

      return users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        organization: user.organization,
        stateKey: user.state_key
      }));
    } catch (error) {
      console.error('Error getting users for high-severity notification:', error);
      return [];
    }
  }

  // ==================== STATE SUBSCRIPTION MANAGEMENT ====================

  // Get all state subscriptions for a user
  async getUserStateSubscriptions(userId) {
    try {
      const subscriptions = await this.db.prepare(`
        SELECT state_key, created_at
        FROM user_state_subscriptions
        WHERE user_id = ?
        ORDER BY state_key
      `).all(userId);

      // Defensive check: ensure we got an array back
      if (!subscriptions || !Array.isArray(subscriptions)) {
        console.warn('getUserStateSubscriptions returned non-array result:', subscriptions);
        return [];
      }

      return subscriptions.map(sub => ({
        stateKey: sub.state_key,
        createdAt: sub.created_at
      }));
    } catch (error) {
      console.error('Error getting user state subscriptions:', error);
      return [];
    }
  }

  // Subscribe user to a state
  async subscribeUserToState(userId, stateKey) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO user_state_subscriptions (user_id, state_key)
        VALUES (?, ?)
      `);
      await stmt.run(userId, stateKey);

      return { success: true };
    } catch (error) {
      console.error('Error subscribing user to state:', error);
      return { success: false, error: error.message };
    }
  }

  // Unsubscribe user from a state
  async unsubscribeUserFromState(userId, stateKey) {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM user_state_subscriptions
        WHERE user_id = ? AND state_key = ?
      `);
      await stmt.run(userId, stateKey);

      return { success: true };
    } catch (error) {
      console.error('Error unsubscribing user from state:', error);
      return { success: false, error: error.message };
    }
  }

  // Set all state subscriptions for a user (replaces existing subscriptions)
  async setUserStateSubscriptions(userId, stateKeys) {
    try {
      // Start a transaction
      const deleteStmt = this.db.prepare(`
        DELETE FROM user_state_subscriptions
        WHERE user_id = ?
      `);

      const insertStmt = this.db.prepare(`
        INSERT INTO user_state_subscriptions (user_id, state_key)
        VALUES (?, ?)
      `);

      // Clear existing subscriptions
      await deleteStmt.run(userId);

      // Add new subscriptions
      for (const stateKey of stateKeys) {
        await insertStmt.run(userId, stateKey);
      }

      return { success: true };
    } catch (error) {
      console.error('Error setting user state subscriptions:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== MIGRATION TRACKING ====================

  // Check if a migration has been applied
  async hasMigration(migrationName) {
    try {
      const result = await this.db.prepare(`
        SELECT migration_name FROM schema_migrations WHERE migration_name = ?
      `).get(migrationName);
      return !!result;
    } catch (error) {
      // If table doesn't exist yet, migration hasn't been run
      console.warn('Migration tracking table not ready:', error.message);
      return false;
    }
  }

  // Record a migration as applied
  async recordMigration(migrationName) {
    try {
      await this.db.prepare(`
        INSERT OR IGNORE INTO schema_migrations (migration_name) VALUES (?)
      `).run(migrationName);
      console.log(`✅ Recorded migration: ${migrationName}`);
      return true;
    } catch (error) {
      console.error(`Failed to record migration ${migrationName}:`, error);
      return false;
    }
  }

  // Run a migration if it hasn't been applied yet
  async runMigration(migrationName, migrationFn) {
    try {
      const hasRun = await this.hasMigration(migrationName);
      if (hasRun) {
        console.log(`⏭️  Skipping migration (already applied): ${migrationName}`);
        return true;
      }

      console.log(`🔄 Running migration: ${migrationName}`);
      await migrationFn();
      await this.recordMigration(migrationName);
      return true;
    } catch (error) {
      console.error(`❌ Migration failed: ${migrationName}`, error);
      return false;
    }
  }

  // ==================== USER PREFERENCES ====================

  // Update user notification preferences
  updateUserNotificationPreferences(userId, preferences) {
    try {
      const fields = [];
      const values = [];

      if (preferences.notifyOnMessages !== undefined) {
        fields.push('notify_on_messages = ?');
        values.push(preferences.notifyOnMessages ? 1 : 0);
      }
      if (preferences.notifyOnHighSeverity !== undefined) {
        fields.push('notify_on_high_severity = ?');
        values.push(preferences.notifyOnHighSeverity ? 1 : 0);
      }

      if (fields.length === 0) {
        return { success: false, error: 'No preferences to update' };
      }

      values.push(userId);
      const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = this.db.prepare(sql);
      stmt.run(...values);

      return { success: true };
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return { success: false, error: error.message };
    }
  }

  // Truck Parking Methods
  addParkingFacility(facilityData) {
    const {
      facilityId,
      facilityName,
      state,
      latitude,
      longitude,
      address = null,
      totalSpaces = null,
      truckSpaces = null,
      amenities = null,
      facilityType = null
    } = facilityData;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO truck_parking_facilities (
          facility_id, facility_name, state, latitude, longitude,
          address, total_spaces, truck_spaces, amenities, facility_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(facility_id) DO UPDATE SET
          facility_name = excluded.facility_name,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          address = excluded.address,
          total_spaces = excluded.total_spaces,
          truck_spaces = excluded.truck_spaces,
          amenities = excluded.amenities,
          facility_type = excluded.facility_type,
          last_updated = CURRENT_TIMESTAMP
      `);
      stmt.run(facilityId, facilityName, state, latitude, longitude, address, totalSpaces, truckSpaces, amenities, facilityType);
      return { success: true };
    } catch (error) {
      console.error('Error adding parking facility:', error);
      return { success: false, error: error.message };
    }
  }

  async getParkingFacilities(stateFilter = null) {
    try {
      // Use parking_facilities table (populated by migration with historical patterns)
      const sql = stateFilter
        ? `SELECT * FROM parking_facilities WHERE state = ? ORDER BY facility_id`
        : `SELECT * FROM parking_facilities ORDER BY state, facility_id`;

      const stmt = this.db.prepare(sql);
      const facilities = stateFilter ? await stmt.all(stateFilter) : await stmt.all();

      return (Array.isArray(facilities) ? facilities : []).map(f => ({
        facilityId: f.facility_id,
        siteId: f.site_id,
        state: f.state,
        capacity: f.avg_capacity || f.capacity || 0,
        latitude: f.latitude || 0,
        longitude: f.longitude || 0,
        totalSamples: f.total_samples || 0,
        createdAt: f.created_at
      }));
    } catch (error) {
      console.error('Error getting parking facilities:', error);
      return [];
    }
  }

  addParkingAvailability(availabilityData) {
    const {
      facilityId,
      availableSpaces,
      occupiedSpaces,
      isPrediction = false,
      predictionConfidence = null
    } = availabilityData;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO parking_availability (
          facility_id, available_spaces, occupied_spaces,
          is_prediction, prediction_confidence
        ) VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(facilityId, availableSpaces, occupiedSpaces, isPrediction ? 1 : 0, predictionConfidence);
      return { success: true };
    } catch (error) {
      console.error('Error adding parking availability:', error);
      return { success: false, error: error.message };
    }
  }

  getLatestParkingAvailability(facilityId = null) {
    try {
      if (facilityId) {
        // Get latest for specific facility
        const row = this.db.prepare(`
          SELECT pa.*, tpf.facility_name, tpf.state, tpf.latitude, tpf.longitude, tpf.truck_spaces
          FROM parking_availability pa
          JOIN truck_parking_facilities tpf ON pa.facility_id = tpf.facility_id
          WHERE pa.facility_id = ?
          ORDER BY pa.timestamp DESC
          LIMIT 1
        `).get(facilityId);

        if (!row) return null;

        return {
          id: row.id,
          facilityId: row.facility_id,
          facilityName: row.facility_name,
          state: row.state,
          latitude: row.latitude,
          longitude: row.longitude,
          truckSpaces: row.truck_spaces,
          availableSpaces: row.available_spaces,
          occupiedSpaces: row.occupied_spaces,
          timestamp: row.timestamp,
          isPrediction: row.is_prediction === 1,
          predictionConfidence: row.prediction_confidence
        };
      } else {
        // Get latest for all facilities
        const rows = this.db.prepare(`
          SELECT pa.*, tpf.facility_name, tpf.state, tpf.latitude, tpf.longitude, tpf.truck_spaces
          FROM parking_availability pa
          JOIN truck_parking_facilities tpf ON pa.facility_id = tpf.facility_id
          WHERE pa.timestamp = (
            SELECT MAX(timestamp)
            FROM parking_availability pa2
            WHERE pa2.facility_id = pa.facility_id
          )
          ORDER BY tpf.state, tpf.facility_name
        `).all();

        return rows.map(row => ({
          id: row.id,
          facilityId: row.facility_id,
          facilityName: row.facility_name,
          state: row.state,
          latitude: row.latitude,
          longitude: row.longitude,
          truckSpaces: row.truck_spaces,
          availableSpaces: row.available_spaces,
          occupiedSpaces: row.occupied_spaces,
          timestamp: row.timestamp,
          isPrediction: row.is_prediction === 1,
          predictionConfidence: row.prediction_confidence
        }));
      }
    } catch (error) {
      console.error('Error getting parking availability:', error);
      return facilityId ? null : [];
    }
  }

  getParkingHistory(facilityId, hours = 24) {
    try {
      const rows = this.db.prepare(`
        SELECT * FROM parking_availability
        WHERE facility_id = ?
          AND timestamp >= datetime('now', '-' || ? || ' hours')
        ORDER BY timestamp DESC
      `).all(facilityId, hours);

      return rows.map(row => ({
        id: row.id,
        facilityId: row.facility_id,
        availableSpaces: row.available_spaces,
        occupiedSpaces: row.occupied_spaces,
        timestamp: row.timestamp,
        isPrediction: row.is_prediction === 1,
        predictionConfidence: row.prediction_confidence
      }));
    } catch (error) {
      console.error('Error getting parking history:', error);
      return [];
    }
  }

  // Parking Prediction Methods
  updateOccupancyPatterns() {
    try {
      // Calculate patterns from actual (non-prediction) data in the last 30 days
      const updateStmt = this.db.prepare(`
        INSERT OR REPLACE INTO parking_occupancy_patterns (
          facility_id, day_of_week, hour_of_day, avg_occupancy_rate, sample_count, last_updated
        )
        SELECT
          facility_id,
          CAST(strftime('%w', timestamp) AS INTEGER) as day_of_week,
          CAST(strftime('%H', timestamp) AS INTEGER) as hour_of_day,
          AVG(CAST(occupied_spaces AS REAL) / NULLIF(
            (SELECT truck_spaces FROM truck_parking_facilities WHERE facility_id = pa.facility_id), 0
          )) as avg_occupancy_rate,
          COUNT(*) as sample_count,
          CURRENT_TIMESTAMP
        FROM parking_availability pa
        WHERE is_prediction = false
          AND timestamp >= datetime('now', '-30 days')
          AND occupied_spaces IS NOT NULL
        GROUP BY facility_id, day_of_week, hour_of_day
        HAVING sample_count >= 3
      `);

      const result = updateStmt.run();
      console.log(`📊 Updated occupancy patterns: ${result.changes} patterns`);
      return { success: true, patternsUpdated: result.changes };
    } catch (error) {
      console.error('Error updating occupancy patterns:', error);
      return { success: false, error: error.message };
    }
  }

  getPredictedAvailability(facilityId, targetTime = null, nearbyEvents = []) {
    try {
      // Get facility info
      const facility = this.db.prepare(`
        SELECT truck_spaces FROM truck_parking_facilities WHERE facility_id = ?
      `).get(facilityId);

      if (!facility || !facility.truck_spaces) {
        return null;
      }

      const totalSpaces = facility.truck_spaces;
      const time = targetTime ? new Date(targetTime) : new Date();
      const dayOfWeek = time.getDay();
      const hourOfDay = time.getHours();

      // Get baseline occupancy pattern
      const pattern = this.db.prepare(`
        SELECT avg_occupancy_rate, sample_count FROM parking_occupancy_patterns
        WHERE facility_id = ? AND day_of_week = ? AND hour_of_day = ?
      `).get(facilityId, dayOfWeek, hourOfDay);

      // Default baseline if no pattern exists (use overall average or conservative estimate)
      let baseOccupancyRate = 0.6; // Default 60% occupancy
      let confidence = 0.3; // Low confidence without data

      if (pattern && pattern.sample_count >= 3) {
        baseOccupancyRate = pattern.avg_occupancy_rate;
        confidence = Math.min(0.9, 0.5 + (pattern.sample_count / 100)); // Higher confidence with more samples
      }

      // Apply event-based modifiers
      let eventModifier = 1.0;
      let eventNearby = false;

      for (const event of nearbyEvents) {
        eventNearby = true;
        const distance = event.distance || 0;
        const severity = event.severity?.toLowerCase() || 'minor';

        // Events increase demand (more trucks looking for parking)
        if (distance < 10) { // Within 10 miles
          if (severity === 'major' || severity === 'closure') {
            eventModifier *= 1.3; // 30% more demand
          } else if (severity === 'moderate') {
            eventModifier *= 1.15; // 15% more demand
          } else {
            eventModifier *= 1.05; // 5% more demand
          }
        } else if (distance < 25) { // 10-25 miles
          eventModifier *= 1.1; // 10% more demand
        }
      }

      // Calculate predicted occupancy
      let predictedOccupancyRate = Math.min(1.0, baseOccupancyRate * eventModifier);
      const predictedOccupied = Math.round(totalSpaces * predictedOccupancyRate);
      const predictedAvailable = Math.max(0, totalSpaces - predictedOccupied);

      // Reduce confidence if events are affecting prediction
      if (eventNearby) {
        confidence *= 0.8; // 20% less confident with events
      }

      return {
        facilityId,
        totalSpaces,
        predictedAvailable,
        predictedOccupied,
        predictedOccupancyRate,
        confidence: Math.round(confidence * 100) / 100,
        hasPattern: pattern !== undefined,
        eventNearby,
        timestamp: time.toISOString()
      };
    } catch (error) {
      console.error('Error calculating prediction:', error);
      return null;
    }
  }

  recordPredictionAccuracy(facilityId, predictedAvailable, actualAvailable, eventNearby = false) {
    try {
      const error = Math.abs(predictedAvailable - actualAvailable);
      const percentError = actualAvailable > 0 ? (error / actualAvailable) * 100 : 0;

      const stmt = this.db.prepare(`
        INSERT INTO parking_prediction_accuracy (
          facility_id, predicted_available, actual_available,
          prediction_error, percent_error, event_nearby
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(facilityId, predictedAvailable, actualAvailable, error, percentError, eventNearby ? 1 : 0);
      return { success: true };
    } catch (error) {
      console.error('Error recording prediction accuracy:', error);
      return { success: false, error: error.message };
    }
  }

  getPredictionAccuracyStats(facilityId = null, days = 7) {
    try {
      const sql = facilityId
        ? `SELECT
            facility_id,
            COUNT(*) as total_predictions,
            AVG(percent_error) as avg_percent_error,
            AVG(CASE WHEN percent_error < 20 THEN 1 ELSE 0 END) * 100 as accuracy_rate
          FROM parking_prediction_accuracy
          WHERE facility_id = ? AND timestamp >= datetime('now', '-' || ? || ' days')
          GROUP BY facility_id`
        : `SELECT
            facility_id,
            COUNT(*) as total_predictions,
            AVG(percent_error) as avg_percent_error,
            AVG(CASE WHEN percent_error < 20 THEN 1 ELSE 0 END) * 100 as accuracy_rate
          FROM parking_prediction_accuracy
          WHERE timestamp >= datetime('now', '-' || ? || ' days')
          GROUP BY facility_id`;

      const rows = facilityId
        ? this.db.prepare(sql).all(facilityId, days)
        : this.db.prepare(sql).all(days);

      return rows.map(row => ({
        facilityId: row.facility_id,
        totalPredictions: row.total_predictions,
        avgPercentError: Math.round(row.avg_percent_error * 10) / 10,
        accuracyRate: Math.round(row.accuracy_rate * 10) / 10
      }));
    } catch (error) {
      console.error('Error getting prediction accuracy stats:', error);
      return [];
    }
  }

  // ==================== Chat Conversation Methods ====================

  saveChatMessage(userId, stateKey, role, message, contextType = null, contextData = null) {
    try {
      const id = crypto.randomBytes(16).toString('hex');
      const stmt = this.db.prepare(`
        INSERT INTO chat_conversations (id, user_id, state_key, role, message, context_type, context_data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, userId, stateKey, role, message, contextType, contextData ? JSON.stringify(contextData) : null);
      return { success: true, id };
    } catch (error) {
      console.error('Error saving chat message:', error);
      return { success: false, error: error.message };
    }
  }

  getChatHistory(userId = null, stateKey = null, limit = 50) {
    try {
      let sql = 'SELECT * FROM chat_conversations WHERE 1=1';
      const params = [];

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }

      if (stateKey) {
        sql += ' AND state_key = ?';
        params.push(stateKey);
      }

      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const rows = this.db.prepare(sql).all(...params);
      return rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        stateKey: row.state_key,
        role: row.role,
        message: row.message,
        contextType: row.context_type,
        contextData: row.context_data ? JSON.parse(row.context_data) : null,
        createdAt: row.created_at
      })).reverse();
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  }

  clearChatHistory(userId) {
    try {
      this.db.prepare('DELETE FROM chat_conversations WHERE user_id = ?').run(userId);
      return { success: true };
    } catch (error) {
      console.error('Error clearing chat history:', error);
      return { success: false, error: error.message };
    }
  }

  // Interstate Interchange and Detour Alert Methods
  async getActiveInterchanges() {
    try {
      if (this.isPostgres) {
        const result = await this.db.query(
          'SELECT * FROM interchanges WHERE active = true ORDER BY state_key, name'
        );
        return result.rows;
      } else {
        return this.db.prepare('SELECT * FROM interchanges WHERE active = 1 ORDER BY state_key, name').all();
      }
    } catch (error) {
      console.error('Error getting active interchanges:', error);
      return [];
    }
  }

  async getDetourAlertByEventAndInterchange(eventId, interchangeId) {
    try {
      if (this.isPostgres) {
        const result = await this.db.query(
          'SELECT * FROM detour_alerts WHERE event_id = $1 AND interchange_id = $2 AND status = $3',
          [eventId, interchangeId, 'active']
        );
        return result.rows[0];
      } else {
        return this.db.prepare(
          'SELECT * FROM detour_alerts WHERE event_id = ? AND interchange_id = ? AND status = ?'
        ).get(eventId, interchangeId, 'active');
      }
    } catch (error) {
      console.error('Error getting detour alert:', error);
      return null;
    }
  }

  async createDetourAlert(data) {
    try {
      if (this.isPostgres) {
        const result = await this.db.query(`
          INSERT INTO detour_alerts
          (interchange_id, event_id, event_state, event_corridor, event_location,
           event_description, severity, lanes_affected, notified_states, message)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          data.interchange_id,
          data.event_id,
          data.event_state,
          data.event_corridor,
          data.event_location,
          data.event_description,
          data.severity,
          data.lanes_affected,
          data.notified_states,
          data.message
        ]);
        return result.rows[0].id;
      } else {
        const stmt = this.db.prepare(`
          INSERT INTO detour_alerts
          (interchange_id, event_id, event_state, event_corridor, event_location,
           event_description, severity, lanes_affected, notified_states, message)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          data.interchange_id,
          data.event_id,
          data.event_state,
          data.event_corridor,
          data.event_location,
          data.event_description,
          data.severity,
          data.lanes_affected,
          data.notified_states,
          data.message
        );
        return result.lastInsertRowid;
      }
    } catch (error) {
      console.error('Error creating detour alert:', error);
      throw error;
    }
  }

  async getActiveDetourAlerts() {
    try {
      if (this.isPostgres) {
        const result = await this.db.query(`
          SELECT da.*, i.name as interchange_name, i.latitude, i.longitude
          FROM detour_alerts da
          JOIN interchanges i ON da.interchange_id = i.id
          WHERE da.status = 'active'
          ORDER BY da.created_at DESC
        `);
        return result.rows;
      } else {
        return this.db.prepare(`
          SELECT da.*, i.name as interchange_name, i.latitude, i.longitude
          FROM detour_alerts da
          JOIN interchanges i ON da.interchange_id = i.id
          WHERE da.status = 'active'
          ORDER BY da.created_at DESC
        `).all();
      }
    } catch (error) {
      console.error('Error getting active detour alerts:', error);
      return [];
    }
  }

  async resolveDetourAlert(alertId, note) {
    try {
      if (this.isPostgres) {
        await this.db.query(
          'UPDATE detour_alerts SET status = $1, resolved_at = CURRENT_TIMESTAMP, resolution_note = $2 WHERE id = $3',
          ['resolved', note, alertId]
        );
      } else {
        this.db.prepare(
          'UPDATE detour_alerts SET status = ?, resolved_at = CURRENT_TIMESTAMP, resolution_note = ? WHERE id = ?'
        ).run('resolved', note, alertId);
      }
      return { success: true };
    } catch (error) {
      console.error('Error resolving detour alert:', error);
      return { success: false, error: error.message };
    }
  }

  // Bridge Clearance Methods
  async getActiveBridges() {
    try {
      if (this.isPostgres) {
        const result = await this.db.query(
          'SELECT * FROM bridge_clearances WHERE active = true ORDER BY clearance_feet ASC'
        );
        return result.rows;
      } else {
        return this.db.prepare('SELECT * FROM bridge_clearances WHERE active = 1 ORDER BY clearance_feet ASC').all();
      }
    } catch (error) {
      console.error('Error getting active bridges:', error);
      return [];
    }
  }

  async getBridgeWarningByEventAndBridge(eventId, bridgeId) {
    try {
      if (this.isPostgres) {
        const result = await this.db.query(
          'SELECT * FROM bridge_clearance_warnings WHERE event_id = $1 AND bridge_id = $2 AND status = $3',
          [eventId, bridgeId, 'active']
        );
        return result.rows[0];
      } else {
        return this.db.prepare(
          'SELECT * FROM bridge_clearance_warnings WHERE event_id = ? AND bridge_id = ? AND status = ?'
        ).get(eventId, bridgeId, 'active');
      }
    } catch (error) {
      console.error('Error getting bridge warning:', error);
      return null;
    }
  }

  async createBridgeWarning(data) {
    try {
      if (this.isPostgres) {
        const result = await this.db.query(`
          INSERT INTO bridge_clearance_warnings
          (bridge_id, event_id, event_state, event_description, distance_km, message)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [
          data.bridge_id,
          data.event_id,
          data.event_state,
          data.event_description,
          data.distance_km,
          data.message
        ]);
        return result.rows[0].id;
      } else {
        const stmt = this.db.prepare(`
          INSERT INTO bridge_clearance_warnings
          (bridge_id, event_id, event_state, event_description, distance_km, message)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          data.bridge_id,
          data.event_id,
          data.event_state,
          data.event_description,
          data.distance_km,
          data.message
        );
        return result.lastInsertRowid;
      }
    } catch (error) {
      console.error('Error creating bridge warning:', error);
      throw error;
    }
  }

  async getActiveBridgeWarnings() {
    try {
      if (this.isPostgres) {
        const result = await this.db.query(`
          SELECT bw.*, b.bridge_name, b.route, b.clearance_feet, b.latitude, b.longitude
          FROM bridge_clearance_warnings bw
          JOIN bridge_clearances b ON bw.bridge_id = b.id
          WHERE bw.status = 'active'
          ORDER BY b.clearance_feet ASC, bw.created_at DESC
        `);
        return result.rows;
      } else {
        return this.db.prepare(`
          SELECT bw.*, b.bridge_name, b.route, b.clearance_feet, b.latitude, b.longitude
          FROM bridge_clearance_warnings bw
          JOIN bridge_clearances b ON bw.bridge_id = b.id
          WHERE bw.status = 'active'
          ORDER BY b.clearance_feet ASC, bw.created_at DESC
        `).all();
      }
    } catch (error) {
      console.error('Error getting active bridge warnings:', error);
      return [];
    }
  }

  async getAllBridgeClearances() {
    try {
      if (this.isPostgres) {
        const result = await this.db.query(`
          SELECT * FROM bridge_clearances
          WHERE active = true
          ORDER BY clearance_feet ASC
        `);
        return result.rows;
      } else {
        return this.db.prepare(`
          SELECT * FROM bridge_clearances
          WHERE active = 1
          ORDER BY clearance_feet ASC
        `).all();
      }
    } catch (error) {
      console.error('Error getting bridge clearances:', error);
      return [];
    }
  }

  async getCorridorRegulations(corridor = null) {
    try {
      let query, result;

      if (this.isPostgres) {
        if (corridor) {
          query = `SELECT * FROM corridor_regulations WHERE corridor = $1 AND active = true ORDER BY state_name ASC`;
          result = await this.db.query(query, [corridor]);
        } else {
          query = `SELECT * FROM corridor_regulations WHERE active = true ORDER BY corridor ASC, state_name ASC`;
          result = await this.db.query(query);
        }
        return result.rows;
      } else {
        if (corridor) {
          query = `SELECT * FROM corridor_regulations WHERE corridor = ? AND active = 1 ORDER BY state_name ASC`;
          result = this.db.prepare(query).all(corridor);
        } else {
          query = `SELECT * FROM corridor_regulations WHERE active = 1 ORDER BY corridor ASC, state_name ASC`;
          result = this.db.prepare(query).all();
        }
        return result;
      }
    } catch (error) {
      console.error('Error getting corridor regulations:', error);
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

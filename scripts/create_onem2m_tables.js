#!/usr/bin/env node

/**
 * Create oneM2M Resource Tables
 *
 * Implements oneM2M standard IoT/M2M resource management for ITS devices:
 * - CSEBase: Root Common Services Entity
 * - AE (Application Entity): Sensors, RSUs, Controllers
 * - Container: Hierarchical data organization
 * - ContentInstance: Actual data readings
 * - Subscription: Event notification management
 * - AccessControlPolicy: Permission management
 * - Group: Bulk operations across resources
 *
 * Based on oneM2M Technical Specifications V5.4.0
 * Integrates ITS devices (sensors, RSUs, signals) with global IoT standards
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'onem2m.db');
const db = new Database(dbPath);

console.log('🌐 Creating oneM2M Resource Tables...\n');

// ============================================================================
// CSEBase - Root Resource
// ============================================================================
console.log('📊 Creating CSEBase (Root CSE) table...');

db.exec(`
  CREATE TABLE IF NOT EXISTS cse_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT UNIQUE NOT NULL,
    resource_name TEXT UNIQUE NOT NULL,
    resource_type INTEGER DEFAULT 5,
    parent_id TEXT,
    cse_id TEXT UNIQUE NOT NULL,
    cse_type TEXT NOT NULL,
    point_of_access TEXT,
    node_link TEXT,
    labels TEXT,
    creation_time TEXT NOT NULL,
    last_modified_time TEXT NOT NULL,
    state_tag INTEGER DEFAULT 0,
    supported_resource_types TEXT,
    announced_attribute TEXT,
    enabled BOOLEAN DEFAULT 1,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ============================================================================
// Application Entity (AE) - Devices/Applications
// ============================================================================
console.log('📱 Creating Application Entity (AE) table...');

db.exec(`
  CREATE TABLE IF NOT EXISTS application_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT UNIQUE NOT NULL,
    resource_name TEXT NOT NULL,
    resource_type INTEGER DEFAULT 2,
    parent_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    app_name TEXT,
    ae_id TEXT UNIQUE,
    point_of_access TEXT,
    ontology_ref TEXT,
    node_link TEXT,
    request_reachability BOOLEAN DEFAULT 1,
    labels TEXT,
    creation_time TEXT NOT NULL,
    last_modified_time TEXT NOT NULL,
    state_tag INTEGER DEFAULT 0,
    device_type TEXT,
    location TEXT,
    enabled BOOLEAN DEFAULT 1,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES cse_base(resource_id)
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_ae_parent ON application_entities(parent_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_ae_app_id ON application_entities(app_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_ae_type ON application_entities(device_type)`);

// ============================================================================
// Container - Hierarchical Data Organization
// ============================================================================
console.log('📦 Creating Container table...');

db.exec(`
  CREATE TABLE IF NOT EXISTS containers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT UNIQUE NOT NULL,
    resource_name TEXT NOT NULL,
    resource_type INTEGER DEFAULT 3,
    parent_id TEXT NOT NULL,
    state_tag INTEGER DEFAULT 0,
    creator TEXT,
    max_nr_of_instances INTEGER,
    max_byte_size INTEGER,
    max_instance_age INTEGER,
    curr_nr_of_instances INTEGER DEFAULT 0,
    curr_byte_size INTEGER DEFAULT 0,
    location_id TEXT,
    ontology_ref TEXT,
    labels TEXT,
    creation_time TEXT NOT NULL,
    last_modified_time TEXT NOT NULL,
    latest_content_instance TEXT,
    oldest_content_instance TEXT,
    container_definition TEXT,
    enabled BOOLEAN DEFAULT 1,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_container_parent ON containers(parent_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_container_name ON containers(resource_name)`);

// ============================================================================
// ContentInstance - Actual Data
// ============================================================================
console.log('📄 Creating ContentInstance table...');

db.exec(`
  CREATE TABLE IF NOT EXISTS content_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT UNIQUE NOT NULL,
    resource_name TEXT,
    resource_type INTEGER DEFAULT 4,
    parent_id TEXT NOT NULL,
    state_tag INTEGER DEFAULT 0,
    creator TEXT,
    content_info TEXT,
    content_size INTEGER,
    content TEXT NOT NULL,
    ontology_ref TEXT,
    labels TEXT,
    creation_time TEXT NOT NULL,
    last_modified_time TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES containers(resource_id) ON DELETE CASCADE
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_ci_parent ON content_instances(parent_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_ci_creation ON content_instances(creation_time)`);

// ============================================================================
// Subscription - Event Notifications
// ============================================================================
console.log('🔔 Creating Subscription table...');

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT UNIQUE NOT NULL,
    resource_name TEXT,
    resource_type INTEGER DEFAULT 23,
    parent_id TEXT NOT NULL,
    state_tag INTEGER DEFAULT 0,
    creator TEXT,
    notification_uri TEXT NOT NULL,
    notification_content_type INTEGER DEFAULT 1,
    event_notification_criteria TEXT,
    expiration_time TEXT,
    latest_notify BOOLEAN DEFAULT 0,
    notification_stats TEXT,
    subscriber_uri TEXT,
    batch_notify TEXT,
    rate_limit TEXT,
    pending_notification INTEGER DEFAULT 0,
    labels TEXT,
    creation_time TEXT NOT NULL,
    last_modified_time TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_sub_parent ON subscriptions(parent_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sub_enabled ON subscriptions(enabled)`);

// ============================================================================
// AccessControlPolicy - Permissions
// ============================================================================
console.log('🔒 Creating AccessControlPolicy table...');

db.exec(`
  CREATE TABLE IF NOT EXISTS access_control_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT UNIQUE NOT NULL,
    resource_name TEXT,
    resource_type INTEGER DEFAULT 1,
    parent_id TEXT NOT NULL,
    state_tag INTEGER DEFAULT 0,
    privileges TEXT NOT NULL,
    self_privileges TEXT,
    labels TEXT,
    creation_time TEXT NOT NULL,
    last_modified_time TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_acp_parent ON access_control_policies(parent_id)`);

// ============================================================================
// Group - Bulk Operations
// ============================================================================
console.log('👥 Creating Group table...');

db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT UNIQUE NOT NULL,
    resource_name TEXT,
    resource_type INTEGER DEFAULT 9,
    parent_id TEXT NOT NULL,
    state_tag INTEGER DEFAULT 0,
    creator TEXT,
    member_type INTEGER,
    curr_nr_of_members INTEGER DEFAULT 0,
    max_nr_of_members INTEGER,
    member_ids TEXT,
    members_access_control_policy_ids TEXT,
    member_type_validated BOOLEAN DEFAULT 1,
    consistency_strategy INTEGER DEFAULT 1,
    group_name TEXT,
    labels TEXT,
    creation_time TEXT NOT NULL,
    last_modified_time TEXT NOT NULL,
    fan_out_point TEXT,
    enabled BOOLEAN DEFAULT 1,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_group_parent ON groups(parent_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_group_type ON groups(member_type)`);

// ============================================================================
// flexContainer - Custom Attributes
// ============================================================================
console.log('🔧 Creating flexContainer table...');

db.exec(`
  CREATE TABLE IF NOT EXISTS flex_containers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT UNIQUE NOT NULL,
    resource_name TEXT,
    resource_type INTEGER DEFAULT 28,
    parent_id TEXT NOT NULL,
    state_tag INTEGER DEFAULT 0,
    creator TEXT,
    ontology_ref TEXT,
    container_definition TEXT,
    custom_attributes TEXT,
    node_link TEXT,
    labels TEXT,
    creation_time TEXT NOT NULL,
    last_modified_time TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_fc_parent ON flex_containers(parent_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_fc_definition ON flex_containers(container_definition)`);

// ============================================================================
// Notification Log
// ============================================================================
console.log('📨 Creating Notification Log table...');

db.exec(`
  CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id TEXT NOT NULL,
    notification_event TEXT NOT NULL,
    resource_id TEXT,
    resource_type INTEGER,
    representation TEXT,
    notification_uri TEXT NOT NULL,
    status INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(resource_id)
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_notif_sub ON notification_log(subscription_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notif_status ON notification_log(status, created_at)`);

// ============================================================================
// Discovery Cache
// ============================================================================
console.log('🔍 Creating Discovery Cache table...');

db.exec(`
  CREATE TABLE IF NOT EXISTS discovery_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_name TEXT,
    parent_id TEXT,
    labels TEXT,
    creation_time TEXT,
    last_modified_time TEXT,
    content_type TEXT,
    location TEXT,
    full_path TEXT,
    indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_disc_type ON discovery_cache(resource_type)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_disc_labels ON discovery_cache(labels)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_disc_location ON discovery_cache(location)`);

// ============================================================================
// Request Log
// ============================================================================
console.log('📝 Creating Request Log table...');

db.exec(`
  CREATE TABLE IF NOT EXISTS request_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT UNIQUE,
    operation TEXT NOT NULL,
    originator TEXT NOT NULL,
    target_resource_id TEXT,
    resource_type INTEGER,
    response_status_code INTEGER,
    request_body TEXT,
    response_body TEXT,
    processing_time_ms INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_req_originator ON request_log(originator, created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_req_status ON request_log(response_status_code)`);

console.log('\n✅ All oneM2M resource tables created successfully!');
console.log('\n📊 Database Schema Summary:');
console.log('   🌐 CSEBase - Root Common Services Entity');
console.log('   📱 Application Entities - Sensors, RSUs, Controllers');
console.log('   📦 Containers - Hierarchical data organization');
console.log('   📄 ContentInstances - Actual sensor readings/data');
console.log('   🔔 Subscriptions - Event notification management');
console.log('   🔒 AccessControlPolicies - Permission management');
console.log('   👥 Groups - Bulk operations across resources');
console.log('   🔧 flexContainers - Custom attribute storage');
console.log('   📨 Notification Log - Event delivery tracking');
console.log('   🔍 Discovery Cache - Fast resource lookup');
console.log('   📝 Request Log - API audit trail');
console.log('\n🎯 Corridor Communicator is now oneM2M-compliant!\n');

db.close();

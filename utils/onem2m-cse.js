/**
 * oneM2M Common Services Entity (CSE)
 *
 * Implements IN-CSE (Infrastructure Node CSE) for ITS/Transportation IoT
 * Provides REST API for CRUD+N (Create, Retrieve, Update, Delete, Notify) operations
 * Manages resource tree: CSEBase → AE → Container → ContentInstance
 *
 * Based on oneM2M Technical Specifications V5.4.0
 * Resource Types: CSEBase(5), ACP(1), AE(2), Container(3), ContentInstance(4),
 *                 Group(9), Subscription(23), flexContainer(28)
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

class OneM2MCSE {
  constructor(cseId = 'IN-CSE-DOT', cseName = 'DOTCorridorCommunicator') {
    this.cseId = cseId;
    this.cseName = cseName;
    this.dbPath = path.join(__dirname, '..', 'onem2m.db');
    this.db = null;
    this.resourceTypes = {
      accessControlPolicy: 1,
      AE: 2,
      container: 3,
      contentInstance: 4,
      CSEBase: 5,
      group: 9,
      subscription: 23,
      flexContainer: 28
    };
    this.init();
  }

  init() {
    try {
      this.db = new Database(this.dbPath);
      this.ensureCSEBase();
      console.log(`🌐 oneM2M CSE initialized: ${this.cseId}`);
    } catch (error) {
      console.error('Error initializing oneM2M CSE:', error);
    }
  }

  /**
   * Ensure CSEBase exists
   */
  ensureCSEBase() {
    const stmt = this.db.prepare('SELECT * FROM cse_base WHERE cse_id = ?');
    const existing = stmt.get(this.cseId);

    if (!existing) {
      const now = new Date().toISOString();
      const insertStmt = this.db.prepare(`
        INSERT INTO cse_base (
          resource_id, resource_name, cse_id, cse_type,
          creation_time, last_modified_time, supported_resource_types
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        this.cseId,
        this.cseName,
        this.cseId,
        'IN-CSE',
        now,
        now,
        JSON.stringify([2, 3, 4, 9, 23, 28]) // Supported resource types
      );

      console.log(`✅ CSEBase created: ${this.cseId}`);
    }
  }

  /**
   * Generate unique resource ID
   */
  generateResourceId(prefix = 'R') {
    return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get current ISO timestamp
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * CREATE - Create a new resource
   */
  create(resourceType, parentId, attributes, originator = 'admin') {
    const now = this.getTimestamp();
    const resourceId = this.generateResourceId();
    const stateTag = 0;

    try {
      let result;

      switch (resourceType) {
        case this.resourceTypes.AE:
          result = this.createAE(resourceId, parentId, attributes, now);
          break;
        case this.resourceTypes.container:
          result = this.createContainer(resourceId, parentId, attributes, now);
          break;
        case this.resourceTypes.contentInstance:
          result = this.createContentInstance(resourceId, parentId, attributes, now);
          break;
        case this.resourceTypes.subscription:
          result = this.createSubscription(resourceId, parentId, attributes, now);
          break;
        case this.resourceTypes.group:
          result = this.createGroup(resourceId, parentId, attributes, now);
          break;
        case this.resourceTypes.flexContainer:
          result = this.createFlexContainer(resourceId, parentId, attributes, now);
          break;
        case this.resourceTypes.accessControlPolicy:
          result = this.createACP(resourceId, parentId, attributes, now);
          break;
        default:
          throw new Error(`Unsupported resource type: ${resourceType}`);
      }

      // Log request
      this.logRequest('CREATE', originator, resourceId, resourceType, 201);

      // Trigger subscriptions
      this.triggerSubscriptions(parentId, 'CREATE', result);

      return {
        statusCode: 201,
        resource: result
      };
    } catch (error) {
      this.logRequest('CREATE', originator, resourceId, resourceType, 500, error.message);
      throw error;
    }
  }

  /**
   * Create Application Entity (AE)
   */
  createAE(resourceId, parentId, attrs, timestamp) {
    const stmt = this.db.prepare(`
      INSERT INTO application_entities (
        resource_id, resource_name, parent_id, app_id, app_name,
        ae_id, point_of_access, device_type, location, labels,
        creation_time, last_modified_time, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const aeId = `C${resourceId}`;

    stmt.run(
      resourceId,
      attrs.resourceName || attrs.appName,
      parentId,
      attrs.appId,
      attrs.appName,
      aeId,
      attrs.pointOfAccess ? JSON.stringify(attrs.pointOfAccess) : null,
      attrs.deviceType || 'sensor',
      attrs.location ? JSON.stringify(attrs.location) : null,
      attrs.labels ? JSON.stringify(attrs.labels) : null,
      timestamp,
      timestamp,
      attrs.metadata ? JSON.stringify(attrs.metadata) : null
    );

    return this.retrieveResource(resourceId, 'application_entities');
  }

  /**
   * Create Container
   */
  createContainer(resourceId, parentId, attrs, timestamp) {
    const stmt = this.db.prepare(`
      INSERT INTO containers (
        resource_id, resource_name, parent_id, max_nr_of_instances,
        max_byte_size, labels, creation_time, last_modified_time, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      resourceId,
      attrs.resourceName,
      parentId,
      attrs.maxNrOfInstances || 1000,
      attrs.maxByteSize || 10485760, // 10MB default
      attrs.labels ? JSON.stringify(attrs.labels) : null,
      timestamp,
      timestamp,
      attrs.metadata ? JSON.stringify(attrs.metadata) : null
    );

    return this.retrieveResource(resourceId, 'containers');
  }

  /**
   * Create ContentInstance
   */
  createContentInstance(resourceId, parentId, attrs, timestamp) {
    const content = typeof attrs.content === 'string'
      ? attrs.content
      : JSON.stringify(attrs.content);

    const stmt = this.db.prepare(`
      INSERT INTO content_instances (
        resource_id, resource_name, parent_id, content, content_info,
        content_size, labels, creation_time, last_modified_time, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      resourceId,
      attrs.resourceName || null,
      parentId,
      content,
      attrs.contentInfo || 'application/json',
      Buffer.byteLength(content, 'utf8'),
      attrs.labels ? JSON.stringify(attrs.labels) : null,
      timestamp,
      timestamp,
      attrs.metadata ? JSON.stringify(attrs.metadata) : null
    );

    // Update parent container statistics
    this.updateContainerStats(parentId);

    return this.retrieveResource(resourceId, 'content_instances');
  }

  /**
   * Create Subscription
   */
  createSubscription(resourceId, parentId, attrs, timestamp) {
    const stmt = this.db.prepare(`
      INSERT INTO subscriptions (
        resource_id, resource_name, parent_id, notification_uri,
        notification_content_type, event_notification_criteria,
        expiration_time, labels, creation_time, last_modified_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      resourceId,
      attrs.resourceName || null,
      parentId,
      attrs.notificationURI,
      attrs.notificationContentType || 1,
      attrs.eventNotificationCriteria ? JSON.stringify(attrs.eventNotificationCriteria) : null,
      attrs.expirationTime || null,
      attrs.labels ? JSON.stringify(attrs.labels) : null,
      timestamp,
      timestamp
    );

    return this.retrieveResource(resourceId, 'subscriptions');
  }

  /**
   * Create Group
   */
  createGroup(resourceId, parentId, attrs, timestamp) {
    const stmt = this.db.prepare(`
      INSERT INTO groups (
        resource_id, resource_name, parent_id, member_type,
        max_nr_of_members, member_ids, group_name, labels,
        creation_time, last_modified_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      resourceId,
      attrs.resourceName || attrs.groupName,
      parentId,
      attrs.memberType || this.resourceTypes.AE,
      attrs.maxNrOfMembers || 100,
      attrs.memberIDs ? JSON.stringify(attrs.memberIDs) : '[]',
      attrs.groupName,
      attrs.labels ? JSON.stringify(attrs.labels) : null,
      timestamp,
      timestamp
    );

    return this.retrieveResource(resourceId, 'groups');
  }

  /**
   * Create flexContainer
   */
  createFlexContainer(resourceId, parentId, attrs, timestamp) {
    const stmt = this.db.prepare(`
      INSERT INTO flex_containers (
        resource_id, resource_name, parent_id, container_definition,
        custom_attributes, labels, creation_time, last_modified_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      resourceId,
      attrs.resourceName,
      parentId,
      attrs.containerDefinition || 'org.onem2m.home.moduleclass.generic',
      attrs.customAttributes ? JSON.stringify(attrs.customAttributes) : null,
      attrs.labels ? JSON.stringify(attrs.labels) : null,
      timestamp,
      timestamp
    );

    return this.retrieveResource(resourceId, 'flex_containers');
  }

  /**
   * Create AccessControlPolicy
   */
  createACP(resourceId, parentId, attrs, timestamp) {
    const stmt = this.db.prepare(`
      INSERT INTO access_control_policies (
        resource_id, resource_name, parent_id, privileges,
        self_privileges, labels, creation_time, last_modified_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      resourceId,
      attrs.resourceName,
      parentId,
      JSON.stringify(attrs.privileges || []),
      attrs.selfPrivileges ? JSON.stringify(attrs.selfPrivileges) : null,
      attrs.labels ? JSON.stringify(attrs.labels) : null,
      timestamp,
      timestamp
    );

    return this.retrieveResource(resourceId, 'access_control_policies');
  }

  /**
   * RETRIEVE - Get a resource
   */
  retrieve(resourceId, originator = 'admin') {
    try {
      // Try each table
      const tables = [
        'cse_base',
        'application_entities',
        'containers',
        'content_instances',
        'subscriptions',
        'groups',
        'flex_containers',
        'access_control_policies'
      ];

      for (const table of tables) {
        const resource = this.retrieveResource(resourceId, table);
        if (resource) {
          this.logRequest('RETRIEVE', originator, resourceId, null, 200);
          return {
            statusCode: 200,
            resource
          };
        }
      }

      this.logRequest('RETRIEVE', originator, resourceId, null, 404);
      throw new Error('Resource not found');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retrieve resource from specific table
   */
  retrieveResource(resourceId, table) {
    try {
      const stmt = this.db.prepare(`SELECT * FROM ${table} WHERE resource_id = ?`);
      const row = stmt.get(resourceId);

      if (!row) return null;

      // Parse JSON fields
      const jsonFields = ['labels', 'metadata', 'custom_attributes', 'member_ids',
                         'privileges', 'point_of_access', 'location'];

      for (const field of jsonFields) {
        if (row[field]) {
          try {
            row[field] = JSON.parse(row[field]);
          } catch (e) {
            // Keep as string if not valid JSON
          }
        }
      }

      return row;
    } catch (error) {
      return null;
    }
  }

  /**
   * UPDATE - Modify a resource
   */
  update(resourceId, attributes, originator = 'admin') {
    const resource = this.retrieve(resourceId, originator).resource;
    if (!resource) {
      throw new Error('Resource not found');
    }

    const now = this.getTimestamp();
    const newStateTag = (resource.state_tag || 0) + 1;

    // Determine table based on resource_type or existing data
    const table = this.getTableForResource(resource);

    // Build UPDATE query dynamically
    const updateFields = [];
    const values = [];

    for (const [key, value] of Object.entries(attributes)) {
      const snakeKey = this.camelToSnake(key);
      updateFields.push(`${snakeKey} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }

    updateFields.push('last_modified_time = ?');
    updateFields.push('state_tag = ?');
    values.push(now, newStateTag, resourceId);

    const query = `UPDATE ${table} SET ${updateFields.join(', ')} WHERE resource_id = ?`;
    const stmt = this.db.prepare(query);
    stmt.run(...values);

    this.logRequest('UPDATE', originator, resourceId, null, 200);
    this.triggerSubscriptions(resource.parent_id, 'UPDATE', resource);

    return {
      statusCode: 200,
      resource: this.retrieveResource(resourceId, table)
    };
  }

  /**
   * DELETE - Remove a resource
   */
  delete(resourceId, originator = 'admin') {
    const resource = this.retrieve(resourceId, originator).resource;
    if (!resource) {
      throw new Error('Resource not found');
    }

    const table = this.getTableForResource(resource);
    const stmt = this.db.prepare(`DELETE FROM ${table} WHERE resource_id = ?`);
    stmt.run(resourceId);

    this.logRequest('DELETE', originator, resourceId, null, 200);
    this.triggerSubscriptions(resource.parent_id, 'DELETE', resource);

    return {
      statusCode: 200
    };
  }

  /**
   * DISCOVER - Find resources matching criteria
   */
  discover(criteria = {}, originator = 'admin') {
    let query = 'SELECT resource_id, resource_type, resource_name, parent_id, labels, creation_time FROM discovery_cache WHERE 1=1';
    const params = [];

    if (criteria.resourceType) {
      query += ' AND resource_type = ?';
      params.push(criteria.resourceType);
    }

    if (criteria.labels) {
      query += ' AND labels LIKE ?';
      params.push(`%${criteria.labels}%`);
    }

    if (criteria.location) {
      query += ' AND location LIKE ?';
      params.push(`%${criteria.location}%`);
    }

    if (criteria.createdAfter) {
      query += ' AND creation_time >= ?';
      params.push(criteria.createdAfter);
    }

    if (criteria.limit) {
      query += ' LIMIT ?';
      params.push(criteria.limit);
    }

    const stmt = this.db.prepare(query);
    const results = stmt.all(...params);

    this.logRequest('DISCOVER', originator, null, null, 200);

    return {
      statusCode: 200,
      resources: results
    };
  }

  /**
   * Update container statistics
   */
  updateContainerStats(containerId) {
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count, SUM(content_size) as total_size
      FROM content_instances
      WHERE parent_id = ?
    `);

    const stats = countStmt.get(containerId);

    const updateStmt = this.db.prepare(`
      UPDATE containers
      SET curr_nr_of_instances = ?,
          curr_byte_size = ?,
          last_modified_time = ?
      WHERE resource_id = ?
    `);

    updateStmt.run(
      stats.count,
      stats.total_size || 0,
      this.getTimestamp(),
      containerId
    );
  }

  /**
   * Trigger subscriptions for resource events
   */
  triggerSubscriptions(parentId, eventType, resource) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM subscriptions
        WHERE parent_id = ? AND enabled = 1
      `);

      const subscriptions = stmt.all(parentId);

      for (const sub of subscriptions) {
        this.sendNotification(sub, eventType, resource);
      }
    } catch (error) {
      console.error('Error triggering subscriptions:', error);
    }
  }

  /**
   * Send notification to subscriber
   */
  sendNotification(subscription, eventType, resource) {
    const logStmt = this.db.prepare(`
      INSERT INTO notification_log (
        subscription_id, notification_event, resource_id,
        resource_type, representation, notification_uri, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    logStmt.run(
      subscription.resource_id,
      eventType,
      resource.resource_id,
      resource.resource_type,
      JSON.stringify(resource),
      subscription.notification_uri,
      0 // Pending
    );

    // In a production system, this would make HTTP POST to notification_uri
    console.log(`📨 Notification queued for ${subscription.notification_uri} (${eventType})`);
  }

  /**
   * Get table name for resource
   */
  getTableForResource(resource) {
    const typeMap = {
      5: 'cse_base',
      1: 'access_control_policies',
      2: 'application_entities',
      3: 'containers',
      4: 'content_instances',
      9: 'groups',
      23: 'subscriptions',
      28: 'flex_containers'
    };

    return typeMap[resource.resource_type] || 'containers';
  }

  /**
   * Convert camelCase to snake_case
   */
  camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Log API request
   */
  logRequest(operation, originator, resourceId, resourceType, statusCode, error = null) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO request_log (
          operation, originator, target_resource_id, resource_type,
          response_status_code, request_body
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        operation,
        originator,
        resourceId,
        resourceType,
        statusCode,
        error
      );
    } catch (err) {
      console.error('Error logging request:', err);
    }
  }

  /**
   * Get CSE statistics
   */
  getStatistics() {
    const stats = {};

    const tables = {
      aes: 'application_entities',
      containers: 'containers',
      contentInstances: 'content_instances',
      subscriptions: 'subscriptions',
      groups: 'groups'
    };

    for (const [key, table] of Object.entries(tables)) {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
      stats[key] = stmt.get().count;
    }

    return stats;
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = OneM2MCSE;

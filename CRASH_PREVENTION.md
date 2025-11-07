# Crash Prevention Guide

This document explains the crash prevention strategies implemented in this project and best practices for avoiding similar issues in the future.

## What Caused The Original Crash?

The crash occurred due to:
1. **Missing database table**: `user_state_subscriptions` table didn't exist in PostgreSQL
2. **Async/await mismatch**: Code tried to call `.map()` on a Promise instead of an array
3. **Insufficient error handling**: Error wasn't caught before causing app crash

## Implemented Solutions

### 1. Defensive Null Checking ✅

**Location**: `database.js:1806-1829`

All database methods now check if query results are valid before processing:

```javascript
async getUserStateSubscriptions(userId) {
  try {
    const subscriptions = await this.db.prepare(`...`).all(userId);

    // Defensive check: ensure we got an array back
    if (!subscriptions || !Array.isArray(subscriptions)) {
      console.warn('getUserStateSubscriptions returned non-array result:', subscriptions);
      return [];
    }

    return subscriptions.map(...);
  } catch (error) {
    console.error('Error getting user state subscriptions:', error);
    return []; // Always return valid default
  }
}
```

**Best Practice**: Always validate database query results before using array methods like `.map()`, `.filter()`, etc.

### 2. Database Migration Tracking System ✅

**Location**: `database.js:1904-1951`

A new `schema_migrations` table tracks which migrations have been applied:

```javascript
// Check if migration has run
const hasRun = await db.hasMigration('add_user_subscriptions');

// Run migration only if needed
await db.runMigration('add_user_subscriptions', async () => {
  await db.execAsync(`CREATE TABLE user_state_subscriptions...`);
});
```

**Tables Added**:
- `schema_migrations` - tracks applied migrations (SQLite: line 302, PostgreSQL: line 586)

**Methods Added**:
- `hasMigration(name)` - check if migration was applied
- `recordMigration(name)` - mark migration as applied
- `runMigration(name, fn)` - run migration if not already applied

**Best Practice**: Use the migration tracking system for all schema changes:

```javascript
// In your startup code or migration script
await db.runMigration('my_new_feature', async () => {
  // Create new tables or alter existing ones
  await db.execAsync(`ALTER TABLE ...`);
});
```

### 3. Global Error Handler ✅

**Location**: `backend_proxy_server.js:9186-9215`

Catches all unhandled errors in Express routes:

```javascript
// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Unhandled error:', err);
  console.error('Error stack:', err.stack);
  console.error('Request URL:', req.url);

  // Don't expose error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';

  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
});
```

**Best Practice**: This catches errors in async route handlers. For it to work, async routes must be properly structured:

```javascript
// ❌ BAD - errors won't be caught
app.get('/api/data', async (req, res) => {
  const data = await someAsyncOperation(); // If this throws, app crashes
  res.json(data);
});

// ✅ GOOD - errors are caught by global handler
app.get('/api/data', async (req, res, next) => {
  try {
    const data = await someAsyncOperation();
    res.json(data);
  } catch (error) {
    next(error); // Pass to error handler
  }
});

// ✅ ALSO GOOD - using express-async-errors package
// npm install express-async-errors
require('express-async-errors'); // Add at top of server file
app.get('/api/data', async (req, res) => {
  const data = await someAsyncOperation(); // Errors auto-caught
  res.json(data);
});
```

### 4. Startup Health Checks ✅

**Location**: `database.js:96-148`

Verifies all critical tables exist when the app starts:

```javascript
async healthCheck() {
  console.log('🏥 Running database health check...');
  const requiredTables = [
    'states',
    'users',
    'user_state_subscriptions',
    // ... more tables
  ];

  // Check each table exists
  // Logs warnings if tables are missing

  return {
    healthy: missingTables.length === 0,
    missingTables
  };
}
```

**Output Examples**:
```
✅ All critical tables present
```
or
```
⚠️  Warning: Missing tables: user_state_subscriptions, schema_migrations
⚠️  Some features may not work correctly. Consider running migrations.
```

## Best Practices Going Forward

### 1. Always Use Async/Await Correctly

```javascript
// ❌ BAD
function getData(id) {
  const result = db.prepare('SELECT * FROM table WHERE id = ?').get(id);
  return result.map(r => r.name); // Crashes if result is Promise
}

// ✅ GOOD
async function getData(id) {
  const result = await db.prepare('SELECT * FROM table WHERE id = ?').get(id);
  if (!result || !Array.isArray(result)) return [];
  return result.map(r => r.name);
}
```

### 2. Handle Database Errors Gracefully

```javascript
// ❌ BAD - crashes on error
async function getUser(id) {
  return await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// ✅ GOOD - returns null on error
async function getUser(id) {
  try {
    return await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}
```

### 3. Use Migration System for Schema Changes

```javascript
// When adding a new feature that needs database changes:

// 1. Add table to schema (database.js)
CREATE TABLE IF NOT EXISTS new_feature_table (...)

// 2. Add migration check in startup code
await db.runMigration('add_new_feature_table', async () => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS new_feature_table (
      id SERIAL PRIMARY KEY,
      ...
    )
  `);
});

// 3. Add to health check required tables list
const requiredTables = [
  'states',
  'users',
  'new_feature_table',  // Add here
  ...
];
```

### 4. Test Error Paths

When adding new endpoints, test what happens when things fail:

```javascript
// Test these scenarios:
// - Database table doesn't exist
// - Query returns null/undefined
// - Query returns non-array when array expected
// - Network timeout
// - Invalid input data
```

### 5. Log Useful Information

```javascript
// ❌ BAD - not helpful
catch (error) {
  console.error('Error');
}

// ✅ GOOD - helps debug
catch (error) {
  console.error('Error getting user subscriptions:', error);
  console.error('User ID:', userId);
  console.error('Stack:', error.stack);
}
```

### 6. Use Environment-Appropriate Error Messages

```javascript
const isDevelopment = process.env.NODE_ENV !== 'production';

res.status(500).json({
  // Show details in dev, generic message in prod
  error: isDevelopment ? error.message : 'Internal server error',
  // Include stack only in dev
  ...(isDevelopment && { stack: error.stack })
});
```

## Monitoring Recommendations

### 1. Add Process-Level Error Handlers

Add to your server startup code:

```javascript
// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - log and continue
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Log to monitoring service
  // Gracefully shutdown
  process.exit(1);
});
```

### 2. Add Health Check Endpoint

Already exists at `/api/health`, but enhance it:

```javascript
app.get('/api/health', async (req, res) => {
  const dbHealth = await db.healthCheck();

  res.json({
    status: dbHealth.healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    database: {
      connected: db.isPostgres ? await db.db.pool.totalCount > 0 : true,
      healthy: dbHealth.healthy,
      missingTables: dbHealth.missingTables
    },
    uptime: process.uptime()
  });
});
```

### 3. Consider Adding Sentry or Similar

For production error tracking:

```bash
npm install @sentry/node
```

```javascript
const Sentry = require("@sentry/node");

Sentry.init({ dsn: process.env.SENTRY_DSN });

// Add as first middleware
app.use(Sentry.Handlers.requestHandler());

// Add error handler before your custom error handler
app.use(Sentry.Handlers.errorHandler());
```

## Quick Reference: Files Changed

1. **database.js**
   - Line 293-300: Added `user_state_subscriptions` table (SQLite)
   - Line 302-306: Added `schema_migrations` table (SQLite)
   - Line 577-584: Added `user_state_subscriptions` table (PostgreSQL)
   - Line 586-590: Added `schema_migrations` table (PostgreSQL)
   - Line 96-148: Added `healthCheck()` method
   - Line 1806-1829: Added defensive checks to `getUserStateSubscriptions()`
   - Line 1904-1951: Added migration tracking methods

2. **backend_proxy_server.js**
   - Line 2447: Made `/api/users/subscriptions` async
   - Line 2461: Made `/api/users/subscriptions` PUT async
   - Line 2482: Made subscription POST async
   - Line 2499: Made subscription DELETE async
   - Line 9186-9215: Added global error handler

3. **scripts/add_user_state_subscriptions_table.sql**
   - New migration script for manual database updates

## Summary

To avoid crashes in the future:

1. ✅ **Validate all database results** before using array methods
2. ✅ **Use async/await correctly** - don't forget the `await`
3. ✅ **Track migrations** using the schema_migrations table
4. ✅ **Add global error handlers** to catch unexpected errors
5. ✅ **Run health checks** at startup to catch missing tables early
6. ✅ **Log errors properly** with context for debugging
7. ✅ **Test error paths** not just happy paths
8. ✅ **Return safe defaults** (empty arrays, null) instead of crashing

The app is now much more resilient to database schema issues and async errors!

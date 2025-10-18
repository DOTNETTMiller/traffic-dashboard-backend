# Database Integration Plan

## Status: IN PROGRESS

### Completed:
1. ✅ Created `database.js` with SQLite database module
2. ✅ Implemented encryption for credentials (AES-256-CBC)
3. ✅ Created database schema (states, state_credentials, admin_tokens tables)
4. ✅ Added helper methods (addState, updateState, deleteState, getAllStates, getState)
5. ✅ Added admin token management
6. ✅ Added migration function to import existing API_CONFIG
7. ✅ Installed better-sqlite3 package
8. ✅ Added database file to .gitignore

### Next Steps:

#### 1. Update backend_proxy_server.js:
   - Add `const db = require('./database');` at line 10 (after other imports)
   - Add admin authentication middleware
   - Add admin API endpoints before line 1970 (before server starts):
     - POST /api/admin/states - Add new state
     - PUT /api/admin/states/:stateKey - Update state
     - DELETE /api/admin/states/:stateKey - Delete state
     - GET /api/admin/states - List all states with credentials
     - POST /api/admin/generate-token - Generate admin token
     - GET /api/admin/test-state/:stateKey - Test state API connection

#### 2. Load State Configurations from Database:
   - After API_CONFIG definition, load states from database
   - Merge database states with hardcoded API_CONFIG
   - Run migration on first startup

#### 3. Create Admin UI Component:
   - Frontend component at `frontend/src/components/StateAdmin.jsx`
   - Form to add/edit state configurations
   - List of current states with edit/delete options
   - Test connection button
   - Admin token authentication

#### 4. Update Frontend:
   - Add "Admin" button to navigation
   - Create admin route
   - Add token storage in localStorage
   - Admin login form

#### 5. Security Considerations:
   - Admin endpoints require Bearer token authentication
   - Encryption key should be in environment variable (ENCRYPTION_KEY)
   - Generate initial admin token on first startup
   - Log admin actions

#### 6. Testing:
   - Test adding a new state via API
   - Test updating state credentials
   - Test deleting a state
   - Verify encrypted credentials in database
   - Test state loading on server restart

#### 7. Deploy to Railway:
   - Set ENCRYPTION_KEY environment variable on Railway
   - Generate admin token on Railway
   - Commit and push changes
   - Verify database persists across deployments

## File Modifications Required:

### backend_proxy_server.js:
- Line 10: Add `const db = require('./database');`
- Line 128 (after API_CONFIG): Load and merge database states
- Line 1970 (before server starts): Add admin endpoints section

### New Files:
- ✅ database.js (CREATED)
- ✅ frontend/src/components/StateAdmin.jsx (CREATED)
- ✅ STATE_REGISTRATION_GUIDE.md (CREATED) - For states to submit their API details

## Environment Variables:

### Required on Railway:
```bash
ENCRYPTION_KEY=<64-character-hex-string>
# Will be auto-generated if not provided, but should be set for production
```

### Admin Token Generation:
```bash
# On first startup, server will log:
# "🔑 Generated admin token: abc123..."
# Save this token securely!
```

## API Examples:

### Add a New State:
```bash
curl -X POST http://localhost:3001/api/admin/states \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stateKey": "wyoming",
    "stateName": "Wyoming",
    "apiUrl": "https://wyroad info.org/api/v1/events",
    "apiType": "Custom JSON",
    "format": "json",
    "credentials": {
      "apiKey": "your-api-key-here"
    }
  }'
```

### Update State Credentials:
```bash
curl -X PUT http://localhost:3001/api/admin/states/wyoming \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": {
      "apiKey": "new-api-key"
    }
  }'
```

### List All States (Admin):
```bash
curl http://localhost:3001/api/admin/states \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Current Progress: 100% Complete ✅

**Status:** All features implemented and deployed to Railway. State registration guide created for external state DOTs.

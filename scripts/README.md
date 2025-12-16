# Scripts Documentation

This directory contains utility scripts for managing the DOT Corridor Communicator backend.

## Update State Feeds (`update_state_feeds.js`)

### Purpose

Updates state feed configurations (Texas and Oklahoma) in the database to match the code-based configuration.

### When to Use

Run this script whenever:
- You deploy code changes that modify state feed configurations
- You add new state feeds to the codebase but they don't appear in production
- The production database needs to be synchronized with code-based `API_CONFIG`

### Why This Exists

The backend uses **database-driven configuration**:
- At startup, `loadStatesFromDatabase()` (backend_proxy_server.js:608) loads state configs from the database
- Database values **override** any code-based configurations
- This allows dynamic state management via the State Admin UI
- But it means code changes won't appear until the database is updated

### Usage

#### Local Development
```bash
node scripts/update_state_feeds.js
```

#### Production (Railway)
```bash
# Method 1: Run script in container
railway ssh -s traffic-dashboard-backend -- node scripts/update_state_feeds.js
railway up  # Restart to apply changes

# Method 2: Run locally with production DATABASE_URL
export DATABASE_URL="postgresql://..."
node scripts/update_state_feeds.js
```

### What It Updates

Currently updates:
- **Texas (tx)**: Austin/Travis County WZDx feed
  - URL: `https://data.austintexas.gov/resource/d9mm-cjw9.geojson?$limit=50000`
  - Type: WZDx
  - Format: geojson

- **Oklahoma (ok)**: CARS Program FEU-G feed
  - URL: `https://ok.carsprogram.org/hub/data/feu-g.xml`
  - Type: FEU-G
  - Format: xml

### Database Support

Automatically detects and supports:
- **PostgreSQL**: Uses `DATABASE_URL` environment variable
- **SQLite**: Falls back to local/volume database at `../states.db` or `DATABASE_PATH`

### Output

```
Updated tx: 1 row(s) affected (PostgreSQL)
Updated ok: 1 row(s) affected (PostgreSQL)
```

or

```
Updated tx: 1 row(s) affected (SQLite @ /app/data/states.db)
Updated ok: 1 row(s) affected (SQLite @ /app/data/states.db)
```

### After Running

1. Restart the backend service (Railway auto-deploys)
2. Check logs: `railway logs -s traffic-dashboard-backend`
3. Look for: `✅ Loaded Texas from database`
4. Verify data appears on frontend (hard refresh browser)
5. Check Digital Infrastructure page reflects updates

## Other Scripts

### `fetch_ohio_events.js`
Fetches event data from Ohio DOT's custom JSON API.

### `fetch_caltrans_lcs.js`
Fetches data from California DOT's Lane Closure System (XML format).

### `fetch_penndot_rcrs.js`
Fetches data from Pennsylvania DOT's Road Condition Reporting System.

### `facilities_data.json`
Static data file containing truck parking facility information (Iowa focus).

## See Also

- **DEPLOYMENT.md**: Database-driven configuration and production deployment
- **docs/ADDING_NEW_FEEDS.md**: How to add new state feeds
- **backend_proxy_server.js:608**: `loadStatesFromDatabase()` function

# Application Restart Guide

## Railway (Production) Deployment

### 1. Deploy Latest Changes
```bash
# Make sure you're in the project directory
cd /Users/mattmiller/Projects/DOT\ Corridor\ Communicator

# Deploy to Railway (this automatically restarts)
railway up
```

### 2. Monitor Deployment
```bash
# Watch logs in real-time
railway logs --follow

# Or just check recent logs
railway logs
```

### 3. Verify Health
After restart, the logs should show:
```
🐘 Connected to PostgreSQL database
✅ PostgreSQL database initialized
🏥 Running database health check...
✅ All critical tables present
🚀 Traffic Dashboard Backend Server (Email Login Enabled)
✅ Server running on http://localhost:3001
```

### 4. Check Status
```bash
railway status
```

---

## Local Development Restart

### Quick Restart
```bash
# Kill existing server
lsof -ti:3001 | xargs kill

# Start server
npm start
```

### Hard Restart (if process won't die)
```bash
# Force kill
lsof -ti:3001 | xargs kill -9

# Start server
npm start
```

### Check What's Running on Port
```bash
lsof -i:3001
```

---

## Manual Database Migration (If Needed)

If the automatic schema creation doesn't work, you can manually run the migration:

### For PostgreSQL (Production)

1. **Connect to Railway PostgreSQL**
```bash
# Get the database URL
railway variables

# Connect using psql (if installed)
railway run psql $DATABASE_URL
```

2. **Run Migration Script**
```bash
# Option A: Use Railway CLI
cat scripts/add_user_state_subscriptions_table.sql | railway run psql $DATABASE_URL

# Option B: Copy/paste into psql
# Then manually run the SQL from scripts/add_user_state_subscriptions_table.sql
```

The migration creates:
- `user_state_subscriptions` table
- `schema_migrations` table (for tracking)
- Necessary indexes

### For SQLite (Local)

The tables will be created automatically on startup. If you need to manually verify:

```bash
sqlite3 states.db

# Check if table exists
.tables

# Check table structure
.schema user_state_subscriptions

# Exit
.exit
```

---

## Troubleshooting

### "Port 3001 already in use"

```bash
# Find what's using the port
lsof -i:3001

# Kill it
lsof -ti:3001 | xargs kill -9

# Try starting again
npm start
```

### "Database connection failed"

**For Railway:**
```bash
# Check if DATABASE_URL is set
railway variables | grep DATABASE_URL

# Test connection
railway run node -e "console.log(process.env.DATABASE_URL)"
```

**For Local:**
```bash
# SQLite will create the database automatically
# Just make sure the directory is writable
ls -la states.db
```

### "Missing tables" warning

The app will now continue running with warnings. To fix:

1. **Railway**: Redeploy (tables will be created)
   ```bash
   railway up
   ```

2. **Local**: Delete the old database and restart
   ```bash
   rm states.db
   npm start
   ```

3. **Manual**: Run the migration script
   ```bash
   # See "Manual Database Migration" section above
   ```

### View Real-Time Logs

**Railway:**
```bash
railway logs --follow
```

**Local:**
The logs appear in your terminal where you ran `npm start`

---

## Deployment Checklist

When deploying the crash prevention fixes:

- [ ] Commit changes to git
  ```bash
  git add .
  git commit -m "Add crash prevention and migration system"
  git push
  ```

- [ ] Deploy to Railway
  ```bash
  railway up
  ```

- [ ] Watch logs for health check
  ```bash
  railway logs --follow
  ```

- [ ] Look for these messages:
  - ✅ `PostgreSQL database initialized`
  - ✅ `Running database health check...`
  - ✅ `All critical tables present`
  - ✅ `Server running on http://localhost:3001`

- [ ] Test the subscription endpoint
  ```bash
  # Get subscriptions (should return empty array, not crash)
  curl https://your-railway-app.railway.app/api/users/subscriptions \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```

- [ ] Verify no more crashes in logs

---

## Emergency Rollback

If something goes wrong:

```bash
# Rollback to previous deployment on Railway dashboard
# OR

# Revert local changes
git revert HEAD
railway up
```

---

## Quick Reference Commands

```bash
# Deploy to Railway
railway up

# View logs
railway logs

# View environment variables
railway variables

# Check status
railway status

# Run command in Railway environment
railway run <command>

# Local restart
lsof -ti:3001 | xargs kill && npm start
```

---

## What Changed in This Update

1. **Database Changes**
   - Added `user_state_subscriptions` table
   - Added `schema_migrations` table
   - Added health check system

2. **Code Changes**
   - Made all subscription methods async
   - Added defensive null checking
   - Added global error handler
   - Added startup health checks

3. **New Files**
   - `scripts/add_user_state_subscriptions_table.sql` - Manual migration
   - `CRASH_PREVENTION.md` - Development guide
   - `RESTART_GUIDE.md` - This file

The app will now warn about issues instead of crashing! 🎉

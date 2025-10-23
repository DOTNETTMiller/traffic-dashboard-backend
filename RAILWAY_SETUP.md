# Railway PostgreSQL Setup

## Current Issue
The SQLite database doesn't persist between Railway deployments because Railway uses ephemeral filesystem.

## Solution: Add PostgreSQL

### Step 1: Add PostgreSQL to Railway
1. Go to https://railway.app
2. Select your "DOT Corridor Communicator" project
3. Click **"New"** → **"Database"** → **"Add PostgreSQL"**
4. Railway will automatically provide `DATABASE_URL` environment variable
5. Wait 1-2 minutes for PostgreSQL to provision

### Step 2: Redeploy (Automatic)
Railway will automatically redeploy your app when PostgreSQL is added.

### Step 3: Login with Fallback Credentials

Once deployment completes, you can log in with these temporary credentials:

**Username**: `MM` or `matthew.miller@iowadot.us`
**Password**: `admin2026`

This will auto-provision your admin account in the new PostgreSQL database.

### Step 4: Change Your Password
After logging in, immediately change your password in the settings.

## Why PostgreSQL?
- **Persistent Storage**: Data survives deployments
- **Scalable**: Better for production use
- **Railway Native**: Fully supported by Railway platform
- **No File System Issues**: Database runs as a separate service

## Local Development
The app will continue to use SQLite locally (no changes needed for development).

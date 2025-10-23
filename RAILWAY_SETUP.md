# Railway Database Fix - SIMPLE SOLUTION

## Current Issue
The SQLite database doesn't persist between Railway deployments because Railway uses ephemeral filesystem.

## ✅ SOLUTION: Add a Volume (NO CODE CHANGES NEEDED!)

### Step 1: Add a Volume to Your Railway Service
1. Go to https://railway.app
2. Select your "traffic-dashboard-backend-production" project
3. Click on your backend service
4. Go to the **"Variables"** tab
5. Click **"New Volume"**
6. **Mount Path**: `/app/data`
7. Click **"Add"**

### Step 2: Set Database Path Environment Variable
Still in the Variables tab:
1. Click **"New Variable"**
2. **Variable**: `DATABASE_PATH`
3. **Value**: `/app/data/states.db`
4. Click **"Add"**

### Step 3: Wait for Automatic Redeploy
Railway will automatically redeploy (takes 1-2 minutes).

### Step 4: Login with Fallback Credentials
Once deployed, log in with:

**Username**: `MM` or `matthew.miller@iowadot.us`
**Password**: `admin2026`

This will auto-create your admin account in the now-persistent SQLite database.

### Step 5: Change Your Password
After logging in, go to settings and change your password to `Bim4infra` or your preferred password.

## Why This Works
- **Volume = Persistent Storage**: Data survives deployments
- **SQLite Still Works**: No code changes needed
- **Simple**: Just 2 settings in Railway dashboard
- **Fast**: Takes 2 minutes total

## Alternative: PostgreSQL (More Complex)
If you want to use PostgreSQL instead (not necessary):
1. Add PostgreSQL database in Railway
2. Requires significant code changes to database.js
3. More complex, but more scalable long-term

For now, the Volume solution is recommended as it works immediately with zero code changes.

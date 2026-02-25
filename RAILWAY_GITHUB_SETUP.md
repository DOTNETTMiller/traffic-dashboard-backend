# Railway GitHub Auto-Deploy Setup

## Problem

Railway service `traffic-dashboard-backend` is **not connected to GitHub**, which is why:
- Auto-deploy doesn't work when you push commits
- Manual "redeploy" doesn't pull latest code
- Production is stuck on old commit `fe8f903`

## Current Status

- Latest commit on GitHub: `4100d00` (crash fix)
- Production version: `1.1.1-fe8f903` (outdated)
- Only Vercel integration is visible (not GitHub)

## How Railway Deployments Work

Railway supports 3 deployment methods:
1. **GitHub Integration** (recommended) - Auto-deploys on push
2. **Railway CLI** - Manual deploys via `railway up`
3. **Docker/Nixpacks** - Direct container deploys

Currently, this service appears to be using method #3 (no GitHub source).

## Steps to Connect GitHub

### Option 1: Reconnect GitHub at Service Level

1. In Railway dashboard, go to your service
2. Look for "Settings" or a gear icon
3. Find "Source" or "Repository" section
4. Click "Connect GitHub Repository"
5. Select: `DOTNETTMiller/traffic-dashboard-backend`
6. Branch: `main`
7. Enable "Auto-deploy on push"

### Option 2: Use Railway CLI (Temporary Workaround)

If GitHub integration is broken, deploy manually via CLI:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
cd "/Users/mattmiller/Projects/DOT/DOT Corridor Communicator"
railway link

# Deploy latest code
railway up
```

### Option 3: Create New Service from GitHub

If the service can't be connected to GitHub:

1. Create a new Railway service
2. Choose "Deploy from GitHub"
3. Select `DOTNETTMiller/traffic-dashboard-backend`
4. Branch: `main`
5. Copy environment variables from old service
6. Copy database connection
7. Delete old service

## Environment Variables to Preserve

When creating a new service, make sure to copy these:
- `DATABASE_URL`
- `PORT`
- `NODE_ENV=production`
- Any API keys (PennDOT credentials, etc.)

## Next Steps After GitHub Connection

1. Verify auto-deploy works by pushing a test commit
2. Check deployment logs for successful build
3. Verify production version updates to latest commit
4. Monitor for crashes and errors

## Manual Deploy for Immediate Fix

If you need to deploy `4100d00` right now:

```bash
railway login
cd "/Users/mattmiller/Projects/DOT/DOT Corridor Communicator"
railway link
railway up
```

This will deploy the current local code (which includes the crash fix).

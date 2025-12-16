# Deployment Guide

This guide walks you through deploying both the backend and frontend to Railway.

## Prerequisites

- Railway account (sign up at https://railway.app)
- GitHub repository connected to Railway
- Backend API keys and credentials ready

## Backend Deployment (Already Done ✅)

Your backend should already be deployed on Railway. If not:

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select: `DOTNETTMiller/traffic-dashboard-backend`
4. Railway will auto-detect the Node.js backend
5. Set environment variables in Railway dashboard:
   - `NEVADA_API_KEY`
   - `OHIO_API_KEY`
   - `TXDOT_API_KEY`
   - `CARS_USERNAME`
   - `CARS_PASSWORD`
6. Note your backend URL (e.g., `https://your-app.railway.app`)

## Frontend Deployment to Railway

### Step 1: Create New Railway Project

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select: `DOTNETTMiller/traffic-dashboard-backend` (same repo)
4. Railway will detect both services

### Step 2: Configure Frontend Service

Since both backend and frontend are in the same repo, you need to configure Railway to deploy the frontend separately:

#### Option A: Using Railway Dashboard

1. In your Railway project, click "New Service"
2. Select "GitHub Repo"
3. Choose your repository again
4. Click "Settings" for the new service
5. Under "Build & Deploy":
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
6. Under "Networking":
   - Click "Generate Domain" to get a public URL

#### Option B: Using Railway.json (Already Configured)

The `frontend/railway.json` file is already configured. Railway will use it automatically when deploying from the `frontend` directory.

### Step 3: Set Environment Variables

In the Railway dashboard for your **frontend service**:

1. Go to the "Variables" tab
2. Add this variable:
   - **Key**: `VITE_API_URL`
   - **Value**: Your backend URL from Railway (e.g., `https://traffic-dashboard-backend.railway.app`)

**Important**: Don't include `/api` in the URL - the frontend code will add it automatically.

### Step 4: Deploy

1. Railway will automatically deploy on push to `main`
2. Or click "Deploy" manually in the Railway dashboard
3. Wait for the build to complete (2-5 minutes)
4. Click the generated domain to view your app!

## Verification

Once deployed, verify your frontend:

1. Open the frontend URL in your browser
2. Check that the event count appears in the header
3. Try clicking "Refresh Now" - should load events
4. Check browser console for any API errors
5. Test the map view and table view
6. Try filtering events
7. Click "Messages" on an event to test the messaging feature

## Troubleshooting

### Code changes deployed but not appearing in production

**Symptoms**:
- You deployed code changes that add/modify state feeds
- Frontend bundle shows SUCCESS and new JS/CSS files are being served
- But the new state data doesn't appear (e.g., TX/OK feeds missing)
- Digital Infrastructure page doesn't show the updates

**Cause**: The production database still has old state configurations that override your code changes

**Fix**:
```bash
# Method 1: Run the update script
railway ssh -s traffic-dashboard-backend -- node scripts/update_state_feeds.js
railway up

# Method 2: Update database manually
railway ssh -s traffic-dashboard-backend -- sh
sqlite3 /app/data/states.db "UPDATE states SET api_url='...', api_type='...', format='...' WHERE state_key='tx';"
exit
railway up

# Method 3: Use State Admin UI (no restart needed)
# Go to production frontend → Login → State Admin → Edit the state
```

See the "Database-Driven Configuration" section above for detailed explanation.

### Frontend shows "Error loading events"

**Cause**: Backend URL is incorrect or backend is not running

**Fix**:
1. Check the `VITE_API_URL` environment variable
2. Make sure backend is deployed and running
3. Test backend directly: `https://your-backend.railway.app/api/health`
4. Rebuild frontend after changing environment variables

### CORS Errors

**Cause**: Backend not allowing frontend domain

**Fix**:
1. Backend already has `cors()` enabled for all origins
2. If you restricted CORS, add your frontend domain to the allowlist

### Map doesn't show markers

**Cause**: No events returned or invalid coordinates

**Fix**:
1. Check that backend API keys are set correctly
2. Some DOT APIs may be temporarily down
3. Check the "errors" field in the API response: `/api/events`
4. Verify events have valid `latitude` and `longitude` values

### Build fails with "out of memory"

**Fix**:
1. In Railway settings, increase memory limit
2. Or upgrade Railway plan

### Specific state feed not loading in production

**Symptoms**: State feed works locally but not in production

**Cause**: Database configuration differs from code, or API keys not set

**Fix**:
1. Check backend logs: `railway logs -s traffic-dashboard-backend`
2. Look for state loading messages: `✅ Loaded [State] from database`
3. Verify API keys are set in Railway environment variables
4. Update database with correct feed URL/credentials
5. Restart backend service

## Updating the Application

To update your deployed application:

1. Make changes to your code locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your update message"
   git push
   ```
3. Railway automatically detects the push and redeploys
4. Monitor the deployment logs in Railway dashboard

## Environment Variables Reference

### Backend
| Variable | Required | Description |
|----------|----------|-------------|
| `NEVADA_API_KEY` | Optional | Nevada DOT API key |
| `OHIO_API_KEY` | Optional | Ohio DOT API key |
| `TXDOT_API_KEY` | Optional | Texas DOT (Socrata) app token |
| `CARS_USERNAME` | Optional | CARS Program username (for IA, KS, NE, IN, MN) |
| `CARS_PASSWORD` | Optional | CARS Program password |

### Frontend
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API URL (e.g., `https://your-backend.railway.app`) |

## Costs

Railway offers:
- **Free Tier**: $5 of usage per month
- **Pro Plan**: $20/month + usage

Estimated costs for this app:
- Backend: ~$2-5/month (depending on traffic)
- Frontend: ~$1-2/month
- Total: ~$3-7/month (within free tier for low traffic)

## Alternative: Deploy Frontend to Vercel/Netlify

If you prefer, you can deploy the frontend to Vercel or Netlify (often free):

### Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Framework: Vite
4. Root Directory: `frontend`
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Add environment variable: `VITE_API_URL`

### Netlify
1. Go to https://app.netlify.com/start
2. Import your GitHub repo
3. Base directory: `frontend`
4. Build command: `npm run build`
5. Publish directory: `frontend/dist`
6. Add environment variable: `VITE_API_URL`

## Database-Driven Configuration (CRITICAL)

### Understanding Backend Configuration

The backend uses a **database-first configuration system**:

1. At startup, `backend_proxy_server.js` calls `loadStatesFromDatabase()` (line 608)
2. This function loads state feed configurations from the SQLite database at `/app/data/states.db` (mounted volume in production)
3. **Database values override any code-based configurations in `API_CONFIG`**
4. This happens on every server restart/redeploy

**Important**: Changes to state feed configurations in the source code **will not** appear in production until the database is updated. The database is the source of truth for production.

### Updating State Feeds in Production

When you add or modify state feed configurations (like Texas or Oklahoma), you must update the production database:

#### Method 1: Using the Update Script (Recommended)

```bash
# SSH into the backend container
railway ssh -s traffic-dashboard-backend -- sh

# Run the update script inside the container
node scripts/update_state_feeds.js

# Exit the container
exit

# Restart the backend service to apply changes
railway up
```

The `scripts/update_state_feeds.js` script automatically updates both PostgreSQL and SQLite databases with the latest state feed configurations from the code.

#### Method 2: Manual SQL Updates

If you need to update specific states manually:

```bash
# SSH into the backend container
railway ssh -s traffic-dashboard-backend -- sh

# Update the database directly
sqlite3 /app/data/states.db "
  UPDATE states
  SET api_url='https://data.austintexas.gov/resource/d9mm-cjw9.geojson?$limit=50000',
      api_type='WZDx',
      format='geojson'
  WHERE state_key='tx';

  UPDATE states
  SET api_url='https://ok.carsprogram.org/hub/data/feu-g.xml',
      api_type='FEU-G',
      format='xml'
  WHERE state_key='ok';
"

# Exit
exit

# Restart/redeploy the backend
railway up
```

#### Method 3: Using the State Admin UI

1. Go to your production frontend URL
2. Login as admin
3. Navigate to "State Admin"
4. Click "Edit" on the state you want to update
5. Modify the feed URL, API type, or other settings
6. Click "Save"
7. The changes are immediately applied to the database

**Note**: The State Admin UI directly updates the production database, so no restart is required.

### Database Location

- **Local Development**: `./states.db` (in project root)
- **Production (Railway)**: `/app/data/states.db` (mounted volume)
- **Alternative**: PostgreSQL database if `DATABASE_URL` environment variable is set

### Why Database Overrides Code

This design allows:
- Dynamic state management without code changes
- Secure credential storage (encrypted in database)
- State Admin UI to work in production
- Different configurations per environment

However, it requires that **code-based configuration changes be synchronized to the production database** using one of the methods above.

### Verifying Configuration Changes

After updating the database and restarting:

1. Check backend logs for state loading:
   ```bash
   railway logs -s traffic-dashboard-backend
   ```
   Look for: `✅ Loaded Texas from database`

2. Visit the frontend and hard-refresh your browser
3. Check that the new data appears (e.g., TX/OK events on map)
4. Verify the Digital Infrastructure page reflects new data sources

## Production Checklist

Before going live:

- [ ] Set all required API keys in backend environment variables
- [ ] Update production database with latest state feed configurations (run `scripts/update_state_feeds.js`)
- [ ] Set correct backend URL in frontend environment variable
- [ ] Test all features (map, table, filters, messaging)
- [ ] Verify all expected state feeds are loading (check backend logs)
- [ ] Set up custom domain (optional)
- [ ] Enable HTTPS (Railway does this automatically)
- [ ] Set up monitoring/alerts
- [ ] Review Railway usage limits
- [ ] Consider adding analytics (Google Analytics, etc.)

## Support

For Railway-specific issues:
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

For application issues:
- Check GitHub Issues
- Review application logs in Railway dashboard

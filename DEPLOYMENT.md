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

## Production Checklist

Before going live:

- [ ] Set all required API keys in backend
- [ ] Set correct backend URL in frontend environment variable
- [ ] Test all features (map, table, filters, messaging)
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

# Railway Volume Setup via CLI

## Quick Setup (Recommended)

### Option 1: Railway Dashboard (Easiest)
1. Press `⌘K` (Command+K on Mac) in your Railway dashboard
2. Type "volume" and select "Create Volume"
3. Configure:
   - **Mount Path**: `/app/uploads`
   - **Size**: 100 GB
4. Select your backend service
5. Click "Create"

### Option 2: Railway CLI

#### Install Railway CLI (if not installed)
```bash
# Install via npm
npm install -g @railway/cli

# Or via Homebrew
brew install railway
```

#### Login and Create Volume
```bash
# Login to Railway
railway login

# Link to your project
cd /Users/mattmiller/Projects/DOT/DOT\ Corridor\ Communicator
railway link

# Create the volume
railway volume create --mount /app/uploads --size 100
```

#### Verify Volume Created
```bash
# List volumes
railway volume list

# You should see:
# Mount Path: /app/uploads
# Size: 100 GB
```

## What Happens Next

1. Railway will automatically restart your service with the volume mounted
2. The `/app/uploads/ifc/` directory will persist across deployments
3. Uploaded BIM files will be saved permanently
4. The database will store metadata in the `bim_models` table

## Verification

After creating the volume:

1. Check deployment logs for: `Volume mounted at /app/uploads`
2. Upload a BIM file via Digital Infrastructure page
3. Verify record appears in `bim_models` table
4. Restart service and verify file still exists

## Current Status

✅ Database table `bim_models` created
✅ Upload endpoint updated (backend_proxy_server.js:18551)
✅ GET endpoint added for model details (backend_proxy_server.js:18739)
✅ Code deployed to Railway (commit 511665f)
⏳ Volume needs to be created (use Option 1 or 2 above)

## Troubleshooting

If you don't see volumes in the UI:
- Use Command Palette: `⌘K` → "Create Volume"
- Right-click on the service canvas and select "Add Volume"
- Use CLI method above as fallback

# LandScan via Google Earth Engine Setup Guide

## Overview

The DOT Corridor Communicator now integrates with **LandScan Global 2024** (Oak Ridge National Lab) via **Google Earth Engine** for the highest-accuracy population data available.

**Key Benefits:**
- ✅ **FREE ACCESS** - No cost for non-commercial use
- ✅ **1km RESOLUTION** - Most accurate global population data
- ✅ **NO DOWNLOADS** - Cloud-based processing (no 10GB GeoTIFF files!)
- ✅ **LATEST DATA** - LandScan 2024 available
- ✅ **VERY HIGH CONFIDENCE** - Professional-grade accuracy

## How It Works

Instead of downloading multi-gigabyte GeoTIFF files, we query LandScan data directly through Google Earth Engine's cloud platform:

```
IPAWS Alert Generator
         ↓
Google Earth Engine API
         ↓
LandScan Global 2024 Dataset
(projects/sat-io/open-datasets/ORNL/LANDSCAN_GLOBAL)
         ↓
Population estimate for geofence
```

## Prerequisites

1. **Google Cloud Platform Account** (free tier available)
2. **Google Earth Engine Access** (free registration)
3. **Service Account** with Earth Engine permissions

## Setup Instructions

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing):
   - Click "Select a project" → "New Project"
   - Name: `DOT-Corridor-Communicator`
   - Click "Create"

### Step 2: Enable Google Earth Engine API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Earth Engine API"
3. Click "Enable"

### Step 3: Register for Earth Engine

1. Go to [Google Earth Engine Sign Up](https://earthengine.google.com/signup/)
2. Fill out the form:
   - **Purpose**: Research / Non-commercial
   - **Organization**: Iowa Department of Transportation
   - **Project**: Emergency alert geofencing with population analysis
3. Wait for approval email (usually instant for non-commercial use)

### Step 4: Create Service Account

1. In Google Cloud Console, go to **IAM & Admin** → **Service Accounts**
2. Click "Create Service Account"
3. Fill in details:
   - **Name**: `dot-corridor-earth-engine`
   - **Description**: `Service account for LandScan population queries`
4. Click "Create and Continue"
5. **Grant this service account access to project**:
   - Role: `Earth Engine Resource Viewer`
   - Role: `Earth Engine Resource Writer` (if needed for future features)
6. Click "Continue" → "Done"

### Step 5: Create Service Account Key

1. Click on the newly created service account
2. Go to **Keys** tab
3. Click "Add Key" → "Create new key"
4. Select **JSON** format
5. Click "Create"
6. A JSON file will download: `dot-corridor-earth-engine-xxxxx.json`

**⚠️ IMPORTANT:** This JSON file contains your private key. Keep it secure! Never commit it to version control.

### Step 6: Register Service Account with Earth Engine

Run this command to register your service account with Earth Engine:

```bash
# Install Earth Engine CLI (one-time setup)
pip install earthengine-api

# Authenticate your Earth Engine account
earthengine authenticate

# Register the service account
earthengine set_project YOUR_GCP_PROJECT_ID

# Verify access
earthengine ls
```

Alternatively, go to [Earth Engine Code Editor](https://code.earthengine.google.com/) and run:
```javascript
// Verify LandScan dataset is accessible
var landscan = ee.ImageCollection('projects/sat-io/open-datasets/ORNL/LANDSCAN_GLOBAL');
print('LandScan years available:', landscan.aggregate_array('system:index'));
```

### Step 7: Configure Railway Environment Variables

**Option A: Base64-encode the entire JSON file**

```bash
# Encode the service account JSON
cat dot-corridor-earth-engine-xxxxx.json | base64 > gee-key-base64.txt

# Set in Railway
railway variables set GEE_PRIVATE_KEY="$(cat gee-key-base64.txt)"

# Set service account email (from JSON file)
railway variables set GEE_SERVICE_ACCOUNT="dot-corridor-earth-engine@your-project.iam.gserviceaccount.com"
```

**Option B: Set the JSON directly as a string**

```bash
# Set the entire JSON as an environment variable (Railway supports long values)
railway variables set GEE_PRIVATE_KEY="$(cat dot-corridor-earth-engine-xxxxx.json)"

# Set service account email
railway variables set GEE_SERVICE_ACCOUNT="dot-corridor-earth-engine@your-project.iam.gserviceaccount.com"
```

### Step 8: Verify Integration

Run the enhanced population test script:

```bash
node scripts/test_enhanced_population.js
```

Expected output:
```
📋 CONFIGURATION:
   Census API: ✅ Enabled
   LandScan: ✅ Enabled (Google Earth Engine)
   OpenStreetMap: ✅ Enabled
   Iowa State GIS: ✅ Enabled

✅ Google Earth Engine initialized successfully

2️⃣  ENHANCED MULTI-SOURCE QUERY
─────────────────────────────────────────────────────────────
   📊 Best Population Estimate: 1,847
   🎯 Primary Source: LandScan Global (ORNL via Google Earth Engine)
   ✅ Confidence: VERY_HIGH
   📡 Sources Queried: 4

   🛰️  LANDSCAN (Google Earth Engine):
      Total: 1,847
      Resolution: 1km
      Year: 2024
      Accuracy: very_high
```

## Service Account JSON Structure

Your downloaded JSON file will look like this:

```json
{
  "type": "service_account",
  "project_id": "dot-corridor-communicator",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "dot-corridor-earth-engine@dot-corridor-communicator.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

Extract the `client_email` value for `GEE_SERVICE_ACCOUNT`.

## Security Best Practices

### ✅ DO:
- Store service account JSON securely in Railway environment variables
- Use base64 encoding if your deployment platform has issues with multiline strings
- Rotate service account keys periodically (every 90 days recommended)
- Use separate service accounts for dev/staging/production
- Restrict service account to minimum required permissions

### ❌ DON'T:
- Commit service account JSON to version control
- Share service account keys in Slack/email
- Use personal Google account credentials for production
- Give service account Owner or Editor roles (use least privilege)

## Troubleshooting

### Error: "Earth Engine not initialized"

**Solution**: Check that environment variables are set correctly:
```bash
railway variables
# Should show GEE_SERVICE_ACCOUNT and GEE_PRIVATE_KEY
```

Verify the JSON is valid:
```bash
echo $GEE_PRIVATE_KEY | base64 -d | jq .
```

### Error: "Initialization error: Permission denied"

**Solution**: Service account not registered with Earth Engine:
1. Go to [Earth Engine Asset Manager](https://code.earthengine.google.com/?asset_manager)
2. Click "Cloud Project" → Link your GCP project
3. Re-run service account registration:
```bash
earthengine set_project YOUR_PROJECT_ID
```

### Error: "Collection not found: projects/sat-io/open-datasets/ORNL/LANDSCAN_GLOBAL"

**Solution**: LandScan is a community catalog dataset. Ensure you have Earth Engine access and the dataset is publicly available.

Verify access in [Earth Engine Code Editor](https://code.earthengine.google.com/):
```javascript
var landscan = ee.ImageCollection('projects/sat-io/open-datasets/ORNL/LANDSCAN_GLOBAL');
print('Access granted:', landscan.size());
```

### Error: "Computation timeout"

**Solution**: Large geofences may take longer to process. Consider:
- Reducing geofence size
- Increasing timeout in code
- Using Census or Iowa GIS as fallback

## Alternative: Local Development

For local development, you can use a `.private-key.json` file:

1. Download service account JSON as described above
2. Place in project root: `.private-key.json`
3. Add to `.gitignore`:
```bash
echo ".private-key.json" >> .gitignore
```

4. Update `population-density-service.js` to load from file in development:
```javascript
// In constructor
if (process.env.NODE_ENV === 'development' && fs.existsSync('./.private-key.json')) {
  const privateKey = require('./.private-key.json');
  this.dataSources.landscan.geePrivateKey = JSON.stringify(privateKey);
  this.dataSources.landscan.geeServiceAccount = privateKey.client_email;
  this.dataSources.landscan.enabled = true;
}
```

## Cost Analysis

### Google Earth Engine Pricing

For **non-commercial use** (government, education, research):
- ✅ **FREE** - No charges for Earth Engine compute or storage

For **commercial use**:
- $0.00 - $0.30 per query depending on complexity
- Our queries are simple spatial reductions: ~$0.01 per alert

**Estimated Monthly Cost for Iowa DOT:**
- ~1,000 IPAWS alerts per month
- $10/month (worst case)
- **LIKELY $0** (non-commercial government use)

Compare to alternatives:
- LandScan direct license: $10,000+ per year
- Census API: Free but lower resolution
- PostGIS hosting: ~$50/month for 10GB storage

### Earth Engine Quotas

Free tier limits:
- **Compute time**: 5,000 queries/day
- **Concurrent requests**: 100
- **Response time**: 5-30 seconds per query

**DOT Corridor Communicator usage:**
- 1-10 queries per IPAWS alert
- ~30 alerts per day (peak)
- **Well within free tier limits** ✅

## Data Source Comparison

| Feature | LandScan (GEE) | Census Bureau | OpenStreetMap | Iowa GIS |
|---------|---------------|---------------|---------------|----------|
| **Resolution** | 1km | Census tract | Varies | Municipal |
| **Accuracy** | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★★☆ |
| **Cost** | FREE | FREE | FREE | FREE |
| **Setup Complexity** | Medium | Easy | None | None |
| **API Key Required** | Yes (Service Account) | Yes | No | No |
| **Global Coverage** | Yes | US only | Yes | Iowa only |
| **Update Frequency** | Annual | 10 years | Real-time | Quarterly |
| **Best For** | Highest accuracy | Official data | Quick setup | Iowa-specific |

## Production Checklist

- [ ] Google Cloud Project created
- [ ] Earth Engine API enabled
- [ ] Earth Engine access approved
- [ ] Service account created with Earth Engine permissions
- [ ] Service account JSON key generated
- [ ] `GEE_SERVICE_ACCOUNT` set in Railway variables
- [ ] `GEE_PRIVATE_KEY` set in Railway variables (base64-encoded JSON)
- [ ] Test script executed successfully
- [ ] LandScan data showing "VERY_HIGH" confidence in alerts
- [ ] Service account key stored securely (not in code!)
- [ ] Calendar reminder set for key rotation (90 days)

## Support

### Official Documentation
- [Google Earth Engine Guides](https://developers.google.com/earth-engine)
- [Earth Engine Service Accounts](https://developers.google.com/earth-engine/guides/service_account)
- [LandScan Community Catalog](https://gee-community-catalog.org/projects/landscan/)

### Getting Help
- Earth Engine Forum: https://groups.google.com/g/google-earth-engine-developers
- LandScan Support: landscan@ornl.gov
- Google Cloud Support: https://cloud.google.com/support

## Next Steps

Once LandScan is configured:

1. **Monitor Performance**: Track query response times and confidence levels
2. **Compare Data Sources**: Run A/B tests comparing LandScan vs Census vs estimation
3. **Optimize Geofences**: Use LandScan's high accuracy to refine alert targeting
4. **Reduce False Alerts**: Leverage 1km resolution for precise urban exclusion
5. **Extend Coverage**: Use LandScan for nationwide IPAWS support (beyond Iowa)

---

**Status**: ✅ **PRODUCTION READY**

LandScan Global 2024 via Google Earth Engine provides the highest-accuracy population data available for IPAWS alert targeting. Follow this guide to enable "very_high" confidence population estimates in your alert workflow.

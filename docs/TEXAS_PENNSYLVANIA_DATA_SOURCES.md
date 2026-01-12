# Texas and Pennsylvania Data Source Solutions

## Current Status

Both Texas and Pennsylvania are returning 0 events due to data source issues:

- **Texas**: Using Austin city feed which contains only local streets (no interstates)
- **Pennsylvania**: API authentication failures (credentials may be expired/invalid)

---

## Texas - Solution

### Problem
Current feed: `https://data.austintexas.gov/download/d9mm-cjw9`
- Contains 1,402 events
- **All local city streets** (NEELY DR, E 51ST ST, RIO GRANDE ST, etc.)
- **Zero interstate highways**
- Application correctly filters these out

### Solution: TxDOT Statewide WZDx Feed

**Primary Feed (Recommended):**
- **URL**: `https://api.drivetexas.org/api/conditions.wzdx.geojson?key={API_KEY}`
- **Coverage**: All of Texas (statewide)
- **Format**: WZDx 4.2 GeoJSON
- **Update Frequency**: Every 5 minutes
- **Includes**: Interstate highways (I-10, I-20, I-30, I-35, I-45, etc.)
- **API Key Required**: YES

**How to Get API Key:**

1. **Online Contact Form**: https://www.txdot.gov/contact-us/form.html
2. **Phone Support**: 1-800-452-9292
   - Automated info: 24/7
   - Travel counselor: 8:00 AM - 6:00 PM, 7 days/week
3. **Request**: Ask for DriveTexas API access key for WZDx feed
4. **Alternative**: Check TxDOT Open Data Portal: https://gis-txdot.opendata.arcgis.com/

**Once API Key Obtained:**
```sql
UPDATE states
SET api_url = 'https://api.drivetexas.org/api/conditions.wzdx.geojson?key=YOUR_API_KEY_HERE',
    state_name = 'Texas DOT'
WHERE state_key = 'tx';
```

Or set environment variable:
```bash
TXDOT_API_KEY=your_api_key_here
```

---

## Pennsylvania - Solutions

### Problem
Current credentials for PennDOT RCRS API are returning **401 Authentication Failed**:
- Username: `pdsvcevntdfidot01`
- Password: `wCQky958aegM`
- Environment: CWOPA

### Solution 1: Pennsylvania Turnpike Commission WZDx Feed (Recommended)

**Feed Information:**
- **Organization**: Pennsylvania Turnpike Commission (PTC)
- **URL**: `https://atms.paturnpike.com/api/WZDxWorkZoneFeed?api_key={API_KEY}`
- **Format**: WZDx 4.1 GeoJSON
- **Update Frequency**: Every 1 minute
- **Coverage**: Pennsylvania Turnpike system
- **API Key Required**: YES

**How to Get API Key:**

1. **Email**: DataSharing@paturnpike.com
2. **Request**: PTC Data Feed and Digital Data Access Request Form
3. **Documentation**: Download API Key Instructions from WZDx Feed Registry
4. **Registry**: https://data.transportation.gov/Roadways-and-Bridges/Work-Zone-Data-Exchange-WZDx-Feed-Registry/69qe-yiui

**Once API Key Obtained:**
```sql
UPDATE states
SET api_url = 'https://atms.paturnpike.com/api/WZDxWorkZoneFeed?api_key=YOUR_API_KEY',
    api_type = 'WZDx',
    format = 'geojson',
    state_name = 'Pennsylvania Turnpike Commission'
WHERE state_key = 'pa';
```

---

### Solution 2: Verify/Update PennDOT RCRS Credentials

If you prefer the PennDOT RCRS feed over Pennsylvania Turnpike:

**Current Endpoints:**
- Live Events: `https://eventsdata.dot.pa.gov/liveEvents`
- Planned Events: `https://eventsdata.dot.pa.gov/plannedEvents`

**Contact for New Credentials:**

1. **PennDOT Data Access**: https://www.pa.gov/services/penndot/request-access-to-transportation-related-data-feeds
2. **Submit**: Data Feed Request Form
3. **Email**: penndotdata@pa.gov (if form doesn't work)
4. **Verify**: Environment ID (CWOPA) and username/password are still valid
5. **Documentation**: https://www.pa.gov/agencies/penndot/programs-and-doing-business/online-services/developer-resources-documentation-api.html

**Update Environment Variables on Railway:**
```bash
railway variables --set "PENNDOT_USERNAME=new_username"
railway variables --set "PENNDOT_PASSWORD=new_password"
```

---

## Comparison: Which Feed to Use?

### Texas

| Option | Coverage | Update Freq | API Key | Interstate Focus |
|--------|----------|-------------|---------|------------------|
| **DriveTexas API (TxDOT)** | ✅ Statewide | 5 min | Required | ✅ YES |
| Austin City | ❌ Austin only | 60 min | No | ❌ NO (local streets) |

**Recommendation**: Use DriveTexas API - covers all Texas interstates

### Pennsylvania

| Option | Coverage | Update Freq | API Key | Status |
|--------|----------|-------------|---------|--------|
| **PA Turnpike WZDx** | Turnpike system | 1 min | Required | ✅ Available |
| PennDOT RCRS | ❌ Statewide | Real-time | Credentials | ❌ Auth failing |

**Recommendation**:
1. **Short-term**: Get PA Turnpike WZDx API key (easier access)
2. **Long-term**: Request new PennDOT RCRS credentials for statewide coverage (includes more than just turnpike)

---

## Implementation Steps

### For Texas:

1. **Request API Key**:
   - Call 1-800-452-9292 or use https://www.txdot.gov/contact-us/form.html
   - Request: "DriveTexas API key for WZDx feed access"
   - Timeline: Usually 1-3 business days

2. **Update Database** (once key received):
   ```bash
   sqlite3 states.db "UPDATE states SET api_url = 'https://api.drivetexas.org/api/conditions.wzdx.geojson?key=YOUR_KEY' WHERE state_key = 'tx';"
   ```

3. **Set Environment Variable**:
   ```bash
   railway variables --set "TXDOT_API_KEY=your_key_here"
   ```

4. **Deploy and Test**:
   ```bash
   git add states.db
   git commit -m "Update Texas to use TxDOT DriveTexas WZDx feed"
   git push
   ```

### For Pennsylvania:

#### Option A: PA Turnpike (Faster)

1. **Request API Key**:
   - Email: DataSharing@paturnpike.com
   - Subject: "Request PTC WZDx API Key"
   - Body: "I would like to request access to the Pennsylvania Turnpike Commission WZDx feed API. Please send the Data Feed and Digital Data Access Request Form."

2. **Update Database** (once key received):
   ```bash
   sqlite3 states.db "UPDATE states SET api_url = 'https://atms.paturnpike.com/api/WZDxWorkZoneFeed?api_key=YOUR_KEY' WHERE state_key = 'pa';"
   ```

3. **Deploy and Test**

#### Option B: PennDOT RCRS (Comprehensive)

1. **Request New Credentials**:
   - Visit: https://www.pa.gov/services/penndot/request-access-to-transportation-related-data-feeds
   - Submit: Data Feed Request Form
   - Specify: RCRS API access for Environment CWOPA

2. **Update Railway Variables** (once received):
   ```bash
   railway variables --set "PENNDOT_USERNAME=new_username"
   railway variables --set "PENNDOT_PASSWORD=new_password"
   ```

3. **Code already supports RCRS** - no changes needed!

---

## Testing Locally

### Test Texas Feed (with API key):
```bash
curl "https://api.drivetexas.org/api/conditions.wzdx.geojson?key=YOUR_KEY" | jq '.features | length'
```

### Test PA Turnpike Feed (with API key):
```bash
curl "https://atms.paturnpike.com/api/WZDxWorkZoneFeed?api_key=YOUR_KEY" | jq '.features | length'
```

### Test PennDOT RCRS (with credentials):
```bash
PENNDOT_USERNAME=user PENNDOT_PASSWORD=pass node scripts/fetch_penndot_rcrs.js
```

---

## Expected Results After Fixes

### Texas (DriveTexas)
- **Expected Events**: 500-2,000 statewide work zones
- **Interstates Covered**: I-10, I-20, I-30, I-35, I-35E, I-35W, I-37, I-40, I-45, I-69, I-410, I-610, I-820
- **Major Cities**: Houston, Dallas, Austin, San Antonio, Fort Worth, El Paso

### Pennsylvania
- **PA Turnpike**: 50-150 events on PA Turnpike system
- **PennDOT RCRS**: 200-500 events statewide (if credentials restored)

---

## Timeline

| Task | Estimated Time | Priority |
|------|---------------|----------|
| Request TxDOT API key | 1-3 business days | HIGH |
| Request PA Turnpike API key | 1-5 business days | HIGH |
| Request PennDOT RCRS credentials | 5-10 business days | MEDIUM |
| Update database & deploy | 15 minutes | After keys received |

---

## Contact Summary

| State | Organization | Contact Method | Purpose |
|-------|--------------|----------------|---------|
| Texas | TxDOT | 1-800-452-9292 | DriveTexas API key |
| Texas | TxDOT | https://www.txdot.gov/contact-us/form.html | Online request |
| PA | PA Turnpike | DataSharing@paturnpike.com | WZDx API key |
| PA | PennDOT | https://www.pa.gov/services/penndot/request-access-to-transportation-related-data-feeds | RCRS credentials |

---

**Last Updated**: January 11, 2026
**Status**: Awaiting API keys from TxDOT and Pennsylvania Turnpike Commission

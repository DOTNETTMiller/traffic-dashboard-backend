# Connected Corridors Grant Matcher - Grants.gov Integration

## Overview

The Connected Corridors Grant Matcher is a comprehensive grant funding discovery system that combines expert-curated recommendations with live Grants.gov API data, specifically tailored for connected corridors and intelligent transportation system (ITS) projects.

## Features

### 1. 🛣️ Connected Corridors Strategy Matcher

Analyzes your project against connected corridors strategy priorities:

- **Strategy Alignment Scoring** - Measures how well your project aligns with connected corridors initiatives
- **Smart Recommendations** - AI-powered suggestions for strengthening your application
- **Focus Area Analysis** - Identifies key areas: V2X, Connected Vehicles, Traffic Management, Multi-State Coordination, Data Sharing

**Strategic Priorities:**
- V2X Infrastructure Deployment
- Connected Vehicle Systems Integration
- Real-time Traffic Management
- Multi-State/Regional Coordination
- Data Sharing & Interoperability Standards

### 2. 🔴 Live Grants.gov Integration

Real-time access to current federal funding opportunities:

- **Live NOFO Search** - Direct integration with Grants.gov API (no authentication required)
- **Auto-Matching** - Automatically scores opportunities against your project description
- **Direct Links** - One-click access to Grants.gov application pages
- **Status Tracking** - See which grants are open, forecasted, or closing soon

**API Endpoints:**
- `/api/grants/search-live` - Search current opportunities
- `/api/grants/opportunity/:id` - Fetch detailed NOFO information
- `/api/grants/connected-corridors-match` - Smart matcher combining curated + live data

### 3. ⏰ Deadline Monitoring

Proactive deadline tracking and alerts:

- **60-Day Forecast** - Monitor all upcoming deadlines
- **Critical Alerts** - Highlights grants closing within 14 days
- **Priority Levels:**
  - 🚨 **CRITICAL**: 0-14 days until close
  - ⚠️ **HIGH**: 15-30 days until close
  - 📅 **MEDIUM**: 31-60 days until close

**API Endpoint:**
- `/api/grants/monitor-deadlines` - Real-time deadline monitoring

### 4. ✅ Curated Grant Recommendations

Expert-selected grants with ITS/connected corridors focus:

**Competitive Grants:**
- **SMART Grant** - Connected vehicles, V2X, automation
- **ATCMTD** - Traffic management, signal optimization, V2I
- **RAISE** - Multimodal, safety, sustainability
- **INFRA** - Freight corridors, major infrastructure
- **PROTECT** - Resilience, emergency management
- **FMCSA IT-D** - Commercial vehicle data, truck parking

**Block Grants:**
- **HSIP** - Highway Safety Improvement Program
- **CMAQ** - Congestion Mitigation and Air Quality
- **STBG** - Surface Transportation Block Grant
- **TAP** - Transportation Alternatives
- **FTA 5339** - Bus and Bus Facilities

## Usage

### Step 1: Describe Your Project

Navigate to **Grant Applications → Connected Corridors Matcher** tab:

```
Project Description: "Deploy V2X infrastructure and connected vehicle
systems along I-80 corridor with multi-state coordination between Iowa,
Nebraska, and Illinois"

Primary Corridor: I-80
Requested Amount: $8,500,000
Geographic Scope: Multi-State
```

### Step 2: Get Smart Matches

Click **"Find Matching Grants"** to receive:

1. **Strategy Alignment Score** (0-100%)
   - Based on connected corridors priorities
   - V2X deployment potential
   - Multi-state coordination
   - ITS infrastructure readiness

2. **Strategic Recommendations**
   - Priority-ranked action items
   - Specific grant program alignments
   - Data sharing requirements
   - Partnership opportunities

3. **Top Grant Matches**
   - Expert-curated programs (SMART, ATCMTD, etc.)
   - Live Grants.gov opportunities
   - Block grant options

### Step 3: Monitor Live Opportunities

Switch to **"Live Opportunities"** tab:

- Real-time search of Grants.gov
- Filtered for transportation/ITS keywords
- Sorted by match score
- Direct application links

### Step 4: Track Deadlines

Switch to **"Deadline Alerts"** tab:

- See all upcoming deadlines (60-day window)
- Critical alerts highlighted at top
- Auto-refreshes to show latest data
- Direct links to apply

## API Integration Details

### Backend Endpoints

#### Search Live Grants
```javascript
POST /api/grants/search-live
{
  "keyword": "intelligent transportation systems",
  "fundingAgency": "DOT",
  "status": "forecasted,posted",
  "eligibility": "State governments"
}
```

**Response:**
```javascript
{
  "success": true,
  "opportunities": [
    {
      "opportunityId": "12345",
      "title": "FY2025 SMART Grant Program",
      "agency": "USDOT",
      "closeDate": "2025-06-30",
      "daysUntilClose": 45,
      "closingSoon": false,
      "awardCeiling": 15000000,
      "status": "posted",
      "grantsGovLink": "https://www.grants.gov/search-results-detail/12345"
    }
  ],
  "totalResults": 12,
  "fetchedAt": "2025-12-27T10:30:00Z"
}
```

#### Connected Corridors Match
```javascript
POST /api/grants/connected-corridors-match
{
  "description": "V2X deployment along I-80",
  "primaryCorridor": "I-80",
  "requestedAmount": 8500000,
  "geographicScope": "multi-state",
  "stateKey": "IA"
}
```

**Response:**
```javascript
{
  "success": true,
  "curatedGrants": [...],
  "liveOpportunities": [...],
  "blockGrants": [...],
  "connectedCorridorsStrategy": {
    "alignmentScore": 85,
    "recommendations": [
      {
        "area": "V2X Infrastructure",
        "priority": "HIGH",
        "suggestion": "SMART and ATCMTD grants prioritize V2X deployment..."
      }
    ],
    "keyFocusAreas": [
      "V2X Infrastructure Deployment",
      "Connected Vehicle Systems",
      "Real-time Traffic Management",
      "Multi-State Coordination",
      "Data Sharing & Interoperability"
    ]
  },
  "context": {
    "hasITSEquipment": true,
    "hasV2XGaps": true,
    "hasTruckParkingData": true,
    "isFreightCorridor": true
  }
}
```

#### Monitor Deadlines
```javascript
GET /api/grants/monitor-deadlines?stateKey=IA&daysAhead=60
```

**Response:**
```javascript
{
  "success": true,
  "deadlineAlerts": {
    "critical": [
      {
        "opportunityId": "67890",
        "title": "RAISE Grant FY2025",
        "agency": "USDOT",
        "closeDate": "2025-01-30",
        "daysUntilClose": 3,
        "urgency": "CRITICAL",
        "grantsGovLink": "https://www.grants.gov/..."
      }
    ],
    "high": [...],
    "medium": [...],
    "total": 8
  },
  "monitoredDays": 60
}
```

## Matching Algorithm

### Connected Corridors Match Score

The system calculates a 0-100% match score based on:

**Technology Deployment (25 points)**
- Keywords: connected, V2X, ITS, smart, automated
- Presence of existing ITS infrastructure

**Corridor Focus (20 points)**
- Keywords: corridor, interstate, highway, I-XX
- Freight corridor identification

**Regional Coordination (20 points)**
- Multi-state projects
- Regional partnerships
- Interstate collaboration

**V2X Infrastructure (20 points)**
- V2X deployment potential
- RSU gaps identified
- Connected vehicle systems

**Data Sharing (15 points)**
- Interoperability plans
- Data sharing agreements
- Standards compliance

### Live Opportunity Match Score

For Grants.gov opportunities:

**Connected Corridors Keywords (15 pts each)**
- Connected vehicles
- Intelligent transportation
- V2X / V2I
- Smart corridors
- ITS deployment

**Technology Focus (20 points)**
- ITS, smart, automated, connected

**V2X Specific (25 points)**
- V2X, V2I, connected vehicle, vehicle-infrastructure

**Corridor/Infrastructure (15 points)**
- Corridor, highway, interstate, infrastructure

**Funding Alignment (10 points)**
- Award range matches request

**Status Bonus (15 points)**
- Currently accepting applications

## Benefits

### For State DOTs

1. **Time Savings**
   - No manual Grants.gov searches
   - Auto-filtered for relevance
   - Direct application links

2. **Strategic Alignment**
   - Ensures projects fit connected corridors strategy
   - Identifies gaps and opportunities
   - Prioritizes high-value grants

3. **Never Miss Deadlines**
   - Proactive monitoring
   - Critical alerts for urgent applications
   - 60-day planning window

4. **Data-Driven Decisions**
   - Uses actual ITS inventory
   - Incorporates corridor data
   - Leverages existing infrastructure

### For Grant Writers

1. **Smart Recommendations**
   - Explains why grants match
   - Highlights key requirements
   - Shows typical award ranges

2. **Live Status**
   - Real-time NOFO availability
   - Current deadlines
   - Award amounts

3. **Multi-Source**
   - Expert-curated programs
   - Live Grants.gov data
   - Block grant options

## Testing

### Test Live Search

```bash
curl -X POST http://localhost:3001/api/grants/search-live \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "intelligent transportation systems",
    "fundingAgency": "DOT",
    "status": "posted"
  }'
```

### Test Connected Corridors Match

```bash
curl -X POST http://localhost:3001/api/grants/connected-corridors-match \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Deploy V2X RSUs and connected vehicle systems along I-35 corridor",
    "primaryCorridor": "I-35",
    "requestedAmount": 8000000,
    "geographicScope": "multi-state",
    "stateKey": "IA"
  }'
```

### Test Deadline Monitoring

```bash
curl http://localhost:3001/api/grants/monitor-deadlines?daysAhead=60
```

## Technical Architecture

### Frontend Components

**ConnectedCorridorsGrantMatcher.jsx**
- Main component with 3 tabs
- Smart Matcher view
- Live Opportunities view
- Deadline Alerts view
- Real-time API integration
- Responsive design with dark mode

**Integration Points**
- Added to GrantApplications.jsx as new tab
- Shares user context and state
- Uses existing api service layer

### Backend Infrastructure

**New Endpoints** (`backend_proxy_server.js`)
- `/api/grants/search-live` - Grants.gov search
- `/api/grants/opportunity/:id` - Opportunity details
- `/api/grants/connected-corridors-match` - Smart matcher
- `/api/grants/monitor-deadlines` - Deadline tracking

**Enhanced Recommender** (`utils/grant-recommender.js`)
- Existing scoring algorithms
- Extended with V2X focus
- Truck parking data integration
- Freight corridor detection

### Grants.gov API

**Base URL:** `https://api.grants.gov/v1/api`

**Endpoints Used:**
- `POST /search2` - Search opportunities
- `POST /fetchOpportunity` - Get opportunity details

**Authentication:** None required for these endpoints

**Rate Limits:** Not specified by Grants.gov API

## Future Enhancements

### Planned Features

1. **Email Alerts**
   - Daily/weekly deadline digests
   - New opportunity notifications
   - Custom keyword alerts

2. **Saved Searches**
   - Save project criteria
   - Auto-run searches weekly
   - Compare changes over time

3. **Application Tracking**
   - Link matched grants to applications
   - Track submission status
   - Award notifications

4. **Enhanced Scoring**
   - Machine learning for match quality
   - Historical award data
   - Success rate predictions

5. **Collaboration Features**
   - Share opportunities with team
   - Multi-state project coordination
   - Partner matching

6. **Analytics Dashboard**
   - Funding trends over time
   - Success rates by program
   - Budget allocation insights

## Support

For issues or questions:
- Check the API logs for Grants.gov connectivity
- Verify project description includes connected corridors keywords
- Ensure state context is available (user.stateKey)
- Test endpoints directly with curl/Postman

## References

- [Grants.gov API Guide](https://www.grants.gov/api/api-guide)
- [USDOT SMART Grant Program](https://www.transportation.gov/grants/SMART)
- [Connected Corridors Coalition](https://connectedcorridors.org/)
- [ARC-IT 10.0 Standards](https://www.arc-it.net/)

---

**Generated:** December 27, 2025
**Version:** 1.0
**Component:** DOT Corridor Communicator - Grant Discovery System

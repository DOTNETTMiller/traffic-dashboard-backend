# Phase 2: Sensor Health & Asset Management Implementation Guide

**Status:** 🚧 In Progress
**Timeline:** Q2 2025 (3 months)
**Goal:** Become the infrastructure monitoring standard

---

## Overview

Phase 2 transforms the DOT Corridor Communicator into a comprehensive ITS asset management platform. This phase tracks the health, performance, and maintenance needs of transportation infrastructure equipment across all corridors.

### Key Components

1. **Real-Time Asset Status Dashboard** - Monitor health of ITS equipment
2. **Predictive Maintenance AI** - Forecast equipment failures before they occur
3. **Coverage Gap Analysis Engine** - Identify corridors needing more ITS infrastructure

---

## 1. Database Schema

### Asset Types Tracked

- **CCTV** - Traffic cameras
- **RSU** - Roadside Units (V2X communication)
- **DMS** - Dynamic Message Signs
- **RWIS** - Road Weather Information Systems
- **DETECTOR** - Traffic sensors and loops

### Tables Created

#### `asset_health`
Main asset tracking table with current status:

```sql
CREATE TABLE asset_health (
  asset_id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL,
  location_lat REAL,
  location_lon REAL,
  state_key TEXT,
  corridor TEXT,

  -- Health Status
  status TEXT DEFAULT 'OPERATIONAL',
  last_online DATETIME,
  last_successful_ping DATETIME,
  uptime_percentage_30d REAL DEFAULT 100,

  -- Performance Metrics (asset-type specific)
  message_success_rate REAL,      -- RSUs
  video_quality_score REAL,       -- CCTV
  display_error_count INTEGER,    -- DMS
  sensor_accuracy_score REAL,     -- RWIS/Detectors

  -- Maintenance
  last_maintenance_date DATE,
  next_maintenance_due DATE,
  maintenance_vendor TEXT,
  warranty_expiration DATE,

  -- Equipment Details
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  install_date DATE,
  age_years REAL,
  estimated_remaining_life_years REAL,

  -- AI Predictions
  failure_probability_7d REAL DEFAULT 0,
  failure_probability_14d REAL DEFAULT 0,
  failure_probability_30d REAL DEFAULT 0,
  ai_recommendation TEXT
);
```

#### `asset_health_history`
Historical health data and alert tracking:

```sql
CREATE TABLE asset_health_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT,
  performance_metric REAL,
  uptime_percentage REAL,
  alert_triggered BOOLEAN DEFAULT FALSE,
  alert_type TEXT,
  notes TEXT
);
```

**Alert Types:**
- `FAILURE` - Asset offline or failed
- `DEGRADED` - Performance below acceptable threshold
- `MAINTENANCE_DUE` - Scheduled maintenance approaching
- `PREDICTED_FAILURE` - AI detected high failure risk

#### `asset_coverage_gaps`
Identifies corridors with insufficient ITS coverage:

```sql
CREATE TABLE asset_coverage_gaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  state_key TEXT NOT NULL,
  corridor TEXT NOT NULL,
  segment_start_lat REAL,
  segment_start_lon REAL,
  segment_end_lat REAL,
  segment_end_lon REAL,
  gap_distance_miles REAL,

  -- Analysis
  missing_asset_types TEXT,              -- JSON array
  incident_response_time_avg_minutes REAL,
  incident_count_30d INTEGER,
  traffic_volume_aadt INTEGER,
  priority_score REAL,                   -- 0-100

  -- Recommendations
  recommended_equipment TEXT,            -- JSON array
  estimated_installation_cost REAL,
  estimated_annual_roi REAL,
  matching_grant_programs TEXT,         -- JSON array

  status TEXT DEFAULT 'IDENTIFIED'
);
```

**Gap Status:**
- `IDENTIFIED` - Gap detected, not yet addressed
- `FUNDING_SOUGHT` - Grant application in progress
- `APPROVED` - Funding secured
- `INSTALLED` - Equipment deployed

#### `maintenance_schedule`
Preventive maintenance tracking:

```sql
CREATE TABLE maintenance_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  maintenance_type TEXT,
  priority TEXT DEFAULT 'MEDIUM',
  assigned_vendor TEXT,
  estimated_cost REAL,
  estimated_downtime_hours REAL,

  -- Tracking
  status TEXT DEFAULT 'SCHEDULED',
  actual_start_time DATETIME,
  actual_end_time DATETIME,
  actual_cost REAL,
  work_performed TEXT,
  next_maintenance_recommendation DATE
);
```

**Maintenance Types:**
- `PREVENTIVE` - Routine scheduled maintenance
- `CORRECTIVE` - Repair after issue detected
- `PREDICTIVE` - AI-recommended proactive maintenance
- `EMERGENCY` - Urgent repair required

---

## 2. Migration Script

**File:** `scripts/create_asset_health_tables.js`

### Running the Migration

```bash
# Local SQLite database
node scripts/create_asset_health_tables.js

# With custom database path
DATABASE_PATH=/path/to/db.sqlite node scripts/create_asset_health_tables.js
```

### Verification

```sql
-- Check tables created
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'asset%';

-- Check indexes
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';
```

Expected output:
- `asset_health`
- `asset_health_history`
- `asset_coverage_gaps`
- `maintenance_schedule`
- 10 indexes for query performance

---

## 3. Asset Health Monitoring Service

### Service Architecture

```javascript
// services/asset-health-monitor.js

class AssetHealthMonitor {
  constructor() {
    this.healthCheckers = {
      'CCTV': this.checkCameraHealth,
      'RSU': this.checkRSUHealth,
      'DMS': this.checkDMSHealth,
      'RWIS': this.checkWeatherStationHealth,
      'DETECTOR': this.checkDetectorHealth
    };
  }

  // Real-time health monitoring
  async monitorAsset(assetId) {
    const asset = await this.getAsset(assetId);
    const checker = this.healthCheckers[asset.asset_type];

    const health = await checker(asset);
    await this.updateAssetHealth(assetId, health);

    if (health.alert_triggered) {
      await this.sendAlert(asset, health);
    }
  }

  // Calculate uptime percentage
  calculateUptime(history, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const recentHistory = history.filter(h =>
      new Date(h.timestamp) >= startDate
    );

    const operationalCount = recentHistory.filter(h =>
      h.status === 'OPERATIONAL'
    ).length;

    return (operationalCount / recentHistory.length) * 100;
  }

  // Asset-specific health checks
  async checkCameraHealth(camera) {
    // Ping camera, check video feed quality
    const isOnline = await this.pingDevice(camera);
    const videoQuality = await this.analyzeVideoQuality(camera);

    return {
      status: isOnline && videoQuality > 70 ? 'OPERATIONAL' : 'DEGRADED',
      performance_metric: videoQuality,
      alert_triggered: !isOnline || videoQuality < 50,
      alert_type: !isOnline ? 'FAILURE' : 'DEGRADED'
    };
  }

  async checkRSUHealth(rsu) {
    // Check V2X message transmission success rate
    const messageStats = await this.getRSUMessageStats(rsu);
    const successRate = messageStats.successful / messageStats.total;

    return {
      status: successRate > 0.95 ? 'OPERATIONAL' : 'DEGRADED',
      performance_metric: successRate * 100,
      alert_triggered: successRate < 0.80,
      alert_type: successRate < 0.80 ? 'DEGRADED' : null
    };
  }

  // ... more health checkers
}
```

### Health Metrics by Asset Type

| Asset Type | Primary Metric | Operational Threshold | Degraded Threshold |
|------------|----------------|----------------------|-------------------|
| CCTV | Video Quality Score | > 80 | 50-80 |
| RSU | Message Success Rate | > 95% | 80-95% |
| DMS | Display Error Count | < 5/day | 5-20/day |
| RWIS | Sensor Accuracy Score | > 90 | 70-90 |
| DETECTOR | Data Transmission Rate | > 95% | 80-95% |

---

## 4. API Endpoints

### GET /api/asset-health/dashboard/:stateKey

Returns comprehensive asset health overview for a state.

**Response:**
```json
{
  "success": true,
  "state_key": "PA",
  "summary": {
    "total_assets": 487,
    "operational": 445,
    "degraded": 32,
    "failed": 10,
    "maintenance": 0,
    "overall_health_score": 91.4
  },
  "by_type": {
    "CCTV": { "total": 245, "operational": 230, "health_score": 93.9 },
    "RSU": { "total": 89, "operational": 85, "health_score": 95.5 },
    "DMS": { "total": 67, "operational": 62, "health_score": 92.5 },
    "RWIS": { "total": 45, "operational": 38, "health_score": 84.4 },
    "DETECTOR": { "total": 41, "operational": 30, "health_score": 73.2 }
  },
  "alerts": [
    {
      "asset_id": "PA-I80-CCTV-MM145",
      "asset_type": "CCTV",
      "alert_type": "FAILURE",
      "timestamp": "2025-01-23T10:15:00Z",
      "message": "Camera offline for 6 hours"
    }
  ],
  "maintenance_due": [
    {
      "asset_id": "PA-I76-DMS-MM52",
      "scheduled_date": "2025-01-25",
      "maintenance_type": "PREVENTIVE",
      "days_until_due": 2
    }
  ],
  "coverage_gaps": [
    {
      "corridor": "I-80",
      "segment": "MM 200-225",
      "gap_distance_miles": 25,
      "priority_score": 87.3,
      "missing_types": ["CCTV", "RWIS"],
      "incident_count_30d": 47
    }
  ]
}
```

### GET /api/asset-health/asset/:assetId

Get detailed information for a specific asset.

### GET /api/asset-health/coverage-gaps/:stateKey

Returns prioritized list of coverage gaps.

### GET /api/asset-health/maintenance/upcoming

Get upcoming maintenance schedule.

### POST /api/asset-health/maintenance/schedule

Schedule new maintenance activity.

---

## 5. Predictive Maintenance AI

### ML Model Architecture

**Model Type:** Gradient Boosting (XGBoost)

**Features:**
1. Asset age (years)
2. Cumulative operating hours
3. Recent performance trend (7/14/30 day averages)
4. Historical failure rate for model/manufacturer
5. Environmental factors (weather exposure, traffic volume)
6. Maintenance history (time since last service)

**Output:**
- Failure probability in next 7/14/30 days (0-100%)
- Confidence interval
- Top contributing factors

### Training Data Requirements

Minimum dataset:
- 2+ years of asset health history
- 100+ failure events per asset type
- Maintenance logs with outcomes
- Environmental/weather data correlation

### Alert Thresholds

| Risk Level | Probability | Action |
|------------|-------------|--------|
| 🔴 CRITICAL | > 80% | Schedule immediate inspection |
| 🟠 HIGH | 60-80% | Schedule maintenance this week |
| 🟡 MEDIUM | 40-60% | Monitor closely, schedule proactively |
| 🟢 LOW | < 40% | Continue normal monitoring |

### Cost Savings Calculation

```javascript
// ROI Calculator
function calculateMaintenanceROI(asset, prediction) {
  const preventiveCost = 2000;  // Average proactive maintenance
  const emergencyCost = 8000;   // Average emergency repair
  const downtimeCost = 500;     // Per hour corridor impact

  const preventiveDowntime = 2;  // hours
  const emergencyDowntime = 12;  // hours

  const preventiveTotalCost = preventiveCost + (preventiveDowntime * downtimeCost);
  const emergencyTotalCost = emergencyCost + (emergencyDowntime * downtimeCost);

  const savings = emergencyTotalCost - preventiveTotalCost;
  const roi = (savings / preventiveTotalCost) * 100;

  return {
    savings: savings,           // $4,000
    roi: roi,                   // 100%
    recommendation: 'Schedule preventive maintenance to avoid emergency repair'
  };
}
```

---

## 6. Coverage Gap Analysis Engine

### Gap Detection Algorithm

```javascript
async function detectCoverageGaps(stateKey, corridor) {
  // 1. Get corridor geometry
  const corridorPath = await getCorridorGeometry(corridor);

  // 2. Get all assets along corridor
  const assets = await getAssetsOnCorridor(stateKey, corridor);

  // 3. Identify segments without coverage
  const gaps = [];
  let lastAssetMilepost = 0;

  for (const asset of assets.sort((a, b) => a.milepost - b.milepost)) {
    const distance = asset.milepost - lastAssetMilepost;

    if (distance > COVERAGE_THRESHOLD_MILES) {
      gaps.push({
        start: lastAssetMilepost,
        end: asset.milepost,
        distance: distance,
        missing_types: determineMissingAssets(asset.asset_type)
      });
    }

    lastAssetMilepost = asset.milepost;
  }

  // 4. Prioritize gaps by impact
  for (const gap of gaps) {
    gap.priority_score = await calculateGapPriority(gap);
  }

  return gaps.sort((a, b) => b.priority_score - a.priority_score);
}

function calculateGapPriority(gap) {
  // Weighted scoring
  const incidentScore = gap.incident_count_30d * 2;
  const trafficScore = (gap.traffic_volume_aadt / 10000) * 1.5;
  const responseScore = (gap.incident_response_time_avg_minutes / 60) * 1.0;
  const distanceScore = (gap.gap_distance_miles / 10) * 0.5;

  return Math.min(100, incidentScore + trafficScore + responseScore + distanceScore);
}
```

### Gap Priority Scoring

Factors considered:
1. **Incident Frequency** (40% weight) - How often incidents occur
2. **Traffic Volume** (30% weight) - AADT on segment
3. **Response Time** (20% weight) - Current incident response time
4. **Gap Distance** (10% weight) - Physical distance without coverage

### Recommendation Engine

```javascript
function recommendEquipment(gap) {
  const recommendations = [];

  // High incident rate → CCTV for monitoring
  if (gap.incident_count_30d > 20) {
    recommendations.push({
      type: 'CCTV',
      quantity: Math.ceil(gap.gap_distance_miles / 5),
      reason: 'High incident frequency requires visual monitoring'
    });
  }

  // Winter weather corridor → RWIS
  if (gap.weather_events_30d > 10) {
    recommendations.push({
      type: 'RWIS',
      quantity: Math.ceil(gap.gap_distance_miles / 25),
      reason: 'Weather monitoring for winter maintenance'
    });
  }

  // CV pilot corridor → RSU
  if (gap.corridor_type === 'CV_PILOT') {
    recommendations.push({
      type: 'RSU',
      quantity: Math.ceil(gap.gap_distance_miles / 2),
      reason: 'V2X communication infrastructure'
    });
  }

  return recommendations;
}
```

### Grant Program Matching

Automatically identifies applicable federal/state grants:

- **INFRA Grants** - Large corridor improvements
- **RAISE Grants** - Safety/mobility projects
- **ITS4US** - Innovative ITS deployments
- **ATCMTD** - Advanced transportation technology
- **State-specific programs** - Based on state_key

---

## 7. Frontend Dashboard

### Component Structure

```
AssetHealthDashboard/
├── StateOverview.jsx          - Summary metrics and map
├── AssetList.jsx              - Sortable/filterable asset table
├── AssetDetail.jsx            - Individual asset health page
├── AlertsFeed.jsx             - Real-time alert stream
├── MaintenanceSchedule.jsx    - Calendar view of maintenance
├── CoverageGapMap.jsx         - Visual gap identification
└── PredictiveInsights.jsx     - AI recommendations
```

### Key Features

1. **Real-Time Status Map**
   - Color-coded assets by health status
   - Click for asset details
   - Filter by type, status, corridor

2. **Alert Dashboard**
   - Live alert feed
   - Severity-based sorting
   - Quick action buttons

3. **Maintenance Calendar**
   - Upcoming maintenance schedule
   - Vendor assignment
   - Cost tracking

4. **Predictive Analytics Panel**
   - Assets at risk
   - Recommended actions
   - ROI calculations

5. **Coverage Gap Visualization**
   - Heatmap of coverage density
   - Priority-ranked gaps
   - Equipment recommendations

---

## 8. Implementation Checklist

### Phase 2.1: Real-Time Asset Status Dashboard

- [x] Create database schema
- [ ] Build asset health monitoring service
- [ ] Implement API endpoints
- [ ] Create frontend dashboard
- [ ] Test with sample asset data
- [ ] Deploy monitoring cron jobs

### Phase 2.2: Predictive Maintenance AI

- [ ] Collect historical asset data
- [ ] Train failure prediction model
- [ ] Integrate ML model into health monitor
- [ ] Create ROI calculator
- [ ] Build maintenance recommendation UI

### Phase 2.3: Coverage Gap Analysis Engine

- [ ] Implement gap detection algorithm
- [ ] Build priority scoring system
- [ ] Create equipment recommendation engine
- [ ] Integrate grant program matching
- [ ] Build coverage gap visualization

---

## 9. Success Metrics

### Operational Metrics

- **Asset Uptime:** Target 99%+ for critical infrastructure
- **Mean Time to Detect (MTTD):** < 15 minutes for failures
- **Mean Time to Repair (MTTR):** < 4 hours for critical assets
- **Maintenance Cost Reduction:** 30%+ through predictive maintenance

### Business Impact

- **Prevented Failures:** Track emergency repairs avoided
- **Cost Savings:** Document ROI of predictive maintenance
- **Grant Success Rate:** Improve funding success with data-driven proposals
- **DOT Adoption:** Number of states using asset health features

---

## 10. Integration Points

### Existing Systems

- **ITS Equipment Inventory** - Pull asset list from sensors table
- **Corridor Network** - Use corridor geometries for gap analysis
- **Event Data** - Correlate incidents with asset locations
- **Grant Recommender** - Feed gaps into grant matching system

### External Data Sources

- **Manufacturer APIs** - Real-time equipment telemetry
- **Weather Services** - Environmental impact correlation
- **Traffic Sensors** - Volume data for priority scoring
- **Maintenance Management Systems** - Work order integration

---

## 11. Next Steps

After Phase 2 completion, proceed to:

**Phase 3: Intelligent Event Validation**
- Cross-source verification engine
- False positive suppression
- Automatic incident duration estimation

See `docs/NAPCORE_KILLER_ROADMAP.md` for full roadmap.

---

## Support

For questions or issues with Phase 2 implementation:
- GitHub Issues: https://github.com/DOTNETTMiller/traffic-dashboard-backend/issues
- Documentation: `docs/` directory
- API Reference: `API_DOCUMENTATION.md`

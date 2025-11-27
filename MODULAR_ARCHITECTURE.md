# DOT Corridor Communicator - Modular Architecture Guide

## Overview

This document describes how to extract and deploy individual components from the DOT Corridor Communicator as standalone widgets/add-ons that state DOTs can integrate into their existing platforms.

## Design Philosophy

The DOT Corridor Communicator is built with a modular architecture allowing states to:
- **Cherry-pick features** - Integrate only the specific tools they need
- **Embed in existing systems** - Add widgets to current DOT websites without full platform migration
- **Customize branding** - Adapt look and feel to match existing state systems
- **Self-host or API-access** - Choose between embedded components or API-only integration

---

## Available Modules

### 1. State-to-State Messaging Widget

**Component**: `StateMessaging.jsx`
**API Endpoints**: `/api/state-messages/*`
**Database Tables**: `state_messages`

**What it does**:
- Real-time messaging between state DOT operations centers
- Event-specific threaded conversations
- Read receipts and notification system
- Cross-state coordination for border incidents

**Integration Options**:

#### Option A: Embedded Widget (React)
```jsx
import StateMessaging from '@dot-communicator/state-messaging';

function MyDOTDashboard() {
  return (
    <StateMessaging
      apiBaseUrl="https://api.dot-corridor.com"
      authToken={userToken}
      user={{
        stateKey: 'IA',
        username: 'john.doe',
        fullName: 'John Doe'
      }}
      themeColors={{
        primary: '#1e3a8a',    // Customize to state colors
        secondary: '#3b82f6'
      }}
    />
  );
}
```

#### Option B: iframe Embed
```html
<iframe
  src="https://widgets.dot-corridor.com/messaging?state=IA&token=xxx"
  width="100%"
  height="600px"
  frameborder="0"
></iframe>
```

#### Option C: API-Only
```javascript
// Send message
POST /api/state-messages
{
  "fromState": "IA",
  "toState": "NE",
  "eventId": "evt_123",
  "message": "I-80 WB closure coordination needed",
  "urgency": "high"
}

// Get messages
GET /api/state-messages?stateKey=IA&unreadOnly=true
```

**Dependencies**: axios, React 18+
**Self-hosted**: ✅ Yes (Node.js backend required)

---

### 2. Corridor Briefing Generator

**Component**: `CorridorBriefing.jsx`
**API Endpoints**: `/api/corridor-briefing/*`
**Database Tables**: None (aggregates from events, detours, alerts)

**What it does**:
- Auto-generated executive summaries for corridors (I-80, I-35, etc.)
- PDF export for shift briefings
- Customizable time windows (last 24h, last week, custom)
- Severity-based highlighting

**Integration Options**:

#### Option A: Embeddable Widget
```jsx
import CorridorBriefing from '@dot-communicator/corridor-briefing';

<CorridorBriefing
  apiBaseUrl="https://api.dot-corridor.com"
  corridor="I-80"
  timeWindow="24h"
  onExportPDF={(pdfBlob) => console.log('PDF generated')}
/>
```

#### Option B: Scheduled Email Reports
```javascript
// Configure in backend
{
  "schedule": "0 7 * * *", // Daily at 7am
  "corridors": ["I-80", "I-35"],
  "recipients": ["ops@iowadot.gov", "traffic@iowadot.gov"],
  "format": "pdf"
}
```

**Dependencies**: React 18+, jsPDF (for PDF export)
**Self-hosted**: ✅ Yes

---

### 3. ITS Equipment Viewer

**Component**: `ITSEquipmentLayer.jsx`
**API Endpoints**: `/api/its-equipment/*`
**Database Tables**: `its_equipment`, `equipment_attributes`, `equipment_coverage`

**What it does**:
- Interactive map display of ITS infrastructure (cameras, DMS, RSU, sensors)
- ARC-IT 10.0 compliance tracking
- Equipment filtering (by route, type, status)
- V2X deployment analysis
- RAD-IT export for regional architecture planning

**Integration Options**:

#### Option A: Leaflet Map Layer
```jsx
import { MapContainer, TileLayer } from 'react-leaflet';
import ITSEquipmentLayer from '@dot-communicator/its-equipment';

<MapContainer center={[41.878, -93.097]} zoom={7}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

  <ITSEquipmentLayer
    apiBaseUrl="https://api.dot-corridor.com"
    stateKey="IA"
    route="I-80"  // Filter by route for performance
    equipmentType="camera"  // Optional filter
  />
</MapContainer>
```

#### Option B: Static Inventory Table
```jsx
import ITSInventoryTable from '@dot-communicator/its-equipment';

<ITSInventoryTable
  apiBaseUrl="https://api.dot-corridor.com"
  stateKey="IA"
  columns={['type', 'location', 'status', 'arc_its_id', 'manufacturer']}
  exportFormats={['csv', 'xlsx', 'radit-xml']}
/>
```

#### Option C: API for SCADA Integration
```javascript
// Get equipment by route
GET /api/its-equipment?stateKey=IA&route=I-80&status=active

// RAD-IT XML export for architecture planning
GET /api/its-equipment/export/radit?stateKey=IA
```

**Performance Note**: With 20K+ devices per state, **route filtering is required** for acceptable map performance. The recent update adds this capability.

**Dependencies**: React 18+, Leaflet, react-leaflet-cluster
**Self-hosted**: ✅ Yes

---

### 4. Detour & Bridge Alerts

**Component**: `DetourAlerts.jsx` + `BridgeClearanceWarnings.jsx`
**API Endpoints**: `/api/detour-alerts/*`, `/api/bridge-clearances/*`
**Database Tables**: `interstate_detours`, `bridge_clearances`

**What it does**:
- Active detour advisories for major incidents
- Bridge clearance warnings (<16.5ft - critical for commercial trucks)
- Automated alerts based on incident proximity to interchanges
- Integration with event coordination system

**Integration Options**:

#### Option A: Alert Dashboard Widget
```jsx
import { DetourAlerts, BridgeClearanceWarnings } from '@dot-communicator/alerts';

<div className="alerts-dashboard">
  <DetourAlerts
    apiBaseUrl="https://api.dot-corridor.com"
    authToken={token}
    autoRefresh={60000}  // Refresh every minute
    onAlertClick={(alert) => console.log('Alert clicked:', alert)}
  />

  <BridgeClearanceWarnings
    minClearance={16.5}  // Federal standard
    highlightPinchPoints={true}
  />
</div>
```

#### Option B: SMS/Email Notifications
```javascript
// Subscribe to detour alerts
POST /api/detour-alerts/subscribe
{
  "stateKey": "IA",
  "corridors": ["I-80", "I-35"],
  "notificationMethod": "sms",
  "phoneNumber": "+15551234567"
}
```

**Dependencies**: React 18+
**Self-hosted**: ✅ Yes

---

### 5. Truck Parking Availability & Prediction

**Component**: `ParkingLayer.jsx`
**API Endpoints**: `/api/parking/*`
**Database Tables**: `truck_parking_historical`, `parking_facilities`

**What it does**:
- Real-time truck parking availability
- ML-based prediction (1hr, 3hr, 6hr, 12hr, 24hr ahead)
- Historical pattern analysis
- Critical alerts when facilities approach capacity

**Integration Options**:

#### Option A: Map Overlay
```jsx
import ParkingLayer from '@dot-communicator/parking';

<ParkingLayer
  apiBaseUrl="https://api.dot-corridor.com"
  showParking={true}
  predictionHoursAhead={3}  // Show 3-hour forecast
/>
```

#### Option B: Traveler Information API
```javascript
// Get current availability
GET /api/parking/current?corridor=I-80

// Get predictions
GET /api/parking/historical/predict-all?time=2025-01-15T18:00:00Z

Response:
{
  "predictions": [
    {
      "facilityId": "IA_I80_MM123",
      "facilityName": "Rest Area WB MM 123",
      "predictedAvailable": 12,
      "capacity": 50,
      "confidence": 0.87,
      "recommendation": "Plan alternative - high demand period"
    }
  ]
}
```

**Dependencies**: React 18+, Leaflet
**Self-hosted**: ⚠️ Requires ML service (Python FastAPI) - can use hosted API

---

### 6. Ground Truth Validation Dashboard

**Component**: `GroundTruthDashboard.jsx`
**API Endpoints**: `/api/ground-truth/*`
**Database Tables**: `ground_truth_events`, `ground_truth_attributes`

**What it does**:
- Field-validated incident reports
- Data quality scoring (compare vendor feeds vs reality)
- Vendor DQI comparison
- TETC (Transportation Exchange) compliance grading

**Integration Options**:

#### Option A: Quality Assurance Dashboard
```jsx
import GroundTruthDashboard from '@dot-communicator/ground-truth';

<GroundTruthDashboard
  apiBaseUrl="https://api.dot-corridor.com"
  authToken={token}
  currentUser={user}
  enableFieldSubmission={true}  // Allow TMC operators to submit validations
/>
```

#### Option B: Vendor Accountability Reports
```javascript
// Get vendor DQI scores
GET /api/vendor-dqi?stateKey=IA&startDate=2025-01-01

Response:
{
  "vendors": [
    {
      "vendorName": "Vendor A",
      "dqi": 8.7,
      "accuracy": 92.3,
      "timeliness": 87.1,
      "completeness": 89.5
    }
  ]
}
```

**Dependencies**: React 18+
**Self-hosted**: ✅ Yes

---

### 7. Grant Application AI Assistant

**Component**: `GrantApplications.jsx`
**API Endpoints**: `/api/grants/*`
**Database Tables**: `grant_funding_programs`, `grant_packages`, `cost_estimator_items`

**What it does**:
- AI-generated grant narratives (SMART, RAISE, ATCMTD)
- Pooled fund multi-state coordination
- Cost estimation with lifecycle analysis
- Support letter template generation
- RAD-IT architecture documentation export

**Integration Options**:

#### Option A: Grant Writer Widget
```jsx
import GrantApplications from '@dot-communicator/grants';

<GrantApplications
  user={currentUser}
  authToken={token}
  enablePooledFund={true}  // For multi-state applications
/>
```

#### Option B: API for Grant Data
```javascript
// Generate AI narrative
POST /api/grants/generate-narrative
{
  "stateKey": "IA",
  "grantType": "SMART",
  "projectType": "V2X",
  "fundingRequested": 5000000,
  "pooledFundStates": ["IA", "NE", "WY"]
}

// Get cost estimates
GET /api/grants/cost-estimate?equipmentType=rsu&quantity=50
```

**Dependencies**: React 18+, Anthropic Claude API (for AI generation)
**Self-hosted**: ⚠️ Requires API key for AI features

---

## System Architecture for Self-Hosting

### Minimum Requirements

**Backend (Node.js)**:
- Node.js 18+
- SQLite (included) or PostgreSQL (for high-volume)
- Express.js server
- better-sqlite3

**Frontend (React)**:
- React 18+
- Vite or Create React App
- Leaflet + react-leaflet (for map features)
- Axios for API calls

**Optional Services**:
- **ML Parking Predictions**: Python 3.9+, FastAPI, scikit-learn (can use hosted API)
- **AI Grant Generation**: Anthropic Claude API key (or OpenAI GPT-4 alternative)

### Deployment Options

#### Option 1: Full Platform (All Features)
```bash
git clone https://github.com/mattmiller-dot/dot-communicator.git
cd dot-communicator
npm install
npm run build
node backend_proxy_server.js
```

Access: `http://your-domain.com:3001`

#### Option 2: Standalone Widget Package
```bash
npm install @dot-communicator/messaging
npm install @dot-communicator/its-equipment
npm install @dot-communicator/corridor-briefing
# etc. - pick what you need
```

#### Option 3: API-Only (Headless)
Deploy just the backend, integrate via REST API from your existing frontend.

---

## Data Sovereignty & Security

### Self-Hosted (Full Control)
- State maintains 100% data ownership
- No data leaves state infrastructure
- Custom authentication/authorization
- Compliant with state data retention policies

### Hybrid (Widgets + Hosted API)
- Widgets run in state's frontend
- API calls go to centralized DOT Corridor API
- Data aggregation for cross-state features
- Shared infrastructure costs

### API Keys & Authentication
All API endpoints support:
- JWT tokens
- API keys
- OAuth 2.0
- SAML SSO (for enterprise deployments)

---

## Customization & Branding

### Theme Configuration
```javascript
const theme = {
  colors: {
    primary: '#1e3a8a',        // Your state's primary color
    secondary: '#3b82f6',
    accent: '#10b981',
    background: '#ffffff',
    text: '#1f2937'
  },
  logo: '/path/to/state-dot-logo.png',
  brandName: 'Iowa DOT Traffic Operations'
};

<StateMessaging theme={theme} />
```

### White-Label Options
- Remove "DOT Corridor Communicator" branding
- Replace with state DOT branding
- Custom domain (e.g., `traffic.iowadot.gov`)

---

## Performance Optimization

### ITS Equipment (20K+ devices)
**Problem**: Rendering 20K markers freezes the map.

**Solutions Implemented**:
1. **Route Filtering** (NEW): Require route selection before loading
   ```javascript
   <ITSEquipmentLayer route="I-80" />  // Only loads I-80 equipment
   ```

2. **Marker Clustering**: Groups nearby markers (already implemented)
   ```javascript
   <MarkerClusterGroup maxClusterRadius={50}>
     {/* equipment markers */}
   </MarkerClusterGroup>
   ```

3. **Lazy Loading**: Only load equipment when layer is active

### API Rate Limiting
For high-volume states (IA with 20K devices, nationwide approaching 1M):
- Implement CDN caching for static data
- Use Redis for frequently accessed equipment lists
- Consider PostgreSQL instead of SQLite for >100K records

---

## License & Support

### Open Source
- Core platform: MIT License
- Components can be extracted and modified
- Attribution appreciated but not required

### Commercial Support
Contact: matt.miller@corridor-dot.com
- Integration assistance
- Custom feature development
- SLA-backed hosting
- Training for state DOT staff

---

## Migration Path

### Phase 1: API Integration (Weeks 1-2)
1. Set up API access
2. Test read-only endpoints
3. Validate data format

### Phase 2: Widget Deployment (Weeks 3-4)
1. Embed 1-2 widgets in existing portal
2. Test with limited user group
3. Gather feedback

### Phase 3: Full Adoption (Weeks 5-8)
1. Deploy all desired widgets
2. Train operations staff
3. Migrate from legacy systems

### Phase 4: Data Contribution (Ongoing)
1. Begin submitting ITS equipment data
2. Participate in cross-state messaging
3. Contribute to ground truth validation

---

## Next Steps

To get started with modular integration:

1. **Identify your needs**: Which widgets solve your current problems?
2. **Choose deployment model**: Self-hosted, hybrid, or API-only?
3. **Request API access**: Contact for sandbox credentials
4. **Pilot program**: Deploy 1-2 widgets with small user group
5. **Scale up**: Expand to full feature set based on success

**Questions?** Contact Matt Miller, CPM at matt.miller@corridor-dot.com

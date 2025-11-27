# DOT Corridor Communicator - Implementation Guide for State DOTs

**Version 1.0 | Updated: November 2025**

This guide helps state DOTs implement and integrate the DOT Corridor Communicator platform into their existing traffic management infrastructure.

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Full Platform Deployment](#full-platform-deployment)
3. [Modular Integration Options](#modular-integration-options)
4. [TMC System Integration](#tmc-system-integration)
5. [Feature-Specific Implementation Guides](#feature-specific-implementation-guides)
6. [API Reference](#api-reference)
7. [Security & Authentication](#security--authentication)
8. [Support & Training](#support--training)

---

## Platform Overview

### What is DOT Corridor Communicator?

A comprehensive platform for interstate corridor management that provides:

- **Real-time state-to-state messaging** for incident coordination
- **Traffic data aggregation** from 46+ state DOT APIs
- **ITS equipment inventory management** (ARC-IT 10.0 compliant)
- **Truck parking availability** with predictive analytics
- **Corridor briefing reports** for operations planning
- **Grant application support** (RAD-IT, SMART, RAISE, ATCMTD)
- **Detour & bridge clearance alerts**
- **Multi-state event visualization**

### Who Should Use This?

- **Traffic Operations Centers (TOCs/TMCs)**: Real-time corridor monitoring
- **Communications Officers**: State-to-state coordination
- **ITS Engineers**: Equipment inventory and grant applications
- **Planning Departments**: Corridor analysis and reporting
- **Emergency Management**: Multi-state incident response

---

## Full Platform Deployment

### Option 1: Hosted SaaS Platform

**Best for:** States wanting immediate access without infrastructure investment

**Features:**
- Instant account activation
- Automatic updates
- 99.9% uptime SLA
- Shared infrastructure (cost-effective)
- Email/password authentication

**Getting Started:**
1. Contact project administrator for account creation
2. Receive login credentials at your state DOT email
3. Configure your state's data feeds (see Section 5.2)
4. Train staff using platform tutorials
5. Begin corridor operations

**Cost Model:** Shared among pooled fund states, minimal per-state cost

---

### Option 2: Self-Hosted Deployment

**Best for:** States requiring on-premise hosting or custom integrations

**Requirements:**
- Node.js 18+ runtime environment
- SQLite database (or PostgreSQL for enterprise)
- 2GB RAM minimum, 4GB recommended
- HTTPS certificate for secure communications
- Outbound internet access for state DOT API calls

**Deployment Steps:**

```bash
# 1. Clone repository
git clone https://github.com/your-org/dot-corridor-communicator.git
cd dot-corridor-communicator

# 2. Install dependencies
npm install
cd frontend && npm install && cd ..

# 3. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 4. Initialize database
npm run db:init

# 5. Start services
npm run start:backend &    # Backend API server
npm run start:frontend &   # Frontend web app
```

**Environment Configuration (.env):**
```env
# Server Configuration
PORT=3001
FRONTEND_PORT=5173
NODE_ENV=production

# Database
DATABASE_PATH=./states.db

# Authentication
JWT_SECRET=your-secure-random-string-here
SESSION_SECRET=another-secure-random-string

# Email (optional - for notifications)
SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=noreply@yourdot.gov

# Encryption (for storing API keys)
ENCRYPTION_KEY=32-character-encryption-key

# External APIs (add your state's API keys)
STATE_API_KEY=your-state-api-key
```

**Docker Deployment (Recommended):**

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      - DATABASE_PATH=/data/states.db
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./data:/data
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

```bash
docker-compose up -d
```

---

## Modular Integration Options

**Key Principle:** You don't need to deploy the entire platform. Extract individual features and integrate them into your existing TMC systems.

### Integration Patterns

#### 1. **API-Only Integration**
Use backend APIs from your existing applications. No UI deployment needed.

#### 2. **Widget/Component Integration**
Embed React components into your existing web applications.

#### 3. **iFrame Embedding**
Embed full-page features into your portal via iFrame.

#### 4. **Data Pipeline Integration**
Feed data from our platform into your existing dashboards/databases.

---

## TMC System Integration

### Common TMC System Architectures

Most state TMCs use one of these systems:
- **SunGuide** (Florida DOT)
- **ATMS.now** (PeMS/Caltrans)
- **TransSuite** (TransCore)
- **IRIS** (Minnesota DOT)
- **Custom ATMS** (various vendors)

Our platform integrates with all of these through standard APIs.

---

### Integration Pattern 1: Real-Time Messaging for TMC Operators

**Use Case:** Your TMC operators need to coordinate with neighboring states during incidents, but your ATMS doesn't support interstate messaging.

**Solution:** Add state-to-state messaging module to your TMC workstations.

#### Implementation Options

##### A. API Integration (Recommended for TMC Systems)

**How it works:**
1. Your ATMS sends HTTP requests to our messaging API
2. Messages appear in neighboring state TMCs
3. Responses come back via webhooks or polling

**API Endpoints:**

```javascript
// Send message to another state
POST /api/messages
{
  "sendingStateKey": "IA",
  "receivingStateKeys": ["NE", "MO"],
  "eventId": "i80-mm123-incident",
  "message": "Major crash blocking 2 lanes EB I-80 MM 123. Expect delays.",
  "priority": "high",
  "userId": "operator@iowadot.gov"
}

// Get messages for your state
GET /api/messages?receivingStateKey=IA&unreadOnly=true

// Mark message as read
PUT /api/messages/{messageId}/read

// Reply to message
POST /api/messages/{messageId}/reply
{
  "message": "Copy. Diverting traffic at Exit 118.",
  "userId": "operator@iowadot.gov"
}
```

**Example TMC Integration (C#/.NET):**

```csharp
// Add to your ATMS application
public class CorridorMessenger
{
    private readonly HttpClient _client;
    private readonly string _apiUrl = "https://corridor.dot.gov/api";

    public async Task SendMessageToState(string receivingState, string message, string eventId)
    {
        var payload = new {
            sendingStateKey = "IA",
            receivingStateKeys = new[] { receivingState },
            eventId = eventId,
            message = message,
            priority = "high",
            userId = GetCurrentOperator()
        };

        var response = await _client.PostAsJsonAsync($"{_apiUrl}/messages", payload);
        response.EnsureSuccessStatusCode();
    }

    public async Task<List<Message>> CheckNewMessages()
    {
        var response = await _client.GetAsync(
            $"{_apiUrl}/messages?receivingStateKey=IA&unreadOnly=true"
        );
        var data = await response.Content.ReadFromJsonAsync<MessageResponse>();
        return data.Messages;
    }
}

// In your TMC event handling code
private async void OnIncidentDetected(Incident incident)
{
    if (incident.AffectsInterstate)
    {
        var affectedStates = DetermineAffectedStates(incident);
        var messenger = new CorridorMessenger();

        foreach (var state in affectedStates)
        {
            await messenger.SendMessageToState(
                state,
                $"Incident on {incident.Route} MM {incident.Milepost}. {incident.Description}",
                incident.Id
            );
        }
    }
}
```

**Webhook Integration (Push Notifications):**

```javascript
// Configure webhook in platform settings
{
  "webhookUrl": "https://yourtmc.dot.gov/api/corridor-messages",
  "events": ["message.received", "message.replied"],
  "authToken": "your-webhook-secret"
}

// Your TMC receives POST requests when messages arrive
POST https://yourtmc.dot.gov/api/corridor-messages
{
  "event": "message.received",
  "timestamp": "2025-11-27T10:30:00Z",
  "data": {
    "messageId": "msg-12345",
    "fromState": "NE",
    "toState": "IA",
    "message": "Severe weather moving east on I-80",
    "priority": "critical"
  }
}
```

##### B. Widget Integration (For Web-Based TMC Systems)

**How it works:**
- Embed our messaging React component into your TMC web interface
- Component handles UI and API communication
- Seamlessly blends with your existing design

**Implementation:**

```html
<!-- Add to your TMC dashboard -->
<div id="corridor-messaging"></div>

<script src="https://corridor.dot.gov/widgets/messaging.js"></script>
<script>
  CorridorMessaging.init({
    container: '#corridor-messaging',
    stateKey: 'IA',
    apiUrl: 'https://corridor.dot.gov/api',
    authToken: 'your-api-token',
    theme: {
      primaryColor: '#0066cc',
      backgroundColor: '#1a1a1a'  // Match your TMC theme
    },
    onMessageReceived: function(message) {
      // Trigger your TMC's notification system
      TMC.notify({
        title: `Message from ${message.fromState}`,
        body: message.content,
        sound: 'alert.wav'
      });
    }
  });
</script>
```

##### C. TMC Display Board Integration

**How it works:**
- Messages appear on TMC operator screens automatically
- Color-coded by priority
- Audio alerts for critical messages

**Display API:**

```javascript
// WebSocket connection for real-time updates
const ws = new WebSocket('wss://corridor.dot.gov/ws');

ws.on('connect', () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    stateKey: 'IA',
    authToken: 'your-token'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);

  // Display on TMC screen
  displayMessageOnScreen({
    from: message.fromState,
    text: message.content,
    priority: message.priority,
    timestamp: message.timestamp
  });

  // Play audio alert if critical
  if (message.priority === 'critical') {
    playAlertSound();
  }
});
```

---

### Integration Pattern 2: Detour Alerts for Dynamic Message Signs (DMS)

**Use Case:** Automatically update your DMS boards when neighboring states report detours affecting your corridor.

**Solution:** Connect detour alert API to your DMS management system.

#### Implementation

**API Endpoint:**
```javascript
// Get active detours affecting your state
GET /api/detour-alerts?affectedStates=IA

Response:
{
  "success": true,
  "alerts": [
    {
      "id": "detour-2025-001",
      "reportingState": "IL",
      "route": "I-80",
      "location": "MM 145 to MM 160",
      "detourRoute": "I-88 to I-39 to I-80",
      "reason": "Bridge reconstruction",
      "startDate": "2025-12-01",
      "endDate": "2026-03-15",
      "affectedStates": ["IA", "NE"],
      "impactLevel": "major"
    }
  ]
}
```

**DMS Integration Example:**

```csharp
// Automated DMS update service
public class DmsCorridorAlertService
{
    private readonly IDmsController _dms;
    private readonly ICorridorApi _corridor;

    public async Task UpdateDmsBoards()
    {
        // Get alerts from corridor platform
        var alerts = await _corridor.GetActiveDetours("IA");

        foreach (var alert in alerts)
        {
            // Find DMS boards near the affected route
            var affectedBoards = _dms.FindBoardsByRoute(alert.Route);

            foreach (var board in affectedBoards)
            {
                // Update DMS message
                await _dms.SetMessage(board.Id, new DmsMessage
                {
                    Lines = new[] {
                        $"{alert.Route} DETOUR",
                        $"{alert.Location}",
                        $"USE {alert.DetourRoute}",
                        $"THRU {alert.EndDate:MM/DD}"
                    },
                    Priority = alert.ImpactLevel == "major" ? 2 : 3,
                    Duration = TimeSpan.FromDays(1)
                });
            }
        }
    }

    // Run every 15 minutes
    public void StartMonitoring()
    {
        Timer timer = new Timer(async _ => await UpdateDmsBoards(),
            null, TimeSpan.Zero, TimeSpan.FromMinutes(15));
    }
}
```

---

### Integration Pattern 3: Bridge Clearance Alerts for Commercial Vehicle Enforcement

**Use Case:** Your commercial vehicle enforcement division needs real-time alerts about bridge strikes or clearance issues on interstate corridors.

**Solution:** Push bridge alerts to enforcement dispatch systems.

#### Implementation

**REST API:**
```javascript
// Get bridge clearance alerts
GET /api/bridge-alerts?stateKey=IA&activeOnly=true

Response:
{
  "success": true,
  "alerts": [
    {
      "id": "bridge-alert-456",
      "route": "I-80",
      "milepost": 234.5,
      "bridgeName": "Main Street Overpass",
      "clearance": {
        "posted": "13'6\"",
        "actual": "13'2\"",  // Lower due to repaving
        "restrictions": "No vehicles over 13' until Dec 2025"
      },
      "coordinates": {
        "lat": 41.234,
        "lon": -93.567
      },
      "impactDate": "2025-11-15",
      "severity": "warning"
    }
  ]
}
```

**CAD/Dispatch Integration:**

```python
# Python integration for dispatch systems
import requests
from datetime import datetime

class BridgeAlertMonitor:
    def __init__(self, api_url, api_token):
        self.api_url = api_url
        self.headers = {'Authorization': f'Bearer {api_token}'}

    def get_active_bridge_alerts(self, state_key):
        """Fetch active bridge clearance alerts"""
        response = requests.get(
            f'{self.api_url}/api/bridge-alerts',
            params={'stateKey': state_key, 'activeOnly': True},
            headers=self.headers
        )
        return response.json()['alerts']

    def push_to_dispatch(self, alert):
        """Send alert to CAD system"""
        # Format for your CAD system
        cad_alert = {
            'type': 'BRIDGE_CLEARANCE',
            'priority': 'MEDIUM',
            'location': f"{alert['route']} MM {alert['milepost']}",
            'description': (
                f"Bridge clearance restriction: {alert['bridgeName']} - "
                f"Posted {alert['clearance']['posted']}, "
                f"Actual {alert['clearance']['actual']}"
            ),
            'coordinates': alert['coordinates'],
            'validUntil': alert.get('impactDate')
        }

        # Push to your CAD system API
        requests.post(
            'https://cad.yourdot.gov/api/alerts',
            json=cad_alert
        )

    def monitor(self):
        """Continuously monitor for new alerts"""
        while True:
            alerts = self.get_active_bridge_alerts('IA')
            for alert in alerts:
                if not self.already_notified(alert['id']):
                    self.push_to_dispatch(alert)
                    self.mark_notified(alert['id'])

            time.sleep(300)  # Check every 5 minutes

# Usage
monitor = BridgeAlertMonitor(
    api_url='https://corridor.dot.gov',
    api_token='your-api-token'
)
monitor.monitor()
```

---

### Integration Pattern 4: ITS Equipment Inventory for Asset Management Systems

**Use Case:** Your asset management system needs to track ITS equipment for maintenance scheduling and grant applications.

**Solution:** Sync ITS equipment data with your CMMS/asset management database.

#### Implementation

**Bulk Data Export:**
```javascript
// Export all ITS equipment for your state
GET /api/its-equipment/export?stateKey=IA&format=json

Response:
{
  "success": true,
  "equipment": [
    {
      "id": "IA-CAM-001",
      "equipmentType": "camera",
      "manufacturer": "Axis Communications",
      "model": "Q6155-E",
      "route": "I-80",
      "milepost": 123.4,
      "latitude": 41.234,
      "longitude": -93.567,
      "installationDate": "2023-06-15",
      "status": "active",
      "arc_its_id": "IA-TMC-CAM-001",
      "arc_its_category": "Field Equipment",
      "arc_its_function": "Traffic Monitoring"
    },
    // ... more equipment
  ],
  "metadata": {
    "totalCount": 2456,
    "lastUpdated": "2025-11-27T10:00:00Z"
  }
}
```

**CMMS Integration Example (Maximo, SAP PM, etc.):**

```java
// Java integration for enterprise asset management
public class ItsEquipmentSync {
    private final RestTemplate restTemplate;
    private final MaximoService maximo;

    public void syncEquipment() {
        // Fetch from corridor platform
        ResponseEntity<ItsEquipmentResponse> response = restTemplate.getForEntity(
            "https://corridor.dot.gov/api/its-equipment/export?stateKey=IA&format=json",
            ItsEquipmentResponse.class
        );

        List<ItsEquipment> equipment = response.getBody().getEquipment();

        for (ItsEquipment item : equipment) {
            // Create or update in Maximo
            Asset asset = new Asset();
            asset.setAssetNum(item.getId());
            asset.setDescription(item.getEquipmentType() + " - " + item.getModel());
            asset.setLocation(item.getRoute() + " MM " + item.getMilepost());
            asset.setLatitude(item.getLatitude());
            asset.setLongitude(item.getLongitude());
            asset.setManufacturer(item.getManufacturer());
            asset.setModel(item.getModel());
            asset.setInstallDate(item.getInstallationDate());
            asset.setStatus(item.getStatus());

            // Custom fields for ARC-ITS compliance
            asset.setCustomField("ARC_ITS_ID", item.getArcItsId());
            asset.setCustomField("ARC_CATEGORY", item.getArcItsCategory());

            maximo.createOrUpdateAsset(asset);
        }

        log.info("Synced {} ITS assets to Maximo", equipment.size());
    }

    // Schedule daily sync at 2 AM
    @Scheduled(cron = "0 0 2 * * ?")
    public void scheduledSync() {
        syncEquipment();
    }
}
```

**Delta Sync (For Large Inventories):**

```javascript
// Only sync changes since last update
GET /api/its-equipment/changes?stateKey=IA&since=2025-11-26T00:00:00Z

Response:
{
  "success": true,
  "changes": {
    "added": [ /* new equipment */ ],
    "updated": [ /* modified equipment */ ],
    "deleted": [ /* removed equipment IDs */ ]
  },
  "lastSync": "2025-11-27T10:00:00Z"
}
```

---

## Feature-Specific Implementation Guides

### 5.1 State-to-State Messaging

#### Full Feature Deployment

**Standalone Deployment:**
```bash
# Deploy just the messaging module
npm run deploy:messaging

# Access at: https://messaging.yourdot.gov
```

**iFrame Embedding:**
```html
<iframe
  src="https://corridor.dot.gov/messaging?stateKey=IA&embed=true"
  width="100%"
  height="600"
  frameborder="0">
</iframe>
```

#### Database Schema (For Self-Hosted)

```sql
CREATE TABLE corridor_messages (
  id INTEGER PRIMARY KEY,
  sending_state_key TEXT NOT NULL,
  receiving_state_key TEXT NOT NULL,
  event_id TEXT,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  replied_at TIMESTAMP,
  user_id TEXT NOT NULL,
  FOREIGN KEY (sending_state_key) REFERENCES states(state_key),
  FOREIGN KEY (receiving_state_key) REFERENCES states(state_key)
);

CREATE INDEX idx_messages_receiving ON corridor_messages(receiving_state_key, read_at);
CREATE INDEX idx_messages_event ON corridor_messages(event_id);
```

#### Authentication & Authorization

```javascript
// Verify user can send messages for their state
POST /api/messages
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

// Token payload must include:
{
  "userId": "operator@iowadot.gov",
  "stateKey": "IA",
  "role": "operator",
  "exp": 1732723200
}
```

---

### 5.2 Traffic Data Feed Integration

#### Adding Your State's Data Feed

**Configuration File:**
```javascript
// config/states/iowa.js
module.exports = {
  stateKey: 'IA',
  stateName: 'Iowa DOT',
  apiUrl: 'https://lb.511ia.org/api/v2',
  apiKey: process.env.IOWA_API_KEY,
  refreshInterval: 60000, // 1 minute

  // Data transformation
  transformEvent: (rawEvent) => ({
    id: rawEvent.event_id,
    type: rawEvent.event_type,
    route: rawEvent.roadway,
    milepost: rawEvent.mile_marker,
    direction: rawEvent.direction,
    description: rawEvent.description,
    startTime: new Date(rawEvent.start_time),
    endTime: rawEvent.end_time ? new Date(rawEvent.end_time) : null,
    severity: mapSeverity(rawEvent.severity),
    coordinates: {
      lat: rawEvent.latitude,
      lon: rawEvent.longitude
    }
  }),

  // Optional: Custom filters
  filterEvents: (event) => {
    // Only include interstate events
    return event.roadway.startsWith('I-');
  }
};
```

**Testing Your Feed:**
```bash
# Validate configuration
npm run test:feed --state=IA

# Manual fetch test
curl -X GET \
  "https://corridor.dot.gov/api/test-state/IA" \
  -H "Authorization: Bearer admin-token"
```

---

### 5.3 ITS Equipment Management

#### Uploading Equipment Inventory

**Method 1: File Geodatabase (.gdb.zip)**

Supports ESRI File Geodatabase format with spatial data.

```bash
# Prepare your GDB export from ArcGIS
# Required fields:
# - OBJECTID
# - SHAPE (Point geometry)
# - EQUIPMENT_TYPE (camera, dms, rsu, sensor)
# - MANUFACTURER (optional)
# - MODEL (optional)
# - INSTALL_DATE (optional)
# - ROUTE (e.g., "I-80")
# - MILEPOST

# Zip the .gdb folder
zip -r ia_its_equipment.gdb.zip Iowa_ITS.gdb/

# Upload via web interface or API
curl -X POST \
  "https://corridor.dot.gov/api/its-equipment/upload" \
  -H "Authorization: Bearer your-token" \
  -F "file=@ia_its_equipment.gdb.zip" \
  -F "stateKey=IA"
```

**Method 2: CSV Upload**

```csv
equipment_id,equipment_type,latitude,longitude,route,milepost,manufacturer,model,installation_date,status
IA-CAM-001,camera,41.5868,-93.6250,I-80,123.4,Axis,Q6155-E,2023-06-15,active
IA-DMS-002,dms,41.5912,-93.6180,I-80,125.2,Daktronics,VF-4010,2022-03-20,active
IA-RSU-003,rsu,41.5950,-93.6100,I-80,127.0,Commsignia,ITS-G5,2024-01-10,active
```

#### Bulk Update Via API

```javascript
// Update multiple equipment records
PUT /api/its-equipment/bulk-update
{
  "stateKey": "IA",
  "updates": [
    {
      "id": "IA-CAM-001",
      "status": "maintenance",
      "notes": "Scheduled maintenance 2025-12-01"
    },
    {
      "id": "IA-DMS-002",
      "manufacturer": "Daktronics",
      "model": "VF-4010",
      "arc_its_id": "IA-TMC-DMS-002"
    }
  ]
}
```

---

### 5.4 Corridor Briefing Reports

#### Automated Daily Briefings

**Schedule Generation:**
```javascript
// Configure automated corridor briefing
POST /api/corridor-briefing/schedule
{
  "stateKey": "IA",
  "corridors": ["I-80", "I-35", "I-29"],
  "schedule": {
    "frequency": "daily",
    "time": "06:00",  // 6 AM local time
    "timezone": "America/Chicago"
  },
  "recipients": [
    "operations@iowadot.gov",
    "communications@iowadot.gov"
  ],
  "format": "pdf"
}
```

**Manual Generation:**
```javascript
// Generate on-demand briefing
POST /api/corridor-briefing/generate
{
  "stateKey": "IA",
  "corridor": "I-80",
  "dateRange": {
    "start": "2025-11-20",
    "end": "2025-11-27"
  },
  "includeWeather": true,
  "includeTruckParking": true,
  "includeIncidents": true
}

// Returns PDF download link
Response:
{
  "success": true,
  "reportUrl": "https://corridor.dot.gov/reports/ia-i80-20251127.pdf",
  "expiresAt": "2025-12-04T00:00:00Z"
}
```

---

### 5.5 Truck Parking Integration

#### Real-Time Parking Availability API

**Get Current Availability:**
```javascript
GET /api/truck-parking/availability?route=I-80&state=IA

Response:
{
  "success": true,
  "facilities": [
    {
      "facilityId": "IA-I80-MM123",
      "name": "Iowa 80 Truck Stop",
      "route": "I-80",
      "milepost": 123,
      "direction": "EB",
      "capacity": 300,
      "available": 45,
      "percentFull": 85,
      "trend": "filling",
      "lastUpdated": "2025-11-27T14:30:00Z",
      "coordinates": {
        "lat": 41.5868,
        "lon": -93.6250
      },
      "amenities": ["fuel", "restaurant", "showers", "wifi"]
    }
  ]
}
```

**DMS Integration for Parking:**
```javascript
// Get formatted DMS messages for parking status
GET /api/truck-parking/dms-messages?route=I-80&state=IA

Response:
{
  "messages": [
    {
      "facilityId": "IA-I80-MM123",
      "dmsLocation": "MM 115",
      "lines": [
        "IOWA 80 TRUCK STOP",
        "8 MI - 85% FULL",
        "45 SPACES"
      ]
    },
    {
      "facilityId": "IA-I80-MM156",
      "dmsLocation": "MM 150",
      "lines": [
        "REST AREA MM 156",
        "6 MI - FULL",
        "NO PARKING"
      ]
    }
  ]
}
```

**Predictive Parking API:**
```javascript
// Get predicted availability for next 24 hours
GET /api/truck-parking/prediction?facilityId=IA-I80-MM123&hours=24

Response:
{
  "facilityId": "IA-I80-MM123",
  "predictions": [
    {
      "hour": "2025-11-27T15:00:00Z",
      "predictedAvailable": 42,
      "confidence": 0.87
    },
    {
      "hour": "2025-11-27T16:00:00Z",
      "predictedAvailable": 35,
      "confidence": 0.91
    },
    // ... 24 hours
  ]
}
```

---

## API Reference

### Base URL
```
Production: https://corridor.dot.gov/api
Staging: https://staging.corridor.dot.gov/api
Self-Hosted: https://your-server.dot.gov/api
```

### Authentication

All API requests require a valid JWT token in the Authorization header.

```bash
# Get token
POST /api/auth/login
{
  "email": "user@iowadot.gov",
  "password": "your-password"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 123,
    "email": "user@iowadot.gov",
    "stateKey": "IA",
    "role": "operator"
  }
}

# Use token in requests
GET /api/messages
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Core Endpoints

#### Traffic Events
```
GET    /api/events              # Get all events
GET    /api/events/:state       # Get events for state
GET    /api/events/:id          # Get specific event
POST   /api/events              # Create manual event
PUT    /api/events/:id          # Update event
DELETE /api/events/:id          # Delete event
```

#### Messages
```
GET    /api/messages                    # Get messages
POST   /api/messages                    # Send message
GET    /api/messages/event/:eventId     # Get event messages
PUT    /api/messages/:id/read           # Mark as read
POST   /api/messages/:id/reply          # Reply to message
DELETE /api/messages/:id                # Delete message
```

#### ITS Equipment
```
GET    /api/its-equipment                    # List equipment
POST   /api/its-equipment/upload             # Upload inventory
GET    /api/its-equipment/export             # Export data
GET    /api/its-equipment/compliance-report  # Gap analysis
GET    /api/its-equipment/export/radit       # RAD-IT format
GET    /api/its-equipment/routes             # List routes
GET    /api/its-equipment/states             # States with data
```

#### Truck Parking
```
GET    /api/truck-parking/availability       # Current availability
GET    /api/truck-parking/prediction         # Predictive data
GET    /api/truck-parking/dms-messages       # DMS formatted
GET    /api/truck-parking/facilities         # List facilities
```

#### Detours & Alerts
```
GET    /api/detour-alerts         # Active detours
POST   /api/detour-alerts         # Report detour
GET    /api/bridge-alerts         # Bridge clearances
POST   /api/bridge-alerts         # Report bridge issue
```

#### Corridor Briefing
```
GET    /api/corridor-briefing/:corridor      # Get briefing
POST   /api/corridor-briefing/generate       # Generate report
POST   /api/corridor-briefing/schedule       # Schedule automatic
```

---

## Security & Authentication

### User Management

#### Creating State Operator Accounts

```javascript
POST /api/admin/users
{
  "email": "operator@iowadot.gov",
  "stateKey": "IA",
  "role": "operator",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "515-555-0100"
}

// Roles:
// - "operator": TMC operators (send/receive messages, view data)
// - "admin": State DOT admins (manage users, upload data)
// - "viewer": Read-only access
```

### API Token Management

#### Long-Lived API Tokens (For System Integration)

```javascript
// Generate API token for automated systems
POST /api/admin/generate-token
{
  "purpose": "DMS Integration",
  "stateKey": "IA",
  "permissions": ["read:detours", "read:bridge-alerts"],
  "expiresInDays": 365
}

Response:
{
  "token": "api_live_1234567890abcdef",
  "expiresAt": "2026-11-27"
}

// Use in requests
GET /api/detour-alerts?stateKey=IA
Headers:
  Authorization: Bearer api_live_1234567890abcdef
```

### IP Allowlisting (Enterprise)

```javascript
// Restrict API access to your TMC IP range
POST /api/admin/security/ip-allowlist
{
  "stateKey": "IA",
  "allowedIps": [
    "203.0.113.0/24",      // TMC network
    "198.51.100.50",       // VPN gateway
    "192.0.2.0/28"         // Backup operations center
  ]
}
```

---

## Support & Training

### Training Resources

#### Online Training Portal
- Video tutorials: https://corridor.dot.gov/training
- User guides: https://corridor.dot.gov/docs
- API documentation: https://corridor.dot.gov/api-docs

#### Live Training Sessions
Contact: training@corridor.dot.gov
- Monthly webinars (first Tuesday, 2 PM ET)
- Custom DOT training available
- TMC operator certification program

### Technical Support

#### Support Tiers

**Tier 1: Community Support** (Free)
- GitHub issues: https://github.com/your-org/dot-corridor-communicator/issues
- Community forum: https://forum.corridor.dot.gov
- Response time: Best effort

**Tier 2: Standard Support** (Included for pooled fund states)
- Email: support@corridor.dot.gov
- Phone: 1-800-DOT-HELP
- Response time: 24 business hours
- Hours: 8 AM - 5 PM ET, Mon-Fri

**Tier 3: Premium Support** (Enterprise SLA)
- Dedicated support engineer
- 24/7 phone support
- 2-hour response time for critical issues
- Custom integration assistance
- Contact: enterprise@corridor.dot.gov

### Integration Assistance

Need help integrating with your specific TMC system?

**Free Integration Consultation:**
- 1-hour video call to discuss your architecture
- Review integration options
- Answer technical questions
- Book at: https://corridor.dot.gov/consult

**Professional Services:**
- Custom API development
- TMC system integration
- Data migration
- On-site training
- Contact: services@corridor.dot.gov

---

## Appendix A: Integration Checklist

### Pre-Integration Assessment

- [ ] Identify which features your DOT needs
- [ ] Determine integration pattern (API, Widget, iFrame, Full Platform)
- [ ] Inventory existing TMC systems and their APIs
- [ ] Assess network security requirements
- [ ] Define user roles and access levels
- [ ] Schedule training for staff

### Technical Prerequisites

- [ ] Obtain API credentials
- [ ] Configure firewalls for API access
- [ ] Set up SSL certificates (if self-hosting)
- [ ] Establish database backup procedures
- [ ] Configure monitoring and alerts
- [ ] Test data feeds in staging environment

### Go-Live Checklist

- [ ] Complete user acceptance testing
- [ ] Train all operators on new features
- [ ] Document custom integration code
- [ ] Set up monitoring dashboards
- [ ] Configure automated backups
- [ ] Establish support escalation procedures
- [ ] Announce launch to neighboring states

---

## Appendix B: Common TMC System Integration Examples

### SunGuide Integration (Florida DOT ATMS)

```sql
-- Add corridor messaging to SunGuide database
CREATE TABLE corridor_messages (
    message_id VARCHAR(50) PRIMARY KEY,
    from_state CHAR(2),
    to_state CHAR(2),
    event_id VARCHAR(50),
    message_text VARCHAR(2000),
    priority VARCHAR(20),
    received_timestamp TIMESTAMP,
    operator_id VARCHAR(50),
    acknowledged CHAR(1) DEFAULT 'N'
);

-- Trigger to alert operators
CREATE TRIGGER alert_operator
AFTER INSERT ON corridor_messages
FOR EACH ROW
BEGIN
    IF NEW.priority = 'CRITICAL' THEN
        -- Insert into SunGuide alert queue
        INSERT INTO operator_alerts (
            alert_type,
            alert_text,
            alert_time
        ) VALUES (
            'CORRIDOR_MESSAGE',
            CONCAT('URGENT: ', NEW.from_state, ' reports: ', NEW.message_text),
            NOW()
        );
    END IF;
END;
```

### TransSuite Integration

```xml
<!-- TransSuite Custom Event Processor -->
<EventProcessor name="CorridorMessaging">
    <Source>
        <Type>REST_API</Type>
        <Endpoint>https://corridor.dot.gov/api/messages</Endpoint>
        <PollInterval>60</PollInterval>
        <Authentication>
            <Type>Bearer</Type>
            <Token>${CORRIDOR_API_TOKEN}</Token>
        </Authentication>
    </Source>

    <Processing>
        <Transform>
            <Field source="fromState" target="origin_agency"/>
            <Field source="message" target="event_description"/>
            <Field source="priority" target="event_priority"/>
        </Transform>

        <Alert>
            <Condition>priority == 'CRITICAL'</Condition>
            <Action>
                <Type>Notification</Type>
                <Recipients>shift_supervisor,operations_manager</Recipients>
                <Sound>high_priority_alert.wav</Sound>
            </Action>
        </Alert>
    </Processing>
</EventProcessor>
```

---

## Appendix C: Sample Integration Costs

### Implementation Costs (Estimates)

**Full Platform Deployment:**
- Self-hosted infrastructure: $5,000 - $15,000 (one-time)
- Annual hosting: $2,000 - $5,000
- Staff training: $3,000 - $10,000
- Total first year: $10,000 - $30,000

**Modular Integration (Single Feature):**
- API integration development: $2,000 - $8,000
- Testing and validation: $1,000 - $3,000
- Staff training: $500 - $2,000
- Total per module: $3,500 - $13,000

**Hosted SaaS (Pooled Fund):**
- Shared costs among states
- Typical per-state: $1,000 - $5,000/year
- Includes hosting, support, updates

---

## Document Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-27 | Initial release | DOT Corridor Team |

---

**Questions?** Contact us at support@corridor.dot.gov or visit https://corridor.dot.gov/help

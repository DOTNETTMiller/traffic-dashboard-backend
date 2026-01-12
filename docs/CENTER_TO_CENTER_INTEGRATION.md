# Center-to-Center Communication: Modular Integration Guide

## Overview

The DOT Corridor Communicator Messenger can be deployed as a **modular backend server** that integrates with any traffic management software to enable **national center-to-center communication**. This document explains the architecture, deployment strategies, and integration methods for using the Corridor Communicator as a communication layer for Traffic Management Centers (TMCs).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Modular Design Principles](#modular-design-principles)
3. [Event Data Model](#event-data-model)
4. [Integration Methods](#integration-methods)
5. [API Reference for External Systems](#api-reference-for-external-systems)
6. [Deployment Strategies](#deployment-strategies)
7. [Center-to-Center Communication](#center-to-center-communication)
8. [Authentication & Security](#authentication--security)
9. [Standards Compliance](#standards-compliance)
10. [Implementation Examples](#implementation-examples)

---

## Architecture Overview

### System Components

The Corridor Communicator consists of three primary layers that can be deployed independently:

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (Optional)                        │
│              React-based Web Dashboard                       │
│           Can be replaced with any UI/client                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API Server (Core)                       │
│        Express.js REST API + WebSocket Server                │
│     • Event aggregation & normalization                      │
│     • Message routing & storage                              │
│     • User authentication                                     │
│     • Standards conversion (WZDx, TIM, TMDD)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Integration Layer                          │
│     • State DOT API connectors (39+ states)                  │
│     • Database (SQLite/PostgreSQL)                           │
│     • External TMC integrations                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Features for Modular Integration

- **Stateless API Design**: RESTful endpoints that can be called from any system
- **Event-Driven Architecture**: Real-time updates via WebSocket or polling
- **Standards-Based Data Exchange**: WZDx, SAE J2735, TMDD support
- **Flexible Authentication**: API keys, OAuth, or SSO integration
- **Database Agnostic**: SQLite (embedded) or PostgreSQL (enterprise)
- **Containerized Deployment**: Docker support for easy installation

---

## Modular Design Principles

### 1. Separation of Concerns

The backend is designed to be **independent** of the frontend, allowing TMCs to:

- Use their existing traffic management UI
- Integrate the backend as a microservice
- Replace only the communication layer
- Maintain their current workflows

### 2. Plugin Architecture

The system supports modular components:

```javascript
// Example: Adding a new state DOT connector
const customStateConnector = {
  stateKey: 'custom',
  name: 'Custom State DOT',
  apiUrl: 'https://custom-state.gov/api/traffic',
  apiType: 'WZDx',
  fetchFunction: async () => {
    // Custom fetch logic
    return normalizedEvents;
  }
};

// Register the connector
registerStateConnector(customStateConnector);
```

### 3. Event Normalization

All incoming data is normalized to a **common schema**, regardless of source:

```javascript
{
  id: "unique-event-id",
  type: "work-zone", // incident, restriction, weather, parking
  state: "IA",
  description: "Road work on I-80",
  startDate: "2026-01-12T00:00:00Z",
  endDate: "2026-01-15T23:59:59Z",
  location: {
    latitude: 41.5868,
    longitude: -93.6250,
    roadName: "I-80",
    direction: "eastbound"
  },
  severity: "moderate", // minor, moderate, major
  lanes: {
    affected: ["right lane"],
    closedCount: 1,
    totalCount: 3
  },
  source: {
    provider: "Iowa DOT",
    timestamp: "2026-01-12T10:30:00Z"
  }
}
```

---

## Event Data Model

### Core Event Schema

All events in the system follow a standardized schema that can be extended:

```typescript
interface TrafficEvent {
  // Identification
  id: string;                    // Unique identifier
  type: EventType;               // work-zone, incident, restriction, weather, parking

  // Location
  state: string;                 // Two-letter state code
  location: {
    latitude: number;
    longitude: number;
    roadName?: string;
    direction?: string;
    mileposts?: {
      start: number;
      end: number;
    };
  };

  // Temporal
  startDate: string;             // ISO 8601 timestamp
  endDate?: string;              // ISO 8601 timestamp
  isActive: boolean;

  // Description
  description: string;
  severity: 'minor' | 'moderate' | 'major';

  // Impact
  lanes?: {
    affected: string[];
    closedCount: number;
    totalCount: number;
  };
  delay?: {
    estimatedMinutes: number;
  };

  // Source tracking
  source: {
    provider: string;
    timestamp: string;
    url?: string;
  };

  // Extensible metadata
  metadata?: Record<string, any>;
}
```

### Event Types

The system supports multiple event types:

| Type | Description | Use Cases |
|------|-------------|-----------|
| `work-zone` | Construction, maintenance | Lane closures, roadwork |
| `incident` | Accidents, breakdowns | Crashes, disabled vehicles |
| `restriction` | Speed limits, weight restrictions | Truck restrictions, special events |
| `weather` | Weather-related impacts | Snow, ice, flooding |
| `parking` | Truck parking availability | Rest areas, weigh stations |
| `special-event` | Planned events | Parades, sports events |

---

## Integration Methods

### Method 1: API-Based Integration (Recommended)

**Use Case**: Existing TMC software makes API calls to fetch/post event data

```javascript
// In your existing TMC software:

// 1. Fetch events for your region
const response = await fetch('https://corridor-api.example.com/api/events?state=ia');
const events = await response.json();

// 2. Post a new event from your system
await fetch('https://corridor-api.example.com/api/events', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'incident',
    state: 'IA',
    description: 'Multi-vehicle accident on I-80',
    location: { latitude: 41.5868, longitude: -93.6250 },
    severity: 'major'
  })
});

// 3. Subscribe to real-time updates
const ws = new WebSocket('wss://corridor-api.example.com/ws');
ws.onmessage = (event) => {
  const newEvent = JSON.parse(event.data);
  updateYourTMCDisplay(newEvent);
};
```

### Method 2: Database Replication

**Use Case**: Direct database access for high-performance reads

```sql
-- Your TMC can read directly from the replicated events table
SELECT * FROM events
WHERE state = 'IA'
  AND is_active = true
  AND start_date <= NOW()
  AND (end_date IS NULL OR end_date >= NOW());
```

### Method 3: Message Queue Integration

**Use Case**: Event-driven architecture with message brokers

```javascript
// Publish events to your existing message queue
const eventBus = require('your-message-queue');

// Subscribe to Corridor Communicator events
corridorAPI.on('new-event', (event) => {
  eventBus.publish('traffic-events', event);
});

// Your TMC subscribes to the same queue
eventBus.subscribe('traffic-events', (event) => {
  displayInTMC(event);
});
```

### Method 4: Embedded Deployment

**Use Case**: Install the backend directly within your TMC infrastructure

```bash
# Install as a service on your TMC server
npm install corridor-communicator-backend

# Configure to use your database
export DATABASE_URL="postgresql://your-tmc-db:5432/traffic"
export PORT=3001

# Start the service
npm start
```

---

## API Reference for External Systems

### Authentication

All API requests require authentication:

```bash
# Generate an API key for your TMC
curl -X POST https://corridor-api.example.com/api/auth/generate-key \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "Iowa DOT TMC",
    "contact": "admin@iowadot.gov"
  }'

# Use the API key in subsequent requests
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://corridor-api.example.com/api/events
```

### Core Endpoints

#### 1. Get Events

```http
GET /api/events?state=ia&type=incident&active=true
Authorization: Bearer YOUR_API_KEY
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-01-12T10:00:00Z",
  "totalEvents": 145,
  "events": [
    {
      "id": "evt-123",
      "type": "incident",
      "state": "IA",
      "description": "Accident on I-80",
      "location": {
        "latitude": 41.5868,
        "longitude": -93.6250,
        "roadName": "I-80"
      },
      "severity": "major",
      "startDate": "2026-01-12T09:30:00Z",
      "isActive": true
    }
  ]
}
```

#### 2. Post Event (Center-to-Center Sharing)

```http
POST /api/events
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "type": "work-zone",
  "state": "IA",
  "description": "Bridge maintenance on I-35",
  "location": {
    "latitude": 41.5868,
    "longitude": -93.6250,
    "roadName": "I-35",
    "direction": "northbound"
  },
  "startDate": "2026-01-13T06:00:00Z",
  "endDate": "2026-01-13T18:00:00Z",
  "lanes": {
    "affected": ["right lane"],
    "closedCount": 1,
    "totalCount": 2
  },
  "severity": "moderate"
}
```

#### 3. Post Message (TMC-to-TMC Communication)

```http
POST /api/messages
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "eventId": "evt-123",
  "message": "We've diverted traffic to US-30. Estimated 45-minute delays.",
  "author": "Iowa DOT TMC",
  "timestamp": "2026-01-12T10:15:00Z"
}
```

#### 4. Get Messages for Event

```http
GET /api/messages/event/evt-123
Authorization: Bearer YOUR_API_KEY
```

#### 5. Convert to Standards Format

```http
GET /api/convert/tim?eventId=evt-123
GET /api/convert/wzdx?state=ia
GET /api/convert/tmdd?region=midwest
```

### WebSocket API (Real-Time Updates)

```javascript
const ws = new WebSocket('wss://corridor-api.example.com/ws?apiKey=YOUR_API_KEY');

// Subscribe to specific event types
ws.send(JSON.stringify({
  action: 'subscribe',
  filters: {
    states: ['IA', 'NE', 'IL'],
    types: ['incident', 'work-zone'],
    severity: ['major']
  }
}));

// Receive real-time updates
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('New event:', update);
};
```

---

## Deployment Strategies

### Strategy 1: Cloud-Hosted National Server

**Architecture**: Single national instance serving all TMCs

```
┌────────────────────────────────────────────────────────────┐
│         National Corridor Communicator Server              │
│           (Cloud: AWS, Azure, Railway, etc.)              │
│                                                            │
│  • Aggregates data from all 50 states                     │
│  • Provides APIs to all TMCs                              │
│  • Handles authentication & authorization                  │
│  • Manages center-to-center messaging                     │
└────────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ Iowa TMC│    │ NE  TMC │    │ IL  TMC │
    │ (Client)│    │ (Client)│    │ (Client)│
    └─────────┘    └─────────┘    └─────────┘
```

**Deployment:**
```bash
# Clone repository
git clone https://github.com/your-org/corridor-communicator.git
cd corridor-communicator

# Configure environment
cp .env.example .env
# Edit .env with production settings

# Deploy to cloud platform
railway up  # or docker-compose up, etc.
```

**Benefits**:
- Single source of truth
- Centralized maintenance
- Automatic updates for all users
- Cost-effective

**Drawbacks**:
- Single point of failure
- Requires internet connectivity
- Data sovereignty concerns

### Strategy 2: Regional Deployments

**Architecture**: Regional servers for specific corridors/regions

```
┌──────────────────────┐      ┌──────────────────────┐
│   Midwest Region     │      │   Western Region     │
│   Corridor Server    │      │   Corridor Server    │
│  (IA, NE, IL, MO)   │      │   (CA, NV, AZ)      │
└──────────────────────┘      └──────────────────────┘
         │                              │
         └──────────────────┬───────────┘
                            │
               ┌────────────▼────────────┐
               │   National Federation   │
               │   (Data Sync Service)   │
               └─────────────────────────┘
```

**Configuration:**
```javascript
// regional-config.js
module.exports = {
  region: 'midwest',
  states: ['IA', 'NE', 'IL', 'MO', 'WI', 'MN'],
  federationEndpoint: 'https://national-sync.example.com',
  localDatabase: 'postgresql://localhost:5432/midwest_traffic'
};
```

**Benefits**:
- Better redundancy
- Lower latency for regional users
- Can operate independently if national connection fails

### Strategy 3: On-Premises TMC Installation

**Architecture**: Each TMC runs its own instance

```
┌─────────────────────────────────────────────────┐
│              Iowa DOT Data Center               │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Corridor Communicator Backend (Local)   │  │
│  │  • Embedded SQLite database              │  │
│  │  • Connects to state-specific APIs       │  │
│  │  • Syncs with national federation        │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │     Existing TMC Software                │  │
│  │  • Integrates via API calls              │  │
│  │  • Uses local Corridor Communicator      │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Installation:**
```bash
# Install on Windows Server (TMC environment)
# 1. Install Node.js (v18 or higher)
# 2. Install corridor-communicator
npm install -g corridor-communicator

# 3. Initialize configuration
corridor-communicator init
# Creates config file at C:\ProgramData\CorridorCommunicator\config.json

# 4. Start as Windows Service
corridor-communicator install-service
corridor-communicator start
```

**Benefits**:
- Full control over data
- Works with no internet connection
- Can customize to specific TMC needs
- Meets data sovereignty requirements

### Strategy 4: Hybrid (Recommended for National Rollout)

**Architecture**: Combines cloud and on-premises deployments

```
┌────────────────────────────────────────────────────────┐
│      National Cloud Federation Layer (Optional)        │
│   • Event aggregation across all states                │
│   • Cross-region message routing                       │
│   • Analytics and reporting                            │
└────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ On-Prem │    │ Cloud   │    │ On-Prem │
    │ Iowa TMC│    │ NE  TMC │    │ IL  TMC │
    └─────────┘    └─────────┘    └─────────┘
     (Hybrid)        (Cloud)        (Hybrid)
```

---

## Center-to-Center Communication

### Message Exchange Protocol

The system supports **asynchronous messaging** between TMCs:

```javascript
// TMC A (Iowa) posts a message about an incident
POST /api/messages
{
  "eventId": "ia-i80-incident-001",
  "message": "Major accident at I-80 MM 110. Consider alternate routes via US-30.",
  "author": "Iowa DOT TMC",
  "visibility": ["NE", "IL", "WI"],  // Which states can see this
  "priority": "high",
  "tags": ["detour", "major-delay"]
}

// TMC B (Nebraska) receives notification
WebSocket message: {
  "type": "new-message",
  "eventId": "ia-i80-incident-001",
  "from": "Iowa DOT TMC",
  "message": "Major accident at I-80 MM 110...",
  "timestamp": "2026-01-12T10:30:00Z"
}

// TMC B replies
POST /api/messages
{
  "eventId": "ia-i80-incident-001",
  "message": "Acknowledged. We're updating our westbound I-80 VMS boards with detour info.",
  "author": "Nebraska DOT TMC",
  "replyTo": "msg-12345"
}
```

### Event Sharing

TMCs can share events they create with other states:

```javascript
// Iowa TMC creates a work zone that affects Nebraska traffic
POST /api/events
{
  "type": "work-zone",
  "state": "IA",
  "description": "I-80 bridge work at Iowa/Nebraska border",
  "location": {
    "latitude": 41.2565,
    "longitude": -95.9345,
    "roadName": "I-80"
  },
  "startDate": "2026-01-15T06:00:00Z",
  "endDate": "2026-01-20T18:00:00Z",
  "sharedWith": ["NE"],  // Nebraska will see this in their feed
  "contactInfo": {
    "agency": "Iowa DOT District 4",
    "phone": "515-239-1101",
    "email": "district4@iowadot.us"
  }
}
```

### Collaborative Incident Management

Multiple TMCs can collaborate on the same incident:

```
Timeline for Cross-State Incident:

10:00 AM - Iowa TMC creates incident: "Multi-vehicle pileup on I-80 EB at MM 110"
10:05 AM - Iowa TMC posts message: "Blocking all lanes, estimated 2-hour clearance"
10:10 AM - Nebraska TMC receives notification, replies: "Diverting traffic to US-30"
10:15 AM - Illinois TMC updates message: "VMS boards activated on I-80 WB"
10:45 AM - Iowa TMC updates incident: "One lane reopened, heavy delays remain"
12:30 PM - Iowa TMC closes incident: "All lanes cleared, traffic returning to normal"
```

---

## Authentication & Security

### API Key Management

Each TMC receives a unique API key:

```javascript
// Generate API key for a new TMC
POST /api/admin/generate-token
{
  "organization": "Nebraska Department of Transportation",
  "contact": "john.smith@nebraska.gov",
  "permissions": {
    "readEvents": ["NE", "IA", "CO", "WY", "KS", "SD"],  // Can read these states
    "writeEvents": ["NE"],  // Can only create events for Nebraska
    "messaging": true,
    "exportFormats": ["wzdx", "tim", "tmdd"]
  }
}

// Response
{
  "apiKey": "ne_live_sk_1234567890abcdef",
  "createdAt": "2026-01-12T10:00:00Z",
  "expiresAt": "2027-01-12T10:00:00Z"
}
```

### Role-Based Access Control

```javascript
// User roles within a TMC
const roles = {
  'tmc-operator': {
    permissions: ['read-events', 'post-messages', 'update-status']
  },
  'tmc-supervisor': {
    permissions: ['read-events', 'post-messages', 'create-events', 'update-events']
  },
  'tmc-admin': {
    permissions: ['*']
  },
  'external-agency': {
    permissions: ['read-events']  // Fire/EMS can see events but not modify
  }
};
```

### Data Privacy

- **PII Protection**: No personally identifiable information is stored
- **Audit Logging**: All API calls are logged for compliance
- **Data Retention**: Configurable retention policies (default 90 days for closed events)
- **Encryption**: TLS 1.3 for all API communications

---

## Standards Compliance

### WZDx (Work Zone Data Exchange)

Export events in WZDx format:

```bash
# Get all work zones in WZDx 4.2 format
GET /api/convert/wzdx?state=ia

# Response is valid WZDx GeoJSON
{
  "feed_info": {
    "publisher": "Iowa DOT Corridor Communicator",
    "version": "4.2",
    "update_date": "2026-01-12T10:00:00Z"
  },
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[-93.6250, 41.5868], [-93.6100, 41.5900]]
      },
      "properties": {
        "core_details": {
          "event_type": "work-zone",
          "data_source_id": "ia-i80-wz-001"
        }
      }
    }
  ]
}
```

### SAE J2735 TIM (Traveler Information Message)

Convert to SAE J2735 for broadcasting to vehicles:

```bash
# Get TIM messages for connected vehicles
GET /api/convert/tim?region=midwest

# Response is SAE J2735 compliant
{
  "MessageFrame": {
    "messageId": 31,
    "value": {
      "TravelerInformation": {
        "msgCnt": 1,
        "packetID": "ia-i80-001",
        "dataFrames": [...]
      }
    }
  }
}
```

### TMDD (Traffic Management Data Dictionary)

Support for legacy TMDD systems:

```bash
# Export in TMDD format
GET /api/convert/tmdd?state=ia

# Returns TMDD XML
<?xml version="1.0"?>
<tmdd xmlns="http://www.tmdd.org/3.0">
  <event-information>
    <event-id>ia-i80-001</event-id>
    <event-type>incident</event-type>
    ...
  </event-information>
</tmdd>
```

---

## Implementation Examples

### Example 1: Integrating with Existing .NET TMC Software

```csharp
// C# code for .NET-based TMC software
using System.Net.Http;
using System.Text.Json;

public class CorridorCommunicatorClient
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;

    public CorridorCommunicatorClient(string baseUrl, string apiKey)
    {
        _httpClient = new HttpClient { BaseAddress = new Uri(baseUrl) };
        _apiKey = apiKey;
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
    }

    // Fetch events for display in your TMC software
    public async Task<List<TrafficEvent>> GetEventsAsync(string state)
    {
        var response = await _httpClient.GetAsync($"/api/events?state={state}");
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<EventsResponse>(json);

        return result.Events;
    }

    // Post an event from your TMC to share with other centers
    public async Task<string> CreateEventAsync(TrafficEvent evt)
    {
        var json = JsonSerializer.Serialize(evt);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync("/api/events", content);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadAsStringAsync();
        return result;
    }
}

// Usage in your TMC software
var client = new CorridorCommunicatorClient(
    "https://corridor-api.example.com",
    "your-api-key-here"
);

// Display events on your TMC map
var events = await client.GetEventsAsync("IA");
foreach (var evt in events)
{
    DisplayOnTMCMap(evt);
}

// Share an incident from your TMC
await client.CreateEventAsync(new TrafficEvent
{
    Type = "incident",
    State = "IA",
    Description = "Multi-vehicle accident on I-80",
    Location = new Location { Latitude = 41.5868, Longitude = -93.6250 },
    Severity = "major"
});
```

### Example 2: Java Integration for Enterprise TMC Systems

```java
// Java client for enterprise TMC platforms
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.fasterxml.jackson.databind.ObjectMapper;

public class CorridorCommunicatorService {
    private final HttpClient httpClient;
    private final String baseUrl;
    private final String apiKey;
    private final ObjectMapper mapper;

    public CorridorCommunicatorService(String baseUrl, String apiKey) {
        this.httpClient = HttpClient.newHttpClient();
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.mapper = new ObjectMapper();
    }

    public List<TrafficEvent> getEvents(String state) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/events?state=" + state))
            .header("Authorization", "Bearer " + apiKey)
            .GET()
            .build();

        HttpResponse<String> response = httpClient.send(
            request,
            HttpResponse.BodyHandlers.ofString()
        );

        EventsResponse result = mapper.readValue(
            response.body(),
            EventsResponse.class
        );

        return result.getEvents();
    }

    // WebSocket connection for real-time updates
    public void subscribeToUpdates(Consumer<TrafficEvent> onEvent) {
        WebSocketClient client = new WebSocketClient(
            URI.create(baseUrl.replace("https", "wss") + "/ws?apiKey=" + apiKey)
        ) {
            @Override
            public void onMessage(String message) {
                TrafficEvent event = mapper.readValue(message, TrafficEvent.class);
                onEvent.accept(event);
            }
        };

        client.connect();
    }
}

// Usage in your enterprise TMC system
CorridorCommunicatorService corridor = new CorridorCommunicatorService(
    "https://corridor-api.example.com",
    System.getenv("CORRIDOR_API_KEY")
);

// Fetch events every minute
ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
scheduler.scheduleAtFixedRate(() -> {
    try {
        List<TrafficEvent> events = corridor.getEvents("IA");
        updateTMCDisplay(events);
    } catch (Exception e) {
        logger.error("Failed to fetch events", e);
    }
}, 0, 1, TimeUnit.MINUTES);

// Subscribe to real-time updates
corridor.subscribeToUpdates(event -> {
    logger.info("New event: " + event.getDescription());
    displayAlertInTMC(event);
});
```

### Example 3: Python Integration for Analytics/Reporting

```python
# Python client for analytics and reporting systems
import requests
import websocket
import json
from typing import List, Dict, Optional

class CorridorCommunicatorClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def get_events(self, state: Optional[str] = None,
                   event_type: Optional[str] = None) -> List[Dict]:
        """Fetch events with optional filters"""
        params = {}
        if state:
            params['state'] = state
        if event_type:
            params['type'] = event_type

        response = requests.get(
            f'{self.base_url}/api/events',
            headers=self.headers,
            params=params
        )
        response.raise_for_status()

        return response.json()['events']

    def create_event(self, event_data: Dict) -> str:
        """Create a new event"""
        response = requests.post(
            f'{self.base_url}/api/events',
            headers=self.headers,
            json=event_data
        )
        response.raise_for_status()

        return response.json()['id']

    def post_message(self, event_id: str, message: str,
                     author: str) -> None:
        """Post a message about an event"""
        requests.post(
            f'{self.base_url}/api/messages',
            headers=self.headers,
            json={
                'eventId': event_id,
                'message': message,
                'author': author
            }
        )

    def subscribe_to_updates(self, callback):
        """Subscribe to real-time event updates via WebSocket"""
        ws_url = self.base_url.replace('https', 'wss') + \
                 f'/ws?apiKey={self.api_key}'

        def on_message(ws, message):
            event = json.loads(message)
            callback(event)

        ws = websocket.WebSocketApp(
            ws_url,
            on_message=on_message
        )
        ws.run_forever()

# Usage example
client = CorridorCommunicatorClient(
    base_url='https://corridor-api.example.com',
    api_key='your-api-key'
)

# Fetch all incidents in Iowa
incidents = client.get_events(state='IA', event_type='incident')
for incident in incidents:
    print(f"Incident: {incident['description']}")

# Create a new work zone
event_id = client.create_event({
    'type': 'work-zone',
    'state': 'IA',
    'description': 'Bridge maintenance on I-80',
    'location': {
        'latitude': 41.5868,
        'longitude': -93.6250,
        'roadName': 'I-80'
    },
    'startDate': '2026-01-15T06:00:00Z',
    'endDate': '2026-01-15T18:00:00Z'
})

# Post a message about the work zone
client.post_message(
    event_id=event_id,
    message='Expect delays during morning rush hour',
    author='Iowa DOT TMC'
)

# Subscribe to real-time updates
def handle_update(event):
    print(f"New event: {event['description']}")

client.subscribe_to_updates(handle_update)
```

---

## Configuration Reference

### Environment Variables

```bash
# Server Configuration
PORT=3001                          # API server port
NODE_ENV=production               # Environment (development/production)

# Database
DATABASE_URL=postgresql://...     # PostgreSQL connection string
# OR
DATABASE_TYPE=sqlite              # Use embedded SQLite
SQLITE_PATH=./states.db           # SQLite database file

# Authentication
API_KEY_SECRET=random-secret-123  # Secret for API key generation
SESSION_SECRET=random-secret-456  # Session encryption key

# External APIs
OPENAI_API_KEY=sk-...            # For AI features (optional)
SENDGRID_API_KEY=SG.xzy...       # For email notifications (optional)

# Federation (for distributed deployments)
FEDERATION_ENABLED=true
FEDERATION_ENDPOINT=https://national.example.com/sync
FEDERATION_API_KEY=fed_...

# Logging & Monitoring
LOG_LEVEL=info                    # debug, info, warn, error
SENTRY_DSN=https://...@sentry.io  # Error tracking (optional)

# Features
ENABLE_WEBSOCKETS=true
ENABLE_TRUCK_PARKING=true
ENABLE_AI_CONSENSUS=true
```

### config.json

```json
{
  "server": {
    "port": 3001,
    "cors": {
      "enabled": true,
      "origins": ["https://your-tmc.example.com"]
    }
  },
  "database": {
    "type": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "corridor_communicator",
    "pool": {
      "min": 2,
      "max": 10
    }
  },
  "states": {
    "enabled": ["IA", "NE", "IL", "MO", "WI", "MN"],
    "refreshInterval": 300000,
    "customConnectors": [
      {
        "key": "custom-state",
        "name": "Custom State DOT",
        "apiUrl": "https://custom.gov/api",
        "apiType": "WZDx"
      }
    ]
  },
  "messaging": {
    "enabled": true,
    "retentionDays": 90
  },
  "federation": {
    "enabled": true,
    "endpoint": "https://national.example.com/sync",
    "syncInterval": 60000,
    "conflictResolution": "source-priority"
  },
  "security": {
    "apiKeys": {
      "enabled": true,
      "expirationDays": 365
    },
    "rateLimit": {
      "enabled": true,
      "maxRequests": 1000,
      "windowMs": 60000
    }
  }
}
```

---

## Support & Resources

### Getting Started

1. **Read the Documentation**: Start with `docs/ABOUT.md` for system overview
2. **Review API Examples**: See implementation examples above
3. **Test with Sandbox**: Use `https://sandbox-corridor-api.example.com` for testing
4. **Generate API Key**: Contact your system administrator or use the admin panel
5. **Integrate**: Follow the integration method that fits your TMC architecture

### Training Materials

- **Video Tutorial**: [YouTube: Corridor Communicator Integration Guide](#)
- **Sample Code**: `examples/` directory in repository
- **API Documentation**: `https://api-docs.corridor-communicator.example.com`
- **Webinars**: Monthly integration Q&A sessions

### Technical Support

- **Email**: support@corridor-communicator.example.com
- **Slack**: #corridor-communicator-integrations
- **GitHub**: https://github.com/your-org/corridor-communicator/issues
- **Office Hours**: Tuesdays 2-4 PM ET

### Community

- **User Forum**: https://community.corridor-communicator.example.com
- **GitHub Discussions**: Share integration patterns and ask questions
- **Monthly Calls**: First Tuesday of each month, 1 PM ET

---

## Conclusion

The DOT Corridor Communicator provides a **flexible, modular backend** that can be integrated into any traffic management system. Whether you choose cloud hosting, on-premises deployment, or a hybrid approach, the system's standards-based APIs and event-driven architecture make it easy to:

- Share traffic data between TMCs
- Enable center-to-center communication
- Provide real-time updates to operators
- Export data in industry-standard formats
- Scale from single-state to national deployment

By following the integration patterns and examples in this guide, your TMC can become part of a national network of connected traffic management centers, improving situational awareness and coordination across jurisdictions.

---

**Last Updated**: January 12, 2026
**Version**: 1.0
**Maintained By**: DOT Corridor Communicator Team

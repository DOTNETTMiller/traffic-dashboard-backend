# Third-Party Data Provider Plugin System

## Overview

The DOT Corridor Communicator Plugin System allows traffic data providers (Inrix, Here, Waze, TomTom, etc.) to integrate their data feeds and demonstrate their capabilities to state DOTs.

## Architecture

### Key Features

1. **Self-Service Registration**: Providers can register and configure their feeds without manual intervention
2. **Secure API Keys**: Each provider gets a unique API key for data submission
3. **WZDx Standardization**: All plugin data is normalized to WZDx format
4. **Demo Mode**: Providers can showcase their data alongside public DOT feeds
5. **Analytics Dashboard**: Track usage, data quality, and performance metrics
6. **Trial Periods**: Time-limited demos for prospect states

## Data Flow

```
Provider → API Key Auth → WZDx Validation → Normalization → Display
                ↓
        Analytics Tracking
```

## Database Schema

### plugin_providers Table
```sql
CREATE TABLE plugin_providers (
  provider_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_name TEXT NOT NULL UNIQUE,           -- "Inrix", "Here Technologies", etc.
  display_name TEXT NOT NULL,                    -- Branded display name
  api_key TEXT NOT NULL UNIQUE,                  -- Encrypted API key for auth
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  website_url TEXT,
  logo_url TEXT,                                  -- URL to provider logo
  description TEXT,                               -- Brief company description
  data_types JSON,                                -- ["incidents", "speed", "travel_time", "parking"]
  coverage_states JSON,                           -- ["CA", "TX", "NY"]
  status TEXT DEFAULT 'active',                   -- active, suspended, trial
  trial_expires_at TIMESTAMP,                     -- For trial accounts
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settings JSON                                   -- Provider-specific settings
);
```

### plugin_data_feeds Table
```sql
CREATE TABLE plugin_data_feeds (
  feed_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  feed_name TEXT NOT NULL,                        -- "I-80 Corridor Demo"
  feed_type TEXT NOT NULL,                        -- "work_zone", "incident", "traffic_speed"
  state_codes JSON,                                -- ["CA", "NV"] for coverage
  endpoint_url TEXT,                               -- Provider's API endpoint (optional)
  refresh_interval INTEGER DEFAULT 300,            -- Seconds between updates
  is_enabled BOOLEAN DEFAULT 1,
  last_updated TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id)
);
```

### plugin_events Table
```sql
CREATE TABLE plugin_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  feed_id INTEGER,
  event_data JSON NOT NULL,                       -- Full WZDx event data
  event_type TEXT,                                 -- "work_zone", "incident", etc.
  state_code TEXT,
  latitude REAL,
  longitude REAL,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,                            -- Auto-cleanup old data
  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id),
  FOREIGN KEY (feed_id) REFERENCES plugin_data_feeds(feed_id)
);
```

### plugin_analytics Table
```sql
CREATE TABLE plugin_analytics (
  analytics_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  metric_type TEXT NOT NULL,                      -- "api_calls", "events_submitted", "data_quality_score"
  metric_value REAL NOT NULL,
  state_code TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,                                   -- Additional context
  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id)
);
```

### plugin_access_tokens Table
```sql
CREATE TABLE plugin_access_tokens (
  token_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  access_token TEXT NOT NULL UNIQUE,
  token_type TEXT DEFAULT 'api_key',               -- api_key, oauth, jwt
  scopes JSON,                                      -- ["read", "write", "analytics"]
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT 1,
  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id)
);
```

## API Endpoints

### Provider Registration

#### POST /api/plugins/register
Register a new data provider.

**Request:**
```json
{
  "provider_name": "inrix",
  "display_name": "Inrix",
  "contact_email": "partnerships@inrix.com",
  "contact_name": "Jane Doe",
  "website_url": "https://inrix.com",
  "logo_url": "https://inrix.com/logo.png",
  "description": "Real-time traffic intelligence for 50+ countries",
  "data_types": ["incidents", "speed", "travel_time"],
  "coverage_states": ["CA", "TX", "NY", "FL"]
}
```

**Response:**
```json
{
  "success": true,
  "provider_id": 1,
  "api_key": "inrix_live_abc123xyz789",
  "message": "Provider registered successfully"
}
```

### Data Submission

#### POST /api/plugins/events
Submit traffic events (WZDx format).

**Headers:**
```
Authorization: Bearer inrix_live_abc123xyz789
Content-Type: application/json
```

**Request:**
```json
{
  "feed_id": 1,
  "events": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[-121.4944, 38.5816], [-121.4894, 38.5886]]
      },
      "properties": {
        "core_details": {
          "event_type": "incident",
          "data_source_id": "inrix-ca-001",
          "road_names": ["I-80"],
          "direction": "eastbound"
        },
        "start_date": "2024-12-16T10:00:00Z",
        "end_date": "2024-12-16T12:00:00Z",
        "is_start_date_verified": true,
        "is_end_date_verified": false,
        "location_method": "channel-device-method",
        "vehicle_impact": "some-lanes-closed"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "events_created": 1,
  "errors": []
}
```

#### GET /api/plugins/events
Retrieve plugin events (with optional filters).

**Query Parameters:**
- `provider_id` - Filter by provider
- `state` - Filter by state code
- `start_date` - ISO timestamp
- `end_date` - ISO timestamp
- `event_type` - work_zone, incident, etc.

**Response:**
```json
{
  "events": [...],
  "total": 150,
  "page": 1,
  "provider_info": {
    "provider_name": "inrix",
    "display_name": "Inrix",
    "logo_url": "https://inrix.com/logo.png"
  }
}
```

### Analytics

#### GET /api/plugins/analytics/:provider_id
Get analytics for a provider.

**Response:**
```json
{
  "provider_id": 1,
  "provider_name": "inrix",
  "metrics": {
    "total_events": 15420,
    "events_last_24h": 342,
    "api_calls_today": 87,
    "data_quality_score": 94.5,
    "coverage_states": ["CA", "TX", "NY"],
    "average_latency_ms": 125
  },
  "by_state": [
    {
      "state_code": "CA",
      "events": 8500,
      "quality_score": 96.2
    }
  ]
}
```

## Authentication

### API Key Format
```
{provider}_live_{random_hash}
Example: inrix_live_a1b2c3d4e5f6
```

### Security Features
- All API keys are encrypted at rest
- Rate limiting: 1000 requests/hour per provider
- IP whitelisting available for enterprise providers
- OAuth 2.0 support for advanced integrations

## Integration Examples

### Inrix Integration
```javascript
const axios = require('axios');

const INRIX_API_KEY = 'inrix_live_abc123';
const DOT_COMM_API = 'https://corridor-comm.example.com';

async function submitInrixData() {
  const events = await fetchInrixIncidents(); // Get from Inrix API

  const wzdzEvents = events.map(incident => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: incident.geometry.coordinates
    },
    properties: {
      core_details: {
        event_type: 'incident',
        data_source_id: `inrix-${incident.id}`,
        road_names: incident.roads,
        direction: incident.direction
      },
      start_date: incident.startTime,
      end_date: incident.estimatedEnd,
      is_start_date_verified: true,
      vehicle_impact: mapInrixSeverity(incident.severity)
    }
  }));

  await axios.post(`${DOT_COMM_API}/api/plugins/events`, {
    feed_id: 1,
    events: wzdzEvents
  }, {
    headers: {
      'Authorization': `Bearer ${INRIX_API_KEY}`
    }
  });
}
```

### Here Technologies Integration
```python
import requests

HERE_API_KEY = "here_live_xyz789"
DOT_COMM_API = "https://corridor-comm.example.com"

def submit_here_traffic_data():
    # Fetch from Here Traffic API
    traffic_data = fetch_here_traffic_flow()

    # Convert to WZDx
    wzdx_events = convert_to_wzdx(traffic_data)

    # Submit to DOT Corridor Communicator
    response = requests.post(
        f"{DOT_COMM_API}/api/plugins/events",
        json={"feed_id": 2, "events": wzdx_events},
        headers={"Authorization": f"Bearer {HERE_API_KEY}"}
    )

    return response.json()
```

## UI Components

### Provider Badge
Display on map markers and event cards:

```
┌──────────────────────┐
│ 🏢 Powered by Inrix │
└──────────────────────┘
```

### Provider Filter
Add filter option in sidebar:

```
Data Sources:
☑ State DOTs (40)
☑ Inrix (150)
☐ Here Technologies (89)
☐ Waze (45)
```

### Provider Showcase Page
`/providers` route showing:
- Provider logos and descriptions
- Coverage maps
- Sample data quality metrics
- Contact information for demos

## Trial Management

### Trial Period Features
- 30-day default trial period
- Limited to 1,000 events/day
- Automatic expiration with email notification
- Upgrade path to full access

### Conversion Tracking
```sql
-- Track which states are interested in which providers
CREATE TABLE plugin_provider_interests (
  interest_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  state_code TEXT NOT NULL,
  contact_email TEXT,
  status TEXT DEFAULT 'interested',  -- interested, demo_requested, contract_signed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id)
);
```

## Data Quality Monitoring

### Automated Checks
1. **WZDx Compliance**: Validate against WZDx schema
2. **Temporal Accuracy**: Track start/end time accuracy
3. **Spatial Accuracy**: Verify coordinates are valid
4. **Completeness**: Check for required fields
5. **Freshness**: Monitor data update frequency

### Quality Score Calculation
```
Quality Score = (
  wzd_compliance * 0.3 +
  temporal_accuracy * 0.25 +
  spatial_accuracy * 0.25 +
  completeness * 0.15 +
  freshness * 0.05
) * 100
```

## Business Model

### Revenue Opportunities
1. **Listing Fees**: $500/month for provider listing
2. **Premium Placement**: Featured provider spots
3. **Analytics Access**: Charge providers for detailed usage analytics
4. **Lead Generation**: Charge per state DOT introduction
5. **White Label**: Custom branding for enterprise providers

### Value Proposition for Providers
- Access to 50+ state DOT decision makers
- Standardized WZDx integration (build once, deploy everywhere)
- Analytics on data quality and engagement
- Competitive comparison metrics
- Direct sales pipeline to transportation agencies

### Value Proposition for State DOTs
- Compare multiple providers side-by-side
- Free trial access to commercial data
- Standardized data format (WZDx)
- Vendor-neutral platform
- Data quality metrics for procurement decisions

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- ✅ Database schema
- ✅ API endpoint structure
- ✅ Authentication system
- ✅ Basic UI components

### Phase 2: Provider Onboarding (Weeks 3-4)
- Registration portal
- API key management
- Documentation site
- Integration testing

### Phase 3: Analytics & Monitoring (Weeks 5-6)
- Data quality scoring
- Analytics dashboard
- Usage tracking
- Alerting system

### Phase 4: Marketplace (Weeks 7-8)
- Provider showcase page
- Trial management
- Lead generation
- Billing integration

## Success Metrics

### Technical Metrics
- API uptime: >99.9%
- Average latency: <200ms
- Data validation accuracy: >98%

### Business Metrics
- Number of registered providers: Target 10+ in Year 1
- Number of trial activations: Target 50+ in Year 1
- Provider-to-DOT introductions: Target 100+ in Year 1
- Conversion rate (trial to contract): Target >20%

## Security & Compliance

### Data Privacy
- No PII in traffic data
- GDPR compliance for provider contact info
- Data retention policies (90 days default)

### API Security
- Rate limiting (1000 req/hour)
- IP whitelisting
- Request signing for sensitive operations
- Audit logging for all data submissions

## Support & Documentation

### Developer Portal
- Interactive API documentation (Swagger/OpenAPI)
- Code examples in 5+ languages
- WZDx validation tools
- Sandbox environment for testing

### Provider Support
- Dedicated Slack channel
- Weekly office hours
- Integration assistance
- Data quality consulting

## Future Enhancements

1. **Real-time WebSocket Feeds**: Push updates to dashboard
2. **Machine Learning Quality Scoring**: AI-based anomaly detection
3. **Multi-modal Data**: Support transit, bike, pedestrian data
4. **Federated Identity**: SSO with transportation industry credentials
5. **Blockchain Verification**: Tamper-proof data provenance tracking

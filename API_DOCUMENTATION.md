# DOT Corridor Communicator API Documentation

**Base URL (Production):** `https://corridor-communication-dashboard-production.up.railway.app`

**Version:** 1.0
**Last Updated:** 2026-01-19

## Table of Contents

- [Authentication](#authentication)
- [Events & Traffic Information](#events--traffic-information)
- [Data Quality & Analytics](#data-quality--analytics)
- [User Management](#user-management)
- [State-to-State Messaging](#state-to-state-messaging)
- [ITS Equipment & Infrastructure](#its-equipment--infrastructure)
- [Grant Management](#grant-management)
- [Truck Parking & Predictions](#truck-parking--predictions)
- [Admin Endpoints](#admin-endpoints)
- [Additional Categories](#additional-categories)

---

## Authentication

Most endpoints support three authentication methods:

### 1. JWT Token (User Authentication)
```http
Authorization: Bearer <jwt_token>
```

### 2. State Password
```http
X-State-Auth: <stateKey>
X-State-Password: <password>
```

### 3. API Key (Plugins/External)
```http
X-API-Key: <api_key>
```

---

## Events & Traffic Information

### Get All Events
```http
GET /api/events
```
**Query Parameters:**
- `state` (optional) - Filter by state key

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-01-19T12:00:00Z",
  "totalEvents": 1500,
  "events": [...],
  "errors": []
}
```

### Get State-Specific Events
```http
GET /api/events/:state
```
**Path Parameters:**
- `state` - State key (e.g., 'iowa', 'ohio', 'ca')

**Response:** Deduplicated events with validated coordinates

### Get Event Comments
```http
GET /api/events/:eventId/comments
```

### Post Event Comment
```http
POST /api/events/:eventId/comments
```
**Auth:** Required (User or State)
**Body:**
```json
{
  "comment": "Bridge clearance issue confirmed"
}
```

---

## Data Quality & Analytics

### Get Data Quality Summary
```http
GET /api/data-quality/summary
```
**Response:**
```json
{
  "success": true,
  "feeds": [...],
  "summary": {
    "total_feeds": 45,
    "avg_dqi": 85.2,
    "grade_distribution": {...}
  }
}
```

### Get Vendor Leaderboard
```http
GET /api/data-quality/leaderboard
```
**Response:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "provider_name": "INRIX",
      "avg_dqi": 89.5,
      "letter_grade": "A-",
      "total_feeds": 12,
      "badges": [...]
    }
  ],
  "summary": {
    "total_providers": 8,
    "avg_market_dqi": 83.7
  }
}
```

### Get Gap Analysis
```http
GET /api/data-quality/gap-analysis
```
**Query Parameters:**
- `provider` (optional) - Filter by provider name
- `maxDQI` (optional) - Show feeds below this DQI score

**Response:**
```json
{
  "success": true,
  "feeds": [
    {
      "feed_id": "inrix_tt_i80",
      "provider_name": "INRIX",
      "corridor_name": "I-80 Iowa",
      "current_dqi": 85,
      "max_potential_dqi": 92,
      "gaps": [
        {
          "field": "accuracy",
          "priority": "high",
          "currentScore": 80,
          "targetScore": 90,
          "gap": 10,
          "potentialDQIIncrease": 2.0,
          "recommendation": "..."
        }
      ]
    }
  ]
}
```

### Get Coverage Gap Analysis
```http
GET /api/data-quality/coverage-gaps
```
**Response:**
```json
{
  "success": true,
  "total_corridors": 26,
  "corridors_with_gaps": 24,
  "corridors": [
    {
      "corridor_id": "I80_IA",
      "corridor_name": "I-80 Iowa Segment",
      "opportunity_score": 42,
      "current_state": {
        "vendor_count": "4",
        "avg_dqi": 81.1
      },
      "gaps": [...],
      "opportunities": [...]
    }
  ],
  "summary": {
    "critical_gaps": 8,
    "high_priority": 10,
    "moderate_priority": 6,
    "low_priority": 2
  }
}
```

### Get Corridor Quality Metrics
```http
GET /api/data-quality/corridor/:corridorId
```
**Query Parameters:**
- `minGrade` (optional) - Filter by minimum letter grade
- `serviceType` (optional) - Filter by service type

---

## User Management

### Register User
```http
POST /api/users/register
```
**Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securepass123",
  "fullName": "John Doe",
  "organization": "Iowa DOT",
  "stateKey": "iowa"
}
```
**Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {...}
}
```

### Login
```http
POST /api/users/login
```
**Body:**
```json
{
  "username": "john_doe",
  "password": "securepass123"
}
```

### Get Current User
```http
GET /api/users/me
```
**Auth:** Required (JWT)

### Update Profile
```http
PUT /api/users/profile
```
**Auth:** Required (JWT)
**Body:**
```json
{
  "fullName": "John Smith",
  "organization": "Iowa DOT",
  "notifyOnMessages": true,
  "notifyOnHighSeverity": true
}
```

### Change Password
```http
PUT /api/users/password
```
**Auth:** Required (JWT)
**Body:**
```json
{
  "currentPassword": "oldpass",
  "newPassword": "newpass123"
}
```

### Manage State Subscriptions
```http
GET /api/users/subscriptions
PUT /api/users/subscriptions
POST /api/users/subscriptions/:stateKey
DELETE /api/users/subscriptions/:stateKey
```
**Auth:** Required (JWT)

---

## State-to-State Messaging

### State Login
```http
POST /api/states/login
```
**Body:**
```json
{
  "stateKey": "iowa",
  "password": "state_password"
}
```

### Send Message
```http
POST /api/states/messages
```
**Auth:** Required (State or User)
**Body:**
```json
{
  "toState": "ohio",
  "subject": "I-80 Closure Notification",
  "message": "Major incident on I-80...",
  "eventId": "evt_123",
  "priority": "high"
}
```

### Get Inbox
```http
GET /api/states/inbox
```
**Auth:** Required (State)

### Get Sent Messages
```http
GET /api/states/sent
```
**Auth:** Required (State)

### Mark Message as Read
```http
POST /api/states/messages/:id/read
```
**Auth:** Required (State)

### Delete Message
```http
DELETE /api/states/messages/:id
```
**Auth:** Required (State)

---

## ITS Equipment & Infrastructure

### Get ITS Equipment
```http
GET /api/its-equipment
```
**Query Parameters:**
- `state` - Filter by state
- `type` - Filter by equipment type (RSU, camera, DMS, etc.)
- `latitude`, `longitude`, `radius` - Spatial filter
- `limit` - Max results (default 100)

**Response:**
```json
{
  "success": true,
  "count": 150,
  "equipment": [
    {
      "equipment_id": "IA_RSU_001",
      "equipment_type": "RSU",
      "state_key": "iowa",
      "latitude": 41.5868,
      "longitude": -93.6250,
      "status": "operational",
      "standards": ["NTCIP", "SAE J2735"]
    }
  ]
}
```

### Upload ITS Equipment (GIS)
```http
POST /api/its-equipment/upload
```
**Auth:** Optional
**Body:** Multipart form-data
- `gisFile` - Shapefile, GeoJSON, KML, or CSV
- `stateKey` - State identifier
- `uploadedBy` - Username (optional)

**Response:**
```json
{
  "success": true,
  "imported": 145,
  "failed": 5,
  "message": "Equipment imported successfully"
}
```

### Get Equipment Health Status
```http
GET /api/equipment/health
```

### Get Equipment Telemetry
```http
GET /api/equipment/:equipmentId/telemetry
```

### Get Network Topology
```http
GET /api/network/topology
```

### Get V2X Analysis
```http
GET /api/its-equipment/v2x-analysis
```

### Get Compliance Report
```http
GET /api/its-equipment/compliance-report
```
**Query Parameters:**
- `state` (optional)

---

## Grant Management

### Create Grant Application
```http
POST /api/grants/applications
```
**Body:**
```json
{
  "stateKey": "iowa",
  "grantProgram": "SMART",
  "grantYear": "2025",
  "applicationTitle": "Connected Vehicle Infrastructure",
  "projectDescription": "Deploy V2X infrastructure...",
  "requestedAmount": 5000000,
  "matchingFunds": 1250000,
  "totalProjectCost": 6250000,
  "primaryCorridor": "I-80",
  "affectedRoutes": ["I-80", "I-35"],
  "geographicScope": "statewide"
}
```

### Get Grant Applications
```http
GET /api/grants/applications
```
**Query Parameters:**
- `stateKey`, `grantProgram`, `status`, `year`

### Get Specific Application
```http
GET /api/grants/applications/:id
```

### Update Application
```http
PUT /api/grants/applications/:id
```

### Generate Grant Content (AI)
```http
POST /api/grants/generate-content
```
**Body:**
```json
{
  "contentType": "narrative",
  "context": {
    "grantProgram": "SMART",
    "projectFocus": "V2X deployment"
  }
}
```

### Attach ITS Equipment to Application
```http
POST /api/grants/applications/:id/attach-its-equipment
```
**Body:**
```json
{
  "equipmentIds": ["IA_RSU_001", "IA_RSU_002", "IA_CAM_010"]
}
```

### Search Live Grant Opportunities
```http
POST /api/grants/search-live
```
**Body:**
```json
{
  "keywords": "connected vehicles",
  "stateKey": "iowa",
  "deadline": "2025-06-01"
}
```

### Get Grant Recommendations
```http
POST /api/grants/recommend
```
**Body:**
```json
{
  "stateKey": "iowa",
  "corridor": "I-80",
  "focus": "V2X"
}
```

---

## Truck Parking & Predictions

### Get Parking Facilities
```http
GET /api/parking/facilities
```
**Query Parameters:**
- `state` (optional)

### Get Current Availability
```http
GET /api/parking/availability
GET /api/parking/availability/:facilityId
```

### Get Availability History
```http
GET /api/parking/history/:facilityId
```
**Query Parameters:**
- `hours` - Hours of history (default 24)

### Get Parking Predictions
```http
GET /api/parking/predict/:facilityId
GET /api/parking/predict-all
```
**Query Parameters:**
- `time` - ISO timestamp for prediction (optional, defaults to now)

**Response:**
```json
{
  "success": true,
  "prediction": {
    "facility_id": "IA_REST_AREA_80_MM_142",
    "timestamp": "2026-01-19T14:00:00Z",
    "predicted_available": 45,
    "predicted_occupied": 75,
    "confidence": 0.87,
    "prediction_horizon_hours": 2
  }
}
```

### Find Nearby Parking
```http
GET /api/parking/nearby
```
**Query Parameters:**
- `lat`, `lon` - Coordinates
- `radius` - Search radius in km (default 50)
- `minAvailable` - Minimum available spaces

### Submit Ground Truth Observation
```http
POST /api/parking/ground-truth/observations
```
**Body:**
```json
{
  "facilityId": "IA_REST_AREA_80_MM_142",
  "observedSpaces": 48,
  "timestamp": "2026-01-19T12:30:00Z",
  "notes": "Manual count verified"
}
```

### Get Prediction Accuracy
```http
GET /api/parking/ground-truth/accuracy
```

---

## Admin Endpoints

### Generate Report Cards
```http
POST /api/reports/generate/:month
```
**Path Parameters:**
- `month` - Format: YYYY-MM (e.g., "2025-01")

### Get State Report Card
```http
GET /api/reports/:stateCode/:month
```

### Get National Rankings
```http
GET /api/reports/rankings/:month
```

### Manage Users
```http
GET /api/admin/users
POST /api/admin/users
PUT /api/admin/users/:userId
DELETE /api/admin/users/:userId
POST /api/admin/users/:userId/reset-password
```
**Auth:** Required (Admin)

### Manage States
```http
GET /api/admin/states
POST /api/admin/states
PUT /api/admin/states/:stateKey
DELETE /api/admin/states/:stateKey
GET /api/admin/test-state/:stateKey
```
**Auth:** Required (Admin)

### Manage Interchanges
```http
GET /api/admin/interchanges
POST /api/admin/interchanges
PUT /api/admin/interchanges/:id
DELETE /api/admin/interchanges/:id
```
**Auth:** Required (Admin)

### Get Detour Alerts
```http
GET /api/detour-alerts/active
```

### Resolve Detour Alert
```http
POST /api/admin/detour-alerts/:id/resolve
```
**Auth:** Required (Admin)
**Body:**
```json
{
  "note": "Incident cleared, detour no longer needed"
}
```

---

## Additional Categories

### Digital Infrastructure / IFC Models
```http
POST /api/digital-infrastructure/upload
GET /api/digital-infrastructure/models
GET /api/digital-infrastructure/models/:modelId
GET /api/digital-infrastructure/elements/:modelId
GET /api/digital-infrastructure/gaps/:modelId
```

### Corridor Regulations
```http
GET /api/corridor-regulations
GET /api/corridor-briefing/:corridor
GET /api/state-osow-regulations
GET /api/state-osow-regulations/:stateKey
```

### Health & Diagnostics
```http
GET /api/health
GET /api/db-status
GET /api/data-quality/check-postgres
GET /api/data-quality/env-check
```

### Plugin System
```http
POST /api/plugins/register
POST /api/plugins/events
GET /api/plugins/events
GET /api/plugins/providers
```

### Chat Assistant
```http
POST /api/chat
GET /api/chat/history
DELETE /api/chat/history
```

### Vendor Uploads
```http
POST /api/vendors/upload
GET /api/vendors/truck-parking
GET /api/vendors/segment-enrichment
POST /api/vendors/truck-parking/predict/:facilityId
```

---

## Response Format Standards

### Success Response
```json
{
  "success": true,
  "data": {...},
  "timestamp": "2026-01-19T12:00:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error context"
}
```

---

## Rate Limiting

No rate limiting currently enforced. Recommended:
- Public endpoints: 100 req/min
- Authenticated endpoints: 1000 req/min
- Admin endpoints: No limit

---

## CORS Policy

CORS enabled for all origins in development.
Production: Restricted to approved domains.

---

## Pagination

Endpoints supporting pagination use:
- `limit` - Results per page (default varies by endpoint)
- `offset` - Skip N results
- `page` - Page number (some endpoints)

---

## Date/Time Format

All timestamps use ISO 8601 format:
```
2026-01-19T12:00:00Z
```

---

## Support & Contact

**Issues:** https://github.com/DOTNETTMiller/traffic-dashboard-backend/issues
**Base URL:** https://corridor-communication-dashboard-production.up.railway.app

---

## Version History

- **v1.0** (2026-01-19) - Initial comprehensive documentation
  - 200+ endpoints documented
  - Data Quality system with leaderboards
  - Vendor gap analysis
  - Coverage gap analysis
  - Grant management integration
  - Truck parking predictions
  - ITS equipment management

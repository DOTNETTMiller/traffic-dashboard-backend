# ITS CodeHub Integration Summary

## What We Added

Your DOT Corridor Communicator now integrates with the **USDOT ITS JPO CodeHub** - specifically the **Operational Data Environment (ODE)** platform for real-time connected vehicle (V2X) data.

---

## Quick Start

### 1. Initialize the Database

```bash
node scripts/create_v2x_tables.js
```

### 2. Start the Services

```bash
docker-compose up -d
```

This starts:
- **ODE** (port 8080) - Processes V2X messages
- **Kafka** (port 9092) - Message broker
- **Zookeeper** (port 2181) - Kafka coordinator
- **MongoDB** (port 27017) - ODE storage
- **V2X Consumer** - Processes messages and stores to database
- **Backend** (port 3001) - Your existing API with new V2X endpoints
- **ML Service** (port 8001) - Your existing ML service

### 3. Send Test Data

```bash
# Test BSM (vehicle position)
curl -X POST http://localhost:8080/upload/bsm \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "data": {
        "coreData": {
          "id": "TEST001",
          "lat": 41.5868,
          "long": -93.6250,
          "speed": 15.5,
          "heading": 90
        }
      }
    }
  }'

# Test TIM (traveler information)
curl -X POST http://localhost:8080/upload/tim \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "data": {
        "msgId": "TIM001",
        "dataframes": [{
          "frameType": "advisory",
          "startTime": "2025-12-30T10:00:00Z",
          "durationTime": 120,
          "priority": 2,
          "content": "Test advisory message"
        }]
      }
    }
  }'
```

### 4. View the Data

```bash
# Check statistics
curl http://localhost:3001/api/v2x/statistics

# Get BSM messages
curl http://localhost:3001/api/v2x/bsm

# Get active TIM messages
curl http://localhost:3001/api/v2x/tim
```

---

## What Was Created

### Backend Components

1. **docker-compose.yml** (updated)
   - Added ODE, Kafka, Zookeeper, MongoDB services
   - Configured v2x-consumer service

2. **v2x-consumer/** (new)
   - Kafka consumer that processes V2X messages
   - Supports BSM, TIM, SPaT, MAP message types
   - Sends processed data to backend API

3. **routes/v2x.js** (new)
   - API endpoints for V2X data
   - POST endpoints for receiving data from consumer
   - GET endpoints for serving data to frontend

4. **scripts/create_v2x_tables.js** (new)
   - Database schema for V2X messages
   - Tables: v2x_bsm, v2x_tim, v2x_spat, v2x_map, v2x_statistics

### Frontend Components

1. **frontend/src/components/V2XDataViewer.jsx** (new)
   - React component for visualizing V2X data
   - Tabs for BSM, TIM, SPaT, MAP
   - Interactive map with vehicle markers
   - Real-time auto-refresh

2. **frontend/src/components/V2XDataViewer.css** (new)
   - Styling for the V2X viewer component

### Documentation

1. **docs/ITS_CODEHUB_ODE_INTEGRATION.md**
   - Complete integration guide
   - Architecture overview
   - API documentation
   - Troubleshooting guide

---

## New API Endpoints

### V2X Data Endpoints

All mounted at `/api/v2x`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/bsm` | Store Basic Safety Message |
| GET | `/bsm` | Retrieve BSM data |
| GET | `/bsm/heatmap` | Get BSM heatmap data |
| POST | `/tim` | Store Traveler Information Message |
| GET | `/tim` | Retrieve active TIM messages |
| POST | `/spat` | Store Signal Phase and Timing |
| GET | `/spat/:intersectionId` | Get SPaT for intersection |
| POST | `/map` | Store MAP data |
| GET | `/map/:intersectionId` | Get MAP for intersection |
| GET | `/statistics` | Get V2X message statistics |

---

## V2X Message Types Supported

### BSM (Basic Safety Message)
- Real-time vehicle position and movement
- 10 messages per second per vehicle
- Used for vehicle tracking and congestion analysis

### TIM (Traveler Information Message)
- Road advisories and incident alerts
- Construction zone information
- Weather-related warnings

### SPaT (Signal Phase and Timing)
- Traffic signal status
- Countdown timers
- Used for green light optimization

### MAP (Map Data)
- Intersection geometry
- Lane configurations
- Spatial reference data

---

## Architecture Overview

```
┌──────────────────────────────────────────┐
│   DOT Corridor Communicator (Frontend)  │
│          React + Leaflet Maps            │
└────────────────┬─────────────────────────┘
                 │ HTTP GET
                 ▼
┌──────────────────────────────────────────┐
│   Backend API (Express.js)               │
│   - State DOT APIs                       │
│   - V2X Data Endpoints (NEW)             │
│   - Grant Tools                          │
└───┬──────────────────────────────────────┘
    │ SQLite
    ▼
┌──────────────────────────────────────────┐
│   Database                               │
│   - Traffic Events                       │
│   - V2X Messages (NEW)                   │
└──────────────────────────────────────────┘
    ▲
    │ HTTP POST
┌───┴──────────────────────────────────────┐
│   V2X Consumer (Node.js/Kafka)           │
│   - Subscribes to Kafka topics           │
│   - Processes BSM, TIM, SPaT, MAP        │
└───┬──────────────────────────────────────┘
    │ Kafka Subscribe
    ▼
┌──────────────────────────────────────────┐
│   Kafka Message Broker                   │
│   Topics: BSM, TIM, SPaT, MAP            │
└───┬──────────────────────────────────────┘
    │ Kafka Publish
    ▼
┌──────────────────────────────────────────┐
│   USDOT ITS JPO ODE                      │
│   - Decodes ASN.1 V2X messages           │
│   - Publishes to Kafka                   │
└───┬──────────────────────────────────────┘
    │ HTTP POST (upload)
    ▼
┌──────────────────────────────────────────┐
│   RSU / Field Equipment / Test Data      │
│   Sends SAE J2735 V2X messages           │
└──────────────────────────────────────────┘
```

---

## Integration with Existing Features

### JSTAN Compliance

The V2X integration aligns with your existing JSTAN documentation:

- **SAE J2735 messages** - Standard for connected vehicles (already documented in JSTAN guide)
- **CTI Standards** - Connected Transportation Interoperability (referenced in JSTAN_INTEGRATION_GUIDE.md)
- **Multi-state coordination** - V2X data can be shared across corridor states

### Grant Applications

The ODE integration strengthens grant proposals:

- **USDOT ITS JPO alignment** - Uses official federal platform
- **Standards compliance** - SAE J2735, IEEE 1609.2
- **Innovation** - Connected vehicle technology adoption
- **Multi-state benefits** - Corridor-wide V2X deployment

---

## Next Steps

### 1. Add to Frontend Navigation

Update `frontend/src/App.jsx` to add the V2X viewer:

```jsx
import V2XDataViewer from './components/V2XDataViewer';

// Add route
<Route path="/v2x" element={<V2XDataViewer />} />

// Add to navigation menu
<Link to="/v2x">📡 V2X Data</Link>
```

### 2. Connect Real RSU Data

When you have actual roadside equipment:

1. Configure RSU to send messages to ODE endpoint
2. Update ODE environment variables with RSU credentials
3. Messages will automatically flow through the pipeline

### 3. Enhance Visualizations

- Add SPaT countdown timer displays
- Render MAP data as intersection diagrams
- Create BSM heatmaps for speed and congestion
- Add historical analytics

### 4. Multi-State Coordination

- Share ODE endpoints across corridor states
- Aggregate V2X data from multiple state deployments
- Create unified corridor-wide vehicle tracking

---

## Monitoring

### Check Service Health

```bash
# All services
docker-compose ps

# ODE logs
docker-compose logs -f ode

# V2X consumer
docker-compose logs -f v2x-consumer

# Kafka
docker-compose logs -f kafka
```

### Check Data Flow

```bash
# V2X statistics
curl http://localhost:3001/api/v2x/statistics

# Recent BSM messages
curl http://localhost:3001/api/v2x/bsm?limit=5

# Active TIM messages
curl http://localhost:3001/api/v2x/tim?active=true
```

### Monitor Kafka Topics

```bash
# List topics
docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --list

# Watch BSM topic
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic topic.OdeBsmJson \
  --from-beginning
```

---

## Resources

- **Full Documentation**: `docs/ITS_CODEHUB_ODE_INTEGRATION.md`
- **ODE GitHub**: https://github.com/usdot-jpo-ode/jpo-ode
- **ITS CodeHub**: https://www.its.dot.gov/code/
- **SAE J2735**: https://www.sae.org/standards/content/j2735_201603/

---

## Support

For issues or questions:

1. Check `docs/ITS_CODEHUB_ODE_INTEGRATION.md` troubleshooting section
2. Review ODE documentation: https://github.com/usdot-jpo-ode/jpo-ode
3. Check ITS CodeHub issues: https://github.com/usdot-jpo-codehub

---

**Integration Completed:** December 30, 2025
**Version:** 1.0

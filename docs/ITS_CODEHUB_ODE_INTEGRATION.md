# ITS CodeHub ODE Integration Guide

## DOT Corridor Communicator - Connected Vehicle Data Integration

---

## Table of Contents

1. [Overview](#overview)
2. [What is the ODE?](#what-is-the-ode)
3. [Architecture](#architecture)
4. [Installation & Setup](#installation--setup)
5. [V2X Message Types](#v2x-message-types)
6. [API Documentation](#api-documentation)
7. [Frontend Components](#frontend-components)
8. [Data Flow](#data-flow)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Resources](#resources)

---

## Overview

The DOT Corridor Communicator now integrates with the **USDOT ITS JPO Operational Data Environment (ODE)** to ingest, process, and visualize real-time connected vehicle (V2X) data. This integration enables:

- **Real-time vehicle tracking** through Basic Safety Messages (BSM)
- **Traveler information** via TIM messages
- **Traffic signal status** through SPaT messages
- **Intersection geometry** via MAP data

### Key Benefits

✅ **Standards-compliant V2X data** - Uses SAE J2735 message formats
✅ **Real-time processing** - Kafka-based message streaming
✅ **Scalable architecture** - Microservices design with Docker
✅ **Multi-state coordination** - Compatible with ODE deployments across state DOTs
✅ **Grant alignment** - Demonstrates USDOT ITS JPO technology adoption

---

## What is the ODE?

The **Operational Data Environment (ODE)** is a real-time data management system developed by the USDOT ITS Joint Program Office. It serves as a data router that:

- **Ingests** connected vehicle messages from roadside equipment (RSUs)
- **Decodes** ASN.1 encoded V2X messages
- **Validates** message formats and security certificates
- **Publishes** decoded JSON messages to Kafka topics
- **Archives** data for historical analysis

### Supported Message Types

| Message Type | Description | Standard |
|-------------|-------------|----------|
| **BSM** | Basic Safety Message | SAE J2735 |
| **TIM** | Traveler Information Message | SAE J2735 |
| **SPaT** | Signal Phase and Timing | SAE J2735 |
| **MAP** | Intersection Geometry | SAE J2735 |
| **PSM** | Personal Safety Message | SAE J2735 |
| **SSM** | Signal Status Message | SAE J2735 |
| **SRM** | Signal Request Message | SAE J2735 |

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                  DOT Corridor Communicator                   │
│                                                              │
│  ┌────────────┐  ┌─────────────┐  ┌────────────────────┐  │
│  │  Frontend  │  │   Backend   │  │  V2X Consumer      │  │
│  │   React    │──│  Express.js │──│   Node.js/Kafka    │  │
│  └────────────┘  └─────────────┘  └────────────────────┘  │
│                         │                     │             │
└─────────────────────────┼─────────────────────┼─────────────┘
                          │                     │
                ┌─────────┴─────────┐          │
                │   SQLite DB       │          │
                │  (V2X Messages)   │          │
                └───────────────────┘          │
                                               │
┌──────────────────────────────────────────────┼─────────────┐
│              ITS JPO ODE Platform            │             │
│                                              │             │
│  ┌────────┐    ┌────────┐    ┌──────────┐  │             │
│  │  ODE   │───→│ Kafka  │───→│ Topics:  │──┘             │
│  │        │    │ Broker │    │ - BSM    │                │
│  └────────┘    └────────┘    │ - TIM    │                │
│      │              │         │ - SPaT   │                │
│      │              │         │ - MAP    │                │
│      │         ┌────┴────┐   └──────────┘                │
│      │         │ MongoDB │                                │
│      │         └─────────┘                                │
│      │                                                     │
│  ┌───┴──────────────────────────────────────┐            │
│  │  RSU / Field Equipment / Test Data       │            │
│  └──────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────┘
```

### Docker Services

| Service | Image | Purpose | Port |
|---------|-------|---------|------|
| **backend** | Custom Node.js | Main API server | 3001 |
| **v2x-consumer** | Custom Node.js | Kafka message consumer | N/A |
| **ode** | usdotjpoode/jpo-ode | ODE platform | 8080 |
| **kafka** | confluentinc/cp-kafka | Message broker | 9092 |
| **zookeeper** | confluentinc/cp-zookeeper | Kafka coordination | 2181 |
| **mongodb** | mongo:7.0 | ODE data storage | 27017 |

---

## Installation & Setup

### Prerequisites

- Docker 24.0+
- Docker Compose 2.0+
- Node.js 18+ (for local development)
- 4GB+ RAM available for containers

### Quick Start

1. **Clone the repository**

```bash
cd /path/to/DOT\ Corridor\ Communicator
```

2. **Create environment file**

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL=your_database_url

# JWT
JWT_SECRET=your_secret_key

# OpenAI (optional, for AI features)
OPENAI_API_KEY=your_openai_key

# SendGrid (optional, for email)
SENDGRID_API_KEY=your_sendgrid_key

# MongoDB for ODE
MONGO_USERNAME=ode
MONGO_PASSWORD=odepassword

# ODE DDS (optional, for USDOT Situation Data Warehouse)
ODE_DDS_CAS_URL=
ODE_DDS_CAS_USERNAME=
ODE_DDS_CAS_PASSWORD=
```

3. **Initialize the database**

```bash
node scripts/create_v2x_tables.js
```

4. **Build and start services**

```bash
docker-compose up -d
```

5. **Verify services are running**

```bash
docker-compose ps
```

Expected output:
```
NAME                  STATUS              PORTS
backend               Up 30 seconds       0.0.0.0:3001->3001/tcp
v2x-consumer          Up 30 seconds
ode                   Up 30 seconds       0.0.0.0:8080->8080/tcp
kafka                 Up 30 seconds       0.0.0.0:9092->9092/tcp
zookeeper             Up 30 seconds       0.0.0.0:2181->2181/tcp
mongodb               Up 30 seconds       0.0.0.0:27017->27017/tcp
```

6. **Check logs**

```bash
# ODE logs
docker-compose logs -f ode

# V2X consumer logs
docker-compose logs -f v2x-consumer

# Backend logs
docker-compose logs -f backend
```

### Sending Test Data to ODE

The ODE platform accepts V2X messages via HTTP POST. Here's how to send test data:

**Test BSM Message:**

```bash
curl -X POST http://localhost:8080/upload/bsm \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "data": {
        "coreData": {
          "id": "TEST001",
          "lat": 41.5868,
          "long": -93.6250,
          "elev": 291.4,
          "speed": 15.5,
          "heading": 90,
          "accuracy": {
            "semiMajor": 5,
            "semiMinor": 3
          }
        }
      }
    }
  }'
```

**Test TIM Message:**

```bash
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
          "content": "Construction ahead - reduce speed"
        }]
      }
    }
  }'
```

---

## V2X Message Types

### 1. BSM (Basic Safety Message)

**Purpose:** Real-time vehicle position, speed, and heading

**Frequency:** 10 Hz (10 messages per second)

**Use Cases:**
- Vehicle tracking and visualization
- Speed analysis and heatmaps
- Congestion detection
- Probe data for travel times

**Data Fields:**
```javascript
{
  messageType: 'BSM',
  timestamp: '2025-12-30T10:00:00.000Z',
  temporaryId: 'VEHICLE-123',
  latitude: 41.5868,
  longitude: -93.6250,
  elevation: 291.4,
  speed: 15.5,        // m/s
  heading: 90,        // degrees
  accuracy: {
    semiMajor: 5,
    semiMinor: 3
  }
}
```

### 2. TIM (Traveler Information Message)

**Purpose:** Road advisories, incidents, and construction alerts

**Frequency:** Event-driven (when conditions change)

**Use Cases:**
- Active incident alerts
- Construction zone information
- Weather-related advisories
- Dynamic message sign content

**Data Fields:**
```javascript
{
  messageType: 'TIM',
  timestamp: '2025-12-30T10:00:00.000Z',
  msgId: 'TIM-456',
  frameType: 'advisory',
  startTime: '2025-12-30T10:00:00Z',
  durationTime: 120,  // minutes
  priority: 2,        // 1-5 (1 = highest)
  content: 'Construction ahead - reduce speed',
  regions: [...]      // Geographic regions affected
}
```

### 3. SPaT (Signal Phase and Timing)

**Purpose:** Traffic signal status and countdown timers

**Frequency:** 1-10 Hz (varies by intersection)

**Use Cases:**
- Green light optimal speed advisory (GLOSA)
- Red light violation warning
- Pedestrian crossing safety
- Emergency vehicle preemption visualization

**Data Fields:**
```javascript
{
  messageType: 'SPaT',
  timestamp: '2025-12-30T10:00:00.000Z',
  intersectionId: 'INT-789',
  states: [
    {
      signalGroup: 1,
      phase: 'green',
      timeRemaining: 15  // seconds
    },
    {
      signalGroup: 2,
      phase: 'red',
      timeRemaining: 45
    }
  ]
}
```

### 4. MAP (Map Data)

**Purpose:** Intersection geometry and lane configuration

**Frequency:** Infrequent (changes only with infrastructure updates)

**Use Cases:**
- Lane-level navigation
- Intersection conflict zone mapping
- Automated vehicle path planning
- Safety application development

**Data Fields:**
```javascript
{
  messageType: 'MAP',
  timestamp: '2025-12-30T10:00:00.000Z',
  intersectionId: 'INT-789',
  refPoint: {
    lat: 41.5868,
    long: -93.6250
  },
  laneSet: [...]  // Detailed lane geometry
}
```

---

## API Documentation

### V2X Endpoints

All V2X endpoints are mounted at `/api/v2x`

#### POST /api/v2x/bsm

Store a Basic Safety Message

**Request:**
```json
{
  "timestamp": "2025-12-30T10:00:00.000Z",
  "temporaryId": "VEHICLE-123",
  "latitude": 41.5868,
  "longitude": -93.6250,
  "speed": 15.5,
  "heading": 90
}
```

**Response:**
```json
{
  "success": true,
  "message": "BSM stored successfully"
}
```

#### GET /api/v2x/bsm

Retrieve Basic Safety Messages

**Query Parameters:**
- `limit` (optional): Max number of messages (default: 100)
- `since` (optional): ISO timestamp for messages after this time

**Response:**
```json
{
  "success": true,
  "count": 25,
  "messages": [...]
}
```

#### POST /api/v2x/tim

Store a Traveler Information Message

#### GET /api/v2x/tim

Retrieve Traveler Information Messages

**Query Parameters:**
- `limit` (optional): Max number of messages (default: 50)
- `active` (optional): `true` to get only active messages (default: true)

#### GET /api/v2x/spat/:intersectionId

Get latest SPaT data for a specific intersection

#### GET /api/v2x/map/:intersectionId

Get MAP data for a specific intersection

#### GET /api/v2x/statistics

Get V2X message statistics

**Response:**
```json
{
  "success": true,
  "statistics": [
    {
      "message_type": "BSM",
      "count": 15234,
      "last_received": "2025-12-30T10:30:00.000Z",
      "first_received": "2025-12-30T08:00:00.000Z"
    },
    ...
  ]
}
```

#### GET /api/v2x/bsm/heatmap

Get BSM data formatted for heatmap visualization

**Query Parameters:**
- `since` (optional): ISO timestamp
- `limit` (optional): Max points (default: 1000)

**Response:**
```json
{
  "success": true,
  "count": 500,
  "points": [
    {
      "latitude": 41.5868,
      "longitude": -93.6250,
      "speed": 15.5
    },
    ...
  ]
}
```

---

## Frontend Components

### V2XDataViewer Component

The main React component for displaying V2X data is located at:

```
frontend/src/components/V2XDataViewer.jsx
```

**Features:**
- Tab-based interface for different message types
- Real-time auto-refresh (5-second interval)
- Interactive map with vehicle markers
- Statistics dashboard
- Table views for detailed data

**Usage:**

```jsx
import V2XDataViewer from './components/V2XDataViewer';

function App() {
  return (
    <div>
      <V2XDataViewer />
    </div>
  );
}
```

**Adding to Navigation:**

Update `frontend/src/App.jsx`:

```jsx
import V2XDataViewer from './components/V2XDataViewer';

// Add route
<Route path="/v2x" element={<V2XDataViewer />} />

// Add navigation link
<Link to="/v2x">V2X Data</Link>
```

---

## Data Flow

### Message Processing Pipeline

```
1. Field Equipment (RSU) sends V2X message
                ↓
2. ODE receives and decodes ASN.1 message
                ↓
3. ODE publishes JSON to Kafka topic
                ↓
4. V2X Consumer subscribes to Kafka topic
                ↓
5. Consumer processes and validates message
                ↓
6. Consumer POSTs to Backend API endpoint
                ↓
7. Backend stores in SQLite database
                ↓
8. Frontend fetches via GET request
                ↓
9. React component renders visualization
```

### Kafka Topics

The ODE publishes to these Kafka topics:

- `topic.OdeBsmJson` - Basic Safety Messages
- `topic.OdeTimJson` - Traveler Information Messages
- `topic.OdeSpatJson` - Signal Phase and Timing
- `topic.OdeMapJson` - Map Data
- `topic.OdePsmJson` - Personal Safety Messages
- `topic.OdeSsmJson` - Signal Status Messages
- `topic.OdeSrmJson` - Signal Request Messages

---

## Testing

### Unit Tests

```bash
# Test database schema
node scripts/create_v2x_tables.js

# Verify tables created
sqlite3 data/database.sqlite "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'v2x_%';"
```

### Integration Tests

**Test Kafka connectivity:**

```bash
# List Kafka topics
docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --list

# Monitor BSM topic
docker exec -it kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic topic.OdeBsmJson --from-beginning
```

**Test V2X Consumer:**

```bash
# Check consumer logs
docker-compose logs -f v2x-consumer

# Should see:
# ✓ Connected to Kafka broker
# ✓ Subscribed to topic.OdeBsmJson
# ✓ Subscribed to topic.OdeTimJson
# 📡 Listening for V2X messages...
```

**Test Backend API:**

```bash
# Check health
curl http://localhost:3001/api/health

# Get V2X statistics
curl http://localhost:3001/api/v2x/statistics

# Get BSM messages
curl http://localhost:3001/api/v2x/bsm?limit=10
```

---

## Troubleshooting

### ODE not receiving messages

**Issue:** Messages sent to ODE but not appearing in Kafka

**Solution:**
1. Check ODE logs: `docker-compose logs ode`
2. Verify ODE is accepting uploads:
   ```bash
   curl http://localhost:8080/
   ```
3. Check Kafka connectivity:
   ```bash
   docker exec -it ode ping kafka
   ```

### V2X Consumer not processing messages

**Issue:** Messages in Kafka but not reaching database

**Solution:**
1. Check consumer logs: `docker-compose logs v2x-consumer`
2. Verify Kafka broker address:
   ```bash
   docker exec -it v2x-consumer env | grep KAFKA_BROKER
   ```
3. Test backend connectivity:
   ```bash
   docker exec -it v2x-consumer curl http://backend:3001/api/health
   ```

### No data in frontend

**Issue:** V2XDataViewer shows "No data"

**Solution:**
1. Check browser console for API errors
2. Verify backend is running: `curl http://localhost:3001/api/v2x/statistics`
3. Check database has data:
   ```bash
   sqlite3 data/database.sqlite "SELECT COUNT(*) FROM v2x_bsm;"
   ```

### High memory usage

**Issue:** Docker containers using excessive RAM

**Solution:**
1. Reduce Kafka retention:
   Edit `docker-compose.yml`:
   ```yaml
   KAFKA_LOG_RETENTION_HOURS: 24
   KAFKA_LOG_SEGMENT_BYTES: 1073741824
   ```
2. Limit BSM storage:
   ```sql
   DELETE FROM v2x_bsm WHERE timestamp < datetime('now', '-1 hour');
   ```
3. Add to cron for automatic cleanup

---

## Resources

### Official Documentation

- **ITS JPO ODE GitHub**: https://github.com/usdot-jpo-ode/jpo-ode
- **ITS CodeHub**: https://www.its.dot.gov/code/
- **SAE J2735**: https://www.sae.org/standards/content/j2735_201603/
- **USDOT ITS JPO**: https://www.its.dot.gov/

### Related Standards

- **SAE J2735** - Dedicated Short Range Communications (DSRC) Message Set Dictionary
- **IEEE 1609** - Family of Standards for Wireless Access in Vehicular Environments (WAVE)
- **ISO 19091** - Intelligent transport systems - Cooperative ITS - Using V2I and I2V communications

### Community

- **ITS JPO CodeHub Issues**: https://github.com/usdot-jpo-codehub/jpo-ode/issues
- **V2X Community Forum**: https://groups.google.com/g/connected-vehicle
- **AASHTO JSTAN**: https://transportation.org/data/jstan/

### Training

- **ITS Professional Capacity Building (PCB)**: https://www.pcb.its.dot.gov/
- **Connected Vehicle Pilot Deployment Program**: https://www.its.dot.gov/pilots/
- **V2X Hub Documentation**: https://github.com/usdot-jpo-codehub/V2I-Hub

---

## Next Steps

1. **Configure RSU Integration**: Connect actual roadside equipment to send live V2X data
2. **Add SPaT Visualization**: Implement traffic signal countdown timers in frontend
3. **MAP Data Display**: Render intersection geometry on maps
4. **Analytics Dashboard**: Build reports on V2X message statistics
5. **Multi-State Coordination**: Share V2X data across corridor states
6. **Grant Applications**: Leverage V2X deployment for USDOT funding opportunities

---

**Document Version:** 1.0
**Last Updated:** December 30, 2025
**Maintained By:** DOT Corridor Communicator Development Team

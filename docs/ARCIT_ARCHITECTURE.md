# ARC-IT Architecture Implementation

**DOT Corridor Communicator - V2X Sensor Warning System**

This document maps the V2X sensor-to-RSU warning implementation to the official **ARC-IT (Architecture Reference for Cooperative and Intelligent Transportation)** framework maintained by USDOT ITS Joint Program Office.

---

## ARC-IT Service Packages Implemented

### Primary Service Packages

#### **TM22 - Dynamic Roadway Warning**
**Status:** ✅ Implemented

**Description:** Detects potential hazards and provides dynamic warning information to drivers via V2I communication (RSU broadcast).

**Implementation:**
- **Component:** `services/v2x-warning-service.js`
- **Function:** Monitors events and sensors, generates TIM messages, broadcasts to RSUs
- **Triggers:** High-severity events, sensor warnings (ice, low visibility), work zones

**Physical Objects:**
- **Traffic Management Center (TMC):** DOT Corridor Communicator backend
- **Roadside Equipment (RSE):** RSUs connected via ODE
- **Vehicle OBE:** In-vehicle units receiving TIM messages

**Information Flows:**
- `incident information` → RSE
- `roadway information system data` → RSE
- `driver information` ← RSE (to vehicles)

---

#### **WZ05 - Work Zone Traveler Information**
**Status:** ✅ Implemented (Phase 1 Complete)

**Description:** Provides work zone information to travelers via V2I communication.

**Implementation:**
- **Component:** `services/v2x-warning-service.js`, `utils/wzdx-consumer.js`
- **Function:** Consumes WZDx v4.2 feeds, generates work zone TIM messages
- **Integration:** WZDx work zones → TIM → RSU → Vehicles

**Physical Objects:**
- **Work Zone System:** WZDx feeds from state DOTs
- **Traffic Management Center:** Process and distribute work zone data
- **Roadside Equipment:** Broadcast work zone warnings

**Information Flows:**
- `work zone information` → TMC
- `work zone information` → RSE
- `driver information` ← RSE (work zone details to vehicles)

---

#### **TM18 - Roadway Warning**
**Status:** ✅ Implemented

**Description:** Warns drivers of roadway hazards via static and dynamic warning systems.

**Implementation:**
- **Component:** `utils/tim-generator.js`
- **Function:** Generates SAE J2735 TIM messages with ITIS codes and MUTCD sign codes
- **Standards:** SAE J2735, MUTCD, ITIS

**Information Flows:**
- `environmental conditions` → TMC
- `traffic conditions` → TMC
- `roadway warning status` → RSE

---

### Supporting Service Packages

#### **TM01 - Infrastructure-Based Traffic Surveillance**
**Status:** ✅ Already Integrated (35 States)

**Description:** Monitors traffic conditions using sensors and cameras.

**Implementation:**
- **Existing:** Traffic event data from 35 state DOT APIs
- **Integration Point:** Events trigger TIM generation

---

#### **TM08 - Traffic Incident Management System**
**Status:** ✅ Already Integrated

**Description:** Detects, verifies, and manages traffic incidents.

**Implementation:**
- **Existing:** Event detection and management system
- **Integration:** High-severity events trigger V2X warnings

---

#### **WX02 - Weather Information Processing and Distribution**
**Status:** ✅ Ready for Integration

**Description:** Collects and distributes weather information.

**Implementation:**
- **Ready:** RWIS sensor integration framework
- **Component:** `services/v2x-warning-service.processSensorData()`
- **Capability:** Ice, snow, fog, wind warnings → TIM → RSU

**Information Flows:**
- `road weather information` → TMC
- `environmental sensor data` → TMC
- `environmental conditions` → RSE

---

#### **MC08 - Work Zone Safety Monitoring**
**Status:** ⏳ Planned

**Description:** Monitors work zone safety using sensors and worker detection.

**Planned Integration:**
- Worker presence sensors → TIM generation
- Speed enforcement in work zones
- Queue warnings

---

## Physical Architecture Mapping

### Physical Objects

| ARC-IT Physical Object | Implementation | Component |
|------------------------|----------------|-----------|
| **Traffic Management Center** | DOT Corridor Communicator Backend | `backend_proxy_server.js` |
| **Roadside Equipment (RSE)** | State DOT RSUs | Managed via `rsu-manager.js` |
| **Connected Vehicle Roadside Equipment** | V2X-capable RSUs | ODE integration |
| **Roadway Subsystem** | Environmental sensors, traffic detectors | Database: sensor data |
| **Work Zone System** | WZDx v4.2 feeds | `wzdx-consumer.js` |
| **Vehicle OBE** | In-vehicle connected systems | Receives TIM broadcasts |

### Functional Objects

| ARC-IT Functional Object | Implementation | Component |
|-------------------------|----------------|-----------|
| **TMC Incident Detection** | Event processing | Event database, API routes |
| **TMC Incident Dispatch Coordination** | TIM distribution | `v2x-warning-service.js` |
| **Roadway Traffic Information Dissemination** | RSU broadcast management | `rsu-manager.js` |
| **Roadway Environmental Monitoring** | RWIS data collection | Ready for sensor integration |
| **Work Zone Management** | WZDx consumer/producer | `wzdx-consumer.js` |
| **RSE Traffic Monitoring** | RSU status tracking | `rsu_health` table |

---

## Information Flow Implementation

### 1. Incident Information → RSE

**ARC-IT Flow ID:** `incident information`

**Implementation:**
```javascript
Event → v2xWarningService.processHighSeverityEvent()
     → timGenerator.generateTIMFromEvent()
     → rsuManager.depositTIM()
     → ODE → RSU → Vehicle OBE
```

**Trigger:** High-severity event detected (accident, wrong-way driver, etc.)

**Standards:**
- SAE J2735 (TIM message format)
- ITIS codes (standardized warning codes)
- MUTCD (sign codes)

---

### 2. Environmental Sensor Data → RSE

**ARC-IT Flow ID:** `environmental sensor data`, `road weather information`

**Implementation:**
```javascript
RWIS Sensor → v2xWarningService.processSensorData()
           → timGenerator.generateTIMFromSensor()
           → rsuManager.depositTIM()
           → ODE → RSU → Vehicle OBE
```

**Trigger Examples:**
- Pavement temperature ≤ 32°F + moisture = ice warning
- Friction coefficient < 0.4 = slippery warning
- Visibility < 500 feet = low visibility warning
- Wind speed > 40 mph = high wind warning

---

### 3. Work Zone Information → RSE

**ARC-IT Flow ID:** `work zone information`

**Implementation:**
```javascript
WZDx Feed → wzdxConsumer.processFeed()
         → Database (wzdx_work_zones)
         → v2xWarningService.processWorkZone()
         → timGenerator.generateTIMFromWorkZone()
         → rsuManager.broadcastToRSUs()
         → ODE → RSU → Vehicle OBE
```

**Data Source:** State DOT WZDx v4.2 feeds (12 states integrated)

**Standards:**
- WZDx v4.2 (work zone data format)
- SAE J2735 (TIM message)

---

### 4. Driver Information ← RSE

**ARC-IT Flow ID:** `driver information`

**Implementation:**
```
RSU → DSRC/C-V2X Broadcast (5.9 GHz)
   → Vehicle OBE
   → In-vehicle display/HMI
   → Driver notification (visual/audio)
```

**Message Types:**
- TIM (Traveler Information Message)
- SAE J2735 format
- ITIS codes for standardized warnings

---

## Standards Compliance

### SAE J2735 - DSRC Message Set Dictionary
✅ **Implemented:** TIM (Traveler Information Message) generation

**Component:** `utils/tim-generator.js`

**Key Elements:**
- Message structure (msgCnt, timeStamp, packetID)
- Data frames with geographic regions
- ITIS codes for content
- Priority levels (0-7)
- Duration and temporal elements

### ITIS - International Traveler Information Systems Codes
✅ **Implemented:** 40+ standardized warning codes

**Examples:**
- 5889: Ice on roadway
- 5890: Bridge ice
- 513: Road work
- 516: Workers on roadway
- 769: Accident
- 775: Wrong-way driver

### MUTCD - Manual on Uniform Traffic Control Devices
✅ **Implemented:** Sign code mapping

**Examples:**
- W1-6: Incident ahead
- W20-1: Road work
- W8-5: Icy conditions
- W8-15: Low visibility

### WZDx v4.2 - Work Zone Data Exchange
✅ **Implemented:** Full consumer and producer

**Capabilities:**
- Consume feeds from state DOTs
- Validate against WZDx schema
- Export WZDx v4.2 compliant feeds
- Convert work zones to TIM messages

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Traffic Management Center (TMC)              │
│                 DOT Corridor Communicator Backend               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Traffic    │  │  RWIS/ESS    │  │  WZDx Work   │        │
│  │   Events     │  │   Sensors    │  │    Zones     │        │
│  │  (35 States) │  │  (Ready)     │  │  (12 States) │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                 │                 │                  │
│         └─────────────────┼─────────────────┘                  │
│                           │                                    │
│                   ┌───────▼────────┐                          │
│                   │  V2X Warning   │                          │
│                   │    Service     │                          │
│                   └───────┬────────┘                          │
│                           │                                    │
│                   ┌───────▼────────┐                          │
│                   │ TIM Generator  │                          │
│                   │  (SAE J2735)   │                          │
│                   └───────┬────────┘                          │
│                           │                                    │
│                   ┌───────▼────────┐                          │
│                   │  RSU Manager   │                          │
│                   └───────┬────────┘                          │
│                           │                                    │
└───────────────────────────┼────────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  USDOT ITS     │
                    │  JPO ODE       │
                    │  (Middleware)  │
                    └───────┬────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
    │   RSU 1   │    │   RSU 2   │    │   RSU N   │
    │  I-70 MM  │    │  I-25 MM  │    │  US-6 MM  │
    │    145    │    │    203    │    │    52     │
    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
          │                 │                 │
          │  DSRC/C-V2X    │                 │
          │  5.9 GHz       │                 │
          │  Broadcast     │                 │
          │                 │                 │
    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
    │ Vehicle 1 │    │ Vehicle 2 │    │ Vehicle 3 │
    │    OBE    │    │    OBE    │    │    OBE    │
    └───────────┘    └───────────┘    └───────────┘
```

---

## Integration Points

### Existing Infrastructure Leveraged

1. **Traffic Event Data** (35 states)
   - Real-time incident detection
   - Already normalized and stored
   - Ready to trigger TIM generation

2. **Bridge Clearance Database**
   - Over-height vehicle warnings
   - Location-based alerts

3. **Truck Parking (TPIMS)**
   - Parking availability warnings
   - Queue detection

### New Capabilities Added

1. **WZDx v4.2 Integration** ✅
   - 12 state DOT feeds
   - Work zone warnings via V2X

2. **TIM Generation** ✅
   - SAE J2735 compliant
   - ITIS code mapping
   - MUTCD sign codes

3. **RSU Management** ✅
   - Inventory tracking
   - Health monitoring
   - Geospatial targeting

4. **ODE Integration** ✅
   - Message distribution
   - RSU broadcast coordination

---

## Use Cases

### Use Case 1: Ice Warning (TM22, WX02)

**Scenario:** RWIS sensor detects icy conditions on bridge

**Flow:**
1. RWIS sensor: pavement temp 31°F, moisture detected
2. `v2xWarningService.processSensorData()`
3. TIM generated with ITIS codes: 5890 (Bridge Ice), 5893 (Slippery)
4. RSUs within 2 miles identified
5. TIM broadcast via ODE to RSUs
6. Vehicles receive: "ICE ON BRIDGE - REDUCE SPEED"

**ARC-IT Service Packages:** TM22, WX02, TM18

---

### Use Case 2: Work Zone Warning (WZ05, TM22)

**Scenario:** Active work zone with workers present

**Flow:**
1. WZDx feed: workers present, lane closed, I-70 MM 145-150
2. `v2xWarningService.processWorkZone()`
3. TIM generated with ITIS codes: 514 (Road Work Ahead), 516 (Workers on Roadway)
4. RSUs along I-70 MM 140-155 identified
5. TIM broadcast with 2-mile advance warning
6. Vehicles receive: "WORK ZONE AHEAD - WORKERS PRESENT - REDUCE TO 45 MPH"

**ARC-IT Service Packages:** WZ05, TM22, MC08

---

### Use Case 3: Wrong-Way Driver Alert (TM22, TM08)

**Scenario:** Traffic sensor detects wrong-way vehicle

**Flow:**
1. Event system: wrong-way driver detected I-80 EB MM 23
2. High-severity event triggers `processHighSeverityEvent()`
3. TIM generated with ITIS code: 775 (Wrong-Way Driver), priority 7
4. All RSUs within 5 miles identified
5. Emergency broadcast to all RSUs
6. Vehicles receive: "DANGER - WRONG WAY DRIVER AHEAD"

**ARC-IT Service Packages:** TM22, TM08, TM01

---

## Component Summary

| Component | Purpose | ARC-IT Mapping |
|-----------|---------|----------------|
| `tim-generator.js` | Generate SAE J2735 TIM messages | TM18, TM22 functional object |
| `rsu-manager.js` | Manage RSU inventory and broadcasts | RSE management, ODE integration |
| `v2x-warning-service.js` | Event-driven TIM generation | TMC dispatch coordination |
| `wzdx-consumer.js` | Consume WZDx feeds | WZ05 work zone data source |
| `rsu_inventory` table | Track RSU assets | RSE physical object database |
| `tim_broadcast_log` table | Audit TIM broadcasts | Logging and analytics |

---

## Next Steps

### Phase 2A: Sensor Integration (Planned)
- Connect RWIS sensors
- ESS (Environmental Sensor Stations)
- Pavement sensors
- Automated ice/weather warnings

### Phase 2B: RSU Deployment (Infrastructure)
- Deploy RSUs along corridors
- Connect to ODE
- Configure SNMP parameters
- Test broadcasts

### Phase 2C: Enhanced Work Zones (Planned)
- Worker presence detection
- Speed enforcement integration
- Queue warning sensors
- Dynamic lane closure updates

---

## References

- **ARC-IT 10.0:** https://www.arc-it.net/
- **SAE J2735:** DSRC Message Set Dictionary
- **WZDx v4.2:** https://github.com/usdot-jpo-ode/wzdx
- **USDOT ITS JPO ODE:** https://github.com/usdot-jpo-ode/jpo-ode
- **ITIS Codes:** https://www.ite.org/technical-resources/standards/itis/
- **MUTCD:** https://mutcd.fhwa.dot.gov/

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Maintained By:** DOT Corridor Communicator Development Team

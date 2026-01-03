## V2X Sensor-to-RSU Warning System
# Complete Deployment Guide

**Comprehensive guide for deploying the ARC-IT-compliant V2X warning system with sensor integration**

---

## Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [ODE Setup](#ode-setup)
5. [Sensor Configuration](#sensor-configuration)
6. [RSU Deployment](#rsu-deployment)
7. [Testing & Validation](#testing--validation)
8. [Operations & Monitoring](#operations--monitoring)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This system provides automated V2X warnings to connected vehicles based on:
- ✅ **RWIS sensors** - Ice, weather, road conditions
- ✅ **Traffic sensors** - Congestion, incidents
- ✅ **Bridge sensors** - Over-height, ice, flooding
- ✅ **Work zones** - WZDx v4.2 feeds (12 states)
- ✅ **Events** - High-severity incidents (35 states)

**Architecture:**
```
Sensors/Events → DOT Corridor Communicator → ODE → RSUs → Vehicles
```

**Standards:**
- SAE J2735 (TIM messages)
- WZDx v4.2
- ARC-IT service packages
- ITIS codes
- MUTCD sign codes

---

## System Requirements

### Hardware Requirements

**Production Server:**
- CPU: 4+ cores
- RAM: 8GB minimum, 16GB recommended
- Disk: 50GB SSD
- Network: Gigabit Ethernet

**ODE Server:**
- CPU: 4+ cores
- RAM: 16GB minimum
- Disk: 100GB SSD
- Network: Gigabit Ethernet

**RSUs:**
- DSRC (5.9 GHz) or C-V2X capable
- SAE J2735 message support
- SNMP management
- Network connectivity (wired/cellular)

### Software Requirements

- Node.js 20.x or higher
- SQLite 3.x or PostgreSQL 12+
- Docker (for ODE deployment)
- Git

---

## Installation

### Step 1: Clone and Install

```bash
cd /path/to/DOT\ Corridor\ Communicator

# Dependencies already installed via npm install
# Database tables already created

# Create sensor tables
node scripts/create_sensor_tables.js

# Create RSU tables (already done)
node scripts/create_rsu_tables.js
```

### Step 2: Verify Installation

```bash
# Check database tables
sqlite3 states.db ".tables"

# Should see:
# - sensor_inventory
# - rwis_readings
# - traffic_readings
# - bridge_readings
# - sensor_alerts
# - sensor_health
# - rsu_inventory
# - tim_broadcast_log
# - rsu_health
```

---

## ODE Setup

### Option 1: USDOT ITS JPO ODE (Recommended)

**Official ODE:** https://github.com/usdot-jpo-ode/jpo-ode

#### Quick Start with Docker

```bash
# Clone ODE
git clone https://github.com/usdot-jpo-ode/jpo-ode.git
cd jpo-ode

# Start ODE with Docker Compose
docker-compose up -d

# Verify ODE is running
curl http://localhost:8080/tim/count
```

#### Configuration

**1. Environment Variables**

Create `.env` file:
```bash
# ODE Connection
ODE_BASE_URL=http://localhost:8080
ODE_API_KEY=your-api-key-if-required

# Optional: Production ODE
# ODE_BASE_URL=https://your-production-ode.example.com
```

**2. Test Connection**

```bash
# Start DOT Corridor Communicator
npm start

# Check logs - should see:
# ✅ Connected to ODE: http://localhost:8080
```

#### ODE API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `POST /tim` | Deposit TIM messages for RSU broadcast |
| `GET /tim/count` | Health check |
| `GET /tim/query` | Query sent TIMs |

### Option 2: State DOT ODE Instance

If your state DOT has an ODE instance:

```bash
# Contact your state DOT ITS team for:
# - ODE URL
# - API credentials (if required)
# - RSU connection details
# - Network access requirements

# Configure
export ODE_BASE_URL=https://state-dot-ode.example.com
export ODE_API_KEY=provided-api-key
```

### Option 3: Cloud-Based ODE

Deploy ODE to AWS/Azure:

**AWS Deployment:**
```bash
# Use ODE CloudFormation template
# Or deploy via ECS/EKS

# Example CloudFormation:
aws cloudformation create-stack \
  --stack-name ode-production \
  --template-url https://ode-cloudformation.s3.amazonaws.com/ode.template \
  --parameters ParameterKey=VPC,ParameterValue=vpc-xxxxx
```

---

## Sensor Configuration

### RWIS Sensors

#### Step 1: Add RWIS Sensor to Inventory

```sql
INSERT INTO sensor_inventory (
  sensor_id,
  sensor_name,
  sensor_type,
  latitude,
  longitude,
  elevation,
  roadway,
  direction,
  milepost,
  location_description,
  manufacturer,
  model,
  ip_address,
  data_feed_url,
  polling_interval,
  capabilities,
  status,
  owner
) VALUES (
  'RWIS-I70-MM145',
  'I-70 MM 145 Eisenhower Tunnel',
  'rwis',
  39.6783,
  -105.9078,
  11158,
  'I-70',
  'EB',
  145.0,
  'Eisenhower Tunnel East Portal',
  'Vaisala',
  'DST111',
  '10.1.1.50',
  'http://rwis.example.com/api/stations/I70-MM145/current.json',
  300,
  '{"temperature": true, "friction": true, "precipitation": true, "visibility": true}',
  'active',
  'CDOT'
);
```

#### Step 2: Configure Data Feed URL

**Common RWIS Data Formats:**

**Format 1: JSON API**
```json
{
  "station_id": "I70-MM145",
  "timestamp": "2025-12-30T12:00:00Z",
  "air_temperature": 28.5,
  "pavement_temperature": 31.2,
  "pavement_condition": "wet",
  "pavement_friction": 0.35,
  "precipitation_type": "snow",
  "precipitation_rate": 0.2,
  "visibility": 450,
  "wind_speed": 25
}
```

**Format 2: NTCIP 1204 (XML)**
```xml
<station>
  <id>I70-MM145</id>
  <atmospheric>
    <airTemp units="F">28.5</airTemp>
  </atmospheric>
  <pavement>
    <surfaceTemp units="F">31.2</surfaceTemp>
    <condition>wet</condition>
    <friction>0.35</friction>
  </pavement>
</station>
```

**Custom Parser:**

Edit `services/rwis-sensor-service.js` → `parseSensorData()` method to match your format.

#### Step 3: Test Sensor

```bash
# Manual poll
curl -X POST http://localhost:3001/api/sensors/poll

# Check logs
# Should see:
# ✓ RWIS-I70-MM145: 31.2°F, friction: 0.35

# View latest reading
curl http://localhost:3001/api/sensors/readings/rwis/RWIS-I70-MM145
```

### Traffic Sensors

**Similar process - set sensor_type='traffic'**

Example:
```sql
INSERT INTO sensor_inventory (
  sensor_id, sensor_name, sensor_type,
  latitude, longitude, roadway, milepost,
  data_feed_url, status
) VALUES (
  'TRAFFIC-I25-MM200',
  'I-25 MM 200 Loop Detector',
  'traffic',
  39.7392, -104.9903,
  'I-25', 200.0,
  'http://traffic.example.com/api/detectors/I25-MM200.json',
  'active'
);
```

### Bridge Sensors

**Set sensor_type='bridge'**

Example:
```sql
INSERT INTO sensor_inventory (
  sensor_id, sensor_name, sensor_type,
  latitude, longitude, roadway, milepost,
  data_feed_url, status
) VALUES (
  'BRIDGE-US6-CLEAR-CREEK',
  'Clear Creek Bridge Height Monitor',
  'bridge',
  39.7547, -105.2211,
  'US-6', 259.5,
  'http://bridge.example.com/api/sensors/clear-creek.json',
  'active'
);
```

---

## RSU Deployment

### Step 1: Physical Installation

**Location Selection:**
- 500-1000m upstream of hazard zones
- Line-of-sight to roadway
- Power and network access
- Avoid obstructions

**Mounting:**
- Standard: 15-20 feet above roadway
- Ensure 5.9 GHz antenna clearance
- Ground properly
- Weatherproofing

### Step 2: Network Configuration

**RSU Network Setup:**
```bash
# RSU IP configuration
IP: 10.1.1.100
Subnet: 255.255.255.0
Gateway: 10.1.1.1

# SNMP Configuration
Community: public (read)
Community: private (write)
SNMP Version: 2c

# Verify connectivity
ping 10.1.1.100
snmpwalk -v2c -c public 10.1.1.100
```

### Step 3: Add RSU to Inventory

```sql
INSERT INTO rsu_inventory (
  rsu_id,
  serial_number,
  manufacturer,
  model,
  latitude,
  longitude,
  elevation,
  roadway,
  direction,
  milepost,
  location_description,
  ipv4_address,
  mac_address,
  snmp_community,
  rsuid,
  capabilities,
  firmware_version,
  radio_type,
  channel,
  status,
  installation_date,
  owner
) VALUES (
  'RSU-I70-MM145',
  'SN123456789',
  'Commsignia',
  'IRS-350',
  39.6783,
  -105.9078,
  11158,
  'I-70',
  'EB',
  145.0,
  'I-70 Eisenhower Tunnel East',
  '10.1.1.100',
  '00:11:22:33:44:55',
  'private',
  '00000083',
  '{"tim": true, "spat": true, "map": true, "bsm": true}',
  '4.2.1',
  'DSRC',
  178,
  'active',
  '2025-12-30',
  'CDOT'
);
```

### Step 4: Configure ODE → RSU Connection

**In ODE configuration:**
```yaml
# config.yaml
rsus:
  - rsu_id: RSU-I70-MM145
    ipv4_address: 10.1.1.100
    username: admin
    password: your-password
    snmp_community: private
    channel: 178
```

### Step 5: Test RSU Broadcast

```bash
# Send test TIM via ODE
curl -X POST http://localhost:8080/tim \
  -H "Content-Type: application/json" \
  -d @test-tim.json

# Monitor RSU logs
# Verify broadcast on channel 178

# Use OBE/vehicle to verify reception
```

---

## Testing & Validation

### Test 1: Ice Warning (RWIS → V2X)

**Scenario:** RWIS detects ice

```bash
# 1. Insert test RWIS reading
sqlite3 states.db <<EOF
INSERT INTO rwis_readings (
  sensor_id, reading_timestamp,
  air_temperature, pavement_temperature,
  pavement_condition, pavement_friction,
  visibility, wind_speed,
  warning_level
) VALUES (
  'RWIS-I70-MM145', datetime('now'),
  28, 31, 'wet', 0.35,
  600, 15,
  3
);
EOF

# 2. Trigger warning detection
# (Automatic via polling, or manual via API)

# 3. Check sensor alerts
curl http://localhost:3001/api/sensors/alerts

# 4. Verify TIM generated
curl http://localhost:3001/api/v2x/status
# Should show: active_warnings: 1

# 5. Check ODE
curl http://localhost:8080/tim/count
# Should increment

# 6. Check tim_broadcast_log
sqlite3 states.db "SELECT * FROM tim_broadcast_log ORDER BY created_at DESC LIMIT 1"
```

**Expected Result:**
- Alert created in sensor_alerts
- TIM generated with ITIS codes: 5889 (Ice on Roadway), 5893 (Slippery)
- TIM deposited to ODE
- RSU broadcasts on Channel 178
- Vehicles within 2 miles receive warning

### Test 2: Work Zone Warning (WZDx → V2X)

```bash
# Work zones already imported from WZDx feeds

# Trigger work zone broadcast
curl -X POST http://localhost:3001/api/v2x/broadcast/workzones

# Verify TIM for active work zones
sqlite3 states.db "SELECT * FROM tim_broadcast_log WHERE source_type = 'workzone'"
```

### Test 3: Wrong-Way Driver (Event → V2X)

```bash
# Create high-severity event
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Wrong-way driver I-70 Eastbound Mile 145",
    "severity": "critical",
    "latitude": 39.6783,
    "longitude": -105.9078,
    "event_type": "incident"
  }'

# Verify emergency TIM broadcast
# Priority: 7 (highest)
# ITIS Code: 775 (Wrong-Way Driver)
```

---

## Operations & Monitoring

### Dashboard Access

```
http://localhost:3001
```

**Navigation:**
- State Tools → 🌡️ Sensor Monitoring (new)
- State Tools → 🚧 WZDx Work Zones
- State Tools → 🏛️ ITS Architecture

### Key Metrics

**Sensor Health:**
```sql
SELECT sensor_type, status, COUNT(*) as count
FROM sensor_inventory
GROUP BY sensor_type, status;
```

**Active Warnings:**
```sql
SELECT alert_type, severity, COUNT(*) as count
FROM sensor_alerts
WHERE status = 'active'
GROUP BY alert_type, severity;
```

**TIM Broadcast Success Rate:**
```sql
SELECT
  status,
  COUNT(*) as count,
  COUNT(*)*100.0/(SELECT COUNT(*) FROM tim_broadcast_log) as percentage
FROM tim_broadcast_log
WHERE created_at > datetime('now', '-24 hours')
GROUP BY status;
```

### Automated Monitoring

**Sensor polling:** Every 5 minutes
**Work zone updates:** Every 15 minutes
**Event monitoring:** Real-time
**RSU health checks:** Every hour

### Alerting

Configure email alerts for:
- Sensor offline > 30 minutes
- Critical warning level detected
- TIM broadcast failures
- RSU communication errors

---

## Troubleshooting

### Issue: ODE Not Connected

**Symptoms:**
```
⚠️  ODE not connected (connect ECONNREFUSED)
```

**Solutions:**
1. Check ODE is running: `curl http://localhost:8080/tim/count`
2. Verify ODE_BASE_URL environment variable
3. Check network/firewall
4. Review ODE logs: `docker logs ode-ode-1`

### Issue: Sensor Not Reporting

**Symptoms:**
- No recent readings
- last_contact timestamp old

**Solutions:**
1. Check sensor data_feed_url is accessible:
   ```bash
   curl "$(sqlite3 states.db "SELECT data_feed_url FROM sensor_inventory WHERE sensor_id='RWIS-I70-MM145'")"
   ```

2. Verify sensor network connectivity
3. Check sensor power/status lights
4. Review sensor logs

### Issue: TIM Not Broadcasting to RSU

**Symptoms:**
- TIM created
- ODE received TIM
- RSU not broadcasting

**Solutions:**
1. Check RSU network connectivity: `ping 10.1.1.100`
2. Verify SNMP configuration:
   ```bash
   snmpwalk -v2c -c public 10.1.1.100 .1.3.6.1.4.1.1206.4.2.3
   ```

3. Check ODE → RSU configuration
4. Review RSU logs
5. Verify RSU channel configuration (default: 178)

### Issue: No Warnings Generated

**Symptoms:**
- Sensors reporting
- No alerts created

**Solutions:**
1. Check warning thresholds in code
2. Verify sensor data quality
3. Review rwis_readings.warning_level values
4. Check V2X Warning Service status:
   ```bash
   curl http://localhost:3001/api/v2x/status
   ```

---

## Production Checklist

Before going live:

### Infrastructure
- [ ] ODE deployed and tested
- [ ] RSUs installed and configured
- [ ] Network connectivity verified
- [ ] Backup/monitoring configured

### Sensors
- [ ] All sensors registered in inventory
- [ ] Data feeds tested and validated
- [ ] Polling configured
- [ ] Warning thresholds tuned

### V2X System
- [ ] ODE connection tested
- [ ] TIM generation validated
- [ ] RSU broadcasts verified
- [ ] OBE reception confirmed

### Operations
- [ ] Monitoring dashboards configured
- [ ] Alerting enabled
- [ ] Operations team trained
- [ ] Maintenance procedures documented
- [ ] Escalation procedures defined

### Compliance
- [ ] ARC-IT service packages documented
- [ ] SAE J2735 compliance verified
- [ ] ITIS codes validated
- [ ] MUTCD sign codes correct

---

## Support & Resources

**Documentation:**
- ARC-IT: https://www.arc-it.net/
- SAE J2735: https://www.sae.org/standards/content/j2735/
- WZDx: https://github.com/usdot-jpo-ode/wzdx
- USDOT ODE: https://github.com/usdot-jpo-ode/jpo-ode

**USDOT Resources:**
- ITS JPO: https://its.dot.gov/
- Connected Vehicle Pilot: https://www.its.dot.gov/pilots/
- V2X Deployment Resources: https://www.its.dot.gov/v2x/

**System Documentation:**
- `docs/ARCIT_ARCHITECTURE.md` - Complete ARC-IT mapping
- `docs/V2X_DEPLOYMENT_GUIDE.md` - This document
- `README.md` - Project overview

---

**Last Updated:** 2025-12-30
**Version:** 1.0
**Maintained By:** DOT Corridor Communicator Team

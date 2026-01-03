# RSU Testing Guide

**Complete testing procedures for V2X RSU deployment**

---

## Quick Start

```bash
# Run all tests
node scripts/test_rsu.js --all

# Test ODE connection
node scripts/test_rsu.js --test-ode

# Simulate complete sensor → TIM → RSU flow
node scripts/test_rsu.js --simulate
```

---

## Testing Tools

### 1. ODE Connection Test

**Tests:**
- ODE health check (`/tim/count` endpoint)
- TIM deposit API
- Response validation

**Usage:**
```bash
node scripts/test_rsu.js --test-ode
```

**Expected Output:**
```
════════════════════════════════════════════════════════════════
  ODE Communication Test
════════════════════════════════════════════════════════════════

Testing ODE at: http://localhost:8080

Test 1: ODE Health Check
─────────────────────────
✓ ODE is responding
  TIM count: 5

Test 2: Test TIM Deposit
─────────────────────────
✓ TIM deposit successful
  Response status: 200

Test Summary
────────────
✓ ODE connection successful (2/2)
```

**If ODE is not running:**
```bash
# Start ODE first
./scripts/setup_ode.sh

# Verify ODE is ready
curl http://localhost:8080/tim/count
```

---

### 2. RSU Connectivity Test

**Tests:**
- IP reachability
- SNMP configuration
- RSU status and capabilities
- Geographic coordinate validation

**Usage:**
```bash
# Test specific RSU
node scripts/test_rsu.js --connectivity RSU-I70-MM145

# List available RSUs first
sqlite3 states.db "SELECT rsu_id, rsu_name, status FROM rsu_inventory;"
```

**Expected Output:**
```
════════════════════════════════════════════════════════════════
  RSU Connectivity Test
════════════════════════════════════════════════════════════════

Testing RSU: I-70 Eisenhower Tunnel RSU
  ID: RSU-I70-MM145
  Location: 39.6783, -105.9078
  IPv4: 192.168.1.100
  SNMP Community: ***

Test 1: IP Connectivity
────────────────────────
✓ IP is reachable

Test 2: SNMP Configuration
───────────────────────────
✓ SNMP community configured
✓ RSUID configured: 00000083

Test 3: RSU Status
──────────────────
✓ RSU status: active

Test 4: RSU Capabilities
─────────────────────────
✓ Capabilities defined:
  tim: true
  bsm: false
  spat: false

Test 5: Geographic Validity
────────────────────────────
✓ Valid coordinates: 39.6783, -105.9078

Test Summary
────────────
✓ All critical tests passed (5/5)
```

---

### 3. TIM Message Validation

**Tests:**
- SAE J2735 required fields
- Message count range (0-127)
- Data frames structure
- ITIS codes presence
- Geographic regions
- Priority levels (0-7)

**Usage:**
```bash
# Validate specific TIM
node scripts/test_rsu.js --validate-tim TIM-1735574400000-0

# Find recent TIMs first
sqlite3 states.db "SELECT packet_id, created_at FROM tim_broadcast_log ORDER BY created_at DESC LIMIT 5;"
```

**Expected Output:**
```
════════════════════════════════════════════════════════════════
  TIM Message Validation (SAE J2735)
════════════════════════════════════════════════════════════════

Validating TIM: TIM-1735574400000-0
  Created: 2025-12-30T12:00:00Z
  Priority: 6
  Status: success

Validation 1: Required SAE J2735 Fields
────────────────────────────────────────
✓ msgCnt: present
✓ timeStamp: present
✓ packetID: present
✓ dataFrames: present

Validation 2: Message Count
────────────────────────────
✓ msgCnt valid: 42 (0-127)

Validation 3: Data Frames Structure
────────────────────────────────────
✓ dataFrames is array: 1 frame(s)

  Frame 1:
  ✓ frameType: roadSignage
  ✓ priority: 6 (0-7)
  ✓ regions: 1 region(s)
  ✓ content: present
    ✓ advisory: present
    ✓ advisory items: 2

Validation 4: ITIS Codes
─────────────────────────
  ✓ Frame 1: ITIS code 5889
  ✓ Frame 1: ITIS code 516

Validation 5: Geographic Regions
─────────────────────────────────
  ✓ Frame 1, Region 1: Circle (lat: 396783000, lon: -1059078000, radius: 1609m)

Validation Summary
──────────────────
✓ TIM is valid SAE J2735
```

---

### 4. Broadcast Simulation

**Simulates complete sensor → TIM → RSU flow without actual hardware**

**What it does:**
1. Gets test RWIS sensor
2. Creates hazardous conditions data
3. Generates TIM message
4. Finds nearby RSUs
5. Simulates broadcast (dry run)
6. Logs to database

**Usage:**
```bash
node scripts/test_rsu.js --simulate
```

**Expected Output:**
```
════════════════════════════════════════════════════════════════
  Mock RSU Broadcast Simulation
════════════════════════════════════════════════════════════════

Simulating complete sensor → TIM → RSU flow

Step 1: Get Test Sensor
────────────────────────
✓ Using sensor: I-70 Eisenhower Tunnel East

Step 2: Simulate Hazardous Conditions
──────────────────────────────────────
Mock sensor readings:
  air_temperature: 28
  pavement_temperature: 30
  pavement_friction: 0.35
  pavement_condition: wet
  dew_point: 27
  visibility: 800
  wind_speed: 25
  precipitation_type: snow

Step 3: Generate TIM Message
─────────────────────────────
✓ TIM generated successfully
  Packet ID: TIM-1735574400000-42
  Priority: 6
  ITIS Codes: 5889, 1283, 8321

Step 4: Find Nearby RSUs
─────────────────────────
✓ Found 2 nearby RSU(s):
  • I-70 Eisenhower Tunnel RSU (0.25 miles)
  • I-70 Georgetown RSU (3.80 miles)

Step 5: Simulate Broadcast (Dry Run)
─────────────────────────────────────
ℹ This is a simulation - no actual broadcast

Broadcast would include:
  • TIM Packet ID: TIM-1735574400000-42
  • Target RSUs: 2
  • SNMP Channel: 178 (5.9 GHz)
  • Broadcast Mode: Continuous
  • Message Interval: 1 second

Step 6: Log Broadcast (Simulated)
──────────────────────────────────
✓ Broadcast logged to database

Simulation Summary
──────────────────
✓ Complete sensor-to-RSU flow simulated successfully

To test with real ODE:
  1. Ensure ODE is running: ./scripts/setup_ode.sh
  2. Start the application: npm start
  3. Trigger sensor poll: curl -X POST http://localhost:3001/api/sensors/poll
```

---

### 5. Complete System Test

**Runs all tests in sequence**

**Usage:**
```bash
node scripts/test_rsu.js --all
```

**Tests Run:**
1. ODE Connection Test
2. RSU Connectivity Test (first active RSU)
3. TIM Validation (latest TIM)
4. Broadcast Simulation

**Expected Output:**
```
════════════════════════════════════════════════════════════════
  Complete RSU System Test
════════════════════════════════════════════════════════════════

Running all tests...

📡 Testing ODE connection...
[ODE test output...]

📡 Testing RSU connectivity...
[RSU test output...]

📡 Testing TIM validation...
[TIM validation output...]

📡 Running broadcast simulation...
[Simulation output...]

════════════════════════════════════════════════════════════════
  Test Suite Summary
════════════════════════════════════════════════════════════════
✓ ODE Connection
✓ RSU Connectivity
✓ TIM Validation
✓ Broadcast Simulation

Total: 4/4 tests passed
```

---

## Common Testing Scenarios

### Before Field Deployment

```bash
# 1. Verify ODE is running
node scripts/test_rsu.js --test-ode

# 2. Test each RSU
node scripts/test_rsu.js --connectivity RSU-I70-MM145
node scripts/test_rsu.js --connectivity RSU-I70-MM216

# 3. Run simulation to verify TIM generation
node scripts/test_rsu.js --simulate

# 4. Validate TIM format
sqlite3 states.db "SELECT packet_id FROM tim_broadcast_log ORDER BY created_at DESC LIMIT 1;"
node scripts/test_rsu.js --validate-tim <packet-id>
```

---

### After Sensor Configuration

```bash
# 1. Trigger manual sensor poll
curl -X POST http://localhost:3001/api/sensors/poll

# 2. Check if warnings were detected
curl http://localhost:3001/api/sensors/alerts?status=active | jq

# 3. Verify TIM was generated
sqlite3 states.db "SELECT packet_id, created_at, source_type FROM tim_broadcast_log ORDER BY created_at DESC LIMIT 5;"

# 4. Validate latest TIM
node scripts/test_rsu.js --validate-tim <packet-id>
```

---

### Production Health Check

```bash
# Quick health check
node scripts/test_rsu.js --all > health_check_$(date +%Y%m%d).log

# Review results
cat health_check_*.log
```

---

## Troubleshooting

### Issue: ODE Connection Failed

**Symptoms:**
```
✗ ODE not accessible: connect ECONNREFUSED
```

**Solutions:**
```bash
# Check if ODE is running
docker ps | grep ode

# Start ODE if not running
cd ../jpo-ode && docker-compose up -d

# Wait for ODE to be ready (30-60 seconds)
watch curl -s http://localhost:8080/tim/count

# Test again
node scripts/test_rsu.js --test-ode
```

---

### Issue: RSU Not Reachable

**Symptoms:**
```
⚠ IP timeout or connection refused
```

**This is normal if:**
- RSU doesn't have HTTP interface enabled
- RSU is on private network (VPN required)
- RSU is configured but not physically deployed

**Verify RSU configuration:**
```sql
SELECT rsu_id, ipv4_address, snmp_community, status
FROM rsu_inventory
WHERE rsu_id = 'RSU-I70-MM145';
```

---

### Issue: TIM Validation Errors

**Symptoms:**
```
⚠ TIM has 2 error(s):
  • Missing required field: timeStamp
  • Frame 0: invalid priority
```

**Solutions:**
Check TIM generator logic in `utils/tim-generator.js`:
```javascript
// Ensure all required fields are set
return {
  msgCnt: this.getNextMessageCount(),
  timeStamp: this.getJ2735Timestamp(),  // Must be present
  packetID: this.generatePacketID(),
  dataFrames: [{
    priority: 6,  // Must be 0-7
    // ... rest of frame
  }]
};
```

---

### Issue: No RSUs Found in Simulation

**Symptoms:**
```
⚠ No RSUs found within 5 miles
  Would broadcast to default RSU list
```

**Solutions:**
```bash
# Add test RSUs
node scripts/populate_example_rsus.js

# Or add manually
sqlite3 states.db << EOF
INSERT INTO rsu_inventory (rsu_id, rsu_name, latitude, longitude, status)
VALUES ('RSU-TEST-1', 'Test RSU', 39.7392, -104.9903, 'active');
EOF

# Run simulation again
node scripts/test_rsu.js --simulate
```

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: V2X System Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Start ODE
        run: ./scripts/setup_ode.sh local

      - name: Run RSU tests
        run: node scripts/test_rsu.js --all

      - name: Upload test results
        uses: actions/upload-artifact@v2
        with:
          name: test-results
          path: health_check_*.log
```

---

## Manual Testing Checklist

**Pre-Deployment:**
- [ ] ODE connection successful
- [ ] All RSUs pass connectivity test
- [ ] TIM validation passes for all message types
- [ ] Simulation runs successfully

**Post-Deployment:**
- [ ] Sensor polling active
- [ ] Warnings detected correctly
- [ ] TIMs generated with valid SAE J2735 format
- [ ] RSU broadcasts logged
- [ ] No errors in application logs

**Production Monitoring:**
- [ ] Daily health check runs
- [ ] TIM broadcast count increasing
- [ ] No failed RSU broadcasts
- [ ] Sensor readings current (< 10 minutes old)

---

## API Testing with curl

### Test Sensor API

```bash
# Get all sensors
curl http://localhost:3001/api/sensors | jq

# Get active alerts
curl http://localhost:3001/api/sensors/alerts?status=active | jq

# Trigger manual poll
curl -X POST http://localhost:3001/api/sensors/poll

# Get RWIS readings for specific sensor
curl http://localhost:3001/api/sensors/readings/rwis/RWIS-I70-MM145 | jq '.[0]'

# Get dashboard data
curl http://localhost:3001/api/sensors/dashboard | jq
```

---

## Database Queries for Testing

```sql
-- Check recent TIM broadcasts
SELECT
  packet_id,
  priority,
  status,
  rsus_targeted,
  created_at
FROM tim_broadcast_log
ORDER BY created_at DESC
LIMIT 10;

-- Check active warnings
SELECT
  sa.alert_type,
  sa.severity,
  si.sensor_name,
  si.roadway,
  sa.detected_at
FROM sensor_alerts sa
JOIN sensor_inventory si ON sa.sensor_id = si.sensor_id
WHERE sa.status = 'active'
ORDER BY sa.severity DESC;

-- Check RSU health
SELECT
  rsu_id,
  rsu_name,
  last_broadcast_time,
  total_broadcasts,
  status
FROM rsu_health
ORDER BY last_broadcast_time DESC;

-- Check sensor readings (last hour)
SELECT
  sensor_id,
  air_temperature,
  pavement_temperature,
  pavement_friction,
  warning_level,
  reading_timestamp
FROM rwis_readings
WHERE reading_timestamp > datetime('now', '-1 hour')
ORDER BY reading_timestamp DESC;
```

---

## Performance Testing

### Load Test RSU System

```bash
# Generate 100 test TIMs
for i in {1..100}; do
  node scripts/test_rsu.js --simulate
  sleep 1
done

# Check performance
sqlite3 states.db "SELECT COUNT(*) FROM tim_broadcast_log WHERE status = 'success';"
sqlite3 states.db "SELECT COUNT(*) FROM tim_broadcast_log WHERE status = 'error';"

# Calculate success rate
sqlite3 states.db << EOF
SELECT
  ROUND(100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM tim_broadcast_log;
EOF
```

---

**For Support:**
- Review system logs: `npm start` console output
- Check ODE logs: `cd ../jpo-ode && docker-compose logs -f`
- Reference: `docs/V2X_DEPLOYMENT_GUIDE.md`
- Contact: DOT ITS support team

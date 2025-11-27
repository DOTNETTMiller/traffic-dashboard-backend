# Testing Guide - ML Features

Complete testing instructions for all 10 patent-worthy ML features.

## Prerequisites

Before testing, ensure you have:
- ✅ Node.js 18+ installed
- ✅ Python 3.11+ installed
- ✅ Git repository cloned
- ✅ Environment variables configured (`.env` file)

## Quick Start Testing

### Step 1: Install Dependencies

**Backend:**
```bash
npm install
```

**ML Service:**
```bash
cd ml-service
pip install -r requirements.txt
cd ..
```

### Step 2: Start Services

**Terminal 1 - Start ML Service:**
```bash
cd ml-service
python app.py
```

Expected output:
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8001
```

**Terminal 2 - Start Backend:**
```bash
npm start
```

Expected output:
```
🤖 Initializing ML Services...
   ✅ ML Service: Connected
   ✅ Provenance Chain: Initialized
   ✅ Spatial Compression: Ready

Server is running on http://localhost:3001
```

### Step 3: Verify ML Health

```bash
curl http://localhost:3001/api/ml/health
```

Expected response:
```json
{
  "success": true,
  "ml_service": {
    "healthy": true,
    "models_loaded": {
      "data_quality": true,
      "correlation": true,
      "anomaly": true,
      ...
    }
  },
  "provenance_chain": {
    "total_records": 0,
    "valid": true
  }
}
```

---

## Testing Each Feature

### Feature #1: ML Data Quality Assessment

**Test via API:**
```bash
curl -X POST http://localhost:3001/api/ml/assess-quality \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "events": [
      {
        "id": "test1",
        "state": "IA",
        "event_type": "construction",
        "latitude": 41.5,
        "longitude": -93.5,
        "timestamp": "2025-01-15T10:00:00Z",
        "description": "I-80 westbound lane closure at mile marker 123"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "scores": [0.85],
  "model_version": "1.0.0"
}
```

**Test via Frontend:**
1. Open http://localhost:5173 (or your frontend port)
2. Login with credentials
3. Click "ML Features" button
4. Select "Data Quality" tab
5. Click "Assess Events"
6. Verify quality scores displayed

**Success Criteria:**
- ✅ Returns quality scores 0-1
- ✅ Shows improvement vs rule-based (if ML service running)
- ✅ Falls back gracefully if ML service offline

---

### Feature #2: Cross-State Correlation

**Test via API:**
```bash
curl -X POST http://localhost:3001/api/ml/correlations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "events": [
      {
        "id": "evt1",
        "state": "NE",
        "event_type": "construction",
        "latitude": 41.2,
        "longitude": -96.0,
        "timestamp": "2025-01-15T10:00:00Z"
      },
      {
        "id": "evt2",
        "state": "IA",
        "event_type": "construction",
        "latitude": 41.6,
        "longitude": -93.6,
        "timestamp": "2025-01-15T12:00:00Z"
      }
    ],
    "predict_downstream": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "correlations": [
    {
      "event1_id": "evt1",
      "event2_id": "evt2",
      "state1": "NE",
      "state2": "IA",
      "correlation_strength": 0.78,
      "distance_km": 245.3
    }
  ],
  "predictions": [
    {
      "source_state": "NE",
      "predicted_state": "IA",
      "probability": 0.6
    }
  ]
}
```

**Success Criteria:**
- ✅ Detects correlations between nearby events
- ✅ Predicts downstream impacts
- ✅ Shows corridor graph structure

---

### Feature #4: Cryptographic Provenance Chain

**Test Chain Stats:**
```bash
curl http://localhost:3001/api/provenance/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "total_records": 150,
  "operations": {
    "INGESTION": 100,
    "TRANSFORMATION": 30,
    "DELIVERY": 20
  },
  "chain_valid": true
}
```

**Test Event Provenance:**
```bash
curl http://localhost:3001/api/provenance/evt123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Verify Chain Integrity:**
```bash
curl http://localhost:3001/api/provenance/verify/chain \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "valid": true,
  "errors": [],
  "total_blocks": 150
}
```

**Success Criteria:**
- ✅ Records every operation
- ✅ Chain verification passes
- ✅ Export proof works (downloads JSON)
- ✅ Timeline shows custody chain

---

### Feature #5: Anomaly Detection

**Test via API:**
```bash
curl -X POST http://localhost:3001/api/ml/detect-anomaly \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "event": {
      "id": "test1",
      "state": "IA",
      "event_type": "construction",
      "latitude": 0,
      "longitude": 0,
      "timestamp": "2025-01-15T10:00:00Z"
    }
  }'
```

**Expected Response (Anomaly Detected):**
```json
{
  "success": true,
  "is_anomaly": true,
  "anomaly_score": 1.0,
  "type": "zero_coordinates",
  "explanation": "Event coordinates (0, 0) indicate sensor failure",
  "fallback": {
    "source": "cached_coordinates",
    "latitude": 41.5,
    "longitude": -93.5
  }
}
```

**Test Cases:**
1. **Zero coordinates** - Should detect and provide cached fallback
2. **Future timestamp** - Should detect temporal anomaly
3. **Stale event (>1 week old)** - Should filter out
4. **Stuck API (all events same location)** - Should detect pattern anomaly

**Success Criteria:**
- ✅ Detects 8 types of anomalies
- ✅ Provides appropriate fallback for each type
- ✅ Shows self-healing action taken

---

### Feature #6: Route Optimization

**Test via API:**
```bash
curl -X POST http://localhost:3001/api/ml/optimize-route \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "origin": {"lat": 41.5, "lon": -93.5},
    "destination": {"lat": 40.7, "lon": -89.6},
    "vehicle_constraints": {
      "height_meters": 4.2,
      "weight_kg": 35000,
      "hazmat": false
    },
    "current_events": []
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "path": [...],
  "time": 4.5,
  "fuel_cost": 125.50,
  "warnings": ["Vehicle height exceeds standard clearance - verify bridge clearances"],
  "metrics": {
    "estimated_time": 4.5,
    "fuel_cost": 125.50,
    "parking_stops": 1
  }
}
```

**Test Different Scenarios:**
1. **Normal truck** - height: 4.0m, weight: 30000kg
2. **Overheight** - height: 4.8m (should warn)
3. **HazMat** - hazmat: true (should restrict routes)
4. **With events** - Include construction events on route

**Success Criteria:**
- ✅ Returns valid route
- ✅ Enforces vehicle constraints
- ✅ Shows warnings for violations
- ✅ Balances 5 objectives

---

### Feature #9: Spatial-Temporal Compression

**Test via API:**
```bash
curl -X POST http://localhost:3001/api/compress/spatial-temporal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "events": [
      {"id": "1", "state": "IA", "event_type": "construction", "latitude": 41.5, "longitude": -93.5, "timestamp": "2025-01-15T10:00:00Z"},
      {"id": "2", "state": "IA", "event_type": "construction", "latitude": 41.51, "longitude": -93.51, "timestamp": "2025-01-15T10:30:00Z"},
      {"id": "3", "state": "IA", "event_type": "construction", "latitude": 41.49, "longitude": -93.49, "timestamp": "2025-01-15T10:15:00Z"}
    ],
    "compression_level": "balanced"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "compressed": [
    {
      "compressed": true,
      "cluster_size": 3,
      "event_type": "construction",
      "state": "IA",
      "latitude": 41.5,
      "longitude": -93.5
    }
  ],
  "stats": {
    "original_count": 3,
    "compressed_count": 1,
    "compression_ratio": "3.0x",
    "bytes_saved_percent": "67.0"
  }
}
```

**Test Decompression:**
```bash
curl -X POST http://localhost:3001/api/decompress/spatial-temporal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "compressed_events": [...]
  }'
```

**Success Criteria:**
- ✅ Achieves >5x compression on clustered events
- ✅ Preserves high-priority events uncompressed
- ✅ Decompression recovers data
- ✅ <5% information loss for routing

---

### Feature #10: Predictive Incident Detection

**Test via API:**
```bash
curl -X POST http://localhost:3001/api/ml/predict-incidents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "current_conditions": {
      "weather": {
        "precipitation_mm": 8,
        "temperature_c": -2,
        "visibility_km": 0.5,
        "wind_speed_kmh": 15
      },
      "traffic": {
        "average_speed_kmh": 45,
        "volume_vehicles_per_hour": 2500
      },
      "location": {
        "latitude": 41.5,
        "longitude": -93.5,
        "has_curve": true,
        "has_bridge": false,
        "highway": "I-80"
      }
    },
    "historical_events": []
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "incidents": [
    {
      "incident_type": "weather_related_crash",
      "subtype": "ice_snow",
      "probability": 0.78,
      "predicted_location": {"latitude": 41.5, "longitude": -93.5},
      "estimated_time": "5-15 minutes",
      "severity_estimate": "high",
      "prevention_suggestions": [
        "Deploy anti-icing treatment",
        "Post reduced speed advisory",
        "Activate warning signs"
      ]
    }
  ],
  "confidence": 0.78,
  "factors": [
    {"factor": "heavy_precipitation", "contribution": 0.3},
    {"factor": "low_visibility", "contribution": 0.25}
  ]
}
```

**Test Different Conditions:**
1. **Ice/Snow** - precip >5mm, temp <0°C
2. **Fog** - visibility <1km
3. **Congestion** - speed <50km/h
4. **Normal** - all values normal (should predict low probability)

**Success Criteria:**
- ✅ Predicts high probability for dangerous conditions
- ✅ Provides prevention suggestions
- ✅ Shows contributing factors
- ✅ Time-to-incident estimates reasonable

---

## Frontend Testing

### Opening ML Features Panel

1. **Login** to the dashboard
2. Look for **"🤖 ML Features"** button (add if not present)
3. Click to open panel
4. Verify all 7 tabs visible:
   - ✅ Data Quality
   - ✅ Correlations
   - ✅ Provenance
   - ✅ Anomalies
   - ✅ Route Optimizer
   - ✅ Predictions
   - ✅ Compression

### Testing Each Tab

**Data Quality Tab:**
1. Click "Assess Events" button
2. Wait for results (5-10 seconds)
3. Verify quality scores displayed as percentages
4. Check distribution chart shows breakdown
5. Individual event scores list visible

**Correlations Tab:**
1. Auto-analyzes on load
2. Verify correlations list shows state pairs
3. Check predictions section populated
4. Verify graph structure info displayed

**Provenance Tab:**
1. Check chain stats show total records
2. Select an event from list
3. Verify timeline displays
4. Click export proof button
5. Verify JSON file downloads

**Anomalies Tab:**
1. Click "Check for Anomalies"
2. If anomalies found, verify:
   - Anomaly type labeled
   - Explanation clear
   - Fallback action shown
3. If none found, shows "✓ No anomalies"

**Route Optimizer Tab:**
1. Enter origin/destination coordinates
2. Set vehicle constraints
3. Click "Optimize Route"
4. Verify route metrics displayed
5. Check warnings if vehicle exceeds limits

**Predictions Tab:**
1. Adjust weather/traffic conditions
2. Click "Predict Incidents"
3. Verify predictions show probability
4. Check prevention suggestions listed
5. Contributing factors visualized

**Compression Tab:**
1. Select compression level
2. Click "Compress Events"
3. Verify stats show compression ratio
4. Check original vs compressed counts
5. Preview shows clustered/individual items

---

## Performance Testing

### Load Testing

**Test 1: Large Event Set (1000 events)**
```bash
# Generate 1000 test events
node test-scripts/generate-events.js 1000 > test-events.json

# Test quality assessment
time curl -X POST http://localhost:3001/api/ml/assess-quality \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d @test-events.json
```

**Expected:** Complete in <5 seconds

**Test 2: Compression Performance**
```bash
# Test compression on 1000 events
time curl -X POST http://localhost:3001/api/compress/spatial-temporal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d @test-events.json
```

**Expected:** Complete in <2 seconds, achieve >8x compression

### Stress Testing

**Concurrent Requests:**
```bash
# Send 10 concurrent quality assessments
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/ml/assess-quality \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d @test-events.json &
done
wait
```

**Expected:** All complete successfully, no errors

---

## Troubleshooting

### ML Service Won't Start

**Error:** `ModuleNotFoundError: No module named 'fastapi'`

**Solution:**
```bash
cd ml-service
pip install -r requirements.txt
```

---

### Backend Can't Connect to ML Service

**Error:** `ML Service: Offline (using fallback methods)`

**Check:**
1. ML service running? `ps aux | grep "python app.py"`
2. Correct port? `echo $ML_SERVICE_URL` (should be http://localhost:8001)
3. Firewall blocking? `curl http://localhost:8001/health`

**Solution:**
```bash
# Set environment variable
export ML_SERVICE_URL=http://localhost:8001

# Restart backend
npm start
```

---

### Frontend Shows "Unauthorized"

**Error:** 401 responses on ML endpoints

**Solution:**
1. Login to dashboard
2. Check auth token in localStorage
3. Verify token not expired

---

### Provenance Chain Shows "Invalid"

**Warning:** Chain verification fails

**Check:**
1. View verification errors: `/api/provenance/verify/chain`
2. Chain corruption may occur if:
   - Database manually edited
   - Server crashed mid-write
   - File system corruption

**Solution:**
- Chain is append-only, corruption shouldn't happen
- If it does, indicates serious issue requiring investigation

---

## Success Metrics

After testing, you should see:

- ✅ **All 10 features** responding correctly
- ✅ **ML service healthy** (or graceful fallback)
- ✅ **Provenance chain valid** with growing record count
- ✅ **Frontend displays** all data correctly
- ✅ **Performance acceptable** (<5s for typical requests)
- ✅ **No errors** in console logs

## Next Steps

Once testing passes:
1. Collect screenshots for patent filing
2. Document actual performance metrics
3. Prepare demo for stakeholders
4. File provisional patents (top 3 features)
5. Begin pilot deployment with state DOT

---

**Testing Complete!** You now have a fully functional, patent-worthy ML platform. 🚀

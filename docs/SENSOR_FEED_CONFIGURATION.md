# Sensor Feed Configuration Guide

**Complete guide for integrating real-world RWIS, traffic, and bridge sensors**

---

## Common RWIS Data Formats

### Format 1: NTCIP 1204 (XML) - Standard DOT Format

**Example URL:** `http://rwis.example.com/api/station/12345.xml`

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ess-obs>
  <station-id>12345</station-id>
  <observation-time>2025-12-30T12:00:00Z</observation-time>
  <atmospheric>
    <air-temp units="celsius">-2.5</air-temp>
    <dew-point units="celsius">-4.0</dew-point>
    <relative-humidity units="percent">82</relative-humidity>
    <wind-speed units="kph">40</wind-speed>
    <wind-direction units="degrees">270</wind-direction>
    <visibility units="meters">400</visibility>
  </atmospheric>
  <pavement>
    <surface-temp units="celsius">-1.0</surface-temp>
    <subsurface-temp units="celsius">0.5</subsurface-temp>
    <surface-condition>wet-ice</surface-condition>
    <friction-coefficient>0.32</friction-coefficient>
  </pavement>
  <precipitation>
    <type>snow</type>
    <rate units="mm-per-hour">5</rate>
  </precipitation>
</ess-obs>
```

**Parser for RWIS Service:**
```javascript
// Edit services/rwis-sensor-service.js

parseSensorData(rawData, sensor) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(rawData, 'text/xml');

  // Helper to get value with unit conversion
  const getValue = (path, convertToF = false) => {
    const elem = xml.querySelector(path);
    if (!elem) return null;

    let value = parseFloat(elem.textContent);

    // Convert Celsius to Fahrenheit
    if (convertToF && elem.getAttribute('units') === 'celsius') {
      value = (value * 9/5) + 32;
    }

    // Convert KPH to MPH
    if (elem.getAttribute('units') === 'kph') {
      value = value * 0.621371;
    }

    // Convert meters to feet
    if (elem.getAttribute('units') === 'meters') {
      value = value * 3.28084;
    }

    return value;
  };

  return {
    air_temperature: getValue('atmospheric air-temp', true),
    dew_point: getValue('atmospheric dew-point', true),
    relative_humidity: getValue('atmospheric relative-humidity'),

    wind_speed: getValue('atmospheric wind-speed'),
    wind_direction: getValue('atmospheric wind-direction'),
    visibility: getValue('atmospheric visibility'),

    pavement_temperature: getValue('pavement surface-temp', true),
    subsurface_temperature: getValue('pavement subsurface-temp', true),
    pavement_condition: xml.querySelector('pavement surface-condition')?.textContent,
    pavement_friction: getValue('pavement friction-coefficient'),

    precipitation_type: xml.querySelector('precipitation type')?.textContent || 'none',
    precipitation_rate: getValue('precipitation rate') || 0
  };
}
```

---

### Format 2: Vaisala JSON API

**Example URL:** `http://rwis.vaisala.com/api/v1/stations/I70-MM145/observations/latest`

**Response:**
```json
{
  "station_id": "I70-MM145",
  "timestamp": "2025-12-30T12:00:00Z",
  "observations": {
    "air": {
      "temperature_f": 28.5,
      "dew_point_f": 25.2,
      "humidity_percent": 78,
      "pressure_inhg": 29.92
    },
    "surface": {
      "temperature_f": 31.2,
      "condition": "wet",
      "friction": 0.35,
      "ice_thickness_mm": 0,
      "water_depth_mm": 2
    },
    "subsurface": {
      "temperature_f": 33.8,
      "depth_inches": 4
    },
    "precipitation": {
      "type": "snow",
      "rate_in_per_hr": 0.2,
      "accumulation_in": 1.5
    },
    "visibility": {
      "distance_ft": 450,
      "obscuration": "snow"
    },
    "wind": {
      "speed_mph": 25,
      "gust_mph": 35,
      "direction_degrees": 270,
      "direction_cardinal": "W"
    }
  }
}
```

**Parser:**
```javascript
parseSensorData(rawData, sensor) {
  const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
  const obs = data.observations || data;

  return {
    air_temperature: obs.air?.temperature_f,
    dew_point: obs.air?.dew_point_f,
    relative_humidity: obs.air?.humidity_percent,

    pavement_temperature: obs.surface?.temperature_f,
    subsurface_temperature: obs.subsurface?.temperature_f,
    pavement_condition: obs.surface?.condition,
    pavement_friction: obs.surface?.friction,

    precipitation_type: obs.precipitation?.type || 'none',
    precipitation_rate: obs.precipitation?.rate_in_per_hr || 0,

    visibility: obs.visibility?.distance_ft,

    wind_speed: obs.wind?.speed_mph,
    wind_gust: obs.wind?.gust_mph,
    wind_direction: obs.wind?.direction_degrees
  };
}
```

---

### Format 3: METRo (Road Weather Model) JSON

**Example URL:** `http://metro.example.com/api/forecast/I70-MM145`

**Response:**
```json
{
  "header": {
    "station_id": "I70-MM145",
    "valid_time": "2025-12-30T12:00:00Z"
  },
  "roadcast": {
    "air_temperature": {
      "value": -2.5,
      "unit": "celsius"
    },
    "road_temperature": {
      "value": -0.5,
      "unit": "celsius"
    },
    "road_condition": "icy",
    "ice_percent": 45,
    "black_ice_risk": "high",
    "grip": 0.30
  },
  "weather": {
    "precipitation": {
      "type": "freezing_rain",
      "intensity": "light"
    },
    "visibility_m": 500,
    "wind_speed_kph": 35
  }
}
```

---

## Real-World RWIS Vendors

### 1. Vaisala

**Product:** DST111, DST111S, DSC111
**API Type:** REST JSON or XML
**Typical Endpoint:** `https://api.vaisala.com/rwis/v2/stations/{id}/observations`

**Configuration:**
```sql
UPDATE sensor_inventory
SET data_feed_url = 'https://api.vaisala.com/rwis/v2/stations/I70-MM145/observations'
WHERE sensor_id = 'RWIS-I70-MM145';
```

---

### 2. Lufft (OTT HydroMet)

**Product:** IRS31 Pro, MARWIS
**API Type:** REST JSON
**Typical Endpoint:** `http://roadweather.lufft.com/api/stations/{id}/latest`

---

### 3. Campbell Scientific

**Product:** Various RWIS configurations
**Protocol:** HTTP, FTP, or direct datalogger connection
**Format:** CSV, JSON, or XML

**Example CSV Parser:**
```javascript
parseSensorData(rawData, sensor) {
  // CSV format: timestamp,air_temp,surface_temp,friction,visibility
  const lines = rawData.trim().split('\n');
  const headers = lines[0].split(',');
  const values = lines[1].split(',');

  const data = {};
  headers.forEach((header, i) => {
    data[header.trim()] = parseFloat(values[i]);
  });

  return {
    air_temperature: data.air_temp,
    pavement_temperature: data.surface_temp,
    pavement_friction: data.friction,
    visibility: data.visibility
  };
}
```

---

### 4. SSI (Surface Systems Inc.)

**Product:** SCAN Series
**API Type:** HTTP GET with query parameters
**Typical Endpoint:** `http://ess.example.com/cgi-bin/get_ess_data?site=I70-MM145`

---

## Traffic Sensor Formats

### Wavetronix SmartSensor

**Example URL:** `http://traffic.example.com/api/sensors/12345/data`

**Response:**
```json
{
  "sensor_id": "12345",
  "timestamp": "2025-12-30T12:00:00Z",
  "lanes": [
    {
      "lane_number": 1,
      "speed_mph": 65,
      "volume_vph": 520,
      "occupancy_percent": 12,
      "vehicle_class": {
        "cars": 480,
        "trucks": 40
      }
    },
    {
      "lane_number": 2,
      "speed_mph": 68,
      "volume_vph": 580,
      "occupancy_percent": 15,
      "vehicle_class": {
        "cars": 540,
        "trucks": 40
      }
    }
  ],
  "aggregates": {
    "avg_speed_mph": 66.5,
    "total_volume_vph": 1100,
    "avg_occupancy_percent": 13.5
  }
}
```

---

### Sensys Loop Detectors

**Example:** Legacy inductive loops
**Protocol:** Often NTCIP 1202 or proprietary

---

## Bridge Sensor Formats

### Over-Height Detection

**Trigg Sensors:** `http://bridge.example.com/api/sensors/clearance/us6-clearcreek`

**Response:**
```json
{
  "sensor_id": "us6-clearcreek",
  "timestamp": "2025-12-30T12:00:00Z",
  "clearance": {
    "current_height_ft": 13.2,
    "legal_limit_ft": 13.5,
    "warning_threshold_ft": 13.0,
    "over_height_detected": true
  },
  "vehicle": {
    "detected": true,
    "height_ft": 14.2,
    "speed_mph": 45
  },
  "alarm_status": "active"
}
```

---

## Complete Sensor Configuration Example

### Step-by-Step: Colorado I-70 Eisenhower Tunnel RWIS

```sql
-- 1. Update sensor with feed URL
UPDATE sensor_inventory
SET
  data_feed_url = 'http://cdot-rwis.cotrip.org/api/stations/I70-MM145.json',
  polling_interval = 300,  -- 5 minutes
  capabilities = '{"temperature": true, "friction": true, "precipitation": true, "visibility": true, "wind": true}'
WHERE sensor_id = 'RWIS-I70-MM145';

-- 2. Verify configuration
SELECT sensor_id, data_feed_url, polling_interval, status
FROM sensor_inventory
WHERE sensor_id = 'RWIS-I70-MM145';
```

### Test the Feed

```bash
# Test URL accessibility
FEED_URL=$(sqlite3 states.db "SELECT data_feed_url FROM sensor_inventory WHERE sensor_id='RWIS-I70-MM145'" | tr -d '\r')
curl -s "$FEED_URL" | jq .

# Trigger manual poll
curl -X POST http://localhost:3001/api/sensors/poll

# Check reading
curl http://localhost:3001/api/sensors/readings/rwis/RWIS-I70-MM145 | jq '.[0]'
```

---

## Troubleshooting

### Issue: "Connection Refused"

**Cause:** Sensor endpoint not accessible

**Solution:**
```bash
# Test connectivity
curl -v http://sensor-endpoint/api/data

# Check firewall
# Check VPN if sensors are on private network
```

---

### Issue: "Parse Error"

**Cause:** Data format doesn't match parser

**Solution:**
```bash
# Examine raw response
curl -s http://sensor-endpoint/api/data > raw_response.txt
cat raw_response.txt

# Update parser in rwis-sensor-service.js
```

---

### Issue: "No Warnings Generated"

**Cause:** Thresholds not met

**Solution:**
```sql
-- Check readings
SELECT *
FROM rwis_readings
WHERE sensor_id = 'RWIS-I70-MM145'
ORDER BY reading_timestamp DESC
LIMIT 5;

-- Check warning levels
SELECT warning_level, COUNT(*)
FROM rwis_readings
WHERE sensor_id = 'RWIS-I70-MM145'
GROUP BY warning_level;
```

---

## Production Recommendations

### Security
- Use HTTPS for sensor feeds
- API keys in environment variables
- VPN for internal sensors
- Rate limiting on polling

### Reliability
- Implement retry logic (already in code)
- Log failed polls
- Health monitoring
- Backup sensors

### Performance
- Cache recent readings
- Optimize polling intervals
- Database indexes (already created)
- Async processing (already implemented)

---

**For Assistance:**
- Review `services/rwis-sensor-service.js`
- Check logs: `npm start` and watch console
- Test with curl before configuring
- Contact sensor vendor for API documentation

# WZDx Feed Generation Guide

**Generated WZDx v4.2 Feeds for States Without Official Feeds**

---

## Overview

The DOT Corridor Communicator automatically generates **WZDx v4.2 compliant feeds** for states that don't provide official Work Zone Data Exchange feeds. These feeds are publicly accessible and suitable for consumption by:

- Navigation applications (Waze, Google Maps, Apple Maps, HERE)
- Commercial fleet routing systems
- Traveler information systems (511 systems)
- Traffic management centers
- Connected vehicle applications
- Data analytics platforms

---

## Quick Access

### Header Links

Click the **🚧 WZDx** button in the header (next to TIM, CV-TIM, and CIFS) to access the main feed.

### Feed URLs

**Base URL:** `https://[your-production-url]/api/wzdx/feed`

**State-Specific Feeds:**
- Nebraska: `https://[your-production-url]/api/wzdx/feed/NE`
- Nevada: `https://[your-production-url]/api/wzdx/feed/NV`

---

## API Endpoints

### 1. Get All Work Zones

```
GET /api/wzdx/feed
```

**Query Parameters:**
- `state` (string) - Filter by state code (e.g., "NE", "IA", "NV")
- `corridor` (string) - Filter by corridor (e.g., "I-80", "I-35")
- `includeCompleted` (boolean) - Include completed/past events (default: false)
- `format` (string) - Output format: "json" or "geojson" (default: "json")

**Example Requests:**
```bash
# Get all active work zones across all states
curl https://your-domain/api/wzdx/feed

# Get only I-80 work zones
curl https://your-domain/api/wzdx/feed?corridor=I-80

# Get Iowa work zones
curl https://your-domain/api/wzdx/feed?state=IA

# Get Nebraska work zones including completed events
curl https://your-domain/api/wzdx/feed/NE?includeCompleted=true

# Get work zones in GeoJSON format
curl https://your-domain/api/wzdx/feed?format=geojson
```

**Response Format:**
```json
{
  "feed_info": {
    "publisher": "DOT Corridor Communicator",
    "version": "4.2",
    "license": "https://creativecommons.org/publicdomain/zero/1.0/",
    "data_sources": [
      {
        "data_source_id": "corridor-communicator",
        "organization_name": "DOT Corridor Communicator",
        "update_frequency": 60,
        "update_date": "2026-03-12T18:30:00Z"
      }
    ]
  },
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "NE-event-123",
      "properties": {
        "core_details": {
          "data_source_id": "corridor-communicator",
          "event_type": "work-zone",
          "road_names": ["Interstate 80"],
          "direction": "eastbound",
          "name": "Bridge Repair - I-80 EB MM 123",
          "description": "Lane closure for bridge repair work",
          "creation_date": "2026-03-10T08:00:00Z",
          "update_date": "2026-03-12T18:30:00Z"
        },
        "start_date": "2026-03-10T06:00:00Z",
        "end_date": "2026-03-15T18:00:00Z",
        "beginning_accuracy": "estimated",
        "ending_accuracy": "estimated",
        "vehicle_impact": "some-lanes-closed",
        "event_status": "active",
        "reduced_speed_limit_kph": 88
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-96.7142, 40.8136],
          [-96.7012, 40.8145]
        ]
      }
    }
  ]
}
```

---

### 2. Get State-Specific Feed

```
GET /api/wzdx/feed/:state
```

**Path Parameters:**
- `state` (string) - Two-letter state code (e.g., "NE", "NV")

**Example:**
```bash
curl https://your-domain/api/wzdx/feed/NE
```

---

### 3. Get Feed Statistics

```
GET /api/wzdx/stats
```

Returns statistics about generated WZDx feeds.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_events": 145,
    "active_events": 87,
    "states_covered": ["NE", "NV"],
    "event_types": {
      "work-zone": 65,
      "incident": 22
    },
    "last_updated": "2026-03-12T18:30:00Z"
  }
}
```

---

### 4. Validate WZDx Feed

```
POST /api/wzdx/validate
```

Validates a WZDx feed against the v4.2 specification.

**Request Body:**
```json
{
  "feed": {
    "feed_info": { ... },
    "type": "FeatureCollection",
    "features": [ ... ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "version": "4.2",
  "errors": [],
  "warnings": [
    "Optional field 'issuing_organization' not provided"
  ]
}
```

---

## WZDx v4.2 Specification Compliance

### Required Fields (Always Provided)

✅ **Feed Info:**
- Publisher
- Version (4.2)
- License
- Data sources with update frequency

✅ **Core Details:**
- Data source ID
- Event type (work-zone, detour, incident, restriction)
- Road names
- Direction
- Description
- Creation date
- Update date

✅ **Event Properties:**
- Start date
- End date (when available)
- Beginning accuracy
- Ending accuracy
- Vehicle impact
- Event status (active, pending, completed, cancelled)

✅ **Geometry:**
- LineString coordinates (when available)
- Point coordinates (fallback)

### Business Rules Implemented

✅ **Business Rule #1:** All dates/times in UTC with ISO 8601 format
✅ **Business Rule #2:** All geometries in WGS84 coordinate system
✅ **Business Rule #3:** Lane-level data included when available
✅ **Business Rule #4:** Relationships between road events preserved
✅ **Business Rule #5:** Data quality metadata included

---

## Integration Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

async function getWorkZones() {
  try {
    const response = await axios.get('https://your-domain/api/wzdx/feed', {
      params: {
        state: 'NE',
        corridor: 'I-80'
      }
    });

    const workZones = response.data.features;
    console.log(`Found ${workZones.length} work zones`);

    workZones.forEach(wz => {
      console.log(`${wz.properties.core_details.name} - ${wz.properties.vehicle_impact}`);
    });
  } catch (error) {
    console.error('Error fetching work zones:', error.message);
  }
}

getWorkZones();
```

### Python

```python
import requests

def get_work_zones(state='NE', corridor='I-80'):
    url = 'https://your-domain/api/wzdx/feed'
    params = {
        'state': state,
        'corridor': corridor
    }

    response = requests.get(url, params=params)
    response.raise_for_status()

    feed = response.json()
    work_zones = feed['features']

    print(f"Found {len(work_zones)} work zones")

    for wz in work_zones:
        props = wz['properties']
        name = props['core_details']['name']
        impact = props['vehicle_impact']
        print(f"{name} - {impact}")

get_work_zones()
```

### cURL

```bash
# Get Nebraska work zones and save to file
curl -o nebraska_work_zones.json \
  "https://your-domain/api/wzdx/feed/NE"

# Get I-80 work zones across all states
curl "https://your-domain/api/wzdx/feed?corridor=I-80" | jq '.features[].properties.core_details.name'

# Check feed statistics
curl "https://your-domain/api/wzdx/stats" | jq .
```

---

## States Using Generated Feeds

### Nebraska (NE)
- **Reason:** No official WZDx feed in USDOT registry
- **Coverage:** All Nebraska interstate work zones and incidents
- **Feed URL:** `/api/wzdx/feed/NE`

### Nevada (NV)
- **Reason:** No official WZDx feed in USDOT registry
- **Coverage:** All Nevada interstate work zones and incidents
- **Feed URL:** `/api/wzdx/feed/NV`

**Note:** All other states use official WZDx feeds from state DOTs as registered in the USDOT Work Zone Data Feed Registry.

---

## Data Quality & Updates

### Update Frequency
- **Real-time:** Feeds update immediately when events are added/modified in the system
- **Refresh Interval:** Recommended polling interval is 5 minutes
- **Cache-Control:** Responses include appropriate cache headers

### Data Sources
Generated feeds combine data from multiple sources:
- State DOT 511 systems
- Traffic management centers
- Work zone management systems
- Field reports from maintenance crews
- Automated detection systems

### Quality Assurance
- ✅ All events validated before inclusion
- ✅ Duplicate events deduplicated
- ✅ Location accuracy verified
- ✅ Date/time consistency checked
- ✅ WZDx v4.2 schema validation

---

## FAQs

### Q: Why generate WZDx feeds instead of using official ones?

**A:** Nebraska and Nevada do not currently publish official WZDx feeds to the USDOT registry. Our generated feeds provide standardized access to work zone data for these states until official feeds become available.

### Q: Are these feeds compliant with USDOT standards?

**A:** Yes. All generated feeds fully comply with WZDx v4.2 specification and follow USDOT best practices for work zone data exchange.

### Q: Can I use these feeds in production systems?

**A:** Yes. These feeds are production-ready and suitable for integration into navigation systems, fleet routing, and traveler information applications.

### Q: How do I report data quality issues?

**A:** Please contact your DOT Corridor Communicator administrator or file an issue through the appropriate channels.

### Q: Will these feeds be discontinued when official feeds become available?

**A:** Yes. When Nebraska or Nevada publish official WZDx feeds to the USDOT registry, we will transition to consuming and redistributing those feeds instead of generating our own.

---

## Support & Resources

### WZDx Specification
- **Official Spec:** https://github.com/usdot-jpo-ode/wzdx
- **Version:** 4.2
- **Schema:** https://github.com/usdot-jpo-ode/wzdx/blob/main/schemas/4.2

### USDOT Registry
- **Work Zone Data Feed Registry:** https://datahub.transportation.gov/d/69qe-yiui
- **Registry Updates:** Check monthly for new feeds

### Contact
For questions or support with WZDx feed integration:
- **Documentation:** `/docs/digital-infrastructure.md`
- **API Reference:** `/docs/API_DOCUMENTATION.md`

---

**Last Updated:** 2026-03-12
**WZDx Version:** 4.2
**Feed Status:** Active and production-ready

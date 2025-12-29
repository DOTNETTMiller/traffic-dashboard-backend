# NODE Integration Guide
## National Operations Dataset Exchange Implementation

**Version:** 1.0
**Last Updated:** 2025-12-28
**Status:** Production Ready

---

## Table of Contents

1. [What is NODE?](#what-is-node)
2. [Getting Started](#getting-started)
3. [API Authentication](#api-authentication)
4. [Consuming Data (WZDx Feed)](#consuming-data-wzdx-feed)
5. [Contributing Data](#contributing-data)
6. [Data Quality & Provenance](#data-quality--provenance)
7. [Rate Limits & Tiers](#rate-limits--tiers)
8. [Code Examples](#code-examples)
9. [Troubleshooting](#troubleshooting)

---

## What is NODE?

**NODE** (National Operations Dataset Exchange) is a **framework** (not a database) for public and private sector data interaction in transportation operations.

**Key Principles:**
- **Federated architecture** - Data stays distributed, not centralized
- **Bidirectional exchange** - Both consume and contribute
- **Standards-based** - Uses WZDx, TMDD, SAE J2735
- **Public/Private collaboration** - Government agencies + commercial operators

**How the Corridor Communicator Implements NODE:**

| NODE Principle | Our Implementation |
|----------------|-------------------|
| **Data Publishing** | WZDx v4.2 feed at `/api/v1/wzdx` |
| **Data Contribution** | Accept probe data, incidents, parking status |
| **Provenance Tracking** | Confidence scores, source attribution |
| **Quality Assurance** | Validation, verification, quality metrics |
| **Authentication** | API keys with role-based access |
| **Standards Compliance** | WZDx 4.2, GeoJSON, ISO 8601 timestamps |

---

## Getting Started

### Step 1: Get an API Key

Contact your Corridor Communicator administrator to request an API key:

**What You'll Need to Provide:**
- Organization name
- Use case (consuming data, contributing data, or both)
- Expected API call volume
- Contact email

**What You'll Receive:**
```json
{
  "api_key": "node_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
  "key_prefix": "node_a1b",
  "tier": "standard",
  "rate_limit_per_hour": 10000,
  "expires_at": null
}
```

**⚠️ Important:** Store this API key securely! It will only be shown once.

### Step 2: Test Your Key

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  https://[your-domain]/api/v1/node
```

Expected response:
```json
{
  "name": "DOT Corridor Communicator NODE Implementation",
  "version": "1.0.0",
  "capabilities": { ... }
}
```

---

## API Authentication

All NODE endpoints require an API key.

### Method 1: HTTP Header (Recommended)

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  https://[your-domain]/api/v1/wzdx
```

### Method 2: Query Parameter

```bash
curl "https://[your-domain]/api/v1/wzdx?api_key=YOUR_API_KEY"
```

### Authentication Errors

| Status Code | Reason | Solution |
|-------------|--------|----------|
| `401 Unauthorized` | Missing API key | Include X-API-Key header or api_key parameter |
| `403 Forbidden` | Invalid or expired key | Contact administrator for new key |
| `403 Forbidden` | Endpoint not allowed | Your key doesn't have access to this endpoint |
| `429 Too Many Requests` | Rate limit exceeded | Reduce request frequency or upgrade tier |

---

## Consuming Data (WZDx Feed)

### GET /api/v1/wzdx

Retrieve aggregated traffic events in WZDx v4.2 format.

**Request:**
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  "https://[your-domain]/api/v1/wzdx?corridor=I-80&state=iowa"
```

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `corridor` | string | Filter by corridor | `I-80` |
| `state` | string | Filter by state key | `iowa` |
| `bbox` | string | Bounding box (future) | `minLon,minLat,maxLon,maxLat` |

**Response (WZDx v4.2):**
```json
{
  "road_event_feed_info": {
    "update_date": "2025-12-28T15:30:00Z",
    "publisher": "DOT Corridor Communicator",
    "version": "4.2",
    "license": "https://creativecommons.org/publicdomain/zero/1.0/",
    "data_sources": [
      {
        "data_source_id": "corridor-communicator",
        "organization_name": "Multi-State Corridor Communicator",
        "update_frequency": 60
      }
    ]
  },
  "type": "FeatureCollection",
  "features": [
    {
      "id": "IA-WZ-12345",
      "type": "Feature",
      "properties": {
        "core_details": {
          "event_type": "work-zone",
          "data_source_id": "iowa",
          "road_names": ["I-80"],
          "direction": "eastbound"
        },
        "start_date": "2025-12-28T08:00:00Z",
        "end_date": "2025-12-30T17:00:00Z",
        "description": "Bridge repair",
        "severity": "high",
        "data_quality": {
          "confidence_score": 0.95,
          "source_type": "official_dot",
          "source_name": "Iowa DOT",
          "validation_status": "validated"
        }
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-93.6091, 41.5868]
      }
    }
  ]
}
```

### Data Quality Metadata

Every event includes NODE-specific quality metadata:

```json
"data_quality": {
  "confidence_score": 0.95,        // 0.0 to 1.0
  "source_type": "official_dot",   // official_dot, commercial_fleet, crowdsource, sensor
  "source_name": "Iowa DOT",       // Human-readable source
  "validation_status": "validated", // validated, unvalidated, suspicious, rejected
  "last_verified": "2025-12-28T15:00:00Z"
}
```

**Confidence Score Interpretation:**

| Score | Meaning | Example Sources |
|-------|---------|-----------------|
| 0.9 - 1.0 | Very High | Official DOT systems, verified sensors |
| 0.7 - 0.9 | High | Commercial fleet operators, facility operators |
| 0.5 - 0.7 | Medium | Cross-verified crowdsource, historical patterns |
| 0.3 - 0.5 | Low | Single crowdsource report, unverified |
| 0.0 - 0.3 | Very Low | Flagged for review, potential spam |

---

## Contributing Data

NODE is **bidirectional** - you can contribute data as well as consume it.

### POST /api/v1/contribute/probe-data

Submit probe data from commercial fleets or navigation apps.

**Use Cases:**
- Truck GPS speed data
- Hard braking events
- Traffic flow observations

**Request:**
```bash
curl -X POST \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_type": "commercial_truck",
    "timestamp": "2025-12-28T15:30:00Z",
    "location": {
      "lat": 41.5868,
      "lon": -93.6091,
      "accuracy": 10
    },
    "speed": 45,
    "event_type": "hard_braking",
    "metadata": {
      "vehicle_class": "Class 8",
      "posted_speed": 65
    }
  }' \
  https://[your-domain]/api/v1/contribute/probe-data
```

**Response:**
```json
{
  "success": true,
  "contribution_id": 12345,
  "message": "Probe data received and queued for validation"
}
```

### POST /api/v1/contribute/incident

Submit incident reports (crowdsource or official).

**Request:**
```bash
curl -X POST \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Disabled vehicle blocking right lane",
    "location": {
      "lat": 41.5868,
      "lon": -93.6091
    },
    "incident_type": "disabled_vehicle",
    "severity": "medium",
    "timestamp": "2025-12-28T15:30:00Z",
    "source_confidence": 0.8
  }' \
  https://[your-domain]/api/v1/contribute/incident
```

### POST /api/v1/contribute/parking-status

Submit truck parking availability updates.

**Request:**
```bash
curl -X POST \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "facility_id": "IA-I80-MM142",
    "location": {
      "lat": 41.5868,
      "lon": -93.6091
    },
    "spaces_available": 25,
    "total_spaces": 50,
    "timestamp": "2025-12-28T15:30:00Z",
    "amenities": ["restrooms", "fuel", "food"]
  }' \
  https://[your-domain]/api/v1/contribute/parking-status
```

---

## Data Quality & Provenance

### What is Data Provenance?

**Provenance** = Complete history of where data came from and how it was transformed.

**Example Provenance Chain:**
```json
{
  "event_id": "IA-FUSED-98765",
  "data_provenance": {
    "chain": [
      {
        "source": "Iowa DOT WZDx Feed",
        "timestamp": "2025-12-28T08:00:00Z",
        "operation": "initial_ingestion"
      },
      {
        "source": "Commercial Fleet Probe Data",
        "timestamp": "2025-12-28T08:15:00Z",
        "operation": "cross_validation",
        "confidence_boost": 0.1
      },
      {
        "source": "Corridor Communicator",
        "timestamp": "2025-12-28T08:16:00Z",
        "operation": "data_fusion",
        "final_confidence": 0.95
      }
    ]
  }
}
```

### Quality Validation Process

1. **Ingestion** - Data received from contributor
2. **Validation** - Check coordinates, required fields, format
3. **Cross-Reference** - Compare with official sources if available
4. **Scoring** - Assign confidence score based on source and validation
5. **Publishing** - Include in feeds if score meets threshold

**Minimum Confidence for Publishing:**
- Official feeds: 0.5
- Commercial API: 0.6
- Public API: 0.7

---

## Rate Limits & Tiers

### API Tiers

| Tier | Rate Limit | Use Case | Cost |
|------|------------|----------|------|
| **Public** | 1,000 requests/hour | Research, personal projects | Free |
| **Standard** | 10,000 requests/hour | Small commercial applications | Contact admin |
| **Premium** | 100,000 requests/hour | Large fleets, navigation providers | Contact admin |
| **Unlimited** | No limit | Government agencies, critical systems | Contact admin |

### Rate Limit Headers

Every API response includes rate limit information:

```http
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9876
X-RateLimit-Reset: 1672243200
```

### Handling Rate Limits

**Best Practices:**
1. **Cache responses** - Don't re-fetch unchanged data
2. **Use query filters** - Request only the data you need (corridor, state)
3. **Respect 429 errors** - Back off exponentially
4. **Upgrade tier** - If you consistently hit limits

**Example: Exponential Backoff**
```javascript
async function fetchWithRetry(url, apiKey, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, {
      headers: { 'X-API-Key': apiKey }
    });

    if (response.status === 429) {
      const retryAfter = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`Rate limited. Retrying in ${retryAfter}ms`);
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      continue;
    }

    return response;
  }
  throw new Error('Max retries exceeded');
}
```

---

## Code Examples

### JavaScript/Node.js

```javascript
const fetch = require('node-fetch');

const API_KEY = 'node_your_api_key_here';
const BASE_URL = 'https://[your-domain]/api/v1';

// Fetch WZDx feed
async function getWZDxFeed(corridor = 'I-80') {
  const response = await fetch(`${BASE_URL}/wzdx?corridor=${corridor}`, {
    headers: { 'X-API-Key': API_KEY }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Received ${data.features.length} events`);
  return data;
}

// Submit probe data
async function submitProbeData(location, speed, eventType) {
  const response = await fetch(`${BASE_URL}/contribute/probe-data`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vehicle_type: 'commercial_truck',
      timestamp: new Date().toISOString(),
      location,
      speed,
      event_type: eventType
    })
  });

  const result = await response.json();
  console.log('Contribution ID:', result.contribution_id);
  return result;
}

// Usage
getWZDxFeed('I-80')
  .then(feed => console.log(feed))
  .catch(err => console.error(err));
```

### Python

```python
import requests
from datetime import datetime

API_KEY = 'node_your_api_key_here'
BASE_URL = 'https://[your-domain]/api/v1'

def get_wzdx_feed(corridor='I-80'):
    headers = {'X-API-Key': API_KEY}
    params = {'corridor': corridor}

    response = requests.get(f'{BASE_URL}/wzdx', headers=headers, params=params)
    response.raise_for_status()

    data = response.json()
    print(f"Received {len(data['features'])} events")
    return data

def submit_incident(description, location, severity='medium'):
    headers = {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
    }

    payload = {
        'description': description,
        'location': location,
        'severity': severity,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }

    response = requests.post(
        f'{BASE_URL}/contribute/incident',
        headers=headers,
        json=payload
    )

    result = response.json()
    print(f"Contribution ID: {result['contribution_id']}")
    return result

# Usage
feed = get_wzdx_feed('I-80')
print(feed)
```

### cURL

```bash
# Get WZDx feed
curl -H "X-API-Key: YOUR_API_KEY" \
  "https://[your-domain]/api/v1/wzdx?corridor=I-80"

# Submit parking status
curl -X POST \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "facility_id": "IA-I80-MM142",
    "location": {"lat": 41.5868, "lon": -93.6091},
    "spaces_available": 25,
    "total_spaces": 50,
    "timestamp": "2025-12-28T15:30:00Z"
  }' \
  https://[your-domain]/api/v1/contribute/parking-status
```

---

## Troubleshooting

### Common Issues

**Problem:** `401 Unauthorized`
- **Cause:** Missing API key
- **Solution:** Include `X-API-Key` header or `api_key` query parameter

**Problem:** `403 Forbidden - Endpoint not allowed`
- **Cause:** Your API key doesn't have permission for this endpoint
- **Solution:** Contact administrator to update allowed endpoints

**Problem:** Empty WZDx feed
- **Cause:** No events match your filters
- **Solution:** Try broader filters (remove corridor/state parameters)

**Problem:** Contributions not appearing in feed
- **Cause:** Confidence score below publishing threshold
- **Solution:** Check validation status via admin panel, or improve data quality

### Getting Help

- **Technical Issues:** Contact your system administrator
- **API Questions:** See `/docs/NODE_API_REFERENCE.md`
- **JSTAN Standards:** jstan@aashto.org

---

## Next Steps

1. **Request API Key** - Contact your administrator
2. **Review API Reference** - `/docs/NODE_API_REFERENCE.md`
3. **Test Integration** - Use code examples above
4. **Monitor Usage** - Check rate limits and usage logs
5. **Contribute Data** - Help build the national operational dataset!

---

**Document Version:** 1.0
**Last Updated:** 2025-12-28
**Maintained By:** DOT Corridor Communicator Development Team

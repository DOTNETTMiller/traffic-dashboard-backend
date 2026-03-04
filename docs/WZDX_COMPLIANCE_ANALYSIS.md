# WZDx Feed Creation Compliance Analysis

**Reference**: [USDOT WZDx Feed Creation Guide](https://github.com/usdot-jpo-ode/wzdx/blob/develop/Creating_a_WZDx_Feed.md)
**Current Version**: WZDx v4.2
**Date**: March 3, 2026

## Executive Summary

The TETC DOT Corridor Communicator currently **consumes** WZDx feeds from 21+ state DOTs but does **not publish** a WZDx-compliant feed. This document outlines the requirements for creating a compliant WZDx feed and our current gaps.

## WZDx Business Rules (Non-Negotiable)

### ✅ Rule #1: Event Segmentation
**Requirement**: Events must be segmented into separate `WorkZoneRoadEvent` or `DetourRoadEvent` objects whenever required property values or lane characteristics change.

**Status**: ❌ **Not Implemented**
- We don't currently segment events by lane changes
- **Solution**: Implemented in `services/wzdx-feed-generator.js:segmentEventsByLaneChanges()`

### ✅ Rule #2: Complete Lane Coverage
**Requirement**: If lane information is included, it must cover **every lane** in the road event—partial lane data is prohibited.

**Status**: ❌ **Not Implemented**
- We accept partial lane data
- **Solution**: Implemented validation in `services/wzdx-feed-generator.js:validateAndOrderLanes()` - rejects partial lane data

### ✅ Rule #3: Lane Ordering
**Requirement**: Lane ordering begins at 1 for the leftmost lane, incrementing rightward.

**Status**: ⚠️ **Partially Implemented**
- We have lane data but don't enforce left-to-right ordering
- **Solution**: Implemented in `services/wzdx-feed-generator.js:validateAndOrderLanes()`

### ✅ Rule #4: Data Source Matching
**Requirement**: All `data_source_id` values must match corresponding `FeedDataSource` entries in the same document.

**Status**: ❌ **Not Implemented**
- We don't generate FeedDataSource entries
- **Solution**: Implemented in `services/wzdx-feed-generator.js:generateFeed()` - includes `data_sources` array

### ✅ Rule #5: UTC Timestamps
**Requirement**: All timestamps must use UTC.

**Status**: ⚠️ **Partially Implemented**
- Some timestamps may not be UTC
- **Solution**: Implemented `ensureUTC()` method to convert all timestamps

## Geometry Requirements

### Coordinate Order
**Requirement**: The first point represents where road users initially encounter the event.

**Status**: ❌ **Not Implemented**
- We don't enforce coordinate order based on traffic direction
- **Solution**: Implemented in `normalizeGeometry()` - reverses coordinates for westbound/southbound

### LineString vs Point
**Requirement**: Use LineString geometry when three or more points define the event path.

**Status**: ⚠️ **Partially Implemented**
- We store geometry but may not use correct type
- **Solution**: Implemented type detection in `normalizeGeometry()`

### Dense Point Coverage
**Requirement**: Provide denser point coverage along curved road sections for improved matching to road networks.

**Status**: ❌ **Not Implemented**
- We use geometry as-is from source feeds
- **Recommendation**: Implement curve densification algorithm (future enhancement)

## Feed Format Requirements

### GeoJSON Structure
**Requirement**: Feeds must be formatted as GeoJSON documents (.geojson files) containing a single FeatureCollection.

**Status**: ✅ **Implemented**
- `generateFeed()` returns proper FeatureCollection structure

### Feed Metadata
**Requirement**: Must include `road_event_feed_info` with publisher info, contact details, update frequency, version, and data sources.

**Status**: ✅ **Implemented** (new)
- Complete feed_info implementation in `generateFeed()`
- Includes:
  - `feed_info_id`: UUID
  - `update_date`: UTC timestamp
  - `publisher`: TETC DOT Corridor Communicator
  - `contact_name`: TETC Operations
  - `contact_email`: operations@tetcoalition.org
  - `update_frequency`: 300 seconds (5 minutes)
  - `version`: 4.2
  - `license`: CC0
  - `data_sources[]`: Array of FeedDataSource objects

## Data Quality Guidelines

### Completed Events
**Requirement**: Include completed road events in public feeds for at least one hour or one feed refresh cycle.

**Status**: ⚠️ **Needs Configuration**
- Need to implement retention policy
- **Recommendation**: Add `includeCompleted` parameter with 1-hour TTL

### Schema Validation
**Requirement**: Validate against JSON schemas (v4.2 available for WorkZoneFeed).

**Status**: ❌ **Not Implemented**
- No schema validation currently
- **Recommendation**: Add JSON schema validation using official WZDx v4.2 schema

### Self-Validation Checklist
**Requirement**: Reference the Self-Validation Checklist before publishing.

**Status**: ❌ **Not Started**
- **Action**: Complete WZDx self-validation checklist before going live

## Security Best Practices

### HTTP Methods
**Requirement**: Expose only HTTP GET (or POST for request-body queries) endpoints.

**Status**: ✅ **Compliant**
- Our API uses GET-only for feed access

### SSL/TLS
**Requirement**: Implement SSL/TLS certificates for data transit protection.

**Status**: ✅ **Compliant**
- Railway deployment includes HTTPS

### DDoS Prevention
**Requirement**: Consider cloud hosting for DDoS prevention and scalability.

**Status**: ✅ **Compliant**
- Hosted on Railway with built-in DDoS protection

## Implementation Checklist

### Phase 1: Core Feed Generation (COMPLETED)
- [x] Create WZDxFeedGenerator service class
- [x] Implement event segmentation logic
- [x] Implement lane validation and ordering
- [x] Implement geometry normalization
- [x] Implement UTC timestamp conversion
- [x] Generate complete feed_info metadata
- [x] Add FeedDataSource entries

### Phase 2: API Endpoint (IN PROGRESS)
- [ ] Add GET `/api/wzdx/feed` endpoint
- [ ] Add GET `/api/wzdx/feed.geojson` endpoint
- [ ] Add state filter parameter
- [ ] Add completed events filter
- [ ] Cache feed generation (5-minute TTL)
- [ ] Add proper CORS headers
- [ ] Add `Content-Type: application/geo+json` header

### Phase 3: Database Integration
- [ ] Implement `getEvents()` method for PostgreSQL
- [ ] Add event segmentation query logic
- [ ] Optimize for performance with large datasets
- [ ] Add retention policy for completed events

### Phase 4: Validation & Testing
- [ ] Add JSON schema validation
- [ ] Complete WZDx self-validation checklist
- [ ] Test with WZDx validator tool
- [ ] Verify against official WZDx v4.2 schema
- [ ] Test lane ordering edge cases
- [ ] Test geometry normalization

### Phase 5: Documentation & Deployment
- [ ] Add API documentation for WZDx endpoints
- [ ] Update README with WZDx feed URL
- [ ] Register feed with USDOT WZDx registry
- [ ] Add to state DOT integrations list
- [ ] Create monitoring/alerting for feed health

## API Endpoint Design

### GET `/api/wzdx/feed.geojson`
**Purpose**: Serve WZDx v4.2-compliant GeoJSON feed

**Query Parameters**:
- `state` (optional): Filter by state code (e.g., `?state=TX`)
- `includeCompleted` (optional): Include completed events (default: false)

**Response Headers**:
```
Content-Type: application/geo+json
Cache-Control: public, max-age=300
Access-Control-Allow-Origin: *
```

**Response Body**:
```json
{
  "type": "FeatureCollection",
  "features": [...],
  "road_event_feed_info": {
    "feed_info_id": "uuid",
    "update_date": "2026-03-03T12:00:00Z",
    "publisher": "TETC DOT Corridor Communicator",
    "contact_name": "TETC Operations",
    "contact_email": "operations@tetcoalition.org",
    "update_frequency": 300,
    "version": "4.2",
    "license": "https://creativecommons.org/publicdomain/zero/1.0/",
    "data_sources": [...]
  }
}
```

## Current vs. Required Comparison

| Requirement | Current Status | Solution Status |
|------------|---------------|-----------------|
| **Business Rules** |
| Event Segmentation | ❌ Missing | ✅ Implemented |
| Complete Lane Coverage | ❌ Accepts partial | ✅ Validation added |
| Lane Ordering (1 = left) | ⚠️ Partial | ✅ Implemented |
| Data Source Matching | ❌ No data_sources | ✅ Implemented |
| UTC Timestamps | ⚠️ Inconsistent | ✅ Conversion added |
| **Geometry** |
| Coordinate Order | ❌ Not enforced | ✅ Implemented |
| LineString for 3+ points | ⚠️ May be wrong | ✅ Type detection added |
| Dense curve points | ❌ Not implemented | ⚠️ Future enhancement |
| **Feed Structure** |
| GeoJSON FeatureCollection | ✅ Can generate | ✅ Implemented |
| Feed Metadata | ❌ Missing | ✅ Implemented |
| FeedDataSource entries | ❌ Missing | ✅ Implemented |
| **Security** |
| HTTPS | ✅ Railway | ✅ Compliant |
| GET-only endpoints | ✅ Current design | ✅ Compliant |
| DDoS protection | ✅ Railway | ✅ Compliant |

## Next Steps

1. **Immediate (Week 1)**:
   - Add `/api/wzdx/feed.geojson` endpoint to backend_proxy_server.js
   - Integrate WZDxFeedGenerator with database
   - Test basic feed generation

2. **Short-term (Week 2-3)**:
   - Add JSON schema validation
   - Complete self-validation checklist
   - Performance optimization for large datasets

3. **Medium-term (Month 1)**:
   - Register feed with USDOT
   - Add monitoring/alerting
   - Document for state DOTs

4. **Long-term (Quarter 1)**:
   - Implement curve densification
   - Add advanced filtering options
   - Support WZDx v5.0 (when released)

## References

- [WZDx Feed Creation Guide](https://github.com/usdot-jpo-ode/wzdx/blob/develop/Creating_a_WZDx_Feed.md)
- [WZDx v4.2 Specification](https://github.com/usdot-jpo-ode/wzdx/tree/v4.2)
- [WZDx JSON Schema](https://github.com/usdot-jpo-ode/wzdx/blob/v4.2/schemas/wzdx_v4.2_feed.json)
- [WZDx Self-Validation Checklist](https://github.com/usdot-jpo-ode/wzdx/blob/develop/Creating_a_WZDx_Feed.md#self-validation-checklist)

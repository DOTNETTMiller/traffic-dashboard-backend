# WZDx Feed Upgrade Candidates

**Research Date:** March 14, 2026
**Source:** USDOT WZDx Feed Registry (https://datahub.transportation.gov/d/69qe-yiui)

## Overview

Out of 33 active WZDx feeds in the USDOT registry, **24 feeds require upgrading to v4.2**. This document tracks which states need upgrades and prioritizes implementation.

---

## Upgrade Priority Tiers

### 🔴 CRITICAL - v3.x and Older (2 feeds)

Major version upgrade required. These feeds use deprecated schema versions.

| State/Org | Current Version | Feed URL | Priority |
|-----------|----------------|----------|----------|
| **North Carolina DOT** | v3.1 | us-datacloud.one.network/wzdx-north-carolina.json | URGENT |
| Quebec City (Canada) | v3.1 | quebec.gewi.com/wzdx/pull | LOW |

**Action:** Consume and upgrade v3.1 → v4.2 (significant schema changes)

---

### 🟠 HIGH PRIORITY - v4.0 (7 feeds)

Substantial upgrade from v4.0 to v4.2. Missing recent spec improvements.

| State/Org | Current Version | Feed URL | Coverage |
|-----------|----------------|----------|----------|
| **Oklahoma DOT** | v4.0 | oktraffic.org/api/Geojsons/workzones | I-35, I-40, I-44 |
| **Utah DOT** | v4.0 | udottraffic.utah.gov/wzdx/udot/v40/data | I-15, I-80 |
| **Iowa DOT** | v4.0 | iowa-atms.cloud-q-free.com/api/rest/dataprism/wzdx | I-29, I-35, I-80 |
| **Minnesota DOT** | v4.0 | mn.carsprogram.org/carsapi_v1/api/wzdx | I-35, I-90, I-94 |
| **Virginia DOT** | v4.0 | data.511-atis-ttrip-prod.iteriscloud.com/smarterRoads | I-81, I-95, I-64 |
| **Kansas DOT** | v4.0 | ks.carsprogram.org/carsapi_v1/api/wzdx | I-35, I-70 |
| National Park Service | v4.0 | developer.nps.gov/api/v1/roadevents | Parks nationwide |

**Action:** Consume and upgrade v4.0 → v4.2

**v4.2 Improvements:**
- Enhanced road event relationships
- Better lane-level data structures
- Improved data quality metadata
- New vehicle impact categories
- Enhanced geometry handling

---

### 🟡 MEDIUM PRIORITY - v4.1 (14 feeds)

Minor version upgrade. Mostly compatible but missing latest enhancements.

| State/Org | Current Version | Feed URL | Coverage |
|-----------|----------------|----------|----------|
| Maryland DOT | v4.1 | filter.ritis.org/wzdx_v4.1/mdot.geojson | I-95, I-70, I-270 |
| MTC San Francisco | v4.1 | api.511.org/traffic/wzdx | Bay Area |
| Wisconsin DOT | v4.1 | 511wi.gov/api/wzdx | I-90, I-94, I-43 |
| New Mexico DOT | v4.1 | ai.blyncsy.io/wzdx/nmdot/feed | I-25, I-40 |
| Hawaii DOT | v4.1 | ai.blyncsy.io/wzdx/hidot/feed | Interstate H-1 |
| New York DOT | v4.1 | 511ny.org/api/wzdx | I-87, I-90, I-95 |
| PA Turnpike | v4.1 | atms.paturnpike.com/api/WZDxWorkZoneFeed | I-76, I-476 |
| Massachusetts DOT | v4.1 | feed.massdot-swzm.com/massdot_wzdx_v4.1 | I-90, I-93, I-95 |
| Kentucky DOT | v4.1 | storage.googleapis.com/kytc-its-2020-openrecords | I-65, I-75, I-64 |
| New Jersey DOT | v4.1 | smartworkzones.njit.edu/nj/wzdx | I-95, I-78, I-80 |
| Idaho DOT | v4.1 | 511.idaho.gov/api/wzdx | I-15, I-84, I-86 |
| Indiana DOT | v4.1 | in.carsprogram.org/carsapi_v1/api/wzdx | I-65, I-70, I-74 |
| Louisiana DOTD | v4.1 | wzdx.e-dot.com/la_dot_d_feed_wzdx_v4.1.geojson | I-10, I-12, I-20 |
| Delaware DOT | v4.1 | wzdx.e-dot.com/del_dot_feed_wzdx_v4.1.geojson | I-95, I-295 |

**Action:** Consume and upgrade v4.1 → v4.2

**v4.2 Enhancements:**
- Minor schema refinements
- Additional optional fields
- Enhanced validation rules
- Better GeoJSON compliance

---

### ⚪ SPECIAL CASE - Non-Standard Format (1 feed)

| State/Org | Current Version | Feed URL | Notes |
|-----------|----------------|----------|-------|
| Colorado DOT | CWZ 1.0 | data.cotrip.org/api/v1/cwz | Custom format, needs conversion |

**Action:** Research CWZ format, convert to WZDx v4.2

---

## States Already Using v4.2

✅ **No upgrade needed** - Already compliant:

- Alaska DOT
- Florida DOT
- Georgia DOT
- Illinois Tollway
- Michigan DOT
- Missouri DOT
- Oregon DOT
- Texas DOT
- Washington DOT

---

## States Without Official Feeds

🚧 **Currently generating our own feeds:**

- **Nebraska** - No official feed
- **Nevada** - No official feed

---

## Implementation Strategy

### Phase 1: Critical Upgrades (Week 1)
1. ✅ Nebraska - Generate v4.2 feed (DONE)
2. ✅ Nevada - Generate v4.2 feed (DONE)
3. 🔄 North Carolina - Upgrade v3.1 → v4.2
4. 🔄 Oklahoma - Upgrade v4.0 → v4.2
5. 🔄 Utah - Upgrade v4.0 → v4.2

### Phase 2: High-Priority v4.0 Upgrades (Week 2)
6. Iowa DOT
7. Minnesota DOT
8. Virginia DOT
9. Kansas DOT
10. National Park Service

### Phase 3: Medium-Priority v4.1 Upgrades (Week 3-4)
11. Maryland DOT
12. MTC San Francisco
13. Wisconsin DOT
14. New Mexico DOT
15. Hawaii DOT
16. New York DOT
17. Pennsylvania Turnpike
18. Massachusetts DOT
19. Kentucky DOT
20. New Jersey DOT
21. Idaho DOT
22. Indiana DOT
23. Louisiana DOTD
24. Delaware DOT

### Phase 4: Special Cases (Week 5)
25. Colorado DOT (CWZ conversion)

---

## Technical Approach

### Feed Upgrade Service

```javascript
// Service to consume and upgrade WZDx feeds
class WZDxUpgradeService {
  // Fetch upstream feed
  async fetchUpstreamFeed(url, version)

  // Upgrade v3.x → v4.2
  async upgradeV3ToV42(feed)

  // Upgrade v4.0 → v4.2
  async upgradeV40ToV42(feed)

  // Upgrade v4.1 → v4.2
  async upgradeV41ToV42(feed)

  // Validate upgraded feed
  async validateV42Feed(feed)
}
```

### API Endpoints

```
GET /api/wzdx/upgraded/feed         - All upgraded feeds
GET /api/wzdx/upgraded/feed/:state  - State-specific upgraded feed
GET /api/wzdx/upgraded/stats        - Upgrade statistics
```

### Caching Strategy

- Cache upstream feeds for 5 minutes
- Upgrade on-the-fly when serving
- Background refresh every 5 minutes
- Serve stale cache on upstream errors

---

## Benefits of Upgrading

1. **Standardization** - All feeds use same v4.2 schema
2. **Enhanced Data** - Access to v4.2 improvements
3. **Better Integration** - Consistent API for all states
4. **Future-Proof** - Latest spec version
5. **Reliability** - Fallback if upstream feeds fail

---

## Resources

- **WZDx v4.2 Spec:** https://github.com/usdot-jpo-ode/wzdx/tree/main/schemas/4.2
- **Migration Guide:** https://github.com/usdot-jpo-ode/wzdx/blob/main/docs/migration-guide.md
- **Feed Registry:** https://datahub.transportation.gov/d/69qe-yiui
- **Registry API:** https://datahub.transportation.gov/resource/69qe-yiui.json

---

**Last Updated:** March 14, 2026
**Next Review:** Check registry monthly for new feeds and version updates

# WZDx & CWZ Upgrade Plan

## Overview
Upgrade all state feeds to use official WZDx v4.x feeds from the USDOT Work Zone Data Feed Registry, plus support for the NEW **CWZ 1.0 (Connected Work Zone)** standard.

**CWZ vs WZDx:**
- **WZDx** = Traditional work zone data exchange (v4.2 is latest)
- **CWZ** = NEW connected vehicle standard built on WZDx foundation
- **CWZ adds:** V2X broadcasting, real-time updates, automated vehicle support
- **CWZ is the future:** WZDx v4.2 is rolling into CWZ formal standard (ITE/AASHTO/NEMA/SAE)

**Sources:**
- USDOT Registry: https://datahub.transportation.gov/Roadways-and-Bridges/Work-Zone-Data-Feed-Registry/69qe-yiui
- CWZ Standard: https://www.ite.org/technical-resources/standards/cwz/

## Current Status

### Feed Type Distribution

**WZDx (Traditional Work Zone Data Exchange):**
- **WZDx 4.2** (Latest): 8 states - Illinois, Arizona, Florida, Washington, Colorado, Ohio, Texas
- **WZDx 4.1**: 15 states - MA, NJ, PA, KY, IN, MO, MD, DE, CA, NY, WI, HI, NM, ID, LA
- **WZDx 4.0**: 9 states - Michigan, Kansas, Utah, Iowa, Oklahoma, Minnesota, Virginia, MO (St. Charles)
- **WZDx 3.1** (Older): 1 state - North Carolina

**CWZ (Connected Work Zone - NEW V2X Standard):**
- **CWZ 1.0**: 1 state - **Colorado** 🚀 (ALSO has WZDx 4.2)
  - First state with the new connected vehicle standard!
  - Supports V2X broadcasting for automated vehicles
  - Built on WZDx 4.1/4.2 foundation with enhancements

### States We Need to Upgrade (14 states)

#### CARS Consortium (4 states) - **HIGH PRIORITY**
These states switched from FEU-G XML to WZDx:

1. **Iowa** 🌽
   - Current: `https://ia.carsprogram.org/hub/data/feu-g.xml` (FEU-G XML)
   - Upgrade to: `https://iowa-atms.cloud-q-free.com/api/rest/dataprism/wzdx/wzdxfeed` (WZDx 4.0)

2. **Indiana**
   - Current: `https://inhub.carsprogram.org/data/feu-g.xml` (FEU-G XML)
   - Upgrade to: `https://in.carsprogram.org/carsapi_v1/api/wzdx` (WZDx 4.1)

3. **Kansas**
   - Current: `https://kscars.kandrive.gov/hub/data/feu-g.xml` (FEU-G XML)
   - Upgrade to: `https://ks.carsprogram.org/carsapi_v1/api/wzdx` (WZDx 4.0)

4. **Minnesota**
   - Current: `https://mn.carsprogram.org/hub/data/feu-g.xml` (FEU-G XML)
   - Upgrade to: `https://mn.carsprogram.org/carsapi_v1/api/wzdx` (WZDx 4.0)

#### Major States (7 states)

5. **California** 🌴
   - Current: `https://cwwp2.dot.ca.gov/data/d*/lcsdata.json` (Caltrans LCS)
   - Upgrade to: `https://api.511.org/traffic/wzdx?api_key=` (WZDx 4.1)

6. **Colorado** 🏔️ **[SPECIAL - Has BOTH WZDx AND CWZ!]**
   - Primary (Connected Vehicles): `https://data.cotrip.org/api/v1/cwz?apiKey=` (CWZ 1.0) 🚀
   - Secondary (Traditional): `https://data.cotrip.org/api/v1/wzdx?apiKey=` (WZDx 4.2)
   - **Colorado is a CWZ pioneer!** First state with connected work zone V2X standard
   - **Recommendation:** Support BOTH endpoints
     - Use CWZ for connected vehicle applications
     - Use WZDx for traditional data consumers

7. **Illinois**
   - Current: `https://travelmidwest.com/lmiga/incidents.json?path=GATEWAY.IL` (Travel Midwest)
   - Upgrade to: `https://tims2go.tollway.state.il.us/wzdx/v4.2?api_key=` (WZDx 4.2)

8. **New Jersey** 🌊
   - Current: `https://511nj.org/client/rest/rss/RSSAllNJActiveEvents` (RSS)
   - Upgrade to: `https://smartworkzones.njit.edu/nj/wzdx` (WZDx 4.1)

9. **Ohio**
   - Current: `https://publicapi.ohgo.com/api/v1/constructions` (Custom API)
   - Upgrade to: `https://publicapi.ohgo.com/api/work-zones/wzdx/4.2?api-key=` (WZDx 4.2)

10. **Pennsylvania** 🔔
    - Current: `https://www.511pa.com/feeds/RoadConditions.xml` (511 XML)
    - Upgrade to: `https://atms.paturnpike.com/api/WZDxWorkZoneFeed?api_key=` (WZDx 4.1)

11. **Texas** 🤠
    - Current: `https://data.austintexas.gov/download/d9mm-cjw9` (Austin only)
    - Upgrade to: `https://api.drivetexas.org/api/conditions.wzdx.geojson?key=` (WZDx 4.2 - Statewide)

#### Already Correct (3 states)
These URLs are correct but need API type updated:

12. **Florida** ✅
    - URL: `https://us-datacloud.one.network/fdot/feed.json?app_key=` (WZDx 4.2)
    - Update: Change API type to 'WZDx'

13. **Oklahoma** ✅
    - URL: `https://oktraffic.org/api/Geojsons/workzones?&access_token=` (WZDx 4.0)
    - Update: Change API type to 'WZDx'

14. **Virginia** ✅
    - URL: `https://data.511-atis-ttrip-prod.iteriscloud.com/smarterRoads/workzone/workZoneJSON/current/workZone.json?token=` (WZDx 4.0)
    - Update: Change API type to 'WZDx'

### States to Add (1 state)

15. **Michigan** 🚗
    - Add: `https://mdotridedata.state.mi.us/api/v1/organization/michigan_department_of_transportation/dataset/work_zone_information/query` (WZDx 4.0)

## States That DON'T Have WZDx (2 states)

These states will use our **generated WZDx feeds**:

1. **Nebraska** - Not in USDOT registry
2. **Nevada** - Not in USDOT registry

## Implementation Steps

### 1. Database Migration ✅ CREATED
Run: `migrations/upgrade_to_official_wzdx_feeds.sql`

This will:
- Backup current state configurations
- Update all 14 states to WZDx URLs
- Add Michigan
- Add Colorado CWZ as fallback (`co-cwz`)
- Create `wzdx_feed_versions` view for version tracking

### 2. Backend Updates (NEEDED)

Add CWZ format support to `backend_proxy_server.js`:

**CWZ vs WZDx Differences:**
- **CWZ is built on WZDx 4.1/4.2** as foundation (same base structure)
- **CWZ adds V2X capabilities:** Real-time broadcasting to connected vehicles
- **CWZ supports automated vehicles:** Enhanced data for autonomous systems
- **CWZ is the future standard:** WZDx is rolling into CWZ under ITE/AASHTO/NEMA/SAE
- **Data format:** Very similar to WZDx (see Annex F of CWZ spec for differences)
- **Key additions:** Real-time worker presence, equipment status, dynamic lane closures

**Required Code Addition:**
Add CWZ handling right after WZDx handling (around line 2940):

```javascript
// Handle CWZ (Construction Work Zone) format - Colorado legacy
if (detectedApiType === 'CWZ' && (rawData.features || rawData.road_event_features)) {
  const features = rawData.features || rawData.road_event_features || [];
  console.log(`${stateName}: Processing ${features.length} CWZ features`);

  features.forEach(feature => {
    const props = feature.properties;
    const coreDetails = props.core_details || props;

    // CWZ has similar structure to WZDx
    // Extract coordinates
    let lat = 0, lng = 0;
    if (feature.geometry?.coordinates) {
      const coords = feature.geometry.coordinates;
      if (Array.isArray(coords) && coords.length > 0) {
        if (Array.isArray(coords[0])) {
          lng = parseFloat(coords[0][0]) || 0;
          lat = parseFloat(coords[0][1]) || 0;
        } else {
          lng = parseFloat(coords[0]) || 0;
          lat = parseFloat(coords[1]) || 0;
        }
      }
    }

    const roadNames = coreDetails.road_names || props.road_names || [];
    const locationText = roadNames.join(', ') || 'Unknown location';

    if (isInterstateRoute(locationText)) {
      const eventId = coreDetails.road_event_id || props.road_event_id || feature.id;

      normalized.push({
        id: `CO-${eventId}`,
        state: stateName,
        corridor: extractCorridor(locationText),
        eventType: coreDetails.event_type || 'work-zone',
        description: stripHtmlTags(coreDetails.description || props.description) || 'Work zone',
        location: locationText,
        county: props.county || 'Unknown',
        latitude: lat,
        longitude: lng,
        startTime: props.start_date || coreDetails.start_date,
        endTime: props.end_date || coreDetails.end_date,
        lanesAffected: props.vehicle_impact || 'Check conditions',
        severity: (props.vehicle_impact === 'all-lanes-open') ? 'low' : 'medium',
        direction: coreDetails.direction || props.direction || 'Both',
        requiresCollaboration: false,
        geometry: feature.geometry || null
      });
    }
  });

  console.log(`${stateName}: Normalized ${normalized.length} CWZ events`);
}
```

### 3. API Key Management

Many WZDx feeds require API keys. States that need keys:

**Requires API Keys:**
- California (511.org)
- Colorado (data.cotrip.org)
- Illinois (tims2go.tollway.state.il.us)
- Ohio (publicapi.ohgo.com)
- Pennsylvania (atms.paturnpike.com)
- Texas (api.drivetexas.org)

**Key Storage:**
Store in `state_credentials` table (encrypted):

```sql
UPDATE state_credentials
SET credentials_encrypted = encrypt_credentials(json_object(
  'api_key', 'YOUR-API-KEY-HERE'
))
WHERE state_key = 'ca';
```

### 4. Testing Checklist

For each upgraded state:
- [ ] Fetch feed successfully
- [ ] Parse WZDx/CWZ format correctly
- [ ] Extract interstate events only
- [ ] Normalize to our event schema
- [ ] Store in database
- [ ] Display on map
- [ ] Generate CIFS messages

### 5. Rollback Plan

If upgrade causes issues:

```sql
-- Restore from backup
DELETE FROM states;
INSERT INTO states SELECT * FROM states_backup_20260311;
```

## Benefits

### Performance
- **Direct WZDx feeds** = No XML parsing overhead for CARS states
- **Native JSON** = Faster processing
- **Standardized schema** = Simpler code

### Data Quality
- **Authoritative source** = USDOT-verified feeds
- **Real-time updates** = Most feeds update every 1-5 minutes
- **Richer data** = Lane closures, vehicle impacts, restrictions

### Compliance
- **FHWA standard** = WZDx is the federal work zone data standard
- **Interoperability** = Compatible with all WZDx consumers (Waze, Google, etc.)
- **Future-proof** = All states migrating to WZDx

## Post-Upgrade Monitoring

### Metrics to Track
1. **Feed availability** - % of successful fetches
2. **Event count** - Compare pre/post upgrade
3. **Processing time** - Should be faster with WZDx
4. **Error rate** - Monitor parsing errors
5. **Interstate coverage** - Ensure I-80 still covered

### Dashboard Query
```sql
SELECT
  state_key,
  state_name,
  wzdx_version,
  COUNT(*) as feed_fetches,
  COUNT(*) FILTER (WHERE success = true) as successful_fetches,
  AVG(fetch_time_ms) as avg_fetch_time
FROM feed_fetch_log
WHERE fetched_at > NOW() - INTERVAL '24 hours'
GROUP BY state_key, state_name, wzdx_version
ORDER BY state_name;
```

## Timeline

- **Day 1**: Run migration, update 4-5 states (CARS consortium)
- **Day 2**: Update major states (CA, TX, PA, NJ)
- **Day 3**: Update remaining states, add Michigan
- **Day 4**: Testing and validation
- **Day 5**: Monitor and optimize

## Support

### Documentation
- **WZDx Spec:** https://github.com/usdot-jpo-ode/wzdx
- **CWZ Standard (NEW!):** https://www.ite.org/technical-resources/standards/cwz/
- **USDOT Registry:** https://datahub.transportation.gov/d/69qe-yiui
- **CWZ vs WZDx:** CWZ Implementation Guide Annex F (differences from WZDx v4.2)

### What is CWZ?
**Connected Work Zone (CWZ)** is the new USDOT/ITE standard for connected vehicle applications:
- **Built on WZDx 4.1/4.2** as foundation
- **Adds V2X broadcasting** for real-time vehicle communication
- **Supports automated vehicles** with enhanced data elements
- **Developed by:** ITE, AASHTO, NEMA, SAE International
- **Key additions:** Worker presence detection, equipment status, dynamic updates
- **Use cases:** Connected vehicles, automated driving systems, real-time safety alerts
- **C-V2X:** Supports 5.9 GHz ITS band communications (FCC finalized 2024)
- **Colorado is first!** Colorado DOT is pioneering CWZ deployment

### API Key Requests
Each state DOT has their own process for API key requests. Generally:
1. Visit state DOT developer portal
2. Register account
3. Request API key for WZDx feed
4. Wait for approval (1-5 business days)

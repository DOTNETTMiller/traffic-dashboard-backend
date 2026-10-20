# Corridor Communicator — External Data Sources (APIs We Pull In)

Inventory of every upstream API/feed the platform consumes, compiled from the
`states` feed registry (SQLite) and the fetch code in
`backend_proxy_server.js` + `services/`. API keys/tokens are redacted; the
live values are in env vars / the production registry.

> Note: this reflects the local registry snapshot; the production (Railway)
> registry may differ slightly. `[env key]` = credential from environment.

## 1. State DOT Work Zone / Event Feeds

### WZDx feeds (state-level)

| State | Vendor/host | URL | Notes |
|---|---|---|---|
| California | 511.org | `https://api.511.org/traffic/wzdx?api_key=[env]` | |
| Colorado | CDOT cotrip | `https://data.cotrip.org/api/v1/cwz?apiKey=[env]` | **CWZ 1.0** feed |
| Colorado (traditional) | CDOT cotrip | `https://data.cotrip.org/api/v1/wzdx?apiKey=[env]` | |
| Delaware | e-dot.com | `https://wzdx.e-dot.com/del_dot_feed_wzdx_v4.1.geojson` | |
| Florida | one.network | `https://us-datacloud.one.network/fdot/feed.json?app_key=[env]` | |
| Hawaii | Blyncsy | `https://ai.blyncsy.io/wzdx/hidot/feed` | |
| Idaho | 511.idaho.gov | `https://511.idaho.gov/api/wzdx` | |
| Illinois Tollway | tims2go | `https://tims2go.tollway.state.il.us/wzdx/v4.2?api_key=[env]` | v4.2 |
| Indiana | CARS | `https://in.carsprogram.org/carsapi_v1/api/wzdx` | |
| Iowa | Q-Free | `https://iowa-atms.cloud-q-free.com/api/rest/dataprism/wzdx/wzdxfeed` | |
| Kansas | CARS | `https://ks.carsprogram.org/carsapi_v1/api/wzdx` | |
| Kentucky | KYTC (GCS) | `https://storage.googleapis.com/kytc-its-2020-openrecords/public/feeds/WZDx/kytc_wzdx_v4.1.geojson` | |
| Louisiana | e-dot.com | `https://wzdx.e-dot.com/la_dot_d_feed_wzdx_v4.1.geojson` | |
| Maryland | RITIS | `https://filter.ritis.org/wzdx_v4.1/mdot.geojson` | |
| Massachusetts | SWZM | `https://feed.massdot-swzm.com/massdot_wzdx_v4.1_work_zone_feed.geojson` | |
| Michigan | MDOT Ride | `https://mdotridedata.state.mi.us/api/v1/.../work_zone_information/query` | key via env |
| Minnesota | CARS | `https://mn.carsprogram.org/carsapi_v1/api/wzdx` | |
| Missouri | RIDSI | `https://scc.ridsi-dash.com:5000/wzdx.geojson` | |
| New Jersey | NJIT | `https://smartworkzones.njit.edu/nj/wzdx` | |
| New Mexico | Blyncsy | `https://ai.blyncsy.io/wzdx/nmdot/feed` | |
| New York | 511NY | `https://511ny.org/api/wzdx` | |
| North Carolina | one.network | `https://us-datacloud.one.network/wzdx-north-carolina.json?app_key=[env]` | |
| Ohio | OHGO | `https://publicapi.ohgo.com/api/work-zones/wzdx/4.2?api-key=[env]` | v4.2 |
| Oklahoma | oktraffic | `https://oktraffic.org/api/Geojsons/workzones?access_token=[env]` | |
| Pennsylvania Turnpike | PTC ATMS | `https://atms.paturnpike.com/api/WZDxWorkZoneFeed?api_key=[env]` | |
| Texas | drivetexas | `https://api.drivetexas.org/api/conditions.wzdx.geojson?key=[env]` | |
| Utah | UDOT | `https://udottraffic.utah.gov/wzdx/udot/v40/data` | |
| Virginia | Iteris SmarterRoads | `https://data.511-atis-ttrip-prod.iteriscloud.com/smarterRoads/workzone/.../workZone.json?token=[env]` | |
| Washington | WSDOT | `https://wzdx.wsdot.wa.gov/api/v4/WorkZoneFeed` | |
| Wisconsin | 511WI | `https://511wi.gov/api/wzdx` | |

### Sub-state / regional WZDx

| Producer | URL |
|---|---|
| City of Austin, TX | `https://data.austintexas.gov/download/d9mm-cjw9` |
| Maricopa County, AZ | `https://wzdxapi.aztech.org/construction` |
| Quebec City | `https://quebec.gewi.com/wzdx/pull` |

### Non-WZDx state event feeds

| State | Format | URL | Notes |
|---|---|---|---|
| Iowa / Kansas / Nebraska / Indiana / Minnesota | CARS FEU-G XML | `https://{ia,kscars,ne,inhub,mn}.carsprogram.org/hub/data/feu-g.xml` | Credentialed (`CARS_USERNAME`/password env) |
| Nevada | Custom JSON | `https://www.nvroads.com/api/v2/get/roadconditions` | + `/get/truckparking` |
| New Jersey | 511 RSS | `https://511nj.org/client/rest/rss/RSSAllNJActiveEvents` | |
| Illinois | TravelMidwest JSON | `https://travelmidwest.com/lmiga/incidents.json?path=GATEWAY.IL` | Lake Michigan Interstate Gateway |
| Ohio | OHGO REST | `https://publicapi.ohgo.com/api/v1/constructions` + `/incidents` | |

## 2. Truck Parking (TPIMS)

| Source | URL | Notes |
|---|---|---|
| Illinois TPIMS | `https://truckparking.travelmidwest.com/TPIMS_Dynamic.json` (+ `TPIMS_Static.json`) | MAASTO v2.2 |
| Kentucky TRIMARC | `http://www.trimarc.org/dat/tpims/TPIMS_Dynamic.json` | plain HTTP |
| Minnesota IRIS | `http://iris.dot.state.mn.us/iris/TPIMS_dynamic` | plain HTTP |
| Nevada | `https://www.nvroads.com/api/v2/get/truckparking` | |
| Iowa rest-area cameras | `https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/*.jpg` | Snapshot images for AI ground-truth occupancy counts |

## 3. Federal / National Data

| Source | URL | Used for |
|---|---|---|
| NWS Alerts API | `https://api.weather.gov` | Road-impacting CAP alerts (~30 event types) |
| CBP Border Wait Times | `https://bwt.cbp.gov/api/waittimes` | US–CA / US–MX ports, commercial lanes |
| NHTSA FARS | `https://static.nhtsa.gov` annual bulk CSV zips | Historical crash analytics (live CrashAPI is Akamai-blocked from datacenter IPs — use bulk files) |
| USDOT NBI (NTAD) | `https://services.arcgis.com/xOi1kZaI0eWDREZv/.../NTAD_National_Bridge_Inventory/FeatureServer/0` | Bridge vertical clearances (ingest script → Cloudflare static `corridor-bridges.pages.dev/bridges.json`) |
| ARNOLD road network | `https://geo.dot.gov/server/rest/services/Hosted/ARNOLD_{STATE}_{YEAR}/FeatureServer/0` | Route geometry (source: `geodata.bts.gov`) |
| US Census | `https://api.census.gov`, `https://tigerweb.geo.census.gov` | Population estimates/heatmap |
| Grants.gov | `https://api.grants.gov` | Live grant opportunity search + deadline monitoring |

## 4. Commercial / Third-Party APIs

| Source | URL | Used for |
|---|---|---|
| TomTom Traffic | `https://api.tomtom.com` (incident details) | Live incident overlay vs. DOT feeds (deviation/ground-truth) |
| Ticketmaster Discovery | `https://app.ticketmaster.com/discovery/v2/events.json` | Major-event demand surge alerts (gated on `TICKETMASTER_API_KEY`) |
| PredictHQ | `https://api.predicthq.com/v1/events/` | Major-events alternative provider (ready, not active) |
| OpenAI | `https://api.openai.com` | AI features (chat, analysis, letter/narrative generation) |

*(Blyncsy, one.network, RITIS, GEWI, Q-Free, Iteris, CARS appear above as
vendors hosting state feeds rather than independent sources.)*

## 5. Geospatial / Utility Services

| Source | URL | Used for |
|---|---|---|
| OSRM | `https://router.project-osrm.org` | Route snapping / diversion routes (cached in `osrm_cache.db`) |
| Overpass API | `https://overpass-api.de` | OSM queries (interchanges, road data) |
| Nominatim | `https://nominatim.openstreetmap.org` | Geocoding |
| State GIS route services | KS `wfs.ksdot.org`, NE `giscat.ne.gov`, IN `gisdata.in.gov`, MN `webgis.dot.state.mn.us`, IA `gis.iowadot.gov` / `maps.iowadot.gov`, IA DNR `data.iowadnr.gov` | Route/milepost geometry enrichment |
| Indiana TrafficWise | `https://content.trafficwise.org` | Supplemental IN data |
| Wisconsin Transportal | `https://transportal.cee.wisc.edu` | Supplemental WI data |

## 6. Registered / Pending / Planned

| Source | Status |
|---|---|
| PennDOT RCRS (`rcrs.transportation.org`) | Registered; custom adapter pending |
| Waze for Cities (CCP) | Registered; ingest planned |
| Eastern Transportation Coalition (CIFS) | Grading methodology + CIFS ingest (`tetcoalition.org` references) |
| Mobile feed ingest (`services/mobile-feed-ingest.js`) | New: external JSON feeds e.g. field-escort feed (`purposebuiltsystems.github.io/field-escort-feed/feed.json`) |

---

**Totals:** ~31 state WZDx/CWZ feeds + 3 sub-state WZDx + 5 CARS XML + 4
custom state APIs + 5 TPIMS/parking sources + 7 federal datasets + 4
commercial APIs + ~10 geospatial utilities ≈ **70 distinct upstream sources**
(the "~39 WZDx producers" figure counts state + sub-state + district-level
WZDx endpoints).

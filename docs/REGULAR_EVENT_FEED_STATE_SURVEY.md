# Regular-Event Feed — State Survey (non-work-zone)

Companion to `DEVICE_FEED_STATE_SURVEY.md` and the WZDx work-zone coverage. This surveys the
**other** event data: incidents/crashes, closures/restrictions, road & weather (winter)
conditions, and special events. 36 states probed (Aug 2026), endpoints verified by fetching.

**Bottom line:** regular-event data is far more openly available than device feeds. **~18 states
are usable today with no key**, **3 more unlock with keys we already hold** (Colorado, Ohio,
Nevada), and **~7 are one free registration away** — so ~28 states are reachable. RCRS (AASHTO
national) is gated everywhere (403 without credential).

## Tier 1 — GO-TODAY, public, no key (verified live)
| State | Feeds | Endpoint(s) |
|---|---|---|
| **New York** ⭐ | incidents + closures + **special events** (2,274) | `511ny.org/api/getevents?format=json` (keyless legacy path) |
| **North Carolina** ⭐ | incidents + closures (593) + adverse-weather | ArcGIS `services.arcgis.com/NuWFvHYDMVmmxMeM/.../NCDOT_TIMS_Incidents/FeatureServer/0` (+ `NCDOT_TIMSAdverseWeather`) |
| **Washington** ⭐ | road alerts (83) + mtn-pass/winter + RWIS (584) | `data.wsdot.wa.gov/arcgis/.../TravelInfoRoadAlerts/FeatureServer/0` (+ MtPassReports, CamerasWeather) |
| **Florida** | incidents/closures + special events | `gis.fdot.gov/arcgis/.../DIVAS_GetEvent/FeatureServer/0` (+ `DIVAS_ERSGetEvent`) |
| **California** | CHP incidents + LCS closures (~12k) + chain control | `media.chp.ca.gov/sa_xml/sa.xml`; `cwwp2.dot.ca.gov/data/d{N}/lcs/lcsStatusD{NN}.json`; `.../cc/ccStatusD{NN}.json` |
| **Maryland** | incidents + closures + RWIS | `chart.maryland.gov/DataFeeds/GetIncidentJSON` · `GetClosureJSON` · `GetRwisJSON` |
| **Missouri** | incidents + closures + floods + road/winter conditions | `mapping.modot.mo.gov/arcgis/.../TravelerInformation/TravelerInformationData/MapServer` (layers) + `.../RoadConditions/MapServer` |
| **Minnesota** | incidents + weather sensors | `data.dot.state.mn.us/iris_xml/incident.xml.gz` · `weather_sensor.xml.gz` |
| **Michigan** | incidents | `mdotjboss.state.mi.us/MiDrive/incident/list/loadIncidents` (lat/lon embedded in an href → parse) |
| **Delaware** | Waze incidents + advisories (closures/construction/special) + RWIS | `tmc.deldot.gov/json/wazealert.json` · `advisory.json` · `weatherstation.json` |
| **Nebraska** | incidents + winter (458) + truck restrictions | `POST 511.nebraska.gov/api/graphql` op `MapFeatures` slugs `roadReports`/`winterDriving`/`truckersReports` (reverse-engineered) |
| **New Mexico** | incidents/closures/roadwork/special (one feed) | `servicev5.nmroads.com/RealMapWAR/GetEventsJSON?eventType=N&callback=cb` (JSONP; coords projected → reproject) |
| **Illinois** | incidents + special events + construction | `travelmidwest.com/lmiga/incidents.json?path=GATEWAY.IL` (+ `specialEvents.json`, `construction.json`) |
| **Indiana** | incidents | `travelmidwest.com/lmiga/incidents.json?path=GATEWAY.IN` |
| **Maine / NH / VT** | incidents + closures + special + winter | `POST newengland511.org/List/GetData/traffic` & `/winterroads` (DataTables POST; **no lat/lon** → geocode; filter by `state`) |
| **Hawaii** | Oahu HPD incidents (no coords) + statewide lane closures | `data.honolulu.gov/resource/ykb6-n5th.json`; HDOT `Lane_Closure_WebMap_WFL1_view` (overlaps WZDx) |

## Tier 2 — unlock with a key we already hold
| State | Feeds | Endpoint |
|---|---|---|
| **Colorado** ⭐ | incidents + roadConditions + plannedEvents + weatherStations + snowPlows | `data.cotrip.org/api/v1/{resource}?apiKey=$COLORADO_API_KEY` (same key as our WZDx feed) |
| **Ohio** ⭐ | incidents + weather-sensor-sites + dangerous-slowdowns | `publicapi.ohgo.com/api/v1/{...}` (same OHGO key we already use for `constructions`) |
| **Nevada** | events (incidents/closures/special) | `nvroads.com/api/v2/get/event` (same NV key we use for `roadconditions`) |

## Tier 3 — free-key (register)
Arizona (`az511.com/api/v2/get/event`), Idaho (`511.idaho.gov`), Louisiana (`511la.org`),
Utah (`udottraffic.utah.gov/api/v2/get/event`+`roadconditions`+`weatherstations`),
Oregon (TripCheck Data API — incidents, road/weather, RWIS, local/special),
Texas (`api.drivetexas.org/api/conditions.wzdx.geojson`), Wisconsin
(`511wi.gov/api/v2/get/event`+`closures`+`roadconditions`+`winterdrivingconditions`+`specialevents`).

## Gated (no public signup)
RCRS/AASHTO national (403 everywhere), Kansas, Kentucky (Waze CCP), New Jersey (WAF),
Mississippi (token), Massachusetts (GoTime request; CARS graphql fragile), Pennsylvania
(penndotdata@pa.gov), Virginia (SmarterRoads gated; VDEM ArcGIS unresolved), Oklahoma (internal-only).

## Notes
- **Coverage gaps:** dedicated **special-events** and structured **RWIS/road-weather** feeds are
  the weakest categories — only a handful of states expose them. NY/FL/WI have real special-events
  feeds; elsewhere they fold into the incident/planned stream (pair with the existing
  Ticketmaster/PredictHQ demand-surge module).
- **PBS footprint:** `conditions.drivetexas.org` republishes TxDOT conditions under PurposeBuilt
  Systems (the user's own feed), same as the DTCD CWZ feed — not an independent upstream.
- **RCRS** would be the single highest-leverage add (national incidents + conditions from one
  source) if an AASHTO credential is obtained — relevant given the CCAI/AASHTO I-35 anchor role.
- Adding these to the events pipeline is core product (runs on the on-demand event-cache refresh),
  so each feed is one more outbound pull per refresh — curate for value vs. egress.

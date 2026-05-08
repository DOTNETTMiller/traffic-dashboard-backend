# Transportation Event Data Feed Discovery

**Date:** 2026-05-08
**Scope:** WZDx and adjacent transportation event feeds for Matt's Experimental Sandbox
**Method:** Direct query against the USDOT WZDx Feed Registry (Socrata API) plus targeted state-by-state web search.

---

## TL;DR

- Of 21 US states currently missing from the dashboard, **only AZ statewide and Alaska have ready-to-go WZDx endpoints** (both via the Iteris 511 family, free key). Everything else is either no public API, gated by a request form, or only available in non-WZDx Open511/JSON.
- **Top 5 next integrations:** AZ 511 → Alaska 511 → NPS Road Events → Waze for Cities → PennDOT RCRS. Three of those are quick (low-effort, free key); two require an application.
- **CWZ 1.0** has grown from one producer (CDOT) to four (CDOT, MassDOT, IDOT, PBS) in the last few months — worth confirming the dashboard's CWZ parser handles all four. IDOT's feed registered 2026-05-01 is the freshest item in the registry.
- **Best non-WZDx fillers for the dark states:** NWS Alerts API (free, immediate), CBP border waits (free, immediate), Waze CCP (free but slow application cycle).
- **No new public CIFS or TMDD producers** discovered beyond what's already integrated — the I-95/TETC CIFS remains canonical.

---

## 1. Currently-published WZDx feeds from missing states

### 1a. Authoritative source

The full WZDx Feed Registry is queryable as JSON without auth at
`https://data.transportation.gov/resource/69qe-yiui.json?$limit=200`. **Of the
~21 missing states, only Arizona currently has any registered WZDx feed**, and
only as a regional Maricopa County producer. Everything else marked "missing"
is genuinely missing from the federal registry as of 2026-05-08.

### 1b. Net-new feeds we can integrate

| State | Issuer | Feed URL | WZDx version | API key | Notes |
|---|---|---|---|---|---|
| Arizona | **Maricopa County DOT** (already in registry) | `https://wzdxapi.aztech.org/construction` | 4.2 | No | Regional only — Phoenix metro / AZTech partners |
| Arizona | **AZ DOT statewide (AZ511)** | `https://az511.com/api/wzdx` | unspecified (likely 4.x) | **Yes** (key= query param) | Free; throttled at 10 calls/60s. Same iBi/Iteris API pattern as 511GA, 511NY, Alaska 511, UDOT |
| Alaska | **Alaska DOT&PF (Alaska 511)** | `wzdxfielddevice` endpoint on `https://511.alaska.gov` | unspecified | **Yes** (developer key) | Iteris-hosted ATIS; same family as AZ/GA/NY/UT |
| District of Columbia | DDOT | — | — | — | No public WZDx; only ArcGIS layers (cameras, volumes) |
| Pennsylvania (state DOT) | PennDOT | RCRS feed (gated) | — | — | Behind data-feed request form at `pa.gov/services/penndot/request-access-to-transportation-related-data-feeds`. Email `penndotdata@pa.gov`. Not WZDx-formatted. |

### 1c. States with no public WZDx feed

Confirmed via WZDx registry + state-specific search: **no public WZDx feed**
for AL, AR, CT, GA, ME, MS, MT, NH, ND, OR, RI, SC, SD, TN, VT, WV, WY, plus
US territories (PR, VI, GU, AS, MP).

Some publish event/incident data via Iteris-style 511 APIs (Open511-ish JSON
`events` endpoint), just not in WZDx format:

| State | Portal | Has events endpoint? | API key |
|---|---|---|---|
| Georgia | `https://511ga.org/developers/doc` | Yes (8 endpoints incl. Events, Alerts) | Yes |
| Alabama | ALGO Traffic / `algotraffic.com` | Internal; no public dev docs | Unknown |
| Mississippi | `mdottraffic.com` | No public API documented | — |
| Montana | `511mt.net` | No developer docs — contact MDT | — |
| Tennessee (TDOT) | `smartway.tn.gov/traffic` | No public API documented | — |
| South Carolina | `511sc.org` | No public API documented | — |
| New England (ME / NH / VT shared) | `newengland511.org` | Iteris-backed; no developer page surfaced | Probably yes if asked |
| Wyoming | `wyoroad.info` | No public API documented | — |
| Rhode Island | `dot.ri.gov/travel` | Static pages only | — |

### 1d. Other registry feeds we don't currently consume

| Feed | URL | Version | Note |
|---|---|---|---|
| **Michigan DOT (mdot_4)** — re-registered Feb 2026 | `https://mdotridedata.state.mi.us//api/v1/organization/michigan_department_of_transportation/dataset/work_zone_information/query?limit=200&_format=json` | 4 | API key required. Verify our existing MI integration uses this endpoint, not the older deactivated one. |
| **St. Charles County, MO** | `https://scc.ridsi-dash.com:5000/wzdx.geojson` | 4 | Public, no key. Sub-MO regional. |
| **City of Austin, TX** | `https://data.austintexas.gov/download/d9mm-cjw9` | 4.2 | Public. Sub-TX regional. |
| **National Park Service** | `https://developer.nps.gov/api/v1/roadevents?type=workzone&api_key=` | 4 | Free key. **Underrated — covers all NPS roads nationwide; fills WY/MT/TN/ME gaps.** |
| **Quebec City** | `https://quebec.gewi.com/wzdx/pull` | 3.1 | Public, no key. International. |
| **CivicLink CrewCast** | `https://road-connect-community-bry7272.replit.app/api/wzdx/work-zones.geojson` | 4.2 | Public; vendor/community feed |
| **Colorado CWZ** | `https://data.cotrip.org/api/v1/cwz?apiKey=` | **CWZ 1.0** | Same key as CDOT WZDx |
| **MassDOT CWZ** | `https://api.massdot-swzm.com/api/v1/cwz/work-zone-feed` | **CWZ 1.0** | API key required |
| **IDOT CWZ (Illinois state DOT)** | `https://wzad-idot.illinois.gov/cwz/01.00?api_key=` | **CWZ 1.0** | Brand-new (registered 2026-05-01). Free key. |
| **Illinois Tollway WZDx** | `https://tims2go.tollway.state.il.us/wzdx/v4.2?api_key=...` | 4.2 | Sister-feed to IDOT — confirm which Illinois feed we currently use |

---

## 2. Non-WZDx event feeds worth integrating

### 2a. Federal

| Feed | Type | URL | Auth | Why useful |
|---|---|---|---|---|
| **NWS Alerts API** | Weather alerts (CAP/JSON) | `https://api.weather.gov/alerts/active` | None | Authoritative road-impacting weather (winter storms, flash floods, fog). Critical for multi-state ops. |
| **NWS Forecast API** | Weather forecast / GeoJSON | `https://api.weather.gov` | User-Agent header only | Per-segment 72hr forecast for proactive routing |
| **NOAA MADIS RWIS** | Road-weather sensor obs | `https://madis.ncep.noaa.gov/madis_rwis_clarus.shtml` | DSA / agency sponsor | Pavement temp, freeze point, surface condition direct from state RWIS |
| **CBP Border Wait Times** | Border crossings | `https://bwt.cbp.gov/api/waittimes` | None | XML; commercial truck lanes broken out. Drop-in for freight corridor (TX/NM/AZ/CA/MI/NY/ME borders) |
| **FMCSA QCMobile** | Carrier safety | `https://mobile.fmcsa.dot.gov/QCDevsite/docs/qcApi` | Free Webkey | Carrier USDOT lookup, OOS status. Useful for incident enrichment |
| **NPS Road Events** | NPS work zones (WZDx-formatted) | `https://developer.nps.gov/api/v1/roadevents?type=workzone&api_key=` | Free key | **Highest-leverage single feed.** Fills WY/MT/TN/ME work-zone gaps via national parks |
| **NPMRDS via RITIS** | Probe travel-time | `https://npmrds.ritis.org/analytics/` | DSA — agency-sponsored | Gold standard for actual segment travel times |

### 2b. Crowdsourced / probe

| Feed | Type | Auth | Why useful |
|---|---|---|---|
| **Waze for Cities (CCP)** | Real-time incidents, jams, hazards | Free for DOTs/agencies — `waze.com/wazeforcities` | Two-way: get user-reported incidents (often minutes ahead of DOT detection); publish DOT alerts back to Waze users. **Single biggest crowdsourced fill-in for missing states.** |
| **INRIX** | Probe + incidents | Paid (typically state DOT contract) | Commercial — outside free-tier unless re-using a sponsor license |
| **HERE Traffic Feeds** (via Eastern Transportation Coalition) | Probe + incidents | Member agency only | Commercial; relevant only via TETC access |

### 2c. Regional / multi-state aggregators

| Feed | Coverage | URL | Auth | Why useful |
|---|---|---|---|---|
| **MAASTO TPIMS** | 8-state truck parking (IN, IA, KS, KY, MI, MN, OH, WI) | `https://trucksparkhere.com/developer-info/` | Public REST | Real-time stall counts at 100+ rest areas |
| **I-10 TPAS** | CA/AZ/NM/TX truck parking | `https://i10connects.com/overview-tpas` | Per-state feed | 37 sites along I-10 |
| **TN SmartPark** | TN truck parking with reservations | TDOT | Inquire | Reservation-aware — unique |
| **TRANSCOM XCM** | NY/NJ/CT/PA event aggregation | TRANSCOM members only | Member agency | Best regional fusion of NY/NJ/CT events (CT is otherwise dark) |
| **511.org Bay Area** | CA Bay Area Open511 events | `https://api.511.org/traffic/events?api_key=...&format=json` | Free key | Open511-formatted; sub-CA regional |
| **Caltrans CWWP2** | CA statewide ITS field data | `https://cwwp2.dot.ca.gov/documentation/qm/qm.htm` | Public | XML/JSON/CSV — incidents, lane closures, CMS, RWIS, chains |
| **VDOT SmarterRoads** | VA DOT all data feeds | `https://smarterroads.vdot.virginia.gov/` | Free registration | Beyond WZDx — incidents, signals, RWIS, sign messages |

---

## 3. CIFS / TMDD / CWZ producers (non-WZDx specs)

### CWZ 1.0 (Connected Work Zones) — emerging

| Producer | URL | Auth |
|---|---|---|
| **Colorado DOT (CDOT)** | `https://data.cotrip.org/api/v1/cwz?apiKey=` | Key required |
| **MassDOT** | `https://api.massdot-swzm.com/api/v1/cwz/work-zone-feed` | Key at `api-app.massdot-swzm.com` |
| **Illinois DOT (IDOT)** | `https://wzad-idot.illinois.gov/cwz/01.00?api_key=...` | Brand new — registered 2026-05-01 |
| **PurposeBuilt Systems (own feed)** | `https://us-central1-digital-traffic-control-f1cc2.cloudfunctions.net/getWZDxFeed` | — |

### CIFS (Common Incident Format Specification)

- **The Eastern Transportation Coalition** — CIFS feed is member-agency only. The dashboard's existing TETC CIFS integration is the canonical one. **No additional public CIFS producers** found in this scan.
- **City of Austin** Real-Time Traffic Incident Reports (`dx9v-zd7x` on data.austintexas.gov) — closest structural match to CIFS. Public Socrata.

### TMDD v3.03b

Center-to-center, not designed for public consumption. Most state DOTs speak TMDD internally to peer TMCs but do **not** publish it publicly. **No new public TMDD endpoints discovered.**

### SAE J2735 (V2X)

Real-time SAE J2735 over RSU/cellular is roadside infrastructure, not a web feed. Dashboard's current V2X integration (USDOT federal data) is the right scope.

---

## 4. Top 5 priority recommendations

Ranked by **(coverage gap × effort × reliability)**:

1. **Arizona 511 statewide WZDx** — `https://az511.com/api/wzdx`
   - Closes a top-15 state. Same Iteris pattern as feeds we already use. Free key. Heavy I-10/I-40 freight coverage. Effort: low.

2. **Alaska 511 WZDx** — `wzdxfielddevice` endpoint on `511.alaska.gov`
   - Only WZDx producer for entire Alaska. Same pattern. Effort: low.

3. **NPS Road Events (national)** — `https://developer.nps.gov/api/v1/roadevents?type=workzone&api_key=`
   - **Highest-leverage single feed.** Adds work zones in WY, MT, ME, TN, SC (Yellowstone, Glacier, Acadia, Smokies, Blue Ridge, etc.). Native WZDx 4.0. Free `nps.gov` developer key. Effort: low.

4. **Waze for Cities (CCP)** — apply at `waze.com/wazeforcities`
   - Single biggest qualitative gap closer for the 17 states with no DOT API. Two-way feed. Free. Approval is the slow step. Effort: medium.

5. **PennDOT RCRS data feed** — request via `pa.gov/services/penndot/request-access-to-transportation-related-data-feeds`
   - PA state DOT is the largest unclaimed corridor (we only have the Turnpike). Real-time incidents + roadwork + winter conditions. Free. Effort: medium (RCRS is not WZDx; closer to TMDD-derived JSON).

### Honorable mentions (rank 6–10)

6. **Illinois IDOT CWZ feed** (registered 2026-05-01) — verify whether the dashboard's existing Illinois pull is Tollway-only, and add this if so.
7. **MAASTO TPIMS expansion** — `trucksparkhere.com` covers truck parking across 8 Midwest states.
8. **Michigan DOT new WZDx endpoint** — verify our existing MI source is the v4 endpoint at `mdotridedata.state.mi.us`.
9. **511GA Events API** — Georgia is the largest state with no WZDx but with a usable Iteris JSON `events` endpoint. Custom adapter required.
10. **Caltrans CWWP2** — already have CA via MTC SF Bay; CWWP2 adds statewide field-data depth (CMS, RWIS, chain controls).

---

## Key references

- WZDx Feed Registry (live JSON API): `https://data.transportation.gov/resource/69qe-yiui.json?$limit=200`
- WZDx hub: `https://www.transportation.gov/av/data/wzdx`
- WZDx GitHub: `https://github.com/usdot-jpo-ode/wzdx`
- CWZ Standard: `https://www.ite.org/technical-resources/standards/cwz/`
- RITIS / NPMRDS access: `https://ritis.org/access`
- Waze for Cities: `https://www.waze.com/wazeforcities/`
- NPS Developer: `https://www.nps.gov/subjects/developer/get-started.htm`
- NWS API: `https://api.weather.gov`
- CBP Border Wait Times: `https://bwt.cbp.gov/api/waittimes`
- FMCSA QCMobile: `https://mobile.fmcsa.dot.gov/QCDevsite/docs/qcApi`
- MAASTO TPIMS: `https://trucksparkhere.com/developer-info/`
- AZ 511 dev docs: `https://www.az511.com/developers/doc`
- Alaska 511 dev docs: `https://511.alaska.gov/developers/doc`
- 511GA dev docs: `https://511ga.org/developers/doc`
- PennDOT data feed request: `https://www.pa.gov/services/penndot/request-access-to-transportation-related-data-feeds`

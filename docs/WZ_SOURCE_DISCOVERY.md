# Finding work-zone data a state already publishes

Where to look when a state's WZDx feed is missing, frozen, or thinner than its own data — and,
just as usefully, where **not** to look. Measured 2026-09-30.

Tools: `scripts/discover_state_wz_sources.js`, `scripts/generate_wzdx_from_511.js`,
`scripts/audit_cwz_conformance.js`.

## Why this exists

Utah is a registered WZDx publisher. Its feed returns HTTP 200, FHWA's registry lists it
`active` on a 15-minute cycle, and every one of its 744 events carries `event_status: "active"`.
It has served the same **2023-03-19** snapshot for ~1,291 days, so its live content is zero.
Nobody consuming it noticed, or nobody told them.

The assumption was that fixing it needed TMDD. It did not. UDOT already publishes the extents
and the impact classification; they were in a place nobody had looked.

## The channels, ranked by what they actually returned

| # | Channel | Yield |
|---|---|---|
| 1 | **IBI/one.network 511 `List/GetData/Construction`** | **Best. 4 new states.** |
| 2 | **A state's own ArcGIS Server / AGOL org** | Utah's best data; WV + DC LRS/closures |
| 3 | ArcGIS Online keyword search | Utah only; noise everywhere else |
| 4 | State 511 "API" paths (`api/v2/get/...`) | Nothing. All soft-404 HTML |

### 1. The 511 construction layer — the one that scales

`POST {base}/List/GetData/Construction` plus `GET {base}/map/mapIcons/Construction`, joined on
the list's `DT_RowId`. Keyless. The list caps a page at 100 rows whatever `length` asks, so page
on the count **returned**. `mapIcons` `location` is `[lat, lon]` — reversed from GeoJSON.

Found by testing the endpoint against every candidate 511 host rather than reasoning about which
platform each state runs:

| state | records | why it matters |
|---|---|---|
| **Alaska** | 245 | **no registered WZDx feed** — this becomes the feed |
| **Connecticut** | 47 | **no registered WZDx feed** — same |
| **Arizona** | 2,650 | registered feed exists; **not one record in it has an `update_date`** |
| **ME/NH/VT** | 289 | registered feed stamps every event **year 0001** |
| Utah, Georgia, Nevada, Idaho, Louisiana | — | covered previously |
| PA, NC, OR, SC, TN, WV, WY, MT, SD, AL, RI, DE, NM | — | endpoint absent |

Split a shared host on the record's **`state`** field. Not `area` — that is what the
*MessageSigns* layer on the same platform uses, and it is empty in the construction layer.
Reusing that mapping files all three New England states as one.

### 2. The state's own ArcGIS server — highest ceiling, lowest hit rate

Probe `{host}/arcgis/rest/services?f=pjson` directly. Hosts that answered, of 18 tried:

- **Utah** `roads.udot.utah.gov` — a full public LRS (`Read_Only_Public_LRS_Routes`,
  `Points2RefPost` coordinate→milepost GP service, `Mile_Point_*`). Separately, AGOL carries
  `Traffic Events View` (UPlan), which is where Utah's extents live.
- **West Virginia** `gis.transportation.wv.gov` — `Roads_And_Highways/Publication_LRS` (Esri
  Roads & Highways). An LRS, so useful for geometry; **no work-zone layer**.
- **DC** `maps2.dcgis.dc.gov` — `FEEDS/DDOT/MapServer/12` "Construction Permit – Last 30 Days"
  (3,240 records, point, permit-shaped: `EFFECTIVEDATE`/`EXPIRATIONDATE`/`WORKDETAIL`, no route
  or direction) and `DDOT/HSEMA_RoadClosures` (Road Closures polyline, Road Detours 140).
- Oregon, Rhode Island, Tennessee AGOL orgs answered but hold no state work-zone layer —
  Tennessee's is Nashville Metro, not TDOT.

### 3. ArcGIS Online keyword search — do not trust it

`scripts/discover_state_wz_sources.js` searches per state, probes each candidate's **field
list** (titles lie), and scores on lanes / extent / milepost / updated / impact / direction. It
was validated by having it rediscover both Utah services unaided at top score.

Across 19 states it returned candidates for 4, and **three are junk**: Oregon's hit is an *Ohio*
layer with 1 record, South Carolina's is a gmail-owned copy, Arkansas's is a regional Waze
platform. Utah was exceptional.

### 4. State 511 API paths — a dead channel

16 endpoint guesses across AL, AR, MT, OR, RI, SC, SD, TN, WV, WY, DC. Several return **HTTP
200 with HTML** — a soft 404 that reads as success to anything checking status codes. None
returned JSON.

## Bonus finding: the Esri "Road Closures" solution, 613 deployments

Iowa's closure layer is `RoadClosures_public`. So is DC's HSEMA layer, and one in Tennessee's
org — because it is an **Esri Solutions template**, and therefore discoverable by name.

`node scripts/discover_state_wz_sources.js --roadclosures` → **613 distinct feature services.**
A 40-service sample, probed live:

- 33/40 responded with the template schema (`street`, `direction`, `starttime`, `endtime`,
  `description`, `altroute`, `activeincid`, `subtype`)
- **33/33 POLYLINE** — real extents, not pins
- 24/33 had live records; **812 closures** across the sample
- extrapolating, roughly 9–12k closures nationally

**The catch, and it is the whole point: zero of the 613 are state DOTs.** They are cities and
counties — Guilford County NC, Raleigh, King County WA, Worcester, Manatee County FL, Moose Jaw.
Searching for target states returns false positives: a city in Oregon, a person named Dakota in
Wisconsin, a city in Alabama.

So this does **not** fill a state's missing WZDx feed. What it is instead is the layer WZDx
structurally does not cover — **local** road closures, one uniform schema, keyless, with
geometry and times. Worth its own decision, not a substitute for a state feed.

## Where the 13 remaining states stand

AL, AR, MT, OR, RI, SC, SD, TN, WV, WY and DC have **no public state work-zone feed** reachable
by any of the four channels. Options, in order of effort:

1. **HaulHub** publishes for AL, AR, CT, MT, ND, OR, RI, SC, TN, WV, WY. Honest limits: it is a
   contractor subset, an event is a 2-hour activity window so instantaneous counts are tiny
   (AL 2, AR 1, RI 12, SC 2, TN 1, WV 3 on 2026-09-29), and using a HaulHub feed as a state's
   work-zone source **disqualifies it as an independent validator for that state** — see
   `services/haulhub-worker-presence.js` on why DE and LA are excluded there.
2. **A free key** — Oregon's ODOT feed is registered and key-gated; ask rather than probe.
3. **The WZDx DIY kit route** (`docs/wzdx-diy/`), already proven for Nebraska and Nevada.
4. **TMDD / direct ATMS.** Still the route to lane detail *in Utah*, where `LaneImpact` and
   `LanesAffected` are populated on every record with the literal string `"No Data"`.

   **Corrected 2026-09-30:** the broader claim — that no public state source carries lane
   detail — was wrong. **Alabama publishes it.** Every one of its 148 roadwork events carries
   `laneDirections`: per-lane `state`, `type` and `placement`, 932 lanes in total with 73
   `Closed` across 28 events. It maps onto the WZDx `lanes` array directly. The claim was
   generalised from the states examined at the time, and Alabama had been written off before
   its API was found.

### Alabama — and why "nothing public" was wrong

Recorded here as having nothing. It has one of the better event APIs found anywhere, and the
reason it was missed is the same reason twice over:

- its 511 landing page is a **2.2 KB SPA shell**, so scanning page HTML sees nothing;
- ALGO Traffic versions its API **per resource, not per host**, so `/v3/Cameras`,
  `/v3.0/Cameras` and `/v2/Cameras` all 404 while `/v4.0/Cameras` returns 636.

Guessing resource names produced 404s on `Incidents`, `Constructions`, `Events`, `RoadWork`
and `LaneClosures`. What worked was resolving the bundle's own URL templates: it builds
`${base}/${version}/${map.trafficEvents}`, where the map resolves `trafficEvents` →
`TrafficEvents` and the version variable is `v3.0`.

| endpoint | content |
|---|---|
| `api.algotraffic.com/v3.0/TrafficEvents` | 217 events — **Roadwork 148**, Incident 60, Crash 7, Facility 2 |
| `api.algotraffic.com/v4.0/Cameras` | 636 (629 public, 307 interstate) |
| `api.algotraffic.com/v3/MessageSigns` | 72 DMS, 54 displaying, **milepost on all 71 usable** |

The roadwork set is better than most WZDx feeds: all 148 active and updated today, **148/148
with a start milepost**, **133/148 with an `endLocation`** (a real two-point extent, not a pin),
and **148/148 with lane detail**. 35 are on interstates and now ingest.

Two things deliberately not used: the bundle embeds a 551-entry camera array and a client API
token. The live `v4.0` endpoint makes parsing a hash-named bundle unnecessary — that filename
changes every deploy — and every endpoint used answers unauthenticated, so building on someone's
embedded browser credential was never necessary.

**The method that works, in order:** read the 511 page's JS bundle and resolve its URL
templates → probe the state's own ArcGIS server → then, and only then, guess.

## Rules earned the hard way

- **Field presence is not field population.** Three errors this way in one session: Utah's
  restriction fields exist and are empty; `EventCategory` looked uniform and is a mix of seven
  values; `LaneImpact` is populated on every record with `"No Data"`.
- **Distrust a join that looks generous.** A first check said 255 of 279 Utah records joined for
  `start_date`. False: 208 empty `Location` values were matching 511 records with an empty
  `locationDescription`. Guarding the empty key is what made the number real (47).
- **A rich source may be a subset, not a superset.** UPlan has the extents, so it looked like the
  better base — but only 71 of its 279 records carry a `Location`, and building on it left
  `start_date` (required) missing on 224 of 271. The thin source with complete dates is the base;
  the rich one enriches.
- **Registry membership, HTTP 200, and `event_status: "active"` each say nothing about liveness.**
  Measure the newest `update_date`, per `data_source_id` — Washington's `WSDOT-WZDB` is current
  while `WSDOT-CIA` is 851 days stale, and at feed level they average to "fresh".
- **Always include a known-good control when probing.** An early sweep reported zero device feeds
  nationally, Washington's included, because Python's cert store here fails
  `CERTIFICATE_VERIFY_FAILED` and every request collapsed into the same empty result. A probe that
  reaches nothing is indistinguishable from one that finds nothing.

## Catching the next one: `scripts/feed_health_check.js`

Everything above was found by accident in one afternoon, and all of it was months or years old.
This is the scheduled version. It says nothing when nothing is wrong, and reports three states —
OK / PROBLEM / NOT EVALUATED — so an unreachable feed is never counted as healthy.

    node scripts/feed_health_check.js --state /data/feed_health.json

Exit codes: `0` healthy · `1` a source went stale or its count fell sharply · `2` a feed is
unreachable, unparseable, or a source's zones went to zero. Pass `--state <path>` on a persistent
volume to enable count-drop detection (it needs the previous run to compare against). Tunable with
`STALE_SOURCE_DAYS` (default 30) and `DROP_PCT` (default 40).

Two classification rules it earned immediately:

- **A 200 is not success.** Several state 511 hosts answer `200` with an HTML error page, which
  reads as healthy to anything checking only a status code. The check rejects a body that starts
  with `<`.
- **401/403 is missing credentials, not an outage.** Texas passes its key as a request parameter,
  so sniffing the URL for `key=` misses it and produced a false CRITICAL. A nightly job that cries
  wolf is a nightly job nobody reads.

**What the first run found that the manual audit had missed: Florida has 11 frozen sub-publishers**,
including 1,815 zones frozen 112 days and 724 frozen 61 days. Florida's feed is a one.network
aggregate of 49 sources, so individual municipal publishers die while the feed as a whole looks
current — invisible at feed level, which is the point of measuring per source.

### But how stale is stale? Corrected 2026-09-30

I first read Florida's raw counts as "worse than Utah". That was wrong, and the correction is the
more useful finding. Of Florida's 2,564 stale-source features:

- `event_status` is **completed 1,744 / pending 764 / active 56**. Florida publishes an archival
  record, not phantom active zones — unlike Utah, where all 744 say `active`.
- every one carries an `end_date`, and **1,726 have already passed** (median 68 days ago), so the
  ingest's 2-day past-end grace filter already removes them.
- the 764 `pending` are **3 distinct locations**: 382 features on Cocoanut Avenue and 382 on
  Fruitville Road, all from one Sarasota publisher. That is ~2 real zones expanded into 382
  recurrence instances each, not 764 zones.
- **zero are on an interstate**, so the interstate filter excludes all of them anyway.

So the honest exposure across every frozen publisher found:

| source | zones | days frozen | claim `active` | on an interstate | reaches our feed |
|---|---|---|---|---|---|
| Utah (both sources) | 744 | 1,291 | 744 | **18** | **18** |
| Florida (11 sources) | 2,564 | 32–237 | 56 | 0 | **0** |
| WSDOT-CIA | 370 | 851 | **0** | 0 | **0** |

The whole problem is **18 Utah zones**. Raw counts from a frozen publisher say nothing until they
are filtered by what the records actually claim and whether the pipeline would carry them.

### Adjudicating them with cameras

Cameras are the right instrument for this specific job, and not for a general reason: camera
validation is the **only demotable source** in the stack. Every other validator is positive-only
and sticky by design, so nothing else can express "this zone is finished" — which is exactly the
question a frozen publisher raises.

Measured: all **18/18** of Utah's frozen-but-active interstate zones have a camera within 500 m
(2,081 UT cameras available), at 18 distinct locations. So 18 vision calls settle a 1,291-day
question. TomTom is the fallback where no camera adapter exists — Washington has none — and it is
live and nationwide via zone-derived tiles, though budget-capped by `TOMTOM_DAILY_BUDGET`.

### The 18 adjudicated — camera results, 2026-09-30 01:38 MDT

The 18 features are **10 physical projects**: eight are published twice as directional pairs.
Nearest camera to the closest point of each zone: **8–195 m**, all ten inside or beside the
project limits.

| # | route | UDOT project | camera verdict |
|---|---|---|---|
| 1 | I-215 E | improve I-215 E between 3300 S and 4500 S | **clear** — open lanes, no cones, barrier or equipment |
| 2 | I-15 MP 122 | *(no description in feed)* | **clear** — rural, open |
| 3 | I-15 University Ave | replace/refresh pavement markings | **clear** |
| 4 | I-15 1800 S | highway sign replacement | **clear** |
| 5 | I-84 MP 109 | pavement preservation, 19 bridges | **clear** |
| 6 | I-80 2200 E | improve I-80 between 1300 E and 2300 E | **clear** |
| 7 | I-80 Echo | EB/WB I-80 bridge improvement | NOT EVALUATED — placeholder image |
| 8 | I-15 Parrish Ln | removing damaged concrete panels, Davis County | **likely ACTIVE** — orange barrels/delineators, darkened lane |
| 9 | I-84 Devils Slide | Weber River bridge reconstruction, Croydon | NOT EVALUATED — blown out by headlight glare |
| 10 | I-70 | safety/service-life project | NOT EVALUATED — placeholder image |

**6 clear · 1 likely active · 3 not evaluated.**

What this does and does not show. Every image is 01:38 local, so the absence of *workers* proves
nothing — nobody is paving at 2am. What it does show is the absence of work-zone *infrastructure*:
cones, drums, temporary barrier, lane shifts. A multi-month reconstruction leaves those in place
24 hours a day, so their absence at a camera **inside the project limits** is real evidence the
project is finished or dormant. It is not proof of completion: a project spanning 3300 S to 4500 S
could have work a mile from the camera.

Three further cautions, each of which would have produced a wrong answer if ignored:

- **Proximity is not visibility.** #10's nearest camera at 195 m is *"I-15 SB @ I-70 Interchange"* —
  it points at I-15, not at the I-70 zone it was matched to. A distance match says a camera is
  near, not that it is looking at the right road.
- **Two of the ten images were the same file.** #7 and #10 are byte-identical placeholders (md5
  `585afd07…`). A pipeline that does not hash images would have scored an "unavailable" graphic as
  a clean look at the road, twice.
- **First-vertex distance is not zone distance.** Measuring from each zone's first vertex put five
  zones over 1 km from a camera; measuring to the nearest point of the geometry put all eighteen
  under 500 m. The second is the operationally relevant number, and it is the one that decides
  whether a zone is adjudicable at all.

This was a manual visual assessment, not a run of the platform's vision pipeline. The right
production shape is the existing camera ledger, which is the only **demotable** source in the
stack: these six would be marked `suspect-inactive` with imagery attached, which is exactly the
claim the evidence supports — and exactly what no other validator can express.


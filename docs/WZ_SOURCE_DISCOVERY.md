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
4. **TMDD / direct ATMS**, which is the only route to **lane detail** anywhere. No public source
   in any state examined carries it: Utah populates `LaneImpact` and `LanesAffected` on every
   record with the literal string `"No Data"`.

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

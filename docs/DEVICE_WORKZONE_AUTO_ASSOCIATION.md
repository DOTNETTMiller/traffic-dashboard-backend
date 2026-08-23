# Connected Device ↔ Work Zone Auto-Association

Automatically links connected field devices — iCone / Ver-Mac **arrow boards** and
**portable message signs** — to the work-zone event they belong to, and shows *where* and
*why* each link was made. This replaces the manual process of eyeballing which board goes
with which closure.

## The problem it fixes

A connected arrow board is almost never *at* the work zone. It sits **upstream in the travel
direction** — in the advance-warning area or the taper, often a quarter to half a mile ahead
of the closure. On a divided highway the two carriageways sit ~100 ft apart. So a naive
"nearest device" match:

- grabs a zone the board is actually *downstream* of (traffic already passed it),
- grabs a zone on the **opposite carriageway**, or
- misses entirely because the board is "too far" from the zone geometry.

Those are exactly the judgment calls a human was making by eye. The association is a
**multi-signal match**, not a distance check.

## How it works — a cascade of gates, then a score

For each device, every candidate event runs through gates (any failure rejects the
candidate), then survivors are scored and the best is kept.

1. **Route** *(gate)* — the device route, normalized (`I 380` → `I-380`, and `RAMP: I 80E TO
   100TH STREET` → `I-80`), must equal the event's corridor.
2. **Direction** *(gate)* — the board's carriageway (`N/S/E/W`) must match the event's;
   opposite carriageways are rejected. `Both`/unknown pass through.
3. **Proximity** *(gate + score)* — the device is snapped onto the event's road-following
   `LineString` (perpendicular distance, or distance to the nearest end for a board just off
   the end), or measured to a point event. Beyond `maxMatchM` (default 1600 m ≈ 1 mi) →
   rejected; closer → higher score.
4. **Upstream** *(gate)* — the bearing device→zone must point roughly the way that traffic is
   heading (within ~100°). This rejects a board the traffic has already passed. Skipped when
   the device is *alongside* the zone (inside the work area) or direction is unknown.
5. **Temporal** *(score)* — the device must be reporting recently (`freshnessHours`, default
   2 h) and, ideally, within the event's active window.
6. **Deployment state (is it on?)** *(score + auto gate)* — the board's `msgtext` tells us
   whether it's actively displaying an arrow/chevron/caution or blank/off. Each link carries an
   `on` flag.

**Auto-link is gated on on + close.** An off/blank board, or one farther than `farM` (800 m,
~½ mi), still *matches* but is held in the **review queue** instead of auto-linking — a blank
board isn't actively marking a zone, and a far one isn't certain. `off`/`far` don't lower the
confidence score (it stays an honest measure); they just block auto so a human confirms (so a
1,200 m board lands in review even at 81%). Toggle with `requireOnForAuto` / `farM`.

**Confidence** = 40 (route) + up to 25 (direction) + up to 25 (proximity) + 5 (temporal) +
5 (deployment). Outcomes:

| Confidence | Outcome |
|---|---|
| **≥ 75** | **auto-link** |
| 60–74 | **review queue** — surfaced for a human, never silently linked |
| < 60 | unmatched |

Every decision carries **human-readable reasons** (e.g. `route I-80 · dir W · 163m from zone
· upstream · device live · within event window · displaying: ROADWORK AHEAD LEFT LANES
CLOSED`).

## Where each match was made

So you can see and audit the association, every link records the geometry of the match:

- `deviceCoord` — the board's position (WGS84 `[lon, lat]`).
- `zoneRef` — the exact point **on the zone** the board links to.
- `connector` — a 2-point line `[deviceCoord, zoneRef]`, drawn on the map as a dashed
  leader so the link is visible at a glance.
- `distanceM` + `reasons` — how far, and on what basis.

## Output

- **On the event** — matched devices are written back as
  `event.x_connected_devices = [{ device_id, device_type, confidence }]` (WZDx-Device-Feed
  style). The match confidence is also usable as a corroboration signal for
  `services/event-confidence.js`.
- **`GET /api/devices`** — the live device roster plus:
  - `links[]` — auto-links (≥75%), each with the where/why fields above.
  - `review[]` — the 60–74% band for human confirmation.
  - `devices[]` — every device with `matched`, `road_event_id`, `confidence`.
  - `counts` — `{ devices, autoLinked, review, unmatched }`.
- **Map layer** — "Connected Arrow Boards" toggle (NavSidebar). Green = auto-linked, amber =
  review, grey = unmatched; a dashed connector runs to the matched zone; the popup shows the
  board's live message and the full match basis.
- **`GET /api/cwz/devices`** — a **CWZ 1.0 / WZDx v4.2 Device Feed** (see below).

## CWZ 1.0 / WZDx Device Feed output

CWZ 1.0 (ITE, 2024) is built on the WZDx v4.x Device Feed and maps device data concepts to
NTCIP 1218/1203. The device→work-zone link this system computes is exactly the
`road_event_ids` a CWZ Device Feed carries, so `GET /api/cwz/devices` emits a standards-native
`FeatureCollection` (`services/cwz-device-feed.js`):

- `feed_info` — `update_date`, `publisher`, `version` (WZDx base), `x_cwz_profile: "CWZ 1.0"`,
  `update_frequency`, contact, and `data_sources`.
- Each device is a **FieldDevice** feature with `core_details` (`device_type`, `data_source_id`,
  `device_status` = ok/warning/unknown from freshness, `update_date`, `has_automatic_location`,
  `road_names`, `road_direction`, and **`road_event_ids`** = the auto-linked zones).
  - **arrow-board** → `pattern` (ArrowBoardPattern, mapped from the board's `msgtext`, e.g.
    `left-chevron-sequential`) + `is_in_transport_position`.
  - **dynamic-message-sign** → `message_multi_string` (the NTCIP 1203 MULTI string from the feed).
- The match basis rides along as WZDx vendor extensions: `x_match_confidence`,
  `x_match_distance_m`, `x_match_basis`.

Validated: 100 features (61 arrow-board + 39 DMS), 0 schema violations, `road_event_ids`
populated for every auto-linked device. Full connected-vehicle *broadcast* (SAE J2735 TIM over
RSUs) is a separate hardware layer beyond this data feed; registration is with USDOT ITS DataHub.

## Elevating connected work zones (CWZ)

A work zone with a confirmed connected device present is a higher-confidence, *connected* work
zone. `annotateEvents` therefore **elevates** each matched event in place — the fields flow
through the normal `/api/events` feed (they survive `slimEvent`), so every consumer sees the
promotion:

- `x_cwz_connected: true`
- `x_connected_device_count`, `x_connected_confidence` (strongest link), `x_connection_status`
- `x_connected_devices` (the linked device list)

**Two-way validation (device as ground truth).** A WZDx event is a *claim*; a live connected
board is *physical* evidence. So the annotation validates in both directions:
- **`x_zone_activity: 'confirmed-active'`** — an on + close device confirms the claimed zone is
  actually deployed right now (the elevated/positive case).
- **`x_zone_activity: 'suspect-inactive'`** — a device is present at the claimed zone but is
  **off/blank** (not displaying) → the zone is likely stale/torn-down. Surfaced on the map
  (amber dashed ring), in `/api/events` (`x_offline_devices`), and in `/api/devices/health`
  (`suspectInactive`). Events with no nearby device are left unflagged (unconfirmed — we can't
  say either way; positive matches confirm presence, they don't prove absence).

Two ways it surfaces:

- **`GET /api/cwz/events`** — a CWZ 1.0 / WZDx **RoadEvent** feed (`services/cwz-roadevent-feed.js`)
  containing only the elevated work zones as `WorkZoneRoadEvent` features, tagged
  `x_cwz_profile: "CWZ 1.0"`, with `is_start_position_verified: true` (the device confirms the
  zone) and the device linkage. This is the RoadEvent half of CWZ 1.0 — the companion to the
  Device feed at `/api/cwz/devices`.
- **Web map** — connected work zones get a green dashed **ring** (`TrafficMap.jsx`, rendered
  outside the marker cluster so they stand out at a glance) with a tooltip: "🔗 Connected Work
  Zone (CWZ 1.0) · N devices · NN%". Visible whenever Events are shown — no toggle needed.

## Validation monitoring

Because an auto-link can be plausible-but-wrong, `services/device-validation.js` runs
alongside the matcher (lazily, when a device endpoint is opened — no separate loop) and validates every link
against **independent** signals the matcher did not use, then rolls the results into health
metrics. Served at **`GET /api/devices/health`**.

Per-link checks → `pass` / `warn` / `fail`:

- **self-location agreement** *(independent)* — many devices embed their own route/direction/
  milepost in their name (`SS2426 - I-35 NB @ MM 71.6`). The matcher keyed off the feed's
  Route/Direction fields, so the name is an independent check. A route mismatch is a **fail**.
- **message vs zone type** — a board reading "REST AREA CLOSED" linked to a plain construction
  zone is flagged (this catches the IPSIR-906 case).
- **temporal** — device reported within the zone's active window.
- **distance / direction sanity** — links beyond 800 m, or made without a known carriageway
  ("dir both"), are downgraded to **warn**.

Aggregate metrics in the summary:

- **feed** — `ok` (DMS_View returning data), device count, `stale` share, how many displaying.
  A `devices: 0` here is the "feed broke" signal, distinct from a healthy-but-quiet feed.
- **matching** — auto-linked / review / unmatched, `matchRate`, `avgConfidence`.
- **validation** — `pass` / `warn` / `fail` counts and `passRate`.
- **coverage** — work zones total vs. `zonesWithDevice` and `coverageRate` (how instrumented
  the network is — most zones have no connected device, which is itself worth tracking).

A **trend** records device count, match rate, avg confidence, warn/fail counts, and coverage
over time, so a regression (feed drop, match-rate collapse, rising anomalies) is visible. It is
**persisted to SQLite** (`services/device-health-store.js`, table `device_health_snapshots`,
created lazily; last ~288 snapshots returned) so it survives restarts, with the in-memory copy
as a fallback.

**Frontend panel** — `DeviceValidationPanel.jsx`, opened from the NavSidebar "Device Validation
Monitor" (🩺) item. It loads `/api/devices/health` once and shows the feed/matching/validation/
coverage stat cards, trend sparklines (auto-linked, avg confidence, match rate), and the
anomaly list with per-link flags.

Live sample: 100 devices (0 stale, 98 displaying), 10 auto-linked, validation 4✓/6⚠/0✗ — the
warnings being the far/rest-area/out-of-window links, exactly the ones worth a human glance.

## The live feed

Iowa DOT publishes the devices on the **`DMS_View`** FeatureServer (no auth):

```
https://services.arcgis.com/8lRhdTsQyJpO52F1/ArcGIS/rest/services/DMS_View/FeatureServer/0/query
  ?where=1=1&outFields=DeviceName,Route,Direction,SignType,msgtext,lat_,long_,EditDate
  &returnGeometry=false&f=json&resultRecordCount=2000
```

It carries fixed overhead DMS *and* the `SignType = 'Portable-Contractor'` iCone units (the
arrow boards). We ingest the portable units for work-zone association.

> **Gotcha:** `DMS_View` returns its `geometry` in **Web Mercator**, but the WGS84
> coordinates live in the **`lat_` / `long_` attribute** fields. Request
> `returnGeometry=false` and read the attributes — reading `geometry.x/y` as degrees places
> every device thousands of miles away. `EditDate` is epoch **ms**.

## Where it runs

- `services/device-workzone-matcher.js` — the matching logic (route/direction/proximity/
  upstream/temporal/deployment scoring). Self-tests with `node services/device-workzone-matcher.js`.
- `services/device-ingest.js` — pulls and normalizes `DMS_View`.
- `backend_proxy_server.js` — **EXPERIMENTAL, lazy:** `ensureDeviceMatch()` runs the whole
  pipeline (ingest → match → RAMS → validate → annotate the cached events → store in
  `devicesCache`) **only when a user opens a device endpoint** (`/api/devices`,
  `/api/devices/health`, `/api/cwz/devices`, `/api/cwz/events`), cached for 3 min. It is
  intentionally NOT run on the shared/automatic event refresh, so it costs nothing when nobody
  is looking at it. Disable entirely with `DISABLE_DEVICE_MATCH=true`.
- `frontend/src/components/ConnectedDevicesLayer.jsx` — the map layer.

## Lineage and next work

The upstream-gating logic is adapted from **Field Escort** (`field-escort-connect/src/
advisories.js`), which selects retaskable devices upstream of moving equipment by route +
direction + upstream sector.

**RAMS chainage precision.** ✅ Done — `services/rams-chainage.js` snaps both the device and
the zone onto the Iowa RAMS `Road_Network` centerline
(`https://gis.iowadot.gov/agshost/rest/services/RAMS/Road_Network/FeatureServer/0`, M-aware
polylines, measures in miles) and, when both resolve to the **same `ROUTEID`**, returns the
true along-road distance by subtracting interpolated mileposts — falling back to straight-line
otherwise, never mixing the two. It runs as a fail-safe **refinement pass** after matching
(warms every point's measure in parallel — ~360 ms for a full pass, cached across refreshes),
re-checks the `far` gate against real road distance (demoting a link to review if the road
distance exceeds `farM`), and adds an independent **same-`ROUTEID`** confirmation. Each link
carries `distance_basis` (`route-measure`/`straight-line`), `chainageM`, and `sameRouteId`;
validation prefers the chainage distance when present. Any RAMS outage degrades silently to
straight-line. Disable with `DISABLE_RAMS_CHAINAGE=true`.

**WZDx / CWZ Device Feed.** ✅ Done — `GET /api/cwz/devices` emits it (see "CWZ 1.0 / WZDx
Device Feed output" above). Each state supplies its own device feed; the matcher itself is
state-agnostic.

## Tuning knobs (`DEFAULTS` in the matcher)

| Knob | Default | Meaning |
|---|---|---|
| `maxMatchM` | 1600 | furthest a device can be from a zone and still match (~1 mi) |
| `fullSpatialM` | 150 | at/under this the board is treated as *on* the zone |
| `freshnessHours` | 2 | device must have reported within this to count as live |
| `farM` | 800 | beyond this a link is held for review, never auto-linked |
| `requireOnForAuto` | true | a blank/off board can match but never auto-links |
| `autoThreshold` | 75 | ≥ this → auto-link |
| `reviewThreshold` | 60 | [review, auto) → surfaced for human confirmation |

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
6. **Deployment state** *(score)* — a board actively displaying an arrow/chevron/caution
   (from its `msgtext`) scores higher than a blank/staged one.

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
- `backend_proxy_server.js` — during each event-cache refresh (`fetchAndCacheEvents`), it
  ingests devices, matches against the Iowa events, annotates the cached events, and stores
  the roster/links/review in `devicesCache`. Disable with `DISABLE_DEVICE_MATCH=true`.
- `frontend/src/components/ConnectedDevicesLayer.jsx` — the map layer.

## Lineage and next work

The upstream-gating logic is adapted from **Field Escort** (`field-escort-connect/src/
advisories.js`), which selects retaskable devices upstream of moving equipment by route +
direction + upstream sector.

**Phase 2 — chainage precision.** Distance is currently straight-line / perpendicular. Field
Escort's more precise approach snaps both the device and the zone onto the Iowa RAMS
`Road_Network` centerline
(`https://gis.iowadot.gov/agshost/rest/services/RAMS/Road_Network/FeatureServer/0`, point
query, 150 m radius → `ROUTEID`, `FROMMEASURE`, `TOMEASURE`) and, when they resolve to the
**same `ROUTEID`**, subtracts linear-reference measures for a true along-road upstream
distance (falling back to straight-line otherwise, never mixing the two). This would tighten
the longer matches (the ~950–1200 m ones).

**WZDx Device Feed.** Emitting each device as a WZDx field device with `road_event_id` set to
its matched zone turns this into a standards-native, shareable kit for other states — each of
which would supply its own device feed; the matcher itself is state-agnostic.

## Tuning knobs (`DEFAULTS` in the matcher)

| Knob | Default | Meaning |
|---|---|---|
| `maxMatchM` | 1600 | furthest a device can be from a zone and still match (~1 mi) |
| `fullSpatialM` | 150 | at/under this the board is treated as *on* the zone |
| `freshnessHours` | 2 | device must have reported within this to count as live |
| `autoThreshold` | 75 | ≥ this → auto-link |
| `reviewThreshold` | 60 | [review, auto) → surfaced for human confirmation |

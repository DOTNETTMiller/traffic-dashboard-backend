# Connected Device ↔ Work Zone Auto-Association — Setup & Implementation Guide

How to stand up automatic association of connected field devices (iCone/Ver-Mac arrow boards,
portable message signs) to the work-zone events they belong to — with validation monitoring and
a CWZ 1.0 / WZDx Device Feed output. Written so another agency can adapt it to their own device
feed; the matcher itself is **state-agnostic**.

For *how it works conceptually*, see `DEVICE_WORKZONE_AUTO_ASSOCIATION.md`. This document is the
build/setup recipe.

---

## 1. Architecture

```
 device feed (ArcGIS/JSON/MQTT)          work-zone events (WZDx / your feed)
            │                                         │
            ▼                                         │
   device-ingest.js  ──normalized devices──►          │
                                            ▼         ▼
                              device-workzone-matcher.js   (route→direction→proximity→
                                            │               upstream→temporal→deployment)
                        ┌───────────────────┼───────────────────┐
                        ▼                   ▼                   ▼
                  links / review      annotateEvents()    device-validation.js
                        │            (x_connected_devices)   (pass/warn/fail + health)
                        ▼                                       │
        ┌───────────────┼──────────────────┐          device-health-store.js (SQLite trend)
        ▼               ▼                  ▼                    │
  GET /api/devices  GET /api/cwz/devices  GET /api/devices/health ◄──┘
        │               │                  │
        └────────── frontend: ConnectedDevicesLayer + DeviceValidationPanel ──────────┘
```

Everything runs **on the existing event-cache refresh** — no separate timer or polling loop.

---

## 2. Prerequisites

- Node.js 18+
- npm packages: `axios`, `@turf/turf` (matcher geometry), `better-sqlite3` (trend persistence)
  ```
  npm install axios @turf/turf better-sqlite3
  ```
- A **connected-device feed** with, per device: an id, a route, a direction, a WGS84 position,
  and ideally a live status/message + timestamp.
- A **work-zone event source** with, per event: an id, a route/corridor, a direction, and
  geometry (a road-following `LineString` is ideal; a point works with lower precision) plus a
  start/end time. A WZDx 4.x RoadEvent feed is the natural source.

---

## 3. The data contract

The matcher consumes **normalized devices** and **events**. Your only per-agency work is
producing these two shapes; everything downstream is generic.

### Normalized device
```js
{
  id: 'A16BEB Solar Tech - AB',   // stable unique id (its own name is fine)
  deviceType: 'arrow-board',      // 'arrow-board' | 'dms'
  route: 'I-29',                  // normalized route (see normalizeRoute)
  direction: 'N',                 // 'N' | 'S' | 'E' | 'W' | 'BOTH' | null
  coordinates: [-95.80119, 40.98686], // [lon, lat], WGS84
  mode: { displaying: true, pattern: 'Left Chevron, sequential' }, // live state
  updated: '2026-08-21T03:19:06.500Z', // ISO timestamp of last report
  signType: 'Portable-Contractor',     // optional
  ntcip: '[jp2][jl3]...'               // optional NTCIP 1203 MULTI (for CWZ DMS feed)
}
```

### Event (what the matcher reads)
```js
{
  id: 'IO-OpenTMS-Event23395705125',
  corridor: 'I-29',               // or .route
  direction: 'northbound',        // any casing; normalized internally
  geometry: { type: 'LineString', coordinates: [[lon,lat], ...] }, // or a Point
  coordinates: [lon, lat],        // fallback if no geometry
  startTime: '...', endTime: '...' // or startDate/endDate
}
```

---

## 4. Install the service files

Copy these from `services/` (each is self-contained and documented at the top):

| File | Responsibility |
|---|---|
| `device-workzone-matcher.js` | the matching + scoring (state-agnostic). `matchDevices`, `annotateEvents`, `deviceFromFeature`, `selftest`, `DEFAULTS` |
| `device-ingest.js` | **agency-specific**: fetch your device feed → normalized devices |
| `device-validation.js` | per-link cross-checks + health metrics (`validate`, `appendTrend`) |
| `device-health-store.js` | persist the trend to SQLite (`record`, `trend`) |
| `cwz-device-feed.js` | emit a CWZ 1.0 / WZDx Device Feed (`buildFeed`) |

The only file you rewrite for a new agency is **`device-ingest.js`**.

---

## 5. Write your ingest (the one agency-specific file)

Fetch your feed and return normalized devices. Reuse the matcher's `deviceFromFeature` if your
feed resembles the Iowa DOT `DMS_View` shape; otherwise map fields yourself. Example (Iowa):

```js
const https = require('https');
const matcher = require('./device-workzone-matcher');

const FEED_URL = 'https://services.arcgis.com/.../DMS_View/FeatureServer/0/query'
  + '?where=1=1&outFields=DeviceName,Route,Direction,SignType,msgtext,NTCIP,lat_,long_,EditDate'
  + '&returnGeometry=false&f=json&resultRecordCount=2000';

async function fetchDevices() {
  const j = await getJSON(FEED_URL);               // small https GET → JSON
  const devices = [];
  for (const f of (j.features || [])) {
    const a = { ...f.attributes };
    if (typeof a.EditDate === 'number') a.EditDate = new Date(a.EditDate).toISOString();
    const isPortable = /Portable-Contractor/i.test(a.SignType || '') || /-\s*AB\b/i.test(a.DeviceName || '');
    if (!isPortable) continue;                       // keep the work-zone-deployed units
    const d = matcher.deviceFromFeature({ properties: a });
    if (!d.coordinates) continue;
    d.signType = a.SignType || null;
    d.ntcip = a.NTCIP || null;
    devices.push(d);
  }
  return devices;
}
```

> **Coordinate gotcha:** many ArcGIS device layers return `geometry` in **Web Mercator** while
> the WGS84 lat/lon live in **attribute** fields (`lat_`/`long_`). Request `returnGeometry=false`
> and read the attributes, or every device lands thousands of miles off.

---

## 6. Wire it into your server refresh

Wherever you already build your event cache, add the match/validate/persist block **after** the
events are assembled (they must be shared references so `annotateEvents` reaches your cache):

```js
if (process.env.DISABLE_DEVICE_MATCH !== 'true') {
  try {
    const ingest     = require('./services/device-ingest');
    const matcher    = require('./services/device-workzone-matcher');
    const validation = require('./services/device-validation');
    const store      = require('./services/device-health-store');

    const devices = await ingest.fetchDevices();
    const events  = activeEvents.filter(e => /* your state's events */ true);

    const match = matcher.matchDevices(devices, events);
    matcher.annotateEvents(events, match);          // writes event.x_connected_devices
    const v = validation.validate(match, devices, events);
    store.record(v.summary);                         // persist trend snapshot

    devicesCache = {
      devices, links: match.links, review: match.review,
      unmatchedCount: match.unmatched.length, timestamp: Date.now(),
      validation: v.summary, matchValidations: v.matches, anomalies: v.anomalies,
      trend: validation.appendTrend(devicesCache.trend || [], v.summary)
    };
  } catch (e) { console.error('device match skipped:', e.message); }
}
```

`devicesCache` is a module-level object you declare next to your event cache. The block never
throws — a device-feed outage degrades to "no links," never a broken refresh.

---

## 7. Expose the endpoints

```js
// Devices + auto-links + review queue (for the map layer)
app.get('/api/devices', (req, res) => { /* slim devicesCache.links + roster */ });

// Validation monitoring: summary, anomalies, per-link flags, trend
app.get('/api/devices/health', (req, res) => res.json({
  success: true,
  summary: devicesCache.validation || null,
  anomalies: devicesCache.anomalies || [],
  matches: devicesCache.matchValidations || [],
  trend: (() => { try { return require('./services/device-health-store').trend(288); }
                  catch { return devicesCache.trend || []; } })()
}));

// CWZ 1.0 / WZDx Device Feed
app.get('/api/cwz/devices', (req, res) =>
  res.json(require('./services/cwz-device-feed').buildFeed(devicesCache)));
```

See the full endpoint bodies in `backend_proxy_server.js` (search `/api/devices`).

---

## 8. Frontend (optional but recommended)

- **`ConnectedDevicesLayer.jsx`** (react-leaflet) — draws each device, a dashed connector to the
  matched zone (the *where*), and a popup with the live message + match basis (the *why*).
  Loads `/api/devices` once when its toggle turns on (no polling).
- **`DeviceValidationPanel.jsx`** — a modal that loads `/api/devices/health` and shows feed/
  matching/validation/coverage stat cards, trend sparklines (inline SVG — no chart library), and
  the anomaly list.

Wire both through your layer menu (see `NavSidebar.jsx`: a `toggle-connected-devices` layer
toggle and an `open-device-health` action).

---

## 9. Configure & tune

Matcher knobs (`DEFAULTS` in `device-workzone-matcher.js`):

| Knob | Default | Meaning |
|---|---|---|
| `maxMatchM` | 1600 | furthest a device can be from a zone and still match (~1 mi) |
| `fullSpatialM` | 150 | at/under this the board is treated as *on* the zone |
| `freshnessHours` | 2 | device must have reported within this to count as live |
| `autoThreshold` | 75 | ≥ this → auto-link |
| `reviewThreshold` | 60 | [review, auto) → surfaced for human confirmation |

Pass overrides per call: `matcher.matchDevices(devices, events, { autoThreshold: 80 })`.

Route/direction normalization lives in `normalizeRoute` / `normalizeDir` — extend the regexes if
your routes use other prefixes (e.g. state routes, toll roads).

---

## 10. Test

```
# Unit self-test of the scoring gates (no network):
node services/device-workzone-matcher.js        # → "✅ selftest PASS"

# Live smoke test of your ingest:
node -e "require('./services/device-ingest').fetchDevices().then(d=>console.log(d.length,'devices',d[0]))"

# End-to-end: match live devices against a saved events snapshot and print links.
```

The self-test proves the upstream gate rejects opposite-carriageway and downstream boards while
auto-linking a real upstream one — independent of any live data.

---

## 11. CWZ 1.0 / WZDx Device Feed & registration

`GET /api/cwz/devices` emits a `FeatureCollection` with a `feed_info` header
(`x_cwz_profile: "CWZ 1.0"`) and one FieldDevice per device: `core_details`
(`device_type`, `data_source_id`, `device_status`, `update_date`, `has_automatic_location`,
`road_names`, `road_direction`, **`road_event_ids`**), plus `pattern` (ArrowBoardPattern) for
arrow boards or `message_multi_string` (NTCIP 1203) for DMS. The device→zone link is the
`road_event_ids` a CWZ Device Feed exists to carry.

To go live: (1) confirm your RoadEvent (work-zone) feed is valid WZDx 4.1/4.2; (2) validate the
device feed against the WZDx/CWZ schema; (3) register both with the USDOT ITS DataHub Work Zone
Data Feed Registry. Full connected-vehicle *broadcast* (SAE J2735 TIM over RSUs) is a separate
hardware layer beyond this data feed.

---

## 12. Operational notes

- **No loops / no polling.** All work rides the on-demand event-cache refresh; the only added
  network call is one small device-feed fetch per refresh. Frontends load once on open.
- **Fail-safe.** Every stage is wrapped so a device-feed outage never breaks the event refresh.
- **Kill switch.** `DISABLE_DEVICE_MATCH=true` disables ingest+match+validation entirely.
- **Cost.** Negligible against an egress-driven hosting bill: one ~40 KB inbound fetch per
  refresh; the endpoints cost only when called.

Questions: Matt Miller, Iowa DOT — matthew.miller@iowadot.us

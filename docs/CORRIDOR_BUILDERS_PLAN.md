# Corridor Work-Zone Request Builders — I-35 & I-80 States · Build Plan

Extend the map-based work-zone request builder (Iowa + Nevada shipped) to every
state on the I-35 and I-80 corridors, per-state branded, at Iowa-level parity.

## Corridor states (16)

- **I-35:** Texas (48), Oklahoma (40), Kansas (20), Missouri (29), **Iowa (19) ✅**, Minnesota (27)
- **I-80:** California (06), **Nevada (32) ✅**, Utah (49), Wyoming (56), Nebraska (31), Iowa (19), Illinois (17), Indiana (18), Ohio (39), Pennsylvania (42), New Jersey (34)

*(number = federal NBI STATE_CODE_001)*

## Data inventory (what exists today)

| Capability | Availability | Access |
|---|---|---|
| **Bridge clearances + weight** | **All 50 states** (federal NTAD NBI, by state code) | CORS-open ✓ — direct from tool |
| **Road geometry** | Everywhere (OSRM) | CORS-open ✓ |
| **County** | Everywhere (FCC) | CORS-open ✓ |
| **Basemap + satellite** | Everywhere (Esri) | CORS-open ✓ |
| **Work-zone events / WZDx** | **All 16** corridor states already ingested by the platform | via backend (CORS-open) |
| **Cameras** | 7 corridor states wired (CA, IA, MN, NV, PA, TX, UT) + more | via backend |
| **DMS / devices** | 4 corridor (NJ, NV, PA, UT) + more | via backend |
| **Posted mileposts** | Iowa ✓, Nevada ✓ (CORS-open); most states' DOT GIS **not** CORS-open | per-state; usually via backend |

**Key enabler:** the corridor backend already **ingests events for all 16 states** (and cameras/DMS for several), and is **globally CORS-open** (`app.use(cors())`). So "full parity" is *not* 16 new data pipelines — it's exposing a few clean per-state endpoints over data that already flows.

## CORS reality (why the architecture is what it is)

A double-clicked HTML file (`file://`) can only call servers that send `Access-Control-Allow-Origin`. Confirmed:

- **CORS-open (tool calls directly):** federal NBI, OSRM, FCC, Esri tiles; Iowa's ArcGIS org; Nevada's ArcGIS **Online** mile-marker layer.
- **NOT CORS-open (must go through our backend):** nvroads, `gis.dot.nv.gov`, `webgis.dot.state.mn.us` (MnDOT), and most state DOT GIS/511 servers.

So: universal data comes straight from the tool; live state data (events/cameras/DMS/mileposts) comes from **our CORS-open backend**.

## Architecture

```
Per-state builder (branded HTML)
   ├─ direct → NBI (state code) · OSRM · FCC · Esri            [universal baseline]
   └─ → corridor backend /api/wz/*  (CORS-open)                 [live per-state data]
            ├─ /api/wz/events?state=&bbox=      (from eventsCache)
            ├─ /api/wz/cameras?state=&bbox=     (camera-adapters getCameras)
            ├─ /api/wz/dms?state=&bbox=         (device-adapters fetchState)
            └─ /api/wz/mileposts?state=&lat=&lon=  (proxied state LRS/reference posts)
```

- **One shared endpoint set** — every state tool uses the same `/api/wz/*`; the state is a query param.
- **Per-state config** — `{ stateCode, routes[], brand{}, submitEmail, hasCorsMileposts }` drives a **template**; each state is generated + branded from it.
- **Submission** — WZDx feature / email / summary PDF / database (Iowa's official 511 PDF is unique to Iowa; other states use WZDx/email/PDF).

## Architecture as built

- **Foundation:** `GET /api/wz/mileposts?state=&lat=&lon=` — a per-state milepost proxy backed by the
  registry `WZ_MP_SOURCES` in `backend_proxy_server.js`. Each state = one entry
  `{ url, mpField, routeField, nameField?, countyField?, where? }`. Server-side query of the state's
  LRS/mile-marker service (works even when the state GIS isn't CORS-open), nearest post + tenths
  interpolation, CORS-open. Companion: `GET /api/wz/cameras` and `GET /api/wz/dms` (state+bbox) over
  the camera/device adapters.
- **Generator:** `scratchpad/build-state.js` — one `STATES[key]` config per state (branding, NBI code,
  route list, map view, official logo, and a `wzRouteFriendly` that decodes that state's route-id
  scheme) transforms the Nevada template into a branded builder + inlines libs. **A new full-parity
  state = one `WZ_MP_SOURCES` entry + one `STATES` config.**

## Per-state status (10 of 16 built)

| State | Milepost source | Route decode | Cameras | DMS | Logo |
|---|---|---|---|---|---|
| Iowa | RAMS (direct) + RAMS speed | ✓ | ✓ | ✓ | ✓ |
| Nevada | AGOL mile markers (direct) | ✓ | ✓ | ⚠ gated | ✓ |
| Minnesota | RAMS reference posts (proxy) | ✓ (01/02/03 sys codes) | ✓ | — | ✓ |
| Texas | TxDOT mile markers (proxy) | ✓ (IH/US/SH) | ✓ | — | ✓ |
| Pennsylvania | PennDOT interstate MM (proxy) | ✓ (interstate) | ✓ | ✓ | ✓ |
| California | Caltrans postmiles (proxy) | ✓ (interstate #s) | ✓ | ✓ | text |
| Indiana | INDOT reference posts (proxy) | ✓ (post_name I_70_) | — | — | text |
| New Jersey | NJDOT SRI+MP (proxy) | ✓ (SRI 8-digit) | — | ✓ | text |
| Nebraska | gis.ne.gov mile markers (proxy) | ✓ (I/US/N sets) | — | — | text |
| Oklahoma | ODOT mile-marker signs (proxy) | ✗ route manual (opaque codes) | — | ✓ | text |

All 10 also carry: NBI bridge clearances (by state code), reduced work-zone speed, both-directions /
divided two-line drawing, coordinate entry, ADA/mobile, WZDx/email/PDF/DB outputs.

## Remaining 6 — need external inputs (no clean public point milepost service found)

| State | Blocker | Path to finish |
|---|---|---|
| Kansas | KDOT server (`wfs.ksdot.org`) unresponsive to probes | retry / get a working endpoint from KDOT |
| Missouri | no public point milepost/reference-post service located | MoDOT-provided feed |
| Utah | none located | UDOT feed (UDOT has LRM data — needs the service URL) |
| Wyoming | none located | WYDOT feed |
| Illinois | none located | IDOT feed |
| Ohio | none located | ODOT (Ohio) feed |

For these, the tool still works with a **manual route dropdown** (all universal features function); only
route/milepost auto-fill awaits a source. National HPMS fallback was evaluated and **rejected** — its
feature queries time out (only `returnCountOnly` responds), unusable for live lookups.

## Open items
- Configure the **NV device-feed credential** in the backend to un-gate Nevada DMS.
- Optional: official logos for CA / IN / NJ / OK (not surfaced in ArcGIS search; add if the DOTs provide).
- **WFS for Iowa DOT projects** — wire into the project-# lookup once the endpoint is provided.

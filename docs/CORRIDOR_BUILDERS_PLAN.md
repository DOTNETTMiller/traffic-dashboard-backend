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

## Phased roadmap

1. **Phase 1 (in progress):** add the shared `/api/wz/{events,cameras,dms,mileposts}` endpoints to the backend (thin wrappers over existing adapters/caches; CORS already global) + deploy. Build **Minnesota** end-to-end against them as the parity proof (MN: NBI state 27 ✓, events + cameras ingested ✓, mileposts via proxy since MnDOT GIS isn't CORS-open).
2. **Phase 2:** parameterize the proven Minnesota build into a **template + per-state config**; generate the remaining I-35 states (TX, OK, KS, MO) and the I-80 states with strong feeds.
3. **Phase 3:** fill gaps — states missing camera/DMS feeds, milepost proxying, per-state branding polish.
4. **Phase 4:** registered WZDx output per state (reuse the DIY-kit generators) + the validation stack (TomTom/camera/DMS).

## Per-state status

| State | Bridges | Events | Cameras | DMS | Mileposts | Tool |
|---|---|---|---|---|---|---|
| Iowa | ✓ | ✓ (CORS-open ArcGIS) | ✓ | ✓ | ✓ direct | **shipped (full)** |
| Nevada | ✓ | via backend | via backend | via backend | ✓ direct (AGOL) | **shipped (baseline+MP)** |
| Minnesota | ✓ (2,147) | ✓ ingested | ✓ ingested | — | via proxy | Phase 1 proof |
| TX/OK/KS/MO | ✓ | ✓ ingested | partial | partial | via proxy | Phase 2 |
| CA/UT/WY/NE/IL/IN/OH/PA/NJ | ✓ | ✓ ingested | partial | partial | via proxy | Phase 2–3 |

## Open items
- **WFS for Iowa DOT projects** (offered by the program lead) — wire into the project-# lookup once the endpoint is provided.
- Confirm the public backend base URL the tools should call for `/api/wz/*`.

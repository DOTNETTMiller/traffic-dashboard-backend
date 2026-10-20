# Truck Parking — Upstream APIs We Currently Pull

The external data sources feeding the sandbox's truck parking endpoints
(companion to `TRUCK_PARKING_API_ENDPOINTS.md`, which lists what we serve).
Sources are defined in `scripts/fetch_tpims_data.js` (TPIMS feeds) and
`backend_proxy_server.js` (Nevada, Iowa cameras).

## TPIMS feeds (MAASTO-format Dynamic/Static JSON)

| State | Operator/host | Dynamic URL | Static URL | Access |
|---|---|---|---|---|
| Kentucky | TRIMARC | `http://www.trimarc.org/dat/tpims/TPIMS_Dynamic.json` | `.../TPIMS_Static.json` | Open (plain HTTP) |
| Minnesota | MnDOT IRIS | `http://iris.dot.state.mn.us/iris/TPIMS_dynamic` | `.../TPIMS_static` | Open (plain HTTP) |
| Illinois | TravelMidwest (LMIGA) | `https://truckparking.travelmidwest.com/TPIMS_Dynamic.json` | `.../TPIMS_Static.json` | Open |
| Indiana | TrafficWise | `https://content.trafficwise.org/json/tpims.json` | `.../json/rest_area.json` | Open — GeoJSON format, custom preprocessor parses "Spaces Available" from message fields |
| Ohio | OHGO public API | `https://publicapi.ohgo.com/api/v1/truck-parking` | — | **API key required** (`OHIO_API_KEY` env; register at publicapi.ohgo.com) |
| Kansas | KDOT TPIMS | `https://tpims.ksdot.gov/api/dynamic` | `.../api/static` | **Credentialed** (`KS_TPIMS_COOKIE` env; register at tpims.ksdot.gov) |
| Wisconsin | 511WI | `https://511wi.gov/api/TPIMS_Dynamic?format=Json` | `.../TPIMS_Static?format=Json` | **API key required** (`WI_TPIMS_KEY` env; request via 511wi.gov/developers) — feed skipped if key not set |

## Non-TPIMS live sources

| Source | URL | Notes |
|---|---|---|
| Nevada DOT | `https://www.nvroads.com/api/v2/get/truckparking` | Custom JSON alongside NV road conditions feed |
| Iowa DOT rest-area cameras | `https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80{EB\|WB}###-01-{CENTER\|ENTRY\|EXIT}.jpg` | ~104 snapshot URLs across 6 I-80 rest areas (EB 148/180/300, WB 19/180/268), 3 camera views each — input to the AI ground-truth occupancy counting endpoints |

## Internal/derived layers built on these

- **Historical occupancy archive** — loaded from the platform database
  (`scripts/migrate_parking_to_db.js`); trains the hourly prediction models.
- **Vendor/partner submissions** — `/api/vendors/truck-parking` ingest path;
  currently the on-ramp for any private provider (fleet telematics, ELD,
  crowd-sourced) rather than an external pull.

## Coverage summary

**Verified against Railway production env (2026-08-06):** `OHIO_API_KEY` is
SET; `KS_TPIMS_COOKIE` and `WI_TPIMS_KEY` are NOT SET. Current live coverage
= **7 states** (KY, MN, IL, IN, OH via TPIMS + Nevada + Iowa camera ground
truth). Kansas (register: tpims.ksdot.gov/account/register, cookie auth) and
Wisconsin (key via 511wi.gov/developers) each activate with one free
registration — Kansas is an I-35 corridor state, so this directly shrinks
the grant's gap map.

**Gaps on the ATTAIN corridors:** I-35 — TX, OK, MO have no live parking
feed; I-80 — CA, NV(partial), UT, WY, NE, PA, NJ have none. This gap map is
the deployment case for the grant's parking element.

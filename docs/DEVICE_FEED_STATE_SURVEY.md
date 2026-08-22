# Connected-Device Feed — State Survey

Which states could run the device↔work-zone auto-association (see
`DEVICE_WORKZONE_AUTO_ASSOCIATION.md`), and how. The matcher is state-agnostic — the only
per-state work is an ingest adapter. Adapters for the states below are implemented in
`services/device-adapters.js`; run `node scripts/test_device_adapters.js` to see which are
live right now.

Surveyed 36 states (Aug 2026), verifying endpoints by actually fetching them. **~33 states
already publish WZDx work zones** (the "left half" of the association), so the connected-device
feed is the only gap. Public **live-message** feeds are common; public **portable / arrow-board**
feeds are rare — Iowa, Washington, Pennsylvania, Oklahoma, New York, and Maine are the standouts.

## Headline
- **In production:** Iowa.
- **Portable / arrow-board, go-today:** Washington, Oklahoma, Pennsylvania, New York, Maine.
- **~20 states usable now** on a public or free-key device feed (mostly fixed DMS).
- **~7 more** have portable leads behind one data step; 3–4 have nothing public.

## Tier 1 — Portable / arrow-board, adapter live (no key unless noted)
| State | Adapter | Feed | Verified pull | Route caveat |
|---|---|---|---|---|
| Iowa | (production `device-ingest.js`) | DMS_View ArcGIS | 100 devices | clean (`Route` field) |
| **Washington** | `wa` | WZDx v4 `DeviceFeed` | 5 arrow-boards, all portable, on | ⚠️ `road_names` blank → needs coord→route snap |
| **Oklahoma** | `ok` | oktraffic.org REST (Devices+DmsStatuses) | 168 devices, 41 portable, 54 on | ⚠️ route in message text → parse or snap |
| **Pennsylvania** | `pa` | PennDOT TSAMS ArcGIS L17 | 955 devices, 109 portable | ⚠️ `STATE_ROUTE` is an internal SR code → needs translation/snap; no live message |
| **Maine** | `me` | MaineDOT ArcGIS L111 (trailer fleet) | 101 trailer-mounted | ⚠️ `rt_code` coded → snap; no live message (511 has messages) |
| **New York** | `ny` (key: `NY_511_KEY`) | 511NY `getmessagesigns` | ~223 portable of 960 | route field present; portable coords patchy |

## Tier 2 — Fixed DMS, live message, adapter live, no key
| State | Adapter | Feed | Verified pull |
|---|---|---|---|
| **Florida** | `fl` | FDOT DIVAS_MessageBoard ArcGIS | 1,155 devices, 890 routed, 442 on |
| **Kentucky** | `ky` | dmsSigns_2020 ArcGIS | 90 devices, 83 on |
| **Maryland** | `md` | CHART DMS ArcGIS | 295 devices, 213 on |
| **New Mexico** | `nm` | nmroads RealMap JSON | 134 devices, routed |
| **California** | `ca` | CWWP2 per-district CMS JSON | 1,016 devices (msg parsing per-district varies) |

## Tier 3 — Fixed DMS, one free API key away (CARS/OneStop 511; set env key to enable)
| State | Adapter | Key env | Base |
|---|---|---|---|
| Utah | `ut` | `UT_511_KEY` | udottraffic.utah.gov |
| Louisiana | `la` | `LA_511_KEY` | 511la.org |
| Arizona | `az` | `AZ_511_KEY` | az511.com |
| North Carolina | `nc` | `NC_511_KEY` | drivenc.gov |
| New Jersey | `nj` | `NJ_511_KEY` | 511nj.org (`getmessagesigns`) |
| Wisconsin | `wi` | `WI_511_KEY` | 511wi.gov |
| Nevada | `nv` | `NV_511_KEY` | nvroads.com |
| Idaho | `id` | `ID_511_KEY` | 511.idaho.gov (also keyless ArcGIS inventory) |

Oregon (TripCheck API, free key) and Kansas/Indiana (CARS 511, key + endpoint confirmation) fit
here too; adapters can be added with the same `cars511` family once keys/paths are confirmed.

## Tier 4 — Portable leads worth chasing (data step needed)
- **Colorado** — COtrip `/signs` (free key); ingests iCone/NavJOY contractor sources → likely portable.
- **Indiana** — Indiana Data Hub "Portable Digital Message Sign" dataset lead (retrieval 404'd).
- **Ohio** — OHGO WZDx 4.2 feed may carry `arrow-board` field devices (unchecked; free key).
- **Delaware** — FirstMap ArcGIS inventory has `IS_MOBILE='Y'` (123 units) but no message/route.
- **Massachusetts** — MassDOT RTTM drives portable VMS, but the feed is behind developer auth.
- **New Hampshire / Vermont** — New England 511 (keyless) carries portable work-zone signs, unlabeled.

## None found (public)
Mississippi, Missouri, Hawaii (no public DMS device feed); Nebraska (511 GraphQL backend locked).

## The route caveat (important)
The matcher gates on a normalized route (e.g. `I-80`) matching between device and zone. States
whose feed carries a signed-route string (FL, KY, MD, NM, CA, most 511 feeds) work directly.
The **portable** feeds (WA blank, PA/ME internal codes, OK in-message) need a **coordinate→route
derivation** first — snap the device position to a centerline to get its route. We already have
this: `services/rams-chainage.js` `measureAt()` returns a route id from the Iowa RAMS network,
and the national FHWA ARNOLD centerline is the state-agnostic equivalent. Adding a small
"route-from-coordinate" enrichment makes the portable feeds fully matchable.

## Cross-state fallback
`api.road511.com` (third-party aggregator, free `X-API-Key`) reports current DMS messages across
30+ states — a single-integration fallback where an official feed is gated. Not authoritative;
per-state portable coverage unverified.

## How to add a state
Add one entry to `ADAPTERS` in `services/device-adapters.js` using the `arcgis`, `cars511`, or
`wzdxDevice` family (or a small custom fetcher), mapping its fields to the normalized device
shape. No matcher/endpoint/frontend changes. Verify with `node scripts/test_device_adapters.js`.

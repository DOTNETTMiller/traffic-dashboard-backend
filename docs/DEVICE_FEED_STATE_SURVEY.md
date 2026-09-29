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
- **In production:** Iowa + 20 adapter states (all of Tiers 1–3). Measured 2026-09-29:
  **20 of 21 adapters live, ~7,240 devices.**
- **Portable / arrow-board, go-today:** Washington, Oklahoma, Pennsylvania, New York, Maine.
- **~7 more** have portable leads behind one data step; 3–4 have nothing public.

### Correction, 2026-09-29 — Tier 3 never needed keys
The original survey reached Tier 3 through the CARS/OneStop `api/v2/get/messagesigns` path,
which does require a key, and concluded those eight states were blocked on registration. They
were not. Every one of those hosts also serves **the public map JSON its own 511 website calls
from the browser** — keyless, no registration:

    POST {base}/List/GetData/MessageSigns   → message, roadway, direction, status (NO position)
    GET  {base}/map/mapIcons/MessageSigns   → position only, keyed by the list's DT_RowId

The two must be **joined**; neither is usable alone, because without coordinates every record
fails the adapter's position check and the state silently yields nothing. This is the same
family the camera adapters had been using keylessly all along — the device side simply never
tried it. Seven of the eight Tier-3 states came online with no key (`ibi511` family), and the
same probe added Georgia, Alaska and Vermont, and **recovered Florida** after FDOT withdrew
public ArcGIS access. New Jersey is the one real holdout: 511nj.org answers **403 on both**
paths and genuinely needs a key.

Lesson worth keeping: "needs an API key" was a property of *the endpoint that was tried*, not
of the agency. Probe the state's own map before accepting a registration wall.

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
| **Florida** | `fl` | ~~FDOT DIVAS_MessageBoard ArcGIS~~ → **FL511 map JSON** (`ibi511`) | 1,141 devices, 875 routed, ~390 on |

> Florida moved on 2026-09-29: FDOT's DIVAS FeatureServer now answers `499 Token Required` and
> the whole DIVAS folder has left the public services directory. The ArcGIS adapter was
> returning **0 devices, silently**. FL511's keyless map JSON replaced it and also gave back
> the cameras (4,960, where the dead ArcGIS layer returned none).
| **Kentucky** | `ky` | dmsSigns_2020 ArcGIS | 90 devices, 83 on |
| **Maryland** | `md` | CHART DMS ArcGIS | 295 devices, 213 on |
| **New Mexico** | `nm` | nmroads RealMap JSON | 134 devices, routed |
| **California** | `ca` | CWWP2 per-district CMS JSON | 1,016 devices (msg parsing per-district varies) |

## Tier 3 — Fixed DMS on the keyless public 511 map JSON (`ibi511`; no key, live now)
Verified pull 2026-09-29. These were filed as key-gated in the August survey; see the
correction above for why that was wrong.

| State | Adapter | Base | Verified pull |
|---|---|---|---|
| Utah | `ut` | udottraffic.utah.gov | 221 devices, 212 routed, 135 on |
| Louisiana | `la` | www.511la.org | 55 devices, 54 routed, 55 on |
| Arizona | `az` | az511.com | 305 devices, 199 routed, 305 on |
| North Carolina | `nc` | drivenc.gov | 416 devices, 396 routed, 416 on |
| Wisconsin | `wi` | 511wi.gov | 166 devices, 134 routed, 166 on |
| Nevada | `nv` | nvroads.com | 653 devices, 510 routed, 41 on |
| Idaho | `id` | 511.idaho.gov | 69 devices, 68 routed, 69 on |
| **Georgia** *(new)* | `ga` | 511ga.org | 226 devices, 214 routed, 221 on |
| **Alaska** *(new)* | `ak` | 511.alaska.gov | 10 devices, 10 on |
| **Maine / New Hampshire / Vermont** *(new)* | `newengland` | www.newengland511.org | 494 devices → ME 256, NH 131, **VT 107** |

`newengland` is one host serving three states. The record's `area` field is the **only** thing
identifying the state (`region` and `county` are both null), so the adapter splits on it via
`stateFrom`. Labelling that host with a single state code would file two states' signs under
the third. It is additive to the `me` entry, which reads Maine's own *portable trailer*
inventory from MaineDOT ArcGIS — different source, different device class.

### Still key-gated
| State | Adapter | Key env | Why |
|---|---|---|---|
| New Jersey | `nj` | `NJ_511_KEY` | 511nj.org returns **403 on both** the CARS path and the public map JSON |

Oregon (TripCheck API, free key) and Kansas/Indiana (CARS 511, key + endpoint confirmation) are
still open leads — but probe `/List/GetData/MessageSigns` on each before assuming a key is needed.

## Tier 4 — Portable leads worth chasing (data step needed)
- **Colorado** — COtrip `/signs` (free key); ingests iCone/NavJOY contractor sources → likely portable.
- **Indiana** — Indiana Data Hub "Portable Digital Message Sign" dataset lead (retrieval 404'd).
- **Ohio** — OHGO WZDx 4.2 feed may carry `arrow-board` field devices (unchecked; free key).
- **Delaware** — FirstMap ArcGIS inventory has `IS_MOBILE='Y'` (123 units) but no message/route.
- **Massachusetts** — MassDOT RTTM drives portable VMS, but the feed is behind developer auth.
- ~~**New Hampshire / Vermont** — New England 511 (keyless) carries portable work-zone signs, unlabeled.~~
  **Done 2026-09-29** — live via the `newengland` adapter (NH 131, VT 107). The fixed DMS are in;
  the *portable* subset is still unlabeled on that host, so portability is inferred from the
  sign name only.

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

## Arrow boards — what the 2026-09-29 sweep actually found
Chased properly rather than assumed, because "connected arrow boards" is the part of this
survey that has not moved.

**FHWA's WZDx Feed Registry** (`datahub.transportation.gov/resource/69qe-yiui.json`, 43 active
feeds) is the authoritative catalogue and is worth reading before probing anything:
- It lists **no device feeds at all** — it catalogues work-zone feeds only. Arrow-board feeds
  are not registered anywhere central.
- Probing every registered feed's sibling device-feed URL (`WorkZoneFeed`→`DeviceFeed`,
  `workzones`→`devices`, and hand-written variants for UT/NC/ID/NY/WI/AZ/MS/MN/KS/IN and the
  New England compass host) found exactly one: **Washington**, which we already have.

So **WA remains the only public WZDx Device Feed in the country**, and portable/arrow-board
coverage is still IA / WA / OK / PA / ME / NY. Everything added on 2026-09-29 is fixed DMS.

### Still open for arrow boards (each needs something we do not have here)
| Lead | Blocker |
|---|---|
| Colorado COtrip `/signs` (ingests iCone/NavJOY → likely portable) | needs `COLORADO_API_KEY`, which lives only in Railway prod — untestable locally |
| Ohio OHGO devices | needs the OHGO key, same situation |
| Delaware FirstMap `IS_MOBILE='Y'` (123 units) | **the layer is gone.** FirstMap moved to `enterprise.firstmap.delaware.gov`; its Transportation folder and `DE_Assets` now carry no DMS layer at all. The August survey did not record the URL, so there is nothing to re-check against |
| Indiana portable DMS dataset | retrieval 404'd in August, unchanged |
| Massachusetts RTTM portable VMS | behind developer auth |

A caution from this sweep: the first pass of the sibling-URL probe reported **zero** device
feeds everywhere, including Washington's, because Python's cert store on this machine fails
`CERTIFICATE_VERIFY_FAILED` and every request errored into the same empty result. A probe that
cannot reach anything reports the same thing as a probe that found nothing. It was only caught
by checking a feed already known to work. Re-run through `curl` before believing a negative.

## HaulHub — two feeds recovered from the registry
The same registry read fixed two wrong notes in `services/haulhub-worker-presence.js`:
- **Delaware** — recorded as "no feed under any variant tried". It publishes `del_dot_feed`
  (spelled out, which no 2-letter or state-name variant hits): **79 events**, the *second
  largest publisher of the 39*, behind Ohio and ahead of Iowa.
- **Louisiana** — recorded as "publishes nothing", because `la_dot_feed` is the City of Los
  Angeles. Its real feed is `la_dot_d_feed` — the trailing `_d` is not guessable: **8 events**.

Now 39 feeds, **19 publishing, 333 events** (was 37 / 18). HaulHub needed no wiring — every
feed already runs ungated through `fetchAllPresence()`.

Since the file names are not derivable, probing for them could never have worked. The registry
is the first stop for any publisher whose naming cannot be predicted.

## Cameras
`services/camera-adapters.js` runs **16 states ungated, 25,763 cameras** (2026-09-29): NY 1,874 ·
MN 1,528 · PA 1,537 · NC 1,154 · AZ 644 · ME 405 · GA 4,331 · UT 2,081 · NV 652 · ID 457 ·
LA 336 · TX 1,007 · CA 3,408 · IA 1,259 · FL 4,960 · AK 130. Probe with
`node scripts/test_camera_adapters.js`.

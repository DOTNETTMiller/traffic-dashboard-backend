# Nevada DOT — Work-Zone Request Builder · User & Setup Guide

A single-file, map-based tool that helps NDOT staff assemble a work-zone request,
scan bridge clearances along the route **and** detour, and export it as a **WZDx
feature**, an **email**, a **summary PDF**, or a **database submission**.

- **File:** `NDOT-WorkZone-Request-Builder.html` — double-click to open in any modern
  browser (Chrome, Edge, Safari). No install.
- **Works offline** except for the live map tiles and the three internet lookups
  listed under *Connected data services*.


## Contents
1. [What it does (and what it doesn't)](#1-what-it-does-and-what-it-doesnt)
2. [Step-by-step](#2-step-by-step)
3. [Importing a project list (CSV)](#3-importing-a-project-list-csv)
4. [The four outputs](#4-the-four-outputs)
5. [Connected data services](#5-connected-data-services)
6. [Setup for IT (database + hosting)](#6-setup-for-it-database--hosting)
7. [Full-parity option (live NDOT data)](#7-full-parity-option-live-ndot-data)


## 1. What it does (and what it doesn't)

**It does:**
- Snap a work-zone segment to the **road** (road-following geometry) from two clicks
  or your GPS location, and auto-fill the **county**.
- Scan **federal NBI bridge clearances** along the route and the detour, and apply
  the lowest height/width as restrictions.
- Build a recurring **schedule**, **draw a detour**, capture **restrictions** and
  notes, and run a **readiness check**.
- Produce four outputs: **WZDx feature**, **email to NDOT**, **summary PDF**, and a
  **database submission** (or JSON download).

- Auto-fill **posted mileposts** (Begin/End) by interpolating between NDOT mile
  markers.

**It does not** (in this offline build): pull live NV 511 events, cameras, or DMS.
Those systems (nvroads, NDOT ATMS GIS) don't allow direct browser access (no CORS),
so a self-contained file can't call them. See
[§7](#7-full-parity-option-live-ndot-data) for the path to add them.

> Because of that, geometry is **road-following** (not centerline-snapped), and
> project numbers come from a **CSV you import** rather than a live lookup. Posted
> mileposts DO auto-fill from NDOT's CORS-open mile-marker layer.


## 2. Step-by-step

**Toolbar** — Save project · pick a saved project · New (starts a fresh request;
your name/email/contact are kept).

**Step 1 — Mark the work zone**
- Click the road for the **begin** point, then the **end** point.
  In the field, tap **📍 My location** to set a point from GPS.
- The segment follows the road; the info box shows direction, length, and a
  shareable Google Maps link. County auto-fills (toggle off to skip).
- **Drag the A / B pins** to fine-tune.

**Step 2 — Location & details**
- Pick the **Route** (I-15, I-80, US-95, …, or type another) and **Direction**.
- **Project #** — type to search your imported list (see §3); selecting one fills
  the description.
- Fill description, begin/end location, requestor, email, 24-hr contact, and the
  **Vehicle impact** (WZDx-standard values, e.g. `some-lanes-closed`).

**Step 3 — Restrictions & clearances**
- **🌉 Scan NBI clearances (route + detour)** lists the lowest bridge clearance on
  the route *and* the detour (detours often route trucks under lower bridges).
  **Apply** fills height/width. Add weight/length and timing as needed.

**Step 4 — Schedule**
- Choose a pattern (Continuous / Weekdays / Nights / Weekends), number of weeks,
  start date, and daily hours → **Build weeks** lists each occurrence.

**Step 5 — Detour & notes**
- **✏️ Draw detour** traces a road-following detour; set "marked detour," DMS
  request, and any additional notes.

**Step 6 — Submit**
- Set the **NDOT recipient email**, run **✓ Check readiness**, then use any of the
  four outputs below.


## 3. Importing a project list (CSV)

Under **Project #**, click **＋ import CSV**. The format is flexible:

```
Project Number,Description
NV-15-2026-014,Bridge deck rehab
"SR160-2026-3","Widening, Blue Diamond to Pahrump"
```
- Project-number column is found by header (`Project Number`, `Project #`, `PIN`,
  `Project`, …). Description column is optional (`Description`, `Work`, `Type`).
- No recognizable header? Column 1 = number, Column 2 = description.
- A single column of numbers works too. Wrap values with commas in "quotes".
- The list is saved on the device and used for type-to-search.


## 4. The four outputs

| Output | What it produces |
|---|---|
| **🧩 Export WZDx** | A WZDx v4.2 `RoadEventFeature` GeoJSON — the national Work Zone Data Exchange format. Feeds NDOT's WZDx feed / the connected-work-zone diary. Geometry, dates, `vehicle_impact`, and clearance `restrictions` are included. |
| **✉️ Email NDOT** | Opens a draft to the recipient you set, with the full request as text (also copied to your clipboard). Does not auto-send. |
| **📄 Summary PDF** | An NDOT-branded one-page summary of the request + schedule. |
| **🗄️ Submit to database** | POSTs the full request (fields + geometry + detour + schedule + the WZDx feature) as JSON to your endpoint. **⬇ Download JSON** is the offline fallback. |


## 5. Connected data services

All are read-only and need no login.

| Service | Used for | Access |
|---|---|---|
| Federal **NTAD National Bridge Inventory** | Bridge clearances (item 54B), Nevada = STATE_CODE 32 | CORS-open ✓ |
| **OSRM** (`router.project-osrm.org`) | Road-following segment + detour geometry | CORS-open ✓ |
| **FCC** area API (`geo.fcc.gov`) | County from lat/lon | CORS-open ✓ |
| NDOT **MileMarker_CoCumPart2** (ArcGIS Online) | Posted mileposts (interpolated) | CORS-open ✓ |
| Esri basemap / Google Maps links | Basemap / shareable map links | — |

*Not used in this build (no CORS):* nvroads (events/cameras/DMS) and NDOT
`gis.dot.nv.gov` (centerline geometry). See §7.


## 6. Setup for IT (database + hosting)

- **Database submit:** under "Submit to database," set an **endpoint URL** and
  optional **Authorization header** (saved on the device). The tool sends a `POST`
  with `Content-Type: application/json`; return `200` with `{ "id": "…" }`.
  The JSON includes a ready-to-store `wzdx` feature.
- **CORS:** for the browser submit to work, host the HTML on the **same origin** as
  the endpoint, or enable CORS on the endpoint. Everything else works from the
  opened file.
- **HTTPS + a write-only intake token** are recommended; validate all fields server
  side and keep the whole payload for audit.


## 7. Full-parity option (live NDOT data)

To match the Iowa tool's live features (load an existing 511 event, duplicate
check, camera/DMS device scan, centerline mileposts), NDOT's sources must be
reachable from the browser. Two ways:

1. **Backend proxy (recommended):** a small server proxies nvroads
   (events/cameras/message-signs) and NDOT GIS (LRS mileposts, NevadaRoutes
   centerline) and re-serves them with CORS enabled. The same UI then lights up
   with live loads. Our corridor platform already ingests nvroads, so this is a
   modest add.
2. **NDOT enables CORS** on nvroads + `gis.dot.nv.gov` (and provides an API key for
   the nvroads `api/v2` feed), allowing a true standalone like Iowa's.

Until then, this offline build covers the full workflow using clearances,
road geometry, county, CSV project numbers, and manual entry.


## 8. Building it out further — data connections & roadmap

Everything below already **exists** at NDOT; it's a matter of making it reachable
from the tool. The one architectural piece to add is a small **proxy service** (a
few dozen lines) that fetches these sources server-side and re-serves them with CORS
enabled. Once that exists, each connection is an incremental feature on the same UI.

### 8.1 The connections, by capability

| Capability to add | NDOT / vendor source (confirmed live) | What it unlocks | Effort |
|---|---|---|---|
| **Centerline snap + posted mileposts** | NDOT GIS `LRS/ROUTES_STATE_CUM`, `LRS/ROUTES_COUNTY_MPCAL` (milepost calibration), `Authoritative/MileMarker_CoCum`, `NevadaRoutes` | Segment snaps to the state route and auto-fills posted mileposts (like the Iowa tool) instead of raw GPS | Medium |
| **Load an existing 511 event / duplicate check** | nvroads `List/GetData/Construction` + `map/mapIcons/Construction` (or `api/v2/get/event` with a key) | Tap a live NV work zone to pre-fill route/dates/hours/description; warn on duplicates | Medium |
| **Camera attach (visual verification)** | nvroads `List/GetData/Cameras` (has `images`, `roadway`, `area`) | Attach nearby camera snapshots to the request | Low |
| **DMS / message-sign pull** | nvroads `List/GetData/MessageSigns` | Surface nearby message signs; document requested messaging | Low |
| **Auto-route to the right district (RCE-equivalent)** | NDOT GIS `Authoritative/District_Boundaries`, `Subdistrict_Boundaries`, `Maintenance_Crew_Linear` | Auto-set the NDOT district + intake email from the map point | Low |
| **Bridge/structure detail beyond clearance** | NDOT GIS `Authoritative/Bridge_Locations`, `STRUCTURES` (+ federal NBI already used) | NDOT-owned structure IDs, condition, posting | Low |
| **Live project numbers (replace CSV)** | NDOT letting / STIP / AgileAssets (internal) — expose a read view | Type-to-search live project numbers instead of a CSV import | Medium |
| **County polygons (offline-independent)** | NDOT GIS `Authoritative/NV_Counties` | County without the FCC call | Low |

> All the NDOT GIS services above are on `gis.dot.nv.gov/arcgis/rest/services`;
> nvroads endpoints are `POST` on `www.nvroads.com`. Both currently lack CORS
> headers, which is the only reason the offline tool can't call them directly.

### 8.2 Recommended architecture

```
  Browser tool ──HTTPS──► NDOT proxy (CORS-enabled)  ──► nvroads (events/cameras/DMS)
                              │                        └─► NDOT GIS (LRS, districts, structures)
                              └─► caches + normalizes  ──► returns clean JSON to the tool
```
- The proxy is stateless and read-only: it forwards a bounded query (a bbox around
  the segment), caches briefly, strips to the fields the tool needs, and adds
  `Access-Control-Allow-Origin`. Host it on an NDOT server or the corridor platform.
- The tool then calls `…/api/nv/events?bbox=…`, `…/api/nv/cameras?bbox=…`,
  `…/api/nv/lrs?lat=…&lon=…`, etc. — mirroring how the Iowa tool calls Iowa's
  already-CORS-open ArcGIS layers directly.
- Our corridor platform **already ingests nvroads** (events + cameras), so those
  proxy endpoints are largely built.

### 8.3 Publishing NDOT's work zones as a registered WZDx feed

The tool already **exports** a WZDx feature per request. To turn NDOT's work zones
into a **registered national feed**:
1. Run the Nevada WZDx generator (see the NV kit in `docs/wzdx-diy/`) against
   `nvroads api/v2/get/event` on a 5-minute schedule → `wzdx_nevada.geojson`.
2. Host that file at a public URL.
3. Register it with USDOT at **avdx@dot.gov**.
Requests built in this tool can be POSTed into the same pipeline so inspector-filed
closures flow straight to the national feed.

### 8.4 Independent validation (optional, high value)

Once zones are flowing, add the corridor platform's **validation stack** so each
NDOT work zone carries a confidence signal from sources that don't touch NDOT's feed:
- 🚗 **TomTom** probe (already nationwide — covers NV today),
- 📷 **camera AI-vision** (nvroads cameras),
- 🔶 **DMS message** corroboration (nvroads message signs).

### 8.5 Suggested phasing

1. **Phase 1 (now):** this offline tool — clearances, geometry, WZDx/email/PDF/DB.
2. **Phase 2:** stand up the proxy → add district auto-routing, cameras, DMS,
   county polygons (all Low effort).
3. **Phase 3:** centerline snap + posted mileposts (LRS), live event load +
   duplicate check.
4. **Phase 4:** live project numbers, registered WZDx feed, validation stack.

Each phase is additive on the same interface — no rework of the tool itself.

### 8.6 OSOW (oversize/overweight) permit-route restrictions

The Iowa builder auto-checks the state's public OSOW permit-route network
(`AllSystemsPermitOversize` / `AllSystemsPermitOverweight`), flagging **Restricted**
segments on the route/detour with the local contact. **Nevada has no equivalent
public GIS layer** — a scan of NDOT GIS and the NDOT ArcGIS Online org found only
generic routes/mileposts; OSOW routing is handled inside NDOT's permit system
("LoIS"). To add the same check for Nevada, NDOT would need to publish an OSOW
route layer (segment + restriction status + contact); then it drops into the tool
exactly as Iowa's does. Until then, verify OSOW routing via LoIS.

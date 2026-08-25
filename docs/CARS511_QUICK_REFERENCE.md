# CARS 511 Request Builder — Quick Reference

A one-page guide for field/RCE staff. Open **`cars511-request-standalone.html`** (double-click, or from your intranet). Everything works from one file; internet is only needed for the map tiles and the live lookups below.

---

## Build a request in 6 steps

1. **Mark the work zone.** Click the road for the **begin** point, then the **end** point — the segment snaps to the Iowa DOT centerline and auto-fills the **posted mileposts**, county, and nearest RCE office. *(In the field, tap **📍 Use my location** instead of clicking.)*
2. **Check it's not already filed.** Press **🔁 Check for existing closures / duplicates**. Green = clear to file. Red = an existing 511 closure is here — tap **load & extend** to update it instead of filing a duplicate.
3. **Pull in the details** (each is a button; results are tappable):
   - **🏗️ Find DOT project #** — programmed (5-year) + letting projects near the segment → tap a number to fill it.
   - **🌉 Scan NBI clearances (route + detour)** — lowest bridge clearance on the route *and* the detour, plus posted restrictions → **Apply** fills height/width.
   - **🔶 Scan DMS, arrow boards & Street Smart (IWZ)** — tap devices to add; a **Street Smart (SS/SSR)** unit marks it an **Intelligent Work Zone**.
   - **📷 Attach nearby traffic cameras** — adds camera links so the TMC/RCE can see the zone.
   - The **lane hint** under "Traffic impact" tells you how many lanes exist that direction — pick the matching impact.
4. **Set the schedule.** Enter dates/times, or use **Build weeks** for recurring patterns. Draw a **detour** if there is one.
5. **Review readiness.** Press **✓ Check readiness** — it flags any required field still empty before you submit.
6. **Submit.** Choose one:
   - **📝 Fill official 511 PDF** — downloads the filled Iowa 511 form.
   - **📋 Fill 511 site (copy fields)** — opens the SeamlessDocs form + per-field copy buttons.
   - **✉️ Email TMC (cc RCE)** — drafts the email (text auto-copied; Gmail fallback link if no mail app).
   - **🗄️ Submit to database** — posts directly to your system (if IT has set it up).

> Tip: **💾 Save project** keeps a request to reload later; **🗑 New** clears everything.

---

## What's new (Aug 2026)

- **📍 GPS "use my location"** — set the begin/end point from the field.
- **Duplicate/overlap check** against the live 511 feed, with one-tap **load & extend**.
- **Load & extend** an existing 511 event (auto-fills route, dates, description, mileposts).
- **Find DOT project #** from the 5-Year Program + letting/bid layers.
- **NBI clearances on route *and* detour** — now from the **live federal NBI** (statewide, fresher) + Iowa **posted restrictions**.
- **DMS / arrow boards / Street Smart (IWZ)** device scan — correct IWZ meaning (Street Smart deployment, not arrow boards).
- **📷 Nearby cameras** attach for visual verification.
- **Full 26-choice traffic-impact dropdown** (matches the official form) + a **lanes-available** hint.
- **Additional info / notes** field that consolidates devices, cameras, and your notes into the form's Additional-info box.
- **Readiness check** before submitting; **Share route/detour maps**; **Database submit** + JSON export.

---

## Connected data services

All are **read-only GET** requests and (except where noted) **CORS-open**, so the standalone file can call them directly. IT can use this list for allow-listing.

### Iowa DOT ArcGIS (org `8lRhdTsQyJpO52F1`)
| Service | Used for |
|---|---|
| `Road_Network_View` | Centerline geometry, **NUMBER_LANES** + AADT/truck AADT (HPMS-equivalent) |
| `Reference_Post_View` | Posted mileposts, route & direction |
| `CARS511_Iowa_View` | Live 511 events — **Load from live feed** + **duplicate check** |
| `DMS_View` | DMS signs, arrow boards, Street Smart (IWZ) devices |
| `Traffic_Cameras_View` | Nearby traffic-camera snapshots |
| `Leg17Bridges` | Posted bridge restrictions (`Bridge_Posting`) |
| `Resident_Construction_Office_view` | Nearest RCE office auto-detect |
| `Iowa_DOT_Five_Year_Program_Project_Data_V2_Public_VIEW` | 5-Year Program project codes |
| `Project_Scheduling_Public_Bid_Line_View` | Letting/bid **project numbers** |

### Federal
| Service | Used for |
|---|---|
| `NTAD_National_Bridge_Inventory` (org `xOi1kZaI0eWDREZv`) | **Live bridge clearances** (item 54B vertical underclearance), statewide |

### Other endpoints
| Endpoint | Used for | Notes |
|---|---|---|
| `corridor-bridges.pages.dev/bridges.json` | Static NBI corridor fallback | Used only if the live NBI service is unavailable |
| `geo.fcc.gov/api/census/area` | County from lat/lon | Works from `file://` |
| `router.project-osrm.org` | Road-following geometry (detours + fallback) | Public OSRM |
| OpenStreetMap **Nominatim** | Reverse-geocode road name | Optional toggle; blocked from `file://` (degrades gracefully) |
| `www.google.com/maps/dir/` | Shareable route/detour map links | Opens in a browser tab (not an API call) |
| `mail.google.com/mail/` | Gmail compose fallback | Used only if no desktop mail app |
| `iowadot.seamlessdocs.com` | Official 511 web form | Opened for copy/paste submission |
| *your* `…/api/cars511` | **Optional** database submit | Configured per device (see `CARS511_DATABASE_INTEGRATION.md`) |

Plus map tiles from OpenStreetMap. No credentials are required for any lookup; only the optional database submit uses an auth token you configure.

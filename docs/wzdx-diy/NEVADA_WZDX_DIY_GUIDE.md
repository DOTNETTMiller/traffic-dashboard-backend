# Nevada WZDx Feed — Complete Directions

**Everything Nevada DOT needs to publish an official WZDx v4.2 work zone feed and register it with FHWA/USDOT, in one document.** The only other file you need is the companion script, `nevada_wzdx_generator.py` — keep the two together.

**No programming knowledge is required to run the script, and nothing needs to be installed except Python itself.**

---

## Who does what

| Role | Their parts | Effort |
|---|---|---|
| **Program lead** (you — no technical skills needed) | Parts 1, 4, 6, 7, 8 — API key, review, registration, data-quality rollout | A few hours, spread out |
| **Any IT person** (help desk level is fine) | Parts 2, 3, 5 — install Python, schedule the script, put one file on a web server | About half a day, once |

The pipeline being built:

```
Nevada 511 / NV Roads API  ──►  script (runs every 5 min)  ──►  wzdx_nevada.geojson  ──►  public URL  ──►  USDOT Feed Registry
```

> **Shortcut worth one phone call before doing anything:** ask your 511 platform vendor whether a native WZDx output can be enabled on the NV Roads platform — several 511 vendors offer it as a product feature. If yes, skip straight to Part 7 (registration). If no or too slow, continue — the DIY path below is proven working against Nevada's live API.

---

## Part 1 — Get an API key (program lead, ~15 minutes)

The source is Nevada's own 511 system: `https://www.nvroads.com/api/v2/get/event`. Create an account at https://www.nvroads.com and request a **developer API key** (Developer/API section of the account pages) — or, since NDOT owns the 511 contract, the 511 program manager can get a key directly from the vendor with no rate limits.

## Part 2 — Install Python and run the script (IT, ~30 minutes)

1. Install **Python 3.9 or newer** from https://www.python.org/downloads/ (on Windows, check *"Add Python to PATH"* during install). Many machines already have it.
2. Put `nevada_wzdx_generator.py` in a folder of its own (e.g. `C:\wzdx\` or `/opt/wzdx/`).
3. In the same folder, create a plain-text file named **`credentials.txt`** containing exactly one line (with the real key from Part 1):
   ```
   NV511_API_KEY=your-nvroads-key
   ```
   Restrict who can read this file (it holds a key).
4. Open a command prompt / terminal **in that folder** and run:
   ```
   python nevada_wzdx_generator.py
   ```
   (If `python` isn't recognized, try `python3` or, on Windows, `py`.)

Expected output:

```
Fetching https://www.nvroads.com/api/v2/get/event ...
Source events: 106
Work-zone features: 135 (skipped 5 non-work-zone, 0 without coordinates)
Data gaps: 87 across 64 features (71 gap-free) -> wzdx_nevada_gaps.md
Specification check: PASSED (WZDx v4.2)
Wrote wzdx_nevada.geojson (538,215 bytes)
Wrote wzdx_nevada.cifs.xml (NNN CIFS incidents; N point-only skipped)
```

Three files appear: **`wzdx_nevada.geojson`** (the WZDx feed), **`wzdx_nevada.cifs.xml`** (a CIFS feed for Google/Waze, written automatically alongside the WZDx feed; add `--no-cifs` to skip it), and **`wzdx_nevada_gaps.md`** (the data-quality report — Part 6). Publish the `.cifs.xml` at a public URL the same way as the GeoJSON if you want to feed Google/Waze directly (`Content-Type: application/xml`).

> **Optional — road-following geometry.** Nevada's feed already uses encoded polylines, so most work zones follow the roadway. For any that fall back to a two-point location (see the gap report), you can run the included `wzdx_geometry_fix.py` tool on the output to snap them to your centerline, then FHWA ARNOLD, then OSM routing. That tool needs the `shapely` and `pyproj` packages, so it is a separate optional step rather than part of this no-install script.

**If something goes wrong, the script says so in plain English** — rejected key, no internet/firewall, missing credentials file — and every run re-checks the output against the WZDx v4.2 specification before writing, so a bad run can never replace a good feed. `python nevada_wzdx_generator.py --probe` shows the raw source data if anything ever needs investigating.

## Part 3 — Make it run every 5 minutes (IT, ~15 minutes)

**Windows (Task Scheduler), one command in an administrator prompt:**

```
schtasks /Create /TN "WZDx Nevada Feed" /SC MINUTE /MO 5 /TR "python C:\wzdx\nevada_wzdx_generator.py --out C:\inetpub\wwwroot\data\wzdx_nevada.geojson"
```

**Linux (cron):** `crontab -e`, then add:

```
*/5 * * * * cd /opt/wzdx && python3 nevada_wzdx_generator.py --out /var/www/data/wzdx_nevada.geojson >> wzdx.log 2>&1
```

The `--out` path should point at the web-served location from Part 5. Writes are atomic — consumers never see a half-written file.

## Part 4 — Check the output once (program lead, ~15 minutes)

1. Drag `wzdx_nevada.geojson` onto https://geojson.io — work zones should draw along Nevada highways (drawn extents as lines, single locations as dots).
2. Spot-check five events against https://www.nvroads.com — locations, directions, lane impacts should match.
3. Optional extra credit: USDOT's self-validation checklist — https://github.com/usdot-jpo-ode/wzdx/blob/main/documents/WZDx_Data_Feed_Self-Validation_Checklist_April2022.pdf

## Part 5 — Put the file at a public web address (IT, one ticket)

Requirements: **HTTPS, no login, stable URL, updated every ~5 minutes** (the scheduled task from Part 3 handles the updating — this is just where the file lands). Any one of:

- **A. Existing NDOT web server** — serve the file at e.g. `https://www.dot.nv.gov/data/wzdx_nevada.geojson`. Ideal headers: `Content-Type: application/geo+json`, `Cache-Control: max-age=300`, `Access-Control-Allow-Origin: *`.
- **B. Cloud storage** — an S3 bucket / Azure blob behind a CDN; have the scheduled task copy the file up after each run.
- **C. NODE (National Open Data Exchange / MITRE iNODE)** — if NDOT can't host a public endpoint, coordinate with the NODE program office to onboard as a data provider and publish through NODE instead; NDOT remains the issuing organization. Nevada's SMART data-exchange grant work is a natural vehicle for this onboarding, and the feed plugs straight into the I-80 corridor program.

Afterward, set a simple uptime monitor to alert if the URL's `feed_info.update_date` is more than 30 minutes old.

## Part 6 — Fix the data at the source (program lead, ongoing)

Every run writes **`wzdx_nevada_gaps.md`**: what the source data is missing, how many events are affected, and exactly what to change in the 511 entry. The feed is always specification-valid — this report is the work-off list that makes it *useful*.

**Nevada's advantage:** the NV Roads entry system has **structured fields for everything below** — the gaps are unfilled fields, not missing capability. An entry-desk rule of *"no roadwork event saved with an Unknown direction, blank PlannedEndDate, or empty LanesAffected"* clears most of this with zero vendor work. Live baseline (2026-07-28, 135 features, 71 fully gap-free):

| Gap | Affected | Fix at the source |
|---|---|---|
| **Lane impact not stated** | **37 (27%)** | Fill `LanesAffected` (or state lanes in the description). Nevada's #1 gap. |
| No drawn extent | 21 (16%) | Draw the polyline (or set secondary lat/long) so the zone maps as a line, not a dot |
| No planned end date | 15 (11%) | Fill `PlannedEndDate`; update when schedules slip |
| Direction unknown | 14 (10%) | Set `DirectionOfTravel` — never leave "Unknown" |

Track these percentages monthly — falling numbers are your data-quality KPI, and a reportable data-exchange outcome for the SMART grant.

### Work-zone intake form (copy for resident engineers / permit holders / contractors)

One form per work zone, filed with the TMC/511 desk before cones go out; resubmit on schedule changes; close out on completion. **Each answer maps directly onto a field in the NV Roads entry screen — no interpretation needed.**

| # | Field | Entry |
|---|---|---|
| 1 | Project / contract / permit number; submitted by (name, phone) | ______________ |
| 2 | ☐ New ☐ Update ☐ **Closeout** — existing event #: | ______________ |
| 3 | ● Route as signed (`I-80`, `I-15`, `US-95`, `SR-28`) → `RoadwayName` | ______________ |
| 4 | ● Direction(s): ☐ NB ☐ SB ☐ EB ☐ WB ☐ Both → `DirectionOfTravel` *(never "Unknown")* | |
| 5 | ● Begin point — milepost **and** nearest interchange/cross street | ______________ |
| 6 | ● End point — milepost **and** nearest interchange/cross street → *511 entry should also **draw the polyline** between these points* | ______________ |
| 7 | ● Planned start — date **and** time (Pacific) → `StartDate` | ______________ |
| 8 | ● **Planned end** — date **and** time → `PlannedEndDate` *(best estimate required; "unknown" not accepted — update it later if it slips)* | ______________ |
| 9 | Work pattern: ☐ 24/7 ☐ Days ____–____ ☐ Nights ____–____ ☐ Weekdays only | |
| 10 | ● Closure type → 511 fields: ☐ Full closure → `IsFullClosure = Yes` · ☐ Lane(s) closed → `LanesAffected` = "left/right/center lane closed" (count: ____) · ☐ Alternating one-way (☐ flaggers ☐ pilot car ☐ temp signal) · ☐ Lanes shifted ☐ left ☐ right · ☐ Shoulder only | |
| 11 | Reduced speed: ____ mph (normal ____) → `Restrictions.Speed` · Restrictions: ☐ Width ____ ft ☐ Height ____ ft ☐ Length ____ ft ☐ Weight ____ lbs ☐ No oversize → `Restrictions.*` *(publish as machine-readable truck-routing data)* | |
| 12 | Event type for the 511 entry: **roadwork** *(other types don't enter the work-zone feed)* · Type of work: ☐ Maintenance ☐ Surface/paving ☐ Bridge ☐ Overhead ☐ Below-road ☐ Barrier ☐ Striping ☐ Other ____ | |
| 13 | Workers present during closure hours? ☐ Yes ☐ No · Mobile operation? ☐ Static ☐ Moving | |
| 14 | ● Description — **[What] on [route + direction] from [begin] to [end]: [lane impact]. [Delay/advice].** *Example: "Paving on I-80 westbound from Exit 46 (Golconda) to Exit 43: right lane closed. Expect delays up to 10 minutes."* → `Description` | ______________ |

Digitize in Microsoft/Google Forms or ArcGIS Survey123 (map-click begin/end points), and attach it to lane-closure permits and preconstruction checklists.

## Part 7 — Register with FHWA/USDOT (program lead, one email)

After the feed has run stably for about a week:

**Email `avdx@dot.gov`** (the USDOT point of contact for the Work Zone Data Feed Registry, dataset 69qe-yiui on data.transportation.gov):

> **Subject:** New WZDx feed registration — Nevada DOT
>
> Hello,
>
> The Nevada Department of Transportation has published a statewide Work Zone Data Exchange feed and requests that it be added to the Work Zone Data Feed Registry (dataset 69qe-yiui).
>
> - Feed URL: https://…/wzdx_nevada.geojson
> - Specification: WZDx v4.2, Work Zone Feed (GeoJSON)
> - Coverage: all NDOT-maintained routes statewide, sourced from the Nevada 511 / NV Roads system
> - Update frequency: every 5 minutes; no API key required; license CC0 1.0
> - The feed passes WZDx v4.2 specification validation on every generation.
> - Technical POC: [name, title, email, phone]
>
> Please let us know if additional information or verification is needed.

Confirm the listing appears in the registry (allow a few weeks; follow up at the same address). Then tell your FHWA Division Office and cite the registered feed in SMART grant reporting — it's a concrete data-exchange deliverable. Navigation providers (Google, HERE, TomTom, Waze) discover feeds through this registry.

## Part 8 — Keep it healthy

- **Freshness:** the Part 5 monitor alerts if the feed stops updating.
- **Quality:** re-read `wzdx_nevada_gaps.md` monthly; drive the percentages down via Part 6.
- **Registry changes:** email `avdx@dot.gov` when the URL or point of contact changes.
- **Upgrades:** when WZDx v5 is released, the script needs a small update — one item, not a rebuild.

---

## Appendix — Field mapping (NV Roads event API → WZDx v4.2)

For the technically curious and future maintainers; the script implements all of this. The accessor accepts both PascalCase and snake_case variants; ● = WZDx-required.

| NV Roads source | WZDx v4.2 target | Transform |
|---|---|---|
| `ID` | ● `features[].id` | Prefix `NV-`; stable across updates |
| `EventType` (+ subtype/description keywords) | filter → ● `core_details.event_type` = `work-zone` | Only `roadwork`/construction/maintenance events; crashes and weather excluded |
| `RoadwayName` | ● `core_details.road_names[]` | As-is |
| `DirectionOfTravel` | ● `core_details.direction` | NB/SB/EB/WB → enum; "All/Both" → **two road events** (`-1`/`-2`), axis from route parity (even = E–W); missing → recovered from direction words in the road name/description, else `undefined` |
| `EncodedPolyline` | ● `geometry` | Google encoded polyline (precision 5) → `LineString` `[lng, lat]`, WGS84 — preferred source |
| `Latitude`/`Longitude` (+ `LatitudeSecondary`/`LongitudeSecondary`) | `geometry` fallback | Both pairs → 2-point `LineString`; one → `MultiPoint` (bare `Point` is invalid WZDx) |
| `StartDate` / `PlannedEndDate` | ● `start_date` / ● `end_date` | **Epoch seconds → UTC ISO**; missing end → start + 30 days (never in the past), `is_end_date_verified: false` |
| `Reported` / `LastUpdated` | `core_details.creation_date` / `update_date` | Epoch → UTC |
| `IsFullClosure`, `LanesAffected` | ● `vehicle_impact` | `IsFullClosure` → `all-lanes-closed`; else lane language → enum; unmatched → `unknown` |
| `Restrictions.Width/Height/Length/Weight` | `restrictions[]` | feet/pounds, `reduced-*` types |
| `Restrictions.Speed` | `reduced_speed_limit_kph` | mph × 1.609344 |
| `AreaName` | appended to description | e.g. "(Clark)" |
| *(constants)* | ● `location_method` = `junction-method`; `work_zone_type` = `static`; four `is_*_verified` = `false`; `event_status` from dates | v4.2 requirements |

**Feed header (`feed_info`):** publisher `Nevada Department of Transportation`, version `4.2`, license CC0 (the only value the spec allows), `update_frequency` 300 s, data source id `ndot-nvroads-511`.

**References:** WZDx spec & schemas — https://github.com/usdot-jpo-ode/wzdx · Feed Registry — https://data.transportation.gov/Roadways-and-Bridges/Work-Zone-Data-Feed-Registry/69qe-yiui

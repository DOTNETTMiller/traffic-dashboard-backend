# Nebraska WZDx Feed — Complete Directions

**Everything Nebraska DOT needs to publish an official WZDx v4.2 work zone feed and register it with FHWA/USDOT, in one document.** The only other file you need is the companion script, `nebraska_wzdx_generator.py` — keep the two together.

**No programming knowledge is required to run the script, and nothing needs to be installed except Python itself.**

---

## Who does what

| Role | Their parts | Effort |
|---|---|---|
| **Program lead** (you — no technical skills needed) | Parts 1, 4, 6, 7, 8 — credentials, review, registration, data-quality rollout | A few hours, spread out |
| **Any IT person** (help desk level is fine) | Parts 2, 3, 5 — install Python, schedule the script, put one file on a web server | About half a day, once |

The pipeline being built:

```
Nebraska CARS/511 feed  ──►  script (runs every 5 min)  ──►  wzdx_nebraska.geojson  ──►  public URL  ──►  USDOT Feed Registry
```

> **Shortcut worth one phone call before doing anything:** the CARS platform (Castle Rock) can natively produce WZDx for member states — Iowa's registry feed comes from the same platform. Ask your CARS Program representative whether a WZDx output can simply be enabled for Nebraska. If yes, skip straight to Part 7 (registration). If no or too slow, continue — the DIY path below is proven working against Nebraska's live feed.

---

## Part 1 — Get credentials (program lead, ~1 email)

The source is Nebraska's own CARS feed: `https://ne.carsprogram.org/hub/data/feu-g.xml`, protected by a username and password. Your 511/CARS hub administrator (or Castle Rock support) issues them — ask for **read access to the Nebraska FEU-G hub feed**. NDOT operations staff who manage 511 typically already have these.

## Part 2 — Install Python and run the script (IT, ~30 minutes)

1. Install **Python 3.9 or newer** from https://www.python.org/downloads/ (on Windows, check *"Add Python to PATH"* during install). Many machines already have it.
2. Put `nebraska_wzdx_generator.py` in a folder of its own (e.g. `C:\wzdx\` or `/opt/wzdx/`).
3. In the same folder, create a plain-text file named **`credentials.txt`** containing exactly two lines (with the real values from Part 1):
   ```
   CARS_USERNAME=your-hub-username
   CARS_PASSWORD=your-hub-password
   ```
   Restrict who can read this file (it holds a password).
4. Open a command prompt / terminal **in that folder** and run:
   ```
   python nebraska_wzdx_generator.py
   ```
   (If `python` isn't recognized, try `python3` or, on Windows, `py`.)

Expected output:

```
Fetching https://ne.carsprogram.org/hub/data/feu-g.xml ...
Source events: 659
Work-zone features: 332 (skipped 491 non-work-zone, 0 without coordinates)
Data gaps: 594 across 332 features (0 gap-free) -> wzdx_nebraska_gaps.md
Specification check: PASSED (WZDx v4.2)
Wrote wzdx_nebraska.geojson (333,028 bytes)
Wrote wzdx_nebraska.cifs.xml (NNN CIFS incidents; N point-only skipped)
```

Three files appear: **`wzdx_nebraska.geojson`** (the WZDx feed), **`wzdx_nebraska.cifs.xml`** (a CIFS feed for Google/Waze, written automatically alongside the WZDx feed; add `--no-cifs` to skip it), and **`wzdx_nebraska_gaps.md`** (the data-quality report — Part 6). Publish the `.cifs.xml` at a public URL the same way as the GeoJSON if you want to feed Google/Waze directly (`Content-Type: application/xml`).

> **Optional — road-following geometry.** Nebraska's source gives each work zone as a two-point (straight-line) location, which mapping partners pick up less reliably. If you want polylines that follow the roadway, run the included `wzdx_geometry_fix.py` tool on the output: it snaps to your centerline, then FHWA ARNOLD, then OSM routing. That tool needs the `shapely` and `pyproj` packages, so it is a separate optional step rather than part of this no-install script.

**If something goes wrong, the script says so in plain English** — wrong password, no internet/firewall, missing credentials file — and every run re-checks the output against the WZDx v4.2 specification before writing, so a bad run can never replace a good feed. `python nebraska_wzdx_generator.py --probe` shows the raw source data if anything ever needs investigating.

## Part 3 — Make it run every 5 minutes (IT, ~15 minutes)

**Windows (Task Scheduler), one command in an administrator prompt:**

```
schtasks /Create /TN "WZDx Nebraska Feed" /SC MINUTE /MO 5 /TR "python C:\wzdx\nebraska_wzdx_generator.py --out C:\inetpub\wwwroot\data\wzdx_nebraska.geojson"
```

**Linux (cron):** `crontab -e`, then add:

```
*/5 * * * * cd /opt/wzdx && python3 nebraska_wzdx_generator.py --out /var/www/data/wzdx_nebraska.geojson >> wzdx.log 2>&1
```

The `--out` path should point at the web-served location from Part 5. Writes are atomic — consumers never see a half-written file.

## Part 4 — Check the output once (program lead, ~15 minutes)

1. Drag `wzdx_nebraska.geojson` onto https://geojson.io — work zones should draw on Nebraska highways.
2. Spot-check five events against https://511.nebraska.gov — locations, directions, lane impacts should match.
3. Optional extra credit: USDOT's self-validation checklist — https://github.com/usdot-jpo-ode/wzdx/blob/main/documents/WZDx_Data_Feed_Self-Validation_Checklist_April2022.pdf

## Part 5 — Put the file at a public web address (IT, one ticket)

Requirements: **HTTPS, no login, stable URL, updated every ~5 minutes** (the scheduled task from Part 3 handles the updating — this is just where the file lands). Any one of:

- **A. Existing NDOT web server** — serve the file at e.g. `https://dot.nebraska.gov/data/wzdx_nebraska.geojson`. Ideal headers: `Content-Type: application/geo+json`, `Cache-Control: max-age=300`, `Access-Control-Allow-Origin: *`.
- **B. Cloud storage** — an S3 bucket / Azure blob behind a CDN; have the scheduled task copy the file up after each run.
- **C. NODE (National Open Data Exchange / MITRE iNODE)** — if NDOT can't host a public endpoint, coordinate with the NODE program office to onboard as a data provider and publish through NODE instead; NDOT remains the issuing organization, and the feed plugs straight into the I-80 corridor program.

Afterward, set a simple uptime monitor to alert if the URL's `feed_info.update_date` is more than 30 minutes old.

## Part 6 — Fix the data at the source (program lead, ongoing)

Every run writes **`wzdx_nebraska_gaps.md`**: what the source data is missing, how many events are affected, and exactly what to change in CARS. The feed is always specification-valid — this report is the work-off list that makes it *useful*. Live baseline (2026-07-28, 332 features):

| Gap | Affected | Fix at the source |
|---|---|---|
| **No explicit end time** | **332 (100%)** | The hub publishes only an update-time + a fixed duration. Two-part fix: enter planned completion dates in CARS, **and email the CARS Program rep one request — enable start/end times on the FEU-G hub output.** Nebraska's #1 gap; the hub setting clears it statewide. |
| Lane impact not stated | 139 (42%) | Use the phrase table below in every CARS description |
| No end point (extent) | 60 (18%) | Enter the secondary/end location so the zone maps as a line, not a dot |
| Terse description | 49 (15%) | Use the description formula below |
| No milepost | 14 (4%) | Populate the linear reference |

Track these percentages monthly — falling numbers are your data-quality KPI.

### Work-zone intake form (copy for resident engineers / permit holders / contractors)

One form per work zone, filed with the TMC/511 desk before cones go out; resubmit on schedule changes; close out on completion. **In Nebraska, lane impact travels to the public feed as description text, so the checked box commits the CARS entry to the exact phrase shown.**

| # | Field | Entry |
|---|---|---|
| 1 | Project / permit number; submitted by (name, phone) | ______________ |
| 2 | ☐ New ☐ Update ☐ **Closeout** — existing event #: | ______________ |
| 3 | ● Route as signed (`I-80`, `US-30`, `N-2`) | ______________ |
| 4 | ● Direction(s): ☐ NB ☐ SB ☐ EB ☐ WB ☐ Both | |
| 5 | ● Begin point — reference post **and** nearest interchange/cross street | ______________ |
| 6 | ● End point — reference post **and** nearest interchange/cross street *(required; "same as begin" if a single spot)* | ______________ |
| 7 | ● Planned start — date **and** time (☐ Central ☐ Mountain) | ______________ |
| 8 | ● **Planned end** — date **and** time *(best estimate required; "unknown" not accepted — update it later if it slips)* | ______________ |
| 9 | Work pattern: ☐ 24/7 ☐ Days ____–____ ☐ Nights ____–____ ☐ Weekdays only | |
| 10 | ● Closure type → phrase for the CARS description: ☐ Full closure → "**road closed**" · ☐ Lane(s) closed → "**left/right/center lane closed**" · ☐ Alternating → "**alternating one-lane traffic**" (+ "with pilot car") · ☐ Flaggers → "**flagger**" · ☐ Shifted → "**lanes shifted left/right**" · ☐ Shoulder only → "**shoulder work — all lanes open**" | |
| 11 | Reduced speed: ____ mph (normal ____) · Restrictions: ☐ Width ____ ft ☐ Height ____ ft ☐ Length ____ ft ☐ Weight ____ ☐ No oversize | |
| 12 | Type of work: ☐ Maintenance ☐ Surface/paving ☐ Bridge ☐ Overhead ☐ Below-road ☐ Barrier ☐ Striping ☐ Other ____ | |
| 13 | Workers present during closure hours? ☐ Yes ☐ No · Mobile operation? ☐ Static ☐ Moving | |
| 14 | ● Description — use the formula: **[What] on [route + direction] from [begin RP] to [end RP]: [phrase from #10]. [Delay/advice].** *Example: "Bridge deck repair on I-80 westbound from RP 432 to RP 428: right lane closed, alternating one-lane traffic at night with pilot car. Expect delays up to 15 minutes."* | ______________ |

Digitize in Microsoft/Google Forms or ArcGIS Survey123 (keep #10's phrases exactly as worded), and attach it to lane-closure permits and preconstruction checklists.

## Part 7 — Register with FHWA/USDOT (program lead, one email)

After the feed has run stably for about a week:

**Email `avdx@dot.gov`** (the USDOT point of contact for the Work Zone Data Feed Registry, dataset 69qe-yiui on data.transportation.gov):

> **Subject:** New WZDx feed registration — Nebraska DOT
>
> Hello,
>
> The Nebraska Department of Transportation has published a statewide Work Zone Data Exchange feed and requests that it be added to the Work Zone Data Feed Registry (dataset 69qe-yiui).
>
> - Feed URL: https://…/wzdx_nebraska.geojson
> - Specification: WZDx v4.2, Work Zone Feed (GeoJSON)
> - Coverage: all NDOT-maintained routes statewide, sourced from the Nebraska 511/CARS system
> - Update frequency: every 5 minutes; no API key required; license CC0 1.0
> - The feed passes WZDx v4.2 specification validation on every generation.
> - Technical POC: [name, title, email, phone]
>
> Please let us know if additional information or verification is needed.

Confirm the listing appears in the registry (allow a few weeks; follow up at the same address). Then tell your FHWA Division Office — a registered feed counts toward federal work zone data commitments and strengthens grant applications. Navigation providers (Google, HERE, TomTom, Waze) discover feeds through this registry.

## Part 8 — Keep it healthy

- **Freshness:** the Part 5 monitor alerts if the feed stops updating.
- **Quality:** re-read `wzdx_nebraska_gaps.md` monthly; drive the percentages down via Part 6.
- **Registry changes:** email `avdx@dot.gov` when the URL or point of contact changes.
- **Upgrades:** when WZDx v5 is released, the script needs a small update — one item, not a rebuild.

---

## Appendix — Field mapping (CARS FEU-G → WZDx v4.2)

For the technically curious and future maintainers; the script implements all of this. FEU-G paths are relative to each `FEUMessages / full-event-update` element; ● = WZDx-required.

| FEU-G source | WZDx v4.2 target | Transform |
|---|---|---|
| `event-reference/event-id` | ● `features[].id` | Prefix `NE-`; stable across updates |
| `headline/headline` (ITIS phrase) | `core_details.name`; work-zone filter | Only roadwork/construction/maintenance-type events become `event_type` ● `work-zone` |
| `details/detail/descriptions/description[]/phrase` | `core_details.description` | Text nodes joined with `; ` |
| `…/location-on-link/route-designator`; `roadway-names/roadway-name[]` | ● `core_details.road_names[]` | De-duplicated |
| `…/link-direction` + `link-alignment` | ● `core_details.direction` | positive/negative × N/E/S/W → `northbound`…`westbound`; "both directions" → **two road events** (`-1`/`-2`), axis from alignment or route parity (even = E–W); else `undefined` |
| `…/primary-location/geo-location` (+ `secondary-location`) | ● `geometry` | **Microdegrees ÷ 1,000,000**, WGS84 `[lng, lat]`; both points → `LineString`, one point → `MultiPoint` (bare `Point` is invalid WZDx) |
| `…/primary-location/linear-reference` | `beginning_milepost` | Float |
| `details/detail/times/start-time` (live hub) or `event-times/start-time` | ● `start_date` | Compound `{date, time, utc-offset}` or ISO string → UTC `Z`; missing → anchored to update-time |
| `…/times/end-time` / `valid-period` | ● `end_date` | **Live hub has no end times** — derived from `duration` (fallback +30 days), never in the past, `is_end_date_verified: false` |
| `…/times/update-time` | `core_details.update_date` | UTC |
| *(derived from text)* | ● `vehicle_impact` | Phrase table in Part 6 #10; unmatched → `unknown` |
| *(constants)* | ● `location_method` = `junction-method`; `work_zone_type` = `static`; four `is_*_verified` = `false`; `event_status` from dates | v4.2 requirements |

**Feed header (`feed_info`):** publisher `Nebraska Department of Transportation`, version `4.2`, license CC0 (the only value the spec allows), `update_frequency` 300 s, data source id `ndot-cars-511`.

**References:** WZDx spec & schemas — https://github.com/usdot-jpo-ode/wzdx · Feed Registry — https://data.transportation.gov/Roadways-and-Bridges/Work-Zone-Data-Feed-Registry/69qe-yiui

# Improving Work-Zone Data in Nevada & Nebraska

*A briefing for NDOT (Nevada) and NDOT (Nebraska) 511 / traffic-operations leads.*
*Prepared 2026-08-25. Companion materials: `docs/wzdx-diy/` (complete DIY kits + tested generators for both states).*

---

## Why this matters

WZDx (the USDOT Work Zone Data Exchange) is the national standard that lets navigation apps, freight routers, and connected-vehicle systems consume a state's work zones automatically. A registered WZDx feed puts your closures in front of Google/Apple/Waze/freight platforms — and makes your zones eligible for independent validation (camera, probe-traffic, and message-sign corroboration) instead of living only inside your 511 map.

Neither state publishes a registered WZDx feed today. Both are **one short step away**, and the data underneath is already good enough to start.

---

## Where each state stands (measured 2026-08-25)

| | **Nevada** | **Nebraska** |
|---|---|---|
| 511 platform | one.network (nvroads.com) | CARS / Castle Rock (ne.carsprogram.org) |
| Live work-zone events | ~76 construction events | ~332 work-zone features (from 659 raw) |
| Public, no-auth access | ✅ yes (already ingested by the corridor platform) | ❌ no — CARS hub is credentialed |
| Registered WZDx feed | none | none |
| Native WZDx available from vendor? | Ask one.network — several vendors offer it | **Yes — CARS/Castle Rock already emits WZDx** (it's how Iowa's registered feed is produced) |
| DIY kit (fallback) | ✅ proven vs live API | ✅ proven vs live feed |

---

## The recommended action — per state

### Nebraska — one phone call (highest-leverage, lowest-effort)
Nebraska's 511 runs on the **CARS platform (Castle Rock Associates)** — the *same* platform that produces **Iowa's** registered WZDx feed. Before any development work:

> **Ask your CARS Program representative to enable the native WZDx output for Nebraska.**

If they enable it, you skip straight to registration (below) with **zero engineering**. If it's unavailable or slow, the DIY kit (`docs/wzdx-diy/NEBRASKA_WZDX_DIY_GUIDE.md`) is proven working against Nebraska's live CARS FEU-G feed — a half-day IT lift.

### Nevada — ask the vendor, else run the kit
Nevada's data is already public and clean. Ask **one.network** whether a native WZDx output can be turned on for the NV Roads platform. If not, run the DIY kit (`docs/wzdx-diy/NEVADA_WZDX_DIY_GUIDE.md`) against `nvroads.com/api/v2/get/event` — a half-day IT lift.

### Register the feed (both states)
Once a public WZDx URL exists, register it with the **USDOT Work Zone Data Exchange feed registry** (email **avdx@dot.gov**). Registration is free and puts the feed on the national map.

---

## Data-quality punch-list

A WZDx feed is only as useful as its fields. Priorities below.

### Nevada — live findings (measured against nvroads construction data)
Nevada's core fields are strong: roadway name, direction, start date, description, and closure flag are all **100%** populated. The gaps to close:

| Gap | Current | Fix |
|---|---|---|
| **Line geometry** | Map pins are single **points** | WZDx wants a `LineString` with an accurate **begin/end** along the roadway. Highest-value fix — enables lane-level routing and camera/probe matching. (The kit's `wzdx_geometry_fix.py` handles the 2-point remediation.) |
| **End dates** | ~**17% missing** | Populate `end_date` on every zone; navigation apps drop zones without an end time. |
| **Structured lanes** | `laneDescription` is free text | Map to the WZDx `lanes[]` array (order, status, type) so downstream systems can reason about which lanes are closed. Restriction fields (`widthRestriction`, `heightRestriction`, `lengthRestriction`, `weightRestriction`) already exist — carry them into WZDx `restrictions`. |

### Nebraska — pending public access
Nebraska's raw feed reports **594 data gaps across 332 features (0 gap-free)** per the DIY generator's own gap report — completeness is the priority, not geometry. The generator writes a per-feature `wzdx_nebraska_gaps.md` punch-list on every run; that report is the fix list. *A live field-by-field analysis on our side is blocked until Nebraska exposes a public feed (see "recommended action").*

---

## What the states get back (at near-zero burden)

Once a state's zones are public (even the raw 511 today, for Nevada), the corridor platform adds **independent validation** on top — four separate sources, none of which touch the state's own feed:

- 🔗 **Connected devices** (arrow boards / DMS telemetry)
- 📷 **Camera AI-vision** (a traffic camera actually sees the zone)
- 🚗 **TomTom** (commercial probe reports construction at the spot)
- 🔶 **DMS message text** (a message sign is posting the closure)

This is the **enhanced feed** concept: the state keeps publishing its normal feed; we return a layered, validation-flagged version that raises confidence and flags likely-stale zones — with no added work for the state.

---

## Bottom line

1. **Nebraska:** one call to CARS/Castle Rock could turn on a registered WZDx feed with no engineering — do this first.
2. **Nevada:** data is already clean and public; publish it as WZDx (vendor toggle or the proven kit) and fix geometry + end dates.
3. Both: register at **avdx@dot.gov**, then get free independent validation via the corridor platform.

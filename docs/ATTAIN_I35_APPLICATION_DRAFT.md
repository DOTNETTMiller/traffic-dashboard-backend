# ATTAIN Application — FIRST DRAFT

## I-35 Connected Work Zone Corridor: Digital Corridor Infrastructure from Laredo to Duluth

> **Status: DRAFT input for the Iowa DOT application team — {PLACEHOLDER}
> marks items to supply. Not for submission.**
>
> **CONFIRMED 2026-08-04: Iowa DOT is the lead applicant**, supporting CCAI
> efforts and I-35 Anchor State activities. Scope per CCAI year-one work
> plan: public + private data for **work zones and truck parking**. Headline
> goal: **cut truck-driver parking-search time from 60 to 30 minutes**.
> Internal timeline: proposal complete EOD Thu Aug 7 → Governor's Office
> review Fri Aug 8 / Mon Aug 10 → federal deadline Aug 11. Partner states
> invited via letter-of-commitment template.
>
> Program: FHWA Advanced Transportation Technologies and Innovation (ATTAIN),
> FY25–FY26 NOFO. Deadline: **August 11, 2026**. Federal share ≤80%;
> non-Federal cost share ≥20%. Award ceiling $12M.

---

## Executive Summary

The I-35 corridor states propose to deploy the nation's first **end-to-end
connected work zone corridor**: every significant work zone on I-35 from the
Mexican border to Lake Superior digitally published in machine-readable
standards (WZDx 4.2 / Connected Work Zones 1.0), broadcast to connected and
automated vehicles, delivered to every major navigation platform, and — unique
among ATTAIN applications — **independently measured for accuracy against
ground truth** by an operational multi-state data quality instrument.

This is not a concept proposal. The core technology is operational today:

- A corridor data platform currently ingesting and normalizing real-time work
  zone, incident, truck parking, and weather data from **~39 state and
  sub-state producers** across WZDx (v3.0–v4.2), CWZ 1.0, TMDD, CIFS, and
  TPIMS standards.
- A **Data Quality Index (DQI)** and per-event confidence scoring framework
  applying the Eastern Transportation Coalition grading methodology
  consistently across states.
- A ground-truth validation capability comparing DOT-reported events against
  **multiple independent sources**: probe data (TomTom), HaulHub e-ticketing
  activity (materials-delivery presence at work sites — partnership discussion
  with HaulHub and MITRE underway), connected arrow board status, iCone device
  data, and Drivewyze in-cab slow-down alerts (partnership discussion
  scheduled). Cross-corroboration across these sources is the basis of the
  required performance measurement plan.
- An exchange backbone pathway via **MITRE iNODE** for interoperable,
  governed multi-state data exchange.

**The central product is a higher-level corridor feed**: a secondary,
quality-scored, multi-source-validated work zone feed covering the majority
of interstate work zones on the corridor — built by layering state feeds
with independent validation datasets (probe, e-ticketing, connected devices,
in-cab alerts). Critically, this **requires very little from the states**:
their participation and support of the secondary feed, not new systems, new
staff, or new publishing obligations. States keep publishing what they
publish today; the layered feed raises the quality ceiling above what any
single source can achieve. The validated feed is published both as WZDx 4.2
and as **CIFS (Common Incident Feed Specification)** — the format Google and
Waze consume directly — creating a one-connection on-ramp for navigation
services.

The project is organized under the AASHTO-coordinated I-35 Digital Corridor
Infrastructure (DCI) initiative, with {LEAD STATE DOT} as lead applicant on
behalf of the six corridor states (TX, OK, KS, MO, IA, MN), with partner
pooled funds invited to contribute datasets, ideas, and process support.

**Request:** ${12.0}M Federal / ${3.0}M non-Federal (20%) / ${15.0}M total
over 36 months. {PLACEHOLDER: finalize amounts against detailed budget.}

---

## Section 1: Project Description

### Vision

I-35 is one of North America's most consequential freight corridors — the
spine of NAFTA/USMCA truck traffic from the Port of Laredo through Texas,
Oklahoma, Kansas, Missouri, Iowa, and Minnesota. Yet a truck driver (or an
automated driving system) traversing it today crosses six state lines and six
different levels of digital work zone visibility: some states publish
conformant real-time feeds, some publish stale or partial data, and in some
segments work zones exist only as orange barrels — invisible to navigation
systems and connected vehicles until the last moment.

This project closes that gap. At completion, **100% of long-duration and
significant short-duration work zones on I-35 will be digitally published
within {15} minutes of field status change**, conformant to WZDx 4.2 and CWZ
1.0, exchanged through a governed corridor backbone, delivered to CAVs and
navigation platforms, and continuously scored for accuracy.

### Project Overview — Six Deployment Elements

1. **Truck parking availability and prediction network (headline element).**
   Fuse public detection with private/partner signals into corridor-wide
   real-time availability plus **hourly occupancy predictions** per facility.
   Components (stated generically for procurement): TPIMS-style space
   detection; ground-truth devices (camera-based AI occupancy counts —
   already operational at Iowa rest areas — and in-ground sensors);
   historical occupancy archives that train the prediction models; fleet
   telematics and **ELD provider input** (where trucks actually park and
   dwell); **crowd-sourced driver app reports**; and connected-vehicle
   movement analytics. Delivered where drivers decide: navigation apps,
   fleet systems, in-cab alerts, and DMS.
   The prediction engine, calibration service, and accuracy tracking are
   operational today. Success measure: **average end-of-shift parking search
   time cut from 60 to 30 minutes**, with downstream benefits in supply
   chain productivity, fuel efficiency, fewer trucks parked on ramps and
   shoulders, and fewer hours-of-service violations. The closure-to-parking
   linkage ties this element to the work zone elements below: when a work
   zone or closure will consume downstream parking, drivers and fleets know
   before the shift ends.

2. **Standardized publication and geometry remediation (all six states).**
   Bring every corridor state to conformant WZDx 4.2 + CWZ 1.0 publication
   for I-35 work zones, including field-status verification (per FHWA Work
   Zone Data Initiative practices). Includes deployment of lightweight
   feed-generation tooling in states without existing pipelines (tooling
   already built and proven: Python generators produce conformant WZDx from
   existing state feeds, demonstrated for two non-publishing states; MITRE
   can operationalize this as a hosted output). Critically, this element
   also fixes a documented Midwest data defect: **many states publish
   2-point straight-line geometry** that does not follow the roadway — some
   marked "both directions" with only a single line. We have already
   demonstrated remediation to direction-matched, route-following polyline
   GeoJSON, which materially increases uptake by mapping partners.

3. **Connected work zone field systems.** Instrument {N = 40 placeholder}
   active work zones per construction season with connected devices (smart
   arrow boards, connected barrels/beacons, iCone devices, queue detection)
   publishing real-time lane state and geometry; broadcast via V2X (C-V2X
   RSUs where deployed; cellular/SDX pathway corridor-wide). This element
   also closes a known operational gap: today, connected arrow boards must
   be **manually associated by TMC staff with 511 events** — the project
   automates device-to-event association so field devices confirm and
   update events without operator intervention.

4. **Corridor exchange backbone.** Stand up governed multi-state exchange on
   MITRE iNODE: authentication, provenance, versioning, and subscriber
   management for state TMCs, USDOT (Work Zone Data Exchange registry),
   navigation providers, and fleet/AV consumers. The backbone carries both
   directions of the safety loop: field/partner data in (arrow boards,
   iCone, HaulHub, Drivewyze) and validated alerts out — including wider
   dissemination of Drivewyze-style in-cab slow-down alerts through the
   exchange {PLACEHOLDER: pending Drivewyze discussions}.

5. **Enhanced corridor feed + independent measurement layer.** Produce and
   operate the higher-level feed: every corridor work zone corroborated
   against probe data (TomTom), HaulHub e-ticketing activity, connected
   device status (arrow boards, iCone), and Drivewyze slow-down alert
   clusters, carrying a per-event confidence score. Published as WZDx 4.2
   and **CIFS for direct connection to Google, Waze, and other services** —
   no per-state integration required by consumers. The same instrument
   produces monthly state report cards and validation scorecards on a
   public dashboard, doubling as the ATTAIN-required performance
   measurement plan and transferable evaluation methodology for FHWA.
   Includes a **market-penetration observatory**: TomTom's reported events
   are already visible in the platform; the project invites Google and
   Apple to contribute their displayed corridor events as layers on the
   MITRE map, giving states the first real-time view of **which work zone
   events actually reach travelers through each navigation service** — so
   the operational practices behind well-penetrating events can be
   identified and replicated consistently across the corridor.

6. **Corridor vertical clearance intelligence.** Establish a live, verified
   bridge clearance inventory for the corridor by reconciling National
   Bridge Inventory records with state GIS clearance data. Our research
   shows NBI and state-reported clearances **differ by a 2"–6" safety
   factor depending on the state** — a consistency gap that keeps this data
   out of truck routing systems. The project (a) uses WZDx events to flag
   bridges near active construction for clearance re-verification, (b)
   clears the majority of corridor structures with no nearby activity as
   verified-stable, and (c) publishes a consistent, consumable clearance
   feed for trucking and AV routing platforms.

### Goals

| Goal | Target | Measured by |
|---|---|---|
| **Truck parking search time (headline)** | **60 min → 30 min average at end of shift** | Parking prediction accuracy metrics + ground-truth observations + driver/fleet survey {PLACEHOLDER: baseline citation — ATRI research pegs average daily search near this figure; verify current number} |
| Digital work zone coverage on I-35 | 100% of long-duration WZs published | Measurement layer (Element 5) |
| Publication latency | ≤15 min from field change | Feed timestamps vs. field logs |
| Data accuracy | ≥90% location/status agreement with ground truth | Probe deviation scorecard |
| Work zone crash reduction | {25%} on instrumented segments | State crash data; CMF-based |
| CAV consumption | ≥3 navigation platforms + {2} AV/fleet consumers | Subscriber logs |
| Standards conformance | WZDx 4.2 / CWZ 1.0 A-grade in all 6 states | DQI compliance grading |
| Market penetration | ≥{80%} of corridor work zones visible to travelers in ≥1 major navigation service | Market-penetration observatory |

---

## Section 2: Project Location

**Corridor:** Interstate 35, Laredo, TX to Duluth, MN (~1,569 miles), including
I-35E/I-35W splits in the Dallas–Fort Worth and Minneapolis–St. Paul metros.

**States:** Texas, Oklahoma, Kansas, Missouri, Iowa, Minnesota.

**Freight significance:** {PLACEHOLDER: AADT/AADTT by segment; Port of Laredo
crossing volumes; % of US–Mexico surface trade moving on I-35; FAF corridor
ranking.}

**Safety need:** {PLACEHOLDER: 3–5 year work zone crash counts and fatalities
by state on I-35; corridor work zone crash trend. Pull from state crash
databases + FARS. The platform's crash analytics module (live I-35 feed +
FARS historical) can generate this exhibit directly.}

**Urban/rural mix:** Corridor includes major urban segments (San Antonio,
Austin, DFW, OKC, Wichita, Kansas City, Des Moines, Twin Cities, Duluth) and
long rural segments where digital invisibility of work zones is most acute
and detection/communication gaps are largest.

---

## Section 3: Project Parties & Partnerships

### Lead Applicant

**Iowa DOT** (confirmed 2026-08-04) — eligible applicant under 23 U.S.C.
503(c)(4), applying in support of CCAI efforts and I-35 Anchor State
activities, on behalf of the corridor coalition. Partner states join via
letters of commitment and support (template circulated to states 2026-08-04).
Iowa-owned assets already in play: Q-Free WZDx feed, CARS event feed,
rest-area camera network used for AI parking ground-truth counts, and state
GIS clearance data.

### Core Partners

- **Corridor state DOTs (TX, OK, KS, MO, IA, MN)** — {PLACEHOLDER: named
  commitments; each provides corridor work zone data, field deployment sites,
  and match (cash or in-kind).} **The ask of each state is deliberately
  small**: participation and support of the secondary layered feed — no new
  systems, publishing obligations, or dedicated staff.
- **Partner pooled funds** — {PLACEHOLDER: e.g., CCAI pooled fund, TPIMS
  (MAASTO), Eastern Transportation Coalition, smart work zone pooled funds}
  — contribute datasets, operational lessons, and process support toward
  the layered feed; formal coordination letters sought from each.
- **AASHTO** — corridor coordination via the Digital Corridor Infrastructure
  initiative. {PLACEHOLDER: letter of support.}
- **MITRE** — iNODE exchange backbone. {PLACEHOLDER: scope + letter.}
- **Purpose Built Systems / Corridor Communicator platform** — technology and
  measurement partner; operates ingestion, standards translation, DQI
  grading, and the deviation scorecard.

### Validation & Field Data Partners

- **HaulHub** — e-ticketing/materials-delivery activity as independent work
  zone presence validation via the MITRE tool. {STATUS: initial meeting held
  with HaulHub and MITRE; PLACEHOLDER: letter of intent.}
- **iCone** — connected device data for work zone confirmation and automated
  device-to-event association. {STATUS: outreach planned; PLACEHOLDER:
  letter.}
- **Drivewyze** — in-cab slow-down alerts as (a) a validation signal for
  active work zones and (b) a wider dissemination channel through the MITRE
  exchange. {STATUS: meeting scheduled; PLACEHOLDER: letter.}
- **TomTom** — probe-based incident data for reported-vs-observed deviation
  scoring (integration operational today).

### Data Consumers & End Users (adoption evidence)

- Navigation: Google Maps and Waze currently consume WZDx feeds;
  {PLACEHOLDER: letters of intent for corridor-wide consumption; Apple Maps
  letter of interest.}
- Freight: {PLACEHOLDER: ATA / OOIDA / named carriers operating I-35 —
  letters of support; fleet telematics providers (Trimble, Samsara,
  Omnitracs) integration letters.}
- AV developers operating in TX corridor ({PLACEHOLDER: Aurora, Kodiak,
  Waymo Via — letters of interest for CWZ consumption}).

### Governance

Multi-state agreement modeled on pooled-fund governance: executive board (one
member per state DOT), technical working group, and published data-sharing +
interoperability charter (RFC-based change process already drafted in
platform specs). {PLACEHOLDER: confirm instrument — pooled fund vs. MOU under
lead state.}

---

## Section 4: Grant Funds, Sources, and Uses

### Budget Summary {ALL AMOUNTS PLACEHOLDER — validate bottom-up}

| Element | Federal | Non-Federal | Total |
|---|---|---|---|
| 1. Truck parking availability + prediction network (public + private data fusion, delivery channels) | $2.0M | $0.5M | $2.5M |
| 2. Program mgmt, systems engineering, governance | $1.2M | $0.3M | $1.5M |
| 3. Standardized publication + geometry remediation (6 states) | $1.6M | $0.4M | $2.0M |
| 4. Connected work zone field systems ({40} zones/season, incl. automated device-to-event association) | $3.6M | $0.9M | $4.5M |
| 5. Exchange backbone (iNODE integration + partner data in/out) | $1.6M | $0.4M | $2.0M |
| 6. Multi-source measurement layer + public dashboard + evaluation | $1.2M | $0.3M | $1.5M |
| 7. Corridor vertical clearance intelligence (NBI + state GIS reconciliation) | $0.4M | $0.1M | $0.5M |
| 8. Outreach, training, national transferability toolkit | $0.4M | $0.1M | $0.5M |
| **Total** | **$12.0M (80%)** | **$3.0M (20%)** | **$15.0M** |

### Non-Federal Match ($3.0M, 20%)

- State in-kind: TMC operator and construction-office staff time for feed
  operations and field verification — ${1.2}M {PLACEHOLDER: per-state letters
  certifying in-kind valuation}.
- State cash / pooled contributions — ${1.0}M.
- Existing equipment and platform IP contributed to the project — ${0.8}M
  {PLACEHOLDER: valuation methodology per 2 CFR 200.306}.
- **Verify in-kind allowability and valuation rules in the FY25–26 NOFO text
  before finalizing** (in-kind is generally allowable under 2 CFR 200.306;
  prior ATTAIN cycles permitted it).

### Operations & Maintenance (post-grant)

Continued operations funded through the corridor pooled-fund mechanism at an
estimated ${600}K/year (feeds, backbone subscription, measurement layer),
versus $15M capital — an O&M ratio well within state ITS operating norms.
{PLACEHOLDER: state O&M commitments in support letters — this is a known
application-killer if left vague.}

---

## Section 5: Merit Criteria

### Criterion 1 — Safety

Work zones are among the most dangerous environments on the interstate
system; rear-end crashes from unexpected queues and lane drops dominate. This
project attacks the root cause: **information latency between field
conditions and the traveling public**. Real-time lane-level work zone data
delivered in-vehicle produces earlier merging, reduced queue-tail speed
differentials, and fewer intrusions.

- Expected {25%} reduction in work zone crashes on instrumented segments
  (CMF basis: {PLACEHOLDER — cite FHWA smart work zone / queue warning CMF
  literature, e.g., queue warning systems 18–45% rear-end reduction}).
- {PLACEHOLDER: corridor baseline — 3-year average I-35 work zone crashes,
  injuries, fatalities; compute lives saved × $13.2M VSL (2024 USDOT
  guidance — verify current value).}
- Worker safety: connected devices give workers a digital presence in every
  consuming vehicle's map.
- Bridge strike prevention: verified corridor clearance inventory (Element 6)
  delivered into truck routing; {PLACEHOLDER: corridor bridge strike
  baseline — strikes/year and average incident cost}.
- Alignment: National Roadway Safety Strategy, Safe System Approach, FHWA
  Work Zone Safety focus area.

### Criterion 2 — Mobility & Economic Competitiveness

- I-35 carries {PLACEHOLDER}% of US–Mexico surface trade; work-zone-related
  nonrecurring delay costs freight ${PLACEHOLDER}/year on the corridor.
- Real-time work zone + truck parking + delay data enables freight routing
  and departure-time decisions; corridor delay engine quantifies improvement.
- Border-to-border consistency removes the six-state patchwork problem for
  interstate carriers and AV developers — a national economic argument no
  single-state application can make.

### Criterion 3 — Innovation & Technology

- First corridor-scale deployment pairing CWZ 1.0 field devices with an
  **independent, continuously operating, multi-source accuracy measurement
  layer** (probe + e-ticketing + connected devices + in-cab alert
  corroboration) — moving work zone data from "published" to "trustworthy,"
  the acknowledged gap in national WZDx adoption.
- **The layered secondary feed model itself**: rather than asking six states
  to each reach A-grade publication independently, the project produces one
  quality-scored, validated corridor feed from layered datasets — published
  in WZDx 4.2 *and* CIFS so Google, Waze, and peers connect once instead of
  fifty times. A replicable national template.
- **Market-penetration observatory**: real-time comparison of corridor
  events against what TomTom — and, by invitation, Google and Apple —
  actually display to travelers, on a shared MITRE map layer. For the first
  time, states can see which operational practices get work zones in front
  of drivers, and standardize on what works.
- Automated device-to-event association: eliminates today's manual TMC
  linkage of connected arrow boards to 511 events — a workflow innovation
  every state TMC can adopt.
- Geometry remediation at scale: converts prevalent 2-point straight-line
  WZDx geometry into direction-matched route-following polylines, directly
  addressing the #1 reason mapping partners decline state feeds.
- Live vertical clearance inventory reconciling NBI and state GIS —
  resolving the documented 2"–6" inter-source discrepancy and making
  clearance data consumable by truck routing for the first time at corridor
  scale.
- Multi-version standards interoperability (WZDx 3.x→4.2 upgrade service,
  TMDD/CIFS/CWZ crosswalk) already operational — de-risked innovation, not
  speculative R&D.
- ARC-IT alignment: {PLACEHOLDER: map project to ARC-IT service packages —
  e.g., MC06 Work Zone Management, TM20 Variable Speed Limits, TI01 Broadcast
  Traveler Information, SU (Support) data distribution packages. Required by
  NOFO.}

### Criterion 4 — Partnership & Collaboration

Six states, AASHTO coordination, federal exchange alignment (USDOT WZDx
registry, avdx@dot.gov feed registration), MITRE backbone, partner pooled
funds contributing datasets and operational lessons, and named private
consumers. Because the layered feed asks so little of each participant, the
partnership model scales — additional states and pooled funds can join
without renegotiating the architecture. Governance charter and RFC process
pre-drafted. {PLACEHOLDER: letters — this criterion is won or lost on signed
commitments.}

### Criterion 5 — Performance & Accountability

The project's measurement layer is not an evaluation afterthought; it is a
funded deployment element operating from Month 1:

- Per-event confidence scores and compliance grades, published monthly.
- Probe-data deviation scorecard: reported-vs-observed location, status, and
  timing agreement per state per month.
- Public corridor dashboard — any FHWA reviewer can watch corridor data
  quality improve quarter over quarter for the life of the award.
- All measurement methodology published openly for reuse by other ATTAIN
  awardees (national transferability deliverable).

---

## Section 6: Project Readiness

- **Technology maturity:** Ingestion platform, standards translation, DQI
  grading, deviation measurement, WZDx feed generation tooling — operational
  today. Connected work zone devices — commercially available, FHWA-piloted.
  No experimental technology on the critical path.
- **Schedule:** 36 months. M1–6 governance + systems engineering (ARC-IT
  based); M4–12 state feed conformance; M7–30 field deployments (two
  construction seasons); M1–36 measurement layer live; M30–36 evaluation +
  national toolkit.
- **NEPA:** Categorical Exclusion expected — ITS deployments within existing
  ROW. {PLACEHOLDER: lead state environmental confirmation.}
- **Procurement:** State contract vehicles / competitive RFP for field
  devices; software components exist (no development-schedule risk on the
  platform side).
- **Risks & mitigation:** Multi-state coordination (mitigated three ways:
  pre-drafted governance, AASHTO anchor, and — decisively — the layered-feed
  architecture, which asks states only for participation and support rather
  than new systems or staffing); device supply lead times (order M4);
  state staffing (feed tooling minimizes per-state lift — proven by prior
  DIY state handoff kits).

---

## Appendices (to assemble)

- A. Letters of support/commitment — {PLACEHOLDER: state DOTs ×6, AASHTO,
  MITRE, navigation providers, carriers, AV developers}
- B. Detailed budget + in-kind valuation
- C. Benefit-Cost Analysis — {PLACEHOLDER: build from corridor crash baseline
  + delay model; platform crash analytics and delay engine produce inputs}
- D. ARC-IT service package mapping
- E. Detailed schedule / Gantt
- F. Data management & sharing plan (WZDx registry, open dashboard, provenance)
- G. Draft multi-state governance charter
- H. Platform capability inventory (`docs/SANDBOX_CAPABILITY_INVENTORY.md`)

---

## Critical Path to Submission (if targeting Aug 11, 2026)

1. **Lead state commitment** — nothing proceeds without it. {Days 1–3}
2. SAM.gov / Grants.gov registration status of lead applicant — verify
   immediately (new registrations take longer than 12 days).
3. Letters of support — parallel blitz, minimum viable set: 6 state DOTs +
   AASHTO + 2 consumers.
4. Corridor crash baseline + BCA — generate from platform crash analytics +
   FARS this week.
5. Budget bottom-up with each state's match certification.
6. Narrative finalization against actual NOFO section headings/page limits —
   **download the full NOFO PDF and conform this draft's structure to it.**

*If the lead state cannot mobilize by ~Aug 1, target the next cycle and use
the interim to bank letters, baseline data, and the governance agreement.*

# ATTAIN Project Options

Candidate project concepts for the FHWA ATTAIN program (Advanced Transportation
Technologies and Innovation, formerly ATCMTD), drawn from capabilities already
built or specified in the Corridor Communicator platform and related work.

## Program Snapshot (FY25–FY26 NOFO)

| Parameter | Value |
|---|---|
| Total funding | $120M (FY25 + FY26 combined) |
| Expected awards | ~20 |
| Award ceiling | $12M (typical awards $2M–$12M) |
| Non-Federal cost share | **20% minimum** (Federal share up to 80%). In-kind generally allowable under 2 CFR 200.306 — confirm in current NOFO |
| Application deadline | **August 11, 2026** |
| Eligible applicants | State DOTs, local governments, transit agencies, MPOs |
| Key requirements | Technology deployment plan, data sharing, interoperability standards, ARC-IT alignment, performance measurement plan |

**Eligibility note:** The platform itself is not an eligible applicant. Every
option below needs an eligible lead (state DOT, MPO, or local government) with
the platform scoped as the technology/measurement component. The I-35 pooled
states and the AASHTO anchor relationship are the natural pathway.

**Named ATTAIN focus areas** (from statute/NOFO): advanced traveler
information, traffic signal optimization, electronic pricing/payment, V2I,
automated/connected transportation, ITS integration.

---

## Option 1 — I-35 Connected Work Zone Corridor (Tier 1, recommended lead)

**Concept:** Multi-state connected work zone deployment along I-35 (per the DCI
work plan): standardized WZDx/CWZ publication from every corridor state, smart
work zone hardware at active projects, V2I broadcast of work zone geometry and
lane state to connected and automated vehicles, MITRE iNODE as the exchange
backbone, and the sandbox as the independent QA/measurement instrument.

- **ATTAIN alignment:** V2I, automated transportation, ITS integration, advanced traveler information — hits four of six named focus areas.
- **Lead applicant:** One I-35 state DOT on behalf of the corridor coalition (AASHTO anchor relationship is the differentiator).
- **Scope elements:** CWZ 1.0 feed enablement per state; smart arrow boards / connected devices at N work zones; iNODE exchange integration; sandbox DQI + Event Confidence scoring as the performance measurement plan; navigation-provider delivery (Google/Waze/Apple already consuming WZDx).
- **Ballpark ask:** $8M–$12M (ceiling-range, multi-state).
- **Match strategy:** Pooled-fund state contributions + in-kind staff time and existing equipment across member states — 20% is very achievable without new cash.
- **Performance measures:** Feed latency/accuracy vs. ground truth, work zone intrusion/crash rates, % of corridor work zones digitally published, CAV message delivery rates.
- **Readiness:** Highest — work plan package already produced; governance story exists.

## Option 2 — Multi-State Advanced Traveler Information Backbone (Tier 1)

**Concept:** Harden and operationalize the Corridor Communicator ingestion +
standards-translation core as a shared ATIS backbone producing a
**higher-level secondary feed**: quality-scored, multi-source-validated
coverage of the majority of interstate work zones, built by layering ~39
WZDx producers, TMDD/CIFS/CWZ/TPIMS/NWS/CBP feeds, and validation datasets
on top of what states already publish. Requires almost nothing from states —
participation and support, not new systems. Published as WZDx 4.2 **and as a
CIFS output for direct connection to Google/Waze and other services**.
Partner pooled funds contribute datasets and process support. Includes the
market-penetration observatory: TomTom events visible today, with Google and
Apple invited to layer their displayed events on the MITRE map to measure
real-time market penetration of corridor events and replicate the
operational practices that get events in front of travelers.

- **ATTAIN alignment:** Advanced traveler information (named category), ITS integration, interoperability/data-sharing requirements met by design.
- **Lead applicant:** A member state DOT or an MPO consortium; pooled-fund structure per `docs/pooled-fund-enablement.md`.
- **Scope elements:** Production hardening, SLA operations, state onboarding kits, provenance viewer + compliance grading as public quality accountability.
- **Ballpark ask:** $4M–$8M.
- **Match strategy:** In-kind: existing platform IP, state staff time for onboarding, pooled-fund dues.
- **Performance measures:** DQI/TETC grade improvement per state, feed uptime, consumer (nav-app) uptake, event confidence scores.
- **Readiness:** High — system is operational, not a concept (a scored ATTAIN advantage).

## Option 3 — WZDx Coverage-Gap Deployment for No-Data States (Tier 1)

**Concept:** Stand up WZDx feed generation in states with no public real-time
work zone data, using the tested DIY kits (Nebraska/Nevada packages in
`docs/wzdx-diy/`) plus the coverage-gap analyzer to target and sequence states.
The coverage-gap analyzer already names ATTAIN as the recommended funding
program for exactly this gap.

- **ATTAIN alignment:** Advanced traveler information, ITS integration, data sharing; clean "technology deployment plan" narrative.
- **Lead applicant:** One gap state DOT (NE or NV are furthest along) or a multi-state application covering 3–5 gap states.
- **Scope elements:** Feed generator deployment per state, register via avdx@dot.gov, conformance validation via sandbox compliance grading, operator training.
- **Ballpark ask:** $2M–$4M (modest, high win probability — right-sized scope is a scored strength).
- **Match strategy:** In-kind state staff time; kit development already sunk cost.
- **Performance measures:** States moved from zero coverage to conformant v4.2 feeds; % of state work zones published; nav-app consumption.
- **Readiness:** High — kits are written and generators tested (NE/NV are
  I-80 states, so this doubles as transferability evidence for an I-35
  application). MITRE has been identified as a path to operationalize the
  Python generators as hosted, production feed outputs.
- **Related proven work:** Midwest 2-point geometry remediation — several
  states publish straight-line WZDx geometry (sometimes one line marked
  "both" directions); we have demonstrated correction to direction-matched
  route-following polyline GeoJSON, which materially improves mapping-partner
  uptake. Include as a scope element in any feed-quality application.

## Option 4 — Corridor Truck Parking Information Expansion (Tier 2)

**Concept:** Extend TPIMS-style truck parking availability + the platform's
prediction engine (hourly occupancy forecasts, calibration service, accuracy
metrics, closure→parking-surge linkage) to additional corridor states and
publish predictions to traveler-information channels and fleet platforms.

- **ATTAIN alignment:** Advanced traveler information for freight; ITS integration; complements MAASTO TPIMS (known FHWA priority — Jason's Law).
- **Lead applicant:** MAASTO-adjacent state DOT or corridor coalition.
- **Scope elements:** Detection hardware at unmonitored facilities, prediction API productization, DMS + 511 + fleet-telematics delivery, surge-aware alerts tied to closures.
- **Ballpark ask:** $5M–$10M (hardware-heavy).
- **Match strategy:** State facility investments count; in-kind operations staff.
- **Performance measures:** Prediction accuracy (already instrumented), parking-search time reduction, unauthorized parking incidents.
- **Readiness:** Medium-high — software live for IL/KY/MN feeds; new-state hardware is the long pole.

## Option 5 — Freight Clearance & Routing Intelligence (Tier 2)

**Concept:** Statewide/corridor bridge clearance intelligence for freight and
oversize/overweight movements: NBI-based clearance layer, construction-proximity
staleness flagging, route optimizer integration, and clearance alerts delivered
V2I/in-cab to prevent bridge strikes.

- **ATTAIN alignment:** Advanced traveler information, V2I, automated transportation (clearance data is a CAV/AV prerequisite for trucks).
- **Lead applicant:** A state DOT with a bridge-strike problem (strong benefit-cost story per strike avoided).
- **Scope elements:** Authoritative clearance data pipeline (CSV/NBI ingest path is reliable) reconciled against state GIS clearance data, verification workflow after construction activity (WZDx-triggered re-verification for bridges near active work; no-activity bridges cleared as verified-stable), routing API, OS/OW permit-system integration.
- **Key finding to lead with:** NBI and state-reported clearances differ by a 2"–6" safety factor depending on the state — a consistency gap that keeps clearance data out of truck routing systems. A live, consistently-reported inventory is the fix.
- **Ballpark ask:** $2M–$5M.
- **Match strategy:** In-kind: state bridge inventory staff, permit office time.
- **Performance measures:** Bridge strikes avoided, stale-clearance records remediated, routing API adoption.
- **Readiness:** Medium — layer exists; permit-system integration is new work.

## Option 6 — Ground-Truth Deviation & Data Quality Instrumentation (Tier 2, best as a component)

**Concept:** Corridor-scale independent measurement: multi-source work zone
validation corroborating DOT-reported events against TomTom probe data,
HaulHub e-ticketing activity (meeting held with HaulHub + MITRE), connected
arrow board status (today manually linked to 511 events by TMC staff —
automation opportunity), iCone device data (outreach planned), and Drivewyze
in-cab slow-down alerts (meeting scheduled; also a candidate wider
dissemination channel through MITRE) — plus the deviation scorecard (Phase 2
of the TomTom work), DQI/TETC grading, event confidence, and ground-truth
dashboard — packaged as the performance-measurement layer ATTAIN requires of
every award.

- **ATTAIN alignment:** Directly satisfies the mandated performance measurement plan; data quality is an FHWA evaluation emphasis.
- **Positioning:** Weak as a standalone application (measurement without deployment), strong embedded in Options 1–5 — include it in whichever option leads. Could also be pitched to FHWA as the evaluation instrument for *other* states' ATTAIN awards.
- **Ballpark ask:** $500K–$1.5M as a work package inside a larger application.
- **Readiness:** High — Phase 1 live; scorecard specified.

## Option 7 — Corridor Decision-Support & Operations Automation (Tier 3)

**Concept:** Multi-state operations automation: closure approval workflow, DMS
message authoring with template library, diversion route library with
road-snapping, corridor delay engine, incident predictor, and predictive
analytics — an integrated corridor TMC-augmentation deployment across 2–3
states.

- **ATTAIN alignment:** ITS integration, traffic management technology; "advanced transportation management" is core ATCMTD-lineage territory.
- **Lead applicant:** Two-state pair with shared corridor TMC coordination needs.
- **Ballpark ask:** $3M–$6M.
- **Risk:** Broad scope reads as a platform pitch rather than a deployment — needs a tight corridor-specific framing to be competitive.
- **Readiness:** Medium — features exist but multi-state operational adoption is unproven.

---

## Comparison

| # | Option | Focus-area hits | Ask | Readiness | Win probability |
|---|---|---|---|---|---|
| 1 | I-35 Connected Work Zone Corridor | 4/6 | $8–12M | ★★★★★ | High — deployment-ready, multi-state, governance in place |
| 2 | Multi-State ATIS Backbone | 2/6 | $4–8M | ★★★★★ | High — operational system, but "platform" framing risk |
| 3 | WZDx Coverage-Gap Deployment | 2/6 | $2–4M | ★★★★☆ | High — small ask, crisp scope, kits done |
| 4 | Truck Parking Expansion | 2/6 | $5–10M | ★★★☆☆ | Medium — strong priority area, hardware risk |
| 5 | Freight Clearance & Routing | 3/6 | $2–5M | ★★★☆☆ | Medium — great B/C story, integration work new |
| 6 | Ground-Truth Measurement | (component) | $0.5–1.5M | ★★★★☆ | Embed in 1–5, not standalone |
| 7 | Ops Decision-Support | 2/6 | $3–6M | ★★☆☆☆ | Lower — scope framing risk |

## Recommendation

- **This cycle (Aug 11, 2026 deadline — 12 days):** a full new application is
  unrealistic unless a lead state DOT already has one in motion. If any I-35
  state is drafting, offer Option 6 as their performance-measurement work
  package immediately — small, additive, and strengthens their submission.
- **Primary play:** Option 1 with Option 6 embedded, led by an I-35 state via
  the DCI coalition — for the next NOFO cycle (or this one if a state is
  already mobilized).
- **Fastest standalone win:** Option 3 — smallest ask, finished kits, and the
  coverage-gap analyzer provides the data-driven justification narrative.
- All options budget the 20% match primarily as **in-kind** (state staff time,
  existing equipment, pooled-fund contributions) — verify in-kind treatment in
  the current NOFO text or with ATTAIN@dot.gov before finalizing any budget.

## Sources / References

- FY25–FY26 ATTAIN NOFO listing: https://simpler.grants.gov/opportunity/4764a83e-9f5b-4eb6-b4f3-0ccfc20aba5f
- FHWA ATTAIN program page: https://www.fhwa.dot.gov/infrastructure-investment-and-jobs-act/attain.cfm
- Internal: `docs/SANDBOX_CAPABILITY_INVENTORY.md`, `docs/FEDERAL_GRANT_APPLICATION_GUIDE.md`, `docs/wzdx-diy/`, DCI I-35 work plan package, `services/coverage-gap-analyzer.js`

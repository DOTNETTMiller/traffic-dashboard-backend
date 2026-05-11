# Sandbox Capability Inventory

**Matt's Experimental Sandbox (DOT Corridor Communicator)**
**Compiled:** May 11, 2026

A complete catalog of what the sandbox attempts. Items are listed by functional area rather than implementation completeness — some are mature, some are exploratory, all are present in the codebase as active research surfaces.

---

## 1. Real-Time Data Ingestion (Federal & State Public Feeds)

The sandbox ingests, normalizes, and surfaces the following public feed families:

- **Work Zone Data Exchange (WZDx)** at versions 3.0, 4.0, 4.1, and 4.2 simultaneously — across approximately 39 state DOT and sub-state producers
- **Connected Work Zones (CWZ 1.0)** — CDOT, MassDOT, IDOT, and others
- **Common Incident Format Specification (CIFS)** — via Eastern Transportation Coalition
- **TMDD-derived state ATIS APIs** — Iteris/iBi family, including 511GA, 511NY, AZ511, Alaska 511, UDOT
- **MAASTO Truck Parking Information Management System (TPIMS) v2.2** — Illinois (TravelMidwest), Kentucky (TRIMARC), Minnesota (IRIS)
- **NWS Alerts API** — road-impacting CAP alerts filtered to ~30 weather event types
- **CBP Border Wait Times** — US-Canada and US-Mexico ports with commercial-truck lane breakouts
- **NPS Road Events** — work zones across the National Park Service road network
- **Sub-state / regional WZDx feeds** — City of Austin TX, St. Charles County MO, Maricopa County AZ, Quebec City
- **State-specific incident and traveler-information feeds** — Iowa, Missouri, Wisconsin, Florida, Hawaii, Idaho, Kentucky, Louisiana, Maryland, Massachusetts, New Mexico, North Carolina, Washington, Delaware, and others
- **PennDOT RCRS** — registered for access (custom adapter pending)
- **Waze for Cities (CCP)** — registered for access (planned)

## 2. Data Quality Measurement & Grading

The sandbox treats data quality as first-class, not afterthought:

- **Data Quality Index (DQI) framework** — composite scoring on accuracy, standards conformance, governance, completeness, timeliness, and lifecycle hygiene
- **TETC Data Grading** — applies the Eastern Transportation Coalition's grading methodology consistently across all member states
- **State Quality Rankings** — comparative state-by-state ranking by DQI
- **State Report Cards** — per-state, per-month quality snapshots
- **Event Confidence scoring** — per-event trust score derived from source reliability, lifecycle completeness, geometry validity, and cross-feed corroboration
- **Feed Quality Scoring service** — programmatic scoring of individual feeds against the DQI methodology
- **Coverage Gap Analysis** — identifies state-by-state coverage gaps where a state DOT publishes no public real-time event data
- **Feed Alignment** — measures how well multi-source feeds for the same region/event agree with each other
- **Compliance Grades** — per-event compliance letter grades (and percentages) against spec expectations
- **Corridor Data Quality** — per-corridor quality across the participating state pipeline
- **Cross-State Correlation** — finds corroborating events across adjacent state feeds
- **Data Quality ML Assessment** — exploratory ML-based assessment of event plausibility and source trust
- **Anomaly Detection Panel** — surfaces unusual patterns in incoming feed data

## 3. Standards Translation & Interoperability Research

- **Digital Standards Crosswalk** — translation tables among WZDx, TMDD, CIFS, CWZ 1.0, SAE J2735, and Common Alerting Protocol
- **WZDx upgrade service** — programmatic upgrade of WZDx v3.x → v4.x → v4.2 with field-population fidelity tracking
- **WZDx feed generator** — for producing conformant WZDx output from internal event store
- **Provenance Viewer** — per-event lineage showing which feed contributed which field
- **Geometry Validator** — validates feed geometry conformance with WZDx and GeoJSON expectations
- **Compression statistics** — measures payload efficiency including polyline encoding for transport savings

## 4. Map Visualization Layers

Toggleable map layers covering:

- Traffic events (work zones, incidents, closures, restrictions) with severity tones
- NWS road-impacting weather alerts (CAP polygons)
- CBP border wait times (port-of-entry markers with commercial-truck delay)
- Truck parking (internal database, with predictions)
- MAASTO TPIMS (real-time, with trend and trust flags)
- Diversion routes (3-point exit/via/reentry with OSRM road-snapping)
- Aerial overlays (TIF + PDF, S3 + Postgres-bytea fallback)
- ITS equipment (cameras, DMS, RWIS, weather stations)
- V2X deployment locations (RSU/OBU)
- CADD design elements
- Interchanges (with mile-marker lookup)
- Bridge clearances (with low-clearance warnings)
- Oversize/overweight permit-rule layers
- Network topology
- TETC corridors
- Heat maps (events density, severity, vendor coverage)
- Interstate-only filter (event filter, treated as a layer toggle)

## 5. Operations Workflows

- **DMS Messaging** — sign-message authoring, LED-dot preview, template library, approval workflow
- **DMS Sign Playground** — preview tool for testing message rendering before deployment
- **Closure Approval** — multi-state closure approval workflow with state-DOT review, comments, and audit log
- **Diversion Route Library** — pre-staged 3-waypoint diversion routes (exit / via / reentry) with road-snapping
- **Detour Alerts** — real-time detour-active surfacing
- **Corridor Briefing** — generates corridor situational-awareness summary
- **Corridor Warnings** — surfaces active risk on a chosen corridor
- **Closure → Parking Surge Linkage** — flags truck parking facilities likely to fill due to active closures within a geographic radius
- **Corridor Delay Engine** — estimates corridor-segment delay from active events + base travel time
- **Corridor Delay Dashboard** — operator view of delay by corridor
- **Route Optimizer** — multi-segment route planning around active events
- **Event Lifecycle Manager** — auto-archive, auto-expire, and lifecycle hygiene
- **Feed Submission** — public-facing form for community/agency submission of event data
- **Bounding Box Selector** — geographic filtering across multiple views

## 6. Predictive and Analytic Tools

- **Predictive Analytics Dashboard** — forecasts event likelihood and corridor risk
- **Incident Predictor** — probability of incident at a corridor/segment over a forecast window
- **Parking Prediction** — hourly truck-parking occupancy forecast per facility
- **Parking Calibration Service** — calibration of prediction model against observed availability
- **Parking Accuracy Metrics** — operational accuracy tracking for parking predictions
- **Predictive Maintenance AI** — exploratory equipment-failure forecasting
- **Advanced Analytics Dashboard** — exploratory cross-cutting analytic views
- **Ground Truth Dashboard** — comparison of reported vs. observed conditions
- **ML Features Panel** — exposes ML inputs and feature engineering for transparency
- **ML Tutorial** — onboarding view explaining how the predictive features work

## 7. Compliance, Regulatory & Permit Tools

- **IPAWS Active Alerts** — wired to FEMA's Integrated Public Alert & Warning System
- **IPAWS Active Alerts Manager** — author/manage road-impacting public alerts
- **IPAWS Rules Config** — rules driving when alerts are auto-generated
- **IPAWS After-Action Reviews** — post-event review and lessons-learned capture
- **IPAWS Compliance Panel** — per-state IPAWS conformance dashboard
- **IPAWS Scenario Selector** — pre-built scenarios for testing
- **IPAWS Alert Generator** — programmatic generation of IPAWS-format alerts from internal events
- **NASCO Corridor Regulations View** — North America's Corridor Coalition regulatory rules surfaced for operators
- **NASCO AI Analysis** — exploratory analysis of NASCO rule overlap, conflict, and corridor implications
- **State OS/OW Regulations Layer** — state-by-state oversize/overweight permit rules surfaced as map layer
- **OS/OW Regulations Layer (corridor-level)** — corridor-aggregated permit rules
- **Bridge Clearance Warnings** — surfaces low-clearance hazards for over-height freight

## 8. Communications & Coordination

- **Messages Panel** — operator-to-operator and state-to-state messaging
- **State Messaging** — per-state messaging channel
- **Event Messaging** — per-event annotation/discussion thread
- **Chat Widget (AI Assistant)** — operator-facing AI assistant for the sandbox
- **Event Format Popup** — quick-look event format details on map clicks
- **Calendar / Calendar Admin** — operations calendar with events, closures, and admin overlay
- **Activity Timeline** — chronological event/action stream
- **Live Statistics** — real-time counters across feeds, states, severities
- **Dashboard Widgets** — composable per-state and per-corridor widgets
- **Mini Map Control** — embedded mini-map within other views
- **Heat Map Control** — controls for various heat-map modes
- **Toast Container** — notification system
- **Notification Service** — backend-side notification orchestration

## 9. Vendor and Procurement Transparency

- **Vendor Portal** — vendor-facing view for those providing data feeds
- **Vendor Leaderboard** — comparative scoring of commercial traffic-data vendors on the DQI methodology
- **Vendor DQI Comparison** — head-to-head DQI breakdown
- **Vendor Gap Analysis** — what's missing in each vendor's feed coverage
- **Procurement Dashboard** — state vendor-contract tracking, SLA monitoring, expiration alerts, cost-per-event analysis
- **Feed Scoring + Modal** — per-feed quality scoring view
- **Feed Tracking Service** — feed-availability monitoring (up/down/last-success)

## 10. Funding and Grants

- **Funding Opportunities** — federal and state transportation grant search
- **Federal Grant Resources** — index of relevant federal grant programs (BIL/IIJA, SMART, ATTAIN, etc.)
- **Connected Corridors Grant Matcher** — matches grant opportunities to project profiles
- **Grant Applications** — application tracking
- **Grant Drafting Assistant** — drafting support for grant narratives
- **Grant Proposal Analyzer** — exploratory analysis of proposal strength against funding criteria
- **Grants Service** — backend service indexing grant opportunities

## 11. Decision Support & Asset Management

- **Asset Health Dashboard** — equipment health, ITS device status, RWIS condition
- **Asset Health Monitor service** — backend monitoring service
- **ITS Equipment Layer** — map-visible equipment with status
- **Nearby ITS Equipment** — proximity-based equipment lookup near an event
- **ITS Equipment Export** — equipment data export
- **CADD Models** — engineering-model library
- **CADD Viewer** — model viewer integrated into the dashboard
- **IFC Model Viewer** — 3D BIM/IFC viewer for digital project delivery
- **Digital Infrastructure** — survey of digital-infrastructure assets and readiness per state
- **Corridor Geometry Diff** — diff between authoritative geometry and inferred geometry
- **Network Topology Layer** — visual representation of corridor topology

## 12. Research & Diagnostic Surfaces

- **Data Quality Report** — synthesized quality narrative across the system
- **Coverage Gap Analysis** — visualization of national feed coverage gaps
- **Cross-State Correlation** — finds related events across state lines
- **Provenance Viewer** — per-event source lineage
- **Community Contribution** — community-sourced event submission and review
- **State Quality Dashboard** — per-state DQI dashboard
- **State Report Card** — printable per-state quality summary
- **Documentation Viewer** — in-app documentation surface
- **API Documentation Viewer** — interactive API spec viewer
- **Advanced Search** — cross-cutting search across events, feeds, vendors

## 13. Authentication, Administration & System

- **JWT-based auth** with 7-day token lifetime + auto-logout on expiry
- **State-level password auth** — separate auth tier for state-DOT users
- **Admin Panel** — administrative tooling
- **Admin Users** — user management
- **Admin Feed Submissions** — review of community-submitted feeds
- **Admin Interchanges** — interchange data management
- **State Admin** — per-state administrative tools
- **User Profile** — user account view
- **User Login** — authentication entry point
- **Calendar Admin** — administrative scheduling
- **File Upload** — uploads for aerial overlays, CADD files, geometry imports
- **Aerial Overlays Panel** — overlay metadata and lifecycle
- **PWA Install Prompt** — progressive web app install affordance
- **Command Palette** — keyboard-driven navigation and action launcher
- **Dark Mode Toggle** — visual mode switch
- **Intro Splash** — first-load orientation
- **Export Menu** — multi-format data export (CSV, JSON, PDF, GeoJSON)
- **Skeleton / Skeleton Loader** — loading-state placeholders
- **Compression Stats** — payload-size diagnostics
- **Heat Map Layer** — rendered heat-map overlay
- **Auto-import of WZDx feeds from USDOT registry** — keeps the integrated feed list current
- **Auto-detection of Postgres vs SQLite** — runs against either backend with graceful schema fallback
- **In-memory caching with TTL and inFlight dedupe** — pattern used across NWS, CBP, MAASTO, events, weather alerts

## 14. Cross-Cutting Engineering Patterns

- **OSRM road-snapping** — route geometry snapped to drivable corridors
- **Polyline encoding** — efficient geometry transport (6× payload reduction observed)
- **Cache-Control headers** — explicit CDN/browser cache hints across endpoints
- **inFlight promise pattern** — dedupes concurrent upstream fetches under load
- **Schema-drift tolerance** — try/catch + sensible defaults on per-table queries so a missing optional table doesn't 500 the whole endpoint
- **Promise.allSettled for multi-endpoint fetches** — one failing endpoint never blanks an entire dashboard view
- **Geographic-radius linkage (Haversine)** — closure → parking surge identified by proximity rather than corridor matching when corridor data is sparse
- **Background auto-refresh** — per-layer refresh cadence aligned with upstream update frequency

---

## What the Sandbox Is NOT

For completeness, the following are out of scope:

- Not a commercial product. Not for sale, not licensed, not promoted as a service.
- Not a procurement target. None of this is offered to any agency to evaluate, fund, or adopt.
- Not a regulator. The DQI grading is for research transparency, not for scoring states as a compliance function.
- Not a replacement for any state DOT system. It consumes their data and analyzes it; the state systems are authoritative.
- Not an authoritative source for any single state. Authority lies with each producing agency.

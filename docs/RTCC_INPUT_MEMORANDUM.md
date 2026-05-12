# Input Memorandum to the Research and Technology Coordinating Committee

**To:** Carlos M. Braceras, P.E., Chair, Research and Technology Coordinating Committee
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Joseph Hartmann, Associate Administrator for Research, Development & Technology, Federal Highway Administration
**Cc:** Gloria M. Shepherd, Executive Director, Federal Highway Administration
**From:** Matt Miller
**Date:** May 11, 2026
**Subject:** A state-side view of national digital infrastructure interoperability gaps — research inputs in support of the September 2025 RTCC Letter Report

---

## Affiliation and Conflicts

I work on transportation data integration from a state-DOT-adjacent vantage point. I operate a private, non-commercial experimentation environment to ingest and study public federal and state digital infrastructure feeds. No product, system, or service from that work is offered for the Committee's consideration. Every recommendation below is a recommendation that **federal research be funded and conducted** — not that any agency procure, adopt, or evaluate any external work.[^1]

## Purpose

This memorandum is submitted in advance of my first RTCC meeting. It is written from the perspective of a state-side practitioner observing a national problem: state DOTs are individually responsible for operating safe, efficient, multi-jurisdictional corridors, but the digital infrastructure connecting them is decentralized, unevenly conformant, and not measurable in any federally-curated way. States cannot fix that from where we sit; the federal research enterprise is the natural locus. The recommendations below are scoped accordingly — each is a research question that fits a 2-to-3-year federal RD&T cycle and produces methodology, specification, or empirical findings the practitioner community can converge on.

## Acknowledgment of Existing Federal Work

These recommendations are intended as additive to, not corrective of, the substantial federal research program already underway. FHWA RD&T, ITS-JPO, TFHRC, NCHRP, NPMRDS-related work through RITIS, the Vehicle Probe Project, and AASHTO standards activities each address pieces of the interoperability puzzle. The recommendations below are gaps observed *from outside* those programs, offered in the spirit that the decentralized RD&T enterprise will benefit from cross-cutting research the Committee endorsed in Conclusion 3 of the September 2025 Letter Report.[^2]

## Source and Breadth of Empirical Observations

The observations below are drawn from end-to-end integration covering the following surfaces:

- **Federal and state real-time public feeds:** Work Zone Data Exchange across versions 3.0 through 4.2 and approximately 39 state and sub-state producers; CWZ 1.0; Common Incident Format Specification via the Eastern Transportation Coalition; TMDD-derived state ATIS APIs in the Iteris/iBi family; MAASTO TPIMS v2.2; NWS Alerts; CBP Border Wait Times; NPS Road Events; and sub-state and international producers including the City of Austin, St. Charles County Missouri, Maricopa County, and Quebec City.
- **Data quality measurement:** composite Data Quality Index applied per producer; per-event confidence scoring; coverage gap analysis; cross-state event correlation; feed-alignment analysis; anomaly detection.
- **Standards translation:** crosswalks among WZDx, TMDD, CIFS, CWZ 1.0, SAE J2735, and Common Alerting Protocol; version-upgrade tooling; per-event provenance and lineage.
- **Operations:** dynamic message sign authoring with approval workflow; multi-state closure approval; pre-staged diversion routes; corridor situational-awareness briefings; corridor delay estimation.
- **Compliance and permits:** IPAWS road-impact integration; NASCO corridor regulations; state and corridor-level oversize/overweight rule representation; bridge-clearance warnings.
- **Predictive analytics and validation:** event probability, parking occupancy, corridor risk, equipment-failure forecasting; ground-truth comparison.
- **Decision support:** ITS equipment status; CADD/IFC viewing for digital project delivery; digital infrastructure readiness assessment.
- **Vendor transparency:** vendor DQI leaderboards, head-to-head comparisons, gap analysis, procurement contract tracking.

End-to-end means source identification, fetch, schema parsing, conformance checking, normalization to a common event model, cross-feed joining, operational presentation, and observation over time.[^3]

## Recommendations

Each item below names the state-side problem driving the recommendation, the research scope appropriate to a 2-to-3-year federal RD&T cycle, and a recommended owner.

### A. Feeds, Standards, and Interoperability Measurement

**A.1 Measurement-of-Interoperability Research.**
*State lens:* A state TMC consuming neighboring states' feeds has no federally-curated baseline to evaluate what it is receiving. Decisions about whether to ingest a neighboring feed today rest on a 60-second integration test by an analyst, not on published measurement.
*Research scope:* Sustained, open-methodology empirical measurement of conformance, completeness, freshness, and standards-fidelity across major public feeds. Phase 1: methodology + baseline (months 1–6). Phase 2: continuous measurement at scale (months 6–24). Phase 3: longitudinal trend reporting (months 24–36).
*Owner:* FHWA RD&T / TFHRC, with NCHRP support.

**A.2 Authoritative Cross-Specification Crosswalk Research.**
*State lens:* Every state integrating neighbor or vendor data builds its own WZDx↔TMDD↔CIFS translation. The translations diverge silently, which degrades the comparability of multi-state operations data over time.
*Research scope:* Reference crosswalks among WZDx, TMDD, CIFS, CWZ 1.0, SAE J2735, and CAP; one open-source reference normalization implementation. Phase 1: crosswalk authoring (months 1–9). Phase 2: reference implementation + community pilot (months 9–24). Phase 3: standards-body submission and publication (months 24–30).
*Owner:* FHWA RD&T with SAE, ITE, and AASHTO.

**A.3 Sub-State and Regional Digital Infrastructure Layer Research.**
*State lens:* A state DOT is not the only producer of operationally-relevant data in its own footprint. Cities, counties, toll authorities, and tribal agencies publish feeds that overlap incompatibly with the state's. The state cannot harmonize these alone.
*Research scope:* Inventory the sub-state and regional layer; characterize its prevalence, conformance, and overlap with state-level feeds; develop policy-lever analysis for harmonization. Phase 1: inventory (months 1–6). Phase 2: conformance + overlap analysis (months 6–18). Phase 3: harmonization policy options (months 18–30).
*Owner:* FHWA RD&T jointly with NCHRP.

**A.4 Non-WZDx Federal-Partner Feed Integration Patterns Research.**
*State lens:* State TMCs use NWS Alerts, CBP Border Wait Times, NPS Road Events, and IPAWS ad hoc — each with bespoke integration patterns. There is no canonical guidance for fusing these federal-partner feeds with state-published work zone and incident data.
*Research scope:* Reference architecture and fusion patterns for federal-partner feed integration into state operations. Phase 1: feed inventory + integration-pattern survey (months 1–9). Phase 2: reference architecture (months 9–24). Phase 3: pilot with two to three states (months 24–36).
*Owner:* FHWA RD&T in coordination with FEMA, NWS, and CBP.

**A.5 Provenance and Lineage Standards Research.**
*State lens:* When two feeds report the same event with different fields, the consuming state cannot audit which source contributed which attribute. Cross-feed fusion is therefore not defensible to leadership when the data is questioned after an incident.
*Research scope:* Provenance schema specification and reference implementation suitable for multi-source transportation event records. Phase 1: requirements + schema (months 1–9). Phase 2: reference implementation (months 9–24). Phase 3: integration with WZDx and related specs (months 24–36).
*Owner:* TRB Cooperative Research Program.

### B. Data Quality, Measurement, and Validation

**B.1 Standardized Data Quality Index Methodology Research.**
*State lens:* Each state and each vendor uses its own "quality" definition. State leadership therefore cannot compare quality claims across feed providers or against neighbor states.
*Research scope:* Open, versioned Data Quality Index methodology applicable across transportation feed types, with published reference scores. Phase 1: methodology authoring (months 1–9). Phase 2: pilot scoring at scale (months 9–24). Phase 3: publication + governance handoff (months 24–30).
*Owner:* FHWA RD&T with NCHRP and the practitioner community.

**B.2 Ground Truth and Predictive Model Validation Research.**
*State lens:* States increasingly deploy predictive analytics for incidents, parking, and corridor delay. Each deployment defines its own "good enough" against its own observations. There is no shared validation framework.
*Research scope:* Ground-truth protocols and reference validation datasets for incident, parking, delay, and equipment-health prediction. Phase 1: protocol design (months 1–9). Phase 2: dataset collection (months 9–24). Phase 3: publication (months 24–36).
*Owner:* FHWA RD&T, TFHRC, NCHRP.

**B.3 Coverage Gap and Cross-State Correlation Research.**
*State lens:* A state planning a multi-state operations strategy has no federally-curated, public view of where the national event picture is incomplete — which neighbors publish, what they publish, and where the gaps are.
*Research scope:* Methodology and ongoing public assessment of national coverage gaps and cross-state event correlation reliability. Phase 1: methodology + initial assessment (months 1–12). Phase 2: continuous updating (months 12–30). Phase 3: reporting interface (months 30–36).
*Owner:* FHWA RD&T.

### C. Operations Workflows and Coordination

**C.1 Multi-State Closure Approval and Diversion Coordination Research.**
*State lens:* Multi-state freight-corridor closures and diversions today coordinate by phone and email between state TMCs. There is no federal protocol or data-exchange standard supporting cross-state coordination at operational tempo.
*Research scope:* Reference coordination protocol and supporting data-exchange specification for multi-state planned closures and diversion routes. Phase 1: process and gap analysis (months 1–9). Phase 2: protocol design (months 9–24). Phase 3: pilot with two to three corridors (months 24–36).
*Owner:* FHWA RD&T with AASHTO.

**C.2 Dynamic Message Sign Messaging Conformance and Effectiveness Research.**
*State lens:* The same multi-state incident is signed differently in each state the driver passes through. Inconsistency is well-known to state DOT operations leadership; its effectiveness cost is not well-characterized.
*Research scope:* Empirical effectiveness research and a recommended cross-state message-pattern library. Phase 1: cross-state DMS messaging audit (months 1–9). Phase 2: effectiveness study (months 9–24). Phase 3: pattern library publication (months 24–36).
*Owner:* FHWA RD&T with state DOT participation.

**C.3 Truck-Parking Sensor Data Quality Research.**
*State lens:* MAASTO TPIMS demonstrates that federal coordination of state data systems works at the protocol level. The limiting factor on impact is sensor data quality — a substantial portion of Illinois sites currently flag their own data as untrusted. This is a TFHRC sensors lab question, not a state question.
*Research scope:* Sensor reliability research, calibration methodology, and reference deployment guidance for truck parking sensing. Phase 1: failure-mode characterization (months 1–9). Phase 2: calibration methodology (months 9–24). Phase 3: reference deployment guidance (months 24–36).
*Owner:* FHWA RD&T and TFHRC sensors lab.

### D. Compliance, Regulatory, and Permit Interoperability

**D.1 IPAWS Road-Impact Authoring Conformance Research.**
*State lens:* IPAWS is a federal capability state DOTs use unevenly. From the state side, the on-ramp from operational events to CAP-compliant authoring is unclear and inconsistent.
*Research scope:* Conformance methodology and per-state assessment of road-impact IPAWS authoring; operator-workflow integration patterns. Phase 1: state survey (months 1–9). Phase 2: methodology + assessment (months 9–24). Phase 3: integration-pattern publication (months 24–30).
*Owner:* FHWA RD&T with FEMA IPAWS Program Office.

**D.2 OS/OW Permit-Rule Interoperability Research.**
*State lens:* States have made significant individual progress on oversize/overweight permit-rule digitization. Cross-state corridor consistency remains poor in structure, vocabulary, and exchange. Freight carriers and routing engines absorb that cost.
*Research scope:* Permit-rule data model and exchange specification. Phase 1: state-by-state encoding survey (months 1–9). Phase 2: data model design (months 9–24). Phase 3: pilot exchange across a NASCO corridor (months 24–36).
*Owner:* FHWA RD&T with NASCO and AASHTO.

**D.3 Bridge-Clearance and Restriction Data Interoperability Research.**
*State lens:* Bridge clearance data is heterogeneous across states (units, datum reference, posted vs. measured); over-height-vehicle routing fails at state lines because of it.
*Research scope:* Standard exchange format for low-clearance, weight-restricted, and hazardous-cargo-restricted infrastructure inventory. Phase 1: state inventory survey (months 1–9). Phase 2: data model (months 9–24). Phase 3: pilot exchange (months 24–36).
*Owner:* FHWA RD&T with AASHTO Bridges Committee.

### E. Decision Support and Asset Management

**E.1 Asset Health and ITS Equipment Status Interoperability Research.**
*State lens:* State asset-health data — cameras, DMS, RWIS, V2X RSUs — exists per-state with no exchange standard. Cross-state coordination and federal asset-management RD&T both suffer.
*Research scope:* Equipment status schema and reference implementation. Phase 1: requirements (months 1–9). Phase 2: schema + reference impl. (months 9–24). Phase 3: pilot with three states (months 24–36).
*Owner:* FHWA RD&T and TFHRC operations lab.

**E.2 Digital Project Delivery — Transportation IFC/BIM Profile Research.**
*State lens:* States are being asked to deliver digitally; IFC was designed for vertical construction and transportation use is inconsistent. The Letter Report's promise of "accelerating delivery of highway projects" depends on this profile existing.
*Research scope:* Transportation IFC profile, metadata standards, and reference exchange tooling. Phase 1: requirements + profile draft (months 1–12). Phase 2: pilot exchange (months 12–24). Phase 3: standards-body submission (months 24–36).
*Owner:* TFHRC infrastructure RD&T.

### F. Vendor Transparency and Practitioner Costs

**F.1 Independent Comparative Evaluation Methodology for Commercial Data Products.**
*State lens:* Each state's procurement cycle replicates substantially the same RFP and vendor-comparison work. No federally-curated methodology exists. The cost to states is direct and recurring.
*Research scope:* Open methodology and empirical findings for head-to-head evaluation of probe, incident, and work-zone data products. Phase 1: methodology design (months 1–9). Phase 2: empirical evaluation cycle (months 9–24). Phase 3: publication (months 24–30). Explicitly **not** procurement recommendations or product endorsements.
*Owner:* FHWA RD&T and NCHRP joint topic.

**F.2 Downstream-Cost Research on TFHRC External-Engagement Constraints.**
*State lens:* As a state-side consumer of federal research, the constraints flagged in Letter Report Recommendation 2 are not abstract — HSIS dark-out, reduced AMRP detail, reduced conference engagement each have measurable downstream costs in state operations and research efficiency.
*Research scope:* Empirical characterization of downstream cost to inform process change inside FHWA. Phase 1: practitioner survey (months 1–6). Phase 2: empirical assessment (months 6–18). Phase 3: synthesis report (months 18–24).
*Owner:* TRB Cooperative Research Program.

## Closing

The recommendations above are submitted as inputs to the Committee's deliberations. I would welcome the opportunity to elaborate on any item the Committee chooses to consider further, and I defer entirely to the Committee's process on which to advance, which to refine, and which to set aside. As a new member, I am aware that the value of these inputs is determined by how they survive the Committee's collective deliberation rather than by their individual merits as offered.

Respectfully submitted,

**Matt Miller**
mattmilleriowa@gmail.com

---

[^1]: This memorandum and the empirical observations cited within it are submitted in a personal research capacity. The integration environment referenced is operated privately for research purposes; no portion of it is offered for the Committee's evaluation, funding, or adoption.

[^2]: National Academies of Sciences, Engineering, and Medicine. 2025. *Research and Technology Coordinating Committee Letter Report: September 2025.* Washington, DC: The National Academies Press. https://doi.org/10.17226/29262

[^3]: Methodology: state counts and feed coverage are verified against the USDOT Work Zone Data Exchange Feed Registry (https://data.transportation.gov/resource/69qe-yiui.json) as of May 8, 2026, cross-checked against direct fetch of each registered endpoint. "No public WZDx feed" means no entry in the federal registry and no publicly-accessible WZDx-conformant endpoint identifiable on the state DOT or 511 developer pages.

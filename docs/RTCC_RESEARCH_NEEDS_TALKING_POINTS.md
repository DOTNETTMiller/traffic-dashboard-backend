# Federal Research Needs — Digital Infrastructure Interoperability

**Talking Points · RTCC Meeting · May 2026**
**Matt Miller**

**Framing:** every item below is a recommendation for **federal research investment** to operationalize the September 2025 RTCC Letter Report. Nothing here proposes any product, system, or service for adoption.

Each research need is anchored in an empirical observation from independent integration work covering ~10 federal and state public feed families across 39+ producers, plus the surrounding operations, quality, and decision-support surfaces (see *Sandbox Capability Inventory* for full scope).

---

## A. Feeds, Standards, and Interoperability Measurement

### 1. Measurement-of-Interoperability Research

- **Need:** Sustained, public federal research that empirically measures conformance, quality, and interoperability of public digital infrastructure feeds.
- **Why now:** ~21 states publish no public WZDx feed at all. Among those that do, the variance in conformance and quality is wide and silent. No federal research program measures this publicly.
- **Owner:** FHWA RD&T / TFHRC, NCHRP support
- **Output:** Open methodology, public per-producer measurements, refreshed continuously

### 2. Authoritative Cross-Specification Crosswalk Research

- **Need:** Reference crosswalks between WZDx ↔ TMDD ↔ CIFS ↔ CWZ 1.0 ↔ SAE J2735 ↔ Common Alerting Protocol, plus an open-source reference normalization implementation.
- **Why now:** Translation among specs is the single largest integration cost. Every multi-state consumer reinvents the mappings independently and they diverge silently.
- **Owner:** FHWA RD&T with relevant standards bodies (SAE, ITE, AASHTO)
- **Output:** Spec + reference implementation as research output. Not a product.

### 3. Sub-State and Regional Digital Infrastructure Layer Research

- **Need:** Characterize the sub-state and regional public-feed layer — prevalence, conformance, overlap with state-level feeds, and harmonization levers.
- **Why now:** Sub-state producers (City of Austin, St. Charles County, Maricopa County, Quebec City) fill real coverage gaps; they also overlap incompatibly with state feeds in some jurisdictions (PennDOT vs. PA Turnpike; IDOT vs. Illinois Tollway vs. City of Chicago). No academic or state program is filling this research gap.
- **Owner:** FHWA RD&T + NCHRP joint
- **Output:** Inventory, conformance assessment, policy-lever analysis

### 4. Non-WZDx Feed Integration Patterns Research

- **Need:** Research into how non-WZDx federal and federal-partner feeds (NWS Alerts, CBP Border Wait Times, NPS Road Events, IPAWS) should integrate with state work-zone and incident data in operator-facing systems.
- **Why now:** These feeds exist independently with no canonical guidance on fusion. Operators correlating weather, border delays, and work zones currently do this ad hoc.
- **Owner:** FHWA RD&T with FEMA, NWS, CBP coordination
- **Output:** Reference architecture and fusion patterns

### 5. Provenance and Lineage Standards Research

- **Need:** Research into per-field provenance standards for multi-source event records — how downstream consumers track which feed contributed which attribute when feeds overlap.
- **Why now:** Cross-state and cross-vendor data fusion is not auditable without provenance. Today every integrator implements ad hoc lineage if any at all.
- **Owner:** FHWA RD&T + TRB Cooperative Research Program
- **Output:** Provenance schema specification, reference implementation

## B. Data Quality, Measurement, and Validation

### 6. Standardized Data Quality Index Methodology Research

- **Need:** Federally-funded methodology research producing a standard, open Data Quality Index applicable across feed types (work zones, incidents, parking, weather, V2X).
- **Why now:** Every quality-grading initiative currently invents its own dimensions, weights, and scales. Without a methodological baseline, "quality" claims aren't comparable across feeds or producers.
- **Owner:** FHWA RD&T, with NCHRP and the practitioner community
- **Output:** Open methodology with versioning; published reference scores

### 7. Ground Truth and Predictive Model Validation Research

- **Need:** Systematic research into ground-truth methodologies for transportation predictive models — incidents, parking occupancy, corridor delay, equipment health.
- **Why now:** Predictive analytics in transportation operations are deployed broadly without standard validation protocols. Each implementation defines its own "good enough."
- **Owner:** FHWA RD&T, TFHRC, NCHRP
- **Output:** Ground-truth protocols and validation reference datasets

### 8. Coverage Gap and Cross-State Correlation Research

- **Need:** Research into how to systematically identify and quantify national coverage gaps in transportation event data, and how cross-state event correlation can be reliably performed.
- **Why now:** Today coverage gaps and cross-state correlations are surfaced only by integrators with full pipelines built. There's no federally-curated, methodologically-transparent view of where the national event picture is incomplete.
- **Owner:** FHWA RD&T
- **Output:** Methodology + ongoing public coverage assessment

## C. Operations Workflows and Coordination

### 9. Multi-State Closure Approval and Diversion Coordination Research

- **Need:** Research into federally-defined coordination protocols for multi-state planned closures and diversion routes.
- **Why now:** Multi-state closures and diversions today coordinate ad hoc, by phone or email between state TMCs. No federal protocol or data-exchange pattern exists despite the demonstrably national nature of freight corridor closures.
- **Owner:** FHWA RD&T with AASHTO
- **Output:** Reference coordination protocol and supporting data-exchange spec

### 10. DMS Messaging Conformance and Effectiveness Research

- **Need:** Research into dynamic message sign content patterns — what message structures actually change driver behavior, what cross-state variance in messaging looks like for the same incident type, and how DMS authoring tools should be governed.
- **Why now:** DMS messaging is one of the most direct operator levers; cross-state inconsistency is well known anecdotally but not systematically characterized.
- **Owner:** FHWA RD&T + state DOT participation
- **Output:** Empirical effectiveness findings, recommended message-pattern library

### 11. Truck-Parking Sensor Data Quality Research

- **Need:** Sensor-quality research for the MAASTO TPIMS coalition and parallel state systems.
- **Why now:** Of three keyless public MAASTO feeds, a substantial portion of Illinois sites currently flag their own sensor data as untrusted. Protocol-level coordination (MAASTO) is mature; the limiting factor on impact is sensor-level data quality, which is a research-program question.
- **Owner:** FHWA RD&T + TFHRC sensors lab
- **Output:** Sensor reliability research, calibration methodology

## D. Compliance, Regulatory, and Permit Interoperability

### 12. IPAWS Road-Impact Authoring Conformance Research

- **Need:** Research into how road-impacting CAP alert authoring in IPAWS maps to state TMC operator workflows in practice, and how IPAWS conformance varies state to state.
- **Why now:** IPAWS is a federal capability state DOTs use unevenly. There is no federally-funded research characterizing the variance or the operator-side friction.
- **Owner:** FHWA RD&T with FEMA IPAWS Program Office
- **Output:** Conformance methodology + per-state assessment

### 13. OS/OW Permit-Rule Interoperability Research

- **Need:** Research into how state oversize/overweight permit rules are encoded and exchanged, with attention to multi-state corridor consistency.
- **Why now:** NASCO has corridor-level guidance; state-by-state permit-rule encoding remains inconsistent in structure, vocabulary, and exchange format. Cross-state freight planning bears the cost.
- **Owner:** FHWA RD&T with NASCO and AASHTO
- **Output:** Permit-rule data model and exchange specification

### 14. Bridge-Clearance and Restriction Data Interoperability Research

- **Need:** Research into a standard exchange format for low-clearance, weight-restricted, and hazardous-cargo-restricted infrastructure inventory.
- **Why now:** Bridge clearance data is heterogeneous across states (units, datum reference, posted vs. measured); over-height-vehicle routing currently fails because of this heterogeneity.
- **Owner:** FHWA RD&T + AASHTO Bridges committee
- **Output:** Data model and reference exchange spec

## E. Decision Support and Asset Management

### 15. Asset Health and ITS Equipment Status Interoperability Research

- **Need:** Research into a standard exchange format for ITS equipment health (cameras, DMS, RWIS, weather stations, V2X RSUs).
- **Why now:** Asset health data exists per-state with no exchange standard. Cross-state operations and federal asset-management RD&T both suffer from the absence.
- **Owner:** FHWA RD&T + TFHRC operations lab
- **Output:** Equipment status schema and reference implementation

### 16. Digital Project Delivery / IFC-BIM Transportation Profile Research

- **Need:** Research into a transportation-specific IFC/BIM profile and metadata standards for digital project delivery exchange.
- **Why now:** IFC was designed for vertical construction. Transportation digital project delivery uses IFC inconsistently. The benefits the Letter Report cites — "accelerating delivery of highway projects" — depend on this profile existing.
- **Owner:** TFHRC infrastructure RD&T
- **Output:** Transportation IFC profile, reference exchange tooling

## F. Vendor Transparency and Practitioner Costs

### 17. Independent Comparative Evaluation Methodology for Commercial Data Products

- **Need:** Open methodology for head-to-head, methodologically-transparent evaluation of commercial probe, incident, and work-zone data products.
- **Why now:** State DOTs replicate similar RFP and vendor-comparison work in isolation each procurement cycle. No federally-curated, published methodology exists.
- **Owner:** FHWA RD&T + NCHRP joint
- **Output:** Open methodology and empirical findings. **Explicitly not** a procurement recommendation or product endorsement.

### 18. Downstream-Cost Research on TFHRC External-Engagement Constraints

- **Need:** Quantify the practitioner-side and state-DOT-side cost of constraints on TFHRC researchers' external engagement (Letter Report Recommendation 2).
- **Why now:** HSIS partial dark-out; reduced detail in AMRP/TFHRC Long-Range Plan publications; reduced conference engagement. These costs are real, distributed, and largely invisible to FHWA today.
- **Owner:** TRB Cooperative Research Program
- **Output:** Empirical characterization of the downstream cost

---

## What I am NOT asking for

- No specific system, product, or service for the committee to evaluate, fund, or adopt
- No procurement guidance
- No federal scoring of states as a regulatory function
- No endorsement of any methodology beyond those produced as research output

All eighteen items above are recommendations for **federal research investment** to advance interoperability in support of the digital infrastructure direction the Committee has already endorsed.

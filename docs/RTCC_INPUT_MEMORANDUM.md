# Input Memorandum to the Research and Technology Coordinating Committee

**To:** Carlos M. Braceras, P.E., Chair, Research and Technology Coordinating Committee
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Joseph Hartmann, Associate Administrator for Research, Development & Technology, Federal Highway Administration
**Cc:** Gloria M. Shepherd, Executive Director, Federal Highway Administration
**From:** Matt Miller
**Date:** May 11, 2026
**Subject:** Empirical observations on the state of digital infrastructure interoperability — inputs to the federal research agenda in support of the September 2025 RTCC Letter Report

---

## 1. Purpose and Scope of This Memorandum

I am grateful for the invitation to participate in the Research and Technology Coordinating Committee. In advance of my first meeting, I am submitting this memorandum to share empirical observations drawn from several years of independent, non-commercial integration work with the public digital infrastructure feeds published by state and federal transportation agencies. The intent is to contribute concrete inputs to the federal research agenda — specifically in operationalizing the digital infrastructure direction articulated in the Committee's September 2025 Letter Report.[^1]

I want to state the scope clearly at the outset. **This memorandum is offered strictly as research and policy input. It does not present, propose, recommend, or seek consideration of any specific system, product, or service.** Where I refer to integration work I have performed, I do so only as the empirical source of the observations that follow. Every recommendation below is a recommendation that **federal research be funded and conducted** — by FHWA Office of Research, Development & Technology, by Turner-Fairbank Highway Research Center, by NCHRP, or by appropriate partners — not that any agency procure, adopt, or evaluate any external work.

## 2. Source and Breadth of Empirical Observations

The observations below are drawn from end-to-end integration covering the following surfaces:

**Federal and state real-time public feed ingestion.** Work Zone Data Exchange at versions 3.0 through 4.2 across approximately 39 state and sub-state producers; Connected Work Zones (CWZ 1.0); Common Incident Format Specification via the Eastern Transportation Coalition; TMDD-derived state ATIS APIs in the Iteris/iBi family; MAASTO Truck Parking Information Management System v2.2; National Weather Service Alerts; CBP Border Wait Times; NPS Road Events; and sub-state and international producers including the City of Austin, St. Charles County Missouri, Maricopa County, and Quebec City.

**Data quality measurement and grading.** A composite Data Quality Index applied across producers (accuracy, conformance, completeness, timeliness, governance, lifecycle hygiene); per-state and per-vendor leaderboards; per-event confidence scoring; coverage gap and feed-alignment analysis; cross-state event correlation; anomaly detection.

**Standards translation and provenance.** Crosswalks between WZDx, TMDD, CIFS, CWZ 1.0, SAE J2735, and Common Alerting Protocol; WZDx version upgrade tooling; per-event provenance and lineage tracking; geometry validation.

**Operations workflows.** Dynamic message sign authoring with template management and approval; multi-state closure approval with state-DOT review and audit log; pre-staged diversion routes with road-snapping; corridor situational-awareness briefings; corridor delay estimation; route optimization across active events.

**Compliance, regulatory, and permit tools.** IPAWS integration for road-impacting public alerts (active alerts, rules configuration, after-action review, compliance assessment); NASCO corridor regulations; state and corridor-level oversize/overweight permit-rule representation; bridge-clearance warnings.

**Predictive analytics and validation.** Event probability forecasting; truck-parking occupancy forecasting with calibration; corridor risk forecasting; equipment-failure forecasting; ground-truth dashboards comparing reported and observed conditions.

**Decision support and digital project delivery.** Asset and equipment health monitoring; ITS equipment inventory and proximity lookup; CADD model libraries; IFC/BIM model viewing in-context; digital infrastructure readiness assessment per state.

**Communications and coordination.** Operator-to-operator and state-to-state messaging; per-event annotation; calendar-based scheduling; activity timelines.

**Vendor transparency.** Vendor leaderboards, DQI head-to-head comparisons, per-vendor gap analysis, procurement contract and SLA tracking, cost-per-event analysis.

**Cross-cutting engineering patterns.** OSRM road-snapping for routing; polyline-encoded geometry transport; caching with TTLs aligned to upstream update cadence; in-flight request dedupe; schema-drift tolerance.

End-to-end means: source identification, fetch, schema parsing, conformance checking, normalization to a common event model, cross-feed joining, operational presentation, and observation over time. This depth of engagement surfaces interoperability problems that are not visible from specification documents or from federal feed registries alone.

A companion inventory document enumerates the surfaces in greater detail and is available on request.

## 3. Findings and Federal Research Recommendations

The eighteen research-investment recommendations below are organized into six clusters. They are inputs intended for the Committee's consideration; they do not require any specific action by any agency.

### 3.A Feeds, Standards, and Interoperability Measurement

**(1) Measurement-of-Interoperability Research.** Approximately twenty-one states publish no public Work Zone Data Exchange feed of any kind, verified against the USDOT WZDx Feed Registry.[^2] Among states that do publish, conformance and quality variance is significant — invalid GeoJSON, expired TLS certificates, inconsistent field population, divergent lifecycle conventions. No federal research program publicly characterizes this variance. **Recommendation:** FHWA RD&T fund a sustained measurement-of-interoperability research program covering major public digital infrastructure feeds, with open methodology and public per-producer results.

**(2) Authoritative Cross-Specification Crosswalk Research.** The dominant integration cost across the practitioner community is translation among WZDx, TMDD, CIFS, CWZ 1.0, SAE J2735, and Common Alerting Protocol. Every consumer reinvents these mappings and they diverge silently. **Recommendation:** FHWA RD&T, in coordination with relevant standards bodies, fund research producing authoritative reference crosswalks and at least one open-source reference normalization implementation.

**(3) Sub-State and Regional Digital Infrastructure Layer Research.** Sub-state and regional public-sector producers contribute materially to national coverage (City of Austin, St. Charles County, Maricopa County, Quebec City), and in some jurisdictions overlap incompatibly with state-level feeds (PennDOT vs. PA Turnpike; IDOT vs. Illinois Tollway vs. City of Chicago). **Recommendation:** FHWA RD&T jointly with NCHRP fund research characterizing prevalence, conformance, overlap, and harmonization levers in this layer.

**(4) Non-WZDx Federal-Partner Feed Integration Patterns Research.** NWS Alerts, CBP Border Wait Times, NPS Road Events, and IPAWS exist independently with no canonical guidance on fusion with state work-zone and incident data. **Recommendation:** FHWA RD&T, in coordination with FEMA, NWS, and CBP, fund research producing a reference architecture for federal-partner feed integration.

**(5) Provenance and Lineage Standards Research.** Cross-feed and cross-vendor data fusion is currently not auditable because no provenance standard exists for which feed contributed which attribute. **Recommendation:** TRB Cooperative Research Program fund research producing a provenance schema and reference implementation.

### 3.B Data Quality, Measurement, and Validation

**(6) Standardized Data Quality Index Methodology Research.** Every quality-grading initiative currently invents its own dimensions, weights, and scales. **Recommendation:** FHWA RD&T fund methodology research producing a standard, open Data Quality Index applicable across transportation feed types, with versioning.

**(7) Ground Truth and Predictive Model Validation Research.** Predictive analytics are deployed broadly in transportation operations without standard validation protocols. **Recommendation:** FHWA RD&T and NCHRP fund research producing ground-truth protocols and reference validation datasets for incident, parking, delay, and equipment-health prediction.

**(8) Coverage Gap and Cross-State Correlation Research.** No federally-curated view of where the national event picture is incomplete currently exists. **Recommendation:** FHWA RD&T fund research producing methodology and ongoing public coverage assessment.

### 3.C Operations Workflows and Coordination

**(9) Multi-State Closure Approval and Diversion Coordination Research.** Multi-state closures and diversions today coordinate ad hoc despite the demonstrably national nature of freight corridor closures. **Recommendation:** FHWA RD&T, with AASHTO, fund research producing a reference coordination protocol and supporting data-exchange specification.

**(10) DMS Messaging Conformance and Effectiveness Research.** Cross-state DMS message inconsistency for the same incident type is well-known anecdotally but not systematically characterized. **Recommendation:** FHWA RD&T fund effectiveness research and produce a recommended message-pattern library.

**(11) Truck-Parking Sensor Data Quality Research.** Protocol-level coordination through MAASTO is mature; the limiting factor on impact is sensor-level data quality, with a substantial portion of Illinois sites currently self-flagging as untrusted. **Recommendation:** FHWA RD&T and TFHRC fund sensor reliability research and produce a calibration methodology.

### 3.D Compliance, Regulatory, and Permit Interoperability

**(12) IPAWS Road-Impact Authoring Conformance Research.** IPAWS is a federal capability state DOTs use unevenly; no research characterizes the variance or operator-side friction. **Recommendation:** FHWA RD&T, with FEMA IPAWS Program Office, fund conformance methodology and per-state assessment.

**(13) OS/OW Permit-Rule Interoperability Research.** State-by-state permit-rule encoding remains inconsistent in structure, vocabulary, and exchange format. **Recommendation:** FHWA RD&T, with NASCO and AASHTO, fund research producing a permit-rule data model and exchange specification.

**(14) Bridge-Clearance and Restriction Data Interoperability Research.** Bridge clearance data is heterogeneous across states; over-height-vehicle routing fails because of it. **Recommendation:** FHWA RD&T, with AASHTO Bridges, fund research producing a standard exchange format.

### 3.E Decision Support and Asset Management

**(15) Asset Health and ITS Equipment Status Interoperability Research.** Asset health data exists per-state with no exchange standard. **Recommendation:** FHWA RD&T and TFHRC operations lab fund research producing an equipment status schema and reference implementation.

**(16) Digital Project Delivery / IFC-BIM Transportation Profile Research.** IFC was designed for vertical construction; transportation digital project delivery uses it inconsistently. The Letter Report's reference to "accelerating delivery of highway projects" depends on this profile existing. **Recommendation:** TFHRC infrastructure RD&T fund research producing a transportation IFC profile and reference exchange tooling.

### 3.F Vendor Transparency and Practitioner Costs

**(17) Independent Comparative Evaluation Methodology for Commercial Data Products.** State DOTs replicate similar vendor-comparison work in isolation each procurement cycle. **Recommendation:** FHWA RD&T and NCHRP fund open methodology and empirical findings — explicitly not procurement recommendations or product endorsements.

**(18) Downstream-Cost Research on TFHRC External-Engagement Constraints.** The Letter Report's Recommendation 2 frames TFHRC engagement constraints as an internal-process concern; they also have measurable, distributed, practitioner-side costs. **Recommendation:** TRB Cooperative Research Program fund empirical characterization of the downstream cost to inform process change inside FHWA.

## 4. Closing

I would welcome the opportunity to elaborate on any of the findings above at the Committee's discretion, including by sharing measurements, conformance summaries, and gap inventories drawn from the integration work referenced in Section 2. I defer entirely to the Committee's process on whether and how to incorporate any of these inputs into its advice to FHWA leadership.

I look forward to participating in the Committee's continued dialogue with FHWA on these matters.

Respectfully submitted,

**Matt Miller**
mattmilleriowa@gmail.com

---

[^1]: National Academies of Sciences, Engineering, and Medicine. 2025. *Research and Technology Coordinating Committee Letter Report: September 2025.* Washington, DC: The National Academies Press. https://doi.org/10.17226/29262

[^2]: USDOT Work Zone Data Exchange Feed Registry. https://data.transportation.gov/resource/69qe-yiui.json — verified May 8, 2026.

# Federal Research Needs — Digital Infrastructure Interoperability

**Talking Points · RTCC Meeting · May 2026**
**Matt Miller — state-side perspective on a national problem**

**Framing:** state DOTs are individually responsible for safe, efficient, multi-jurisdictional corridors. The digital infrastructure connecting them is decentralized and unevenly conformant; states cannot harmonize it from where they sit. The recommendations below are research investments shaped to a 2–3 year federal RD&T cycle, additive to existing FHWA / ITS-JPO / TFHRC / NCHRP / NPMRDS / AASHTO standards work. None propose any product, system, or service for adoption.

---

## A. Feeds, Standards, and Interoperability Measurement

### 1. Measurement-of-Interoperability Research
- **State lens:** A state TMC consuming neighbor feeds has no federally-curated baseline against which to judge what it's receiving.
- **Horizon:** Phase 1 methodology + baseline (6mo) → Phase 2 continuous measurement (24mo) → Phase 3 longitudinal trends (36mo).
- **Owner:** FHWA RD&T / TFHRC, NCHRP support.
- **Output:** Open methodology, public per-producer measurements.

### 2. Authoritative Cross-Specification Crosswalk Research
- **State lens:** Every state reinvents WZDx↔TMDD↔CIFS translation; the translations diverge silently.
- **Horizon:** Crosswalk authoring (9mo) → reference implementation + pilot (24mo) → standards submission (30mo).
- **Owner:** FHWA RD&T with SAE, ITE, AASHTO.
- **Output:** Reference crosswalks + open-source normalization implementation.

### 3. Sub-State and Regional Layer Research
- **State lens:** Cities, counties, toll authorities, tribal agencies publish feeds that overlap incompatibly with the state's. The state cannot harmonize these alone.
- **Horizon:** Inventory (6mo) → conformance/overlap analysis (18mo) → harmonization policy options (30mo).
- **Owner:** FHWA RD&T + NCHRP.
- **Output:** Inventory, conformance assessment, policy-lever analysis.

### 4. Non-WZDx Federal-Partner Feed Integration Research
- **State lens:** State TMCs use NWS Alerts, CBP Wait Times, NPS Road Events, IPAWS ad hoc with no canonical fusion guidance.
- **Horizon:** Feed inventory (9mo) → reference architecture (24mo) → state pilot (36mo).
- **Owner:** FHWA RD&T with FEMA, NWS, CBP.
- **Output:** Reference architecture and fusion patterns.

### 5. Provenance and Lineage Standards Research
- **State lens:** Cross-feed event fusion is not auditable today; no provenance schema exists for which feed contributed which field.
- **Horizon:** Schema (9mo) → reference implementation (24mo) → integration with WZDx and adjacent specs (36mo).
- **Owner:** TRB Cooperative Research Program.
- **Output:** Provenance schema + reference implementation.

### 6. Field-Capture Provenance for Transportation Data
- **State lens:** Mobile-app and field-tablet capture of TTC deployments, asset inspections, and as-built records is emerging across practitioner workflows; no standard links a field-captured record back to the source authority, certifying credential, capture device, and capture moment.
- **Horizon:** Practitioner workflow survey (6mo) → spec authoring (24mo) → reference implementation + pilot (36mo).
- **Owner:** FHWA RD&T with TFHRC.
- **Output:** Field-capture provenance specification covering TTC deployments, as-built captures (including AR/LiDAR workflows), and asset inspections.

## B. Data Quality, Measurement, and Validation

### 7. Standardized Data Quality Index Methodology Research
- **State lens:** Each state and each vendor uses its own "quality" definition; cross-comparison is therefore not possible.
- **Horizon:** Methodology (9mo) → pilot scoring at scale (24mo) → publication + governance (30mo).
- **Owner:** FHWA RD&T + NCHRP.
- **Output:** Open, versioned DQI methodology with reference scores.

### 8. Ground Truth and Predictive Model Validation Research
- **State lens:** States deploy predictive analytics with each implementation defining its own "good enough." No shared validation framework.
- **Horizon:** Protocol design (9mo) → dataset collection (24mo) → publication (36mo).
- **Owner:** FHWA RD&T, TFHRC, NCHRP.
- **Output:** Ground-truth protocols + reference validation datasets.

### 9. Coverage Gap and Cross-State Correlation Research
- **State lens:** A state planning multi-state strategy has no federally-curated view of where the national event picture is incomplete.
- **Horizon:** Methodology + initial assessment (12mo) → continuous updating (30mo) → reporting interface (36mo).
- **Owner:** FHWA RD&T.
- **Output:** Methodology + ongoing public coverage assessment.

## C. Operations Workflows and Coordination

### 10. Multi-State Closure & Diversion Coordination Research
- **State lens:** Multi-state freight-corridor closures coordinate by phone and email between TMCs. No protocol or data-exchange standard exists for operational tempo.
- **Horizon:** Process/gap analysis (9mo) → protocol design (24mo) → multi-corridor pilot (36mo).
- **Owner:** FHWA RD&T with AASHTO.
- **Output:** Reference coordination protocol + data-exchange spec.

### 11. DMS Messaging Conformance and Effectiveness Research
- **State lens:** Same incident, signed differently in each state the driver passes through. Effectiveness cost is uncharacterized.
- **Horizon:** Cross-state audit (9mo) → effectiveness study (24mo) → pattern library (36mo).
- **Owner:** FHWA RD&T with state DOTs.
- **Output:** Empirical effectiveness findings + recommended cross-state pattern library.

### 12. Truck-Parking Sensor Data Quality Research
- **State lens:** MAASTO shows federal coordination works at the protocol level; sensor data quality is the limiting factor (Illinois sites self-flagging as untrusted).
- **Horizon:** Failure-mode characterization (9mo) → calibration methodology (24mo) → reference deployment guidance (36mo).
- **Owner:** FHWA RD&T + TFHRC sensors lab.
- **Output:** Sensor reliability research + calibration methodology.

### 13. Work Zone Reality vs. Reported Data Reconciliation Research
- **State lens:** Statewide WZDx feeds publish what permit/planning data say; actual TTC deployed in the field often differs. Field-app deployment data captured by certified crews is an under-utilized authoritative source for closing the loop.
- **Horizon:** Practitioner workflow survey + gap analysis (9mo) → reconciliation methodology + reference exchange spec (24mo) → state-DOT pilot (36mo).
- **Owner:** FHWA RD&T with AASHTO Work Zone Subcommittee and ATSSA.
- **Output:** Reconciliation methodology + reference exchange pattern for field-deployment data ↔ WZDx feeds.

### 14. Certified Traffic Control Supervisor Credential Interoperability Research
- **State lens:** TCS certifications are state-specific. Multi-state contractors maintain duplicates; state operations leadership has no federally-recognized way to verify a TCS credential issued elsewhere.
- **Horizon:** Program inventory (6mo) → data model + reciprocity framework (24mo) → multi-state pilot (36mo).
- **Owner:** FHWA RD&T with AASHTO and ATSSA.
- **Output:** Cross-recognition data model + reciprocity pilot.

## D. Compliance, Regulatory, and Permit Interoperability

### 15. IPAWS Road-Impact Authoring Conformance Research
- **State lens:** State DOT on-ramp from operational events to CAP-compliant authoring is unclear and inconsistent.
- **Horizon:** State survey (9mo) → methodology + assessment (24mo) → integration patterns (30mo).
- **Owner:** FHWA RD&T with FEMA IPAWS Program Office.
- **Output:** Conformance methodology + per-state assessment.

### 16. OS/OW Permit-Rule Interoperability Research
- **State lens:** State permit-rule digitization is progressing individually; cross-state corridor consistency in structure and vocabulary remains poor. Carriers and routing engines absorb the cost.
- **Horizon:** Encoding survey (9mo) → data model (24mo) → NASCO corridor pilot (36mo).
- **Owner:** FHWA RD&T with NASCO and AASHTO.
- **Output:** Permit-rule data model + exchange specification.

### 17. Bridge-Clearance and Restriction Data Interoperability Research
- **State lens:** Bridge clearance data is heterogeneous across states (units, datum, posted vs. measured); over-height routing fails at state lines.
- **Horizon:** Inventory survey (9mo) → data model (24mo) → pilot exchange (36mo).
- **Owner:** FHWA RD&T with AASHTO Bridges Committee.
- **Output:** Standard exchange format.

## E. Decision Support and Asset Management

### 18. Asset Health & ITS Equipment Status Interoperability Research
- **State lens:** Cameras, DMS, RWIS, V2X RSU health data exists per-state with no exchange standard. Cross-state coordination and federal asset-management RD&T both suffer.
- **Horizon:** Requirements (9mo) → schema + reference implementation (24mo) → three-state pilot (36mo).
- **Owner:** FHWA RD&T + TFHRC operations lab.
- **Output:** Equipment status schema + reference implementation.

### 19. Transportation IFC/BIM Profile Research
- **State lens:** States are being asked to deliver digitally. IFC was designed for vertical construction; transportation use is inconsistent. Depends on as-built data — utility lines, drainage, ITS conduit, surface assets — flowing in without translation loss.
- **Horizon:** Requirements + profile draft (12mo) → pilot exchange (24mo) → standards submission (36mo).
- **Owner:** TFHRC infrastructure RD&T.
- **Output:** Transportation IFC profile + reference exchange tooling, with attention to AR/LiDAR-assisted as-built capture workflows.

### 20. Subsurface Utility Engineering and ROW Utility Data Interoperability Research
- **State lens:** ROW utility data is captured per-project, per-utility, per-state, with no unified schema. SUE Quality Level data flows are ad hoc; cross-project and cross-jurisdictional reuse is impossible at scale. AR/LiDAR-assisted field capture is emerging without exchange standards to support it.
- **Horizon:** Practitioner-tool + state-program inventory (9mo) → data model + exchange spec (24mo) → multi-utility multi-state corridor pilot (36mo).
- **Owner:** FHWA RD&T with AASHTO SUE Committee and the Common Ground Alliance.
- **Output:** Reference data model spanning SUE Quality Levels A–D, as-built capture methods, and downstream BIM/IFC integration.

## F. Vendor Transparency and Practitioner Costs

### 21. Independent Comparative Evaluation Methodology for Commercial Data Products
- **State lens:** Each procurement cycle replicates substantially the same RFP and vendor-comparison work. No federally-curated methodology exists; cost to states is direct and recurring.
- **Horizon:** Methodology (9mo) → empirical evaluation cycle (24mo) → publication (30mo).
- **Owner:** FHWA RD&T + NCHRP joint topic.
- **Output:** Open methodology + empirical findings. **Not** procurement recommendations or product endorsements.

### 22. Downstream-Cost Research on TFHRC External-Engagement Constraints
- **State lens:** As state-side consumers of federal research, the constraints flagged in Letter Report Recommendation 2 (HSIS dark-out, reduced AMRP detail, reduced conference engagement) are not abstract; they each have measurable downstream cost.
- **Horizon:** Practitioner survey (6mo) → empirical assessment (18mo) → synthesis report (24mo).
- **Owner:** TRB Cooperative Research Program.
- **Output:** Empirical characterization to inform internal FHWA process change.

---

## Voting Strategy Notes (For Matt — Not For Distribution)

If the Committee proceeds to vote-by-item rather than collective deliberation, prioritize defense of these as the highest-leverage / lowest-cost:
- **#1** (measurement of interoperability) — operationalizes Rec. 5 directly, hardest to argue against on principle.
- **#2** (crosswalks) — small research investment, large national leverage, no political risk.
- **#5** (provenance) — short timeline, small scope, enables auditability.
- **#6** (field-capture provenance) — naturally extends #5 and pulls in a research area that none of the other federal programs are currently funding.
- **#10** (multi-state closure/diversion) — most politically alignable across the state DOT seats on the committee.
- **#13** (work zone reality vs. reported) — addresses a known but unspoken pain point for any state DOT operations head; pairs well with #6 and #10.

Politically delicate (be prepared to negotiate or trade):
- **#21** (vendor evaluation) — commercial members (IIHS, ATRI, AAA Foundation) may resist; offer trade for #22 if needed.
- **#22** (TFHRC engagement downstream cost) — asks TRB to study FHWA's own constraints; will need careful framing.
- **#8 / #9** (ground-truth, coverage gap) — may overlap with existing NPMRDS-adjacent work; be ready to differentiate.
- **#14** (TCS credential interoperability) — touches state licensure prerogatives; soften framing as cross-recognition research, not federal mandate.
- **#20** (SUE/ROW utility data) — pulls in CGA and AASHTO SUE constituencies who may have prior preferences; offer to coordinate, not lead.

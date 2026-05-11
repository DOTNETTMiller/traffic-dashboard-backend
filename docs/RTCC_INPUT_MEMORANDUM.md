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

I want to state the scope clearly at the outset. **This memorandum is offered strictly as research and policy input. It does not present, propose, recommend, or seek consideration of any specific system, product, or service.** Where I refer to integration work I have performed, I do so only as the empirical source of the observations that follow. Every recommendation here is a recommendation that **federal research be funded and conducted** — by FHWA Office of Research, Development & Technology, by Turner-Fairbank Highway Research Center, by NCHRP, or by appropriate partners — not that any agency procure, adopt, or evaluate any external work.

## 2. Source of Empirical Observations

The observations below are drawn from end-to-end integration of the following public digital infrastructure feeds, conducted as independent research:

- Work Zone Data Exchange (WZDx) at versions 3.0 through 4.2, across approximately 39 state DOT and sub-state producers
- Connected Work Zones (CWZ 1.0) feeds from CDOT, MassDOT, IDOT, and others
- Common Incident Format Specification (CIFS) via Eastern Transportation Coalition
- TMDD-derived state ATIS Application Programming Interfaces in the Iteris/iBi family
- MAASTO Truck Parking Information Management System (TPIMS) v2.2
- Federal feeds including the National Weather Service Alerts API, CBP Border Wait Times, and NPS Road Events
- Sub-state and international producers including the City of Austin, St. Charles County Missouri, Maricopa County, and Quebec City

End-to-end means: source identification, fetch, schema parsing, conformance checking, normalization to a common event model, cross-feed joining, and operational use over time. This is the level of engagement at which interoperability problems become observable that are not visible from specification documents or from the federal feed registries alone.

## 3. Findings and Federal Research Recommendations

### Finding 1: Interoperability cannot be assumed at the present state of practice; it must be measured.

The Committee's Recommendation 5 calls for the Federal Highway Administration to elevate Turner-Fairbank's role in advancing digital infrastructure and data systems. The benefit case for that elevation is contingent on the feeds themselves being observably interoperable, and that condition is not currently met.

Empirical observations:

- As of May 2026, approximately twenty-one state DOTs publish no public Work Zone Data Exchange feed of any kind, verified against the USDOT WZDx Feed Registry.[^2] For those jurisdictions, statewide real-time work-zone data is not available to downstream consumers through any public channel.
- Among the states that do publish, conformance and quality variance is significant. Independent integration encounters feeds that ship invalid GeoJSON, feeds with expired TLS certificates, fields populated inconsistently from one state to the next, and lifecycle conventions that diverge from the published specification.
- No federal research program presently characterizes this variance publicly. The WZDx Feed Registry is a directory of feed locations, not a measurement of feed conformance, quality, or interoperability.

**Recommended federal research investment:** That FHWA RD&T fund and conduct a sustained measurement-of-interoperability research program covering the major public digital infrastructure feeds — WZDx, CWZ, CIFS, TMDD-derived state APIs, and federal partner feeds. The program's methodology should be open and its results public, with the goal of giving states, practitioners, and the federal program itself an empirical view of whether interoperability investments are paying off. This is the cross-cutting, national-scope research role that decentralized partners cannot fill for themselves, consistent with the Letter Report's Conclusion 3.

### Finding 2: The dominant integration cost is translation among standards, not the standards themselves.

The interoperability friction encountered most frequently in practice is not deficiency within any single specification. It is the absence of authoritative crosswalks between the specifications consumers must integrate together. Every operations dashboard, every traveler information consumer, and every multi-state research project performs substantially the same translation work independently.

Examples of friction points repeatedly observed:

- Event-type vocabularies in Work Zone Data Exchange, TMDD, CIFS, and SAE J2735 each define overlapping but non-identical event taxonomies
- Severity scales differ across specifications — Work Zone Data Exchange has no severity dimension at all, CIFS uses four levels, TMDD has its own scheme, and the National Weather Service uses Common Alerting Protocol
- Lifecycle conventions diverge, such that an event marked "closed" in one specification may be "completed" in another and "archived" in a third

The cost of this fragmentation is borne silently by every multi-state integrator and degrades the comparability of multi-state analyses in ways that are difficult to detect after the fact.

**Recommended federal research investment:** That FHWA RD&T, in coordination with the appropriate standards bodies, fund research producing (a) authoritative reference crosswalks between WZDx, TMDD, CIFS, CWZ 1.0, SAE J2735, and Common Alerting Protocol, and (b) at least one open-source reference normalization implementation that the practitioner community can converge upon. The output is research output — a specification and a reference — and does not require any agency to procure any product.

### Finding 3: The sub-state and regional layer of digital infrastructure is materially significant and currently un-researched.

A consistent observation from feed cataloging is that sub-state and regional public-sector producers contribute materially to national coverage in ways the WZDx Feed Registry does not fully reflect:

- The City of Austin publishes a Work Zone Data Exchange feed at v4.2 covering urban arterials the Texas Department of Transportation statewide feed does not include
- St. Charles County, Missouri publishes a regional Work Zone Data Exchange feed covering the Interstate 70 corridor west of St. Louis
- Maricopa County DOT is the only Work Zone Data Exchange producer for the entire state of Arizona at present
- Quebec City publishes Work Zone Data Exchange v3.1, providing international consistency for Northeast freight planning
- In some jurisdictions, sub-state feeds overlap incompatibly with state-level feeds — observed cases include Pennsylvania (PennDOT versus PA Turnpike), Illinois (IDOT versus Illinois Tollway versus the City of Chicago), and the Minneapolis-St. Paul metropolitan area
- The Indiana Department of Transportation publishes a public truck parking feed that does not conform to the MAASTO TPIMS v2.2 schema — there is no current research mechanism for diagnosing or addressing the divergence

**Recommended federal research investment:** That FHWA RD&T fund research into the sub-state and regional layer of digital infrastructure — characterizing its prevalence, conformance with major specifications, overlap with state-level feeds, and the policy levers available to harmonize it. No academic or state-led research program is presently filling this gap, and it fits the national-scope coordination research role the Committee has endorsed in Recommendation 3.

## 4. Supporting Observations

The following are offered briefly in support of the Letter Report's existing recommendations, drawn from the same source of empirical observation.

### 4.1 Recommendation 2 (TFHRC external engagement) has measurable downstream costs.

The Letter Report frames the constraints on TFHRC researchers' external engagement primarily as an internal-process concern. From the perspective of downstream practitioners, the constraint also has a measurable research-productivity cost. Reductions in the public availability of TFHRC resources, including the Highway Safety Information System, remove reference datasets practitioners had been using. Less detailed publication of methodology forces independent reverse-engineering from samples, producing drift between what practitioners build and what FHWA originally intended. The Annual Modal Research Plan and the TFHRC Long-Range Plan are how practitioners orient to which federal research lines are active; reductions in the detail of those publications correspondingly reduce downstream research efficiency. These costs are real and worth surfacing alongside the internal-process concerns the Letter Report already identifies.

### 4.2 Independent comparative evaluation of commercial transportation data products is an underfunded research area.

A consistent observation from conversations with state transportation agencies is that procurement of commercial transportation data products — probe data, incident detection, work-zone monitoring — occurs largely without comparable, methodologically-transparent independent evaluation. Each state replicates similar request-for-proposal work, and no published, federally-curated, head-to-head methodology exists for these product categories. This appears to be a candidate joint research topic for FHWA RD&T and the National Cooperative Highway Research Program. The output would be open methodology and empirical findings — not procurement recommendations or product endorsements — that states could draw upon to inform their own independent evaluations.

## 5. Closing

I would welcome the opportunity to elaborate on any of the findings above at the Committee's discretion, including by sharing measurements, conformance summaries, and gap inventories drawn from the integration work referenced in Section 2. I defer entirely to the Committee's process on whether and how to incorporate any of these inputs into its advice to FHWA leadership.

I look forward to participating in the Committee's continued dialogue with FHWA on these matters.

Respectfully submitted,

**Matt Miller**
mattmilleriowa@gmail.com

---

[^1]: National Academies of Sciences, Engineering, and Medicine. 2025. *Research and Technology Coordinating Committee Letter Report: September 2025.* Washington, DC: The National Academies Press. https://doi.org/10.17226/29262

[^2]: USDOT Work Zone Data Exchange Feed Registry. https://data.transportation.gov/resource/69qe-yiui.json — verified May 8, 2026.

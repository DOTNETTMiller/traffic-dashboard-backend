# RTCC Participation Brief — Matt Miller

**Audience:** TRB Research and Technology Coordinating Committee (RTCC), FHWA RD&T leadership
**Reference:** Sept 2025 RTCC Letter Report — doi:10.17226/29262
**Posture:** Strictly research and interoperability advocacy. Not a vendor, not selling a service, not promoting any tool. Lived integration experience is offered as *evidence* informing what federal research should fund, not as a product to evaluate.

---

## What lived integration experience informs

Over the past several years I have done extensive hands-on, non-commercial integration work consuming, normalizing, and stress-testing the public digital infrastructure feeds states and federal agencies publish:

- WZDx (every published version — v3, v4.0, v4.1, v4.2 — in production simultaneously)
- CWZ 1.0 Connected Work Zones
- CIFS via Eastern Transportation Coalition
- TMDD-derived state ATIS APIs (Iteris/iBi family — multiple states)
- MAASTO TPIMS v2.2
- NWS Alerts API, CBP Border Wait Times, NPS Road Events
- Sub-state and Canadian/international producers

That work is research, not service delivery. **Nothing here is being offered for the committee to evaluate, fund, or adopt.** The point of recounting it is that empirical evidence from end-to-end integration surfaces specific interoperability gaps that policy-level advice should reflect.

Those gaps — and the federal research investments that would close them — are below.

---

## The 3 anchor points (must-say)

### 1. Interoperability cannot be assumed; it must be measured — and federally-funded research should produce the measurement

The committee's Recommendation 5 calls for TFHRC to elevate its role in digital infrastructure. **The agenda cannot deliver its promised benefits** if the feeds the digital infrastructure produces aren't observably trustworthy. Empirical findings from independent integration work:

- **Roughly 21 states have no public WZDx feed of any kind** as of May 2026 (verified against the WZDx Feed Registry). Statewide real-time work-zone data is simply unavailable for those jurisdictions through any public channel.
- Among states that *do* publish, conformance and quality variance is large enough that a "national digital infrastructure" narrative is currently aspirational, not real. Independent integration encounters feeds with invalid GeoJSON, expired TLS certs, fields populated inconsistently across states, and lifecycle conventions that diverge from the spec.
- **No federal research program publicly characterizes this variance.** The WZDx Feed Registry is a directory, not a measurement program.

**Research ask:** TFHRC should fund and conduct a sustained measurement-of-interoperability research program. Methodology open, results public, comparable across producers. Not as a regulator scoring states, but as a research function that lets practitioners, states, and the federal program itself see whether interoperability investments are paying off. This is *exactly* the cross-cutting national-scope research role that the decentralized partners won't fill for themselves (Conclusion 3 of the letter report).

### 2. Crosswalk and translation research is the highest-leverage federal investment in interoperability

The biggest interoperability friction in practice is not the standards themselves; it is **translating among them**. Every consumer of multi-state real-time data spends most integration effort on translation:

- WZDx event types ↔ TMDD event types ↔ CIFS incident codes ↔ SAE J2735 PSM/RSM messages
- Severity scales: WZDx has none, CIFS has four levels, TMDD has its own, NWS uses CAP
- Lifecycle conventions: "closed" in WZDx may be "completed" in TMDD or `event_status: archived` in CWZ

Today every integrator reinvents these mappings independently — and they all disagree at the edges, which silently degrades the comparability of multi-state analyses.

**Research ask:** TFHRC should fund research that produces (a) authoritative reference crosswalks between WZDx, TMDD, CIFS, CWZ, SAE J2735, and CAP, and (b) at least one open-source reference normalization implementation that the practitioner community can converge on. This is research output (specification + reference) — it does not require any agency to procure any product.

### 3. The sub-state and regional layer is the fastest national-coverage win, and it is currently un-researched

Empirical finding from independent feed cataloguing:

- Several sub-state producers publish high-quality WZDx feeds that cover urban arterials and corridor segments their state DOT doesn't publish (City of Austin, St. Charles County MO, Maricopa County, Quebec City as international example)
- In some jurisdictions, the sub-state feeds *overlap incompatibly* with state feeds (PennDOT vs PA Turnpike, IDOT vs Illinois Tollway vs City of Chicago, MnDOT vs Minneapolis-area producers)
- Indiana INDOT publishes a public TPIMS feed in a non-conforming format that doesn't match the V2.2 schema MAASTO standardized — there is no research mechanism for nudging it back into conformance

**Research ask:** Fund research into the sub-state and regional layer of digital infrastructure — its prevalence, conformance, overlap, and the policy levers that would harmonize it with state-level feeds. This is a gap area no academic or state-led program is currently filling, exactly the kind of national-scope coordination research the committee has already endorsed in Recommendation 3.

---

## The 2 supporting points (deploy if the conversation goes there)

### 4. The constraint on TFHRC's external engagement (Recommendation 2) is measurable downstream

The letter report frames this as an internal-process concern. From a downstream practitioner perspective it is also a research-productivity concern:

- HSIS going partially dark removed a reference dataset I (and others) had been using
- Reduced TFHRC publication of methodology details forces practitioners to reverse-engineer from samples, which produces drift between what we build and what FHWA intended
- AMRP and long-range plan documents are how practitioners orient to which federal research lines are active — when those publications get less detailed, downstream research efficiency suffers

This is offered as an example of the *measurable cost* of the constraint, supporting the letter report's existing recommendation.

### 5. Independent comparative evaluation of commercial traffic data products is an underfunded research area

A consistent observation from state-DOT conversations is that procurement of commercial traffic data products (probe data, incident detection, work-zone monitoring) happens largely without comparable, methodologically-transparent independent evaluation. Each state re-does similar RFP work. There is no published, federally-curated, head-to-head evaluation methodology for these products.

**Research ask:** This is a candidate TFHRC + NCHRP joint research topic. The output would be **methodology and findings** — not a procurement recommendation, not a product endorsement — that states could use to inform their own evaluations.

---

## Tactical notes for the meeting itself

- **Frame as research and policy, not as work product.** Reference lived integration only as the source of empirical observation — never as something the committee should look at, fund, or adopt. The line to avoid: "I built X, FHWA should consider adopting/funding it." The line to use: "Integration work surfaced finding X, which suggests federal research should investigate Y."
- **No live demos. No screen-shares of any tool.** If pressed for evidence of specific findings, offer to share *data* and *findings* — measurements, conformance reports, gap inventories — never a system being demonstrated.
- **Numbers carry; tools don't.** "21 states with no public WZDx feed" lands; "look at what my dashboard does" doesn't and shouldn't.
- **Lead with the gap, not with the experience.** Open with the interoperability finding; only mention the integration work as the source if a member asks how the finding was reached.
- **Don't echo Braceras.** He chairs from the UDOT executive director seat; the state-DOT-customer voice is already represented. Your distinctive contribution is the *interoperability researcher* voice — someone who has empirically observed how federal and state digital infrastructure actually behaves when stitched together.
- **One anchor per meeting.** Trying to land all three in the first session will dilute the message. The measurement-of-interoperability ask is the natural first-meeting opener because it directly operationalizes the letter report's existing Recommendation 5.

---

## Phrases you can use verbatim

- "I'd like to help operationalize Recommendation 5. The digital infrastructure agenda won't deliver its benefits unless federal research is also measuring whether the underlying feeds are observably interoperable, and right now no public research program does."
- "Roughly 21 states have no public WZDx feed of any kind. That gap is what determines whether the digital infrastructure narrative is empirically real or currently aspirational."
- "The integration research community is independently reinventing the WZDx ↔ TMDD ↔ CIFS crosswalk many times over. A federally-funded authoritative crosswalk specification — not a product, just the spec and a reference implementation — would be a small research investment with national leverage."
- "MAASTO TPIMS is the existence proof that federal coordination of state data systems works in practice. The current limiting factor on its impact is sensor data quality, which is squarely a TFHRC research-program question."
- "I want to be clear that I'm not bringing anything for the committee to fund or adopt. I'm offering the empirical observations from independent integration work as inputs to the federal research agenda."

# Platform Stewardship, Sustainability, and Multi-Jurisdiction Adoption

**A working memo on why state DOTs benefit from a shared interoperability platform, how the same pattern extends to cities and counties, and what the long-term home, governance, and funding structure should look like.**

**Author:** Matt Miller
**Date:** 2026-05-18
**Status:** Working draft for discussion with state DOT leadership, AASHTO committee staff, and FHWA RD&T partners.

---

## 1. Executive Summary

A working reference implementation now exists that ingests roughly 31 state DOT feeds, 2 sub-state regional feeds, and several federal-partner feeds (NWS, CBP, NPS, IPAWS), normalizes them to a common event model, and presents them as a multi-state operational picture. Empirically it has surfaced four classes of silent failure in state feeds that, when fixed, recovered ~450 interstate events that had been invisible to operators — without changing the source feeds at all. The platform is already useful, and the most important questions are no longer technical. They are:

1. **Why should a state pay anything to participate?** Because every state is solving the same neighbor-feed integration, format-drift, and federal-reporting problem in parallel, and the marginal cost of doing it once at a shared layer is much smaller than 50 states each doing it badly.

2. **Does the same model extend below the state level?** Yes. Cities and counties suffer the same gaps with even less capacity to bridge them, and several federal funding streams (SS4A, ATCMTD successors, V2X deployments) are explicit about funding *integrated arterial + freeway* operational data.

3. **Where should this live long-term?** The strongest fit is an **AASHTO cooperative program** modeled on AASHTOWare — member-owned by state DOTs, dues-funded, with elected technical committees and a published lifecycle. ITE is the right bridge for city and county participation. FHWA is the right partner for standards alignment, not the long-term home.

4. **How does it get funded across the transition?** A staged model: **FHWA pooled fund study (TPF-5) in years 1–3** to fund the move from prototype to managed shared service, transitioning to **AASHTO member dues plus tiered licensing** as the steady-state operating model.

The rest of this memo defends these recommendations.

---

## 2. Value to States

A state DOT operating a TMC today already does most of this work — once, alone, with no measurement, and incompletely. The value of a shared platform is concrete, and it accrues across at least twelve distinct lines of operational, compliance, and financial benefit. The sections below take each in turn. The unifying claim is simple: **every state is already paying for all of this. The platform makes the cost legible, the work non-redundant, and the outcome measurable.**

### 2.1 Data quality goes from "we think it's fine" to measurable and continuously improving

The single largest benefit of a shared platform is that **data quality stops being an opinion and becomes a number** — published, longitudinal, comparable across states, and trending. Today, every state DOT has a working theory about whether its own feeds are good. None has evidence. None has a baseline to improve against. None can credibly compare itself to a peer.

The platform produces, for every ingested feed, a composite **Data Quality Index** measuring:

- **Conformance** to the published specification (WZDx 4.x, TMDD, CIFS, CWZ 1.0, etc.).
- **Completeness** of expected fields, per-event and per-feed.
- **Freshness** — time from real-world incident to feed availability.
- **Geometry quality** — presence and accuracy of route geometry, milepost alignment, snapping fidelity to the underlying interstate network.
- **Coverage** — what percentage of expected corridor mileage and event types is the feed actually reporting.
- **Stability** — how often the feed structure changes underneath consumers.

Once a state can see these numbers for its own feed and its neighbors', three things happen:

1. **Silent failures surface.** In the current reference implementation, 13 of 31 configured state feeds were silently dropping events. Four bug classes accounted for most of the loss: a missing format-dispatch value (NJ, OK silently never fetched), an interstate-classification regex that required "I-" prefix and rejected WSDOT's `"005"` and MoDOT's `"70"`, the same regex rejecting valid I-XX events whose description mentioned a cross-street state route, and a trailing word-boundary that rejected DelDOT's `"I-95NB"` form. Fixing them recovered ~450 events per refresh cycle. **No state DOT staff would have caught these bugs alone** — the failure mode is "events the operator never sees" and there is no alarm for an event that doesn't exist in the local view. Shared measurement is the only practical way to find this class of problem.

2. **Procurement gains an objective standard.** A state with measurable, longitudinal feed-quality data can say "our current ATMS vendor's WZDx feed scores 0.62 on the published DQI; three peers' vendors score above 0.85" and put that in a procurement document. Without the platform, the only available evidence is anecdote.

3. **Continuous improvement gets a feedback loop.** Quarterly DQI reports become an artifact state CIOs and Chief Operating Officers can use in performance reviews of internal teams, vendor contracts, and grant deliverables. The act of measuring drives the quality up; the platform is the measurement instrument.

### 2.2 Consistent multi-state messaging from a single composer

When a winter storm shuts down I-80 from Nevada through Wyoming, today four different state DOTs put up four DMS messages with four different wordings, four different abbreviation conventions, four different priorities — and the truck driver hears the same warning from one sign that reads `"I-80 CLOSED / USE ALT RTE"` and another that reads `"WB I-80 CLOSED MILE 142 / EXPECT 4 HR DELAY"`. The traveler experience is worse than any single state would design alone.

The platform offers a **shared DMS message library and composer**:

- MUTCD-compliant templates with categorical tags (incident, weather, construction, parking, AMBER alert, queue warning, detour, special event, speed limit, lane closure).
- Variable substitution (`{{delay}}`, `{{exit}}`, `{{detour_route}}`) so that the same template renders correctly for each state's local context.
- Per-template approval status so that a draft can be reviewed before activation.
- Live LED-board preview so the activating operator sees exactly what the sign will display.
- A shared activation history searchable across states, enabling after-action review.
- Auto-coordination with **adjacent-state notification** when a closure or major event in one state should trigger a corresponding upstream DMS message in the neighbor.

The same composer drives **IPAWS road-impact alerts** with shared geofence templates so that a tornado-related I-29 closure published by Iowa is immediately available, in IPAWS-CAP format, to be replicated or referenced by Nebraska and Missouri TMCs. AMBER Alerts coordinated this way reach travelers entering a state in the same format they saw on the way in.

This is what "consistent messaging from a central location" delivers in practice: not a federal override, but a *member-shared toolset* that lets neighboring states converge on common wording when it serves the traveler, while keeping their own authority to override.

### 2.3 Cross-border operational coordination

Today: an event on I-80 at the Iowa/Illinois line is in two different ATMS systems, in two different schemas, with two different update cadences, and Iowa's TMC sees it via a phone call. The Iowa operator manually re-keys the Illinois description into a TIM message. If the event escalates, neither TMC has a shared incident-of-record.

With a shared layer: the same event has a single normalized record carrying both states' source fields with full provenance. Either TMC can subscribe to the corridor and see the other state's data updated within seconds.

Beyond the basic shared view, the platform supports:

- **Pre-staged diversion routes** that cross state lines, with operator approval workflows from each affected state.
- **Closure approval workflows** that route a request through both states' designated approvers before activation, with a published audit trail.
- **Corridor delay estimation** that fuses upstream and downstream sensor data across the state line rather than truncating at it.
- **Stranded-motorist coordination** so a state-line incident is owned by exactly one operator at any time, with documented handoff.

The cost of *not* having this is invisible because the failure mode is human re-keying and operator-to-operator phone calls, not an alarm. The platform makes the invisible cost legible.

### 2.4 Workforce leverage and operator efficiency

Modern TMCs are chronically understaffed. The platform doesn't replace operators, but it materially expands how much each operator can manage:

- A consistent interface across corridors means an operator certified on one corridor can cover an adjacent one during a shift gap without re-training.
- The corridor view collapses what would be three or four single-state dashboards into one — an operator monitoring I-80 sees Nevada, Utah, Wyoming, Nebraska, and Iowa in one frame, not five tabs.
- **24/7 mutual-aid backup**: when a state's TMC is short-staffed, a neighboring TMC can credibly monitor the interstate segment from across the border using the same tooling, with explicit handoff documented in the shared system.
- **Onboarding new operators** is faster with consistent UX; **training materials** can be developed once and shared.

The single largest line item in most state TMC budgets is staff. Even modest staffing leverage compounds: an operator who covers 1.3 corridors instead of 1.0 produces 30% more operational coverage without any new headcount.

### 2.5 Predictive analytics at a national-volume scale

A single state's operational history is too small to support most useful predictive analytics. Pooling normalized data across 30+ states unlocks a category of capability no individual state can produce:

- **Event probability forecasting** — given current weather, time-of-day, day-of-week, and corridor characteristics, what is the probability of a major incident in the next two hours?
- **Parking occupancy forecasting** — multi-state truck-parking demand modeling for the MAASTO TPIMS layer.
- **Corridor risk scoring** — segment-level safety-and-incident risk maps for Safe System Approach planning.
- **Equipment-failure forecasting** — predictive maintenance for ITS field equipment based on multi-state failure-mode patterns.

These are research-grade capabilities that NCHRP and pooled-fund studies have long sought to produce. The shared platform is the only place the data volume exists to produce them outside a federal research vehicle.

### 2.6 Federal compliance and grant competitiveness

In the next federal cycle, state DOTs face a stack of digital-infrastructure compliance expectations: WZDx 4.2 conformance, CWZ 1.0 connected-work-zone readiness for V2X deployments, ARC-IT architecture documentation, IPAWS road-impact event integration, FHWA HPMS digital reporting, and Safe System Approach data integration tied to SS4A funding eligibility. Every state will be asked to demonstrate these.

A shared platform absorbs much of the conformance machinery so that compliance becomes a *configuration* rather than a *project*. The cost of one state implementing WZDx 4.2 conformance from scratch is the same as the cost of 30 states implementing it once at a shared layer — except the second option uses 1/30th the staff time and produces a comparable baseline.

The same applies to **grant competitiveness**. The current generation of federal mobility grant instruments — SS4A, SMART Stage 2, V2X deployment grants, ATCMTD successors, CRRSAA-style programs — explicitly score applicants on demonstrated data integration and interoperability. A state listing "active participant in the multi-state interoperability cooperative, with measured WZDx conformance score 0.91" outscores a state listing "we are pursuing a state-specific WZDx implementation." Participation becomes a competitive asset in the same federal funding cycles that fund the participation itself.

### 2.7 Operational resilience and redundancy

State DOTs are exposed to single-point-of-failure risk in ways that don't appear in any continuity-of-operations plan today:

- **Feed outages.** When a state's ATMS goes down, its 511 system goes dark, and adjacent states are blinded to events at the border for the duration of the outage. With a shared layer, the last-known-good state of each feed is cached and visible; neighbors aren't operating in the dark.
- **Vendor failure.** If a single vendor providing 511 services to multiple states has an outage (which has happened more than once at the iBi511 / Iteris tier), every affected state loses visibility simultaneously. Shared multi-source ingest reduces the blast radius.
- **Cybersecurity incidents.** A state DOT under active incident response cannot publish to its own feeds. Neighboring states can continue to see the last-known-good state from the platform's cache rather than losing operational picture mid-incident.
- **Staffing surges.** During severe weather, several states' TMCs simultaneously hit capacity. Shared workflows let a state with reserve capacity assist a state at capacity.

Resilience is the kind of value that is invisible until it's needed. Buying it through a shared cooperative is dramatically cheaper than buying it through redundant state-by-state infrastructure.

### 2.8 Public-facing consistency for travelers, CMV operators, and connected vehicles

The traveling public — especially commercial vehicle operators driving across multiple states in a single shift — experiences state-DOT data inconsistency directly. A consistent multi-state view solves three concrete problems:

- **511 messaging consistency.** Traveler-facing 511 messages converge on shared wording and abbreviation conventions where states opt in, while keeping local authority where it matters.
- **Commercial vehicle routing.** Freight operators get a coherent multi-state advisory picture: oversize/overweight permits, bridge clearances, truck parking availability, fuel/rest area data, and active closures are presented in a single normalized format across state lines.
- **Connected and automated vehicle readiness.** CV/AV applications consuming WZDx and SAE J2735 messages require *consistent format and quality across state boundaries* — a connected work-zone message that's well-formed in Iowa but malformed at the border in Illinois is operationally useless to the vehicle. A shared platform with conformance measurement is what makes CV/AV deployments at the corridor scale credible.

This is also the angle that matters most to elected leadership: the public-facing case for state DOT investment lives or dies on whether the traveler experience improves. Multi-state consistency is the most visible improvement available.

### 2.9 Procurement leverage and vendor transparency

A state with longitudinal vendor-performance data has procurement leverage it does not otherwise have. Beyond DQI scores, the platform tracks:

- **Vendor head-to-head comparisons** across states on conformance, freshness, and stability.
- **Procurement contract tracking** showing which vendors hold which contracts in which states with what scope.
- **Vendor DQI leaderboards** updated continuously.
- **Format-change frequency** — how often does a given vendor change its feed structure under consumers? — which is a hidden cost most procurement processes don't measure.

This information is non-rival: every state that joins makes every other state's procurement stronger. The information also tilts the vendor market toward higher quality — vendors who are measured well in front of their customers' peers tend to invest in remaining measured well.

### 2.10 Equity across DOT sizes — small and rural states gain the most

Today, the gap between a large-state TMC (California, Texas, New York) and a small-state TMC (Vermont, Delaware, Wyoming) is enormous in tooling capability — large states can afford to build custom integration tooling that small states can't. The result is that a freight corridor passing through a small state experiences a capability discontinuity at the border.

A shared cooperative compresses that gap. **The same tooling becomes available to every member regardless of TMC size or budget.** A small-state TMC running the cooperative's tooling gets the same operator experience, the same predictive analytics, the same compliance posture, and the same procurement leverage as the largest member. This is not a marginal benefit — it is the single largest equity gain available to small and rural state DOTs in operational technology.

### 2.11 Standards harmonization without giving up state authority

A common concern in any multi-state coordination conversation is loss of state authority. The platform is explicitly designed around the opposite assumption: **the state retains all decision authority**. The platform standardizes the *plumbing* (formats, identifiers, schemas, conformance testing) without prescribing the *content* (when to close a corridor, what to say on a sign, who to contact). State DOTs retain:

- Decision authority over their own DMS activations, closures, and IPAWS publications.
- Their own feed structure if they choose not to adopt the cooperative's reference normalizer.
- Their own vendor relationships and procurement practices.
- The right to opt out of any specific shared workflow (multi-state closure approval, etc.) while still participating in baseline data integration.

What the platform standardizes is the layer where standardization is non-controversial: the schemas, the conformance tests, the measurement methodology. The same layer where AASHTOWare standardizes pavement and bridge management software without telling states what bridges to build.

### 2.12 Bottom-line: every state is paying for this already

The argument-of-last-resort for state participation is financial:

- Every state already pays integration engineers, vendor staff, and analysts to do this work, badly, in parallel with 49 other states doing it badly in parallel.
- Every state already absorbs the cost of silent feed failures in the form of operator re-keying, late TIM messages, and uncoordinated cross-border response.
- Every state already loses grant points to states that can demonstrate integration; the question is whether your state is on the winning side of that scoring or the losing side.
- Every state already has compliance work coming in the next federal cycle; the question is whether your state pays the full cost of that compliance work or 1/30th of it.

The cost is *not zero today*. It is decentralized, opaque, and individually small enough to not show up in any one state's budget line. The cooperative makes it legible, consolidates it, reduces it, and produces measurable continuous improvement.

**This is the case for every state DOT to participate, and it is why "we already do this ourselves" is not actually a reason to stay out — it is the reason this is worth doing together.**

---

## 3. Why the Same Pattern Extends to Cities and Counties

The same gaps exist below the state level — and in many ways are worse — but with much less capacity to address them. The user-facing problem is identical: an event "downtown" affects the upstream interstate, but the city feed and the state feed don't share a schema, identifier space, or update channel.

### 3.1 Sub-state operational data is real, fragmented, and growing

The current reference implementation already ingests sub-state feeds from the City of Austin, St. Charles County (Missouri), Maricopa County (Arizona), and Quebec City. Several patterns repeat across them:

- They publish WZDx-shaped data but at city/county scope, sometimes covering arterials that the state DOT does not.
- The volume is significant: Austin alone publishes ~2,400 work-zone features at any given time.
- They are not surfaced in any federally-curated registry consistently.
- They are operationally adjacent to state interstate events but cannot be correlated without normalization.

### 3.2 Why cities and counties under-invest individually

A typical mid-sized city public-works department does not have an integration engineer, much less a TMC. Even when the city publishes a WZDx feed, it is usually because a single vendor delivered it as part of a project — and the city has no in-house ability to monitor whether the feed continues to function, much less measure its quality.

This is the strongest argument for shared infrastructure at the city/county tier: the *unit economics never work alone*. A single city cannot justify the staffing to run an integration layer; 30 cities sharing one layer can.

### 3.3 Federal funding is moving in this direction

The current generation of federal mobility funding instruments explicitly favor integrated arterial-plus-freeway operational data:

- **Safe Streets and Roads for All (SS4A)** Implementation Grants require demonstrated data integration for Safe System Approach action plans, which makes shared operational data a competitive asset rather than a cost.
- **Strengthening Mobility and Revolutionizing Transportation (SMART)** Stage 2 deployment grants explicitly fund interoperability infrastructure.
- **The successor programs to ATCMTD** continue to fund regional integration over single-jurisdiction tooling.
- **V2X / CV deployment grants** require connected work-zone data from the city/county tier in addition to the state tier.

In each case, a participating city or county is more competitive with a shared platform participation in hand than with a one-off project deliverable.

### 3.4 The model: same platform, different tier

The pattern works because the *architecture is identical* — only the membership tier differs:

- **State tier**: full member, full vote on the technical committee, full dues, full mutual coordination obligations.
- **City/county tier**: associate member, observer vote, scaled dues, optional contribution to shared technical committees, full access to data and operational tooling.
- **Regional consortium tier**: a multi-jurisdiction body (metropolitan planning organization, corridor coalition) can hold a consortium membership covering its member jurisdictions.

Critically, the *platform* is the same. Cities don't get a worse product; they get a tier of governance scaled to their capacity to participate.

---

## 4. Long-Term Financial Structure

There is no single funding mechanism that works for the full lifecycle. The right structure is a staged transition.

### 4.1 Years 1–3: FHWA Pooled Fund Study (TPF-5)

The FHWA Transportation Pooled Fund program (TPF-5) is the natural starting point. It is:

- **Multi-state by design**: it exists specifically to let states co-fund work whose benefits cross state lines.
- **Federally-supported at 50%**: every $1 of state contribution is matched by 50% federal pooled-fund support, so a $250K-per-state annual commitment from 10 lead states becomes a $3.75M program with federal participation.
- **Well-precedented for digital infrastructure**: the existing pooled-fund framework documented in `docs/pooled-fund-digital-infrastructure.md` lays out the model; this would not be the first.
- **Time-bounded**: TPF-5 studies are typically 3–5 years, which is the right horizon for moving from working prototype to managed shared service.

The TPF-5 study cannot, however, be the *permanent* home — pooled-fund studies are research vehicles, not operating organizations.

### 4.2 Years 3–5: Transition to AASHTO cooperative program

Around year 3, the operating model should converge with an AASHTO cooperative — the same governance structure used by **AASHTOWare** (the AASHTO software cooperative for pavement, bridge, and project-management software products). AASHTOWare:

- Is **member-owned** by state DOTs.
- Charges **scaled member fees** tied to product use and DOT size.
- Has **elected technical advisory committees** that govern feature priorities.
- Maintains a **published product lifecycle** with release cadence and support tiers.
- Distributes **member-developed software** to all participating DOTs as a non-rival good.

The platform fits this precedent cleanly. The transition from a TPF-5 study to an AASHTOWare-like cooperative is the same transition AASHTOWare products themselves have made historically.

### 4.3 Years 5+: Steady-state sustainment

Once at steady-state, the cost structure breaks roughly into four pieces:

1. **Member dues** (states + cities/counties) covering core platform operations.
2. **Federal cooperative agreements** for new-capability work that benefits the federal RD&T enterprise (measurement methodology, crosswalk research, new-standard reference implementations).
3. **Project-specific grant pass-throughs** for state-specific extensions funded through SS4A, SMART, V2X deployment grants — paid into the platform when the state's grant funds the integration work.
4. **Vendor-tier participation** (paid associate memberships for vendors who want access to the measurement infrastructure without governance vote) — used only to keep the measurement work independent of any single vendor, and capped so vendor revenue does not exceed member revenue.

Order-of-magnitude steady-state: ~$8–12M/year for the full multi-state platform with city/county tier active, of which ~60% is state member dues, ~25% is federal grants, ~15% is vendor and project pass-throughs.

### 4.4 What this structure protects against

The staged transition protects against three failure modes that have ended similar efforts in the past:

- **Federal-only funding** ends when the federal program ends. Pooled-fund + member-dues ensures the platform survives priority changes at FHWA.
- **Single-vendor capture**. AASHTOWare-style governance puts vendor influence in a capped tier, with state DOTs holding the voting majority.
- **Conformance-by-fiat without operational use**. Member-funded means members must use it, which means it must actually solve operational problems — not just publish a specification.

---

## 5. Stewardship Organization Analysis

Three organizations are commonly suggested as long-term hosts: **AASHTO**, **ITE**, and **ITS America**. **FHWA** is sometimes suggested as well. Each has strengths and disqualifying weaknesses.

### 5.1 AASHTO — recommended primary home

**Strengths.**

- **Member-owned by all 50 state DOTs**, which matches the primary participant tier exactly.
- **Existing precedent for software cooperatives** via AASHTOWare — the operating model is established and understood by state CFOs and procurement staff.
- **Existing standards alignment via JSTAN** (Joint Subcommittee on Data Standardization). The platform's standards posture (WZDx, TMDD, CIFS, SAE J2735, IFC) maps to JSTAN's existing scope, so housing the platform under AASHTO does not require creating a new technical committee from scratch — the existing AASHTO committee structure can be a host immediately.
- **AASHTO ShareIT** already exists as the document and resource distribution mechanism.
- **Liaison committees** to ITE, ITS America, TRB, and AASHTOWare are already in place — adding city/county participation through ITE liaison is structurally supported.

**Weaknesses.**

- AASHTO's primary identity is state-DOT-facing. City and county participation, while supported via ITE liaison, is a second-class arrangement in the AASHTO structure.
- AASHTO cooperatives are slow-moving by design. The 6-month committee cycle is correct for governance but does not match the cadence of operational software.

**Mitigation.** Pair the AASHTO governance home with a faster-cadence operating organization (see Section 6 on structure).

### 5.2 ITE — recommended city/county bridge

**Strengths.**

- **Broad membership** spanning state DOTs, cities, counties, transit agencies, and consultants. ITE is the natural home for the city/county tier of participation.
- **Active technical councils** on traffic management, connected/automated vehicles, and shared mobility provide a venue for cross-tier coordination.
- **International scope** (ITE has Canadian and Mexican members), which matches the platform's cross-border integration (Quebec City is already an integrated regional feed).

**Weaknesses.**

- ITE is a professional society, not a member-of-agencies organization. Funding mechanics for an agency-owned cooperative are awkward inside ITE.
- ITE does not currently run software products of comparable complexity.

**Recommendation.** ITE is not the right primary home, but is the right **co-steward for the city/county tier** and the right forum for cross-tier technical coordination.

### 5.3 ITS America — recommended industry alignment partner

**Strengths.**

- Deep V2X / connected-vehicle technical depth.
- Strong industry relationships, which is the right venue for vendor participation.

**Weaknesses.**

- Industry-led governance is the *wrong* governance for what should be a state-DOT-led cooperative. Vendor voting majority would invert the value proposition.
- ITS America's operating model is convening + advocacy, not running shared infrastructure.

**Recommendation.** ITS America is the right venue for **vendor-tier coordination and V2X technical alignment**, not the long-term home of the platform.

### 5.4 FHWA — recommended standards-alignment partner, not long-term home

**Strengths.**

- Standards authority (WZDx, ARC-IT, HPMS) sits at FHWA.
- TPF-5 is operated at FHWA, so the year 1–3 funding mechanism is housed there.

**Weaknesses.**

- Federal hosting creates federal-control optics that state DOTs systematically resist. AASHTOWare is the model because state DOTs prefer member-ownership to federal stewardship.
- FHWA staffing turnover and administration-level priority changes make FHWA an unstable long-term host for an operational platform that needs 10+ year continuity.
- FHWA cannot easily collect member dues, which closes off the most stable funding source.

**Recommendation.** FHWA is the right **standards-alignment, research, and Phase 1 funding partner**, not the long-term home.

### 5.5 TRB / NCHRP — recommended research-arm partner

**Strengths.**

- TRB's NCHRP cooperative research program is the natural home for **methodology research** (Data Quality Index, crosswalk specifications, measurement frameworks).
- NCHRP work flows directly into AASHTO committee adoption.

**Weaknesses.**

- TRB is research-only. It cannot operate a production platform.

**Recommendation.** TRB/NCHRP is the right partner for **research outputs that feed into the platform** (DQI methodology, crosswalk specifications, etc.), and the natural place to publish the measurement methodology so that it becomes a defensible standard.

### 5.6 Summary recommendation

| Function | Home |
|---|---|
| Long-term governance and membership | **AASHTO cooperative (AASHTOWare-model)** |
| City and county participation | **ITE co-stewardship, AASHTO liaison** |
| Vendor-tier participation | **ITS America affiliated committee** |
| Standards alignment | **FHWA + AASHTO JSTAN joint** |
| Years 1–3 funding | **FHWA TPF-5 pooled fund** |
| Methodology research | **TRB / NCHRP** |
| Open-source code stewardship | **Foundation (e.g., OMF or Linux Foundation), reporting to the AASHTO cooperative** |

The platform itself is governed by the AASHTO cooperative; the other organizations are partners with specific scopes.

---

## 6. Structural Recommendations

### 6.1 Governance board

- **9 voting seats**: 7 elected state DOT seats (regional rotation matching AASHTO's regional structure: Northeast, Mid-Atlantic, Southeast, Mid-America, Central, West, and Pacific) + 1 city/county at-large seat + 1 federal-partner non-voting seat.
- **Term length**: 3 years staggered, 1-term renewable.
- **Officer election** annually from the seated board.
- **Quorum** at 5; major changes (dues structure, charter amendments) require 7.

### 6.2 Technical committees

Four standing committees, each with a state-DOT chair and an at-large vice-chair:

1. **Feeds and Conformance** — feed onboarding, conformance testing, crosswalk maintenance.
2. **Operations and User Experience** — operator-facing tooling, multi-state coordination workflows.
3. **Measurement and Quality** — Data Quality Index governance, longitudinal reporting, methodology publication.
4. **Sub-state Integration** — city, county, regional feed onboarding; ITE liaison.

Each committee meets monthly; chairs report quarterly to the governance board.

### 6.3 Operating organization

The governance board is slow by design. The day-to-day operating organization is a small **managing entity** (4–6 FTE in steady state) housed at an AASHTO-affiliated nonprofit, accountable to the governance board, with a published service-level agreement.

This is the AASHTOWare model. It separates **what gets built** (committee decisions, slow) from **how it runs** (operating staff, fast).

### 6.4 Open-source posture

The reference implementation is licensed under a permissive open-source license (Apache 2.0 or BSD-3-Clause). Member dues fund the *managed shared service* — the production hosting, the data integration ops, the measurement work — not access to source code. This matches the AASHTOWare precedent of cooperative-developed software being freely available to participating DOTs and the public alike.

### 6.5 IP posture

- **Crosswalk specifications**: published as open standards via AASHTO + SAE + ITE joint publication. No member or vendor holds IP.
- **Measurement methodology (DQI etc.)**: published as open methodology via TRB/NCHRP. No member or vendor holds IP.
- **Reference normalization implementations**: open-source.
- **State-specific extensions** built with state grant funds: optionally contributed back; members retain the right to keep state-specific work proprietary if grant terms require, but the platform itself remains open.

### 6.6 Dues structure

A 5-tier annual dues schedule, indexed to operational scale rather than to state population (which is the wrong measure for a TMC platform):

| Tier | Annual dues | Eligibility |
|---|---|---|
| State DOT — Tier A | $250K | Operates a primary TMC, ≥5 freeway corridors integrated |
| State DOT — Tier B | $150K | Operates a primary TMC, <5 freeway corridors integrated |
| State DOT — Tier C | $75K | No primary TMC; coordinates with regional or peer TMCs |
| Regional consortium | $50K | MPO, corridor coalition, or regional operating body covering multiple jurisdictions |
| Local government | $10K | City or county, member or associate scope |
| Federal partner | $0 (in-kind) | FHWA, USDOT components, FEMA, NWS, CBP, NPS |
| Vendor — capped tier | $50K | Read access to measurement data, no governance vote |

These figures are illustrative; the right levels emerge from the TPF-5 study's cost baseline.

---

## 7. Why AASHTO is the Right Home — A Final Argument

A skeptic could reasonably ask: "Why does this need a home at all? Why can't every state just keep doing what they're doing?"

The answer is that *what they're doing* is producing the silent failures documented in Section 2.1 — where 13 of 31 configured state feeds were dropping events without anyone knowing. Every state is paying the cost of these bugs already, in operator re-keying, in TIM messages that go out late, in cross-border phone calls, in compliance work done from scratch. The cost is not zero, it is just decentralized, opaque, and individually small enough to not show up in any one state's budget.

A shared cooperative makes that cost legible. Once it is legible, it is reducible. That is the entire argument.

AASHTO is the right home for the cooperative because **AASHTO already runs cooperatives like this**. AASHTOWare exists. JSTAN exists. The committee structure exists. The state CFO familiarity exists. Standing up an AASHTO cooperative for shared interoperability infrastructure is not a new idea — it is the natural extension of the model that already works for pavement-management software, bridge-management software, and project-management software.

The reference implementation already exists. The standards alignment is already in place. The measurement methodology is already validated against ~31 state feeds and ~4 sub-state feeds. The remaining question is governance, and the cleanest answer is AASHTO.

---

## 8. Open Questions for Discussion

The recommendations above are working positions. Several questions remain genuinely open and should be discussed before committing to a specific structure:

1. **Lead state(s) for the TPF-5 study.** The pooled fund needs a sponsoring state DOT and ideally 4–6 committed lead states for the initial 3-year scope. Iowa, Nebraska, Kansas, Indiana, and Minnesota (current CARS members) are natural candidates; Utah, Idaho, and Washington are natural West-region candidates; New York and Pennsylvania are natural Northeast candidates.

2. **Where the operating organization is physically housed.** AASHTOWare uses outsourced operators; this platform could use the same model or could be housed at an AASHTO-affiliated nonprofit. The latter has stronger optics but higher fixed cost.

3. **Whether cities and counties participate from day one or in year 2.** A staged model that lets the state tier stabilize first is administratively simpler; a same-day-launch model is operationally more valuable. The TPF-5 study scope should make this call explicitly.

4. **Vendor participation gating.** The capped vendor-tier structure is correct in principle but the *threshold* — how much vendor revenue is permitted before governance independence is compromised — needs to be set carefully and reviewed annually.

5. **Sunset criteria for the TPF-5 study.** The pooled fund must have clear hand-off criteria so it actually transitions to the AASHTO cooperative rather than persisting indefinitely. NCHRP precedent suggests a 3-year scope with a defined transition milestone.

These are appropriate questions for the first board cycle and the TPF-5 study scoping memo.

---

## Appendix A: Related Documents

- `docs/RTCC_INPUT_MEMORANDUM.md` — research recommendations submitted to the FHWA Research and Technology Coordinating Committee, May 2026.
- `docs/AASHTO_JSTAN_OVERVIEW.md` — detailed mapping of platform capabilities to AASHTO JSTAN standards and committees.
- `docs/pooled-fund-digital-infrastructure.md` — framework for using TPF-5 to fund multi-state digital infrastructure work.
- `docs/RTCC_PREP_BRIEF.md` — empirical observations on national digital infrastructure gaps.

## Appendix B: Comparable Cooperative Models

- **AASHTOWare** — state-DOT-owned software cooperative; ~25 years of operating history; primary model for the structural recommendations above.
- **NPMRDS / RITIS at the University of Maryland** — federal-funded operational data infrastructure; a useful comparator for the federal-cooperative-agreement portion of the funding stack.
- **TPIMS / MAASTO** — regional truck-parking pooled-fund study; demonstrates that the TPF-5 mechanism can produce a sustained operating service when scoped correctly.
- **The Eastern Transportation Coalition (formerly I-95 Corridor Coalition)** — multi-state operating coalition; useful as a regional-tier precedent within the proposed national structure.
- **Open Mobility Foundation (OMF)** — open-source code stewardship at a foundation; useful precedent for the code-stewardship layer that sits underneath the AASHTO cooperative.

---

*This memo is a working draft. Comments, corrections, and counter-arguments are welcome.*

# RTCC Participation Brief — Matt Miller

**Audience:** TRB Research and Technology Coordinating Committee (RTCC), FHWA RD&T leadership
**Reference:** Sept 2025 RTCC Letter Report — doi:10.17226/29262
**Your role:** New committee member. The seated members are mostly senior agency execs (UDOT, GDOT, MaineDOT, Memphis MPO), industry/research leaders (IIHS, ATRI, AAA Foundation, NCAT), and academia (Georgia Tech). Your comparative advantage is **operator-level lived experience** integrating real federal and state digital infrastructure feeds.

---

## What you bring to the table that the current committee doesn't

You've built and operate a multi-state traffic operations sandbox that consumes, normalizes, scores, and surfaces:

- **39+ state DOT work-zone feeds** in WZDx (v3/v4/v4.1/v4.2 — yes, all four versions in production simultaneously)
- **CWZ 1.0** Connected Work Zones (CDOT, MassDOT, IDOT, your own)
- **CIFS** via Eastern Transportation Coalition
- **TMDD-derived** state ATIS APIs (Iteris/iBi family — 511GA, 511NY, AZ511, Alaska 511, UDOT)
- **MAASTO TPIMS v2.2** real-time truck parking — and the discovery that of 8 member states, only 3 publish keyless public feeds, and several have sensors their own agency flags as untrusted
- **NWS Alerts API, CBP Border Wait Times, NPS Road Events, Waze CCP** as non-WZDx fillers for states with no DOT-published feed
- **Sub-state and international feeds:** City of Austin TX, St. Charles County MO, Quebec City, Maricopa County AZ
- **A working data quality grading framework** (DQI: completeness, accuracy, timeliness, standards conformance, governance) applied across states and vendors
- **Standards crosswalk** between WZDx, TMDD, CIFS, CWZ, SAE J2735 event types

None of the seated members do this work directly. That's your lane.

---

## The 3 anchor points (must-say)

### 1. Data quality is the unfunded pre-condition for the digital infrastructure agenda

The committee's Recommendation 5 calls for TFHRC to elevate its role in digital infrastructure. **The agenda will stall** unless the feeds themselves are usable. Right now:

- **21 states have no public WZDx feed at all** (verified against the WZDx Feed Registry, May 2026). For those states, there is no statewide real-time work-zone data the public or downstream systems can consume.
- Among the states that *do* publish, the variance in quality is enormous. I can show:
  - Feeds that ship invalid GeoJSON
  - Feeds with expired TLS certs (St. Charles County, MO, weeks-stale)
  - Feeds that report `confirmed: true` for events with no road name, no geometry, and a 30-day duration
  - WZDx v4 fields populated inconsistently across states (some never populate `vehicle_impact`, others never populate `worker_presence`)
- **No federal entity grades any of this publicly.** The WZDx Feed Registry is a directory, not a quality scoreboard.

**Ask:** TFHRC should operate a continuously-updated public observatory of digital traffic data feed health — completeness, accuracy, freshness, conformance — for every state and major sub-state producer. The methodology should be open so states can self-improve against it. This is exactly the kind of *cross-cutting, national-scope, infrastructure-as-research* function decentralized partners won't do for themselves.

### 2. Standards crosswalks are the actual bottleneck — not the standards themselves

Every operations dashboard, every traveler information consumer, every research project that touches multi-state real-time data spends the majority of its integration budget translating between vocabularies:

- WZDx event types ↔ TMDD event types ↔ CIFS incident codes ↔ SAE J2735 PSM/RSM messages
- Severity scales: WZDx has none, CIFS has 4 levels, TMDD has its own, NWS uses CAP
- Lifecycle conventions: a "closed" work zone in WZDx may be "completed" in TMDD or `event_status: archived` in CWZ

**Ask:** TFHRC should publish (a) authoritative reference crosswalks between these specs, (b) at least one open-source reference normalization implementation that downstream consumers can vendor in. Today every integrator rolls their own and they all disagree slightly — which silently degrades the comparability of multi-state analyses.

### 3. Sub-state and regional feeds are the fastest national-coverage win — and nobody is coordinating them

Concrete cases I can cite:

- **City of Austin TX** publishes a 5MB WZDx feed daily that covers urban arterials TxDOT's statewide feed misses
- **St. Charles County MO** publishes regional WZDx that fills the I-70 west-of-St-Louis corridor
- **Maricopa County DOT** is the *only* WZDx producer for the entire state of Arizona
- **Indiana INDOT** publishes a non-spec TPIMS feed at `content.trafficwise.org` that doesn't conform to the V2.2 schema MAASTO standardized
- **Quebec City** publishes WZDx 3.1 cleanly — international consistency for Northeast freight planning

These aren't research projects; they're production feeds operated by transportation agencies. But nobody catalogs them centrally; nobody validates their conformance; and they overlap unpredictably with state-level feeds (PennDOT vs PA Turnpike, IDOT vs Illinois Tollway vs City of Chicago).

**Ask:** A modest federal harmonization effort — including the sub-state feeds in the registry, validating their conformance, and brokering protocol convergence where overlap exists — would yield disproportionate national coverage gain. This is a TFHRC-shaped problem: too coordinative for any single state, too operational for academic research, and exactly the "fill gaps the decentralized enterprise won't fill" function the committee already endorses (Conclusion 3).

---

## The 2 supporting points (deploy if the conversation goes there)

### 4. Echoing Recommendation 2 from a downstream user's perspective

The committee notes that constraints on TFHRC researchers' external engagement are "increasingly problematic." I can speak to that as the customer they're losing access to.

- HSIS going partially dark cost me a reference dataset for a corridor risk model
- Difficulty reaching TFHRC staff on questions about FHWA pavement data formats meant I had to reverse-engineer the schema from samples
- I rely on AMRP and TFHRC long-range plan documents to understand which research lines are funded and ongoing — if those publications get less detailed, downstream practitioners lose orientation

**Ask:** Frame the loss of TFHRC external presence as a measurable cost to state DOTs and the practitioner community, not just an internal-process concern.

### 5. State DOTs lack a federally-curated "buyer's guide" for traffic data vendors

Right now states evaluate vendors (Iteris, INRIX, HERE, RITIS, Waycare, Rekor, Acyclica, Caliper, …) in isolation, often re-doing the same RFP work and comparing apples to oranges. The sandbox I run has:

- A vendor leaderboard scoring feeds head-to-head on the DQI methodology above
- Coverage gap analysis (what's missing in vendor X's product per state)
- Vendor-side comparison views surfacing where vendor data diverges from authoritative state DOT data

**Ask:** This is a TFHRC + NCHRP candidate project: a federally-curated, methodologically-transparent vendor comparison would save state procurement cycles and reduce the per-state cost of evaluating commercial data products. ATRI and IIHS sit on this committee; they have aligned incentives.

---

## Tactical notes for the meeting itself

- **Lead with the work, not the opinion.** A 30-second "here's what I've integrated and what surprised me" hooks attention faster than abstract advocacy.
- **Numbers carry.** "21 states with no WZDx feed" lands harder than "many states lag in adoption." Have these queued.
- **Don't echo Braceras.** He chairs from the UDOT executive director seat; he already owns the state-DOT-as-customer voice. Your voice is the integrator/operator one beneath that — a layer the committee hasn't had.
- **Pick one new thing to introduce per meeting.** Trying to land all 3 anchors + 2 supports in the first session will dilute. Pick the data-quality-observatory ask as the first-meeting anchor; bank the rest.
- **Offer to bring artifacts.** The committee operates on briefings; you can offer a screen-share of the live sandbox showing concrete feed-quality variance across states. Most members have never seen this data side-by-side.
- **Watch where the committee already has momentum.** Recommendation 5 (digital infrastructure) is the open door. Frame your points as *operationalizing* that recommendation — not as alternative direction.

---

## Phrases you can use verbatim

- "I'd like to operationalize Recommendation 5. Digital infrastructure won't deliver on its promise unless the underlying feeds are observably trustworthy, and right now no federal entity scores them publicly."
- "There are 21 states for which a downstream consumer cannot get statewide real-time work-zone data through any public channel. That's the gap that determines whether the digital infrastructure narrative is real or aspirational."
- "Every multi-state integrator is reinventing the WZDx↔TMDD↔CIFS crosswalk independently. TFHRC publishing an authoritative one would be a small effort with national leverage."
- "The MAASTO truck parking program is the existence proof that federal coordination of state data systems works. Three of eight states publish public feeds; the limiting factor right now is sensor data quality, not protocol. Sensor-quality research is exactly TFHRC's lane."
- "I'm one of the practitioners who's downstream of TFHRC. When the agency becomes harder to reach, the cost is invisible to FHWA but real to me — let me describe what specifically gets lost."

# TDI Data Architecture Framework Validation Session — Preparation Brief

**Session:** Transportation Digital Infrastructure Architecture Framework Validation
**Convener:** ITS America (on behalf of U.S. DOT, OST-R)
**Date:** Tuesday, May 19, 2026 · 1:00 pm – 3:15 pm ET
**Format:** Virtual peer-exchange · recorded for notetaking · non-attribution
**Participant:** Matt Miller, CPM — Iowa DOT
**RSVP deadline:** COB Wednesday, May 6, 2026

**Last Updated:** 2026-05-07

---

## 1. Why I'm in the room

I've spent the last 18 months building **Matt's Experimental Sandbox** (formerly DOT
Corridor Communicator) — a multi-state, multi-format traffic dashboard that
aggregates ~1,900 active events from ~50 state DOT feeds, normalizes across five
parallel specifications (WZDx v4.2, TMDD, SAE J2735 TIM, CIFS, CWZ), and applies a
per-event compliance grading layer that surfaces which fields are missing, invalid,
or out-of-spec for each standard.

This is operational, not theoretical. The platform pulls live data, applies
road-snap geometry via OSRM, integrates federal V2X deployment data, generates
IPAWS-compliant alerts, and computes closure-driven truck parking surge predictions
in real time. The same infrastructure layer that this validation session is
discussing — distributed governance, trust domains, identity federation, multi-spec
data architecture — is something I've had to make real implementation choices on,
not just policy choices.

That perspective is what I bring: **what actually breaks at the edges**, and which
architectural questions are technical vs. which are masquerading as architectural
when they're really policy.

---

## 2. The four discussion areas — my positions

### 2.1 Data ownership and liability

**Position:** Ownership in a federated transportation data architecture is *not*
binary. It must be modeled as a chain: source authority → normalizer → aggregator →
consumer. Liability flows along that chain and can't be cleanly assigned to any one
node.

**Concrete grounding from the platform:**
- I ingest WZDx feeds from ~50 state DOTs. Each state owns its own data at the
  source. But the moment my server normalizes a TMDD event into SAE J2735 TIM
  format and applies an OSRM road-snap, I have **derived** something — and the
  original state DOT has no awareness or control of that derivation.
- When a closure event from Iowa's feed is incorrect (wrong lat/lng, missing
  end_time), and I serve it to a downstream consumer who routes a truck around
  it — who's liable? Iowa for sourcing it wrong? My platform for relaying it? The
  consumer for trusting it?
- I solved the **technical** part by attaching a per-event compliance score
  (0-100 per spec) and a `geometrySource` field (`osrm`, `state_dot_wfs`,
  `straight_line` fallback, etc.) so consumers see exactly how trustworthy each
  record is. But that doesn't answer the legal question.

**What the framework should say:**
- Adopt **provenance metadata as a first-class architectural requirement**, not an
  afterthought. Every record should carry a chain-of-custody header (source
  authority, transformation steps, quality scores, last-validated timestamp).
- Distinguish **liability for accuracy** (source) from **liability for fitness**
  (aggregator) from **liability for use** (consumer). The framework can clarify
  the boundaries; the legal regime around them is policy, not architecture.

**Question I'd ask the convener:** Does the draft framework specify a provenance
schema, or does it leave that to implementers? In my experience leaving it
unspecified produces fifty incompatible custody headers.

---

### 2.2 Distributed governance models

**Position:** Distributed governance works in this domain — but *only* with
discoverability, conformance testing, and a backstop authority for dispute
resolution. Pure peer-to-peer federation without a coordinating layer creates a
tragedy of the commons.

**Concrete grounding from the platform:**
- I work with the NASCO Coalition (multi-state freight corridor coordination)
  and the CCAI pooled fund concept (Iowa, Kansas, Minnesota, Missouri, Nebraska,
  Nevada, Oklahoma, Pennsylvania, Texas). These are real distributed governance
  experiments.
- What works: a shared **specification** (WZDx) that all members commit to. What
  doesn't: differential **adoption maturity** (some states publish all required
  fields, others publish 60% of them). My compliance grading exists because
  even within a "compliant" feed, half the events fail spec.
- I built `TETC_MDODE_Grading_SOP.md` (the Data Quality Index v1.0) precisely
  because there was no neutral third party scoring vendor and state feeds. The
  weights got rebalanced (Accuracy 25→40%, Standards 20→10%) once we had real
  validation data — which is what neutral scoring authority looks like in
  practice.

**What the framework should say:**
- Distributed governance requires a **conformance testing authority** — not a
  centralized data store, but a reference implementation + scoring rubric that
  all participants can validate against.
- Specify **discoverability primitives** (registry, capability advertisement,
  health endpoints) so consumers can find producers without out-of-band coordination.
- Anticipate **maturity gradients** in the architecture itself. Don't assume
  every participant is at v4.2 conformance; provide graceful degradation paths.

**Question I'd ask:** How does the framework handle a state DOT that joins TDI
five years from now starting at "WZDx v3.0 partially compliant"? Does the
architecture admit them or block them?

---

### 2.3 Trust domains and identity federation

**Position:** Identity federation in a multi-state, multi-vendor transportation
data ecosystem is the most underestimated technical challenge in the entire
architecture. Today's state-by-state authentication doesn't scale; full SAML/OIDC
federation is too heavy for many DOTs. The framework needs a middle path.

**Concrete grounding from the platform:**
- The dashboard supports user-account JWT + state-account API keys + admin tokens.
  Three identity domains, each with different lifetimes and trust levels.
  Implementing this was straightforward; coordinating it across 50 DOTs would
  not be.
- For machine-to-machine traffic (state-feed-to-aggregator) I rely on shared
  API keys per feed. This works at the prototype level but doesn't survive
  rotation, revocation, or audit at scale.
- IPAWS — the actual federal alerting system — has a **certificate-based
  identity** (COG IDs + certs) that smaller agencies struggle to operationalize.
  That's an existence proof of why identity-as-a-service matters for TDI.

**What the framework should say:**
- Specify a **trust-domain hierarchy** with three tiers: federal authority (TDI
  Registry), state-level authority (DOT identity provider), and consumer
  identity (operator/vendor/researcher). Cross-domain trust is established by
  signed manifests, not bilateral integrations.
- Mandate **cryptographically signed feed metadata** — not necessarily signed
  payloads (too expensive for high-volume real-time data) but signed manifests
  the consumer can verify against the producer's published key.
- Acknowledge that **most state DOTs lack the IT capacity** to run a SAML IdP.
  Provide a federated-identity-as-a-service pattern (analogous to login.gov for
  citizens) that DOTs can adopt without building.

**Question I'd ask:** What's the proposed identity-binding mechanism between TDI
participants, and does it require state DOTs to operate IdPs?

---

### 2.4 Usability of the proposed design process

**Position:** "Architectural beauty" and "implementer usability" frequently
diverge. The TDI framework will succeed or fail on whether a mid-sized state DOT
with three IT FTEs can become a participating node within ~6 months — not 18.

**Concrete grounding from the platform:**
- I built the entire normalization layer (5 specifications, 50 state feeds,
  per-event compliance grading, OSRM enrichment, IPAWS integration) as a single
  developer working part-time. That's possible because each integration is a
  well-bounded **adapter** with clear input/output contracts.
- What slowed me down was *not* the spec complexity — it was undocumented quirks
  in real feeds (Caltrans's regional dialects, Texas/Oklahoma WZDx field
  inconsistencies, Iowa's geometry format variations). The framework can't fix
  source-data quality, but it can require a **conformance test suite** so these
  drift early instead of in production.
- I'd estimate that 80% of my integration time was "schema drift on the producer
  side." The remaining 20% was the actual mapping logic.

**What the framework should say:**
- Ship a **reference implementation + test harness** with the spec. Without it,
  every implementer rebuilds the same plumbing differently and conformance is
  decorative.
- Specify a **maturity tiers model** (Bronze: WZDx-compliant feed; Silver:
  Bronze + signed manifests; Gold: Silver + identity federation + real-time
  sync). DOTs can advance one tier at a time rather than face a binary join/don't.
- Include a **plain-language onboarding guide** targeted at IT staff at a DOT
  with limited budget, not at architects.

**Question I'd ask:** Is there a "reference participant" implementation planned —
something a state DOT can clone and stand up — or is the framework specification-
only?

---

## 3. Areas of alignment I expect to affirm

Based on the invitation framing, I'm prepared to affirm:

- **Federated > centralized** for transportation data architecture. Centralized
  would never get state DOT buy-in.
- **Standards-based interoperability** (WZDx, TMDD, SAE J2735, CIFS) as the right
  foundation. Real-world experience: it works.
- **Provenance and quality scoring** as core architectural primitives. Operators
  *need* "how much should I trust this record" answered at the platform level.
- **Multi-tier participation** — recognition that not every participant arrives
  at the same maturity level.

## 4. Concerns I plan to raise

- **Identity federation is the silent blocker.** The architecture can be elegant
  on every other axis and fail because state DOTs can't authenticate each
  other's machines reliably.
- **Schema drift is a first-class problem**, not an edge case. The spec needs
  a versioning + deprecation contract or every aggregator becomes a graveyard
  of broken adapters.
- **Liability allocation is policy, not architecture** — but unresolved liability
  questions paralyze adoption. The framework must be explicit about what it
  decides vs. what it defers to legal/policy.
- **No reference implementation = endless interpretation drift.** The spec text
  alone won't produce interoperable systems; the test harness is non-negotiable.
- **OSRM-class enrichment matters for usability.** Raw lat/lng pairs aren't
  enough; consumers need road-snapped geometry, snap-confidence scoring, and
  fallback behaviors. Either TDI specifies enrichment expectations or every
  aggregator reinvents that wheel.

## 5. Architectural vs policy distinction

Per the invitation's explicit framing: **"distinguish architectural questions from
those requiring broader policy consensus."** Where I'd draw the line:

| Topic                    | Architectural | Policy / Legal |
|--------------------------|---------------|----------------|
| Provenance schema        | ✅ Specify     | ❌              |
| Quality scoring rubric   | ✅ Specify     | ❌              |
| Identity binding mechanism | ✅ Specify   | ❌              |
| Conformance test suite   | ✅ Required    | ❌              |
| Liability assignment     | ❌            | ✅ Federal/state law |
| Funding & sustainment    | ❌            | ✅ Pooled-fund / appropriations |
| Mandatory participation  | ❌            | ✅ Federal regulation |
| Data licensing & use     | ❌            | ✅ Each agency's open-data policy |

The architecture should provide **affordances** for the policy decisions
(provenance fields, identity tokens, license metadata) without taking sides on
the legal questions.

## 6. What I want out of the session

In priority order:

1. **Confirm the framework treats provenance as first-class** — not as optional
   metadata that 30% of producers will drop.
2. **Confirm a reference implementation + conformance test suite is in scope**.
   If not, raise it as a blocking gap.
3. **Probe the identity federation strategy** to ensure it's realistic for mid-
   sized state DOTs without dedicated identity teams.
4. **Push for a maturity-tier model** so the architecture admits new participants
   at varying competence levels rather than a binary join/don't gate.
5. **Connect on the schema-drift / versioning contract** because every aggregator
   in the room has lived this and the spec usually doesn't acknowledge it.

If I get clear answers on (1) and (2), the session is a success from my seat.

## 7. Talking points if discussion drifts into specifics

If the discussion gets into the weeds on practical operations, points I'd raise
based on the platform:

- **WZDx adoption gap**: ~45% of states publish WZDx; ~30% of *those* are missing
  required fields routinely. The spec is fine; producer maturity is the bottleneck.
- **Polyline geometry quality**: ~40% of work-zone events arrive as straight-line
  geometries (not road-snapped). I run OSRM enrichment server-side. The framework
  should require either snapped geometry from producers, or specify the
  enrichment contract.
- **Cross-spec semantic gaps**: WZDx has fields TMDD doesn't; SAE J2735 ITIS codes
  don't 1:1 map to CIFS event types. Multi-spec aggregators must adopt a
  superset model + canonical mapping. The framework should publish that mapping
  rather than letting each aggregator invent its own.
- **Real-time vs. batch**: traffic events change every minute; aerial overlays
  change rarely. The architecture must accept hybrid sync patterns; one-size-fits-
  all polling won't work.
- **Closure → parking surge** as an example of cross-domain data joins: the
  platform already correlates closures with truck parking demand within a 50-mi
  radius. This is the kind of derived value the architecture should *enable*
  without prescribing.

## 8. Pre-session prep

- [ ] Confirm RSVP by COB Wed May 6
- [ ] Read the background materials when shared
- [ ] Re-read this brief the morning of May 19
- [ ] Test virtual meeting link 15 min before
- [ ] Have the dashboard open in a browser for reference / quick demo if needed
- [ ] Bring sandbox credentials in case live demo is invited

## 9. Post-session follow-ups

- Note specific questions raised that I committed to answering offline
- Capture any new architectural primitives discussed (record names + intent only,
  per non-attribution rule)
- Identify other participants whose follow-up engagement would be valuable
- Update the platform's `TDI_POLICY_RESPONSE.md` with refinements informed by the
  session

---

*Prepared as a personal participation brief. Non-attribution session — capture
themes and architectural insights for platform planning, not direct quotes.*

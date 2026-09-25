# iNODE logical architecture — rules for getting the drawing right

**Purpose.** Not a defect list against any one draft. These are the rules that, applied to
*any* revision of the iNODE logical architecture, produce a drawing that survives contact with
a member state, a vendor, and a federal reviewer.

Each rule states what it is, the evidence behind it, and a **drawing test** — a question to ask
of the diagram. A rule with no drawing test is an opinion; these all have one.

**Scope note on evidence.** The reference implementation cited throughout is the Corridor
Communicator backend. Its architecture is *not* iNODE's and does not need to be — it is a
single-operator corridor system, not a governed multi-member platform. What transfers is not
its design but its **findings**: where it settled on a rule the hard way, that is evidence
about the problem domain, not about the implementation. Section 10 separates the two
explicitly. Everything cited below is running in production or was measured against live
public feeds.

---

## 1. Rules about what the architecture must name

An architecture drawing is a claim about which functions exist. A function that is not drawn
will not be funded, staffed, or built.

### 1.1 Identity is a layer, not a step inside normalization

Mapping a *schema* is not the same as agreeing what counts as the *same thing* across
refreshes. A drawing that shows "normalize / map to common data models" and stops has not
addressed identity at all.

The exchange must **mint its own key** for every subject and maintain a **monitored mapping**
to each producer's identifier. Monitored, not assumed: the mapping breaks silently and by
design goes unreported by the producer.

> **Evidence.** WZDx requires a road event `id` to be unique within a feed. It says nothing
> testable about that id being opaque or immutable. Measured on one federally-registered state
> feed across 13 snapshots over 18 hours: **six events were re-identified and 39 ids destroyed**
> belonging to zones that never left the feed. The id embedded the event's current
> segmentation, so re-slicing a zone replaced every id naming it. A single-snapshot audit of
> the same feed reports it perfectly clean — the defect is invisible to the check most people
> would run.

**Drawing test.** Point at the box that answers: *when this producer's identifier changes and
the producer does not tell us, what notices?*

### 1.2 Verification is not enrichment — name the independence

"Stream processing → event correlation & enrichment → derived data" is generic ETL vocabulary
that any integrator can claim. It does not say what makes the output trustworthy.

The property that matters is that evidence originates in a system **operationally independent
of the claim being tested** — a different organisation, a different sensor chain, a different
human. Name the independence, not the sensor.

**Drawing test.** For each evidence source, ask: *whose system produced this, and is it the
same one that published the claim?* If the answer is "the same one", it is enrichment.

### 1.3 The return path is an architectural element

A drawing whose every arrow points from source to consumer describes a harvest. The return
path — measurement going back to the people who can act on it — is what distinguishes an
exchange from a very good aggregator, and it is the half that cannot be procured from a
vendor.

> **Evidence.** The return loop is already explicit in the Iowa-led ATTAIN architecture
> ("validated corrections return to inform the state source feeds"; "market-penetration
> observatory — did the driver actually see it?"). It is also already *implemented* in the
> reference system — see §5.

**Drawing test.** Cover the left half of the diagram. Does anything still flow?

### 1.4 Rights brokerage is a function, not a policy footnote

The hard part of sharing vendor data across members is **contractual, not technical**. Vendor
agreements are bilateral and non-transferable. Making one member's procured data lawfully
visible to another is a capability with no substitute; a better pipeline does not produce it.

Demoting this to a line in a cross-cutting "Governance & Policy" bar understates the one
function that procurement audiences will actually respond to.

**Drawing test.** Where on this page is the TETC marketplace requirement satisfied? If the
answer is a footer bar, redraw it.

### 1.5 The catalog is a function, not a bullet

Discovery, lineage, freshness and coverage *across members* is the foundation the tool-building
surface stands on, and the only place cross-member data quality can be measured — no member
can run that comparison on itself.

**Drawing test.** If a member asks "what data exists across the pool and how fresh is it",
which box answers?

---

## 2. Rules about semantics — how the platform is allowed to behave

These are governance properties. They belong on the architecture page because they determine
whether members will participate.

### 2.1 Elevate, never invalidate

No member's record is ever marked false. Elevation is strictly additive, so participating can
only improve a member's position.

This is not politeness. It is what makes adjudication survivable inside a *governed* exchange:
it pre-answers the first question a member will ask — *by what authority do you mark my work
zone wrong?* Nothing is marked wrong.

### 2.2 Absence of evidence is published with its reason

Positive-only is neutral per record and stops being neutral in aggregate. If 40% of one state's
zones elevate and 5% of another's do, that is a ranking whether or not any record was
invalidated — and members will read it as one.

Every un-elevated record must carry *why*: no camera in range, no device present, geometry
already sound, source unreachable. "Not elevated" must never be silently readable as "poor".

### 2.3 Unevaluable must never render as clean

A thing that could not be assessed must produce a result **visibly distinct** from a thing that
was assessed and found sound. This is the single most repeated failure in this domain.

> **Evidence, three independent instances.** (1) A conformance report emitting
> `analysis_status: complete` for an input it could not read. (2) A federal registry listing a
> state feed as `active: True` while that endpoint returns **HTTP 200 with an HTML error page** —
> zero road events, and any status-code health check calls it healthy. (3) A stability checker
> that found zero identifiers in a feed, exited zero, and read as a pass.

**Drawing test.** Ask of every quality or status output: *what does this say when the check
could not run?* Three states minimum — pass, fail, **not evaluated** — and the third must never
be rendered as the first.

### 2.4 Never synthesize content; loud placeholders beat plausible guesses

Normalize *structure*; never manufacture an *observation*. Worker presence, restrictions, lane
counts, speed limits, organisation names, `update_date` — these are facts about the physical
world or about real organisations. An absent one gets a placeholder that cannot be mistaken for
data.

> The failure mode to design against is a normalized feed that *looks* complete because the gaps
> were filled with invention. It is strictly worse than the non-conforming feed it replaced,
> because the defects are now invisible.

### 2.5 Lossless normalization

Every migrated value is retained. Normalization destroys nothing; a consumer can always recover
what the publisher actually said.

### 2.6 Sticky accumulation, with exactly one demotable source

Corroboration accumulates and is never demoted — **except** from a source that can genuinely
observe absence. Most sources can only confirm presence; only one kind can see that a zone is
finished.

> **Evidence.** In the reference system, device, sign and probe corroboration are positive-only
> and sticky. Camera is deliberately excluded from that ledger and re-checked daily, because a
> camera can *see* that the traffic control is gone — it is the only affirmative "it's over"
> signal in the stack.

**Corollary, and it is a real trap:** *never demoted* plus an *unstable key* manufactures
ghosts. See §3.3.

### 2.7 Idempotence

Running any normalization, elevation or repair twice changes nothing the second time.

---

## 3. Rules about identity and lifecycle

### 3.1 Mint, map, monitor

Mint the exchange's own key. Map it to producer identifiers. **Monitor the mapping continuously** —
it is the component most likely to fail silently, and its failure is invisible in any
single-snapshot view.

### 3.2 Publish lifecycle transitions, not only states

`created · updated · superseded_by · ended`. A zone that is re-segmented, split, merged or
re-issued must produce a **legible event**, not a silent disappearance and a set of strangers.

Without `superseded_by`, the information that a subject changed identity exists only as the
absence of identifiers that used to be there — which is why it took 13 snapshots to detect.

### 3.3 Never-demoted + unstable key = ghosts. Garbage-collect against presence.

When accumulated evidence is keyed on an identifier that can die, and nothing removes evidence
when its identifier leaves the feed, each re-identification produces **two** faults at once:

1. Accumulated evidence strands on a dead identifier as a *validated record with no
   corresponding event*.
2. The same physical subject returns under new identifiers carrying **nothing**, and reads as
   brand new and unverified.

Neither is signalled. An exchange keying on producer ids inherits both, multiplied by every
member.

> **Evidence.** In the reference system the validation ledger keys on `event_id`, is never
> demoted, and nothing deletes a row when its id leaves the feed — rows expire only on a
> 180-day prune. Notably, the *camera* ledger does garbage-collect against current events; the
> asymmetry was unintentional and is exactly the bug class to design out.

**Drawing test.** *What removes an assertion when the thing it was about stops existing?*

### 3.4 Identity stability is a standing measurement, not a one-time audit

It requires two things no member can supply alone: **a time series** and **cross-member
comparison**. That makes it a natural exchange-level service and a concrete answer to "what
does the exchange do besides move bytes".

---

## 4. Rules about evidence and repair

### 4.1 Independence is the property; the sensor is an implementation detail

Design the architecture around *classes of independent witness*, not around named vendors or
devices. The device category, the visual category, the human-operator category, the
probe/commercial category. Vendors change; the independence property is what the confidence
model rests on.

### 4.2 Evidence carries provenance, and inference is distinguishable from observation

Every elevated claim states what saw it, when, and how. A consumer must be able to tell a live
observation from an accumulated one, and an observation from an inference.

> **Evidence.** Inherited corroboration in the reference system is stamped
> `subject_inherited` rather than silently promoted, precisely so a consumer can tell the
> difference.

### 4.3 Repair is a proposal subject to acceptance gates — and "unchanged" is a valid outcome

Geometry correction runs a fixed source cascade (the state's own LRS first, national LRS
second, a router last). Each tier's output is a **proposal**, not an answer, and passes
acceptance gates before it is accepted — length plausibility, endpoint proximity, bearing
agreement with the stated direction.

If every tier fails every gate, **emit the event unchanged**.

> A wrong polyline is worse than an honest straight line: the straight line advertises that it
> is an approximation, and the wrong polyline does not.

### 4.4 Attribute every defect to the adapter that produced it

An aggregated feed's defects cluster **by adapter, not by feature**. Until that is shown, a
finding reads as "the feed is bad", which nobody can act on. Grouped by source, the same data
reads as "these three adapters have these three specific bugs" — which is a work plan.

If a defect really is spread evenly across every source, that is itself the finding: the fault
is in assembly, not upstream.

Always carry **sample record ids, one per defect class**, so the recipient can reproduce rather
than take your word for it.

---

## 5. Rules about the return path

The return path is not "we'll publish a quality dashboard". It is a closed loop with five
stages, and the reference implementation already runs it.

### 5.1 Detect → diagnose → route → correct → re-verify, with round-trip identity

> **Evidence — this exists and works.** Deviation findings are root-caused into an actionable
> exception queue. Each exception carries: its **kind**, a **reason** in plain language, the one
> known **fix**, a **priority**, and a **deep link that opens that state's own authoring tool
> pre-filled with the flagged record**. The correction carries the finding's id back
> (`x_resolves_exception`), so a submitted fix is tied to the finding it answers.

**Drawing test.** *Can a state act on a finding without leaving the finding?* If the output is
a report they must then go and do something about elsewhere, the loop is not closed.

### 5.2 A finding must carry its remedy

Five exception kinds, each with a single stated remedy, is worth more than a hundred metrics.
For illustration, the working taxonomy:

| Kind | What it means | The one fix |
|---|---|---|
| `stale-active` | End date passed, still active in your feed — a ghost zone nav already dropped | Close it, or extend if work is genuinely ongoing |
| `bad-geometry` | No usable location, so nav cannot place it | Add or repair the geometry |
| `not-reaching` | You publish it, no nav source shows it — not propagating | Confirm the feed carries it and is being ingested |
| `timing-mismatch` | Reaches nav, but the windows disagree | Correct the end date to match reality |
| `missing-from-feed` | Nav shows a zone your feed does not — unreported closure | If it is yours, author it (opens pre-filled) |

### 5.3 Prioritise by harm, not by count

A misleading record outranks a missing one. A ghost zone on an interstate outranks a geometry
defect on a local road. The queue is sorted so a steward works the harmful ones first, not the
numerous ones.

### 5.4 Measure delivery, not only publication

Publication is not arrival. The observatory question — *did the driver actually see it?* — is a
distinct measurement from *did we publish it*, and it is the one that tells a member whether
their investment reached anyone.

---

## 6. Rules about cost and operational safety

These read as implementation detail. They are architecture, because a platform that cannot
bound its costs or degrade honestly will not be trusted with member data.

### 6.1 Every external call has a budget, a circuit breaker, and a cache

Not one of the three — all three. A self-imposed ceiling *below* the provider's, enforced in
our code, so the guardrail survives the provider changing their terms.

> **Evidence.** The probe integration enforces its own daily request budget beneath the
> provider's free-tier limit and stops early, independently of the provider's own cap.

### 6.2 Lazy over scheduled; on-demand over batch

Work performed because someone asked for it is bounded by demand. Work performed on a timer is
bounded by nothing, and runs at 3am for nobody.

> **Evidence.** Across the reference system: camera inventories fetched lazily on first use,
> vision inference invoked per request and never in a loop, partner feeds filled on demand when
> a layer is opened ("nothing here polls"), validation monitoring running *alongside* the
> existing refresh rather than on its own timer. A per-subject ledger then makes cost
> independent of how often anything is called: only *due* work ever runs, and never more than
> its cap.

### 6.3 Degradation is explicit and typed

A source that is unavailable reports *unavailable* — not empty, not zero, not a silent pass.
Distinguish: credentials absent, provider in cooldown, provider unreachable, response
unparseable. Each is a different operational response.

> **Evidence.** The freight adapter ships uncredentialed on purpose and returns
> `{available: false, reason}` rather than throwing, so the rest of the stack runs unchanged
> and it begins working the moment a token exists.

### 6.4 Durable state belongs in durable storage

Anything that must survive a restart — accumulated evidence, check ledgers, health trends —
persists. Application disk is ephemeral on managed platforms, and a "sticky" ledger that
evaporates on deploy is not sticky.

### 6.5 Feed health is content-level, not status-code

A source that answers 200 with an error page is not healthy. Health means *parseable, in the
expected shape, carrying records*.

### 6.6 Trust the source of record over the convenient mirror

Where an authoritative source exists, use it — a mirror puts someone else's uptime and parsing
between you and the truth, which is a poor foundation for anything used as evidence. Keep the
mirror as a declared fallback, labelled as one.

### 6.7 Where nothing is published, observe rather than infer

Some data does not exist publicly at any price. The honest response is to *observe* it with
instruments you control, or to say plainly that it is unavailable — not to infer it and present
the inference as observation.

> **Evidence.** Freight rail publishes nothing openly; every public "train" feed is passenger
> only. The reference system observes crossings with cameras and trackside sightings rather
> than inferring freight positions it cannot see.

### 6.8 Freshness is a tier, not a boolean

A source whose observations can be hours or days old must expose that age, and stale data must
be structurally prevented from reaching an operational surface.

> **Evidence.** A commercial sighting network can retain an "active" trip whose last observation
> is **five days old**. The adapter tiers every sighting — current, marked, never displayed
> operationally — rather than trusting the provider's own notion of "active".

---

## 7. Rules about federation

### 7.1 Authorship never transfers, and a member can leave with its data

Including for a feed the exchange *hosts* on a member's behalf: the issuing organisation stays
the author. This must be visible in the drawing, not asserted in a bullet.

### 7.2 Bring your own data **and** your own procurement

Members keep their own vendor relationships and procurement mechanisms. The exchange brokers
rights; it does not become the buyer.

### 7.3 One adapter per publisher, and the adapter owns its quirks

Per-source adapters are what make §4.4 possible. Every publisher's peculiarity is absorbed in
exactly one place and is attributable.

> **Evidence, at the scale this actually reaches:** 254 distinct endpoints across 43 work-zone
> feeds, 37 states, plus cameras, devices, signs, probe, parking, rail, plow, crash and LRS
> services. This is not a hypothetical integration burden.

### 7.4 Tools distributed to members connect to original sources, not back to us

A tool a state takes away should depend on that state's own public services and nothing of
ours. It works offline, outlives our uptime, and creates no dependency a member has to
justify.

---

## 8. Rules about drawing the thing

### 8.1 Draw the architecture, not the org chart

If two boxes have the same functions because there are two funding programmes — two gateways,
two monitoring stacks — a reviewer will ask which one they integrate with. If the answer is
"one platform, two phases", draw one platform.

### 8.2 Draw what is permanent, not what is currently funded

A phase arrow that reads *research → transition → operational* implies the first thing ends. If
the catalog, the marketplace and the governed membership live there permanently, that framing
will cost you: members do not build procurement around something they read as a pilot.

### 8.3 Every box must answer "what breaks if this is missing"

If the answer is "nothing observable", it is a label, not a component.

### 8.4 Label flows by what they carry, not by direction

"Data flow" tells a reader nothing. *Identifiers and records in*, *evidence and corrections
back*, *rights and agreements laterally* — each is a different thing with different governance.

### 8.5 Anything asserted on the page should be measurable

"No loss of state data control" is an assertion. *Authorship retained, exit with your data,
procurement stays yours* are mechanisms. Prefer the mechanism; a reviewer can test it.

---

## 9. The review process

Run this against every revision. It takes ten minutes and catches the recurring failures.

1. **Cover the left half.** Does anything still flow? *(§1.3)*
2. **Name the identity box.** What notices when a producer's id changes? *(§1.1, §3.1)*
3. **Ask the un-evaluable question** of every quality output. Three states, not two. *(§2.3)*
4. **Find the authority answer.** Where does the page pre-empt *by what authority do you mark my
   data wrong?* *(§2.1)*
5. **Find the rights mechanism.** Not the policy bar — the mechanism. *(§1.4)*
6. **Trace one correction end to end.** Detect → diagnose → route → correct → re-verify. Where
   does it break? *(§5.1)*
7. **Count duplicate functions.** Two of anything → is that architecture or org chart? *(§8.1)*
8. **Check every box for a failure mode.** What breaks if it is missing? *(§8.3)*
9. **Check the phase framing** against what is permanent. *(§8.2)*
10. **Pick three assertions at random** and ask how a member would verify them. *(§8.5)*

---

## 10. What transfers from the reference implementation, and what does not

The reference backend is functional but architecturally unlike iNODE. Being explicit about
which is which keeps the evidence usable and stops the wrong things being copied.

### Transfers — these are findings about the problem, not the implementation

| Finding | Implication for iNODE |
|---|---|
| Producer identifiers change without notice, invisibly to single-snapshot checks | Identity must be minted and the mapping monitored *(§1.1, §3)* |
| Never-demoted evidence on an unstable key manufactures ghosts | Evidence needs garbage collection against presence *(§3.3)* |
| Unevaluable silently reads as clean, in at least three independent forms | Three-state reporting everywhere *(§2.3)* |
| Defects cluster by adapter, not by record | Per-source attribution is the reporting unit *(§4.4)* |
| A wrong repair is worse than an honest approximation | Acceptance gates, and "unchanged" as a valid outcome *(§4.3)* |
| Only one class of evidence can observe absence | Exactly one demotable source *(§2.6)* |
| A findings report nobody can act on changes nothing | Findings carry remedy + route to action *(§5)* |
| Feeds answer 200 with error pages | Content-level health *(§6.5)* |

### Does not transfer — iNODE's problems that the reference system does not have

| Reference system | iNODE |
|---|---|
| Single operator; can adjudicate freely | Governed membership — which is *why* elevate-never-invalidate matters far more there |
| No membership, authentication or subscriber management | Core functions that must be built |
| No rights brokerage — consumes what is already public | The scarcest function it offers |
| Costs bounded by one operator's budget and free tiers | Bounded by federal and member agreements |
| Pulls from public endpoints | Push, subscription and agreement-gated access |
| Its own identity choices affect only itself | Its identity choices propagate to every member |

**The consequence worth stating plainly:** every rule in §2 is *more* binding on iNODE than on
a single-operator system, not less. A single operator that gets adjudication semantics wrong
annoys its own users. A governed exchange that gets them wrong loses members.

---

*Companion to the logical architecture boards. Evidence in this document is drawn from
production behaviour and from measurements against live public feeds, September 2026.*

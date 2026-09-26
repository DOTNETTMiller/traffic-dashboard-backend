# Prompt for revising the iNODE / Corridor Connect logical architecture infographic

*Paste everything below the line into ChatGPT alongside the current image.*

---

You produced the attached logical architecture infographic for iNODE / Corridor Connect. It is
close, and most of it should not change. Below is a prioritised revision brief: what to keep,
what to fix, what to add, and what to deliberately leave out.

Read the whole brief before changing anything — several items interact, and item 1 conflicts
with something currently on the page.

## Audience and purpose

State DOT leadership, MITRE, FHWA reviewers, pooled-fund member states, and vendors. It must
survive being read by a member state who will ask "what does this platform assert about my
data, and what can it do to me?" Every element should be defensible to that reader.

## Keep these exactly as they are

Do not weaken, shorten, or reword these. They are the hardest-won parts of the page:

- **Three-state reporting**: PASS / FAIL / NOT EVALUATED, with "check result, not a verdict on
  member truth" and "never disguise an unrun check as clean."
- **"No evidence is not a fail"**, with the three reasons (no coverage, source unreachable, no
  elevation needed).
- **The five-stage return path**, with stage 4 marked MEMBER-OWNED ACTION, "same finding ID:
  close or repeat", and the worked F-104 example. The example is doing more work than any
  other single element — keep it verbatim.
- **"Independence is tested, not assumed from sensor type."**
- **"Enrichment is separate — adds context and inference. Does not prove the claim."**
- **"Add evidence; never mark member records false"** and **"Explain every non-elevation."**
- **"A successful HTTP response is not enough."**
- **Lifecycle**: created / updated / superseded_by / ended, plus "monitor silent ID changes."
- **"Member remains author even when exchange-hosted"**, "Take your data with you",
  "Authorship retained | Procurement stays with members | Exit with data."
- **"All fail? Unchanged"** on geometry proposals, and the member-LRS-first cascade order.
- The legend that labels flows by what they carry rather than by direction.

## MUST FIX — in this order

Items 1 and 2 are corrections. Items 3 and 4 are the larger problem: **the page under-represents
what actually flows through the platform**, and a member reading it will undervalue membership.

### 1. Resolve the contradiction in "Compare quality across members"

The Cross-member catalog box currently offers "Compare quality across members." That is in
direct tension with "never mark member records false" and "no evidence is not a fail" elsewhere
on the page.

Per-record neutrality is handled well. Neutrality leaks in the **aggregate**: if one member's
records elevate at 40% and another's at 5%, that is a ranking, and members will read it as one
even though no individual record was invalidated. A member whose corridor has fewer cameras
will appear worse at data quality when the real difference is instrumentation coverage.

**Change the line to make the comparison peer-normalised, and say so on the page.** Suggested
replacement text for that bullet:

> Compare coverage and completeness **within peer groups**, normalised for what each member's
> infrastructure can evidence. Rank against comparable members, never against the pool.

And add one short qualifier line beneath the catalog box:

> **A member is never ranked on a gap in coverage.** Comparison controls for network size,
> instrumentation and feed maturity.

This is not a hypothetical concern and the mitigation is not invented: the working reference
implementation computes national, regional **and peer-group** rankings, and peer grouping is
precisely the control that makes benchmarking defensible between governments.

### 2. Restore the build and automation surface — it was dropped

The current page ends at "Deliver → rights-gated APIs" and "Use across corridors → consumer
categories." That describes a platform that hands out data. The platform's members also
**build on it**, and that is a materially different commitment which must appear.

Add a component in or beside Deliver, titled something like **"Build on the catalog"**:

> Members build automation on the catalog, not only dashboards: emergency-alert authoring,
> dynamic detour activation, message-sign templates, request builders.
>
> **Automation carries guardrails.** Templates are approved before use, activations are
> recorded, and rules that fire automatically are reviewable after the fact.
>
> Hosting authoritative SOPs is a heavier commitment than hosting data — it makes the exchange
> a normative body, not only infrastructure.

Grounding: the reference implementation runs an emergency-alert generation subsystem, a
pre-planned diversion-route registry that auto-checks against live events and requires an
explicit activation step, and a message-sign template system with a formal approval workflow
before a template may be used.

### 3. The page shows one kind of data. The platform carries many.

As drawn, a reader concludes this is a work-zone data exchange. It is a **corridor data**
exchange, and every consumer group on the right depends on that being true. This is the change
that most affects how a member values membership, so it belongs in the spine, not in a caption.

**3a — Replace the source list with data domains.** In "Publish + author", show a compact grid
rather than a sentence. The domains the platform actually carries:

> work zones and closures · incidents · **truck parking (real-time availability and forecast)** ·
> weather and road conditions · **winter operations and plow activity** · **rail movements and
> grade-crossing blockage** · **bridge and structure clearance** · ITS asset health ·
> **crash history** · special events and demand surge · freight and commercial vehicle ·
> border wait times

**3b — Draw clearance as a two-way loop, not a data type.** The interesting thing is not that
the platform holds clearance data; it is that clearance and work zones inform each other:

> **Structure clearance ↔ work zones.** Clearance informs routing decisions made on work-zone
> data — which structures actually restrict a route, and therefore which detours are legal for a
> tall or heavy load. And the reverse: a work zone on or under a structure is a **reason to
> re-check that clearance**, because the work may have changed it. Resurfacing raises a deck;
> staged construction narrows or lowers what is passable.
>
> Today clearance is a periodic inventory. Driving re-checks from live event data is the path to
> **clearance that reflects the road as it is now** rather than as it was last inspected.

Draw this as a small bidirectional pair between the work-zone domain and clearance, not as a
bullet. The loop is the point — a static inventory is not worth a box on this page, and a
self-refreshing one is.

**3c — Show rail as a trust problem the architecture solves, not as another feed.**

The consumer is **emergency services** — a blocked crossing is a response-time problem, and
nobody currently tells a dispatcher that the route is about to be cut. The obstacle is that
**freight railroads are reluctant to share operational data**, and reasonably so: train
positions are commercially and operationally sensitive.

The architecture answers that directly, and the page should say so:

> **Grade crossings — the output is crossing state, never train position.** Movements are
> snapped to track and walked forward along it, and what leaves the platform is
> "**this crossing is closed, or closing shortly, for about this long**". A railroad's
> operational data never leaves its own control.
>
> Passenger rail, which does publish openly, is where this pattern is **demonstrated** —
> proving the privacy-preserving shape works end to end before asking a freight railroad to
> trust it.

This is one of the strongest arguments on the page: it shows the exchange can deliver a public
safety outcome **without** requiring a reluctant private party to expose what it does not want
exposed. Draw the boundary explicitly — what enters, what never leaves.

### 4. Correct what the platform delivers — and be explicit about what it does *not* do

Two problems. Delivery is drawn as one channel, and the previous brief wrongly implied the
platform broadcasts connected-vehicle messages. **It does not, and it must not appear to.**

**4a — This platform produces feeds, not broadcasts. Say so on the page.**

The platform's product is a **better source feed in existing FHWA formats** — verified,
geometrically corrected, identity-stable, ITIS-coded work-zone and corridor data in
**CWZ 1.0 / WZDx v4.2**, with **ngTMDD** where a member needs it. It does not mint SAE J2735
messages, does not operate roadside units, and does not distribute to vehicles.

Add a short, prominent panel — this is a commercial-positioning statement, not a caveat:

> **What this is not.** Not a message broadcaster. Not a roadside-unit operator. Not a
> replacement for connected-vehicle distribution.
>
> **The platform makes existing distribution work better.** SDX and commercial distributors
> already reach vehicles; what they have never had is input that is verified, geometrically
> correct, identity-stable and current. Better source data makes their product more effective,
> not less necessary.

Draw the connected-vehicle world as a **downstream partner receiving the feed**, with the
handoff labelled — not as a channel the platform operates. Anyone whose business is
distribution should be able to look at this page and see their role intact and strengthened.

**4b — Then show the channels the platform genuinely does operate:**

> **APIs and subscriptions** — query, subscribe, replay history, rights-gated and rate-limited.
> **Navigation** — WZDx and CIFS into consumer navigation and mapping partners.
> **Roadside signs** — from approved templates, with recorded activations (see 4c).
> **Public alerting** — IPAWS / WEA for qualifying events, with CAP formatting, geofence
> targeting and an audit record of who sent what.
>
> **Feeds to distributors** — CWZ 1.0 / WZDx / ngTMDD to SDX and other distribution partners,
> who convert and broadcast on their own terms.

Public alerting especially must appear. A platform that can push a Wireless Emergency Alert is
making a far heavier claim on member trust than one that publishes a feed, and the governance
questions a reviewer asks about it differ in kind.

**4c — Geofenced sign activation from moving assets. This is genuinely novel — give it a box.**

Sign activation today is event-driven: an event matches a rule, a template fills, the nearest
sign lights. The distinctive move is to drive activation from a **moving asset's own position**:

> **Geofence activation from AVL.** A tracked asset — slow-moving equipment, a maintenance
> vehicle, a work convoy — crossing a geofence activates the appropriate sign automatically,
> from an approved template, with the activation recorded.
>
> This turns any AVL or telematics stream into driver-facing warning at scale, without an
> operator watching a map. The pattern is **extensible to any fleet that already reports
> position**, and the reference implementation of the feed side is being **released openly** so
> others adopt the pattern rather than rebuild it — which is how it reaches scale beyond the
> members of this exchange.

Say plainly on the page that this is not common practice elsewhere. It is one of the few
elements here that is genuinely new rather than better-executed, and a reviewer should not have
to infer that.

### 5. Rename stage 2 from "Preserve" to "Identify"

Identity is the single most important thing this revision added, and "Preserve" reads as
archival storage, which buries it. The box already does the right work ("normalize + identify",
"mint exchange keys; map producer IDs", "monitor silent ID changes") — the label just
undersells it.

Rename the stage **Identify**, keep the subtitle "Normalize + preserve originals", and keep
every existing bullet.

### 6. Give geometry its own box next to Verify — it is a product, not a repair utility

"Bounded cost + safe repair" couples two unrelated disciplines because both happen to be
operational. Split them, and promote geometry: it is one of the most consequential things the
platform produces, and burying it in a cost box badly undersells it.

- **Bounded cost** stays in the cross-cutting row: own budget, circuit breaker, cache; only
  requested or due work; repeat safely without duplicating changes.
- **Geometry** becomes its own component beside **Verify**:

> **Corrected geometry.** A closure arrives as two points and a straight line between them.
> It leaves as road-following linework snapped to the centreline, covering the **full length of
> the closure**, and as **both carriageways when both are closed** rather than one line standing
> in for two.
>
> Cascade: the member's own LRS first, national LRS second, a router last. Every tier's output
> is a proposal that must clear length, endpoint and bearing gates. **All fail? Emit unchanged** —
> a wrong polyline is worse than an honest straight line, because the straight line advertises
> that it is an approximation.

Then state what it is *for*, because that is the part a reviewer will care about:

> Correct geometry is what makes the rest usable: it decides which structures and restrictions a
> zone actually interacts with, it is what a validation check is run against, and it is what
> **mapping and navigation partners need to place a closure correctly and to suggest a sensible
> alternative route**. A zone drawn as a straight line across a river routes traffic into it.

## SHOULD FIX

### 7. Rights brokerage needs agreement lifecycle

The box currently says permissions are brokered. Agreements also **expire**, and an expired
agreement that nobody noticed is a compliance incident, not a data problem. Add one line:

> Track agreement scope and **expiry**; warn before permissions lapse. A lapsed agreement
> withdraws access automatically rather than silently continuing.

Grounding: the reference implementation maintains a contract registry with expiration alerting.

### 8. Show how a source or member gets in

The page shows members publishing but never shows **onboarding**. That is a governance function
and reviewers will ask about it. Add a small element on the member-owned side:

> **Propose a source.** Members and partners submit a feed; it is tested before acceptance and
> carries its test result. Coverage gaps are visible and members can signal which matter most.

Grounding: the reference implementation has feed submission with stored test results, a
contribution intake with pending/approved status, and gap prioritisation voting.

### 9. Add the second measurement loop

"Delivery observatory — did it actually reach the consumer or driver?" answers *did it arrive*.
It does not answer *were we right*. Those are different loops and both belong. Add beside the
observatory:

> **Accuracy of derived products.** Predictions and derived values are scored against
> ground-truth observation and the error is retained. Published confidence is earned, not
> asserted.

Grounding: the reference implementation stores ground-truth observations and prediction-accuracy
history for its derived products, and calibrates against them.

### 10. Fix "Independent witnesses" sitting in the member-owned column

Devices and cameras are typically member-owned; **commercial probe data is not** — it is vendor
data the member procured. The column header implies ownership of all four and a vendor will
notice.

Either re-title the column **"Member-owned and member-procured"**, or move the commercial/probe
line out of that box and attach it to "Own procurement." The first is simpler.

### 11. Stop the phase bar fighting its own correction

"ONE SHARED PLATFORM — permanent across every phase" is the right fix and should stay. But the
headline arrow still reads left-to-right as *iNODE → hardened → Corridor Connect*, so a skimmer
concludes iNODE is stage one of three and will sunset. Members do not build procurement around
something they read as a pilot.

Redraw the phase bar as a **timeline running beneath or behind the platform**, with the platform
spanning its full width — so the phases are clearly *when things happen*, not *what replaces
what*.

## IF SPACE ALLOWS

### 12. Deepen Verify — say what the witnesses are and how evidence behaves over time

"Independent evidence" is right but abstract. Two additions, both short:

**12a — Name the witness classes**, so a reader can judge independence for themselves:

> A device physically on the zone · a visual observation · a human operator writing on a
> different system · a commercial probe network. Evidence from a different operational chain
> than the claim.

**12b — State how evidence behaves over time.** This is a governance property and currently
absent:

> Presence evidence **accumulates and is never demoted**, because most witnesses can confirm
> presence and none can prove absence. **Exactly one class may demote** — the one that can
> actually observe a zone is finished. A live observation is distinguishable from an
> accumulated one.

### 13. Name the standards the platform is accountable to, and its place in the ITS architecture

Two things a federal reviewer will look for and cannot currently find.

**13a — Standards.** Put a compact strip in the shared foundation row:

> **Produces:** WZDx v4.x / **CWZ 1.0** · **ngTMDD** where a member needs it · **ITIS** coding ·
> **CAP** for public alerting.
> **Consumes and scores against:** WZDx, TMDD / ngTMDD, **NTCIP 1203/1218** (signs and field
> devices), **buildingSMART IFC 4.3 / IDS** (infrastructure models).
> **Codes to, but does not emit:** **SAE J2735** vocabulary — ITIS codes carry through so a
> downstream distributor can build messages without re-deriving them.
>
> Conformance is *scored*, not claimed — per source, against the published rubric.

Keep the produces / consumes / codes-to distinction visible. It is exactly what prevents a
distribution partner reading this page as an encroachment.

**13b — Position it against the national ITS architecture.** One line under the title, where the
positioning statement belongs:

> iNODE makes the **enterprise view of the national ITS architecture operational**. ARC-IT has
> described inter-agency information exchange agreements for years; this is the machinery that
> executes them.

That sentence does more for a federal audience than any box on the page. It says iNODE is not a
new institution competing with the architecture — it is the missing implementation of one.

### 14. Design-time data, not only operational data (if space)

The platform also carries **infrastructure models**, and this is a genuinely different data
class the diagram has no room for at all: not what the road is doing now, but what was built and
what a future asset must carry.

> **Models and asset requirements.** Infrastructure models are checked for the properties an
> operational system will later need — mapping model elements to ITS applications, V2X use cases
> and automated-vehicle requirements — and the gaps are exported as a machine-checkable
> **buildingSMART IDS** specification.
>
> The exchange can tell a designer what to model so the asset is usable in operations after it
> is built.

If nothing else fits, this is the one to leave out — but it is the strongest single argument
that the platform spans the asset lifecycle rather than the traffic day.

### 15. Name the proving ground

Nothing shows where a verification method is validated before the exchange runs it at member
scale. One line near Verify:

> Methods are proven against live corridor data — where they can fail cheaply and be measured —
> before the exchange operationalises them across members.

## Do NOT add

- Vendor or product names of any kind. Standards names (WZDx, J2735, TMDD, IFC/IDS, CAP,
  NTCIP) are not product names — those belong on the page.
- New technology choices (clouds, databases, message brokers). This is a logical architecture.
- More than the items above. The page is already dense; if something must give to fit items 1
  and 2, cut detail from the bottom utility row rather than dropping a named component.
- Any implication that the exchange authors, owns, corrects or invalidates member data. The
  exchange **coordinates**; the member **edits**; the exchange **rechecks**.
- **Any implication that the platform broadcasts to vehicles or replaces a distribution
  provider.** No roadside units, no J2735 message emission, no vehicle-facing delivery. This is
  the single most commercially sensitive line on the page: distribution partners must read it
  and see their role strengthened, not threatened. If a box could be misread that way, relabel
  it or draw the handoff.

## Output requirements

- Same visual system: same palette, typography, iconography and density. This is a revision, not
  a redesign.
- Landscape, legible at 100% on a laptop screen and readable when printed at A3.
- Minimum body text 11px equivalent; no text below 4.5:1 contrast against its background.
- Keep the legend, and add any new flow type to it rather than introducing an unlabelled line.
- Check that "Enrichment is separate" renders without a strikethrough on the first word — the
  current version appears to have one, which inverts the meaning of a line whose entire job is
  to draw a distinction.

## One check before you finish

Cover the right-hand third of the page. A member state should still be able to read what the
platform asserts about their data, what it will never do, and how they get a finding corrected.
If any of those three is only legible from the part you covered, move it left.

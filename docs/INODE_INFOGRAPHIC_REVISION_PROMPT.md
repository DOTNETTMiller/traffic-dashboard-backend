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

### 3. Rename stage 2 from "Preserve" to "Identify"

Identity is the single most important thing this revision added, and "Preserve" reads as
archival storage, which buries it. The box already does the right work ("normalize + identify",
"mint exchange keys; map producer IDs", "monitor silent ID changes") — the label just
undersells it.

Rename the stage **Identify**, keep the subtitle "Normalize + preserve originals", and keep
every existing bullet.

### 4. Move geometry repair out of "Bounded cost + safe repair"

That box couples two unrelated disciplines because both happen to be operational. Split it:

- **Bounded cost** stays in the cross-cutting row: own budget, circuit breaker, cache; only
  requested or due work; repeat safely without duplicating changes.
- **Safe repair** — the LRS cascade, the length/endpoint/bearing gates, and "all fail?
  unchanged" — moves next to **Verify**, because repair is something done *to a record*, not a
  platform-wide utility.

Keep every word of the repair content; only its placement changes.

## SHOULD FIX

### 5. Rights brokerage needs agreement lifecycle

The box currently says permissions are brokered. Agreements also **expire**, and an expired
agreement that nobody noticed is a compliance incident, not a data problem. Add one line:

> Track agreement scope and **expiry**; warn before permissions lapse. A lapsed agreement
> withdraws access automatically rather than silently continuing.

Grounding: the reference implementation maintains a contract registry with expiration alerting.

### 6. Show how a source or member gets in

The page shows members publishing but never shows **onboarding**. That is a governance function
and reviewers will ask about it. Add a small element on the member-owned side:

> **Propose a source.** Members and partners submit a feed; it is tested before acceptance and
> carries its test result. Coverage gaps are visible and members can signal which matter most.

Grounding: the reference implementation has feed submission with stored test results, a
contribution intake with pending/approved status, and gap prioritisation voting.

### 7. Add the second measurement loop

"Delivery observatory — did it actually reach the consumer or driver?" answers *did it arrive*.
It does not answer *were we right*. Those are different loops and both belong. Add beside the
observatory:

> **Accuracy of derived products.** Predictions and derived values are scored against
> ground-truth observation and the error is retained. Published confidence is earned, not
> asserted.

Grounding: the reference implementation stores ground-truth observations and prediction-accuracy
history for its derived products, and calibrates against them.

### 8. Fix "Independent witnesses" sitting in the member-owned column

Devices and cameras are typically member-owned; **commercial probe data is not** — it is vendor
data the member procured. The column header implies ownership of all four and a vendor will
notice.

Either re-title the column **"Member-owned and member-procured"**, or move the commercial/probe
line out of that box and attach it to "Own procurement." The first is simpler.

### 9. Stop the phase bar fighting its own correction

"ONE SHARED PLATFORM — permanent across every phase" is the right fix and should stay. But the
headline arrow still reads left-to-right as *iNODE → hardened → Corridor Connect*, so a skimmer
concludes iNODE is stage one of three and will sunset. Members do not build procurement around
something they read as a pilot.

Redraw the phase bar as a **timeline running beneath or behind the platform**, with the platform
spanning its full width — so the phases are clearly *when things happen*, not *what replaces
what*.

## IF SPACE ALLOWS

### 10. Show the data domains, not just work zones

The page reads as a work-zone exchange. The corridor problem is broader, and the reference
implementation spans work zones, incidents, truck parking, weather, winter operations, rail and
grade crossings, bridge clearance, asset health, crash history and connected-vehicle messaging.

In the "Publish + author" box, replace the current list with a compact grid of **domains**, so a
reader sees this is corridor data, not one feed type.

### 11. Name the proving ground

Nothing shows where a verification method is validated before the exchange runs it at member
scale. One line near Verify:

> Methods are proven against live corridor data — where they can fail cheaply and be measured —
> before the exchange operationalises them across members.

## Do NOT add

- Vendor or product names of any kind.
- New technology choices (clouds, databases, message brokers). This is a logical architecture.
- More than the items above. The page is already dense; if something must give to fit items 1
  and 2, cut detail from the bottom utility row rather than dropping a named component.
- Any implication that the exchange authors, owns, corrects or invalidates member data. The
  exchange **coordinates**; the member **edits**; the exchange **rechecks**.

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

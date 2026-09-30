# Outreach drafts — state work-zone data

Drafted 2026-09-30. Every figure below was measured, and the measurement is reproducible with
`scripts/audit_cwz_conformance.js` and `scripts/feed_health_check.js`.

Three notes on framing, applied throughout:

- **No product name.** These are peer-to-peer DOT conversations under TPF-5(566). Naming an
  internal platform invites a procurement conversation instead of a data one.
- **Nothing accusatory.** "Your feed is broken" puts a person on the defensive about something
  they probably did not build and may not own. Every draft leads with what we saw, states that
  we may be wrong, and makes the reply easy.
- **No overclaiming.** Where a number is uncertain or a check was inconclusive, the draft says
  so. Several figures in this session's analysis moved on re-measurement, and a state that
  checks our claim and finds it soft will not answer the second email.

---

## 1 · UDOT (Utah) — the frozen feed

Highest value and the most delicate. Send to the UDOT traffic operations / TOC data contact,
not to a general inbox.

> **Subject:** Utah WZDx feed — possible stale endpoint, and an offer
>
> Hi [name],
>
> I'm Matt Miller with Iowa DOT. Iowa leads TPF-5(566), a pooled fund on connected work zone
> data, and part of what we do is aggregate and quality-check state WZDx feeds nationally.
>
> Running that check this week, Utah's registered feed came up in a way I wanted to flag
> directly rather than leave in a report. The endpoint in FHWA's registry —
> `udottraffic.utah.gov/wzdx/udot/v40/data` — returns HTTP 200 and a full document, and every
> event in it carries `event_status: "active"`. But the feed's own `update_date`, its declared
> data source, and the newest event in it are all dated **19 March 2023**. We see no v4.1 or
> later endpoint.
>
> If that's known, or if there's a newer endpoint we should be pointing at, just say so and
> I'll correct our configuration — that's the most likely explanation and the easiest outcome.
>
> If it isn't known, two things may be useful.
>
> First, 744 work zones are currently being published as active. Eighteen of those are on
> interstates. We looked at ten of them through UDOT's own cameras (nearest camera 8–195 m,
> all inside or beside the project limits, images pulled at 01:38 MDT on 30 September):
> six show open lanes with no cones, barrier or lane shift; one — the Davis County concrete
> panel replacement at Parrish Lane — is clearly still active; three we couldn't judge, two
> because the camera returned a placeholder image and one because of headlight glare. I've
> attached the images and timestamps. That's evidence the projects are finished or dormant,
> not proof, and a night image can't tell you whether crews are working.
>
> Second, we built a current WZDx 4.2 feed for Utah from data UDOT already publishes — the 511
> construction layer joined with the Traffic Events View service in UPlan. It produces 267 work
> zones updated today, 54 of them with real polyline extents and mileposts from your own
> records. It needed nothing from UDOT: no key, no deployment, no agreement. Happy to hand it
> over, including the code, if it's useful — or to drop it if you'd rather we didn't.
>
> One thing your public data doesn't carry anywhere we could find is lane-level detail —
> `LaneImpact` and `LanesAffected` are populated on every record with the string "No Data".
> That's the one piece that would need TMDD or direct ATMS access, and it's the main reason
> I'd welcome a conversation about Utah joining the pooled fund.
>
> Glad to get on a call, or to send the feed and the imagery and leave it there.
>
> Matt

---

## 2 · NDOT (Nevada) — a member state with no registered feed

Nevada is already a TPF-5(566) member, which changes the tone entirely: this is an obligation
to discharge, not a pitch.

> **Subject:** Nevada WZDx — we can stand one up from your own 511 data
>
> Hi [name],
>
> Matt Miller, Iowa DOT, on the TPF-5(566) connected work zone pooled fund.
>
> While auditing national WZDx coverage I noticed Nevada has no feed registered with FHWA. I
> wanted to check whether that's deliberate — a feed in progress, or a decision already made —
> before assuming it's a gap.
>
> If it is a gap, it's an easy one to close. NDOT's own 511 construction layer is public and
> keyless, and we've already generated a conformant WZDx 4.2 feed from it: 94 work zones,
> current as of today, carrying route, direction and restrictions where your records have them.
> No new system, no key, no data-sharing agreement — it reads only what nvroads.com already
> publishes.
>
> As a member state you're entitled to that work regardless. The options are roughly: we hand
> you the generator and NDOT publishes it under your own domain and registers it; we host it on
> your behalf as an interim; or you tell us Nevada has a different plan and we stay out of the
> way.
>
> Happy to send the generated feed so you can look at it before deciding anything.
>
> Matt

---

## 3 · ODOT (Oregon) — an API key request

Short, because it is a small ask.

> **Subject:** API key request — ODOT WZDx feed
>
> Hi [name],
>
> Matt Miller, Iowa DOT. Iowa leads TPF-5(566), a pooled fund on connected work zone data, and
> we aggregate state WZDx feeds to do national quality reporting.
>
> Oregon's feed is registered with FHWA at `api.odot.state.or.us/WZDx/v4.0/Workzones` and is
> key-gated. Could we get a key, or be pointed at the right request process?
>
> Read-only use: we poll the feed, check it for conformance against WZDx 4.x and CWZ 1.0, and
> include Oregon in coverage reporting. Happy to share the conformance results for Oregon back
> with you — that tends to be the more useful half for the publishing state.
>
> Matt

---

## 4 · ARDOT / TDOT / WYDOT — data availability

One template, three sends. These states publish nothing we could find through public channels,
so the email asks rather than asserts.

> **Subject:** Work zone data — does [STATE] publish a feed we've missed?
>
> Hi [name],
>
> Matt Miller, Iowa DOT. Iowa leads TPF-5(566), a pooled fund on connected work zone data. Part
> of that is keeping an accurate national picture of which states publish work zone information
> and in what form.
>
> [STATE] currently shows as no public feed in our records, and I'd rather ask than assume. We
> looked at [511 SITE], the FHWA WZDx registry, and [STATE DOT]'s ArcGIS services, and didn't
> find a work-zone or lane-closure feed. It's entirely possible we looked in the wrong place.
>
> Three questions, any of which is useful:
>
> 1. Does [STATE] publish work zone or lane closure data anywhere public — WZDx, GeoJSON,
>    ArcGIS, an ATIS vendor feed, anything?
> 2. If not public, is there a feed available to another state DOT on request?
> 3. If neither, is a WZDx feed something [STATE] is considering? The pooled fund has produced
>    starter kits for states in exactly that position, and we'd share them at no cost.
>
> No obligation attached to any answer — a "we don't publish that" is genuinely useful to us,
> because it stops us reporting [STATE] as a gap we simply failed to find.
>
> Matt

---

## Sequencing

1. **Nevada first.** Member state, easy yes, and it proves the approach on someone who already
   signed up before it's shown to a non-member.
2. **Oregon** next — a small ask, unrelated to the rest, no reason to hold it.
3. **Utah** once Nevada has replied, so the offer can say it has been done elsewhere.
4. **AR / TN / WY** whenever; they are low-yield and nothing depends on them.

## Before sending Utah

Check our own house. The feed registered to us in FHWA's registry —
`feeds.purposebuilt.systems/cwz` — is currently serving **zero features** and emits `feed_info`
rather than `road_event_feed_info`. Utah is fair to raise; it is much less fair to raise while
our own registered entry is empty, and anyone who receives that email may well look.

---
name: cwz-conformance
description: Audit an aggregated multi-source work-zone feed against CWZ 1.0 / WZDx 4.1+ and normalize it into a conformant feed at assembly time. Complete, portable, stack-agnostic method — attribute every defect to the source adapter that produced it, synthesize the missing road_event_feed_info, migrate pre-4.0 publishers onto the current schema losslessly, classify geometry by recoverability, and refuse to invent what only a publisher can supply. Use when a feed built by combining upstream state WZDx/event feeds must be made conformant without waiting on the publishers, e.g. before serving an exchange like MITRE iNODE.
---

# CWZ conformance for an aggregated feed — full method

**Goal.** Given a feed assembled by combining many upstream WZDx/event feeds, decide whether it
conforms to CWZ 1.0 (and its WZDx 4.1+ base), say precisely **which upstream source** caused each
defect, and mechanically repair everything that can be repaired **without inventing data**.

The governing distinction: in an aggregated feed most defects are **inherited, not authored** — they
are what the publishers actually emit. That is good news. Inherited structural defects can be
normalized deterministically at assembly, with no publisher changes and no coordination. What cannot
be normalized is *content the publisher never sent*, and the whole value of this method is drawing
that line honestly rather than papering over it.

Stack-agnostic specification, implementable anywhere.

---

## 1. Inputs

1. **The assembled feed** — a GeoJSON `FeatureCollection` of road events, each with a
   `properties.core_details.data_source_id` naming the upstream source it came from.
2. **The target profile** — CWZ 1.0 (§5.4.2.1 payload fields) over a WZDx 4.1/4.2 base.
3. Optional: any attribution the assembler already recorded (organization names, contacts) to seed
   the feed metadata instead of leaving placeholders.

---

## 2. Attribute every defect to its source (do this first)

Before reporting anything, group the audit by `data_source_id`. **An aggregated feed's defects
cluster by adapter, not by feature** — and until you show that, a finding reads as "the feed is bad,"
which nobody can act on. Grouped, the same data reads as "these three adapters have these three
specific bugs," which is a work plan.

Build a per-source matrix: feature count, geometry outcomes, schema shape, field coverage. Expect
adapter-shaped answers — one source 100% broken on an axis, another 100% clean on it. If a defect
really is spread evenly across every source, that is itself the finding: the fault is in assembly,
not upstream.

Always carry **sample feature ids, one per defect class**, so the recipient can reproduce rather than
take your word for it.

---

## 3. Feed-level structure

`road_event_feed_info` is required and is what a consumer reads before anything else. Absent, the
feed fails ingest before a single event is parsed.

Synthesize it from what the features themselves prove: collect every `data_source_id` actually
referenced, and declare one `data_sources` entry per distinct value. **Every referenced id must
resolve** — a feature pointing at an undeclared source is a dangling reference.

Per source, derive `update_date` from the newest `core_details.update_date` among its own features.
Where a source has none, see §7 — do not substitute the current time.

**Extension namespace.** The spec's extension convention is an `x_` prefix. Members added by the
assembler under other spellings (a leading underscore, a bare name) are non-conforming wherever they
sit, feed level included. Rename rather than drop: they usually carry the assembler's most valuable
additions.

---

## 4. Schema-version migration

A feed aggregating many publishers will contain **several schema generations at once**. Detect this
by looking for fields that a later version *replaced*, then migrate the laggards forward.

The WZDx 4.1 case: the pre-4.0 `*_accuracy` enumerations were replaced by boolean verification flags.

| Pre-4.0 | 4.1 / CWZ 1.0 |
|---|---|
| `start_date_accuracy` | `is_start_date_verified` |
| `end_date_accuracy` | `is_end_date_verified` |
| `beginning_accuracy` | `is_start_position_verified` |
| `ending_accuracy` | `is_end_position_verified` |

Before mapping, **inspect the actual enum values present**. Where the source vocabulary is a clean
binary (`verified` / `estimated`), the mapping is exact and lossless. Where it is not, map only what
is unambiguous and report the rest rather than forcing a value.

Migrate **losslessly**: retain the original value under an `x_` field (e.g. `x_source_accuracy`).
Normalization should never be the step that destroys upstream evidence.

**Paired fields.** Some fields are meaningful only as a pair (start/end verification). Where one half
is present without the other, first check whether the *legacy* field supplies the missing half —
often the feature still carries it, and migrating fills the pair from real upstream data. Only if
nothing supplies it should you default, and then to the conservative value (unverified, not verified)
with a note recording that you did.

---

## 5. Geometry: classify by recoverability, repair elsewhere

Do **not** correct geometry in the normalization pass — that needs a centerline, a network, and its
own acceptance gates (see `geometry-correction`). Normalization's job is to sort the defective
geometry into what someone can actually do about it:

| Class | Meaning | Disposition |
|---|---|---|
| **Correctable by measure** | 2-point, and carries *distinct* begin/end measures | Exact LRS location. Best outcome — no snapping, no tolerance |
| **Correctable by snap** | 2-point, no usable measures | Endpoint snap onto the centerline |
| **Not correctable** | Zero extent — single point, or begin measure == end measure | **Publisher fix.** The extent was never published |
| **Already valid** | > 2 vertices | Leave alone |

The measure check is what makes this worth doing: a 2-point feature that carries real mileposts is
not merely fixable, it is fixable *exactly*, and knowing how many fall in that class changes the
remediation plan. Attach the class to each feature as a note so the next pass can act on it.

Distinguish "the endpoint was dropped in translation" from "the source published no extent" by
comparing the measures. They call for entirely different conversations.

---

## 6. Respect event-type-specific requirements

A profile's required fields attach to a **specific event type**. Do not flag a field as missing on an
event type that never required it — a detour is not a work zone, and reporting its absent work-zone
fields as defects destroys the credibility of every real finding in the report. Segment coverage
statistics by `event_type` and say which population each figure is over.

---

## 7. What must never be synthesized

The line between normalization and fabrication:

| Never invent | Why | Instead |
|---|---|---|
| CWZ payload fields (`worker_presence`, `restrictions`, `reduced_speed_limit_kph`, `lanes`, `types_of_work`) | Observations about a physical work zone. Absent means the publisher never sent it | Report coverage per source; escalate upstream |
| `organization_name`, contacts | Facts about real organizations | Emit a loud placeholder a human must replace |
| `update_date` for a source whose features carry none | Stamping "now" asserts a freshness nobody observed | Flag the source as freshness-unverifiable |
| Geometry extent where begin == end | The zone's length was never published | Mark as publisher-fix; never buffer to a plausible length |

A loud placeholder beats a plausible guess. The failure mode to design against is a normalized feed
that *looks* complete because the gaps were filled with invention — it is strictly worse than the
non-conforming feed it replaced, because the defects are now invisible.

---

## 8. Output

1. **The normalized feed** — conformant structure, every other field preserved verbatim, per-feature
   `x_conformance_notes` recording anything defaulted or deferred.
2. **A report**, which is the actual deliverable: fixed counts, the per-source matrix (§2), geometry
   by recoverability class (§5), payload coverage with its population stated (§6), and an explicit
   list of what needs a publisher.

Report before/after counts for each defect class. "8,012 legacy fields → 0" is verifiable; "migrated
the schema" is not.

---

## 9. Invariants

1. **Structure yes, content never** — normalize shape; never manufacture an observation (§7).
2. **Lossless** — every migrated value is retained under `x_`; normalization destroys nothing.
3. **Every reference resolves** — no feature may name an undeclared data source.
4. **Attribute, don't aggregate** — every defect count is reported per source (§2).
5. **Classify, don't repair** geometry here; hand it to the correction cascade with its class (§5).
6. **Type-aware requirements** — never flag a field against an event type that does not require it.
7. **Idempotent** — running it twice changes nothing the second time.
8. **Loud over plausible** — an unfillable field gets a placeholder that cannot be mistaken for data.

---

## 10. End-to-end pseudocode

```text
audit = per_source_matrix(feed)                       # §2 — before anything else

for feature in feed.features:
    for legacy, modern in SCHEMA_MIGRATION:           # §4
        if legacy in feature and modern not in feature:
            value = map_enum(feature[legacy])
            if value is None: report_unmapped(legacy); continue
            feature[modern] = value
            feature.x_source_accuracy[legacy] = feature.pop(legacy)

    for (a, b) in PAIRED_FIELDS:                      # §4
        if present(a) != present(b):
            fill_from_legacy_or_default_false(feature, a, b, note=True)

    feature.geometry_class = classify(feature)         # §5 measure | snap | upstream | ok
    note(feature, feature.geometry_class)

feed.road_event_feed_info = synthesize(               # §3
    sources = distinct(data_source_id in features),
    update_date_per_source = newest(core_details.update_date) or FLAG_UNVERIFIABLE,
    organization_name = attribution or LOUD_PLACEHOLDER)

for member in feed.non_standard_top_level:            # §3
    rename(member, "x_" + strip_underscore(member))

emit(feed, report(audit, fixed_counts, geometry_classes, payload_coverage, needs_publisher))
```

---

## 11. Reference implementation

CCAI Connected Corridor:

- `scripts/cwz_normalize.py` — this method end to end, stdlib-only so it runs anywhere:
  feed-info synthesis, lossless accuracy→boolean migration, pair completion, `x_` renaming,
  geometry classification, and the per-source report. `--report-only` audits without writing.
- `docs/wzdx-diy/wzdx_geometry_fix.py` — the geometry pass this one defers to (see the
  `geometry-correction` skill for the cascade and its acceptance gates).
- `compliance-analyzer.js` — the CWZ v1.0 required-field profile (§5.4.2.1) used for scoring.

Applied to a 5,756-feature six-state export: 8,012 legacy fields migrated to 0 remaining, 5
previously-dangling data sources declared, 234 orphaned flags paired from their own upstream values,
and 1,186 of 1,463 defective geometries classified as recoverable — leaving exactly two items
(277 zero-extent events and `worker_presence` coverage) that only a publisher can resolve.

# Work-Zone Validation — Skill Set (for MITRE iNODE)

Portable, stack-agnostic capability specifications for independently validating reported work zones
(WZDx) using sources that are *operationally separate* from the DOT export. Each skill is a complete
top-to-bottom method — inputs, algorithm, thresholds, output schema, invariants, and pseudocode — that
an implementer can build from scratch, and each stamps WZDx-compatible `x_*` verification fields.

## Skills

| Skill | Capability |
|---|---|
| **`work-zone-validation`** | Orchestrator: runs the four validators, composes `x_verification` + confidence, positive-only + sticky, emits the WZDx/CWZ validated feed. **Start here.** |
| **`camera-validation`** | AI vision on public traffic-camera stills; deployed-vs-stored; the only source that can demote (daily removal). |
| **`device-validation`** | Connected field device (arrow board / DMS / sensor) on the zone by route + chainage. |
| **`probe-validation`** | Commercial traffic-incident provider (e.g. TomTom v5) corroboration, with metered-API safety controls. |
| **`dms-validation`** | Operator-posted dynamic message sign text; two-gate accept/reject classification. |

## Format

Each is a Claude Code / agent `SKILL.md`: YAML frontmatter (`name`, `description`) + markdown body.
Directory-per-skill (`<name>/SKILL.md`) is the on-disk convention; the flat copies here
(`<name>.SKILL.md`) are for review/hand-off. If iNODE expects a different manifest wrapper, the body
content is portable as-is.

## Key design decisions (read once)

- **Independent signal classes.** device (on-site hardware), camera (visual), probe (commercial nav),
  dms (operator text). Agreement between *different* systems is what makes corroboration meaningful.
- **Positive-only**, with exactly one demotion: camera's daily re-check can mark a zone finished.
- **Sticky accumulation** for device/probe/dms (persist, never demote); camera stays daily-recheckable.
- **Confidence** = number of agreeing sources (`≥2` = strong).

Full feed schema, endpoints, and integration guidance: `VALIDATED_WORK_ZONES_DEV_SPEC.md`.

Contact: matthew.miller@iowadot.us

# TETC Documentation Map

The TETC (Eastern Transportation Coalition) data-quality grading work is
spread across four documents that have distinct roles. Read this first if
you're trying to figure out which one you need.

**Last Updated:** 2026-05-07

| Document | Role | Status |
|----------|------|--------|
| [`TETC_MDODE_Grading_SOP.md`](./TETC_MDODE_Grading_SOP.md) | **Canonical methodology**: how to score a feed, dimension by dimension. Currently authoritative. | ✅ Current (v1.0 SOP, Nov 2025) |
| [`TETC_SCORING_WORKFLOW.md`](./TETC_SCORING_WORKFLOW.md) | **Tool guide**: ChatGPT-prompt pipeline for running batch scores against Postgres. | ✅ Current |
| [`TETC_VALIDATION_EVIDENCE.md`](./TETC_VALIDATION_EVIDENCE.md) | **Evidence repository**: per-platform scores with citations. | ⚠️ Composites computed under v1.0 weights — see header note |
| [`TETC_DQI_SCORING_MATRIX.md`](./TETC_DQI_SCORING_MATRIX.md) | **Historical reference (v1.0)**: original Nov 2024 weights. | 🗄️ Deprecated — kept for historical context |

## Where to start

- **You're scoring a new vendor** → read the SOP, then use the WORKFLOW for the ChatGPT pipeline.
- **You want to know what Corridor Communicator's score is** → EVIDENCE doc (read the per-component scores; recompute the composite if you need today's number).
- **You're reading a Nov 2024 reference that mentions "Standards 20%, Governance 15%"** → that's the v1.0 weights. The current weights are in the SOP; the deprecation banner on the Matrix maps the changes.

## Why the formula changed

Between v1.0 (Nov 2024) and the current SOP (Nov 2025), the weights were rebalanced
to put more emphasis on Accuracy and Coverage (from 25%/20% to 40%/25%) and less on
Standards Conformance and Governance (from 20%/15% to 10%/5%). The shift reflects
real-world experience that operators care most about whether a feed's values are
right and complete; standards conformance and governance still matter but were
double-counted under the original weights.

# Federal Research Needs — Digital Infrastructure Interoperability

**Talking Points · RTCC Meeting**
**Matt Miller · May 2026**

Framing: every item below is a recommendation for federal research investment to operationalize the September 2025 RTCC Letter Report. Nothing here proposes any product, system, or service for adoption.

---

## 1. Measurement-of-Interoperability Research

- **Need:** A sustained, public federal research program that empirically measures the conformance, quality, and interoperability of public digital infrastructure feeds.
- **Why now:**
  - Approximately **21 states publish no public WZDx feed of any kind** (per the USDOT WZDx Feed Registry, May 2026)
  - Among states that do publish: invalid GeoJSON, expired TLS certs, inconsistent field population, divergent lifecycle conventions
  - The federal registry is a **directory**, not a measurement program
- **Recommended owner:** FHWA RD&T / TFHRC, with NCHRP support
- **Output:** Open methodology, publicly-reported per-producer measurements, refreshed continuously

## 2. Authoritative Cross-Specification Crosswalk Research

- **Need:** Federally-funded research producing authoritative reference crosswalks between the specs operations consumers must integrate together.
- **Why now:** The dominant integration cost is **translation**, not specification quality. Every multi-state integrator independently reinvents the same mappings, and the mappings silently diverge.
- **Specs in scope:**
  - WZDx ↔ TMDD ↔ CIFS ↔ CWZ 1.0 ↔ SAE J2735 ↔ Common Alerting Protocol
  - Event-type vocabularies, severity scales, lifecycle conventions
- **Recommended owner:** FHWA RD&T in coordination with the relevant standards bodies (SAE, ITE, AASHTO)
- **Output:** Reference crosswalks as research publications **and** at least one open-source reference normalization implementation

## 3. Sub-State and Regional Digital Infrastructure Research

- **Need:** Characterize the sub-state and regional layer of digital infrastructure — prevalence, conformance, overlap, and harmonization levers.
- **Why now:**
  - Sub-state producers fill real coverage gaps state DOTs don't (e.g., City of Austin, St. Charles County, Maricopa County, Quebec City)
  - Where they overlap with state-level feeds, they overlap **incompatibly** (PennDOT vs. PA Turnpike; IDOT vs. Illinois Tollway vs. City of Chicago)
  - The MAASTO TPIMS coalition shows federal harmonization at this layer **can** work — Indiana's non-conforming TPIMS feed shows where it currently doesn't
- **Recommended owner:** FHWA RD&T, jointly with NCHRP
- **Output:** Inventory + conformance assessment + policy-lever analysis for harmonizing sub-state producers with state-level feeds

## 4. Downstream-Cost Research on TFHRC External-Engagement Constraints

- **Need:** Quantify the practitioner-side and state-DOT-side cost of the constraints on TFHRC researchers' external engagement that the September 2025 Letter Report (Recommendation 2) flags as a process concern.
- **Why now:**
  - HSIS partial dark-out has removed reference datasets practitioners had been using
  - Reduced detail in AMRP and TFHRC Long-Range Plan publications reduces downstream practitioners' ability to orient to active federal research lines
  - These costs are real, distributed, and largely invisible to FHWA today
- **Recommended owner:** TRB / Cooperative Research Program, in support of the Letter Report's existing recommendation
- **Output:** Empirical characterization of the downstream cost, suitable for informing process changes inside FHWA

## 5. Independent Comparative Evaluation Methodology for Commercial Transportation Data Products

- **Need:** Open methodology for head-to-head, methodologically-transparent evaluation of commercial probe, incident, and work-zone data products.
- **Why now:**
  - State DOTs replicate substantially the same RFP and vendor-comparison work, in isolation, each procurement cycle
  - No federally-curated, published evaluation methodology exists for this product category
- **Recommended owner:** FHWA RD&T + NCHRP joint topic
- **Output:** Open methodology + empirical findings. Explicitly **not** a procurement recommendation or product endorsement — a research artifact states can draw on for their own evaluations

---

## What I am NOT asking for

- No specific system, product, or service for the committee to evaluate, fund, or adopt
- No procurement guidance
- No federal scoring of states as a regulatory function

All recommendations above are recommendations for **federal research** to advance interoperability in support of the digital infrastructure direction the Committee has already endorsed.

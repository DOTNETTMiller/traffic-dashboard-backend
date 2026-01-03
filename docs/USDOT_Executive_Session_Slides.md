# Executive Strategy Session Presentation
## Modernizing National Transportation Corridors

**Presenter:** Matthew Miller, Iowa DOT / AASHTO JSTAN Member
**Date:** January 15, 2026
**Duration:** 10 minutes

---

## Slide 1: Title Slide

**SCALING CORRIDOR MODERNIZATION**
**From Proof-of-Concept to National Deployment**

Matthew Miller
Iowa Department of Transportation
AASHTO JSTAN Member

January 15, 2026 | USDOT Executive Strategy Session

---

**Speaker Notes:**
- Thank USDOT for the invitation and TRB for hosting
- Brief intro: State DOT perspective + JSTAN standards work
- Goal: Share working implementation that addresses session's three key challenges: digital infrastructure, data quality, and interoperability

---

## Slide 2: The Three Critical Challenges

**What's Blocking Corridor Modernization?**

1. **Fragmented Data Systems**
   - 50 state DOTs, each with different formats
   - Commercial providers (Google, HERE, Waze) operate independently
   - No standardized way to share data bidirectionally

2. **Unknown Data Quality**
   - Mixed sources: official, commercial, crowdsource
   - No provenance tracking or confidence scoring
   - Liability concerns prevent data sharing

3. **Standards Exist But Aren't Deployed**
   - WZDx v4.2: Work zone data exchange standard
   - SAE J2735: Connected vehicle messages
   - **Problem: Implementation gap, not standards gap**

---

**Speaker Notes:**
- These aren't hypothetical - encountered all three in building multi-state corridor system
- Good news: Standards are mature and ready
- Challenge is deployment coordination and data trust frameworks
- This presentation shows one approach that works

---

## Slide 3: Working Solution - DOT Corridor Communicator

**Proof-of-Concept Addressing All Three Challenges**

**What It Does:**
- Aggregates data from **35 state DOT APIs** in real-time
- Publishes standardized **WZDx v4.2 feeds** for commercial consumption
- Accepts **contributed data** from commercial providers (probe data, incidents)
- Tracks **data provenance** and assigns **confidence scores** (0.0-1.0)

**Key Architecture:**
```
State DOTs (35) → Normalization → Quality Validation → WZDx Feed
     ↕                                                      ↓
Commercial Data Contributors ← API Keys ← Published to Google/HERE/Waze
```

**Development Cost:** ~40 hours, open-source stack
**Standards Used:** WZDx v4.2, SAE J2735, NTCIP (no proprietary tech)

---

**Speaker Notes:**
- This is running right now - not a proposal
- Can demonstrate live during Q&A if time permits
- Point: Corridor modernization doesn't require massive budgets
- Primary costs are coordination/governance, not technology

---

## Slide 4: Data Quality Framework - The Trust Problem

**How Do You Trust Data from Multiple Sources?**

**Implemented Solution: Confidence Scoring + Provenance**

| Source Type | Confidence Range | Example |
|-------------|------------------|---------|
| **Official DOT** | 0.85 - 1.0 | Iowa DOT reports I-80 closure |
| **Commercial Validated** | 0.65 - 0.85 | HERE Maps fleet probe data |
| **Crowdsource Verified** | 0.40 - 0.65 | Waze report cross-referenced |
| **Unvalidated** | < 0.40 | Single social media report |

**Provenance Tracking:**
- Every event records: original source, validation method, timestamp
- Full transformation chain from raw data to published feed
- Enables liability clarity and regulatory compliance

**Result:** Consumers make risk-based decisions
- Navigation apps: Use 0.65+ confidence data
- AVs: Require 0.85+ for route planning
- Emergency response: Validate <0.65 data before acting

---

**Speaker Notes:**
- This solves the "who do you believe" problem when DOT says one thing, Google says another
- Not just technical - this is a legal/liability framework
- Confidence scores enable graduated response based on data quality
- Example: AV can route around high-confidence work zone, but needs human verification for low-confidence incident

---

## Slide 5: Commercial Data Partnerships - The Incentive Model

**Challenge:** Industry won't share proprietary data without value exchange

**Proposed Framework: Data Reciprocity**

**What Commercial Providers Want:**
- Real-time access to official DOT data (work zones, incidents, restrictions)
- Standardized API (not 50 different state formats)
- High-quality data with provenance (reduces their validation costs)

**What They Can Contribute:**
- Probe data (anonymized speed, congestion, hard braking events)
- Crowdsourced incident reports
- Parking availability (from fleet management systems)

**API Key Tier System:**
| Tier | Access | Contribution Required | Rate Limit |
|------|--------|----------------------|------------|
| **Public** | Basic WZDx feed | None | 1K requests/hour |
| **Commercial** | Real-time updates | Probe data contribution | 10K/hour |
| **Government** | Full access + admin | Data validation help | Unlimited |

**Revenue Model:** Neutral exchange - no fees, mutual benefit

---

**Speaker Notes:**
- This is how you get Google, Apple, HERE to participate
- They already consume WZDx feeds - making it bidirectional is the innovation
- Key insight: Their probe data is valuable to DOTs for validation
- Example: Google has millions of phones on I-80, can confirm/deny incident reports
- No government funding needed for data contributions - it's value exchange

---

## Slide 6: AV Readiness - Why This Matters for Autonomous Vehicles

**AVs Need High-Definition, Real-Time Infrastructure State**

**Current Problem:**
- Each AV manufacturer builds proprietary data pipelines
- Duplicated effort, inconsistent coverage
- No standardized way to receive official DOT updates

**NODE Solution for AV:**

1. **Standardized Infrastructure Feed**
   - WZDx provides machine-readable work zone geometry
   - Confidence scores enable AV decision-making
   - Official DOT data reduces liability concerns

2. **Real-Time Updates**
   - Sub-60 second data freshness
   - Lane closure notifications before AVs encounter them
   - Dynamic rerouting based on corridor conditions

3. **Truck Parking for Autonomous Freight**
   - Real-time availability at 113+ facilities
   - Predictive models for rest stop planning
   - Enables hours-of-service compliance

**Strategic Point:** Federally-funded AV corridors should **require NODE implementation** as condition of funding → ensures interoperability

---

**Speaker Notes:**
- This session mentioned AV specifically - here's the connection
- NODE isn't just for today's navigation apps, it's AV infrastructure
- Comparison: We built roads before cars - here we're building data infrastructure before AVs scale
- Recommendation: Make NODE requirement for USDOT AV grants
- This prevents vendor lock-in and ensures public infrastructure remains publicly accessible

---

## Slide 7: Looking Forward - A Conceptual Framework for Infrastructure IoT

**Current Gap:** We have standards for data (WZDx), but not for devices

**Observation from Smart Home Industry:**
- Matter protocol solved fragmentation (Zigbee vs Z-Wave vs proprietary)
- Enables any device to work with any platform (Apple/Google/Amazon)
- Key principles: Device discovery, interoperability, certification

**Conceptual Proposal: Apply Matter-Like Thinking to Infrastructure**

**What if infrastructure devices had:**
- Standardized discovery and registration
- Certification and calibration tracking
- Time-series data with quality metrics
- Interoperability across vendors

**Use Cases:**
- Weather sensors publish road condition data
- Roadside units (RSUs) provide V2I connectivity
- Parking sensors report availability
- DMS/cameras self-report operational status

**Potential Path:** AASHTO JSTAN working group to develop framework
**Value:** Just as Matter unified smart homes, this could unify infrastructure IoT

---

**Speaker Notes:**
- This is forward-looking, not implemented
- Inspired by seeing how well Matter solved consumer IoT fragmentation
- Transportation has similar problem: Kapsch devices vs Daktronics vs others
- Not proposing new standard wars - suggesting we learn from Matter's success
- JSTAN could be the right venue since it's already state DOT consensus mechanism
- Open question for discussion: Is this worth pursuing?

---

## Slide 8: Deployment Pathway - How to Scale Nationally

**Three-Phase Approach**

**Phase 1: Proof-of-Concept Corridors (Year 1)**
- Select 5 high-priority corridors (I-80, I-95, I-10, I-70, I-5)
- Implement NODE in participating states
- Establish commercial data partnerships (Google, HERE, TomTom)
- Validate architecture and governance model

**Phase 2: Regional Expansion (Year 2)**
- Scale to 20+ corridors
- Launch certification program for commercial providers
- Deploy 100+ infrastructure IoT devices (sensor pilots)
- Measure safety and efficiency improvements

**Phase 3: National Deployment (Year 3)**
- All interstate corridors NODE-enabled
- Industry-standard APIs adopted by major nav providers
- AV manufacturers integrate standardized feeds
- Export U.S. playbook to international partners

**Success Metrics:**
- % of interstate miles with <60 second data freshness
- Number of certified commercial data contributors
- Reduction in work zone incidents
- AV operational design domain (ODD) expansion

---

**Speaker Notes:**
- This is realistic 3-year timeline based on WZDx adoption speed
- WZDx went from concept to 40+ states in ~5 years - we can accelerate
- Key: Don't require 100% before starting - corridor-by-corridor is fine
- Federal role: Coordination, standards governance, pilot funding
- State DOT role: Implementation, operations, data quality
- Industry role: Data contribution, commercial deployment

---

## Slide 9: Investment Requirements - What Would This Cost?

**Development Costs (Per State):**
- NODE implementation: $500K - $1M
  - Software development
  - API hosting infrastructure
  - Data quality monitoring
  - Staff training

**National Coordination:**
- USDOT NODE coordination office: $5-10M (3-year startup)
- Conformance testing program: $10-20M
- 50-state deployment support: $25-50M

**Total Federal Investment: ~$40-80M**

**Cost Comparison:**
- Single mile of urban interstate: $5-10M
- **This is the equivalent of 8-16 miles of highway** to establish data interoperability **nationwide**

**Return on Investment:**
- Reduced incident response times (lives saved)
- Commercial fleet efficiency (GDP impact)
- AV deployment acceleration (global competitiveness)
- Foundation for decades of digital infrastructure innovation

---

**Speaker Notes:**
- These are realistic estimates based on proof-of-concept experience
- Not massive - comparable to single large interchange project
- Most cost is coordination/policy, not technology
- Federal role is seed funding + coordination, not ongoing operations
- States cover ongoing operations (like they do for traffic management centers)
- ROI isn't just financial - it's safety, competitiveness, enabling innovation

---

## Slide 10: Call to Action - What We Can Do Today

**Near-Term Actions (Next 6 Months):**

1. **Designate Pilot Corridors**
   - USDOT selects 3-5 corridors for NODE deployment
   - Provides implementation funding
   - Establishes success metrics

2. **Convene Commercial Partners**
   - Google, HERE, TomTom, Waze, Apple
   - Negotiate data reciprocity agreements
   - Define API key tiers and quality SLAs

3. **AASHTO JSTAN Coordination**
   - Formalize NODE specification
   - Develop conformance testing
   - Explore infrastructure IoT framework (Matter-like concept)

**What I'm Offering:**
- ✅ Open-source reference implementation (DOT Corridor Communicator)
- ✅ Technical consultation on state deployments
- ✅ JSTAN working group participation
- ✅ Live demonstration of working system (available today)

**The Opportunity:** Standards exist. Technology is proven. What's needed is **coordination and commitment** to deploy at scale.

---

**Speaker Notes:**
- End with clear asks and offers
- This isn't theoretical - we can start immediately with pilot corridors
- Reference implementation exists, so states don't start from scratch
- Commercial providers are already interested (WZDx proves this)
- Key message: We're not 5 years away, we're 6 months away if we decide to act
- Emphasize willingness to help - this is about collaboration, not individual credit

---

## Backup Slides (If Time Permits)

### Backup Slide 1: Global Competitiveness Context

**International Landscape:**

**Europe (C-ITS):**
- EU-mandated cooperative ITS deployment
- Day 1 messages similar to WZDx
- Centralized approach with strict standards

**China:**
- Aggressive smart highway investments
- Government-industry coordination
- Proprietary standards (vendor lock-in)

**U.S. Competitive Advantage:**
- Open standards heritage (GPS, ITS, connected vehicle)
- Public-private innovation model
- Federated architecture (scales better than centralized)
- Commercial tech sector (Google, Apple, Tesla)

**Strategic Risk:** Fragmentation could cede leadership to Europe/China

**Strategic Opportunity:** NODE/Infrastructure IoT as exportable U.S. standard

---

### Backup Slide 2: Technical Architecture Diagram

**NODE Data Flow:**

```
┌─────────────────────────────────────────────────────────┐
│              State DOT Data Sources (35)                │
│  Different formats, update frequencies, APIs            │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│         DOT Corridor Communicator (NODE Layer)          │
│  - Data normalization                                   │
│  - Quality validation & confidence scoring              │
│  - Provenance tracking                                  │
│  - WZDx v4.2 feed generation                           │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│          Standardized API with Authentication           │
│  - API key tiers (public, commercial, government)       │
│  - Rate limiting                                        │
│  - Usage analytics                                      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│               Commercial Consumers                       │
│  Google Maps, Apple Maps, HERE, Waze, TomTom           │
│                                                          │
│               Data Contributors (Reciprocal)            │
│  Probe data, incidents, parking status                  │
└─────────────────────────────────────────────────────────┘
```

---

### Backup Slide 3: Live Demo - What I Can Show

**Available for Demonstration:**

1. **Multi-State WZDx Feed**
   - Query 35 state DOT sources in real-time
   - Show data normalization (different formats → standard WZDx)
   - Display confidence scores and provenance

2. **API Key Authentication**
   - Generate test API key
   - Show tier-based rate limiting
   - Usage analytics dashboard

3. **Data Quality Validation**
   - Conflicting reports from different sources
   - Automated resolution using confidence scoring
   - Provenance chain visualization

**Requirements:** Laptop + internet connection + projector

**Time Needed:** 5 minutes for comprehensive demo

---

## END OF PRESENTATION

---

## Notes for Presenter

**Key Messages to Emphasize:**

1. **Working Implementation:** This isn't slides - it's a running system that proves feasibility
2. **Cost-Effective:** $40-80M national deployment vs billions in traditional infrastructure
3. **Standards-Based:** No proprietary tech, uses existing WZDx/SAE frameworks
4. **Public-Private Model:** Data reciprocity creates win-win for industry and government
5. **AV-Ready:** Infrastructure foundation for autonomous vehicle deployment
6. **Actionable:** Can start pilot corridors in 6 months, not 5 years

**Anticipated Questions & Answers:**

**Q: "Why should commercial providers share their data?"**
A: They get real-time official DOT data in standardized format, reducing their validation costs. It's value exchange, not altruism.

**Q: "What about data privacy with probe data?"**
A: Anonymized/aggregated only. No PII. Focus on traffic patterns, not individual vehicles.

**Q: "How is this different from existing TMCs?"**
A: TMCs manage devices. NODE manages data exchange. Complementary, not replacement.

**Q: "What if states don't want to participate?"**
A: Start with willing states on priority corridors. Federated model allows opt-in. Success will drive adoption.

**Q: "What's the federal role vs state role?"**
A: Federal: Coordination, standards, pilot funding. States: Implementation, operations, data quality.

**Q: "Timeline to national deployment?"**
A: 3 years for full interstate coverage if we start now. WZDx adoption shows this is realistic.

**Tone Notes:**
- Collaborative, not prescriptive
- Evidence-based (working system proves concept)
- Action-oriented (specific next steps)
- Humble (open to feedback, offering help not selling solution)

**Visual Aids Needed:**
- Consider screen recording of live system for backup if demo fails
- Architecture diagram (included in backup slides)
- Map showing 35 state coverage
- Timeline graphic for 3-phase deployment

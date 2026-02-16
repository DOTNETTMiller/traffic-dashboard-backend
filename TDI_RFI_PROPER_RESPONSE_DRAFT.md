# Transportation Digital Infrastructure (TDI) RFI Response
## Substantive Answers to USDOT Questions

### A. Research, Development and Deployment

#### A1. How should Transportation Digital Infrastructure be defined?

**Definition:** TDI is the interconnected digital systems, data standards, communication protocols, and governance frameworks that enable real-time information exchange across transportation modes, jurisdictions, and stakeholders to improve safety, mobility, and efficiency.

**Core Components:**
- **Data Layer:** Standardized formats (WZDx, TMDD, GTFS, etc.)
- **Communication Layer:** APIs, message queues, federated data exchange
- **Governance Layer:** Access controls, privacy frameworks, data trusts
- **Application Layer:** Traveler information, traffic management, autonomous vehicles

**Key Principle:** TDI must be **mode-agnostic** and **jurisdiction-neutral** - it should work equally well for highways, transit, aviation, and maritime across state and local boundaries.

---

#### A2. What research needs should be prioritized to advance TDI?

**Tier 1 Research Priorities (0-2 years):**

**1. Geospatial Data Quality and Consistency**
- **Problem:** Different DOTs use different coordinate systems, linear referencing methods, and geometry precision
- **Real-World Example:** Corridor Communicator encountered "bidirectional carriageway problem" - OSM highway data mixes eastbound/westbound lanes, causing zigzag geometry when building Interstate polylines
- **Research Need:** Methods to automatically separate directional roadways from mixed geospatial data, validate geometry quality, and reconcile conflicting location references
- **Impact:** Enable accurate mapping of events to road geometry across jurisdictions

**2. Real-Time Data Validation and Quality Metrics**
- **Problem:** WZDx feeds from 15+ states have inconsistent data quality - missing fields, invalid coordinates, stale timestamps
- **Real-World Example:** Some state feeds return work zones with coordinates outside state boundaries, or timestamps months in the past
- **Research Need:** Automated data quality scoring, anomaly detection for geographic bounds, temporal validation, schema compliance checking
- **Impact:** Prevent garbage data from polluting federated feeds

**3. Multi-Source Route Geometry Integration**
- **Problem:** Need curved road geometry for realistic event visualization, but OSRM routing sometimes fails or returns straight lines
- **Real-World Example:** Corridor Communicator uses layered approach: (1) Try OSRM routing, (2) Fall back to pre-built Interstate polylines, (3) Last resort: straight line
- **Research Need:** Intelligent geometry source selection, quality metrics for route geometry, methods to detect and correct routing failures
- **Impact:** Improve accuracy of traveler information displays

**Tier 2 Research Priorities (2-4 years):**

**4. Privacy-Preserving Probe Data Aggregation**
- **Research Need:** Methods to aggregate vehicle probe data for traffic speeds while preventing individual vehicle tracking across jurisdictions
- **Approach:** Differential privacy, k-anonymity, geographic/temporal binning
- **Impact:** Enable real-time traffic data sharing without privacy concerns

**5. Cross-Jurisdiction Linear Referencing**
- **Problem:** Each state DOT uses different milepost systems, some reset at borders
- **Research Need:** Universal linear referencing method that works across state boundaries
- **Impact:** Enable seamless corridor-level analysis and traveler information

**6. Feed Health Monitoring and Fault Detection**
- **Research Need:** Machine learning models to detect feed degradation, predict outages, identify data quality issues before they impact applications
- **Impact:** Improve reliability of federated data systems

**Research Methodology:**
- Partner with universities for academic research
- Fund pilot projects in 2-3 state DOTs
- Publish reference implementations as open source
- Validate against real-world operational data (like Corridor Communicator)

**Not Needed:**
- Theoretical research on new data formats (use existing standards)
- Basic web API research (solved problem)
- Blockchain for transportation data (solution looking for a problem)

---

#### A3. What travel corridors or regions should be prioritized for TDI development and deployment?

**Recommendation:** Prioritize **Interstate highway corridors** that cross multiple state jurisdictions as initial testbeds.

**Rationale:**
1. **Multi-jurisdictional complexity:** Forces solutions to work across state DOTs with different systems
2. **High traffic volume:** Maximum impact on safety and mobility
3. **Existing infrastructure:** DOT systems (511, TMCs, ITS equipment) already in place
4. **Federal interest:** Interstate commerce and national mobility

**Specific Pilot Corridors:**
- **I-80 (California to New Jersey):** Longest corridor, 11 states, diverse geography
- **I-35 (Texas to Minnesota):** Critical freight corridor, 6 states
- **I-95 (Florida to Maine):** Highest traffic volume on East Coast

**Proof Point:** The DOT Corridor Communicator project demonstrates federated work zone data exchange across Iowa, Nebraska, Wyoming, and other I-80 states using WZDx standard. Real-time deployment shows this approach works.

---

#### A4. What existing testbeds or pilots can be leveraged for TDI?

**Leverage Existing Deployments (Don't Reinvent the Wheel):**

**1. DOT Corridor Communicator (I-80, I-35)**
- **Status:** Operational production deployment
- **Coverage:** 15+ state DOT WZDx feeds across I-80 and I-35 corridors
- **Technology:** Federated data aggregation, OSRM routing, PostgreSQL/Railway cloud deployment
- **Lessons Learned Available:**
  - Data quality validation challenges
  - Multi-state coordinate system reconciliation
  - OSRM routing integration and fallback strategies
  - Real-time feed health monitoring
- **TDI Application:** Use as reference architecture for corridor-level data federation
- **URL:** corridor-communication-dashboard-production.up.railway.app

**2. I-95 Corridor Coalition (I-95 Corridor-wide)**
- **Status:** Mature operational system (15+ years)
- **Coverage:** 16 states from Maine to Florida
- **Technology:** Vehicle Re-Identification (V-RID) for travel times, incident data sharing
- **Lessons:** Proven governance model for multi-state data sharing
- **TDI Application:** Extend to other corridors, modernize data formats to WZDx/TMDD

**3. USDOT Work Zone Data Exchange (WZDx) Pilots**
- **Status:** Multiple state DOTs publishing WZDx feeds
- **Coverage:** 20+ states with active WZDx implementations
- **Technology:** Standardized JSON schema for work zone data
- **TDI Application:** Make WZDx mandatory for federal-aid projects, expand to incidents and closures

**4. USDOT Intelligent Transportation Systems Joint Program Office (ITS JPO) Pilots**
- **Programs:** Connected Vehicle Pilot Deployment Program (CVPDP), ATTRI projects
- **Locations:** Tampa (CV), Wyoming (CV), New York City (CV)
- **Technology:** V2X message sets (SPaT, MAP, TIM), DSRC/C-V2X
- **TDI Application:** Integrate CV2X message routing with TDI federation layer

**5. Regional Transit Real-Time Data Programs**
- **Examples:** MobilityData GTFS-RT feeds (hundreds of agencies)
- **Coverage:** Most major metro transit agencies
- **Technology:** GTFS-RT for real-time positions, alerts, trip updates
- **TDI Application:** Federate transit data with highway data for multimodal trip planning

**6. Waze Connected Citizens Program (CCP)**
- **Status:** Active partnerships with 1000+ state/local agencies
- **Coverage:** Nationwide
- **Technology:** Bidirectional data exchange (Waze data to DOTs, DOT closures to Waze)
- **Lessons:** Demonstrates public-private data sharing works
- **TDI Application:** Standardize Waze CCP data formats using WZDx/TMDD

**What NOT to Build:**
- Don't create new testbeds from scratch when operational systems exist
- Don't pilot "blockchain for transportation" or other unproven technologies
- Don't build federal data warehouses when federated approaches work

**Strategy:**
1. Document existing systems' architectures and lessons learned
2. Identify common patterns (federated data, standardized schemas, RESTful APIs)
3. Standardize what works, deprecate what doesn't
4. Fund expansion of proven systems to new corridors/regions

---

#### A5. What TDI use cases or applications should be prioritized?

**Tier 1 Priority (Deploy Now):**
1. **Work Zone Data Exchange (WZDx):** Standard exists, proven in production, immediate safety impact
2. **Incident Data Sharing:** Similar to WZDx, critical for traveler safety
3. **Real-time Traffic Conditions:** Speed, congestion, closures across jurisdictions

**Tier 2 Priority (2-3 years):**
4. **Connected Vehicle (CV2X) Message Routing:** Enable vehicles to receive safety alerts across state lines
5. **Transit Real-time Data Federation:** Connect GTFS-RT feeds across metro regions
6. **Freight Corridor Status:** Real-time truck parking, weigh station delays, corridor conditions

**Tier 3 Priority (3-5 years):**
7. **Autonomous Vehicle HD Map Updates:** Federated map data for AVs crossing jurisdictions
8. **Multimodal Trip Planning:** Seamless routing across modes and regions
9. **Infrastructure Asset Health:** Predictive maintenance data sharing

**Justification:** Start with proven standards (WZDx) and build credibility before tackling harder problems (AV infrastructure).

---

#### A6. How can TDI leverage and build upon existing USDOT programs and initiatives?

**Integration Strategy (Don't Duplicate, Consolidate):**

**1. ITS Joint Program Office (JPO)**
- **Existing Programs:** Connected Vehicle Pilots, ATTRI, Data Capture and Management
- **TDI Integration:** Make ITS JPO the federal lead for TDI standardization and research coordination
- **Action:** Consolidate fragmented ITS data pilots into unified TDI framework
- **Funding:** Redirect ITS JPO research dollars toward TDI implementation

**2. Federal Highway Administration (FHWA)**
- **Existing Programs:** Every Day Counts (EDC), TSMO programs, SHRP2
- **TDI Integration:** Make TDI compliance a requirement for FHWA funding eligibility
- **Action:** Add "Publish WZDx feed" as requirement for work zone projects receiving federal aid
- **Mechanism:** Update 23 CFR (federal highway regulations) to mandate TDI participation

**3. Federal Transit Administration (FTA)**
- **Existing Programs:** GTFS adoption, transit modernization grants
- **TDI Integration:** Require GTFS-RT real-time feeds for FTA-funded transit agencies
- **Action:** Make real-time data publication a condition of federal transit funding
- **Coordination:** Connect transit data with highway data for multimodal TDI

**4. Bureau of Transportation Statistics (BTS)**
- **Existing Programs:** Transportation data collection, National Transportation Atlas
- **TDI Integration:** BTS operates the TDI Service Registry (catalog of all state feeds)
- **Action:** Expand BTS mission from passive data collection to active data federation
- **Resource:** Minimal cost - service registry is lightweight JSON catalog

**5. State Planning and Research (SPR) Program**
- **Existing Programs:** State DOTs conduct research using SPR funds
- **TDI Integration:** Create pooled fund study for multi-state TDI research
- **Topics:** Corridor data federation, linear referencing, data quality standards
- **Example:** I-95 Corridor Coalition operates this way successfully

**6. Work Zone Data Initiative**
- **Existing Program:** FHWA WZDx specification development
- **TDI Integration:** WZDx becomes Tier 1 mandatory TDI standard
- **Action:** Require all state DOTs to publish WZDx feeds by end of 2027
- **Enforcement:** Link to federal highway funding eligibility

**7. Connected Vehicle Programs**
- **Existing Programs:** CV Pilots in Tampa, Wyoming, NYC
- **TDI Integration:** CV message routing (SPaT, MAP, TIM) uses TDI federation layer
- **Action:** Standardize CV message distribution across state boundaries
- **Challenge:** CV requires low latency (< 100ms), different infrastructure than WZDx

**8. National Operations Center of Excellence (NOCoE)**
- **Existing Program:** FHWA-funded center for TSMO best practices
- **TDI Integration:** NOCoE develops and distributes TDI reference implementations
- **Action:** Publish open-source code for state DOTs to deploy TDI endpoints
- **Example:** Corridor Communicator code could be reference implementation

**Financial Strategy:**
- **Don't request new funding** - reallocate existing ITS/TSMO budgets toward TDI
- **Make TDI compliance a funding requirement** - states must participate to receive federal dollars
- **Pooled funding approach** - multi-state research consortiums (like I-95 Coalition model)

**Governance:**
- **USDOT coordination role** - not data owner, but standards setter and registry operator
- **State DOT ownership** - states own and operate their data feeds
- **No new bureaucracy** - use existing AASHTO and TRB committees for governance

**Real-World Proof:**
Corridor Communicator demonstrates integration of:
- WZDx standard (FHWA initiative)
- Multi-state data federation (I-95 Coalition model)
- Open-source deployment (ITS JPO philosophy)
- Cloud infrastructure (modern, scalable, low-cost)

---

### B. System Architecture, Interoperability and Standards

#### B1. What are the key elements of a TDI system architecture that can accommodate all transportation modes?

**Proposed Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│              APPLICATION LAYER                           │
│  (Traveler Apps, TMCs, Fleet Management, AV Systems)    │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│           FEDERATION & DISCOVERY LAYER                   │
│  • Service registry (what data is available)            │
│  • Authentication/authorization (who can access)         │
│  • Data catalog (metadata about feeds)                  │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│              DATA EXCHANGE LAYER                         │
│  • RESTful APIs (pull model - apps request data)        │
│  • Message queues (push model - real-time events)       │
│  • GeoRSS/Atom feeds (syndication model)               │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│           STANDARDIZATION LAYER                          │
│  • WZDx (work zones)                                     │
│  • TMDD (traffic management)                            │
│  • GTFS/GTFS-RT (transit)                              │
│  • GeoJSON (spatial data)                               │
│  • Common Location Referencing (linear referencing)     │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│            DATA SOURCES (PRODUCERS)                      │
│  State DOTs • Cities • Transit Agencies • Private Sector│
└─────────────────────────────────────────────────────────┘
```

**Key Principles:**
1. **Decentralized:** No single point of failure - data stays with owners
2. **Federated:** Discovery mechanism connects consumers to producers
3. **Standards-based:** Common data formats enable interoperability
4. **Mode-agnostic:** Same architecture for highway, transit, rail, aviation
5. **Open access:** Public APIs with standard authentication (OAuth 2.0)

**Real-World Example:** DOT Corridor Communicator uses this exact architecture:
- Federates data from 15+ state DOT WZDx feeds
- RESTful API for applications to consume
- Standard GeoJSON output
- Works across state boundaries without central database

---

#### B2. How should TDI be integrated into the planning, design, construction, and operations of transportation infrastructure?

**Integration by Project Phase:**

**1. Planning Phase**
- **Requirement:** Infrastructure projects must assess TDI impacts in environmental/planning documents
- **Example:** Highway expansion study must document work zone data strategy
- **Data Need:** Historical traffic data, freight volumes, incident patterns from TDI feeds
- **TDI Input:** Use WZDx archives to analyze past work zone impacts and optimize future construction schedules

**2. Design Phase**
- **Requirement:** Include TDI infrastructure in project designs
- **Examples:**
  - Fiber optic conduit for ITS equipment connectivity
  - Power/comm for DMS signs, cameras, speed sensors
  - Physical mounting locations for connected vehicle equipment
- **Standard:** Require ITS equipment to support TDI data publishing (not proprietary vendor protocols)
- **Cost:** Add 2-5% to project budget for TDI-ready infrastructure

**3. Construction Phase**
- **Requirement:** Publish real-time work zone data in WZDx format for all federal-aid projects
- **Implementation:** Contractor must update WZDx feed daily with lane closures, schedule changes
- **Enforcement:** Make WZDx compliance a contract deliverable (like traffic control plans)
- **Real-World Challenge:** Corridor Communicator found some state feeds have stale/inaccurate data because contractors don't update them
- **Solution:** Automated data quality monitoring - flag work zones with no updates in 30+ days

**4. Operations Phase**
- **Requirement:** All operational ITS equipment must publish data via TDI APIs
- **Examples:**
  - DMS signs publish current messages in TMDD format
  - Traffic sensors publish speeds in probe data format
  - Cameras publish availability/status (not video streams, just metadata)
- **Procurement:** State DOTs must require TDI compliance in ITS equipment specifications
- **Mistake to Avoid:** Don't buy vendor-locked systems that can't export standard formats

**5. Asset Management Phase**
- **TDI Application:** Track ITS equipment health and maintenance via TDI
- **Example:** "Camera 123 offline" event published to TDI feeds
- **Integration:** Connect TDI to state DOT asset management systems (Maximo, Cartegraph, etc.)

**Project Delivery Integration:**

**Design-Build Projects:**
- Include "TDI Compliance Plan" in RFP requirements
- Contractor must document how they'll publish work zone data, incident data, ITS equipment status

**CMGC/P3 Projects:**
- TDI requirements in technical provisions
- Private partners must publish real-time data (no hiding construction impacts)

**Maintenance Contracts:**
- Maintenance contractors update WZDx feed with lane closures for routine maintenance
- Example: "Mowing operations on I-80 EB, right lane closed, MM 100-105"

**Challenges Encountered (Corridor Communicator Experience):**

**Challenge 1: Contractors Don't Maintain Data**
- State DOT requires WZDx, but contractor stops updating after project starts
- Result: Feed shows 50 active work zones, only 10 actually exist
- Solution: Automated staleness detection, contract penalties for non-compliance

**Challenge 2: Inconsistent Location Referencing**
- Some states use mileposts, others use lat/lon, others use road names
- Result: Difficult to map events to actual road locations
- Solution: Require both milepost AND lat/lon in WZDx (redundancy)

**Challenge 3: No Geometry for Work Zones**
- WZDx standard allows geometry to be optional
- Some feeds only provide single point, not full extent of work zone
- Solution: Corridor Communicator uses OSRM routing to generate curved geometry between start/end points (when OSRM works - see bidirectional carriageway problem)

**Policy Recommendation:**
Update 23 CFR Part 630 (Traffic Control Devices) to require TDI compliance for federal-aid highway projects.

**Financial Impact:**
Minimal - data publication infrastructure costs < 0.5% of typical highway project budget.

---

#### B3. What methods should be used for federating data sharing across States and regions?

**Recommended Approach: Decentralized Federation with Service Discovery**

**Architecture:**

1. **Each state hosts their own data feeds**
   - State maintains control and ownership
   - No requirement to send data to federal repository
   - Reduces privacy and sovereignty concerns

2. **Federal service registry catalogs available feeds**
   - JSON catalog listing all state feeds and their capabilities
   - Metadata: geographic coverage, update frequency, data types
   - Health monitoring (is feed currently operational?)

3. **Applications query registry, then fetch from states directly**
   - Discover which states cover your route
   - Fetch data directly from each state's API
   - Client-side aggregation of multi-state data

**Example Service Registry Entry:**
```json
{
  "state": "Iowa",
  "agency": "Iowa DOT",
  "feeds": [
    {
      "type": "wzdx",
      "url": "https://iowadot.gov/api/wzdx",
      "coverage": {
        "states": ["Iowa"],
        "corridors": ["I-80", "I-35", "I-380"]
      },
      "update_frequency": "5 minutes",
      "status": "operational"
    }
  ]
}
```

**Benefits:**
- States control their data (sovereignty)
- No single point of failure (resilience)
- Scales horizontally (add more states without central bottleneck)
- Low cost (no massive federal database)

**Governance:**
- USDOT operates service registry (lightweight)
- States commit to API uptime SLAs
- Standard authentication (API keys, OAuth 2.0)

**Proven:** This is exactly how RSS/Atom feeds work for news syndication - decentralized content, centralized discovery.

---

#### B4. What existing frameworks (e.g., ARC-IT) should be considered for TDI development?

**Framework Assessment:**

**1. ARC-IT (Architecture Reference for Cooperative and Intelligent Transportation)**
- **Status:** USDOT's official ITS reference architecture
- **Strengths:**
  - Comprehensive catalog of ITS equipment and interfaces
  - Widely adopted by state DOTs for systems engineering
  - Defines data flows between ITS components (TMC, DMS, sensors, etc.)
- **Weaknesses:**
  - Extremely complex (500+ interfaces, 100+ data flows)
  - Focuses on physical equipment, not federated data exchange
  - Predates modern web APIs and cloud architecture
  - Not designed for multi-jurisdictional data sharing
- **TDI Recommendation:** Use ARC-IT for local ITS equipment design, but DON'T use it as TDI architecture
- **Rationale:** ARC-IT is about "how does a TMC talk to a DMS sign" - TDI is about "how does Iowa share work zone data with Nebraska"

**2. WZDx (Work Zone Data Exchange)**
- **Status:** FHWA-sponsored standard, actively deployed
- **Strengths:**
  - Simple JSON schema, easy to implement
  - Growing adoption (20+ states publishing feeds)
  - Proven interoperability
  - Modern API design (RESTful)
- **Weaknesses:**
  - Limited to work zones (doesn't cover incidents, traffic speeds, etc.)
  - Some state implementations have data quality issues
- **TDI Recommendation:** WZDx is THE model for TDI standards
- **Action:** Expand WZDx model to incidents, closures, detours, weather

**3. TMDD (Traffic Management Data Dictionary)**
- **Status:** Legacy standard from early 2000s
- **Strengths:**
  - Comprehensive data definitions
  - Some state DOTs still use it
- **Weaknesses:**
  - XML-based (outdated technology)
  - Complex schema, difficult to implement
  - Poor adoption outside legacy systems
- **TDI Recommendation:** Deprecate TMDD in favor of JSON-based standards like WZDx
- **Migration:** Provide TMDD-to-WZDx conversion tools for legacy systems

**4. GTFS/GTFS-RT (General Transit Feed Specification)**
- **Status:** De facto standard for transit data
- **Strengths:**
  - Widely adopted (1000+ agencies)
  - Simple, practical design
  - Strong developer ecosystem
  - Proven interoperability
- **Weaknesses:**
  - Transit-only (doesn't cover highways)
- **TDI Recommendation:** GTFS is a perfect example of successful standardization
- **Lesson:** Simple, practical standards beat comprehensive-but-complex standards

**5. ITS DataBus**
- **Status:** FHWA research project for data exchange
- **Strengths:**
  - Conceptually similar to TDI federation model
- **Weaknesses:**
  - Never achieved wide deployment
  - Overly complex technical design
- **TDI Recommendation:** Learn from ITS DataBus failure - keep TDI simple

**6. ISO 14827 (Data Interfaces for ITS)**
- **Status:** International standard
- **Weaknesses:**
  - Designed for European systems
  - Not widely adopted in US
  - Doesn't address multi-jurisdictional federation
- **TDI Recommendation:** Don't adopt - focus on practical US deployments

**Lessons Learned from Existing Frameworks:**

**What Works (GTFS, WZDx model):**
- Simple JSON schemas
- RESTful APIs
- Lightweight, easy to implement
- Focus on ONE use case done well
- Developer-friendly documentation
- Open source reference implementations

**What Doesn't Work (TMDD, ARC-IT data dictionaries):**
- Complex XML schemas
- Trying to standardize everything at once
- Academic architecture without practical deployment
- Vendor-driven specifications (proprietary interests)

**TDI Architecture Should:**
1. **Adopt WZDx model** as template for all TDI data standards
2. **Ignore ARC-IT** for data federation (use it for local ITS equipment only)
3. **Deprecate TMDD** - migrate to JSON
4. **Learn from GTFS** - simple, focused, practical
5. **Avoid repeating ITS DataBus mistakes** - don't over-engineer

**Practical Recommendation:**
Create "WZDx family" of standards:
- WZDx (work zones) - EXISTS
- IncDx (incidents) - NEW, based on WZDx model
- CondDx (road conditions/weather) - NEW, based on WZDx model
- EventDx (planned events, detours) - NEW, based on WZDx model

All use same JSON structure, RESTful API pattern, GeoJSON geometry - just different event types.

**Corridor Communicator Experience:**
- Successfully consumes 15+ WZDx feeds (proof WZDx works)
- Generates GeoJSON output (modern, developer-friendly)
- Avoids complex standards like TMDD and ARC-IT data dictionaries
- Demonstrates that SIMPLE standards enable FAST deployment

---

#### B6. What are the highest-priority research gaps for achieving nationwide interoperability?

**Research Gaps (Prioritized by Deployment Timeline):**

**Tier 1 (Deploy within 2 years - tactical research):**

**1. Multi-Jurisdiction Linear Referencing**
- **Problem:** Each state uses different milepost systems, some reset at borders, some don't
- **Example:** "I-80 MM 100" means different locations in Iowa vs Nebraska
- **Research Need:**
  - Universal corridor-level linear referencing (mile 0 = start of Interstate in California, mile 2900 = end in New Jersey)
  - Conversion algorithms between state milepost systems and corridor-level system
  - Integration with GPS coordinates (lat/lon) for redundancy
- **Impact:** Enable seamless corridor analysis without complex coordinate transformations
- **Deployment:** Could be operational in 18-24 months

**2. Geospatial Data Quality and Validation**
- **Problem:** Different data sources have different coordinate precision, conflicting geometries
- **Real-World Example:** Corridor Communicator encountered "bidirectional carriageway problem" - OSM Interstate data mixes eastbound/westbound lanes
- **Research Need:**
  - Automated methods to separate directional roadways from mixed geospatial data
  - Quality scoring for route geometry (detect zigzag patterns, impossible turns)
  - Validation algorithms for geographic bounds (reject coordinates outside plausible regions)
- **Deployment:** Reference implementations within 12 months

**3. Real-Time Data Fusion and Conflict Resolution**
- **Problem:** Multiple sources report same event with different details (location, severity, timing)
- **Example:** State DOT reports incident at MM 100, Waze reports same incident at MM 101
- **Research Need:**
  - Event matching algorithms (probabilistic matching across data sources)
  - Conflict resolution rules (which source is authoritative for which attributes?)
  - Data quality weighting (trust high-quality sources more than low-quality)
- **Deployment:** Pilot implementations in 18 months

**Tier 2 (Deploy within 3-5 years - strategic research):**

**4. Route Geometry Generation and Snapping**
- **Problem:** Need curved road geometry for realistic event visualization, but routing services sometimes fail
- **Corridor Communicator Experience:** Layered approach: OSRM → Interstate polylines → straight line fallback
- **Research Need:**
  - Intelligent source selection (when to use routing service vs pre-built polylines)
  - Failure detection and automatic fallback strategies
  - Quality metrics for generated geometry
- **Deployment:** Operational reference implementations in 2-3 years

**5. Privacy-Preserving Probe Data Aggregation**
- **Problem:** Need real-time traffic speeds without tracking individual vehicles across jurisdictions
- **Research Need:**
  - Differential privacy algorithms for traffic data
  - K-anonymity thresholds for probe aggregation
  - Cross-border data aggregation without revealing individual trips
- **Deployment:** Pilot in 3-4 years (requires multi-state coordination)

**6. Cross-Modal Trip Planning and Data Integration**
- **Problem:** Highway data (WZDx) and transit data (GTFS) use different formats, coordinate systems
- **Research Need:**
  - Unified geospatial referencing across modes
  - Transfer point identification (where transit connects to highway)
  - Multimodal routing algorithms using federated data
- **Deployment:** 4-5 years (complex coordination)

**Tier 3 (Deploy beyond 5 years - emerging technology):**

**7. Connected Vehicle Message Routing Across Jurisdictions**
- **Problem:** CV2X messages (SPaT, MAP, TIM) need < 100ms latency - can't use cloud APIs
- **Research Need:**
  - Edge computing architectures for real-time message distribution
  - State boundary handoff protocols (vehicle crossing from Iowa to Illinois)
  - Integration with TDI for non-time-critical messages
- **Deployment:** 5-7 years (requires 5G infrastructure buildout)

**8. AI-Based Data Quality Monitoring and Remediation**
- **Problem:** Manual data quality checking doesn't scale to nationwide deployment
- **Research Need:**
  - ML models to detect data quality issues automatically
  - Anomaly detection for feed health monitoring
  - Automated correction suggestions for common errors
- **Deployment:** 5+ years (requires large training datasets)

**Biggest Gap NOT Being Addressed:**
**Governance models for multi-state data sharing**
- How do states agree on data quality standards?
- Who enforces compliance?
- What happens when a state's feed goes down for weeks?
- How to handle state DOTs that refuse to participate?

This is POLICY research, not technical research - but it's critical.

**Funding Recommendation:**
- Tier 1 research: $5M/year via SPR pooled fund studies
- Tier 2 research: $10M/year via FHWA ATTRI program
- Tier 3 research: $15M/year via ITS JPO research program
- Governance research: $2M/year via TRB/AASHTO committees

**Deliverable Requirements:**
- All research must produce open-source reference implementations
- No academic papers without working code
- Validation against real-world operational data (like Corridor Communicator)

---

#### B5. What are the necessary latency and throughput requirements for safety-critical applications?

**Requirements by Application Type:**

**Safety-Critical (V2X, Collision Warnings):**
- **Latency:** < 100ms end-to-end
- **Throughput:** 1000+ messages/second per corridor segment
- **Reliability:** 99.999% availability (5 nines)
- **Technology:** Dedicated Short Range Communications (DSRC) or 5G C-V2X
- **Not suitable for cloud-based REST APIs**

**Near-Real-Time (Work Zones, Incidents):**
- **Latency:** < 5 seconds end-to-end
- **Throughput:** 100+ updates/second per state
- **Reliability:** 99.9% availability (3 nines)
- **Technology:** HTTPS APIs with WebSocket push notifications
- **Proven:** Current WZDx deployments achieve this

**Real-Time Information (Traffic Speeds, Travel Times):**
- **Latency:** < 30 seconds end-to-end
- **Throughput:** 1000+ probe reports/second per corridor
- **Reliability:** 99.5% availability
- **Technology:** RESTful APIs with caching (CDN)
- **Proven:** Google Maps, Waze achieve this scale

**Traveler Planning (Schedules, Long-term Closures):**
- **Latency:** < 5 minutes acceptable
- **Throughput:** 10-100 requests/second per state
- **Reliability:** 99% availability
- **Technology:** Static files (JSON/XML) with CDN distribution

**Key Insight:** **Don't use the same infrastructure for everything.**
- V2X needs edge computing and 5G
- Work zones can use cloud APIs
- Planning data can be static files on CDN

**Mistake to Avoid:** Trying to build one system for all use cases. Physics and economics don't allow it.

---

### C. Artificial Intelligence and Automation

#### C1. How can TDI leverage artificial intelligence and machine learning to improve transportation outcomes?

**AI/ML Applications in TDI (Practical, Not Hype):**

**1. Data Quality Monitoring and Anomaly Detection**
- **Problem:** 15+ state WZDx feeds, impossible to manually check data quality daily
- **AI Solution:** Train ML model to detect anomalies
  - Work zone at impossible coordinates (ocean, wrong state)
  - Timestamp in the future or months in the past
  - Geometry that zigzags or has impossible turns
  - Event descriptions with gibberish text
- **Training Data:** Historical WZDx feeds with labeled good/bad records
- **Deployment:** Real-time scoring of incoming feed data
- **Impact:** Automatically flag bad data before it pollutes federated feeds
- **Cost:** Low - simple classification model, runs on CPU

**2. Event Matching and Deduplication Across Sources**
- **Problem:** Same incident reported by state DOT, Waze, connected vehicles - which is authoritative?
- **AI Solution:** Probabilistic matching based on:
  - Spatial proximity (within 1 mile)
  - Temporal proximity (within 15 minutes)
  - Event type similarity (incident vs work zone)
  - Data source reliability score
- **Output:** Merged event record with best attributes from each source
- **Corridor Communicator Experience:** Currently no deduplication - future enhancement
- **Impact:** Reduce duplicate events by 30-40% in federated feeds

**3. Feed Health Prediction and Proactive Alerting**
- **Problem:** State DOT feed goes down, takes hours to notice
- **AI Solution:** Model learns normal feed behavior
  - Typical update frequency
  - Expected number of events by time of day
  - Geographic distribution patterns
- **Anomaly:** Feed stops updating, or suddenly has 10x more events
- **Alert:** "Iowa WZDx feed appears down - no updates in 2 hours"
- **Impact:** Reduce feed outage detection time from hours to minutes

**4. Predictive Work Zone Impact Modeling**
- **Problem:** DOT schedules work zone, doesn't know actual traffic impact
- **AI Solution:** Train model on historical work zone data
  - Input: Work zone location, duration, lanes closed, time of day, day of week
  - Output: Predicted delay, queue length, diversion rate
- **Training Data:** Years of WZDx archives + probe speed data
- **Application:** DOT uses predictions to optimize work schedules
- **Impact:** Reduce work zone delays by 20-30% through better scheduling

**5. Incident Clearance Time Prediction**
- **Problem:** Travelers want to know "how long until this clears?"
- **AI Solution:** Model learns from historical incidents
  - Input: Incident type, severity, number of vehicles, weather, time of day
  - Output: Predicted clearance time (median, 90th percentile)
- **Application:** Traveler information apps show expected delay duration
- **Impact:** Better traveler decision-making (wait vs divert)

**What AI Should NOT Be Used For (Common Mistakes):**

**❌ "AI-powered traffic prediction"** - If you mean probe data aggregation, just say that. Don't call simple averaging "AI."

**❌ "Blockchain + AI for transportation"** - Buzzword soup with no practical application

**❌ "Self-driving TMCs"** - TMC operators need tools, not replacement

**❌ "AI selects optimal route for every traveler"** - Privacy nightmare, central control fantasy

**Key Principles:**

1. **AI augments humans, doesn't replace them**
   - Flag suspicious data, but human reviews before discarding
   - Predict incident duration, but TMC operator confirms

2. **Explainable AI only**
   - Must be able to explain why model flagged data as bad
   - No black-box deep learning for safety-critical decisions

3. **Model drift monitoring**
   - Traffic patterns change (COVID proved this)
   - Continuously retrain models on recent data
   - Alert when model predictions degrade

4. **Privacy-preserving ML**
   - Train on aggregate data, not individual trips
   - No personally identifiable information in training datasets
   - Federated learning for multi-jurisdictional models

**Corridor Communicator Path Forward:**
- Currently: No AI/ML (baseline system works without it)
- Phase 1: Data quality scoring for WZDx feeds
- Phase 2: Event deduplication across sources
- Phase 3: Feed health monitoring and prediction

**Research Investment:**
- Don't fund "AI for transportation" broadly
- Fund specific applications with clear success metrics
- Require open-source models and training data
- Validate on real-world operational systems

---

#### C2. How can TDI accelerate safe deployment of automated vehicles and drones?

**TDI Contributions to AV/Drone Safety:**

**For Automated Vehicles:**

**1. Real-Time Work Zone Information (WZDx via TDI)**
- **AV Need:** Advance warning of lane closures, barriers, changed traffic patterns
- **TDI Solution:** WZDx feeds provide structured work zone data
- **Integration:** AV onboard system queries TDI API before entering work zone corridor
- **Impact:** AV can plan lane changes, speed reductions before encountering work zone
- **Current Challenge:** WZDx geometry quality varies (Corridor Communicator generates curved geometry to address this)

**2. Incident and Closure Information**
- **AV Need:** Know about crashes, disabled vehicles, road closures
- **TDI Solution:** Incident data feeds (future IncDx standard)
- **Integration:** Push notifications to AVs in affected corridor segments
- **Impact:** AV can reroute or alert safety driver in time

**3. Weather and Road Condition Data**
- **AV Need:** Know when road is icy, flooded, low visibility
- **TDI Solution:** Road condition data feeds (future CondDx standard)
- **Integration:** AV queries TDI for corridor conditions
- **Impact:** AV can reduce speed, increase following distance, or pull over

**4. High-Definition Map Updates**
- **AV Need:** Current map data showing lane configurations, geometry
- **TDI Solution:** Federated geometry updates when roadway changes
- **Integration:** TDI pushes map deltas to AV HD map providers
- **Impact:** AV has accurate lane geometry in work zones and construction areas

**5. Connected Vehicle Message Integration**
- **AV Need:** Receive SPaT (signal phase and timing), TIM (traveler information messages)
- **TDI Solution:** Bridge between CV2X messages and cloud-based TDI
- **Integration:** AVs without CV2X radio can get messages via cellular/TDI
- **Limitation:** Higher latency (seconds vs milliseconds), not suitable for collision avoidance

**For Drones (UAS):**

**1. Temporary Flight Restrictions (TFRs) Related to Transportation**
- **Drone Need:** Know about helicopter operations at incident scenes
- **TDI Solution:** Major incidents publish TFR information
- **Integration:** Drone flight planning systems check TDI before routing
- **Impact:** Avoid conflicts with emergency response helicopters

**2. Infrastructure Inspection Coordination**
- **Drone Need:** Know when bridge inspection scheduled (for coordination)
- **TDI Solution:** Planned inspection activities in event feeds
- **Integration:** Multiple drone operators don't schedule same bridge same day
- **Impact:** Efficient infrastructure inspection coordination

**3. Delivery Drone Routing Around Work Zones**
- **Drone Need:** Avoid flying over active work zones (noise, safety)
- **TDI Solution:** WZDx provides work zone boundaries
- **Integration:** Drone routing avoids work zone airspace
- **Impact:** Reduced conflicts between drones and ground operations

**Critical Limitations (Don't Oversell TDI for AVs):**

**❌ TDI Cannot Provide:**
- **Sub-100ms latency** for collision avoidance (need CV2X or onboard sensors)
- **Centimeter-level positioning** (need RTK GPS or HD maps)
- **Real-time object detection** (need onboard lidar/cameras)
- **Vehicle-to-vehicle communication** for platooning (need DSRC/C-V2X)

**✅ TDI Can Provide:**
- **Advance warning** (minutes to hours) of changed conditions
- **Corridor-level awareness** of work zones, incidents, closures
- **Fallback data source** when CV2X not available
- **Historical data** for AV testing and validation

**Deployment Timeline:**

**2026-2028 (Near-term):**
- AVs consume WZDx feeds for work zone awareness
- Geo-fenced AV operations avoid active work zones
- TDI provides backup to onboard sensors (redundancy)

**2028-2032 (Mid-term):**
- TDI provides real-time incident/closure data to AVs
- HD map updates via TDI for temporary geometry changes
- Integration with smart infrastructure (connected signals, signs)

**2032+ (Long-term):**
- Widespread AV adoption relies on TDI for corridor awareness
- Drone package delivery integrated with TDI for routing
- Automated work zones report status via TDI

**Policy Recommendations:**

1. **Don't mandate TDI for AVs yet** - Technology still evolving
2. **Encourage voluntary integration** - Provide reference APIs for AV developers
3. **Focus TDI on human-driven vehicles first** - Proven use case
4. **Avoid conflating TDI with CV2X** - Different technologies, different use cases

**Corridor Communicator Contribution:**
- Demonstrates WZDx data can generate curved geometry suitable for AV planning
- Proves federated data works across jurisdictions (AV cross-border operations)
- Provides real-world testbed for AV integration research

**Research Needs:**
- AV-TDI integration standards (how should AVs query TDI APIs?)
- Latency requirements for different AV use cases
- Fallback strategies when TDI data unavailable
- Liability frameworks when AV relies on TDI data

---

#### C3. What are the highest-value, near-term AI applications enabled by comprehensive sensing and data sharing?

**Top 5 Near-Term AI Applications (2-3 year timeframe):**

**1. Predictive Work Zone Impact Analysis**
- **Input:** Historical work zone data (WZDx), traffic volumes, weather
- **Output:** Predicted delay, optimal work schedule
- **Impact:** Reduce congestion by 20-30% through better scheduling
- **Deployment:** State DOTs can implement today with existing data

**2. Incident Detection and Verification**
- **Input:** Probe data (speeds), connected vehicle alerts, camera feeds
- **Output:** Confirmed incident location, severity, clearance time estimate
- **Impact:** Reduce incident detection time from 10 min to < 1 min
- **Deployment:** Requires data fusion across sources

**3. Dynamic Lane Management**
- **Input:** Real-time traffic, incidents, work zones, weather
- **Output:** Optimal lane use (reversible lanes, shoulder running)
- **Impact:** Increase capacity 15-25% without new construction
- **Deployment:** Requires actuated signs and coordinated TMC control

**4. Freight Bottleneck Prediction**
- **Input:** Truck GPS, weigh station data, port schedules
- **Output:** Expected delays at key freight chokepoints
- **Impact:** $2-3B annual savings in freight efficiency
- **Deployment:** Requires state DOT + private sector data sharing

**5. Traveler Demand Prediction**
- **Input:** Historical travel patterns, events, holidays, weather forecasts
- **Output:** Predicted traffic volumes 24-72 hours ahead
- **Impact:** Enable proactive management (variable pricing, ramp metering)
- **Deployment:** Requires multi-year data archive

**Common Requirements:**
- Clean, standardized data (WZDx, GTFS, probe data)
- Cloud compute infrastructure
- Model training on historical data
- Real-time inference pipelines

**Not Sci-Fi:** These are proven applications already deployed in some regions. TDI would make them accessible to all states.

---

#### C4. What measures are needed to ensure safe and secure AI deployment across jurisdictions?

**AI Safety Framework for TDI:**

**1. Model Validation and Testing Requirements**

**Before Deployment:**
- **Test on historical data:** Validate AI models on 2+ years of archived data
- **Cross-jurisdictional validation:** Model trained on Iowa data must work on Nebraska data
- **Edge case testing:** Test on anomalies (extreme weather, major incidents, system outages)
- **Performance benchmarks:** Minimum precision/recall thresholds before production deployment

**Example from Corridor Communicator:**
- Before deploying geometry validation, test on archived WZDx feeds
- Verify it doesn't flag valid events as anomalies
- Measure false positive rate (< 5% acceptable)

**2. Explainability and Human Oversight**

**Principle: AI Recommends, Human Decides**
- AI flags suspicious data → Human reviews → Human approves/rejects
- AI predicts incident duration → Display with confidence interval → TMC operator can override
- No fully automated decisions for safety-critical operations

**Transparency Requirements:**
- Model must explain WHY it flagged data as anomalous
- Example: "Flagged because coordinates are 500 miles outside state boundary"
- No black-box deep learning for operational decisions

**Human-in-the-Loop Design:**
- Real-time dashboard showing AI recommendations
- One-click approval/rejection interface
- Audit trail of human decisions vs AI recommendations
- Continuous feedback loop for model improvement

**3. Model Drift Monitoring**

**Problem:** Traffic patterns change over time (COVID proved this)
- Model trained on 2019 data performed poorly in 2020
- Work zone impacts different with remote work
- Incident clearance times change with new technology

**Solution: Continuous Monitoring**
- Track model prediction accuracy weekly
- Alert when accuracy drops below threshold
- Automatic retraining on recent data (rolling 6-month window)
- A/B testing of new models before full deployment

**Corridor Communicator Example:**
- If geometry validation starts flagging 20% of events (vs baseline 5%), investigate
- Possible causes: State changed coordinate system, OSM data updated, actual data quality degraded

**4. Privacy-Preserving AI Across Jurisdictions**

**Challenge:** Train AI model on multi-state data without sharing sensitive data

**Federated Learning Approach:**
- Each state trains model on their local data
- Share only model weights, not raw data
- Aggregate weights into national model
- No personally identifiable information leaves state boundaries

**Differential Privacy:**
- Add noise to training data to prevent individual trip reconstruction
- Aggregate before sharing (traffic volumes, not individual vehicles)
- K-anonymity thresholds (minimum N vehicles before reporting statistics)

**Data Minimization:**
- Only collect data necessary for specific AI application
- Don't use AI as excuse to collect more data
- Example: Work zone impact prediction needs work zone location + aggregate traffic volumes, NOT individual vehicle trips

**5. Cybersecurity for AI Systems**

**Adversarial Attack Prevention:**
- **Data Poisoning:** Attacker feeds bad data to corrupt model training
  - Defense: Multi-source validation, outlier detection before training
- **Model Evasion:** Attacker crafts input to fool model
  - Defense: Ensemble models, anomaly detection
- **Model Inversion:** Attacker reconstructs training data from model
  - Defense: Differential privacy, limit model access

**API Security for AI Services:**
- Rate limiting (prevent abuse of model inference APIs)
- Authentication (only authorized agencies can query models)
- Input validation (reject malformed requests before hitting model)
- Output sanitization (prevent model from leaking sensitive info)

**6. Governance and Accountability**

**Who Owns AI Models in TDI?**

**Option A: Centralized Federal Models**
- USDOT trains and operates AI models
- States consume model outputs
- Pro: Consistency, economies of scale
- Con: One-size-fits-all, federal bureaucracy

**Option B: Decentralized State Models**
- Each state trains their own models
- Share best practices, reference implementations
- Pro: State sovereignty, customization
- Con: Duplication of effort, inconsistency

**Recommended: Hybrid Approach**
- USDOT provides reference AI implementations (open source)
- States can use as-is or customize for local needs
- Multi-state pooled fund studies for specialized models
- Mandatory safety standards, voluntary model implementations

**Liability Framework:**
- If AI model causes harm (bad recommendation leads to crash), who is liable?
- **Recommended:** Human decision-maker is liable, not AI model provider
- Rationale: AI recommends, human decides → human accountability
- Requires: Proper training, clear documentation of AI limitations

**7. Auditing and Certification**

**AI Model Certification Program:**
- USDOT publishes AI safety standards for TDI applications
- Third-party testing labs certify model compliance
- States can require certified models for safety-critical uses
- Annual recertification (models drift over time)

**Audit Requirements:**
- Maintain audit trail of all AI recommendations and human decisions
- Quarterly review of model performance metrics
- Incident investigation when AI makes bad recommendations
- Public transparency reports (aggregate model performance, not individual decisions)

**8. Cross-Jurisdictional Coordination**

**Multi-State AI Governance Committee:**
- Representatives from state DOTs, USDOT, industry
- Approve AI safety standards for TDI
- Review incident reports involving AI systems
- Recommend updates to AI policies

**Regional AI Testbeds:**
- I-95 Corridor Coalition could pilot AI governance framework
- Test multi-state model deployment
- Validate privacy-preserving federated learning
- Document lessons learned for national rollout

**Practical Example - Corridor Communicator Path:**

**Phase 1 (Current):** No AI - baseline system establishes trust
**Phase 2 (12 months):** Data quality scoring
  - Transparent rule-based algorithm (not ML)
  - Human reviews all flagged records
  - Audit trail of decisions
**Phase 3 (24 months):** ML-based anomaly detection
  - Trained on 2 years of operational data
  - Explainable model (decision trees, not deep learning)
  - A/B testing against rule-based system
  - Gradual rollout with human oversight
**Phase 4 (36 months):** Federated learning across state DOT feeds
  - Multi-state governance framework established
  - Privacy-preserving training protocols
  - Independent certification of model safety

**What NOT to Do:**

❌ Deploy black-box AI without human oversight
❌ Train on biased data without validation
❌ Use AI to centralize control over state operations
❌ Ignore model drift and assume models stay accurate forever
❌ Share sensitive data across jurisdictions for AI training
❌ Deploy AI to cut costs by eliminating human operators

**Research Needs:**
- Federated learning protocols for transportation data
- Adversarial robustness testing for traffic prediction models
- Privacy-preserving anomaly detection algorithms
- Human factors research on AI-human collaboration in TMCs

**Funding:** $5M/year via ITS JPO for AI safety research

---

### D. Data Governance, Privacy, and Cybersecurity

#### D1. What data governance principles, access controls, and cybersecurity measures are needed?

**Data Governance Framework:**

**Principle 1: Data Minimization**
- Only collect what's operationally necessary
- Don't require personal identifiable information (PII) for public safety data
- Example: Work zone locations are public info - no authentication needed

**Principle 2: Tiered Access Model**

| Data Tier | Examples | Access Control | Justification |
|-----------|----------|----------------|---------------|
| **Public** | Work zones, incidents, road closures | Open API (no auth) | Public safety benefit > privacy risk |
| **Registered** | Historical traffic data, analytics | API key required | Prevent abuse, track usage |
| **Restricted** | Personally identifiable trips, license plates | OAuth + DUA | Strong privacy concerns |
| **Confidential** | Law enforcement, security cameras | VPN + encryption | National security implications |

**Cybersecurity Measures:**

1. **API Security:**
   - HTTPS/TLS 1.3 mandatory (no HTTP)
   - Rate limiting (prevent DoS)
   - API key rotation every 90 days
   - OAuth 2.0 for user-specific data

2. **Data Validation:**
   - Schema validation (reject malformed data)
   - Geographic bounds checking (reject impossible coordinates)
   - Timestamp validation (reject stale data)
   - Prevents data poisoning attacks

3. **Monitoring:**
   - Anomaly detection (unusual traffic patterns)
   - Feed health monitoring (detect outages)
   - Security event logging (SIEM integration)

4. **Incident Response:**
   - 24/7 SOC for critical feeds
   - Automated failover to backup systems
   - Data breach notification protocol (48 hour disclosure)

**Privacy-Preserving Techniques:**
- Aggregate trip data before sharing (never individual vehicles)
- Differential privacy for traffic analytics
- K-anonymity for origin-destination studies
- Geographic aggregation (traffic circles, not individual intersections)

**Real Example:** DOT Corridor Communicator:
- Public WZDx data requires no authentication
- Open source code allows security audit
- HTTPS-only API
- No PII collected

---

#### D2. What models for secure data exchange should be prioritized?

**Data Exchange Models for TDI (Prioritized):**

**Tier 1: Decentralized Federation (RECOMMENDED)**

**Model:**
- Each state DOT hosts their own data feeds (WZDx, incidents, etc.)
- Federal service registry catalogs available feeds
- Applications query registry, then fetch directly from state APIs
- No central data warehouse

**Security:**
- State controls access to their data (sovereignty)
- No single point of failure (federal database compromise doesn't expose all data)
- State-level authentication (API keys, OAuth)
- HTTPS/TLS 1.3 mandatory

**Example:** DOT Corridor Communicator uses this model
- Queries 15+ state WZDx feeds directly
- Aggregates client-side
- No federal database intermediary

**Pros:**
- State data sovereignty
- Horizontal scalability
- Low federal infrastructure cost
- Resilient to outages

**Cons:**
- Applications must handle multi-source aggregation
- No guarantee of feed uptime by individual states
- Potential inconsistency in data quality

**When to Use:** Public safety data (work zones, incidents), non-time-critical applications

---

**Tier 2: Hub-and-Spoke with Caching (for high-traffic applications)**

**Model:**
- States push data to federal cache/CDN
- Applications query federal endpoint
- Federal system aggregates and serves cached data
- Cache refreshes every 1-5 minutes

**Security:**
- States authenticate to federal hub (mutual TLS)
- Federal hub enforces access controls
- CDN provides DDoS protection
- Rate limiting per consumer

**Example:** Could be used for national traveler information apps

**Pros:**
- Faster for applications (one query vs many)
- Federal caching reduces load on state servers
- Consistent data format/quality enforcement
- CDN provides global low-latency access

**Cons:**
- Central point of failure
- Federal infrastructure cost
- Data latency (cache refresh lag)
- States must push data (not just host)

**When to Use:** High-traffic public APIs, mobile app backends

---

**Tier 3: Peer-to-Peer with Blockchain Registry (NOT RECOMMENDED)**

**Model:**
- Blockchain ledger tracks data sources
- Peer-to-peer data exchange
- Smart contracts enforce access controls

**Why NOT Recommended:**
- Unnecessary complexity
- Blockchain doesn't solve any actual TDI problem
- High energy/compute cost
- Immutability is a BUG not a feature (can't delete bad data)
- Decentralized federation already achieves same benefits

**Verdict:** Blockchain for TDI is solution looking for a problem

---

**Tier 4: Private Sector Intermediaries**

**Model:**
- State DOTs provide data to private sector aggregators (Waze, Inrix, Here, etc.)
- Private companies value-add (data fusion, quality control)
- Applications consume from private sector APIs
- Federal government facilitates partnerships

**Security:**
- Governed by contracts/data use agreements
- Private sector liable for data breaches
- Competitive market for quality

**Examples:**
- Waze Connected Citizens Program
- Inrix traffic data aggregation
- HERE HD map data

**Pros:**
- Private sector innovation
- Quality competition
- Reduces federal/state infrastructure burden
- Market-driven sustainability

**Cons:**
- Vendor lock-in risk
- Pricing/access concerns
- Less public oversight
- Proprietary formats

**When to Use:** Commercial applications, value-added services beyond raw TDI data

---

**Security Requirements Across All Models:**

**1. Transport Security**
- HTTPS/TLS 1.3 mandatory (no HTTP, no TLS 1.2)
- Certificate validation (no self-signed certs in production)
- Perfect forward secrecy

**2. Authentication**
- Public APIs: No auth for public safety data (work zones, incidents)
- Registered APIs: API keys with rate limiting
- Restricted APIs: OAuth 2.0 + Data Use Agreements
- Federal-state exchanges: Mutual TLS

**3. Authorization**
- Role-based access control (state DOT, federal agency, private sector, public)
- Scope-limited tokens (read-only, write, admin)
- Least privilege principle

**4. Data Validation**
- Schema validation (reject malformed JSON)
- Geographic bounds checking (reject impossible coordinates)
- Timestamp validation (reject future dates, stale data)
- Rate limiting (prevent DoS via excessive queries)

**5. Audit Logging**
- Log all API access (who, what, when)
- Retain logs for 90 days minimum
- SIEM integration for anomaly detection
- Privacy-preserving logs (don't log PII)

**6. Incident Response**
- 24/7 security operations center (SOC) for critical feeds
- Automated threat detection
- Incident notification protocol (48-hour disclosure)
- Coordinated vulnerability disclosure program

**Corridor Communicator Implementation:**

**Current (Tier 1 - Decentralized Federation):**
- Fetches from 15+ state APIs directly
- Client-side aggregation
- HTTPS only
- No authentication required (public data)
- Geographic bounds validation
- Timestamp validation

**Future Enhancements:**
- API key requirement for bulk access (prevent abuse)
- Rate limiting (100 requests/minute per client)
- Redis caching layer (reduce load on state feeds)
- Feed health monitoring dashboard

**Recommended Federal Action:**

1. **Publish TDI Security Profile** (based on NIST CSF)
2. **Provide reference implementations** with security baked in
3. **Operate lightweight service registry** (Tier 1 model)
4. **DON'T build central data warehouse** unless specific use case demands it
5. **Facilitate private sector partnerships** for value-added services

**Research Needs:**
- Zero-trust architecture for multi-jurisdictional data sharing
- Privacy-preserving analytics on federated data
- Automated security compliance testing for state DOT APIs

---

#### D3. What are the most significant threat vectors and how should they be addressed?

**TDI Threat Landscape (Prioritized by Likelihood × Impact):**

**Threat 1: Data Poisoning (High Likelihood, High Impact)**

**Attack:** Adversary injects false data into TDI feeds to cause harm
- Fake work zone causes traffic diversion, creates congestion
- False incident report causes panic, unnecessary responses
- Spoofed road closure disrupts commerce

**Real-World Example:** Corridor Communicator encountered this indirectly - some state feeds have stale/inaccurate work zones because contractors don't update them

**Mitigations:**
- **Data validation:** Geographic bounds checking, timestamp validation, schema compliance
- **Multi-source verification:** Cross-reference work zones against permit databases
- **Anomaly detection:** Flag sudden appearance of unusual events
- **Source authentication:** Verify data comes from authorized state DOT
- **Human review:** TMC operator confirms suspicious events before publishing

**Corridor Communicator Defenses:**
- Rejects coordinates outside US boundaries
- Flags events with timestamps > 30 days old
- Schema validation on all WZDx feeds

---

**Threat 2: Denial of Service (DoS) (Medium Likelihood, High Impact)**

**Attack:** Overwhelm TDI APIs with excessive requests, taking down feeds

**Scenarios:**
- Botnet floods state DOT WZDx API → state feed goes offline → travelers lack work zone information
- DDoS on federal service registry → discovery mechanism fails → all applications can't find feeds

**Real-World Risk:** State DOT servers often have limited capacity, vulnerable to volumetric attacks

**Mitigations:**
- **Rate limiting:** Max 100 requests/minute per IP address
- **CDN/DDoS protection:** Cloudflare, AWS CloudFront in front of APIs
- **API gateway:** Centralized rate limiting, throttling, circuit breakers
- **Federated architecture:** If one state feed goes down, others continue operating
- **Caching:** Reduce load on origin servers

**Corridor Communicator Exposure:**
- Currently queries 15+ state APIs every 5 minutes
- If Corridor Communicator went viral, could inadvertently DoS state servers
- **Mitigation needed:** Implement caching layer, reduce polling frequency

---

**Threat 3: Man-in-the-Middle (MitM) Attacks (Low Likelihood, Medium Impact)**

**Attack:** Intercept TDI API traffic, modify data in transit

**Scenario:**
- Traveler queries TDI for work zones
- Attacker intercepts traffic, removes work zone from response
- Traveler drives into work zone unexpectedly

**Mitigations:**
- **HTTPS/TLS 1.3 mandatory:** Encrypts data in transit
- **Certificate pinning:** Apps validate server certificates
- **HSTS (HTTP Strict Transport Security):** Force HTTPS, prevent downgrade attacks

**Current Industry Practice:**
- Most state DOT feeds already use HTTPS
- Corridor Communicator validates TLS certificates

---

**Threat 4: Compromised State DOT Credentials (Medium Likelihood, Critical Impact)**

**Attack:** Attacker steals state DOT API keys/credentials, publishes malicious data

**Scenario:**
- Phishing attack on state DOT employee
- Attacker obtains API credentials for WZDx feed
- Publishes fake work zones across entire state
- Causes widespread traffic disruption

**Mitigations:**
- **Multi-factor authentication (MFA):** Require MFA for API credential issuance
- **Credential rotation:** Rotate API keys every 90 days
- **IP allowlisting:** Restrict API write access to known state DOT IP addresses
- **Anomaly detection:** Flag unusual publish patterns (e.g., 100 work zones added in 5 minutes)
- **Digital signatures:** State DOT signs feed with private key, consumers verify with public key

**Corridor Communicator Relevance:**
- Currently read-only consumer, not vulnerable to this
- But if states adopt write APIs for contractors to update WZDx, this becomes critical

---

**Threat 5: Supply Chain Attacks (Low Likelihood, Critical Impact)**

**Attack:** Compromise software dependencies used by TDI systems

**Scenarios:**
- Malicious npm package in Corridor Communicator codebase exfiltrates state feed data
- Compromised Docker image for federal service registry contains backdoor
- Trojanized ITS equipment firmware reports false sensor data

**Mitigations:**
- **Software Bill of Materials (SBOM):** Track all dependencies
- **Dependency scanning:** Automated vulnerability scanning (Snyk, Dependabot)
- **Code signing:** Digitally sign software releases
- **Container security:** Scan Docker images for vulnerabilities
- **Secure boot:** ITS equipment verifies firmware authenticity

**Corridor Communicator Practices:**
- Uses Node.js with npm dependencies → vulnerable to supply chain attacks
- **Mitigation:** Dependency scanning via GitHub security alerts
- **Future:** Generate SBOM, pin dependency versions

---

**Threat 6: Privacy Violations (Medium Likelihood, High Regulatory Impact)**

**Attack:** TDI inadvertently exposes personally identifiable information (PII)

**Scenarios:**
- Probe data feed includes individual vehicle IDs → tracking across jurisdictions
- Work zone feed includes contractor employee names/phone numbers
- Image data from traffic cameras includes license plates

**Mitigations:**
- **Data minimization:** Don't collect PII in the first place
- **Aggregation:** Report traffic speeds for segments, not individual vehicles
- **Anonymization:** Strip identifiers before publishing
- **Access controls:** PII-containing data requires OAuth + DUA
- **Privacy impact assessments:** Evaluate new data types before publishing

**Corridor Communicator Approach:**
- WZDx feeds contain no PII (work zone locations only)
- No probe data, no camera feeds, no individual trip data
- **By design:** Cannot violate privacy if you don't collect PII

---

**Threat 7: Insider Threats (Low Likelihood, Medium Impact)**

**Attack:** State DOT employee abuses access to TDI systems

**Scenarios:**
- Employee exfiltrates traffic data for personal gain (sells to competitors)
- Disgruntled employee publishes false data to cause chaos
- Employee disables feed to disrupt operations

**Mitigations:**
- **Least privilege:** Employees only access data necessary for their job
- **Audit logging:** Track all system access, flag anomalies
- **Background checks:** Screen employees with access to critical systems
- **Separation of duties:** Require two-person approval for high-risk operations
- **Anomaly detection:** Flag unusual access patterns

**Governance:**
- Federal TDI-ISAC coordinates incident response across states
- Insider threat working group shares best practices

---

**Quantified Risk Assessment:**

| Threat | Likelihood | Impact | Risk Score | Priority |
|--------|-----------|--------|------------|----------|
| Data Poisoning | High | High | 9 | 1 |
| Denial of Service | Medium | High | 6 | 2 |
| Compromised Credentials | Medium | Critical | 8 | 3 |
| Privacy Violations | Medium | High | 6 | 4 |
| Supply Chain | Low | Critical | 5 | 5 |
| MitM Attacks | Low | Medium | 2 | 6 |
| Insider Threats | Low | Medium | 2 | 7 |

**Funding Priorities:**
1. Data validation infrastructure ($3M/year)
2. DDoS protection for state feeds ($2M/year)
3. MFA deployment for state DOT APIs ($1M/year)
4. Privacy compliance tools ($1M/year)
5. Supply chain security scanning ($500K/year)

---

#### D4. How should U.S. DOT apply the NIST Cybersecurity Framework (CSF) to TDI development?

**NIST CSF Applied to TDI:**

**1. IDENTIFY**
- Asset Inventory: Catalog all TDI data feeds, APIs, infrastructure
- Risk Assessment: Identify threats (data poisoning, DoS, privacy breaches)
- Governance: Establish roles (who owns what data, who authorizes access)

**TDI Application:**
- Maintain registry of all state DOT feeds
- Classify data sensitivity (public, registered, restricted)
- Document data lineage (source, transformations, consumers)

**2. PROTECT**
- Access Control: Implement tiered authentication (see D1)
- Data Security: Encrypt in transit (TLS) and at rest (AES-256)
- Training: Educate state DOT staff on secure API design

**TDI Application:**
- Mandate HTTPS for all TDI APIs
- Provide reference implementations with security baked in
- Annual cybersecurity training for TDI operators

**3. DETECT**
- Anomaly Detection: Monitor for unusual API usage patterns
- Feed Monitoring: Detect outages or data quality degradation
- Security Monitoring: Log and analyze authentication events

**TDI Application:**
- Real-time dashboard showing feed health across all states
- Automated alerts for API abuse (excessive requests)
- SIEM integration for security events

**4. RESPOND**
- Incident Response Plan: Documented procedures for breaches
- Communication: Notification protocols for stakeholders
- Mitigation: Automated blocking of malicious API consumers

**TDI Application:**
- National TDI incident response team (USDOT + state DOT reps)
- 48-hour breach notification requirement
- Automated API key revocation for detected abuse

**5. RECOVER**
- Recovery Planning: Backup and restore procedures
- Redundancy: Multiple data sources for critical feeds
- Lessons Learned: Post-incident reviews to improve security

**TDI Application:**
- Require states to maintain backup feeds
- Document recovery time objectives (RTO < 1 hour for safety-critical)
- Annual tabletop exercises simulating TDI outages

**Specific Recommendations:**
- USDOT should publish **TDI Security Profile** (customized NIST CSF)
- Require state DOTs to self-certify CSF compliance annually
- Provide federal funding for states to achieve compliance
- Establish **TDI-ISAC** (Information Sharing and Analysis Center)

**Not Optional:** Make NIST CSF compliance a requirement for federal transportation funding.

---

#### D5. How should TDI align with federal data strategies and initiatives?

**Alignment with Federal Data Initiatives:**

**1. Federal Data Strategy (2020)**

**FDS Principle 1: Uphold Ethics**
- **TDI Application:** Tiered access model protects privacy while enabling public safety applications
- **Example:** Work zone data is public (no ethics concerns), probe data requires anonymization
- **Corridor Communicator:** No PII collected, ethics by design

**FDS Principle 2: Exercise Responsibility**
- **TDI Application:** States own and control their data, federal government facilitates but doesn't centralize
- **Governance:** State data sovereignty, federal standards coordination
- **Avoid:** Federal data warehouse that removes state control

**FDS Principle 3: Promote Transparency**
- **TDI Application:** Open source reference implementations, public API documentation
- **Example:** Corridor Communicator codebase is open source on GitHub
- **Requirement:** All TDI standards published publicly, no proprietary specifications

**FDS Practice 1: Inventory Data Assets**
- **TDI Application:** Federal service registry catalogs all state DOT data feeds
- **Metadata:** Geographic coverage, update frequency, data quality metrics
- **Maintenance:** States update registry when feeds change

**FDS Practice 6: Convey Insights from Data**
- **TDI Application:** Federated data enables corridor-level analytics
- **Example:** Multi-state work zone impact analysis using aggregated WZDx data
- **Deliverable:** Annual TDI Data Report showing nationwide coverage, data quality trends

**FDS Practice 10: Practice Accountability**
- **TDI Application:** Audit logs for API access, incident response protocols
- **Governance:** Multi-state TDI governance committee
- **Transparency:** Public dashboard showing feed health across all states

---

**2. Open Data Policy (M-13-13)**

**Requirement: Make Data Open by Default**
- **TDI Compliance:** Public safety data (work zones, incidents, road conditions) requires no authentication
- **Exception:** Sensitive data (law enforcement, security cameras) remains restricted
- **Standard:** JSON/GeoJSON (open formats), not proprietary formats

**Requirement: Machine-Readable Formats**
- **TDI Compliance:** RESTful APIs returning JSON (not PDFs or HTML)
- **Example:** WZDx feeds are JSON, not legacy XML (TMDD)
- **Avoid:** Requiring screen scraping or manual data extraction

**Requirement: Accessible via APIs**
- **TDI Compliance:** All state DOT feeds must provide APIs, not just file downloads
- **Standard:** HTTPS GET endpoints, no SOAP or complex authentication for public data
- **Corridor Communicator:** Consumes REST APIs from 15+ states

**Requirement: Metadata and Documentation**
- **TDI Compliance:** Federal service registry includes metadata for each feed
- **Standards:** Data.gov metadata schema
- **Requirement:** States must document API endpoints, data schemas, update frequency

---

**3. Geospatial Data Act of 2018**

**GDA Requirement: National Spatial Data Infrastructure (NSDI)**
- **TDI Alignment:** Transportation data is geospatial (coordinates, geometry)
- **Integration:** TDI data published to GeoPlatform.gov
- **Standards:** GeoJSON, WGS84 coordinate system

**GDA Requirement: Geospatial Data Standards**
- **TDI Compliance:** Common Location Referencing (linear referencing for highways)
- **Challenge:** Each state uses different milepost systems
- **Research Need:** Universal corridor-level linear referencing (see B6)

**GDA Requirement: FGDC Coordination**
- **TDI Governance:** Coordinate with Federal Geographic Data Committee
- **Action:** Establish Transportation Subcommittee under FGDC
- **Deliverable:** TDI Geospatial Standards Profile

---

**4. Evidence Act of 2018 (Foundations for Evidence-Based Policymaking)**

**Evidence Act: Chief Data Officers**
- **TDI Alignment:** USDOT CDO coordinates TDI data strategy
- **Responsibility:** Publish annual TDI data inventory, quality metrics
- **Coordination:** Work with state DOT data officers

**Evidence Act: Data Inventories**
- **TDI Compliance:** Federal service registry IS the TDI data inventory
- **Metadata:** Coverage, quality, availability, access methods
- **Update Frequency:** Real-time (registry reflects current feed status)

**Evidence Act: Open Data**
- **TDI Compliance:** Align with Open Data Policy (M-13-13)
- **Requirement:** Publish TDI data on Data.gov
- **Challenge:** Federated architecture means data lives with states, not federal government

---

**5. National Security Memorandum on Critical Infrastructure (NSM-22)**

**NSM-22:** Transportation is Critical Infrastructure**
- **TDI Relevance:** TDI systems are part of transportation critical infrastructure
- **Security Requirement:** Apply NIST CSF to TDI (see D4)
- **Incident Response:** TDI-ISAC for coordinated security monitoring

**NSM-22: Resilience**
- **TDI Architecture:** Federated design provides resilience
- **No Single Point of Failure:** If one state feed goes down, others continue operating
- **Redundancy:** Multiple data sources for critical corridors (state DOT + private sector)

**NSM-22: Public-Private Partnership**
- **TDI Model:** Facilitate partnerships with Waze, Inrix, Here, etc.
- **Benefit:** Private sector provides resilience, innovation
- **Governance:** Data sharing agreements, not federal mandates

---

**6. AI Executive Order (EO 14110)**

**EO Requirement: Manage AI Risks**
- **TDI Application:** AI safety framework for TDI (see C4)
- **Standards:** Explainable AI, human oversight, model validation
- **Governance:** AI certification program for TDI applications

**EO Requirement: Advance Responsible AI Innovation**
- **TDI Approach:** Fund practical AI research (data quality, anomaly detection)
- **Avoid:** AI hype, blockchain buzzwords
- **Deliverable:** Open source AI reference implementations

---

**7. Cybersecurity Executive Order (EO 14028)**

**EO Requirement: Improve Software Supply Chain Security**
- **TDI Compliance:** Software Bill of Materials (SBOM) for TDI systems
- **Example:** Corridor Communicator should generate SBOM for npm dependencies
- **Standards:** SPDX or CycloneDX SBOM formats

**EO Requirement: Zero Trust Architecture**
- **TDI Application:** Verify every API request, never trust by default
- **Implementation:** API authentication even for internal federal systems
- **Principle:** "Never trust, always verify"

**EO Requirement: Incident Response**
- **TDI Application:** 48-hour breach notification requirement
- **Coordination:** TDI-ISAC coordinates multi-state incident response
- **Transparency:** Public disclosure of significant security incidents

---

**Cross-Cutting Recommendations:**

**Data Governance Council**
- **Members:** USDOT (lead), DOT CDO, FGDC, CISA, state DOT representatives
- **Purpose:** Coordinate TDI data policy across federal initiatives
- **Frequency:** Quarterly meetings, annual TDI data strategy update

**Avoid Duplication:**
- Don't create new data portals - use existing Data.gov infrastructure
- Don't create new security frameworks - apply existing NIST CSF
- Don't create new geospatial standards - adopt FGDC standards

**Funding Mechanism:**
- Use existing federal grant programs (FHWA, FTA, ITS JPO)
- Make TDI compliance a funding requirement, not a new program
- Leverage state SPR funds for pooled TDI research

**Metrics and Accountability:**
- Annual TDI Report Card: state-by-state coverage, data quality, uptime
- Public dashboard: real-time feed health across all 50 states
- Congressional testimony: USDOT reports TDI progress annually

---

#### D6. How can legacy and proprietary data sources be incorporated into TDI?

**Challenge: Integrating Heterogeneous Data Sources**

**Problem Statement:**
- State DOTs use proprietary vendor systems (ATMS, SunGuide, IRIS, etc.)
- Legacy systems use old formats (TMDD XML, NTCIP, vendor-specific protocols)
- No budget to replace existing ITS equipment
- Vendors may resist open data standards (protects their market)

**Corridor Communicator Experience:**
- 15+ state WZDx feeds, each with different quirks
- Some use GeoJSON geometry, some don't provide geometry at all
- Timestamp formats vary (ISO 8601, Unix timestamps, human-readable strings)
- Coordinate precision varies (5 decimals vs 7 decimals)
- Requires custom parsing logic for each state

---

**Strategy 1: Adapter/Translator Layer (Recommended)**

**Approach:**
- States keep existing proprietary systems
- Deploy lightweight "TDI adapter" between legacy system and TDI API
- Adapter translates proprietary format → WZDx/standard format
- Adapter publishes standard API for external consumption

**Architecture:**
```
[Legacy ATMS] → [TDI Adapter] → [WZDx API] → [TDI Consumers]
  (proprietary)   (translation)    (standard)
```

**Example:**
- Florida uses SunGuide (proprietary vendor system)
- Deploy TDI adapter that queries SunGuide database
- Adapter converts SunGuide work zones → WZDx JSON
- Publishes HTTPS API at florida.dot.gov/api/wzdx

**Benefits:**
- No need to replace legacy systems (low cost)
- State retains control over adapter deployment
- Adapter can be updated as TDI standards evolve
- Open source adapter code can be shared across states

**USDOT Role:**
- Publish reference adapter implementations for common vendor systems
- Fund development of adapters for top 5 ATMS vendors
- Provide technical assistance to states deploying adapters

**Estimated Cost:** $50K-$200K per state for adapter development/deployment

---

**Strategy 2: Vendor Requirements in Procurement**

**Approach:**
- New ITS procurements require TDI compliance
- Vendor systems must natively support WZDx, GTFS-RT, etc.
- Add to technical specifications: "System shall publish WZDx-compliant API"
- Make TDI compliance a mandatory requirement, not a nice-to-have

**Example Spec Language:**
```
"The ATMS shall provide a RESTful API endpoint publishing work zone data
in WZDx v4.2 format, updated every 5 minutes, accessible via HTTPS with
no authentication required for public safety data."
```

**Benefits:**
- New systems are TDI-native from day one
- Vendors build TDI support into their products (economies of scale)
- Over time, legacy systems are naturally replaced with TDI-compliant systems

**Challenges:**
- Only applies to new procurements (doesn't help with existing systems)
- Vendors may increase prices to cover TDI compliance development
- Takes 5-10 years for full fleet turnover

**USDOT Role:**
- Publish model procurement language for TDI compliance
- Certify vendor systems for TDI compliance (voluntary program)
- Maintain list of TDI-compliant vendors on USDOT website

---

**Strategy 3: Data Escrow for Proprietary Systems**

**Problem:** Vendor locks state DOT into proprietary system, refuses to provide data export

**Approach:**
- Procurement contract requires vendor to provide data export capability
- If vendor refuses, invoke "data escrow" clause
- Vendor must deposit database schemas, API specifications with third party
- If vendor goes out of business or refuses support, state gets escrow materials

**Example Clause:**
```
"Vendor shall deposit complete database schema, API specifications, and
data export scripts with [escrow agent] within 90 days of contract execution.
State may access escrow materials if vendor ceases support or refuses to
provide data export functionality."
```

**Benefits:**
- Protects state DOT from vendor lock-in
- Enables development of TDI adapters even if vendor doesn't cooperate
- Industry standard practice in software procurement

---

**Strategy 4: Open Source Replacement Systems**

**Approach:**
- Fund development of open source ATMS, TMC software
- States can deploy instead of proprietary systems
- Built with TDI compliance from day one
- Shared maintenance cost across states

**Example:**
- Open source traffic management system (like OpenTMS)
- Includes WZDx feed generation built-in
- States customize for local needs
- Multi-state consortium funds development

**Benefits:**
- No vendor lock-in
- Full control over TDI compliance
- Share development costs across states

**Challenges:**
- Requires significant upfront investment
- States lack in-house expertise to maintain
- Vendors will oppose (threatens their market)

**USDOT Role:**
- Fund initial development ($5M-$10M)
- Provide technical assistance for state deployments
- Facilitate multi-state consortium for ongoing maintenance

---

**Strategy 5: API Gateway/Aggregation Layer**

**Approach:**
- State deploys API gateway in front of multiple legacy systems
- Gateway queries each legacy system, aggregates data
- Gateway publishes single unified TDI-compliant API
- External consumers only interact with gateway, not legacy systems

**Architecture:**
```
[ATMS] ─┐
        ├─→ [API Gateway] → [TDI API] → [Consumers]
[CCTV]─┘     (aggregates)    (standard)
```

**Benefits:**
- Single integration point for external consumers
- Legacy systems remain unchanged
- Can add new data sources to gateway without affecting consumers

**Challenges:**
- Gateway becomes single point of failure
- Requires ongoing maintenance as legacy systems change

---

**Practical Recommendations:**

**Phase 1 (0-2 years):** Adapter layer
- Deploy TDI adapters for existing legacy systems
- Quick wins, low cost, immediate TDI compliance

**Phase 2 (2-5 years):** Procurement requirements
- All new procurements require TDI compliance
- Gradual replacement of legacy systems
- Build vendor ecosystem around TDI standards

**Phase 3 (5-10 years):** Open source alternatives
- Fund development of open source transportation management systems
- States have choice: proprietary vendors or open source
- Competitive pressure drives vendor TDI adoption

**USDOT Funding:**
- $10M/year for TDI adapter development (shared across states)
- $5M/year for open source system development
- $2M/year for vendor TDI certification program

**Success Metrics:**
- 2027: 30 states publishing WZDx feeds (via adapters or native systems)
- 2030: 45 states publishing WZDx feeds
- 2035: All 50 states + territories TDI-compliant

**Corridor Communicator Lessons:**
- Simple adapters work well (fetch legacy data, convert to GeoJSON)
- Data quality validation is critical (legacy systems have dirty data)
- Monitoring is essential (legacy systems go offline unexpectedly)
- States need technical assistance, not just standards documents

---

## Conclusion

These are the types of **specific, actionable answers** that USDOT needs to inform TDI policy. The original response was advocacy fluff - this provides:

1. **Concrete definitions** that can guide policy
2. **Prioritized recommendations** with clear rationale
3. **Technical architectures** that can be implemented
4. **Real-world examples** proving feasibility
5. **Specific security controls** meeting NIST standards

The Corridor Communicator project provides **proof points** for many of these recommendations - it's a working example of federated, standards-based, multi-state data sharing.

**This is what a serious RFI response looks like.**

---

**Prepared by:** [Your Organization]
**Date:** February 15, 2026
**Contact:** [Contact Information]

**Supporting Evidence:**
- DOT Corridor Communicator (https://corridor-communication-dashboard-production.up.railway.app)
- Open source codebase demonstrating WZDx federation across 15+ states
- Operational deployment proving technical feasibility

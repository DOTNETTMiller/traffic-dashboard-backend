# U.S. Department of Transportation
## Transportation Digital Infrastructure (TDI) Policy Framework
### Request for Information (RFI) Response

**Date:** February 11, 2026

---

## Executive Summary

Transportation Digital Infrastructure (TDI) represents a fundamental shift in how infrastructure data flows from design through operations. This response addresses USDOT's TDI policy questions from both strategic and implementation perspectives, drawing on multi-state operational experience with open data standards, Building Information Modeling (BIM/IFC), and connected vehicle infrastructure.

**Critical Infrastructure Data Gaps:**
- **Lifecycle Disconnect:** Design data (BIM/IFC) remains isolated from operational systems (NTCIP, TMDD)
- **Interstate Fragmentation:** 50+ incompatible state DOT data formats prevent coordinated operations
- **V2X Infrastructure Gap:** Traffic control systems lack standardized interfaces for connected vehicles
- **Skills Shortage:** Transportation workforce lacks digital infrastructure expertise

**Policy Recommendations:**
1. Federal mandate for IFC4x3 adoption in federally-funded infrastructure projects
2. USDOT-led multi-state data standards harmonization (WZDx, TMDD, SAE J2735)
3. V2X infrastructure deployment requirements tied to federal highway funding
4. National workforce development program for transportation digital literacy

---

## A. Research, Development and Deployment

### A1. What emerging technologies should USDOT prioritize for Transportation Digital Infrastructure?

#### **Executive Perspective: Strategic Investment Priorities**

**Priority 1: Industry Foundation Classes (IFC) for Transportation Infrastructure Lifecycle**

Federal investment should mandate IFC adoption across the entire infrastructure lifecycle—from preliminary design through operations and maintenance. Current practice creates data silos where design intent is lost during handoffs between phases.

**Policy Imperative:**
- Require IFC deliverables for all federally-funded infrastructure projects >$10M
- Fund buildingSMART International IDM/IDS development for transportation-specific schemas
- Establish USDOT as authority for IFC transportation extensions (Road, Railway, Bridge)

**ROI Justification:**
- **30-40% reduction** in operations/maintenance costs through design data reuse
- **Elimination** of manual as-built documentation processes
- **Interoperability** between design tools (Bentley, Autodesk) and operations platforms

**Priority 2: Open Data Standards for Multi-State Operations**

Interstate commerce requires seamless data exchange across state boundaries. Current fragmentation creates operational inefficiencies and safety gaps.

**Federal Action Required:**
- Mandate WZDx v4.x for work zone data as condition of federal highway funding
- Establish TMDD v3.x as minimum standard for state DOT data sharing
- Require SAE J2735 compliance for all V2X infrastructure deployments

**Multi-Agency Coordination:**
- FHWA leads standards development and compliance monitoring
- NHTSA coordinates V2X infrastructure standards
- FTA ensures transit integration with highway systems

**Priority 3: Connected Vehicle Infrastructure (V2X)**

Automated and connected vehicles require standardized infrastructure communication. Current deployments are fragmented pilot projects.

**Strategic Goals:**
- Establish national V2X coverage targets (Interstate system by 2030)
- Standardize RSU communication protocols (DSRC/C-V2X interoperability)
- Integrate V2X with existing traffic management centers

**Institutional Barriers:**
- State DOT procurement practices favor proprietary systems
- Lack of federal V2X infrastructure funding mechanisms
- Regulatory uncertainty around spectrum allocation

---

#### **Practitioner Perspective: Technical Implementation**

**Priority 1: IFC Implementation Pathway**

**Required Standards:**
- IFC4x3 (Road and Railway extensions) - ISO 16739-1:2024
- IFC Alignment (IfcAlignment) for linear referencing
- Property sets for operational data (device IDs, NTCIP addresses, maintenance schedules)

**Current IFC Gaps Blocking Operations Integration:**
1. **Missing Operational Properties** - IFC models lack device IDs, IP addresses, communication protocols
2. **No Linear Referencing** - IfcAlignment implementation incomplete in transportation contexts
3. **Absent Lifecycle Data** - Maintenance schedules, warranty information, uptime requirements not standardized
4. **Equipment Metadata Gaps** - Traffic signals, sensors, cameras lack operational property sets

**Implementation Steps:**
1. **Phase 1 (2026-2027):** BuildingSMART IDM development for ITS equipment
2. **Phase 2 (2027-2028):** IFC export capabilities in major design platforms (OpenRoads, Civil 3D)
3. **Phase 3 (2028-2029):** Operations platforms (ATMS, asset management) consume IFC data
4. **Phase 4 (2029-2030):** Full lifecycle integration with predictive maintenance AI/ML

**Skills Required:**
- BIM managers with IFC schema expertise
- GIS specialists for coordinate system transformations
- ITS engineers understanding NTCIP integration points

**Priority 2: Multi-State Data Standards Implementation**

**WZDx (Work Zone Data Exchange) v4.x:**
- JSON-based work zone feed specification
- Real-time updates (<5 minute latency)
- Standardized event types, road restrictions, lane closures
- Integration: State ATMS → WZDx feed → Navigation providers (Waze, Google, Apple)

**Implementation Challenges:**
- Legacy ATMS systems lack WZDx export capabilities (require middleware)
- State data quality varies wildly (missing geometries, incorrect timestamps)
- No federal compliance enforcement mechanism

**TMDD (Traffic Management Data Dictionary) v3.1:**
- XML-based center-to-center (C2C) communication
- Standardized message sets for incidents, detectors, signals, DMS
- Supports state-to-state data sharing for interstate corridors

**Technical Requirements:**
- C2C servers at each state TMC
- VPN/secure tunnels between states
- Message translation for legacy systems

**SAE J2735 (Connected Vehicle Message Set):**
- Traveler Information Message (TIM) for work zones
- Signal Phase and Timing (SPaT) for traffic signals
- MAP data for intersection geometry
- Basic Safety Message (BSM) from vehicles

**Deployment Approach:**
1. Upgrade traffic signal controllers with NTCIP 1211 (SPaT export)
2. Deploy RSUs at signalized intersections
3. Integrate with state TMC for centralized management
4. Provide MAP data from IFC models or GIS

**Interoperability Challenge:**
- 23 different traffic controller vendors with proprietary protocols
- No common API for SPaT broadcast enablement
- Need USDOT-mandated controller interfaces

**Priority 3: V2X Infrastructure Technical Standards**

**Required Specifications:**
- IEEE 802.11p (DSRC) or 3GPP 5G (C-V2X) radio protocols
- SAE J2735 message formats
- SAE J2945/x security credentials management
- ISO 21217 CALM architecture

**Deployment Architecture:**
1. **Roadside Units (RSUs):** Every 300-500m on Interstate system
2. **Backhaul Connectivity:** Fiber or cellular to state TMC
3. **Security Infrastructure:** SCMS (Security Credential Management System)
4. **TMC Integration:** Feed real-time events to V2X broadcasts

**Cost Estimates:**
- RSU hardware + installation: $15K-25K per unit
- Annual operation/maintenance: $2K-5K per RSU
- 50,000 Interstate miles × 10 RSUs/mile = 500,000 units
- Capital cost: $7.5B - $12.5B (federal investment required)

---

### A2. How can digital infrastructure improve transportation safety, especially for vulnerable road users?

#### **Executive Perspective: Policy and Investment Strategy**

**Strategic Vision:**
Digital infrastructure enables **proactive safety interventions** rather than reactive crash response. Key vulnerable populations—pedestrians, cyclists, visually impaired—benefit from machine-readable infrastructure data accessible to assistive technologies and autonomous systems.

**Federal Policy Recommendations:**

1. **Mandate ADA-Compliant Digital Infrastructure**
   - Require sidewalk/crosswalk geometries in IFC models
   - Standardize tactile paving locations in GIS datasets
   - Provide accessible pedestrian signals (APS) with V2X broadcasts

2. **Connected Infrastructure for Pedestrian Safety**
   - V2X "Pedestrian in Crosswalk" warnings to approaching vehicles
   - Smartphone apps for visually impaired using V2X intersection data
   - Real-time alerts for school zones, construction areas

3. **AI/ML for Predictive Safety**
   - Federal funding for state DOT adoption of predictive crash analytics
   - Machine learning models using infrastructure condition + crash history
   - Proactive interventions before high-risk conditions develop

**ROI and Impact:**
- 20-30% reduction in pedestrian fatalities through V2X warnings
- $2.4M average value of statistical life (VSL) × lives saved
- Infrastructure data accessibility compliance (ADA Section 508)

**Institutional Challenges:**
- State DOTs lack AI/ML expertise and infrastructure
- Privacy concerns with pedestrian tracking technologies
- Procurement rules favor lowest-bid, not innovation

---

#### **Practitioner Perspective: Implementation Approaches**

**1. Digital Pedestrian Infrastructure from BIM**

**IFC Elements for Vulnerable Road Users:**
- `IFCKERB` - Curb heights (ADA ramp identification)
- `IFCPEDESCROSSING` - Crosswalk locations and geometries
- `IFCSIGNAL` - Pedestrian signal locations with APS attributes
- `IFCOBSTACLE` - Street furniture, poles (navigation hazards)

**Operational Integration:**
```
IFC Model → GIS Extract → Routing APIs
- Wheelchair-accessible routes (curb ramps, crosswalks)
- Visual impairment navigation (tactile paving, APS locations)
- Cyclist infrastructure (protected bike lanes)
```

**Data Gaps Preventing Implementation:**
- Most IFC models exclude pedestrian infrastructure entirely
- No standardized property sets for tactile paving, APS types
- Sidewalk condition/width not captured in design models

**2. V2X Pedestrian Safety Applications**

**Technical Implementation:**

**Pedestrian Collision Warning (PCW):**
- Smartphones broadcast "I'm here" message via Bluetooth/V2X
- Approaching vehicles receive warning if pedestrian in conflict zone
- Traffic signals extend crossing time based on pedestrian detection

**Technical Challenges:**
- Smartphone V2X adoption requires carrier support
- Battery drain concerns with continuous broadcasts
- Privacy implications of pedestrian tracking

**Accessible Pedestrian Signals (APS) V2X Integration:**
- Mobile apps request extended crossing time
- V2X broadcasts signal timing to assist

ive devices
- Real-time notification of signal malfunctions

**Standards Required:**
- SAE J2735 extension for pedestrian messages
- ISO accessibility standards integration
- Privacy-preserving authentication protocols

**3. Predictive Safety Analytics**

**Data Sources for ML Models:**
- **Infrastructure Condition:** Pavement quality, lighting levels, sight distances (from IFC/GIS)
- **Historical Crashes:** FARS, state crash databases
- **Traffic Operations:** Volumes, speeds, signal timing (NTCIP feeds)
- **Environmental:** Weather, road surface conditions
- **Contextual:** School zones, special events, construction

**ML Approach:**
1. **Predictive Crash Modeling:** Random forests predicting high-risk locations
2. **Real-Time Risk Scoring:** Dynamic risk based on current conditions
3. **Intervention Recommendations:** Speed limit changes, signal timing, enforcement

**Implementation Requirements:**
- Centralized data lake (cloud infrastructure)
- Data science team (PhD-level statisticians, ML engineers)
- Integration with traffic management systems for interventions
- Continuous model retraining as conditions change

**Workforce Skills Gap:**
- Transportation agencies lack data science expertise
- Need partnerships with universities, private sector
- Federal funding for state DOT innovation offices

---

### A3. What data governance, privacy, and cybersecurity frameworks are needed?

#### **Executive Perspective: Policy and Regulatory Framework**

**Critical Policy Challenge:**
Transportation data spans privacy-sensitive (traveler movements), safety-critical (traffic control), and commercially valuable (mobility analytics) domains. No comprehensive federal framework exists.

**Recommended Federal Actions:**

**1. Transportation Data Governance Act**
- Establish data ownership/stewardship for public infrastructure data
- Mandate open access to safety-critical data (crash locations, work zones)
- Restrict commercial use of privacy-sensitive traveler data
- Federal preemption of conflicting state data regulations

**2. Privacy-Preserving Data Sharing Standards**
- Differential privacy for aggregated mobility analytics
- Anonymization requirements for V2X broadcasts (no persistent IDs)
- De-identification standards for multi-state data sharing
- User consent frameworks for connected vehicle data

**3. Cybersecurity Requirements for V2X Infrastructure**
- Federal certification for V2X security credentials (SCMS)
- Mandatory penetration testing for traffic control systems
- Incident response protocols for infrastructure cyberattacks
- NIST Cybersecurity Framework compliance for state DOTs

**Institutional Coordination:**
- **USDOT:** Data governance policy, V2X security standards
- **NIST:** Cybersecurity frameworks, encryption standards
- **FTC:** Privacy enforcement, commercial data practices
- **DHS/CISA:** Critical infrastructure protection

**Investment Requirements:**
- State DOT cybersecurity upgrades: $50M-100M per state
- Federal SCMS infrastructure: $500M capital + $50M/year operations
- Privacy compliance technology: $10M-20M per state

---

#### **Practitioner Perspective: Technical Implementation**

**1. Data Governance Architecture**

**Data Classification Framework:**

**Tier 1: Public Open Data**
- Work zones (WZDx feeds)
- Traffic signal locations/timing
- Road geometries, speed limits
- Infrastructure condition
- **Governance:** Creative Commons license, unrestricted access

**Tier 2: Operational Restricted Data**
- Real-time traffic speeds, volumes
- Incident details (before public notification)
- Maintenance schedules
- **Governance:** Approved agency access only, data use agreements

**Tier 3: Privacy-Protected Data**
- Individual vehicle trajectories
- Toll transactions with identifiers
- V2X broadcasts with trip patterns
- **Governance:** Anonymization required, differential privacy, retention limits

**Tier 4: Safety-Critical Control Systems**
- Traffic signal control commands
- RSU configuration
- ATMS administrative access
- **Governance:** No external access, multi-factor authentication, audit logs

**2. Privacy-Preserving Technologies**

**Differential Privacy for Mobility Data:**
```
Technique: Add statistical noise to aggregate queries
Example: "How many vehicles on I-80 at 8am?"
Result: True count 1,247 → Reported 1,247 ± 15
Privacy guarantee: No individual trip reconstructable
```

**Implementation:**
- Cloud-based query engines (AWS Clean Rooms, Google Confidential Computing)
- ε-differential privacy with ε=0.1 to 1.0 (configurable)
- Academic partnerships for algorithm validation

**V2X Pseudonymization:**
- Rotating certificate scheme (SAE J2945/1)
- No persistent vehicle IDs across sessions
- Certificate change frequency: every 5 minutes
- SCMS prevents linkage across pseudonyms

**3. Cybersecurity Technical Controls**

**Traffic Control System Hardening:**

**Network Segmentation:**
- Separate VLAN for traffic controllers (no internet access)
- DMZ for public-facing data feeds (WZDx, 511)
- Management network with VPN-only access
- Air-gapped critical control functions

**Access Controls:**
- Multi-factor authentication (MFA) for all administrative access
- Role-based access control (RBAC) - "least privilege" principle
- Hardware security modules (HSM) for cryptographic keys
- Biometric authentication for critical systems

**Monitoring and Response:**
- Security Information and Event Management (SIEM) - 24/7 monitoring
- Intrusion Detection Systems (IDS) at network perimeters
- Automated threat response (isolate compromised systems)
- Incident response playbooks (30-minute detection-to-containment)

**V2X Infrastructure Security:**

**SCMS (Security Credential Management System):**
- Public Key Infrastructure (PKI) for V2X certificates
- Certificate revocation for compromised devices
- Federal root certificate authority (USDOT operated)
- Misbehavior detection (reject messages from malicious actors)

**Technical Standards:**
- IEEE 1609.2 - V2X security services
- SAE J2945/1 - Certificate management
- ISO 21434 - Automotive cybersecurity engineering

**4. Data Retention and Disposal**

**Retention Policies by Data Type:**

| Data Type | Retention Period | Justification |
|-----------|------------------|---------------|
| Work zones (WZDx) | 2 years | Safety analysis, litigation |
| Traffic volumes | 5 years | Planning, modeling |
| Incident reports | 7 years | FHWA requirements |
| V2X broadcasts | 24 hours | Real-time only, no history |
| Individual trajectories | 30 days maximum | Privacy protection |
| Video surveillance | 30-90 days | Investigations, then purge |

**Secure Disposal:**
- Cryptographic erasure (destroy encryption keys)
- Physical destruction for decommissioned hardware
- Audit trails of disposal activities
- Vendor contracts requiring certified data destruction

---

## B. Data Accessibility and Availability

### B1. How should USDOT facilitate open data sharing while protecting sensitive information?

#### **Executive Perspective**

**Balanced Approach Required:**
Maximize open data access for innovation while protecting safety-critical systems and traveler privacy.

**Federal Open Data Mandate:**
- All non-sensitive transportation data public by default
- APIs required for real-time data access
- Standardized formats (WZDx, TMDD, GeoJSON)
- No fees for public access to public data

**Economic Impact:**
- $500M-1B annual economic value from navigation app integration
- $200M-500M from freight logistics optimization
- Academic research enabling $50M-100M in safety innovations

**Exceptions for Closed Data:**
- Infrastructure vulnerability assessments (terrorism risk)
- Cybersecurity incident details (prevent copycat attacks)
- Law enforcement investigations
- Competitive procurement information

**Public-Private Partnerships:**
- Private sector provides tools/platforms (Waze, Google)
- Government provides authoritative data (work zones, incidents)
- Revenue sharing from commercial derivative products
- Open source requirement for federally-funded tools

---

#### **Practitioner Perspective**

**1. Open Data Platform Architecture**

**Core Components:**
- **Data Lake:** Centralized cloud storage (AWS S3, Azure Data Lake)
- **API Gateway:** Rate-limited public access (10,000 requests/day free tier)
- **ETL Pipelines:** Real-time transformation from operational systems
- **Developer Portal:** Documentation, sample code, support

**API Standards:**
- RESTful APIs (JSON responses)
- GraphQL for complex queries
- WebSocket for real-time streams
- OAuth 2.0 for authenticated access

**Example API Endpoints:**
```
GET /api/v1/workzones?state=IA&format=wzdx
GET /api/v1/incidents?corridor=I-80&active=true
GET /api/v1/signals/locations?city=DesMoines
```

**2. Data Quality Assurance**

**Automated Validation:**
- Schema validation (WZDx v4.x conformance)
- Geometry checks (coordinates within state boundaries)
- Temporal validation (future dates, stale data flags)
- Completeness scoring (required vs. optional fields)

**Quality Metrics Dashboard:**
- Real-time data completeness percentage
- Validation error rates
- API uptime/latency monitoring
- User feedback integration

**3. Tiered Access Model**

**Public Tier (No Authentication):**
- Historical data (>24 hours old)
- 1,000 API requests/hour
- Cached responses (5-minute refresh)

**Registered Tier (Free API Key):**
- Real-time data (<5 minute latency)
- 10,000 API requests/hour
- Webhooks for event notifications

**Partner Tier (Data Use Agreement):**
- Bulk data downloads
- Custom data feeds
- Priority support
- Advanced analytics access

---

## C. Workforce Development

### C1. What skills and training are needed for the TDI workforce?

#### **Executive Perspective**

**Critical Skills Gap:**
Transportation workforce trained in civil engineering and traffic operations lacks digital infrastructure expertise. This creates adoption barriers for BIM, data standards, and connected vehicle technologies.

**Federal Workforce Strategy:**

**1. University Transportation Centers (UTC) Curriculum**
- Mandate TDI courses in UTC programs receiving federal funding
- Required topics: IFC/BIM, GIS, data standards (WZDx, TMDD), V2X, AI/ML
- Capstone projects integrating design data with operations
- Industry partnerships for real-world problem-solving

**2. State DOT Training Programs**
- FHWA Every Day Counts (EDC) initiative for TDI adoption
- Regional training hubs (one per FHWA division)
- Hands-on workshops: IFC authoring, API integration, data quality
- Certification programs (BIM Manager, Data Architect, V2X Engineer)

**3. Industry Partnerships**
- Technology vendors provide training to state DOTs
- Open source tool development (federal grants)
- Peer exchange programs (state-to-state knowledge transfer)
- Annual TDI summit for practitioners

**Investment:**
- $50M/year UTC curriculum development
- $100M/year state DOT training programs
- $25M/year industry partnerships

**Timeline:**
- 2026-2028: Curriculum development, pilot training
- 2028-2030: National rollout, certification programs
- 2030+: Continuous learning, advanced specializations

---

#### **Practitioner Perspective**

**Required Skill Sets:**

**1. BIM/IFC Specialists**
- IFC schema expertise (road, railway, bridge extensions)
- 3D modeling tools (Bentley OpenRoads, Autodesk Civil 3D)
- Data extraction/transformation (Python, FME)
- Quality assurance (buildingSMART validation tools)

**2. GIS Analysts for Transportation**
- Spatial data management (ArcGIS, QGIS)
- Coordinate system transformations
- Linear referencing systems (LRS)
- Web mapping APIs (Mapbox, Leaflet)

**3. Data Integration Engineers**
- API development (REST, GraphQL)
- ETL pipeline design (Apache Airflow, SSIS)
- Database administration (PostgreSQL, MongoDB)
- Cloud platforms (AWS, Azure, GCP)

**4. V2X Infrastructure Engineers**
- Radio frequency engineering (DSRC/C-V2X)
- Network architecture (RSU deployment patterns)
- SAE J2735 message structures
- Security credential management (SCMS)

**5. Data Scientists for Transportation**
- Machine learning (Python, TensorFlow, scikit-learn)
- Statistical analysis (R, SAS)
- Predictive modeling (crash analytics, maintenance)
- Data visualization (Tableau, PowerBI)

**Training Resources:**
- Coursera/edX online courses (IFC, GIS, ML)
- Vendor certifications (Esri, Bentley, Autodesk)
- Open source communities (QGIS, OpenStreetMap)
- Professional conferences (TRB, ITE, buildingSMART)

---

## Conclusion

Transportation Digital Infrastructure represents a fundamental transformation of how infrastructure data flows through planning, design, construction, operations, and maintenance. Success requires:

1. **Federal Leadership** - USDOT must mandate standards, fund adoption, coordinate multi-state efforts
2. **Open Standards** - IFC, WZDx, TMDD, SAE J2735 as mandatory, not optional
3. **Workforce Investment** - Train existing workforce, recruit digital expertise
4. **Privacy & Security** - Balanced approach enabling innovation while protecting critical systems
5. **Public-Private Partnership** - Leverage private sector tools with public sector data

The concepts and approaches outlined here draw on operational experience deploying digital infrastructure across multiple states and transportation modes. Implementation is technically feasible with existing standards and technologies—what's missing is federal policy mandates, funding mechanisms, and coordinated execution.

**Recommendation:** USDOT should establish a Transportation Digital Infrastructure Office with authority to:
- Mandate data standards for federally-funded projects
- Administer TDI grant programs
- Coordinate multi-state implementations
- Develop workforce training programs
- Monitor compliance and measure outcomes

The economic and safety benefits justify immediate federal action.

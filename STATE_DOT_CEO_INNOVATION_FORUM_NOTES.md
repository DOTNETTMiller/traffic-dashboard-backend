# State DOT CEO Innovation Forum
**February 22nd, 2026**

---

## Forum Series Goals

### 1. Define Innovation in a State DOT Context

**Core Definition:**
- Innovation is **improving measurable outcomes through operationalized change**, not just deploying new technology
- Innovation must be **scalable, sustainable, and tied to mission-critical objectives**
- Technology is an enabler, not the end goal

**For State DOTs, Innovation Means:**
- **Embedding digital infrastructure into daily operations**
  - Digital twins tied to real-time sensor networks
  - BIM/IFC models feeding directly into asset management and work order systems
  - Connected vehicle data streams integrated with TMC operations
  - API-first architecture replacing manual data transfers

- **Converting field data into real-time decision support**
  - Snowplow AVL → traveler alerts and dynamic route recommendations
  - Camera feeds → AI-powered incident detection and classification
  - Truck parking sensors → real-time parking availability and routing
  - Work zone telematics → automated WZDx feed generation and DMS updates
  - Pavement sensors → predictive maintenance scheduling

- **Scaling pilots into standardized programs**
  - Moving from "proof of concept" to "standard operating procedure"
  - Documenting replicable implementation frameworks
  - Transitioning from grant-funded experiments to sustained O&M budgets
  - Building institutional knowledge and workforce capacity

- **Modernizing business processes alongside technology**
  - Procurement processes that support agile deployment
  - Data governance frameworks that enable interoperability
  - Workforce development for data engineering and cybersecurity roles
  - Performance measurement tied to operational outcomes, not deployment counts

**Innovation Litmus Test:**
> *If it doesn't improve safety, reliability, resilience, or workforce efficiency at scale, it's not innovation—it's experimentation.*

---

### 2. Explore Transformative Technologies and Operational Innovations

**Iowa's Framework for "Transformative":**

A technology is transformative if it:
1. **Enables interoperability across silos or jurisdictions**
   - Breaks down data barriers between maintenance, operations, planning
   - Allows cross-state data sharing without custom integration
   - Connects previously isolated systems (asset management ↔ real-time operations)

2. **Reduces manual processes**
   - Eliminates double data entry
   - Automates reporting and compliance documentation
   - Streamlines approval workflows

3. **Improves predictive capability**
   - Moves from reactive to proactive operations
   - Uses historical data and ML to forecast incidents, failures, maintenance needs
   - Enables "what-if" scenario planning

**Priority Technology Areas:**

#### **A. Connected Vehicle Ecosystems**
- **CV2X (Cellular V2X)**
  - Roadside Units (RSUs) communicating with equipped vehicles
  - Work zone warnings, curve speed warnings, queue warnings
  - Integration with existing DMS and camera networks

- **Connected Contractor Equipment**
  - Construction vehicles broadcasting position and activity
  - Automated WZDx feed generation from equipment telematics
  - Real-time work zone boundary updates to 511 and navigation apps

- **Fleet Telematics Integration**
  - Snowplow AVL feeding traveler information systems
  - Maintenance vehicle location → DMS "crews working ahead" messages
  - Response vehicle tracking for incident management coordination

#### **B. Work Zone Data Exchange (WZDx)**
- **511 Integration**
  - WZDx feeds as the authoritative source for planned work zones
  - Real-time status updates (active, delayed, cancelled, completed)
  - Automated synchronization with 511 databases

- **DMS Integration**
  - Work zone data automatically populating DMS messages
  - Dynamic messaging based on work zone proximity and traffic conditions
  - Consistent messaging across jurisdictions

- **Third-Party Data Sharing**
  - WZDx feeds consumed by Waze, Google Maps, TomTom
  - Standardized format eliminates vendor-specific integrations
  - Improved accuracy through authoritative state DOT data

#### **C. Snowplow AVL + Traveler Notification Systems**
- **Real-Time Plow Tracking**
  - Public-facing plow maps (Iowa DOT "Where's the Plow")
  - Integration with 511 road condition reporting
  - Automated social media updates on treatment progress

- **Predictive Messaging**
  - "Plow 15 minutes away" notifications via DMS
  - Corridor-based alerts ("I-80 EB MM 100-150 being treated now")
  - Integration with weather forecasting for proactive deployment

- **Performance Metrics**
  - Time to bare pavement by route segment
  - Coverage gaps identification
  - Resource optimization based on historical storm response

#### **D. Truck Parking Information Systems**
- **Real-Time Availability**
  - Sensors at rest areas and truck stops
  - ELD (Electronic Logging Device) data integration showing parking demand patterns
  - Crowdsourced validation from trucking apps

- **Predictive Availability**
  - ML models forecasting parking occupancy based on time, day, freight volumes
  - "Next available parking in 45 miles" routing recommendations
  - Integration with Hours of Service (HOS) enforcement data

- **Telematics Integration**
  - Fleet management systems sharing anonymized parking utilization data
  - Cross-validation between sensors and telematics for accuracy
  - Real-time updates to DMS: "Rest Area 90% full, next stop 30 miles"

#### **E. AI for Data Quality Scoring and Anomaly Detection**
- **Data Quality Assessment**
  - Automated scoring of state data feeds (completeness, timeliness, accuracy)
  - Comparative benchmarking across states
  - Identification of degraded feeds requiring remediation

- **Anomaly Detection**
  - Unusual traffic patterns suggesting unreported incidents
  - Camera feeds showing disabled vehicles not in incident logs
  - Weather sensor readings inconsistent with reported road conditions
  - Parking availability data deviating from historical norms

- **Predictive Incident Detection**
  - ML models identifying high-probability incident locations/times
  - Weather + traffic + historical crash data → risk scoring
  - Proactive resource positioning (tow trucks, emergency response)

#### **F. Digital Delivery (BIM/IFC) Connected to Operations**
- **Design → Construction → Operations Data Flow**
  - IFC models from design containing operational metadata (ITS equipment, asset IDs, network topology)
  - As-built BIM models feeding directly into asset management systems
  - Zero post-construction data collection lag

- **V2X Infrastructure Planning**
  - BIM models including RSU locations, coverage zones, power/fiber requirements
  - Gap analysis: "What V2X data is missing from design deliverables?"
  - IDS (Information Delivery Specification) templates for consultants

- **Maintenance Integration**
  - Asset location, mounting heights, access points from BIM → CMMS
  - Predictive maintenance schedules based on design life and environmental exposure
  - Digital twins combining BIM geometry with real-time sensor data

**Key Insight:**
> *Transformation is less about devices and more about connected data systems. A camera is just a camera until its feed powers automated incident detection, informs DMS messaging, and validates work zone compliance.*

---

### 3. Identify Shared Challenges and High-Value Opportunities

#### **Operational Innovation Framework**

Innovation isn't just technology—it's **rethinking workflow, governance, and institutional processes**.

**A. Corridor-Based Governance (I-35 and I-80 Models)**

**Current State:**
- Multi-state corridors managed by independent state DOTs
- No formal coordination on technology deployments
- Inconsistent data formats, messaging, traveler information
- Incidents and weather cross borders, but operations don't

**I-35 Corridor Example:**
- States: Minnesota, Iowa, Missouri, Kansas, Oklahoma, Texas
- Challenges:
  - Texas uses different work zone data schema than Minnesota
  - Truck parking data available in Iowa but not Kansas
  - No unified traveler information for corridor-length trips
  - V2X deployments in one state don't communicate with adjacent states

**Innovation Opportunity:**
- **Formal corridor governance structure**
  - Regular coordination meetings (quarterly at minimum)
  - Shared performance metrics (delay, safety, reliability)
  - Joint procurement for interoperable technology
  - Unified traveler information branded as "I-35 Corridor"

- **Standardized technology stack**
  - Common WZDx schema across all I-35 states
  - Interoperable V2X messaging (same application set)
  - Shared truck parking data feed
  - Coordinated DMS messaging near state lines

- **Joint grant applications**
  - Multi-state USDOT grant proposals for corridor-wide deployments
  - Shared federal funding for interoperability vs. six separate state projects
  - Higher competitiveness through demonstrated collaboration

**B. API-First Architecture Instead of Siloed Systems**

**Current State:**
- Data trapped in legacy databases and GIS systems
- Manual exports to spreadsheets for sharing
- Custom integrations for each data consumer
- No real-time access to authoritative data

**API-First Approach:**
- **All data accessible via standardized APIs**
  - Work zones: WZDx-compliant REST API
  - Incidents: TMDD or custom JSON schema API
  - Assets: ITS equipment, cameras, DMS via queryable API
  - Truck parking: Real-time availability API

- **Benefits:**
  - Third parties can integrate without custom development
  - States can consume each other's data seamlessly
  - Mobile apps, dashboards, analytics tools pull from live sources
  - Eliminates "data warehouse" lag—everything is real-time

- **Implementation:**
  - Start with one high-value dataset (work zones)
  - Publish API documentation using OpenAPI/Swagger
  - Provide developer portal with example code
  - Monitor API usage to prioritize additional datasets

**C. Data Normalization Before Visualization**

**The Problem:**
- States display data on maps/dashboards without standardizing it first
- Result: "Apples to oranges" comparisons, misleading visualizations
- Example: Iowa reports incidents by milepost, Nebraska by lat/lon, Missouri by county

**Solution:**
- **Normalize data at ingestion, not display**
  - Convert all locations to standard format (lat/lon + linear referencing)
  - Standardize event types, severities, statuses
  - Geocode addresses to coordinates
  - Validate data quality before publication

- **Benefits:**
  - Consistent cross-state visualizations
  - Accurate analytics and performance metrics
  - Third-party apps don't need custom parsers for each state
  - Easier to identify data quality issues

**D. Standardized Data Maturity Scoring**

**Current State:**
- No objective way to compare data quality across states
- "We have an API" doesn't mean the data is complete, timely, or accurate
- States don't know how they compare to peers

**Data Maturity Index:**
Scoring framework (0-100 scale) based on:

1. **Availability (25 points)**
   - Is data accessible via API or just manual download?
   - Is documentation provided?
   - Is there a developer support contact?

2. **Completeness (25 points)**
   - What percentage of required fields are populated?
   - Are all corridor segments covered?
   - Is historical data available?

3. **Timeliness (25 points)**
   - How quickly are updates published?
   - Work zones: within 30 minutes of change?
   - Incidents: within 5 minutes?
   - Truck parking: real-time (< 1 minute)?

4. **Accuracy (25 points)**
   - How often does data match ground truth?
   - Truck parking: 90%+ accuracy?
   - Work zone locations: within 0.1 mile?
   - Incident descriptions match camera verification?

**Implementation:**
- Quarterly scoring published publicly
- States ranked by data maturity
- Creates peer pressure and accountability
- Highlights leaders and laggards

**E. Lean Deployment of Roadside Units (RSUs)**

**Current State:**
- "Blanket coverage" approach: RSU every 2 miles regardless of need
- High upfront cost, low utilization
- Maintenance burden for underutilized equipment

**Lean Approach:**
- **Deploy based on safety data and use cases**
  - High crash locations (curve speed warnings, queue warnings)
  - Work zone approaches (frequent or long-duration zones)
  - Truck parking locations (real-time availability notifications)
  - Weather-prone segments (icy bridge warnings)

- **Prioritize high-value applications**
  - Start with work zone alerts (proven safety benefit)
  - Expand to speed harmonization in congested areas
  - Add truck-specific applications (parking, weigh station bypass)

- **Measure utilization before expanding**
  - How many BSMs (Basic Safety Messages) per hour?
  - What percentage of vehicles are equipped?
  - Are messages being acted upon (speed reduction, route changes)?

**F. Using Existing Infrastructure Before Adding Hardware**

**Current State:**
- Tendency to buy new sensors/cameras/equipment for every use case
- Existing assets underutilized
- O&M costs grow without proportional value

**Maximize Existing Assets:**
- **Cameras:**
  - Already have 500+ cameras? Use AI for automated incident detection before buying new detection hardware
  - Computer vision for work zone compliance, queue detection, vehicle classification

- **Telematics:**
  - State fleet vehicles already have GPS? Use for roadway condition crowdsourcing
  - Snowplow data → road treatment status
  - Maintenance vehicle locations → "crews working ahead" alerts

- **DMS:**
  - Already have 100 dynamic message signs? Integrate with real-time data feeds (WZDx, truck parking, weather)
  - Automated messaging eliminates manual updates

- **Smartphones:**
  - Maintenance crews already have phones? Use for mobile data collection (pothole reporting, sign damage, debris)
  - Cheaper than dedicated ruggedized tablets

**Key Principle:**
> *Innovation is rethinking workflow, not just adding sensors. Extract maximum value from existing investments before procuring new technology.*

---

### 4. Support Interstate Coordination and Scalable Implementation

#### **Cross-State Barriers to Innovation**

**A. Fragmented Data Schemas**
- **Problem:**
  - Each state uses different field names, formats, enumerations
  - Iowa: `event_type`, Ohio: `incidentType`, Pennsylvania: `EventCategory`
  - Makes cross-state data aggregation extremely difficult
  - Third parties must write custom parsers for each state

- **Solution:**
  - Adopt national standards (WZDx for work zones, TMDD for incidents)
  - Multi-state working group to agree on schema extensions
  - Publish crosswalk documents mapping state schemas to standards

**B. Vendor Lock-In and Proprietary Formats**
- **Problem:**
  - Vendor A's work zone management system exports proprietary XML
  - Can't easily switch vendors or integrate with other states
  - Data extraction requires expensive professional services

- **Solution:**
  - Require open data formats in procurement contracts
  - "Data portability" clauses: vendor must export to WZDx, GeoJSON, CSV
  - Avoid "data hostage" situations where vendor owns the only export mechanism

**C. Lack of Sustained O&M Funding for Digital Infrastructure**
- **Problem:**
  - Easy to get federal grant for capital deployment (cameras, RSUs)
  - No funding model for ongoing operations, maintenance, data management
  - Systems degrade or go offline due to lack of sustained support

- **Solution:**
  - Build O&M costs into grant applications
  - State DOT budget line items for "digital infrastructure O&M"
  - Shared service models (e.g., multi-state data platform funded jointly)
  - USDOT formula funds for digital infrastructure (like NHS for pavement)

**D. Workforce Gaps in Data Engineering and Cybersecurity**
- **Problem:**
  - DOTs struggle to hire data engineers, software developers, cybersecurity specialists
  - Can't compete with private sector salaries
  - Institutional knowledge concentrated in one or two people

- **Solution:**
  - Regional shared services (Iowa/Nebraska/Missouri pool data engineering talent)
  - Contractor augmentation for specialized skills
  - Training programs for existing staff (pavement engineers → data analysts)
  - Partnerships with universities (interns, research collaborations)

**E. Cross-Border Inconsistency in Corridor Operations**
- **Problem:**
  - Iowa's 511 shows work zones 50 miles into Missouri, but Missouri's 511 doesn't show Iowa zones
  - Truck parking data available in one state, not adjacent states
  - DMS messaging changes abruptly at state line

- **Solution:**
  - Formal data sharing agreements between corridor states
  - Reciprocal display of adjacent state data on 511 systems
  - Coordinated messaging protocols near state boundaries
  - Joint traveler information branding ("I-80 Corridor" vs. individual state 511s)

**F. Difficulty Measuring ROI for Operational Technology**
- **Problem:**
  - Easy to measure ROI for pavement (PSI, remaining life)
  - Hard to quantify value of "better data" or "real-time integration"
  - Difficult to justify continued investment without clear metrics

- **Solution:**
  - Define measurable outcomes:
    - Incident response time reduction (minutes saved)
    - Traveler delay reduction (vehicle-hours saved)
    - Safety improvements (crash reduction %)
    - Workforce efficiency (staff hours freed up)
  - Before/after studies for technology deployments
  - Cost-benefit analysis frameworks specific to ITS (USDOT ITS BCR tool)

**The Biggest Shared Challenge:**
> *Data interoperability at scale. Individual states can deploy technology successfully, but corridor-wide impact requires seamless data exchange and operational coordination.*

---

### 5. Strengthen State DOT and USDOT Collaboration

#### **High-Value Opportunities for Joint Action**

**A. Multi-State API Harmonization**

**Vision:**
- Any third-party developer can access traffic data from all 50 states using the same API structure
- Similar to how weather data is standardized (NOAA API works nationally)

**Implementation Steps:**
1. **Identify core data types** (work zones, incidents, cameras, truck parking, road conditions)
2. **Adopt existing standards where available** (WZDx, TMDD, 511 data formats)
3. **USDOT publishes reference API specifications** for each data type
4. **States commit to phased implementation** (start with one data type, add others over 2-3 years)
5. **USDOT provides technical assistance and validation tools**

**Near-Term Focus:**
- **Work zones (WZDx)**: Already a mature standard, ~20 states publishing
- **Truck parking**: High demand, no standard yet—opportunity to define one
- **Road weather**: Fragmented state systems, need harmonization

**B. Shared Data Quality Frameworks**

**Current Gap:**
- No consistent definition of "good data" across states
- States self-report compliance without validation
- No incentive to improve beyond minimum requirements

**Shared Framework Components:**

1. **Data Quality Metrics**
   - **Completeness**: % of required fields populated
   - **Timeliness**: Latency from event occurrence to publication
   - **Accuracy**: Match rate with ground truth (field validation, camera verification)
   - **Consistency**: Adherence to standard schemas and enumerations

2. **Automated Validation**
   - USDOT-hosted validation service
   - States submit data feeds for automated quality checks
   - Dashboard showing compliance scores and specific issues

3. **Public Transparency**
   - Published scorecards showing state data quality rankings
   - Peer pressure drives improvement (no state wants to be last)
   - Highlight leaders as case studies

4. **Continuous Improvement Process**
   - Quarterly quality reports
   - Root cause analysis for quality issues
   - Remediation support (USDOT technical assistance)

**C. Real-Time Truck Parking Integration Using ELD and Telematics**

**Problem:**
- Truck parking shortage is national crisis (FHWA estimates 98,000 space deficit)
- Real-time availability data is spotty and inaccurate
- Truckers don't trust published data ("says available, but lot is full")

**Opportunity:**
- **ELDs (Electronic Logging Devices)** are mandated for all commercial trucks
- ELDs track location, idling, Hours of Service (HOS)
- Telematics companies (Geotab, Samsara, Omnitracs) have anonymized parking behavior data
- **Can infer parking occupancy from ELD/telematics data without installing sensors**

**Multi-State Pilot:**
1. **Partner with ELD/telematics providers** (data sharing agreements)
2. **Define privacy-preserving data format** (anonymized, aggregated)
3. **Validate against sensor data** (install sensors at 10 pilot locations, compare accuracy)
4. **Publish real-time parking availability** via API and DMS
5. **Measure impact**: Are truckers using the data? Is parking more efficient?

**Target Corridors:**
- I-80 (major freight corridor, chronic parking shortage)
- I-35 (Canada-Mexico trade route, cross-border coordination needed)

**D. Cross-Border WZDx Normalization**

**Current State:**
- 20+ states publishing WZDx feeds
- But implementation varies (optional fields inconsistently used, different interpretation of enumerations)
- Example: "Lane closure" could mean:
  - 1 of 3 lanes closed (Iowa interpretation)
  - All lanes closed intermittently (Ohio interpretation)
  - Shoulder closure counted as lane (Pennsylvania interpretation)

**Normalization Effort:**
1. **Multi-state working group** to document interpretation differences
2. **Publish WZDx implementation guide** with clarifications and examples
3. **Common validation tool** to catch inconsistencies
4. **Quarterly audits** of state feeds against normalization standards

**Benefit:**
- Third parties (Waze, Google) can accurately display work zones without custom logic per state
- Cross-state corridor trips show consistent information
- Improved traveler trust in work zone data

**E. Corridor-Based Performance Dashboards**

**Vision:**
- Single dashboard showing I-80 performance metrics from San Francisco to Teaneck, NJ
- Aggregates data from 11 states into unified view
- Enables corridor-level decision making (not just state-level)

**Key Metrics:**
- **Mobility**: Average travel time, delay, reliability (95th percentile travel time)
- **Safety**: Crash rate, incident clearance time, secondary crash rate
- **Freight**: Truck volumes, truck parking availability, freight delay costs
- **Operations**: DMS uptime, camera uptime, incident detection time, work zone compliance

**Data Sources:**
- State 511 APIs (real-time incidents, travel times)
- WZDx feeds (work zones)
- NPMRDS (National Performance Management Research Data Set) for freight
- State asset management systems (ITS equipment inventory and status)

**Governance:**
- Corridor coalition (all states contribute data)
- Shared performance targets (e.g., "clear incidents within 90 minutes")
- Quarterly review meetings to address problem areas

**F. Shared Cybersecurity Standards for Connected Infrastructure**

**Threat Landscape:**
- RSUs communicating with vehicles are potential attack vectors
- Compromised DMS could display false messages, causing crashes
- V2X infrastructure must be secured against:
  - Message spoofing (fake work zone warnings)
  - Denial of service (flooding RSUs with bogus messages)
  - Unauthorized access to control systems

**Current Gap:**
- No mandatory cybersecurity standards for ITS equipment
- Each state/vendor implements different security measures
- Inconsistent firmware update processes, vulnerability patching

**Shared Standards Opportunity:**
1. **USDOT publishes cybersecurity framework for ITS** (based on NIST, ISO 27001)
2. **Minimum security requirements in procurement specs**:
   - Encrypted communications (TLS 1.3+)
   - Authentication and access control (role-based, MFA)
   - Security event logging and monitoring
   - Vendor commitment to timely patching
3. **Regional ISAC (Information Sharing and Analysis Center)** for transportation cybersecurity
   - Threat intelligence sharing
   - Incident response coordination
   - Vulnerability disclosure process
4. **Tabletop exercises and penetration testing** to validate security posture

**The Opportunity:**
> *Building interoperable digital corridors, not isolated smart projects. A single state deploying V2X has limited value. A corridor-long deployment with consistent messaging and cybersecurity transforms freight and passenger mobility.*

---

### 6. Translate Discussion into Practical Next Steps

#### **Requirements for Scalable Implementation**

**A. Start with Defined Use Cases**

**Why Use Cases Matter:**
- Technology for technology's sake doesn't scale
- Use cases define success criteria and stakeholder value
- Clear use case → measurable ROI → sustained funding

**I-80 Corridor Example Use Cases:**

1. **Work Zone Speed Harmonization**
   - **Problem**: Speed limit changes abruptly at work zones, causing rear-end crashes
   - **Solution**: V2X messages + DMS showing gradual speed reduction (65→55→45 MPH over 2 miles)
   - **Success Metric**: 20% reduction in work zone crashes
   - **States**: Iowa, Nebraska, Wyoming, Utah, Nevada

2. **Truck Parking Near-Capacity Warnings**
   - **Problem**: Truckers enter rest area, find it full, lose 30+ minutes backtracking
   - **Solution**: DMS 10 miles upstream shows "Rest Area 90% full, next stop 45 miles"
   - **Success Metric**: 50% reduction in "parking search" delay
   - **States**: All I-80 states (11 total)

3. **Weather-Responsive DMS**
   - **Problem**: Travelers unaware of icy conditions until too late
   - **Solution**: RWIS sensors → DMS "Icy conditions ahead, reduce speed to 45 MPH"
   - **Success Metric**: 15% reduction in weather-related crashes
   - **States**: Iowa, Nebraska, Wyoming (high-wind, ice-prone segments)

**B. Agree on Minimum Viable Data Standards**

**Principle:**
- Don't wait for perfect standards
- Define "minimum viable" subset that provides immediate value
- Iterate and expand over time

**Work Zone Data Example:**

**Minimum Viable WZDx:**
- Location (road, direction, start/end lat/lon or milepost)
- Status (planned, active, cancelled, completed)
- Lane closures (number of lanes closed, which lanes)
- Start/end date/time

**Nice to Have (add later):**
- Contractor information
- Reason for work
- Restrictions (width, height, weight)
- Worker presence flag

**Truck Parking Data Example:**

**Minimum Viable:**
- Facility ID and name
- Location (lat/lon)
- Total spaces
- Spaces available (real-time)
- Last update timestamp

**Nice to Have:**
- Amenities (restrooms, food, showers, WiFi)
- Truck types supported (standard, oversized)
- Security (lighting, cameras, patrols)
- Fees/restrictions

**C. Publish API Contracts Early**

**API-First Development:**
- Define API specification before building the system
- Use OpenAPI (Swagger) format for machine-readable contracts
- Publish to developer portal for feedback

**Benefits:**
- Third parties can start development in parallel
- States can validate interoperability before deployment
- Changes are negotiated early, not after launch

**Example Workflow:**
1. **Multi-state working group defines truck parking API spec** (2 months)
2. **Publish draft spec on GitHub** for public comment (1 month)
3. **States implement API** (6 months, can be parallel)
4. **Validation testing** (USDOT-hosted test harness checks compliance)
5. **Go live** with coordinated announcement

**D. Use Federated Data Models (Not Forced Centralization)**

**Centralized Model (avoid):**
- All states send data to national repository
- Repository becomes single point of failure
- Governance challenges (who controls the data?)
- States lose autonomy

**Federated Model (preferred):**
- Each state maintains authoritative data
- States publish standard APIs
- Aggregators pull from multiple state APIs
- States retain control, interoperability through standards

**Example:**
- **Iowa publishes WZDx API**: `https://data.iowadot.gov/wzdx`
- **Nebraska publishes WZDx API**: `https://511.nebraska.gov/api/wzdx`
- **Third-party aggregator** queries both APIs, merges data, displays on map
- **No central database required**—just adherence to WZDx standard

**E. Formal MOUs Between Corridor States**

**Why MOUs Matter:**
- Codifies commitment beyond informal coordination
- Defines roles, responsibilities, data sharing terms
- Provides legal framework for cross-jurisdictional operations
- Demonstrates seriousness to federal grantors

**MOU Components:**

1. **Purpose and Scope**
   - Corridor definition (I-80 from CA to NJ)
   - Goals (improve safety, mobility, freight efficiency)

2. **Data Sharing**
   - What data will be shared (work zones, incidents, truck parking)
   - Format (WZDx, TMDD, etc.)
   - Update frequency (real-time, hourly, daily)
   - License terms (public domain, attribution required)

3. **Governance Structure**
   - Steering committee (state DOT CIOs or CTOs)
   - Technical working groups (by use case)
   - Meeting frequency (quarterly minimum)
   - Decision-making process (consensus, majority vote)

4. **Technology Standards**
   - Agreed-upon schemas and APIs
   - Cybersecurity requirements
   - Procurement guidelines (interoperability requirements)

5. **Performance Monitoring**
   - Shared metrics (incident clearance time, data quality scores)
   - Reporting cadence (quarterly dashboards)
   - Continuous improvement process

6. **Funding and Cost Sharing**
   - Joint grant applications (50/50 match, or proportional by VMT)
   - Shared infrastructure costs (multi-state data platform)
   - O&M cost allocation

**Example: I-35 Corridor MOU**
- **Signatories**: Minnesota, Iowa, Missouri, Kansas, Oklahoma, Texas DOTs
- **Commitment**: Publish WZDx and truck parking APIs by Q4 2026
- **Joint Procurement**: Unified RFP for corridor-wide RSU deployment
- **Shared Funding**: USDOT INFRA grant application for $50M V2X corridor

---

#### **From Iowa's Experience: What Makes Coordination Work**

**Success Factors:**

**1. Tie to a Specific Corridor**
- **Why**: Corridor focus provides geographic scope and clear boundaries
- **Example**: I-80 coalition (11 states) vs. "all states everywhere" (too broad)
- **Benefit**: Manageable scope, measurable outcomes, clear stakeholder group

**2. Measurable Safety or Mobility Objective**
- **Why**: Abstract goals ("improve coordination") don't drive action
- **Example**: "Reduce I-80 truck parking search delay by 50%" is specific
- **Benefit**: Clear success criteria, easy to communicate value, justifies funding

**3. Clear Governance Structure**
- **Why**: Coordination fails without defined roles and decision authority
- **Iowa Model**:
  - **Steering Committee**: State DOT directors or deputies (strategic decisions)
  - **Technical Working Group**: State CTOs, IT leads (implementation)
  - **Use Case Teams**: Subject matter experts (work zones, truck parking, V2X)
- **Meeting Rhythm**:
  - Steering: Semi-annually
  - Technical: Quarterly
  - Use Case Teams: Monthly during active development

**4. Start Small, Scale Fast**
- **Phase 1**: One use case, two states, 6-month pilot
  - Example: Iowa + Nebraska truck parking data integration
- **Phase 2**: Expand to full corridor, add second use case (12 months)
- **Phase 3**: Add advanced features, formalize into standard operations (24 months)

**5. Celebrate Wins Publicly**
- **Why**: Momentum attracts funding and executive support
- **Iowa Examples**:
  - "I-80 Corridor Demonstrates 22% Crash Reduction in V2X Work Zones" (press release)
  - Case study presented at TRB, AASHTO, ITE conferences
  - Feature in FHWA Innovator newsletter
- **Result**: Other states want to replicate, federal funding follows success

---

#### **Immediate Next Steps (Within 90 Days)**

**1. Form Multi-State Interoperability Task Group**
- **Lead**: AASHTO Committee on Transportation System Operations (CTSO)
- **Membership**: State DOT CTOs from I-35 and I-80 corridor states
- **Charter**:
  - Define interoperability priorities (work zones, truck parking, V2X)
  - Document current state capabilities (what APIs exist today)
  - Identify quick wins (what can be standardized with minimal effort)
- **First Deliverable**: Gap analysis report (by Q2 2026)

**2. Establish Shared Data Maturity Index**
- **Lead**: USDOT ITS JPO (Joint Program Office) + Volpe Center
- **Approach**:
  - Adapt existing frameworks (EU ITS Directive data quality, UK DfT standards)
  - Define 4-5 maturity levels (Level 1: Manual data, Level 5: Real-time, validated APIs)
  - Pilot scoring with 10 volunteer states
- **First Deliverable**: Maturity index framework published (by Q3 2026)

**3. Pilot Cross-Border Truck Parking Data Integration**
- **Lead**: Iowa DOT + Nebraska DOT
- **Scope**:
  - Integrate truck parking data from both states into unified API
  - Display on both states' 511 systems
  - Push to third parties (Waze, Trucker Path app)
- **Timeline**:
  - API spec defined: Month 1
  - Implementation: Months 2-4
  - Testing and validation: Month 5
  - Go live: Month 6
- **Success Metrics**:
  - 95%+ data accuracy (validated by field checks)
  - 50%+ of truckers report using data (survey)
  - Measurable reduction in parking search delay (probe data analysis)

**4. Publish Corridor-Level API Templates**
- **Lead**: USDOT ITS JPO
- **Content**:
  - OpenAPI specs for work zones (WZDx), incidents (TMDD), truck parking (new)
  - Code examples in Python, JavaScript, Java
  - Validation tools (linters, test harnesses)
- **Distribution**:
  - GitHub repository (public, open source)
  - Developer portal (its.dot.gov/developers)
- **Timeline**: Publish by Q2 2026, update quarterly

**5. Develop National Digital Infrastructure O&M Funding Model**
- **Lead**: AASHTO + USDOT (Office of the Secretary policy team)
- **Problem**: Capital funding available (grants), O&M funding scarce
- **Options to Explore**:
  - **Formula funds for digital infrastructure** (like NHPP for pavement)
    - States allocate % of federal-aid to ITS O&M
  - **ITS Equipment Lifecycle Fund**
    - Set aside at deployment for 10-year O&M
  - **Regional shared services model**
    - Multi-state cost sharing for data platforms, cloud infrastructure
- **First Deliverable**: White paper with funding model options (by Q4 2026)

---

#### **12-Month Goals (Within One Year)**

**1. Demonstrate at Least One Fully Interoperable Corridor Use Case**
- **Target**: I-80 Truck Parking Availability
- **Scope**: All 11 I-80 states (CA, NV, UT, WY, NE, IA, IL, IN, OH, PA, NJ)
- **Deliverable**:
  - Unified truck parking API covering entire corridor
  - Real-time data displayed on all state 511 systems
  - DMS messages at key decision points ("Next parking 45 miles")
  - Integration with navigation apps
- **Timeline**: Pilot (Iowa/Nebraska, Q2 2026) → Corridor-wide (Q4 2026)

**2. Document Measurable Safety or Mobility Improvements**
- **Use Case**: I-35 V2X Work Zone Warnings (Minnesota, Iowa, Missouri pilot)
- **Baseline Data** (before deployment):
  - Work zone crash rate: X per million VMT
  - Average speed variance: Y MPH
- **Post-Deployment Data** (6 months after):
  - Work zone crash rate reduction: target 20%
  - Speed variance reduction: target 30%
- **Report**: Publish findings in TRB paper, FHWA case study

**3. Publish Shared Implementation Guidance**
- **Title**: "Multi-State Digital Corridor Playbook"
- **Audience**: State DOT CTOs, IT leads, project managers
- **Content**:
  - Governance frameworks (MOUs, steering committees)
  - API design patterns (WZDx, truck parking, V2X)
  - Procurement templates (interoperability requirements, open data clauses)
  - Case studies (I-80, I-35 examples)
  - Lessons learned (what worked, what didn't)
- **Format**: PDF + interactive website
- **Distribution**: AASHTO, USDOT ITS JPO, TRB

**Critical Success Factor:**
> *Innovation must move from conversation to codified implementation. The goal is not another white paper—it's measurable outcomes and replicable processes.*

---

## Forum Format & Logistics

### What to Expect

**1. Facilitated Peer Exchange, Not Formal Presentations**
- **Format**: Roundtable discussion, not PowerPoint decks
- **Goal**: Learn from each other's successes and failures
- **Approach**: Structured questions with open dialogue
- **Duration**: 90-minute sessions

**Example Questions:**
- "What's the biggest barrier to API deployment in your state?"
- "How do you justify O&M costs to your legislature?"
- "What vendor contract clauses ensure data portability?"

**2. Open Discussion and Structured Exploration**
- **Balance**: Free-flowing conversation within guided topic areas
- **Facilitator Role**: Keep discussion on track, ensure all voices heard
- **Output**: Capture key themes, action items, volunteer leads

**3. Cross-State Perspective Sharing**
- **Diversity**: Large vs. small states, urban vs. rural, snow vs. sun belt
- **Example**:
  - Wyoming: "We have 100-mile rural segments with no ITS. How do you prioritize?"
  - New Jersey: "We have ITS every mile, but data integration is a nightmare."
- **Value**: Learn what works in different contexts, adapt ideas

**4. Priority Setting for Follow-Up Sessions**
- **End of Session**: Vote on top 3 topics for next meeting
- **Options**:
  - Deep dive on truck parking pilot results
  - Cybersecurity framework development
  - Grant application coordination
  - Workforce development strategies

**5. Clear Takeaways and Next-Step Themes After Each Meeting**
- **Same-Day Summary**: Email to participants within 24 hours
- **Content**:
  - Key discussion points
  - Action items with assigned leads
  - Date/topic for next session
- **Accountability**: Progress update at start of next meeting

---

## Modal Joining Meeting

**Hybrid Format:**
- **In-Person**: Preferred for initial session (relationship building, trust)
- **Virtual**: For follow-up sessions (reduces travel burden, increases attendance)
- **Technology**: Zoom with breakout rooms for small group discussions

**Best Practices:**
- **Video on**: Builds connection vs. voice-only
- **Chat feature**: Capture questions, ideas in real-time
- **Screen sharing**: For collaborative document editing, data visualization

---

## Potential Locations for Multistate Corridors

### Priority Corridors for Digital Interoperability

**1. Interstate 80 (I-80)**
- **States**: California, Nevada, Utah, Wyoming, Nebraska, Iowa, Illinois, Indiana, Ohio, Pennsylvania, New Jersey (11 states)
- **Characteristics**:
  - Primary east-west freight corridor
  - High truck volumes (30-50% in rural segments)
  - Diverse geography (Sierra Nevada, Great Plains, Appalachians)
  - Weather extremes (blizzards in Wyoming, heat in Nevada)
- **Use Cases**:
  - Truck parking (chronic shortage in IL, IN, OH)
  - Work zone coordination (major reconstruction in multiple states)
  - Weather-responsive operations (RWIS integration)

**2. Interstate 35 (I-35)**
- **States**: Minnesota, Iowa, Missouri, Kansas, Oklahoma, Texas (6 states)
- **Characteristics**:
  - NAFTA/USMCA trade corridor (Canada to Mexico)
  - International freight priority
  - NASCO (North America's SuperCorridor Coalition) support
- **Use Cases**:
  - Cross-border coordination (US-Canada, US-Mexico)
  - V2X for commercial vehicles (truck platooning, safety apps)
  - International truck parking and weigh station coordination

**3. Interstate 10 (I-10)**
- **States**: California, Arizona, New Mexico, Texas, Louisiana, Mississippi, Alabama, Florida (8 states)
- **Characteristics**:
  - Southern transcontinental route
  - Hurricane evacuation corridor
  - High AV testing activity (Arizona, Texas)
- **Use Cases**:
  - AV-ready infrastructure (lane markings, signage standards)
  - Emergency evacuation coordination
  - Weather (hurricanes, dust storms, extreme heat)

**4. Interstate 95 (I-95)**
- **States**: Maine to Florida (15 states)
- **Characteristics**:
  - Highest traffic volumes nationally
  - Urban-heavy (Boston, NYC, Philly, DC, Baltimore)
  - Massive truck volumes (40%+ in some segments)
- **Use Cases**:
  - Congestion management and dynamic tolling
  - Work zone coordination (constant construction)
  - V2X for urban mobility (queue warnings, transit priority)

**5. Interstate 70 (I-70)**
- **States**: Utah, Colorado, Kansas, Missouri, Illinois, Indiana, Ohio, West Virginia, Pennsylvania, Maryland (10 states)
- **Characteristics**:
  - Mountain passes (Eisenhower Tunnel, Vail Pass)
  - Extreme weather variability
  - Growing freight corridor
- **Use Cases**:
  - Weather-responsive operations (chain laws, closures)
  - Truck parking in mountainous terrain
  - V2X curve speed warnings

---

### 2-State Boundary Focus (Quick Wins)

**Why Start with 2 States:**
- Simpler governance (bilateral vs. multilateral)
- Faster decision making
- Proof of concept before scaling
- Builds trust and momentum

**High-Priority 2-State Pairs:**

**1. Iowa + Nebraska (I-80)**
- **Rationale**:
  - Adjacent states, strong existing relationship
  - Both have advanced 511 systems
  - High truck parking demand
- **Pilot**: Truck parking data integration (Q2 2026)

**2. Minnesota + Iowa (I-35)**
- **Rationale**:
  - NASCO corridor champions
  - Both states deploying V2X
  - Shared interest in international freight
- **Pilot**: V2X work zone warnings (Q3 2026)

**3. Texas + Oklahoma (I-35)**
- **Rationale**:
  - High commercial vehicle volumes
  - Cross-border coordination with Mexico
  - NASCO priority segment
- **Pilot**: WZDx harmonization for construction zones

**4. Pennsylvania + New Jersey (I-80, I-95)**
- **Rationale**:
  - Dense urban corridors
  - High congestion and work zone activity
  - Shared trucking industry stakeholders
- **Pilot**: Coordinated DMS messaging for incidents and work zones

---

## Preferred Corridors for Autonomous Vehicles (AV)

**1. Interstate 35**
- **Why**: NASCO focus on AV-ready infrastructure, long rural segments ideal for testing
- **States**: Texas (major AV testing), Oklahoma, Kansas (emerging AV activity)

**2. Interstate 10**
- **Why**: Arizona and Texas have permissive AV regulations, established testing programs
- **States**: Arizona (Waymo, Cruise, TuSimple), Texas (Aurora, Kodiak Robotics)

**3. Interstate 70 (Utah, Colorado)**
- **Why**: Utah Connected Vehicle Corridor, Colorado AV testing in mountain conditions
- **Advanced Features**: Dedicated AV lanes (planned in some segments)

---

## Interstate Focus: Border to Border

**Rationale:**
- Interstates are federally funded, making multi-state coordination logical
- Interstate System connects major freight hubs (ports, rail yards, distribution centers)
- Federal interest in interstate performance (IIJA, FAST Act requirements)

**Avoiding Scope Creep:**
- Focus on interstates, not state highways or local roads (at least initially)
- Reason: Manageable scope, clear federal/state roles, existing governance (AASHTO)
- Later expansion: US routes, state corridors can adopt proven standards

---

## Corridor Coalition Membership

**Criteria for Membership:**

**1. Focus on Corridors, Not Individual Projects**
- **Membership**: State DOTs along designated interstate corridors
- **Not Included** (initially): States without connection to priority corridors
- **Example**: I-80 coalition = 11 states, not all 50

**2. Focus on Automation and Connected Vehicles**
- **Technologies**: V2X, truck platooning, AV-ready infrastructure
- **Not Included** (initially): States with no AV/CV activity or interest

**3. Emphasis on Commercial Vehicles**
- **Rationale**:
  - Freight is economic driver
  - Commercial vehicles are early adopters of connectivity (ELDs, telematics, fleet management)
  - Safety benefits (truck crashes are disproportionately severe)
- **Use Cases**: Truck parking, work zone safety, platooning, weigh station bypass

**4. National Alerts and Emergency Management**
- **Capabilities**:
  - AMBER alerts, Silver alerts via V2X
  - Weather warnings (tornado, flash flood, blizzard)
  - Emergency evacuations (hurricanes, wildfires)
- **Coordination**: Multi-state alert distribution, consistent messaging

---

## Specific Technologies for Modernization

### High-Priority Technology Areas

**1. Truck Parking**
- **Technology**:
  - Sensors (infrared, computer vision) for real-time occupancy
  - ELD/telematics integration for demand prediction
  - DMS integration for upstream warnings
- **Data Standard**: Develop national truck parking API (no standard exists yet)

**2. Digital Message Signs (DMS)**
- **Modernization**:
  - Automated messaging (WZDx → DMS without manual updates)
  - Context-aware messages (weather + traffic + work zones combined)
  - Multi-state coordination (consistent messages across state lines)
- **Integration**: 511, WZDx, weather APIs, truck parking APIs

**3. Asset Management**
- **Technology**:
  - GIS integration (asset location tied to road network)
  - BIM/IFC integration (design data → asset inventory)
  - Predictive maintenance (ML models forecasting failures)
- **Data Flow**: Design → Construction → As-Built → Asset Management → Work Orders

**4. LiDAR and Remote Sensing**
- **Applications**:
  - Mobile LiDAR for pavement condition, sign inventory, guardrail assessment
  - Aerial LiDAR for corridor mapping, interchange geometry
  - Bridge inspection (close-range scanning)
- **Use Case**: Reduce manual field surveys, improve data accuracy

**5. Pavement Condition Assessment**
- **Technology**:
  - Automated distress detection (AI on pavement images)
  - Continuous friction testing (SCRIM, GripTester)
  - Ground-penetrating radar (subsurface defects)
- **Benefit**: Predict maintenance needs before visible deterioration

**6. Sign Retroreflectivity Measurement**
- **Technology**:
  - Mobile retroreflectometers (measure from moving vehicle)
  - Computer vision (assess sign condition from images)
- **Use Case**: MUTCD compliance (ensure signs meet minimum reflectivity standards)

**7. Pavement Marking Assessment**
- **Technology**:
  - Retroreflectivity meters (measure marking visibility at night)
  - 3D profiling (measure marking height for rumble strips, raised pavement markers)
- **AV Relevance**: AVs depend on lane markings for positioning—must be high quality

---

## Gap Analysis and Scaling

### Gap Analysis Framework

**What Are We Missing?**

**1. Geometric Data Gaps**
- **Lane widths**: Required for AV path planning
  - **Current State**: Some GIS layers, not comprehensive or accurate
  - **Need**: Sub-foot accuracy, updated after reconstruction

- **Shoulder widths**: Critical for emergency stopping
  - **Current State**: Typically in HPMS, but may be outdated
  - **Need**: Paved vs. unpaved distinction, seasonal changes (snow banks)

- **Clearances**: Vertical (bridges, signs) and lateral (clear zones)
  - **Current State**: Bridge clearances in NBIS, but not in real-time routing systems
  - **Need**: Digital database of all overhead obstacles (signs, signals, utilities)

- **Curve radii and superelevation**: For AV speed control
  - **Current State**: Design plans, not in operational GIS
  - **Need**: Extract from as-built plans, integrate into HD maps

**2. Asset Data Gaps**
- **Sign inventory**: Type, size, retroreflectivity, condition
  - **Current State**: Manual surveys, often incomplete
  - **Need**: Mobile LiDAR collection, AI for sign recognition

- **Pavement marking inventory**: Type, width, retroreflectivity
  - **Current State**: Variable by state, some use mobile collection
  - **Need**: Continuous monitoring, AV-grade quality standards

- **Guardrail and barrier inventory**: Type, height, condition, end treatments
  - **Current State**: Inspection-driven, not comprehensive GIS
  - **Need**: Full inventory for AV "keep-out zones"

**3. Operational Data Gaps**
- **Real-time work zones**: WZDx adoption still incomplete (~20 states)
  - **Gap**: 30 states not publishing WZDx
  - **Need**: Universal adoption by 2027

- **Truck parking availability**: Real-time data sparse
  - **Gap**: Most states have no sensor coverage, rely on crowdsourcing (unreliable)
  - **Need**: ELD/telematics integration, validated sensors at key locations

- **Weather impacts on roadway**: RWIS sensors limited coverage
  - **Gap**: Rural segments often lack sensors
  - **Need**: Modeling (using radar, satellite, connected vehicle data)

**4. Standards and Specification Gaps**
- **AV-grade infrastructure**: No national standard for "AV-ready" roadway
  - **Gap**: What lane marking retroreflectivity is sufficient for AV cameras?
  - **Need**: Research, pilot testing, standards development

- **Minimum clearances for automated trucks**: Oversized loads + AV routing
  - **Gap**: No digital database of vertical/lateral clearances
  - **Need**: NBIS + GIS integration, real-time updates

---

### How Do We Scale? Moving Past Pilots

**The "Pilot Purgatory" Problem:**
- DOTs love pilots (grant-funded, low-risk, innovative)
- But pilots often die after grant ends (no O&M funding, no institutionalization)
- Result: Dozens of "successful" pilots, but no operational impact at scale

**Scaling Framework:**

**Phase 1: Pilot (6-12 months)**
- **Scope**: Small geography (50-mile segment, single use case)
- **Goal**: Prove technical feasibility, measure early outcomes
- **Funding**: Federal grant (ATCMTD, SMART, ITS4US)
- **Staffing**: Dedicated project manager, contractor support

**Phase 2: Regional Expansion (12-24 months)**
- **Scope**: Expand to full corridor (e.g., all of I-80 in Iowa)
- **Goal**: Demonstrate scalability, refine operational processes
- **Funding**: Combination of state funds + remaining grant
- **Staffing**: Transition to existing operations staff

**Phase 3: Institutionalization (24+ months)**
- **Scope**: Statewide or multi-state
- **Goal**: Standard operating procedure, no longer "innovative"
- **Funding**: State DOT operations budget (no grant dependency)
- **Staffing**: Fully integrated into existing teams (not separate "innovation" unit)

**Keys to Successful Scaling:**
1. **Plan for O&M from Day 1**: Include 10-year O&M costs in pilot budget
2. **Document Standard Operating Procedures**: How to maintain, troubleshoot, update
3. **Train Existing Staff**: Avoid dependence on specialized contractors
4. **Measure ROI Continuously**: Justify continued funding with data
5. **Automate Where Possible**: Reduce manual effort to sustain at scale

---

## Communication and Infrastructure Requirements for AV

**What AVs Need from DOT Infrastructure:**

**1. Roadway Geometry**
- **Lane widths**: Narrower lanes → AV must slow down or refuse to operate
  - **Standard**: 12-foot lanes ideal, 11-foot minimum for AV comfort
  - **Issue**: Many rural interstates have 11-foot lanes in reconstructed segments
  - **Solution**: Prioritize 12-foot lanes in AV corridors during resurfacing

- **Curve radii**: Tight curves → AV speed reduction
  - **Need**: Digital curve database (radius, superelevation, advisory speed)
  - **Source**: Extract from design plans, validate with mobile LiDAR

**2. Clearances**
- **Vertical clearances**: Low bridges risk collision with oversized AV trucks
  - **Minimum**: 14-16 feet (varies by state)
  - **Issue**: Unmarked low bridges, outdated NBIS data
  - **Solution**: GIS layer of all overhead obstacles, integrated into AV routing

- **Lateral clearances**: Shoulders, clear zones
  - **Need**: AV must know safe recovery space if leaving lane
  - **Standard**: 10-foot paved shoulder ideal, 6-foot minimum

**3. Pavement Markings**
- **Retroreflectivity**: AV cameras depend on visible markings
  - **Standard**: MUTCD minimum (varies by marking type)
  - **AV Requirement**: May need higher standard (under research)
  - **Issue**: Many states barely meet MUTCD minimums
  - **Solution**: Continuous monitoring, prioritize remarking in AV corridors

- **Consistency**: Marking width, color, pattern must be consistent
  - **Issue**: Wide vs. narrow lines, dashed vs. solid transitions
  - **Solution**: Standardize marking specs for AV corridors (e.g., always 6-inch wide)

**4. Signs**
- **Retroreflectivity**: AV must read speed limits, warnings, regulatory signs
  - **Standard**: MUTCD Table 2A-3 (minimum maintained retroreflectivity)
  - **Issue**: Many signs degrade below standard before replacement
  - **Solution**: Proactive replacement schedule based on condition monitoring

- **Standardization**: Sign design, placement must follow MUTCD strictly
  - **Issue**: "Creative" sign designs (local variations) confuse AV
  - **Solution**: Enforce strict MUTCD compliance in AV corridors

**5. V2X Communication**
- **RSU Coverage**: For safety applications (curve speed, queue warning, work zone alerts)
  - **Minimum**: 1 RSU per high-risk location (curves, work zones, congested segments)
  - **Ideal**: Continuous coverage (1 RSU every 2 miles)
  - **Trade-off**: Cost vs. benefit—start with high-value locations

- **Message Standardization**: SAE J2735 (DSRC) or similar for CV2X
  - **Issue**: Custom messages won't be understood by all AVs
  - **Solution**: Stick to standard message sets, avoid proprietary formats

**6. Work Zone Management**
- **Advanced Warning**: AVs need earlier warning than human drivers
  - **Current**: 1-2 miles upstream
  - **AV Need**: 5+ miles (allows route re-planning, not just slow-down)
  - **Solution**: WZDx feeds consumed by AV routing systems

- **Clear Delineation**: Cones, barriers, markings must clearly define travel path
  - **Issue**: Gaps in cones, faded markings confuse AV sensors
  - **Solution**: AV-grade work zone setup standards (tighter spacing, higher-visibility)

---

## Cut and Paste from Stu's Document / Present

*(Note: This section would include content from Stuart Anderson's or another subject matter expert's document on AV infrastructure requirements, NHTSA next-gen regulations, etc. Since the source document isn't provided, placeholder guidance is below.)*

**Topics to Include from Expert Documents:**
- NHTSA AV regulations (FMVSS updates for automated driving systems)
- AV lane designation criteria (dedicated lanes vs. mixed traffic)
- I-80 Pell Study findings (UC Davis research on truck automation corridors)
- Insurance and liability frameworks for AV operations
- Cybersecurity standards for V2X and AV communications

**Presentation Format:**
- Summary slides (key findings, recommendations)
- Detailed appendix (full study results, methodologies)
- Discussion prompts (how do findings apply to our corridors?)

---

## Datasets: What Can You Bring?

**Data Inventory by State:**

Each state should document:

**1. Linear Referencing System (LRS)**
- **What it is**: Backbone for locating assets, events, conditions along roadways
- **Format**: ESRI Shapefile, GeoJSON, PostGIS
- **Coverage**: All interstate routes (minimum), ideally all state highways
- **Accuracy**: Sub-meter for interstates

**2. Paved Shoulders**
- **What**: Width, surface type, condition of paved shoulders
- **Source**: Pavement management system, HPMS
- **AV Relevance**: Emergency stopping, lane keeping

**3. Liability Concerns / Legal Frameworks**
- **What**: State laws on AV operation, liability in AV crashes, data sharing restrictions
- **Format**: Legal summary documents, links to statutes
- **Cross-State Issue**: Inconsistent liability laws create compliance challenges for AV operators

**4. GIS Layers**
- **Assets**: Signs, signals, cameras, DMS, RSUs, guardrails
- **Geometry**: Lane widths, curve radii, clearances
- **Conditions**: Pavement quality, marking retroreflectivity
- **Environment**: Floodplains, wildlife crossings, steep grades

**5. Asset Management Systems**
- **SIIMS (Statewide Integrated Information Management System)**: Example from Iowa
  - **Content**: Pavement condition, bridge inspection, asset inventory, work orders
  - **Interoperability**: Can it export to GIS? API available?

- **RAMS (Roadway Asset Management System)**: Example from other states
  - **Content**: Similar to SIIMS, varies by state
  - **Gap**: Rarely interoperable between states—need data translation

**6. HPMS (Highway Performance Monitoring System) Data**
- **What**: Federally required dataset (FHWA mandated)
- **Content**: AADT, truck percentages, lane widths, shoulder types, pavement condition
- **Availability**: All states submit to FHWA annually
- **Issue**: Annual lag (not real-time), aggregated (not granular)
- **Use for AV**: Baseline geometry, traffic volumes for corridor prioritization

**7. Work Zone Data (WZDx)**
- **Current Adoption**: ~20 states publishing WZDx feeds
- **Content**: Work zone locations, lanes closed, start/end times, contractor info
- **Format**: GeoJSON (WZDx v4.0 standard)
- **Gap**: 30 states not yet publishing—priority for adoption

**8. NHTSA Next-Gen Regulations Data**
- **What**: Data requirements for AV manufacturers (crash reporting, disengagement logs)
- **State Role**: Support federal data collection, share state crash reports
- **Opportunity**: Use NHTSA data to prioritize AV safety improvements

**9. I-80 Pell Study Data (UC Davis)**
- **What**: Research on truck automation corridors, infrastructure requirements
- **Content**: Lane keeping requirements, sensor performance in weather, human-AV interaction
- **Availability**: Published study (2024), data may be available for corridor planning

**10. AV Lanes (Dedicated or Mixed-Use)**
- **Concept**: Some corridors considering AV-only lanes (similar to HOV lanes)
- **Data Needed**:
  - Traffic volumes (can corridor support dedicated lane?)
  - Enforcement feasibility (how to detect non-AV in AV lane?)
  - Cost-benefit (does dedicated lane improve AV performance enough to justify?)

---

## What's Available Today: Leveraging Existing Technology

**Key Principle:**
> *Use what you have before buying new technology. Maximize ROI of existing infrastructure.*

**1. HPMS Data**
- **Available Now**: All states submit HPMS annually to FHWA
- **Use Cases**:
  - Corridor prioritization (which interstates have highest truck volumes?)
  - Baseline geometry (lane widths, shoulder types)
  - Performance benchmarking (compare states on pavement condition, congestion)

**2. Work Zone Data**
- **Available in 20 States**: WZDx feeds
- **Immediate Action**: Non-publishing states adopt WZDx by end of 2026
- **Quick Win**: Even basic WZDx (location, dates) is valuable—don't wait for perfect data

**3. Camera Networks**
- **Available in Most States**: Hundreds or thousands of CCTV cameras
- **Underutilized**: Manual monitoring only, no automated analysis
- **Opportunity**: Apply AI for incident detection, work zone compliance, queue detection
  - **Cost**: $5K-$20K per camera for AI software (one-time), no new hardware

**4. DMS Networks**
- **Available in All States**: Dynamic message signs on major routes
- **Underutilized**: Manual message updates, not integrated with real-time data
- **Opportunity**: WZDx → automated DMS messages, truck parking → DMS warnings
  - **Cost**: Software integration only (API connections), minimal hardware changes

**5. 511 Systems**
- **Available in All States**: Traveler information websites/apps
- **Underutilized**: Often manual updates, not consuming WZDx or other APIs
- **Opportunity**: Automated data pipelines (WZDx → 511, truck parking → 511)

**6. Snowplow AVL**
- **Available in Many States**: GPS tracking on plow trucks
- **Underutilized**: Used for dispatch only, not shared with travelers
- **Opportunity**: Public plow map (Iowa "Where's the Plow"), 511 integration

**7. Truck Weigh Stations**
- **Available in All States**: WIM (Weigh-In-Motion) sensors
- **Underutilized**: Enforcement only, data not shared
- **Opportunity**: Truck volume data for freight planning, truck parking demand forecasting

**8. ELDs (Electronic Logging Devices)**
- **Available on All Commercial Trucks (federal mandate)**: GPS, Hours of Service data
- **Underutilized**: Regulatory compliance only, not used for DOT planning
- **Opportunity**: Partner with ELD providers for anonymized parking demand data, freight flow analysis

---

## Performance Metrics: What Does Success Look Like?

**Defining Success:**
- **Specific**: Not "improve safety"—"reduce work zone crashes by 20%"
- **Measurable**: Can be quantified with data
- **Achievable**: Within DOT control or influence
- **Relevant**: Tied to DOT mission (safety, mobility, economic vitality)
- **Time-Bound**: Target date for achieving metric

**Metric Categories:**

### 1. Safety Metrics
- **Crash Reduction**
  - **Baseline**: Crashes per million VMT (before deployment)
  - **Target**: 15-25% reduction in targeted crash types
  - **Measurement**: State crash database, before/after analysis
  - **Example**: "V2X work zone warnings reduce rear-end crashes by 20% within 6 months"

- **Incident Clearance Time**
  - **Baseline**: Average time from incident detection → roadway clear
  - **Target**: 20% reduction in clearance time
  - **Measurement**: CAD (Computer-Aided Dispatch) logs, TMC records
  - **Example**: "AI incident detection reduces clearance time from 45 to 35 minutes"

- **Secondary Crash Rate**
  - **Baseline**: % of incidents that cause secondary crashes
  - **Target**: 30% reduction in secondary crashes
  - **Measurement**: Crash proximity analysis (time/space clusters)
  - **Example**: "DMS queue warnings reduce secondary crashes by 30%"

### 2. Mobility Metrics
- **Travel Time Reliability**
  - **Baseline**: 95th percentile travel time / median travel time (Planning Time Index)
  - **Target**: Reduce PTI by 10%
  - **Measurement**: Probe data (INRIX, HERE, connected vehicles)
  - **Example**: "Real-time DMS detour recommendations improve reliability by 12%"

- **Delay Reduction**
  - **Baseline**: Vehicle-hours of delay (AADT × delay per vehicle)
  - **Target**: 15% reduction in delay
  - **Measurement**: Probe data, loop detectors
  - **Example**: "Coordinated signal timing reduces I-35 urban delay by 18%"

- **Truck Parking Search Time**
  - **Baseline**: Average time truckers spend looking for parking
  - **Target**: 50% reduction (from 30 minutes to 15 minutes)
  - **Measurement**: ELD data analysis, trucker surveys
  - **Example**: "Real-time parking info reduces search time from 32 to 14 minutes"

### 3. Operational Efficiency Metrics
- **Data Quality Score**
  - **Baseline**: Current maturity level (1-5 scale)
  - **Target**: Improve by 1 level within 12 months
  - **Measurement**: Automated validation tools (completeness, timeliness, accuracy)
  - **Example**: "WZDx feed improves from Level 2 to Level 4 after process automation"

- **Workforce Efficiency**
  - **Baseline**: Staff hours per task (e.g., updating DMS messages, 511 website)
  - **Target**: 50% reduction in manual effort
  - **Measurement**: Time logs, before/after comparison
  - **Example**: "WZDx automation saves 20 staff hours/week previously spent on manual 511 updates"

- **System Uptime**
  - **Baseline**: % of time ITS equipment is operational
  - **Target**: 95%+ uptime for critical systems
  - **Measurement**: SCADA logs, maintenance records
  - **Example**: "Predictive maintenance increases camera uptime from 87% to 96%"

### 4. Economic Metrics
- **Freight Delay Costs**
  - **Baseline**: $ cost of truck delay (hours × $cost per truck-hour)
  - **Target**: 20% reduction in freight delay costs
  - **Measurement**: Truck probe data, economic analysis
  - **Example**: "I-80 truck parking info saves $2.5M annually in reduced delay costs"

- **Benefit-Cost Ratio (BCR)**
  - **Baseline**: N/A (new deployment)
  - **Target**: BCR > 3.0 (benefits exceed costs by 3x)
  - **Measurement**: USDOT ITS BCR tool, crash cost savings, delay reduction
  - **Example**: "V2X work zone deployment has BCR of 4.2 over 10 years"

---

### How to Identify If Automation Is Working

**Automation Validation Framework:**

**1. Process Metrics (Is the system functioning?)**
- **API Uptime**: Are data feeds available 99%+ of the time?
- **Data Freshness**: Are updates published within target timeframe (e.g., WZDx within 30 min)?
- **Error Rates**: How often do automated processes fail or produce invalid data?

**2. Outcome Metrics (Is it making a difference?)**
- **User Adoption**: Are travelers using the data? (511 page views, app downloads, DMS readership surveys)
- **Behavior Change**: Are truckers changing routes based on parking data? (probe data analysis)
- **Safety Impact**: Are crashes decreasing in areas with V2X deployment?

**3. Feedback Loops**
- **User Surveys**: Do truckers trust the parking data? (Net Promoter Score)
- **Stakeholder Interviews**: Do TMC operators find automation helpful or burdensome?
- **Continuous Monitoring**: Real-time dashboards showing system performance

---

## Next Steps: Actionable Items

### Immediate Actions (0-3 Months)

**1. Identify What Can Be Done**
- **State Self-Assessment**: Each state documents current capabilities
  - What APIs exist today?
  - What data is available (GIS, HPMS, WZDx)?
  - What ITS equipment is deployed (cameras, DMS, RSUs)?
  - What are top 3 barriers to interoperability?

- **Deliverable**: One-page summary per state (due by April 2026)

**2. Identify Interoperability Hubs**
- **Hub Concept**: States or regions that can serve as data aggregators, shared services providers
- **Candidates**:
  - **Iowa DOT**: Advanced 511, WZDx publisher, truck parking pilot experience
  - **NASCO (North America's SuperCorridor Coalition)**: I-35 corridor governance
  - **I-95 Corridor Coalition**: Existing multi-state collaboration on I-95
  - **Western States Rural Transportation Consortium**: Rural state coordination

- **Hub Responsibilities**:
  - Host shared data platforms (multi-state APIs)
  - Provide technical assistance to smaller states
  - Coordinate grant applications
  - Facilitate governance (steering committees, working groups)

**3. Define the 9-Month Vision**
- **Goal**: "AV-Ready Corridors" with measurable deployment
- **Target**:
  - **X miles of AV-ready corridor** (e.g., "500 miles of I-80 with compliant markings, signs, V2X")
  - **Connected to X airports and seaports** (e.g., "I-35 connected to DFW Airport, Port of Houston")
  - **X% truck parking coverage** (e.g., "Real-time parking data for 80% of truck spaces on I-80")

- **Specific 9-Month Deliverables**:
  - WZDx feeds published by all corridor states
  - Truck parking API operational (I-80 or I-35 pilot)
  - V2X deployment plan finalized (RSU locations, funding identified)
  - Coordinated DMS messaging active (adjacent states showing each other's work zones)

### Medium-Term Actions (3-9 Months)

**4. Focus on Freight-Heavy / Rural Freight Corridors**
- **Rationale**:
  - Freight movement is economic priority
  - Rural corridors have fewer distractions (easier for AV testing)
  - Commercial vehicles are early adopters of connectivity

- **Priority Corridors**:
  - I-80 (transcontinental freight)
  - I-35 (NAFTA/USMCA trade)
  - I-10 (southern freight route)

**5. Intercountry Corridor Coordination**
- **Canada**:
  - I-35 north to Winnipeg (NASCO priority)
  - I-94 to Toronto (Windsor-Detroit border)
- **Mexico**:
  - I-35 south to Monterrey, Mexico City
  - I-10 to El Paso / Ciudad Juárez

- **Coordination Needs**:
  - Data format harmonization (Canada uses metric, different sign standards)
  - Cross-border truck parking data integration
  - V2X interoperability (message standards, RSU compatibility)

**6. Continue Focus on Interstates—Don't Get Distracted**
- **Scope Discipline**:
  - Finish interstate interoperability before expanding to US routes or state highways
  - Reason: Manageable scope, federal funding alignment, clear governance

- **Avoid Scope Creep**:
  - Cities will ask for urban street integration—defer to Phase 2
  - States will want to add state routes—defer to Phase 2
  - Focus = Interstate system, freight priority, AV readiness

### Long-Term Actions (9-24 Months)

**7. Funding Strategy**
- **Congressional Action**:
  - Advocate for dedicated "Digital Infrastructure" title in next highway bill
  - Similar to how IIJA included EV charging, broadband—add ITS O&M, V2X, data platforms

- **Legislation Proposals**:
  - **Digital Interstate Act**: Federal funding for corridor-wide V2X, data interoperability
  - **Truck Parking Modernization Act**: Dedicated funding for real-time parking systems
  - **ITS O&M Formula Funds**: Sustained funding for operations, not just capital deployment

- **State Action**:
  - Budget line items for "digital infrastructure O&M" (not buried in general IT or maintenance)
  - Dedicated FTEs for data management, API development, cybersecurity

**8. Measure and Publicize Success**
- **Year 1 Report** (Q1 2027):
  - Document outcomes from pilots (crash reduction, delay savings, data quality improvement)
  - Case studies from lead states (Iowa, Minnesota, Pennsylvania)
  - ROI analysis (benefit-cost ratios, justification for continued funding)

- **National Conference Presentations**:
  - TRB Annual Meeting (January 2027)
  - AASHTO Spring Meeting (May 2027)
  - ITE Annual Meeting (August 2027)

- **Media Strategy**:
  - Press releases on major milestones ("I-80 Corridor Achieves Full WZDx Coverage")
  - Trade publication articles (Better Roads, Roads & Bridges, Public Works)
  - FHWA Innovator newsletter features

---

## Closing Thoughts: Innovation as Institutional Change

**Innovation Is Not Just Technology:**
- It's changing how DOTs operate
- It's creating new partnerships (states, vendors, academia)
- It's shifting culture from "pilot projects" to "operational programs"

**Success Requires:**
- **Executive Sponsorship**: State DOT directors must champion interoperability
- **Sustained Funding**: Move beyond grant dependence
- **Workforce Development**: Train staff in data science, API development, cybersecurity
- **Performance Accountability**: Measure outcomes, not just outputs

**The Vision:**
By 2027, a trucker can drive from Los Angeles to New York on I-80 and:
- See consistent work zone information across all 11 states (WZDx-powered)
- Find real-time truck parking availability at every rest area (ELD-integrated)
- Receive V2X warnings about hazards, queues, weather (RSU coverage)
- Experience coordinated incident management (multi-state TMC collaboration)

**This vision is achievable—if we commit to collaboration, standardization, and sustained implementation.**

---

**End of Notes**

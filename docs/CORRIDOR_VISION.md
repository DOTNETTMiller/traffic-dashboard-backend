# Connected Corridors: The Grand Vision

## A Unified Operating System for America's Interstate Network

**Prepared by the Connected Corridors Advancement Initiative (CCAI)**
**Pooled Fund Study TPF-5(566) | Solicitation #1633**
**Lead Agency: Iowa Department of Transportation**
**March 2026**

---

## The Problem We're Solving

America's interstate corridors are managed in fragments. A winter storm crossing from Nebraska into Iowa into Illinois into Indiana is handled by four separate traffic management centers with four separate systems, four separate data standards, and no shared picture of what's happening. A truck driver on I-80 crosses eleven state lines between San Francisco and New Jersey and encounters eleven different information ecosystems, none of which talk to each other.

The consequences are measurable:

- **$74 billion annually** in freight delay costs on the National Highway Freight Network (ATRI/FHWA Freight Performance Measures, 2023)
- **Incident notification across state lines typically requires phone calls** between TMCs, adding minutes to response coordination during the critical early phase
- **FHWA estimates 20% of truck parking-related crashes** involve fatigued drivers who could not find available parking (FHWA Truck Parking Development Handbook, 2022)
- **No state DOT currently has a real-time picture** of what's happening on the other side of its border -- each operates in its own data silo

Every state DOT has invested in its own systems. Those systems work well within state boundaries. The gap is between them.

---

## The Vision: One Corridor, One Picture, One Response

**By 2030, every mile of the I-80 and I-35 corridors will operate as a single, integrated system** -- where an incident in one state triggers coordinated responses across every state it impacts, where travelers receive consistent information regardless of which state they're in, and where infrastructure operators share a common operating picture from coast to coast.

This is not a theoretical future. The foundation is built and operating today.

---

## What Exists Today (March 2026)

The DOT Corridor Communicator is live in production, serving real traffic operations:

| Capability | Status | Scale |
|-----------|--------|-------|
| Real-time event aggregation | Live | 20 state feeds, 17,700+ work zones |
| Multi-state event display | Live | I-80 (11 states), I-35 (6 states) |
| WZDx v4.2 feed validation | Live | Automated compliance scoring |
| Connected vehicle message generation | Live | SAE J2735 TIM, CV-TIM, CIFS |
| IPAWS emergency alerting | Live | Road-following geofences, population analysis |
| DMS message coordination | Live | 49 MUTCD-compliant templates, auto-activation |
| Truck parking intelligence | Live | 174 facilities, 7 TPIMS feeds, AI calibration |
| Corridor delay engine | Live | 35 segments, real-time health scores |
| Multi-state closure approval | Live | 6-level workflow, border coordination |
| Diversion route management | Live | 6 pre-approved routes, truck suitability checks |
| Data quality scoring | Live | 7-dimension DQI with letter grades |
| Digital infrastructure (BIM/IFC) | Live | 3D model viewing, GIS export |
| Predictive parking (AI-calibrated) | Live | Corridor delay surge adjustments |
| Interstate travel time estimates | Live | Segment-level, state-to-state |

---

## The Grand Completed Vision

### Phase 1: The Connected Corridor (2026-2027)
*Where we are now -- establishing the foundation*

**Every event on I-80 and I-35 is visible to every state in real time.**

A TMC operator in Des Moines sees the same events as operators in Lincoln, Kansas City, and Columbus. When a multi-vehicle crash closes I-80 in eastern Iowa, the system automatically:

1. Classifies the event and estimates duration from historical patterns
2. Generates MUTCD-compliant DMS messages for signs upstream in Nebraska and downstream in Illinois
3. Calculates corridor delay impact across all 35 segments
4. Adjusts truck parking predictions at facilities within 75 miles (drivers will queue)
5. Triggers the pre-approved diversion route if the closure meets threshold criteria
6. Notifies adjacent-state TMCs through the messaging system
7. Generates IPAWS-ready alerts with road-following geofences for affected populations
8. Updates travel time estimates for the entire I-80 corridor

**This happens in under 60 seconds. Today.**

### Phase 2: The Intelligent Corridor (2027-2028)
*From reactive to predictive -- AI and automation at every level*

The corridor learns from its own history and acts on what it learns.

**AI-Driven Predictive Intelligence:**
- The system has tracked every event's lifecycle -- when it appeared, how long it lasted, how many times the end time was extended, what the actual duration was versus the estimated duration. Machine learning models trained on two years of data predict: "A high-severity crash on I-80 in winter conditions between mile markers 280-300 typically lasts 3.8 hours, causes 42 minutes of delay at peak, and results in truck parking reaching capacity at the Grinnell rest area within 90 minutes."
- AI calibration runs daily on parking prediction accuracy, continuously tuning time-of-day, day-of-week, and corridor-delay surge weights -- for less than $0.02/day in API costs
- Construction events that extend past their planned end dates are flagged automatically. ML pattern recognition surfaces insights: certain contractors, certain project types, certain seasons correlate with schedule overruns
- Weather correlation: when NWS issues a winter storm warning for central Iowa, AI pre-positions DMS messages, increases parking prediction sensitivity, and alerts downstream states before the first flake falls
- Natural language AI generates corridor briefings, after-action summaries, and grant application evidence from live operational data

**Automated Response Chains -- Reducing Response Times:**
- Event detection triggers a cascade of coordinated responses across states without human intervention for routine scenarios (lane closures, minor incidents, weather advisories)
- Auto-DMS activation puts messages on signs within 60 seconds of event detection -- eliminating the 8-15 minute manual response time that currently exists
- Adjacent-state notification is instantaneous: when I-80 closes in Iowa, Nebraska and Illinois TMCs see it on their screens before a phone call could be placed
- IPAWS emergency alerts with road-following geofences deploy in under 2 minutes for qualifying events, reaching affected populations faster than any manual process
- Human operators focus on exceptions and escalations, not routine coordination
- After-action reviews feed back into the automation rules through AI analysis, continuously improving response quality
- **Target: Reduce cross-border incident notification from phone-call timelines (5-15 minutes) to automated alerts (under 60 seconds)**

**Freight Intelligence:**
- Real-time Hours of Service (HOS) parking demand modeling: when a closure creates a 2-hour delay, the system calculates how many commercial vehicles will need to park within the next 4 hours based on average HOS clock positions
- Oversize/overweight permit route validation against active closures and restrictions in real time
- Bridge clearance conflict detection: an overheight vehicle approaching a construction zone with temporary clearance reduction gets advance warning through connected vehicle infrastructure

### Phase 3: The Digital Twin Corridor & Strategic Physical Deployment (2028-2029)
*From monitoring to simulation -- from software to steel*

**The corridor exists as a living digital model.**

Every segment of I-80 and I-35 has a digital twin that maintains:
- Current operational state (speed, volume, occupancy, congestion level)
- Infrastructure condition (pavement, bridges, signs, signals, sensors)
- Active events and their predicted evolution
- Historical performance patterns by hour, day, season
- Equipment health and predicted failure windows

**What-If Scenario Planning:**
- "If we close the eastbound lanes at mile marker 150 for bridge work on Tuesday, what happens to traffic flow, parking demand, and travel times across the corridor?" The digital twin runs the scenario using real historical data and current conditions to produce minute-by-minute predictions
- State DOTs use this to coordinate construction schedules across borders -- Iowa doesn't start a lane closure on I-80 EB when Illinois already has one active 60 miles downstream
- Emergency management runs tabletop exercises against the digital twin: "What if a hazmat spill closes I-35 at the Iowa-Missouri border during Friday rush hour in July?" The twin shows cascading effects across six states in minutes

**Strategic Physical Deployments:**

The digital platform identifies where physical infrastructure investments will have the highest impact -- and the pooled fund co-invests in deploying them at critical locations:

*Border Zone Instrumentation (State Line ± 10 miles):*
- RSU (Roadside Unit) clusters at every interstate state border crossing on I-80 and I-35 -- the exact locations where coordination gaps cause the most harm
- CCTV coverage at border zones feeds AI-powered vehicle counting and incident detection
- RWIS (Road Weather Information Systems) stations at border zones where weather transitions cause chain-reaction closures
- DMS signs positioned for advance warning before state transitions: "ENTERING IOWA / I-80 CLOSURE MM 280 / 45 MIN DELAY / USE I-380 DETOUR"

*Truck Parking Smart Infrastructure:*
- Computer vision cameras at the 30 highest-demand truck parking facilities along I-80 and I-35
- Real-time space counting feeds directly into the prediction engine, providing ground truth that calibrates AI models
- Digital signage at facility entrances showing live availability and next-facility predictions
- Strategic new parking capacity at the top 5 bottleneck locations identified by the corridor delay engine's historical analysis

*Connected Vehicle Infrastructure Hubs:*
- RSU deployments at 50 critical interchanges (major freight junctions, known incident hotspots, work zone transition areas)
- DSRC/C-V2X dual-mode communication supporting both legacy and next-gen connected vehicles
- Edge computing nodes that process BSM data locally and feed summarized corridor state back to the platform in real time

*Sensor Fusion Stations:*
- Combined radar + camera + weather sensor stations at 25-mile intervals along instrumented corridor segments
- AI-processed speed, volume, and classification data flowing into the digital twin
- Automatic incident detection (AID) providing sub-minute event identification without relying on 911 calls or state feeds

**Deployment Cost Model (Shared Across Pooled Fund):**

| Infrastructure | Unit Cost | Quantity | Total | Per State (8) |
|---------------|-----------|----------|-------|---------------|
| Border RSU clusters (4 RSUs each) | $120K | 16 borders | $1.92M | $240K |
| Truck parking cameras + AI | $25K | 30 facilities | $750K | $94K |
| Interchange RSU + edge compute | $80K | 50 interchanges | $4.0M | $500K |
| Sensor fusion stations | $60K | 40 stations | $2.4M | $300K |
| DMS signs at borders | $150K | 32 signs | $4.8M | $600K |
| **Total physical deployment** | | | **$13.87M** | **$1.73M** |

*Funded through combination of pooled fund contributions, SMART/INFRA/ATCMTD grants, and state capital programs. Platform data provides the evidence base for competitive federal grant applications.*

**Reducing Operations & Maintenance Costs:**

The combination of AI automation and strategic sensor deployment fundamentally changes the O&M cost structure:

- **Predictive maintenance** replaces reactive maintenance: AI models trained on equipment health history predict failures 14-30 days in advance, allowing scheduled repairs instead of emergency callouts. Industry research shows unplanned maintenance costs 3-5x more than planned maintenance (FHWA ITS Maintenance Best Practices, 2020). **Target: Shift the planned/unplanned maintenance ratio from typical 40/60 to 70/30**
- **Automated incident detection** reduces reliance on manual monitoring: sensor fusion stations detect incidents in 1-2 minutes, compared to 5-15 minutes for 911-dependent notification chains (NCHRP Report 855, Automated Incident Detection). **Target: Measurable reduction in mean time to notification for incidents in instrumented segments**
- **Shared DMS message libraries** eliminate per-state template development: 49 pre-approved templates used across all corridor states, with AI-recommended activation. States stop reinventing the same messages independently
- **Coordinated construction scheduling** prevents the "we didn't know they were also doing work" conflicts that cause emergency mobilizations and contract change orders. **Target: Eliminate uncoordinated concurrent closures within 50 miles across state borders**
- **Centralized platform hosting** replaces per-state server infrastructure: one cloud deployment serves all states instead of each state running separate corridor monitoring systems
- **AI-generated reports** replace manual performance reporting: monthly report cards, after-action reviews, and federal compliance reports are produced automatically from live data. **Target: Reduce performance reporting labor from days to hours per reporting cycle**

### Phase 4: The Private Sector Corridor & Autonomous Readiness (2029-2030)
*Where public infrastructure meets commercial innovation*

**Private Sector Integration -- The Data Marketplace:**

The corridor becomes a platform that private industry builds on, creating revenue streams that offset public investment:

*Commercial Data Consumers:*
- **Freight carriers & logistics companies** subscribe to real-time corridor delay feeds, parking predictions, and route optimization APIs. A carrier dispatching 500 trucks/day across I-80 pays for the 15-minute advantage of knowing about a closure before Google Maps does
- **Insurance & telematics companies** license historical corridor performance data for risk modeling. Event duration patterns, weather correlation, and segment reliability indices have direct actuarial value
- **Navigation providers** (Google, Apple, Waze, HERE, TomTom) consume standardized WZDx and TIM feeds, improving routing accuracy for all travelers -- not just connected vehicles
- **Autonomous vehicle operators** pay for real-time ODD boundary data, HD map update feeds, and infrastructure sensor fusion streams that their vehicles require to operate safely

*Commercial Data Providers:*
- **Private truck stops** (Pilot/Flying J, Love's, TA/Petro) contribute real-time parking availability from their own systems into the corridor platform, gaining visibility alongside public rest areas. Their data improves the overall parking prediction model; the platform drives customers to their available spaces
- **Weather data companies** provide hyperlocal forecasts that improve the corridor's predictive models beyond what NWS alone provides
- **Connected fleet operators** contribute anonymized probe data (speed, position) that provides ground truth for the digital twin's traffic models -- better than loop detectors, cheaper than dedicated sensors

*Public-Private Partnership Models:*
- **Truck parking P3s:** Private operators build new capacity at locations identified by corridor data as chronic bottlenecks; the platform provides demand guarantees based on historical analysis and real-time routing
- **ITS maintenance contracts:** Sensor fusion stations and RSU clusters are maintained by private ITS vendors under performance-based contracts; the platform's equipment health monitoring validates contractor performance automatically
- **Data licensing revenue:** Corridor data feeds are licensed to commercial consumers, creating a revenue stream that offsets platform operating costs. Pricing is based on data tier (real-time vs. historical, raw vs. enriched)

**Autonomous-Ready Infrastructure:**

- HD map updates are generated automatically from work zone data and pushed to AV operators within minutes of a lane configuration change
- Operational Design Domain (ODD) boundaries are published in real time: "Automated driving is supported on I-80 EB from mile 0 to mile 280. From mile 280 to 295, work zone conditions reduce ODD to SAE Level 2 (driver must monitor). From mile 295 onward, full ODD resumes."
- Infrastructure-to-Vehicle (I2V) messaging provides upcoming geometry changes, speed advisories, and merge warnings that AVs consume directly
- The corridor serves as a certified testing ground for AV freight operations, with instrumented segments providing the sensor density and communication infrastructure that AV developers require
- **AI orchestration layer** manages the interaction between human-driven and automated vehicles through dynamic speed harmonization, merge coordination, and work zone lane guidance broadcast via RSU infrastructure

**AI & Automation -- The Full Stack:**

By 2030, AI and automation operate at every level of the corridor:

| Layer | AI/Automation Capability | Human Role |
|-------|------------------------|------------|
| **Data ingestion** | Automated feed polling, format normalization, quality scoring | Configure new feeds |
| **Event detection** | Sensor fusion AID, cross-source verification, false positive filtering | Review flagged anomalies |
| **Event classification** | ML severity estimation, duration prediction, freight impact tagging | Override edge cases |
| **Response activation** | Auto-DMS, auto-IPAWS, auto-parking alerts, auto-detour triggers | Approve escalations |
| **Traveler information** | Real-time corridor briefings, travel time estimates, parking guidance | None (fully automated) |
| **Infrastructure health** | Predictive failure detection, maintenance scheduling, lifecycle costing | Approve work orders |
| **Performance reporting** | Automated monthly scorecards, federal compliance reports, grant evidence | Review and submit |
| **Resource optimization** | Construction schedule conflict detection, crew deployment optimization | Strategic decisions |
| **Continuous improvement** | After-action AI analysis, calibration weight tuning, rule refinement | Set policy goals |

---

## The Multi-State Operating Model

### Governance

The pooled fund study (TPF-5(566)) establishes a governance structure where:

- **Lead State (Iowa DOT)** hosts the platform and coordinates development priorities
- **Participating States** contribute $250K each over 2026-2030 ($2M total)
- **Technical Committee** (one representative per state) meets monthly to prioritize features
- **Operations Committee** coordinates real-time procedures and protocols
- **Industry Advisory Board** provides input from freight carriers, technology providers, and AV developers

### Cost Model

| Item | Per State/Year | 8-State Total/Year |
|------|---------------|-------------------|
| Platform subscription | $30,000 | $240,000 |
| Pooled fund contribution | $50,000 | $400,000 |
| State-specific customization | $10,000 | $80,000 |
| **Total** | **$90,000** | **$720,000** |

**Return on Investment:**

The value proposition operates at two levels -- the platform itself, and the strategic physical deployments it enables:

| Benefit Category | Mechanism | Measurable Outcome |
|---------|-----------|-------------------|
| **Federal grant competitiveness** | Live operational data replaces projections in grant applications; demonstrated multi-state coordination is a SMART/INFRA scoring criterion | Track grant awards attributable to platform data |
| **Incident response coordination** | Automated cross-border notification (seconds vs. minutes); coordinated DMS activation | Measure mean time from event detection to adjacent-state notification |
| **Maintenance cost avoidance** | Predictive models shift unplanned-to-planned ratio; industry data shows 3-5x cost difference (FHWA, 2020) | Track planned vs. emergency maintenance events and costs |
| **Reporting labor reduction** | Automated performance reports, after-action reviews, compliance documentation | Measure staff hours per reporting cycle before/after |
| **Construction conflict avoidance** | Cross-state visibility of active and planned closures prevents concurrent work within impact zones | Count eliminated conflicts per quarter |
| **Private sector revenue** | Data licensing to freight carriers, navigation providers, and AV operators | Track subscription revenue |
| **IT consolidation** | Single platform vs. per-state corridor monitoring tools | Compare per-state hosting and maintenance costs |

*Note: Dollar values will be quantified through the pooled fund study's formal benefit-cost analysis, using actual measured outcomes from Year 1 operations rather than projections.*

### Scaling Path

The platform is designed to scale beyond the initial 8-state coalition:

- **Year 1 (2026):** 8 pooled fund states fully operational
- **Year 2 (2027):** 15 states (add I-90, I-70 corridor states)
- **Year 3 (2028):** 25 states (Southeast, Mountain West)
- **Year 5 (2030):** 46+ states (national coverage achieved)

Each new state adds its existing data feeds (WZDx, 511, TPIMS) and immediately gains access to the full corridor intelligence network. No new infrastructure required.

---

## Federal Alignment

The Connected Corridors vision directly supports:

| Federal Program | How CCAI Supports It |
|----------------|---------------------|
| **FHWA Work Zone Data Initiative (23 CFR 940)** | WZDx feed aggregation, validation, and quality scoring across all corridor states |
| **Transportation Performance Management (23 CFR 490)** | Automated TTTR metrics, daily corridor performance aggregation, 2-year archival |
| **National ITS Architecture** | Standards-based interoperability (TMDD, NTCIP, SAE J2735) |
| **Every Day Counts (EDC-7)** | Technology deployment acceleration through shared platform |
| **Bipartisan Infrastructure Law - Digital Infrastructure** | BIM/IFC integration, digital twin foundation, AV readiness |
| **SMART Grants** | Data-driven corridor management demonstration |
| **INFRA/RAISE/BUILD Grants** | Freight corridor optimization, multi-state coordination proof |
| **ATCMTD** | Connected vehicle deployment readiness |

---

## What Success Looks Like in 2030

**For the TMC Operator:**
One screen shows every active event on I-80 from California to New Jersey. Color-coded segments show real-time health. Clicking any event shows coordinated DMS messages already active in upstream states, the estimated remaining duration based on 4 years of historical patterns, and the downstream parking and delay impacts. Routine events are handled automatically. The operator focuses on the 5% of situations that need human judgment.

**For the Truck Driver:**
Parking availability is visible 200 miles ahead, updated every 30 minutes, with predictions that account for the lane closure 50 miles upstream that will cause bunching in 90 minutes. Connected vehicle messages provide work zone warnings with lane-level precision. Hours of service planning integrates real-time corridor conditions -- the app doesn't just say "there's a rest area in 30 miles," it says "the rest area in 30 miles will be full by the time you get there; the one in 52 miles has 8 spaces predicted available."

**For the State DOT Director:**
Monthly report cards show corridor data quality scores improving across all participating states. Federal grant applications include real data from real operations -- not projections, not promises, but measured outcomes from a live system. Construction scheduling coordination across borders has eliminated the "adjacent state surprises" that used to cause political headaches and freight industry complaints.

**For the Traveling Public:**
Whether crossing Nebraska, Iowa, or Illinois on I-80, the travel information is consistent, accurate, and timely. DMS messages use the same formats and templates. Work zone warnings appear with enough advance notice to make decisions. Emergency alerts reach only the people who need them, with geofences that follow the actual roadway rather than crude circles on a map.

**For the Maintenance Engineer:**
Equipment health dashboards flag the DMS sign at mile marker 195 as trending toward failure based on performance degradation patterns. The system recommends preventive maintenance before the peak travel weekend. What used to be an emergency callout on a Friday night becomes a scheduled repair on a Tuesday morning -- at a fraction of the cost. Across the corridor's tracked ITS assets, the shift from reactive to predictive maintenance compounds savings year over year.

**For the Freight Carrier:**
The corridor data API feeds directly into dispatch planning. Fleet managers see real-time delay estimates from the corridor delay engine and adjust routing before trucks hit congestion. Parking predictions integrated with HOS clock management mean drivers find spaces instead of circling or parking illegally. For a carrier operating across I-80, the advance visibility into corridor conditions enables better route and rest planning decisions.

**For the Private Truck Stop Operator:**
Contributing real-time availability data to the corridor platform drives customers to available spaces. When the rest area upstream is predicted full due to a corridor delay surge, the platform routes drivers to the nearest private facility with capacity. Data sharing is a revenue driver, not a cost center.

**For the Federal Highway Administration:**
A working proof of concept for national-scale corridor interoperability, built with open standards, funded through state pooled funds, and operating in production -- not a research paper, not a pilot, not a PowerPoint, but a live system serving real operations across state lines every day. The physical infrastructure deployments demonstrate that software and steel work together -- that the platform isn't just a dashboard, but the intelligence layer that makes every sensor, sign, and RSU on the corridor work as a coordinated system.

---

## The Bottom Line

The technology exists. The data exists. The standards exist. The governance model exists. The private sector is ready to participate. The AI is already running.

The cost is $90,000 per state per year for the platform -- less than a single lane-mile of interstate reconstruction. Strategic physical deployments at border zones and critical interchanges are funded through competitive federal grants that the platform's operational data makes winnable.

In return: cross-border incident notification measured in seconds instead of minutes. Maintenance costs shifted from emergency to planned. Reporting automated from live data instead of assembled by hand. A corridor that learns from every event and gets smarter every day. And a private sector ecosystem that contributes data and revenue instead of operating in a parallel silo.

The only thing missing is the decision to operate as one corridor instead of eleven separate states.

The DOT Corridor Communicator is that decision made real.

---

*Connected Corridors Advancement Initiative (CCAI)*
*Pooled Fund Study TPF-5(566) | Solicitation #1633*
*Iowa Department of Transportation*
*Contact: Matthew Miller, CPM | matthew.miller@iowadot.us*

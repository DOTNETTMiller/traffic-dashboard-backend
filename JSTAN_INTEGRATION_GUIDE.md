# JSTAN Integration Guide
## AASHTO Joint Subcommittee on Data Standardization

### DOT Corridor Communicator Integration with JSTAN Standards

---

## Table of Contents

1. [What is JSTAN?](#what-is-jstan)
2. [JSTAN Mission & Scope](#jstan-mission--scope)
3. [Key Standards & Schemas](#key-standards--schemas)
4. [Integration with DOT Corridor Communicator](#integration-with-dot-corridor-communicator)
5. [Implementation Guidelines](#implementation-guidelines)
6. [Data Exchange Protocols](#data-exchange-protocols)
7. [Use Cases & Examples](#use-cases--examples)
8. [Resources & Documentation](#resources--documentation)

---

## What is JSTAN?

**JSTAN** (Joint Subcommittee on Data Standardization) is AASHTO's internal, cross-committee, multi-disciplines group formed to coordinate transportation data schema development, identify gaps, resolve conflicts, and avoid duplication of efforts across state DOTs.

### Establishment

- **Founded**: February 2020
- **Established By**: AASHTO Strategic Management Committee
- **Current Chair**: Trisha Stafanski, Minnesota DOT (MnDOT)
- **Purpose**: Coordinate adoption of standardized data schemas across transportation agencies

### Organizational Structure & Role

JSTAN is **not a traditional standards technical development group**. Instead, JSTAN serves as a **recommendations and coordination body** that:

- **Makes standards recommendations** to AASHTO for official adoption
- **Works across all AASHTO committees** to coordinate standardization efforts
- **Seeks official endorsement** from AASHTO and other governing bodies
- **Bridges technical implementation** with organizational adoption processes
- **Champions practical adoption** by state DOTs to ensure standards serve agencies effectively

### Key Challenges & Innovations

**Current Challenge**: Traditional AASHTO publishing cycles can't keep pace with rapidly changing technology, particularly in areas like:
- Connected and automated vehicles (V2X)
- Artificial intelligence integration
- Cloud-based data exchange
- Real-time systems integration

**Proposed Solution**: JSTAN is exploring an **official AASHTO GitHub repository** to:
- Maintain living standards that stay current with technology changes
- Enable version-controlled collaboration across agencies
- Provide AI integration guidance and recommendations
- Support rapid updates outside traditional publication cycles
- Allow states to contribute improvements and extensions

### Effective Function in AASHTO Environment

For groups like JSTAN to function effectively within AASHTO:
1. **Clear coordination pathways** with all relevant technical committees
2. **Streamlined adoption processes** that balance rigor with agility
3. **Member engagement** from practitioners focused on technical adoption
4. **Practical implementation support** to help states deploy standards
5. **Regular communication** between standards development and operational needs

### Official Resources

- **Website**: https://transportation.org/data/jstan/
- **Data Portal**: https://data.transportation.org/jstan/
- **Parent Committee**: AASHTO Committee on Data Management and Analytics

---

## How Corridor Communicator Serves and Informs JSTAN

The DOT Corridor Communicator serves as both an **implementation platform** for JSTAN standards and a **feedback mechanism** to inform JSTAN's ongoing work. This bidirectional relationship creates a practical testing ground for standards while generating real-world insights.

### As an Implementation Platform

**1. Live Standards Testing Environment**
- Deploys JSTAN standards (IFC, SAE J2735, WZDx, TMDD) in production across multiple states
- Validates multi-state interoperability in real corridor operations
- Tests standards compatibility with existing state DOT systems
- Demonstrates practical integration patterns for other states to follow

**2. Reference Implementation**
- Provides working code examples for JSTAN standards integration
- Documents common implementation challenges and solutions
- Serves as a template for other state DOT deployments
- Demonstrates how standards work together in a complete system

**3. Multi-State Data Exchange Proof of Concept**
- Shows how different states can share data using common standards
- Tests cross-border coordination scenarios (I-80, I-35 corridors)
- Validates that standards enable true interoperability, not just theoretical compatibility
- Identifies where standards need refinement for real-world use

### As a Feedback Mechanism to JSTAN

**1. Gap Identification**
- **Real-time operational data reveals missing standards**: When the Corridor Communicator encounters data that doesn't fit existing schemas, it highlights gaps JSTAN should address
- **Cross-standard conflicts surface during integration**: Attempting to use multiple standards together reveals inconsistencies that JSTAN can resolve
- **State-specific variations become visible**: Shows where states interpret standards differently, indicating need for clarification

**2. Practical Adoption Insights**
- **Implementation difficulty metrics**: Tracks which standards are easy vs. hard for states to adopt
- **Resource requirements**: Documents staff time, training, and infrastructure needed
- **Vendor compatibility issues**: Identifies which vendor systems struggle with standard compliance
- **Cost-benefit analysis**: Shows which standards deliver the most value for state DOT operations

**3. Use Case Validation**
- **Confirms standards solve real problems**: Demonstrates whether JSTAN standards actually address the operational challenges they're designed for
- **Identifies overlooked scenarios**: Reveals edge cases and special situations JSTAN standards should cover
- **Multi-state coordination patterns**: Shows how states actually collaborate, informing future standards development

**4. Data for JSTAN Decision-Making**

The Corridor Communicator generates actionable data that JSTAN can use:

| Data Type | How JSTAN Can Use It | Example |
|-----------|---------------------|---------|
| **Standards Adoption Rates** | Prioritize which standards to promote | "85% of states can integrate WZDx, only 30% use IFC for bridges" |
| **Integration Time** | Estimate deployment timelines | "Average state takes 3 months to implement SAE J2735 messaging" |
| **Interoperability Metrics** | Validate cross-vendor compatibility | "IFC models from Vendor A work seamlessly with Vendor B's software" |
| **Error Patterns** | Identify common implementation mistakes | "60% of states incorrectly encode TMDD coordinates in first deployment" |
| **Feature Usage Analytics** | Guide standards evolution | "States primarily use 40% of IFC bridge properties - simplify the rest" |

**5. Real-World Testing for Proposed Standards**

Before JSTAN recommends a new standard to AASHTO:
- **Pilot in Corridor Communicator**: Deploy the proposed standard across 2-3 states
- **Measure impact**: Quantify improvements in data quality, interoperability, or operational efficiency
- **Collect state feedback**: Get practitioner input on usability and value
- **Refine before adoption**: Use insights to improve the standard before AASHTO endorsement
- **Demonstrate ROI**: Show AASHTO concrete benefits from actual deployments

### Informing the AASHTO GitHub Proposal

The Corridor Communicator directly supports JSTAN's proposed AASHTO GitHub repository by:

**1. Demonstrating Agile Standards Management**
- Shows how standards need rapid iteration based on real-world feedback
- Documents version control requirements for transportation standards
- Illustrates how states can contribute improvements to living standards

**2. Generating Use Cases for AI Integration**
- Collects data on how AI could assist with:
  - Automated standards compliance checking
  - Intelligent data transformation between formats
  - Predictive gap analysis for future standards needs
- Provides training data for AI-powered standards tools

**3. Model for State Collaboration**
- Demonstrates how states can jointly develop and refine standards
- Shows value of continuous improvement vs. fixed publication cycles
- Illustrates how to balance innovation with standardization

### Feedback Loop: Implementation → Insights → Refinement

```
┌─────────────────────────────────────────────────────────┐
│  1. JSTAN Recommends Standard                           │
│     (e.g., "Use IFC 4.3 for bridge data exchange")     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  2. Corridor Communicator Implements Standard           │
│     - Integrates IFC 4.3 across Iowa, Nebraska, Ohio   │
│     - Encounters real-world challenges                  │
│     - Documents what works and what doesn't             │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  3. Generate Implementation Data                         │
│     - "IFC property X missing from 40% of state models" │
│     - "Vendor software Y can't parse IFC geometry"      │
│     - "States need simplified IFC export templates"     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  4. Feed Insights Back to JSTAN                         │
│     - Present findings at JSTAN meetings                │
│     - Recommend standard refinements                     │
│     - Propose implementation guidance additions          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  5. JSTAN Refines Standard                              │
│     - Updates IFC guidance based on feedback            │
│     - Creates simplified templates for states           │
│     - Works with vendors to improve compatibility       │
└────────────────┬────────────────────────────────────────┘
                 │
                 └─────► (Loop back to Step 2 with improved standard)
```

### Value Proposition for JSTAN Members

As a JSTAN member using the Corridor Communicator, you can:

✅ **See your standards work in action** - Watch how your recommendations perform in real deployments
✅ **Collect evidence for AASHTO** - Bring concrete data to support standards adoption
✅ **Identify issues early** - Find problems before standards are widely deployed
✅ **Test new ideas quickly** - Prototype proposed standards without requiring full state commitment
✅ **Build case studies** - Document successful implementations for grant applications and peer states
✅ **Inform your JSTAN contributions** - Base recommendations on actual operational experience, not just theory

### Making JSTAN More Effective

Tools like the Corridor Communicator help JSTAN function more effectively in the AASHTO environment by:

1. **Providing Evidence-Based Recommendations**: Replace "we think this standard would help" with "we deployed this standard across 5 states and measured 30% improvement"

2. **Accelerating Adoption Cycles**: Test → Refine → Deploy faster than traditional publication cycles allow

3. **Demonstrating Multi-Committee Coordination**: Show how JSTAN standards support goals of structures committees, ITS committees, and data committees simultaneously

4. **Building State Buy-In**: When states see standards working in production, they're more likely to support AASHTO adoption

5. **Creating Living Documentation**: Generate up-to-date implementation guides based on actual deployments, complementing formal AASHTO publications

---

## JSTAN Mission & Scope

### Mission Statement

> Champion and coordinate efficient information flow throughout the lifecycle of all assets and related information that comprise transportation systems through open data standards, data governance, schema development, and collaborative public/private partnerships.

### Core Objectives

1. **Coordinate Schema Development** - Ensure consistent data structures across transportation domains
2. **Identify Gaps** - Find missing standards and specifications
3. **Resolve Conflicts** - Address inconsistencies between competing standards
4. **Avoid Duplication** - Prevent redundant standardization efforts
5. **Promote Adoption** - Help agencies implement open data standards

### Focus Areas

- **Asset Management** - Standardize infrastructure inventory data
- **Bridge & Structures** - IFC-based exchange specifications
- **ITS & Connected Vehicles** - Real-time data sharing protocols
- **Pavement Management** - Condition assessment data standards
- **Traffic Data** - Volume, speed, and incident reporting
- **Work Zone Data** - Construction and maintenance activities

---

## Key Standards & Schemas

### 1. IFC Schema (Industry Foundation Classes)

**AASHTO Resolution AR-1-19 (2019)**: Adopted IFC Schema as the national standard for exchange of electronic engineering data

**What is IFC?**
- Open, international standard for Building Information Modeling (BIM)
- Developed by buildingSMART International
- Enables interoperability between different software platforms
- Supports entire asset lifecycle (design → construction → operation → maintenance)

**IFC Bridge Extension:**
- Specific schema for bridge infrastructure
- Supports geometric, structural, and asset data
- Enables design-to-construction data exchange
- Version: IFC 4.3 (current), IFC 5.0 (in development)

**Key Benefits:**
- **Vendor-neutral** - Works across all major CAD/BIM platforms
- **Comprehensive** - Covers geometry, properties, relationships
- **Extensible** - Can be customized for specific needs
- **Long-term** - Ensures data longevity beyond software lifecycles

### 2. IDS (Information Delivery Specification)

**AASHTO Publication IDM-1 (2023)**: Information Delivery Manual for Design to Construction Data Exchange for Highway Bridges, Version 1.0

**What is IDS?**
- Computer-interpretable (XML) standard
- Defines what information must be delivered in BIM exchanges
- Specifies requirements for objects, classifications, properties, values, and units
- Enables automated model checking and validation

**IDS Facets (Requirements Categories):**

1. **Entity (Classes)** - Required object types (e.g., IfcBridge, IfcBeam)
2. **Attributes** - Required properties (e.g., Name, Description)
3. **Classification** - Required classification systems (e.g., Uniformat, Omniclass)
4. **Properties** - Custom property requirements (e.g., DesignLoad, Material)
5. **Materials** - Material specifications
6. **PartOf** - Spatial/containment relationships

**XML Example:**
```xml
<ids xmlns="http://standards.buildingsmart.org/IDS">
  <specification name="Bridge Design Requirements">
    <applicability>
      <entity>
        <name>
          <simpleValue>IFCBRIDGE</simpleValue>
        </name>
      </entity>
    </applicability>
    <requirements>
      <property dataType="IFCLABEL" minOccurs="1">
        <propertySet>
          <simpleValue>Pset_BridgeCommon</simpleValue>
        </propertySet>
        <name>
          <simpleValue>DesignLife</simpleValue>
        </name>
      </property>
    </requirements>
  </specification>
</ids>
```

### 3. CTI Standards (Connected Transportation Interoperability)

**Joint Development**: AASHTO, ITE, NEMA, SAE International
**Sponsor**: USDOT

**CTI Standards Suite:**
- **NTCIP 1218** - Roadside equipment configuration
- **SAE J2735** - Message set dictionary for connected vehicles
- **IEEE 1609 (WAVE)** - Wireless access in vehicular environments
- **ISO 19091** - Cooperative ITS - Spatiotemporal intersection data

**Relevance to Connected Corridors:**
- Standardizes V2X communication protocols
- Ensures interoperability between RSUs, OBUs, TMCs
- Defines data formats for SPaT, MAP, BSM messages
- Critical for multi-state corridor deployments

### 4. Open Data Standards

**Focus**: Making transportation data accessible and usable

**Key Initiatives:**
- **GTFS** (General Transit Feed Specification) - Transit data
- **MDS** (Mobility Data Specification) - Micromobility data
- **WZDx** (Work Zone Data Exchange) - Construction zone information
- **Curb Data Specification** - Curb management and regulations

---

## Integration with DOT Corridor Communicator

### Current Integration Points

#### 1. **ITS Equipment Inventory**

**JSTAN Alignment:**
- Equipment data follows IFC-based asset classification
- Supports spatial relationships (corridor → segment → device)
- Uses standardized property sets for device attributes

**DOT Corridor Communicator Implementation:**
```javascript
// ITS Equipment with JSTAN-compatible structure
{
  "equipment_id": "RSU-IA-I80-MM100",
  "equipment_type": "rsu",  // Maps to IFC entity
  "properties": {
    "manufacturer": "Cohda Wireless",
    "model": "MK5",
    "firmware_version": "4.2.1",
    "installation_date": "2024-03-15",
    "design_life": 10,  // IDS requirement
    "latitude": 41.5868,
    "longitude": -93.6250
  },
  "relationships": {
    "corridor": "I-80",
    "state": "IA",
    "milepost": 100.5
  },
  "classification": {
    "system": "ITS Device Taxonomy",
    "code": "Connected Vehicle Infrastructure"
  }
}
```

**Benefits:**
- Standard-compliant asset tracking
- Interoperable with other states' systems
- Supports BIM for Infrastructure workflows
- Enables data exchange with FHWA, USDOT

#### 2. **Bridge Infrastructure Data**

**JSTAN Alignment:**
- Bridge inventory follows IFC Bridge schema
- Clearance data uses IDS-specified properties
- Supports design-to-construction data exchange

**DOT Corridor Communicator Integration:**
```javascript
// Bridge data following IFC Bridge + IDS
{
  "bridge_id": "NBI-123456",
  "ifc_entity": "IfcBridge",
  "properties": {
    "name": "I-80 over Des Moines River",
    "description": "Steel girder bridge",
    "design_life": 75,  // IDS required
    "vertical_clearance": 16.5,  // feet
    "horizontal_clearance": 42.0,
    "design_load": "HL-93",
    "year_built": 2015
  },
  "spatial_structure": {
    "corridor": "I-80",
    "milepost": 142.3,
    "latitude": 41.5868,
    "longitude": -93.6250
  },
  "psets": {  // Property Sets per IDS
    "Pset_BridgeCommon": {
      "ConstructionMethod": "Steel Girder",
      "DesignLife": 75,
      "Status": "In Service"
    },
    "Pset_BridgeGeometry": {
      "VerticalClearance": 16.5,
      "HorizontalClearance": 42.0,
      "SpanLength": 180.0
    }
  }
}
```

**Use Cases:**
- Over-height vehicle warnings (clearance data)
- Freight corridor planning (load capacity)
- Asset management integration
- Grant applications (infrastructure inventory)

#### 3. **Connected Vehicle Data Exchange**

**JSTAN Alignment:**
- V2X messages follow SAE J2735 standard
- RSU data follows NTCIP protocols
- Multi-state coordination uses CTI standards

**DOT Corridor Communicator Implementation:**
```javascript
// V2X Message (SPaT - Signal Phase and Timing)
{
  "message_type": "SAE_J2735_SPaT",
  "timestamp": "2025-12-27T10:30:00Z",
  "intersection_id": "IA-POLK-001",
  "states": [
    {
      "signal_group": 1,
      "phase": "green",
      "time_remaining": 15,  // seconds
      "confidence": 95
    },
    {
      "signal_group": 2,
      "phase": "red",
      "time_remaining": 45,
      "confidence": 95
    }
  ],
  "spatial_reference": {
    "latitude": 41.5868,
    "longitude": -93.6250,
    "elevation": 291.4
  }
}
```

**Benefits:**
- Standard-compliant V2X deployment
- Interoperable with other states
- Supports federal CV Pilot programs
- Enables cross-border data sharing

#### 4. **Traffic Data Standards**

**JSTAN Alignment:**
- Volume/speed data follows AASHTO Guidelines for Traffic Data Programs
- Incident data follows TMDD (Traffic Management Data Dictionary)
- Work zone data follows WZDx specification

**DOT Corridor Communicator Implementation:**
```javascript
// Incident Report (TMDD-compliant)
{
  "incident_id": "IA-I80-2025-12-27-001",
  "event_type": "crash",
  "severity": "major",
  "location": {
    "corridor": "I-80",
    "direction": "eastbound",
    "milepost": 100.5,
    "latitude": 41.5868,
    "longitude": -93.6250
  },
  "impact": {
    "lanes_blocked": 2,
    "total_lanes": 3,
    "queue_length": 2.5,  // miles
    "delay": 25  // minutes
  },
  "timestamp": {
    "detected": "2025-12-27T10:15:00Z",
    "verified": "2025-12-27T10:18:00Z",
    "cleared": null
  },
  "responders": ["Iowa State Patrol", "DOT FIRST Team"]
}
```

---

## Implementation Guidelines

### Phase 1: Data Inventory & Mapping

**Objective**: Understand current data structures and map to JSTAN standards

**Steps:**

1. **Audit Existing Data**
   - Inventory all data sources (ITS, bridges, traffic, assets)
   - Document current schemas and formats
   - Identify proprietary/non-standard elements

2. **Map to JSTAN Standards**
   - Match data fields to IFC properties
   - Identify IDS requirements for each asset type
   - Note gaps and required additions

3. **Document Mappings**
   ```javascript
   // Example: Current → JSTAN mapping
   {
     "current": {
       "field": "rsu_manufacturer",
       "type": "string",
       "example": "Cohda Wireless"
     },
     "jstan": {
       "entity": "IfcController",
       "property_set": "Pset_ControllerTypeCommon",
       "property": "Manufacturer",
       "data_type": "IfcLabel"
     }
   }
   ```

### Phase 2: Schema Enhancement

**Objective**: Extend database to support JSTAN-compliant data

**Database Changes:**

```sql
-- Add IFC entity type to ITS equipment
ALTER TABLE its_equipment
  ADD COLUMN ifc_entity VARCHAR(100),
  ADD COLUMN ifc_global_id UUID DEFAULT gen_random_uuid();

-- Add property sets table for IDS compliance
CREATE TABLE equipment_property_sets (
  id SERIAL PRIMARY KEY,
  equipment_id INTEGER REFERENCES its_equipment(id),
  property_set_name VARCHAR(100),
  property_name VARCHAR(100),
  property_value TEXT,
  data_type VARCHAR(50),
  unit VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add classification table
CREATE TABLE equipment_classifications (
  id SERIAL PRIMARY KEY,
  equipment_id INTEGER REFERENCES its_equipment(id),
  classification_system VARCHAR(100),
  classification_code VARCHAR(50),
  classification_name VARCHAR(200)
);

-- Add spatial relationships
CREATE TABLE spatial_relationships (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER,
  parent_type VARCHAR(50),
  child_id INTEGER,
  child_type VARCHAR(50),
  relationship_type VARCHAR(100),  -- e.g., "IfcRelAggregates", "IfcRelContainedInSpatialStructure"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Phase 3: API Development

**Objective**: Create endpoints for JSTAN-compliant data exchange

**New API Endpoints:**

```javascript
// IFC Export endpoint
app.get('/api/jstan/export/ifc', async (req, res) => {
  // Export ITS equipment as IFC file
  const { corridor, format } = req.query;

  // Generate IFC 4.3 XML or STEP file
  const ifcData = await generateIFCExport(corridor, format);

  res.setHeader('Content-Type', 'application/ifc');
  res.setHeader('Content-Disposition', `attachment; filename="${corridor}_its_equipment.ifc"`);
  res.send(ifcData);
});

// IDS Validation endpoint
app.post('/api/jstan/validate/ids', async (req, res) => {
  const { ifcData, idsSpecification } = req.body;

  // Validate IFC data against IDS requirements
  const validation = await validateAgainstIDS(ifcData, idsSpecification);

  res.json({
    success: validation.passed,
    errors: validation.errors,
    warnings: validation.warnings,
    compliance_rate: validation.compliance_percentage
  });
});

// CTI/V2X Data Exchange endpoint
app.post('/api/jstan/v2x/spat', async (req, res) => {
  const { intersection_id } = req.body;

  // Return SAE J2735 compliant SPaT message
  const spatMessage = await generateSPaTMessage(intersection_id);

  res.json({
    message_type: 'SAE_J2735_SPaT',
    version: '2016',
    data: spatMessage
  });
});

// TMDD Incident Feed
app.get('/api/jstan/incidents/tmdd', async (req, res) => {
  const { corridor, start_time, end_time } = req.query;

  // Return TMDD-compliant incident feed
  const incidents = await getIncidentsTMDD(corridor, start_time, end_time);

  res.setHeader('Content-Type', 'application/xml');
  res.send(generateTMDDXML(incidents));
});
```

### Phase 4: Data Governance

**Objective**: Establish processes for maintaining JSTAN compliance

**Best Practices:**

1. **Data Stewardship**
   - Assign data owners for each domain
   - Define update procedures
   - Establish quality control checks

2. **Version Control**
   - Track schema versions
   - Document changes
   - Maintain backward compatibility

3. **Validation Rules**
   - Automated IDS validation on data entry
   - Regular compliance audits
   - Error reporting and remediation

4. **Documentation**
   - Maintain data dictionaries
   - Document mappings to standards
   - Provide user guides for data entry

---

## Data Exchange Protocols

### 1. IFC File Exchange

**Use Case**: Share bridge/infrastructure designs with contractors

**Process:**
1. Export asset data as IFC 4.3 file
2. Include required property sets per IDS
3. Validate against IDS specification
4. Share via secure file transfer

**Example IFC Structure:**
```
IFC Export
├── IfcProject (I-80 Connected Corridor)
│   ├── IfcSite (Iowa DOT District 1)
│   │   ├── IfcRoad (I-80 Mainline)
│   │   │   ├── IfcBridge (Bridge over Des Moines River)
│   │   │   │   ├── Properties (Pset_BridgeCommon)
│   │   │   │   └── Geometry (IfcSweptSolid)
│   │   │   └── IfcAlignment (Horizontal/Vertical)
│   │   └── IfcController (RSU-IA-I80-MM100)
│   │       ├── Properties (Pset_ControllerTypeCommon)
│   │       └── Location (IfcLocalPlacement)
└── Classification (ITS Device Taxonomy)
```

### 2. V2X Message Exchange

**Use Case**: Real-time connected vehicle data sharing

**Supported Messages (SAE J2735):**
- **SPaT** - Signal Phase and Timing
- **MAP** - Intersection geometry
- **BSM** - Basic Safety Message
- **TIM** - Traveler Information Message
- **PSM** - Personal Safety Message

**Integration:**
```javascript
// Subscribe to V2X message feed
const v2xClient = new V2XMessageClient({
  endpoint: 'wss://api.dot-corridor.gov/v2x/stream',
  protocols: ['SAE_J2735_2016'],
  authentication: apiKey
});

v2xClient.on('SPaT', (message) => {
  // Process signal phase and timing
  updateTrafficSignalStatus(message);
});

v2xClient.on('BSM', (message) => {
  // Process basic safety message from vehicles
  updateProbeData(message);
});
```

### 3. Work Zone Data Exchange (WZDx)

**Use Case**: Share construction/maintenance activity data

**Standard**: WZDx v4.2 specification
**Format**: GeoJSON

**Example:**
```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "properties": {
      "road_event_id": "IA-I80-WZ-2025-001",
      "event_type": "work-zone",
      "road_name": "Interstate 80",
      "direction": "eastbound",
      "beginning_milepost": 100.0,
      "ending_milepost": 105.5,
      "start_date": "2025-06-01T06:00:00Z",
      "end_date": "2025-09-30T18:00:00Z",
      "lanes": [{
        "type": "shoulder",
        "status": "closed"
      }, {
        "type": "general",
        "status": "open",
        "restrictions": ["reduced-width"]
      }]
    },
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-93.625, 41.586],
        [-93.550, 41.590],
        [-93.475, 41.594]
      ]
    }
  }]
}
```

### 4. AASHTOWare OpenAPI Integration

**Use Case**: Integrate with state DOT enterprise systems

**Capabilities:**
- Asset management data sync
- Bridge inspection records
- Pavement condition data
- Maintenance work orders

**Authentication:**
```javascript
const aashtowareClient = new AASHTOWareAPI({
  baseURL: 'https://api.aashtoware.org/v1',
  apiKey: process.env.AASHTOWARE_API_KEY,
  agency: 'IOWA_DOT'
});

// Fetch bridge inspection data
const inspections = await aashtowareClient.bridges.inspections.list({
  corridor: 'I-80',
  inspection_date_from: '2024-01-01',
  inspection_date_to: '2024-12-31'
});

// Sync to DOT Corridor Communicator
await syncBridgeInspections(inspections);
```

---

## Use Cases & Examples

### Use Case 1: Multi-State V2X Corridor Deployment

**Scenario**: Iowa, Nebraska, and Illinois collaborate on I-80 connected corridor

**JSTAN Standards Used:**
- SAE J2735 for V2X messages
- NTCIP 1218 for RSU configuration
- IFC for infrastructure documentation
- CTI standards for interoperability

**Implementation:**
1. **Common Data Model**
   ```javascript
   // All three states use same RSU data structure
   const rsuStandard = {
     ifc_entity: "IfcController",
     sae_j2735_version: "2016",
     ntcip_profile: "1218-v3",
     property_sets: [
       "Pset_ControllerTypeCommon",
       "Pset_V2XDeviceCommon"
     ]
   };
   ```

2. **Cross-State Data Sharing**
   - Iowa exports ITS inventory as IFC
   - Nebraska imports and validates against IDS
   - Illinois subscribes to real-time V2X feed
   - All states use common classification system

3. **Grant Application**
   - Combined IFC export shows complete corridor
   - Demonstrates standards compliance
   - Proves interoperability commitment
   - Strengthens multi-state coordination score

**Benefits:**
- Seamless data exchange between states
- Consistent V2X message interpretation
- Reduced deployment costs (shared infrastructure)
- Stronger grant applications (multi-state collaboration)

### Use Case 2: Bridge BIM for Asset Management

**Scenario**: Track bridge conditions and plan maintenance using BIM

**JSTAN Standards Used:**
- IFC Bridge schema
- IDS for design-to-construction exchange
- AASHTO Bridge Management standards

**Implementation:**

1. **Initial Bridge Model** (from design)
   - Import bridge IFC model from design consultant
   - Validate against AASHTO IDS specification
   - Store in asset management database

2. **Inspection Data Integration**
   ```javascript
   // Add inspection findings as IFC properties
   const inspectionUpdate = {
     ifc_global_id: "3ZqPH8qTj9QP00000L0001",
     property_sets: {
       "Pset_BridgeCondition": {
         "InspectionDate": "2024-12-15",
         "DeckConditionRating": 7,
         "SuperstructureRating": 8,
         "SubstructureRating": 7,
         "RecommendedAction": "Routine Maintenance"
       }
     }
   };
   ```

3. **Maintenance Planning**
   - Query bridges with condition rating < 6
   - Generate work orders
   - Track costs against asset lifecycle
   - Update bridge model with completed work

4. **Grant Applications**
   - Export degraded bridges as IFC dataset
   - Demonstrate need for rehabilitation funding
   - Show condition trends over time
   - Prove good asset management practices

**Benefits:**
- Single source of truth for bridge data
- Standards-compliant documentation
- Improved grant competitiveness
- Better long-term asset planning

### Use Case 3: Traffic Data Exchange with Regional Partners

**Scenario**: Share real-time traffic data with MPOs, universities, and private sector

**JSTAN Standards Used:**
- TMDD (Traffic Management Data Dictionary)
- AASHTO Traffic Data Guidelines
- Open data standards (JSON/XML APIs)

**Implementation:**

1. **Standardized Data Feed**
   ```javascript
   // TMDD-compliant incident feed
   app.get('/api/jstan/traffic/incidents', async (req, res) => {
     const incidents = await getIncidents(req.query);

     const tmddFeed = incidents.map(inc => ({
       event_id: inc.id,
       event_type: mapToTMDDEventType(inc.type),
       location: {
         link_id: inc.corridor,
         direction: inc.direction,
         milepost: inc.milepost
       },
       severity: mapToTMDDSeverity(inc.severity),
       detected_time: inc.detected_at,
       verified_time: inc.verified_at,
       expected_clearance_time: inc.expected_clear
     }));

     res.json({ incidents: tmddFeed, standard: "TMDD-v3.1" });
   });
   ```

2. **Data Sharing Agreements**
   - Define permitted uses
   - Set update frequencies
   - Establish SLAs (Service Level Agreements)
   - Document API access procedures

3. **Quality Assurance**
   - Automated validation against TMDD schema
   - Data completeness checks
   - Timeliness monitoring
   - Error logging and alerts

**Benefits:**
- Consistent data interpretation
- Easier integration for partners
- Demonstrates open data commitment
- Supports regional planning efforts

### Use Case 4: Grant Proposal Enhancement with JSTAN Compliance

**Scenario**: Strengthen SMART Grant application by demonstrating standards compliance

**JSTAN Standards Demonstrated:**
- IFC for BIM-based design documentation
- SAE J2735 for V2X interoperability
- CTI standards for multi-state coordination
- Open data commitments

**Grant Application Sections:**

**Technical Approach:**
> "Our I-80 Connected Corridor deployment will utilize AASHTO JSTAN-endorsed standards throughout the project lifecycle:
>
> - **Design Phase**: All infrastructure will be documented using IFC 4.3 schema per AASHTO Resolution AR-1-19, enabling seamless data exchange with contractors and neighboring states.
>
> - **V2X Deployment**: RSUs will broadcast SAE J2735:2016 compliant messages (SPaT, MAP, BSM) ensuring interoperability with vehicles from all OEMs and compatibility with adjacent state deployments.
>
> - **Data Sharing**: We commit to publishing real-time traffic and V2X data using TMDD and CTI standards, supporting regional research and commercial applications.
>
> - **Asset Management**: Bridge and roadway infrastructure will be maintained in IFC-compliant BIM models, validated against AASHTO IDS specifications, ensuring long-term data interoperability and preservation."

**Project Benefits:**
- Standards compliance demonstrates technical sophistication
- Multi-state interoperability proves regional coordination
- Open data commitments support broader impacts
- BIM/IFC adoption shows innovation and forward-thinking

**Scoring Impact:**
- **Technical Merit**: +10 points (standards-based approach)
- **Project Impact**: +5 points (regional interoperability)
- **Sustainability**: +5 points (long-term data preservation)

---

## Resources & Documentation

### Official JSTAN Resources

1. **AASHTO JSTAN Portal**
   - URL: https://transportation.org/data/jstan/
   - Contact: jstan@aashto.org
   - Access: Public (some resources member-only)

2. **AASHTO Data Management Committee**
   - URL: https://transportation.org/data/
   - Focus: Data governance, standards, analytics
   - Meetings: Quarterly

3. **AASHTO Store - Standards & Specifications**
   - URL: https://store.transportation.org/
   - Purchase: IDS specifications, IDM documents, guidelines

### IFC & BIM Resources

4. **buildingSMART International**
   - URL: https://www.buildingsmart.org/
   - IFC Documentation: https://standards.buildingsmart.org/IFC
   - IDS Specification: https://technical.buildingsmart.org/projects/information-delivery-specification-ids/

5. **BIM for Bridges (TPF-5(372))**
   - URL: https://www.bimforbridgesus.com/
   - Resources: Sample IFC files, IDS templates, training materials
   - Contact: BIM for Bridges technical team

6. **FHWA Bridge BIM Initiative**
   - URL: https://www.fhwa.dot.gov/bridge/bim/
   - Guides: Implementation guides, case studies
   - Tools: IFC validators, conversion utilities

### V2X & Connected Vehicles

7. **SAE International - J2735 Standard**
   - URL: https://www.sae.org/standards/content/j2735_201603/
   - Purchase: SAE J2735:2016 (Message Set Dictionary)
   - Updates: Regular revisions (check for latest version)

8. **USDOT ITS JPO - Connected Vehicle Standards**
   - URL: https://www.its.dot.gov/research_archives/connected_vehicle/connected_vehicle_standards.htm
   - Resources: Standards fact sheets, implementation guides
   - Tools: Message validators, test tools

9. **CTI Standards Portal**
   - Partners: AASHTO, ITE, NEMA, SAE
   - Focus: Traffic signal controllers, roadside equipment
   - Access: Through professional society membership

### Traffic & Asset Management

10. **AASHTO Guidelines for Traffic Data Programs**
    - Store Link: https://store.transportation.org/Item/PublicationDetail?ID=616
    - Content: Volume, classification, speed data standards

11. **TAM Portal (Transportation Asset Management)**
    - URL: https://www.tam-portal.com/
    - Resources: TAM guides, best practices, tools
    - Focus: Asset inventory, condition assessment, investment strategies

12. **AASHTOWare**
    - URL: https://www.aashtoware.org/
    - Products: Bridge management, pavement management, project management
    - API: https://adifpromo.azurewebsites.net/

### Open Data Standards

13. **Work Zone Data Exchange (WZDx)**
    - GitHub: https://github.com/usdot-jpo-ode/wzdx
    - Specification: v4.2 (latest)
    - Tools: Validators, sample feeds

14. **General Transit Feed Specification (GTFS)**
    - Documentation: https://gtfs.org/
    - Real-time: GTFS-RT for live updates
    - Adoption: Used by all major transit agencies

15. **Mobility Data Specification (MDS)**
    - GitHub: https://github.com/openmobilityfoundation/mobility-data-specification
    - Focus: Micromobility (scooters, bikes)
    - Version: 2.0 (current)

### Training & Implementation Support

16. **AASHTO Webinars**
    - Schedule: Quarterly JSTAN updates
    - Topics: New standards, case studies, Q&A
    - Registration: Through AASHTO member portal

17. **buildingSMART Certification**
    - Programs: IFC Coordinator, IFC Manager
    - Online: Self-paced courses
    - Cost: $500-1500 per certification

18. **ITS Professional Capacity Building (PCB)**
    - URL: https://www.pcb.its.dot.gov/
    - Courses: V2X deployment, standards implementation
    - Cost: Free (FHWA-funded)

---

## Quick Start Checklist

### For DOT Corridor Communicator Administrators:

- [ ] Review current data structures against JSTAN standards
- [ ] Identify gaps in IFC/IDS compliance
- [ ] Plan database schema enhancements
- [ ] Develop IFC export functionality
- [ ] Implement IDS validation
- [ ] Create V2X message endpoints
- [ ] Establish data sharing agreements
- [ ] Document JSTAN compliance in grant applications
- [ ] Train staff on standards and tools
- [ ] Join AASHTO JSTAN mailing list

### For Grant Writers:

- [ ] Reference JSTAN standards in technical approach
- [ ] Highlight IFC/BIM adoption plans
- [ ] Demonstrate V2X interoperability commitment
- [ ] Show multi-state data sharing capabilities
- [ ] Include standards compliance in sustainability plan
- [ ] Use JSTAN buzzwords (IFC, IDS, CTI, SAE J2735)
- [ ] Cite AASHTO resolutions (AR-1-19)
- [ ] Include standards training in project budget

### For IT/Database Teams:

- [ ] Install IFC parsing libraries
- [ ] Set up IDS validation engine
- [ ] Create property sets tables
- [ ] Implement classification system
- [ ] Build IFC export pipeline
- [ ] Develop V2X message formatters
- [ ] Add TMDD incident feed
- [ ] Create data quality dashboards

---

## Contact & Support

**JSTAN Committee:**
- Email: jstan@aashto.org
- Chair: Trisha Stafanski (Minnesota DOT / MnDOT)

**AASHTO:**
- Phone: (202) 624-5800
- Address: 555 12th Street NW, Suite 1000, Washington, DC 20004

**DOT Corridor Communicator Support:**
- For technical issues: Contact your system administrator
- Documentation: Available in the app under "📚 Docs"
- For JSTAN-related questions: jstan@aashto.org

---

**Document Version:** 1.0
**Last Updated:** December 27, 2025
**Prepared By:** DOT Corridor Communicator Development Team
**Next Review:** June 2026

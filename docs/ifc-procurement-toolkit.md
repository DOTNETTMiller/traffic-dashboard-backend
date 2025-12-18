![CCAI Logo](/assets/ccai-logo.png)

# IFC/BIM Procurement Toolkit for State DOTs

## Overview

This toolkit provides ready-to-use procurement language, specifications, and quality assurance criteria for state DOTs requiring BIM/IFC deliverables with operational digital infrastructure capabilities. Use these templates to ensure contractors and design consultants deliver IFC models that integrate with ARC-ITS systems, support V2X applications, and enable digital twin operations.

**What's Included:**
- Model RFP sections for design contracts
- IFC technical specifications and property requirements
- Quality assurance / quality control (QA/QC) acceptance criteria
- Deliverable checklists by project type
- Payment milestone tied to IFC quality
- Sample contract amendment language (for existing contracts)

---

## Section 1: Model RFP Language

### 1.1 General BIM/IFC Requirements (Insert into Section 2: Scope of Work)

```
2.X BIM/IFC MODEL DELIVERABLES

2.X.1 General Requirements

The Consultant shall deliver Building Information Models (BIM) in Industry Foundation Classes (IFC) format compliant with ISO 16739 (IFC4 or IFC4x3). All models shall be suitable for lifecycle use including design coordination, construction, operations, maintenance, and integration with Intelligent Transportation Systems (ITS).

2.X.2 IFC Schema Version

- Bridges: IFC4 or IFC4x3 (preferred)
- Roads and Highways: IFC4x3 (required for alignment support)
- ITS Equipment: IFC4 minimum, IFC4x3 preferred
- Structures (buildings, retaining walls): IFC4 minimum

2.X.3 Coordinate Reference Systems

All IFC models shall include:
a) Geolocation using IfcSite entity with RefLatitude and RefLongitude
b) Map conversion (IfcMapConversion) specifying:
   - State Plane Coordinate System zone (EPSG code required)
   - Vertical datum (NAVD88 preferred)
   - Units (US Survey Feet or International Feet, clearly specified)
   - Eastings, Northings, OrthogonalHeight origins
c) For linear projects: IfcAlignment entities with stationing and offset methodology

2.X.4 Level of Development (LOD)

Minimum LOD requirements by project phase:
- Design Development (DD): LOD 300
- Construction Documents (CD): LOD 350
- As-Built: LOD 400 (including as-constructed dimensions and properties)

2.X.5 Operational Properties

All IFC elements representing physical assets shall include property sets enabling operational use:

For ITS Equipment (DMS, cameras, signals, detectors, weather stations):
□ Unique device identifier (device_id) matching State's asset management system
□ Manufacturer and model number
□ Installation date and warranty information
□ Communication protocol (NTCIP 1203/1204/1209/1211, SNMP, HTTP API, etc.)
□ Network addressing (IP address, MAC address where applicable)
□ NTCIP object identifiers for real-time data integration
□ Mounting specifications (height, orientation, coverage area)

For Bridges:
□ Design load capacity and clearance heights (for V2X traveler information)
□ Structural element classifications per AASHTO/NBIS
□ Inspection access points and maintenance requirements
□ Condition rating fields (prepared for future population)

For Roadways:
□ Lane configuration and widths
□ Speed limits and regulatory information
□ Surface type and material specifications
□ Maintenance zones and responsible jurisdictions

2.X.6 Submission Requirements

IFC models shall be submitted at the following milestones:
a) 60% Design Review: IFC model for preliminary gap analysis
b) 90% Design Review: IFC model for final validation
c) 100% Construction Documents: Final IFC for bid package
d) As-Built Submission: Updated IFC reflecting field conditions

Format: Native IFC (.ifc file), not proprietary formats requiring vendor software
Size: Optimized for web-based viewers (target < 100 MB per file; coordinate with State if larger)
Validation: Consultant shall validate IFC using buildingSMART IDS (Information Delivery Specification) provided by State

2.X.7 Deliverable Checklist

Each IFC submission shall include:
□ IFC file(s) with clearly named files (ProjectName_Bridge_60pct.ifc)
□ Model validation report from IDS checker
□ Property completeness report (% of required properties populated)
□ Coordinate system documentation (EPSG code, datum, units)
□ Element count summary (number of beams, columns, ITS devices, etc.)
□ Known issues log (if any properties cannot be determined at current phase)

Failure to meet minimum requirements (see Section 2.X.8) will result in rejection of deliverable and resubmission required within 10 business days at no additional cost to State.
```

### 1.2 Technical Specifications (Insert into Section 3: Technical Requirements)

```
3.X IFC MODEL TECHNICAL SPECIFICATIONS

3.X.1 IFC Entity Requirements by Asset Type

The following IFC entities shall be used for specified infrastructure types:

BRIDGES:
- IfcBridge (IFC4x3) or IfcBuilding (IFC4) for overall structure
- IfcBeam for girders and stringers
- IfcColumn for piers and bents
- IfcPlate for deck slabs
- IfcFooting for abutments and pile caps
- IfcReinforcingBar for rebar (LOD 400 only)

ROADWAYS (IFC4x3 required):
- IfcRoad for overall roadway project
- IfcAlignment for horizontal and vertical alignments
- IfcPavement for surface courses
- IfcKerb for curbs and barriers
- IfcSign for static signage
- IfcRoadSegment for geometric sections

ITS EQUIPMENT:
- IfcDynamicMessageSign (or IfcActuator with subtype) for DMS
- IfcCamera for CCTV and traffic cameras
- IfcSignal for traffic signals and lane control
- IfcSensor (or IfcTrafficSensor) for detectors and vehicle sensors
- IfcWeatherStation (or IfcSensor with subtype) for RWIS
- IfcRoadsideUnit (or IfcDistributionElement) for CV/V2X RSUs
- IfcCommunicationsAppliance for network switches and cabinets

SAFETY INFRASTRUCTURE:
- IfcRailing for guard rails and barriers
- IfcSurfaceFeature for pavement markings (IFC4x3)

3.X.2 Required Property Sets (Pset_*)

Consultant shall populate the following buildingSMART property sets where applicable:

COMMON PROPERTIES (all elements):
- Pset_ManufacturerTypeInformation (Manufacturer, ModelLabel, ModelReference)
- Pset_ServiceLife (ServiceLifeDuration, InstallationDate)

ITS EQUIPMENT SPECIFIC:
- Pset_DeviceCommon (device_id, DeviceType)
- Pset_NetworkConnection (ip_address, MAC_Address, Protocol)
- Pset_LocationCommon (Latitude, Longitude, Elevation)
- Pset_OperationalStatus (CurrentStatus - field prepared for operations phase)

If standard Pset does not exist, Consultant shall propose custom property sets following buildingSMART naming conventions (agency review and approval required).

3.X.3 Custom Properties for State DOT Operational Integration

In addition to standard property sets, the following custom properties shall be added to enable integration with State's ARC-ITS and asset management systems:

For all ITS Equipment:
| Property Name | Data Type | Example Value | Required/Optional |
|---------------|-----------|---------------|-------------------|
| device_id | String | I80-DMS-125.5 | Required |
| ntcip_standard | String | NTCIP 1203 | Required for NTCIP devices |
| ntcip_oid | String | 1.3.6.1.4.1.1206.4.2.3 | Required for NTCIP devices |
| data_feed_url | URL | http://tmc.state.gov/api/dms/I80-DMS-125.5 | Optional (operations phase) |
| alert_email | Email | its-maint@stateDOT.gov | Optional |
| maintenance_zone | String | District 3, Zone 5 | Required |
| comm_backhaul | String | Fiber Cabinet 12-5 | Optional |

For Bridges (V2X integration):
| Property Name | Data Type | Example Value | Required/Optional |
|---------------|-----------|---------------|-------------------|
| clearance_height_vertical | Length (ft) | 16.5 ft | Required |
| clearance_width_horizontal | Length (ft) | 48.0 ft | Required |
| weight_limit_tons | Weight (tons) | 80 tons | Required |
| restrictions | String | Oversize permit required >14' high | Optional |

Property values shall be validated against State's asset management system naming conventions (provided by State PM within 10 days of contract execution).

3.X.4 Geolocation Accuracy Requirements

Horizontal Accuracy: ±3 feet (0.91 meters) for all elements
Vertical Accuracy: ±0.5 feet (0.15 meters) for elevation-critical elements (clearances, drainage)
Validation Method: Consultant shall provide survey control documentation and coordinate verification report

3.X.5 Alignment and Linear Referencing

For roadway and corridor projects:
a) IfcAlignment entity required with baseline geometry
b) Station equations documented in IfcLinearPositioningElement
c) All ITS equipment positioned using station/offset methodology
d) Cross-reference table mapping IFC GUID → Station/Offset → Lat/Long

3.X.6 File Optimization

IFC files shall be optimized for performance:
- Target file size: <100 MB (coordinate with State if larger files necessary)
- Geometry tessellation: Appropriate for visualization (not excessive triangulation)
- External references: Minimize or eliminate (self-contained IFC preferred)
- Validation: No errors when opened in industry-standard IFC viewers (BIM Vision, Solibri, etc.)

3.X.7 Quality Assurance Validation

Prior to each submission, Consultant shall:
1. Open IFC in at least two IFC viewers (e.g., BIM Vision and xBIM Xplorer) to verify display
2. Run buildingSMART IDS validation using State-provided specification
3. Generate property completeness report
4. Verify coordinate system using sample GPS coordinates of known locations
5. Submit validation documentation with IFC file

Submissions failing validation will be rejected and resubmission required within 10 business days at no cost to State.
```

---

## Section 2: QA/QC Acceptance Criteria

### 2.1 IFC Model Acceptance Checklist

Use this checklist to evaluate IFC deliverables before acceptance:

**PHASE 1: FILE INTEGRITY (Go/No-Go Criteria)**

□ IFC file opens without errors in BIM Vision
□ IFC file opens without errors in xBIM Xplorer or FZKViewer
□ File size reasonable (<100 MB or pre-approved if larger)
□ No missing geometry (visual inspection against CAD/PDF plans)
□ Coordinate system matches specifications (verify sample point)

**Acceptance Threshold**: 100% compliance required (any failure = rejection)

**PHASE 2: GEOLOCATION & COORDINATE SYSTEM**

□ IfcSite entity present with RefLatitude and RefLongitude
□ IfcMapConversion specifies correct EPSG code
□ Vertical datum documented (NAVD88 or as specified)
□ Units clearly specified (US Survey Feet vs. International Feet)
□ Sample location verified (±3 feet horizontal, ±0.5 feet vertical)

**Acceptance Threshold**: 100% compliance required

**PHASE 3: REQUIRED IFC ENTITIES**

Verify presence of specified IFC types:

For Bridge Projects:
□ IfcBridge (or IfcBuilding)
□ IfcBeam (count matches structural plans)
□ IfcColumn (count matches structural plans)
□ IfcPlate (deck elements)
□ IfcFooting (abutments)

For Roadway Projects:
□ IfcRoad (IFC4x3)
□ IfcAlignment
□ IfcPavement
□ IfcKerb (if applicable)

For ITS Equipment:
□ All DMS as IfcDynamicMessageSign or IfcActuator
□ All cameras as IfcCamera
□ All signals as IfcSignal
□ All detectors as IfcSensor or IfcTrafficSensor

**Acceptance Threshold**: 95% of expected entities present (minor omissions acceptable with explanation)

**PHASE 4: PROPERTY COMPLETENESS**

Run automated property completeness check (via platform or IDS validator):

| Property Category | Target Completeness | Weight |
|-------------------|---------------------|--------|
| device_id (ITS equipment) | 100% | Critical |
| Geolocation (lat/long) | 95% | High |
| Manufacturer/Model | 90% | High |
| Installation Date | 80% | Medium |
| NTCIP properties | 90% | High |
| Maintenance zone | 90% | Medium |
| Communication protocol | 85% | High |

**Acceptance Threshold**: Weighted score ≥85%

**Calculation Example:**
```
Critical properties (100% required): device_id
- Actual: 100% → Pass

High priority (weighted 3x):
- Geolocation: 95% → 95 x 3 = 285 points
- Manufacturer: 92% → 92 x 3 = 276 points
- NTCIP: 88% → 88 x 3 = 264 points
- Communication: 90% → 90 x 3 = 270 points

Medium priority (weighted 1x):
- Install date: 82% → 82 points
- Maint zone: 91% → 91 points

Total: (285+276+264+270+82+91) / (3+3+3+3+1+1) = 1268 / 14 = 90.6%
Result: PASS (≥85%)
```

**PHASE 5: OPERATIONAL READINESS**

□ Can extract device list as CSV (for import to ATMS)
□ Can query by spatial location (station/offset or lat/long)
□ Element GUIDs are stable (re-export doesn't generate new GUIDs)
□ Properties accessible via IFC viewers (not buried in complex structures)

**Acceptance Threshold**: 4/4 operational readiness criteria met

### 2.2 buildingSMART IDS Validation

State will provide IDS (Information Delivery Specification) file for automated validation:

**Sample IDS snippet for DMS requirements:**
```xml
<requirements>
  <specification name="DMS Operational Requirements" ifcVersion="IFC4X3">
    <applicability>
      <entity name="IFCDYNAMICMESSAGESIGN" />
    </applicability>
    <requirements>
      <property propertySet="Pset_DeviceCommon" propertyName="device_id" dataType="IfcIdentifier" minOccurs="1" />
      <property propertySet="Pset_ManufacturerTypeInformation" propertyName="Manufacturer" dataType="IfcLabel" minOccurs="1" />
      <property propertySet="Pset_NetworkConnection" propertyName="ip_address" dataType="IfcLabel" minOccurs="0" />
      <property propertySet="Pset_LocationCommon" propertyName="Latitude" dataType="IfcReal" minOccurs="1" />
      <property propertySet="Pset_LocationCommon" propertyName="Longitude" dataType="IfcReal" minOccurs="1" />
    </requirements>
  </specification>
</requirements>
```

**Validation Process:**
1. Consultant runs IDS checker against IFC file
2. Tool generates compliance report (pass/fail per requirement)
3. Report submitted with IFC deliverable
4. State spot-checks 10% of elements manually

**Acceptance Threshold**: ≥90% compliance with IDS requirements

---

## Section 3: Deliverable Checklists by Project Type

### 3.1 Bridge Project Deliverables

**60% Design Submission:**
```
IFC File Contents:
□ Bridge superstructure (beams, deck, railing)
□ Bridge substructure (piers, abutments, footings)
□ Geolocation (lat/long for abutment centerline)
□ Coordinate system documentation

Properties Required at 60%:
□ Preliminary clearance heights
□ Design load capacity
□ Span lengths and configurations
□ Material types (concrete, steel, timber)

Acceptance Criteria:
- File integrity: 100%
- Geometry completeness: ≥90%
- Property completeness: ≥60%
```

**100% Construction Documents:**
```
IFC File Contents:
□ All 60% items (updated)
□ Detailed rebar (LOD 350+)
□ Drainage and utilities
□ Lighting and ITS equipment

Properties Required at 100%:
□ Final clearance heights (V2X-ready)
□ Final load ratings
□ Manufacturer/model for all equipment
□ Maintenance access points
□ Inspection zones

Acceptance Criteria:
- File integrity: 100%
- Geometry completeness: 100%
- Property completeness: ≥85%
- IDS validation: ≥90% pass rate
```

**As-Built Submission:**
```
IFC Updates:
□ As-constructed dimensions (field-verified)
□ Installation dates for all equipment
□ Final network addressing (IP addresses for ITS)
□ Warranty documentation references
□ Any field changes from design

Properties Required:
□ All 100% items (verified/updated)
□ device_id for all ITS (matching ATMS database)
□ Communication protocols confirmed
□ Maintenance zone assignments

Acceptance Criteria:
- Property completeness: ≥95%
- Geolocation accuracy: 100% field-verified
- NTCIP properties: 100% for commissioned devices
```

### 3.2 Smart Corridor / ITS Deployment

**Design Phase:**
```
IFC File Contents:
□ IfcAlignment for corridor centerline
□ All ITS equipment (DMS, cameras, signals, detectors)
□ Fiber optic network and cabinets
□ Power infrastructure
□ RSU locations (if CV/V2X project)

Properties Required:
□ device_id naming convention (State-approved)
□ Proposed IP addressing scheme
□ NTCIP standards applicability (1203/1204/1209/1211)
□ Power requirements and sources
□ Communication backhaul (fiber cabinet IDs)
□ Coverage areas (camera FOV, detector zones, RSU range)

Deliverables:
□ IFC model
□ Device inventory spreadsheet (cross-referenced to IFC GUIDs)
□ Network diagram
□ Station/offset reference table
```

**As-Built:**
```
IFC Updates:
□ As-installed equipment locations (GPS-verified)
□ Actual IP addresses and network configuration
□ Commissioned NTCIP object identifiers
□ Data feed URLs (for integration with ATMS)
□ Calibration data (camera PTZ presets, detector sensitivity)

Required Documentation:
□ Updated IFC with all as-built changes
□ Integration testing report (NTCIP communication verified)
□ Device commissioning certificates
□ Warranty and O&M manual references in IFC properties

Acceptance Criteria:
- 100% device_id populated and matching ATMS
- 100% IP addresses confirmed and tested
- NTCIP integration validated (at least 1 sample device per type)
```

### 3.3 Roadway Resurfacing with ITS

**Simplified IFC Requirements:**

For projects with limited structural scope but ITS equipment:

```
Required IFC Elements:
□ IfcAlignment (centerline or edge of pavement)
□ IfcPavement (surface layer only, with material specs)
□ IfcSign (static signs relocated or added)
□ ITS equipment (DMS, cameras if impacted)

Properties (streamlined):
□ Geolocation (lat/long)
□ Station/offset along alignment
□ Material type for pavement
□ device_id for any ITS equipment

Acceptance Criteria:
- Geometry: Alignment and pavement extents accurate
- Properties: ≥75% completeness acceptable (less complex project)
- Primary purpose: Document as-built surface and equipment locations
```

---

## Section 4: Payment Milestones Tied to IFC Quality

### 4.1 Recommended Payment Structure

Tie contract payments to IFC deliverable quality to incentivize compliance:

**Design Phase Payments:**
```
Milestone: 60% Design Submittal
Payment: 40% of design fee
Condition: IFC model meeting 60% acceptance criteria (see Section 3.1)
Holdback: 5% of milestone payment until IFC accepted

Milestone: 90% Design Submittal
Payment: 30% of design fee
Condition: IFC model meeting 90% criteria (property completeness ≥80%)
Holdback: 5% of milestone payment until IFC accepted

Milestone: 100% Construction Documents
Payment: 20% of design fee
Condition: IFC meeting 100% criteria (property completeness ≥85%, IDS ≥90%)
Holdback: 5% of milestone payment until IFC accepted

Final Payment: 10% of design fee
Condition: As-built IFC accepted (property completeness ≥95%)
```

**Incentive/Disincentive Structure:**
```
Bonus: +2% of design fee if IFC exceeds expectations:
- Property completeness ≥98%
- IDS validation 100% pass
- Zero resubmissions required
- Early integration testing successful

Penalty: Resubmission costs borne by Consultant
- First resubmission: No penalty (learning curve)
- Second resubmission: Consultant absorbs all costs
- Third+ resubmission: $5,000 penalty per resubmission + costs
```

### 4.2 Sample Contract Language for Payment Terms

```
ARTICLE X: PAYMENT TERMS FOR BIM/IFC DELIVERABLES

X.1 Conditional Payments

Payments for design milestones are conditional upon acceptance of IFC model deliverables meeting the criteria specified in Technical Specifications Section 3.X and evaluated per QA/QC Acceptance Checklist (Appendix [Y]).

X.2 Acceptance Process

Upon IFC submission, State will evaluate deliverable within 10 business days and provide one of the following responses:

a) ACCEPTED: IFC meets all acceptance criteria → Payment released
b) ACCEPTED WITH MINOR DEFICIENCIES: IFC meets minimum thresholds with noted gaps → Payment released, Consultant must address deficiencies within 30 days at no cost
c) REJECTED: IFC fails minimum acceptance criteria → Payment withheld, Consultant must resubmit within 10 business days at no cost

X.3 Resubmission Process

If IFC deliverable is rejected:
- First rejection: Consultant resubmits at no cost to State, no financial penalty
- Second rejection (same milestone): Consultant absorbs all State review costs (estimated at $2,500)
- Third rejection (same milestone): $5,000 penalty plus State review costs; State reserves right to terminate for cause

X.4 Final Payment Holdback

Five percent (5%) of each milestone payment will be held until corresponding IFC deliverable is accepted. Final payment (10% of total design fee) is conditional upon acceptance of As-Built IFC model meeting criteria in Section 3.X.7.

X.5 Performance Incentive

Consultant may earn performance bonus of up to 2% of total design fee if:
- All IFC deliverables accepted on first submission
- Property completeness exceeds 98% at final submission
- buildingSMART IDS validation 100% pass rate
- Integration testing with State ATMS successful (if applicable)

State will evaluate bonus eligibility upon project closeout.
```

---

## Section 5: Amendment Language for Existing Contracts

If adding IFC requirements to existing design contracts:

### 5.1 Contract Amendment Template

```
AMENDMENT NO. [X] TO CONTRACT [NUMBER]
FOR [PROJECT NAME]

This Amendment No. [X] ("Amendment") to Contract [Number] dated [Original Date] ("Contract") is entered into by and between [STATE DOT] ("State") and [CONSULTANT NAME] ("Consultant").

WHEREAS, the State and Consultant desire to add Building Information Modeling (BIM) deliverables in Industry Foundation Classes (IFC) format to the Contract scope;

NOW, THEREFORE, the parties agree as follows:

1. SCOPE MODIFICATION

Section [2.X] of the Contract is hereby amended to add the following:

[Insert Section 1.1 and 1.2 above]

2. COMPENSATION ADJUSTMENT

In consideration of the additional IFC deliverables, the Contract sum is increased by $[AMOUNT], representing [X]% of the original design fee, for a new total Contract sum of $[NEW TOTAL].

Rationale: Industry standard BIM/IFC effort ranges from 5-15% of design fee depending on project complexity. Recommended range:
- Simple projects (roadway, ITS only): +5-8%
- Moderate complexity (single bridge, corridor): +8-12%
- Complex projects (multiple structures, extensive ITS): +12-15%

3. SCHEDULE MODIFICATION

IFC deliverable milestones are added as follows:
- 60% Design: [Date] - IFC model for preliminary review
- 90% Design: [Date] - IFC model for validation
- 100% CD: [Date] - Final design IFC
- As-Built: [Date, 30 days after substantial completion] - As-built IFC

4. ACCEPTANCE CRITERIA

IFC deliverables shall be evaluated per QA/QC Acceptance Checklist (Exhibit [Y], attached). Payment for milestones is conditional upon IFC acceptance as specified in amended Article [X].

5. TRAINING AND SUPPORT

State agrees to provide:
a) IDS (Information Delivery Specification) file within 10 days of Amendment execution
b) Property naming conventions and device_id standards
c) Technical point of contact for IFC-related questions
d) Access to DOT Corridor Communicator platform for validation (if applicable)

6. GENERAL PROVISIONS

Except as specifically modified by this Amendment, all terms and conditions of the original Contract remain in full force and effect.

IN WITNESS WHEREOF, the parties have executed this Amendment as of [DATE].

[Signature blocks]
```

### 5.2 Negotiation Guidance for Amendment Cost

**Factors to Consider:**

1. **Project Phase at Time of Amendment:**
   - Pre-design (0-30%): Higher cost (more effort to integrate BIM)
   - Mid-design (30-60%): Moderate cost (some rework required)
   - Near completion (60%+): Lower cost (mostly documentation of existing work)

2. **Consultant BIM Maturity:**
   - Experienced with IFC exports: Lower cost (efficient workflow)
   - Learning curve required: Higher cost (training and trial/error time)

3. **Project Complexity:**
   - Simple corridor (few ITS devices): +5% of design fee
   - Moderate (bridge + ITS): +10% of design fee
   - Complex (multiple bridges, extensive ITS, CV/V2X): +15% of design fee

4. **Value to State:**
   - Operational digital twin benefits: $50K - $500K over asset life
   - Grant competitiveness: Potential $500K - $3M in federal funding
   - Justifies investment even if amendment cost is $25K-$75K

**Recommended Negotiation Strategy:**
```
State's Initial Offer: +5% of design fee
Consultant Counter: +15% of design fee
Likely Settlement: +8-10% of design fee

Include performance incentives (up to +2%) to encourage quality delivery
```

---

## Section 6: Resources and Templates

### 6.1 Downloadable Templates

**Available on platform:**
- RFP Section 2.X (Scope of Work) - Word document
- Technical Specifications Section 3.X - Word document
- QA/QC Acceptance Checklist - Excel spreadsheet
- Payment Terms Article X - Word document
- Contract Amendment Template - Word document
- buildingSMART IDS file (sample for DMS/Camera/Signal) - XML file
- Property Completeness Calculator - Excel tool

**Access:** https://corridor-communicator.org/docs/procurement-toolkit

### 6.2 Training and Support

**For DOT Procurement Staff:**
- Webinar: "Writing Effective BIM/IFC Specifications" (1 hour, monthly)
- Office hours: Ask questions about RFP language (Fridays, 2-4 PM ET)
- Sample procurements library: Learn from peer states

**For Consultants:**
- Webinar: "Meeting DOT IFC Requirements" (2 hours, monthly)
- IFC validation tool training
- Technical Q&A forum

**Contact:** procurement-support@corridor-communicator.org

### 6.3 Peer State Examples

**States with Mature IFC Procurement:**
- **Utah DOT**: IFC required on all bridge projects >$5M (since 2019)
- **Washington DOT**: IFC4x3 for all roadway projects (pilot program)
- **Florida DOT**: IFC for ITS deployments on smart corridors
- **Iowa DOT**: IFC with NTCIP integration for I-80 corridor

**Request sample RFPs:** peer-examples@corridor-communicator.org

---

**Document Version**: 1.0
**Last Updated**: December 2024
**Related Documentation**:
- [IFC Quick Start Guide](/docs/ifc-quick-start-guide.md)
- [Digital Standards Crosswalk](/docs/digital-standards-crosswalk.md)
- [ARC-ITS Integration Guide](/docs/arc-its-ifc-integration.md)

**Legal Disclaimer**: This toolkit provides sample language for informational purposes. States should consult with legal counsel and procurement officials before incorporating into official solicitations. Modify language to conform to state-specific procurement regulations and policies.

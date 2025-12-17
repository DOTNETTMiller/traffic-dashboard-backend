# Digital Infrastructure Documentation

## Overview

The DOT Corridor Communicator provides comprehensive digital infrastructure capabilities that integrate Building Information Models (BIM/IFC) with real-time operational data from Intelligent Transportation Systems (ITS).

This documentation suite covers:
- BIM/IFC infrastructure modeling standards
- ARC-ITS operational data integration
- Data quality standards for traffic events
- Connected and autonomous vehicle (CAV) support
- Digital twin workflows

---

## Documentation Pages

### [ARC-ITS and IFC Integration](/docs/arc-its-ifc-integration.md)

**Comprehensive guide to integrating ARC-ITS operational data with IFC building information models**

Topics covered:
- Integration architecture (static IFC + dynamic ARC-ITS)
- Equipment mapping (NTCIP, SAE, IEEE standards)
- Traffic monitoring devices (cameras, sensors, weather stations)
- Traffic control systems (DMS, ramp meters, signals)
- Connected vehicle infrastructure (RSUs, SPaT-enabled signals)
- Communications infrastructure (fiber, cabinets, switches)
- Digital twin workflows and real-time visualization
- Implementation guidelines and API design

**Use Cases:**
- Real-time 3D visualization of ITS equipment status
- Spatial queries for incident response
- Predictive maintenance using BIM + operational data
- Digital twin applications for traffic operations

### [Event Data Quality Standards](/docs/data-quality.md)

**Documentation of data quality standards and end time coverage for traffic events**

Topics covered:
- Event data field definitions (required vs optional)
- End time coverage by API type (WZDx, FEU-G, Custom, RSS)
- Data quality thresholds and scoring
- TMDD and SAE J2735 compliance requirements
- Recommendations for state DOTs
- Coverage statistics across 40+ state feeds

**Coverage Statistics:**
- WZDx feeds: 60-90% end time coverage (30+ states)
- FEU-G feeds: 70-85% coverage (5 states)
- Custom APIs: 20-60% coverage (4+ states)
- Overall system: ~55-70% of events include end times

### [Digital Standards Crosswalk](/docs/digital-standards-crosswalk.md)

**Comprehensive mapping of standards across infrastructure lifecycle for data interoperability**

Topics covered:
- Standards by lifecycle phase (Planning, Survey, Design, Construction, Operations, Maintenance)
- Data crosswalk examples (Bridge Design→Operations, ITS Equipment Lifecycle, Pavement Management)
- Interoperability frameworks (IFC↔NTCIP, GIS↔BIM, WZDx↔Traffic Management)
- Implementation guidance (database schema, API endpoints, gap analysis integration)
- Standards organizations and resources

**Key Standards Mapped:**
- Planning: HPMS, TPM, GIS (ISO 19100), MIRE 2.0
- Design: IFC, NBIMS-US, ISO 19650, LandXML
- Construction: e-Construction, TransXML, WZDx
- Operations: NTCIP (1203/1204/1209/1211), SAE J2735, IEEE 1609, TMDD
- Maintenance: ISO 55000, PAS 55, IRI, CMMS

**Benefits:**
- Seamless data flow from planning through operations
- Multi-vendor system interoperability
- FHWA/USDOT grant compliance (SMART, RAISE, ATCMTD)
- Digital twin enablement with real-time operational data

---

## What the Digital Infrastructure Feature Does

The Digital Infrastructure feature provides comprehensive IFC model analysis capabilities that bridge the gap between BIM design data and ITS operational requirements. Here's what it does:

### Core Capabilities

1. **Parses IFC Models to Extract Infrastructure Elements**
   - Automatically identifies and catalogs infrastructure components: bridges, beams, columns, signs, signals, pavement, guardrails, and ITS equipment
   - Extracts geometric properties: dimensions, locations, elevations, clearances
   - Preserves IFC Global IDs (GUIDs) for element tracking and lifecycle management
   - Supports both IFC2X3 and IFC4.3 schema versions

2. **Identifies Data Present vs. ITS Operational Requirements**
   - Compares extracted properties against what ITS systems actually need
   - Assesses geolocation data quality (coordinates, alignments, linear referencing)
   - Evaluates equipment metadata (manufacturers, models, installation dates)
   - Checks for operational properties (device IDs, communication protocols, controller information)

3. **Generates Gap Analysis for V2X and AV Systems**
   - Identifies missing properties required for Vehicle-to-Everything (V2X) communications
   - Flags elements critical for autonomous vehicle (AV) routing and operations
   - Highlights gaps in clearance data, lane markings, and surface conditions
   - Categorizes gaps by severity: high (AV-critical), medium, low
   - Associates gaps with specific ITS use cases (route planning, dynamic messaging, etc.)

4. **Creates buildingSMART IDM/IDS Recommendations**
   - Generates Information Delivery Manual (IDM) recommendations for missing properties
   - Produces Information Delivery Specification (IDS) validation rules
   - Maps IFC types to industry standards (AASHTO, SAE J2735, SAE J3216, NTCIP)
   - Provides actionable guidance for BIM authoring workflows
   - Enables standards-compliant data exchange across the infrastructure lifecycle

5. **Supports Multiple IFC Schemas**
   - **IFC2X3**: Full support for traditional building and bridge infrastructure
   - **IFC4.3**: Support for advanced infrastructure (roads, railways, alignment-based positioning)
   - Schema auto-detection from uploaded files
   - Handles multi-line IFC entities and complex property sets

### 3D Visualization and Operational Data Overlay

The Digital Infrastructure feature includes a **3D IFC Model Viewer** that:
- Renders IFC models in an interactive Three.js-based 3D environment
- Provides orbit controls for model inspection (rotate, pan, zoom)
- Displays operational data highlighting modes:
  - **Elements with Gaps**: Highlights infrastructure elements missing critical properties (orange)
  - **V2X Elements**: Shows elements applicable to V2X communications (green)
  - **AV Critical Elements**: Displays elements critical for autonomous vehicle operations (blue)

### Current Limitations: IFC 4.3 3D Highlighting

**Important:** The 3D highlighting feature currently has limitations with IFC 4.3 files due to compatibility issues with the web-ifc-three library:

#### What Works
- ✅ 3D geometry rendering and visualization
- ✅ Model navigation (rotate, pan, zoom)
- ✅ Automatic camera positioning and lighting
- ✅ IFC 4.3 file parsing and element extraction
- ✅ Gap analysis and operational data tables
- ✅ Element lists with filtering and search

#### What Doesn't Work (IFC 4.3 Only)
- ❌ **3D highlighting of individual elements** - The web-ifc-three library does not populate the `expressID` property on mesh objects for IFC 4.3 files, which prevents mapping database GUIDs to rendered 3D geometry
- ❌ **Interactive element selection** - Cannot highlight specific infrastructure elements (bridges, beams, signs) in the 3D view based on operational data

#### Technical Details
The web-ifc-three library (version used in production) has partial IFC 4.3 support:
- Can parse and render IFC 4.3 geometry for visualization
- Cannot expose element metadata (expressID) needed for GUID-based highlighting
- Console shows: `Building GUID map for 0 meshes` when loading IFC 4.3 files
- This prevents matching operational data (gaps, V2X flags, AV criticality) to specific 3D mesh objects

#### Workarounds and Recommendations

**For Full 3D Highlighting Support:**
1. **Use IFC 2x3 Export**: Export your model from your BIM authoring software (e.g., Allplan, Revit, Civil 3D) using IFC 2x3 schema
   - IFC 2x3 files work fully with the 3D highlighting feature
   - All element properties and operational data can be highlighted in 3D

2. **Upload Both Versions**: For projects using IFC 4.3 features (alignments, advanced road modeling):
   - Upload IFC 4.3 version for gap analysis and element extraction
   - Upload IFC 2x3 version for 3D visualization with highlighting
   - Use the IFC 4.3 analysis data with the IFC 2x3 3D viewer

**For IFC 4.3 Files (Current Capability):**
- View operational data in **table/list format** instead of 3D highlighting
- Use element filtering and search in the elements table
- Export gap reports to CSV for offline analysis
- Access IDS validation rules for property enrichment
- The 3D viewer still provides valuable model navigation and inspection, just without operational data overlays

**Future Enhancement Path:**
- Upgrade to a newer IFC 4.3-compatible viewer library when available
- Implement alternative GUID mapping strategies (spatial queries, property-based matching)
- Add support for IFC.js or other modern IFC rendering engines with better IFC 4.3 support

### Operational Value Despite Limitations

Even with the 3D highlighting limitation for IFC 4.3, the Digital Infrastructure feature provides significant value:
- Complete gap analysis showing exactly what properties are missing
- Identification of V2X-applicable and AV-critical elements
- buildingSMART IDM/IDS recommendations for standards compliance
- Detailed element tables with all extracted properties
- CSV export for integration with other systems
- Foundation for digital twin workflows and asset management

The gap analysis and IDM/IDS recommendations work identically for both IFC 2x3 and IFC 4.3 files—only the 3D highlighting feature is affected.

---

## Digital Infrastructure Features

### BIM/IFC Model Support

Upload and parse Industry Foundation Classes (IFC) models containing:
- **Bridge Infrastructure** - Beams, columns, decks, piles
- **Roadway Infrastructure** - Pavement, curbs, alignments
- **ITS Equipment** - Signs, signals, sensors, cameras, DMS
- **Safety Infrastructure** - Guardrails, barriers, markings
- **Connected Vehicle Infrastructure** - RSUs, SPaT signals, beacons

### Geospatial Integration

Models support multiple coordinate reference systems:
- **Geographic Coordinates** - Latitude/longitude (IFCSITE)
- **Projected Coordinates** - State plane, UTM (IFCMAPCONVERSION)
- **Linear Referencing** - Station/offset along alignments (IFCLINEARPLACEMENT)

---

## Recommended Solutions for Alignment-Based Positioning

### The Problem: Fragmented Linear Referencing Approaches

Transportation agencies face a critical challenge: **multiple incompatible systems for describing location along linear infrastructure**. The BIM for Infrastructure Pooled Fund has identified this as a primary barrier to digital infrastructure adoption. Current approaches include:

- **LRS (Linear Referencing System)** - Database-driven, route-milepost system used by asset management
- **Milepost** - Physical markers along highways (may not match design stationing)
- **Stationing** - Engineering coordinates from design alignment (starts at 0+00, increases along centerline)
- **GPS Coordinates** - Latitude/longitude (poor for linear queries like "what's between mileposts 45-47?")

**The core issue:** These systems rarely align with each other, creating data silos where:
- Construction plans use stationing (e.g., "Install sign at Station 125+50")
- Operations/maintenance use mileposts (e.g., "Pothole at MP 12.5")
- Asset management uses LRS route-measure (e.g., "US-30, measure 125.5")
- ITS systems use GPS coordinates
- None can easily query the others without complex translation tables

### Why This Matters for IFC and Digital Infrastructure

IFC 4.3 introduced `IfcAlignment` and `IfcLinearPlacement` specifically to solve this problem, but **industry adoption has been slow** because:
1. Lack of clear guidance on which referencing system to use
2. No standard for maintaining translation between systems
3. Existing BIM tools don't enforce alignment-based placement
4. Deliverable specifications don't require it

**Real-world consequence:** A bridge BIM model may include GPS coordinates but no stationing, making it impossible to match with construction staking data or maintenance work orders that reference mileposts.

### Recommended Solution: Multi-Reference Approach

The DOT Corridor Communicator implements a **hybrid referencing strategy** that maintains all reference systems and their translations:

#### 1. Primary Reference: IFC Alignment with IfcLinearPlacement

**Requirement:** All linear infrastructure elements MUST be placed using `IfcLinearPlacement` relative to an `IfcAlignment` object.

```
IfcAlignment
  ├── Horizontal geometry (curves, spirals, tangents)
  ├── Vertical geometry (grades, vertical curves)
  ├── Station equations (handling stationing discontinuities)
  └── IfcLinearPlacement elements
        ├── DistanceAlong (stationing)
        ├── Lateral offset
        └── VerticalOffset
```

**Benefits:**
- Preserves design intent (stationing from original alignment)
- Supports station equations (e.g., "100+00 back = 105+00 ahead")
- Enables linear queries (IFC): "Get all signs between Station 50+00 and 75+00"
- Provides geometric context (curve/tangent, grade)

#### 2. Secondary References: LRS and Milepost Mapping

**Requirement:** IFC property sets MUST include mappings to operational referencing systems:

```xml
<PropertySet name="Pset_LinearReferencing">
  <!-- Design Reference (IFC Native) -->
  <Property name="AlignmentName" datatype="IfcLabel" />
  <Property name="Stationing" datatype="IfcLengthMeasure" />

  <!-- LRS Reference (Asset Management) -->
  <Property name="LRS_RouteID" datatype="IfcIdentifier" />
  <Property name="LRS_Measure" datatype="IfcLengthMeasure" />
  <Property name="LRS_Date" datatype="IfcDate" />  <!-- LRS changes over time -->

  <!-- Milepost Reference (Operations) -->
  <Property name="Milepost" datatype="IfcLengthMeasure" />
  <Property name="MilepostDirection" datatype="IfcLabel" />  <!-- Increasing/Decreasing -->

  <!-- GPS Reference (Fallback) -->
  <Property name="Latitude" datatype="IfcReal" />
  <Property name="Longitude" datatype="IfcReal" />
  <Property name="Elevation" datatype="IfcLengthMeasure" />
</PropertySet>
```

**Implementation in DOT Corridor Communicator:**
- `infrastructure_elements` table stores all four reference types
- API endpoints accept queries in any format:
  - `/api/infrastructure/query?station=125+50`
  - `/api/infrastructure/query?lrs_route=US-30&measure=125.5`
  - `/api/infrastructure/query?milepost=12.5`
  - `/api/infrastructure/query?lat=41.5&lon=-93.6`
- System maintains translation mappings between formats

#### 3. Alignment Translation Tables

**Requirement:** Projects MUST include translation tables mapping between referencing systems.

**Example Translation Table Structure:**
```sql
CREATE TABLE alignment_lrs_mapping (
    alignment_name TEXT,
    station REAL,
    lrs_route_id TEXT,
    lrs_measure REAL,
    milepost REAL,
    latitude REAL,
    longitude REAL,
    mapping_date DATE,
    source TEXT  -- 'survey', 'design', 'as-built'
);
```

**Population Strategy:**
1. **Design Phase:** CAD/BIM software exports alignment with station equations
2. **Survey Phase:** Field survey correlates stationing to GPS and existing mileposts
3. **As-Built Phase:** Update translations based on actual construction
4. **Operations Phase:** LRS team provides route-measure mappings

**Maintenance:** Translation tables are versioned and timestamped because:
- LRS routes are re-segmented periodically
- Mileposts may be relocated
- Station equations may be added/modified

#### 4. IDS Validation Rules for Alignment Compliance

**buildingSMART IDS Requirement:** Validate that linear elements include proper placement and cross-references.

```xml
<specification name="Linear Infrastructure Referencing" ifcVersion="IFC4X3">
  <applicability>
    <entity>
      <name>
        <simpleValue>IFCROAD</simpleValue>
        <simpleValue>IFCBRIDGE</simpleValue>
        <simpleValue>IFCSIGN</simpleValue>
        <simpleValue>IFCTRAFFICSIGNAL</simpleValue>
      </name>
    </entity>
  </applicability>

  <requirements>
    <!-- Require IfcLinearPlacement -->
    <attribute>
      <name><simpleValue>ObjectPlacement</simpleValue></name>
      <value>
        <xs:restriction base="xs:string">
          <xs:enumeration value="IfcLinearPlacement"/>
        </xs:restriction>
      </value>
    </attribute>

    <!-- Require Linear Referencing Properties -->
    <property>
      <propertySet><simpleValue>Pset_LinearReferencing</simpleValue></propertySet>
      <name><simpleValue>Stationing</simpleValue></name>
      <datatype><simpleValue>IfcLengthMeasure</simpleValue></datatype>
    </property>

    <property>
      <propertySet><simpleValue>Pset_LinearReferencing</simpleValue></propertySet>
      <name><simpleValue>LRS_RouteID</simpleValue></name>
      <datatype><simpleValue>IfcIdentifier</simpleValue></datatype>
    </property>

    <property>
      <propertySet><simpleValue>Pset_LinearReferencing</simpleValue></propertySet>
      <name><simpleValue>Milepost</simpleValue></name>
      <datatype><simpleValue>IfcLengthMeasure</simpleValue></datatype>
    </property>
  </requirements>
</specification>
```

**Gap Analysis Impact:** The DOT Corridor Communicator flags elements missing alignment-based placement or cross-references as **high-severity gaps** because they cannot be queried by operational systems.

#### 5. Procurement Language for DOT Contracts

**Sample Contract Language:**

> **Linear Referencing Requirements**
>
> All IFC deliverables for linear transportation infrastructure shall comply with the following:
>
> 1. **Alignment-Based Placement:** Every element (bridges, signs, pavement, utilities) shall be placed using `IfcLinearPlacement` relative to a project `IfcAlignment`. GPS coordinates alone are not sufficient.
>
> 2. **Multi-System Cross-Reference:** Each element's property sets shall include:
>    - Design stationing (from IfcAlignment)
>    - LRS route ID and measure (from agency LRS)
>    - Milepost value (from agency milepost system)
>    - Latitude/longitude (WGS84)
>
> 3. **Translation Table:** Contractor shall deliver an alignment translation table mapping stationing to LRS, milepost, and GPS at 100-foot intervals minimum. Table shall be validated by agency survey team before final acceptance.
>
> 4. **IDS Validation:** All deliverables shall pass buildingSMART IDS validation for linear referencing compliance using agency-provided IDS file.
>
> 5. **As-Built Updates:** Following construction, contractor shall update translation table and element placements to reflect as-built conditions, verified by field survey.

#### 6. Workflow Integration

**Design → Construction → Operations Data Flow:**

```
┌─────────────────┐
│  Design (BIM)   │  → Uses stationing from IfcAlignment
│  Civil 3D/      │  → Exports IFC with IfcLinearPlacement
│  OpenRoads      │  → Includes station equations
└────────┬────────┘
         ↓
┌─────────────────┐
│  Survey Team    │  → Correlates stationing to existing mileposts
│                 │  → Surveys GPS at key stations
│                 │  → Creates translation table
└────────┬────────┘
         ↓
┌─────────────────┐
│  Construction   │  → Uses stationing for staking
│                 │  → Updates as-built deviations
│                 │  → Verifies installed element locations
└────────┬────────┘
         ↓
┌─────────────────┐
│  LRS Team       │  → Adds new route segments to LRS
│                 │  → Provides route-measure mappings
│                 │  → Updates LRS annually
└────────┬────────┘
         ↓
┌─────────────────┐
│  Operations/    │  → Queries using any reference system
│  Maintenance    │  → Work orders use mileposts
│  (DOT Corridor  │  → ITS integrations use GPS
│  Communicator)  │  → Asset management uses LRS
│                 │  → System translates between all formats
└─────────────────┘
```

### Benefits of This Approach

**For Design Teams:**
- Use familiar stationing system in CAD/BIM tools
- No need to learn LRS or milepost systems
- Alignment geometry preserved for future use

**For Construction:**
- Staking matches design plans (stationing-based)
- As-built surveys update translation tables
- No confusion about reference systems

**For Operations:**
- Query infrastructure using any reference system
- Work orders in mileposts automatically map to design stations
- ITS systems use GPS but can correlate to LRS assets

**For Asset Management:**
- LRS remains authoritative for inventory
- IFC models provide rich geometric context
- Annual LRS updates don't break BIM references

**For Digital Twins:**
- Real-time operational data (GPS-based) overlays on BIM geometry (stationing-based)
- Sensor networks (GPS) correlate to infrastructure elements (LRS)
- Seamless data flow across lifecycle phases

### Industry Impact and Standardization

**Recommendation to buildingSMART and BIM for Infrastructure Pooled Fund:**

1. **Mandate IfcLinearPlacement** for all linear infrastructure in IFC 4.3+
   - Update IDM templates to require alignment-based placement
   - Develop IDS validation rules (as shown above)
   - Provide reference implementations in major CAD platforms

2. **Standardize Multi-Reference Property Sets**
   - Add `Pset_LinearReferencing` to buildingSMART Data Dictionary
   - Include LRS, milepost, and GPS fields
   - Specify units and coordinate systems

3. **Develop Translation Table Standards**
   - Define schema for alignment-LRS-milepost-GPS mappings
   - Specify versioning and timestamping requirements
   - Create sample datasets for training

4. **Update Procurement Templates**
   - FHWA/AASHTO model contract language
   - State DOT specification guidance
   - QA/QC checklists for deliverable acceptance

5. **Tool Vendor Engagement**
   - Autodesk (Civil 3D), Bentley (OpenRoads), Trimble to auto-populate translations
   - GIS vendors (Esri) to import/export LRS mappings
   - BIM viewers to support multi-reference queries

**Expected Outcome:** Within 2-3 years, eliminate the "which referencing system?" debate by requiring ALL systems to coexist with automated translation, ensuring seamless data flow from planning through operations.

---

### Gap Analysis & Compliance

Automated identification of missing data required for:
- **ITS Operations** - Device IDs, communication protocols, data feeds
- **V2X/CV Applications** - SPaT capability, RSU coverage, message broadcasting
- **AV Systems** - Lane markings, clearance heights, surface conditions
- **Asset Management** - Installation dates, maintenance schedules, condition ratings
- **Standards Compliance** - buildingSMART IDM/IDS, NTCIP, SAE J2735

### Real-Time Data Integration

Connect static BIM models to live operational data:
- **NTCIP Protocols** - DMS (1203), RWIS (1204), CCTV (1209), Signals (1211)
- **SAE J2735 Messages** - SPaT, MAP, TIM, BSM
- **IEEE 1609 WAVE** - RSU communications, SCMS certificates
- **Custom APIs** - State DOT traffic management centers

### CAD-to-IFC Conversion Playbook

Most transportation agencies still hold roadway and bridge designs in CAD-centric formats (Civil 3D, OpenRoads, MicroStation). To ensure those files become operational digital twins:

1. **Normalize the CAD Model**
   - Flatten xRefs and ensure named layers for ITS devices (DMS, CCTV, RWIS, Signals).
   - Export alignment baselines and station equations (LandXML or IFC Alignment).
   - Convert coordinate systems to a documented EPSG code (track units!).
2. **Export to IFC4x3**
   - Civil 3D: use Autodesk’s “Publish IFC” with the InfraWorks bridge/road templates.
   - OpenRoads: leverage the Bentley IFC4x3 extension; ensure `IfcAlignment` entities are included.
   - Validate that every ITS layer is mapped to an IFC entity (IFCDYNAMICMESSAGESIGN, IFCSIGNAL, etc.).
3. **Enrich with Property Sets**
   - Add `Pset_ManufacturerTypeInformation`, `Pset_IFCCommon` with device IDs, controller IDs, firmware, install dates.
   - Record NTCIP object identifiers and maintenance region tags so ARC-ITS can bind to the same GUIDs.
4. **Validate with IDS**
   - Run the provided IDS snippets (see below) to guarantee clearance heights, lane counts, signal phases, and comms links are populated.

> **Conversion Tip:** If the CAD authoring tool cannot emit IFC4x3, export to STEP/DGN and run through FME or BlenderBIM to attach property sets before upload.

### Digital Twin Operations Runbook

Create a closed loop between BIM/CADD and live ITS operations:

1. **GUID Registry**
   - Every device in ARC-ITS should carry the IFC GUID in its metadata table.
   - Nightly sync compares IFC GUIDs to active devices and flags orphaned or missing assets.
2. **Change Detection**
   - When a contractor delivers updated IFC, parse it automatically; compare element bounding boxes + GUIDs to detect moved or deleted equipment.
   - Auto-generate work orders when installed equipment drifts from the design record (wrong orientation, missing cabinet, etc.).
3. **Operational Overlay**
   - Use `/api/digital-infrastructure/elements/:modelId` to feed the 3D viewer, then stream live NTCIP status (online/offline, active message) alongside the geometry.
   - Highlight RSUs or SPaT signals that are offline directly in the BIM context so field crews see precise coordinates and mounting heights.
4. **Lifecycle Feedback**
   - As maintenance closes work orders, push install dates and firmware versions back into the IFC property sets (either via IDS validation or by patching the `infrastructure_elements` table).
   - Export updated BIM snapshots quarterly so design, construction, and operations are always referencing the same digital twin.

### IDS / IDM Templates for ITS Assets

Use buildingSMART IDS snippets to make sure every IFC upload satisfies operational requirements:

```
<requirements>
  <specification name="DMS Requirements" ifcVersion="IFC4X3">
    <applicability>
      <entity name="IFCDYNAMICMESSAGESIGN" />
    </applicability>
    <requirements>
      <propertySet name="Pset_DMSOperational">
        <property name="ntcipId" datatype="IfcIdentifier" />
        <property name="controllerIp" datatype="IfcLabel" />
        <property name="installationDate" datatype="IfcDateTime" />
      </propertySet>
      <propertySet name="Pset_LocationCommon">
        <property name="latitude" datatype="IfcReal" />
        <property name="longitude" datatype="IfcReal" />
      </propertySet>
    </requirements>
  </specification>
</requirements>
```

Recommended starter templates:
- **IFCSIGNAL / IFCTRAFFICSIGNAL:** enforce SPaT controller IDs, phase plans, cabinet association.
- **IFCROADSIDEUNIT:** require SCMS certificate IDs, RF channel, backhaul fiber cabinet link.
- **IFCWEATHERSTATION:** capture NTCIP 1204 sensor groups, elevation, pole type.

Share these IDS files with your designers so they validate before uploading—our parser will surface the exact missing property when an IDS check fails.

---

## Integration Architecture

### Layer 1: Physical Infrastructure (IFC)

```
IFC Models provide:
├── 3D Geometry & Coordinates
├── Asset Inventory
│   ├── Equipment Type
│   ├── Manufacturer/Model
│   └── Installation Date
├── Spatial Relationships
│   ├── Alignment-based positioning
│   ├── Geographic location
│   └── Network topology
└── Lifecycle Data
    ├── Condition ratings
    ├── Maintenance schedules
    └── Replacement timelines
```

### Layer 2: Operational Data (ARC-ITS)

```
ARC-ITS systems provide:
├── Real-Time Status
│   ├── Device health (online/offline)
│   ├── Communication status
│   └── Performance metrics
├── Live Data Streams
│   ├── Traffic counts/speeds
│   ├── Weather conditions
│   └── Video feeds
├── Control States
│   ├── Signal phases
│   ├── DMS messages
│   └── Gate positions
└── Alerts & Events
    ├── Device malfunctions
    ├── Maintenance needs
    └── Communication failures
```

### Layer 3: Event Data (WZDx/511)

```
State DOT feeds provide:
├── Work Zones
│   ├── Location & extent
│   ├── Start/end times
│   └── Lane impacts
├── Incidents
│   ├── Type & severity
│   ├── Affected corridors
│   └── Clearance estimates
├── Road Conditions
│   ├── Weather impacts
│   ├── Surface conditions
│   └── Travel advisories
└── Travel Information
    ├── Delays & speeds
    ├── Detours
    └── Closures
```

---

## Use Cases

### Traffic Operations Center (TOC) Applications

**Visual Asset Inventory**
- 3D map of all ITS equipment across corridors
- Real-time operational status overlay
- Quick identification of offline devices
- Maintenance history and upcoming work

**Incident Response**
- Spatial query: "Show all cameras within 2 miles of incident"
- Check nearby DMS availability for traveler alerts
- Identify ramp meters for queue management
- Locate weather stations for surface condition data

**Performance Monitoring**
- Device uptime dashboards
- Communication link status
- Data quality metrics
- Predictive failure alerts

### Field Maintenance Applications

**Work Order Generation**
- Precise device location (lat/long + station/offset)
- Equipment specifications (manufacturer, model, parts)
- Installation details (mounting height, power requirements)
- Access instructions (cabinet location, network ID)

**Preventive Maintenance**
- Schedule based on installation date + lifecycle data
- Prioritize by criticality (V2X devices, safety systems)
- Coordinate with work zones and lane closures
- Track spare parts inventory

### Connected & Autonomous Vehicle (CAV) Support

**Infrastructure Readiness Assessment**
- Identify V2X-capable intersections (SPaT-enabled signals)
- Map RSU coverage zones (DSRC/C-V2X)
- Verify lane marking quality for AV lane detection
- Check clearance data for automated routing

**Digital Twin for AV Planning**
- Simulate infrastructure sensor coverage
- Model communication range and gaps
- Test edge cases (weather, lighting, occlusions)
- Validate perception algorithms against BIM geometry

### Planning & Design

**Infrastructure Deployment**
- Analyze gaps in ITS equipment coverage
- Optimize new device placement using 3D models
- Coordinate with roadway/bridge construction projects
- Evaluate fiber network extensions

**What-If Scenario Analysis**
- Model impact of new DMS installations
- Simulate camera field-of-view from proposed locations
- Test RSU placement for optimal V2X coverage
- Evaluate lane configuration changes

---

## Standards & Specifications

### Building Information Modeling

- **IFC2x3** - Bridge and building infrastructure
- **IFC4** - Enhanced infrastructure support
- **IFC4x3** - Roads, railways, ports, waterways (latest)
- **buildingSMART IDM** - Information Delivery Manual for ITS
- **buildingSMART IDS** - Information Delivery Specification (validation)

### ITS Communications

- **NTCIP 1203** - Object Definitions for Dynamic Message Signs (DMS)
- **NTCIP 1204** - Object Definitions for Environmental Sensor Stations (ESS)
- **NTCIP 1209** - Object Definitions for Transportation Sensor Systems (TSS)
- **NTCIP 1211** - Object Definitions for Signal Control and Prioritization (SCP)

### Connected Vehicle

- **SAE J2735** - Dedicated Short Range Communications (DSRC) Message Set Dictionary
- **SAE J2945** - Dedicated Short Range Communications (DSRC) Minimum Performance Requirements
- **SAE J3216** - Taxonomy and Definitions for Terms Related to Cooperative Driving Automation
- **IEEE 1609** - Family of Standards for Wireless Access in Vehicular Environments (WAVE)

### Data Exchange

- **WZDx v4.0+** - Work Zone Data Exchange Specification
- **TMDD** - Traffic Management Data Dictionary
- **GTFS-RT** - General Transit Feed Specification - Realtime
- **TCIP** - Transit Communications Interface Profiles

---

## Getting Started

### 1. Upload an IFC Model

Navigate to **Digital Infrastructure** → **Upload Model**

Supported formats:
- `.ifc` (Industry Foundation Classes)
- `.ifcxml` (IFC XML encoding)

The parser will extract:
- All infrastructure elements (bridges, roads, ITS equipment)
- Geospatial location data
- Alignment information
- Equipment properties

### 2. Review Gap Analysis

After upload, review the **Gap Analysis** report:
- Missing properties for ITS operations
- Geolocation data quality
- Alignment-based positioning status
- Standards compliance recommendations

### 3. Link to ARC-ITS Data

For operational integration:
1. Map IFC equipment to ARC-ITS device IDs
2. Configure NTCIP/API endpoints
3. Set up real-time polling intervals
4. Define alert thresholds

### 4. View Digital Twin

Access the **Infrastructure Dashboard**:
- 3D visualization of equipment
- Real-time status overlays
- Spatial query tools
- Historical performance data

---

## API Reference

### Infrastructure Elements

```
GET /api/infrastructure/elements
  - List all extracted IFC elements
  - Filter by type, corridor, station range
  - Include geometry and properties

GET /api/infrastructure/element/:guid
  - Get detailed info for specific element
  - Include raw IFC data
  - Show linked ARC-ITS devices

GET /api/infrastructure/gaps
  - Get gap analysis for uploaded models
  - Filter by severity, category, IFC type
  - Include IDM/IDS recommendations
```

### Spatial Queries

```
GET /api/infrastructure/spatial-query
  ?corridor=I-80
  &station=125+00
  &radius=1mi

  - Find equipment near specific location
  - Return IFC geometry + operational status
  - Support station/offset and lat/long queries
```

### Real-Time Integration

```
GET /api/infrastructure/device/:guid/status
  - Poll ARC-ITS data for specific device
  - Return current operational state
  - Include communication status

POST /api/infrastructure/device/:guid/link-arc-its
  - Associate IFC element with ARC-ITS device
  - Configure data feed URLs
  - Enable real-time synchronization
```

---

## Future Enhancements

### Phase 1 (Current)
- ✅ IFC model parsing and element extraction
- ✅ Gap analysis with buildingSMART IDM/IDS recommendations
- ✅ ARC-ITS equipment type recognition
- ✅ Documentation and integration architecture

### Phase 2 (Planned)
- 🔄 Real-time NTCIP polling integration
- 🔄 Automated device-to-IFC mapping via spatial proximity
- 🔄 3D visualization with operational overlays
- 🔄 Alert generation for device failures

### Phase 3 (Future)
- 📋 Machine learning for predictive maintenance
- 📋 Historical performance analytics
- 📋 What-if scenario modeling
- 📋 CV/AV infrastructure readiness scoring

---

## Support & Resources

### Documentation
- [ARC-ITS Integration Guide](/docs/arc-its-ifc-integration.md)
- [Data Quality Standards](/docs/data-quality.md)
- State Coverage: `/docs/STATE_COVERAGE.md` (local)

### Standards Bodies
- **buildingSMART International** - https://www.buildingsmart.org/
- **NTCIP Users Group** - https://www.ntcip.org/
- **SAE Mobility** - https://www.sae.org/
- **AASHTO** - https://www.transportation.org/

### Open Source Projects
- **web-ifc** - https://github.com/IFCjs/web-ifc
- **IFC.js** - https://ifcjs.github.io/info/
- **BlenderBIM** - https://blenderbim.org/

---

**Last Updated:** 2025-12-16
**Version:** 1.1
**Access:** https://[your-domain]/docs/digital-infrastructure.md

For questions or feedback, contact your DOT Corridor Communicator administrator.

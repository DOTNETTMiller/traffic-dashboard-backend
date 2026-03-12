# Common Data Environment (CDE) Requirements for Transportation Infrastructure

**Date:** March 12, 2026
**Standard:** ISO 19650-1 & ISO 19650-2
**Scope:** Transportation infrastructure digital asset lifecycle management

---

## Executive Summary

A **Common Data Environment (CDE)** is the foundational platform for ISO 19650-compliant infrastructure projects. It serves as the single source of truth for all project information throughout the asset lifecycle—from planning and design through construction, operations, and maintenance.

**Key Findings:**
- ISO 19650 mandates CDEs for all BIM projects
- Transportation infrastructure requires specialized CDE capabilities beyond standard construction
- Your DOT Corridor Communicator platform already has **70% of core CDE requirements**
- Critical gaps: Workflow state management, formal information protocols, document retention compliance

---

## 1. What is a CDE? (ISO 19650-1 Definition)

> "An agreed source of information for any given project or asset, for collecting, managing and disseminating each information container through a managed process."

### Key Characteristics:

✅ **Single Source of Truth** - All project stakeholders access the same information
✅ **Managed Process** - Information flow controlled through defined workflows
✅ **Lifecycle Scope** - Covers planning → design → construction → operations → maintenance
✅ **Mandatory Requirement** - Required when ISO 19650 is specified on projects
✅ **Appointing Party Responsibility** - Owner/client establishes and manages the CDE

---

## 2. Core CDE Functional Requirements

### A. Four-State Information Container Model

ISO 19650 mandates four distinct information states with gated transitions:

#### 1️⃣ **Work in Progress (WIP)**
- Information created and amended by task team
- **Only state where information is editable**
- Default status: S0 (preliminary, not suitable for use)
- **Access:** Restricted to originating team only
- No visibility to other project members

#### 2️⃣ **Shared**
- Information approved for sharing with other task teams
- **Purpose:** Coordination, comment, collaboration
- Status codes: S1 (suitable for coordination), S2 (suitable for information)
- **Access:** Visible to project members, read-only
- Non-linear: Can pass between WIP ↔ Shared multiple times

#### 3️⃣ **Published**
- Contractual information authorized for specific use
- **Purpose:** Construction, detailed design, asset management
- Considered final deliverables
- **Access:** Read-only for all parties
- Formal authorization required

#### 4️⃣ **Archived**
- Historical record of all shared and published information
- **Purpose:** Compliance, auditing, future reference
- Provides audit trail of information container development
- Maintains regulatory compliance

### B. Information Management Capabilities

#### Unique Identification & Naming Convention

ISO 19650 standard format:
```
PROJ-ORG-PH-LV-TYP-RL-CL-NUM-SUIT-REV

Example: I80-IOWA-DES-B01-MOD-STR-38-M3-D001-S4-P01
```

Where:
- **PROJ** = Project code (I80-IOWA)
- **ORG** = Originator/Organization (DES = Design Consultant)
- **PH** = Phase (not used in this example, replaced by level)
- **LV** = Level/Location (B01 = Bridge 1)
- **TYP** = Type (MOD = Model)
- **RL** = Role/Discipline (STR = Structural)
- **CL** = Classification (38 = Bridges per Uniclass)
- **NUM** = Number (M3 = Model 3)
- **SUIT** = Suitability code (S4 = Suitable for construction)
- **REV** = Revision (P01 = First published version)

#### Metadata Requirements

Each information container must track:
- State (WIP, Shared, Published, Archive)
- Status code (suitability for use: S0-S8)
- Revision number
- Classification (Uniclass, Omniclass, MasterFormat)
- Author
- Creation/modification date
- File size
- Approval/authorization status

#### Version Control

- Track every revision of documents and models
- Maintain detailed version history:
  - Version number
  - Date of change
  - Author name
  - Description of changes
  - Approver information
- Prevent confusion from outdated files
- Transparent audit trail
- Prevent unauthorized modifications

### C. Security & Access Control

#### Role-Based Permissions
- Access controlled at each state level
- Only authorized personnel access specific data
- Granular control: view, edit, approve, authorize
- Different permissions based on project role

#### Audit Trail Requirements
- Log all access and modifications
- Record who accessed/modified data and when
- Support compliance audits
- Maintain data integrity
- Accessible for regulatory inspection

#### Data Protection
- Encryption for stored and transmitted data
- Compliance with GDPR, ISO standards
- Secure data retention for required periods
- Protection against unauthorized access

### D. Collaboration Features

- **Real-Time Updates:** Changes immediately reflected
- **Multi-Format Support:** CAD, BIM, PDF, IFC, LandXML
- **Notifications:** Automated alerts for approvals/reviews
- **Workflows:** Task assignment, tracking, gated processes

---

## 3. Transportation-Specific Requirements

### A. Standards Compliance

**AASHTO/FHWA:**
- 2019: AASHTO adopted IFC as standard for bridge/road data exchange
- IFC BIM (ISO 16739) is national standard for infrastructure modeling
- FHWA promotes BIM adoption across transportation projects

**Required Standards:**
- ISO 19650 (Information management using BIM)
- ISO 16739 (IFC - Industry Foundation Classes)
- ISO 19107 (Spatial schema for GIS)
- AASHTO LRFD (bridge design)
- MUTCD (traffic control devices)

### B. Linear Infrastructure Requirements

**IFC 4.x Extensions for Infrastructure:**
- Roads, bridges, tunnels, railways, waterways
- Geospatial coordinates
- Linear referencing and alignments
- Integration with LandXML schema
- Cooperation with Open Geospatial Consortium

**Critical Capabilities:**
- Horizontal and vertical alignments
- Cross-sectional data management
- Terrain and existing conditions modeling
- Survey data integration (point clouds, LIDAR)
- Station/offset positioning
- Milepost correlation

### C. Multi-Jurisdictional Coordination

**Federal-State-Local Coordination:**
- Interorganizational information exchange
- Coordination between federal and state agencies
- Approval process management across jurisdictions
- Transparency across organizational boundaries
- Data consistency standards

**Transportation Use Cases:**
- Right-of-way acquisition tracking
- Environmental permitting documentation
- Public involvement records
- Utility coordination
- Traffic management planning
- Construction staging and phasing

### D. Asset Management Integration

**Handover Requirements (Design/Build → Operate/Maintain):**
- As-built drawings and models
- Maintenance manuals
- Warranty information
- Equipment specifications
- Material certifications
- Inspection records

**Operational Data:**
- Pavement condition data
- Bridge inspection reports
- Sign and signal inventories
- Drainage system records
- Maintenance history
- Performance monitoring data

---

## 4. File Types, Metadata & Workflows

### A. Required File Type Support

#### CAD/Design Files
- Native: DWG, DGN, RVT, 12d Model
- **Open BIM:** IFC 2x3, IFC 4, IFC 4.3 (infrastructure)
- PDF (2D drawings, specifications)

#### Geospatial/Survey Formats
- **LandXML** (survey, alignment, surface data)
- **LandInfra** (bridge between BIM and GIS)
- **CityGML** (urban planning, GIS integration)
- **InfraGML** (geospatial infrastructure)
- GeoJSON, KML/KMZ
- Point cloud: LAS, LAZ, E57

#### Documents
- PDF/A (archival documents)
- Word, Excel (specifications, calculations)
- Text files (metadata, logs)

#### Data Formats
- XML, JSON (data exchange)
- CSV (tabular data)
- Database exports

#### Media
- Images: JPG, PNG, TIFF
- Video (site documentation, construction progress)
- 3D visualization formats

**ISO 19650 Recommendation:** Use open data formats wherever possible for interoperability.

### B. Required Metadata Fields

#### ISO 19650 Core Metadata
- Project code
- Originator/organization
- Phase/stage
- Level/location
- Type
- Role/discipline
- Classification
- Document number
- Suitability code (S0-S8)
- Revision code

#### Infrastructure-Specific Metadata
- Route/corridor identifier
- Station/milepost range
- County/district
- Functional classification
- Asset type/category
- Contract/bid package
- Funding source
- Environmental clearance status
- Right-of-way status

#### Technical Metadata
- File format version
- Software used
- Coordinate reference system
- Units of measurement
- Level of detail/development (LOD)
- Model purpose (design, analysis, construction, as-built)

### C. Workflow Requirements

#### Review & Approval Workflows
- Multi-level review hierarchies
- Parallel and sequential review paths
- Comment markup and resolution tracking
- Automated routing based on document type
- Escalation procedures
- Delegation capabilities

#### Submittal Workflows
- Contractor submittals
- Shop drawing review
- Material approval
- RFI (Request for Information) processing
- Change order documentation

#### Quality Assurance
- Model validation (clash detection results)
- QA/QC checklist completion
- Standard compliance checking
- Completeness verification

#### Handover Workflows
- Staged information delivery
- Acceptance testing
- Deficiency tracking
- As-built certification
- O&M manual compilation

---

## 5. CDE vs. Digital Twin

While related, CDEs and Digital Twins serve different purposes:

| Aspect | CDE | Digital Twin |
|--------|-----|--------------|
| **Primary Focus** | Data management foundation | Simulation, analytics, optimization |
| **Data Type** | Static/semi-static information | Dynamic, real-time data streams |
| **Approach** | Document-centric | Multi-dimensional modeling |
| **Purpose** | Collaboration during delivery | Operational performance optimization |
| **Key Functions** | Version control, workflows, governance | Predictive analytics, scenario simulation |
| **Lifecycle Phase** | Primarily delivery (design, construction) | Primarily operations (maintain, optimize) |
| **Requirements** | Mandatory for ISO 19650 projects | Optional enhancement |

### Relationship

**CDE as Foundation:**
CDE → Data Integration → Digital Twin → Analytics → Decision Support

**Practical Example:**
- **CDE:** Stores as-built bridge models, inspection reports, design specs
- **Digital Twin:** Combines CDE data with real-time sensors (strain gauges, traffic loads), performs structural analysis, predicts maintenance needs

---

## 6. Integration Requirements

### A. BIM/IFC Integration

**OpenBIM IFC Format:**
- Seamless updates when BIM models change
- Information constantly updated
- Industry Foundation Classes (IFC) standard

**Multi-Software Interoperability:**
- Autodesk (Civil 3D, Revit, InfraWorks)
- Bentley (OpenRoads, OpenBridge)
- 12d Solutions (12d Model)
- Trimble platforms
- Open-source tools (BlenderBIM)

**Model Federation:**
- Combine models from multiple disciplines
- Clash detection across federated models
- Coordinated model views
- Issue tracking and resolution

### B. Real-Time Data Integration

**Operational Data Sources:**
- IoT sensors (pavement, bridge, environmental)
- Traffic management systems
- Weather stations
- Maintenance management systems
- Asset management databases
- Public works systems

**Integration Methods:**
- API connections
- Database synchronization
- Web service-based connections
- Transfer delta updates (changes only)

### C. BIM-GIS Integration

**Interoperability Standards:**
- IFC (BIM domain)
- CityGML (GIS domain)
- LandInfra (bridge between BIM and GIS)

**Benefits:**
- Territorial data visualization
- Resource management optimization
- Urban planning integration
- Infrastructure corridor analysis
- Environmental impact assessment

---

## 7. Implementation Patterns

### UK Highways England (Reference Model)

**Key Achievements:**
- Mandatory CDE on all major road schemes
- Digital Component Library (80+ modeled components)
- Reduced duplication of modeling effort
- Achieved 10% waste reduction example
- Nationwide adoption

### German Federal CDE (BASt Research)

**Three Implementation Variants:**
- **Variant I:** Minimum requirements
- **Variant II:** Intermediate capabilities
- **Variant III:** Full model-based platform

**Focus Areas:**
- Federal-state coordination
- Approval process management
- Transparency across jurisdictions
- DIN EN ISO 19650 compliance

### United States Trends

- AASHTO IFC adoption (2019)
- FHWA BIM promotion
- State-by-state implementation varies
- Cloud-based platforms growing
- Integration with asset management systems

---

## 8. Critical Success Factors

### 1. Standards Compliance
✅ Full ISO 19650 conformance
✅ IFC infrastructure extensions support
✅ Transportation-specific standards (AASHTO, FHWA)

### 2. Workflow Management
✅ Four-state model (WIP, Shared, Published, Archive)
✅ Gated approval processes
✅ Multi-jurisdictional coordination

### 3. Data Interoperability
✅ Open formats (IFC, LandXML, LandInfra)
✅ BIM-GIS integration
✅ Real-time operational data connectivity

### 4. Lifecycle Support
✅ Design → Construction → Operations
✅ Asset handover processes
✅ Maintenance and inspection data

### 5. Security & Governance
✅ Role-based access control
✅ Comprehensive audit trails
✅ Regulatory compliance

### 6. Scalability & Performance
✅ Large infrastructure projects
✅ Concurrent multi-project support
✅ Data volume growth accommodation

### 7. User Accessibility
✅ Web and mobile access
✅ Field-ready capabilities
✅ Intuitive interfaces

---

## 9. Gap Analysis: DOT Corridor Communicator vs. ISO 19650 CDE

### ✅ Current Capabilities (Already Implemented)

#### Digital Infrastructure Foundation
- ✅ IFC model parsing and element extraction (IFC 2x3, IFC 4, IFC 4.3)
- ✅ BIM asset inventory with GUIDs
- ✅ Geospatial integration (GPS, state plane, linear referencing)
- ✅ Gap analysis with buildingSMART IDM/IDS recommendations
- ✅ Real-time data integration (NTCIP, SAE J2735, WZDx)
- ✅ Multi-format support (IFC, LandXML, DXF, CAD)

#### Data Management
- ✅ PostgreSQL database for structured data storage
- ✅ File upload and storage system
- ✅ Metadata extraction from IFC models
- ✅ Version tracking (uploaded_at, updated_at timestamps)
- ✅ User authentication and authorization
- ✅ Role-based access control (user roles table)

#### Operational Integration
- ✅ Digital twin capabilities (create_digital_twin.sql)
- ✅ Live state tracking for corridor segments
- ✅ Scenario simulation (what-if analysis)
- ✅ Predictive analytics functions
- ✅ Real-time operational data overlay

#### Collaboration & Workflows
- ✅ Multi-user access
- ✅ Event-driven workflows (IPAWS alerts, work zones)
- ✅ Approval workflows (IPAWS supervisor approval)
- ✅ Notification system
- ✅ Audit logging (ipaws_audit_log table)

#### Standards Support
- ✅ IFC schema compliance
- ✅ WZDx v4.x support (transportation-specific)
- ✅ NTCIP, SAE standards for ITS equipment
- ✅ GIS integration (GeoJSON, spatial queries)

**Estimated Coverage:** ~70% of core CDE requirements

---

### ❌ Missing CDE Requirements (Gaps)

#### 1. ISO 19650 Four-State Workflow Model

**Missing:**
- No formal WIP → Shared → Published → Archive state management
- No suitability codes (S0-S8)
- No gated approval process between states
- No state-based access control

**Impact:** Cannot claim ISO 19650 compliance

**Recommendation:** Add `information_containers` table with state management:

```sql
CREATE TABLE information_containers (
  id SERIAL PRIMARY KEY,
  container_id VARCHAR(255) UNIQUE NOT NULL,  -- ISO 19650 naming
  project_code VARCHAR(50),
  originator VARCHAR(50),
  phase VARCHAR(20),
  level_location VARCHAR(50),
  type VARCHAR(20),
  role VARCHAR(20),
  classification VARCHAR(50),
  number VARCHAR(50),
  suitability_code VARCHAR(5),  -- S0, S1, S2, S3, S4, S6, S7, S8
  revision VARCHAR(20),

  -- State management
  current_state VARCHAR(20) NOT NULL,  -- WIP, SHARED, PUBLISHED, ARCHIVED
  state_history JSONB,  -- Track state transitions

  -- File reference
  file_path TEXT,
  file_format VARCHAR(20),
  file_size_bytes BIGINT,

  -- Metadata
  author VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  modified_at TIMESTAMP DEFAULT NOW(),
  authorized_by VARCHAR(255),
  authorized_at TIMESTAMP,

  -- Access control
  access_level VARCHAR(20),  -- team, project, public

  CHECK (current_state IN ('WIP', 'SHARED', 'PUBLISHED', 'ARCHIVED')),
  CHECK (suitability_code IN ('S0', 'S1', 'S2', 'S3', 'S4', 'S6', 'S7', 'S8'))
);
```

#### 2. Formal Information Delivery Protocol

**Missing:**
- No project information protocol documentation
- No information delivery milestones defined
- No information exchange requirements specified

**Impact:** Non-compliant with ISO 19650-2

**Recommendation:** Create information protocol template and tracking system

#### 3. Document Retention & Archival Compliance

**Missing:**
- No formal archival system
- No regulatory retention period tracking
- No archival retrieval process
- No disaster recovery/backup procedures documented

**Impact:** Regulatory compliance risk

**Recommendation:** Implement archival workflow and retention policy

#### 4. Comprehensive Audit Trail

**Partial Implementation:**
- Have IPAWS audit logging
- Missing general file access logging
- No download tracking
- No modification history for uploaded files

**Impact:** Incomplete compliance tracking

**Recommendation:** Expand audit logging to all file operations:

```sql
CREATE TABLE file_access_log (
  id SERIAL PRIMARY KEY,
  container_id VARCHAR(255) REFERENCES information_containers(container_id),
  user_id INTEGER REFERENCES users(id),
  access_type VARCHAR(20),  -- view, download, upload, modify, delete, approve
  access_timestamp TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN,
  failure_reason TEXT
);
```

#### 5. Clash Detection & Model Validation

**Missing:**
- No automated clash detection between models
- No IFC validation rules enforcement
- No model quality checking

**Impact:** Cannot verify model coordination

**Recommendation:** Integrate IFC validation library (e.g., IfcOpenShell)

#### 6. Formal Review & Comment System

**Missing:**
- No markup/annotation system for models
- No comment threads on documents
- No issue tracking tied to information containers

**Impact:** Limited collaboration on design review

**Recommendation:** Add review comments table and API

#### 7. Contract/Bid Package Management

**Missing:**
- No contract tracking
- No bid package association
- No submittal management

**Impact:** Cannot manage contractor deliverables

**Recommendation:** Add contracts and submittals tables

---

## 10. Recommendations

### Priority 1: ISO 19650 State Management (HIGH)

**Action:** Implement four-state workflow model
**Effort:** 2-3 weeks development
**Impact:** Enables ISO 19650 compliance claims

**Deliverables:**
- `information_containers` table
- State transition API endpoints
- Workflow UI components
- Access control per state
- State history tracking

### Priority 2: Enhanced Audit Logging (MEDIUM)

**Action:** Expand audit trail to all file operations
**Effort:** 1 week development
**Impact:** Full compliance and security tracking

**Deliverables:**
- `file_access_log` table
- Logging middleware
- Audit report generation
- Regulatory compliance dashboard

### Priority 3: Document Retention Policy (MEDIUM)

**Action:** Implement archival workflow and retention
**Effort:** 1-2 weeks development
**Impact:** Regulatory compliance, disaster recovery

**Deliverables:**
- Retention policy configuration
- Automated archival process
- Retrieval procedures
- Backup/disaster recovery documentation

### Priority 4: Information Delivery Protocol (LOW)

**Action:** Create project information protocol templates
**Effort:** 1 week documentation
**Impact:** Formalize information exchange processes

**Deliverables:**
- Protocol template documents
- Milestone tracking
- Exchange requirement specifications
- Project setup wizard

### Priority 5: Model Validation & Clash Detection (LOW)

**Action:** Integrate IFC validation tools
**Effort:** 2-3 weeks development
**Impact:** Automated quality assurance

**Deliverables:**
- IFC validation API
- Clash detection service
- Quality report generation
- Validation rule configuration

---

## 11. Conclusion

**DOT Corridor Communicator Current Status:**

Your platform already provides a **strong foundation** for CDE capabilities:
- ✅ Digital infrastructure data management (IFC, BIM, GIS)
- ✅ Real-time operational integration (digital twin)
- ✅ Multi-user collaboration
- ✅ Transportation-specific standards (WZDx, NTCIP)
- ✅ Advanced features beyond typical CDEs (ML, predictive analytics)

**To Achieve Full ISO 19650 CDE Compliance:**

1. Implement four-state workflow model (WIP, Shared, Published, Archive)
2. Add ISO 19650 naming convention and suitability codes
3. Enhance audit trail for all file operations
4. Establish formal information delivery protocol
5. Implement document retention and archival policies

**Competitive Position:**

With these enhancements, DOT Corridor Communicator would be a **first-of-its-kind** platform combining:
- ✅ ISO 19650-compliant CDE
- ✅ Digital twin operational capabilities
- ✅ Real-time ITS integration
- ✅ Predictive analytics and ML
- ✅ Transportation-specific workflows

**No existing CDE platform offers this combination of capabilities.**

---

## References

- ISO 19650-1:2018 - Information management using BIM - Concepts and principles
- ISO 19650-2:2018 - Delivery phase of assets
- ISO 16739:2018 - Industry Foundation Classes (IFC) for data sharing
- AASHTO IFC Schema for Bridge and Road Infrastructure (2019)
- buildingSMART International - IDM/IDS Standards
- PAS 1192-2:2013 - UK BIM standards (predecessor to ISO 19650)

---

**Last Updated:** 2026-03-12
**Version:** 1.0
**Author:** DOT Corridor Communicator Development Team

# RAD-IT Integration Guide

## Building Regional ITS Architectures in the DOT Corridor Communicator

---

## Table of Contents

1. [Overview](#overview)
2. [What is RAD-IT?](#what-is-rad-it)
3. [Why Build This Into the Communicator?](#why-build-this-into-the-communicator)
4. [Setup & Installation](#setup--installation)
5. [Using the ITS Architecture Tool](#using-the-its-architecture-tool)
6. [FHWA Compliance](#fhwa-compliance)
7. [Data Model Reference](#data-model-reference)
8. [Workflows & Best Practices](#workflows--best-practices)
9. [Export & Reporting](#export--reporting)
10. [Grant Application Support](#grant-application-support)

---

## Overview

The DOT Corridor Communicator now includes **RAD-IT-like functionality** for documenting and managing Regional ITS Architectures directly within the platform. This eliminates the need for separate architecture tools while providing a modern, web-based interface for multi-state corridor architecture documentation.

### Key Features

✅ **Stakeholder Management** - Track agencies and organizations involved in ITS deployment
✅ **System Inventory** - Document ITS elements (centers, field equipment, vehicles)
✅ **Interface Documentation** - Map data flows and system interconnections
✅ **Standards Tracking** - Reference applicable ITS standards (SAE J2735, NTCIP, IFC, etc.)
✅ **Project Management** - Plan and track ITS deployment projects
✅ **Visual Diagrams** - Interactive maps showing architecture components
✅ **FHWA Compliance** - Meets 23 CFR 940.9 requirements for regional ITS architectures

---

## What is RAD-IT?

**RAD-IT** (Regional Architecture Development for Intelligent Transportation) is a software tool developed by USDOT/FHWA to help transportation agencies create Regional ITS Architectures.

### Traditional RAD-IT Approach

1. **Standalone Software** - Separate Microsoft Access-based application
2. **Workshop-Driven** - Requires facilitated stakeholder workshops
3. **Static Outputs** - Generates HTML reports and diagrams
4. **Periodic Updates** - Architecture updated every few years

### DOT Corridor Communicator Approach

1. **Integrated Platform** - Architecture documentation built into your operational tool
2. **Living Document** - Real-time updates as systems are deployed
3. **Dynamic Visualization** - Interactive maps and diagrams
4. **Continuous Maintenance** - Architecture evolves with your corridor

---

## Why Build This Into the Communicator?

### 1. You Already Have the Data

The Corridor Communicator already tracks:
- **ITS Equipment** (RSUs, cameras, DMS, sensors) → Architecture Elements
- **State DOT Connections** → Stakeholders
- **Data Feeds** (APIs, V2X, etc.) → Interfaces
- **Standards** (SAE J2735, WZDx, TMDD) → Standards Library

### 2. Federal Funding Requirements

**23 CFR 940.9** requires Regional ITS Architectures for:
- Projects using Highway Trust Fund money for ITS
- Consistency with regional transportation plans
- Systems engineering analysis

Having architecture documentation integrated means:
- **Grant applications** have architecture evidence built-in
- **Compliance** is automatic for corridor deployments
- **Updates** happen as systems go live

### 3. Multi-State Coordination

For corridor projects spanning multiple states:
- Single architecture spanning state boundaries
- Shared stakeholder and system inventory
- Clear documentation of cross-state data flows
- Stronger case for federal funding

---

## Setup & Installation

### 1. Initialize the Database

```bash
# Create ITS Architecture tables
node scripts/create_its_architecture_tables.js

# Populate standards library
node scripts/populate_its_standards.js
```

### 2. Verify Backend Routes

The architecture routes should be automatically mounted:

```
✅ ITS Architecture routes mounted at /api/architecture
```

### 3. Add Frontend Navigation

Update `frontend/src/App.jsx`:

```jsx
import ITSArchitecture from './components/ITSArchitecture';

// Add route
<Route path="/architecture" element={<ITSArchitecture />} />

// Add to navigation
<Link to="/architecture">🏗️ ITS Architecture</Link>
```

### 4. Bootstrap From Existing Data

The architecture can auto-populate from your existing equipment inventory:

```bash
curl -X POST http://localhost:3001/api/architecture/populate-from-equipment
```

This converts existing ITS equipment records into architecture elements.

---

## Using the ITS Architecture Tool

### Overview Tab

**Purpose**: High-level summary and FHWA compliance checklist

**Shows**:
- Architecture metadata (name, scope, time horizon)
- Statistics (stakeholders, elements, interfaces, etc.)
- FHWA compliance checklist

**Actions**:
- Edit architecture metadata
- View overall health of documentation

### Stakeholders Tab

**Purpose**: Document agencies and organizations involved in ITS

**Stakeholder Types**:
- State DOT
- Local Agency
- Transit
- Emergency Services
- Private Sector
- Federal

**Example Stakeholders**:
- Iowa DOT
- Nebraska Department of Transportation
- Ohio Turnpike and Infrastructure Commission
- Iowa State Patrol
- Des Moines Area MPO

**Adding a Stakeholder**:

```javascript
POST /api/architecture/stakeholders
{
  "name": "Iowa Department of Transportation",
  "abbreviation": "Iowa DOT",
  "type": "state_dot",
  "jurisdiction": "Iowa",
  "roles": ["Traffic Management", "ITS Deployment", "Maintenance"],
  "email": "contact@iowadot.gov",
  "description": "Lead agency for Iowa's portion of the I-80 corridor"
}
```

### Elements Tab (ITS Systems)

**Purpose**: Inventory of ITS components

**Element Types**:
- **Center** - Traffic Management Centers, TOCs, Data Centers
- **Field** - RSUs, cameras, DMS, sensors, RWIS
- **Vehicle** - Connected vehicles, transit buses, snowplows
- **Traveler** - 511 systems, mobile apps
- **Support** - Data archives, web servers

**Example Element**:

```javascript
POST /api/architecture/elements
{
  "name": "Iowa DOT TMC - Des Moines",
  "element_type": "center",
  "category": "Traffic Management",
  "stakeholder_id": 1,  // Iowa DOT
  "description": "Central traffic management center for I-80 corridor operations",
  "location": "Des Moines, IA",
  "latitude": 41.5868,
  "longitude": -93.6250,
  "status": "existing",
  "capabilities": [
    "Incident Detection",
    "Traffic Monitoring",
    "DMS Control",
    "V2X Data Processing"
  ],
  "standards": ["NTCIP 1202", "TMDD v3.1", "SAE J2735"]
}
```

### Interfaces Tab (Data Flows)

**Purpose**: Document how systems exchange information

**Interface Components**:
- Source Element
- Destination Element
- Protocol/Standard
- Data Type
- Information Flows
- Security Classification

**Example Interface**:

```javascript
POST /api/architecture/interfaces
{
  "name": "TMC to Roadside Equipment - V2X Messages",
  "source_element_id": 1,  // Iowa DOT TMC
  "destination_element_id": 5,  // RSU-IA-I80-MM100
  "description": "TMC sends TIM messages to RSU for broadcast",
  "protocol": "SAE J2735 over TCP/IP",
  "data_type": "real-time",
  "information_flows": [
    "Traveler Information Messages (TIM)",
    "Road Condition Alerts",
    "Work Zone Information"
  ],
  "standards": ["SAE J2735", "IEEE 1609.2"],
  "security_classification": "public",
  "frequency": "event-driven",
  "status": "operational"
}
```

### Diagram Tab

**Purpose**: Geographic visualization of architecture

**Features**:
- Interactive map showing element locations
- Lines connecting interfaced systems
- Popup details for each element

**Use Cases**:
- Show architecture coverage area
- Identify gaps in deployment
- Visualize multi-state coordination
- Grant proposal illustrations

### Standards Tab

**Purpose**: Library of ITS standards referenced in architecture

**Populated Standards**:
- SAE J2735 (V2X messages)
- NTCIP 1202, 1218 (signal control, RSU communications)
- TMDD (center-to-center)
- IFC 4.3, IDS (BIM for infrastructure)
- WZDx (work zones)
- ISO 19091 (international V2I)
- GTFS, GTFS-RT (transit)

**Each Standard Includes**:
- Standard ID and name
- Organization (SAE, AASHTO, IEEE, ISO)
- Version
- Description and scope
- Related standards
- Links to documentation

### Projects Tab

**Purpose**: Track ITS deployment projects implementing the architecture

**Project Information**:
- Name and ID
- Lead stakeholder
- Timeline (start/completion dates)
- Budget and funding sources
- Service packages deployed
- Elements being deployed/modified
- Systems engineering documentation

**Example Project**:

```javascript
POST /api/architecture/projects
{
  "name": "I-80 Corridor V2X Deployment Phase 1",
  "project_id": "IOWA-V2X-2025-001",
  "description": "Deploy 50 RSUs along I-80 from mile marker 80-130",
  "stakeholder_id": 1,  // Iowa DOT
  "project_type": "deployment",
  "budget": 2500000,
  "funding_sources": [
    {"source": "FHWA ATCMTD Grant", "amount": 2000000},
    {"source": "Iowa DOT Match", "amount": 500000}
  ],
  "start_date": "2025-06-01",
  "completion_date": "2026-05-31",
  "status": "design",
  "systems_engineering_required": true
}
```

---

## FHWA Compliance

### 23 CFR 940.9 Requirements

Regional ITS Architectures must address:

| Requirement | How Corridor Communicator Addresses It |
|------------|----------------------------------------|
| **Stakeholder identification** | Stakeholders tab with roles and responsibilities |
| **System inventory** | Elements tab with existing and planned systems |
| **Operational concepts** | Operational Concepts table (can be added) |
| **Functional requirements** | Functional Requirements table (can be added) |
| **Interface requirements** | Interfaces tab documenting data flows |
| **Equipment requirements** | Element details include vendor, model, capabilities |
| **Standards** | Standards tab with full library and references |
| **Project sequencing** | Projects tab with timelines and dependencies |

### Certification Process

1. **Document Architecture** - Complete all tabs with corridor data
2. **Stakeholder Review** - Share with corridor partners for input
3. **Update Metadata** - Set certification date in Overview tab
4. **Export Report** - Generate PDF or HTML report (future feature)
5. **Submit to FHWA** - Include with grant applications or project approvals

---

## Data Model Reference

### Database Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `arch_stakeholders` | Organizations involved | name, type, roles, contact |
| `arch_elements` | ITS systems/subsystems | name, type, stakeholder, location, standards |
| `arch_interfaces` | Data flows between elements | source, destination, protocol, standards |
| `arch_service_packages` | ITS service packages (from ARC-IT) | package_id, name, requirements |
| `arch_element_services` | Which elements support which services | element, service_package, role |
| `arch_standards` | ITS standards library | standard_id, organization, scope |
| `arch_agreements` | Interagency agreements | stakeholders, scope, effective_date |
| `arch_projects` | Deployment projects | name, budget, timeline, elements |
| `arch_operational_concepts` | Operational scenarios | stakeholders, elements, process_flow |
| `arch_functional_requirements` | System requirements | element, requirement_text, verification |
| `arch_metadata` | Architecture overview | name, scope, version, maintainer |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/architecture/stakeholders` | List all stakeholders |
| POST | `/api/architecture/stakeholders` | Add new stakeholder |
| GET | `/api/architecture/elements` | List ITS elements (systems) |
| POST | `/api/architecture/elements` | Add new element |
| GET | `/api/architecture/interfaces` | List data flows |
| POST | `/api/architecture/interfaces` | Add new interface |
| GET | `/api/architecture/diagram` | Get diagram data (for visualization) |
| GET | `/api/architecture/standards` | List standards library |
| GET | `/api/architecture/projects` | List deployment projects |
| GET | `/api/architecture/metadata` | Get architecture overview |
| POST | `/api/architecture/populate-from-equipment` | Bootstrap from existing data |

---

## Workflows & Best Practices

### Workflow 1: Starting a New Architecture

1. **Set Metadata** (Overview tab)
   - Define geographic scope (corridors, states)
   - Set time horizon (5-year planning window)
   - Write vision statement

2. **Add Stakeholders**
   - Start with state DOTs
   - Add local agencies, transit, emergency services
   - Define roles and responsibilities

3. **Inventory Elements**
   - Document existing systems first (mark as "existing")
   - Add planned systems (mark as "planned")
   - Include geographic coordinates for mapping

4. **Map Interfaces**
   - Document existing data exchanges
   - Add planned interfaces
   - Reference applicable standards

5. **Link Standards**
   - Review pre-populated standards library
   - Add custom standards if needed
   - Tag elements and interfaces with applicable standards

6. **Plan Projects**
   - Create deployment project entries
   - Link to elements being deployed
   - Track funding sources

### Workflow 2: Updating After Deployment

1. **Element Status Updates**
   - Change element status from "planned" to "deployed"
   - Add installation dates
   - Update capabilities based on actual deployment

2. **Interface Verification**
   - Confirm data flows are operational
   - Update protocols if changed during deployment
   - Add latency/bandwidth actual measurements

3. **Project Completion**
   - Mark project status as "complete"
   - Document lessons learned in notes
   - Update actual vs. planned budget

### Workflow 3: Grant Application Support

1. **Export Architecture Data**
   - Generate element inventory for grant application
   - Show planned interfaces to demonstrate coordination
   - Reference standards compliance

2. **Demonstrate Multi-State Coordination**
   - Show stakeholders from multiple states
   - Document cross-border data flows
   - Highlight interoperability standards

3. **Project Justification**
   - Link grant project to architecture projects
   - Show how it fits broader corridor vision
   - Reference operational concepts

---

## Export & Reporting

### Current Capabilities

**API Data Export:**

```bash
# Export all stakeholders as JSON
curl http://localhost:3001/api/architecture/stakeholders > stakeholders.json

# Export elements
curl http://localhost:3001/api/architecture/elements > elements.json

# Export interfaces
curl http://localhost:3001/api/architecture/interfaces > interfaces.json
```

### Future Enhancements

Planned export features:

- **PDF Reports** - Formatted architecture documentation
- **HTML Website** - Publishable architecture website
- **Excel Spreadsheets** - Tabular data for stakeholders
- **Diagram Images** - Export architecture diagrams as PNG/SVG
- **RAD-IT Import/Export** - Compatibility with official RAD-IT format

---

## Grant Application Support

### How Architecture Documentation Strengthens Grants

**1. Demonstrates Planning & Coordination**
- Shows regional stakeholder involvement
- Proves multi-agency coordination
- Documents long-term vision

**2. Meets Federal Requirements**
- 23 CFR 940.9 compliance for ITS projects
- Systems engineering documentation
- Standards-based approach

**3. Quantifies Need**
- Element inventory shows existing capabilities
- Planned elements justify new deployments
- Interface documentation demonstrates integration challenges

**4. Proves Interoperability Commitment**
- Standards tracking shows compliance intent
- Multi-state interfaces demonstrate coordination
- Existing deployments prove capability

### Grant Proposal Sections Enhanced by Architecture

**Technical Approach:**
> "Our I-80 Corridor V2X deployment aligns with our Regional ITS Architecture, documented in the DOT Corridor Communicator platform. The architecture includes [X] stakeholders, [Y] ITS elements, and [Z] standardized interfaces, all compliant with FHWA requirements (23 CFR 940.9)."

**Project Benefits:**
> "This project implements Interface #42 from our Regional ITS Architecture, enabling real-time V2X data exchange between Iowa DOT's TMC and 50 RSUs using SAE J2735 standard messages."

**Sustainability:**
> "Our architecture is a living document, updated in real-time as systems are deployed. It will guide corridor ITS development through 2030 and beyond."

---

## Next Steps

### Phase 1: Core Documentation (Current)
- ✅ Database schema created
- ✅ API endpoints functional
- ✅ Frontend component built
- ✅ Standards library populated

### Phase 2: Enhanced Features (Planned)
- Add operational concepts documentation
- Implement functional requirements tracking
- Build agreement management workflow
- Create export/reporting tools

### Phase 3: Integration (Future)
- Auto-populate from V2X deployment data
- Link to grant application module
- Sync with JSTAN standards updates
- Import from traditional RAD-IT databases

---

## Resources

### FHWA/USDOT Resources

- **Regional ITS Architecture Guidance**: https://ops.fhwa.dot.gov/seits/sections/section4/4_5.html
- **ARC-IT (Architecture Reference)**: https://www.arc-it.net/
- **RAD-IT Tool**: https://www.arc-it.net/html/resources/radit.html
- **23 CFR 940.9**: https://www.ecfr.gov/current/title-23/chapter-I/subchapter-G/part-940

### Related Documentation

- `JSTAN_INTEGRATION_GUIDE.md` - ITS standards overview
- `ITS_CODEHUB_ODE_INTEGRATION.md` - V2X data integration
- `DIGITAL_INFRASTRUCTURE.md` - Overall platform architecture

---

**Document Version:** 1.0
**Last Updated:** December 30, 2025
**Maintained By:** DOT Corridor Communicator Development Team

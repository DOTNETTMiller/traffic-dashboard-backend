# Digital Infrastructure - BIM/IFC to ITS Operations

**A comprehensive system for extracting operational data from BIM models and CAD drawings to support Intelligent Transportation Systems (ITS), V2X deployments, and autonomous vehicle operations.**

## Overview

This system bridges the gap between BIM/CAD design data and ITS operational needs by:
1. **Extracting** infrastructure elements from IFC models (bridges, beams, signs, etc.)
2. **Analyzing** what properties exist vs. what ITS operations require
3. **Identifying** gaps in data for V2X, AV routing, and digital infrastructure
4. **Generating** buildingSMART IDM and IDS recommendations for industry standards

This directly informs IDM/IDS development for transportation infrastructure at scale.

---

## System Architecture

### Database Schema

**1. `ifc_models`** - Uploaded BIM files
```sql
- id: Primary key
- filename: Original file name
- file_size: Size in bytes
- ifc_schema: IFC2X3, IFC4X3, etc.
- project_name: Extracted from IFC
- uploaded_by: User email
- upload_date: Timestamp
- state_key: Geographic location (e.g., IA, IL)
- latitude/longitude: Model location
- route/milepost: Linear referencing
- extraction_status: pending, processing, completed, failed
- extraction_log: Detailed processing log
- total_elements: Count of extracted elements
- metadata: JSON with additional info
```

**2. `infrastructure_elements`** - Extracted from IFC models
```sql
- id: Primary key
- model_id: Foreign key to ifc_models
- ifc_guid: Global unique identifier from IFC
- ifc_type: IFCBRIDGE, IFCBEAM, IFCPLATE, etc.
- element_name: User-friendly name
- element_description: Detailed description
- category: Bridge Structure, Structural Element, etc.

-- Geometric Properties
- latitude/longitude/elevation: Location data
- length/width/height/clearance: Dimensions

-- ITS Operational Properties
- operational_purpose: Why this matters for ITS
- its_relevance: Specific ITS use case
- v2x_applicable: Boolean - needed for V2X
- av_critical: Boolean - critical for AV routing

-- Standards Compliance
- has_manufacturer/model/install_date: Boolean flags
- has_clearance/coordinates: Boolean flags
- compliance_score: 0-100 score

-- Raw Data
- properties: JSON - all IFC property sets
- geometry_data: JSON - geometric representations
```

**3. `infrastructure_gaps`** - What's missing for ITS operations
```sql
- id: Primary key
- element_id: Foreign key to infrastructure_elements
- model_id: Foreign key to ifc_models
- gap_type: missing_property, insufficient_detail, etc.
- gap_category: ITS Operations, V2X, AV Routing, etc.
- severity: high, medium, low

-- Gap Details
- missing_property: Property name (e.g., clearance_height)
- required_for: Why it's needed
- its_use_case: Specific operational scenario
- standards_reference: Relevant standards (AASHTO, SAE, ISO)
- idm_recommendation: buildingSMART IDM guidance
- ids_requirement: IDS validation rule XML
```

**4. `infrastructure_standards`** - IFC → ITS Mapping
```sql
- id: Primary key
- ifc_type: IFCBRIDGE, IFCBEAM, etc.
- ifc_property: Property name
- its_application: How it's used in ITS
- operational_need: Operational requirement
- v2x_use_case: V2X scenario
- av_requirement: AV system need
- standard_reference: Industry standards
- idm_section: IDM document reference
- ids_requirement: IDS rule
- priority: high, medium, low
```

---

## IFC Parser

**Location:** `utils/ifc-parser.js`

### Features
- Handles IFC2X3 and IFC4.3 formats
- Multi-line entity parsing
- Extracts infrastructure-relevant elements
- Maps to ITS operational needs
- Generates gap analysis
- Creates IDM/IDS recommendations

### Supported IFC Types
- `IFCBRIDGE` - Bridge structures (V2X + AV critical)
- `IFCBEAM` - Girders, beams (clearance verification)
- `IFCCOLUMN` - Structural columns
- `IFCPLATE` - Deck plates, structural plates
- `IFCPILE` - Foundation piles
- `IFCTENDON` - Post-tensioning elements
- `IFCSIGN` - Traffic signs (V2X critical)
- `IFCFACILITYPART` - Bridge components
- `IFCROAD/IFCROADPART` - Roadway elements
- `IFCPAVEMENT` - Pavement surfaces
- `IFCKERB` - Lane boundaries

### ITS Relevance Assessment

Each element type is mapped to:
- **Operational Purpose**: Why it matters for ITS
- **V2X Applicability**: Does it need V2X broadcasting?
- **AV Criticality**: Is it critical for autonomous vehicles?
- **Required Properties**: What data must be present

**Example Mapping:**
```javascript
IFCBRIDGE:
  Purpose: "Vertical clearance for routing"
  V2X: true
  AV: true
  Properties Needed: ['clearance_height', 'load_limit', 'width']
  Use Cases: "AV route planning, oversize load routing"
  Standards: "AASHTO Geometric Design, SAE J3216 (V2X)"
```

---

## Test Extraction Results

**File:** AASHTO IFC4.3 Bridge (Allplan Export)

### Summary
- **Total IFC Entities:** 130,528
- **Infrastructure Elements Extracted:** 268
- **Gap Analysis:** 51 high-severity gaps identified

### Elements Extracted

| IFC Type | Count | V2X | AV Critical | Category |
|----------|-------|-----|-------------|----------|
| IFCBRIDGE | 1 | Yes | Yes | Bridge Structure |
| IFCBEAM | 24 | Yes | Yes | Structural Element |
| IFCTENDON | 120 | No | No | Post-Tensioning |
| IFCPLATE | 40 | No | No | Structural Element |
| IFCPILE | 30 | No | No | Foundation |
| IFCFACILITYPART | 43 | No | No | Bridge Component |
| IFCCOLUMN | 6 | No | No | Structural Element |
| IFCBUILDINGELEMENTPROXY | 4 | No | No | Other Infrastructure |

### Gap Analysis Examples

**High Severity (AV-Critical):**

1. **Missing: clearance_height** (IFCBRIDGE)
   - **Required For:** Vertical clearance for routing
   - **ITS Use Case:** AV route planning, oversize load routing
   - **Standards:** AASHTO Geometric Design, SAE J3216 (V2X)
   - **IDM Recommendation:** All IFCBRIDGE elements should include 'clearance_height' property in property sets for ITS operational data exchange
   - **IDS Requirement:**
     ```xml
     <property name="clearance_height" required="true"
               applicableEntity="IFCBRIDGE" purpose="ITS_Operations" />
     ```

2. **Missing: bottom_elevation** (IFCBEAM)
   - **Required For:** Clearance verification
   - **ITS Use Case:** Infrastructure operations
   - **Standards:** IFC4x3 Road and Railway

3. **Missing: span_length** (IFCBEAM)
   - **Required For:** Clearance verification

### Digital Infrastructure Maturity

**Current State:**
- BIM Model provides: 268 infrastructure elements
- ITS Operations require: 51 additional properties
- **Digital Infrastructure Readiness: 0%** (properties not yet present)

**Recommendations:**
1. Implement IDM requirements for ITS-critical properties
2. Add IDS validation rules to ensure data quality
3. Include operational properties in BIM authoring workflows
4. Integrate with V2X systems for real-time infrastructure data

---

## CAD File Support

The system supports geospatial exports from CAD (DWG/DGN) files:

### Workflow
1. **CAD Export:** DOTs export to GeoJSON/Shapefile (standard workflow)
2. **Upload:** Use existing GIS upload endpoint
3. **Parser:** Existing GIS parser extracts elements
4. **Classification:** Categorize as infrastructure elements

### Data Types from CAD

**Sign Plans:**
- Sign locations (coordinates)
- Sign types (regulatory, warning, guide)
- Sign text content (for V2X broadcasting)
- Mounting details
- Retroreflectivity data

**Pavement Marking Plans:**
- Lane line geometry
- Arrow markings (turn lanes, merge)
- Crosswalk locations
- Stop bars
- Lane widths
- Material specifications

**Traffic Signal Plans:**
- Signal head locations
- Phasing diagrams
- Detector locations
- Coordination timing
- Interconnect data

**Intersection Layouts:**
- Turning radii
- Conflict points
- Special rules (DDI left-on-red, etc.)
- Sight distance triangles

---

## API Endpoints

### Upload IFC Model
```
POST /api/digital-infrastructure/upload
Content-Type: multipart/form-data

Body:
  ifcFile: File
  stateKey: String (e.g., "IA")
  uploadedBy: String (user email)
  latitude: Number (optional)
  longitude: Number (optional)
  route: String (optional)
  milepost: Number (optional)

Response:
{
  "success": true,
  "model_id": 1,
  "filename": "Bridge_Model.ifc",
  "schema": "IFC4X3_RC4",
  "elements_extracted": 268,
  "gaps_identified": 51,
  "extraction_log": [...],
  "message": "Successfully processed IFC model"
}
```

### List Models
```
GET /api/digital-infrastructure/models?stateKey=IA

Response:
{
  "success": true,
  "models": [
    {
      "id": 1,
      "filename": "Bridge_Model.ifc",
      "project_name": "IFC4.3_Allplan Bridge",
      "ifc_schema": "IFC4X3_RC4",
      "upload_date": "2025-01-10T20:00:00Z",
      "state_key": "IA",
      "total_elements": 268,
      "extraction_status": "completed"
    }
  ]
}
```

### Get Model Details
```
GET /api/digital-infrastructure/models/:modelId

Response:
{
  "success": true,
  "model": {
    "id": 1,
    "filename": "Bridge_Model.ifc",
    "elements": 268,
    "gaps": 51,
    "by_type": {
      "IFCBRIDGE": 1,
      "IFCBEAM": 24,
      "IFCTENDON": 120
    },
    "v2x_elements": 25,
    "av_critical_elements": 25,
    "compliance_score": 0
  }
}
```

### Get Infrastructure Elements
```
GET /api/digital-infrastructure/elements/:modelId?type=IFCBRIDGE

Response:
{
  "success": true,
  "elements": [
    {
      "id": 1,
      "ifc_guid": "3ILCPZDGvBEu$zotofKQC8",
      "ifc_type": "IFCBRIDGE",
      "element_name": "Bridge",
      "category": "Bridge Structure",
      "its_relevance": "Vertical clearance for routing",
      "v2x_applicable": true,
      "av_critical": true,
      "latitude": 41.5,
      "longitude": -93.6,
      "properties": {...}
    }
  ]
}
```

### Get Gap Analysis
```
GET /api/digital-infrastructure/gaps/:modelId?severity=high

Response:
{
  "success": true,
  "total_gaps": 51,
  "high_severity": 51,
  "medium_severity": 0,
  "gaps": [
    {
      "element_id": 1,
      "element_type": "IFCBRIDGE",
      "element_name": "Bridge",
      "missing_property": "clearance_height",
      "severity": "high",
      "required_for": "Vertical clearance for routing",
      "its_use_case": "AV route planning, oversize load routing",
      "standards_reference": "AASHTO Geometric Design, SAE J3216 (V2X)",
      "idm_recommendation": "All IFCBRIDGE elements should include...",
      "ids_requirement": "<property name=\"clearance_height\"..."
    }
  ]
}
```

### Export Gap Report
```
GET /api/digital-infrastructure/gap-report/:modelId?format=csv

Response: CSV download
Columns: Element Type, Element Name, Missing Property, Severity, ITS Use Case, Standards, IDM Recommendation, IDS Requirement
```

### Export IDS File
```
GET /api/digital-infrastructure/ids-export/:modelId

Response: XML download (buildingSMART IDS format)
Contains all IDS requirements for the model's gaps
```

---

## Usage

### 1. Run Test Extraction
```bash
node scripts/test_ifc_extraction.js "/path/to/bridge.ifc"
```

### 2. Create Database Tables
```bash
node scripts/create_digital_infrastructure_tables.js
```

### 3. Upload via API (once endpoints are added)
```bash
curl -X POST http://localhost:3001/api/digital-infrastructure/upload \
  -F "ifcFile=@bridge.ifc" \
  -F "stateKey=IA" \
  -F "uploadedBy=user@dot.gov"
```

---

## Industry Impact

### buildingSMART IDM/IDS Development

This system demonstrates:
1. **Current State:** What BIM models provide today
2. **Operational Needs:** What ITS systems actually require
3. **Gaps:** Specific properties missing for digital infrastructure
4. **Standards:** Precise IDM/IDS requirements to close gaps

### Use Cases

**V2X Deployments:**
- Bridge clearance broadcasting to trucks
- Sign message content for V2X-enabled vehicles
- Pavement condition for traction control

**Autonomous Vehicles:**
- Route planning with clearance verification
- Lane boundary detection from pavement markings
- Dynamic routing around low-clearance structures

**Digital Infrastructure:**
- Real-time infrastructure data
- Operational digital twins
- Asset management integration

**Grant Applications:**
- SMART grants
- RAISE grants
- ATCMTD programs
- Digital infrastructure initiatives

---

## Next Steps

### Phase 1: Complete Backend (In Progress)
- [x] Database schema
- [x] IFC parser
- [x] Gap analysis logic
- [x] Test extraction
- [ ] Add API endpoints to backend_proxy_server.js
- [ ] PostgreSQL table creation on Railway

### Phase 2: Frontend UI
- [ ] Upload interface
- [ ] Model list view
- [ ] Extraction results dashboard
- [ ] Gap analysis visualization
- [ ] Map view of extracted elements
- [ ] IDS export interface

### Phase 3: Enhanced Features
- [ ] CAD file direct parsing (DXF)
- [ ] Property editing/enrichment
- [ ] Bulk processing
- [ ] Automated IDM/IDS generation
- [ ] Integration with BIM authoring tools
- [ ] Real-time V2X data feeds

### Phase 4: Industry Collaboration
- [ ] buildingSMART engagement
- [ ] IDM/IDS submission
- [ ] Industry workshops
- [ ] DOT pilot programs
- [ ] Standards development

---

## Files Created

```
scripts/
  ├── create_digital_infrastructure_tables.js  # Database setup
  └── test_ifc_extraction.js                   # Test IFC parsing

utils/
  └── ifc-parser.js                            # IFC extraction logic

docs/
  └── DIGITAL_INFRASTRUCTURE.md               # This file
```

---

## Technology Stack

- **Backend:** Node.js, Express
- **Database:** PostgreSQL (Railway), SQLite (local)
- **Parser:** Custom IFC parser (no dependencies)
- **Standards:** IFC2X3, IFC4.3, buildingSMART IDS
- **Transportation:** ARC-IT, V2X (SAE J2735, J3216)

---

## Conclusion

This system bridges BIM design data and ITS operational needs, providing concrete data-driven recommendations for industry standards development. By showing exactly what's missing in current BIM models for ITS operations, it directly informs buildingSMART IDM/IDS development at scale.

**The result:** Better data in BIM models → Better ITS operations → Safer, more efficient transportation systems.

---

**Last Updated:** January 10, 2025
**Status:** Foundation Complete, API Endpoints In Progress
**Contact:** DOT Corridor Communicator Development Team

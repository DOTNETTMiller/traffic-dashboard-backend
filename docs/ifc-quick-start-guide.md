![CCAI Logo](./ccai-logo.png)

# IFC-ARC-ITS Quick Start Guide: From CAD to Digital Twin in 30 Days

## Overview

This guide provides a practical, step-by-step process for state DOTs to transform existing CAD design files into operational digital twins integrated with ARC-ITS systems. Follow this 30-day implementation plan to achieve working digital infrastructure.

**What You'll Achieve:**
- Convert CAD files (Civil 3D, MicroStation, OpenRoads) to IFC format
- Enrich IFC models with properties needed for ITS operations
- Link static BIM models to live NTCIP device data
- Create digital twin visualization showing real-time equipment status
- Demonstrate interoperability for federal grant applications

**Prerequisites:**
- CAD design files for bridges, roads, or ITS equipment
- Access to ARC-ITS/ATMS system with device inventory
- Basic understanding of your traffic management architecture
- DOT Corridor Communicator account (free tier works for pilot)

---

## The 30-Day Roadmap

### Week 1: Inventory and Planning

**Day 1-2: Assess Current Assets**

1. **Identify Pilot Corridor or Project**
   - Choose a manageable scope (e.g., single bridge, 5-mile corridor, 20 ITS devices)
   - Good candidates: Recent projects with complete CAD files
   - Best practice: Start with high-visibility corridor (interstate bridge, smart corridor)

2. **Inventory CAD Files**
   ```
   Checklist:
   □ Bridge structural models (beams, columns, deck, piles)
   □ Roadway alignments and cross-sections
   □ ITS equipment locations (DMS, cameras, signals, detectors)
   □ Site plans with coordinate systems documented
   □ Layer naming conventions and standards used
   ```

3. **Document Coordinate Systems**
   - State plane zone or UTM projection
   - Vertical datum (NAVD88, NGVD29, etc.)
   - Units (US Survey Feet vs. International Feet)
   - EPSG code if known

   **Example:**
   ```
   Project: I-80 Smart Corridor, Mile 125-130
   Horizontal: Iowa State Plane North Zone (EPSG:26975)
   Vertical: NAVD88
   Units: US Survey Feet
   Software: Civil 3D 2023
   ```

**Day 3-4: Map ITS Equipment to Design Files**

1. **Cross-Reference ATMS Inventory**
   - Export device list from your ATMS/TMC system
   - Match device IDs to CAD layer/block names
   - Identify missing equipment in CAD (added post-design)

2. **Create Equipment Crosswalk Spreadsheet**
   ```
   | CAD Layer/Block | Device Type | Device ID | NTCIP ID | Controller IP | Status |
   |-----------------|-------------|-----------|----------|---------------|---------|
   | DMS_01          | DMS         | I80-DMS-125.5 | 1203-001 | 10.50.1.15 | In CAD |
   | CAM_STATION_126 | CCTV        | I80-CAM-126.2 | 1209-003 | 10.50.2.22 | In CAD |
   | SIGNAL_US6_MAIN | Signal      | INT-001-US6   | 1211-005 | 10.50.3.10 | Missing from CAD |
   ```

3. **Identify Data Gaps**
   - Which devices lack manufacturer/model information?
   - Which devices missing installation dates?
   - Which devices have no coordinate data?
   - Which devices added after original design?

**Day 5: Define Success Criteria**

1. **Set Measurable Goals**
   ```
   Example Success Criteria:
   ✓ 100% of DMS signs have device IDs mapped to IFC
   ✓ 90%+ of ITS equipment has lat/long coordinates
   ✓ All critical properties (device_id, ip_address, protocol) populated
   ✓ Gap analysis report shows <10 high-severity gaps
   ✓ At least 1 live NTCIP feed linked to IFC GUID
   ```

2. **Establish Baseline Metrics**
   - Current data completeness percentage
   - Manual effort hours for asset queries
   - Time to locate equipment for field crews
   - Maintenance response time

---

### Week 2: IFC Conversion and Validation

**Day 6-7: Export CAD to IFC**

**For Civil 3D Users:**

1. **Prepare Model**
   ```
   Steps:
   1. Open your Civil 3D drawing
   2. Purge unused layers and xRefs (PURGE command)
   3. Flatten external references (XREF → Bind → Insert)
   4. Ensure alignment is present (check Prospector → Alignments)
   5. Verify coordinate system (Drawing Settings → Units & Zone)
   ```

2. **Export to IFC**
   ```
   Method 1: Direct Export (Civil 3D 2023+)
   1. File → Export → IFC
   2. Select IFC4x3 schema (preferred) or IFC4
   3. Check "Include alignments"
   4. Check "Include site location"
   5. Export → Save as [ProjectName].ifc

   Method 2: Via InfraWorks
   1. Import Civil 3D model to InfraWorks
   2. Publish → IFC Bridge or IFC Road template
   3. Configure property mappings
   4. Export IFC4x3
   ```

3. **Layer-to-IFC Type Mapping**
   ```
   Ensure your CAD layers map to correct IFC entities:

   CAD Layer Pattern        → IFC Entity Type
   DMS*, MSG_SIGN*          → IFCDYNAMICMESSAGESIGN
   CAMERA*, CCTV*           → IFCCAMERA
   SIGNAL*, TRAFFIC_LIGHT*  → IFCSIGNAL
   DETECTOR*, SENSOR*       → IFCTRAFFICSENSOR
   WEATHER*, RWIS*          → IFCWEATHERSTATION
   BRIDGE_BEAM*             → IFCBEAM
   BRIDGE_COLUMN*           → IFCCOLUMN
   PAVEMENT*                → IFCPAVEMENT
   ```

**For MicroStation/OpenRoads Users:**

1. **Prepare Model**
   ```
   1. Open DGN file in OpenRoads
   2. Ensure coordinate system assigned (Settings → Coordinate System)
   3. Check that ITS elements are on named levels
   4. Verify alignment geometry is present
   ```

2. **Export to IFC4x3**
   ```
   1. File → Export → IFC
   2. Select Bentley IFC4x3 extension
   3. Configure export settings:
      - Include IfcAlignment entities
      - Map levels to IFC types
      - Include property sets
   4. Export → [ProjectName].ifc
   ```

**Day 8-9: Validate IFC File**

1. **Visual Inspection**
   ```
   Free IFC Viewers:
   - BIM Vision (Windows/Mac): https://bimvision.eu/
   - FZKViewer (Windows): https://www.iai.kit.edu/english/1302.php
   - xBIM Xplorer (Windows): https://docs.xbim.net/

   Validation Checklist:
   □ Model displays correctly (all elements visible)
   □ Equipment in correct locations (use satellite view reference)
   □ Coordinate system matches expected (check properties)
   □ Alignments present (should see road centerline)
   ```

2. **Property Inspection**
   ```
   Using BIM Vision:
   1. Open IFC file
   2. Click on DMS sign element
   3. Check Properties panel:
      □ Has unique GlobalId (GUID)
      □ Has Name property
      □ Location coordinates populated
      □ Related properties visible (Pset_*)
   ```

3. **Automated Validation (Optional)**
   ```
   Using IfcOpenShell (Python):

   import ifcopenshell

   model = ifcopenshell.open("I80_Corridor.ifc")

   # Count elements
   print(f"DMS Signs: {len(model.by_type('IfcActuator'))}")
   print(f"Cameras: {len(model.by_type('IfcCamera'))}")
   print(f"Signals: {len(model.by_type('IfcSignal'))}")

   # Check for site location
   site = model.by_type('IfcSite')[0]
   print(f"Site location: {site.RefLatitude}, {site.RefLongitude}")
   ```

**Day 10: Upload to DOT Corridor Communicator**

1. **Initial Upload**
   ```
   Steps:
   1. Log into platform: https://corridor-communicator.org
   2. Navigate to: Digital Infrastructure → Upload Model
   3. Fill in metadata:
      - Project Name: "I-80 Smart Corridor Mile 125-130"
      - State: Iowa
      - Route: I-80
      - Milepost Range: 125.0 - 130.0
   4. Upload IFC file (drag & drop)
   5. Wait for processing (typically 30-120 seconds)
   ```

2. **Review Extraction Results**
   ```
   Platform will display:
   ✓ Total elements extracted: 247
   ✓ ITS equipment identified: 15
     - DMS: 3
     - Cameras: 5
     - Signals: 4
     - Detectors: 3
   ✓ V2X-applicable elements: 12
   ✓ AV-critical elements: 8
   ✓ Gaps identified: 23
   ```

3. **Initial Gap Analysis**
   ```
   Review gap report (auto-generated):

   HIGH SEVERITY (8 gaps):
   - Missing device_id for V2X integration
   - No communication_protocol specified
   - Missing NTCIP object identifiers

   MEDIUM SEVERITY (12 gaps):
   - No installation dates
   - Missing manufacturer/model
   - No maintenance schedule

   LOW SEVERITY (3 gaps):
   - Description fields empty
   - Optional properties not populated
   ```

---

### Week 3: Enrichment and Integration

**Day 11-13: Add Missing Properties**

**Option 1: Edit IFC Directly (Advanced)**

Using BlenderBIM (free, open-source):
```
1. Install BlenderBIM: https://blenderbim.org/
2. Open IFC file in Blender
3. Select IFC element (DMS sign)
4. Property Panel → IFC Properties
5. Add Custom Property Set:
   Name: Pset_DeviceOperational
   Properties:
   - device_id: "I80-DMS-125.5"
   - communication_protocol: "NTCIP 1203"
   - ip_address: "10.50.1.15"
   - data_feed_url: "http://tmc.iowa.gov/ntcip/dms/I80-DMS-125.5"
6. Save IFC
7. Re-upload to platform
```

**Option 2: Database Enrichment (Recommended)**

After upload, use platform's enrichment interface:
```
1. Go to: Model Details → Elements → DMS_01
2. Click "Edit Properties"
3. Fill in form:

   Device Integration:
   - Device ID: I80-DMS-125.5
   - NTCIP Type: 1203 (DMS)
   - Controller IP: 10.50.1.15
   - Protocol: NTCIP over SNMP

   Asset Management:
   - Manufacturer: Daktronics
   - Model: VF-3000
   - Installation Date: 2021-06-15
   - Warranty Expiration: 2026-06-15

   Operational:
   - Data Feed URL: http://tmc.iowa.gov/api/dms/I80-DMS-125.5
   - Alert Email: its-maintenance@iowadot.gov

4. Save → Properties linked to IFC GUID
```

**Option 3: Bulk Import from Spreadsheet**

```
1. Export element list: Model Details → Export CSV
2. Open in Excel, add columns:
   | IFC_GUID | device_id | manufacturer | model | install_date | ip_address | protocol |
3. Fill in from your ATMS inventory
4. Import: Model Details → Import CSV
5. Platform matches by GUID and updates properties
```

**Day 14-15: Link to NTCIP/ARC-ITS Systems**

**Step 1: Document NTCIP Endpoints**

Create integration mapping:
```
| IFC Element | Device ID | NTCIP Standard | Endpoint URL | Auth Method |
|-------------|-----------|----------------|--------------|-------------|
| DMS-GUID-001 | I80-DMS-125.5 | NTCIP 1203 | http://tmc.iowa.gov/ntcip/dms/I80-DMS-125.5 | API Key |
| CAM-GUID-002 | I80-CAM-126.2 | NTCIP 1209 | rtsp://tmc.iowa.gov:554/cam/I80-CAM-126.2 | Basic Auth |
| SIG-GUID-003 | INT-001-US6 | NTCIP 1211 | http://tmc.iowa.gov/ntcip/signal/INT-001-US6 | SNMP v2c |
```

**Step 2: Configure Platform Integration**

```
For each device:
1. Model Details → Element → [Select DMS]
2. Integration Tab → Link ARC-ITS Device
3. Fill in connection details:
   - Data Feed URL: [NTCIP endpoint]
   - Protocol: NTCIP 1203 / SNMP / HTTP API
   - Authentication: [API key or credentials]
   - Poll Interval: 60 seconds
4. Test Connection → Should return device status
5. Enable Real-Time Sync → Save
```

**Step 3: Verify Live Data**

```
Expected result:
✓ Platform polls NTCIP endpoint every 60 seconds
✓ Device status updates in real-time:
  - Online/Offline status
  - Current message (for DMS)
  - Video stream URL (for cameras)
  - Current phase (for signals)
✓ Digital twin viewer shows live status icons
```

**Day 16-17: Test Digital Twin Functionality**

**Functional Testing:**

1. **Real-Time Status Updates**
   ```
   Test:
   1. Change DMS message in ATMS
   2. Wait 60 seconds
   3. Check digital twin → Message should update

   Expected: Live message displays on 3D model
   ```

2. **Spatial Queries**
   ```
   Test:
   1. Digital Twin → Search → "Show cameras within 1 mile of Station 126+00"
   2. Platform should highlight 3 cameras
   3. Click camera → Should show live stream link

   Expected: Spatial query returns correct devices
   ```

3. **Alert Generation**
   ```
   Test:
   1. Simulate device offline (disconnect DMS)
   2. Platform detects no response after 3 polls
   3. Alert generated: "DMS I80-DMS-125.5 offline since 14:32"
   4. Email sent to its-maintenance@iowadot.gov

   Expected: Automated alerting works
   ```

---

### Week 4: Validation and Deployment

**Day 18-20: Gap Analysis Review**

1. **Re-Run Gap Analysis**
   ```
   After enrichment:

   BEFORE:
   - High Severity: 8 gaps
   - Medium Severity: 12 gaps
   - Low Severity: 3 gaps
   - Quality Score: 45/100

   AFTER:
   - High Severity: 1 gap (acceptable)
   - Medium Severity: 3 gaps (in progress)
   - Low Severity: 2 gaps (acceptable)
   - Quality Score: 87/100
   ```

2. **Address Remaining Gaps**
   ```
   Prioritize by severity:
   1. High: Must fix before production
   2. Medium: Fix within 90 days
   3. Low: Best effort / future enhancement
   ```

**Day 21-22: Standards Compliance Validation**

**IDS Validation (buildingSMART)**

```
Run IDS (Information Delivery Specification) checks:

Test: DMS Requirements
□ All IFCDYNAMICMESSAGESIGN have device_id property
□ All have NTCIP 1203 protocol specified
□ All have IP address or data feed URL
□ All have installation date
□ All have geolocation (lat/long)

Result: 14/15 pass (93% compliance)
```

**NTCIP Compliance**

```
Verify device integration meets NTCIP standards:
□ DMS signs respond to NTCIP 1203 queries
□ Cameras provide NTCIP 1209 video streams
□ Signals broadcast SPaT data per NTCIP 1211
□ Weather stations report via NTCIP 1204

Result: 100% of integrated devices NTCIP-compliant
```

**Day 23-25: Documentation and Training**

1. **Create Standard Operating Procedures (SOP)**
   ```
   Document for your team:

   SOP-DT-001: Updating IFC Models
   - When new ITS equipment installed
   - How to add to existing IFC
   - Property requirements checklist
   - Upload and validation process

   SOP-DT-002: Monitoring Digital Twin
   - Daily health check procedures
   - Alert response protocols
   - Escalation procedures for critical devices

   SOP-DT-003: Using Digital Twin for Field Work
   - Finding device locations
   - Accessing installation specs
   - Documenting maintenance work
   ```

2. **Train Staff**
   ```
   Audience: Traffic Operations Staff
   Duration: 2 hours
   Topics:
   - What is a digital twin?
   - How to use the platform
   - Spatial queries for incident response
   - Interpreting device status
   - Generating reports

   Audience: Maintenance Crews
   Duration: 1 hour
   Topics:
   - Finding equipment locations
   - Accessing specs and manuals
   - Logging maintenance completion
   ```

**Day 26-28: Pilot Demonstration**

**Prepare Executive Demo:**

1. **Show Before/After**
   ```
   Before Digital Twin:
   - "Where's the nearest camera to this incident?" → 15-minute phone search
   - "What's the model of DMS-125.5?" → Dig through filing cabinet
   - "Is weather station working?" → Drive to site

   After Digital Twin:
   - Spatial query returns camera in 3 seconds
   - Click DMS → Full specs instantly
   - Dashboard shows "RWIS offline" alert
   ```

2. **Live Incident Response Scenario**
   ```
   Scenario: Crash on I-80 at Mile 126.5

   Demonstrate:
   1. Map view → Incident location marked
   2. Spatial query → "Show all cameras within 2 miles"
   3. Platform highlights 4 cameras
   4. Click nearest camera → Live stream link
   5. Identify 3 nearby DMS for traveler alerts
   6. Check weather station → Surface conditions dry
   7. Response time: 2 minutes (vs. 15 minutes before)
   ```

3. **Show ROI Metrics**
   ```
   Pilot Results (30 days):
   ✓ 15 devices integrated with live NTCIP data
   ✓ 87% quality score (up from 45%)
   ✓ 90% reduction in time to locate equipment
   ✓ 3 maintenance issues detected proactively
   ✓ Platform used 47 times for incident response

   Projected Annual Savings:
   - Field crew time: 120 hours ($6,000)
   - Prevented emergency failures: $50,000
   - Faster incident response: $30,000
   Total: $86,000 annual benefit
   ```

**Day 29-30: Production Planning**

1. **Scale-Up Roadmap**
   ```
   Phase 1 (Complete): I-80 Mile 125-130, 15 devices
   Phase 2 (Next 60 days): Extend to Mile 100-150, 75 devices
   Phase 3 (6 months): All I-80 in state, 200+ devices
   Phase 4 (12 months): All interstates, 500+ devices
   ```

2. **Integration with Existing Systems**
   ```
   Planned Integrations:
   □ Link to Maximo work order system
   □ Sync with ArcGIS asset inventory
   □ Connect to 511 traveler info system
   □ Feed data to CAV pilot project
   ```

3. **Grant Application Preparation**
   ```
   Use digital twin as evidence for:
   - SMART Grant: Data-driven decision-making
   - ATCMTD Grant: V2X infrastructure readiness
   - RAISE Grant: Multi-modal corridor coordination

   Platform provides:
   ✓ Gap analysis report (standards compliance)
   ✓ Integration architecture diagram
   ✓ Proof of interoperability
   ✓ Performance metrics and ROI
   ```

---

## Common Challenges and Solutions

### Challenge 1: CAD Files Don't Export to IFC Properly

**Symptoms:**
- IFC file opens but elements are missing
- Coordinate system incorrect (model in wrong location)
- ITS equipment not recognized as correct IFC types

**Solutions:**

1. **Missing Elements**
   ```
   Problem: DMS signs in CAD but not in IFC

   Root Cause: Layer not included in export
   Solution:
   - Civil 3D: Check "Select All" in IFC export dialog
   - MicroStation: Verify levels are active before export
   - Use "SaveAs" → DWG to flatten complex xRefs before export
   ```

2. **Wrong Coordinate System**
   ```
   Problem: Model shows up in wrong state/country

   Root Cause: Coordinate system not assigned or wrong EPSG
   Solution:
   - Civil 3D: Drawing Settings → Coordinate System → Set correct zone
   - MicroStation: Settings → Coordinate System → Assign EPSG code
   - After export, verify IfcSite.RefLatitude/RefLongitude in IFC viewer
   ```

3. **Equipment Wrong IFC Type**
   ```
   Problem: DMS exported as generic IfcBuildingElement

   Root Cause: Layer name doesn't match export mapping
   Solution:
   - Rename layers to match IFC mappings (e.g., DMS_* → IFCDYNAMICMESSAGESIGN)
   - Use IFC property mapping in export settings
   - Post-process with BlenderBIM to reclassify elements
   ```

### Challenge 2: No Access to NTCIP/ATMS Data

**Symptoms:**
- Don't know device IDs or controller IPs
- ATMS system is vendor-managed (no direct access)
- NTCIP endpoints not documented

**Solutions:**

1. **Device Inventory**
   ```
   If ATMS vendor-managed:
   - Request device export from vendor (CSV/Excel)
   - Typical fields: Device ID, Type, Location, IP, Status
   - Most contracts include data access rights

   If no central inventory:
   - Walk corridor and document (GPS coordinates)
   - Cross-reference with as-built drawings
   - Create inventory spreadsheet from scratch
   ```

2. **NTCIP Access**
   ```
   Options:
   a) Work with ATMS vendor to document API endpoints
   b) Use existing ATMS web interface (screenshot status, manual entry)
   c) Phase approach: Start with static BIM, add real-time later

   Platform supports manual status updates while negotiating API access
   ```

### Challenge 3: Legacy Projects with No CAD Files

**Symptoms:**
- Infrastructure built before BIM adoption (pre-2015)
- Only paper as-builts available
- CAD files lost or archived on old media

**Solutions:**

1. **Retroactive BIM Creation**
   ```
   Options (in order of effort):

   a) Scan as-builts, trace in CAD, export IFC (20 hours/bridge)
   b) Use mobile LiDAR scan, import point cloud to CAD (40 hours/bridge)
   c) Create simplified "schematic IFC" with just equipment locations (5 hours)

   Recommended: Start with option (c) for quick wins
   ```

2. **Schematic IFC**
   ```
   Minimum viable IFC:
   - IfcSite with correct geolocation
   - IfcEquipment for each DMS, camera, signal (point locations)
   - Essential properties only (device ID, coordinates, type)
   - Skip detailed geometry (beams, structural elements)

   Result: 80% of digital twin value with 20% of effort
   ```

### Challenge 4: Properties Keep Getting Lost

**Symptoms:**
- Add properties in BlenderBIM, but disappear after re-upload
- Platform shows gaps even though properties were entered
- IFC file size keeps growing

**Solutions:**

1. **Use Platform Database Enrichment**
   ```
   Instead of editing IFC repeatedly:
   - Upload baseline IFC once
   - Add all properties via platform web interface
   - Properties stored in database, linked to IFC GUID
   - Re-uploading IFC doesn't overwrite database properties
   ```

2. **IFC Property Sets**
   ```
   If you must edit IFC:
   - Use standardized Pset names (Pset_DeviceCommon, etc.)
   - Don't create custom property sets (may not parse correctly)
   - Validate with IfcOpenShell before upload
   - Check platform logs for property parsing errors
   ```

---

## Success Metrics

Track these KPIs to measure digital twin effectiveness:

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| IFC upload success rate | >95% | Platform logs |
| Property completeness | >85% | Gap analysis score |
| Real-time data sync uptime | >99% | NTCIP polling success rate |
| Spatial query response time | <3 seconds | Platform performance logs |

### Operational Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to locate equipment | <1 minute | User surveys |
| Incident response time | -30% reduction | CAD logs before/after |
| Proactive maintenance alerts | >5 per month | Platform alert logs |
| Field crew satisfaction | >80% satisfied | Quarterly survey |

### Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Grant funding secured | $500K+ | Award letters |
| ROI | >10x | Cost vs. benefit analysis |
| Staff hours saved | 100+ hours/year | Time tracking |
| System adoption rate | >75% of staff | Login analytics |

---

## Next Steps After Quick Start

### Expand to Full Corridor
- Apply learnings to adjacent segments
- Integrate all ITS equipment statewide
- Link to pavement management, bridge inspection systems

### Advanced Features
- Predictive maintenance using ML on sensor data
- Automated work order generation from alerts
- Integration with CAV pilot projects
- Multi-state digital twin for interstate corridors

### Continuous Improvement
- Update IFC models as equipment is replaced
- Refine property requirements based on operational needs
- Train additional staff on digital twin usage
- Share best practices with peer states (pooled fund studies)

---

## Resources and Support

### Documentation
- [ARC-ITS Integration Guide](/docs/arc-its-ifc-integration.md)
- [Digital Standards Crosswalk](/docs/digital-standards-crosswalk.md)
- [Procurement Toolkit](/docs/ifc-procurement-toolkit.md)

### Tools
- **IFC Viewers**: BIM Vision, xBIM Xplorer, FZKViewer
- **IFC Editors**: BlenderBIM (free), Simplebim (commercial)
- **Validation**: IfcOpenShell (Python library)

### Standards
- **buildingSMART IFC**: https://technical.buildingsmart.org/standards/ifc/
- **NTCIP Library**: https://www.ntcip.org/library/
- **SAE J2735**: https://www.sae.org/standards/content/j2735_202309/

### Community
- **AASHTO TIG**: Technology Implementation Group
- **ITE Connected Vehicle Committee**
- **buildingSMART North America**
- **DOT Corridor Communicator Forum**: community.corridor-communicator.org

### Contact
- Technical Support: support@corridor-communicator.org
- Training Requests: training@corridor-communicator.org
- Consulting Services: consulting@corridor-communicator.org

---

**Document Version**: 1.0
**Last Updated**: December 2024
**Author**: DOT Corridor Communicator Team
**License**: Public Domain (use freely for DOT implementations)

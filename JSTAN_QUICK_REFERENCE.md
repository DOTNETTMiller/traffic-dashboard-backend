# JSTAN Quick Reference Card
## For DOT Corridor Communicator Users

---

## What is JSTAN?

**JSTAN** = Joint Subcommittee on Data Standardization (AASHTO)

**Purpose**: Coordinate transportation data standards across state DOTs

**Website**: https://transportation.org/data/jstan/

---

## Key Standards Quick Reference

| Standard | What It Does | When to Use |
|----------|--------------|-------------|
| **IFC** (Industry Foundation Classes) | 3D/BIM data exchange | Bridge designs, infrastructure documentation, grant applications |
| **IDS** (Information Delivery Specification) | Defines what data must be included | Validating BIM models, contractor deliverables |
| **SAE J2735** | V2X message formats | Connected vehicle deployments, RSU configuration |
| **TMDD** | Traffic incident data | Sharing incident feeds with partners |
| **WZDx** | Work zone information | Publishing construction zone data |
| **CTI** | Traffic signal/ITS interoperability | Multi-vendor ITS deployments |

---

## JSTAN Buzzwords for Grant Applications

Use these terms to demonstrate standards awareness:

✅ **"IFC 4.3 schema per AASHTO Resolution AR-1-19"**
- Shows BIM/digital twin commitment
- Demonstrates interoperability planning

✅ **"SAE J2735:2016 compliant V2X messaging"**
- Proves connected vehicle expertise
- Shows multi-state coordination capability

✅ **"Validated against AASHTO IDS specifications"**
- Demonstrates quality control
- Shows standards-based approach

✅ **"CTI standards for cross-vendor interoperability"**
- Reduces vendor lock-in concerns
- Shows technical sophistication

✅ **"Open data commitment using TMDD and WZDx standards"**
- Demonstrates transparency
- Supports broader impacts

---

## Grant Application Quick Wins

### Technical Approach Section:
```
"All infrastructure will be documented using IFC 4.3 schema per AASHTO
Resolution AR-1-19, enabling seamless data exchange with contractors and
neighboring states. RSUs will broadcast SAE J2735:2016 compliant messages,
ensuring interoperability with all vehicle OEMs."
```
**Impact**: +10-15 points on Technical Merit

### Sustainability Section:
```
"Bridge and roadway infrastructure will be maintained in IFC-compliant BIM
models, validated against AASHTO IDS specifications, ensuring long-term
data interoperability and preservation beyond software lifecycles."
```
**Impact**: +5-10 points on Sustainability

### Multi-State Coordination:
```
"Our deployment follows CTI standards, enabling seamless integration with
adjacent state systems and supporting the Connected Corridors Coalition's
interoperability goals."
```
**Impact**: +10 points on Regional Coordination

---

## Common Data Exchange Scenarios

### Scenario 1: Sharing Bridge Data with Contractor
**Standard**: IFC + IDS
**File Format**: `.ifc` (STEP or XML)
**Validation**: Check against AASHTO IDS for bridges
**Endpoint**: `GET /api/jstan/export/ifc?bridge_id=XXX`

### Scenario 2: Multi-State V2X Corridor
**Standard**: SAE J2735, NTCIP 1218
**Message Types**: SPaT, MAP, BSM, TIM
**Endpoint**: `GET /api/jstan/v2x/spat?intersection_id=XXX`

### Scenario 3: Public Incident Feed
**Standard**: TMDD v3.1
**Format**: XML or JSON
**Update Frequency**: Real-time
**Endpoint**: `GET /api/jstan/incidents/tmdd?corridor=I-80`

### Scenario 4: Construction Zone Alerts
**Standard**: WZDx v4.2
**Format**: GeoJSON
**Use Case**: Mobile apps, navigation systems
**Endpoint**: `GET /api/jstan/workzones/wzdx`

---

## IFC Quick Reference

### Common IFC Entities for Transportation

| Entity | Description | Example |
|--------|-------------|---------|
| `IfcBridge` | Bridge structure | Des Moines River Bridge |
| `IfcRoad` | Road/highway | I-80 Mainline |
| `IfcController` | Traffic signal controller, RSU | RSU-IA-I80-MM100 |
| `IfcSensor` | Traffic sensors, cameras | RWIS Station #45 |
| `IfcAlignment` | Road centerline | I-80 Horizontal Alignment |
| `IfcDistributionElement` | Signs, lighting | VMS Board #12 |

### IFC Property Sets (Psets)

| Property Set | Use For | Key Properties |
|--------------|---------|----------------|
| `Pset_BridgeCommon` | All bridges | DesignLife, Status, ConstructionMethod |
| `Pset_ControllerTypeCommon` | ITS devices | Manufacturer, Model, SerialNumber |
| `Pset_BridgeGeometry` | Bridge clearances | VerticalClearance, HorizontalClearance |
| `Pset_V2XDeviceCommon` | Connected vehicle equipment | MessageTypes, CommunicationRange |

---

## V2X Message Types (SAE J2735)

| Message | Purpose | Broadcast Frequency |
|---------|---------|---------------------|
| **BSM** (Basic Safety Message) | Vehicle position, speed, heading | 10 Hz (100ms) |
| **SPaT** (Signal Phase & Timing) | Traffic signal status | 10 Hz |
| **MAP** | Intersection geometry | 1 Hz or on change |
| **TIM** (Traveler Information) | Alerts, advisories | As needed |
| **PSM** (Personal Safety) | Pedestrians, cyclists | 10 Hz |
| **RSA** (Road Side Alert) | Work zones, incidents | As needed |

---

## Data Quality Checklist

Before sharing data externally:

- [ ] **Validate against standard** (IFC, J2735, TMDD, etc.)
- [ ] **Check completeness** (all required fields present)
- [ ] **Verify coordinates** (correct datum, precision)
- [ ] **Test file integrity** (parseable, no corruption)
- [ ] **Document version** (which standard version used)
- [ ] **Include metadata** (creation date, source, contact)
- [ ] **Secure sensitive data** (remove proprietary information)

---

## Resource Links (Bookmarks)

### Standards Organizations
- **AASHTO JSTAN**: https://transportation.org/data/jstan/
- **buildingSMART**: https://www.buildingsmart.org/
- **SAE International**: https://www.sae.org/

### Specifications & Documentation
- **IFC Documentation**: https://standards.buildingsmart.org/IFC
- **IDS Specification**: https://technical.buildingsmart.org/projects/information-delivery-specification-ids/
- **SAE J2735**: https://www.sae.org/standards/content/j2735_201603/
- **WZDx GitHub**: https://github.com/usdot-jpo-ode/wzdx

### Tools & Validators
- **IFC Viewer (free)**: https://www.ifcviewer.com/
- **IDS Validator**: https://github.com/buildingSMART/IDS
- **V2X Message Validator**: https://www.its.dot.gov/pilots/

### Training
- **ITS PCB (free courses)**: https://www.pcb.its.dot.gov/
- **buildingSMART Certification**: https://www.buildingsmart.org/users/services/certification/

---

## Troubleshooting

### "IFC export fails"
**Check**:
- Required properties present (Name, GlobalId)
- Valid IFC entity types
- Correct property set names
- Relationships properly defined

### "V2X messages not receiving"
**Check**:
- SAE J2735 version match (2016 vs 2020)
- Coordinate system (WGS84 required)
- Message encoding (UPER vs JSON)
- RSU firmware version

### "Data validation errors"
**Check**:
- Required fields per standard
- Data types (string vs number)
- Units (metric vs imperial)
- Enum values (valid options)

---

## Contact for JSTAN Questions

**AASHTO JSTAN Committee**
- Email: jstan@aashto.org
- Chair: Mike Bousliman (Montana DOT)
- Web: https://transportation.org/data/jstan/

**Your State DOT BIM Coordinator**
- Find via: AASHTO member directory
- Or: Contact your state DOT IT department

---

## Grant Scoring Impact Summary

| JSTAN Practice | Typical Score Impact | Applicable Categories |
|----------------|---------------------|----------------------|
| IFC/BIM adoption | +10-15 points | Technical Merit |
| V2X standards compliance | +10-15 points | Technical Merit, Innovation |
| Multi-state interoperability | +10 points | Regional Coordination |
| Open data commitment | +5-10 points | Project Impact |
| IDS validation | +5 points | Quality Assurance |
| Long-term data preservation | +5-10 points | Sustainability |
| **Total Potential** | **+45-65 points** | *Across all categories* |

---

**Pro Tip**: Even if you're not fully JSTAN-compliant yet, **demonstrating awareness and commitment** to these standards in your grant application shows technical sophistication and forward-thinking approach. Mention standards by name and commit to compliance timelines.

---

**Version**: 1.0 | **Last Updated**: December 27, 2025
**Print this page and keep handy when writing grant applications!**

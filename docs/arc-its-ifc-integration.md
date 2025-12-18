![CCAI Logo](/assets/ccai-logo.png)

# ARC-ITS and IFC Integration for Digital Infrastructure

## Overview

This document describes how Industry Foundation Classes (IFC) BIM models integrate with Advanced Regional Center (ARC) Intelligent Transportation Systems (ITS) data to create a comprehensive digital infrastructure platform.

## ARC-ITS Data Sources

ARC-ITS systems typically provide operational data for:

### Traffic Monitoring Devices
- **Detectors/Sensors** - Loop detectors, radar, video detection
- **CCTV Cameras** - Traffic surveillance cameras
- **Weather Stations** - Road weather information systems (RWIS)
- **Travel Time Sensors** - Bluetooth/Wi-Fi readers, probe data

### Traffic Control Devices
- **Traffic Signals** - Signal controllers with SPaT data
- **Ramp Meters** - Freeway entrance ramp control
- **Lane Control Signs** - Overhead lane use signals
- **Dynamic Message Signs (DMS)** - Variable message signs

### Connected Vehicle Infrastructure
- **Roadside Units (RSU)** - V2X communication infrastructure
- **Signal Phase & Timing (SPaT)** - CV-enabled traffic signals
- **Traveler Information Messages** - TIM broadcasts

### Communication Infrastructure
- **Fiber Optic Network** - ITS device connectivity
- **Wireless Communication** - Radio/cellular backhaul
- **Network Switches** - Communications hubs

## Integration Architecture

### IFC Model Layer (Static Infrastructure)
IFC models provide the **physical infrastructure** layer:
- **Geometry & Location** - 3D position, coordinates, elevation
- **Asset Inventory** - Equipment type, manufacturer, model
- **Physical Properties** - Mounting height, orientation, coverage area
- **Lifecycle Data** - Installation date, warranty, condition
- **Spatial Relationships** - Alignment-based positioning (station/offset)

### ARC-ITS Data Layer (Operational)
ARC-ITS provides the **operational data** layer:
- **Real-Time Status** - Device health, online/offline status
- **Live Data Streams** - Traffic counts, speeds, occupancy
- **Control States** - Signal phases, DMS messages, gate positions
- **Alerts & Events** - Malfunctions, maintenance needs
- **Historical Performance** - Uptime statistics, failure rates

### Integration Points

The IFC parser identifies where static BIM data should connect to dynamic ARC-ITS feeds:

| IFC Entity | ARC-ITS Data Feed | Integration Method |
|------------|-------------------|-------------------|
| IFCSENSOR | Traffic detector data (NTCIP 1204) | `device_id` → NTCIP object identifier |
| IFCACTUATOR (DMS) | Message content (NTCIP 1203) | `device_id` → DMS controller ID |
| IFCSIGNAL | SPaT messages (SAE J2735) | `signal_controller_id` → Intersection ID |
| IFCCAMERA | Video stream URL (ONVIF) | `stream_url` property |
| IFCROADSIDEUNIT | CV data feeds (IEEE 1609) | `rsu_id` → SCMS certificate ID |
| IFCWEATHERSTATION | RWIS data (NTCIP 1204) | `station_id` → ESS identifier |

## Enhanced IFC Types for ITS

### Proposed IFC Extensions

The IFC parser should recognize these ARC-ITS equipment types:

```ifc
// Traffic Monitoring
IFCCAMERA (subtype: traffic_surveillance)
IFCTRAFFICSENSOR (replaces generic IFCSENSOR)
IFCWEATHERSTATION
IFCTRAVELTIMESENSOR

// Traffic Control
IFCDYNAMICMESSAGESIGN (subtype of IFCACTUATOR)
IFCRAMPMETER
IFCLANECONTROLSIGN
IFCGATEDENTRY

// Connected Vehicle Infrastructure
IFCROADSIDEUNIT (RSU)
IFCCONNECTEDSIGNAL (SPaT-enabled)
IFCBEACON (Bluetooth/DSRC)

// Communications
IFCFIBEROPTICNETWORK
IFCCOMMUNICATIONSCABINET
IFCNETWORKSWITCH
```

## Required Properties for ARC-ITS Integration

Each IFC entity should include properties that enable connection to ARC-ITS operational data:

### Core Integration Properties

```
device_id: Unique identifier in ARC-ITS asset management system
device_type: Equipment classification (per NTCIP/IEEE standards)
manufacturer: Equipment manufacturer
model_number: Specific device model
firmware_version: Current firmware revision
installation_date: When device was installed
commissioning_date: When device went operational
```

### Network & Communication Properties

```
ip_address: Network IP address (for NTCIP/SNMP devices)
mac_address: Physical network address
communication_protocol: NTCIP, ONVIF, IEEE 1609, SNMP, etc.
data_feed_url: API endpoint for real-time data
control_interface_url: URL for device control
network_segment: Network zone/VLAN
```

### Operational Data Properties

```
current_status: online, offline, maintenance, fault
last_communication: Timestamp of last successful poll
uptime_percentage: Device availability metric
maintenance_schedule: Preventive maintenance interval
critical_spare_parts: Inventory items needed for repairs
calibration_due_date: Next calibration requirement
```

### Spatial Reference Properties

```
station: Linear reference station (along alignment)
offset: Lateral offset from alignment centerline
alignment_reference: Link to IfcAlignment entity
viewing_direction: Camera pan/tilt/zoom (PTZ)
coverage_area: Detection/communication range polygon
```

## Integration Workflow

### 1. IFC Model Upload
```
User uploads IFC model → Parser extracts ITS equipment →
Stores in infrastructure_elements table with:
  - ifc_guid (unique ID)
  - element_type (IFCSENSOR, IFCACTUATOR, etc.)
  - geometry (3D position)
  - properties (manufacturer, model, etc.)
```

### 2. ARC-ITS Device Registration
```
For each IFC element:
  IF device_id property exists:
    Link to existing ARC-ITS asset record
  ELSE:
    Prompt user to map to ARC-ITS device
    OR auto-discover via spatial proximity matching
```

### 3. Real-Time Data Integration
```
For each registered device:
  Poll ARC-ITS data feed (NTCIP/API/SNMP)
  Update operational status in database
  Trigger alerts if status changes
  Display live data overlaid on 3D model
```

### 4. Bidirectional Updates
```
IFC Model Changes → Update ARC-ITS asset database
ARC-ITS Deployments → Update IFC model with new equipment
Field Installations → Synchronize both systems
```

## ARC-ITS Standards Support

### NTCIP (National Transportation Communications for ITS Protocol)

**NTCIP 1203 - Dynamic Message Signs**
- Message content and scheduling
- Display configuration
- Font and character support

**NTCIP 1204 - Environmental Sensor Stations**
- Weather data (temp, precip, visibility)
- Surface conditions (wet, icy, snow)
- Atmospheric conditions (wind, pressure)

**NTCIP 1209 - CCTV Camera Control**
- PTZ (pan/tilt/zoom) positioning
- Preset positions
- Video stream management

**NTCIP 1211 - Signal Control & Prioritization**
- Phase timing data
- Signal preemption/priority
- Coordination patterns

### SAE Standards

**SAE J2735 - Dedicated Short Range Communications (DSRC) Message Set**
- SPaT (Signal Phase and Timing)
- MAP (Intersection geometry)
- TIM (Traveler Information Messages)
- BSM (Basic Safety Messages)

**SAE J3216 - V2X Cooperative Perception**
- Sensor sharing
- Object detection
- Infrastructure sensor data

### IEEE Standards

**IEEE 1512 - Traffic Incident Management**
- Incident detection
- Response coordination
- Lane closure reporting

**IEEE 1609 - WAVE (Wireless Access in Vehicular Environments)**
- RSU communication protocols
- Security credentials management (SCMS)
- V2I messaging

## Example: Traffic Signal Integration

### IFC Model Data
```
#12345 = IFCSIGNAL('2v8K...')
  Properties:
    - signal_controller_id: "INT-001-MAIN-001"
    - intersection_name: "I-80 & US-6"
    - station: "125+45.2"
    - offset: "-12.5 ft"
    - signal_type: "vehicular"
    - num_phases: 8
    - coordination_enabled: true
```

### ARC-ITS Operational Data (NTCIP 1211)
```
GET /api/signals/INT-001-MAIN-001

{
  "controller_id": "INT-001-MAIN-001",
  "current_phase": 2,
  "time_to_change": 15,
  "coordination_pattern": "PM_PEAK",
  "preemption_active": false,
  "detector_faults": [],
  "last_update": "2025-01-15T14:32:15Z",
  "spat_broadcast_enabled": true
}
```

### Integrated View
```
Digital Infrastructure Dashboard displays:
  - 3D model showing signal location from IFC
  - Live phase & timing from ARC-ITS NTCIP feed
  - SPaT data availability for CV applications
  - Detector status and health alerts
  - Station/offset for maintenance crew dispatch
```

## Benefits of Integration

### For Traffic Operations Centers
- **Visual Asset Inventory** - 3D visualization of all ITS equipment
- **Spatial Queries** - "Show all cameras within 1 mile of incident"
- **Maintenance Planning** - Equipment age, condition, replacement schedules
- **Incident Response** - Quick identification of nearby devices

### For Field Maintenance
- **Device Location** - Precise coordinates and station/offset
- **Installation Details** - Mounting specs, power requirements
- **Spare Parts** - Manufacturer, model, compatibility
- **Work History** - Maintenance logs, calibration records

### For Connected Vehicles (V2X)
- **RSU Coverage Maps** - DSRC/C-V2X communication zones
- **SPaT-Enabled Intersections** - Signal timing data availability
- **Infrastructure Sensor Data** - Weather, traffic, hazards
- **Digital Twin** - Real-time infrastructure state for AV planning

### For Digital Twin Applications
- **Real-Time State** - Live operational status overlaid on 3D model
- **Predictive Maintenance** - ML models using operational + physical data
- **What-If Scenarios** - Simulate equipment failures, upgrades
- **Historical Playback** - Replay traffic incidents with infrastructure context

## Implementation in DOT Corridor Communicator

### Database Schema Enhancement

```sql
-- Add ARC-ITS integration fields to infrastructure_elements table
ALTER TABLE infrastructure_elements ADD COLUMN device_id TEXT;
ALTER TABLE infrastructure_elements ADD COLUMN communication_protocol TEXT;
ALTER TABLE infrastructure_elements ADD COLUMN data_feed_url TEXT;
ALTER TABLE infrastructure_elements ADD COLUMN ip_address TEXT;
ALTER TABLE infrastructure_elements ADD COLUMN current_status TEXT;
ALTER TABLE infrastructure_elements ADD COLUMN last_communication TIMESTAMP;
```

### IFC Parser Enhancements

The parser should extract these properties from IFC property sets:
- `Pset_DeviceIdentification` → device_id, manufacturer, model
- `Pset_NetworkConnection` → ip_address, protocol, data_feed_url
- `Pset_OperationalStatus` → current_status, uptime
- `Pset_MaintenanceSchedule` → next_service_date, calibration_due

### API Endpoints

```
GET /api/infrastructure/devices
  - List all ITS equipment from IFC models
  - Include live operational status from ARC-ITS

GET /api/infrastructure/device/:guid/status
  - Real-time status for specific device
  - Poll ARC-ITS data feed on-demand

GET /api/infrastructure/spatial-query?corridor=I-80&station=125+00&radius=1mi
  - Find devices near specific location
  - Return IFC geometry + ARC-ITS operational data

POST /api/infrastructure/device/:guid/link-arc-its
  - Associate IFC element with ARC-ITS device ID
  - Enable bidirectional data sync
```

## Standards Compliance Checklist

### IFC Model Requirements
- [ ] Include IfcSite with geolocation (lat/long or map conversion)
- [ ] Use IfcAlignment for linear infrastructure positioning
- [ ] Include device_id property for each ITS element
- [ ] Specify communication_protocol property (NTCIP, SNMP, etc.)
- [ ] Include data_feed_url for real-time data access
- [ ] Provide manufacturer and model_number for asset management

### ARC-ITS Integration Requirements
- [ ] Device IDs match between IFC and ARC-ITS systems
- [ ] NTCIP Object Identifiers correctly mapped
- [ ] Network addressing (IP/MAC) documented
- [ ] Communication protocols specified
- [ ] Data feed endpoints accessible
- [ ] Security credentials configured (SNMP communities, API keys)

### Operational Requirements
- [ ] Real-time status polling configured
- [ ] Alert thresholds defined for device failures
- [ ] Maintenance schedules synchronized
- [ ] Spatial queries enabled (station/offset, radius searches)
- [ ] Historical data retention policy established
- [ ] Performance metrics tracked (uptime, data quality)

## Future Enhancements

### Machine Learning Integration
- Predict device failures based on operational patterns
- Optimize maintenance schedules using IFC lifecycle data + ARC-ITS performance
- Anomaly detection for unusual device behavior

### Advanced Visualization
- Real-time 3D dashboard with live ARC-ITS data overlays
- Heatmaps showing device health across corridors
- Time-series playback of historical incidents

### Automated Workflows
- Auto-generate work orders when devices go offline
- Synchronize IFC model updates with ARC-ITS deployments
- Alert nearby maintenance crews using geofencing

---

**Document Version:** 1.0
**Last Updated:** 2025-01-15
**Related Documentation:**
- `/docs/data-quality.md` - Event data quality standards
- IFC Parser: `/utils/ifc-parser.js`
- Database Schema: `infrastructure_elements` table

**Standards References:**
- NTCIP Library: https://www.ntcip.org/library/
- SAE Mobility: https://www.sae.org/standards/content/j2735_202309/
- buildingSMART IFC4x3: https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/

#!/usr/bin/env node

/**
 * Populate Sample Network and Telemetry Data
 *
 * This script creates sample data for:
 * 1. Network connections (fiber and radio links between ITS devices)
 * 2. Sensor health telemetry (real-time device health data)
 * 3. Equipment health history (status change events)
 */

const crypto = require('crypto');
const db = require('../database');

// Use crypto.randomUUID() instead of uuid package
const uuidv4 = () => crypto.randomUUID();

console.log('🌐 Populating sample network and telemetry data...\n');

// First, check if we have any ITS equipment to work with
const equipment = db.db.prepare(`
  SELECT id, equipment_type, location_description, latitude, longitude, state_key
  FROM its_equipment
  LIMIT 20
`).all();

if (equipment.length === 0) {
  console.log('⚠️  No ITS equipment found in database.');
  console.log('   Please upload ITS equipment data first or create sample equipment.\n');
  process.exit(0);
}

console.log(`📍 Found ${equipment.length} ITS devices to connect\n`);

// ==========================================
// 1. Create Network Connections
// ==========================================

console.log('🔗 Creating sample network connections...\n');

const connections = [];

// Create fiber backbone between major hubs
// Example: Connect cameras to DMS, RSUs to sensors, etc.
const cameras = equipment.filter(e => e.equipment_type === 'camera');
const dms = equipment.filter(e => e.equipment_type === 'dms');
const rsus = equipment.filter(e => e.equipment_type === 'rsu');
const sensors = equipment.filter(e => e.equipment_type === 'sensor');

// Helper: Calculate distance between two points (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper: Create LineString WKT from two points
function createLineString(lon1, lat1, lon2, lat2) {
  return `LINESTRING(${lon1} ${lat1}, ${lon2} ${lat2})`;
}

// Example 1: Fiber connections between nearby devices (< 5km)
let connectionCount = 0;
for (let i = 0; i < equipment.length; i++) {
  for (let j = i + 1; j < equipment.length; j++) {
    const dev1 = equipment[i];
    const dev2 = equipment[j];

    // Skip if different states
    if (dev1.state_key !== dev2.state_key) continue;

    const distance = calculateDistance(dev1.latitude, dev1.longitude, dev2.latitude, dev2.longitude);

    // Connect devices within 5km via fiber
    if (distance < 5000 && connectionCount < 15) {
      const connectionId = `FIBER-${dev1.state_key}-${connectionCount + 1}`;

      connections.push({
        id: uuidv4(),
        connection_id: connectionId,
        device_from_id: dev1.id,
        device_to_id: dev2.id,
        connection_type: 'fiber',
        connection_subtype: distance < 1000 ? 'multi-mode-fiber' : 'single-mode-fiber',
        is_physical: true,
        is_bidirectional: true,
        is_redundant: false,
        geometry: createLineString(dev1.longitude, dev1.latitude, dev2.longitude, dev2.latitude),
        geometry_type: 'LineString',
        distance_meters: Math.round(distance),
        bandwidth_mbps: 1000, // 1 Gbps
        latency_ms: distance / 200000, // ~200km/ms for fiber
        fiber_type: distance < 1000 ? 'multi-mode' : 'single-mode',
        fiber_strand_count: 12,
        operational_status: 'active',
        health_status: 'healthy',
        owner: 'state_dot',
        installation_date: '2023-01-15',
        data_source: 'sample_data'
      });

      connectionCount++;
    }
  }
}

console.log(`  Adding ${connections.length} fiber connections...`);
connections.forEach(conn => {
  const result = db.addNetworkConnection(conn);
  if (result.success) {
    console.log(`    ✅ ${conn.connection_id}: ${conn.device_from_id.substring(0, 8)} → ${conn.device_to_id.substring(0, 8)} (${Math.round(conn.distance_meters)}m)`);
  }
});

// Example 2: Radio links between RSUs
if (rsus.length >= 2) {
  console.log(`\n  Adding radio links between RSUs...`);
  for (let i = 0; i < Math.min(rsus.length - 1, 5); i++) {
    const rsu1 = rsus[i];
    const rsu2 = rsus[i + 1];
    const distance = calculateDistance(rsu1.latitude, rsu1.longitude, rsu2.latitude, rsu2.longitude);

    const radioConn = {
      id: uuidv4(),
      connection_id: `RADIO-RSU-${i + 1}`,
      device_from_id: rsu1.id,
      device_to_id: rsu2.id,
      connection_type: 'radio',
      connection_subtype: '5.9ghz-dsrc',
      is_physical: false,
      is_bidirectional: true,
      is_redundant: false,
      geometry: createLineString(rsu1.longitude, rsu1.latitude, rsu2.longitude, rsu2.latitude),
      geometry_type: 'LineString',
      distance_meters: Math.round(distance),
      bandwidth_mbps: 27, // DSRC 5.9 GHz
      frequency_mhz: 5900,
      transmit_power_dbm: 20,
      line_of_sight: true,
      operational_status: 'active',
      health_status: 'healthy',
      owner: 'state_dot',
      installation_date: '2024-06-01',
      data_source: 'sample_data'
    };

    const result = db.addNetworkConnection(radioConn);
    if (result.success) {
      console.log(`    ✅ ${radioConn.connection_id}: ${Math.round(distance)}m @ 5.9 GHz`);
    }
  }
}

// Example 3: Cellular backhaul connections
if (sensors.length >= 1) {
  console.log(`\n  Adding cellular backhaul connections...`);
  for (let i = 0; i < Math.min(sensors.length, 3); i++) {
    const sensor = sensors[i];

    // Find a hub device that's not the same as the sensor
    const hub = equipment.find(e => e.id !== sensor.id) || equipment[0];
    if (hub.id === sensor.id) continue; // Skip if can't find a different device

    const cellularConn = {
      id: uuidv4(),
      connection_id: `CELL-SENSOR-${i + 1}`,
      device_from_id: sensor.id,
      device_to_id: hub.id, // Connect to different device as "hub"
      connection_type: 'cellular',
      connection_subtype: '5g',
      is_physical: false,
      is_bidirectional: true,
      is_redundant: true, // Cellular as backup
      geometry: null, // No physical path for cellular
      geometry_type: null,
      distance_meters: null,
      bandwidth_mbps: 100, // 5G bandwidth
      latency_ms: 20,
      operational_status: 'active',
      health_status: 'healthy',
      provider: 'AT&T',
      owner: 'telecom_provider',
      installation_date: '2024-08-15',
      data_source: 'sample_data'
    };

    const result = db.addNetworkConnection(cellularConn);
    if (result.success) {
      console.log(`    ✅ ${cellularConn.connection_id}: 5G @ 100 Mbps`);
    }
  }
}

// ==========================================
// 2. Create Sensor Health Telemetry
// ==========================================

console.log('\n📊 Creating sample sensor health telemetry...\n');

equipment.forEach((device, idx) => {
  // Generate realistic health data based on equipment type
  let telemetry = {
    id: uuidv4(),
    equipment_id: device.id,
    timestamp: new Date().toISOString(),
    operational_status: 'operational',
    is_online: true,
    last_heartbeat: new Date().toISOString(),
    reported_by: 'device_self_report'
  };

  // Randomly make some devices have issues (10% chance)
  const hasIssue = Math.random() < 0.1;

  if (hasIssue) {
    telemetry.operational_status = 'degraded';
    telemetry.health_score = 60 + Math.random() * 20; // 60-80
    telemetry.measurement_error_rate = 5 + Math.random() * 10; // 5-15%
  } else {
    telemetry.health_score = 90 + Math.random() * 10; // 90-100
    telemetry.measurement_error_rate = Math.random() * 2; // 0-2%
  }

  // Equipment type-specific metrics
  switch (device.equipment_type) {
    case 'camera':
      telemetry.video_stream_status = hasIssue ? 'buffering' : 'streaming';
      telemetry.video_bitrate_kbps = hasIssue ? 1500 : 3000;
      telemetry.video_frame_drops = hasIssue ? 50 : 2;
      telemetry.camera_ptz_functional = !hasIssue;
      break;

    case 'sensor':
      telemetry.sensor_readings_per_minute = hasIssue ? 40 : 60;
      telemetry.sensor_data_gaps = hasIssue ? 12 : 0;
      telemetry.sensor_last_vehicle_detected = new Date(Date.now() - Math.random() * 60000).toISOString();
      telemetry.calibration_status = hasIssue ? 'due_soon' : 'current';
      telemetry.calibration_date = '2024-11-01';
      telemetry.calibration_due_date = '2025-11-01';
      break;

    case 'dms':
      telemetry.dms_display_functional = !hasIssue;
      telemetry.dms_message_errors = hasIssue ? 5 : 0;
      telemetry.dms_pixel_failures = hasIssue ? 20 : 0;
      break;

    case 'rsu':
      telemetry.rsu_message_broadcast_count = 500 + Math.floor(Math.random() * 200);
      telemetry.rsu_connected_vehicles = hasIssue ? 5 : 15;
      telemetry.rsu_bsm_received = 800 + Math.floor(Math.random() * 400);
      telemetry.rsu_tim_sent = 50 + Math.floor(Math.random() * 50);
      break;
  }

  // Common metrics for all devices
  telemetry.uptime_hours = 120 + Math.random() * 600; // 5-30 days
  telemetry.uptime_percent_24h = hasIssue ? 85 + Math.random() * 10 : 99 + Math.random();
  telemetry.cpu_usage_percent = 20 + Math.random() * 50;
  telemetry.memory_usage_percent = 40 + Math.random() * 40;
  telemetry.temperature_celsius = 25 + Math.random() * 20;
  telemetry.network_latency_ms = hasIssue ? 50 + Math.random() * 100 : 10 + Math.random() * 20;
  telemetry.data_quality_score = telemetry.health_score;

  // Power metrics
  telemetry.power_source = 'grid';
  telemetry.voltage_volts = 12 + Math.random() * 0.5;
  telemetry.power_consumption_watts = 50 + Math.random() * 100;

  const result = db.addTelemetryData(telemetry);
  if (result.success) {
    const statusEmoji = hasIssue ? '⚠️ ' : '✅';
    console.log(`  ${statusEmoji} ${device.equipment_type.toUpperCase()}: Health ${Math.round(telemetry.health_score)}% - ${telemetry.operational_status}`);
  }
});

// ==========================================
// 3. Create Health History Events
// ==========================================

console.log('\n📜 Creating sample health history events...\n');

// Create a few historical outage events
const sampleOutages = [
  {
    equipment_id: equipment[0].id,
    old_status: 'active',
    new_status: 'inactive',
    status_category: 'connectivity',
    event_type: 'outage',
    severity: 'critical',
    title: 'Fiber cable cut on Highway 80',
    description: 'Construction crew accidentally severed fiber optic cable during roadwork',
    affected_services: JSON.stringify(['video_feed', 'traffic_data']),
    impact_duration_minutes: 240,
    root_cause: 'fiber_cut',
    resolved: true,
    resolved_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    resolved_by: 'technician_j_smith',
    resolution_notes: 'Fiber cable spliced and tested. All services restored.'
  },
  {
    equipment_id: equipment[1]?.id || equipment[0].id,
    old_status: 'active',
    new_status: 'maintenance',
    status_category: 'maintenance',
    event_type: 'maintenance',
    severity: 'warning',
    title: 'Scheduled camera maintenance',
    description: 'Routine cleaning and calibration of PTZ camera',
    affected_services: JSON.stringify(['video_feed']),
    impact_duration_minutes: 30,
    resolved: true,
    resolved_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    resolved_by: 'technician_a_jones',
    resolution_notes: 'Camera cleaned, calibrated, and returned to service'
  }
];

// Add one ongoing issue
if (equipment.length >= 3) {
  sampleOutages.push({
    equipment_id: equipment[2].id,
    old_status: 'active',
    new_status: 'degraded',
    status_category: 'performance',
    event_type: 'status_change',
    severity: 'warning',
    title: 'Sensor reporting intermittent data',
    description: 'Traffic sensor showing 15% error rate in vehicle detection',
    affected_services: JSON.stringify(['traffic_data']),
    root_cause: null,
    resolved: false,
    maintenance_ticket_id: 'TICKET-2026-0014'
  });
}

sampleOutages.forEach((outage, idx) => {
  const eventData = {
    id: uuidv4(),
    ...outage,
    timestamp: outage.resolved_at
      ? new Date(new Date(outage.resolved_at).getTime() - (outage.impact_duration_minutes * 60000)).toISOString()
      : new Date(Date.now() - 3600000).toISOString() // 1 hour ago
  };

  const result = db.addHealthEvent(eventData);
  if (result.success) {
    const resolvedEmoji = outage.resolved ? '✅' : '⚠️ ';
    console.log(`  ${resolvedEmoji} ${outage.title} - ${outage.severity}`);
  }
});

// ==========================================
// Summary
// ==========================================

console.log('\n✅ Sample data populated successfully!\n');

console.log('📊 Summary:');
console.log(`   - Network connections: ${connections.length + (rsus.length >= 2 ? Math.min(rsus.length - 1, 5) : 0) + Math.min(sensors.length, 3)}`);
console.log(`   - Telemetry records: ${equipment.length}`);
console.log(`   - Health events: ${sampleOutages.length}`);

console.log('\n🔍 Test queries:');
console.log('   - View network topology: SELECT * FROM v_network_topology;');
console.log('   - View equipment health: SELECT * FROM v_equipment_health_dashboard;');
console.log('   - View recent outages: SELECT * FROM v_recent_outages;');
console.log('   - Get offline equipment: SELECT * FROM v_equipment_health_dashboard WHERE is_online = 0;\n');

console.log('🌐 API endpoints to test:');
console.log('   - GET /api/network/topology');
console.log('   - GET /api/equipment/health');
console.log('   - GET /api/equipment/{id}/telemetry');
console.log('   - GET /api/equipment/offline\n');

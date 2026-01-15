#!/usr/bin/env node

/**
 * Import Iowa DOT Wireless Network Connections
 *
 * Imports the idot_wireless layer from ITS_Assets geodatabase
 * containing microwave links and other wireless connections between ITS devices
 */

const fs = require('fs');
const crypto = require('crypto');
const db = require('../database');

const GEOJSON_PATH = '/tmp/idot_wireless.geojson';

console.log('🌐 Importing Iowa DOT Wireless Network Connections...\n');

// Read GeoJSON
const geojson = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
console.log(`📂 Loaded ${geojson.features.length} wireless connections from GeoJSON\n`);

// Get all equipment from database to match endpoints
console.log('📡 Loading equipment inventory...');
const equipment = db.db.prepare('SELECT id, location_description, route, latitude, longitude FROM its_equipment').all();
console.log(`   Found ${equipment.length} ITS devices\n`);

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

// Helper: Find equipment by matching endpoint name
function findEquipmentByName(endpointName) {
  // Try exact match in location_description or id
  let match = equipment.find(e =>
    e.id.includes(endpointName) ||
    (e.location_description && e.location_description.includes(endpointName))
  );

  if (match) return match;

  // Try fuzzy match (remove dashes, case insensitive)
  const cleanName = endpointName.replace(/[-_]/g, '').toLowerCase();
  match = equipment.find(e => {
    const cleanId = e.id.replace(/[-_]/g, '').toLowerCase();
    const cleanDesc = (e.location_description || '').replace(/[-_]/g, '').toLowerCase();
    return cleanId.includes(cleanName) || cleanDesc.includes(cleanName);
  });

  return match;
}

// Helper: Convert MultiLineString to WKT
function multiLineStringToWKT(geometry) {
  if (geometry.type === 'MultiLineString') {
    const lines = geometry.coordinates.map(line => {
      const coords = line.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
      return `(${coords})`;
    }).join(', ');
    return `MULTILINESTRING(${lines})`;
  } else if (geometry.type === 'LineString') {
    const coords = geometry.coordinates.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
    return `LINESTRING(${coords})`;
  }
  return null;
}

// Helper: Find nearest equipment to a coordinate
function findNearestEquipment(lat, lon, maxDistanceMeters = 500) {
  let nearest = null;
  let minDist = maxDistanceMeters;

  for (const eq of equipment) {
    if (!eq.latitude || !eq.longitude) continue;
    const dist = calculateDistance(lat, lon, eq.latitude, eq.longitude);
    if (dist < minDist) {
      nearest = eq;
      minDist = dist;
    }
  }

  return { device: nearest, distance: minDist };
}

// Process each connection
let imported = 0;
let skipped = 0;
let errors = [];

console.log('🔗 Processing connections...\n');

geojson.features.forEach((feature, idx) => {
  const props = feature.properties;
  const geom = feature.geometry;

  // Extract endpoint names from location field
  // Format: "Endpoint 1 - HAR01, Endpoint 2 - CBTV06 CBDS18"
  const location = props.location || '';
  const endpointMatches = location.match(/Endpoint\s+\d+\s+-\s+([^,]+)/g);

  if (!endpointMatches || endpointMatches.length < 2) {
    // Try to match by geometry endpoints
    if (geom && geom.coordinates && geom.coordinates.length > 0) {
      const firstLine = geom.coordinates[0];
      if (firstLine.length >= 2) {
        const [startLon, startLat] = firstLine[0];
        const [endLon, endLat] = firstLine[firstLine.length - 1];

        const fromMatch = findNearestEquipment(startLat, startLon, 500);
        const toMatch = findNearestEquipment(endLat, endLon, 500);

        if (fromMatch.device && toMatch.device && fromMatch.device.id !== toMatch.device.id) {
          // Create connection
          const wkt = multiLineStringToWKT(geom);
          const distance = calculateDistance(startLat, startLon, endLat, endLon);

          const connectionData = {
            id: crypto.randomUUID(),
            connection_id: `IDOT-WIRELESS-${idx + 1}`,
            device_from_id: fromMatch.device.id,
            device_to_id: toMatch.device.id,
            connection_type: props.reference === 'Microwave Link' ? 'microwave' : 'radio',
            is_physical: false,
            is_bidirectional: true,
            geometry: wkt,
            geometry_type: geom.type === 'MultiLineString' ? 'MultiLineString' : 'LineString',
            distance_meters: Math.round(distance),
            operational_status: props.status === '2' ? 'active' : 'unknown',
            owner: 'Iowa DOT',
            data_source: 'ITS_Assets_GDB',
            notes: `Matched by proximity: ${Math.round(fromMatch.distance)}m and ${Math.round(toMatch.distance)}m tolerance`
          };

          const result = db.addNetworkConnection(connectionData);
          if (result.success) {
            imported++;
            if (imported <= 5 || imported % 50 === 0) {
              console.log(`  ✅ ${connectionData.connection_id}: ${fromMatch.device.id.substring(0, 15)} → ${toMatch.device.id.substring(0, 15)} (${Math.round(distance)}m)`);
            }
          }
          return;
        } else {
          skipped++;
          if (skipped <= 3) {
            console.log(`  ⏭️  Skipped: Could not match endpoints (from ${Math.round(fromMatch.distance || 999)}m, to ${Math.round(toMatch.distance || 999)}m away)`);
          }
          return;
        }
      }
    }

    skipped++;
    return;
  }

  // Parse endpoint names
  const endpoint1Name = endpointMatches[0].replace(/Endpoint\s+\d+\s+-\s+/, '').trim();
  const endpoint2Name = endpointMatches[1].replace(/Endpoint\s+\d+\s+-\s+/, '').trim();

  // Split multiple device names (e.g., "CBTV06 CBDS18")
  const endpoint1Devices = endpoint1Name.split(/\s+/);
  const endpoint2Devices = endpoint2Name.split(/\s+/);

  // Try to find matching equipment
  const fromDevice = findEquipmentByName(endpoint1Devices[0]);
  const toDevice = findEquipmentByName(endpoint2Devices[0]);

  if (!fromDevice || !toDevice) {
    skipped++;
    if (skipped <= 3) {
      errors.push(`${endpoint1Name} → ${endpoint2Name}: Could not find devices`);
    }
    return;
  }

  if (fromDevice.id === toDevice.id) {
    skipped++;
    return;
  }

  // Convert geometry to WKT
  const wkt = multiLineStringToWKT(geom);

  // Calculate distance
  let distance = props.Shape_Length * 0.3048; // Convert feet to meters
  if (geom && geom.coordinates && geom.coordinates.length > 0) {
    const firstLine = geom.coordinates[0];
    if (firstLine.length >= 2) {
      const [startLon, startLat] = firstLine[0];
      const [endLon, endLat] = firstLine[firstLine.length - 1];
      distance = calculateDistance(startLat, startLon, endLat, endLon);
    }
  }

  // Create connection record
  const connectionData = {
    id: crypto.randomUUID(),
    connection_id: `IDOT-WIRELESS-${idx + 1}`,
    device_from_id: fromDevice.id,
    device_to_id: toDevice.id,
    connection_type: props.reference === 'Microwave Link' ? 'microwave' : 'radio',
    connection_subtype: props.equipmenttype || null,
    is_physical: false,
    is_bidirectional: true,
    is_redundant: false,
    geometry: wkt,
    geometry_type: geom.type === 'MultiLineString' ? 'MultiLineString' : 'LineString',
    distance_meters: Math.round(distance),
    operational_status: props.status === '2' ? 'active' : props.status === '0' ? 'inactive' : 'unknown',
    health_status: 'healthy',
    owner: 'Iowa DOT',
    manufacturer: props.manufacturer || null,
    installation_date: props.installdate || null,
    notes: props.comments || null,
    data_source: 'ITS_Assets_GDB'
  };

  const result = db.addNetworkConnection(connectionData);
  if (result.success) {
    imported++;
    if (imported <= 5 || imported % 50 === 0) {
      console.log(`  ✅ ${connectionData.connection_id}: ${endpoint1Name} → ${endpoint2Name} (${Math.round(distance)}m)`);
    }
  } else {
    errors.push(`${endpoint1Name} → ${endpoint2Name}: ${result.error}`);
  }
});

console.log(`\n📊 Import Summary:`);
console.log(`   ✅ Imported: ${imported} connections`);
console.log(`   ⏭️  Skipped: ${skipped} (no matching equipment)`);
console.log(`   ❌ Errors: ${errors.length}`);

if (errors.length > 0 && errors.length <= 10) {
  console.log(`\n⚠️  Sample Errors:`);
  errors.slice(0, 10).forEach(err => console.log(`   ${err}`));
}

console.log(`\n✅ Import complete! ${imported} wireless connections now visible on map.\n`);

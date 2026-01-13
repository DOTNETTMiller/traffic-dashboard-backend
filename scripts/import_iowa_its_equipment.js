const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', 'states.db');
const db = new Database(dbPath);

console.log('🚀 Starting Iowa ITS Equipment Import...');

// Function to generate unique ID
function generateId(prefix, uniqueKey) {
  const hash = crypto.createHash('md5').update(uniqueKey).digest('hex').substring(0, 8);
  return `${prefix}-${hash}`;
}

// Function to import cameras
function importCameras() {
  console.log('\n📹 Importing Traffic Cameras...');
  const geojsonPath = path.join(__dirname, '..', 'temp', 'iowa_cameras.geojson');
  const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO its_equipment (
      id, state_key, equipment_type, equipment_subtype,
      latitude, longitude, route, milepost,
      arc_its_id, location_description, stream_url, camera_type,
      resolution, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skipped = 0;

  for (const feature of data.features) {
    const props = feature.properties;

    // Skip if no valid coordinates
    if (!props.latitude || !props.longitude) {
      skipped++;
      continue;
    }

    const id = generateId('IA-CAM', props.device_id?.toString() || props.COMMON_ID || props.Desc_);

    const notes = JSON.stringify({
      device_id: props.device_id,
      image_name: props.ImageName,
      image_url: props.ImageURL,
      organization: props.ORG,
      region: props.REGION,
      common_id: props.COMMON_ID,
      recorded: props.RECORDED,
      function: props.FUNCTION,
      type: props.Type,
      video_hb: props.VideoURL_HB,
      video_hd: props.VideoURL_HD
    });

    try {
      insertStmt.run(
        id,                                    // id
        'ia',                                  // state_key
        'camera',                              // equipment_type
        'traffic',                             // equipment_subtype
        parseFloat(props.latitude),            // latitude
        parseFloat(props.longitude),           // longitude
        props.Route || null,                   // route
        props.linear_reference || null,        // milepost
        props.COMMON_ID || props.device_id?.toString() || null,   // arc_its_id
        props.Desc_ || props.ImageName || null, // location_description
        props.VideoURL || null,                // stream_url
        props.Type || 'CCTV',                  // camera_type
        props.resolution || null,              // resolution
        'active',                              // status
        notes                                  // notes
      );
      imported++;
    } catch (err) {
      console.error(`Error importing camera ${id}:`, err.message);
      skipped++;
    }
  }

  console.log(`✅ Imported ${imported} cameras (skipped ${skipped})`);
  return imported;
}

// Function to import DMS signs
function importDMS(active = true) {
  const filename = active ? 'iowa_dms_active.geojson' : 'iowa_dms_inactive.geojson';
  const status = active ? 'active' : 'inactive';

  console.log(`\n🚏 Importing ${active ? 'Active' : 'Inactive'} DMS Signs...`);
  const geojsonPath = path.join(__dirname, '..', 'temp', filename);
  const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO its_equipment (
      id, state_key, equipment_type, equipment_subtype,
      latitude, longitude, route, milepost,
      dms_type, location_description,
      status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skipped = 0;

  for (const feature of data.features) {
    const props = feature.properties;

    // Parse coordinates from lat_/long_ fields
    const lat = parseFloat(props.lat_);
    const lon = parseFloat(props.long_);

    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      skipped++;
      continue;
    }

    const id = generateId('IA-DMS', props.DeviceName || `${lat},${lon}`);

    // Parse milepost from device name (e.g., "@ MM 75.5")
    const mpMatch = props.DeviceName?.match(/MM\s+([\d.]+)/i);
    const milepost = mpMatch ? parseFloat(mpMatch[1]) : null;

    const notes = JSON.stringify({
      direction: props.Direction,
      sign_type: props.SignType,
      sign_height: props.SignHeight,
      sign_width: props.SignWidth,
      edit_date: props.EditDate,
      current_message_text: props.msgtext,
      current_message_html: props.msghtml,
      ntcip_message: props.NTCIP
    });

    try {
      insertStmt.run(
        id,                          // id
        'ia',                        // state_key
        'dms',                       // equipment_type
        active ? 'active' : 'inactive', // equipment_subtype
        lat,                         // latitude
        lon,                         // longitude
        props.Route || null,         // route
        milepost,                    // milepost
        props.SignType || 'Portable-DOT', // dms_type
        props.DeviceName || null,    // location_description
        status,                      // status
        notes                        // notes
      );
      imported++;
    } catch (err) {
      console.error(`Error importing DMS ${id}:`, err.message);
      skipped++;
    }
  }

  console.log(`✅ Imported ${imported} ${active ? 'active' : 'inactive'} DMS signs (skipped ${skipped})`);
  return imported;
}

// Function to import fiber/wireless infrastructure
function importFiber() {
  console.log('\n📡 Importing Fiber/Wireless Infrastructure...');
  const geojsonPath = path.join(__dirname, '..', 'temp', 'iowa_fiber.geojson');
  const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO its_equipment (
      id, state_key, equipment_type, equipment_subtype,
      latitude, longitude, route,
      location_description, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skipped = 0;

  for (const feature of data.features) {
    const props = feature.properties;
    const geom = feature.geometry;

    // For LineString, use the midpoint
    let lat, lon;
    if (geom.type === 'LineString' && geom.coordinates.length > 0) {
      const midIdx = Math.floor(geom.coordinates.length / 2);
      // Convert from Web Mercator to WGS84 if needed
      // These look like Web Mercator, but let's check if there are lat/lon props
      if (props.latitude && props.longitude) {
        lat = parseFloat(props.latitude);
        lon = parseFloat(props.longitude);
      } else {
        // For now, skip MultiLineString as they don't have simple point coords
        skipped++;
        continue;
      }
    } else if (geom.type === 'Point') {
      if (props.latitude && props.longitude) {
        lat = parseFloat(props.latitude);
        lon = parseFloat(props.longitude);
      } else {
        skipped++;
        continue;
      }
    } else {
      skipped++;
      continue;
    }

    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      skipped++;
      continue;
    }

    const id = generateId('IA-FIBER', `${lat},${lon}-${imported}`);

    const notes = JSON.stringify({
      geometry_type: geom.type,
      ...props
    });

    try {
      insertStmt.run(
        id,                                    // id
        'ia',                                  // state_key
        'fiber',                               // equipment_type
        'wireless',                            // equipment_subtype
        lat,                                   // latitude
        lon,                                   // longitude
        props.Route || props.route || null,    // route
        props.description || props.location || 'IDOT Wireless Infrastructure', // location_description
        'active',                              // status
        notes                                  // notes
      );
      imported++;
    } catch (err) {
      console.error(`Error importing fiber ${id}:`, err.message);
      skipped++;
    }
  }

  console.log(`✅ Imported ${imported} fiber/wireless features (skipped ${skipped})`);
  return imported;
}

// Main execution
try {
  let totalImported = 0;

  // Import all equipment types
  totalImported += importCameras();
  totalImported += importDMS(true);   // Active DMS
  totalImported += importDMS(false);  // Inactive DMS
  totalImported += importFiber();

  console.log(`\n🎉 Total equipment imported: ${totalImported}`);

  // Show summary statistics
  const stats = db.prepare(`
    SELECT equipment_type, COUNT(*) as count
    FROM its_equipment
    WHERE state_key = 'ia'
    GROUP BY equipment_type
  `).all();

  console.log('\n📊 Iowa ITS Equipment Summary:');
  stats.forEach(stat => {
    console.log(`   ${stat.equipment_type}: ${stat.count}`);
  });

} catch (error) {
  console.error('❌ Import failed:', error);
  process.exit(1);
} finally {
  db.close();
}

/**
 * CWZ 1.0 / WZDx Device Feed serializer.
 *
 * Emits the connected field devices (arrow boards + portable message signs) and
 * their auto-associated work zones as a Connected Work Zone (CWZ 1.0) Device Feed.
 * CWZ 1.0 (ITE, 2024) is built on the WZDx v4.x Device Feed and maps device data
 * concepts to NTCIP 1218/1203, so this emits the WZDx Device Feed structure with a
 * CWZ profile tag. The device→work-zone link (`road_event_ids`) is exactly the
 * association the device matcher computes.
 *
 * Schema (WZDx v4.2 Device Feed):
 *   { feed_info, type: 'FeatureCollection', features: [FieldDevice...] }
 *   FieldDevice = { id, type:'Feature', properties:{ core_details, ...typeSpecific }, geometry:Point }
 *   ArrowBoard adds `pattern` (ArrowBoardPattern); DynamicMessageSign adds
 *   `message_multi_string` (NTCIP 1203 MULTI).
 */

const DATA_SOURCE_ID = 'iowadot-dms-view';

// FieldDeviceType: arrow-board | dynamic-message-sign (the two we ingest).
function mapDeviceType(d) {
  return d.deviceType === 'arrow-board' ? 'arrow-board' : 'dynamic-message-sign';
}

// Direction enum tokens.
function mapDirection(dir) {
  return ({ N: 'northbound', S: 'southbound', E: 'eastbound', W: 'westbound' })[dir] || null;
}

// FieldDeviceStatus from report freshness (ok | warning | unknown).
function deviceStatus(updated, now) {
  if (!updated) return 'unknown';
  const age = now - Date.parse(updated);
  if (!Number.isFinite(age)) return 'unknown';
  if (age <= 2 * 3600e3) return 'ok';
  if (age <= 24 * 3600e3) return 'warning';
  return 'unknown';
}

// Map an iCone msgtext (e.g. "Left Chevron, sequential", "Double Arrow, flashing",
// "Caution, Four Corner, flashing") to an ArrowBoardPattern enum token.
function mapArrowPattern(msg) {
  if (!msg) return 'blank';
  const t = String(msg).toLowerCase();
  if (/blank|^off$|^none$/.test(t)) return 'blank';
  if (/four\s*corner/.test(t)) return 'four-corners-flashing';
  if (/double\s*arrow|bidirection/.test(t)) return /static/.test(t) ? 'bidirectional-arrow-static' : 'bidirectional-arrow-flashing';
  if (/diamond/.test(t)) return 'diamonds-alternating';
  if (/\bline\b/.test(t)) return 'line-flashing';
  const dir = /left/.test(t) ? 'left' : /right/.test(t) ? 'right' : null;
  const shape = /chevron/.test(t) ? 'chevron' : /arrow/.test(t) ? 'arrow' : null;
  const mod = /sequential/.test(t) ? 'sequential' : /static/.test(t) ? 'static' : 'flashing';
  if (dir && shape) return `${dir}-${shape}-${mod}`;
  return 'unknown';
}

/**
 * Build the CWZ/WZDx Device Feed from the devicesCache ({ devices, links, timestamp }).
 * `now` is injected for testability (defaults to Date.now()).
 */
function buildFeed(devicesCache, opts = {}) {
  const now = opts.now || Date.now();
  const updateDate = opts.updateDate
    || (devicesCache && devicesCache.timestamp ? new Date(devicesCache.timestamp).toISOString() : new Date(now).toISOString());
  const linkByDevice = new Map((devicesCache.links || []).map((l) => [l.device, l]));

  const features = (devicesCache.devices || []).map((d) => {
    const link = linkByDevice.get(d.id);
    const dir = mapDirection(d.direction);
    const core = {
      device_type: mapDeviceType(d),
      data_source_id: DATA_SOURCE_ID,
      device_status: deviceStatus(d.updated, now),
      update_date: d.updated || updateDate,
      has_automatic_location: true,                 // portable units self-report GPS
      name: d.id,
      // THE association — links this device to the work zone it serves.
      road_event_ids: link && link.road_event_id ? [link.road_event_id] : []
    };
    if (dir) core.road_direction = dir;
    if (d.route) core.road_names = [d.route];
    if (d.mode && d.mode.pattern) core.description = `Displaying: ${d.mode.pattern}`;
    // Vendor extensions: how/why the association was made (x_ prefix per WZDx).
    if (link) {
      core.x_match_confidence = link.confidence;
      core.x_match_distance_m = link.distanceM;
      core.x_match_basis = link.reasons;
    }

    const properties = { core_details: core };
    if (core.device_type === 'arrow-board') {
      properties.pattern = mapArrowPattern(d.mode && d.mode.pattern);           // required
      properties.is_in_transport_position = !(d.mode && d.mode.displaying);
    } else {
      // DynamicMessageSign: message_multi_string is the NTCIP 1203 MULTI string.
      properties.message_multi_string = d.ntcip || '';
      if (d.mode && d.mode.pattern) properties.x_message_text = d.mode.pattern;
    }

    return { id: d.id, type: 'Feature', properties, geometry: { type: 'Point', coordinates: d.coordinates } };
  });

  return {
    feed_info: {
      update_date: updateDate,
      publisher: 'Iowa DOT / CCAI',
      version: opts.version || '4.2',            // WZDx base version CWZ 1.0 builds on
      x_cwz_profile: 'CWZ 1.0',                  // Connected Work Zone profile tag
      update_frequency: 300,
      contact_name: 'Matt Miller',
      contact_email: 'matthew.miller@iowadot.us',
      data_sources: [
        { data_source_id: DATA_SOURCE_ID, organization_name: 'Iowa DOT', update_date: updateDate }
      ]
    },
    type: 'FeatureCollection',
    features
  };
}

module.exports = { buildFeed, mapArrowPattern, mapDeviceType, mapDirection, deviceStatus, DATA_SOURCE_ID };

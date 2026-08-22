/**
 * CWZ 1.0 / WZDx RoadEvent feed for CONNECTED work zones.
 *
 * The companion to cwz-device-feed.js: CWZ 1.0 is a RoadEvent feed + a Device feed.
 * This emits the work-zone events that have a confirmed connected field device
 * (event.x_cwz_connected, set by the matcher's annotateEvents) as WZDx
 * WorkZoneRoadEvent features, tagged with the CWZ profile and the device linkage.
 * These are the "elevated" events — a work zone with a live arrow board present is
 * a higher-confidence, connected work zone.
 */

const DATA_SOURCE_ID = 'ccai-corridor-communicator';

function mapDirection(dir) {
  const t = String(dir || '').toLowerCase();
  if (t.startsWith('n')) return 'northbound';
  if (t.startsWith('s')) return 'southbound';
  if (t.startsWith('e')) return 'eastbound';
  if (t.startsWith('w')) return 'westbound';
  return 'unknown';
}

// WZDx VehicleImpact from our event's status/type.
function vehicleImpact(ev) {
  const st = `${ev.roadStatus || ''} ${ev.type || ev.eventType || ''} ${ev.severity || ''}`.toLowerCase();
  if (/closed|full/.test(st)) return 'all-lanes-closed';
  if (/restrict|lane/.test(st)) return 'some-lanes-closed';
  return 'unknown';
}

function geometryFor(ev) {
  const g = ev.geometry;
  if (g && (g.type === 'LineString' || g.type === 'Point') && Array.isArray(g.coordinates) && g.coordinates.length) return g;
  const p = ev.coordinates || (ev.longitude != null ? [ev.longitude, ev.latitude] : null);
  return p ? { type: 'Point', coordinates: p } : null;
}

/**
 * Build a CWZ RoadEvent FeatureCollection from already-elevated events
 * (those with x_cwz_connected). `now` injectable for testing.
 */
function buildFeed(events, opts = {}) {
  const now = opts.now || Date.now();
  const updateDate = opts.updateDate || new Date(now).toISOString();
  const features = [];

  for (const ev of events || []) {
    const geom = geometryFor(ev);
    if (!geom) continue;
    const core = {
      event_type: 'work-zone',
      data_source_id: DATA_SOURCE_ID,
      road_names: [ev.corridor || ev.route].filter(Boolean),
      direction: mapDirection(ev.direction),
      update_date: ev.updated || ev.updated_at || updateDate
    };
    if (ev.description || ev.location) core.description = ev.description || ev.location;
    core.name = ev.id;

    const props = {
      core_details: core,
      vehicle_impact: vehicleImpact(ev),
      start_date: ev.startTime || ev.startDate || updateDate,
      end_date: ev.endTime || ev.endDate || null,
      // A connected device present confirms the zone's start position/activity.
      is_start_position_verified: true,
      // CWZ connection — the elevation payload.
      x_cwz_connected: true,
      x_connection_status: ev.x_connection_status || 'connected',
      x_connected_device_count: ev.x_connected_device_count || (ev.x_connected_devices || []).length,
      x_connected_confidence: ev.x_connected_confidence,
      x_connected_devices: ev.x_connected_devices || []
    };
    features.push({ id: ev.id, type: 'Feature', properties: props, geometry: geom });
  }

  return {
    feed_info: {
      title: 'CCAI Connected Work Zone — RoadEvent Feed (premier, real-time)',
      description: 'Work zones with a confirmed connected field device present (device-verified, '
        + 'elevated). Multi-state. CWZ 1.0 / WZDx v4.2. Each event carries its connected '
        + 'devices and match confidence.',
      update_date: updateDate,
      publisher: 'CCAI (multi-state)',
      version: opts.version || '4.2',
      x_cwz_profile: 'CWZ 1.0',
      x_dataset_tier: 'premier-realtime-connected',
      update_frequency: 300,
      contact_name: 'Matt Miller',
      contact_email: 'matthew.miller@iowadot.us',
      data_sources: [
        { data_source_id: DATA_SOURCE_ID, organization_name: 'CCAI (multi-state)', update_date: updateDate }
      ]
    },
    type: 'FeatureCollection',
    features
  };
}

module.exports = { buildFeed, mapDirection, vehicleImpact };

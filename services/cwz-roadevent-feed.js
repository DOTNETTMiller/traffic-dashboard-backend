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

    // Verification source: device telemetry, camera vision, and/or independent
    // corroboration from a non-DOT source (TomTom construction/closure at the zone).
    const src = [];
    if (ev.x_cwz_connected) src.push('device');
    if (ev.x_camera_verified) src.push('camera');
    if (ev.x_tomtom_corroborated) src.push('tomtom');
    if (ev.x_dms_corroborated) src.push('dms');
    if (ev.x_workers_present) src.push('worker-presence');
    const props = {
      core_details: core,
      vehicle_impact: vehicleImpact(ev),
      start_date: ev.startTime || ev.startDate || updateDate,
      end_date: ev.endTime || ev.endDate || null,
      // Only a PHYSICAL observation at the location verifies a position: a connected device
      // matched to the zone, or a camera that saw it. This was hardcoded `true` for every
      // feature, which made the claim on tomtom-only and dms-only zones too -- and neither
      // verifies a position. TomTom says traffic is behaving like a work zone somewhere near
      // here; a DMS says an operator posted text on a sign up the road. Both corroborate that
      // the zone is REAL and ACTIVE, which is what x_verification is for. Neither says the
      // start point is where the publisher put it.
      // The state builders in frontend/public all emit `false` here, correctly; the aggregated
      // feed was the only thing asserting otherwise, and it is the one FHWA has registered.
      is_start_position_verified: !!(ev.x_cwz_connected || ev.x_camera_verified),
      x_cwz_connected: !!ev.x_cwz_connected,
      x_verification: src,                       // sources corroborating this zone: device / camera / tomtom / dms
      x_verification_count: src.length,          // 1+ — how many INDEPENDENT sources agree (the corroboration signal)
      x_confidence_tier: src.length >= 2 ? 'multi-source' : (src.length === 1 ? 'single-source' : 'unverified'),
      x_connection_status: ev.x_connection_status || (src.length ? 'verified' : 'connected'),
      // Physical connected devices (e.g., arrow boards) matched to the zone — the actual count, which can be
      // 0 even when the zone is otherwise corroborated (camera/TomTom/DMS). Corroboration is x_verification_count.
      x_connected_device_count: ev.x_connected_device_count || (ev.x_connected_devices || []).length,
      x_connected_confidence: ev.x_connected_confidence,
      x_connected_devices: ev.x_connected_devices || []
    };
    // WZDx worker_presence. This is the whole point of ingesting HaulHub: the publishing
    // DOT's own feed leaves this field empty (Iowa: 1096 zones, zero worker_presence), so
    // we COMPLETE it from the contractor's crew check-in and equipment telematics rather
    // than only using it internally to score confidence.
    //
    // Emitted per the spec, not as an x_ extension, so ordinary WZDx consumers get it:
    //   are_workers_present            - only ever true; the source never asserts absence
    //   worker_presence_last_confirmed_date - when the contractor last confirmed it
    //   confidence                     - carried through from the source
    //   method                         - what the observation was made with. The source
    //                                    leaves this empty, and the honest value for
    //                                    equipment/crew telematics is the spec's
    //                                    "wearables-or-mobile-devices"; omitted rather than
    //                                    guessed when the source says nothing.
    // The PUBLISHER's own worker_presence, when the upstream feed carried one. This was being
    // discarded at ingest for every WZDx state -- 9,060 of 33,663 audited work zones (27%)
    // arrive with it, against roughly 333 rows from HaulHub -- so the field this feed exists
    // to complete was already present on a quarter of the zones and thrown away.
    //
    // Emitted FIRST so HaulHub can override it below: HaulHub is a live contractor
    // confirmation with a timestamp, the publisher's flag often is not. Two differences from
    // the HaulHub path matter:
    //   - the publisher CAN assert are_workers_present: false, which HaulHub structurally
    //     never does, and a negative assertion is information. It is passed through as given.
    //   - it is NOT independent corroboration. It rides on the same document as the zone, so
    //     it must not touch x_verification / x_verification_count. Provenance says so plainly.
    if (ev.worker_presence && typeof ev.worker_presence === 'object'
        && ev.worker_presence.are_workers_present !== undefined) {
      props.worker_presence = ev.worker_presence;
      props.x_worker_presence_source = 'publisher';
    }
    // Remaining CWZ 1.0 payload, passed through exactly as published. Absent stays absent --
    // these are observations about a physical work zone and may never be synthesized.
    if (ev.restrictions) props.restrictions = ev.restrictions;
    if (ev.types_of_work) props.types_of_work = ev.types_of_work;
    if (ev.lanes) props.lanes = ev.lanes;
    if (ev.x_stale_source) {
      // Belt and braces: the endpoint filters these out, but if one ever reaches the builder
      // it must not look current. A consumer can then reject it on its own terms.
      props.x_stale_source = true;
      props.x_source_age_days = ev.x_source_age_days ?? null;
    }
    if (ev.x_workers_present) {
      const wp = { are_workers_present: true };
      if (ev.x_worker_presence_confirmed_at) wp.worker_presence_last_confirmed_date = ev.x_worker_presence_confirmed_at;
      if (ev.x_worker_presence_confidence) wp.confidence = ev.x_worker_presence_confidence;
      if (Array.isArray(ev.x_worker_presence_method) && ev.x_worker_presence_method.length) {
        wp.method = ev.x_worker_presence_method;
      }
      props.worker_presence = wp;
      // Provenance: this did NOT come from the DOT that published the zone, and a consumer
      // deciding whether to trust it needs to know that.
      props.x_worker_presence_source = ev.x_worker_presence_source || 'haulhub';
      if (ev.x_haulhub_distance_m != null) props.x_worker_presence_match_m = ev.x_haulhub_distance_m;
      if (ev.x_haulhub_id) props.x_worker_presence_ref = ev.x_haulhub_id;
    }
    if (ev.x_camera_verified) {
      props.x_camera_verified = true;
      props.x_camera_detected = ev.x_camera_detected || [];
      props.x_camera_checked_at = ev.x_camera_checked_at;
      props.x_camera_url = ev.x_camera_url || null;   // the frame the verdict was read from
      props.x_camera_id = ev.x_camera_id || null;
      // 'fixed' = a roadside camera looking at that spot; 'fleet' = a photograph taken by a
      // maintenance truck as it drove past. Both are read by the same model and both validate,
      // but they are different kinds of evidence and the popup has to be able to say which.
      props.x_camera_source = ev.x_camera_source || (String(ev.x_camera_id || '').startsWith('fleet:') ? 'fleet' : 'fixed');
      if (ev.x_camera_truck) props.x_camera_truck = ev.x_camera_truck;
      if (ev.x_camera_distance_m != null) props.x_camera_distance_m = ev.x_camera_distance_m;
    }
    // A photograph taken by a passing maintenance truck. Carried as EVIDENCE, never as a
    // validating source -- it is not counted in x_verification and does not make a zone
    // "validated". A truck driving past proves an image of that place exists; only something
    // that looks at the image can say what is in it.
    if (ev.x_fleet_camera_url) {
      props.x_fleet_camera_url = ev.x_fleet_camera_url;
      props.x_fleet_camera_at = ev.x_fleet_camera_at || null;
      props.x_fleet_camera_distance_m = ev.x_fleet_camera_distance_m ?? null;
      props.x_fleet_camera_route = ev.x_fleet_camera_route || null;
      props.x_fleet_camera_milepost = ev.x_fleet_camera_milepost ?? null;
      props.x_fleet_truck = ev.x_fleet_truck || null;
      // The photo was taken while this closure was in effect — otherwise it is not attached.
      props.x_fleet_camera_in_window = ev.x_fleet_camera_in_window === true;
    }
    if (ev.x_tomtom_corroborated) {
      props.x_tomtom_corroborated = true;
      props.x_tomtom_category = ev.x_tomtom_category || null;   // Road works / Lane closed / Road closed
      props.x_tomtom_distance_m = ev.x_tomtom_distance_m ?? null;
      if (ev.x_tomtom_delay_s != null) props.x_tomtom_delay_s = ev.x_tomtom_delay_s;
    }
    if (ev.x_dms_corroborated) {
      props.x_dms_corroborated = true;
      props.x_dms_message = ev.x_dms_message || null;           // the work-zone text the sign is showing
      props.x_dms_name = ev.x_dms_name || null;                 // sign name / location
      props.x_dms_distance_m = ev.x_dms_distance_m ?? null;
    }
    features.push({ id: ev.id, type: 'Feature', properties: props, geometry: geom });
  }

  // WZDx 4.x names a ROAD EVENT feed's metadata `road_event_feed_info`; `feed_info` is the
  // DEVICE feed's key. This emitted only `feed_info`, so a consumer validating against the
  // RoadEventFeed schema fails before parsing a single event -- and that is how the feed
  // registered with FHWA was being served. Checked against real publishers 2026-09-29: WSDOT's
  // WorkZoneFeed and NE-Compass both carry `road_event_feed_info`, and WSDOT also carries
  // `feed_info` as a back-compat alias; WSDOT's DeviceFeed carries `feed_info` alone. So the
  // correct shape is both keys on the same object, which is what is built below.
  // (Mississippi's work-zone feed emits `feed_info` only -- the same defect, upstream.)
  const feedInfo = {
      title: 'CCAI Connected Work Zone — Validated RoadEvent Feed (premier, real-time)',
      description: 'Validated work zones — each confirmed by at least one independent source: a '
        + 'connected field device, camera AI, TomTom probe data, or a DMS message. Multi-state. '
        + 'CWZ 1.0 / WZDx v4.2. Each event carries its verification sources and, when present, its '
        + 'connected devices and match confidence.',
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
  };
  return {
    road_event_feed_info: feedInfo,
    feed_info: feedInfo,          // back-compat alias, as WSDOT serves it
    type: 'FeatureCollection',
    features
  };
}

module.exports = { buildFeed, mapDirection, vehicleImpact };

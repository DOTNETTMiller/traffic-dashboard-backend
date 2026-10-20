'use strict';

// The repository's GIS importers already populate its_equipment. Adapt those
// rows without treating database edit/upload dates as sensor observations.
function inventoryRecord(row) {
  if (!row || typeof row !== 'object') return row;
  const subtype = String(row.equipment_subtype || '').toLowerCase();
  const type = row.equipment_type === 'sensor' ? subtype === 'rwis' ? 'rwis' : subtype === 'traffic' ? 'detector' : 'sensor' : row.equipment_type || 'unknown';
  return {
    id: row.id, state: String(row.state_key || 'unknown').toUpperCase(),
    deviceType: type, name: row.location_description || row.id,
    route: row.route, direction: null, coordinates: [row.longitude, row.latitude],
    inventory: true, updated: null, mode: { pattern: null, displaying: null },
    inventoryDetails: {
      subtype: row.equipment_subtype || null, reportedStatus: row.status || null,
      manufacturer: row.manufacturer || null, model: row.model || null,
      externalId: row.arc_its_id || null, dataSource: row.data_source || null,
      databaseUpdatedAt: row.updated_at || null, uploadedAt: row.upload_date || null,
      cameraUrl: row.stream_url || null,
      note: 'Asset inventory attributes; status, saved URLs and edit dates do not establish current field state.'
    }
  };
}
module.exports = { inventoryRecord };

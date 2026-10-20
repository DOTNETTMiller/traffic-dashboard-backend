'use strict';
function seedArchitecture(ops) {
  if (ops.mode !== 'training') throw new Error('Synthetic architecture cannot be loaded into a live workspace.');
  if (ops.list('TRAINING', 'architecture-asset').length) return;
  const actor = { id: 'training-fixture-service', agency: 'TRAINING', role: 'system' };
  ops.db.transaction(() => {
    const at = ops.iso();
    ops.recordCollections('TRAINING', [{ sourceId: 'training-detectors', kind: 'traffic', status: 'ok', collectedAt: at, sourceObservedAt: at,
      payload: { synthetic: true, rows: [{ id: 'SIM-DET-01', state: 'TRAINING', kind: 'detector', name: 'Synthetic I-80 detector', route: 'I-80', direction: 'eastbound',
        coordinates: [-93.5687, 41.653], speedMph: 22, flowVph: 900, occupancyPct: 78, observedAt: at, periodSeconds: 30 }] } }]);
    const asset = (name, type, extra = {}) => ops.saveArchitectureAsset(actor, { version: 0, name, type,
      owner: 'Synthetic training agency', location: 'Synthetic I-80 corridor', notes: 'Synthetic demonstration profile; no installed field equipment is asserted.', ...extra });
    const detector = asset('Synthetic I-80 detector', 'detector', { deviceId: 'source:training-detectors:TRAINING:SIM-DET-01:detector',
      manufacturer: 'Training fixture', model: 'Synthetic detector', firmware: 'synthetic-1', analysis: { referenceSpeedMph: 65, segmentLengthMiles: 1 } });
    const signDevice = ops.get('TRAINING', 'device', 'TRAIN-DMS-01');
    const sign = signDevice ? asset('Virtual upstream DMS', 'dms', { deviceId: signDevice.id, protocol: signDevice.protocol || 'unknown' }) : null;
    const cabinet = asset('Synthetic roadside cabinet', 'cabinet');
    const network = asset('Synthetic cabinet switch', 'switch');
    const gateway = asset('Synthetic data gateway', 'gateway');
    const center = asset('Synthetic operations center', 'center');
    for (const [from, to, flow, sourcePort, targetPort] of [
      [detector, cabinet, 'Speed, volume and occupancy observations', 'Sensor output', 'Terminal A'],
      ...(sign ? [[sign, cabinet, 'Controller message and status observations', 'Controller port', 'Terminal B']] : []),
      [cabinet, network, 'Aggregated field observations', 'Patch panel 1', 'Port 1'],
      [network, gateway, 'Collected operational data', 'Uplink 1', 'LAN 1'],
      [gateway, center, 'Normalized observations and source quality', 'API output', 'Collection API']
    ]) ops.saveArchitectureConnection(actor, { version: 0, from: from.id, to: to.id, layer: 'information', medium: to === center ? 'api' : 'ethernet',
      fromPort: sourcePort, toPort: targetPort, flow, protocol: 'unknown', evidenceReference: 'TRAINING-TOPOLOGY-001 · synthetic diagram',
      notes: 'Candidate dependency for rehearsal. No physical wiring or protocol compatibility is established.' });
    ops.audit(actor, 'architecture', 'architecture.synthetic_seeded', { physicalEquipment: false, fieldVerification: false });
  }).immediate();
}
module.exports = { seedArchitecture };

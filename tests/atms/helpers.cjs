const { CHECKS } = require('../../services/atms/readiness');
exports.commission = (ops, installer, supervisor, id) => {
  for (const [checkId] of CHECKS) ops.commission(installer, id, { action: 'check', checkId, note: 'Synthetic test evidence, never field acceptance.', version: ops.get(installer.agency, 'installation', id)?.version || 0 });
  return ops.commission(supervisor, id, { action: 'accept', note: 'Independent synthetic acceptance.', version: ops.get(installer.agency, 'installation', id).version });
};

'use strict';
// Read-only installation checks. Never starts a listener or writes to a sign.
const fs = require('node:fs');
const path = require('node:path');
const { configuredGateway, provisionDevices, names } = require('../../services/atms/bootstrap');
const { loadRoadNetwork } = require('../../services/atms/geometry');
const { Operations } = require('../../services/atms/core');
function inspect(env = process.env) {
  const checks = [], add = (id, ok, detail) => checks.push({ id, ok: !!ok, detail });
  add('mode', env.ATMS_MODE === 'live', 'Use ATMS_MODE=live for an operational installation.');
  add('agency', !!env.ATMS_AGENCY?.trim(), 'Set the agency identifier.');
  add('identity-secret', (env.ATMS_JWT_SECRET || env.JWT_SECRET || '').length >= 32, 'Configure a 32+ character individual-identity JWT secret.');
  const operators = names(env.ATMS_OPERATOR_USERS), supervisors = names(env.ATMS_SUPERVISOR_USERS);
  add('roles', operators.length && supervisors.length && operators.some(id => !supervisors.includes(id)), 'Assign at least one installer/operator and a separate supervisor.');
  let gateway;
  try { gateway = configuredGateway(env); add('gateway', !!gateway, 'Configure an agency HTTPS gateway and independent secret.'); } catch { add('gateway', false, 'Gateway configuration is invalid.'); }
  add('separate-secrets', !!env.ATMS_GATEWAY_SECRET && env.ATMS_GATEWAY_SECRET !== (env.ATMS_JWT_SECRET || env.JWT_SECRET), 'Gateway and identity secrets must differ.');
  add('frontend', fs.existsSync(path.join(__dirname, '../../frontend/dist/atms.html')), 'Build the frontend before installing.');
  try { const network = loadRoadNetwork(env); add('road-network', true, network ? 'Configured agency road catalog is structurally valid; operator review is still required.' : 'No local catalog configured. Source geometry can be preserved; road lookup is unavailable.'); } catch { add('road-network', false, 'The configured agency road catalog or source attribution is invalid.'); }
  try { const { validator, PROFILES } = require('../../services/atms/feed-publisher'); PROFILES.forEach(validator); add('feed-schemas', true, 'Pinned WZDx and CWZ schemas are intact and compile offline.'); } catch { add('feed-schemas', false, 'Install the pinned schema files and validator dependencies.'); }
  const filename = env.ATMS_DB_PATH;
  add('persistent-path', !!filename && path.isAbsolute(filename) && !/^\/(private\/)?tmp\//.test(filename), 'Use an absolute path on persistent storage.');
  let db;
  try {
    if (!filename || !fs.existsSync(filename)) throw new Error('missing');
    add('database-permissions', (fs.statSync(filename).mode & 0o077) === 0, 'Database must be readable and writable only by the service account.');
    const Database = require('better-sqlite3'); db = new Database(filename, { readonly: true, fileMustExist: true });
    add('database-mode', db.prepare('SELECT value FROM atms_meta WHERE key=?').get('mode')?.value === 'live', 'Database must belong to live mode.');
    const ops = Object.create(Operations.prototype); ops.db = db; ops.now = () => Date.now();
    add('audit', ops.verifyAudit(env.ATMS_AGENCY || '').valid, 'Audit hash chain must verify.');
    const devices = ops.list(env.ATMS_AGENCY || '', 'device').filter(d => d.driver === 'gateway' && d.controlEnabled);
    let matching = 0;
    try { provisionDevices({ get: (...args) => ops.get(...args), registerDevice: (agency, d) => { const stored = ops.get(agency, 'device', d.id); if (d.controlEnabled && stored && stored.provisioningRevision === d.provisioningRevision && stored.gatewayRevision === d.gatewayRevision) matching++; } }, env, gateway); } catch { matching = -1; }
    add('device-manifest', !!env.ATMS_DEVICE_CONFIG && devices.length > 0 && matching === devices.length, 'Device manifest and gateway configuration must match the running database. Restart with the new configuration and recommission changes.');
    add('devices', devices.length > 0, 'Provision control devices using ATMS_DEVICE_CONFIG.');
    add('commissioning', devices.length > 0 && devices.every(d => ops.installation(env.ATMS_AGENCY, d).ready), 'Every provisioned device requires current installation acceptance.');
  } catch { add('database', false, 'Initialize the live service database and verify its schema before acceptance.'); }
  finally { db?.close(); }
  return { product: 'PurposeBuilt ATMS', ready: checks.every(c => c.ok), checks, scope: 'Local configuration checks only. Physical controller acceptance, gateway deployment, TLS proxy, backup restore, and agency authorization require the installation procedure.' };
}
if (require.main === module) { const report = inspect(); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.ready ? 0 : 1; }
module.exports = { inspect };

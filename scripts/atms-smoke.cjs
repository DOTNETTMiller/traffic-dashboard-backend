'use strict';
// Exercises only the loopback, visibly synthetic training service. Never use this
// against an agency control endpoint. Records are retained in the training audit.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = new URL(process.env.ATMS_SMOKE_URL || 'http://127.0.0.1:4432');
if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Smoke checks are restricted to a local training service.');
async function call(path, token, body, expected = 200, key = randomUUID()) {
  const response = await fetch(new URL('/api/atms' + path, base), { method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(10000), headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json', 'X-ATMS-Client': 'workspace', 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json(); assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`); return data;
}
async function main() {
  const runtime = await call('/runtime'); assert.equal(runtime.mode, 'training', 'These checks cannot run in live mode.');
  const session = async id => (await call('/training/session', null, { id })).token;
  const operator = await session('training.operator'), supervisor = await session('training.supervisor'), incoming = await session('training.incoming'), observer = await session('training.observer');
  await call('/workspace', null, undefined, 401);
  const input = { title: 'QA TRAINING · End-to-end incident ' + randomUUID().slice(0, 6), route: 'I-80', direction: 'eastbound', latitude: 41.6, longitude: -93.6, severity: 'moderate', sourceKey: 'forged-source', source: { name: 'untrusted' } };
  await call('/incidents', observer, input, 403);
  const key = randomUUID(); let incident = await call('/incidents', operator, input, 200, key);
  assert.equal(incident.sourceKey, null, 'Clients cannot forge source provenance.');
  assert.equal((await call('/incidents', operator, input, 200, key)).id, incident.id);
  await call('/incidents', operator, { ...input, title: 'Different content' }, 409, key);
  const change = async (action, extra = {}) => { incident = await call('/incidents/' + incident.id + '/actions', operator, { action, version: incident.version, note: 'Synthetic QA evidence. No real roadway action.', ...extra }); return incident; };
  await change('claim');
  await call('/incidents/' + incident.id + '/actions', operator, { action: 'note', version: 1, note: 'Stale client request' }, 409);
  await change('transition', { status: 'verified' });
  const geometryPath = '/incidents/' + incident.id + '/geometry';
  await call(geometryPath, observer, { action: 'review', version: incident.version, note: 'Viewer should not edit geometry.' }, 403);
  incident = await call(geometryPath, operator, { action: 'derive', version: incident.version, start: [-93.63, 41.628], end: [-93.48, 41.648], note: 'Synthetic catalog limits only; not field geometry.' });
  assert.equal(incident.geometry.type, 'LineString'); assert.equal(incident.geometryEvidence.status, 'derived');
  incident = await call(geometryPath, operator, { action: 'review', version: incident.version, note: 'Reviewed the synthetic roadway and limits in the training catalog.' });
  assert.equal((await call(geometryPath, observer)).evidence.status, 'operator_reviewed');
  const firstFeedPreview = await call('/feeds/wzdx-4.2/preview', supervisor);
  if (!firstFeedPreview.config) await call('/feeds/settings', supervisor, { version: 0, publisher: 'PurposeBuilt synthetic training', sourceOrganization: 'Synthetic training agency', contactName: 'Training desk', contactEmail: 'training@example.invalid', dataSourceId: 'purposebuilt-training', license: 'https://creativecommons.org/publicdomain/zero/1.0/', updateFrequency: 300 });
  const draft = { version: 0, incidentVersion: incident.version, eventType: 'work-zone', startDate: new Date(Date.now() - 60000).toISOString(), endDate: new Date(Date.now() + 3600000).toISOString(), observedAt: new Date().toISOString(), vehicleImpact: 'some-lanes-closed', locationMethod: 'sign-method', uniformSegmentConfirmed: true, publicDescription: 'SYNTHETIC QA work-zone feed test.', note: 'Synthetic training observations only, never field claims.' };
  await call('/incidents/' + incident.id + '/feed-details', observer, draft, 403);
  await call('/incidents/' + incident.id + '/feed-details', operator, draft);
  for (const profile of ['wzdx-4.2', 'cwz-1.0']) {
    const preview = await call('/feeds/' + profile + '/preview', supervisor);
    assert.ok(preview.rows.find(r => r.incidentId === incident.id).ready, JSON.stringify(preview.rows.find(r => r.incidentId === incident.id).issues));
    await call('/feeds/' + profile + '/publish', operator, { previewHash: preview.previewHash, note: 'Operator cannot publish.' }, 403);
    await call('/feeds/' + profile + '/publish', supervisor, { previewHash: preview.previewHash, allowPartial: true, note: 'Release synthetic test feed; no external transmission.' });
    const feed = await call('/feeds/' + profile + '/geojson', observer);
    assert.equal(feed.x_training, true); assert.ok(feed.features.some(f => f.id === incident.id));
    assert.equal(require('../services/atms/feed-publisher').validator(profile)(feed), true);
  }
  const coordination = await call('/messages', operator, { incidentId: incident.id, to: 'training.incoming', body: 'Synthetic QA: confirm this incident briefing.' });
  await call('/messages/' + coordination.id + '/acknowledge', operator, { version: coordination.version }, 403);
  await call('/messages/' + coordination.id + '/acknowledge', incoming, { version: coordination.version });
  await call('/templates', operator, { title: 'QA wording', message: 'TRAINING ONLY', guidance: 'Synthetic tests only.' }, 403);
  const template = await call('/templates', supervisor, { title: 'QA wording', message: 'TRAINING ONLY\nEXPECT DELAYS', guidance: 'Synthetic tests only.' });
  const command = await call('/commands', operator, { incidentId: incident.id, deviceId: 'TRAIN-DMS-01', templateId: template.id, message: 'UNTRUSTED', reason: 'Automated training workflow check.' });
  assert.equal(command.message, template.message);
  const { CHECKS } = require('../services/atms/readiness');
  let installationVersion = (await call('/workspace', operator)).devices.find(d => d.id === 'TRAIN-DMS-02').installation.record?.version || 0;
  for (const [checkId] of CHECKS) installationVersion = (await call('/devices/TRAIN-DMS-02/installation', operator, { action: 'check', checkId, note: 'Synthetic QA evidence only.', version: installationVersion })).version;
  await call('/devices/TRAIN-DMS-02/installation', supervisor, { action: 'accept', note: 'Independent synthetic acceptance.', version: installationVersion });

  await call('/commands/' + command.id + '/actions', operator, { action: 'approve', version: command.version, note: 'Self approval should fail.' }, 403);
  await call('/commands/' + command.id + '/actions', supervisor, { action: 'approve', version: command.version, note: 'Synthetic message reviewed by separate training identity.' });
  let workspace;
  for (let i = 0; i < 15; i++) {
    workspace = await call('/workspace', operator);
    if (workspace.commands.find(c => c.id === command.id)?.status === 'simulated') break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const completed = workspace.commands.find(c => c.id === command.id);
  assert.equal(completed.status, 'simulated'); assert.equal(completed.verifiedAt, null);
  await call('/gateway/evidence', operator, { commandId: command.id, status: 'readback' }, 503);
  for (const task of incident.tasks.filter(t => t.required)) await change('task', { taskId: task.id, status: 'complete' });
  for (const status of ['responding', 'monitoring', 'resolved', 'closed']) await change('transition', { status });
  await call('/feeds/wzdx-4.2/geojson', observer, undefined, 503);
  const briefing = await call('/shifts', operator, { to: 'training.incoming', note: 'QA briefing: review active training records and unresolved alarms.' });
  await call('/shifts/' + briefing.id + '/accept', supervisor, { version: briefing.version, note: 'Wrong identity must fail.' }, 403);
  await call('/shifts/' + briefing.id + '/accept', incoming, { version: briefing.version, note: 'Reviewed synthetic training priorities.' });
  const report = await call('/incidents/' + incident.id + '/report', operator);
  assert.ok(report.messages.some(m => m.id === coordination.id && m.acknowledgedAt));
  assert.equal(report.incident.status, 'closed'); assert.equal(report.auditIntegrity.valid, true); assert.equal(report.commands[0].status, 'simulated');
  assert.equal((await call('/audit/integrity', observer)).valid, true);
  console.log(JSON.stringify({ result: 'PASS', incident: incident.number, checks: ['pinned-schema feed publication', 'feed invalidation after incident closure', 'geometry derivation and review', 'operator messaging and acknowledgment', 'approved template resolution', 'commissioning API', 'individual auth', 'read-only role', 'provenance protection', 'idempotency', 'concurrency', 'independent approval', 'simulated command evidence', 'gateway boundary', 'required tasks', 'ordered lifecycle', 'shift acceptance', 'report export', 'audit integrity'] }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

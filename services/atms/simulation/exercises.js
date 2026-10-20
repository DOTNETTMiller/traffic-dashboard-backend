'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { randomUUID } = require('node:crypto');
const { Operations, digest } = require('../core');
const { Dispatcher } = require('../dispatcher');
const { TrainingNtcipLab } = require('../ntcip/training-lab');
const { validator } = require('../feed-publisher');
const { SimulatedWorld } = require('./world');

const CATALOG = [
  { id: 'corridor-response', title: 'Crash response and clearance', requirements: ['SIM-01', 'SIM-02', 'SIM-03'], description: 'CAD intake, approved message plan, SNMP readback, responder/recipient acceptance and ordered closure.' },
  { id: 'uncertain-delivery', title: 'Lost acknowledgment and field override', requirements: ['SIM-02', 'SIM-04'], description: 'Lose the activation reply, recover by reading controller state, then detect local override and expiry.' },
  { id: 'shift-handoff', title: 'Operator leaves during an incident', requirements: ['SIM-05'], description: 'Preserve ownership until the named incoming operator accepts. Reject other identities and stale changes.' },
  { id: 'feed-protection', title: 'Feed freshness and geometry changes', requirements: ['SIM-06'], description: 'Publish both pinned work-zone profiles, invalidate changed geometry and withhold expired observations.' },
  { id: 'service-recovery', title: 'Service failure after sign activation', requirements: ['SIM-07'], description: 'Reopen SQLite while the independent controller stays running; reconcile without activating twice.' },
  { id: 'source-failures', title: 'Upstream outage, duplicate and empty data', requirements: ['SIM-08'], description: 'Preserve prior observations through failure, reject duplicate records and flag an empty snapshot.' }
];
const actors = {
  operator: { id: 'training.operator', name: 'Simulated operator', agency: 'TRAINING', role: 'operator' },
  supervisor: { id: 'training.supervisor', name: 'Simulated supervisor', agency: 'TRAINING', role: 'supervisor' },
  incoming: { id: 'training.incoming', name: 'Incoming simulated operator', agency: 'TRAINING', role: 'operator' },
  viewer: { id: 'training.observer', name: 'Simulated observer', agency: 'TRAINING', role: 'viewer' }
};
const NOTE = 'Synthetic exercise evidence only. No physical roadway action.';

async function runExercise(id, { onProgress = () => {} } = {}) {
  if (id === 'all') {
    const startedAt = new Date().toISOString(), start = performance.now(), reports = [];
    for (const exercise of CATALOG) reports.push(await runExercise(exercise.id, { onProgress: progress => onProgress({ ...progress, completed: reports.reduce((n, r) => n + r.checks.length, 0) + progress.completed }) }));
    const report = { id: randomUUID(), specification: { id: 'all', title: 'Complete simulated corridor acceptance suite', requirements: [...new Set(CATALOG.flatMap(c => c.requirements)), 'SIM-09'] }, synthetic: true, physicalInteroperability: 'not tested', startedAt, finishedAt: new Date().toISOString(), wallDurationMs: Math.round(performance.now() - start), result: reports.every(r => r.result === 'passed') ? 'passed' : 'failed', error: reports.filter(r => r.error).map(r => r.specification.id + ': ' + r.error).join('; ') || null, checks: reports.flatMap(r => r.checks.map(c => ({ ...c, exercise: r.specification.id }))), artifact: { exercises: reports }, limitations: reports[0]?.limitations || [] };
    return { ...report, sha256: digest(report) };
  }
  const specification = CATALOG.find(c => c.id === id);
  if (!specification) throw new Error('Unknown exercise.');
  const started = performance.now(), startedAt = new Date().toISOString(), checks = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'purposebuilt-atms-simulation-'));
  const filename = path.join(dir, 'agency.sqlite');
  let clock = Date.now(), ops = new Operations({ filename, mode: 'training', now: () => clock }), lab;
  const world = new SimulatedWorld({ now: () => clock });
  const advance = ms => { clock += ms; };
  const check = (requirement, title, fn) => {
    const before = performance.now();
    const evidence = fn(); // Assertions fail the exercise; never silently skip a check.
    checks.push({ requirement, title, result: 'passed', wallDurationMs: Math.round((performance.now() - before) * 100) / 100, at: ops.iso(), evidence: evidence ?? null });
    onProgress({ check: title, completed: checks.length });
  };
  const change = (incident, action, extra = {}, actor = actors.operator) => ops.changeIncident(actor, incident.id, { version: ops.need('TRAINING', 'incident', incident.id).version, action, note: NOTE, ...extra });
  const makeIncident = () => {
    ops.ingest('TRAINING', world.batch());
    let incident = ops.promoteEvent(actors.operator, 'TRAINING:SIM-' + world.state.scene);
    incident = change(incident, 'claim'); return change(incident, 'transition', { status: 'verified' });
  };
  const request = (incident, input = {}) => ops.createCommand(actors.operator, { incidentId: incident.id, deviceId: 'TRAIN-DMS-01', message: 'CRASH AHEAD\nTWO LANES BLOCKED\nEXPECT DELAYS', ttlMinutes: 10, reason: NOTE, ...input });
  const approve = command => ops.changeCommand(actors.supervisor, command.id, { version: command.version, action: 'approve', note: NOTE });
  const command = id => ops.need('TRAINING', 'command', id);
  let error = null, artifact = {};
  try {
    // Exactly two healthy signs. The existing lab talks to each independent UDP
    // controller. No request-echo dispatcher fallback is used in these exercises.
    for (const [n, longitude] of [[1, -93.63], [2, -93.59]]) ops.registerDevice('TRAINING', { id: `TRAIN-DMS-0${n}`, name: `Synthetic I-80 sign ${n}`, type: 'dms', route: 'I-80', latitude: 41.633, longitude, driver: 'simulator', controlEnabled: true, lines: 3, columns: 18, displayedMessage: '', observedAt: null });
    lab = await new TrainingNtcipLab(ops).start();
    let dispatcher = new Dispatcher(ops, { trainingLab: lab });
    const controller = lab.devices.get('TRAIN-DMS-01').emulator;
    let incident = makeIncident();
    artifact.incidentId = incident.id;
    if (id === 'corridor-response') {
      check('SIM-01', 'CAD source preserves location and geometry', () => {
        assert.equal(incident.sourceKey, 'TRAINING:SIM-crash'); assert.equal(incident.geometry.type, 'LineString');
        assert.deepEqual(world.snapshot().cad[0].lanesBlocked, [1, 2]);
        return { sourceKey: incident.sourceKey, geometry: incident.geometry, cad: world.snapshot().cad[0] };
      });
      const template = ops.saveTemplate(actors.supervisor, { title: 'Synthetic crash response plan wording', message: 'CRASH AHEAD\nTWO LANES BLOCKED\nEXPECT DELAYS', guidance: NOTE });
      const commands = ['TRAIN-DMS-01', 'TRAIN-DMS-02'].map(deviceId => request(incident, { deviceId, templateId: template.id, message: 'untrusted client text' }));
      check('SIM-02', 'Observer and requester cannot approve commands', () => {
        assert.throws(() => ops.createCommand(actors.viewer, { incidentId: incident.id }), e => e.status === 403);
        assert.throws(() => ops.changeCommand(actors.operator, commands[0].id, { action: 'approve', version: commands[0].version, note: NOTE }), e => e.status === 403);
        assert.equal(commands[0].message, template.message);
      });
      commands.forEach(approve); await dispatcher.tick();
      check('SIM-02', 'Two independent controllers display the approved plan', () => {
        for (const c of commands) {
          assert.equal(command(c.id).status, 'simulated'); assert.equal(command(c.id).verifiedAt, null);
          assert.equal(lab.devices.get(c.deviceId).emulator.snapshot().message, template.message);
          assert.equal(lab.devices.get(c.deviceId).emulator.state.activations, 1);
        }
        return commands.map(c => ({ id: c.id, device: c.deviceId, actualController: lab.devices.get(c.deviceId).emulator.snapshot().message, status: command(c.id).status }));
      });
      const assignment = world.dispatch('SIM-RSS-01', incident.id);
      const delivery = world.notify('crash-notice', incident.id, template.message);
      check('SIM-03', 'Recipient delivery and acceptance are separate', () => {
        assert.equal(delivery.acknowledgedAt, null);
        assert.equal(world.acknowledge(delivery.id).acknowledgedAt, ops.iso());
        assert.equal(assignment.incidentId, incident.id);
        world.configure({ notificationFault: 'drop' });
        const dropped = world.notify('dropped-notice', incident.id, 'Synthetic blocked delivery');
        assert.equal(dropped.status, 'undelivered'); assert.throws(() => world.acknowledge(dropped.id), e => e.status === 409);
        return world.snapshot().notifications;
      });
      incident = change(incident, 'transition', { status: 'responding' });
      for (const task of incident.tasks.filter(t => t.required)) incident = change(incident, 'task', { taskId: task.id, status: 'complete' });
      incident = change(incident, 'transition', { status: 'monitoring' });
      const blanks = ['TRAIN-DMS-01', 'TRAIN-DMS-02'].map(deviceId => request(incident, { deviceId, operation: 'blank', message: '' }));
      blanks.forEach(approve); await dispatcher.tick();
      incident = change(incident, 'transition', { status: 'resolved' }); incident = change(incident, 'transition', { status: 'closed' });
      check('SIM-01', 'Ordered closure follows independently observed blank displays', () => {
        assert.equal(incident.status, 'closed');
        for (const { emulator } of lab.devices.values()) assert.equal(emulator.snapshot().message, '');
        return { incidentStatus: incident.status, signsBlank: true };
      });
    } else if (id === 'uncertain-delivery') {
      controller.setFault('lost-ack'); const c = request(incident); approve(c); await dispatcher.tick();
      check('SIM-04', 'Lost reply preserves an uncertain command outcome', () => {
        assert.equal(command(c.id).status, 'unknown'); assert.equal(controller.state.activations, 1);
        assert.equal(controller.snapshot().message, c.message); return { status: command(c.id).status, activations: controller.state.activations };
      });
      controller.setFault('healthy'); await dispatcher.tick();
      check('SIM-04', 'Readback reconciliation does not resend activation', () => {
        assert.equal(command(c.id).status, 'simulated'); assert.equal(controller.state.activations, 1);
      });
      const observedAt = ops.need('TRAINING', 'device', c.deviceId).observedAt;
      controller.setFault('offline'); advance(1000); await dispatcher.tick();
      check('SIM-04', 'Disconnected controller cannot supply fresh display confirmation', () => {
        assert.equal(command(c.id).status, 'unknown');
        assert.equal(ops.need('TRAINING', 'device', c.deviceId).observedAt, observedAt);
        assert.equal(controller.state.activations, 1);
      });
      controller.setFault('healthy'); await dispatcher.tick();
      controller.override(); await dispatcher.tick();
      check('SIM-04', 'Local override removes prior confirmation', () => {
        assert.equal(command(c.id).status, 'unknown'); assert.equal(ops.need('TRAINING', 'device', c.deviceId).displayedMessage, 'LOCAL OVERRIDE');
      });
      controller.reset(); await dispatcher.tick();
      controller.setFault('validation'); const rejected = request(incident); approve(rejected); await dispatcher.tick();
      check('SIM-02', 'Controller validation refusal cannot report success', () => { assert.equal(command(rejected.id).status, 'failed'); assert.equal(controller.snapshot().message, ''); });
      controller.setFault('healthy'); const expiring = request(incident, { ttlMinutes: 1 }); approve(expiring); await dispatcher.tick();
      advance(61000); await dispatcher.tick();
      check('SIM-04', 'Controller independently expires the displayed message', () => {
        assert.equal(controller.snapshot().message, ''); assert.equal(command(expiring.id).status, 'cleared');
      });
    } else if (id === 'shift-handoff') {
      incident = change(incident, 'offer_handoff', { to: actors.incoming.id });
      check('SIM-05', 'Offered handoff leaves the original owner responsible', () => {
        assert.equal(incident.owner.id, actors.operator.id);
        assert.throws(() => change(incident, 'accept_handoff', {}, actors.supervisor), e => e.status === 403);
      });
      const staleVersion = incident.version;
      incident = change(incident, 'accept_handoff', {}, actors.incoming);
      check('SIM-05', 'Named incoming operator accepts; previous owner loses write authority', () => {
        assert.equal(incident.owner.id, actors.incoming.id);
        assert.throws(() => change(incident, 'note'), e => e.status === 403);
        assert.throws(() => ops.changeIncident(actors.incoming, incident.id, { version: staleVersion, action: 'note', note: NOTE }), e => e.status === 409);
      });
      const briefing = ops.createHandoff(actors.operator, { to: actors.incoming.id, note: NOTE });
      check('SIM-05', 'Shift briefing requires recipient acceptance', () => {
        assert.throws(() => ops.acceptShift(actors.supervisor, briefing.id, { version: briefing.version, note: NOTE }), e => e.status === 403);
        assert.equal(ops.acceptShift(actors.incoming, briefing.id, { version: briefing.version, note: NOTE }).acceptedBy, actors.incoming.id);
      });
    } else if (id === 'feed-protection') {
      world.configure({ scene: 'work-zone' }); incident = makeIncident(); artifact.incidentId = incident.id;
      incident = ops.changeGeometry(actors.operator, incident.id, { action: 'review', version: incident.version, note: NOTE });
      ops.saveFeedConfig(actors.supervisor, { version: 0, publisher: 'Synthetic agency', sourceOrganization: 'Synthetic agency', contactName: 'Training desk', contactEmail: 'simulation@example.invalid', dataSourceId: 'simulation-only', license: 'https://creativecommons.org/publicdomain/zero/1.0/', updateFrequency: 300 });
      ops.saveFeedDetails(actors.operator, incident.id, { version: 0, incidentVersion: incident.version, eventType: 'work-zone', startDate: new Date(clock - 60000).toISOString(), endDate: new Date(clock + 3600000).toISOString(), observedAt: ops.iso(), vehicleImpact: 'some-lanes-closed', locationMethod: 'sign-method', uniformSegmentConfirmed: true, note: NOTE });
      const release = profile => { const preview = ops.previewFeed(actors.supervisor, profile); return ops.publishFeed(actors.supervisor, profile, { previewHash: preview.previewHash, allowPartial: true, note: NOTE }); };
      for (const profile of ['wzdx-4.2', 'cwz-1.0']) release(profile);
      check('SIM-06', 'Both pinned feed profiles validate and remain explicitly synthetic', () => {
        for (const profile of ['wzdx-4.2', 'cwz-1.0']) {
          const feed = ops.publishedFeed('TRAINING', profile).feed;
          assert.equal(validator(profile)(feed), true); assert.equal(feed.x_training, true); assert.equal(feed.features.length, 1);
        }
      });
      advance(1000); world.configure({ sourceFault: 'geometry-change' }); ops.ingest('TRAINING', world.batch());
      check('SIM-06', 'Changed upstream geometry invalidates released snapshots', () => {
        for (const profile of ['wzdx-4.2', 'cwz-1.0']) assert.throws(() => ops.publishedFeed('TRAINING', profile), e => e.status === 503);
      });
      world.configure({ sourceFault: 'healthy' }); advance(1000); ops.ingest('TRAINING', world.batch());
      for (const profile of ['wzdx-4.2', 'cwz-1.0']) release(profile);
      advance(16 * 60000);
      check('SIM-06', 'Expired publication and stale source remain unavailable', () => {
        assert.ok(ops.alarms('TRAINING').some(a => a.id === 'source:stale'));
        for (const profile of ['wzdx-4.2', 'cwz-1.0']) assert.throws(() => ops.publishedFeed('TRAINING', profile), e => e.status === 503);
      });
    } else if (id === 'service-recovery') {
      const c = request(incident); approve(c);
      const dispatched = ops.takeDispatches()[0];
      await lab.execute(dispatched.command, dispatched.device); // kill point: after activation, before ATMS evidence commit
      const before = controller.state.activations;
      ops.close(); ops = new Operations({ filename, mode: 'training', now: () => clock }); lab.ops = ops;
      dispatcher = new Dispatcher(ops, { trainingLab: lab });
      check('SIM-07', 'Restart marks an in-flight command uncertain', () => { assert.equal(command(c.id).status, 'unknown'); assert.equal(controller.snapshot().message, c.message); });
      await dispatcher.tick(); await dispatcher.tick();
      check('SIM-07', 'Persistent journal and controller readback prevent duplicate activation', () => {
        assert.equal(command(c.id).status, 'simulated'); assert.equal(controller.state.activations, before); assert.equal(before, 1);
        return { activationsBeforeRestart: before, activationsAfterRestart: controller.state.activations, recoveredStatus: command(c.id).status };
      });
    } else if (id === 'source-failures') {
      const prior = ops.get('TRAINING', 'source', 'corridor-communicator');
      world.configure({ sourceFault: 'outage' });
      check('SIM-08', 'Upstream failure retains the last observation timestamp', () => {
        assert.throws(() => world.batch(), e => e.status === 503);
        assert.equal(ops.get('TRAINING', 'source', prior.id).observedAt, prior.observedAt);
      });
      advance(1000); world.configure({ sourceFault: 'duplicate' }); const duplicate = ops.ingest('TRAINING', world.batch());
      check('SIM-08', 'Duplicate source IDs do not create duplicate operator incidents', () => {
        assert.equal(duplicate.rejected, 1); assert.equal(duplicate.events, 1);
        assert.equal(ops.promoteEvent(actors.operator, 'TRAINING:SIM-crash').id, incident.id);
      });
      advance(1000); world.configure({ sourceFault: 'empty' }); ops.ingest('TRAINING', world.batch());
      check('SIM-08', 'Empty source flags coverage without resolving an operator incident', () => {
        assert.ok(ops.alarms('TRAINING').some(a => a.id === 'source:empty'));
        assert.equal(ops.need('TRAINING', 'incident', incident.id).status, 'verified');
        assert.equal(ops.need('TRAINING', 'event', 'TRAINING:SIM-crash').present, false);
      });
    }
    check('SIM-09', 'Retained operational audit chain is internally consistent', () => { const integrity = ops.verifyAudit('TRAINING'); assert.equal(integrity.valid, true); return integrity; });
  } catch (e) {
    error = e.message;
    checks.push({ requirement: specification.requirements.join(', '), title: 'Exercise stopped at unmet expectation', result: 'failed', error: e.message, at: ops.iso() });
  } finally {
    try {
      artifact = { ...artifact, incident: artifact.incidentId ? ops.get('TRAINING', 'incident', artifact.incidentId) : null,
        commands: ops.list('TRAINING', 'command'), world: world.snapshot(), audit: ops.timeline('TRAINING', null, 1000).reverse(), auditIntegrity: ops.verifyAudit('TRAINING'),
        controllers: lab ? [...lab.devices].map(([deviceId, { emulator }]) => ({ deviceId, ...emulator.snapshot() })) : [] };
    } finally { await lab?.close(); ops.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  }
  const report = { id: randomUUID(), specification: { ...specification }, synthetic: true, physicalInteroperability: 'not tested',
    clock: 'Controlled scenario time; wall duration measured separately', startedAt, finishedAt: new Date().toISOString(),
    wallDurationMs: Math.round(performance.now() - started), result: error ? 'failed' : 'passed', error, checks, artifact,
    limitations: ['Synthetic camera illustrations, not recorded/live camera interoperability.', 'CAD, responders and notification recipients are local models; no external delivery.', 'Service recovery reopens the application database while emulated controllers stay running.', 'No hardware commissioning, enterprise certification, field detection accuracy or agency reference is established.'] };
  return { ...report, sha256: digest(report) };
}
module.exports = { CATALOG, actors, runExercise };

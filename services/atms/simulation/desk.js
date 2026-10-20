'use strict';
const { randomUUID } = require('node:crypto');
const { Fault, requireRole, digest } = require('../core');
const { SimulatedWorld, SCENES, SOURCE_FAULTS } = require('./world');
const { CATALOG, runExercise } = require('./exercises');

class SimulationDesk {
  constructor(ops, { execute = runExercise } = {}) {
    if (ops.mode !== 'training') throw new Error('Simulation desk is restricted to training workspaces.');
    this.ops = ops; this.execute = execute; this.busy = false; this.pending = null;
    if (!ops.get('TRAINING', 'simulation-world', 'corridor')) this.saveWorld(new SimulatedWorld({ now: () => ops.now() }));
    for (const run of ops.list('TRAINING', 'simulation-run').filter(r => r.status === 'running')) {
      ops.put('TRAINING', 'simulation-run', { ...run, status: 'interrupted', finishedAt: ops.iso(), error: 'Service stopped before this exercise completed. No passing result is asserted.' }, run.version);
      ops.audit(ops.system('TRAINING'), run.id, 'simulation.interrupted');
    }
  }
  guard(actor, role = 'viewer') {
    requireRole(actor, role);
    if (actor.agency !== 'TRAINING' || this.ops.mode !== 'training') throw new Fault(403, 'Only the local synthetic agency can use simulation.');
  }
  world() { return new SimulatedWorld({ now: () => this.ops.now(), state: this.ops.need('TRAINING', 'simulation-world', 'corridor').state }); }
  saveWorld(world, expected) { return this.ops.put('TRAINING', 'simulation-world', { id: 'corridor', state: world.state }, expected); }
  batch() {
    const world = this.world(), batch = world.batch(), snapshot = world.snapshot();
    return { ...batch, collections: [
      { sourceId: 'corridor-events', kind: 'events', status: batch.events.length ? 'ok' : 'empty', collectedAt: batch.observedAt, sourceObservedAt: batch.observedAt, payload: { events: batch.events, synthetic: true } },
      { sourceId: 'training-detectors', kind: 'traffic', status: 'ok', collectedAt: batch.observedAt, sourceObservedAt: batch.observedAt,
        payload: { synthetic: true, rows: snapshot.detectors.map(d => ({ ...d, state: 'TRAINING', kind: 'detector', occupancyPct: d.occupancyPercent,
          coordinates: require('./road-alignment').station(d.route, d.direction, .5) })) } }
    ] };
  }
  snapshot(actor) {
    this.guard(actor);
    const record = this.ops.need('TRAINING', 'simulation-world', 'corridor');
    return { ...this.world().snapshot(), version: record.version, scenes: SCENES, sourceFaults: SOURCE_FAULTS,
      catalog: CATALOG, busy: this.busy,
      runs: this.ops.list('TRAINING', 'simulation-run').slice(0, 25).map(({ report, ...r }) => r) };
  }
  change(actor, input) {
    this.guard(actor, 'operator');
    const current = this.ops.need('TRAINING', 'simulation-world', 'corridor');
    if (input.version !== current.version) throw new Fault(409, 'The simulated agency changed. Refresh before applying another action.');
    const world = this.world();
    if (input.action === 'configure') world.configure(input);
    else if (input.action === 'notify') {
      this.ops.need('TRAINING', 'incident', input.incidentId);
      world.notify(randomUUID(), input.incidentId, input.message);
    } else if (input.action === 'acknowledge') world.acknowledge(input.messageId);
    else if (input.action === 'dispatch') {
      this.ops.need('TRAINING', 'incident', input.incidentId); world.dispatch('SIM-RSS-01', input.incidentId);
    } else throw new Fault(400, 'Choose a supported simulated agency action.');
    this.saveWorld(world, input.version);
    this.ops.audit(actor, 'simulation-world', 'simulation.' + input.action, { scene: world.state.scene, sourceFault: world.state.sourceFault, incidentId: input.incidentId || null });
    return this.snapshot(actor);
  }
  start(actor, input, key) {
    this.guard(actor, 'operator');
    let fresh = false;
    const result = this.ops.mutation(actor, key, 'simulation.exercise', input, () => {
      if (this.busy) throw new Fault(409, 'An isolated exercise is already running.');
      if (input.exercise !== 'all' && !CATALOG.some(c => c.id === input.exercise)) throw new Fault(400, 'Choose an exercise from the catalog.');
      if (this.ops.list('TRAINING', 'simulation-run').length >= 200) throw new Fault(409, 'This training workspace has retained 200 runs. Archive reports and use a new training database.');
      const run = this.ops.put('TRAINING', 'simulation-run', { id: randomUUID(), exercise: input.exercise, requestedBy: actor.id, startedAt: this.ops.iso(), status: 'running', completed: 0, report: null });
      this.ops.audit(actor, run.id, 'simulation.started', { exercise: input.exercise, isolated: true });
      fresh = true; return { id: run.id, status: run.status };
    });
    if (fresh) {
      this.busy = true;
      this.pending = this.finish(result.id, input.exercise);
    }
    return result;
  }
  async finish(id, exercise) {
    try {
      const report = await this.execute(exercise, { onProgress: ({ check, completed }) => {
        const run = this.ops.need('TRAINING', 'simulation-run', id);
        this.ops.put('TRAINING', 'simulation-run', { ...run, completed, currentCheck: check }, run.version);
      } });
      const run = this.ops.need('TRAINING', 'simulation-run', id);
      this.ops.put('TRAINING', 'simulation-run', { ...run, status: report.result, completed: report.checks.length, finishedAt: this.ops.iso(), report, sha256: report.sha256, error: report.error }, run.version);
      this.ops.audit(this.ops.system('TRAINING'), id, 'simulation.completed', { result: report.result, sha256: report.sha256 });
    } catch (e) {
      const run = this.ops.need('TRAINING', 'simulation-run', id);
      this.ops.put('TRAINING', 'simulation-run', { ...run, status: 'failed', finishedAt: this.ops.iso(), error: String(e.message).slice(0, 1000) }, run.version);
      this.ops.audit(this.ops.system('TRAINING'), id, 'simulation.failed', { error: String(e.message).slice(0, 1000) });
    } finally { this.busy = false; this.pending = null; }
  }
  report(actor, id) {
    this.guard(actor);
    const run = this.ops.need('TRAINING', 'simulation-run', id);
    if (!run.report) throw new Fault(409, run.status === 'running' ? 'The exercise is still running.' : 'This run did not produce a complete report.');
    const { sha256, ...report } = run.report;
    if (digest(report) !== sha256) throw new Fault(409, 'Stored exercise report failed its integrity check.');
    return run.report;
  }
  async close() { await this.pending; }
}
module.exports = { SimulationDesk };

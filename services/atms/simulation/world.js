'use strict';
const { Fault } = require('../core');
const { road, station, affectedGeometry, signLocations } = require('./road-alignment');

const SCENES = ['crash', 'work-zone', 'storm', 'clear'];
const SOURCE_FAULTS = ['healthy', 'outage', 'empty', 'duplicate', 'geometry-change'];
const clone = value => JSON.parse(JSON.stringify(value));
// This is an external simulated agency, not a projection of requested ATMS state.
// CAD, sensors, camera and recipient state change only through this model's inputs.
class SimulatedWorld {
  constructor({ now = Date.now, state } = {}) {
    this.now = now;
    this.state = state ? clone(state) : {
      scene: 'crash', sourceFault: 'healthy', cameraOffline: false,
      preset: 'incident', notificationFault: 'healthy', notifications: [], assignments: [],
      observationStartedAt: new Date(now()).toISOString()
    };
  }
  configure(input) {
    for (const [key, values] of [['scene', SCENES], ['sourceFault', SOURCE_FAULTS], ['preset', ['upstream', 'incident', 'downstream']], ['notificationFault', ['healthy', 'drop']]]) {
      if (input[key] !== undefined) {
        if (!values.includes(input[key])) throw new Fault(400, 'Unsupported simulation ' + key + '.');
        this.state[key] = input[key];
      }
    }
    if (input.cameraOffline !== undefined) {
      if (typeof input.cameraOffline !== 'boolean') throw new Fault(400, 'Camera offline must be a boolean.');
      this.state.cameraOffline = input.cameraOffline;
    }
  }
  snapshot() {
    const at = new Date(this.now()).toISOString(), congested = this.state.scene !== 'clear';
    const [cameraLon, cameraLat] = station('I-80', 'eastbound', .56);
    const [responderLon, responderLat] = station('I-80', 'eastbound', .43);
    return {
      synthetic: true, at, scene: this.state.scene, sourceFault: this.state.sourceFault,
      road: clone(road), signLocations: clone(signLocations), affectedGeometry: this.state.scene === 'clear' ? null : affectedGeometry(),
      cameras: [{ id: 'SIM-CAM-01', name: 'Synthetic I-80 traffic camera', latitude: cameraLat, longitude: cameraLon,
        preset: this.state.preset, online: !this.state.cameraOffline, frameAt: this.state.cameraOffline ? null : at,
        media: 'procedural traffic illustration; no recorded or live roadway video', phase: Math.floor(this.now() / 1000) % 30 }],
      detectors: [
        { id: 'SIM-DET-01', route: 'I-80', direction: 'eastbound', speedMph: congested ? 18 : 62, occupancyPercent: congested ? 81 : 22, observedAt: at },
        { id: 'SIM-DET-02', route: 'I-35', direction: 'southbound', speedMph: 58, occupancyPercent: 29, observedAt: at }
      ],
      weather: { id: 'SIM-RWIS-01', condition: this.state.scene === 'storm' ? 'heavy rain' : 'dry', visibilityMiles: this.state.scene === 'storm' ? 0.4 : 10, observedAt: at },
      cad: this.state.scene === 'clear' ? [] : [{ id: 'SIM-CAD-' + this.state.scene, type: this.state.scene, route: 'I-80', direction: 'eastbound', lanesBlocked: this.state.scene === 'storm' ? [] : [1, 2], location: station('I-80', 'eastbound', .72), receivedAt: this.state.observationStartedAt }],
      responders: [{ id: 'SIM-RSS-01', latitude: responderLat, longitude: responderLon, duty: 'on duty', assignment: this.state.assignments.at(-1) || null }],
      notifications: clone(this.state.notifications), notificationFault: this.state.notificationFault
    };
  }
  batch() {
    if (this.state.sourceFault === 'outage') throw new Fault(503, 'Simulated upstream source is disconnected. Last observations are retained.');
    const at = new Date(this.now()).toISOString();
    const coordinates = affectedGeometry().coordinates;
    if (this.state.sourceFault === 'geometry-change') coordinates[0][0] += 0.005;
    const events = this.state.scene === 'clear' || this.state.sourceFault === 'empty' ? [] : [{
      id: 'SIM-' + this.state.scene, state: 'TRAINING', corridor: 'I-80', direction: 'eastbound',
      eventType: this.state.scene === 'crash' ? 'incident' : 'closure', severity: 'major',
      description: 'SIMULATION · ' + ({ crash: 'Crash blocks two eastbound lanes', 'work-zone': 'Planned eastbound work zone', storm: 'Heavy rain and reduced visibility' }[this.state.scene]),
      latitude: coordinates[0][1], longitude: coordinates[0][0], geometry: { type: 'LineString', coordinates },
      geometrySource: 'Iowa DOT All Routes alignment · simulated affected limits', updated: at
    }];
    if (events.length && this.state.sourceFault === 'duplicate') events.push(clone(events[0]));
    return { observedAt: at, sourceName: 'Simulated agency CAD and traffic observations', events };
  }
  dispatch(unit, incidentId) {
    if (unit !== 'SIM-RSS-01' || typeof incidentId !== 'string' || !incidentId) throw new Fault(400, 'Use the simulated responder and an incident ID.');
    const assignment = { unit, incidentId, acceptedAt: new Date(this.now()).toISOString(), synthetic: true };
    this.state.assignments.push(assignment); this.state.assignments = this.state.assignments.slice(-30);
    return assignment;
  }
  notify(id, incidentId, body) {
    const existing = this.state.notifications.find(n => n.id === id);
    if (existing) {
      if (existing.incidentId !== incidentId || existing.body !== body) throw new Fault(409, 'Notification ID reused with a different payload.');
      return clone(existing);
    }
    if (typeof body !== 'string' || !body.trim() || body.length > 1000) throw new Fault(400, 'Provide a bounded notification message.');
    const result = { id, incidentId, body, recipient: 'SIM-DUTY-DESK', sentAt: new Date(this.now()).toISOString(),
      status: this.state.notificationFault === 'drop' ? 'undelivered' : 'delivered', acknowledgedAt: null, synthetic: true };
    this.state.notifications.push(result); this.state.notifications = this.state.notifications.slice(-30);
    return clone(result);
  }
  acknowledge(id) {
    const n = this.state.notifications.find(n => n.id === id);
    if (!n) throw new Fault(404, 'Simulated recipient message not found.');
    if (n.status !== 'delivered') throw new Fault(409, 'The recipient cannot acknowledge an undelivered message.');
    n.acknowledgedAt ||= new Date(this.now()).toISOString(); return clone(n);
  }
}
module.exports = { SimulatedWorld, SCENES, SOURCE_FAULTS };

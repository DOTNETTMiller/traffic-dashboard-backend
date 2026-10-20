import { useEffect, useState } from 'react';

import { request } from './api';

const endpoints = geometry => {
  if (!geometry) return [];
  if (geometry.type === 'Point') return [geometry.coordinates];
  const coords = geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates.flat();
  return [coords[0], coords.at(-1)];
};
export default function GeometryReview({ incident, source: initialSource, sourceAt, network, canWrite, disabled, perform }) {
  const ends = endpoints(incident.geometry);
  const [source, setSource] = useState(initialSource);
  useEffect(() => {
    let active = true;
    request('/incidents/' + incident.id + '/geometry').then(result => { if (active) setSource(result.latestSource); }).catch(() => { if (active) setSource(null); });
    return () => { active = false; };
  }, [incident.id, incident.version, sourceAt]);
  const [mode, setMode] = useState('review'), [note, setNote] = useState(''), [json, setJson] = useState('');
  const [limits, setLimits] = useState({ startLon: ends[0]?.[0] ?? incident.longitude, startLat: ends[0]?.[1] ?? incident.latitude, endLon: ends[1]?.[0] ?? '', endLat: ends[1]?.[1] ?? '' });
  const [error, setError] = useState('');
  useEffect(() => {
    const values = endpoints(incident.geometry);
    setLimits({ startLon: values[0]?.[0] ?? incident.longitude, startLat: values[0]?.[1] ?? incident.latitude, endLon: values[1]?.[0] ?? '', endLat: values[1]?.[1] ?? '' });
  }, [incident.id, incident.geometryEvidence?.fingerprint]);
  const evidence = incident.geometryEvidence;
  const changed = source && evidence?.reviewedSourceFingerprint && source.geometryEvidence?.fingerprint !== evidence.reviewedSourceFingerprint;
  async function submit(event) {
    event.preventDefault(); setError('');
    let payload = { version: incident.version, action: mode, note };
    if (mode === 'derive') payload = { ...payload, start: [Number(limits.startLon), Number(limits.startLat)], end: [Number(limits.endLon), Number(limits.endLat)] };
    if (mode === 'replace') {
      try { payload.geometry = JSON.parse(json); } catch { setError('Enter valid GeoJSON geometry JSON.'); return; }
    }
    if (await perform('/incidents/' + incident.id + '/geometry', payload, mode === 'review' ? 'Geometry review recorded. This does not certify field verification or feed conformance.' : 'Geometry updated. Review the displayed roadway and limits before accepting it.')) setNote('');
  }
  return <div className="inspector-section geometry-review"><div className="section-title"><h3>Affected road geometry</h3></div><dl className="source-details"><div><dt>Shape</dt><dd>{incident.geometry?.type || 'Missing'}</dd></div><div><dt>Status</dt><dd>{evidence?.status?.replaceAll('_', ' ') || 'Needs review'}</dd></div><div><dt>Source</dt><dd>{evidence?.source || 'Unknown'}</dd></div><div><dt>Method</dt><dd>{evidence?.method || 'Unknown'}</dd></div>{evidence?.reviewedAt && <div><dt>Reviewed</dt><dd>{evidence.reviewedBy} · {new Date(evidence.reviewedAt).toLocaleString()}</dd></div>}</dl><p className="muted-small">{evidence?.reviewNote || evidence?.note || 'Confirm the road, direction, and affected limits.'}</p>
    {evidence?.sourceClaims && <p className="muted-small">Source-reported verification: beginning {evidence.sourceClaims.startPositionVerified === null ? 'unknown' : evidence.sourceClaims.startPositionVerified ? 'yes' : 'no'}, ending {evidence.sourceClaims.endPositionVerified === null ? 'unknown' : evidence.sourceClaims.endPositionVerified ? 'yes' : 'no'}. These are source assertions.</p>}
    {changed && <p className="geometry-warning">Source location changed after review. The incident retains its previous geometry.</p>}
    {source?.geometry && <details><summary>Latest source geometry</summary><pre>{JSON.stringify(source.geometry, null, 2)}</pre></details>}
    {canWrite && <details><summary>Review or update geometry</summary><form onSubmit={submit}><label className="form-field">Action<select value={mode} onChange={e => setMode(e.target.value)}><option value="review">Confirm displayed roadway and limits</option><option value="derive" disabled={!network}>Find segment in agency road network</option><option value="replace">Provide GeoJSON geometry</option>{source?.geometry && <option value="adopt_source">Adopt latest source geometry</option>}</select></label>
      {mode === 'derive' && <><p className="muted-small">{network.source}. Match {incident.route}, {incident.direction}. Both endpoints must be within 75 metres of one continuous segment. Derived results require review.</p><div className="geometry-limits">{[['startLat', 'Beginning latitude', -90, 90], ['startLon', 'Beginning longitude', -180, 180], ['endLat', 'Ending latitude', -90, 90], ['endLon', 'Ending longitude', -180, 180]].map(([key, label, min, max]) => <label className="form-field" key={key}>{label}<input required type="number" step="any" min={min} max={max} value={limits[key]} onChange={e => setLimits(v => ({ ...v, [key]: e.target.value }))} /></label>)}</div></>}
      {!network && <p className="muted-small">Road lookup is unavailable until an agency road-network catalog is configured. Existing source geometry remains available.</p>}
      {mode === 'replace' && <label className="form-field">WGS84 GeoJSON geometry<textarea required maxLength={50000} placeholder={'{"type":"LineString","coordinates":[[-93.6,41.6],[-93.59,41.6]]}'} value={json} onChange={e => setJson(e.target.value)} /></label>}
      <label className="form-field">Review evidence / reason<textarea required minLength={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="Describe the road, direction, limits, and evidence checked." /></label>{error && <p role="alert">{error}</p>}<button className="ops-button full" disabled={disabled}>Record geometry action</button><p className="muted-small">Operator review is recorded separately from source claims and field verification.</p>
    </form></details>}
  </div>;
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Download, Network, Plus, RefreshCw } from 'lucide-react';
import { request, saveJson, uploadArchitecturePhoto, architecturePhotoUrl, downloadDruBundle } from './api';
import DruImport from './DruImport';
import DruFieldEvidence from './DruFieldEvidence';
import DruPhoto from './DruPhoto';

const emptyAsset = { version: 0, name: '', type: 'other', deviceId: '', manufacturer: '', model: '', firmware: '', owner: '', contact: '', protocol: '', arcItObject: '', location: '', notes: '', analysis: { referenceSpeedMph: '', segmentLengthMiles: '' } };
const emptyLink = { version: 0, from: '', to: '', fromPort: '', toPort: '', layer: 'information', medium: 'unknown', protocol: '', flow: '', evidenceReference: '', notes: '' };
const date = value => value ? new Date(value).toLocaleString() : 'Not supplied';

function Topology({ assets, connections, selectedId, onSelect, onConnection }) {
  const included = new Set(selectedId ? [selectedId] : assets.slice(0, 30).map(a => a.id));
  const neighbors = new Map();
  for (const c of connections) { for (const [a, b] of [[c.from, c.to], [c.to, c.from]]) { if (!neighbors.has(a)) neighbors.set(a, []); neighbors.get(a).push(b); } }
  const queue = [...included];
  while (queue.length && included.size < 40) for (const next of neighbors.get(queue.shift()) || []) {
    if (!included.has(next) && included.size < 40) { included.add(next); queue.push(next); }
  }
  const visible = assets.filter(a => included.has(a.id));
  const ranks = { detector: 0, camera: 0, dms: 0, rwis: 0, sensor: 0, power: 0, cabinet: 1, controller: 1, switch: 2, gateway: 3, center: 4, feed: 4, other: 2 }, rows = [0, 0, 0, 0, 0];
  const positions = new Map(visible.map(a => { const rank = ranks[a.type] ?? 2; return [a.id, { x: 18 + rank * 205, y: 25 + rows[rank]++ * 100 }]; }));
  return <div className="architecture-topology"><svg viewBox={`0 0 1030 ${Math.max(230, Math.max(...rows) * 100 + 35)}`} role="group" aria-label="Declared ITS connections">
    <defs><marker id="architecture-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="currentColor" /></marker></defs>
    {connections.filter(c => positions.has(c.from) && positions.has(c.to)).slice(0, 100).map(c => { const a = positions.get(c.from), b = positions.get(c.to); return <path key={c.id} className={'architecture-wire ' + c.evidenceState} d={`M${a.x + 168},${a.y + 30} C${a.x + 205},${a.y + 30} ${b.x - 35},${b.y + 30} ${b.x},${b.y + 30}`} markerEnd="url(#architecture-arrow)" role="button" tabIndex="0" aria-label={'Inspect connection ' + (c.flow || c.medium)} onClick={() => onConnection(c)} onKeyDown={e => { if (e.key === 'Enter') onConnection(c); }}><title>{c.flow || 'Unspecified information flow'} · {c.evidenceState} · {c.medium}</title></path>; })}
    {visible.map(a => { const p = positions.get(a.id), subtitle = a.type + ' · ' + (a.protocol || 'unknown'); return <g key={a.id} transform={`translate(${p.x},${p.y})`} role="button" tabIndex="0" aria-label={'Inspect asset ' + a.name} onClick={() => onSelect(a.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(a.id); } }}><rect width="168" height="62" rx="8" className={selectedId === a.id ? 'architecture-node selected' : 'architecture-node'} /><text x="12" y="24" className="architecture-node-name">{a.name.length > 21 ? a.name.slice(0, 20) + '…' : a.name}</text><text x="12" y="44" className="architecture-node-type">{subtitle.length > 30 ? subtitle.slice(0, 29) + '…' : subtitle}</text><title>{a.name + ' · ' + subtitle}</title></g>; })}
  </svg><p>Directed dependencies · candidate / documented / verified evidence · up to 40 nearby assets shown</p></div>;
}

export default function ArchitectureDesk({ data, disabled, onCollect, focusAssetId }) {
  const [druOpen, setDruOpen] = useState(false);
  const [graph, setGraph] = useState({ assets: [], connections: [], photos: [], types: [], media: [] });
  const [selectedId, setSelectedId] = useState(''), [connectionId, setConnectionId] = useState('');
  const [assetForm, setAssetForm] = useState(null), [linkForm, setLinkForm] = useState(null), [deviceSearch, setDeviceSearch] = useState('');
  const [search, setSearch] = useState(''), [capabilities, setCapabilities] = useState(null), [impact, setImpact] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [review, setReview] = useState({ note: '', method: 'field-inspection', observedAt: '' });
  const [photo, setPhoto] = useState({ file: null, caption: '', capturedAt: '', connectionId: '' }), [photoView, setPhotoView] = useState(null);
  const write = data.actor.role !== 'viewer', supervisor = data.actor.role === 'supervisor';
  const selected = graph.assets.find(a => a.id === selectedId), connection = graph.connections.find(c => c.id === connectionId);
  const adjacent = graph.connections.filter(c => c.from === selectedId || c.to === selectedId);
  const photos = graph.photos.filter(p => p.assetId === selectedId);
  const names = useMemo(() => new Map(graph.assets.map(a => [a.id, a.name])), [graph.assets]);
  const load = useCallback(async () => {
    try { const result = await request('/architecture'); setGraph(result); setSelectedId(id => result.assets.some(a => a.id === id) ? id : result.assets[0]?.id || ''); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load, data.actor.id]);
  useEffect(() => { if (focusAssetId && graph.assets.some(a => a.id === focusAssetId)) setSelectedId(focusAssetId); }, [focusAssetId, graph.assets]);
  useEffect(() => { if (druOpen) { setAssetForm(null); setLinkForm(null); setConnectionId(''); } }, [druOpen]);
  useEffect(() => {
    let active = true; setCapabilities(null);
    if (selectedId) request('/architecture/assets/' + selectedId + '/capabilities').then(r => { if (active) setCapabilities(r); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [selectedId, graph.at]);
  useEffect(() => {
    setPhoto({ file: null, caption: '', capturedAt: '', connectionId: '' }); setPhotoView(null);
  }, [selectedId]);
  useEffect(() => {
    if (assetForm || linkForm) document.querySelector('.architecture-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [!!assetForm, !!linkForm]);
  useEffect(() => { if (connectionId) document.querySelector('.architecture-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [connectionId]);
  useEffect(() => () => { if (photoView?.url) URL.revokeObjectURL(photoView.url); }, [photoView]);
  useEffect(() => {
    if (!photoView) return;
    const previous = document.activeElement, dialog = document.querySelector('.architecture-photo-dialog');
    dialog?.querySelector('button')?.focus();
    const keydown = event => {
      if (event.key === 'Escape') { setPhotoView(null); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll('button,a[href]')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus?.(); };
  }, [photoView]);
  async function mutate(path, body, message) {
    setBusy(true); setError('');
    try { const result = await request(path, { method: 'POST', body }); setNotice(message); await load(); return result; }
    catch (e) { setError(e.message); return null; } finally { setBusy(false); }
  }
  function inspectConnection(c) { setConnectionId(c.id); setReview({ note: '', method: 'field-inspection', observedAt: '' }); setImpact(null); }
  const deviceOptions = data.devices.filter(d => !deviceSearch || (d.name + ' ' + d.id + ' ' + d.route).toLowerCase().includes(deviceSearch.toLowerCase())).slice(0, 100);
  return <section className="desk-panel architecture-desk">
    <div className="panel-heading"><div><h2><Network size={19} /> ITS architecture</h2><p>Equipment, physical connections, information flows and the evidence behind operational data.</p></div><div className="heading-actions"><button className="ops-button" disabled={busy} onClick={load}><RefreshCw size={14} />Refresh</button><button className="ops-button" onClick={() => saveJson(graph, 'atms-architecture.json')}><Download size={14} />Export register</button>{write && <button className="ops-button primary" disabled={disabled || busy} onClick={() => { setLinkForm(null); setAssetForm({ ...emptyAsset }); }}><Plus size={14} />Add asset</button>}</div></div>
    {data.mode === 'training' && <p className="architecture-notice">Training architecture and calculations are synthetic. Connection evidence does not authorize physical control.</p>}
    {error && <p className="ops-notice error" role="alert">{error}</p>}{notice && <p className="ops-notice" role="status">{notice}</p>}
    {write && <DruImport graph={graph} disabled={disabled || busy} onImported={load} onOpenChange={setDruOpen} onViewAsset={setSelectedId} />}
    <div hidden={druOpen}>
    {!!graph.assets.length && <Topology assets={graph.assets} connections={graph.connections} selectedId={selectedId} onSelect={setSelectedId} onConnection={inspectConnection} />}
    {!graph.assets.length && <div className="ops-empty"><Network size={28} /><h3>Establish the installed architecture</h3><p>Link existing equipment to profiles, then document the cabinets, communications paths, ports and information flows between them.</p></div>}
    <div className="architecture-columns"><aside className="architecture-assets"><label>Find equipment<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, type, model…" /></label><small>{graph.assets.length} architecture assets</small>
      <div className="architecture-asset-list">{graph.assets.filter(a => (a.name + ' ' + a.type + ' ' + a.model).toLowerCase().includes(search.toLowerCase())).map(a => <button className={a.id === selectedId ? 'selected' : ''} key={a.id} onClick={() => setSelectedId(a.id)}><strong>{a.name}</strong><small>{a.type} · {a.location || 'Location unknown'}</small></button>)}</div>
    </aside><div className="architecture-detail">
      {selected && <><div className="section-title"><div><h3>{selected.name}</h3><small>{selected.synthetic ? 'Synthetic profile' : 'Agency asset profile'} · {selected.type}</small></div>{write && <button className="ops-button compact" disabled={disabled || busy} onClick={() => { setLinkForm(null); setAssetForm({ ...selected, analysis: { ...selected.analysis } }); }}>Edit profile</button>}</div>
        <dl className="source-details architecture-specs">{[['Manufacturer', selected.manufacturer], ['Model / firmware', [selected.model, selected.firmware].filter(Boolean).join(' / ')], ['Owner / contact', [selected.owner, selected.contact].filter(Boolean).join(' · ')], ['Location', selected.location], ['Declared protocol', selected.protocol], ['Linked device', selected.deviceId], ['ARC-IT object · proposed mapping', selected.arcItObject]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Unknown'}</dd></div>)}</dl>{selected.notes && <p>{selected.notes}</p>}
        {!!selected.fieldEvidence?.length && <DruFieldEvidence records={selected.fieldEvidence} photos={photos} connections={adjacent} canReview={write} onReview={inspectConnection} onPhoto={async p => { try { setPhotoView({ ...p, url: await architecturePhotoUrl(p.id) }); } catch (err) { setError(err.message); } }} onDownload={async id => { try { await downloadDruBundle(id); } catch (err) { setError(err.message); } }} />}
        <div className="section-title"><h3>Connections and information flows</h3>{write && <button className="ops-button compact" disabled={disabled || busy} onClick={() => { setAssetForm(null); setLinkForm({ ...emptyLink, from: selectedId }); setConnectionId(''); }}>Add connection</button>}</div>
        {adjacent.map(c => <button className={'architecture-link ' + (c.id === connectionId ? 'selected' : '')} key={c.id} onClick={() => inspectConnection(c)}><span><strong>{names.get(c.from)} → {names.get(c.to)}</strong><small>{c.fromPort || 'Port unknown'} → {c.toPort || 'Port unknown'} · {c.medium} · {c.flow || 'Flow unspecified'}</small></span><span className={'badge ' + (c.evidenceState === 'verified' ? 'good' : c.evidenceState === 'verification-invalidated' ? 'critical' : 'neutral')}>{c.evidenceState.replaceAll('-', ' ')}</span></button>)}
        {!adjacent.length && <p className="architecture-muted">No documented connections for this asset.</p>}
        <div className="section-title"><h3>Installation photographs</h3><span>{photos.length} attached</span></div><p className="architecture-muted">Attach actual device, cabinet, wiring and connector photographs. Uploading evidence leaves it submitted for review.</p>
        <div className="architecture-photos">{photos.map(p => <article key={p.id}><DruPhoto photo={p} onOpen={async () => { try { setPhotoView({ ...p, url: await architecturePhotoUrl(p.id) }); } catch (err) { setError(err.message); } }} /><strong>{p.caption}</strong><small>Captured {date(p.capturedAt)} · {p.uploadedBy}</small><small>{p.connectionId ? 'Connection evidence' : 'Asset evidence'} · {p.evidenceState}</small><button className="ops-button compact" onClick={async () => { try { setPhotoView({ ...p, url: await architecturePhotoUrl(p.id) }); } catch (e) { setError(e.message); } }}>View photograph</button></article>)}</div>
        {write && <form className="architecture-photo-form" onSubmit={async e => {
          e.preventDefault(); setBusy(true); setError('');
          try { await uploadArchitecturePhoto(selectedId, photo.file, { caption: photo.caption, capturedAt: new Date(photo.capturedAt).toISOString(), connectionId: photo.connectionId }); setNotice('Photograph attached as submitted evidence.'); setPhoto({ file: null, caption: '', capturedAt: '', connectionId: '' }); e.target.reset(); await load(); }
          catch (err) { setError(err.message); } finally { setBusy(false); }
        }}><label>JPEG or PNG · up to 5 MB<input key={selectedId} type="file" accept="image/jpeg,image/png" required onChange={e => setPhoto(p => ({ ...p, file: e.target.files[0] }))} /></label><label>What the photograph shows<input required maxLength={1000} value={photo.caption} onChange={e => setPhoto(p => ({ ...p, caption: e.target.value }))} /></label><label>Capture time · local time<input type="datetime-local" required value={photo.capturedAt} onChange={e => setPhoto(p => ({ ...p, capturedAt: e.target.value }))} /></label><label>Connection association<select value={photo.connectionId} onChange={e => setPhoto(p => ({ ...p, connectionId: e.target.value }))}><option value="">Asset only</option>{adjacent.map(c => <option key={c.id} value={c.id}>{names.get(c.from)} → {names.get(c.to)}</option>)}</select></label><button className="ops-button" disabled={disabled || busy}>Attach photograph</button></form>}
        <div className="section-title"><h3>Observed and derivable data</h3>{write && onCollect && <button className="ops-button compact" disabled={disabled || busy} onClick={async () => { await onCollect(); await load(); }}>Collect source readings</button>}</div>{capabilities && <><p className="architecture-muted">Measurement time: {date(capabilities.observation?.observedAt)} · {capabilities.synthetic ? 'Synthetic evidence' : 'Source observation'} · Calculations do not issue operational actions.</p>
          {capabilities.reportedState?.message !== null && capabilities.reportedState?.message !== undefined && <div><small>Reported message · {capabilities.reportedState.provenance} · {date(capabilities.reportedState.observedAt)}</small><pre className="support-sign">{capabilities.reportedState.message || 'Reported blank'}</pre></div>}
          <div className="architecture-readings">{capabilities.observedFields.map(m => <div key={m.name}><small>{m.name}</small><strong>{m.value} {m.unit}</strong></div>)}{!capabilities.observedFields.length && <p>No measurement fields currently linked.</p>}</div>
          <div className="architecture-recipes">{capabilities.derived.map(r => <article key={r.recipe}><div className="section-title"><strong>{r.recipe.replaceAll('-', ' ')}</strong><span className={'badge ' + (r.status === 'available' ? 'good' : 'neutral')}>{r.status}</span></div>{r.status === 'available' ? <p className="architecture-result">{r.value} <small>{r.unit}</small></p> : <p>{r.reason}</p>}{r.assumptions?.map(a => <small key={a}>{a}</small>)}{r.accuracy && <small>{r.accuracy}</small>}{r.inputs?.batchId && <details><summary>Calculation inputs and lineage</summary><pre>{JSON.stringify(r.inputs, null, 2)}</pre></details>}</article>)}</div></>}
      </>}
    </div></div>
    </div>
    {connection && <div className="architecture-review"><div className="section-title"><h3>{names.get(connection.from)} → {names.get(connection.to)}</h3><button className="ops-button compact" onClick={() => setConnectionId('')}>Close connection</button></div><p>{connection.layer} · {connection.medium} · {connection.protocol} · {connection.evidenceState}</p><p>{connection.flow || 'Information flow not yet specified'}</p><p>Evidence reference: {connection.evidenceReference || 'Not supplied'}</p>{connection.notes && <p>{connection.notes}</p>}
      <p className="architecture-muted">Documented by {connection.documentedBy || 'pending'} · Verified by {connection.verifiedBy || 'pending'} · {connection.synthetic ? 'Synthetic rehearsal' : 'Agency evidence record'}</p>
      <div className="heading-actions">{write && <button className="ops-button" disabled={disabled || busy} onClick={() => { setAssetForm(null); setLinkForm({ ...connection }); }}>Edit connection</button>}<button className="ops-button" onClick={async () => { try { setImpact(await request('/architecture/connections/' + connection.id + '/impact')); } catch (e) { setError(e.message); } }}>Explore failed connection</button></div>
      {write && <div className="architecture-review-fields"><label>Inspection / documentation evidence<textarea value={review.note} maxLength={2000} onChange={e => setReview(r => ({ ...r, note: e.target.value }))} /></label><button className="ops-button" disabled={disabled || busy || !review.note.trim()} onClick={() => mutate('/architecture/connections/' + connection.id + '/review', { action: 'document', version: connection.version, note: review.note }, 'Connection documented. Independent verification remains separate.')}>Record documentation</button>
        {supervisor && <><label>Verification basis<select value={review.method} onChange={e => setReview(r => ({ ...r, method: e.target.value }))}><option value="field-inspection">Field inspection</option><option value="bench-test">Bench test</option></select></label><label>Inspection time · local time<input type="datetime-local" value={review.observedAt} onChange={e => setReview(r => ({ ...r, observedAt: e.target.value }))} /></label><button className="ops-button primary" disabled={disabled || busy || !review.note.trim() || !review.observedAt} onClick={() => mutate('/architecture/connections/' + connection.id + '/review', { action: 'verify', version: connection.version, note: review.note, method: review.method, observedAt: new Date(review.observedAt).toISOString() }, 'Connection evidence verified for this configuration.')}>Verify connection evidence</button><button className="ops-button" disabled={disabled || busy || !review.note.trim()} onClick={() => mutate('/architecture/connections/' + connection.id + '/review', { action: 'revoke', version: connection.version, note: review.note }, 'Connection verification revoked.')}>Revoke verification</button></>}
      </div>}{impact && <div className="architecture-impact"><h4>Potential dependency impact</h4><p>{impact.limitations}</p><p>{impact.alternateDeclaredPath ? 'An alternate declared path exists.' : 'No alternate path is recorded from the source.'}</p><ul>{impact.affected.map(a => <li key={a.id}>{a.name} · {a.type}{a.alternateDeclaredPath ? ' · alternate declared path' : ''}</li>)}</ul>{!!impact.dataDependencies?.length && <><h4>Upstream data using this declared path</h4><ul>{impact.dataDependencies.map(d => <li key={d.assetId}>{d.name}: {d.fields.join(", ") || "reported device state"}{d.derivedOutputs.length ? " · " + d.derivedOutputs.join(", ") : ""}</li>)}</ul></>}</div>}
    </div>}
    {assetForm && <div className="architecture-editor"><div className="section-title"><h3>{assetForm.id ? 'Edit asset profile' : 'Add architecture asset'}</h3><button className="ops-button compact" onClick={() => setAssetForm(null)}>Cancel asset</button></div><form onSubmit={async e => { e.preventDefault(); const saved = await mutate('/architecture/assets', assetForm, 'Architecture asset saved.'); if (saved) { setSelectedId(saved.id); setAssetForm(null); } }}>
      <div className="architecture-form-grid"><label>Asset name<input required value={assetForm.name} maxLength={180} onChange={e => setAssetForm(a => ({ ...a, name: e.target.value }))} /></label><label>Asset class<select value={assetForm.type} onChange={e => setAssetForm(a => ({ ...a, type: e.target.value }))}>{graph.types.map(t => <option key={t}>{t}</option>)}</select></label><label>Find existing device<input value={deviceSearch} onChange={e => setDeviceSearch(e.target.value)} placeholder="Search imported inventory…" /></label><label>Link existing device<select value={assetForm.deviceId || ''} onChange={e => { const d = data.devices.find(d => d.id === e.target.value); setAssetForm(a => ({ ...a, deviceId: d?.id || '', name: a.name || d?.name || '', location: a.location || d?.route || '', type: graph.types.includes(d?.type) ? d.type : a.type })); }}><option value="">No linked device</option>{assetForm.deviceId && !deviceOptions.some(d => d.id === assetForm.deviceId) && <option value={assetForm.deviceId}>{assetForm.deviceId}</option>}{deviceOptions.map(d => <option key={d.id} value={d.id}>{d.name} · {d.type}</option>)}</select></label>
      {['manufacturer', 'model', 'firmware', 'owner', 'contact', 'location', 'protocol', 'arcItObject'].map(k => <label key={k}>{({ arcItObject: 'ARC-IT physical object · proposed', protocol: 'Declared protocol · leave unknown if unverified' })[k] || k}<input maxLength={k === 'location' ? 500 : 180} value={assetForm[k] || ''} onChange={e => setAssetForm(a => ({ ...a, [k]: e.target.value }))} /></label>)}
      <label>Reference speed assumption · mph<input type="number" min="0.1" max="120" step="any" value={assetForm.analysis?.referenceSpeedMph ?? ''} onChange={e => setAssetForm(a => ({ ...a, analysis: { ...a.analysis, referenceSpeedMph: e.target.value } }))} /></label><label>Representative segment assumption · miles<input type="number" min="0.01" max="200" step="any" value={assetForm.analysis?.segmentLengthMiles ?? ''} onChange={e => setAssetForm(a => ({ ...a, analysis: { ...a.analysis, segmentLengthMiles: e.target.value } }))} /></label></div><label>Asset notes<textarea maxLength={2000} value={assetForm.notes || ''} onChange={e => setAssetForm(a => ({ ...a, notes: e.target.value }))} /></label><button className="ops-button primary" disabled={disabled || busy}>Save asset profile</button></form></div>}
    {linkForm && <div className="architecture-editor"><div className="section-title"><h3>{linkForm.id ? 'Edit connection' : 'Add directed connection'}</h3><button className="ops-button compact" onClick={() => setLinkForm(null)}>Cancel connection</button></div><form onSubmit={async e => { e.preventDefault(); const saved = await mutate('/architecture/connections', linkForm, 'Connection saved as a candidate.'); if (saved) { setConnectionId(saved.id); setLinkForm(null); } }}><div className="architecture-form-grid">
      {['from', 'to'].map(k => <label key={k}>{k === 'from' ? 'Source / supplying asset' : 'Destination / dependent asset'}<select required value={linkForm[k]} onChange={e => setLinkForm(c => ({ ...c, [k]: e.target.value }))}><option value="">Select asset</option>{graph.assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>)}
      <label>Connection layer<select value={linkForm.layer} onChange={e => setLinkForm(c => ({ ...c, layer: e.target.value }))}>{['physical', 'information', 'power'].map(v => <option key={v}>{v}</option>)}</select></label><label>Medium<select value={linkForm.medium} onChange={e => setLinkForm(c => ({ ...c, medium: e.target.value }))}>{graph.media.map(v => <option key={v}>{v}</option>)}</select></label>
      {['fromPort', 'toPort', 'protocol', 'flow', 'evidenceReference'].map(k => <label key={k}>{({ fromPort: 'Source port / terminal', toPort: 'Destination port / terminal', protocol: 'Declared protocol', flow: 'Information exchanged', evidenceReference: 'Drawing / installation / test reference' })[k]}<input maxLength={k === 'evidenceReference' ? 1000 : k === 'flow' ? 300 : k === 'protocol' ? 180 : 100} value={linkForm[k] || ''} onChange={e => setLinkForm(c => ({ ...c, [k]: e.target.value }))} /></label>)}</div><label>Connection notes<textarea maxLength={2000} value={linkForm.notes || ''} onChange={e => setLinkForm(c => ({ ...c, notes: e.target.value }))} /></label><button className="ops-button primary" disabled={disabled || busy}>Save candidate connection</button></form></div>}
    {photoView && <div className="architecture-photo-dialog" role="dialog" aria-modal="true" aria-label="Installation photograph"><div className="section-title"><h3>{photoView.caption}</h3><button className="ops-button" onClick={() => setPhotoView(null)}>Close photograph</button></div><img src={photoView.url} alt={photoView.caption} /><p>Captured {date(photoView.capturedAt)} · {photoView.evidenceState} · {photoView.synthetic ? 'Training attachment' : 'Agency attachment'}</p><small>SHA256 {photoView.sha256}</small><a className="ops-button" href={photoView.url} download={photoView.id + (photoView.mime === 'image/png' ? '.png' : '.jpg')}>Download original</a></div>}
  </section>;
}

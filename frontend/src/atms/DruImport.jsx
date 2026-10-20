import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ChevronRight, FileCheck2, FileUp, Link2, MapPin, Plus, Search, X } from 'lucide-react';
import { request, uploadDruBundle, downloadDruBundle } from './api';
import DruEvidenceRecord from './DruEvidenceRecord';
import DruPhoto from './DruPhoto';
import { suggestDruMatches } from './dru-matching.mjs';

const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date not supplied';
const names = { dms: 'Message sign', rwis: 'Weather station', other: 'Other equipment' };
const typeName = type => names[type] || type?.replace(/^./, c => c.toUpperCase());

export default function DruImport({ graph, disabled, onImported, onOpenChange, onViewAsset }) {
  const [open, setOpen] = useState(false), [file, setFile] = useState(null), [bundle, setBundle] = useState(null), [step, setStep] = useState(0);
  const [history, setHistory] = useState([]), [maps, setMaps] = useState({}), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [filter, setFilter] = useState(''), [page, setPage] = useState(0), [equipmentSearch, setEquipmentSearch] = useState({});
  const [uploadKey, setUploadKey] = useState(() => crypto.randomUUID()), [commitKey, setCommitKey] = useState(() => crypto.randomUUID());
  const stageRef = useRef(null), headingRef = useRef(null);
  async function refresh() { const r = await request('/architecture/dru/bundles'); setHistory(r.bundles); }
  useEffect(() => { onOpenChange?.(open); if (open) refresh().catch(e => setError(e.message)); }, [open, onOpenChange]);
  useEffect(() => { if (open) { stageRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); headingRef.current?.focus({ preventScroll: true }); } }, [step, open]);
  const suggestions = useMemo(() => Object.fromEntries((bundle?.features || []).map(f => [f.sourceAssetId, suggestDruMatches(f, graph.assets)])), [bundle, graph.assets]);
  function preview(b) {
    setBundle(b); setMaps(Object.fromEntries(b.features.map(f => [f.sourceAssetId, { sourceAssetId: f.sourceAssetId, target: 'skip', name: f.name, type: f.suggestedType, connectionId: '' }])));
    setFilter(''); setPage(0); setEquipmentSearch({}); setStep(b.status === 'imported' ? 3 : 1); setCommitKey(crypto.randomUUID());
  }
  async function run(fn) { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  function change(id, fields) { setMaps(old => ({ ...old, [id]: { ...old[id], ...fields } })); setCommitKey(crypto.randomUUID()); }
  function chooseFile(next) {
    if (!next) return;
    if (next.size > 50 * 1024 * 1024 || !/\.(dru-session|zip)$/i.test(next.name)) { setFile(null); setError('Choose a DRU session file up to 50 MB.'); return; }
    setFile(next); setUploadKey(crypto.randomUUID()); setError('');
  }
  const selected = Object.values(maps).filter(m => !['skip', 'choose'].includes(m.target));
  const included = new Set(selected.map(m => m.sourceAssetId));
  const selectedPhotos = bundle?.photos.filter(p => included.has(p.sourceAssetId)) || [];
  const filtered = (bundle?.features || []).filter(f => (f.name + ' ' + (f.properties.ownerName || '')).toLowerCase().includes(filter.toLowerCase()));
  const visible = filtered.slice(page * 8, page * 8 + 8);
  const attention = bundle?.warnings.filter(w => w.startsWith('Missing photo:') || w.startsWith('Unlinked photo')) || [];
  const targetName = m => m.target === 'new' ? m.name : graph.assets.find(a => a.id === m.target)?.name || 'Equipment unavailable';
  function review() {
    if (Object.values(maps).some(m => m.target === 'choose')) { setError('Choose equipment for each included capture, or leave it out.'); return; }
    if (selected.some(m => m.target === 'new' && !m.name.trim())) { setError('Give each new piece of equipment a name.'); return; }
    setError(''); setStep(2);
  }
  return <section className={'dru-import ' + (open ? 'is-open' : '')} aria-label="DRU field documentation">
    <div className="dru-entry"><span className="dru-entry-icon"><FileCheck2 size={23} /></span><div><span className="dru-kicker">PURPOSEBUILT · DRU</span><h3>Fieldwork, connected.</h3><p>Bring captures, photos and inspections into your operations workspace.</p></div><button className="ops-button" disabled={busy} onClick={() => setOpen(!open)}>{open ? <><X size={14} />Close</> : <>Add field documentation<ArrowRight size={15} /></>}</button></div>
    {open && <div className="dru-workflow" ref={stageRef}>
      <nav className="dru-steps" aria-label="Documentation progress">{['Choose capture', 'Match equipment', 'Review & save'].map((label, index) => <button key={label} aria-current={Math.min(step, 2) === index ? 'step' : undefined} disabled={busy || index > step || step === 3} onClick={() => { setStep(index); setError(''); }}><span>{index < step ? <Check size={13} /> : index + 1}</span>{label}</button>)}</nav>
      {error && <p className="ops-notice error" role="alert">{error}</p>}
      {step === 0 && <>
        <div className="dru-stage-heading"><span className="dru-kicker">01 / CAPTURE</span><h3 tabIndex={-1} ref={headingRef}>Start with your fieldwork.</h3><p>Export a session from DRU, then choose it here. You’ll review everything before saving.</p></div>
        <form onSubmit={e => { e.preventDefault(); if (file) run(async () => { preview(await uploadDruBundle(file, uploadKey)); await refresh(); }); }}>
          <label className={'dru-dropzone ' + (file ? 'has-file' : '')} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy && !disabled) chooseFile(e.dataTransfer.files[0]); }}><span className="dru-upload-symbol">{file ? <FileCheck2 size={30} /> : <FileUp size={30} />}</span><strong>{file ? file.name : 'Choose a DRU capture'}</strong><span>{file ? (file.size / 1024 / 1024).toFixed(1) + ' MB · Ready to preview' : 'Drop your session here, or browse files'}</span><small>.dru-session or .zip · Up to 50 MB</small><input aria-label="Choose DRU session file" type="file" accept=".dru-session,.zip" disabled={busy || disabled} onChange={e => chooseFile(e.target.files[0])} /></label>
          <div className="dru-action-row"><small>Your equipment records change only when you save.</small><button className="ops-button primary" disabled={!file || busy || disabled}>{busy ? 'Reading capture…' : 'Continue'}<ArrowRight size={14} /></button></div>
        </form>
        {!!history.length && <div className="dru-recent"><h4>Recent captures</h4>{history.slice(0, 5).map(b => <button className="dru-recent-item" key={b.id} disabled={busy} onClick={() => run(async () => preview(await request('/architecture/dru/bundles/' + b.id)))}><span className="dru-recent-icon">{b.status === 'imported' ? <CheckCircle2 size={19} /> : <FileCheck2 size={19} />}</span><span><strong>{b.projectName}</strong><small>{date(b.uploadedAt)} · {b.status === 'imported' ? 'Documentation saved' : 'Ready to review'}</small></span><ChevronRight size={16} /></button>)}</div>}
        <details className="dru-help"><summary>Where do I find my DRU capture?</summary><p>In Digital ROW Utilities, export a session bundle. Choose the full photo export to retain the highest available resolution. Compact exports keep smaller copies.</p></details>
      </>}
      {bundle && step > 0 && <>
        <div className="dru-stage-heading"><span className="dru-kicker">{step === 1 ? '02 / EQUIPMENT' : step === 2 ? '03 / REVIEW' : 'SAVED TO YOUR WORKSPACE'}</span><h3 tabIndex={-1} ref={headingRef}>{step === 3 ? 'Fieldwork received.' : step === 1 ? 'Put every capture in its place.' : 'Ready to add your documentation?'}</h3><p>{bundle.manifest.projectName}<span className="dru-inline-divider">/</span>{date(bundle.manifest.exportedAt || bundle.uploadedAt)}</p></div>
        <div className="dru-overview"><div><Camera size={17} /><strong>{step === 1 ? bundle.photos.length : step === 3 ? bundle.result.photoIds.length : selectedPhotos.length}</strong><span>photos</span></div><div><MapPin size={17} /><strong>{step === 1 ? bundle.features.length : step === 3 ? bundle.result.assets.length : selected.length}</strong><span>captures</span></div><div><FileCheck2 size={17} /><strong>{step === 3 ? 'Needs review' : 'You decide'}</strong><span>{step === 3 ? 'installation evidence' : 'what gets saved'}</span></div></div>
        {!!attention.length && <details className="dru-attention"><summary>{attention.length} photo {attention.length === 1 ? 'item needs' : 'items need'} attention</summary><ul>{attention.map(w => <li key={w}>{w}</li>)}</ul></details>}
        {step === 1 && <>
          <div className="dru-match-toolbar"><p>Choose existing equipment or create a new record. Suggestions need your confirmation.</p><label className="dru-search"><Search size={15} /><input aria-label="Find a capture" placeholder="Find a capture…" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }} /></label></div>
          <div className="dru-capture-list">{visible.map(f => {
            const m = maps[f.sourceAssetId], sourcePhotos = bundle.photos.map((p, index) => ({ ...p, index })).filter(p => p.sourceAssetId === f.sourceAssetId), suggestionsForFeature = suggestions[f.sourceAssetId] || [];
            const options = graph.assets.filter(a => !equipmentSearch[f.sourceAssetId] || (a.name + ' ' + a.type + ' ' + a.location).toLowerCase().includes(equipmentSearch[f.sourceAssetId].toLowerCase())).slice(0, 50);
            return <article className={'dru-capture-card ' + (included.has(f.sourceAssetId) ? 'is-included' : '')} key={f.sourceAssetId}>
              <div className="dru-capture-heading"><span className="dru-equipment-icon"><MapPin size={19} /></span><div><h4>{f.name}</h4><small>{typeName(f.suggestedType)} · {sourcePhotos.length} {sourcePhotos.length === 1 ? 'photo' : 'photos'}{f.inspections.length ? ' · Inspection included' : ''}</small></div><span className={'dru-state ' + (included.has(f.sourceAssetId) ? 'included' : '')}>{included.has(f.sourceAssetId) ? <><Check size={12} />Included</> : m.target === 'choose' ? 'Choose equipment' : 'Left out'}</span></div>
              {!!sourcePhotos.length && <div className="dru-photo-strip">{sourcePhotos.slice(0, 3).map(p => <DruPhoto key={p.index} bundleId={bundle.id} index={p.index} photo={p} />)}{sourcePhotos.length > 3 && <span className="dru-photo-more">+{sourcePhotos.length - 3} photos in source</span>}</div>}
              {m.target === 'skip' && !!suggestionsForFeature.length && <div className="dru-suggestions"><span>Suggested equipment</span>{suggestionsForFeature.map(s => <button key={s.assetId} disabled={busy || disabled} onClick={() => change(f.sourceAssetId, { target: s.assetId, connectionId: '' })}><Link2 size={14} /><span><strong>{s.name}</strong><small>{s.reason}</small></span><Plus size={14} /></button>)}</div>}
              <div className="dru-destination-actions" role="group" aria-label={'Destination for ' + f.name}><button aria-pressed={!['skip', 'new'].includes(m.target)} disabled={busy || disabled} onClick={() => change(f.sourceAssetId, { target: 'choose', connectionId: '' })}><Link2 size={14} />Use existing equipment</button><button aria-pressed={m.target === 'new'} disabled={busy || disabled} onClick={() => change(f.sourceAssetId, { target: 'new', connectionId: '' })}><Plus size={14} />Create equipment</button>{m.target !== 'skip' && <button disabled={busy || disabled} onClick={() => change(f.sourceAssetId, { target: 'skip', connectionId: '' })}>Leave out</button>}</div>
              {m.target === 'new' && <div className="architecture-form-grid"><label>Equipment name<input maxLength={180} value={m.name} disabled={busy || disabled} onChange={e => change(f.sourceAssetId, { name: e.target.value })} /></label><label>Equipment type<select value={m.type} disabled={busy || disabled} onChange={e => change(f.sourceAssetId, { type: e.target.value })}>{graph.types.map(t => <option key={t} value={t}>{typeName(t)}</option>)}</select></label></div>}
              {!['skip', 'new'].includes(m.target) && <div className="dru-equipment-picker"><label>Find equipment<input value={equipmentSearch[f.sourceAssetId] || ''} disabled={busy || disabled} placeholder="Search name, type or location…" onChange={e => setEquipmentSearch(old => ({ ...old, [f.sourceAssetId]: e.target.value }))} /></label><label>Attach to<select value={m.target} disabled={busy || disabled} onChange={e => change(f.sourceAssetId, { target: e.target.value, connectionId: '' })}><option value="choose">Choose equipment</option>{m.target !== 'choose' && !options.some(a => a.id === m.target) && <option value={m.target}>{targetName(m)}</option>}{options.map(a => <option key={a.id} value={a.id}>{a.name} · {typeName(a.type)}</option>)}</select></label></div>}
              {!['skip', 'new', 'choose'].includes(m.target) && <details className="dru-connection-option"><summary>Link photos to a connection (optional)</summary><label>Connection<select value={m.connectionId} disabled={busy || disabled} onChange={e => change(f.sourceAssetId, { connectionId: e.target.value })}><option value="">Equipment only</option>{graph.connections.filter(c => [c.from, c.to].includes(m.target)).map(c => <option key={c.id} value={c.id}>{graph.assets.find(a => a.id === c.from)?.name} → {graph.assets.find(a => a.id === c.to)?.name}</option>)}</select></label></details>}
              <details className="dru-capture-details"><summary>Capture details & inspections</summary><DruEvidenceRecord record={f} profile={bundle.profile} /></details>
            </article>;
          })}</div>
          {!filtered.length && <p className="dru-empty">No captures match “{filter}”.</p>}
          {filtered.length > 8 && <div className="dru-pagination"><button className="ops-button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><span>{page * 8 + 1}–{Math.min((page + 1) * 8, filtered.length)} of {filtered.length}</span><button className="ops-button" disabled={(page + 1) * 8 >= filtered.length} onClick={() => setPage(p => p + 1)}>Next</button></div>}
          <div className="dru-action-row dru-sticky-actions"><button className="ops-button" disabled={busy} onClick={() => setStep(0)}><ArrowLeft size={14} />Back</button><span>{selected.length} of {bundle.features.length} captures included</span><button className="ops-button primary" disabled={busy || disabled || !selected.length} onClick={review}>Review selection<ArrowRight size={14} /></button></div>
        </>}
        {step === 2 && <>
          <div className="dru-review-list">{selected.map(m => <div key={m.sourceAssetId}><span className="dru-review-icon">{m.target === 'new' ? <Plus size={17} /> : <Link2 size={17} />}</span><div><strong>{targetName(m)}</strong><small>{m.target === 'new' ? 'New equipment record' : 'Attach to existing equipment'}{m.connectionId ? ' · Connection photos included' : ''}</small></div><Check size={16} /></div>)}</div>
          <p className="dru-review-note"><FileCheck2 size={19} /><span>Saved as <strong>Needs review</strong>. Your team can inspect the documentation and verify connections separately. Existing equipment settings stay in place.</span></p>
          {bundle.features.length > selected.length && <p className="architecture-muted">{bundle.features.length - selected.length} captures will be left out. This capture file can be saved once; include every record you want to attach.</p>}
          <div className="dru-action-row"><button className="ops-button" disabled={busy} onClick={() => setStep(1)}><ArrowLeft size={14} />Edit selection</button><button className="ops-button primary" disabled={busy || disabled || !selected.length} onClick={() => run(async () => {
            const mappings = selected.map(m => m.target === 'new' ? { sourceAssetId: m.sourceAssetId, name: m.name, type: m.type } : { sourceAssetId: m.sourceAssetId, assetId: m.target, version: graph.assets.find(a => a.id === m.target)?.version, connectionId: m.connectionId });
            const result = await request('/architecture/dru/bundles/' + bundle.id + '/import', { method: 'POST', key: commitKey, body: { mappings } });
            setBundle(result); setStep(3); await onImported(); await refresh();
          })}>{busy ? 'Saving documentation…' : 'Save documentation'}<Check size={15} /></button></div>
        </>}
        {step === 3 && <div className="dru-success"><span className="dru-success-mark"><CheckCircle2 size={30} /></span><div><h4>Your documentation is attached.</h4><p>{bundle.result.assets.length} {bundle.result.assets.length === 1 ? 'capture' : 'captures'} and {bundle.result.photoIds.length} {bundle.result.photoIds.length === 1 ? 'photo' : 'photos'} are ready for your team to review.</p></div>{bundle.result.assets.map((a, i) => <button className="dru-saved-equipment" key={a.sourceAssetId} onClick={() => { setOpen(false); onViewAsset?.(a.assetId); }}><Link2 size={16} /><span>{graph.assets.find(item => item.id === a.assetId)?.name || `View equipment ${i + 1}`}</span><ArrowRight size={15} /></button>)}<button className="ops-button" onClick={() => { setStep(0); setBundle(null); setFile(null); }}>Add another capture</button></div>}
        <details className="dru-source-details"><summary>Source file & provenance</summary><p>DRU identities, coordinates, accuracy and sign-offs remain source declarations. Photos retain their exported resolution.</p>{bundle.warnings.map((w, i) => <p key={i}>{w}</p>)}<button className="ops-button" disabled={busy} onClick={() => run(() => downloadDruBundle(bundle.id))}>Download source file</button><small className="dru-digest">SHA256 {bundle.sha256}</small><details><summary>Source sign-offs</summary><pre className="dru-json">{JSON.stringify(bundle.certification, null, 2)}</pre></details></details>
      </>}
    </div>}
  </section>;
}

import { Camera, ChevronRight, ClipboardCheck, FileCheck2 } from 'lucide-react';
import DruEvidenceRecord from './DruEvidenceRecord';
import DruPhoto from './DruPhoto';
const date = v => v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Capture date not supplied';
export default function DruFieldEvidence({ records, photos, connections, onReview, onPhoto, onDownload, canReview }) {
  return <section className="dru-evidence"><div className="section-title"><h3>Field documentation</h3><span className="dru-subtle">{records.length} {records.length === 1 ? 'capture' : 'captures'}</span></div>{records.map(e => {
    const images = photos.filter(p => p.sourceEvidence?.bundleId === e.bundleId && p.sourceEvidence?.sourceAssetId === e.sourceAssetId);
    const related = connections.filter(c => images.some(p => p.connectionId === c.id));
    const inspector = e.inspections?.at(-1);
    return <article className="dru-field-card" key={e.bundleId + e.sourceAssetId}>
      <div className="dru-capture-heading"><span className="dru-equipment-icon"><FileCheck2 size={19} /></span><div><span className="dru-kicker">DRU FIELD CAPTURE</span><h4>{e.properties.utilityComponent || e.properties.component || e.properties.assetType}</h4></div><span className="dru-state">Needs review</span></div>
      <div className="dru-visit-meta"><span><Camera size={13} />{images.length} {images.length === 1 ? 'photo' : 'photos'}</span><span>{date(e.properties.collectionDate || images[0]?.capturedAt)}</span>{inspector && <span><ClipboardCheck size={13} />{typeof inspector.condition === 'string' ? inspector.condition : 'Inspection recorded'}</span>}</div>
      {!!images.length && <div className="dru-photo-strip">{images.slice(0, 3).map(p => <DruPhoto key={p.id} photo={p} onOpen={() => onPhoto(p)} />)}{images.length > 3 && <small className="dru-photo-more">+{images.length - 3} in installation photos</small>}</div>}
      {e.properties.notes && <p className="dru-field-note">{String(e.properties.notes)}</p>}
      <div className="dru-field-footer"><details className="dru-capture-details"><summary>Capture details</summary><DruEvidenceRecord record={e} /><p className="architecture-muted">Added {date(e.importedAt)} by {e.importedBy}. Source reviews require independent confirmation.</p><button className="ops-button" onClick={() => onDownload(e.bundleId)}>Download DRU source file</button></details>{canReview && related.map((c, i) => <button className="dru-text-button" key={c.id} onClick={() => onReview(c)}>Review {related.length === 1 ? 'connection' : `connection ${i + 1}`}<ChevronRight size={14} /></button>)}</div>
    </article>;
  })}</section>;
}

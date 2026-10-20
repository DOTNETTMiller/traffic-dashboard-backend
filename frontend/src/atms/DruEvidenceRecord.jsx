const value = v => v == null || v === '' ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
const when = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
export default function DruEvidenceRecord({ record, profile }) {
  const p = record.properties || {}, captureProfile = profile || record.profile;
  const facts = [
    ['Owner', p.ownerName], ['Installer', p.installerName], ['Captured', when(p.collectionDate)], ['Installed', when(p.installDate)],
    ['Collection method', p.collectionMethod], ['Source document', p.metadataSourceDoc],
    ['Horizontal accuracy · declared', p.positionalAccuracyHzM == null ? null : value(p.positionalAccuracyHzM) + ' m'],
    ['Vertical accuracy · declared', p.positionalAccuracyVtM == null ? null : value(p.positionalAccuracyVtM) + ' m'],
    ['Quality level · declared', p.qualityLevel], ['Horizontal datum', p.horizontalDatum], ['Vertical datum', p.verticalDatum || captureProfile?.verticalDatum]
  ].filter(([, v]) => value(v));
  return <div className="dru-capture-record">
    {!!facts.length && <dl className="dru-facts">{facts.map(([label, v]) => <div key={label}><dt>{label}</dt><dd>{value(v)}</dd></div>)}</dl>}
    {p.qualityLevelJustification && <p className="dru-record-note">Quality declaration: {value(p.qualityLevelJustification)}</p>}
    {!!record.inspections?.length && <div className="dru-record-section"><h4>Field inspections</h4>{record.inspections.map((i, n) => <div className="dru-inspection" key={n}><span><strong>{value(i.inspector) || 'Inspector not supplied'}</strong><small>{when(i.date) || 'Date not supplied'}</small></span><span className="dru-state">{value(i.condition) || 'Recorded'}</span>{i.notes && <p>{value(i.notes)}</p>}</div>)}</div>}
    {!!record.qaReviews?.length && <details className="dru-source-reviews"><summary>DRU review history · {record.qaReviews.length}</summary>{record.qaReviews.map((r, n) => <p key={n}><strong>{value(r.reviewer)}</strong> · {when(r.date)} · {value(r.status)}{r.notes ? ' · ' + value(r.notes) : ''}</p>)}<p className="architecture-muted">Source sign-offs are retained for reference. ATMS verification is separate.</p></details>}
    <details className="dru-source-reviews"><summary>Location, identifiers & source record</summary><p className="architecture-muted">Geometry and accuracy are retained as supplied by DRU. Source asset: {record.sourceAssetId}</p><pre className="dru-json">{JSON.stringify({ geometry: record.geometry, properties: p, profile: captureProfile, inspections: record.inspections, qaReviews: record.qaReviews }, null, 2)}</pre></details>
  </div>;
}

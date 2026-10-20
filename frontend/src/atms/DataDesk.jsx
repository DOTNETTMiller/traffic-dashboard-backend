import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { request, saveJson } from './api';

const time = value => value ? new Date(value).toLocaleString() : 'Not supplied';
export default function DataDesk({ canWrite, onImport, importing, now }) {
  const [streams, setStreams] = useState([]), [page, setPage] = useState({ rows: [], total: 0 });
  const [source, setSource] = useState(''), [offset, setOffset] = useState(0), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [detail, setDetail] = useState(null);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [s, p] = await Promise.all([request('/collections'), request('/collections/observations?limit=50&offset=' + offset + (source ? '&sourceId=' + encodeURIComponent(source) : ''))]);
      setStreams(s.streams); setPage(p); setError('');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [source, offset]);
  useEffect(() => { load(); }, [load, importing]);
  async function inspect(row, history = false) {
    try {
      const result = history ? await request('/collections/observations/' + row.id + '/history') :
        await request('/collections/batches/' + row.batchId + '/replay', { method: 'POST', body: {} });
      setDetail({ title: history ? row.name + ' · retained history' : 'Replay preview · original timestamps preserved', result });
    } catch (e) { setError(e.message); }
  }
  async function download(stream) {
    try { saveJson(await request('/collections/batches/' + stream.batchId), stream.id + '-collection.json'); }
    catch (e) { setError(e.message); }
  }
  return <section className="desk-panel data-desk">
    <div className="panel-heading"><div><h2>Data collection</h2><p>Source observations, measurements and retained evidence across the connected fleet.</p></div>
      <div className="heading-actions"><button className="ops-button" disabled={busy} onClick={load}><RefreshCw size={14} />Refresh readings</button>
        {canWrite && <button className="ops-button primary" disabled={importing} onClick={onImport}>Collect latest data</button>}</div></div>
    {error && <p className="ops-notice error" role="alert">{error}</p>}
    <div className="data-stream-grid">{streams.map(s => <article className="device-card" key={s.id}>
      <div className="section-title"><strong>{s.id}</strong><span className={'badge ' + (['ok', 'empty'].includes(s.status) ? 'good' : 'critical')}>{s.status}</span></div>
      <dl className="source-details"><div><dt>Records received</dt><dd>{s.count.toLocaleString()}</dd></div><div><dt>Collection time</dt><dd>{time(s.lastCollectedAt)}</dd></div><div><dt>Source snapshot time</dt><dd>{time(s.sourceObservedAt)}</dd></div><div><dt>Records needing review</dt><dd>{s.rejected + s.outOfOrder}</dd></div></dl>
      <button className="ops-button compact" onClick={() => download(s)}><Download size={13} />Download captured JSON</button>
    </article>)}</div>
    <div className="queue-filters"><label>Source <select value={source} onChange={e => { setSource(e.target.value); setOffset(0); }}><option value="">All sources</option>{streams.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}</select></label><span>{page.total.toLocaleString()} latest observations · {time(now)}</span></div>
    <div className="data-table-scroll"><table className="ops-table"><thead><tr><th>Asset / report</th><th>Location</th><th>Reading</th><th>Measurement time</th><th>Data quality</th><th>Evidence</th></tr></thead><tbody>
      {page.rows.map(r => <tr key={r.id}><td><strong>{r.name}</strong><br /><small>{r.kind} · {r.sourceId}</small></td><td>{r.route || 'Unknown road'}<br /><small>{r.direction || 'Unknown direction'}{r.lane != null ? ' · Lane ' + r.lane : ''}</small></td>
        <td>{r.measurements.length ? r.measurements.map(m => <div key={m.name}>{m.name}: {m.value} {m.unit}</div>) : r.message !== null ? <span className="data-message">{r.message || 'Reported blank'}</span> : 'No reading supplied'}</td>
        <td>{time(r.observedAt)}<br /><small>Collected {time(r.collectedAt)}</small></td><td><span className={'badge ' + (r.quality === 'current' ? 'good' : 'neutral')}>{r.quality}</span>{r.flags.map(f => <div key={f}><small>{f.replaceAll('-', ' ')}</small></div>)}</td>
        <td><button className="ops-button compact" onClick={() => inspect(r, true)}>History</button>{canWrite && <button className="ops-button compact" onClick={() => inspect(r)}>Replay preview</button>}</td></tr>)}
    </tbody></table></div>
    {!page.rows.length && <div className="ops-empty"><h3>No collected observations</h3><p>Collect a source snapshot to bring existing event, equipment and detector feeds into this workspace.</p></div>}
    <div className="pagination"><span>{page.total ? offset + 1 : 0}–{Math.min(offset + 50, page.total)} of {page.total}</span><button className="ops-button compact" disabled={!offset || busy} onClick={() => setOffset(n => Math.max(0, n - 50))}>Previous</button><button className="ops-button compact" disabled={offset + 50 >= page.total || busy} onClick={() => setOffset(n => n + 50)}>Next</button></div>
    {detail && <div className="data-evidence"><div className="panel-heading"><h3>{detail.title}</h3><button className="ops-button compact" onClick={() => setDetail(null)}>Close</button><button className="ops-button compact" onClick={() => saveJson(detail.result, 'atms-observations.json')}>Download</button></div><pre>{JSON.stringify(detail.result, null, 2)}</pre></div>}
  </section>;
}

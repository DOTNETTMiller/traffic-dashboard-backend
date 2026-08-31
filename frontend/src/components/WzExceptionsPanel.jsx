import { useEffect, useState } from 'react';
import api from '../services/api';

// Work-Zone Exception Queue — the "here's your fix-list and the button" view that closes the loop
// the TomTom deviation scorecard opens. Loads /api/wz/exceptions once (no polling): each deviation
// finding is root-caused into an actionable exception with a deep link that opens the relevant
// state's self-contained builder PRE-FILLED with the flagged zone (detect → diagnose → route →
// correct → re-verify). Sits beside the deviation panel.

const C = {
  good: '#16a34a', warn: '#d97706', bad: '#dc2626', blue: '#2563eb',
  ink: '#111827', sub: '#6b7280', line: '#e5e7eb', bg: '#ffffff', panel: '#f8fafc'
};
const PRI = { 1: C.bad, 2: C.warn, 3: C.sub };
const PRI_BG = { 1: '#fee2e2', 2: '#fef3c7', 3: '#e2e8f0' };
const KIND_LABEL = {
  'stale-active': 'Ghost zone (expired but active)', 'bad-geometry': 'Missing / bad geometry',
  'not-reaching': 'Not reaching drivers', 'timing-mismatch': 'End-date mismatch', 'missing-from-feed': 'Unreported closure'
};

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', minWidth: 110, flex: 1 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: C.sub }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || C.ink, lineHeight: 1.1 }}>{value}</div>
      {sub != null && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Chip({ children }) {
  return <span style={{ background: '#eef2ff', color: '#2563eb', borderRadius: 5, padding: '1px 7px', fontWeight: 600, fontSize: 11 }}>{children}</span>;
}

function Row({ e }) {
  const label = e.kind === 'missing-from-feed' ? 'Create in builder →' : 'Fix in builder →';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, padding: '11px 12px',
      borderTop: `1px solid ${C.line}`, borderLeft: `4px solid ${PRI[e.priority] || C.sub}`, alignItems: 'start' }}>
      <div style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, height: 'fit-content',
        background: PRI_BG[e.priority] || C.panel, color: PRI[e.priority] || C.sub, whiteSpace: 'nowrap' }}>P{e.priority}</div>
      <div>
        <div style={{ fontWeight: 650, color: C.ink, fontSize: 13 }}>{KIND_LABEL[e.kind] || e.kind}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '3px 0 5px', fontSize: 12, color: C.sub }}>
          {e.state && <Chip>{String(e.state).toUpperCase()}</Chip>}
          {e.route && <Chip>{e.route}</Chip>}
          {e.county && <span>{e.county} Co.</span>}
          {e.coordinates && <span>{e.coordinates[1].toFixed(3)}, {e.coordinates[0].toFixed(3)}</span>}
        </div>
        <div style={{ fontSize: 12.5, color: C.ink, marginBottom: 4 }}>{e.reason}</div>
        <span style={{ fontSize: 12, color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6, padding: '4px 8px', display: 'inline-block' }}>✔ {e.fix}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        {e.builderUrl
          ? <a href={e.builderUrl} target="_blank" rel="noopener noreferrer" style={{ background: C.blue, color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>{label}</a>
          : <span style={{ background: '#e2e8f0', color: '#94a3b8', borderRadius: 8, padding: '8px 12px', fontSize: 12.5 }}>no builder</span>}
        {e.coordinates && <a href={`https://www.google.com/maps?q=${e.coordinates[1]},${e.coordinates[0]}`} target="_blank" rel="noopener noreferrer" style={{ border: `1px solid ${C.blue}`, color: C.blue, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }}>map</a>}
      </div>
    </div>
  );
}

export default function WzExceptionsPanel({ onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    api.get('/api/wz/exceptions')
      .then((res) => { if (!cancelled) setData(res && res.data); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const exs = (data && data.exceptions) || [];
  const kinds = [...new Set(exs.map((e) => e.kind))];
  const shown = exs.filter((e) => filter === 'all' || e.kind === filter);
  const cov = data && data.coveragePct;
  const covColor = cov == null ? C.sub : cov >= 80 ? C.good : cov >= 60 ? C.warn : C.bad;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 4000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.bg, borderRadius: 12, width: 'min(860px, 96vw)',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>🛠️ Fix Queue — turn deviations into corrections</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: C.sub }}>×</button>
        </div>

        <div style={{ padding: '16px 18px' }}>
          {error && <div style={{ color: C.bad, fontSize: 13 }}>Couldn’t load: {error}</div>}
          {!error && !data && <div style={{ color: C.sub, fontSize: 13 }}>Loading…</div>}

          {data && (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <Stat label="Coverage" value={cov == null ? '—' : `${cov}%`} sub="reaching nav" color={covColor} />
                <Stat label="Findings" value={data.total} sub="open exceptions" />
                <Stat label="Actionable" value={data.actionable} sub="have a builder" color={C.blue} />
                {data.reverify && <Stat label="Resolved" value={data.reverify.resolvedRecently} sub="re-verified gone" color={C.good} />}
              </div>

              {data.note && <div style={{ marginBottom: 10, fontSize: 12, color: C.warn }}>{data.note}</div>}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {['all', ...kinds].map((k) => (
                  <button key={k} onClick={() => setFilter(k)} style={{ border: `1px solid ${filter === k ? C.blue : C.line}`,
                    background: filter === k ? C.blue : '#fff', color: filter === k ? '#fff' : C.sub, borderRadius: 999,
                    padding: '5px 12px', fontSize: 12.5, cursor: 'pointer' }}>{k === 'all' ? 'All' : (KIND_LABEL[k] || k)}</button>
                ))}
              </div>

              {shown.length === 0
                ? <div style={{ fontSize: 13, color: C.sub, fontStyle: 'italic', padding: 20, textAlign: 'center' }}>No exceptions in this view — coverage is clean. 🎉</div>
                : (
                  <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
                    {shown.map((e) => <Row key={e.id} e={e} />)}
                  </div>
                )}

              <div style={{ marginTop: 12, fontSize: 11, color: C.sub }}>
                Each finding is root-caused and deep-links into that state’s self-contained builder pre-filled with the zone.
                Submitting the correction carries the exception id back (x_resolves_exception) so the loop closes; the “Resolved” count re-verifies when a flagged zone stops deviating on the next nav pull.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

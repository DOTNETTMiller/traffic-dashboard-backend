import { useEffect, useState } from 'react';
import api from '../services/api';

// TomTom deviation scorecard — the "what's getting through?" view.
// Loads /api/tomtom/deviation once (no polling) and shows how DOT-reported work zones line up
// against TomTom's independent nav feed: matched, DOT-only (not reaching drivers), TomTom-only
// (unreported by the DOT), timing gaps, and an overall coverage %.

const C = {
  good: '#16a34a', warn: '#d97706', bad: '#dc2626', blue: '#2563eb',
  ink: '#111827', sub: '#6b7280', line: '#e5e7eb', bg: '#ffffff', panel: '#f8fafc'
};

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', minWidth: 120, flex: 1 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: C.sub }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || C.ink, lineHeight: 1.1 }}>{value}</div>
      {sub != null && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function List({ title, hint, rows, color, cols }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 7 }} />
        {title} <span style={{ color: C.sub, fontWeight: 500 }}>({rows.length})</span>
      </div>
      <div style={{ fontSize: 11.5, color: C.sub, margin: '2px 0 6px' }}>{hint}</div>
      {rows.length === 0
        ? <div style={{ fontSize: 12, color: C.sub, fontStyle: 'italic' }}>none</div>
        : (
          <div style={{ maxHeight: 190, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 8 }}>
            {rows.slice(0, 150).map((r, i) => (
              <div key={r.id || i} style={{ display: 'flex', gap: 10, padding: '6px 10px', borderTop: i ? `1px solid ${C.line}` : 'none', fontSize: 12.5 }}>
                <div style={{ minWidth: 58, fontWeight: 600, color: C.ink }}>{r.route || '—'}</div>
                <div style={{ color: C.sub, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cols === 'tt' ? (r.category ? `${r.category} · ` : '') : ''}{r.description || r.id || ''}
                </div>
              </div>
            ))}
            {rows.length > 150 && <div style={{ padding: '6px 10px', fontSize: 11.5, color: C.sub }}>…and {rows.length - 150} more</div>}
          </div>
        )}
    </div>
  );
}

export default function TomTomDeviationPanel({ onClose, onShowOnMap }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/tomtom/deviation')
      .then((res) => { if (!cancelled) setData(res && res.data); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const s = data && data.summary;
  const cov = s && s.coveragePct;
  const covColor = cov == null ? C.sub : cov >= 80 ? C.good : cov >= 60 ? C.warn : C.bad;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 4000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.bg, borderRadius: 12, width: 'min(780px, 96vw)',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>🚗 TomTom Deviation — what’s getting through?</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onShowOnMap && (
              <button onClick={() => onShowOnMap(data)} style={{ border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8',
                fontWeight: 600, fontSize: 13, cursor: 'pointer', borderRadius: 8, padding: '6px 12px' }}>📍 Show gaps on map</button>
            )}
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: C.sub }}>×</button>
          </div>
        </div>

        <div style={{ padding: '16px 18px' }}>
          {error && <div style={{ color: C.bad, fontSize: 13 }}>Couldn’t load: {error}</div>}
          {!error && !data && <div style={{ color: C.sub, fontSize: 13 }}>Loading…</div>}

          {data && s && (
            <>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                <div style={{ textAlign: 'center', minWidth: 120 }}>
                  <div style={{ fontSize: 44, fontWeight: 800, color: covColor, lineHeight: 1 }}>{cov == null ? '—' : `${cov}%`}</div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>of DOT zones<br />also visible in nav</div>
                </div>
                <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
                  <Stat label="Matched" value={s.matched} sub="DOT + nav agree" color={C.good} />
                  <Stat label="DOT-only" value={s.dotOnly} sub="⚠ not reaching drivers" color={C.bad} />
                  <Stat label="TomTom-only" value={s.tomtomOnly} sub="unreported by DOT" color={C.warn} />
                  <Stat label="Timing gaps" value={s.timingGaps} sub="windows disagree" color={C.blue} />
                </div>
              </div>

              <div style={{ fontSize: 11.5, color: C.sub, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
                {s.dotZones} active DOT work zones · {s.tomtomWorkZones} TomTom work-zone incidents · {data.incidentsCached} incidents cached
                {data.tomtomStatus && data.tomtomStatus !== 'ok' && <span style={{ color: C.bad }}> · TomTom: {data.tomtomStatus}</span>}
                {data.lastZonePull && <> · last pull {new Date(data.lastZonePull).toLocaleString()}</>}
              </div>

              {data.note && <div style={{ marginTop: 8, fontSize: 12, color: C.warn }}>{data.note}</div>}

              <List title="DOT-only — reported, but not showing in nav" color={C.bad}
                hint="Drivers’ navigation isn’t surfacing these — the message may not be getting through."
                rows={data.dotOnly || []} />
              <List title="TomTom-only — nav sees it, DOT didn’t report" color={C.warn} cols="tt"
                hint="Independent evidence of a work zone / closure the DOT feed is missing."
                rows={data.tomtomOnly || []} />
              {data.timingGaps && data.timingGaps.length > 0 && (
                <List title="Timing gaps — matched, but end times disagree" color={C.blue}
                  hint="Same zone, but the DOT and nav end times are more than a day apart." rows={data.timingGaps} />
              )}

              <div style={{ marginTop: 12, fontSize: 11, color: C.sub }}>
                Match rule: same road (read from the zone’s description, not the coarse corridor tag) within ~1.2 km, or tight proximity when a road can’t be read. Geometry-based. Read-only — no extra API calls.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

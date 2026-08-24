import { useEffect, useState } from 'react';
import api from '../services/api';

// Validation-monitoring panel for device↔work-zone associations.
// Loads /api/devices/health once (no polling) and shows feed health, match quality,
// validation pass/warn/fail, coverage, a trend sparkline, and the anomaly list.

const C = {
  pass: '#16a34a', warn: '#d97706', fail: '#dc2626',
  ink: '#111827', sub: '#6b7280', line: '#e5e7eb', bg: '#ffffff', panel: '#f8fafc'
};

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', minWidth: 110 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: C.sub }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || C.ink, lineHeight: 1.1 }}>{value}</div>
      {sub != null && <div style={{ fontSize: 11, color: C.sub }}>{sub}</div>}
    </div>
  );
}

// Minimal inline SVG sparkline for one numeric series.
function Sparkline({ data, accessor, color, label, fmt = (v) => v }) {
  const pts = (data || []).map(accessor).filter((v) => Number.isFinite(v));
  if (pts.length < 2) return <div style={{ fontSize: 12, color: C.sub }}>{label}: not enough history yet</div>;
  const w = 260, h = 40, min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const step = w / (pts.length - 1);
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`).join(' ');
  return (
    <div>
      <div style={{ fontSize: 11, color: C.sub, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span><span>now: {fmt(pts[pts.length - 1])}</span>
      </div>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <path d={d} fill="none" stroke={color} strokeWidth="1.8" />
      </svg>
    </div>
  );
}

export default function DeviceValidationPanel({ onClose, onShowOnMap }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/devices/health')
      .then((res) => { if (!cancelled) setData(res && res.data); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const s = data && data.summary;
  const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 4000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.bg, borderRadius: 12, width: 'min(760px, 96vw)',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>🔶 Connected Device Validation</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onShowOnMap && (
              <button onClick={onShowOnMap} style={{
                border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8', fontWeight: 600,
                fontSize: 13, cursor: 'pointer', borderRadius: 8, padding: '6px 12px' }}>
                📍 Show on map
              </button>
            )}
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: C.sub }}>×</button>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          {error && <div style={{ color: C.fail }}>Failed to load: {error}</div>}
          {!data && !error && <div style={{ color: C.sub }}>Loading…</div>}

          {s && (
            <>
              {s.timestamp && <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>As of {new Date(s.timestamp).toLocaleString()}</div>}

              <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', marginBottom: 6 }}>Feed &amp; Matching</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <Stat label="Feed" value={s.feed.ok ? 'OK' : 'DOWN'} sub={`${s.feed.devices} devices`} color={s.feed.ok ? C.pass : C.fail} />
                <Stat label="Displaying" value={s.feed.displaying} sub={`${s.feed.stale} stale`} />
                <Stat label="Auto-linked" value={s.matching.autoLinked} sub={`${s.matching.review} review · ${s.matching.unmatched} none`} color={C.pass} />
                <Stat label="Match rate" value={pct(s.matching.matchRate)} />
                <Stat label="Avg conf" value={s.matching.avgConfidence == null ? '—' : `${s.matching.avgConfidence}%`} />
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', marginBottom: 6 }}>Validation &amp; Coverage</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <Stat label="Pass" value={s.validation.pass} color={C.pass} />
                <Stat label="Warn" value={s.validation.warn} color={C.warn} />
                <Stat label="Fail" value={s.validation.fail} color={C.fail} />
                <Stat label="Pass rate" value={pct(s.validation.passRate)} />
                <Stat label="Coverage" value={pct(s.coverage.coverageRate)} sub={`${s.coverage.zonesWithDevice}/${s.coverage.workZones} zones`} />
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', marginBottom: 8 }}>Trend</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 16 }}>
                <Sparkline data={data.trend} accessor={(t) => t.autoLinked} color={C.pass} label="Auto-linked" />
                <Sparkline data={data.trend} accessor={(t) => t.avgConfidence} color="#2563eb" label="Avg confidence" fmt={(v) => `${v}%`} />
                <Sparkline data={data.trend} accessor={(t) => (t.matchRate == null ? NaN : t.matchRate * 100)} color="#7c3aed" label="Match rate" fmt={(v) => `${Math.round(v)}%`} />
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', marginBottom: 8 }}>
                Anomalies ({(data.anomalies || []).length})
              </div>
              {(data.anomalies || []).length === 0
                ? <div style={{ fontSize: 13, color: C.sub }}>None — all links pass validation.</div>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {data.anomalies.map((a, i) => (
                      <div key={i} style={{ border: `1px solid ${C.line}`, borderLeft: `4px solid ${a.status === 'fail' ? C.fail : C.warn}`,
                        borderRadius: 6, padding: '8px 10px', fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: C.ink }}>{a.device}</span>
                          <span style={{ color: a.status === 'fail' ? C.fail : C.warn, fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{a.status}</span>
                        </div>
                        <div style={{ color: C.sub, margin: '2px 0' }}>→ {a.road_event_id} ({a.confidence}%)</div>
                        <div style={{ color: C.ink }}>{(a.flags || []).join(' · ')}</div>
                      </div>
                    ))}
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

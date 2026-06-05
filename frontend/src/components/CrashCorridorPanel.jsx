import { useState, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';

// Corridor crash intelligence for I-80 / I-35.
//
// COST DESIGN: the static FARS breakdown and the live incident list are each
// fetched ONCE on mount. All corridor / year / work-zone filtering happens
// client-side against that data — changing a filter makes no network call.
// This keeps egress (the platform's cost driver) to a single small payload.
//
//   • Live    — crash-type incidents from the /api/events cache (approx flags).
//   • History — NHTSA FARS fatal crashes, with verified commercial-vehicle and
//               work-zone attributes, including CMV-in-work-zone crashes.

const SEVERITY_COLORS = { high: '#dc2626', medium: '#f59e0b', low: '#10b981', unknown: '#9ca3af' };

const card = { background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '16px', textAlign: 'center' };
const statLabel = { fontSize: '12px', color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' };

const StatCard = ({ label, value, color = '#111827', sub }) => (
  <div style={card}>
    <div style={statLabel}>{label}</div>
    <div style={{ fontSize: '28px', fontWeight: 'bold', color }}>{value}</div>
    {sub && <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{sub}</div>}
  </div>
);

const CrashCorridorPanel = () => {
  // Filters (client-side only).
  const [corridor, setCorridor] = useState('Both'); // 'I-80' | 'I-35' | 'Both'
  const [year, setYear] = useState('all');          // 'all' | <number>

  // Loaded-once data.
  const [stats, setStats] = useState(null);
  const [statsStatus, setStatsStatus] = useState('loading'); // loading | ready | unavailable | error
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveActivity, setLiveActivity] = useState([]);       // notable live events (incidents/closures/weather)
  const [liveBreakdown, setLiveBreakdown] = useState([]);     // [{ state, corridor, eventType, count }]
  const [liveError, setLiveError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [liveView, setLiveView] = useState('crashes');        // 'crashes' | 'activity'

  // AI report state.
  const [report, setReport] = useState(null);    // markdown string
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

  const load = useCallback(async () => {
    setStatsStatus('loading');
    setLiveError(null);

    const statsP = api.getCrashStats() // no params → full breakdown, filtered locally
      .then(data => { setStats(data); setStatsStatus('ready'); })
      .catch(err => {
        if (err.response?.status === 404) setStatsStatus('unavailable');
        else { console.error('Crash stats fetch failed:', err); setStatsStatus('error'); }
        setStats(null);
      });

    const liveP = api.getLiveCrashes() // both corridors → filtered locally
      .then(data => {
        setLiveEvents(data?.events || []);
        setLiveActivity(data?.activity || []);
        setLiveBreakdown(data?.summary?.activity?.breakdown || []);
      })
      .catch(err => {
        console.error('Live crash fetch failed:', err);
        setLiveError(err.response?.data?.error || err.message || 'Failed to load live crashes');
        setLiveEvents([]);
        setLiveActivity([]);
        setLiveBreakdown([]);
      });

    await Promise.allSettled([statsP, liveP]);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => { load(); }, [load]); // ONCE on mount

  const corridorMatch = (c) => corridor === 'Both' || c === corridor;

  // Draft an AI report for the CURRENT selection (one OpenAI call on click).
  const draftReport = useCallback(async () => {
    setReportLoading(true);
    setReportError(null);
    setReport(null);
    try {
      const data = await api.generateCrashReport({ corridor, year });
      setReport(data?.report || 'No report returned.');
    } catch (err) {
      setReportError(err.response?.data?.error || err.message || 'Failed to draft report');
    } finally {
      setReportLoading(false);
    }
  }, [corridor, year]);

  // Selection changes invalidate a previously drafted report (it was for a different scope).
  useEffect(() => { setReport(null); setReportError(null); }, [corridor, year]);

  const downloadReport = () => {
    if (!report) return;
    const scope = `${corridor}_${year === 'all' ? 'all-years' : year}`;
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crash-report_${scope}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Years available in the data (for the dropdown).
  const years = useMemo(() => {
    const set = new Set((stats?.breakdown || []).map(r => r.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [stats]);

  // Filtered historical summary, computed client-side from the breakdown.
  const filtered = useMemo(() => {
    const rows = (stats?.breakdown || []).filter(r =>
      corridorMatch(r.corridor) && (year === 'all' || r.year === Number(year))
    );
    const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
    return {
      totalCrashes: sum('crashes'),
      commercialVehicleCrashes: sum('commercialVehicleCrashes'),
      workZoneCrashes: sum('workZoneCrashes'),
      cmvWorkZoneCrashes: sum('cmvWorkZoneCrashes'),
      fatalities: sum('fatalities'),
      totalVehicles: sum('totalVehicles'),
      rows
    };
  }, [stats, corridor, year]);

  // Per-year table (respecting the corridor filter; summed across corridors when Both).
  const byYear = useMemo(() => {
    const m = {};
    for (const r of (stats?.breakdown || [])) {
      if (!corridorMatch(r.corridor)) continue;
      const y = (m[r.year] = m[r.year] || { year: r.year, crashes: 0, commercialVehicleCrashes: 0, workZoneCrashes: 0, cmvWorkZoneCrashes: 0, totalVehicles: 0 });
      y.crashes += r.crashes; y.commercialVehicleCrashes += r.commercialVehicleCrashes;
      y.workZoneCrashes += r.workZoneCrashes; y.cmvWorkZoneCrashes += r.cmvWorkZoneCrashes;
      y.totalVehicles += (r.totalVehicles || 0);
    }
    return Object.values(m).sort((a, b) => b.year - a.year);
  }, [stats, corridor]);

  // Per-state historical breakdown (all years; respects the corridor filter).
  const stateRows = useMemo(() => {
    const m = {};
    for (const r of (stats?.byState || [])) {
      if (!corridorMatch(r.corridor)) continue;
      const s = (m[r.state] = m[r.state] || { state: r.state, crashes: 0, commercialVehicleCrashes: 0, workZoneCrashes: 0, cmvWorkZoneCrashes: 0, fatalities: 0 });
      s.crashes += r.crashes; s.commercialVehicleCrashes += r.commercialVehicleCrashes;
      s.workZoneCrashes += r.workZoneCrashes; s.cmvWorkZoneCrashes += r.cmvWorkZoneCrashes;
      s.fatalities += (r.fatalities || 0);
    }
    return Object.values(m).sort((a, b) => b.crashes - a.crashes);
  }, [stats, corridor]);

  // Live events filtered by corridor (client-side).
  const liveFiltered = useMemo(
    () => liveEvents.filter(e => corridorMatch((e.corridor || '').toUpperCase())),
    [liveEvents, corridor]
  );
  const liveSummary = {
    total: liveFiltered.length,
    crashes: liveFiltered.filter(e => e.isCrash).length,
    commercialVehicle: liveFiltered.filter(e => e.involvesCommercialVehicle).length,
    workZone: liveFiltered.filter(e => e.inWorkZone).length,
    fatal: liveFiltered.filter(e => e.isFatal).length
  };

  // All-activity view (client-side, corridor-filtered): notable live events + per-state breakdown.
  const activityFiltered = useMemo(
    () => liveActivity.filter(e => corridorMatch((e.corridor || '').toUpperCase())),
    [liveActivity, corridor]
  );
  const ACTIVITY_TYPES = ['Incident', 'Construction', 'work-zone', 'Closure', 'Weather'];
  const stateBreakdown = useMemo(() => {
    const byState = {};
    for (const r of liveBreakdown) {
      if (!corridorMatch((r.corridor || '').toUpperCase())) continue;
      const s = (byState[r.state] = byState[r.state] || { state: r.state, total: 0 });
      s.total += r.count;
      s[r.eventType] = (s[r.eventType] || 0) + r.count;
    }
    return Object.values(byState).sort((a, b) => b.total - a.total);
  }, [liveBreakdown, corridor]);
  const activityTotal = useMemo(() => stateBreakdown.reduce((a, s) => a + s.total, 0), [stateBreakdown]);

  const pct = (part, whole) => whole ? `${Math.round(100 * part / whole)}% of total` : null;

  const TYPE_COLORS = { Incident: '#dc2626', Construction: '#d97706', 'work-zone': '#d97706', Closure: '#7c3aed', Weather: '#0891b2', Unknown: '#6b7280' };

  return (
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
            Corridor Crash Intelligence
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
            Live incidents + NHTSA FARS history for I-80 &amp; I-35 — commercial-vehicle and work-zone breakdowns
            {lastRefresh && <span style={{ marginLeft: '12px', color: '#9ca3af' }}>Loaded {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button onClick={load} title="Reload data" style={{ padding: '8px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '14px' }}>
          🔄 Reload
        </button>
      </div>

      {/* Filters (client-side; no network calls) */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '2px solid #e5e7eb' }}>
          {['I-80', 'I-35', 'Both'].map(c => (
            <button key={c} onClick={() => setCorridor(c)} style={{
              padding: '8px 18px', border: 'none',
              background: corridor === c ? '#FF8F35' : 'white',
              color: corridor === c ? 'white' : '#374151',
              fontSize: '14px', fontWeight: corridor === c ? '600' : '400', cursor: 'pointer'
            }}>{c}</button>
          ))}
        </div>
        <label style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '5px 8px 5px 14px', borderRadius: '10px',
          border: `2px solid ${year !== 'all' ? '#FF8F35' : '#e5e7eb'}`,
          background: year !== 'all' ? '#fff7ed' : 'white'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: year !== 'all' ? '#b45309' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.6px' }}>📅 Year</span>
          <select value={year} onChange={e => setYear(e.target.value)} style={{
            padding: '8px 12px', borderRadius: '8px', border: '2px solid #e5e7eb',
            fontSize: '15px', fontWeight: 600, color: '#111827', background: 'white', cursor: 'pointer'
          }}>
            <option value="all">All years{stats?.summary?.yearRange ? ` (${stats.summary.yearRange})` : ''}</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>

        {statsStatus === 'ready' && filtered.totalCrashes > 0 && (
          <button
            onClick={draftReport}
            disabled={reportLoading}
            title="Draft an AI safety brief for the current corridor + year selection"
            style={{
              marginLeft: 'auto', padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: reportLoading ? '#d1d5db' : '#111827', color: 'white',
              fontSize: '14px', fontWeight: 600, cursor: reportLoading ? 'default' : 'pointer'
            }}
          >
            {reportLoading ? '✍️ Drafting…' : '📝 Draft AI report'}
          </button>
        )}
      </div>

      {/* AI report */}
      {(report || reportError) && (
        <div style={{ ...card, textAlign: 'left', marginBottom: '24px', borderColor: reportError ? '#fecaca' : '#c7d2fe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
              🤖 AI safety brief · {corridor}{year !== 'all' ? ` · ${year}` : ''}
            </div>
            {report && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => navigator.clipboard?.writeText(report)} style={{ fontSize: '12px', padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>Copy</button>
                <button onClick={downloadReport} style={{ fontSize: '12px', padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>Download .md</button>
              </div>
            )}
          </div>
          {reportError ? (
            <div style={{ color: '#ef4444', fontSize: '13px' }}>{reportError}</div>
          ) : (
            <div style={{ fontSize: '13px', color: '#1f2937', lineHeight: 1.55 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
            </div>
          )}
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>Generated by gpt-4o-mini from the figures above — review before distribution.</div>
        </div>
      )}

      {/* ---- LIVE SECTION (real-time) ---- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', margin: '0 0 12px 0' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', margin: 0 }}>
          {liveView === 'crashes' ? '🔴 Crashes right now' : '🟠 Live corridor activity'}
          <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '13px', marginLeft: '8px' }}>(live state DOT feeds — {corridor === 'Both' ? 'I-80 & I-35' : corridor})</span>
        </h2>
        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '2px solid #e5e7eb' }}>
          {[['crashes', 'Crashes'], ['activity', 'All activity']].map(([v, label]) => (
            <button key={v} onClick={() => setLiveView(v)} style={{
              padding: '6px 14px', border: 'none',
              background: liveView === v ? '#111827' : 'white',
              color: liveView === v ? 'white' : '#374151',
              fontSize: '13px', fontWeight: liveView === v ? 600 : 400, cursor: 'pointer'
            }}>{label}</button>
          ))}
        </div>
      </div>

      {liveError ? (
        <div style={{ ...card, color: '#ef4444', marginBottom: '24px' }}>Error loading live crashes: {liveError}</div>
      ) : liveView === 'crashes' ? (
        <>
          {/* Hero number + filter sub-stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 3fr', gap: '12px', marginBottom: '16px', alignItems: 'stretch' }}>
            <div style={{ ...card, background: '#111827', border: 'none', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ ...statLabel, color: '#9ca3af' }}>Active incidents</div>
              <div style={{ fontSize: '48px', fontWeight: 'bold', lineHeight: 1 }}>{liveSummary.total}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
              <StatCard label="Read as crashes" value={liveSummary.crashes} color="#ef4444" />
              <StatCard label="Work zone" value={liveSummary.workZone} color="#d97706" sub="inferred" />
              <StatCard label="Large CMV" value={liveSummary.commercialVehicle} color="#b45309" sub="inferred" />
              <StatCard label="Fatal" value={liveSummary.fatal} color="#dc2626" sub="if stated" />
            </div>
          </div>

          <div style={{ ...card, textAlign: 'left', marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
            {liveFiltered.length === 0 ? (
              <div style={{ padding: '20px', color: '#6b7280', textAlign: 'center' }}>
                No active crash-type incidents on {corridor === 'Both' ? 'I-80 / I-35' : corridor} right now.
              </div>
            ) : (
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {liveFiltered.map((e, i) => (
                  <div key={e.id || i} style={{ display: 'flex', gap: '10px', padding: '10px 14px', borderBottom: i < liveFiltered.length - 1 ? '1px solid #f3f4f6' : 'none', alignItems: 'flex-start' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0, background: SEVERITY_COLORS[e.severity] || SEVERITY_COLORS.unknown }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: '#111827', fontWeight: 500 }}>{e.headline || e.title || e.description || 'Incident'}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        {e.state || ''}{e.corridor ? ` · ${e.corridor}` : ''}
                        {e.involvesCommercialVehicle && <span style={{ color: '#b45309', marginLeft: '8px' }}>🚛 CMV</span>}
                        {e.isCrash && <span style={{ color: '#ef4444', marginLeft: '8px' }}>crash</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ---- ALL LIVE ACTIVITY (per state) ---- */
        <>
          <div style={{ ...card, textAlign: 'left', marginBottom: '16px', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', fontSize: '13px', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
              {activityTotal} live event{activityTotal === 1 ? '' : 's'} on {corridor === 'Both' ? 'I-80 / I-35' : corridor} across {stateBreakdown.length} state{stateBreakdown.length === 1 ? '' : 's'} — every DOT feed type (most states publish work zones; crashes show only where a state feeds incidents).
            </div>
            {stateBreakdown.length === 0 ? (
              <div style={{ padding: '20px', color: '#6b7280', textAlign: 'center' }}>No live corridor activity right now.</div>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ color: '#6b7280' }}>
                      <th style={{ padding: '8px 14px', textAlign: 'left', position: 'sticky', top: 0, background: 'white' }}>State</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', position: 'sticky', top: 0, background: 'white' }}>Total</th>
                      {ACTIVITY_TYPES.map(t => (
                        <th key={t} style={{ padding: '8px 10px', textAlign: 'right', color: TYPE_COLORS[t], position: 'sticky', top: 0, background: 'white' }}>{t === 'work-zone' ? 'Work zone' : t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stateBreakdown.map((s) => (
                      <tr key={s.state} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 14px', fontWeight: 500, color: '#111827' }}>{s.state}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{s.total}</td>
                        {ACTIVITY_TYPES.map(t => (
                          <td key={t} style={{ padding: '8px 10px', textAlign: 'right', color: s[t] ? (t === 'Incident' ? '#dc2626' : '#374151') : '#d1d5db', fontWeight: (t === 'Incident' && s[t]) ? 700 : 400 }}>{s[t] || '·'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {activityFiltered.length > 0 && (
            <div style={{ ...card, textAlign: 'left', marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', fontSize: '12px', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>Notable live events (incidents · closures · weather)</div>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {activityFiltered.map((e, i) => (
                  <div key={e.id || i} style={{ display: 'flex', gap: '10px', padding: '10px 14px', borderBottom: i < activityFiltered.length - 1 ? '1px solid #f3f4f6' : 'none', alignItems: 'flex-start' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0, background: TYPE_COLORS[e.eventType] || '#9ca3af' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: '#111827', fontWeight: 500 }}>{e.headline || e.eventType}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        {e.state || ''}{e.corridor ? ` · ${e.corridor}` : ''}
                        <span style={{ color: TYPE_COLORS[e.eventType] || '#6b7280', marginLeft: '8px' }}>{e.eventType}</span>
                        {e.involvesCommercialVehicle && <span style={{ color: '#b45309', marginLeft: '8px' }}>🚛 CMV</span>}
                        {e.isCrash && <span style={{ color: '#ef4444', marginLeft: '8px' }}>crash</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- VERIFIED HISTORICAL (FARS) ---- */}
      <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', margin: '0 0 12px 0' }}>
        📊 Verified history <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '13px' }}>(NHTSA FARS — fatal crashes{year !== 'all' ? ` · ${year}` : ''})</span>
      </h2>

      {statsStatus === 'unavailable' ? (
        <div style={{ ...card, color: '#6b7280', marginBottom: '24px' }}>
          Historical FARS data hasn’t been loaded yet. It populates on the monthly refresh, or run <code>POST /api/crashes/refresh</code> once.
        </div>
      ) : statsStatus === 'error' ? (
        <div style={{ ...card, color: '#ef4444', marginBottom: '24px' }}>Error loading historical crash stats.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <StatCard label="Fatal crashes" value={statsStatus === 'loading' ? '…' : filtered.totalCrashes} />
            <StatCard label="Commercial vehicle" value={statsStatus === 'loading' ? '…' : filtered.commercialVehicleCrashes} color="#b45309" sub={pct(filtered.commercialVehicleCrashes, filtered.totalCrashes)} />
            <StatCard label="Work-zone crashes" value={statsStatus === 'loading' ? '…' : filtered.workZoneCrashes} color="#d97706" sub={pct(filtered.workZoneCrashes, filtered.totalCrashes)} />
            <StatCard label="CMV in work zones" value={statsStatus === 'loading' ? '…' : filtered.cmvWorkZoneCrashes} color="#9a3412" sub={filtered.workZoneCrashes ? `${Math.round(100 * filtered.cmvWorkZoneCrashes / filtered.workZoneCrashes)}% of WZ` : null} />
            <StatCard label="Total vehicles" value={statsStatus === 'loading' ? '…' : filtered.totalVehicles} color="#374151" sub={filtered.totalCrashes ? `${(filtered.totalVehicles / filtered.totalCrashes).toFixed(1)}/crash` : null} />
            <StatCard label="Total fatalities" value={statsStatus === 'loading' ? '…' : filtered.fatalities} color="#dc2626" sub={filtered.totalCrashes ? `${(filtered.fatalities / filtered.totalCrashes).toFixed(2)}/crash` : null} />
          </div>

          {/* Source citation */}
          <div style={{ fontSize: '12px', color: '#6b7280', background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', lineHeight: 1.5 }}>
            <strong style={{ color: '#374151' }}>Source:</strong>{' '}
            <a href={stats?.sourceUrl || 'https://www.nhtsa.gov/file-downloads?p=nhtsa/downloads/FARS/'} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
              NHTSA FARS National CSV
            </a>
            {stats?.summary?.yearRange ? `, ${stats.summary.yearRange}` : ''}
            {stats?.summary?.updatedAt ? ` · retrieved ${new Date(stats.summary.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}
            . Fatal crashes only; FARS lags ~1–2 years. On-corridor = within ~1 mi of the I-80/I-35 centerline on an Interstate route. A fatal crash can involve multiple fatalities, so fatalities ≥ crashes.
          </div>

          {byYear.length > 0 && (
            <div style={{ ...card, textAlign: 'left', marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>
                By year{corridor !== 'Both' ? ` · ${corridor}` : ''}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px' }}>Year</th>
                    <th style={{ padding: '4px 8px' }}>Crashes</th>
                    <th style={{ padding: '4px 8px' }}>CMV</th>
                    <th style={{ padding: '4px 8px' }}>Work zone</th>
                    <th style={{ padding: '4px 8px' }}>CMV in WZ</th>
                    <th style={{ padding: '4px 8px' }}>Vehicles</th>
                  </tr>
                </thead>
                <tbody>
                  {byYear.map(y => (
                    <tr key={y.year} style={{ borderTop: '1px solid #f3f4f6', background: year !== 'all' && Number(year) === y.year ? '#fff7ed' : 'transparent' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 500 }}>{y.year}</td>
                      <td style={{ padding: '4px 8px' }}>{y.crashes}</td>
                      <td style={{ padding: '4px 8px', color: '#b45309' }}>{y.commercialVehicleCrashes}</td>
                      <td style={{ padding: '4px 8px', color: '#d97706' }}>{y.workZoneCrashes}</td>
                      <td style={{ padding: '4px 8px', color: '#9a3412' }}>{y.cmvWorkZoneCrashes}</td>
                      <td style={{ padding: '4px 8px', color: '#374151' }}>{y.totalVehicles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {stateRows.length > 0 && (
            <div style={{ ...card, textAlign: 'left', marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>
                By state{corridor !== 'Both' ? ` · ${corridor}` : ''} <span style={{ fontWeight: 400, color: '#9ca3af' }}>(all years)</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px' }}>State</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>Crashes</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>CMV</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>Work zone</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>CMV in WZ</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>Fatalities</th>
                  </tr>
                </thead>
                <tbody>
                  {stateRows.map(s => (
                    <tr key={s.state} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 500 }}>{s.state}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{s.crashes}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#b45309' }}>{s.commercialVehicleCrashes}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#d97706' }}>{s.workZoneCrashes}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#9a3412' }}>{s.cmvWorkZoneCrashes}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#dc2626' }}>{s.fatalities}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '12px' }}>
        Filters apply client-side — switching corridor or year makes no new network call. The live counter reflects the latest dashboard data (no polling); FARS is fatal crashes only and lags ~1–2 years; live work-zone/CMV/fatal flags are text-inferred.
      </p>
    </div>
  );
};

export default CrashCorridorPanel;

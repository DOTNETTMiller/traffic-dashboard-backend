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
  const [liveError, setLiveError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

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
      .then(data => { setLiveEvents(data?.events || []); })
      .catch(err => {
        console.error('Live crash fetch failed:', err);
        setLiveError(err.response?.data?.error || err.message || 'Failed to load live crashes');
        setLiveEvents([]);
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
      rows
    };
  }, [stats, corridor, year]);

  // Per-year table (respecting the corridor filter; summed across corridors when Both).
  const byYear = useMemo(() => {
    const m = {};
    for (const r of (stats?.breakdown || [])) {
      if (!corridorMatch(r.corridor)) continue;
      const y = (m[r.year] = m[r.year] || { year: r.year, crashes: 0, commercialVehicleCrashes: 0, workZoneCrashes: 0, cmvWorkZoneCrashes: 0 });
      y.crashes += r.crashes; y.commercialVehicleCrashes += r.commercialVehicleCrashes;
      y.workZoneCrashes += r.workZoneCrashes; y.cmvWorkZoneCrashes += r.cmvWorkZoneCrashes;
    }
    return Object.values(m).sort((a, b) => b.year - a.year);
  }, [stats, corridor]);

  // Live events filtered by corridor (client-side).
  const liveFiltered = useMemo(
    () => liveEvents.filter(e => corridorMatch((e.corridor || '').toUpperCase())),
    [liveEvents, corridor]
  );
  const liveSummary = {
    total: liveFiltered.length,
    crashes: liveFiltered.filter(e => e.isCrash).length,
    commercialVehicle: liveFiltered.filter(e => e.involvesCommercialVehicle).length
  };

  const pct = (part, whole) => whole ? `${Math.round(100 * part / whole)}% of total` : null;

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
        <label style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Year
          <select value={year} onChange={e => setYear(e.target.value)} style={{ padding: '7px 10px', borderRadius: '8px', border: '2px solid #e5e7eb', fontSize: '14px', background: 'white', cursor: 'pointer' }}>
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

      {/* ---- HISTORICAL (FARS) ---- */}
      <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', margin: '0 0 12px 0' }}>
        📊 Historical crashes <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '13px' }}>(NHTSA FARS — fatal crashes)</span>
      </h2>

      {statsStatus === 'unavailable' ? (
        <div style={{ ...card, color: '#6b7280', marginBottom: '24px' }}>
          Historical FARS data hasn’t been loaded yet. It populates on the monthly refresh, or run <code>POST /api/crashes/refresh</code> once.
        </div>
      ) : statsStatus === 'error' ? (
        <div style={{ ...card, color: '#ef4444', marginBottom: '24px' }}>Error loading historical crash stats.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <StatCard label="Fatal crashes" value={statsStatus === 'loading' ? '…' : filtered.totalCrashes} />
            <StatCard label="Commercial vehicle" value={statsStatus === 'loading' ? '…' : filtered.commercialVehicleCrashes} color="#b45309" sub={pct(filtered.commercialVehicleCrashes, filtered.totalCrashes)} />
            <StatCard label="Work-zone crashes" value={statsStatus === 'loading' ? '…' : filtered.workZoneCrashes} color="#d97706" sub={pct(filtered.workZoneCrashes, filtered.totalCrashes)} />
            <StatCard label="CMV in work zones" value={statsStatus === 'loading' ? '…' : filtered.cmvWorkZoneCrashes} color="#9a3412" sub={filtered.workZoneCrashes ? `${Math.round(100 * filtered.cmvWorkZoneCrashes / filtered.workZoneCrashes)}% of work-zone` : null} />
            <StatCard label="Total fatalities" value={statsStatus === 'loading' ? '…' : filtered.fatalities} color="#dc2626" />
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---- LIVE ---- */}
      <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', margin: '0 0 12px 0' }}>
        🔴 Live incidents <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '13px' }}>(state DOT feeds, approximate flags)</span>
      </h2>

      {liveError ? (
        <div style={{ ...card, color: '#ef4444', marginBottom: '24px' }}>Error loading live crashes: {liveError}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <StatCard label="Active incidents" value={liveSummary.total} />
            <StatCard label="Read as crashes" value={liveSummary.crashes} color="#ef4444" />
            <StatCard label="Commercial vehicle" value={liveSummary.commercialVehicle} color="#b45309" sub="text-inferred" />
          </div>

          <div style={{ ...card, textAlign: 'left', marginBottom: '8px', padding: 0, overflow: 'hidden' }}>
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
      )}

      <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '12px' }}>
        Filters apply client-side — switching corridor or year makes no new network call. FARS is fatal crashes only and lags ~1–2 years; live flags are text-inferred.
      </p>
    </div>
  );
};

export default CrashCorridorPanel;

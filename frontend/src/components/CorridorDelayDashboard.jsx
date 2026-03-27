import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { config } from '../config';

const CORRIDORS = ['I-80', 'I-35'];

const CONGESTION_COLORS = {
  'free-flow': '#10b981',
  'moderate': '#f59e0b',
  'heavy': '#f97316',
  'stopped': '#ef4444',
  'unknown': '#9ca3af'
};

const CONGESTION_LABELS = {
  'free-flow': 'Free Flow',
  'moderate': 'Moderate',
  'heavy': 'Heavy',
  'stopped': 'Stopped',
  'unknown': 'Unknown'
};

const SEVERITY_COLORS = {
  'critical': '#dc2626',
  'major': '#ef4444',
  'moderate': '#f59e0b',
  'minor': '#10b981',
  'low': '#6b7280'
};

const STATE_OPTIONS = {
  'I-80': ['CA', 'NV', 'UT', 'WY', 'NE', 'IA', 'IL', 'IN', 'OH', 'PA', 'NJ'],
  'I-35': ['TX', 'OK', 'KS', 'MO', 'IA', 'MN']
};

const formatMinutes = (mins) => {
  if (mins == null || isNaN(mins)) return '--';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
};

const getHealthColor = (score) => {
  if (score >= 90) return '#10b981';
  if (score >= 75) return '#f59e0b';
  if (score >= 50) return '#f97316';
  return '#ef4444';
};

const CorridorDelayDashboard = () => {
  const [selectedCorridor, setSelectedCorridor] = useState('I-80');
  const [delayData, setDelayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSegment, setExpandedSegment] = useState(null);
  const [travelFrom, setTravelFrom] = useState('');
  const [travelTo, setTravelTo] = useState('');
  const [travelResult, setTravelResult] = useState(null);
  const [travelLoading, setTravelLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const intervalRef = useRef(null);

  const fetchDelayData = useCallback(async () => {
    try {
      setError(null);
      const response = await axios.get(`${config.apiUrl}/api/corridor/${selectedCorridor}/delays`);
      if (response.data.success) {
        setDelayData(response.data);
        setLastRefresh(new Date());
      } else {
        setError('Failed to load delay data');
      }
    } catch (err) {
      console.error('Error fetching corridor delays:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load delay data');
    } finally {
      setLoading(false);
    }
  }, [selectedCorridor]);

  // Initial fetch and auto-refresh every 60 seconds
  useEffect(() => {
    setLoading(true);
    setExpandedSegment(null);
    setTravelResult(null);
    fetchDelayData();

    intervalRef.current = setInterval(fetchDelayData, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDelayData]);

  const fetchTravelTime = useCallback(async () => {
    if (!travelFrom || !travelTo || travelFrom === travelTo) return;
    try {
      setTravelLoading(true);
      const response = await axios.get(
        `${config.apiUrl}/api/corridor/${selectedCorridor}/travel-time`,
        { params: { from: travelFrom, to: travelTo } }
      );
      if (response.data.success) {
        setTravelResult(response.data);
      }
    } catch (err) {
      console.error('Error fetching travel time:', err);
      setTravelResult(null);
    } finally {
      setTravelLoading(false);
    }
  }, [selectedCorridor, travelFrom, travelTo]);

  // Reset travel form when corridor changes
  useEffect(() => {
    setTravelFrom('');
    setTravelTo('');
    setTravelResult(null);
  }, [selectedCorridor]);

  const summary = delayData?.summary || {};
  const segments = delayData?.segments || [];
  const stateOptions = STATE_OPTIONS[selectedCorridor] || [];

  if (loading && !delayData) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontSize: '16px', color: '#6b7280' }}>
        Loading corridor delay data...
      </div>
    );
  }

  if (error && !delayData) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
            Corridor Delay Intelligence
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
            Real-time segment-level delay analysis and travel time estimates
            {lastRefresh && (
              <span style={{ marginLeft: '12px', color: '#9ca3af' }}>
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>

        {/* Corridor Tabs */}
        <div style={{ display: 'flex', gap: '0', borderRadius: '8px', overflow: 'hidden', border: '2px solid #e5e7eb' }}>
          {CORRIDORS.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCorridor(c)}
              style={{
                padding: '8px 20px',
                border: 'none',
                background: selectedCorridor === c ? '#3b82f6' : 'white',
                color: selectedCorridor === c ? 'white' : '#374151',
                fontSize: '14px',
                fontWeight: selectedCorridor === c ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'white',
          border: '2px solid #e5e7eb',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Delay</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: summary.totalDelayMinutes > 30 ? '#ef4444' : summary.totalDelayMinutes > 10 ? '#f59e0b' : '#10b981' }}>
            {formatMinutes(summary.totalDelayMinutes)}
          </div>
        </div>

        <div style={{
          background: 'white',
          border: `2px solid ${getHealthColor(summary.avgHealthScore)}`,
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Health Score</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: getHealthColor(summary.avgHealthScore) }}>
            {summary.avgHealthScore != null ? Math.round(summary.avgHealthScore) : '--'}
          </div>
        </div>

        <div style={{
          background: 'white',
          border: `2px solid ${CONGESTION_COLORS[summary.overallCongestion] || '#e5e7eb'}`,
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Congestion</div>
          <div style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: CONGESTION_COLORS[summary.overallCongestion] || '#6b7280'
          }}>
            {CONGESTION_LABELS[summary.overallCongestion] || 'N/A'}
          </div>
        </div>

        <div style={{
          background: 'white',
          border: '2px solid #e5e7eb',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Events</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: summary.activeEvents > 0 ? '#f59e0b' : '#10b981' }}>
            {summary.activeEvents ?? 0}
          </div>
        </div>

        <div style={{
          background: 'white',
          border: '2px solid #e5e7eb',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Free Flow</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
            {formatMinutes(summary.freeFlowMinutes)}
          </div>
        </div>

        <div style={{
          background: 'white',
          border: '2px solid #e5e7eb',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Travel</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#374151' }}>
            {formatMinutes(summary.currentTravelMinutes)}
          </div>
        </div>
      </div>

      {/* Worst Segment Alert */}
      {summary.worstSegment && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          color: '#991b1b'
        }}>
          <span style={{ fontSize: '16px' }}>&#9888;</span>
          <span>
            <strong>Worst segment:</strong> {summary.worstSegment}
          </span>
        </div>
      )}

      {/* Segment Bar Visualization */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#111827' }}>
          Segment Health ({segments.length} segments, {summary.totalMiles ? Math.round(summary.totalMiles) : '--'} miles)
        </h2>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {Object.entries(CONGESTION_COLORS).filter(([k]) => k !== 'unknown').map(([level, color]) => (
            <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: color }} />
              {CONGESTION_LABELS[level]}
            </div>
          ))}
        </div>

        {/* Horizontal bar */}
        <div style={{
          display: 'flex',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid #e5e7eb',
          minHeight: '48px'
        }}>
          {segments.map((seg, idx) => {
            const color = CONGESTION_COLORS[seg.congestionLevel] || CONGESTION_COLORS.unknown;
            const widthPct = summary.totalMiles > 0
              ? Math.max((seg.lengthMiles / summary.totalMiles) * 100, 1.5)
              : (100 / segments.length);
            const isExpanded = expandedSegment === seg.id;

            return (
              <div
                key={seg.id}
                onClick={() => setExpandedSegment(isExpanded ? null : seg.id)}
                style={{
                  width: `${widthPct}%`,
                  background: color,
                  minWidth: '12px',
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRight: idx < segments.length - 1 ? '1px solid rgba(255,255,255,0.4)' : 'none',
                  transition: 'opacity 0.15s ease',
                  opacity: isExpanded ? 1 : 0.85
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.opacity = '0.85'; }}
                title={`${seg.name} (${seg.state}) - ${CONGESTION_LABELS[seg.congestionLevel] || 'Unknown'} - ${formatMinutes(seg.totalDelayMinutes)} delay`}
              >
                {widthPct > 4 && (
                  <span style={{
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '600',
                    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    padding: '0 2px'
                  }}>
                    {seg.state}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Segment labels below bar */}
        <div style={{ display: 'flex', marginTop: '4px' }}>
          {segments.map((seg) => {
            const widthPct = summary.totalMiles > 0
              ? Math.max((seg.lengthMiles / summary.totalMiles) * 100, 1.5)
              : (100 / segments.length);
            return (
              <div
                key={`label-${seg.id}`}
                style={{
                  width: `${widthPct}%`,
                  minWidth: '12px',
                  textAlign: 'center',
                  fontSize: '9px',
                  color: '#9ca3af',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  padding: '0 1px'
                }}
                title={seg.name}
              >
                {widthPct > 5 ? seg.name?.split(' ')[0] || '' : ''}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Segment Detail */}
      {expandedSegment && (() => {
        const seg = segments.find(s => s.id === expandedSegment);
        if (!seg) return null;
        return (
          <div style={{
            background: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                  {seg.name}
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                  {seg.state} &middot; {seg.type} &middot; {seg.lengthMiles?.toFixed(1)} miles &middot; {seg.lanes} lanes
                </p>
              </div>
              <button
                onClick={() => setExpandedSegment(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  padding: '4px'
                }}
              >
                &#10005;
              </button>
            </div>

            {/* Segment stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '10px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Speed</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
                  {seg.estimatedSpeedMph != null ? `${Math.round(seg.estimatedSpeedMph)} mph` : '--'}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>Free flow: {seg.freeFlowMph} mph</div>
              </div>
              <div style={{ padding: '10px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Travel Time</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
                  {formatMinutes(seg.estimatedTravelMinutes)}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>Free flow: {formatMinutes(seg.freeFlowMinutes)}</div>
              </div>
              <div style={{ padding: '10px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Delay</div>
                <div style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: seg.totalDelayMinutes > 5 ? '#ef4444' : seg.totalDelayMinutes > 0 ? '#f59e0b' : '#10b981'
                }}>
                  {formatMinutes(seg.totalDelayMinutes)}
                </div>
              </div>
              <div style={{ padding: '10px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Health</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: getHealthColor(seg.healthScore) }}>
                  {seg.healthScore ?? '--'}
                </div>
              </div>
              <div style={{ padding: '10px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Congestion</div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: CONGESTION_COLORS[seg.congestionLevel] || '#6b7280'
                }}>
                  {CONGESTION_LABELS[seg.congestionLevel] || 'Unknown'}
                </div>
              </div>
            </div>

            {/* Active Events */}
            {seg.activeEvents && seg.activeEvents.length > 0 ? (
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  Active Events ({seg.activeEvents.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {seg.activeEvents.map((evt, i) => (
                    <div
                      key={evt.id || i}
                      style={{
                        padding: '10px 14px',
                        background: '#fafafa',
                        border: `1px solid ${SEVERITY_COLORS[evt.severity] || '#e5e7eb'}`,
                        borderLeft: `4px solid ${SEVERITY_COLORS[evt.severity] || '#e5e7eb'}`,
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            background: SEVERITY_COLORS[evt.severity] || '#e5e7eb',
                            color: 'white',
                            marginRight: '8px'
                          }}>
                            {evt.severity || 'unknown'}
                          </span>
                          <span style={{ fontWeight: '500', color: '#111827' }}>
                            {evt.type}
                          </span>
                          {evt.description && (
                            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '12px' }}>
                              {evt.description}
                            </p>
                          )}
                          {evt.location && (
                            <p style={{ margin: '2px 0 0', color: '#9ca3af', fontSize: '11px' }}>
                              {evt.location}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap', fontSize: '12px' }}>
                          {evt.delayMinutes != null && (
                            <div style={{ color: '#ef4444', fontWeight: '600' }}>+{formatMinutes(evt.delayMinutes)}</div>
                          )}
                          {evt.lanesAffected != null && (
                            <div style={{ color: '#6b7280', fontSize: '11px' }}>{evt.lanesAffected} lane{evt.lanesAffected !== 1 ? 's' : ''}</div>
                          )}
                          {evt.remainingHours != null && (
                            <div style={{ color: '#9ca3af', fontSize: '11px' }}>{evt.remainingHours}h remain</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: '#10b981' }}>
                No active events on this segment.
              </p>
            )}
          </div>
        );
      })()}

      {/* Segment List (compact table) */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600', color: '#111827' }}>
          All Segments
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Segment</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>State</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Miles</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Speed</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Congestion</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Delay</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Health</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Events</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg) => (
                <tr
                  key={seg.id}
                  onClick={() => setExpandedSegment(expandedSegment === seg.id ? null : seg.id)}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                    background: expandedSegment === seg.id ? '#eff6ff' : 'transparent',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={(e) => { if (expandedSegment !== seg.id) e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={(e) => { if (expandedSegment !== seg.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '8px 12px', fontWeight: '500', color: '#111827' }}>{seg.name}</td>
                  <td style={{ padding: '8px 12px', color: '#6b7280' }}>{seg.state}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280' }}>{seg.lengthMiles?.toFixed(1)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#374151' }}>
                    {seg.estimatedSpeedMph != null ? `${Math.round(seg.estimatedSpeedMph)} mph` : '--'}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: '600',
                      background: CONGESTION_COLORS[seg.congestionLevel] || '#9ca3af',
                      color: 'white'
                    }}>
                      {CONGESTION_LABELS[seg.congestionLevel] || 'Unknown'}
                    </span>
                  </td>
                  <td style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    fontWeight: seg.totalDelayMinutes > 0 ? '600' : '400',
                    color: seg.totalDelayMinutes > 5 ? '#ef4444' : seg.totalDelayMinutes > 0 ? '#f59e0b' : '#10b981'
                  }}>
                    {formatMinutes(seg.totalDelayMinutes)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: getHealthColor(seg.healthScore) }}>
                    {seg.healthScore ?? '--'}
                  </td>
                  <td style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    color: seg.eventCount > 0 ? '#f59e0b' : '#9ca3af',
                    fontWeight: seg.eventCount > 0 ? '600' : '400'
                  }}>
                    {seg.eventCount ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Travel Time Calculator */}
      <div style={{
        background: 'white',
        border: '2px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#111827' }}>
          Travel Time Calculator
        </h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>From State</label>
            <select
              value={travelFrom}
              onChange={(e) => { setTravelFrom(e.target.value); setTravelResult(null); }}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                minWidth: '100px',
                background: 'white',
                color: '#374151'
              }}
            >
              <option value="">Select</option>
              {stateOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: '18px', color: '#9ca3af', paddingBottom: '8px' }}>&#8594;</div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>To State</label>
            <select
              value={travelTo}
              onChange={(e) => { setTravelTo(e.target.value); setTravelResult(null); }}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                minWidth: '100px',
                background: 'white',
                color: '#374151'
              }}
            >
              <option value="">Select</option>
              {stateOptions.filter(s => s !== travelFrom).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchTravelTime}
            disabled={!travelFrom || !travelTo || travelFrom === travelTo || travelLoading}
            style={{
              padding: '8px 20px',
              borderRadius: '6px',
              border: 'none',
              background: (!travelFrom || !travelTo || travelFrom === travelTo) ? '#d1d5db' : '#3b82f6',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: (!travelFrom || !travelTo || travelFrom === travelTo) ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease'
            }}
          >
            {travelLoading ? 'Calculating...' : 'Calculate'}
          </button>
        </div>

        {/* Travel time result */}
        {travelResult && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Route</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                  {travelResult.from} &#8594; {travelResult.to}
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>{travelResult.miles ? `${Math.round(travelResult.miles)} miles` : ''}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Free Flow</div>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#10b981' }}>
                  {travelResult.freeFlowFormatted || formatMinutes(travelResult.freeFlowMinutes)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Current Estimate</div>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#374151' }}>
                  {travelResult.currentFormatted || formatMinutes(travelResult.currentMinutes)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Added Delay</div>
                <div style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: travelResult.delayMinutes > 10 ? '#ef4444' : travelResult.delayMinutes > 0 ? '#f59e0b' : '#10b981'
                }}>
                  +{formatMinutes(travelResult.delayMinutes)}
                </div>
              </div>
            </div>
            {travelResult.impactedSegments > 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                {travelResult.impactedSegments} of {travelResult.segmentCount} segments impacted
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CorridorDelayDashboard;

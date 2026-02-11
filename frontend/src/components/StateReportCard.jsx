import { useState, useEffect } from 'react';
import api from '../services/api';
// GLOBAL_TEXT_VISIBILITY_FIX_APPLIED: Ensures readable text on all backgrounds


/**
 * Phase 1: State Report Card Dashboard
 *
 * Displays comprehensive 7-dimension quality metrics for state DOTs:
 * - Completeness, Freshness, Accuracy, Availability
 * - Standardization, Timeliness, Usability
 * - Historical trends, national rankings, peer comparisons
 * - Actionable recommendations prioritized by impact
 */
const StateReportCard = ({ stateKey: propStateKey }) => {
  const [stateKey, setStateKey] = useState(propStateKey || '');
  const [reportCard, setReportCard] = useState(null);
  const [nationalReport, setNationalReport] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('overview'); // overview, dimensions, history, recommendations
  const [historyDays, setHistoryDays] = useState(30);

  useEffect(() => {
    if (propStateKey) {
      setStateKey(propStateKey);
      fetchReportCard(propStateKey);
    } else {
      fetchNationalReport();
    }
  }, [propStateKey]);

  const fetchReportCard = async (state) => {
    if (!state) return;

    try {
      setLoading(true);
      setError(null);

      const [reportResponse, historyResponse] = await Promise.all([
        api.get(`/api/data-quality/report-card/${state}`),
        api.get(`/api/data-quality/history/${state}?days=${historyDays}`)
      ]);

      if (reportResponse.data.success) {
        setReportCard(reportResponse.data);
      }

      if (historyResponse.data.success) {
        setHistory(historyResponse.data);
      }
    } catch (err) {
      console.error('Error fetching report card:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load report card');
    } finally {
      setLoading(false);
    }
  };

  const fetchNationalReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/api/data-quality/national-report-cards');

      if (response.data.success) {
        setNationalReport(response.data);
      }
    } catch (err) {
      console.error('Error fetching national report:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load national report');
    } finally {
      setLoading(false);
    }
  };

  const handleStateSelect = (state) => {
    setStateKey(state);
    setReportCard(null);
    setHistory(null);
    fetchReportCard(state);
  };

  const handleBackToNational = () => {
    setStateKey('');
    setReportCard(null);
    setHistory(null);
    fetchNationalReport();
  };

  const getLetterGradeColor = (grade) => {
    if (grade === 'A') return '#10b981';
    if (grade === 'B') return '#3b82f6';
    if (grade === 'C') return '#f59e0b';
    if (grade === 'D') return '#f97316';
    return '#ef4444';
  };

  const getDimensionColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 80) return '#3b82f6';
    if (score >= 70) return '#f59e0b';
    if (score >= 60) return '#f97316';
    return '#ef4444';
  };

  const getTrendIcon = (direction) => {
    if (direction === 'improving') return '📈';
    if (direction === 'declining') return '📉';
    return '➡️';
  };

  const getPriorityColor = (priority) => {
    if (priority === 'HIGH') return '#ef4444';
    if (priority === 'MEDIUM') return '#f59e0b';
    return '#3b82f6';
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>Loading report card...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <div style={{ fontSize: '18px', color: '#ef4444', marginBottom: '8px' }}>Error Loading Report</div>
        <div style={{ fontSize: '14px', color: '#6b7280' }}>{error}</div>
        <button
          onClick={handleBackToNational}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: '#111827',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Back to National View
        </button>
      </div>
    );
  }

  // National Overview
  if (!stateKey && nationalReport) {
    return (
      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>
            📊 National Data Quality Report Cards
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '16px' }}>
            Phase 1: Data Quality & Accountability Foundation - 7-Dimension Scoring
          </p>
        </div>

        {/* National Summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div style={{
            padding: '24px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            borderRadius: '12px',
            color: '#111827'
          }}>
            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Total States</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold' }}>{nationalReport.total_states}</div>
          </div>
          <div style={{
            padding: '24px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: '12px',
            color: '#111827'
          }}>
            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>National Avg DQI</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold' }}>{nationalReport.national_avg_dqi}</div>
          </div>
          <div style={{
            padding: '24px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
            borderRadius: '12px',
            color: '#111827'
          }}>
            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Report Date</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {new Date(nationalReport.report_date).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Top 3 Podium */}
        {nationalReport.report_cards.length >= 3 && (
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#111827' }}>
              🏆 Top Performers
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '16px'
            }}>
              {nationalReport.report_cards.slice(0, 3).map((state, index) => {
                const medals = ['🥇', '🥈', '🥉'];
                const backgrounds = [
                  'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
                  'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)',
                  'linear-gradient(135deg, #cd7f32 0%, #e6a57e 100%)'
                ];

                return (
                  <div
                    key={state.state_key}
                    onClick={() => handleStateSelect(state.state_key)}
                    style={{
                      padding: '24px',
                      background: backgrounds[index],
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>{medals[index]}</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                      {state.state_key}
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '4px' }}>
                      {state.dqi}
                    </div>
                    <div style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      borderRadius: '12px',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: getLetterGradeColor(state.letter_grade)
                    }}>
                      Grade {state.letter_grade}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Full Rankings Table */}
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#111827' }}>
            Complete Rankings
          </h2>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundcolor: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Rank</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>State</th>
                  <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>DQI</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Grade</th>
                  <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Feeds</th>
                  <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Events</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Dimensions</th>
                </tr>
              </thead>
              <tbody>
                {nationalReport.report_cards.map((state) => (
                  <tr
                    key={state.state_key}
                    onClick={() => handleStateSelect(state.state_key)}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '16px', fontWeight: '600', color: '#6b7280' }}>
                      #{state.national_rank}
                    </td>
                    <td style={{ padding: '16px', fontWeight: '600', color: '#111827' }}>
                      {state.state_key}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontSize: '18px', fontWeight: 'bold' }}>
                      {state.dqi}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        backgroundColor: getLetterGradeColor(state.letter_grade) + '20',
                        color: getLetterGradeColor(state.letter_grade)
                      }}>
                        {state.letter_grade}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', color: '#6b7280' }}>
                      {state.feed_count}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', color: '#6b7280' }}>
                      {state.total_events?.toLocaleString() || 'N/A'}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {Object.entries(state.dimensions).map(([key, value]) => (
                          <div
                            key={key}
                            style={{
                              width: '8px',
                              height: '24px',
                              borderRadius: '2px',
                              backgroundColor: getDimensionColor(value),
                              title: `${key}: ${value}`
                            }}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Individual State Report Card
  if (stateKey && reportCard) {
    return (
      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Back Button */}
        <button
          onClick={handleBackToNational}
          style={{
            marginBottom: '16px',
            padding: '8px 16px',
            backgroundcolor: '#6b7280',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          ← Back to National View
        </button>

        {/* State Header */}
        <div style={{
          marginBottom: '32px',
          padding: '32px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          borderRadius: '16px',
          color: '#111827'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>STATE REPORT CARD</div>
              <h1 style={{ margin: 0, fontSize: '48px', fontWeight: 'bold' }}>{stateKey}</h1>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '64px',
                fontWeight: 'bold',
                lineHeight: 1,
                marginBottom: '8px'
              }}>
                {reportCard.current_metrics.overall_dqi}
              </div>
              <div style={{
                display: 'inline-block',
                padding: '8px 24px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '12px',
                fontSize: '24px',
                fontWeight: 'bold'
              }}>
                Grade {reportCard.current_metrics.letter_grade}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            marginTop: '24px'
          }}>
            <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>National Rank</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                #{reportCard.ranking.national_rank} of {reportCard.ranking.total_states}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>
                Top {reportCard.ranking.percentile}%
              </div>
            </div>
            <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>Trend (30d)</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {getTrendIcon(reportCard.trend.direction)} {reportCard.trend.change_30d > 0 ? '+' : ''}{reportCard.trend.change_30d}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8', textTransform: 'capitalize' }}>
                {reportCard.trend.direction}
              </div>
            </div>
            <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>Data Feeds</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {reportCard.current_metrics.total_feeds}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8' }}>Active feeds</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>Recommendations</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {reportCard.recommendations.length}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8' }}>Action items</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '2px solid #e5e7eb'
        }}>
          {['overview', 'dimensions', 'history', 'recommendations'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '12px 24px',
                backgroundColor: viewMode === mode ? 'white' : 'transparent',
                border: 'none',
                borderBottom: viewMode === mode ? '3px solid #3b82f6' : '3px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: viewMode === mode ? '600' : '500',
                color: viewMode === mode ? '#3b82f6' : '#6b7280',
                textTransform: 'capitalize'
              }}
            >
              {mode === 'overview' ? '📊' : mode === 'dimensions' ? '📈' : mode === 'history' ? '📅' : '💡'} {mode}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {viewMode === 'overview' && (
          <div>
            {/* 7 Dimensions Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
              marginBottom: '32px'
            }}>
              {Object.entries(reportCard.current_metrics.dimensions).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    padding: '20px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '2px solid #e5e7eb',
                    borderLeft: `4px solid ${getDimensionColor(value)}`
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#6b7280',
                      textTransform: 'capitalize'
                    }}>
                      {key}
                    </div>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: getDimensionColor(value)
                    }}>
                      {value}
                    </div>
                  </div>
                  <div style={{
                    height: '8px',
                    backgroundcolor: '#6b7280',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${value}%`,
                      backgroundColor: getDimensionColor(value),
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Feeds Breakdown */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              padding: '24px',
              marginBottom: '32px'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold' }}>
                Feed Performance
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reportCard.feeds.map(feed => (
                  <div
                    key={feed.feed_key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px',
                      backgroundcolor: '#6b7280',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                        {feed.corridor}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>
                        {feed.provider}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                        {feed.dqi}
                      </div>
                      <div style={{
                        padding: '6px 16px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        backgroundColor: getLetterGradeColor(feed.grade) + '20',
                        color: getLetterGradeColor(feed.grade)
                      }}>
                        {feed.grade}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Peer Comparison */}
            {reportCard.peer_states.length > 0 && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                padding: '24px'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold' }}>
                  Peer States (Similar Performance)
                </h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {reportCard.peer_states.map(peer => (
                    <div
                      key={peer.state_key}
                      onClick={() => handleStateSelect(peer.state_key)}
                      style={{
                        padding: '16px 24px',
                        backgroundcolor: '#6b7280',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#3b82f6';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                        e.currentTarget.style.color = 'inherit';
                      }}
                    >
                      <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                        {peer.state_key}
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.8 }}>
                        DQI: {peer.avg_score}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === 'dimensions' && (
          <DimensionsDetailView dimensions={reportCard.current_metrics.dimensions} />
        )}

        {viewMode === 'history' && history && (
          <HistoryView history={history} />
        )}

        {viewMode === 'recommendations' && (
          <RecommendationsView
            recommendations={reportCard.recommendations}
            contracts={reportCard.contracts}
          />
        )}
      </div>
    );
  }

  return null;
};

// Dimensions Detail View
const DimensionsDetailView = ({ dimensions }) => {
  const dimensionDetails = {
    completeness: {
      title: 'Completeness',
      description: 'Measures presence of required fields: end times, descriptions, geometry, severity, lanes',
      weight: '20%',
      icon: '✅'
    },
    freshness: {
      title: 'Freshness',
      description: 'Measures data recency: update latency, stale event detection',
      weight: '15%',
      icon: '🔄'
    },
    accuracy: {
      title: 'Accuracy',
      description: 'Measures data correctness: geometry validation, schema compliance',
      weight: '20%',
      icon: '🎯'
    },
    availability: {
      title: 'Availability',
      description: 'Measures feed reliability: uptime, fetch success rates',
      weight: '15%',
      icon: '⚡'
    },
    standardization: {
      title: 'Standardization',
      description: 'Measures format compliance: WZDx, ITIS codes, standard event types',
      weight: '15%',
      icon: '📋'
    },
    timeliness: {
      title: 'Timeliness',
      description: 'Measures temporal validity: event age distribution, staleness',
      weight: '10%',
      icon: '⏰'
    },
    usability: {
      title: 'Usability',
      description: 'Measures actionable details: contact info, restrictions, work zone types',
      weight: '5%',
      icon: '💼'
    }
  };

  const getDimensionColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 80) return '#3b82f6';
    if (score >= 70) return '#f59e0b';
    if (score >= 60) return '#f97316';
    return '#ef4444';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {Object.entries(dimensions).map(([key, value]) => {
        const detail = dimensionDetails[key];
        if (!detail) return null;

        return (
          <div
            key={key}
            style={{
              padding: '24px',
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '2px solid #e5e7eb',
              borderLeft: `6px solid ${getDimensionColor(value)}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '32px' }}>{detail.icon}</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                      {detail.title}
                    </h3>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                      Weight: {detail.weight} of overall DQI
                    </div>
                  </div>
                </div>
                <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
                  {detail.description}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '48px', fontWeight: 'bold', color: getDimensionColor(value) }}>
                  {value}
                </div>
              </div>
            </div>
            <div style={{
              height: '12px',
              backgroundcolor: '#6b7280',
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${value}%`,
                backgroundColor: getDimensionColor(value),
                transition: 'width 0.5s ease-out'
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// History View
const HistoryView = ({ history }) => {
  const maxDQI = Math.max(...history.history.map(h => h.dqi));
  const minDQI = Math.min(...history.history.map(h => h.dqi));

  return (
    <div>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 'bold' }}>
          DQI Trend ({history.period_days} days)
        </h3>
        <div style={{ position: 'relative', height: '300px' }}>
          {/* Simple line chart visualization */}
          <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
            <polyline
              points={history.history.map((h, i) => {
                const x = (i / (history.history.length - 1)) * 100;
                const y = 100 - ((h.dqi - minDQI) / (maxDQI - minDQI)) * 80;
                return `${x}%,${y}%`;
              }).join(' ')}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
            />
            {history.history.map((h, i) => {
              const x = (i / (history.history.length - 1)) * 100;
              const y = 100 - ((h.dqi - minDQI) / (maxDQI - minDQI)) * 80;
              return (
                <g key={i}>
                  <circle
                    cx={`${x}%`}
                    cy={`${y}%`}
                    r="4"
                    fill="#3b82f6"
                  />
                  <text
                    x={`${x}%`}
                    y={`${y - 5}%`}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#6b7280"
                  >
                    {h.dqi}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '13px', color: '#6b7280' }}>
          <div>{history.history[0]?.date}</div>
          <div>{history.history[history.history.length - 1]?.date}</div>
        </div>
      </div>

      {/* Historical data table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundcolor: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Date</th>
              <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#374151' }}>DQI</th>
              <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Feeds</th>
              <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Events</th>
            </tr>
          </thead>
          <tbody>
            {history.history.slice().reverse().map((h, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px', fontSize: '13px' }}>{h.date}</td>
                <td style={{ padding: '12px', textAlign: 'right', fontSize: '15px', fontWeight: 'bold' }}>{h.dqi}</td>
                <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: '#6b7280' }}>{h.feed_count}</td>
                <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: '#6b7280' }}>{h.total_events?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Recommendations View
const RecommendationsView = ({ recommendations, contracts }) => {
  const getPriorityColor = (priority) => {
    if (priority === 'HIGH') return '#ef4444';
    if (priority === 'MEDIUM') return '#f59e0b';
    return '#3b82f6';
  };

  return (
    <div>
      {/* Recommendations */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold' }}>
          💡 Actionable Recommendations
        </h3>
        {recommendations.length === 0 ? (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            backgroundcolor: '#6b7280',
            borderRadius: '12px',
            border: '2px solid #86efac'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#166534', marginBottom: '8px' }}>
              Excellent Performance!
            </div>
            <div style={{ color: '#16a34a' }}>
              All quality dimensions are meeting target thresholds. No immediate action required.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {recommendations.map((rec, index) => (
              <div
                key={index}
                style={{
                  padding: '24px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  borderLeft: `6px solid ${getPriorityColor(rec.priority)}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: getPriorityColor(rec.priority) + '20',
                        color: getPriorityColor(rec.priority)
                      }}>
                        {rec.priority} PRIORITY
                      </span>
                      <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                        {rec.dimension}
                      </h4>
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                      Current Score: <span style={{ fontWeight: 'bold', color: '#111827' }}>{rec.current_score}</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      Potential Impact: <span style={{ fontWeight: 'bold', color: '#10b981' }}>{rec.impact}</span>
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '16px',
                  backgroundcolor: '#6b7280',
                  borderRadius: '8px',
                  fontSize: '14px',
                  lineHeight: '1.6'
                }}>
                  <strong>Recommended Action:</strong> {rec.action}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vendor Contracts */}
      {contracts.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold' }}>
            📄 Vendor Contracts
          </h3>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundcolor: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600' , color: '#111827'}}>Vendor</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600' , color: '#111827'}}>Annual Value</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600' , color: '#111827'}}>Contract Period</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600' , color: '#111827'}}>SLA Uptime</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px', fontWeight: '600' }}>{contract.vendor_name}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontSize: '15px', fontWeight: 'bold', color: '#10b981' }}>
                      ${contract.contract_value_annual?.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                      {contract.contract_start_date} - {contract.contract_end_date}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        fontWeight: '600'
                      }}>
                        {contract.sla_uptime_target}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StateReportCard;

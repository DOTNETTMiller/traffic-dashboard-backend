import { useState, useEffect } from 'react';
import api from '../services/api';

const StateQualityDashboard = () => {
  const [rankings, setRankings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedState, setSelectedState] = useState(null);

  useEffect(() => {
    fetchStateRankings();
  }, []);

  const fetchStateRankings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/data-quality/state-rankings');

      if (response.data.success) {
        setRankings(response.data.rankings);
        setSummary(response.data.summary);
      } else {
        setError('Failed to load state quality rankings');
      }
    } catch (err) {
      console.error('Error fetching state rankings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getMedalEmoji = (type) => {
    switch (type) {
      case 'gold': return '🥇';
      case 'silver': return '🥈';
      case 'bronze': return '🥉';
      default: return '';
    }
  };

  const getBadgeEmoji = (type) => {
    switch (type) {
      case '90_club': return '⭐';
      case 'excellence': return '💎';
      case 'consistent': return '✅';
      case 'diverse': return '🎯';
      case 'high_performer': return '🏆';
      default: return '🏅';
    }
  };

  const getGradeColor = (grade) => {
    if (grade === 'A+' || grade === 'A' || grade === 'A-') return '#10b981';
    if (grade.startsWith('B')) return '#3b82f6';
    if (grade.startsWith('C')) return '#f59e0b';
    if (grade.startsWith('D')) return '#f97316';
    return '#ef4444';
  };

  const getRankDisplay = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading state quality rankings...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: '#ef4444' }}>Error: {error}</div>;
  }

  const topThree = rankings.slice(0, 3);

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 'bold' }}>
          State Data Quality Rankings
        </h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          Competitive rankings showing which states provide the highest quality transportation data
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div style={{
            padding: '16px',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: '500' }}>TOTAL STATES</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0c4a6e' }}>
              {summary.total_states}
            </div>
            <div style={{ fontSize: '11px', color: '#0369a1' }}>Participating</div>
          </div>

          <div style={{
            padding: '16px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: '#166534', fontWeight: '500' }}>NATIONAL AVG DQI</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#15803d' }}>
              {summary.avg_national_dqi}
            </div>
            <div style={{ fontSize: '11px', color: '#166534' }}>Overall quality</div>
          </div>

          <div style={{
            padding: '16px',
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: '#92400e', fontWeight: '500' }}>90+ CLUB</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#b45309' }}>
              {summary.states_above_90}
            </div>
            <div style={{ fontSize: '11px', color: '#92400e' }}>A- grade or better</div>
          </div>

          <div style={{
            padding: '16px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: '500' }}>TOTAL FEEDS</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e3a8a' }}>
              {summary.total_feeds}
            </div>
            <div style={{ fontSize: '11px', color: '#1e40af' }}>Data sources</div>
          </div>
        </div>
      )}

      {/* Podium - Top 3 */}
      {topThree.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '20px',
            color: '#374151'
          }}>
            Top Performing States
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px'
          }}>
            {topThree.map((state, idx) => {
              const heights = ['120px', '100px', '80px'];
              const backgrounds = [
                'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', // Gold
                'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)', // Silver
                'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)'  // Bronze
              ];

              return (
                <div key={state.state_abbr} style={{ textAlign: 'center' }}>
                  <div style={{
                    height: heights[idx],
                    background: backgrounds[idx],
                    borderRadius: '8px 8px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    border: '2px solid ' + (idx === 0 ? '#f59e0b' : idx === 1 ? '#9ca3af' : '#fb923c'),
                    marginBottom: '12px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedState(state)}
                  >
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                      {getMedalEmoji(state.badges.find(b => b.type === 'medal')?.value)}
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
                      {state.avg_dqi}
                    </div>
                    <div style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      background: getGradeColor(state.letter_grade),
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}>
                      {state.letter_grade}
                    </div>
                  </div>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '16px',
                    color: '#1f2937',
                    marginBottom: '4px'
                  }}>
                    {state.state_name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginBottom: '8px'
                  }}>
                    {state.total_feeds} feeds • {state.corridor_count} corridors
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    justifyContent: 'center',
                    flexWrap: 'wrap'
                  }}>
                    {state.badges.filter(b => b.type !== 'medal').map((badge, badgeIdx) => (
                      <span
                        key={badgeIdx}
                        style={{ fontSize: '18px' }}
                        title={badge.label}
                      >
                        {getBadgeEmoji(badge.value)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Rankings */}
      <div>
        <h3 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          marginBottom: '20px',
          color: '#374151'
        }}>
          All States ({rankings.length})
        </h3>

        {rankings.map((state) => (
          <div
            key={state.state_abbr}
            style={{
              marginBottom: '16px',
              padding: '20px',
              background: '#fff',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              cursor: 'pointer'
            }}
            onClick={() => setSelectedState(state)}
          >
            {/* State Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    color: state.rank <= 3 ? '#f59e0b' : '#6b7280',
                    minWidth: '60px'
                  }}>
                    {getRankDisplay(state.rank)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '20px', color: '#1f2937' }}>
                      {state.state_name} ({state.state_abbr})
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {state.total_feeds} data feeds across {state.corridor_count} corridors • {state.provider_count} providers
                    </div>
                  </div>
                </div>

                {/* Badges */}
                {state.badges.length > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginTop: '8px'
                  }}>
                    {state.badges.map((badge, badgeIdx) => (
                      <div
                        key={badgeIdx}
                        style={{
                          padding: '4px 10px',
                          background: badge.type === 'medal' ? '#fef3c7' : '#eff6ff',
                          border: `1px solid ${badge.type === 'medal' ? '#fde68a' : '#bfdbfe'}`,
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          color: badge.type === 'medal' ? '#92400e' : '#1e40af',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>{getBadgeEmoji(badge.value)}</span>
                        {badge.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DQI Score */}
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  display: 'inline-block',
                  padding: '8px 20px',
                  background: getGradeColor(state.letter_grade),
                  color: 'white',
                  borderRadius: '8px',
                  marginBottom: '4px'
                }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                    {state.avg_dqi}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    {state.letter_grade}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                  Average DQI
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginTop: '16px',
              padding: '16px',
              background: '#f9fafb',
              borderRadius: '6px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>CONSISTENCY</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                  {state.consistency_score}%
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Quality stability</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>SERVICE TYPES</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                  {state.service_type_count}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Data categories</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>QUALITY RANGE</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
                  {state.min_dqi} - {state.max_dqi}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Min - Max DQI</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>A-GRADE FEEDS</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
                  {state.a_grade_feeds}/{state.total_feeds}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>
                  {state.a_grade_percentage}% excellence
                </div>
              </div>
            </div>

            {/* Dimension Scores */}
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                MDODE Dimension Scores
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                    {state.dimension_scores.accuracy}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Accuracy</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                    {state.dimension_scores.coverage}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Coverage</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                    {state.dimension_scores.timeliness}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Timeliness</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                    {state.dimension_scores.standards}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Standards</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                    {state.dimension_scores.governance}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Governance</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* State Detail Modal */}
      {selectedState && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}
        onClick={() => setSelectedState(null)}
        >
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '900px',
            maxHeight: '80vh',
            overflow: 'auto',
            padding: '24px'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 'bold' }}>
                  {selectedState.state_name} Data Quality Detail
                </h3>
                <div style={{ color: '#6b7280', fontSize: '14px' }}>
                  Rank #{selectedState.rank} • {selectedState.total_feeds} feeds analyzed
                </div>
              </div>
              <button
                onClick={() => setSelectedState(null)}
                style={{
                  padding: '8px 16px',
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Close
              </button>
            </div>

            {/* Feed Breakdown Table */}
            <div style={{ marginTop: '24px' }}>
              <h4 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
                Feed Breakdown ({selectedState.feeds.length} feeds)
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Corridor</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Service</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Provider</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>DQI</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedState.feeds
                      .sort((a, b) => b.dqi - a.dqi)
                      .map((feed, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px', fontSize: '13px' }}>{feed.corridor_name}</td>
                          <td style={{ padding: '12px', fontSize: '13px' }}>{feed.service_display_name}</td>
                          <td style={{ padding: '12px', fontSize: '13px' }}>{feed.provider_name}</td>
                          <td style={{ padding: '12px', textAlign: 'center', fontSize: '15px', fontWeight: 'bold' }}>
                            {feed.dqi}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 8px',
                              background: getGradeColor(feed.letter_grade),
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {feed.letter_grade}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {rankings.length === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            No state data found
          </div>
          <div style={{ color: '#6b7280' }}>
            No state quality data available yet.
          </div>
        </div>
      )}
    </div>
  );
};

export default StateQualityDashboard;

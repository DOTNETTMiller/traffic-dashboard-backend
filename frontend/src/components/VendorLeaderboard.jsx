import { useState, useEffect } from 'react';
import api from '../services/api';

const VendorLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await api.get('/data-quality/leaderboard');

      if (response.data.success) {
        setLeaderboard(response.data.leaderboard);
        setSummary(response.data.summary);
      } else {
        setError('Failed to load vendor leaderboard');
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
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
      case 'perfect': return '💎';
      case 'multi_corridor': return '🌐';
      case 'diverse': return '🎯';
      case 'reliable': return '✅';
      default: return '🏆';
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
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading vendor leaderboard...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: '#ef4444' }}>Error: {error}</div>;
  }

  const topThree = leaderboard.slice(0, 3);
  const restOfLeaderboard = leaderboard.slice(3);

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 'bold' }}>
          Vendor Performance Leaderboard
        </h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          Real-time vendor rankings based on data quality performance across all feeds and corridors
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
            <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: '500' }}>TOTAL VENDORS</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0c4a6e' }}>
              {summary.total_providers}
            </div>
            <div style={{ fontSize: '11px', color: '#0369a1' }}>In competition</div>
          </div>

          <div style={{
            padding: '16px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: '#166534', fontWeight: '500' }}>MARKET AVG DQI</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#15803d' }}>
              {summary.avg_market_dqi}
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
              {summary.providers_above_90}
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
            <div style={{ fontSize: '11px', color: '#1e40af' }}>Market coverage</div>
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
            Top Performers
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px'
          }}>
            {topThree.map((vendor, idx) => {
              const heights = ['120px', '100px', '80px'];
              const backgrounds = ['linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)', 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)'];

              return (
                <div key={vendor.provider_id} style={{
                  textAlign: 'center'
                }}>
                  <div style={{
                    height: heights[idx],
                    background: backgrounds[idx],
                    borderRadius: '8px 8px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    border: '2px solid ' + (idx === 0 ? '#f59e0b' : idx === 1 ? '#9ca3af' : '#fb923c'),
                    marginBottom: '12px'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                      {getMedalEmoji(vendor.badges.find(b => b.type === 'medal')?.value)}
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
                      {vendor.avg_dqi}
                    </div>
                    <div style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      background: getGradeColor(vendor.letter_grade),
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}>
                      {vendor.letter_grade}
                    </div>
                  </div>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '16px',
                    color: '#1f2937',
                    marginBottom: '4px'
                  }}>
                    {vendor.provider_name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginBottom: '8px'
                  }}>
                    {vendor.total_feeds} feeds • {vendor.metrics.corridor_coverage} corridors
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    justifyContent: 'center',
                    flexWrap: 'wrap'
                  }}>
                    {vendor.badges.filter(b => b.type !== 'medal').map((badge, badgeIdx) => (
                      <span
                        key={badgeIdx}
                        style={{
                          fontSize: '18px',
                          title: badge.label
                        }}
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

      {/* Full Leaderboard */}
      <div>
        <h3 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          marginBottom: '20px',
          color: '#374151'
        }}>
          All Vendors ({leaderboard.length})
        </h3>

        {leaderboard.map((vendor) => (
          <div
            key={vendor.provider_id}
            style={{
              marginBottom: '16px',
              padding: '20px',
              background: '#fff',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            {/* Vendor Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    color: vendor.rank <= 3 ? '#f59e0b' : '#6b7280',
                    minWidth: '60px'
                  }}>
                    {getRankDisplay(vendor.rank)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '20px', color: '#1f2937' }}>
                      {vendor.provider_name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {vendor.total_feeds} active feeds across {vendor.metrics.corridor_coverage} corridors
                    </div>
                  </div>
                </div>

                {/* Badges */}
                {vendor.badges.length > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginTop: '8px'
                  }}>
                    {vendor.badges.map((badge, badgeIdx) => (
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
                  background: getGradeColor(vendor.letter_grade),
                  color: 'white',
                  borderRadius: '8px',
                  marginBottom: '4px'
                }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                    {vendor.avg_dqi}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    {vendor.letter_grade}
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
                  {vendor.metrics.consistency_score}%
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Quality stability</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>SERVICE TYPES</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                  {vendor.metrics.service_diversity}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Diversity score</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>QUALITY RANGE</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
                  {vendor.metrics.quality_range.min} - {vendor.metrics.quality_range.max}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Min - Max DQI</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>A-GRADE FEEDS</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
                  {vendor.metrics.a_grade_feeds}/{vendor.total_feeds}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>90+ DQI performance</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {leaderboard.length === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            No vendors found
          </div>
          <div style={{ color: '#6b7280' }}>
            No vendor performance data available yet.
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorLeaderboard;

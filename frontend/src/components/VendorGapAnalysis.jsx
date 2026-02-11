import { useState, useEffect } from 'react';
import api from '../services/api';

const VendorGapAnalysis = () => {
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ provider: '', maxDQI: '85' });

  useEffect(() => {
    fetchGapAnalysis();
  }, [filter]);

  const fetchGapAnalysis = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.provider) params.append('provider', filter.provider);
      if (filter.maxDQI) params.append('maxDQI', filter.maxDQI);

      const response = await api.get(`/api/data-quality/gap-analysis?${params}`);

      if (response.data.success) {
        setGaps(response.data.feeds);
      } else {
        setError('Failed to load gap analysis');
      }
    } catch (err) {
      console.error('Error fetching gap analysis:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getGradeColor = (grade) => {
    if (grade === 'A' || grade === 'A+' || grade === 'A-') return '#10b981';
    if (grade.startsWith('B')) return '#3b82f6';
    if (grade.startsWith('C')) return '#f59e0b';
    if (grade.startsWith('D')) return '#f97316';
    return '#ef4444';
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading gap analysis...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: '#ef4444' }}>Error: {error}</div>;
  }

  // Group feeds by provider
  const feedsByProvider = gaps.reduce((acc, feed) => {
    if (!acc[feed.provider_name]) {
      acc[feed.provider_name] = [];
    }
    acc[feed.provider_name].push(feed);
    return acc;
  }, {});

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold' }}>
          Vendor Data Quality Gap Analysis
        </h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          Identify exactly which data dimensions need improvement to increase your DQI score and reach A-grade status (90+)
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        padding: '16px',
        background: '#f9fafb',
        borderRadius: '8px'
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>
            Filter by Provider
          </label>
          <input
            type="text"
            value={filter.provider}
            onChange={(e) => setFilter({ ...filter, provider: e.target.value })}
            placeholder="e.g., INRIX, Iowa DOT"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>
            Max DQI (show feeds below this score)
          </label>
          <input
            type="number"
            value={filter.maxDQI}
            onChange={(e) => setFilter({ ...filter, maxDQI: e.target.value })}
            min="0"
            max="100"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      {/* Provider Sections */}
      {Object.entries(feedsByProvider).map(([provider, providerFeeds]) => (
        <div key={provider} style={{ marginBottom: '32px' }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#1f2937',
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '8px'
          }}>
            {provider} ({providerFeeds.length} {providerFeeds.length === 1 ? 'feed' : 'feeds'})
          </h3>

          {providerFeeds.map((feed, idx) => (
            <div
              key={`${feed.feed_id}-${idx}`}
              style={{
                marginBottom: '16px',
                padding: '16px',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              {/* Feed Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1f2937' }}>
                    {feed.corridor_name} - {feed.service_type.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Feed ID: {feed.feed_id}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    background: getGradeColor(feed.current_grade),
                    color: '#111827',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    fontSize: '18px'
                  }}>
                    {feed.current_grade}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>
                    {feed.current_dqi}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Current DQI</div>
                </div>
              </div>

              {/* Potential Improvement */}
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: '500' }}>
                      POTENTIAL IF ALL GAPS CLOSED
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e40af' }}>
                      {feed.max_potential_dqi} DQI
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#1e40af' }}>To reach A- grade (90):</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e40af' }}>
                      +{feed.points_to_next_grade} points
                    </div>
                  </div>
                </div>
              </div>

              {/* Priority Action */}
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: '500', marginBottom: '4px' }}>
                  TOP PRIORITY ACTION
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#dc2626' }}>
                  {feed.top_priority_action}
                </div>
              </div>

              {/* Gap Details */}
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px', color: '#374151' }}>
                Improvement Opportunities ({feed.gaps.length})
              </div>

              {feed.gaps.map((gap, gapIdx) => (
                <div
                  key={gapIdx}
                  style={{
                    marginBottom: '12px',
                    padding: '12px',
                    background: '#f9fafb',
                    borderLeft: `4px solid ${getPriorityColor(gap.priority)}`,
                    borderRadius: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{gap.field}</div>
                    <div style={{
                      padding: '2px 8px',
                      background: getPriorityColor(gap.priority),
                      color: '#111827',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {gap.priority}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', fontSize: '13px' }}>
                    <div>
                      Current: <strong>{gap.currentScore}</strong>
                    </div>
                    <div>
                      Target: <strong>{gap.targetScore}</strong>
                    </div>
                    <div>
                      Gap: <strong style={{ color: '#dc2626' }}>{gap.gap} points</strong>
                    </div>
                    <div>
                      Potential gain: <strong style={{ color: '#059669' }}>+{gap.potentialDQIIncrease} DQI</strong>
                    </div>
                  </div>

                  <div style={{
                    fontSize: '13px',
                    color: '#4b5563',
                    fontStyle: 'italic',
                    lineHeight: '1.5'
                  }}>
                    {gap.recommendation}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {gaps.length === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            No gaps found
          </div>
          <div style={{ color: '#6b7280' }}>
            All feeds meeting target criteria. Adjust filters to see more data.
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorGapAnalysis;

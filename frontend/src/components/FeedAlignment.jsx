import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';

export default function FeedAlignment() {
  const [alignment, setAlignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedState, setSelectedState] = useState(null);

  useEffect(() => {
    fetchAlignment();
  }, []);

  const fetchAlignment = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${config.apiUrl}/api/analysis/feed-alignment`);
      setAlignment(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching feed alignment:', err);
      setError('Failed to load feed alignment analysis');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'CRITICAL': return '#dc2626';
      case 'HIGH': return '#f59e0b';
      case 'MEDIUM': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>
          🔄 Analyzing feed alignment across all states...
          <div style={{ fontSize: '14px', marginTop: '10px' }}>
            This may take a minute as we fetch data from all state feeds
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '16px',
          color: '#991b1b'
        }}>
          ⚠️ {error}
        </div>
      </div>
    );
  }

  if (!alignment) return null;

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 8px 0' }}>
          🔄 Cross-State Feed Alignment Analysis
        </h1>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Field mapping variations and normalization recommendations across {alignment.summary.totalStates} state DOT feeds
        </p>
        <div style={{ fontSize: '14px', color: '#9ca3af', marginTop: '4px' }}>
          Generated: {new Date(alignment.generatedAt).toLocaleString()}
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          backgroundColor: '#eff6ff',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #dbeafe'
        }}>
          <div style={{ fontSize: '14px', color: '#1e40af', fontWeight: '600' }}>Total States</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e3a8a' }}>
            {alignment.summary.totalStates}
          </div>
        </div>
        <div style={{
          backgroundColor: '#fef3c7',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #fde68a'
        }}>
          <div style={{ fontSize: '14px', color: '#92400e', fontWeight: '600' }}>Total Events Analyzed</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#78350f' }}>
            {alignment.summary.totalEvents.toLocaleString()}
          </div>
        </div>
        <div style={{
          backgroundColor: '#f3e8ff',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e9d5ff'
        }}>
          <div style={{ fontSize: '14px', color: '#6b21a8', fontWeight: '600' }}>Unique Field Names</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#581c87' }}>
            {alignment.summary.uniqueFieldNames.length}
          </div>
        </div>
      </div>

      {/* Normalization Recommendations */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>
          📋 Normalization Recommendations
        </h2>

        {alignment.normalizationRecommendations.map((rec, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderLeft: `4px solid ${getPriorityColor(rec.priority)}`,
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
              <div>
                <span style={{
                  backgroundColor: getPriorityColor(rec.priority) + '20',
                  color: getPriorityColor(rec.priority),
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  marginRight: '8px'
                }}>
                  {rec.priority}
                </span>
                <span style={{
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {rec.category}
                </span>
              </div>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 8px 0', color: '#1f2937' }}>
              {rec.issue}
            </h3>

            <p style={{ margin: '0 0 12px 0', color: '#4b5563' }}>
              ✅ <strong>Recommendation:</strong> {rec.recommendation}
            </p>

            {rec.affectedStates && rec.affectedStates.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#6b7280', fontSize: '14px' }}>
                  Affected States ({rec.affectedStates.length}):
                </strong>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginTop: '6px'
                }}>
                  {rec.affectedStates.slice(0, 10).map((state, i) => (
                    <span
                      key={i}
                      style={{
                        backgroundColor: '#f3f4f6',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#374151'
                      }}
                    >
                      {state}
                    </span>
                  ))}
                  {rec.affectedStates.length > 10 && (
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      +{rec.affectedStates.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {rec.implementation && (
              <p style={{ margin: '0 0 12px 0', color: '#6b7280', fontSize: '14px' }}>
                💡 <strong>Implementation:</strong> {rec.implementation}
              </p>
            )}

            {rec.codeExample && (
              <details style={{ marginTop: '12px' }}>
                <summary style={{
                  cursor: 'pointer',
                  color: '#3b82f6',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  Show Code Example
                </summary>
                <pre style={{
                  backgroundColor: '#1f2937',
                  color: '#10b981',
                  padding: '16px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  fontSize: '13px',
                  marginTop: '8px',
                  fontFamily: 'Monaco, Courier, monospace'
                }}>
                  {rec.codeExample}
                </pre>
              </details>
            )}

            {rec.mapping && (
              <details style={{ marginTop: '12px' }}>
                <summary style={{
                  cursor: 'pointer',
                  color: '#3b82f6',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  Show Mapping Table
                </summary>
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  {Object.entries(rec.mapping).map(([target, sources]) => (
                    <div key={target} style={{ marginBottom: '8px' }}>
                      <strong style={{ color: '#059669' }}>{target}</strong> ← {Array.isArray(sources) ? sources.join(', ') : sources}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>

      {/* State-Specific Mappings */}
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>
          🗺️ State-Specific Field Mappings
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px'
        }}>
          {Object.entries(alignment.stateSpecificMappings).map(([state, mapping]) => (
            <div
              key={state}
              onClick={() => setSelectedState(selectedState === state ? null : state)}
              style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: selectedState === state ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 8px 0',
                color: '#1f2937'
              }}>
                {state}
              </h3>

              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                <span style={{
                  backgroundColor: '#dbeafe',
                  color: '#1e40af',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  marginRight: '6px'
                }}>
                  {mapping.apiType}
                </span>
                <span style={{
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  {mapping.sourceFormat}
                </span>
              </div>

              {mapping.status === 'NO_EVENTS' ? (
                <div style={{ color: '#9ca3af', fontSize: '14px' }}>
                  {mapping.message}
                </div>
              ) : (
                <>
                  {mapping.issues && mapping.issues.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#dc2626',
                        marginBottom: '4px'
                      }}>
                        ⚠️ Issues ({mapping.issues.length})
                      </div>
                      {selectedState === state && mapping.issues.map((issue, i) => (
                        <div key={i} style={{ fontSize: '12px', color: '#6b7280', marginLeft: '16px' }}>
                          • {issue}
                        </div>
                      ))}
                    </div>
                  )}

                  {mapping.recommendations && mapping.recommendations.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#3b82f6',
                        marginBottom: '4px'
                      }}>
                        💡 Recommendations ({mapping.recommendations.length})
                      </div>
                      {selectedState === state && mapping.recommendations.map((rec, i) => (
                        <div key={i} style={{ fontSize: '12px', color: '#6b7280', marginLeft: '16px', marginBottom: '4px' }}>
                          • {rec}
                        </div>
                      ))}
                    </div>
                  )}

                  {(!mapping.issues || mapping.issues.length === 0) &&
                   (!mapping.recommendations || mapping.recommendations.length === 0) && (
                    <div style={{ fontSize: '14px', color: '#059669' }}>
                      ✅ No issues detected
                    </div>
                  )}
                </>
              )}

              <div style={{
                fontSize: '11px',
                color: '#9ca3af',
                marginTop: '12px',
                textAlign: 'center'
              }}>
                {selectedState === state ? 'Click to collapse' : 'Click for details'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

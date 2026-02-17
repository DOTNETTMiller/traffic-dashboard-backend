import { useState, useEffect } from 'react';
import api from '../services/api';

export default function FundingOpportunities() {
  const [opportunities, setOpportunities] = useState([]);
  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedOpp, setSelectedOpp] = useState(null);

  useEffect(() => {
    fetchOpportunities();
    fetchEvidence();
  }, [filter]);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const keyword = filter === 'ccai' ? 'ccai' : filter === 'its' ? 'intelligent transportation' : 'transportation';

      const response = await api.get('/api/funding-opportunities', {
        params: { keyword, category: filter === 'ccai' ? 'ccai' : null }
      });

      if (response.data.success) {
        setOpportunities(response.data.opportunities);
      }
    } catch (error) {
      console.error('Error fetching funding opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvidence = async () => {
    try {
      const response = await api.get('/api/funding-opportunities/evidence');
      if (response.data.success) {
        setEvidence(response.data.evidence);
      }
    } catch (error) {
      console.error('Error fetching grant evidence:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#ca8a04';
      default: return '#64748b';
    }
  };

  const getAlignmentColor = (level) => {
    switch (level) {
      case 'excellent': return '#16a34a';
      case 'good': return '#2563eb';
      case 'fair': return '#ca8a04';
      default: return '#64748b';
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'Not specified';
    return `$${(amount / 1000000).toFixed(1)}M`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not specified';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
          💰 Funding Opportunities
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Federal grants for transportation research, deployment, and multi-state coordination
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#6b7280',
        borderRadius: '8px'
      }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: filter === 'all' ? '#2563eb' : 'white',
            color: filter === 'all' ? 'white' : '#334155',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          All Opportunities
        </button>
        <button
          onClick={() => setFilter('ccai')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: filter === 'ccai' ? '#2563eb' : 'white',
            color: filter === 'ccai' ? 'white' : '#334155',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          🎯 CCAI-Aligned
        </button>
        <button
          onClick={() => setFilter('its')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: filter === 'its' ? '#2563eb' : 'white',
            color: filter === 'its' ? 'white' : '#334155',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          🚦 ITS & Smart Mobility
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔄</div>
          <div>Loading funding opportunities...</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedOpp ? '1fr 1fr' : '1fr', gap: '20px' }}>
          {/* Opportunities List */}
          <div>
            {opportunities.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px',
                backgroundColor: '#6b7280',
                borderRadius: '8px',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <div style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>
                  No opportunities found
                </div>
                <div style={{ fontSize: '14px' }}>
                  Try a different filter or check back later
                </div>
              </div>
            ) : (
              opportunities.map((opp, idx) => (
                <div
                  key={opp.id}
                  onClick={() => setSelectedOpp(opp)}
                  style={{
                    marginBottom: '16px',
                    padding: '20px',
                    backgroundColor: 'white',
                    border: selectedOpp?.id === opp.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedOpp?.id !== opp.id) {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedOpp?.id !== opp.id) {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        backgroundColor: getPriorityColor(opp.priority) + '15',
                        color: getPriorityColor(opp.priority),
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        marginBottom: '8px'
                      }}>
                        {opp.priority} Priority
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px', color: '#1e293b' }}>
                        {opp.title}
                      </h3>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>
                        {opp.agency}
                      </div>
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      backgroundColor: getAlignmentColor(opp.platformAlignment.level) + '15',
                      color: getAlignmentColor(opp.platformAlignment.level),
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      textAlign: 'center',
                      minWidth: '80px'
                    }}>
                      {opp.platformAlignment.score}% Match
                    </div>
                  </div>

                  {/* Match reasons */}
                  <div style={{ marginBottom: '12px' }}>
                    {opp.matchReasons.map((reason, i) => (
                      <div key={i} style={{
                        fontSize: '12px',
                        color: '#059669',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>✓</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>

                  {/* Footer info */}
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '12px',
                    color: '#64748b',
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    <div>
                      <strong>Deadline:</strong> {formatDate(opp.closeDate)}
                    </div>
                    {opp.estimatedFunding && (
                      <div>
                        <strong>Funding:</strong> {formatCurrency(opp.estimatedFunding)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Detail Panel */}
          {selectedOpp && (
            <div style={{
              position: 'sticky',
              top: '20px',
              padding: '24px',
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>
                  {selectedOpp.title}
                </h2>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                  {selectedOpp.agency} • ID: {selectedOpp.id}
                </div>

                <div style={{
                  padding: '12px',
                  backgroundColor: '#6b7280',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#166534', marginBottom: '8px' }}>
                    Platform Capabilities Match
                  </div>
                  {selectedOpp.platformAlignment.capabilities.map((cap, i) => (
                    <div key={i} style={{ fontSize: '12px', color: '#16a34a', marginBottom: '4px' }}>
                      ✓ {cap}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Description</h3>
                <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#475569' }}>
                  {selectedOpp.description}
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Key Dates</h3>
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Opens:</strong> {formatDate(selectedOpp.openDate)}
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Closes:</strong> {formatDate(selectedOpp.closeDate)}
                  </div>
                </div>
              </div>

              {selectedOpp.estimatedFunding && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Funding</h3>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    Estimated: {formatCurrency(selectedOpp.estimatedFunding)}
                  </div>
                  {selectedOpp.awardFloor && selectedOpp.awardCeiling && (
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      Range: {formatCurrency(selectedOpp.awardFloor)} - {formatCurrency(selectedOpp.awardCeiling)}
                    </div>
                  )}
                </div>
              )}

              {evidence && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                    Grant Evidence (Auto-Generated)
                  </h3>
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '6px' }}>Data Quality:</div>
                    {evidence.dataQuality.slice(0, 3).map((item, i) => (
                      <div key={i} style={{ color: '#1e40af', marginBottom: '3px' }}>• {item}</div>
                    ))}

                    <div style={{ fontWeight: '600', marginTop: '12px', marginBottom: '6px' }}>Multi-State Coordination:</div>
                    {evidence.multiStateCoordination.slice(0, 2).map((item, i) => (
                      <div key={i} style={{ color: '#1e40af', marginBottom: '3px' }}>• {item}</div>
                    ))}
                  </div>
                </div>
              )}

              <a
                href={selectedOpp.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  padding: '12px',
                  backgroundColor: '#2563eb',
                  color: '#111827',
                  textAlign: 'center',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                View Full Opportunity →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


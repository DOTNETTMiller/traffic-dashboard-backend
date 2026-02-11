import { useState, useEffect } from 'react';
import { config } from '../config';

export default function TETCDataGrading() {
  const [qualityData, setQualityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedService, setSelectedService] = useState('all');
  const [votes, setVotes] = useState({});
  const [voteCounts, setVoteCounts] = useState({});

  useEffect(() => {
    fetchQualityData();
    fetchVoteCounts();
  }, []);

  const fetchQualityData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.apiUrl}/api/data-quality/summary`);
      if (!response.ok) throw new Error('Failed to fetch quality data');
      const data = await response.json();
      setQualityData(data);
    } catch (error) {
      console.error('Error fetching TETC quality data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchVoteCounts = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/data-quality/votes`);
      if (!response.ok) throw new Error('Failed to fetch vote counts');
      const data = await response.json();
      if (data.success) {
        setVoteCounts(data.votes);
      }
    } catch (error) {
      console.error('Error fetching vote counts:', error);
    }
  };

  const handleVote = async (feedId, voteType) => {
    // Optimistically update UI
    const previousVote = votes[feedId];
    setVotes(prev => ({
      ...prev,
      [feedId]: prev[feedId] === voteType ? null : voteType
    }));

    try {
      const response = await fetch(`${config.apiUrl}/api/data-quality/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedId, voteType })
      });

      if (!response.ok) throw new Error('Failed to submit vote');

      const data = await response.json();
      console.log('Vote response:', data);

      // Refresh vote counts to get updated totals
      await fetchVoteCounts();
    } catch (error) {
      console.error('Error submitting vote:', error);
      // Revert optimistic update on error
      setVotes(prev => ({
        ...prev,
        [feedId]: previousVote
      }));
    }
  };

  const getComplianceColor = (percentage) => {
    if (percentage >= 90) return '#10b981';
    if (percentage >= 75) return '#3b82f6';
    if (percentage >= 60) return '#f59e0b';
    if (percentage >= 40) return '#f97316';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div>Loading TETC Data Quality Grading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
        Error loading data: {error}
      </div>
    );
  }

  if (!qualityData || qualityData.feeds.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        No TETC quality data available. Run migrations to populate sample data.
      </div>
    );
  }

  // Group feeds by service type
  const feedsByService = qualityData.feeds.reduce((acc, feed) => {
    if (!acc[feed.service_display_name]) {
      acc[feed.service_display_name] = [];
    }
    acc[feed.service_display_name].push(feed);
    return acc;
  }, {});

  const serviceTypes = ['all', ...Object.keys(feedsByService)];
  const filteredFeeds = selectedService === 'all'
    ? qualityData.feeds
    : feedsByService[selectedService] || [];

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundcolor: '#6b7280',
      overflow: 'hidden'
    }}>
      {/* Main Content Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                TETC Data Quality Grading System
              </h1>
              <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
                Evaluating data quality across TETC corridors using MDODE-aligned scoring framework
              </p>
            </div>
            <a
              href="https://tetcoalition.org/tdm/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '10px 20px',
                backgroundColor: '#3b82f6',
                color: '#111827',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background-color 0.2s',
                whiteSpace: 'nowrap',
                marginLeft: '16px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
            >
              📚 TETC Validation Docs →
            </a>
          </div>
        </div>

        {/* Service Type Filter */}
        <div style={{
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
            Filter by Service Type:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {serviceTypes.map((service) => (
              <button
                key={service}
                onClick={() => setSelectedService(service)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: selectedService === service ? '2px solid #3b82f6' : '1px solid #d1d5db',
                  backgroundColor: selectedService === service ? '#eff6ff' : 'white',
                  color: selectedService === service ? '#1e40af' : '#6b7280',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (selectedService !== service) {
                    e.currentTarget.style.borderColor = '#9ca3af';
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedService !== service) {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                {service === 'all' ? 'All Services' : service} ({service === 'all' ? qualityData.feeds.length : feedsByService[service].length})
              </button>
            ))}
          </div>
        </div>

        {/* Quality Scores Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '20px'
        }}>
          {filteredFeeds.map((feed) => (
            <div
              key={feed.data_feed_id}
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: `2px solid ${getComplianceColor(feed.dqi)}`,
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Header with Grade */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                    {feed.corridor_name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                    {feed.service_display_name} • {feed.provider_name}
                  </div>
                  {feed.run_name && (
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px', fontStyle: 'italic' }}>
                      {feed.run_name}
                    </div>
                  )}
                  {feed.methodology_ref && (
                    <a
                      href={feed.methodology_ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '12px',
                        color: '#3b82f6',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: '600',
                        padding: '4px 8px',
                        backgroundColor: '#eff6ff',
                        borderRadius: '4px',
                        border: '1px solid #bfdbfe'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#dbeafe';
                        e.currentTarget.style.borderColor = '#93c5fd';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#eff6ff';
                        e.currentTarget.style.borderColor = '#bfdbfe';
                      }}
                    >
                      📊 View Validation Report
                    </a>
                  )}
                </div>
                <div style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '12px',
                  backgroundColor: getComplianceColor(feed.dqi),
                  color: '#111827',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  flexShrink: 0
                }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', lineHeight: 1 }}>
                    {Math.round(feed.dqi)}%
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: '600', marginTop: '4px' }}>
                    DQI
                  </div>
                </div>
              </div>

              {/* DQI Score */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600' }}>
                  Data Quality Index (DQI)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    flex: 1,
                    height: '8px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${feed.dqi}%`,
                      backgroundColor: getComplianceColor(feed.dqi),
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: getComplianceColor(feed.dqi), minWidth: '50px', textAlign: 'right' }}>
                    {Math.round(feed.dqi)}%
                  </div>
                </div>
              </div>

              {/* Quality Dimensions */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <div style={{
                  padding: '10px',
                  backgroundcolor: '#6b7280',
                  borderRadius: '6px',
                  border: '1px solid #86efac'
                }}>
                  <div style={{ fontSize: '10px', color: '#166534', marginBottom: '4px', fontWeight: '600' }}>
                    ACCURACY
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#15803d' }}>
                    {Math.round(feed.acc_score || 0)}
                  </div>
                </div>
                <div style={{
                  padding: '10px',
                  backgroundColor: '#eff6ff',
                  borderRadius: '6px',
                  border: '1px solid #93c5fd'
                }}>
                  <div style={{ fontSize: '10px', color: '#1e40af', marginBottom: '4px', fontWeight: '600' }}>
                    COVERAGE
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a' }}>
                    {Math.round(feed.cov_score || 0)}
                  </div>
                </div>
                <div style={{
                  padding: '10px',
                  backgroundcolor: '#6b7280',
                  borderRadius: '6px',
                  border: '1px solid #fde68a'
                }}>
                  <div style={{ fontSize: '10px', color: '#92400e', marginBottom: '4px', fontWeight: '600' }}>
                    TIMELINESS
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b45309' }}>
                    {Math.round(feed.tim_score || 0)}
                  </div>
                </div>
                <div style={{
                  padding: '10px',
                  backgroundcolor: '#6b7280',
                  borderRadius: '6px',
                  border: '1px solid #c4b5fd'
                }}>
                  <div style={{ fontSize: '10px', color: '#5b21b6', marginBottom: '4px', fontWeight: '600' }}>
                    STANDARDS
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#6b21a8' }}>
                    {Math.round(feed.std_score || 0)}
                  </div>
                </div>
              </div>

              {/* Governance Score */}
              {feed.gov_score !== null && feed.gov_score !== undefined && (
                <div style={{
                  padding: '10px',
                  backgroundcolor: '#6b7280',
                  borderRadius: '6px',
                  border: '1px solid #fbcfe8',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ fontSize: '10px', color: '#9f1239', fontWeight: '600' }}>
                    GOVERNANCE
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#be123c' }}>
                    {Math.round(feed.gov_score)}
                  </div>
                </div>
              )}

              {/* Validation Period */}
              {feed.period_start && feed.period_end && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px',
                  backgroundcolor: '#6b7280',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#6b7280'
                }}>
                  Validation Period: {new Date(feed.period_start).toLocaleDateString()} - {new Date(feed.period_end).toLocaleDateString()}
                </div>
              )}

              {/* Source Citation */}
              {feed.methodology_ref && (
                <div style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e5e7eb',
                  fontSize: '10px',
                  color: '#9ca3af',
                  lineHeight: '1.5'
                }}>
                  <strong>Source:</strong> {feed.run_name || 'TETC Data Quality Validation'}.{' '}
                  {feed.provider_name && `${feed.provider_name}. `}
                  {feed.period_start && `Validated ${new Date(feed.period_start).toLocaleDateString()} - ${new Date(feed.period_end).toLocaleDateString()}. `}
                  <a
                    href={feed.methodology_ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#3b82f6',
                      textDecoration: 'underline'
                    }}
                  >
                    {feed.methodology_ref}
                  </a>
                </div>
              )}

              {/* Voting Section */}
              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>
                    Is this score accurate?
                  </div>
                  {voteCounts[feed.data_feed_id] && voteCounts[feed.data_feed_id].total > 0 && (
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {voteCounts[feed.data_feed_id].total} vote{voteCounts[feed.data_feed_id].total !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => handleVote(feed.data_feed_id, 'up')}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: votes[feed.data_feed_id] === 'up' ? '2px solid #10b981' : '1px solid #d1d5db',
                      backgroundColor: votes[feed.data_feed_id] === 'up' ? '#ecfdf5' : 'white',
                      color: votes[feed.data_feed_id] === 'up' ? '#065f46' : '#6b7280',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (votes[feed.data_feed_id] !== 'up') {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (votes[feed.data_feed_id] !== 'up') {
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    👍 Yes
                    {voteCounts[feed.data_feed_id] && voteCounts[feed.data_feed_id].upvotes > 0 && (
                      <span style={{ marginLeft: '4px', fontSize: '11px' }}>
                        ({voteCounts[feed.data_feed_id].upvotes})
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleVote(feed.data_feed_id, 'down')}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: votes[feed.data_feed_id] === 'down' ? '2px solid #ef4444' : '1px solid #d1d5db',
                      backgroundColor: votes[feed.data_feed_id] === 'down' ? '#fef2f2' : 'white',
                      color: votes[feed.data_feed_id] === 'down' ? '#991b1b' : '#6b7280',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (votes[feed.data_feed_id] !== 'down') {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (votes[feed.data_feed_id] !== 'down') {
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    👎 No
                    {voteCounts[feed.data_feed_id] && voteCounts[feed.data_feed_id].downvotes > 0 && (
                      <span style={{ marginLeft: '4px', fontSize: '11px' }}>
                        ({voteCounts[feed.data_feed_id].downvotes})
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredFeeds.length === 0 && (
          <div style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            No data feeds found for the selected service type.
          </div>
        )}
      </div>

      {/* Right Sidebar - Scoring Directions */}
      <div style={{
        width: '350px',
        backgroundColor: 'white',
        borderLeft: '1px solid #e5e7eb',
        overflowY: 'auto',
        padding: '24px',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.05)'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
          📊 Scoring Guide
        </h2>

        {/* DQI Explanation */}
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundcolor: '#6b7280',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
            Data Quality Index (DQI)
          </div>
          <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#6b7280', margin: '0 0 12px 0' }}>
            The DQI is a composite score (0-100) that aggregates multiple quality dimensions. Higher scores indicate better overall data quality.
          </p>
        </div>

        {/* Compliance Scale */}
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundcolor: '#6b7280',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
            Compliance Scale
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { range: '90-100%', color: '#10b981', label: 'Excellent' },
              { range: '75-89%', color: '#3b82f6', label: 'Good' },
              { range: '60-74%', color: '#f59e0b', label: 'Moderate' },
              { range: '40-59%', color: '#f97316', label: 'Below Standard' },
              { range: '0-39%', color: '#ef4444', label: 'Poor' }
            ].map(({ range, color, label }) => (
              <div
                key={range}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 10px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: `2px solid ${color}`
                }}
              >
                <div style={{
                  width: '60px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: color,
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {range}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quality Dimensions */}
        <div style={{
          marginBottom: '24px'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
            Quality Dimensions
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              padding: '12px',
              backgroundcolor: '#6b7280',
              borderRadius: '6px',
              border: '1px solid #86efac'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#166534', marginBottom: '4px' }}>
                ✓ ACCURACY (ACC)
              </div>
              <p style={{ fontSize: '11px', lineHeight: '1.5', color: '#166534', margin: '0' }}>
                How precise and correct the data values are. Compares against ground truth or reference data.
              </p>
            </div>

            <div style={{
              padding: '12px',
              backgroundColor: '#eff6ff',
              borderRadius: '6px',
              border: '1px solid #93c5fd'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e40af', marginBottom: '4px' }}>
                📍 COVERAGE (COV)
              </div>
              <p style={{ fontSize: '11px', lineHeight: '1.5', color: '#1e40af', margin: '0' }}>
                Completeness of data across the corridor. Measures geographic and temporal coverage.
              </p>
            </div>

            <div style={{
              padding: '12px',
              backgroundcolor: '#6b7280',
              borderRadius: '6px',
              border: '1px solid #fde68a'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
                ⏱️ TIMELINESS (TIM)
              </div>
              <p style={{ fontSize: '11px', lineHeight: '1.5', color: '#92400e', margin: '0' }}>
                How current and frequently updated the data is. Evaluates update latency and freshness.
              </p>
            </div>

            <div style={{
              padding: '12px',
              backgroundcolor: '#6b7280',
              borderRadius: '6px',
              border: '1px solid #c4b5fd'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#5b21b6', marginBottom: '4px' }}>
                📋 STANDARDS (STD)
              </div>
              <p style={{ fontSize: '11px', lineHeight: '1.5', color: '#5b21b6', margin: '0' }}>
                Compliance with data standards (WZDx, SAE J2735, TMDD). Measures adherence to specifications.
              </p>
            </div>

            <div style={{
              padding: '12px',
              backgroundcolor: '#6b7280',
              borderRadius: '6px',
              border: '1px solid #fbcfe8'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#9f1239', marginBottom: '4px' }}>
                🏛️ GOVERNANCE (GOV)
              </div>
              <p style={{ fontSize: '11px', lineHeight: '1.5', color: '#9f1239', margin: '0' }}>
                Data management practices, documentation quality, and institutional support for data quality.
              </p>
            </div>
          </div>
        </div>

        {/* How to Score Your Data */}
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#eff6ff',
          borderRadius: '8px',
          border: '2px solid #3b82f6'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1e40af' }}>
            ✍️ How to Score Your Data
          </div>
          <p style={{ fontSize: '12px', lineHeight: '1.6', color: '#1e40af', margin: '0 0 12px 0' }}>
            Each dimension is scored 0-100 based on these criteria:
          </p>
          <div style={{ fontSize: '11px', lineHeight: '1.6', color: '#1e3a8a' }}>
            <strong>ACCURACY:</strong> Compare against ground truth. 95%+ match = 90-100, 85-94% = 80-89, 75-84% = 70-79
            <br /><br />
            <strong>COVERAGE:</strong> % of corridor/time covered. 90%+ = 90-100, 75-89% = 80-89, 60-74% = 70-79
            <br /><br />
            <strong>TIMELINESS:</strong> Update frequency. Real-time (&lt; 1 min) = 90-100, &lt; 5 min = 80-89, &lt; 15 min = 70-79
            <br /><br />
            <strong>STANDARDS:</strong> WZDx/J2735/TMDD compliance. Full compliance = 90-100, Most fields = 80-89, Some fields = 70-79
            <br /><br />
            <strong>GOVERNANCE:</strong> Documentation, SLAs, support. Excellent = 90-100, Good = 80-89, Fair = 70-79
          </div>
        </div>

        {/* MDODE Alignment */}
        <div style={{
          padding: '16px',
          backgroundColor: '#ecfdf5',
          borderRadius: '8px',
          border: '1px solid #10b981'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#065f46' }}>
            📚 MDODE Alignment
          </div>
          <p style={{ fontSize: '12px', lineHeight: '1.6', color: '#065f46', margin: '0' }}>
            This scoring framework aligns with the USDOT Multimodal Data Operations & Data Exchange (MDODE) principles for evaluating transportation data quality.
          </p>
        </div>
      </div>
    </div>
  );
}

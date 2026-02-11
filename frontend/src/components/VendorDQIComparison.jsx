import { useState, useEffect } from 'react';
import { config } from '../config';

export default function VendorDQIComparison() {
  const [vendorData, setVendorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVendorType, setSelectedVendorType] = useState('all');
  const [votes, setVotes] = useState({});
  const [voteCounts, setVoteCounts] = useState({});

  useEffect(() => {
    fetchVendorData();
    fetchVoteCounts();
  }, []);

  const fetchVendorData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.apiUrl}/api/vendors/quality-scores`);
      if (!response.ok) throw new Error('Failed to fetch vendor data');
      const data = await response.json();
      setVendorData(data);
    } catch (error) {
      console.error('Error fetching vendor data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchVoteCounts = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/vendors/votes`);
      if (!response.ok) throw new Error('Failed to fetch vote counts');
      const data = await response.json();
      if (data.success) {
        setVoteCounts(data.votes);
      }
    } catch (error) {
      console.error('Error fetching vote counts:', error);
    }
  };

  const handleVote = async (evaluationId, voteType) => {
    // Optimistically update UI
    const previousVote = votes[evaluationId];
    setVotes(prev => ({
      ...prev,
      [evaluationId]: prev[evaluationId] === voteType ? null : voteType
    }));

    try {
      const response = await fetch(`${config.apiUrl}/api/vendors/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ evaluationId, voteType })
      });

      if (!response.ok) throw new Error('Failed to submit vote');

      // Refresh vote counts
      await fetchVoteCounts();
    } catch (error) {
      console.error('Error submitting vote:', error);
      // Revert optimistic update on error
      setVotes(prev => ({
        ...prev,
        [evaluationId]: previousVote
      }));
    }
  };

  const getGradeColor = (grade) => {
    const colors = {
      'A': '#10b981',
      'B': '#3b82f6',
      'C': '#f59e0b',
      'D': '#ef4444',
      'F': '#991b1b'
    };
    return colors[grade] || '#6b7280';
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div>Loading TETC Vendor Comparison...</div>
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

  if (!vendorData || vendorData.vendors.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        No vendor data available.
      </div>
    );
  }

  // Get unique vendor types
  const vendorTypes = ['all', ...new Set(vendorData.vendors.map(v => v.vendor_type))];
  const filteredVendors = selectedVendorType === 'all'
    ? vendorData.vendors
    : vendorData.vendors.filter(v => v.vendor_type === selectedVendorType);

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
                TETC Vendor DQI Comparison
              </h1>
              <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
                Comparing data quality across {vendorData.vendors.length} TETC Transportation Data Marketplace vendors
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
              Visit TETC TDM →
            </a>
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>
              Total Vendors
            </div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>
              {vendorData.summary.total_vendors}
            </div>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>
              Average DQI
            </div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6' }}>
              {Math.round(vendorData.summary.avg_dqi)}
            </div>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>
              Grade Distribution
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              {['A', 'B', 'C', 'D', 'F'].map(grade => (
                <div key={grade} style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: getGradeColor(grade),
                  color: '#111827',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {grade}: {vendorData.summary.grade_distribution[grade]}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vendor Type Filter */}
        <div style={{
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
            Filter by Vendor Type:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {vendorTypes.map((type) => {
              const count = type === 'all'
                ? vendorData.vendors.length
                : vendorData.vendors.filter(v => v.vendor_type === type).length;

              return (
                <button
                  key={type}
                  onClick={() => setSelectedVendorType(type)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: selectedVendorType === type ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    backgroundColor: selectedVendorType === type ? '#eff6ff' : 'white',
                    color: selectedVendorType === type ? '#1e40af' : '#6b7280',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {type === 'all' ? 'All Vendors' : type.replace(/_/g, ' ')} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Vendor Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '20px'
        }}>
          {filteredVendors.map((vendor) => (
            <div
              key={vendor.vendor_id}
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: `2px solid ${getGradeColor(vendor.letter_grade)}`,
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
                    {vendor.vendor_name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                    {vendor.vendor_type?.replace(/_/g, ' ')}
                  </div>
                  {vendor.website_url && (
                    <a
                      href={vendor.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '12px',
                        color: '#3b82f6',
                        textDecoration: 'none',
                        display: 'inline-block',
                        marginTop: '4px'
                      }}
                    >
                      Visit Website →
                    </a>
                  )}
                </div>
                <div style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '12px',
                  backgroundColor: getGradeColor(vendor.letter_grade),
                  color: '#111827',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  flexShrink: 0
                }}>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }}>
                    {vendor.letter_grade}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '600', marginTop: '4px' }}>
                    {Math.round(vendor.dqi)}
                  </div>
                </div>
              </div>

              {/* Data Categories */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px', fontWeight: '600' }}>
                  DATA CATEGORIES
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {vendor.data_categories.map((category, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '4px 8px',
                        backgroundcolor: '#6b7280',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: '#374151',
                        fontWeight: '600'
                      }}
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>

              {/* DQI Score Bar */}
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
                      width: `${vendor.dqi}%`,
                      backgroundColor: getGradeColor(vendor.letter_grade),
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: getGradeColor(vendor.letter_grade), minWidth: '50px', textAlign: 'right' }}>
                    {Math.round(vendor.dqi)}
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
                    {Math.round(vendor.acc_score || 0)}
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
                    {Math.round(vendor.cov_score || 0)}
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
                    {Math.round(vendor.tim_score || 0)}
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
                    {Math.round(vendor.std_score || 0)}
                  </div>
                </div>
              </div>

              {/* Governance Score */}
              {vendor.gov_score !== null && vendor.gov_score !== undefined && (
                <div style={{
                  padding: '10px',
                  backgroundcolor: '#6b7280',
                  borderRadius: '6px',
                  border: '1px solid #fbcfe8',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontSize: '10px', color: '#9f1239', fontWeight: '600' }}>
                    GOVERNANCE
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#be123c' }}>
                    {Math.round(vendor.gov_score)}
                  </div>
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
                  {voteCounts[vendor.evaluation_id] && voteCounts[vendor.evaluation_id].total > 0 && (
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {voteCounts[vendor.evaluation_id].total} vote{voteCounts[vendor.evaluation_id].total !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => handleVote(vendor.evaluation_id, 'up')}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: votes[vendor.evaluation_id] === 'up' ? '2px solid #10b981' : '1px solid #d1d5db',
                      backgroundColor: votes[vendor.evaluation_id] === 'up' ? '#ecfdf5' : 'white',
                      color: votes[vendor.evaluation_id] === 'up' ? '#065f46' : '#6b7280',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                  >
                    👍 Yes
                    {voteCounts[vendor.evaluation_id] && voteCounts[vendor.evaluation_id].upvotes > 0 && (
                      <span style={{ marginLeft: '4px', fontSize: '11px' }}>
                        ({voteCounts[vendor.evaluation_id].upvotes})
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleVote(vendor.evaluation_id, 'down')}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: votes[vendor.evaluation_id] === 'down' ? '2px solid #ef4444' : '1px solid #d1d5db',
                      backgroundColor: votes[vendor.evaluation_id] === 'down' ? '#fef2f2' : 'white',
                      color: votes[vendor.evaluation_id] === 'down' ? '#991b1b' : '#6b7280',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                  >
                    👎 No
                    {voteCounts[vendor.evaluation_id] && voteCounts[vendor.evaluation_id].downvotes > 0 && (
                      <span style={{ marginLeft: '4px', fontSize: '11px' }}>
                        ({voteCounts[vendor.evaluation_id].downvotes})
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredVendors.length === 0 && (
          <div style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            No vendors found for the selected type.
          </div>
        )}
      </div>

      {/* Right Sidebar - Scoring Guide */}
      <div style={{
        width: '350px',
        backgroundColor: 'white',
        borderLeft: '1px solid #e5e7eb',
        overflowY: 'auto',
        padding: '24px',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.05)'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
          Scoring Guide
        </h2>

        {/* About TETC TDM */}
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#eff6ff',
          borderRadius: '8px',
          border: '2px solid #3b82f6'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e40af' }}>
            About TETC TDM
          </div>
          <p style={{ fontSize: '12px', lineHeight: '1.6', color: '#1e40af', margin: '0' }}>
            The Eastern Transportation Coalition's Transportation Data Marketplace (TDM) provides member agencies access to prequalified vendors offering reliable transportation data at negotiated rates.
          </p>
        </div>

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
          <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#6b7280', margin: '0' }}>
            Composite score (0-100) based on weighted average: Accuracy (25%), Coverage (20%), Timeliness (20%), Standards (20%), Governance (15%).
          </p>
        </div>

        {/* Grade Scale */}
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundcolor: '#6b7280',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
            Letter Grade Scale
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { grade: 'A', min: 90, color: '#10b981', label: 'Excellent' },
              { grade: 'B', min: 80, color: '#3b82f6', label: 'Good' },
              { grade: 'C', min: 70, color: '#6b7280', label: 'Fair' },
              { grade: 'D', min: 60, color: '#ef4444', label: 'Poor' },
              { grade: 'F', min: 0, color: '#991b1b', label: 'Failing' }
            ].map(({ grade, min, color, label }) => (
              <div
                key={grade}
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
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: color,
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {grade}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    {min}+ points
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data Sources */}
        <div style={{
          padding: '16px',
          backgroundColor: '#ecfdf5',
          borderRadius: '8px',
          border: '1px solid #10b981'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#065f46' }}>
            Data Sources
          </div>
          <p style={{ fontSize: '12px', lineHeight: '1.6', color: '#065f46', margin: '0' }}>
            Scores based on TETC validation reports, independent studies (VDOT, USDOT), vendor documentation, and industry assessments as of November 2024.
          </p>
        </div>
      </div>
    </div>
  );
}

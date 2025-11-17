import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';

export default function CorridorDataQuality() {
  const [corridors, setCorridors] = useState([]);
  const [selectedCorridor, setSelectedCorridor] = useState(null);
  const [corridorData, setCorridorData] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [serviceDetails, setServiceDetails] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchCorridors(),
      fetchSummary()
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedCorridor) {
      fetchCorridorData(selectedCorridor.corridor_id);
    }
  }, [selectedCorridor]);

  useEffect(() => {
    if (selectedService && selectedCorridor) {
      fetchServiceDetails(selectedCorridor.corridor_id, selectedService.service_type_id);
    }
  }, [selectedService, selectedCorridor]);

  const fetchCorridors = async () => {
    try {
      const response = await axios.get(`${config.apiUrl}/api/data-quality/corridors`);
      setCorridors(response.data.corridors);
      if (response.data.corridors.length > 0) {
        setSelectedCorridor(response.data.corridors[0]);
      }
    } catch (err) {
      setError('Failed to load corridors');
      console.error(err);
    }
  };

  const fetchCorridorData = async (corridorId) => {
    try {
      const response = await axios.get(`${config.apiUrl}/api/data-quality/corridor/${corridorId}`);
      setCorridorData(response.data);
    } catch (err) {
      setError('Failed to load corridor data');
      console.error(err);
    }
  };

  const fetchServiceDetails = async (corridorId, serviceTypeId) => {
    try {
      const response = await axios.get(
        `${config.apiUrl}/api/data-quality/corridor/${corridorId}/service/${serviceTypeId}`
      );
      setServiceDetails(response.data);
    } catch (err) {
      setError('Failed to load service details');
      console.error(err);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await axios.get(`${config.apiUrl}/api/data-quality/summary`);
      setSummary(response.data.summary);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  };

  const getGradeColor = (grade) => {
    const baseGrade = grade ? grade.replace(/[+-]/g, '') : 'F';
    const colors = {
      'A': '#10b981',
      'B': '#3b82f6',
      'C': '#f59e0b',
      'D': '#ef4444',
      'F': '#991b1b'
    };
    return colors[baseGrade] || '#6b7280';
  };

  const getDQIColor = (dqi) => {
    if (dqi >= 90) return '#10b981';
    if (dqi >= 80) return '#3b82f6';
    if (dqi >= 70) return '#f59e0b';
    if (dqi >= 60) return '#ef4444';
    return '#991b1b';
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        color: '#6b7280'
      }}>
        Loading data quality information...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: '#fee2e2',
        borderRadius: '8px',
        color: '#991b1b',
        border: '1px solid #fecaca'
      }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: '#1f2937' }}>
              Data Quality Grading System
            </h2>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
              MDODE-aligned quality assessment for corridor data services
            </p>
          </div>
          <a
            href="https://github.com/DOTNETTMiller/traffic-dashboard-backend/blob/main/docs/TETC_MDODE_Grading_SOP.md"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.2s',
              border: 'none',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
            }}
          >
            <span>📋</span>
            <span>View TETC Grading SOP</span>
          </a>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Services</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937' }}>
              {summary.totalScores}
            </div>
          </div>

          <div style={{
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Average DQI</div>
            <div style={{
              fontSize: '28px',
              fontWeight: '700',
              color: getDQIColor(summary.avgDQI)
            }}>
              {summary.avgDQI.toFixed(1)}
            </div>
          </div>

          {summary.gradeDistribution && Object.entries(summary.gradeDistribution)
            .slice(0, 3)
            .map(([grade, count]) => (
              <div key={grade} style={{
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  Grade {grade}
                </div>
                <div style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: getGradeColor(grade)
                }}>
                  {count}
                </div>
              </div>
            ))}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedService ? '1fr 1fr' : '1fr 2fr',
        gap: '20px'
      }}>
        {/* Corridor Selector */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
            Corridors
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {corridors.map((corridor) => (
              <button
                key={corridor.corridor_id}
                onClick={() => {
                  setSelectedCorridor(corridor);
                  setSelectedService(null);
                  setServiceDetails(null);
                }}
                style={{
                  padding: '12px',
                  backgroundColor: selectedCorridor?.corridor_id === corridor.corridor_id
                    ? '#eff6ff'
                    : 'transparent',
                  border: selectedCorridor?.corridor_id === corridor.corridor_id
                    ? '1px solid #3b82f6'
                    : '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '14px',
                  color: '#1f2937',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (selectedCorridor?.corridor_id !== corridor.corridor_id) {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedCorridor?.corridor_id !== corridor.corridor_id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {corridor.corridor_name}
              </button>
            ))}
          </div>
        </div>

        {/* Services List */}
        {corridorData && !selectedService && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#1f2937' }}>
              {corridorData.corridor.name}
            </h3>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
              {corridorData.services.length} services • Avg DQI: {corridorData.summary.avgDQI.toFixed(1)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {corridorData.services.map((service) => (
                <div
                  key={service.service_type_id}
                  onClick={() => setSelectedService(service)}
                  style={{
                    padding: '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div style={{ fontWeight: '600', fontSize: '15px', color: '#1f2937' }}>
                      {service.service_display_name}
                    </div>
                    <div style={{
                      padding: '4px 12px',
                      backgroundColor: getGradeColor(service.letter_grade),
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: '700'
                    }}>
                      {service.letter_grade}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    fontSize: '13px',
                    color: '#6b7280'
                  }}>
                    <div>
                      <span style={{ fontWeight: '600' }}>DQI:</span> {service.dqi}
                    </div>
                    <div>
                      <span style={{ fontWeight: '600' }}>Provider:</span> {service.provider_name}
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '8px',
                    marginTop: '12px'
                  }}>
                    {[
                      { label: 'ACC', score: service.acc_score, weight: '40%' },
                      { label: 'COV', score: service.cov_score, weight: '25%' },
                      { label: 'TIM', score: service.tim_score, weight: '20%' },
                      { label: 'STD', score: service.std_score, weight: '10%' },
                      { label: 'GOV', score: service.gov_score, weight: '5%' }
                    ].map(({ label, score, weight }) => (
                      <div key={label} style={{
                        textAlign: 'center',
                        padding: '6px',
                        backgroundColor: 'white',
                        borderRadius: '4px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          fontSize: '11px',
                          color: '#6b7280',
                          marginBottom: '2px'
                        }}>
                          {label} ({weight})
                        </div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: getDQIColor(score)
                        }}>
                          {score}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Service Details */}
        {selectedService && serviceDetails && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                {selectedService.service_display_name}
              </h3>
              <button
                onClick={() => {
                  setSelectedService(null);
                  setServiceDetails(null);
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#1f2937'
                }}
              >
                Back
              </button>
            </div>

            {/* Current Grade Card */}
            <div style={{
              padding: '16px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                    Current Grade
                  </div>
                  <div style={{
                    fontSize: '48px',
                    fontWeight: '700',
                    color: getGradeColor(serviceDetails.service.letter_grade)
                  }}>
                    {serviceDetails.service.letter_grade}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    DQI: {serviceDetails.service.dqi}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                    Validation Period
                  </div>
                  <div style={{ fontSize: '14px', color: '#1f2937' }}>
                    {new Date(serviceDetails.service.period_start).toLocaleDateString()} - {new Date(serviceDetails.service.period_end).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Validation History */}
            {serviceDetails.validationHistory.length > 1 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px'
                }}>
                  Validation History
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {serviceDetails.validationHistory.slice(0, 5).map((run) => (
                    <div
                      key={run.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '10px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ color: '#1f2937' }}>
                        {new Date(run.period_start).toLocaleDateString()} - {new Date(run.period_end).toLocaleDateString()}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{
                          padding: '2px 8px',
                          backgroundColor: getGradeColor(run.letter_grade),
                          color: 'white',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {run.letter_grade}
                        </div>
                        <div style={{ color: '#6b7280' }}>
                          DQI: {run.dqi}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Metrics */}
            {serviceDetails.metrics.length > 0 && (
              <div>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px'
                }}>
                  Detailed Metrics
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {serviceDetails.metrics.map((metric) => (
                    <div
                      key={metric.id}
                      style={{
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px'
                      }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#1f2937'
                        }}>
                          {metric.metric_key.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: getDQIColor(metric.score_0_100)
                        }}>
                          {metric.score_0_100}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        marginBottom: '4px'
                      }}>
                        Raw Value: {metric.raw_value} {metric.unit}
                      </div>
                      {metric.notes && (
                        <div style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          fontStyle: 'italic'
                        }}>
                          {metric.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <h4 style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '12px'
        }}>
          Score Components
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          fontSize: '13px'
        }}>
          <div>
            <span style={{ fontWeight: '600', color: '#1f2937' }}>ACC (40%):</span>{' '}
            <span style={{ color: '#6b7280' }}>Accuracy</span>
          </div>
          <div>
            <span style={{ fontWeight: '600', color: '#1f2937' }}>COV (25%):</span>{' '}
            <span style={{ color: '#6b7280' }}>Coverage</span>
          </div>
          <div>
            <span style={{ fontWeight: '600', color: '#1f2937' }}>TIM (20%):</span>{' '}
            <span style={{ color: '#6b7280' }}>Timeliness</span>
          </div>
          <div>
            <span style={{ fontWeight: '600', color: '#1f2937' }}>STD (10%):</span>{' '}
            <span style={{ color: '#6b7280' }}>Standards Compliance</span>
          </div>
          <div>
            <span style={{ fontWeight: '600', color: '#1f2937' }}>GOV (5%):</span>{' '}
            <span style={{ color: '#6b7280' }}>Governance</span>
          </div>
        </div>
      </div>
    </div>
  );
}

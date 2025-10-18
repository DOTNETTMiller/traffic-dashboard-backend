import { useState, useEffect } from 'react';
import { config } from '../config';

export default function DataQualityReport() {
  const [summary, setSummary] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [stateGuide, setStateGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingGuide, setLoadingGuide] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    if (selectedState) {
      fetchStateGuide(selectedState);
    }
  }, [selectedState]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.apiUrl}/api/compliance/summary`);
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStateGuide = async (stateName) => {
    try {
      setLoadingGuide(true);
      const response = await fetch(`${config.apiUrl}/api/compliance/guide/${stateName.toLowerCase()}`);
      const data = await response.json();
      setStateGuide(data);
    } catch (error) {
      console.error('Error fetching state guide:', error);
    } finally {
      setLoadingGuide(false);
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

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 80) return '#3b82f6';
    if (score >= 70) return '#f59e0b';
    if (score >= 60) return '#ef4444';
    return '#991b1b';
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div>Loading compliance data...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
        Failed to load compliance summary
      </div>
    );
  }

  // Filter out states with 0 events
  const statesWithEvents = summary.states.filter(state => state.eventCount > 0);

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f9fafb',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '24px', fontWeight: 'bold' }}>
          SAE J2735 & C2C Compliance Report
        </h1>
        <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
          Generated: {new Date(summary.generatedAt).toLocaleString()} • {statesWithEvents.length} Active States • Standards: SAE J2735, WZDx v4.x, ngTMDD/C2C-MVT
        </p>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>
            SAE J2735 Ready
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>
            {statesWithEvents.filter(s => s.saeJ2735Ready).length}
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>
            WZDx Compliant
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6' }}>
            {statesWithEvents.filter(s => s.wzdxCompliant).length}
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>
            Avg Data Quality
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {Math.round(statesWithEvents.reduce((sum, s) => sum + s.dataCompletenessScore, 0) / statesWithEvents.length)}%
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>
            Total Events
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {statesWithEvents.reduce((sum, s) => sum + s.eventCount, 0)}
          </div>
        </div>
      </div>

      {/* State Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {statesWithEvents.map((state) => (
          <div
            key={state.name}
            onClick={() => setSelectedState(state.name)}
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: selectedState === state.name ? '2px solid #3b82f6' : '2px solid transparent'
            }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'}
          >
            {/* State Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '15px'
            }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold' }}>
                  {state.name}
                </h3>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {state.eventCount} events • {state.currentFormat}
                </div>
              </div>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '8px',
                backgroundColor: getScoreColor(state.dataCompletenessScore),
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                {state.dataCompletenessScore}
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: '15px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                marginBottom: '5px'
              }}>
                <span style={{ color: '#6b7280' }}>Data Completeness</span>
                <span style={{ fontWeight: 'bold' }}>{state.dataCompletenessScore}%</span>
              </div>
              <div style={{
                height: '8px',
                backgroundColor: '#e5e7eb',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${state.dataCompletenessScore}%`,
                  backgroundColor: getScoreColor(state.dataCompletenessScore),
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* Compliance Badges */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {state.saeJ2735Ready && (
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#d1fae5',
                  color: '#065f46',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  SAE J2735 Ready
                </span>
              )}
              {state.wzdxCompliant && (
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#dbeafe',
                  color: '#1e40af',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  WZDx Compliant
                </span>
              )}
              {!state.saeJ2735Ready && !state.wzdxCompliant && (
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  Needs Improvement
                </span>
              )}
            </div>

            {/* Recommended Action */}
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              fontStyle: 'italic'
            }}>
              {state.recommendedAction}
            </div>

            {/* Click to view details */}
            <div style={{
              marginTop: '10px',
              fontSize: '12px',
              color: '#3b82f6',
              fontWeight: '600'
            }}>
              Click for detailed compliance guide →
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
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}
        onClick={() => setSelectedState(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {loadingGuide ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div>Loading detailed compliance guide...</div>
              </div>
            ) : stateGuide ? (
              <div>
                {/* Modal Header */}
                <div style={{
                  padding: '24px',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold' }}>
                      {stateGuide.state}
                    </h2>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      Format: {stateGuide.currentFormat?.apiType || 'Unknown'} • Generated: {new Date(stateGuide.generatedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedState(null)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Close
                  </button>
                </div>

                {/* Modal Content */}
                <div style={{ padding: '24px' }}>
                  {/* Overall Score */}
                  {stateGuide.overallScore && (
                    <div style={{
                      marginBottom: '24px',
                      padding: '20px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                            OVERALL SCORE
                          </div>
                          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                            {stateGuide.overallScore.percentage}/100
                          </div>
                          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                            {stateGuide.overallScore.rank}
                          </div>
                        </div>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '12px',
                          backgroundColor: getGradeColor(stateGuide.overallScore.grade),
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '36px',
                          fontWeight: 'bold'
                        }}>
                          {stateGuide.overallScore.grade}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* C2C Compliance */}
                  {stateGuide.c2cCompliance && (
                    <div style={{
                      marginBottom: '24px',
                      padding: '20px',
                      backgroundColor: stateGuide.c2cCompliance.grade === 'PASS' ? '#d1fae5' : '#fee2e2',
                      borderRadius: '8px',
                      border: `1px solid ${stateGuide.c2cCompliance.grade === 'PASS' ? '#10b981' : '#ef4444'}`
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                        C2C/ngTMDD Compliance ({stateGuide.c2cCompliance.validationTool})
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                        {stateGuide.c2cCompliance.score}/100 - {stateGuide.c2cCompliance.grade}
                      </div>
                      <div style={{ fontSize: '14px' }}>
                        {stateGuide.c2cCompliance.message}
                      </div>
                    </div>
                  )}

                  {/* Category Scores */}
                  {stateGuide.categoryScores && (
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                        Category Breakdown
                      </h3>
                      {Object.entries(stateGuide.categoryScores).map(([key, category]) => (
                        <div key={key} style={{
                          marginBottom: '16px',
                          padding: '16px',
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '12px'
                          }}>
                            <div>
                              <div style={{ fontSize: '16px', fontWeight: '600' }}>
                                {category.name}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                {category.totalScore}/{category.maxScore} points ({category.percentage}%)
                              </div>
                            </div>
                            <div style={{
                              padding: '8px 16px',
                              borderRadius: '6px',
                              backgroundColor: getScoreColor(category.percentage),
                              color: 'white',
                              fontWeight: 'bold',
                              height: 'fit-content'
                            }}>
                              {category.percentage}%
                            </div>
                          </div>
                          {category.fields.map((field, idx) => (
                            <div key={idx} style={{
                              padding: '8px 0',
                              borderTop: idx > 0 ? '1px solid #f3f4f6' : 'none'
                            }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '14px',
                                marginBottom: '4px'
                              }}>
                                <span>
                                  {field.status === 'PASS' ? '✅' : '❌'} {field.field}
                                </span>
                                <span style={{ fontWeight: '600' }}>
                                  {field.currentPoints}/{field.maxPoints} pts
                                </span>
                              </div>
                              <div style={{
                                height: '6px',
                                backgroundColor: '#e5e7eb',
                                borderRadius: '3px',
                                overflow: 'hidden',
                                marginBottom: '4px'
                              }}>
                                <div style={{
                                  height: '100%',
                                  width: `${field.score}%`,
                                  backgroundColor: getScoreColor(field.score)
                                }} />
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                {field.impact}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Plan */}
                  {stateGuide.actionPlan && (
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                        Prioritized Action Plan
                      </h3>

                      {stateGuide.actionPlan.immediate && stateGuide.actionPlan.immediate.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            marginBottom: '8px',
                            color: '#ef4444'
                          }}>
                            ⚠️ IMMEDIATE ACTIONS ({stateGuide.actionPlan.immediate.length})
                          </div>
                          {stateGuide.actionPlan.immediate.map((action, idx) => (
                            <div key={idx} style={{
                              padding: '12px',
                              backgroundColor: '#fee2e2',
                              borderRadius: '6px',
                              marginBottom: '8px',
                              border: '1px solid #fecaca'
                            }}>
                              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                                {action.field}
                              </div>
                              <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                                Current: {action.currentScore}% • Gain {action.pointsGained} points
                              </div>
                              <div style={{ fontSize: '12px', color: '#991b1b' }}>
                                {action.impact}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {stateGuide.actionPlan.shortTerm && stateGuide.actionPlan.shortTerm.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            marginBottom: '8px',
                            color: '#f59e0b'
                          }}>
                            📅 SHORT-TERM IMPROVEMENTS ({stateGuide.actionPlan.shortTerm.length})
                          </div>
                          {stateGuide.actionPlan.shortTerm.map((action, idx) => (
                            <div key={idx} style={{
                              padding: '12px',
                              backgroundColor: '#fef3c7',
                              borderRadius: '6px',
                              marginBottom: '8px',
                              border: '1px solid #fde68a',
                              fontSize: '12px'
                            }}>
                              <strong>{action.field}</strong> • Current: {action.currentScore}% • Gain {action.pointsGained} points
                            </div>
                          ))}
                        </div>
                      )}

                      {stateGuide.actionPlan.longTerm && stateGuide.actionPlan.longTerm.length > 0 && (
                        <div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            marginBottom: '8px',
                            color: '#3b82f6'
                          }}>
                            🎯 LONG-TERM ENHANCEMENTS ({stateGuide.actionPlan.longTerm.length})
                          </div>
                          {stateGuide.actionPlan.longTerm.map((action, idx) => (
                            <div key={idx} style={{
                              padding: '12px',
                              backgroundColor: '#dbeafe',
                              borderRadius: '6px',
                              marginBottom: '8px',
                              border: '1px solid #bfdbfe',
                              fontSize: '12px'
                            }}>
                              <strong>{action.field}</strong> • Current: {action.currentScore}%
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Improvement Potential */}
                  {stateGuide.improvementPotential && stateGuide.improvementPotential.immediateActions > 0 && (
                    <div style={{
                      padding: '20px',
                      backgroundColor: '#ecfdf5',
                      borderRadius: '8px',
                      border: '1px solid #10b981'
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                        💡 Improvement Potential
                      </div>
                      <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                        {stateGuide.improvementPotential.message}
                      </div>
                      <div style={{ fontSize: '12px', color: '#065f46' }}>
                        Potential score increase: +{stateGuide.improvementPotential.potentialScoreIncrease} points → Grade {stateGuide.improvementPotential.newGradeIfFixed}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: '60px', textAlign: 'center', color: '#ef4444' }}>
                Failed to load state details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

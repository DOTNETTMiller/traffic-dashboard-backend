import { useState, useEffect } from 'react';

export default function DataQualityReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/analysis/normalization');
      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
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

  const getPriorityColor = (priority) => {
    const colors = {
      'High': '#ef4444',
      'Medium': '#f59e0b',
      'Low': '#3b82f6'
    };
    return colors[priority] || '#6b7280';
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div>Loading data quality report...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
        Failed to load report
      </div>
    );
  }

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
          Data Quality & Normalization Report
        </h1>
        <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
          Generated: {new Date(report.generatedAt).toLocaleString()}
        </p>
      </div>

      {/* Summary Cards */}
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
            Total States
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {report.summary.totalStates}
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
            {report.summary.totalEvents}
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>
            Good Data Quality
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>
            {report.summary.statesWithGoodData}
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>
            Needs Improvement
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>
            {report.summary.statesNeedingImprovement}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <button
            onClick={() => setActiveTab('summary')}
            style={{
              padding: '15px 30px',
              border: 'none',
              backgroundColor: activeTab === 'summary' ? '#3b82f6' : 'white',
              color: activeTab === 'summary' ? 'white' : '#6b7280',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              borderBottom: activeTab === 'summary' ? '2px solid #3b82f6' : 'none'
            }}
          >
            State Details
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            style={{
              padding: '15px 30px',
              border: 'none',
              backgroundColor: activeTab === 'recommendations' ? '#3b82f6' : 'white',
              color: activeTab === 'recommendations' ? 'white' : '#6b7280',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              borderBottom: activeTab === 'recommendations' ? '2px solid #3b82f6' : 'none'
            }}
          >
            Overall Recommendations
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'summary' && (
            <div>
              {Object.entries(report.states).map(([stateName, data]) => (
                <div
                  key={stateName}
                  style={{
                    marginBottom: '25px',
                    padding: '20px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}
                >
                  {/* State Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '15px'
                  }}>
                    <div>
                      <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold' }}>
                        {stateName}
                      </h3>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>
                        {data.eventCount} events • {data.apiType} • {data.sourceFormat.toUpperCase()}
                      </div>
                    </div>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      backgroundColor: getGradeColor(data.grade),
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      fontWeight: 'bold'
                    }}>
                      {data.grade}
                    </div>
                  </div>

                  {/* Completeness Score */}
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '14px',
                      marginBottom: '5px'
                    }}>
                      <span>Data Completeness</span>
                      <span style={{ fontWeight: 'bold' }}>
                        {data.dataCompleteness.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{
                      height: '8px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${data.dataCompleteness}%`,
                        backgroundColor: getGradeColor(data.grade),
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  {/* Strengths */}
                  {data.strengths.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        marginBottom: '8px',
                        color: '#10b981'
                      }}>
                        ✓ Strengths
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                        {data.strengths.map((strength, idx) => (
                          <li key={idx} style={{ marginBottom: '5px', color: '#059669' }}>
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Issues */}
                  {data.issues.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        marginBottom: '8px',
                        color: '#ef4444'
                      }}>
                        ⚠ Issues
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                        {data.issues.map((issue, idx) => (
                          <li key={idx} style={{ marginBottom: '5px', color: '#dc2626' }}>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {data.recommendations.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        marginBottom: '8px',
                        color: '#3b82f6'
                      }}>
                        💡 Recommendations
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                        {data.recommendations.map((rec, idx) => (
                          <li key={idx} style={{ marginBottom: '5px', color: '#2563eb' }}>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
                Enterprise-Wide Recommendations
              </h3>
              {report.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: '20px',
                    padding: '20px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '15px'
                  }}>
                    <div style={{
                      padding: '4px 12px',
                      borderRadius: '4px',
                      backgroundColor: getPriorityColor(rec.priority),
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}>
                      {rec.priority}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        marginBottom: '5px',
                        textTransform: 'uppercase',
                        fontWeight: '600'
                      }}>
                        {rec.category}
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        marginBottom: '10px'
                      }}>
                        {rec.recommendation}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        lineHeight: '1.5'
                      }}>
                        <strong>Benefit:</strong> {rec.benefit}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

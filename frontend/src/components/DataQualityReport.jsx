import { useState, useEffect } from 'react';
import { config } from '../config';

export default function DataQualityReport() {
  const [summary, setSummary] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [stateGuide, setStateGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [showC2CExplanation, setShowC2CExplanation] = useState(false);
  const [showEnhancedScores, setShowEnhancedScores] = useState(false);

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

  const fetchStateGuide = async (state) => {
    try {
      setLoadingGuide(true);
      // Use the complianceGuideUrl provided by the backend
      const url = `${config.apiUrl}${state.complianceGuideUrl}`;
      const response = await fetch(url);
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

  const severityLevels = [
    { key: 'critical', label: 'Critical', color: '#dc2626' },
    { key: 'high', label: 'High', color: '#f97316' },
    { key: 'medium', label: 'Medium', color: '#3b82f6' }
  ];

  const renderSeverityBreakdown = (breakdown) => {
    if (!breakdown) return null;

    return (
      <div style={{
        display: 'flex',
        gap: '10px',
        marginTop: '8px',
        marginBottom: '8px',
        flexWrap: 'wrap'
      }}>
        {severityLevels.map(({ key, label, color }) => {
          const ratio = typeof breakdown[key] === 'number' ? breakdown[key] : null;
          if (ratio === null) return null;
          const percent = Math.round(ratio * 100);
          return (
            <div
              key={key}
              style={{
                minWidth: '100px',
                padding: '8px 10px',
                borderRadius: '8px',
                backgroundColor: `${color}0F`,
                border: `1px solid ${color}33`,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color }}>
                {label} coverage
              </span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                {percent}%
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderOptionalRecommendations = (recommendations) => {
    if (!recommendations || recommendations.length === 0) return null;

    const topRecommendations = recommendations.slice(0, 3);

    return (
      <div style={{
        marginTop: '10px',
        padding: '10px 12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1f2937', marginBottom: '6px' }}>
          Recommended Enhancements
        </div>
        <ul style={{ margin: 0, paddingLeft: '18px', color: '#4b5563', fontSize: '12px' }}>
          {topRecommendations.map((rec, idx) => {
            const label = rec.field || rec.name || rec.description || 'Enhancement';
            const detail = rec.message || rec.benefit || rec.description || 'Add supplemental coverage';
            return (
              <li key={`${label}-${idx}`} style={{ marginBottom: '4px' }}>
                <strong>{label}:</strong> {detail}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const renderFieldCoverageTable = (coverage, title) => {
    if (!coverage || coverage.length === 0) return null;

    const severityBadgeColor = (severity) => {
      switch (severity) {
        case 'critical':
          return '#dc2626';
        case 'high':
          return '#f97316';
        case 'medium':
        default:
          return '#3b82f6';
      }
    };

    const formatSample = (value) => {
      if (value === null || value === undefined || value === '') return '—';
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (err) {
          return String(value);
        }
      }
      return String(value);
    };

    return (
      <div style={{
        marginTop: '16px',
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>
          {title} • Required Field Coverage
        </h4>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
          <strong>Raw:</strong> Fields that exist in your feed structure •
          <strong style={{ marginLeft: '8px' }}>Extracted:</strong> Values we parse from text •
          <strong style={{ marginLeft: '8px' }}>Normalized:</strong> Final values with fallbacks
        </p>
        <div style={{
          overflowX: 'auto'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '8px', minWidth: '160px' }}>Required Field</th>
                <th style={{ padding: '8px', minWidth: '180px' }}>Spec Field</th>
                <th style={{ padding: '8px', minWidth: '80px' }}>Severity</th>
                <th style={{ padding: '8px', minWidth: '70px', textAlign: 'center' }}>Raw %</th>
                <th style={{ padding: '8px', minWidth: '70px', textAlign: 'center' }}>Extract %</th>
                <th style={{ padding: '8px', minWidth: '70px', textAlign: 'center' }}>Norm %</th>
                <th style={{ padding: '8px', minWidth: '140px' }}>Raw Sample</th>
                <th style={{ padding: '8px', minWidth: '140px' }}>Extracted Sample</th>
                <th style={{ padding: '8px', minWidth: '140px' }}>Normalized Sample</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((row, idx) => (
                <tr key={row.field || idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? 'white' : '#f3f4f6' }}>
                  <td style={{ padding: '8px', fontWeight: 600 }}>{row.description || row.field}</td>
                  <td style={{ padding: '8px', color: '#4b5563' }}>{row.specField || '—'}</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: `${severityBadgeColor(row.severity)}20`,
                      color: severityBadgeColor(row.severity),
                      fontWeight: 600,
                      fontSize: '11px'
                    }}>
                      {row.severity || 'medium'}
                    </span>
                  </td>
                  <td style={{ padding: '8px', fontWeight: 600, textAlign: 'center', color: getScoreColor(row.rawCoveragePercentage || 0) }}>
                    {typeof row.rawCoveragePercentage === 'number' ? `${row.rawCoveragePercentage}%` : '—'}
                  </td>
                  <td style={{ padding: '8px', fontWeight: 600, textAlign: 'center', color: getScoreColor(row.extractedCoveragePercentage || 0) }}>
                    {typeof row.extractedCoveragePercentage === 'number' ? `${row.extractedCoveragePercentage}%` : '—'}
                  </td>
                  <td style={{ padding: '8px', fontWeight: 600, textAlign: 'center', color: getScoreColor(row.normalizedCoveragePercentage || 0) }}>
                    {typeof row.normalizedCoveragePercentage === 'number' ? `${row.normalizedCoveragePercentage}%` : '—'}
                  </td>
                  <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px', color: row.rawSampleValid ? '#065f46' : '#9ca3af' }}>
                    {formatSample(row.rawSampleValid || row.rawSampleInvalid)}
                  </td>
                  <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px', color: row.extractedSampleValid ? '#0369a1' : '#9ca3af' }}>
                    {formatSample(row.extractedSampleValid || row.extractedSampleInvalid)}
                  </td>
                  <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px', color: row.normalizedSampleValid ? '#065f46' : '#9ca3af' }}>
                    {formatSample(row.normalizedSampleValid || row.normalizedSampleInvalid)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const downloadComplianceReport = (format = 'csv') => {
    if (!stateGuide) return;

    const timestamp = new Date().toISOString().split('T')[0];
    const stateKey = stateGuide.state.replace(/\s+/g, '_').toLowerCase();

    if (format === 'csv') {
      // Create comprehensive CSV with field mappings
      const rows = [];

      // Header rows
      rows.push([`${stateGuide.state} - SAE J2735 & C2C Compliance Report`]);
      rows.push([`Generated: ${new Date(stateGuide.generatedAt).toLocaleString()}`]);
      rows.push([`Current Format: ${stateGuide.currentFormat?.apiType || 'Unknown'}`]);
      rows.push([`Overall Score: ${stateGuide.overallScore?.percentage}/100 (Grade ${stateGuide.overallScore?.grade})`]);
      rows.push([`C2C Compliance: ${stateGuide.c2cCompliance?.score}/100 - ${stateGuide.c2cCompliance?.grade}`]);
      rows.push([]);

      // Field-level mapping table
      rows.push(['FIELD-LEVEL COMPLIANCE ANALYSIS']);
      rows.push(['Field Name', 'Category', 'Status', 'Current Score', 'Max Points', 'Current Points', 'Impact/Issue', 'Recommendation']);

      // Add fields from category scores
      if (stateGuide.categoryScores) {
        Object.entries(stateGuide.categoryScores).forEach(([key, category]) => {
          category.fields.forEach(field => {
            rows.push([
              field.field,
              category.name,
              field.status,
              `${field.score}%`,
              field.maxPoints,
              field.currentPoints,
              field.impact,
              field.status === 'FAIL' ? `Required for ${category.name}` : 'Compliant'
            ]);
          });
        });
      }

      rows.push([]);
      rows.push(['C2C COMPLIANCE RECOMMENDATIONS']);
      rows.push(['Field', 'Importance', 'Current Issue', 'Solution']);

      if (stateGuide.c2cCompliance?.recommendations) {
        stateGuide.c2cCompliance.recommendations.forEach(rec => {
          rows.push([
            rec.field,
            rec.importance,
            rec.issue,
            rec.solution
          ]);
        });
      }

      rows.push([]);
      rows.push(['PRIORITIZED ACTION PLAN']);
      rows.push(['Priority', 'Field', 'Current Score', 'Points to Gain', 'Impact']);

      if (stateGuide.actionPlan?.immediate) {
        stateGuide.actionPlan.immediate.forEach(action => {
          rows.push(['IMMEDIATE', action.field, `${action.currentScore}%`, action.pointsGained, action.impact]);
        });
      }

      if (stateGuide.actionPlan?.shortTerm) {
        stateGuide.actionPlan.shortTerm.forEach(action => {
          rows.push(['SHORT-TERM', action.field, `${action.currentScore}%`, action.pointsGained, action.impact || 'Medium priority improvement']);
        });
      }

      if (stateGuide.actionPlan?.longTerm) {
        stateGuide.actionPlan.longTerm.forEach(action => {
          rows.push(['LONG-TERM', action.field, `${action.currentScore}%`, action.pointsGained || 'N/A', action.impact || 'Optional enhancement']);
        });
      }

      // Violations detail
      if (stateGuide.fieldLevelAnalysis?.violationCategories) {
        rows.push([]);
        rows.push(['DETAILED VIOLATIONS']);
        rows.push(['Category', 'Severity', 'Count', 'Spec Requirement', 'Impact', 'Recommendation']);

        stateGuide.fieldLevelAnalysis.violationCategories.forEach(violation => {
          rows.push([
            violation.category,
            violation.severity,
            violation.count,
            violation.specRequirement,
            violation.impact,
            violation.recommendation
          ]);
        });
      }

      // Convert to CSV
      const csvContent = rows.map(row =>
        row.map(cell => {
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return '"' + cellStr.replace(/"/g, '""') + '"';
          }
          return cellStr;
        }).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance_report_${stateKey}_${timestamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const renderStandardCard = (standard, title, subtitle, enhancedData) => {
    if (!standard) return null;

    // Default to RAW (what feed provides), optionally show ENHANCED (with normalization)
    const displayData = showEnhancedScores && enhancedData ? enhancedData : standard;
    const hasEnhancedData = enhancedData && enhancedData.percentage !== undefined;

    return (
      <div style={{
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: `2px solid ${getGradeColor(displayData.grade)}`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        position: 'relative'
      }}>
        {/* Data Source Badge */}
        {hasEnhancedData && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: showEnhancedScores ? '#dbeafe' : '#fef3c7',
            color: showEnhancedScores ? '#1e40af' : '#92400e',
            border: `1px solid ${showEnhancedScores ? '#93c5fd' : '#fcd34d'}`
          }}>
            {showEnhancedScores ? '✨ Enhanced Data' : '📊 Raw Feed Data'}
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '12px',
          marginTop: hasEnhancedData ? '20px' : '0'
        }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
              {title}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>
              {subtitle}
            </div>
          </div>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '8px',
            backgroundColor: getGradeColor(displayData.grade),
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 'bold'
          }}>
            {displayData.grade}
          </div>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: getGradeColor(displayData.grade) }}>
            {displayData.percentage}%
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            {displayData.status}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          height: '6px',
          backgroundColor: '#e5e7eb',
          borderRadius: '3px',
          overflow: 'hidden',
          marginBottom: '12px'
        }}>
          <div style={{
            height: '100%',
            width: `${displayData.percentage}%`,
            backgroundColor: getGradeColor(displayData.grade),
            transition: 'width 0.3s ease'
          }} />
        </div>

        {/* Raw vs Enhanced Comparison */}
        {hasEnhancedData && standard.percentage !== enhancedData.percentage && (
          <div style={{
            padding: '10px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            marginBottom: '12px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#1f2937', marginBottom: '6px' }}>
              📈 Score Comparison
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#92400e', fontWeight: 600 }}>Raw Feed</div>
                <div style={{ color: '#6b7280' }}>
                  {standard.percentage}% ({standard.grade})
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#1e40af', fontWeight: 600 }}>Enhanced</div>
                <div style={{ color: '#6b7280' }}>
                  {enhancedData.percentage}% ({enhancedData.grade})
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#10b981', fontWeight: 600 }}>Improvement</div>
                <div style={{ color: '#6b7280' }}>
                  +{enhancedData.percentage - standard.percentage}%
                </div>
              </div>
            </div>
          </div>
        )}

        {renderSeverityBreakdown(displayData.severityBreakdown)}
        {renderOptionalRecommendations(displayData.optionalRecommendations || standard.optionalRecommendations)}
      </div>
    );
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
      height: '100%',
      overflowY: 'auto'
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
            onClick={() => setSelectedState(state)}
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: selectedState?.name === state.name ? '2px solid #3b82f6' : '2px solid transparent'
            }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'}
          >
            {/* State Header */}
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold' }}>
                {state.name}
              </h3>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {state.eventCount} events • {state.currentFormat}
              </div>
              {state.tmddStandards && state.tmddStandards.version && (
                <div style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  marginTop: '4px'
                }}>
                  {state.tmddStandards.version}
                </div>
              )}
            </div>

            {/* Overall Composite Grade */}
            {state.overallScore && (
              <div style={{
                padding: '12px',
                background: `linear-gradient(135deg, ${getGradeColor(state.overallScore.grade)}15 0%, ${getGradeColor(state.overallScore.grade)}05 100%)`,
                borderRadius: '8px',
                border: `2px solid ${getGradeColor(state.overallScore.grade)}`,
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px', fontWeight: '600' }}>
                    COMPOSITE GRADE
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    {state.overallScore.rank}
                  </div>
                </div>
                <div style={{
                  width: '55px',
                  height: '55px',
                  borderRadius: '10px',
                  backgroundColor: getGradeColor(state.overallScore.grade),
                  color: 'white',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', lineHeight: 1 }}>
                    {state.overallScore.grade}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '600', marginTop: '2px' }}>
                    {state.overallScore.percentage}%
                  </div>
                </div>
              </div>
            )}

            {/* Individual Standard Grades - Always Show */}
            {state.overallScore?.breakdown ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                marginBottom: '12px'
              }}>
                <div style={{
                  padding: '12px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '2px solid #3b82f6',
                  textAlign: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>WZDx</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6', lineHeight: 1 }}>
                    {state.overallScore.breakdown.wzdx.grade}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontWeight: '600' }}>
                    {state.overallScore.breakdown.wzdx.percentage}%
                  </div>
                  {state.overallScore.breakdown.wzdx.severityBreakdown && (
                    <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '4px' }}>
                      Critical cover: {Math.round((state.overallScore.breakdown.wzdx.severityBreakdown.critical || 0) * 100)}%
                    </div>
                  )}
                </div>
                <div style={{
                  padding: '12px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '2px solid #10b981',
                  textAlign: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>SAE J2735</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', lineHeight: 1 }}>
                    {state.overallScore.breakdown.sae.grade}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontWeight: '600' }}>
                    {state.overallScore.breakdown.sae.percentage}%
                  </div>
                  {state.overallScore.breakdown.sae.severityBreakdown && (
                    <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '4px' }}>
                      Critical cover: {Math.round((state.overallScore.breakdown.sae.severityBreakdown.critical || 0) * 100)}%
                    </div>
                  )}
                </div>
                <div style={{
                  padding: '12px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '2px solid #f59e0b',
                  textAlign: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>TMDD</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b', lineHeight: 1 }}>
                    {state.overallScore.breakdown.tmdd.grade}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontWeight: '600' }}>
                    {state.overallScore.breakdown.tmdd.percentage}%
                  </div>
                  {state.overallScore.breakdown.tmdd.severityBreakdown && (
                    <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '4px' }}>
                      Critical cover: {Math.round((state.overallScore.breakdown.tmdd.severityBreakdown.critical || 0) * 100)}%
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Fallback for states without breakdown - show data quality */
              <div style={{
                padding: '16px',
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                marginBottom: '12px',
                textAlign: 'center',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: getScoreColor(state.dataCompletenessScore),
                  marginBottom: '4px',
                  lineHeight: 1
                }}>
                  {state.dataCompletenessScore}%
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600' }}>
                  Data Quality
                </div>
              </div>
            )}

            {/* Click to view details */}
            <div style={{
              marginTop: '12px',
              fontSize: '12px',
              color: '#3b82f6',
              fontWeight: '600',
              textAlign: 'center'
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
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '40px 20px',
          overflowY: 'auto'
        }}
        onClick={() => setSelectedState(null)}
        >
          <div
            style={{
              maxWidth: '900px',
              width: '100%',
              maxHeight: 'none',
              overflow: 'visible',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              marginBottom: '40px'
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
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => downloadComplianceReport('csv')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid #10b981',
                        backgroundColor: '#10b981',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                    >
                      📊 Download Spreadsheet (CSV/Excel)
                    </button>
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
                </div>

                {/* Modal Content */}
                <div style={{ padding: '24px' }}>
                  {/* Overall Composite Score */}
                  {stateGuide.overallScore && (
                    <div style={{
                      marginBottom: '24px',
                      padding: '24px',
                      background: `linear-gradient(135deg, ${getGradeColor(stateGuide.overallScore.grade)}15 0%, ${getGradeColor(stateGuide.overallScore.grade)}05 100%)`,
                      borderRadius: '12px',
                      border: `2px solid ${getGradeColor(stateGuide.overallScore.grade)}`
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>
                            COMPOSITE OVERALL GRADE
                          </div>
                          <div style={{ fontSize: '48px', fontWeight: 'bold', color: getGradeColor(stateGuide.overallScore.grade), lineHeight: 1, marginBottom: '8px' }}>
                            {stateGuide.overallScore.grade}
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                            {stateGuide.overallScore.rank}
                          </div>
                          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                            {stateGuide.overallScore.message}
                          </div>
                        </div>
                        <div style={{
                          width: '120px',
                          height: '120px',
                          borderRadius: '16px',
                          backgroundColor: getGradeColor(stateGuide.overallScore.grade),
                          color: 'white',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}>
                          <div style={{ fontSize: '56px', fontWeight: 'bold', lineHeight: 1 }}>
                            {stateGuide.overallScore.grade}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: '600', marginTop: '4px' }}>
                            {stateGuide.overallScore.percentage}%
                          </div>
                        </div>
                      </div>

                      {/* Breakdown of individual standard grades */}
                      {stateGuide.overallScore.breakdown && (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '12px',
                          marginTop: '16px',
                          paddingTop: '16px',
                          borderTop: '1px solid rgba(0,0,0,0.1)'
                        }}>
                          <div style={{
                            padding: '12px',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            border: '2px solid #3b82f6',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>WZDx</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                              {stateGuide.overallScore.breakdown.wzdx.grade}
                            </div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                            {stateGuide.overallScore.breakdown.wzdx.percentage}%
                          </div>
                          {renderSeverityBreakdown(stateGuide.overallScore.breakdown.wzdx.severityBreakdown)}
                        </div>
                        <div style={{
                          padding: '12px',
                          backgroundColor: 'white',
                          borderRadius: '8px',
                            border: '2px solid #10b981',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>SAE J2735</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                              {stateGuide.overallScore.breakdown.sae.grade}
                            </div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                            {stateGuide.overallScore.breakdown.sae.percentage}%
                          </div>
                          {renderSeverityBreakdown(stateGuide.overallScore.breakdown.sae.severityBreakdown)}
                        </div>
                        <div style={{
                          padding: '12px',
                          backgroundColor: 'white',
                          borderRadius: '8px',
                            border: '2px solid #f59e0b',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>TMDD</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                              {stateGuide.overallScore.breakdown.tmdd.grade}
                            </div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                            {stateGuide.overallScore.breakdown.tmdd.percentage}%
                          </div>
                          {renderSeverityBreakdown(stateGuide.overallScore.breakdown.tmdd.severityBreakdown)}
                        </div>
                      </div>
                      )}
                    </div>
                  )}

                  {/* Multi-Standard Compliance Scorecard */}
                  {stateGuide.multiStandardCompliance && (
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>
                        📊 Multi-Standard Compliance Scorecard
                      </h3>
                      <div style={{
                        padding: '16px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        marginBottom: '16px',
                        fontSize: '14px',
                        color: '#6b7280'
                      }}>
                        {stateGuide.multiStandardCompliance.summary.message}
                        <div style={{ marginTop: '8px', fontSize: '12px' }}>
                          Evaluated {stateGuide.multiStandardCompliance.summary.eventsAnalyzed} events on {new Date(stateGuide.multiStandardCompliance.summary.evaluationDate).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Raw vs Enhanced Toggle */}
                      {(stateGuide.multiStandardCompliance.wzdx?.enhanced || stateGuide.multiStandardCompliance.sae?.enhanced || stateGuide.multiStandardCompliance.tmdd?.enhanced) && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '16px',
                          padding: '12px',
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
                            View Mode:
                          </div>
                          <button
                            onClick={() => setShowEnhancedScores(false)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: showEnhancedScores ? '1px solid #e5e7eb' : '2px solid #f59e0b',
                              backgroundColor: showEnhancedScores ? 'white' : '#fef3c7',
                              color: showEnhancedScores ? '#6b7280' : '#92400e',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            📊 Raw Feed Data (Actual)
                          </button>
                          <button
                            onClick={() => setShowEnhancedScores(true)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: showEnhancedScores ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                              backgroundColor: showEnhancedScores ? '#eff6ff' : 'white',
                              color: showEnhancedScores ? '#1e40af' : '#6b7280',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            ✨ Enhanced (With Inference)
                          </button>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto', maxWidth: '300px' }}>
                            Default shows actual feed data. Toggle to see enhanced scores.
                          </div>
                        </div>
                      )}

                      {/* Three Standards Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '16px',
                        marginBottom: '24px'
                      }}>
                        {renderStandardCard(
                          stateGuide.multiStandardCompliance.wzdx,
                          'WZDx v4.x',
                          'Open Data Standard',
                          stateGuide.multiStandardCompliance.wzdx?.enhanced
                        )}

                        {renderStandardCard(
                          stateGuide.multiStandardCompliance.sae,
                          'SAE J2735',
                          'V2X Communication',
                          stateGuide.multiStandardCompliance.sae?.enhanced
                        )}

                        {renderStandardCard(
                          stateGuide.multiStandardCompliance.tmdd,
                          'TMDD v3.1',
                          'Center-to-Center',
                          stateGuide.multiStandardCompliance.tmdd?.enhanced
                        )}
                      </div>

                      {renderFieldCoverageTable(stateGuide.multiStandardCompliance.wzdx?.fieldCoverage, 'WZDx v4.x')}
                      {renderFieldCoverageTable(stateGuide.multiStandardCompliance.sae?.fieldCoverage, 'SAE J2735')}
                      {renderFieldCoverageTable(stateGuide.multiStandardCompliance.tmdd?.fieldCoverage, 'TMDD v3.1 / ngTMDD')}

                      {/* Cross-Standard Recommendations */}
                      {stateGuide.multiStandardCompliance.crossStandardRecommendations && stateGuide.multiStandardCompliance.crossStandardRecommendations.length > 0 && (
                        <div style={{
                          padding: '20px',
                          backgroundColor: '#ecfdf5',
                          borderRadius: '8px',
                          border: '1px solid #10b981'
                        }}>
                          <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold' }}>
                            🎯 Cross-Standard Priority Recommendations
                          </h4>
                          <div style={{ fontSize: '13px', color: '#065f46', marginBottom: '16px' }}>
                            These improvements will benefit multiple standards simultaneously:
                          </div>
                          {stateGuide.multiStandardCompliance.crossStandardRecommendations.map((rec, idx) => (
                            <div key={idx} style={{
                              padding: '12px',
                              backgroundColor: 'white',
                              borderRadius: '6px',
                              marginBottom: idx < stateGuide.multiStandardCompliance.crossStandardRecommendations.length - 1 ? '12px' : '0',
                              border: '1px solid #d1fae5'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#065f46', marginBottom: '4px' }}>
                                    {rec.issue} ({rec.currentCoverage} coverage)
                                  </div>
                                  <div style={{ fontSize: '13px', color: '#374151' }}>
                                    {rec.recommendation}
                                  </div>
                                </div>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: rec.priority === 'CRITICAL' ? '#fee2e2' : '#fef3c7',
                                  color: rec.priority === 'CRITICAL' ? '#991b1b' : '#92400e',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {rec.priority}
                                </span>
                              </div>
                              <div style={{
                                display: 'flex',
                                gap: '12px',
                                fontSize: '11px',
                                color: '#6b7280',
                                marginTop: '8px',
                                paddingTop: '8px',
                                borderTop: '1px solid #e5e7eb'
                              }}>
                                <div>
                                  <strong>Standards:</strong> {rec.benefitsStandards.join(', ')}
                                </div>
                                <div style={{ marginLeft: 'auto' }}>
                                  <strong>Gain:</strong> WZDx +{rec.pointsGained.wzdx}, SAE +{rec.pointsGained.sae}, TMDD +{rec.pointsGained.tmdd} points
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TMDD Standards Information */}
                  {selectedState.tmddStandards && (
                    <div style={{
                      marginBottom: '24px',
                      padding: '20px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
                        TMDD Standards Compliance
                      </h3>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px',
                        marginBottom: '16px'
                      }}>
                        {/* Version */}
                        <div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                            TMDD Version
                          </div>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#111827'
                          }}>
                            {selectedState.tmddStandards.version || 'Unknown'}
                          </div>
                        </div>

                        {/* Compliance Type */}
                        <div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                            Compliance Type
                          </div>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: selectedState.tmddStandards.compliance === 'Direct TMDD' ? '#10b981' :
                                   selectedState.tmddStandards.compliance === 'WZDx (TMDD-adjacent)' ? '#3b82f6' : '#6b7280'
                          }}>
                            {selectedState.tmddStandards.compliance || 'Not TMDD'}
                          </div>
                        </div>
                      </div>

                      {/* Custom Handler Badge */}
                      {selectedState.tmddStandards.hasCustomHandler && (
                        <div style={{
                          padding: '12px',
                          backgroundColor: '#fffbeb',
                          borderRadius: '6px',
                          border: '1px solid #fde68a',
                          marginBottom: '16px'
                        }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
                            ⚙️ Custom Data Handler Active
                          </div>
                          <div style={{ fontSize: '12px', color: '#78350f' }}>
                            This state uses a specialized parser to handle format-specific deviations from standard TMDD structure.
                          </div>
                        </div>
                      )}

                      {/* Format Deviations */}
                      {selectedState.tmddStandards.deviations && selectedState.tmddStandards.deviations.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                            Format Deviations from Standard
                          </div>
                          <ul style={{
                            margin: '0',
                            padding: '0 0 0 20px',
                            fontSize: '13px',
                            color: '#6b7280',
                            lineHeight: '1.6'
                          }}>
                            {selectedState.tmddStandards.deviations.map((deviation, idx) => (
                              <li key={idx} style={{ marginBottom: '4px' }}>
                                {deviation}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Documentation Link */}
                      {selectedState.tmddStandards.documentationUrl && (
                        <div style={{
                          padding: '12px',
                          backgroundColor: '#dbeafe',
                          borderRadius: '6px',
                          border: '1px solid #3b82f6'
                        }}>
                          <a
                            href={selectedState.tmddStandards.documentationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#1e40af',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <span>📚</span>
                            <span>View {selectedState.tmddStandards.compliance === 'Direct TMDD' ? 'TMDD' : 'WZDx'} Standard Documentation</span>
                            <span style={{ fontSize: '12px' }}>↗</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* C2C Compliance */}
                  {stateGuide.c2cCompliance && (
                    <>
                      <div style={{
                        marginBottom: '12px',
                        padding: '20px',
                        backgroundColor: stateGuide.c2cCompliance.grade === 'PASS' ? '#d1fae5' : '#fee2e2',
                        borderRadius: '8px',
                        border: `1px solid ${stateGuide.c2cCompliance.grade === 'PASS' ? '#10b981' : '#ef4444'}`
                      }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>C2C/ngTMDD Compliance ({stateGuide.c2cCompliance.validationTool})</span>
                          <button
                            onClick={() => setShowC2CExplanation(!showC2CExplanation)}
                            style={{
                              padding: '4px 12px',
                              borderRadius: '4px',
                              border: '1px solid #6b7280',
                              backgroundColor: 'white',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            {showC2CExplanation ? '▲ Hide' : '▼ What is C2C?'}
                          </button>
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                          {stateGuide.c2cCompliance.score}/100 - {stateGuide.c2cCompliance.grade}
                        </div>
                        <div style={{ fontSize: '14px' }}>
                          {stateGuide.c2cCompliance.message}
                        </div>
                      </div>

                      {/* C2C Explanation (Expandable) */}
                      {showC2CExplanation && (
                        <div style={{
                          marginBottom: '24px',
                          padding: '20px',
                          backgroundColor: '#f9fafb',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>
                            Understanding C2C Compliance
                          </h4>

                          <div style={{ fontSize: '14px', marginBottom: '16px', lineHeight: '1.6' }}>
                            <strong>What is C2C?</strong>
                            <p style={{ margin: '8px 0 0 0', color: '#374151' }}>
                              C2C (Center-to-Center) refers to data exchange between Traffic Management Centers (TMCs) operated by different DOT agencies.
                              This allows states to share real-time traffic and incident information across jurisdictions, especially important for events
                              near state borders.
                            </p>
                          </div>

                          <div style={{ fontSize: '14px', marginBottom: '16px', lineHeight: '1.6' }}>
                            <strong>What is TMDD/ngTMDD?</strong>
                            <p style={{ margin: '8px 0 0 0', color: '#374151' }}>
                              TMDD (Traffic Management Data Dictionary) and ngTMDD (Next Generation TMDD) are standardized data dictionaries that define how traffic
                              management data should be structured for C2C communication. These standards ensure TMCs from different states speak the same "language"
                              when exchanging data. WZDx feeds follow their own specification, while traditional event feeds should follow TMDD/ngTMDD standards.
                            </p>
                          </div>

                          <div style={{ fontSize: '14px', marginBottom: '16px', lineHeight: '1.6' }}>
                            <strong>What is C2C-MVT?</strong>
                            <p style={{ margin: '8px 0 0 0', color: '#374151' }}>
                              C2C-MVT (Center-to-Center Message Validation Tool) is a validation tool that checks if your data meets ngTMDD requirements.
                              This compliance score indicates how well your data would work in a C2C data sharing environment.
                            </p>
                          </div>

                          <div style={{ fontSize: '14px', marginBottom: '0', lineHeight: '1.6' }}>
                            <strong>How is the score calculated?</strong>
                            <p style={{ margin: '8px 0 0 0', color: '#374151' }}>
                              The C2C compliance score evaluates whether your data includes critical fields for C2C communication:
                            </p>
                            <ul style={{ margin: '8px 0 0 20px', color: '#374151' }}>
                              <li><strong>Unique Event ID:</strong> Allows events to be tracked across TMCs</li>
                              <li><strong>Organization ID:</strong> Identifies which DOT owns the event</li>
                              <li><strong>Linear Reference:</strong> Route + milepost for precise location (e.g., "I-80 MM 123")</li>
                              <li><strong>Geographic Coordinates:</strong> Latitude/longitude for mapping</li>
                              <li><strong>Update Timestamp:</strong> When the event was last updated</li>
                              <li><strong>Event Status/Severity:</strong> Impact level for prioritization</li>
                              <li><strong>Directional Impact:</strong> Which direction of travel is affected</li>
                              <li><strong>Lane Impact:</strong> Which lanes are closed or restricted</li>
                            </ul>
                            <p style={{ margin: '12px 0 0 0', color: '#374151' }}>
                              A score of 80% or higher means your data is ready for reliable C2C communication with other state TMCs.
                            </p>
                          </div>

                          {stateGuide.c2cCompliance.recommendations && stateGuide.c2cCompliance.recommendations.length > 0 && (
                            <div style={{
                              marginTop: '16px',
                              padding: '12px',
                              backgroundColor: '#fef3c7',
                              borderRadius: '6px',
                              border: '1px solid #f59e0b'
                            }}>
                              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                                📋 Recommendations to Improve C2C Compliance:
                              </div>
                              {stateGuide.c2cCompliance.recommendations.map((rec, idx) => (
                                <div key={idx} style={{
                                  fontSize: '13px',
                                  padding: '8px',
                                  marginBottom: idx < stateGuide.c2cCompliance.recommendations.length - 1 ? '8px' : '0',
                                  backgroundColor: 'white',
                                  borderRadius: '4px'
                                }}>
                                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                    {rec.field} ({rec.importance})
                                  </div>
                                  <div style={{ color: '#6b7280', marginBottom: '4px' }}>
                                    Issue: {rec.issue}
                                  </div>
                                  <div style={{ color: '#065f46' }}>
                                    ✓ Solution: {rec.solution}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Field-Level Violations Analysis */}
                  {stateGuide.fieldLevelAnalysis && stateGuide.fieldLevelAnalysis.violationCategories && stateGuide.fieldLevelAnalysis.violationCategories.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                          Detailed Violation Analysis
                        </h3>
                        <div style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          backgroundColor: stateGuide.fieldLevelAnalysis.feedType === 'WZDx' ? '#dbeafe' : '#fef3c7',
                          border: `1px solid ${stateGuide.fieldLevelAnalysis.feedType === 'WZDx' ? '#3b82f6' : '#f59e0b'}`,
                          fontSize: '12px',
                          fontWeight: '600',
                          color: stateGuide.fieldLevelAnalysis.feedType === 'WZDx' ? '#1e40af' : '#92400e'
                        }}>
                          {stateGuide.fieldLevelAnalysis.feedType === 'WZDx' ? '📋 WZDx v4.x Spec' : `📡 TMDD/ngTMDD via C2C-MVT`}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        marginBottom: '16px',
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <strong>Evaluation Standard:</strong> {stateGuide.fieldLevelAnalysis.evaluationStandard}
                        <br />
                        {stateGuide.fieldLevelAnalysis.summary}
                        {stateGuide.fieldLevelAnalysis.note && (
                          <>
                            <br />
                            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fffbeb', borderRadius: '4px', border: '1px solid #fde68a' }}>
                              ℹ️ {stateGuide.fieldLevelAnalysis.note}
                            </div>
                          </>
                        )}
                      </div>

                      {stateGuide.fieldLevelAnalysis.violationCategories.map((violation, idx) => {
                        const severityColor =
                          violation.severity === 'CRITICAL' ? '#991b1b' :
                          violation.severity === 'HIGH' ? '#ef4444' :
                          violation.severity === 'MEDIUM' ? '#f59e0b' : '#6b7280';
                        const bgColor =
                          violation.severity === 'CRITICAL' ? '#fee2e2' :
                          violation.severity === 'HIGH' ? '#fef2f2' :
                          violation.severity === 'MEDIUM' ? '#fef3c7' : '#f3f4f6';

                        return (
                          <div key={idx} style={{
                            marginBottom: '16px',
                            padding: '16px',
                            backgroundColor: bgColor,
                            borderRadius: '8px',
                            border: `2px solid ${severityColor}`
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'start',
                              marginBottom: '12px'
                            }}>
                              <div>
                                <div style={{
                                  fontSize: '16px',
                                  fontWeight: '600',
                                  color: severityColor,
                                  marginBottom: '4px'
                                }}>
                                  {violation.category}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                  {violation.count} violation{violation.count > 1 ? 's' : ''} found • {violation.severity} priority
                                </div>
                              </div>
                              <div style={{
                                padding: '4px 12px',
                                borderRadius: '6px',
                                backgroundColor: severityColor,
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}>
                                {violation.severity}
                              </div>
                            </div>

                            <div style={{
                              fontSize: '14px',
                              marginBottom: '8px',
                              padding: '8px',
                              backgroundColor: 'white',
                              borderRadius: '4px'
                            }}>
                              <strong>Impact:</strong> {violation.impact}
                            </div>

                            <div style={{
                              fontSize: '13px',
                              marginBottom: '12px',
                              padding: '8px',
                              backgroundColor: 'white',
                              borderRadius: '4px'
                            }}>
                              <strong>Spec Requirement:</strong> {violation.specRequirement}
                            </div>

                            <div style={{
                              fontSize: '13px',
                              marginBottom: '8px',
                              fontWeight: '600'
                            }}>
                              Examples (showing {Math.min(violation.examples.length, 5)}):
                            </div>

                            {violation.examples.slice(0, 5).map((example, exIdx) => (
                              <div key={exIdx} style={{
                                fontSize: '12px',
                                padding: '10px',
                                marginBottom: '8px',
                                backgroundColor: 'white',
                                borderRadius: '4px',
                                border: '1px solid #e5e7eb',
                                fontFamily: 'monospace'
                              }}>
                                <div style={{ marginBottom: '4px' }}>
                                  <strong>Event ID:</strong> {example.eventId}
                                </div>
                                {example.location && (
                                  <div style={{ marginBottom: '4px', color: '#6b7280' }}>
                                    <strong>Location:</strong> {example.location}
                                  </div>
                                )}
                                {example.actual !== undefined && (
                                  <div style={{ marginBottom: '4px', color: '#ef4444' }}>
                                    <strong>Actual Value:</strong> {typeof example.actual === 'object' ? JSON.stringify(example.actual) : example.actual}
                                  </div>
                                )}
                                {example.expected && (
                                  <div style={{ color: '#10b981' }}>
                                    <strong>Expected:</strong> {example.expected}
                                  </div>
                                )}
                                {example.missingFields && (
                                  <div style={{ color: '#ef4444' }}>
                                    <strong>Missing Fields:</strong> {example.missingFields.join(', ')}
                                  </div>
                                )}
                              </div>
                            ))}

                            <div style={{
                              fontSize: '13px',
                              marginTop: '12px',
                              padding: '10px',
                              backgroundColor: 'white',
                              borderRadius: '4px',
                              border: '1px solid ' + severityColor
                            }}>
                              <strong>✅ Recommendation:</strong> {violation.recommendation}
                            </div>
                          </div>
                        );
                      })}
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

import React, { useState } from 'react';

const FeedScoringModal = ({ feed, onClose, onSubmit, currentUser }) => {
  const [scores, setScores] = useState({
    metadata_score: feed.metadata_score || '',
    data_quality_score: feed.data_quality_score || '',
    operational_score: feed.operational_score || '',
    documentation_score: feed.documentation_score || '',
    extensibility_score: feed.extensibility_score || '',
    evaluator_notes: feed.evaluator_notes || '',
    metadata_notes: feed.metadata_notes || '',
    data_quality_notes: feed.data_quality_notes || '',
    operational_notes: feed.operational_notes || '',
    documentation_notes: feed.documentation_notes || '',
    extensibility_notes: feed.extensibility_notes || ''
  });

  const handleScoreChange = (category, value) => {
    const numValue = value === '' ? '' : Math.min(100, Math.max(0, parseInt(value) || 0));
    setScores(prev => ({ ...prev, [category]: numValue }));
  };

  const handleNotesChange = (category, value) => {
    setScores(prev => ({ ...prev, [category]: value }));
  };

  const calculateDQI = () => {
    const scoreValues = [
      scores.metadata_score,
      scores.data_quality_score,
      scores.operational_score,
      scores.documentation_score,
      scores.extensibility_score
    ].filter(s => s !== '').map(Number);

    if (scoreValues.length === 5) {
      return (scoreValues.reduce((a, b) => a + b, 0) / 5).toFixed(1);
    }
    return null;
  };

  const getLetterGrade = (dqi) => {
    if (!dqi) return 'INCOMPLETE';
    if (dqi >= 90) return 'A';
    if (dqi >= 80) return 'B';
    if (dqi >= 70) return 'C';
    if (dqi >= 60) return 'D';
    return 'F';
  };

  const handleSubmit = () => {
    const dqi = calculateDQI();
    const letter_grade = getLetterGrade(dqi);

    onSubmit({
      ...scores,
      dqi: dqi ? parseFloat(dqi) : null,
      letter_grade,
      feed_name: feed.feed_name,
      provider: feed.provider,
      service_type: feed.service_type
    });
  };

  const dqi = calculateDQI();
  const isComplete = scores.metadata_score !== '' &&
                     scores.data_quality_score !== '' &&
                     scores.operational_score !== '' &&
                     scores.documentation_score !== '' &&
                     scores.extensibility_score !== '';

  const categories = [
    {
      key: 'metadata',
      name: 'Metadata (M)',
      description: 'API documentation, field descriptions, update frequency, contact info',
      subcategories: [
        'API documentation completeness (0-25)',
        'Field descriptions and data dictionary (0-25)',
        'Update frequency documentation (0-25)',
        'Contact information and support (0-25)'
      ]
    },
    {
      key: 'data_quality',
      name: 'Data Quality (D)',
      description: 'Accuracy, completeness, consistency, timeliness',
      subcategories: [
        'Accuracy: Data matches ground truth (0-25)',
        'Completeness: All expected fields populated (0-25)',
        'Consistency: Data format is uniform (0-25)',
        'Timeliness: Updates meet stated frequency (0-25)'
      ]
    },
    {
      key: 'operational',
      name: 'Operational (O)',
      description: 'Uptime, response time, error handling, monitoring',
      subcategories: [
        'Uptime/Reliability: Service availability (0-25)',
        'Response time: API performance (0-25)',
        'Error handling: Graceful degradation (0-25)',
        'Monitoring: Health check endpoints (0-25)'
      ]
    },
    {
      key: 'documentation',
      name: 'Documentation (D)',
      description: 'User guides, API examples, change logs, troubleshooting',
      subcategories: [
        'User guide quality (0-25)',
        'API examples and sample code (0-25)',
        'Change log maintenance (0-25)',
        'Troubleshooting guides (0-25)'
      ]
    },
    {
      key: 'extensibility',
      name: 'Extensibility (E)',
      description: 'Standard formats, output options, filtering, integration ease',
      subcategories: [
        'Standard data formats (GeoJSON, JSON, XML) (0-25)',
        'Multiple output formats available (0-25)',
        'Filtering and query capabilities (0-25)',
        'Integration ease (webhooks, callbacks) (0-25)'
      ]
    }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
                Score Data Feed
              </h2>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                {feed.feed_name} ({feed.provider})
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#6b7280'
              }}
            >
              ×
            </button>
          </div>

          {/* DQI Preview */}
          {isComplete && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              backgroundcolor: '#6b7280',
              borderRadius: '8px',
              border: '1px solid #0ea5e9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', color: '#0369a1', fontWeight: '600' }}>
                    Data Quality Index (DQI)
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#0284c7' }}>
                    {dqi}
                  </div>
                </div>
                <div style={{
                  padding: '12px 24px',
                  backgroundColor: getLetterGrade(dqi) === 'A' ? '#10b981' :
                                   getLetterGrade(dqi) === 'B' ? '#3b82f6' :
                                   getLetterGrade(dqi) === 'C' ? '#f59e0b' :
                                   getLetterGrade(dqi) === 'D' ? '#f97316' : '#ef4444',
                  color: '#111827',
                  fontSize: '36px',
                  fontWeight: '700',
                  borderRadius: '8px'
                }}>
                  {getLetterGrade(dqi)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scoring Form */}
        <div style={{ padding: '24px' }}>
          {categories.map((category, idx) => (
            <div key={category.key} style={{
              marginBottom: '32px',
              padding: '20px',
              backgroundcolor: '#6b7280',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                  {category.name}
                </h3>
                <p style={{ margin: '4px 0 12px 0', fontSize: '14px', color: '#6b7280' }}>
                  {category.description}
                </p>
                <div style={{ fontSize: '12px', color: '#6b7280', marginLeft: '16px' }}>
                  {category.subcategories.map((sub, i) => (
                    <div key={i} style={{ marginBottom: '2px' }}>• {sub}</div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Score (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scores[`${category.key}_score`]}
                  onChange={(e) => handleScoreChange(`${category.key}_score`, e.target.value)}
                  placeholder="Enter score 0-100"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Evaluation Notes (2-3 sentences)
                </label>
                <textarea
                  value={scores[`${category.key}_notes`]}
                  onChange={(e) => handleNotesChange(`${category.key}_notes`, e.target.value)}
                  placeholder={`Provide specific feedback on ${category.name.toLowerCase()}...`}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '14px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
            </div>
          ))}

          {/* Overall Notes */}
          <div style={{
            padding: '20px',
            backgroundcolor: '#6b7280',
            borderRadius: '8px',
            border: '1px solid #fbbf24',
            marginBottom: '24px'
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#92400e',
              marginBottom: '8px'
            }}>
              Overall Evaluation Summary
            </label>
            <textarea
              value={scores.evaluator_notes}
              onChange={(e) => handleNotesChange('evaluator_notes', e.target.value)}
              placeholder="Brief summary of key strengths and weaknesses..."
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: '2px solid #fbbf24',
                borderRadius: '6px',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical',
                backgroundColor: 'white'
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          bottom: 0,
          backgroundColor: 'white'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            {isComplete ? (
              <span style={{ color: '#10b981', fontWeight: '600' }}>✓ All scores entered</span>
            ) : (
              <span>Please enter all 5 category scores</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '12px 24px',
                backgroundColor: 'white',
                border: '2px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                color: '#374151'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isComplete}
              style={{
                padding: '12px 24px',
                backgroundColor: isComplete ? '#3b82f6' : '#d1d5db',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isComplete ? 'pointer' : 'not-allowed',
                color: '#111827'
              }}
            >
              Submit Score
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedScoringModal;

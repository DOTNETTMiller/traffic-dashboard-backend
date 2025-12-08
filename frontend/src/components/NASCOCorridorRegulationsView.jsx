import { useState, useEffect } from 'react';
import api from '../services/api';
import { theme } from '../styles/theme';

export default function NASCOCorridorRegulationsView({ darkMode = false }) {
  const [regulations, setRegulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNascoOnly, setShowNascoOnly] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [selectedState, setSelectedState] = useState(null);
  const [editingState, setEditingState] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'analysis'

  const colors = {
    bg: darkMode ? '#0f172a' : '#ffffff',
    bgSecondary: darkMode ? '#1e293b' : '#f8fafc',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    accent: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
  };

  useEffect(() => {
    fetchRegulations();
  }, [showNascoOnly]);

  const fetchRegulations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/state-osow-regulations', {
        params: showNascoOnly ? { nascoOnly: 'true' } : {}
      });

      if (response.data.success) {
        setRegulations(response.data.regulations);
      }
    } catch (error) {
      console.error('Error fetching regulations:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAIAnalysis = async () => {
    try {
      setLoadingAnalysis(true);
      const response = await api.post('/api/nasco-corridor-ai-analysis');

      if (response.data.success) {
        setAiAnalysis(response.data);
        setViewMode('analysis');
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      alert('Failed to generate AI analysis: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleEdit = (regulation) => {
    setEditingState(regulation.state_key);
    setEditFormData({
      max_length_ft: regulation.max_length_ft || '',
      max_width_ft: regulation.max_width_ft || '',
      max_height_ft: regulation.max_height_ft || '',
      legal_gvw: regulation.legal_gvw || '',
      permitted_single_axle: regulation.permitted_single_axle || '',
      permitted_tandem_axle: regulation.permitted_tandem_axle || '',
      permitted_max_gvw: regulation.permitted_max_gvw || '',
      permit_office_phone: regulation.permit_office_phone || '',
      permit_office_email: regulation.permit_office_email || '',
      permit_portal_url: regulation.permit_portal_url || '',
      regulation_url: regulation.regulation_url || '',
      notes: regulation.notes || '',
      is_nasco_state: regulation.is_nasco_state || 0
    });
  };

  const handleSave = async (stateKey) => {
    try {
      const response = await api.put(`/api/state-osow-regulations/${stateKey}`, editFormData);

      if (response.data.success) {
        await fetchRegulations();
        setEditingState(null);
        alert(`Successfully updated ${stateKey.toUpperCase()} regulations`);
      }
    } catch (error) {
      console.error('Error updating regulation:', error);
      alert('Failed to update regulation');
    }
  };

  const renderMarkdown = (text) => {
    if (!text) return null;

    return text.split('\n').map((line, i) => {
      // Headers
      if (line.startsWith('###')) {
        return (
          <h4 key={i} style={{
            fontSize: '14px',
            fontWeight: '700',
            marginTop: '16px',
            marginBottom: '8px',
            color: colors.text
          }}>
            {line.replace('###', '').trim()}
          </h4>
        );
      }
      if (line.startsWith('##')) {
        return (
          <h3 key={i} style={{
            fontSize: '16px',
            fontWeight: '700',
            marginTop: '20px',
            marginBottom: '10px',
            color: colors.text,
            borderBottom: `2px solid ${colors.border}`,
            paddingBottom: '6px'
          }}>
            {line.replace('##', '').trim()}
          </h3>
        );
      }
      if (line.startsWith('#')) {
        return (
          <h2 key={i} style={{
            fontSize: '18px',
            fontWeight: '700',
            marginTop: '24px',
            marginBottom: '12px',
            color: colors.text
          }}>
            {line.replace('#', '').trim()}
          </h2>
        );
      }

      // Lists
      if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
        return (
          <li key={i} style={{
            fontSize: '13px',
            lineHeight: '1.7',
            marginLeft: '24px',
            marginBottom: '6px',
            color: colors.text
          }}>
            {line.replace(/^[\s-*]+/, '')}
          </li>
        );
      }

      // Numbered lists
      if (/^\d+\./.test(line.trim())) {
        return (
          <li key={i} style={{
            fontSize: '13px',
            lineHeight: '1.7',
            marginLeft: '24px',
            marginBottom: '6px',
            listStyleType: 'decimal',
            color: colors.text
          }}>
            {line.replace(/^\d+\.\s*/, '')}
          </li>
        );
      }

      // Bold text **text**
      const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // Regular paragraph
      if (line.trim() !== '') {
        return (
          <p
            key={i}
            style={{
              fontSize: '13px',
              lineHeight: '1.7',
              marginBottom: '12px',
              color: colors.text
            }}
            dangerouslySetInnerHTML={{ __html: boldLine }}
          />
        );
      }

      return <div key={i} style={{ height: '8px' }} />;
    });
  };

  const exportToCSV = () => {
    const headers = [
      'State',
      'NASCO',
      'Max Length (ft)',
      'Max Width (ft)',
      'Max Height (ft)',
      'Legal GVW (lbs)',
      'Permitted Max GVW (lbs)',
      'Single Axle (lbs)',
      'Tandem Axle (lbs)',
      'Permit Phone',
      'Permit Email',
      'Completeness %'
    ];

    const rows = regulations.map(reg => [
      reg.state_name,
      reg.is_nasco_state === 1 ? 'Yes' : 'No',
      reg.max_length_ft || '',
      reg.max_width_ft || '',
      reg.max_height_ft || '',
      reg.legal_gvw || '',
      reg.permitted_max_gvw || '',
      reg.permitted_single_axle || '',
      reg.permitted_tandem_axle || '',
      reg.permit_office_phone || '',
      reg.permit_office_email || '',
      reg.data_completeness_pct || '0'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `osow-regulations-${showNascoOnly ? 'nasco' : 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const styles = {
    container: {
      padding: '24px',
      background: colors.bg,
      minHeight: '100vh',
    },
    header: {
      marginBottom: '24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: '16px'
    },
    title: {
      fontSize: '28px',
      fontWeight: '700',
      color: colors.text,
      marginBottom: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    subtitle: {
      fontSize: '14px',
      color: colors.textSecondary,
      lineHeight: '1.6',
    },
    controls: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    button: {
      padding: '10px 16px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    toggleButton: {
      padding: '8px 16px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600',
      border: `2px solid ${colors.border}`,
      background: colors.bgSecondary,
      color: colors.text,
      cursor: 'pointer'
    },
    toggleButtonActive: {
      background: colors.accent,
      color: 'white',
      borderColor: colors.accent
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      background: colors.bgSecondary,
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    },
    th: {
      padding: '14px 12px',
      textAlign: 'left',
      fontSize: '12px',
      fontWeight: '700',
      color: colors.textSecondary,
      background: darkMode ? '#1e293b' : '#f1f5f9',
      borderBottom: `2px solid ${colors.border}`,
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    td: {
      padding: '12px',
      fontSize: '13px',
      color: colors.text,
      borderBottom: `1px solid ${colors.border}`
    },
    badge: {
      padding: '3px 8px',
      borderRadius: '12px',
      fontSize: '10px',
      fontWeight: '700',
      display: 'inline-block'
    },
    progressBar: {
      width: '80px',
      height: '6px',
      background: darkMode ? '#334155' : '#e2e8f0',
      borderRadius: '3px',
      overflow: 'hidden',
      position: 'relative'
    },
    progressFill: (pct) => ({
      width: `${pct}%`,
      height: '100%',
      background: pct >= 100 ? colors.success : pct >= 50 ? colors.warning : colors.danger,
      transition: 'width 0.3s ease'
    })
  };

  if (loading) {
    return (
      <div style={{
        ...styles.container,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px'
      }}>
        <div style={{ fontSize: '16px', color: colors.textSecondary }}>
          Loading regulations...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <span>🛣️</span>
            {showNascoOnly ? 'NASCO Corridor' : 'State'} OS/OW Regulations
          </h1>
          <p style={styles.subtitle}>
            {showNascoOnly
              ? 'Oversize/Overweight regulations for North American SuperCorridor Coalition states'
              : 'Comprehensive oversize/overweight regulations across all states'
            }
          </p>
        </div>

        <div style={styles.controls}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                ...styles.toggleButton,
                ...(viewMode === 'table' && styles.toggleButtonActive)
              }}
            >
              📊 Table View
            </button>
            <button
              onClick={() => setViewMode('analysis')}
              style={{
                ...styles.toggleButton,
                ...(viewMode === 'analysis' && styles.toggleButtonActive)
              }}
            >
              🤖 AI Analysis
            </button>
          </div>

          {/* NASCO Only Toggle */}
          <button
            onClick={() => setShowNascoOnly(!showNascoOnly)}
            style={{
              ...styles.toggleButton,
              ...(showNascoOnly && styles.toggleButtonActive)
            }}
          >
            {showNascoOnly ? '✓ NASCO Only' : 'All States'}
          </button>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            style={{
              ...styles.button,
              background: colors.success,
              color: 'white'
            }}
          >
            📥 Export CSV
          </button>

          {/* Generate AI Analysis */}
          {viewMode === 'analysis' && !aiAnalysis && (
            <button
              onClick={generateAIAnalysis}
              disabled={loadingAnalysis}
              style={{
                ...styles.button,
                background: loadingAnalysis ? colors.textSecondary : colors.accent,
                color: 'white',
                cursor: loadingAnalysis ? 'wait' : 'pointer'
              }}
            >
              {loadingAnalysis ? 'Analyzing...' : '🤖 Generate AI Analysis'}
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: colors.bgSecondary,
          padding: '16px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600', marginBottom: '4px' }}>
            TOTAL STATES
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>
            {regulations.length}
          </div>
        </div>

        <div style={{
          background: colors.bgSecondary,
          padding: '16px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600', marginBottom: '4px' }}>
            COMPLETE DATA
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: colors.success }}>
            {regulations.filter(r => r.data_completeness_pct >= 100).length}
          </div>
        </div>

        <div style={{
          background: colors.bgSecondary,
          padding: '16px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600', marginBottom: '4px' }}>
            AVG COMPLETENESS
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>
            {Math.round(regulations.reduce((sum, r) => sum + (r.data_completeness_pct || 0), 0) / regulations.length)}%
          </div>
        </div>

        <div style={{
          background: colors.bgSecondary,
          padding: '16px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600', marginBottom: '4px' }}>
            NASCO STATES
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: colors.accent }}>
            {regulations.filter(r => r.is_nasco_state === 1).length}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'table' ? (
        // Table View
        <div style={{
          background: colors.bgSecondary,
          borderRadius: '12px',
          overflow: 'hidden',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>State</th>
                  <th style={styles.th}>NASCO</th>
                  <th style={styles.th}>Max Length</th>
                  <th style={styles.th}>Max Width</th>
                  <th style={styles.th}>Max Height</th>
                  <th style={styles.th}>Legal GVW</th>
                  <th style={styles.th}>Completeness</th>
                  <th style={styles.th}>Permit Office</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {regulations.map(reg => (
                  <tr key={reg.state_key} style={{
                    background: reg.data_completeness_pct >= 100
                      ? (darkMode ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.02)')
                      : 'transparent'
                  }}>
                    <td style={styles.td}>
                      <strong>{reg.state_name}</strong>
                      <div style={{ fontSize: '10px', color: colors.textSecondary }}>
                        {reg.state_key.toUpperCase()}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {reg.is_nasco_state === 1 && (
                        <span style={{
                          ...styles.badge,
                          background: colors.accent,
                          color: 'white'
                        }}>
                          NASCO
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>{reg.max_length_ft ? `${reg.max_length_ft} ft` : '—'}</td>
                    <td style={styles.td}>{reg.max_width_ft ? `${reg.max_width_ft} ft` : '—'}</td>
                    <td style={styles.td}>{reg.max_height_ft ? `${reg.max_height_ft} ft` : '—'}</td>
                    <td style={styles.td}>{reg.legal_gvw ? `${reg.legal_gvw.toLocaleString()} lbs` : '—'}</td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={styles.progressBar}>
                          <div style={styles.progressFill(reg.data_completeness_pct || 0)} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '600' }}>
                          {reg.data_completeness_pct || 0}%
                        </span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      {reg.permit_office_phone && (
                        <div style={{ fontSize: '11px' }}>{reg.permit_office_phone}</div>
                      )}
                      {reg.permit_office_email && (
                        <div style={{ fontSize: '10px', color: colors.textSecondary }}>
                          {reg.permit_office_email}
                        </div>
                      )}
                    </td>
                    <td style={styles.td}>
                      <button
                        onClick={() => handleEdit(reg)}
                        style={{
                          ...styles.button,
                          padding: '6px 12px',
                          fontSize: '11px',
                          background: colors.accent,
                          color: 'white'
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // AI Analysis View
        <div style={{
          background: colors.bgSecondary,
          borderRadius: '12px',
          padding: '24px',
          border: `1px solid ${colors.border}`
        }}>
          {aiAnalysis ? (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '16px',
                borderBottom: `2px solid ${colors.border}`
              }}>
                <div>
                  <h2 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: colors.text,
                    margin: 0,
                    marginBottom: '8px'
                  }}>
                    🤖 AI Harmonization Analysis
                  </h2>
                  <div style={{
                    fontSize: '12px',
                    color: colors.textSecondary
                  }}>
                    Analyzing {aiAnalysis.statesAnalyzed?.length} states for regulatory uniformity
                  </div>
                </div>
                <button
                  onClick={generateAIAnalysis}
                  disabled={loadingAnalysis}
                  style={{
                    ...styles.button,
                    background: loadingAnalysis ? colors.textSecondary : colors.success,
                    color: 'white'
                  }}
                >
                  {loadingAnalysis ? 'Regenerating...' : '🔄 Regenerate'}
                </button>
              </div>

              {/* States Analyzed */}
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                background: darkMode ? '#0f172a' : '#ffffff',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  marginBottom: '10px'
                }}>
                  States Analyzed:
                </div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  {aiAnalysis.statesAnalyzed?.map(state => (
                    <span
                      key={state.key}
                      style={{
                        padding: '6px 12px',
                        background: colors.accent,
                        color: 'white',
                        borderRadius: '16px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}
                    >
                      {state.key.toUpperCase()} - {state.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Analysis Content */}
              <div style={{
                fontSize: '13px',
                lineHeight: '1.8',
                color: colors.text,
                maxWidth: '900px'
              }}>
                {renderMarkdown(aiAnalysis.analysis)}
              </div>

              {/* Footer Actions */}
              <div style={{
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: `1px solid ${colors.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{
                  fontSize: '11px',
                  color: colors.textSecondary
                }}>
                  Generated: {new Date(aiAnalysis.timestamp).toLocaleString()} • Model: {aiAnalysis.model}
                </div>
                <button
                  onClick={() => {
                    const blob = new Blob([aiAnalysis.analysis], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `nasco-corridor-analysis-${new Date().toISOString().split('T')[0]}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    ...styles.button,
                    background: colors.accentBlue || colors.accent,
                    color: 'white'
                  }}
                >
                  📥 Download Analysis
                </button>
              </div>
            </>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: colors.textSecondary
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                No Analysis Generated
              </div>
              <div style={{ fontSize: '13px', marginBottom: '20px' }}>
                Click "Generate AI Analysis" to analyze corridor regulations for uniformity
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingState && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: colors.bg,
            padding: '24px',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '12px',
              borderBottom: `2px solid ${colors.border}`
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: colors.text }}>
                Edit {regulations.find(r => r.state_key === editingState)?.state_name} Regulations
              </h3>
              <button
                onClick={() => setEditingState(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: colors.textSecondary,
                  padding: '0 8px'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {[
                { key: 'max_length_ft', label: 'Max Length (ft)', type: 'number' },
                { key: 'max_width_ft', label: 'Max Width (ft)', type: 'number', step: '0.1' },
                { key: 'max_height_ft', label: 'Max Height (ft)', type: 'number', step: '0.1' },
                { key: 'legal_gvw', label: 'Legal GVW (lbs)', type: 'number' },
                { key: 'permitted_max_gvw', label: 'Permitted Max GVW (lbs)', type: 'number' },
                { key: 'permitted_single_axle', label: 'Single Axle (lbs)', type: 'number' },
                { key: 'permitted_tandem_axle', label: 'Tandem Axle (lbs)', type: 'number' },
                { key: 'permit_office_phone', label: 'Permit Office Phone', type: 'tel' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: colors.textSecondary,
                    marginBottom: '6px'
                  }}>
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    step={field.step}
                    value={editFormData[field.key] || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, [field.key]: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      background: colors.bgSecondary,
                      color: colors.text
                    }}
                  />
                </div>
              ))}

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  marginBottom: '6px'
                }}>
                  Permit Office Email
                </label>
                <input
                  type="email"
                  value={editFormData.permit_office_email || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, permit_office_email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    background: colors.bgSecondary,
                    color: colors.text
                  }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  marginBottom: '6px'
                }}>
                  Permit Portal URL
                </label>
                <input
                  type="url"
                  value={editFormData.permit_portal_url || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, permit_portal_url: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    background: colors.bgSecondary,
                    color: colors.text
                  }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  marginBottom: '6px'
                }}>
                  Notes
                </label>
                <textarea
                  value={editFormData.notes || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    background: colors.bgSecondary,
                    color: colors.text,
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <button
                onClick={() => handleSave(editingState)}
                style={{
                  flex: 1,
                  ...styles.button,
                  background: colors.success,
                  color: 'white',
                  justifyContent: 'center'
                }}
              >
                💾 Save Changes
              </button>
              <button
                onClick={() => setEditingState(null)}
                style={{
                  flex: 1,
                  ...styles.button,
                  background: colors.textSecondary,
                  color: 'white',
                  justifyContent: 'center'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

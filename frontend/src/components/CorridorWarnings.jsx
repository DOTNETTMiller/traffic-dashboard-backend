import { useState, useEffect } from 'react';
import api from '../services/api';
import { theme } from '../styles/theme';

export default function CorridorWarnings({ corridor, onViewOnMap }) {
  const [warnings, setWarnings] = useState([]);
  const [groupedWarnings, setGroupedWarnings] = useState({});
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    if (corridor) {
      fetchWarnings();
    } else {
      setWarnings([]);
      setGroupedWarnings({});
      setStats(null);
      setExpandedGroups({});
    }
  }, [corridor]);

  useEffect(() => {
    // Group warnings by event type
    if (warnings.length > 0) {
      const groups = warnings.reduce((acc, warning) => {
        const type = warning.event.eventType || 'Other';
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(warning);
        return acc;
      }, {});
      setGroupedWarnings(groups);
    }
  }, [warnings]);

  const fetchWarnings = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching warnings for corridor:', corridor);
      const response = await api.get(`/api/warnings/corridor/${encodeURIComponent(corridor)}`);
      console.log('Warnings response:', response.data);

      if (response.data.success) {
        setWarnings(response.data.warnings);
        setStats(response.data.statistics);
        console.log('Loaded warnings:', response.data.warnings.length, 'Stats:', response.data.statistics);
      } else {
        setError('Failed to load traffic warnings');
      }
    } catch (err) {
      console.error('Error fetching corridor warnings:', err);
      setError('Unable to load traffic warnings: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const handleViewOnMap = (warning) => {
    if (onViewOnMap && warning.event.latitude && warning.event.longitude) {
      onViewOnMap({
        ...warning.event,
        impactScore: warning.impactScore,
        warningLevel: warning.warningLevel
      });
    }
  };

  const getGroupSeverity = (groupWarnings) => {
    const severeCounts = {
      severe: groupWarnings.filter(w => w.warningLevel === 'severe').length,
      high: groupWarnings.filter(w => w.warningLevel === 'high').length,
      moderate: groupWarnings.filter(w => w.warningLevel === 'moderate').length
    };

    if (severeCounts.severe > 0) return { level: 'severe', count: severeCounts.severe, color: '#dc2626' };
    if (severeCounts.high > 0) return { level: 'high', count: severeCounts.high, color: '#f59e0b' };
    return { level: 'moderate', count: severeCounts.moderate, color: '#3b82f6' };
  };

  if (!corridor) {
    console.log('CorridorWarnings: No corridor selected');
    return null;
  }

  console.log('CorridorWarnings rendering:', { corridor, loading, warnings: warnings.length, stats });

  if (loading && !stats) {
    return (
      <div style={{
        marginBottom: '8px',
        borderRadius: '6px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#3b82f6',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: 'white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
              Analyzing {corridor}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', opacity: 0.9 }}>
              Evaluating traffic impact...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '8px 12px',
        backgroundColor: '#fee2e2',
        borderRadius: '6px',
        marginBottom: '8px',
        color: '#991b1b',
        fontSize: '12px'
      }}>
        {error}
      </div>
    );
  }

  if (warnings.length === 0) {
    return (
      <div style={{
        padding: '8px 12px',
        backgroundColor: '#d1fae5',
        borderRadius: '6px',
        marginBottom: '8px',
        color: '#065f46',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: '600'
      }}>
        <span style={{ fontSize: '16px' }}>✅</span>
        <span>No major traffic impacts on {corridor}</span>
      </div>
    );
  }

  const getWarningStyle = (level) => {
    switch (level) {
      case 'severe':
        return {
          backgroundColor: '#fef2f2',
          borderLeft: '4px solid #dc2626',
          color: '#991b1b'
        };
      case 'high':
        return {
          backgroundColor: '#fef3c7',
          borderLeft: '4px solid #f59e0b',
          color: '#92400e'
        };
      case 'moderate':
        return {
          backgroundColor: '#dbeafe',
          borderLeft: '4px solid #3b82f6',
          color: '#1e40af'
        };
      default:
        return {
          backgroundColor: '#f3f4f6',
          borderLeft: '4px solid #6b7280',
          color: '#374151'
        };
    }
  };

  const severeCount = stats?.severe || 0;
  const highCount = stats?.high || 0;

  return (
    <div style={{
      ...theme.glass.light,
      marginBottom: theme.spacing.sm,
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      boxShadow: theme.shadows.lg,
      transition: theme.transitions.all
    }}>
      {/* Header */}
      <div
        style={{
          padding: theme.spacing.md,
          backgroundColor: severeCount > 0 ? theme.colors.error.dark : highCount > 0 ? theme.colors.warning.dark : theme.colors.primary.main,
          color: theme.colors.white,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          transition: theme.transitions.base
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.95'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <span style={{ fontSize: theme.fontSize.md }}>
            {severeCount > 0 ? '⛔' : highCount > 0 ? '⚠️' : 'ℹ️'}
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold }}>
              {corridor} Traffic Warnings
            </h3>
            <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.fontSize.xs, opacity: 0.9 }}>
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
              {stats && ` (${severeCount} severe, ${highCount} high, ${stats.moderate} moderate)`}
            </p>
          </div>
        </div>
        <span style={{
          fontSize: theme.fontSize.md,
          transition: theme.transitions.base,
          display: 'inline-block',
          transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'
        }}>
          ▼
        </span>
      </div>

      {/* Summary and Grouped Warnings */}
      {isExpanded && (
        <div style={{
          backgroundColor: 'white'
        }}>
          {/* Summary Stats */}
          <div style={{
            padding: '8px 12px',
            backgroundColor: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
            gap: '8px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                {Object.keys(groupedWarnings).length}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>Types</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>
                {stats?.severe || 0}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>Severe</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>
                {stats?.high || 0}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>High</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>
                {stats?.moderate || 0}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>Moderate</div>
            </div>
          </div>

          {/* Grouped Events */}
          <div style={{
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {Object.entries(groupedWarnings).map(([groupName, groupWarnings]) => {
              const severity = getGroupSeverity(groupWarnings);
              const isGroupExpanded = expandedGroups[groupName];
              const topWarnings = groupWarnings.slice(0, 3); // Show top 3 when expanded

              return (
                <div
                  key={groupName}
                  style={{
                    borderBottom: '1px solid #e5e7eb'
                  }}
                >
                  {/* Group Header */}
                  <div
                    onClick={() => toggleGroup(groupName)}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: isGroupExpanded ? '#fafafa' : 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = isGroupExpanded ? '#fafafa' : 'white'}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: '#111827'
                        }}>
                          {groupName}
                        </h4>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          backgroundColor: severity.color,
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '10px'
                        }}>
                          {groupWarnings.length}
                        </span>
                      </div>
                      <p style={{
                        margin: 0,
                        fontSize: '11px',
                        color: '#6b7280'
                      }}>
                        {severity.count} {severity.level} impact event{severity.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span style={{ fontSize: '16px', color: '#9ca3af' }}>
                      {isGroupExpanded ? '▼' : '▶'}
                    </span>
                  </div>

                  {/* Expanded Group - Show Top Events */}
                  {isGroupExpanded && (
                    <div style={{
                      backgroundColor: '#fafafa',
                      padding: '0 12px 10px 12px'
                    }}>
                      {topWarnings.map((warning, index) => (
                        <div
                          key={warning.eventId}
                          style={{
                            backgroundColor: 'white',
                            padding: '8px',
                            borderRadius: '4px',
                            marginBottom: index < topWarnings.length - 1 ? '6px' : '0',
                            border: `1px solid ${
                              warning.warningLevel === 'severe' ? '#fecaca' :
                              warning.warningLevel === 'high' ? '#fed7aa' : '#bfdbfe'
                            }`
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '6px'
                          }}>
                            <div style={{ flex: 1 }}>
                              <h5 style={{
                                margin: '0 0 2px 0',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#111827'
                              }}>
                                {warning.event.location || warning.details}
                              </h5>
                              <p style={{
                                margin: 0,
                                fontSize: '11px',
                                color: '#6b7280'
                              }}>
                                {warning.event.description || warning.recommendation}
                              </p>
                            </div>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '600',
                              backgroundColor:
                                warning.warningLevel === 'severe' ? '#dc2626' :
                                warning.warningLevel === 'high' ? '#f59e0b' : '#3b82f6',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              marginLeft: '6px',
                              whiteSpace: 'nowrap'
                            }}>
                              {warning.impactScore}
                            </span>
                          </div>

                          {warning.event.latitude && warning.event.longitude && (
                            <button
                              onClick={() => handleViewOnMap(warning)}
                              style={{
                                marginTop: '4px',
                                padding: '4px 8px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                fontSize: '11px',
                                fontWeight: '500',
                                cursor: 'pointer'
                              }}
                              onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
                              onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
                            >
                              📍 View on Map
                            </button>
                          )}
                        </div>
                      ))}

                      {groupWarnings.length > 3 && (
                        <p style={{
                          margin: '8px 0 0 0',
                          fontSize: '10px',
                          color: '#6b7280',
                          textAlign: 'center',
                          fontStyle: 'italic'
                        }}>
                          + {groupWarnings.length - 3} more {groupName.toLowerCase()} event{groupWarnings.length - 3 !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer with legend */}
          <div style={{
            padding: '6px 12px',
            backgroundColor: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
            fontSize: '10px',
            color: '#6b7280'
          }}>
            <strong>Impact:</strong>{' '}
            <span style={{ color: '#dc2626' }}>⛔ Severe (70+)</span> •{' '}
            <span style={{ color: '#f59e0b' }}>⚠️ High (50-69)</span> •{' '}
            <span style={{ color: '#3b82f6' }}>⚡ Moderate (30-49)</span>
          </div>
        </div>
      )}
    </div>
  );
}

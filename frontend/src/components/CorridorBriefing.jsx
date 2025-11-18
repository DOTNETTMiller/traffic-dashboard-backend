import { useState, useMemo, useEffect } from 'react';
import { theme } from '../styles/theme';
import { format } from 'date-fns';
import { config } from '../config';

export default function CorridorBriefing({ events, detourAlerts, onClose }) {
  const [selectedCorridor, setSelectedCorridor] = useState('');
  const [selectedDirection, setSelectedDirection] = useState('all');
  const [aiSummary, setAiSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // Extract unique corridors from events
  const corridors = useMemo(() => {
    const uniqueCorridors = new Set();
    events.forEach(event => {
      if (event.corridor) {
        // Extract interstate number (I-5, I-10, etc.)
        const match = event.corridor.match(/I[-\s]?(\d+)/i);
        if (match) {
          uniqueCorridors.add(`I-${match[1]}`);
        }
      }
    });
    return Array.from(uniqueCorridors).sort((a, b) => {
      const numA = parseInt(a.split('-')[1]);
      const numB = parseInt(b.split('-')[1]);
      return numA - numB;
    });
  }, [events]);

  // Filter events for selected corridor
  const corridorEvents = useMemo(() => {
    if (!selectedCorridor) return [];

    return events.filter(event => {
      const corridor = event.corridor || '';
      const matchesCorridor = corridor.includes(selectedCorridor);

      if (!matchesCorridor) return false;

      // Filter by direction if specified
      if (selectedDirection !== 'all') {
        const direction = (event.direction || '').toLowerCase();
        const description = (event.description || '').toLowerCase();
        const text = `${direction} ${description}`;

        if (selectedDirection === 'north' && !text.includes('north')) return false;
        if (selectedDirection === 'south' && !text.includes('south')) return false;
        if (selectedDirection === 'east' && !text.includes('east')) return false;
        if (selectedDirection === 'west' && !text.includes('west')) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort by state, then by location
      if (a.state !== b.state) return (a.state || '').localeCompare(b.state || '');
      return (a.location || '').localeCompare(b.location || '');
    });
  }, [events, selectedCorridor, selectedDirection]);

  // Filter detour alerts for selected corridor
  const corridorDetours = useMemo(() => {
    if (!selectedCorridor) return [];
    return detourAlerts.filter(alert =>
      alert.event_corridor && alert.event_corridor.includes(selectedCorridor)
    );
  }, [detourAlerts, selectedCorridor]);

  // Calculate corridor statistics
  const stats = useMemo(() => {
    const severityCounts = { high: 0, medium: 0, low: 0 };
    const typeCounts = {};
    const stateCounts = {};

    corridorEvents.forEach(event => {
      const severity = (event.severity || event.severityLevel || 'medium').toString().toLowerCase();
      if (severity === 'high' || severity === 'major') severityCounts.high++;
      else if (severity === 'medium' || severity === 'moderate') severityCounts.medium++;
      else severityCounts.low++;

      const type = event.eventType || 'Unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;

      if (event.state) {
        stateCounts[event.state] = (stateCounts[event.state] || 0) + 1;
      }
    });

    // Calculate overall severity
    let overallSeverity = 'GOOD';
    let advisoryColor = theme.colors.success.main;

    if (severityCounts.high >= 3) {
      overallSeverity = 'CRITICAL';
      advisoryColor = theme.colors.error.main;
    } else if (severityCounts.high >= 1) {
      overallSeverity = 'CAUTION';
      advisoryColor = theme.colors.warning.main;
    } else if (severityCounts.medium >= 5) {
      overallSeverity = 'ADVISORY';
      advisoryColor = theme.colors.warning.main;
    }

    return {
      total: corridorEvents.length,
      severityCounts,
      typeCounts,
      stateCounts,
      overallSeverity,
      advisoryColor
    };
  }, [corridorEvents]);

  // Fetch AI summary when corridor changes
  useEffect(() => {
    const fetchSummary = async () => {
      if (!selectedCorridor || corridorEvents.length === 0) {
        setAiSummary(null);
        return;
      }

      setSummaryLoading(true);
      setSummaryError(null);

      try {
        const response = await fetch(`${config.apiUrl}/api/corridor/generate-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            corridor: selectedCorridor,
            events: corridorEvents,
            detours: corridorDetours
          })
        });

        if (!response.ok) throw new Error('Failed to generate summary');

        const data = await response.json();
        if (data.success) {
          setAiSummary(data.summary);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (error) {
        console.error('Error fetching AI summary:', error);
        setSummaryError(error.message);
      } finally {
        setSummaryLoading(false);
      }
    };

    fetchSummary();
  }, [selectedCorridor, corridorEvents, corridorDetours]);

  const handlePrint = () => {
    window.print();
  };

  const getSeverityIcon = (severity) => {
    const s = (severity || 'medium').toString().toLowerCase();
    if (s === 'high' || s === 'major') return '🔴';
    if (s === 'medium' || s === 'moderate') return '🟡';
    return '🟢';
  };

  const getEventTypeIcon = (type) => {
    switch (type) {
      case 'Closure': return '🚧';
      case 'Construction': return '👷';
      case 'Incident': return '⚠️';
      case 'Weather': return '🌦️';
      default: return '📍';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: theme.colors.glassDark,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '16px',
        boxShadow: theme.shadows.xl,
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: theme.spacing.lg,
          borderBottom: `1px solid ${theme.colors.border}`,
          background: theme.colors.gradients.primary
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.md
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: '700',
              color: 'white'
            }}>
              🛣️ Corridor Travel Briefing
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '24px',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: `all ${theme.transitions.fast}`
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              ×
            </button>
          </div>

          {/* Corridor Selection */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr auto',
            gap: theme.spacing.md
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: 'rgba(255, 255, 255, 0.9)',
                marginBottom: '4px'
              }}>
                Select Corridor
              </label>
              <select
                value={selectedCorridor}
                onChange={(e) => setSelectedCorridor(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="">Choose Interstate...</option>
                {corridors.map(corridor => (
                  <option key={corridor} value={corridor} style={{ color: '#000' }}>
                    {corridor}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: 'rgba(255, 255, 255, 0.9)',
                marginBottom: '4px'
              }}>
                Direction
              </label>
              <select
                value={selectedDirection}
                onChange={(e) => setSelectedDirection(e.target.value)}
                disabled={!selectedCorridor}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: selectedCorridor ? 'pointer' : 'not-allowed',
                  opacity: selectedCorridor ? 1 : 0.5,
                  outline: 'none'
                }}
              >
                <option value="all" style={{ color: '#000' }}>All Directions</option>
                <option value="north" style={{ color: '#000' }}>Northbound</option>
                <option value="south" style={{ color: '#000' }}>Southbound</option>
                <option value="east" style={{ color: '#000' }}>Eastbound</option>
                <option value="west" style={{ color: '#000' }}>Westbound</option>
              </select>
            </div>

            <div style={{ alignSelf: 'flex-end' }}>
              <button
                onClick={handlePrint}
                disabled={!selectedCorridor}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: selectedCorridor ? 'pointer' : 'not-allowed',
                  opacity: selectedCorridor ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: `all ${theme.transitions.fast}`
                }}
                onMouseEnter={(e) => {
                  if (selectedCorridor) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              >
                🖨️ Print
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: theme.spacing.lg
        }}>
          {!selectedCorridor ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: theme.colors.textSecondary
            }}>
              <div style={{ fontSize: '64px', marginBottom: theme.spacing.md }}>🛣️</div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: theme.colors.text,
                marginBottom: '8px'
              }}>
                Select an Interstate Corridor
              </h3>
              <p style={{ fontSize: '14px', margin: 0 }}>
                Choose a corridor above to generate a comprehensive travel briefing
              </p>
            </div>
          ) : (
            <>
              {/* Briefing Header */}
              <div style={{
                background: theme.colors.glassLight,
                borderRadius: '12px',
                padding: theme.spacing.lg,
                marginBottom: theme.spacing.lg,
                border: `2px solid ${stats.advisoryColor}40`
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: theme.spacing.md
                }}>
                  <div>
                    <h3 style={{
                      margin: 0,
                      fontSize: '28px',
                      fontWeight: '700',
                      color: theme.colors.text,
                      marginBottom: '4px'
                    }}>
                      {selectedCorridor}
                      {selectedDirection !== 'all' && ` ${selectedDirection.charAt(0).toUpperCase() + selectedDirection.slice(1)}bound`}
                    </h3>
                    <div style={{
                      fontSize: '13px',
                      color: theme.colors.textSecondary,
                      fontWeight: '600'
                    }}>
                      Briefing issued: {format(new Date(), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </div>
                  <div style={{
                    padding: '12px 20px',
                    borderRadius: '12px',
                    background: `${stats.advisoryColor}20`,
                    border: `2px solid ${stats.advisoryColor}`,
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: stats.advisoryColor
                    }}>
                      {stats.overallSeverity}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: stats.advisoryColor,
                      opacity: 0.8
                    }}>
                      CONDITIONS
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: theme.spacing.md,
                  marginTop: theme.spacing.md,
                  paddingTop: theme.spacing.md,
                  borderTop: `1px solid ${theme.colors.border}`
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '700',
                      color: theme.colors.accentBlue
                    }}>
                      {stats.total}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase'
                    }}>
                      Total Events
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '700',
                      color: theme.colors.error.main
                    }}>
                      {stats.severityCounts.high}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase'
                    }}>
                      High Severity
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '700',
                      color: theme.colors.warning.main
                    }}>
                      {stats.severityCounts.medium}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase'
                    }}>
                      Medium Severity
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '700',
                      color: theme.colors.accentPurple
                    }}>
                      {Object.keys(stats.stateCounts).length}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase'
                    }}>
                      States Affected
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Summary Section */}
              {(aiSummary || summaryLoading || summaryError) && (
                <div style={{ marginBottom: theme.spacing.lg }}>
                  <div style={{
                    background: `linear-gradient(135deg, ${theme.colors.accentPurple}15, ${theme.colors.accentBlue}15)`,
                    borderRadius: '12px',
                    padding: theme.spacing.lg,
                    border: `2px solid ${theme.colors.accentBlue}40`,
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: -20,
                      right: -20,
                      fontSize: '120px',
                      opacity: 0.05
                    }}>
                      🤖
                    </div>
                    <div style={{
                      position: 'relative',
                      zIndex: 1
                    }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: theme.colors.text,
                        marginBottom: theme.spacing.sm,
                        display: 'flex',
                        alignItems: 'center',
                        gap: theme.spacing.sm
                      }}>
                        🤖 AI Corridor Summary
                      </h4>
                      {summaryLoading ? (
                        <div style={{
                          fontSize: '14px',
                          color: theme.colors.textSecondary,
                          fontStyle: 'italic',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{
                            width: '16px',
                            height: '16px',
                            border: `3px solid ${theme.colors.accentBlue}40`,
                            borderTop: `3px solid ${theme.colors.accentBlue}`,
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'spin 1s linear infinite'
                          }} />
                          Generating AI summary...
                        </div>
                      ) : summaryError ? (
                        <div style={{
                          fontSize: '14px',
                          color: theme.colors.error.main,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          ⚠️ Unable to generate summary: {summaryError}
                        </div>
                      ) : (
                        <div style={{
                          fontSize: '15px',
                          lineHeight: '1.7',
                          color: theme.colors.text,
                          fontWeight: '500'
                        }}>
                          {aiSummary}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Detour Alerts Section */}
              {corridorDetours.length > 0 && (
                <div style={{ marginBottom: theme.spacing.lg }}>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: theme.colors.text,
                    marginBottom: theme.spacing.sm,
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing.sm
                  }}>
                    🚨 Active Detour Alerts ({corridorDetours.length})
                  </h4>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: theme.spacing.sm
                  }}>
                    {corridorDetours.map(detour => (
                      <div
                        key={detour.id}
                        style={{
                          background: `${theme.colors.error.main}10`,
                          border: `2px solid ${theme.colors.error.main}40`,
                          borderLeft: `4px solid ${theme.colors.error.main}`,
                          borderRadius: '8px',
                          padding: theme.spacing.md
                        }}
                      >
                        <div style={{
                          fontWeight: '700',
                          fontSize: '14px',
                          color: theme.colors.text,
                          marginBottom: '4px'
                        }}>
                          {detour.interchange_name}
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: theme.colors.textSecondary,
                          lineHeight: '1.5'
                        }}>
                          {detour.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Events List */}
              <div>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: theme.colors.text,
                  marginBottom: theme.spacing.sm,
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm
                }}>
                  📋 Conditions Report
                </h4>

                {corridorEvents.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    background: theme.colors.glassLight,
                    borderRadius: '12px',
                    color: theme.colors.textSecondary
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: theme.spacing.sm }}>✅</div>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>All Clear</div>
                    <div style={{ fontSize: '13px' }}>No reported events for this corridor</div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: theme.spacing.sm
                  }}>
                    {corridorEvents.map((event, idx) => {
                      const severity = (event.severity || event.severityLevel || 'medium').toString().toLowerCase();
                      const severityColor = severity === 'high' || severity === 'major' ? theme.colors.error.main :
                                           severity === 'medium' || severity === 'moderate' ? theme.colors.warning.main :
                                           theme.colors.success.main;

                      return (
                        <div
                          key={event.id || idx}
                          style={{
                            background: theme.colors.glassLight,
                            borderRadius: '8px',
                            padding: theme.spacing.md,
                            borderLeft: `4px solid ${severityColor}`
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '6px'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <span style={{ fontSize: '18px' }}>
                                {getEventTypeIcon(event.eventType)}
                              </span>
                              <span style={{
                                fontWeight: '700',
                                fontSize: '14px',
                                color: theme.colors.text
                              }}>
                                {event.eventType || 'Event'}
                              </span>
                              <span style={{ fontSize: '16px' }}>
                                {getSeverityIcon(severity)}
                              </span>
                            </div>
                            {event.state && (
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: theme.colors.accentBlue,
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: '700'
                              }}>
                                {event.state}
                              </span>
                            )}
                          </div>

                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: theme.colors.textSecondary,
                            marginBottom: '4px'
                          }}>
                            {event.location}
                          </div>

                          <div style={{
                            fontSize: '13px',
                            color: theme.colors.textSecondary,
                            lineHeight: '1.5'
                          }}>
                            {event.description}
                          </div>

                          {event.lanesAffected && (
                            <div style={{
                              marginTop: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: theme.colors.error.main
                            }}>
                              🚧 {event.lanesAffected}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{
                marginTop: theme.spacing.lg,
                paddingTop: theme.spacing.md,
                borderTop: `1px solid ${theme.colors.border}`,
                fontSize: '12px',
                color: theme.colors.textSecondary,
                textAlign: 'center'
              }}>
                <p style={{ margin: 0, marginBottom: '4px' }}>
                  <strong>Important:</strong> Conditions can change rapidly. Monitor updates and drive safely.
                </p>
                <p style={{ margin: 0 }}>
                  DOT Corridor Communicator • Real-time Interstate Corridor Information
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

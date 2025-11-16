import { useState, useEffect, useMemo } from 'react';
import { theme } from '../styles/theme';
import DashboardWidget from './DashboardWidget';

export default function DashboardWidgets({ events }) {
  const [visibleWidgets, setVisibleWidgets] = useState(() => {
    const saved = localStorage.getItem('dashboardWidgets');
    return saved ? JSON.parse(saved) : ['eventCount', 'severity', 'states', 'recentActivity'];
  });
  const [showConfig, setShowConfig] = useState(false);

  // Save visible widgets to localStorage
  useEffect(() => {
    localStorage.setItem('dashboardWidgets', JSON.stringify(visibleWidgets));
  }, [visibleWidgets]);

  // Calculate statistics
  const stats = useMemo(() => {
    const severityCounts = { high: 0, medium: 0, low: 0 };
    const stateCounts = {};
    const corridorCounts = {};
    const eventTypeCounts = {};

    events.forEach(event => {
      // Severity
      const severity = (event.severity || event.severityLevel || 'medium').toString().toLowerCase();
      if (severity === 'high' || severity === 'major') {
        severityCounts.high++;
      } else if (severity === 'medium' || severity === 'moderate') {
        severityCounts.medium++;
      } else {
        severityCounts.low++;
      }

      // State
      if (event.state) {
        stateCounts[event.state] = (stateCounts[event.state] || 0) + 1;
      }

      // Corridor
      if (event.corridor) {
        corridorCounts[event.corridor] = (corridorCounts[event.corridor] || 0) + 1;
      }

      // Event Type
      if (event.eventType) {
        eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] || 0) + 1;
      }
    });

    return {
      totalEvents: events.length,
      severityCounts,
      topStates: Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topCorridors: Object.entries(corridorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topEventTypes: Object.entries(eventTypeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
      recentEvents: events.slice(0, 5)
    };
  }, [events]);

  const availableWidgets = [
    { id: 'eventCount', name: 'Event Count', icon: '📊', size: 'small' },
    { id: 'severity', name: 'Severity Breakdown', icon: '⚠️', size: 'medium' },
    { id: 'states', name: 'Top States', icon: '🗺️', size: 'medium' },
    { id: 'corridors', name: 'Top Corridors', icon: '🛣️', size: 'medium' },
    { id: 'eventTypes', name: 'Event Types', icon: '🔧', size: 'medium' },
    { id: 'recentActivity', name: 'Recent Activity', icon: '⏱️', size: 'large' }
  ];

  const toggleWidget = (widgetId) => {
    setVisibleWidgets(prev =>
      prev.includes(widgetId)
        ? prev.filter(id => id !== widgetId)
        : [...prev, widgetId]
    );
  };

  const renderWidget = (widgetId) => {
    const widgetConfig = availableWidgets.find(w => w.id === widgetId);
    if (!widgetConfig) return null;

    const handleRemove = () => toggleWidget(widgetId);

    switch (widgetId) {
      case 'eventCount':
        return (
          <DashboardWidget
            key={widgetId}
            title={widgetConfig.name}
            icon={widgetConfig.icon}
            size={widgetConfig.size}
            onRemove={handleRemove}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1
            }}>
              <div style={{
                fontSize: '64px',
                fontWeight: '700',
                background: theme.colors.gradients.primary,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                {stats.totalEvents}
              </div>
              <div style={{
                fontSize: '14px',
                color: theme.colors.textSecondary,
                fontWeight: '600'
              }}>
                Total Events
              </div>
            </div>
          </DashboardWidget>
        );

      case 'severity':
        return (
          <DashboardWidget
            key={widgetId}
            title={widgetConfig.name}
            icon={widgetConfig.icon}
            size={widgetConfig.size}
            onRemove={handleRemove}
          >
            {[
              { label: 'High', count: stats.severityCounts.high, color: theme.colors.error.main },
              { label: 'Medium', count: stats.severityCounts.medium, color: theme.colors.warning.main },
              { label: 'Low', count: stats.severityCounts.low, color: theme.colors.success.main }
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: theme.spacing.sm,
                background: theme.colors.glassLight,
                borderRadius: '8px',
                border: `2px solid ${item.color}20`
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.colors.text
                }}>
                  {item.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                  <div style={{
                    flex: 1,
                    height: '8px',
                    background: theme.colors.gray[200],
                    borderRadius: '4px',
                    overflow: 'hidden',
                    width: '100px'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${stats.totalEvents > 0 ? (item.count / stats.totalEvents * 100) : 0}%`,
                      background: item.color,
                      transition: `width ${theme.transitions.medium}`
                    }} />
                  </div>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: item.color,
                    minWidth: '40px',
                    textAlign: 'right'
                  }}>
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </DashboardWidget>
        );

      case 'states':
        return (
          <DashboardWidget
            key={widgetId}
            title={widgetConfig.name}
            icon={widgetConfig.icon}
            size={widgetConfig.size}
            onRemove={handleRemove}
          >
            {stats.topStates.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: theme.colors.textSecondary,
                padding: theme.spacing.lg
              }}>
                No state data available
              </div>
            ) : (
              stats.topStates.map(([state, count]) => (
                <div key={state} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: theme.spacing.sm,
                  background: theme.colors.glassLight,
                  borderRadius: '8px'
                }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: theme.colors.text
                  }}>
                    {state}
                  </span>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: theme.colors.accentBlue
                  }}>
                    {count}
                  </span>
                </div>
              ))
            )}
          </DashboardWidget>
        );

      case 'corridors':
        return (
          <DashboardWidget
            key={widgetId}
            title={widgetConfig.name}
            icon={widgetConfig.icon}
            size={widgetConfig.size}
            onRemove={handleRemove}
          >
            {stats.topCorridors.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: theme.colors.textSecondary,
                padding: theme.spacing.lg
              }}>
                No corridor data available
              </div>
            ) : (
              stats.topCorridors.map(([corridor, count]) => (
                <div key={corridor} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: theme.spacing.sm,
                  background: theme.colors.glassLight,
                  borderRadius: '8px'
                }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: theme.colors.text
                  }}>
                    {corridor}
                  </span>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: theme.colors.accentPurple
                  }}>
                    {count}
                  </span>
                </div>
              ))
            )}
          </DashboardWidget>
        );

      case 'eventTypes':
        return (
          <DashboardWidget
            key={widgetId}
            title={widgetConfig.name}
            icon={widgetConfig.icon}
            size={widgetConfig.size}
            onRemove={handleRemove}
          >
            {stats.topEventTypes.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: theme.colors.textSecondary,
                padding: theme.spacing.lg
              }}>
                No event type data available
              </div>
            ) : (
              stats.topEventTypes.map(([type, count]) => (
                <div key={type} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: theme.spacing.sm,
                  background: theme.colors.glassLight,
                  borderRadius: '8px'
                }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: theme.colors.text
                  }}>
                    {type}
                  </span>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: theme.colors.accentBlue
                  }}>
                    {count}
                  </span>
                </div>
              ))
            )}
          </DashboardWidget>
        );

      case 'recentActivity':
        return (
          <DashboardWidget
            key={widgetId}
            title={widgetConfig.name}
            icon={widgetConfig.icon}
            size={widgetConfig.size}
            onRemove={handleRemove}
          >
            {stats.recentEvents.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: theme.colors.textSecondary,
                padding: theme.spacing.lg
              }}>
                No recent events
              </div>
            ) : (
              stats.recentEvents.map((event, idx) => {
                const severity = (event.severity || event.severityLevel || 'medium').toString().toLowerCase();
                const severityColor = severity === 'high' || severity === 'major' ? theme.colors.error.main :
                                     severity === 'medium' || severity === 'moderate' ? theme.colors.warning.main :
                                     theme.colors.success.main;

                return (
                  <div key={event.id || idx} style={{
                    padding: theme.spacing.sm,
                    background: theme.colors.glassLight,
                    borderRadius: '8px',
                    borderLeft: `4px solid ${severityColor}`
                  }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: theme.colors.text,
                      marginBottom: '4px'
                    }}>
                      {event.eventType || 'Unknown'}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {event.location || event.description || 'No description'}
                    </div>
                  </div>
                );
              })
            )}
          </DashboardWidget>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      width: '100%',
      padding: theme.spacing.lg,
      position: 'relative'
    }}>
      {/* Header with Config Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.lg
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: '700',
          color: theme.colors.text
        }}>
          Dashboard
        </h2>

        <button
          onClick={() => setShowConfig(!showConfig)}
          style={{
            padding: '8px 16px',
            background: showConfig ? theme.colors.accentBlue : theme.colors.glassDark,
            color: showConfig ? 'white' : theme.colors.text,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: `all ${theme.transitions.fast}`,
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm
          }}
          onMouseEnter={(e) => {
            if (!showConfig) {
              e.currentTarget.style.background = theme.colors.glassLight;
            }
          }}
          onMouseLeave={(e) => {
            if (!showConfig) {
              e.currentTarget.style.background = theme.colors.glassDark;
            }
          }}
        >
          <span>⚙️</span>
          Customize Widgets
        </button>
      </div>

      {/* Widget Configuration Panel */}
      {showConfig && (
        <div style={{
          marginBottom: theme.spacing.lg,
          padding: theme.spacing.md,
          background: theme.colors.glassDark,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '12px',
          backdropFilter: 'blur(20px)'
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: theme.spacing.sm
          }}>
            Available Widgets
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: theme.spacing.sm
          }}>
            {availableWidgets.map(widget => (
              <button
                key={widget.id}
                onClick={() => toggleWidget(widget.id)}
                style={{
                  padding: theme.spacing.sm,
                  background: visibleWidgets.includes(widget.id) ? theme.colors.accentBlue : theme.colors.glassLight,
                  color: visibleWidgets.includes(widget.id) ? 'white' : theme.colors.text,
                  border: `1px solid ${visibleWidgets.includes(widget.id) ? theme.colors.accentBlue : theme.colors.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: `all ${theme.transitions.fast}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  if (!visibleWidgets.includes(widget.id)) {
                    e.currentTarget.style.background = `${theme.colors.accentBlue}20`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!visibleWidgets.includes(widget.id)) {
                    e.currentTarget.style.background = theme.colors.glassLight;
                  }
                }}
              >
                <span>{widget.icon}</span>
                {widget.name}
                {visibleWidgets.includes(widget.id) && <span style={{ marginLeft: 'auto' }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Widgets Grid */}
      {visibleWidgets.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: theme.colors.textSecondary
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
            No widgets active
          </div>
          <div style={{ fontSize: '14px' }}>
            Click "Customize Widgets" to add widgets to your dashboard
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: theme.spacing.lg,
          width: '100%'
        }}>
          {visibleWidgets.map(widgetId => renderWidget(widgetId))}
        </div>
      )}
    </div>
  );
}

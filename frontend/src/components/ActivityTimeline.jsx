import { useState, useMemo } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { theme } from '../styles/theme';

export default function ActivityTimeline({ events, messages = {} }) {
  const [filter, setFilter] = useState('all'); // 'all', 'events', 'messages', 'updates'
  const [timeRange, setTimeRange] = useState('24h'); // '1h', '6h', '24h', '7d', 'all'
  const [expanded, setExpanded] = useState({});

  // Generate activity items from events and messages
  const activityItems = useMemo(() => {
    const items = [];

    // Add events as activity items
    events.forEach(event => {
      if (event.startTime) {
        items.push({
          id: `event-${event.id}`,
          type: 'event_created',
          timestamp: new Date(event.startTime),
          event: event,
          icon: getEventTypeIcon(event.eventType),
          color: getSeverityColor(event.severity),
          title: `New ${event.eventType} Event`,
          description: event.location,
          details: event.description,
          metadata: {
            state: event.state,
            severity: event.severity,
            corridor: event.corridor
          }
        });
      }
    });

    // Add messages as activity items
    Object.entries(messages).forEach(([eventId, eventMessages]) => {
      const event = events.find(e => e.id === parseInt(eventId));
      if (event && eventMessages.length > 0) {
        eventMessages.forEach((msg, idx) => {
          if (msg.timestamp) {
            items.push({
              id: `message-${eventId}-${idx}`,
              type: 'message',
              timestamp: new Date(msg.timestamp),
              event: event,
              icon: '💬',
              color: theme.colors.accentBlue,
              title: `Message from ${msg.sender}`,
              description: msg.message,
              details: `Re: ${event.location}`,
              metadata: {
                sender: msg.sender,
                eventType: event.eventType
              }
            });
          }
        });
      }
    });

    // Sort by timestamp (most recent first)
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [events, messages]);

  // Filter by time range
  const timeFilteredItems = useMemo(() => {
    const now = new Date();
    const cutoffs = {
      '1h': 1000 * 60 * 60,
      '6h': 1000 * 60 * 60 * 6,
      '24h': 1000 * 60 * 60 * 24,
      '7d': 1000 * 60 * 60 * 24 * 7,
      'all': Infinity
    };

    const cutoffTime = now - cutoffs[timeRange];
    return activityItems.filter(item => item.timestamp >= cutoffTime);
  }, [activityItems, timeRange]);

  // Filter by activity type
  const filteredItems = useMemo(() => {
    if (filter === 'all') return timeFilteredItems;
    if (filter === 'events') return timeFilteredItems.filter(item => item.type === 'event_created');
    if (filter === 'messages') return timeFilteredItems.filter(item => item.type === 'message');
    return timeFilteredItems;
  }, [timeFilteredItems, filter]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups = {};
    filteredItems.forEach(item => {
      const dateKey = format(item.timestamp, 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: item.timestamp,
          items: []
        };
      }
      groups[dateKey].items.push(item);
    });
    return Object.values(groups).sort((a, b) => b.date - a.date);
  }, [filteredItems]);

  const toggleExpanded = (itemId) => {
    setExpanded(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'white'
    }}>
      {/* Header */}
      <div style={{
        padding: theme.spacing.md,
        borderBottom: `2px solid ${theme.colors.border}`,
        background: theme.colors.glassDark,
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: theme.spacing.md
        }}>
          📜 Activity Timeline
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: theme.spacing.sm,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {/* Type Filter */}
          <div style={{ display: 'flex', gap: theme.spacing.xs }}>
            {[
              { value: 'all', label: 'All', icon: '🔍' },
              { value: 'events', label: 'Events', icon: '📍' },
              { value: 'messages', label: 'Messages', icon: '💬' }
            ].map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: filter === value ? `2px solid ${theme.colors.accentBlue}` : `1px solid ${theme.colors.border}`,
                  background: filter === value ? `${theme.colors.accentBlue}20` : 'white',
                  color: filter === value ? theme.colors.accentBlue : theme.colors.text,
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: `all ${theme.transitions.fast}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Time Range Filter */}
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: theme.spacing.xs
          }}>
            {[
              { value: '1h', label: '1h' },
              { value: '6h', label: '6h' },
              { value: '24h', label: '24h' },
              { value: '7d', label: '7d' },
              { value: 'all', label: 'All' }
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTimeRange(value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: timeRange === value ? `2px solid ${theme.colors.accentPurple}` : `1px solid ${theme.colors.border}`,
                  background: timeRange === value ? `${theme.colors.accentPurple}20` : 'white',
                  color: timeRange === value ? theme.colors.accentPurple : theme.colors.textSecondary,
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: `all ${theme.transitions.fast}`
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{
          marginTop: theme.spacing.sm,
          fontSize: '12px',
          color: theme.colors.textSecondary,
          fontWeight: '600'
        }}>
          Showing {filteredItems.length} {filteredItems.length === 1 ? 'activity' : 'activities'}
        </div>
      </div>

      {/* Timeline Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: theme.spacing.md
      }}>
        {filteredItems.length === 0 ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: theme.colors.textSecondary
          }}>
            <div style={{ fontSize: '64px', marginBottom: theme.spacing.md }}>⏱️</div>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: theme.spacing.xs }}>
              No activity found
            </div>
            <div style={{ fontSize: '14px' }}>
              Try adjusting your filters or time range
            </div>
          </div>
        ) : (
          groupedByDate.map((group) => (
            <div key={format(group.date, 'yyyy-MM-dd')} style={{ marginBottom: theme.spacing.lg }}>
              {/* Date Header */}
              <div style={{
                position: 'sticky',
                top: '120px',
                zIndex: 5,
                padding: '8px 12px',
                marginBottom: theme.spacing.md,
                background: theme.colors.glassDark,
                backdropFilter: 'blur(20px)',
                borderRadius: '12px',
                display: 'inline-block',
                fontSize: '12px',
                fontWeight: '700',
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                boxShadow: theme.shadows.sm
              }}>
                📅 {format(group.date, 'EEEE, MMMM d, yyyy')}
              </div>

              {/* Timeline Items */}
              <div style={{ position: 'relative' }}>
                {/* Vertical Line */}
                <div style={{
                  position: 'absolute',
                  left: '16px',
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  background: `linear-gradient(to bottom, ${theme.colors.border}, transparent)`,
                  zIndex: 0
                }} />

                {group.items.map((item, idx) => {
                  const isExpanded = expanded[item.id];

                  return (
                    <div
                      key={item.id}
                      style={{
                        position: 'relative',
                        paddingLeft: '48px',
                        marginBottom: theme.spacing.md
                      }}
                    >
                      {/* Timeline Dot */}
                      <div style={{
                        position: 'absolute',
                        left: '8px',
                        top: '8px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: item.color,
                        border: '3px solid white',
                        boxShadow: theme.shadows.md,
                        zIndex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px'
                      }}>
                        {item.icon}
                      </div>

                      {/* Activity Card */}
                      <div
                        onClick={() => item.details && toggleExpanded(item.id)}
                        style={{
                          background: theme.colors.glassLight,
                          border: `1px solid ${theme.colors.border}`,
                          borderLeft: `4px solid ${item.color}`,
                          borderRadius: '12px',
                          padding: theme.spacing.md,
                          cursor: item.details ? 'pointer' : 'default',
                          transition: `all ${theme.transitions.fast}`,
                          boxShadow: theme.shadows.sm
                        }}
                        onMouseEnter={(e) => {
                          if (item.details) {
                            e.currentTarget.style.boxShadow = theme.shadows.md;
                            e.currentTarget.style.transform = 'translateX(4px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (item.details) {
                            e.currentTarget.style.boxShadow = theme.shadows.sm;
                            e.currentTarget.style.transform = 'translateX(0)';
                          }
                        }}
                      >
                        {/* Header */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: theme.spacing.xs
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '700',
                              color: theme.colors.text,
                              marginBottom: '4px'
                            }}>
                              {item.title}
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: theme.colors.textSecondary,
                              lineHeight: '1.5'
                            }}>
                              {item.description}
                            </div>
                          </div>

                          <div style={{
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            marginLeft: theme.spacing.md
                          }}>
                            {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                          </div>
                        </div>

                        {/* Metadata Badges */}
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: theme.spacing.xs,
                          marginTop: theme.spacing.sm
                        }}>
                          {item.metadata.state && (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: `${theme.colors.accentBlue}15`,
                              color: theme.colors.accentBlue,
                              fontSize: '10px',
                              fontWeight: '700'
                            }}>
                              📍 {item.metadata.state}
                            </span>
                          )}
                          {item.metadata.severity && (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: `${item.color}20`,
                              color: item.color,
                              fontSize: '10px',
                              fontWeight: '700',
                              textTransform: 'uppercase'
                            }}>
                              {item.metadata.severity}
                            </span>
                          )}
                          {item.metadata.corridor && (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: `${theme.colors.accentPurple}15`,
                              color: theme.colors.accentPurple,
                              fontSize: '10px',
                              fontWeight: '700'
                            }}>
                              🛣️ {item.metadata.corridor}
                            </span>
                          )}
                          {item.metadata.sender && (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: `${theme.colors.gray[200]}`,
                              color: theme.colors.text,
                              fontSize: '10px',
                              fontWeight: '700'
                            }}>
                              👤 {item.metadata.sender}
                            </span>
                          )}
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && item.details && (
                          <div style={{
                            marginTop: theme.spacing.md,
                            paddingTop: theme.spacing.md,
                            borderTop: `1px solid ${theme.colors.border}`,
                            fontSize: '13px',
                            color: theme.colors.text,
                            lineHeight: '1.6',
                            animation: 'fadeIn 0.2s ease-out'
                          }}>
                            {item.details}
                          </div>
                        )}

                        {/* Expand Indicator */}
                        {item.details && (
                          <div style={{
                            marginTop: theme.spacing.xs,
                            fontSize: '11px',
                            color: theme.colors.accentBlue,
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {isExpanded ? '▲ Show less' : '▼ Show more'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function getEventTypeIcon(eventType) {
  const type = eventType?.toLowerCase() || '';
  if (type.includes('construction')) return '🚧';
  if (type.includes('closure')) return '🚫';
  if (type.includes('incident') || type.includes('crash')) return '⚠️';
  if (type.includes('weather')) return '🌧️';
  if (type.includes('restriction')) return '⛔';
  if (type.includes('maintenance')) return '🔧';
  return '📍';
}

function getSeverityColor(severity) {
  const normalized = severity?.toLowerCase() || '';
  if (normalized === 'high' || normalized === 'major') return '#dc2626';
  if (normalized === 'medium' || normalized === 'moderate') return '#f59e0b';
  if (normalized === 'low' || normalized === 'minor') return '#10b981';
  return '#6b7280';
}

import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { isNearBorder } from '../utils/borderProximity';

export default function MessagesPanel({ events = [], messages = {}, detourAlerts = [], filters = {}, onEventSelect, onClose }) {
  const [selectedCorridor, setSelectedCorridor] = useState('all');

  const normalizeCorridorKey = (value = '') => {
    if (!value) return '';
    const upper = value.toString().toUpperCase();
    const interstateMatch = upper.match(/I[\s-]?0*(\d+)/);
    if (interstateMatch) {
      return `I-${interstateMatch[1]}`;
    }
    return upper.trim();
  };

  const corridorMatches = (eventCorridor, filterCorridor) => {
    if (!filterCorridor || filterCorridor === 'all') return true;
    const normalizedFilter = normalizeCorridorKey(filterCorridor);
    if (!normalizedFilter) return true;

    const normalizedEvent = normalizeCorridorKey(eventCorridor);
    if (!normalizedEvent) return false;

    if (normalizedEvent === normalizedFilter) return true;

    return normalizedEvent.startsWith(normalizedFilter);
  };

  // Get events that have messages
  const eventsWithMessages = useMemo(() => {
    return events
      .filter(event => {
        const eventMessages = messages[event.id] || [];
        if (eventMessages.length === 0) return false;

        // Apply corridor filter
        if (selectedCorridor !== 'all' && !corridorMatches(event.corridor, selectedCorridor)) {
          return false;
        }

        // Apply other filters
        if (filters.state && event.state !== filters.state) return false;
        if (filters.eventType && event.eventType !== filters.eventType) return false;
        if (filters.severity && event.severity !== filters.severity) return false;

        return true;
      })
      .sort((a, b) => {
        // Sort by most recent message
        const aMessages = messages[a.id] || [];
        const bMessages = messages[b.id] || [];
        const aLatest = aMessages.length > 0 ? new Date(aMessages[aMessages.length - 1].timestamp) : new Date(0);
        const bLatest = bMessages.length > 0 ? new Date(bMessages[bMessages.length - 1].timestamp) : new Date(0);
        return bLatest - aLatest;
      });
  }, [events, messages, selectedCorridor, filters]);

  // Get unique corridors that have messages
  const corridorsWithMessages = useMemo(() => {
    const corridorMap = new Map();
    events.forEach(event => {
      const eventMessages = messages[event.id] || [];
      if (eventMessages.length > 0 && event.corridor && event.corridor !== 'Unknown') {
        const key = normalizeCorridorKey(event.corridor);
        if (!corridorMap.has(key)) {
          corridorMap.set(key, event.corridor);
        }
      }
    });

    const entries = Array.from(corridorMap.entries());

    entries.sort((a, b) => {
      const [keyA, labelA] = a;
      const [keyB, labelB] = b;
      const interstatePattern = /^I-(\d{1,2})$/;
      const aMatch = keyA.match(interstatePattern);
      const bMatch = keyB.match(interstatePattern);
      if (aMatch && bMatch) {
        return parseInt(aMatch[1], 10) - parseInt(bMatch[1], 10);
      }
      if (aMatch) return -1;
      if (bMatch) return 1;
      return labelA.localeCompare(labelB);
    });

    return entries;
  }, [events, messages]);

  const getSeverityColor = (severity) => {
    const colors = {
      high: '#fee2e2',
      medium: '#fed7aa',
      low: '#d1fae5'
    };
    return colors[severity] || colors.medium;
  };

  const getSeverityTextColor = (severity) => {
    const colors = {
      high: '#991b1b',
      medium: '#9a3412',
      low: '#065f46'
    };
    return colors[severity] || colors.medium;
  };

  console.log('MessagesPanel rendering with', events.length, 'events and', Object.keys(messages).length, 'message groups');

  return (
    <div style={{
      width: '350px',
      minWidth: '350px',
      height: '100%',
      backgroundColor: 'white',
      borderRight: '2px solid #3b82f6',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        backgroundcolor: '#6b7280',
        position: 'relative'
      }}>
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="mobile-close-btn"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#ef4444',
              color: '#111827',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              zIndex: 10
            }}
          >
            ✕
          </button>
        )}
        <h3 style={{
          margin: '0 0 12px 0',
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#111827'
        }}>
          💬 Active Messages
        </h3>

        {/* Corridor Filter */}
        <select
          value={selectedCorridor}
          onChange={(e) => setSelectedCorridor(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            backgroundColor: 'white'
          }}
        >
          <option value="all">All Corridors ({eventsWithMessages.length})</option>
          {corridorsWithMessages.map(([corridorKey, displayLabel]) => {
            const count = eventsWithMessages.filter(e => corridorMatches(e.corridor, corridorKey)).length;
            return (
              <option key={corridorKey} value={corridorKey}>
                {displayLabel} ({count})
              </option>
            );
          })}
        </select>
      </div>

      {detourAlerts.length > 0 && (
        <div style={{
          padding: '12px 16px',
          backgroundcolor: '#6b7280',
          borderBottom: '1px solid #fde68a'
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#92400e',
            marginBottom: '8px'
          }}>
            🚗 Detour Advisories ({detourAlerts.length})
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {detourAlerts.map(alert => {
              const relatedEvent = events.find(ev => ev.id === alert.eventId);
              return (
                <div key={alert.id} style={{
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundcolor: '#6b7280',
                  border: '1px solid #facc15'
                }}>
                  <div style={{ fontWeight: 600, color: '#b45309', marginBottom: '4px' }}>
                    {alert.interchangeName}
                  </div>
                  {alert.eventDescription && (
                    <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>
                      {alert.eventDescription}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#78350f' }}>
                    {alert.message}
                  </div>
                  {relatedEvent && (
                    <button
                      onClick={() => onEventSelect && onEventSelect(relatedEvent)}
                      style={{
                        marginTop: '8px',
                        padding: '6px 12px',
                        backgroundcolor: '#6b7280',
                        color: '#111827',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      View Event
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px'
      }}>
        {eventsWithMessages.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '14px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>
              No messages yet
            </div>
            <div>
              {selectedCorridor === 'all'
                ? 'Click on events to start coordinating'
                : `No messages on ${selectedCorridor}`}
            </div>
          </div>
        ) : (
          eventsWithMessages.map(event => {
            const eventMessages = messages[event.id] || [];
            const latestMessage = eventMessages[eventMessages.length - 1];
            const borderInfo = isNearBorder(event);

            return (
              <div
                key={event.id}
                onClick={() => onEventSelect(event)}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundcolor: '#6b7280',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  borderLeft: borderInfo && borderInfo.nearBorder ? '4px solid #6366f1' : '1px solid #e5e7eb',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  ':hover': {
                    backgroundcolor: '#6b7280',
                    borderColor: '#3b82f6'
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Event Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '8px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#111827'
                      }}>
                        {event.corridor}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: getSeverityColor(event.severity),
                        color: getSeverityTextColor(event.severity),
                        fontSize: '11px',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        {event.severity}
                      </span>
                      {borderInfo && borderInfo.nearBorder && (
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#e0e7ff',
                          color: '#4338ca',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          borderLeft: '2px solid #6366f1'
                        }} title={`${borderInfo.distance} miles from ${borderInfo.borderName}`}>
                          🔵 Border
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6b7280'
                    }}>
                      {event.state} • {event.eventType}
                    </div>
                  </div>
                  {event.requiresCollaboration && (
                    <span style={{
                      fontSize: '18px',
                      lineHeight: 1
                    }} title="Cross-state collaboration">
                      🤝
                    </span>
                  )}
                </div>

                {/* Location */}
                <div style={{
                  fontSize: '13px',
                  color: '#374151',
                  marginBottom: '8px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {event.location}
                </div>

                {/* Latest Message Preview */}
                {latestMessage && (
                  <div style={{
                    padding: '8px',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#3b82f6',
                      marginBottom: '4px'
                    }}>
                      {latestMessage.sender}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#4b5563',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {latestMessage.message}
                    </div>
                  </div>
                )}

                {/* Message Count & Time */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px',
                  color: '#6b7280'
                }}>
                  <span style={{
                    backgroundColor: '#10b981',
                    color: '#111827',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 'bold'
                  }}>
                    {eventMessages.length} {eventMessages.length === 1 ? 'message' : 'messages'}
                  </span>
                  <span>
                    {latestMessage && formatDistanceToNow(new Date(latestMessage.timestamp), { addSuffix: true })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Stats */}
      {eventsWithMessages.length > 0 && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #e5e7eb',
          backgroundcolor: '#6b7280',
          fontSize: '12px',
          color: '#6b7280',
          textAlign: 'center'
        }}>
          Click a message to view on map
        </div>
      )}
    </div>
  );
}

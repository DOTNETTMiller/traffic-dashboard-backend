import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';

export default function EventTable({ events, messages = {}, onEventSelect }) {
  const [sortField, setSortField] = useState('startTime');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedEvents = useMemo(() => {
    const sorted = [...events].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'startTime') {
        aVal = new Date(aVal || 0);
        bVal = new Date(bVal || 0);
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [events, sortField, sortDirection]);

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

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span style={{ opacity: 0.3 }}>↕</span>;
    return <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: 'white' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14px'
      }}>
        <thead style={{
          position: 'sticky',
          top: 0,
          backgroundColor: '#f3f4f6',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          zIndex: 10
        }}>
          <tr>
            <th onClick={() => handleSort('requiresCollaboration')} style={headerStyle}>
              🤝 <SortIcon field="requiresCollaboration" />
            </th>
            <th onClick={() => handleSort('state')} style={headerStyle}>
              State <SortIcon field="state" />
            </th>
            <th onClick={() => handleSort('eventType')} style={headerStyle}>
              Type <SortIcon field="eventType" />
            </th>
            <th onClick={() => handleSort('severity')} style={headerStyle}>
              Severity <SortIcon field="severity" />
            </th>
            <th onClick={() => handleSort('location')} style={headerStyle}>
              Location <SortIcon field="location" />
            </th>
            <th style={headerStyle}>Description</th>
            <th onClick={() => handleSort('lanesAffected')} style={headerStyle}>
              Lanes <SortIcon field="lanesAffected" />
            </th>
            <th onClick={() => handleSort('direction')} style={headerStyle}>
              Direction <SortIcon field="direction" />
            </th>
            <th onClick={() => handleSort('startTime')} style={headerStyle}>
              Started <SortIcon field="startTime" />
            </th>
            <th style={headerStyle}>Messages</th>
            <th style={headerStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedEvents.map((event, index) => {
            const eventMessages = messages[event.id] || [];
            const messageCount = eventMessages.length;

            return (
            <tr
              key={event.id}
              style={{
                backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                cursor: 'pointer'
              }}
              onClick={() => onEventSelect && onEventSelect(event)}
            >
              <td style={cellStyle}>
                {event.requiresCollaboration && (
                  <span style={{
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    Cross-State
                  </span>
                )}
              </td>
              <td style={cellStyle}>{event.state}</td>
              <td style={cellStyle}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#dbeafe',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {event.eventType}
                </span>
              </td>
              <td style={cellStyle}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: getSeverityColor(event.severity),
                  color: getSeverityTextColor(event.severity),
                  fontSize: '12px',
                  fontWeight: '500',
                  textTransform: 'uppercase'
                }}>
                  {event.severity}
                </span>
              </td>
              <td style={cellStyle}>{event.location}</td>
              <td style={{ ...cellStyle, maxWidth: '300px' }}>
                {event.description}
              </td>
              <td style={cellStyle}>{event.lanesAffected}</td>
              <td style={cellStyle}>{event.direction}</td>
              <td style={cellStyle}>
                {event.startTime ? formatDistanceToNow(new Date(event.startTime), { addSuffix: true }) : 'Unknown'}
              </td>
              <td style={cellStyle}>
                {messageCount > 0 ? (
                  <span style={{
                    backgroundColor: '#10b981',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    💬 {messageCount}
                  </span>
                ) : (
                  <span style={{ color: '#9ca3af', fontSize: '12px' }}>—</span>
                )}
              </td>
              <td style={cellStyle}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventSelect && onEventSelect(event);
                  }}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: messageCount > 0 ? '#10b981' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {messageCount > 0 ? 'View' : 'Add'}
                </button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {events.length === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          No events found
        </div>
      )}
    </div>
  );
}

const headerStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: '600',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap'
};

const cellStyle = {
  padding: '12px 16px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

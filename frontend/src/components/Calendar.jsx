import { useState, useEffect } from 'react';
import { config } from '../config';

export default function Calendar({ authToken }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [rsvpStatus, setRsvpStatus] = useState({});
  const [timezone, setTimezone] = useState('America/Chicago');

  const timezones = [
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' }
  ];

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${config.apiUrl}/api/calendar/events`);
      if (!response.ok) throw new Error('Failed to load events');
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEventDetails = async (eventId) => {
    try {
      const [eventRes, artifactsRes] = await Promise.all([
        fetch(`${config.apiUrl}/api/calendar/events/${eventId}`),
        fetch(`${config.apiUrl}/api/calendar/events/${eventId}/artifacts`)
      ]);

      if (!eventRes.ok) throw new Error('Failed to load event details');

      const eventData = await eventRes.json();
      const artifactsData = artifactsRes.ok ? await artifactsRes.json() : { artifacts: [] };

      setSelectedEvent({
        ...eventData.event,
        artifacts: artifactsData.artifacts || []
      });
      setRsvpStatus(eventData.rsvpCounts || {});
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRSVP = async (eventId, response) => {
    if (!authToken) {
      alert('Please log in to RSVP');
      return;
    }

    try {
      const res = await fetch(`${config.apiUrl}/api/calendar/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ response })
      });

      if (!res.ok) throw new Error('Failed to submit RSVP');

      const data = await res.json();
      setRsvpStatus(data.rsvpCounts || {});
      alert('RSVP submitted successfully!');
    } catch (err) {
      alert('Error submitting RSVP: ' + err.message);
    }
  };

  const downloadICS = (eventId) => {
    window.open(`${config.apiUrl}/api/calendar/events/${eventId}/download.ics`, '_blank');
  };

  const downloadFullCalendar = () => {
    window.open(`${config.apiUrl}/api/calendar/i80-coalition.ics`, '_blank');
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short'
    });
  };

  const getEventTypeColor = (type) => {
    const colors = {
      'Technical Working Group': '#3b82f6',
      'Workshop': '#8b5cf6',
      'Coalition Update': '#10b981',
      'Working Group': '#f59e0b',
      'Summit': '#ef4444'
    };
    return colors[type] || '#6b7280';
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>Loading calendar events...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#ef4444' }}>Error: {error}</div>
        <button onClick={fetchEvents} style={{ marginTop: '20px', padding: '10px 20px' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>
            📅 I-80 Corridor Coalition Calendar
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            Stakeholder engagement meetings and technical working groups
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              🌍 Time Zone:
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {timezones.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={downloadFullCalendar}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            📥 Subscribe to Calendar
          </button>
        </div>
      </div>

      {/* Event Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedEvent ? '1fr 400px' : '1fr',
        gap: '20px'
      }}>
        {/* Events List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {events.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: '#f9fafb',
              borderRadius: '12px'
            }}>
              No upcoming events scheduled
            </div>
          ) : (
            events.map(event => (
              <div
                key={event.id}
                onClick={() => fetchEventDetails(event.id)}
                style={{
                  padding: '20px',
                  backgroundColor: 'white',
                  border: `2px solid ${selectedEvent?.id === event.id ? '#3b82f6' : '#e5e7eb'}`,
                  borderLeft: `6px solid ${getEventTypeColor(event.event_type)}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: selectedEvent?.id === event.id ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (selectedEvent?.id !== event.id) {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedEvent?.id !== event.id) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    minWidth: '60px',
                    textAlign: 'center',
                    padding: '8px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
                      {new Date(event.start_time).getDate()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>
                      {new Date(event.start_time).toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <h3 style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1f2937'
                      }}>
                        {event.title}
                      </h3>
                      {event.is_tentative && (
                        <span style={{
                          padding: '2px 8px',
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          fontSize: '11px',
                          fontWeight: '600',
                          borderRadius: '4px'
                        }}>
                          TENTATIVE
                        </span>
                      )}
                      {event.is_optional && (
                        <span style={{
                          padding: '2px 8px',
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                          fontSize: '11px',
                          fontWeight: '600',
                          borderRadius: '4px'
                        }}>
                          OPTIONAL
                        </span>
                      )}
                    </div>

                    <div style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      marginBottom: '8px'
                    }}>
                      📍 {event.location} • {event.event_type}
                    </div>

                    <div style={{ fontSize: '13px', color: '#374151' }}>
                      🕐 {formatDate(event.start_time)}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadICS(event.id);
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#f3f4f6',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    📥 Add
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Event Details Panel */}
        {selectedEvent && (
          <div style={{
            position: 'sticky',
            top: '20px',
            backgroundColor: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            padding: '24px',
            maxHeight: 'calc(100vh - 160px)',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '20px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '700',
                color: '#1f2937',
                flex: 1
              }}>
                {selectedEvent.title}
              </h2>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{
              padding: '12px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                📅 Date & Time
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                {formatDate(selectedEvent.start_time)}
              </div>
            </div>

            {selectedEvent.description && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>
                  Description
                </div>
                <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                  {selectedEvent.description}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>
                Location
              </div>
              <div style={{ fontSize: '14px', color: '#374151' }}>
                📍 {selectedEvent.location}
              </div>
            </div>

            {selectedEvent.virtual_link && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>
                  Virtual Meeting Link
                </div>
                <a
                  href={selectedEvent.virtual_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '14px', color: '#3b82f6' }}
                >
                  🔗 Join Meeting
                </a>
              </div>
            )}

            {/* RSVP Section */}
            {authToken && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>
                  RSVP
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleRSVP(selectedEvent.id, 'going')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    ✅ Going ({rsvpStatus.going || 0})
                  </button>
                  <button
                    onClick={() => handleRSVP(selectedEvent.id, 'maybe')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    🤔 Maybe ({rsvpStatus.maybe || 0})
                  </button>
                  <button
                    onClick={() => handleRSVP(selectedEvent.id, 'not_going')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    ❌ No ({rsvpStatus.not_going || 0})
                  </button>
                </div>
              </div>
            )}

            {selectedEvent.organizer_name && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>
                  Organizer
                </div>
                <div style={{ fontSize: '14px', color: '#374151' }}>
                  {selectedEvent.organizer_name}
                  {selectedEvent.organizer_email && (
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {selectedEvent.organizer_email}
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedEvent.recurrence_rule && (
              <div style={{
                padding: '12px',
                backgroundColor: '#eff6ff',
                borderLeft: '3px solid #3b82f6',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#1e40af',
                marginBottom: '20px'
              }}>
                🔄 {selectedEvent.recurrence_rule}
              </div>
            )}

            {/* Meeting Documents */}
            {selectedEvent.artifacts && selectedEvent.artifacts.length > 0 && (
              <div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>
                  Meeting Documents
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedEvent.artifacts.map(artifact => (
                    <a
                      key={artifact.id}
                      href={artifact.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>
                        {artifact.artifact_type === 'agenda' ? '📋' :
                         artifact.artifact_type === 'minutes' ? '📝' :
                         artifact.artifact_type === 'slides' ? '📊' :
                         artifact.artifact_type === 'recording' ? '🎥' : '📄'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                          {artifact.title}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {artifact.artifact_type.charAt(0).toUpperCase() + artifact.artifact_type.slice(1)}
                        </div>
                      </div>
                      <span style={{ fontSize: '18px', color: '#3b82f6' }}>→</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

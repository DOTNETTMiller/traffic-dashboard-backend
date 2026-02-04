import { useState, useEffect } from 'react';
import { config } from '../config';

export default function Calendar({ authToken, currentUser }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [rsvpStatus, setRsvpStatus] = useState({});
  const [timezone, setTimezone] = useState('America/Chicago');
  const [editingEvent, setEditingEvent] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showProgressTracker, setShowProgressTracker] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPastEvents, setShowPastEvents] = useState(false);

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

  const handleEditEvent = (event) => {
    setEditingEvent({
      ...event,
      start_time: event.start_time ? event.start_time.slice(0, 16) : '',
      end_time: event.end_time ? event.end_time.slice(0, 16) : ''
    });
    setShowEditForm(true);
  };

  const handleSaveEdit = async () => {
    if (!authToken) {
      alert('Please log in to edit events');
      return;
    }

    try {
      const eventData = {
        title: editingEvent.title,
        description: editingEvent.description,
        location: editingEvent.location,
        virtual_link: editingEvent.virtual_link,
        organizer_name: editingEvent.organizer_name,
        organizer_email: editingEvent.organizer_email,
        is_tentative: editingEvent.is_tentative,
        is_optional: editingEvent.is_optional
      };

      const response = await fetch(`${config.apiUrl}/api/calendar/events/${editingEvent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) throw new Error('Failed to update event');

      alert('Event updated successfully!');
      setShowEditForm(false);
      setEditingEvent(null);
      fetchEvents();

      // Refresh selected event details
      if (selectedEvent && selectedEvent.id === editingEvent.id) {
        fetchEventDetails(editingEvent.id);
      }
    } catch (err) {
      alert('Error updating event: ' + err.message);
    }
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

  const eventTypes = [
    'Technical Working Group',
    'Workshop',
    'Coalition Update',
    'Working Group',
    'Summit'
  ];

  // Filter and search events
  const filteredEvents = events.filter(event => {
    const now = new Date();
    const eventDate = new Date(event.start_time);

    // Filter by time (upcoming/past)
    if (!showPastEvents && eventDate < now) return false;
    if (showPastEvents && eventDate >= now) return false;

    // Filter by type
    if (filterType !== 'all' && event.event_type !== filterType) return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        event.title.toLowerCase().includes(query) ||
        (event.description && event.description.toLowerCase().includes(query)) ||
        event.location.toLowerCase().includes(query) ||
        event.event_type.toLowerCase().includes(query)
      );
    }

    return true;
  });

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
        alignItems: 'flex-start',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>
            📅 I-80 Corridor Coalition Calendar
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            Stakeholder engagement meetings and technical working groups
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
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

      {/* Filters and Search */}
      <div style={{
        backgroundColor: 'white',
        border: '2px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Search */}
        <div style={{ flex: '1 1 250px' }}>
          <input
            type="text"
            placeholder="🔍 Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Event Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>
            Event Type:
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              minWidth: '200px'
            }}
          >
            <option value="all">All Types</option>
            {eventTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Upcoming/Past Toggle */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowPastEvents(false)}
            style={{
              padding: '10px 16px',
              backgroundColor: !showPastEvents ? '#3b82f6' : '#f3f4f6',
              color: !showPastEvents ? 'white' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Upcoming
          </button>
          <button
            onClick={() => setShowPastEvents(true)}
            style={{
              padding: '10px 16px',
              backgroundColor: showPastEvents ? '#3b82f6' : '#f3f4f6',
              color: showPastEvents ? 'white' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Past
          </button>
        </div>

        {/* Results Count */}
        <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '600', whiteSpace: 'nowrap' }}>
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* I-80 Coalition Progress Dashboard */}
      <div style={{
        backgroundColor: 'white',
        border: '2px solid #3b82f6',
        borderRadius: '12px',
        marginBottom: '20px',
        overflow: 'hidden'
      }}>
        {/* Collapsible Header */}
        <div
          onClick={() => setShowProgressTracker(!showProgressTracker)}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: showProgressTracker ? 'white' : '#f9fafb',
            transition: 'background-color 0.2s'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1f2937' }}>
            🎯 I-80 Coalition Progress Tracker
          </h2>
          <span style={{ fontSize: '20px', color: '#6b7280' }}>
            {showProgressTracker ? '▼' : '▶'}
          </span>
        </div>

        {showProgressTracker && (
          <div style={{ padding: '0 20px 20px 20px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {/* Current Tasks */}
          <div style={{
            backgroundColor: '#eff6ff',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', color: '#1e40af' }}>
              📋 Active Tasks
            </h3>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#1f2937', lineHeight: '1.6' }}>
              <li>Complete SDX trial onboarding (9/11 states connected)</li>
              <li>Nevada SMART Grant RFP release (pending federal approval)</li>
              <li>Pooled Fund TPF-5(566) participation (TX, OK committed)</li>
              <li>MDODE platform prototype participation</li>
              <li>WZDx feed implementation (OH, PA in progress)</li>
              <li>11 minimum data fields standardization across states</li>
            </ul>
          </div>

          {/* Key Goals */}
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '2px solid #10b981',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', color: '#065f46' }}>
              🎯 2025-2026 Goals
            </h3>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#1f2937', lineHeight: '1.6' }}>
              <li><strong>Data Standardization:</strong> WZDx, TPIMS, TDx alignment across corridor</li>
              <li><strong>SDX Integration:</strong> All 11 states connected to real-time exchange</li>
              <li><strong>SMART Grant:</strong> $2M Nevada implementation (7 tasks)</li>
              <li><strong>Connected Corridor:</strong> Coast-to-coast V2X messaging (SAE J2735)</li>
              <li><strong>Truck Parking:</strong> ELD data integration, corridor-wide availability</li>
              <li><strong>Industry Integration:</strong> OEM partnerships, Google/Waze feeds</li>
            </ul>
          </div>

          {/* Achievements */}
          <div style={{
            backgroundColor: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', color: '#92400e' }}>
              ✅ Recent Achievements
            </h3>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#1f2937', lineHeight: '1.6' }}>
              <li>Illinois DOT connected to SDX with WZDx feed</li>
              <li>Wyoming successfully deployed SDX statewide</li>
              <li>Nevada SMART Grant awarded ($2M)</li>
              <li>Pooled Fund solicitation approved through Dec 2025</li>
              <li>181 data field variables identified and cataloged</li>
              <li>NCHRP CAV Peer Exchange insights integrated</li>
              <li>Ohio DOT WZDx feed launched (partnership with DriveWise)</li>
            </ul>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{
          marginTop: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>11</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>States in Coalition</div>
          </div>
          <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>9/11</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>SDX Trial Participants</div>
          </div>
          <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>$2M</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>SMART Grant (NV)</div>
          </div>
          <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#8b5cf6' }}>181</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Data Fields Cataloged</div>
          </div>
        </div>
          </div>
        )}
      </div>

      {/* Event Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedEvent ? '1fr 400px' : '1fr',
        gap: '20px'
      }}>
        {/* Events List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredEvents.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: '#f9fafb',
              borderRadius: '12px'
            }}>
              {searchQuery || filterType !== 'all'
                ? 'No events match your filters'
                : showPastEvents
                ? 'No past events found'
                : 'No upcoming events scheduled'}
            </div>
          ) : (
            filteredEvents.map(event => (
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

        {/* Edit Event Form */}
        {showEditForm && editingEvent && (
          <div style={{
            position: 'sticky',
            top: '20px',
            backgroundColor: 'white',
            border: '2px solid #3b82f6',
            borderRadius: '12px',
            padding: '24px',
            maxHeight: 'calc(100vh - 160px)',
            overflowY: 'auto'
          }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '700' }}>
              ✏️ Edit Event
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                  Event Title
                </label>
                <input
                  type="text"
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                  Description
                </label>
                <textarea
                  value={editingEvent.description || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Location */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                  Location
                </label>
                <input
                  type="text"
                  value={editingEvent.location}
                  onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Virtual Link */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                  Virtual Meeting Link
                </label>
                <input
                  type="url"
                  value={editingEvent.virtual_link || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, virtual_link: e.target.value })}
                  placeholder="https://teams.microsoft.com/..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Organizer Name */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                  Organizer Name
                </label>
                <input
                  type="text"
                  value={editingEvent.organizer_name || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, organizer_name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Organizer Email */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                  Organizer Email
                </label>
                <input
                  type="email"
                  value={editingEvent.organizer_email || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, organizer_email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Flags */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingEvent.is_tentative || false}
                    onChange={(e) => setEditingEvent({ ...editingEvent, is_tentative: e.target.checked })}
                  />
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Tentative</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingEvent.is_optional || false}
                    onChange={(e) => setEditingEvent({ ...editingEvent, is_optional: e.target.checked })}
                  />
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Optional</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={handleSaveEdit}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  💾 Save Changes
                </button>
                <button
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingEvent(null);
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Event Details Panel */}
        {selectedEvent && !showEditForm && (
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
              <div style={{ display: 'flex', gap: '8px' }}>
                {authToken && (
                  <button
                    onClick={() => handleEditEvent(selectedEvent)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                  >
                    ✏️ Edit
                  </button>
                )}
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

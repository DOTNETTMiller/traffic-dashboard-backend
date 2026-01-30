import { useState, useEffect } from 'react';
import { config } from '../config';

export default function CalendarAdmin({ authToken }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const eventTypes = [
    'Technical Working Group',
    'Workshop',
    'Coalition Update',
    'Working Group',
    'Summit'
  ];

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

  const handleEdit = (event) => {
    setEditingEvent({
      ...event,
      start_time: event.start_time ? event.start_time.slice(0, 16) : '',
      end_time: event.end_time ? event.end_time.slice(0, 16) : ''
    });
    setShowCreateForm(false);
  };

  const handleCreate = () => {
    setEditingEvent({
      title: '',
      description: '',
      event_type: 'Technical Working Group',
      start_time: '',
      end_time: '',
      timezone: 'America/Chicago',
      location: 'Virtual Meeting',
      virtual_link: '',
      organizer_name: 'I-80 Corridor Coalition',
      organizer_email: '',
      corridor: 'I-80',
      workstream: 'General',
      is_tentative: false,
      is_optional: false,
      recurrence_rule: ''
    });
    setShowCreateForm(true);
  };

  const handleSave = async () => {
    if (!editingEvent) return;

    try {
      const eventData = {
        ...editingEvent,
        start_time: editingEvent.start_time.replace('T', ' ') + ':00',
        end_time: editingEvent.end_time.replace('T', ' ') + ':00'
      };

      const url = showCreateForm
        ? `${config.apiUrl}/api/calendar/events`
        : `${config.apiUrl}/api/calendar/events/${editingEvent.id}`;

      const method = showCreateForm ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) throw new Error('Failed to save event');

      alert(showCreateForm ? 'Event created successfully!' : 'Event updated successfully!');
      setEditingEvent(null);
      setShowCreateForm(false);
      fetchEvents();
    } catch (err) {
      alert('Error saving event: ' + err.message);
    }
  };

  const handleDelete = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const response = await fetch(`${config.apiUrl}/api/calendar/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete event');

      alert('Event deleted successfully!');
      fetchEvents();
    } catch (err) {
      alert('Error deleting event: ' + err.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
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
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>
            📅 Calendar Admin
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            Manage I-80 Coalition calendar events, meeting links, and invitations
          </p>
        </div>
        <button
          onClick={handleCreate}
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
          ➕ Create Event
        </button>
      </div>

      {/* Event Edit Form */}
      {editingEvent && (
        <div style={{
          backgroundColor: 'white',
          border: '2px solid #3b82f6',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '700' }}>
            {showCreateForm ? '➕ Create New Event' : '✏️ Edit Event'}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Title */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                Event Title *
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

            {/* Event Type */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                Event Type *
              </label>
              <select
                value={editingEvent.event_type}
                onChange={(e) => setEditingEvent({ ...editingEvent, event_type: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                {eventTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                Location *
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

            {/* Start Time */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                Start Time *
              </label>
              <input
                type="datetime-local"
                value={editingEvent.start_time}
                onChange={(e) => setEditingEvent({ ...editingEvent, start_time: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* End Time */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                End Time *
              </label>
              <input
                type="datetime-local"
                value={editingEvent.end_time}
                onChange={(e) => setEditingEvent({ ...editingEvent, end_time: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Timezone */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                Time Zone *
              </label>
              <select
                value={editingEvent.timezone}
                onChange={(e) => setEditingEvent({ ...editingEvent, timezone: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                {timezones.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
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

            {/* Description */}
            <div style={{ gridColumn: '1 / -1' }}>
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

            {/* Recurrence Rule */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                Recurrence Rule (e.g., "Monthly on 4th Thursday")
              </label>
              <input
                type="text"
                value={editingEvent.recurrence_rule || ''}
                onChange={(e) => setEditingEvent({ ...editingEvent, recurrence_rule: e.target.value })}
                placeholder="Future meetings: 4th Thursday monthly, 12:30-2pm PT"
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
          </div>

          {/* Action Buttons */}
          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSave}
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
              💾 Save Event
            </button>
            <button
              onClick={() => {
                setEditingEvent(null);
                setShowCreateForm(false);
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
      )}

      {/* Events Table */}
      <div style={{
        backgroundColor: 'white',
        border: '2px solid #e5e7eb',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '700' }}>Event</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '700' }}>Type</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '700' }}>Start Time</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '700' }}>Location</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '700' }}>Link</th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '700' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  No events found. Click "Create Event" to add one.
                </td>
              </tr>
            ) : (
              events.map(event => (
                <tr key={event.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px', fontSize: '14px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '2px' }}>{event.title}</div>
                    {event.is_tentative && (
                      <span style={{
                        padding: '2px 6px',
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        fontSize: '11px',
                        fontWeight: '600',
                        borderRadius: '4px',
                        marginRight: '4px'
                      }}>
                        TENTATIVE
                      </span>
                    )}
                    {event.is_optional && (
                      <span style={{
                        padding: '2px 6px',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        fontSize: '11px',
                        fontWeight: '600',
                        borderRadius: '4px'
                      }}>
                        OPTIONAL
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: '#6b7280' }}>
                    {event.event_type}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: '#374151' }}>
                    {formatDate(event.start_time)}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: '#6b7280' }}>
                    {event.location}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px' }}>
                    {event.virtual_link ? (
                      <a
                        href={event.virtual_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#3b82f6', textDecoration: 'none' }}
                      >
                        🔗 Link
                      </a>
                    ) : (
                      <span style={{ color: '#d1d5db' }}>No link</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleEdit(event)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        marginRight: '8px'
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

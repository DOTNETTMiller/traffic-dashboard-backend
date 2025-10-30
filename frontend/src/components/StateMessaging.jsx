import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { config } from '../config';
import '../styles/StateMessaging.css';

export default function StateMessaging({ user, authToken }) {
  const isAdmin = user?.role === 'admin';
  const userStateKey = user?.stateKey ? user.stateKey.toLowerCase() : '';
  const [states, setStates] = useState([]);
  const [stateName, setStateName] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toState, setToState] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('normal');
  const [eventId, setEventId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedMessageId, setExpandedMessageId] = useState(null);

  const isAuthenticated = Boolean(authToken && (userStateKey || isAdmin));
  const authHeaders = useMemo(() => (
    authToken
      ? { Authorization: `Bearer ${authToken}` }
      : {}
  ), [authToken]);

  // Load available states (for recipient selection and state name display)
  useEffect(() => {
    const loadStates = async () => {
      try {
        const response = await axios.get(`${config.apiUrl}/api/states/list`);
        if (response.data.success) {
          setStates(response.data.states);
        }
      } catch (err) {
        console.error('Error loading states:', err);
      }
    };

    loadStates();
  }, []);

  // Resolve the friendly state name once we know the user's state
  useEffect(() => {
    if (!states.length || (!userStateKey && !isAdmin)) {
      setStateName('');
      return;
    }

    const match = states.find((state) => state.stateKey.toLowerCase() === userStateKey);
    setStateName(match?.stateName || '');
  }, [states, userStateKey]);

  // Load inbox/sent when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setInbox([]);
      setSent([]);
      setUnreadCount(0);
      return;
    }

    loadInbox();
    loadSent();

    const interval = setInterval(() => {
      loadInbox();
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authToken, userStateKey]);

  const handleApiError = (err, fallback) => {
    console.error(fallback, err);
    const apiMessage = err.response?.data?.error || err.message || fallback;
    setError(apiMessage);
    setTimeout(() => setError(''), 4000);
  };

  const loadInbox = async () => {
    if (!isAuthenticated) return;

    try {
      const response = await axios.get(`${config.apiUrl}/api/states/inbox`, {
        headers: authHeaders
      });

      if (response.data.success) {
        const sortedMessages = [...response.data.messages].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setInbox(sortedMessages);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (err) {
      // If the token is invalid, prompt the user to re-authenticate via main login
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired. Please log in again.');
      } else {
        handleApiError(err, 'Error loading inbox');
      }
    }
  };

  const loadSent = async () => {
    if (!isAuthenticated) return;

    try {
      const response = await axios.get(`${config.apiUrl}/api/states/sent`, {
        headers: authHeaders
      });

      if (response.data.success) {
        const sortedMessages = [...response.data.messages].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setSent(sortedMessages);
      }
    } catch (err) {
      handleApiError(err, 'Error loading sent messages');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      setError('Session expired. Please log in again.');
      return;
    }

    if (!toState) {
      setError('Please select a recipient state.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await axios.post(
        `${config.apiUrl}/api/states/messages`,
        {
          toState,
          subject,
          message,
          priority,
          eventId: eventId || null
        },
        {
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        setSuccess('Message sent successfully!');
        setToState('');
        setSubject('');
        setMessage('');
        setPriority('normal');
        setEventId('');
        loadSent();
        setTimeout(() => setActiveTab('sent'), 800);
      }
    } catch (err) {
      handleApiError(err, 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId) => {
    if (!isAuthenticated) return;

    try {
      await axios.post(
        `${config.apiUrl}/api/states/messages/${messageId}/read`,
        {},
        { headers: authHeaders }
      );
      loadInbox();
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  };

  const handleDelete = async (messageId, isEventComment) => {
    if (!isAuthenticated) return;
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      const endpoint = isEventComment
        ? `${config.apiUrl}/api/events/comments/${messageId}`
        : `${config.apiUrl}/api/states/messages/${messageId}`;

      await axios.delete(endpoint, { headers: authHeaders });

      loadSent();
      setSuccess('Message deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
      window.dispatchEvent(new Event('messageDeleted'));
    } catch (err) {
      handleApiError(err, 'Failed to delete message');
    }
  };

  const handleClearDetourAdvisories = async () => {
    if (!window.confirm('Are you sure you want to clear all detour advisory messages? This cannot be undone.')) {
      return;
    }

    try {
      const response = await axios.delete(
        `${config.apiUrl}/api/states/messages/bulk/detour-advisories`,
        { headers: authHeaders }
      );

      if (response.data.success) {
        setSuccess(`Cleared ${response.data.deletedCount} detour advisory messages`);
        setTimeout(() => setSuccess(''), 3000);
        loadInbox(); // Refresh inbox
      }
    } catch (err) {
      handleApiError(err, 'Failed to clear detour advisories');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    return date.toLocaleString('en-US', options);
  };

  if (!user) {
    return (
      <div className="state-messaging">
        <div className="login-container">
          <h2>Sign In Required</h2>
          <p>Please log in to access state messaging.</p>
        </div>
      </div>
    );
  }

  if (!userStateKey) {
    return (
      <div className="state-messaging">
        <div className="login-container">
          <h2>State Messaging</h2>
          <p>Your account is not associated with a state yet. Contact an administrator to assign one so you can send and receive messages.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="state-messaging">
        <div className="login-container">
          <h2>State Messaging</h2>
          <p>Your session has expired. Please log out and log back in to continue.</p>
        </div>
      </div>
    );
  }

  const recipientStates = states.filter((state) => state.stateKey !== userStateKey);

  return (
    <div className="state-messaging">
      <div className="header">
        <div>
          <h2>State Messaging</h2>
          <p>
            Signed in as <strong>{stateName || userStateKey.toUpperCase()}</strong>
            {unreadCount > 0 && (
              <span className="badge">{unreadCount} unread</span>
            )}
          </p>
        </div>
        <div className="tab-buttons">
          <button
            className={activeTab === 'inbox' ? 'active' : ''}
            onClick={() => setActiveTab('inbox')}
          >
            Inbox
          </button>
          <button
            className={activeTab === 'sent' ? 'active' : ''}
            onClick={() => setActiveTab('sent')}
          >
            Sent
          </button>
          <button
            className={activeTab === 'compose' ? 'active' : ''}
            onClick={() => setActiveTab('compose')}
          >
            Compose
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {activeTab === 'inbox' && (
        <div className="messages-list">
          {inbox.some(msg => msg.subject?.includes('Detour Advisory')) && (
            <div style={{ padding: '12px', marginBottom: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #fbbf24' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#92400e' }}>🚗 Detour Advisories</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#78350f' }}>
                    {inbox.filter(msg => msg.subject?.includes('Detour Advisory')).length} detour advisory messages
                  </p>
                </div>
                <button
                  onClick={handleClearDetourAdvisories}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#b91c1c'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#dc2626'}
                >
                  Clear All Detour Advisories
                </button>
              </div>
            </div>
          )}
          {inbox.length === 0 ? (
            <p className="empty-state">No messages in your inbox.</p>
          ) : (
            inbox.map((msg) => (
              <div key={msg.id} className={`message-card ${msg.read ? '' : 'unread'}`}>
                <div className="message-header" onClick={() => setExpandedMessageId(msg.id === expandedMessageId ? null : msg.id)}>
                  <div className="message-meta">
                    <span className="message-state">From {msg.from_state_name || msg.from_state}</span>
                    <span className="message-subject">{msg.subject || 'No subject'}</span>
                  </div>
                  <div className="message-meta">
                    <span className="message-priority">{msg.priority?.toUpperCase()}</span>
                    <span className="message-date">{formatDate(msg.created_at)}</span>
                  </div>
                </div>

                {expandedMessageId === msg.id && (
                  <div className="message-body">
                    <p>{msg.message}</p>
                    {msg.event_id && (
                      <p className="message-event">Related event: {msg.event_id}</p>
                    )}
                    {!msg.read && (
                      <button className="link-button" onClick={() => markAsRead(msg.id)}>
                        Mark as read
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'sent' && (
        <div className="messages-list">
          {sent.length === 0 ? (
            <p className="empty-state">You have not sent any messages yet.</p>
          ) : (
            sent.map((msg) => (
              <div key={msg.id} className="message-card">
                <div className="message-header" onClick={() => setExpandedMessageId(msg.id === expandedMessageId ? null : msg.id)}>
                  <div className="message-meta">
                    <span className="message-state">To {msg.to_state_name || msg.to_state}</span>
                    <span className="message-subject">{msg.subject || 'No subject'}</span>
                  </div>
                  <div className="message-meta">
                    <span className="message-priority">{msg.priority?.toUpperCase()}</span>
                    <span className="message-date">{formatDate(msg.created_at)}</span>
                  </div>
                </div>

                {expandedMessageId === msg.id && (
                  <div className="message-body">
                    <p>{msg.message}</p>
                    {msg.event_id && (
                      <p className="message-event">Related event: {msg.event_id}</p>
                    )}
                    <div className="message-actions">
                      <button className="link-button" onClick={() => handleDelete(msg.id, Boolean(msg.event_id))}>
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'compose' && (
        <div className="compose-form">
          <form onSubmit={handleSendMessage}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="toState">To State *</label>
                <select
                  id="toState"
                  value={toState}
                  onChange={(e) => setToState(e.target.value)}
                  required
                >
                  <option value="">Select a state...</option>
                  {recipientStates.map((state) => (
                    <option key={state.stateKey} value={state.stateKey}>
                      {state.stateName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input
                  type="text"
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief subject"
                />
              </div>

              <div className="form-group">
                <label htmlFor="priority">Priority</label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="eventId">Related Event ID (optional)</label>
                <input
                  type="text"
                  id="eventId"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  placeholder="e.g., NV-2024-00123"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="message">Message *</label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                placeholder="Type your message..."
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send Message'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setToState('');
                  setSubject('');
                  setMessage('');
                  setPriority('normal');
                  setEventId('');
                }}
              >
                Clear
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

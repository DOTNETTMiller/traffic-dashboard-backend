import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';
import '../styles/StateMessaging.css';

export default function StateMessaging() {
  // Authentication state
  const [stateKey, setStateKey] = useState('');
  const [password, setPassword] = useState('');
  const [stateName, setStateName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'sent', 'compose'
  const [states, setStates] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Compose form state
  const [toState, setToState] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('normal');
  const [eventId, setEventId] = useState('');

  // Status messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedMessageId, setExpandedMessageId] = useState(null);

  // Load states list on mount and auto-login based on user's state
  useEffect(() => {
    loadStates();

    // Auto-login if not already authenticated
    if (!isAuthenticated) {
      autoLogin();
    }
  }, []);

  const autoLogin = async () => {
    try {
      // Get user's state_key from their user account
      const user = localStorage.getItem('user');
      console.log('🔐 Auto-login attempting with user:', user);

      if (user) {
        const userData = JSON.parse(user);
        console.log('👤 User data:', userData);

        if (userData.stateKey) {
          // Auto-login with the default password
          const defaultPassword = 'ccai2026';

          console.log('🔑 Attempting login for state:', userData.stateKey);
          const response = await axios.post(`${config.apiUrl}/api/states/login`, {
            stateKey: userData.stateKey.toLowerCase(),
            password: defaultPassword
          });

          console.log('📥 Login response:', response.data);

          if (response.data.success) {
            localStorage.setItem('stateKey', response.data.stateKey);
            localStorage.setItem('stateName', response.data.stateName);
            localStorage.setItem('statePassword', defaultPassword);
            setStateKey(response.data.stateKey);
            setStateName(response.data.stateName);
            setPassword(defaultPassword);
            setIsAuthenticated(true);
            console.log(`✅ Auto-logged in as ${response.data.stateName}`);
            console.log('💾 Stored in localStorage:', {
              stateKey: response.data.stateKey,
              stateName: response.data.stateName,
              hasPassword: true
            });
          }
        } else {
          console.log('❌ No stateKey in user data');
        }
      } else {
        console.log('❌ No user in localStorage');
      }
    } catch (error) {
      console.error('❌ Auto-login failed:', error);
      console.error('Error response:', error.response?.data);
    }
  };

  // Load messages when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadInbox();
      loadSent();
      // Refresh every 30 seconds
      const interval = setInterval(() => {
        loadInbox();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const loadStates = async () => {
    try {
      const response = await axios.get(`${config.apiUrl}/api/states/list`);
      if (response.data.success) {
        setStates(response.data.states);
      }
    } catch (error) {
      console.error('Error loading states:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${config.apiUrl}/api/states/login`, {
        stateKey: stateKey.toLowerCase(),
        password
      });

      if (response.data.success) {
        localStorage.setItem('stateKey', response.data.stateKey);
        localStorage.setItem('stateName', response.data.stateName);
        localStorage.setItem('statePassword', password);
        setStateName(response.data.stateName);
        setIsAuthenticated(true);
        setSuccess(`Welcome, ${response.data.stateName}!`);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('stateKey');
    localStorage.removeItem('stateName');
    localStorage.removeItem('statePassword');
    setStateKey('');
    setStateName('');
    setPassword('');
    setIsAuthenticated(false);
    setInbox([]);
    setSent([]);
    setUnreadCount(0);
  };

  const loadInbox = async () => {
    try {
      const storedStateKey = localStorage.getItem('stateKey');
      const storedPassword = localStorage.getItem('statePassword');

      if (!storedStateKey || !storedPassword) {
        handleLogout();
        return;
      }

      const response = await axios.get(`${config.apiUrl}/api/states/inbox`, {
        headers: {
          Authorization: `State ${storedStateKey}:${storedPassword}`
        }
      });

      if (response.data.success) {
        // Sort by created_at descending (newest first)
        const sortedMessages = [...response.data.messages].sort((a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
        );
        setInbox(sortedMessages);
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      // Don't show error if unauthorized - user might need to re-login
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleLogout();
      }
    }
  };

  const loadSent = async () => {
    try {
      const storedStateKey = localStorage.getItem('stateKey');
      const storedPassword = localStorage.getItem('statePassword');

      console.log('🔍 loadSent() called with:', { storedStateKey, hasPassword: !!storedPassword });

      if (!storedStateKey || !storedPassword) {
        console.log('❌ Missing credentials, returning');
        return;
      }

      const response = await axios.get(`${config.apiUrl}/api/states/sent`, {
        headers: {
          Authorization: `State ${storedStateKey}:${storedPassword}`
        }
      });

      console.log('📨 Sent messages response:', response.data);

      if (response.data.success) {
        console.log('✅ Setting sent messages:', response.data.messages.length, 'messages');
        console.log('📅 Message timestamps (original order):', response.data.messages.map(m => ({
          msg: m.message.substring(0, 20),
          time: m.created_at
        })));

        // Sort by created_at descending (newest first) to be sure
        const sortedMessages = [...response.data.messages].sort((a, b) => {
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          return timeB - timeA; // Newest first
        });

        console.log('📅 Message timestamps (after sort):', sortedMessages.map(m => ({
          msg: m.message.substring(0, 20),
          time: m.created_at
        })));

        setSent(sortedMessages);
      }
    } catch (error) {
      console.error('Error loading sent messages:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const storedStateKey = localStorage.getItem('stateKey');
      const storedPassword = localStorage.getItem('statePassword');

      if (!storedStateKey || !storedPassword) {
        setError('Authentication expired. Please log in again.');
        handleLogout();
        return;
      }

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
            Authorization: `State ${storedStateKey}:${storedPassword}`
          }
        }
      );

      if (response.data.success) {
        setSuccess('Message sent successfully!');
        // Reset form
        setToState('');
        setSubject('');
        setMessage('');
        setPriority('normal');
        setEventId('');
        // Refresh sent messages
        loadSent();
        // Switch to sent tab
        setTimeout(() => setActiveTab('sent'), 1000);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      const storedStateKey = localStorage.getItem('stateKey');
      const storedPassword = localStorage.getItem('statePassword');

      if (!storedStateKey || !storedPassword) {
        return;
      }

      await axios.post(
        `${config.apiUrl}/api/states/messages/${messageId}/read`,
        {},
        {
          headers: {
            Authorization: `State ${storedStateKey}:${storedPassword}`
          }
        }
      );

      loadInbox(); // Refresh inbox
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleDelete = async (messageId, isEventComment) => {
    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      const storedStateKey = localStorage.getItem('stateKey');
      const storedPassword = localStorage.getItem('statePassword');

      if (!storedStateKey || !storedPassword) {
        return;
      }

      // Determine which endpoint to use
      const endpoint = isEventComment
        ? `${config.apiUrl}/api/events/comments/${messageId}`
        : `${config.apiUrl}/api/states/messages/${messageId}`;

      await axios.delete(endpoint, {
        headers: {
          Authorization: `State ${storedStateKey}:${storedPassword}`
        }
      });

      // Refresh the sent messages list
      loadSent();
      setSuccess('Message deleted successfully');
      setTimeout(() => setSuccess(''), 3000);

      // Notify App.jsx to reload messages (for map view)
      window.dispatchEvent(new Event('messageDeleted'));
    } catch (error) {
      console.error('Error deleting message:', error);
      setError(error.response?.data?.error || 'Failed to delete message');
      setTimeout(() => setError(''), 3000);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);

    // Format as readable date/time using user's local timezone: "Oct 20, 3:40 PM"
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

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="state-messaging">
        <div className="login-container">
          <h2>State Login</h2>
          <p>Log in as your state to send and receive messages with other DOT agencies.</p>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="stateKey">State</label>
              <select
                id="stateKey"
                value={stateKey}
                onChange={(e) => setStateKey(e.target.value)}
                required
              >
                <option value="">Select your state...</option>
                {states.map(state => (
                  <option key={state.stateKey} value={state.stateKey}>
                    {state.stateName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter state password"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="login-help">
            <p>Don't have a password? Contact your system administrator to set up state access.</p>
          </div>
        </div>
      </div>
    );
  }

  // Main messaging interface
  return (
    <div className="state-messaging">
      {/* Header */}
      <div className="messaging-header">
        <div>
          <h2>State Messaging</h2>
          <p className="logged-in-as">Logged in as <strong>{stateName}</strong></p>
        </div>
        <button onClick={handleLogout} className="btn-logout">
          Logout
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Tabs */}
      <div className="messaging-tabs">
        <button
          className={activeTab === 'inbox' ? 'active' : ''}
          onClick={() => setActiveTab('inbox')}
        >
          Inbox {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
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

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'inbox' && (
          <div className="inbox">
            <h3>Inbox</h3>
            {inbox.length === 0 ? (
              <p className="empty-state">No messages in your inbox</p>
            ) : (
              <div className="messages-list">
                {inbox.map(msg => {
                  const isExpanded = expandedMessageId === msg.id;
                  return (
                    <div
                      key={msg.id}
                      className={`message-item ${msg.read ? 'read' : 'unread'}`}
                      onClick={() => {
                        if (!msg.read) markAsRead(msg.id);
                        setExpandedMessageId(isExpanded ? null : msg.id);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="message-header">
                        <span className="from">
                          From: <strong>{msg.from_state === stateKey ? 'Me' : msg.from_state.toUpperCase()}</strong>
                        </span>
                        <span className="time">{formatDate(msg.created_at)}</span>
                      </div>
                      <div className="message-subject">
                        {msg.priority === 'urgent' && <span className="priority-urgent">URGENT</span>}
                        {msg.priority === 'high' && <span className="priority-high">HIGH</span>}
                        {msg.subject}
                      </div>
                      <div className="message-preview">
                        {isExpanded ? msg.message : `${msg.message.substring(0, 100)}${msg.message.length > 100 ? '...' : ''}`}
                      </div>
                      {msg.event_id && (
                        <div className="message-meta">
                          Regarding Event: {msg.event_id}
                        </div>
                      )}
                      <div style={{
                        fontSize: '11px',
                        color: '#9ca3af',
                        marginTop: '8px',
                        textAlign: 'center'
                      }}>
                        {isExpanded ? 'Click to collapse' : 'Click to expand'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sent' && (
          <div className="sent">
            <h3>Sent Messages</h3>
            {sent.length === 0 ? (
              <p className="empty-state">No sent messages</p>
            ) : (
              <div className="messages-list">
                {sent.map(msg => {
                  const isExpanded = expandedMessageId === msg.id;
                  return (
                    <div
                      key={msg.id}
                      className="message-item read"
                      onClick={() => setExpandedMessageId(isExpanded ? null : msg.id)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      <div className="message-header">
                        <span className="to">
                          To: <strong>{msg.to_state === 'ALL' ? 'ALL STATES' : msg.to_state.toUpperCase()}</strong>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="time">{formatDate(msg.created_at)}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(msg.id, msg.isEventComment);
                            }}
                            style={{
                              padding: '4px 8px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}
                            onMouseOver={(e) => e.target.style.background = '#dc2626'}
                            onMouseOut={(e) => e.target.style.background = '#ef4444'}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="message-subject">
                        {msg.priority === 'urgent' && <span className="priority-urgent">URGENT</span>}
                        {msg.priority === 'high' && <span className="priority-high">HIGH</span>}
                        {msg.subject}
                      </div>
                      <div className="message-preview">
                        {isExpanded ? msg.message : `${msg.message.substring(0, 100)}${msg.message.length > 100 ? '...' : ''}`}
                      </div>
                      {msg.event_id && (
                        <div className="message-meta">
                          Regarding Event: {msg.event_id}
                        </div>
                      )}
                      <div style={{
                        fontSize: '11px',
                        color: '#9ca3af',
                        marginTop: '8px',
                        textAlign: 'center'
                      }}>
                        {isExpanded ? 'Click to collapse' : 'Click to expand'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'compose' && (
          <div className="compose">
            <h3>Compose Message</h3>
            <form onSubmit={handleSendMessage}>
              <div className="form-group">
                <label htmlFor="toState">To</label>
                <select
                  id="toState"
                  value={toState}
                  onChange={(e) => setToState(e.target.value)}
                  required
                >
                  <option value="">Select recipient...</option>
                  <option value="ALL">ALL STATES (Broadcast)</option>
                  <optgroup label="States">
                    {states
                      .filter(s => s.stateKey !== stateKey)
                      .map(state => (
                        <option key={state.stateKey} value={state.stateKey}>
                          {state.stateName}
                        </option>
                      ))}
                  </optgroup>
                </select>
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
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="eventId">Related Event ID (Optional)</label>
                <input
                  type="text"
                  id="eventId"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  placeholder="e.g., UT-12345"
                />
              </div>

              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input
                  type="text"
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Message subject"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={6}
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';
import '../styles/StateMessaging.css';

export default function StateMessaging() {
  // Authentication state
  const [stateKey, setStateKey] = useState(localStorage.getItem('stateKey') || '');
  const [password, setPassword] = useState('');
  const [stateName, setStateName] = useState(localStorage.getItem('stateName') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('stateKey'));

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

  // Load states list on mount
  useEffect(() => {
    loadStates();
  }, []);

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
        setStateName(response.data.stateName);
        setIsAuthenticated(true);
        setPassword(''); // Clear password
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
    setStateKey('');
    setStateName('');
    setIsAuthenticated(false);
    setInbox([]);
    setSent([]);
    setUnreadCount(0);
  };

  const loadInbox = async () => {
    try {
      const storedStateKey = localStorage.getItem('stateKey');
      const storedPassword = password || 'temp'; // We don't store password

      const response = await axios.get(`${config.apiUrl}/api/states/inbox`, {
        headers: {
          Authorization: `State ${storedStateKey}:${storedPassword}`
        }
      });

      if (response.data.success) {
        setInbox(response.data.messages);
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
      const storedPassword = password || 'temp';

      const response = await axios.get(`${config.apiUrl}/api/states/sent`, {
        headers: {
          Authorization: `State ${storedStateKey}:${storedPassword}`
        }
      });

      if (response.data.success) {
        setSent(response.data.messages);
      }
    } catch (error) {
      console.error('Error loading sent messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const storedStateKey = localStorage.getItem('stateKey');
      const storedPassword = password || 'temp';

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
      const storedPassword = password || 'temp';

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
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
                {inbox.map(msg => (
                  <div
                    key={msg.id}
                    className={`message-item ${msg.read ? 'read' : 'unread'}`}
                    onClick={() => !msg.read && markAsRead(msg.id)}
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
                    <div className="message-preview">{msg.message.substring(0, 100)}...</div>
                    {msg.event_id && (
                      <div className="message-meta">
                        Regarding Event: {msg.event_id}
                      </div>
                    )}
                  </div>
                ))}
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
                {sent.map(msg => (
                  <div key={msg.id} className="message-item read">
                    <div className="message-header">
                      <span className="to">
                        To: <strong>{msg.to_state === 'ALL' ? 'ALL STATES' : msg.to_state.toUpperCase()}</strong>
                      </span>
                      <span className="time">{formatDate(msg.created_at)}</span>
                    </div>
                    <div className="message-subject">
                      {msg.priority === 'urgent' && <span className="priority-urgent">URGENT</span>}
                      {msg.priority === 'high' && <span className="priority-high">HIGH</span>}
                      {msg.subject}
                    </div>
                    <div className="message-preview">{msg.message.substring(0, 100)}...</div>
                    {msg.event_id && (
                      <div className="message-meta">
                        Regarding Event: {msg.event_id}
                      </div>
                    )}
                  </div>
                ))}
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

import { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { useTrafficData } from './hooks/useTrafficData';
import { config } from './config';
import TrafficMap from './components/TrafficMap';
import EventTable from './components/EventTable';
import EventFilters from './components/EventFilters';
import EventMessaging from './components/EventMessaging';
import DataQualityReport from './components/DataQualityReport';
import FeedAlignment from './components/FeedAlignment';
import MessagesPanel from './components/MessagesPanel';
import StateAdmin from './components/StateAdmin';
import StateMessaging from './components/StateMessaging';
import UserLogin from './components/UserLogin';
import './styles/App.css';

function App() {
  const [view, setView] = useState('map'); // 'map', 'table', 'report', 'alignment', 'messages', or 'admin'
  const [filters, setFilters] = useState({
    state: '',
    corridor: '',
    eventType: '',
    severity: '',
    search: ''
  });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [messages, setMessages] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);

  // Check for existing authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setAuthToken(token);
        setCurrentUser(user);
        setIsAuthenticated(true);
        console.log('✅ Restored session for user:', user.username);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
        // Clear invalid data
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    } else {
      console.log('❌ No stored authentication found - showing login screen');
    }
  }, []);

  // Fetch traffic data with auto-refresh (60 seconds)
  const { events, loading, error, lastUpdate, refetch } = useTrafficData(
    autoRefresh ? 60000 : null
  );

  // Load messages from backend on mount
  useEffect(() => {
    loadMessagesFromAPI();

    // Listen for message deletion events from StateMessaging
    const handleMessageDeleted = () => {
      console.log('🔄 Message deleted, reloading messages...');
      loadMessagesFromAPI();
    };

    window.addEventListener('messageDeleted', handleMessageDeleted);

    return () => {
      window.removeEventListener('messageDeleted', handleMessageDeleted);
    };
  }, []);

  const loadMessagesFromAPI = async () => {
    try {
      setLoadingMessages(true);
      const messagesByEvent = {};

      // Load old-style messages
      try {
        const response = await axios.get(`${config.apiUrl}/api/messages`);
        if (response.data.success) {
          response.data.messages.forEach(msg => {
            if (!messagesByEvent[msg.eventId]) {
              messagesByEvent[msg.eventId] = [];
            }
            messagesByEvent[msg.eventId].push(msg);
          });
          console.log('💬 Loaded', response.data.count, 'old messages from server');
        }
      } catch (error) {
        console.error('Error loading old messages:', error);
      }

      // Load event comments
      try {
        const response = await axios.get(`${config.apiUrl}/api/events/comments/all`);
        if (response.data.success) {
          response.data.comments.forEach(comment => {
            if (!messagesByEvent[comment.event_id]) {
              messagesByEvent[comment.event_id] = [];
            }
            // Convert comment format to message format for MessagesPanel
            messagesByEvent[comment.event_id].push({
              id: comment.id,
              eventId: comment.event_id,
              sender: comment.state_name,
              message: comment.comment,
              timestamp: comment.created_at
            });
          });
          console.log('💬 Loaded', response.data.comments.length, 'event comments from server');
        }
      } catch (error) {
        console.error('Error loading event comments:', error);
      }

      setMessages(messagesByEvent);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Filter events based on active filters
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // State filter
      if (filters.state && event.state !== filters.state) return false;

      // Corridor filter
      if (filters.corridor && event.corridor !== filters.corridor) return false;

      // Event type filter
      if (filters.eventType && event.eventType !== filters.eventType) return false;

      // Severity filter
      if (filters.severity && event.severity !== filters.severity) return false;

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableText = [
          event.location,
          event.description,
          event.state,
          event.corridor
        ].join(' ').toLowerCase();

        if (!searchableText.includes(searchLower)) return false;
      }

      return true;
    });
  }, [events, filters]);

  const handleSendMessage = async (message) => {
    try {
      // Save to backend
      const response = await axios.post(`${config.apiUrl}/api/messages`, message);

      if (response.data.success) {
        const savedMessage = response.data.message;

        // Update local state
        setMessages(prev => ({
          ...prev,
          [savedMessage.eventId]: [...(prev[savedMessage.eventId] || []), savedMessage]
        }));

        console.log('💬 Message saved to server:', savedMessage.id);
      }
    } catch (error) {
      console.error('Error saving message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const eventMessages = selectedEvent ? (messages[selectedEvent.id] || []) : [];

  // Handle successful login
  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    setAuthToken(token);
    setIsAuthenticated(true);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setAuthToken(null);
    setIsAuthenticated(false);
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <UserLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="title">DOT Corridor Communicator</h1>
          <div className="header-info">
            {currentUser && (
              <span className="user-info">
                👤 {currentUser.fullName || currentUser.username || 'User'}
                {currentUser.organization && ` - ${currentUser.organization}`}
              </span>
            )}
            {lastUpdate && (
              <span className="last-update">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <span className="event-count">
              {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
            </span>
            <button
              onClick={handleLogout}
              className="logout-btn"
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#ef4444',
                color: 'white',
                cursor: 'pointer',
                fontSize: '13px',
                marginLeft: '10px'
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="controls">
        <div className="view-toggle">
          <button
            className={`toggle-btn ${view === 'map' ? 'active' : ''}`}
            onClick={() => setView('map')}
          >
            Map View
          </button>
          <button
            className={`toggle-btn ${view === 'table' ? 'active' : ''}`}
            onClick={() => setView('table')}
          >
            Table View
          </button>
          <button
            className={`toggle-btn ${view === 'report' ? 'active' : ''}`}
            onClick={() => setView('report')}
          >
            Data Quality Report
          </button>
          <button
            className={`toggle-btn ${view === 'alignment' ? 'active' : ''}`}
            onClick={() => setView('alignment')}
          >
            Feed Alignment
          </button>
          <button
            className={`toggle-btn ${view === 'messages' ? 'active' : ''}`}
            onClick={() => setView('messages')}
          >
            Messages
          </button>
          <button
            className={`toggle-btn ${view === 'admin' ? 'active' : ''}`}
            onClick={() => setView('admin')}
            style={{ backgroundColor: view === 'admin' ? '#dc3545' : '#6c757d' }}
          >
            Admin
          </button>
        </div>

        <div className="control-buttons">
          <label className="refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button onClick={refetch} className="refresh-btn" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {view !== 'report' && view !== 'alignment' && view !== 'admin' && view !== 'messages' && (
          <EventFilters
            events={events}
            filters={filters}
            onFilterChange={setFilters}
          />
        )}

        {error && view !== 'admin' && view !== 'messages' && view !== 'alignment' && (
          <div className="error-banner">
            Error loading events: {error}
          </div>
        )}

        {view === 'admin' ? (
          <StateAdmin />
        ) : view === 'messages' ? (
          <StateMessaging />
        ) : view === 'alignment' ? (
          <FeedAlignment />
        ) : view === 'map' ? (
          <>
            {/* Mobile overlay */}
            <div
              className={`mobile-messages-overlay ${mobileMenuOpen ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Mobile menu button */}
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle messages"
            >
              💬
            </button>

            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
              minHeight: 0,
              overflow: 'hidden',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              position: 'relative'
            }}>
              <div className={`messages-panel-mobile ${mobileMenuOpen ? 'open' : ''}`}>
                <MessagesPanel
                  events={filteredEvents}
                  messages={messages}
                  filters={filters}
                  onEventSelect={(event) => {
                    setSelectedEvent(event);
                    setMobileMenuOpen(false);
                  }}
                  onClose={() => setMobileMenuOpen(false)}
                />
              </div>
              <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                <TrafficMap
                  events={filteredEvents}
                  messages={messages}
                  onEventSelect={setSelectedEvent}
                  selectedEvent={selectedEvent}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="view-container">
            {view === 'table' ? (
              <EventTable
                events={filteredEvents}
                messages={messages}
                onEventSelect={setSelectedEvent}
              />
            ) : view === 'report' ? (
              <DataQualityReport />
            ) : null}
          </div>
        )}
      </div>

      {/* Messaging Modal */}
      {selectedEvent && (
        <EventMessaging
          event={selectedEvent}
          messages={eventMessages}
          onSendMessage={handleSendMessage}
          onClose={() => setSelectedEvent(null)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

export default App;

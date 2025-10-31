import { useState, useMemo, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTrafficData } from './hooks/useTrafficData';
import { config } from './config';
import api from './services/api';
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
import AdminUsers from './components/AdminUsers';
import AdminInterchanges from './components/AdminInterchanges';
import AdminFeedSubmissions from './components/AdminFeedSubmissions';
import FeedSubmission from './components/FeedSubmission';
import DocumentationViewer from './components/DocumentationViewer';
import ChatWidget from './components/ChatWidget';
import UserProfile from './components/UserProfile';
import './styles/App.css';

function App() {
  const [view, setView] = useState('map'); // 'map', 'table', 'report', 'alignment', 'messages', 'docs', or 'admin'
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
  const [showParking, setShowParking] = useState(false);
  const [parkingPredictionHours, setParkingPredictionHours] = useState(0);
  const [parkingContext, setParkingContext] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile starts closed
  const [desktopMessagesOpen, setDesktopMessagesOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [detourAlerts, setDetourAlerts] = useState([]);

  // Fetch parking data when parking view is active
  useEffect(() => {
    if (!showParking) {
      setParkingContext(null);
      return;
    }

    const fetchParkingContext = async () => {
      try {
        const targetTime = new Date();
        targetTime.setHours(targetTime.getHours() + parkingPredictionHours);
        const timeParam = targetTime.toISOString();

        const response = await axios.get(`${config.apiUrl}/api/parking/historical/predict-all?time=${timeParam}`);

        if (response.data && response.data.success) {
          setParkingContext({
            type: 'parking',
            data: {
              predictions: response.data.predictions,
              alerts: response.data.alerts || [],
              targetTime: response.data.predictedFor,
              hourOffset: parkingPredictionHours
            }
          });
        }
      } catch (error) {
        console.error('Error fetching parking context:', error);
      }
    };

    fetchParkingContext();
  }, [showParking, parkingPredictionHours]);

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

  // Fetch traffic data with auto-refresh (5 minutes = 300 seconds)
  const { events, loading, error, lastUpdate, refetch } = useTrafficData(
    autoRefresh ? 300000 : null
  );

  const loadDetourAlerts = useCallback(async () => {
    if (!authToken) {
      setDetourAlerts([]);
      return;
    }

    try {
      const response = await api.getActiveDetourAlerts(authToken);
      setDetourAlerts(response.alerts || []);
    } catch (err) {
      console.error('Error loading detour alerts:', err);
    }
  }, [authToken]);

  useEffect(() => {
    let intervalId;

    if (authToken) {
      loadDetourAlerts();
      intervalId = setInterval(loadDetourAlerts, 60000);
    } else {
      setDetourAlerts([]);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [authToken, loadDetourAlerts]);

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
    if (!filterCorridor) return true;
    const normalizedFilter = normalizeCorridorKey(filterCorridor);
    if (!normalizedFilter) return true;

    const normalizedEvent = normalizeCorridorKey(eventCorridor);
    if (!normalizedEvent) return false;

    if (normalizedEvent === normalizedFilter) return true;

    return normalizedEvent.startsWith(normalizedFilter);
  };

  // Filter events based on active filters
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // State filter
      if (filters.state && event.state !== filters.state) return false;

      // Corridor filter
      if (filters.corridor && !corridorMatches(event.corridor, filters.corridor)) return false;

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

  const handleCommentAdded = (message) => {
    if (!message || !message.eventId) return;

    const enrichedMessage = {
      ...message,
      stateKey: message.stateKey || currentUser?.stateKey || null
    };

    setMessages(prev => {
      const existing = prev[enrichedMessage.eventId] || [];
      if (existing.some(msg => msg.id === enrichedMessage.id)) {
        return prev;
      }

      return {
        ...prev,
        [enrichedMessage.eventId]: [...existing, enrichedMessage]
      };
    });
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
            <div className="tim-links" style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
              <a
                href={`${config.apiUrl}/api/convert/tim`}
                target="_blank"
                rel="noopener noreferrer"
                className="tim-link"
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid #3b82f6',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-block'
                }}
                title="SAE J2735 Traveler Information Message feed for connected vehicles"
              >
                📡 J2735 TIM Feed
              </a>
              <a
                href={`${config.apiUrl}/api/convert/tim-cv`}
                target="_blank"
                rel="noopener noreferrer"
                className="tim-link"
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid #8b5cf6',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-block'
                }}
                title="SAE J2540 Commercial Vehicle TIM feed with truck-specific advisories"
              >
                🚛 J2540 CV-TIM Feed
              </a>
            </div>
            <button
              onClick={() => setView('profile')}
              className="profile-btn"
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #6b7280',
                backgroundColor: view === 'profile' ? '#3b82f6' : 'white',
                color: view === 'profile' ? 'white' : '#374151',
                cursor: 'pointer',
                fontSize: '13px',
                marginLeft: '10px'
              }}
            >
              My Profile
            </button>
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
            className={`toggle-btn ${view === 'docs' ? 'active' : ''}`}
            onClick={() => setView('docs')}
          >
            📚 Documentation
          </button>
          {authToken && (
            <button
              className={`toggle-btn ${view === 'feedSubmission' ? 'active' : ''}`}
              onClick={() => setView('feedSubmission')}
            >
              Submit Feed
            </button>
          )}

          {currentUser?.role === 'admin' && (
            <>
              <button
                className={`toggle-btn ${view === 'admin' ? 'active' : ''}`}
                onClick={() => setView('admin')}
                style={{ backgroundColor: view === 'admin' ? '#dc3545' : '#6c757d' }}
              >
                Admin (States)
              </button>
              <button
                className={`toggle-btn ${view === 'adminUsers' ? 'active' : ''}`}
                onClick={() => setView('adminUsers')}
                style={{ backgroundColor: view === 'adminUsers' ? '#dc3545' : '#6c757d' }}
              >
                Admin (Users)
              </button>
              <button
                className={`toggle-btn ${view === 'adminInterchanges' ? 'active' : ''}`}
                onClick={() => setView('adminInterchanges')}
                style={{ backgroundColor: view === 'adminInterchanges' ? '#dc3545' : '#6c757d' }}
              >
                Admin (Detours)
              </button>
              <button
                className={`toggle-btn ${view === 'adminFeeds' ? 'active' : ''}`}
                onClick={() => setView('adminFeeds')}
                style={{ backgroundColor: view === 'adminFeeds' ? '#dc3545' : '#6c757d' }}
              >
                Admin (Feeds)
              </button>
            </>
          )}
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
          <label className="refresh-toggle">
            <input
              type="checkbox"
              checked={showParking}
              onChange={(e) => {
                setShowParking(e.target.checked);
                if (!e.target.checked) setParkingPredictionHours(0);
              }}
            />
            🚛 Truck Parking
          </label>
          {showParking && (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ color: '#6b7280', marginRight: '4px' }}>Predict:</span>
              {[0, 1, 2, 3, 4].map(hours => (
                <button
                  key={hours}
                  onClick={() => setParkingPredictionHours(hours)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    backgroundColor: parkingPredictionHours === hours ? '#3b82f6' : 'white',
                    color: parkingPredictionHours === hours ? 'white' : '#374151',
                    cursor: 'pointer',
                    fontWeight: parkingPredictionHours === hours ? '600' : '400'
                  }}
                >
                  {hours === 0 ? 'Now' : `+${hours}hr`}
                </button>
              ))}
            </div>
          )}
          <button onClick={refetch} className="refresh-btn" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {view !== 'report' && view !== 'alignment' && view !== 'admin' && view !== 'adminUsers' && view !== 'messages' && (
          <EventFilters
            events={events}
            filters={filters}
            onFilterChange={setFilters}
          />
        )}

        {error && view !== 'admin' && view !== 'adminUsers' && view !== 'messages' && view !== 'alignment' && (
          <div className="error-banner">
            Error loading events: {error}
          </div>
        )}

        {view === 'feedSubmission' ? (
          <FeedSubmission authToken={authToken} user={currentUser} />
        ) : view === 'profile' ? (
          <UserProfile
            user={currentUser}
            authToken={authToken}
            onProfileUpdate={(updatedUser) => setCurrentUser(updatedUser)}
          />
        ) : view === 'admin' ? (
          <StateAdmin user={currentUser} authToken={authToken} />
        ) : view === 'adminUsers' ? (
          <AdminUsers user={currentUser} authToken={authToken} />
        ) : view === 'adminInterchanges' ? (
          <AdminInterchanges authToken={authToken} />
        ) : view === 'adminFeeds' ? (
          <AdminFeedSubmissions authToken={authToken} />
        ) : view === 'messages' ? (
          <StateMessaging user={currentUser} authToken={authToken} />
        ) : view === 'alignment' ? (
          <FeedAlignment />
        ) : view === 'docs' ? (
          <DocumentationViewer />
        ) : view === 'map' ? (
          <>
            {/* Mobile overlay */}
            <div
              className={`mobile-messages-overlay ${mobileMenuOpen ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Messages toggle button - show when panel is closed */}
            {!mobileMenuOpen && (
              <button
                className="mobile-menu-btn"
                onClick={() => {
                  if (window.innerWidth < 769) {
                    setMobileMenuOpen(true);
                  } else {
                    setDesktopMessagesOpen(true);
                  }
                }}
                aria-label="Open messages"
              >
                💬
              </button>
            )}

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
              <div className={`messages-panel-mobile ${mobileMenuOpen ? 'open' : ''} ${desktopMessagesOpen ? '' : 'closed'}`}>
                <div className="messages-panel-content">
                <MessagesPanel
                  events={filteredEvents}
                  messages={messages}
                  detourAlerts={detourAlerts}
                  filters={filters}
                  onEventSelect={(event) => {
                    setSelectedEvent(event);
                    setMobileMenuOpen(false);
                    setDesktopMessagesOpen(true);
                  }}
                  onClose={() => {
                    if (window.innerWidth < 769) {
                      setMobileMenuOpen(false);
                    } else {
                      setDesktopMessagesOpen(false);
                    }
                  }}
                />
                </div>
              </div>
              <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                <TrafficMap
                  events={filteredEvents}
                  messages={messages}
                  detourAlerts={detourAlerts}
                  onEventSelect={setSelectedEvent}
                  selectedEvent={selectedEvent}
                  showParking={showParking}
                  parkingPredictionHours={parkingPredictionHours}
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
          onSendMessage={handleCommentAdded}
          onClose={() => setSelectedEvent(null)}
          currentUser={currentUser}
        />
      )}

      {/* AI Chat Widget */}
      {isAuthenticated && currentUser && (
        <ChatWidget
          user={currentUser}
          context={
            parkingContext ? parkingContext :
            view === 'report' ? {
              type: 'compliance',
              data: {
                stateKey: currentUser.stateKey,
                view: 'data-quality'
              }
            } : view === 'alignment' ? {
              type: 'feed-alignment',
              data: {
                view: 'alignment-analysis'
              }
            } : null
          }
        />
      )}
    </div>
  );
}

export default App;

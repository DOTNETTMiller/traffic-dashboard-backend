import { useState, useMemo, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTrafficData } from './hooks/useTrafficData';
import { config } from './config';
import api from './services/api';
import TrafficMap from './components/TrafficMap';
import EventTable from './components/EventTable';
import EventFilters from './components/EventFilters';
import CorridorWarnings from './components/CorridorWarnings';
import DetourAlerts from './components/DetourAlerts';
import BridgeClearanceWarnings from './components/BridgeClearanceWarnings';
import EventMessaging from './components/EventMessaging';
import DataQualityReport from './components/DataQualityReport';
import FeedAlignment from './components/FeedAlignment';
import MessagesPanel from './components/MessagesPanel';
import LiveStatistics from './components/LiveStatistics';
import CommandPalette from './components/CommandPalette';
import QuickActionToolbar from './components/QuickActionToolbar';
import ActivityTimeline from './components/ActivityTimeline';
import DarkModeToggle from './components/DarkModeToggle';
import ExportMenu from './components/ExportMenu';
import ToastContainer, { showToast } from './components/ToastContainer';
import DashboardWidgets from './components/DashboardWidgets';
import CorridorBriefing from './components/CorridorBriefing';
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
import GroundTruthDashboard from './components/GroundTruthDashboard';
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
  const [showInterchanges, setShowInterchanges] = useState(true); // Show interchanges by default
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile starts closed
  const [desktopMessagesOpen, setDesktopMessagesOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [detourAlerts, setDetourAlerts] = useState([]);
  const [statsExpanded, setStatsExpanded] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [heatMapActive, setHeatMapActive] = useState(false);
  const [heatMapMode, setHeatMapMode] = useState('density');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCorridorBriefing, setShowCorridorBriefing] = useState(false);

  // Apply dark mode class to document root
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

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
        } else {
          // Service returned but without success
          setParkingContext(null);
        }
      } catch (error) {
        console.error('Error fetching parking context:', error);
        // Don't set parking context on error (503, etc.)
        setParkingContext(null);
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
      // Silently fail - detour alerts are optional
      // 403 errors are expected if endpoint requires special permissions
      setDetourAlerts([]);
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

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + K - Open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Deduplicate events that are very similar (likely duplicates from different feeds)
  const deduplicateEvents = (events) => {
    const deduped = [];
    const seen = new Map();

    for (const event of events) {
      // Create a key based on location, type, and time proximity
      const lat = event.latitude ? Math.round(event.latitude * 100) / 100 : 'no-lat';
      const lng = event.longitude ? Math.round(event.longitude * 100) / 100 : 'no-lng';
      const type = event.eventType || 'unknown';
      const corridor = normalizeCorridorKey(event.corridor);

      // Key combines location (rounded to ~1km), type, and corridor
      const key = `${lat},${lng}|${type}|${corridor}`;

      if (seen.has(key)) {
        // Similar event exists - combine data
        const existing = seen.get(key);

        // Prefer higher severity
        if (event.severity === 'high' && existing.severity !== 'high') {
          existing.severity = 'high';
        } else if (event.severity === 'medium' && existing.severity === 'low') {
          existing.severity = 'medium';
        }

        // Combine state sources
        if (event.state && !existing.states.includes(event.state)) {
          existing.states.push(event.state);
          existing.state = existing.states.join(', ');
        }

        // Use longer description
        if (event.description && event.description.length > (existing.description || '').length) {
          existing.description = event.description;
        }
      } else {
        // New unique event
        const dedupedEvent = {
          ...event,
          states: [event.state],
          isDuplicate: false
        };
        deduped.push(dedupedEvent);
        seen.set(key, dedupedEvent);
      }
    }

    return deduped;
  };

  // Filter events based on active filters
  const filteredEvents = useMemo(() => {
    const filtered = events.filter(event => {
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

    // Deduplicate similar events
    return deduplicateEvents(filtered);
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

  // Handle command execution from command palette
  const handleExecuteCommand = useCallback((command) => {
    switch (command.type) {
      case 'navigate':
        setView(command.view);
        break;

      case 'toggle':
        if (command.feature === 'autoRefresh') {
          setAutoRefresh(command.value);
          showToast(`Auto-refresh ${command.value ? 'enabled' : 'disabled'}`, 'info');
        } else if (command.feature === 'showParking') {
          setShowParking(command.value);
          showToast(`Truck parking ${command.value ? 'shown' : 'hidden'}`, 'info');
        } else if (command.feature === 'showInterchanges') {
          setShowInterchanges(command.value);
          showToast(`Coordination points ${command.value ? 'shown' : 'hidden'}`, 'info');
        }
        break;

      case 'action':
        if (command.action === 'refresh') {
          refetch();
          showToast('Refreshing data...', 'info');
        } else if (command.action === 'clearFilters') {
          setFilters({
            state: '',
            corridor: '',
            eventType: '',
            severity: '',
            search: ''
          });
          showToast('All filters cleared', 'success');
        } else if (command.action === 'toggleStats') {
          setStatsExpanded(!statsExpanded);
          showToast(`Statistics ${!statsExpanded ? 'shown' : 'hidden'}`, 'info');
        } else if (command.action === 'export') {
          setShowExportMenu(true);
        } else if (command.action === 'openBriefing') {
          setShowCorridorBriefing(true);
          showToast('Opening corridor briefing...', 'info');
        }
        break;

      case 'filter':
        setFilters(prev => ({
          ...prev,
          [command.filter]: command.value
        }));
        break;

      default:
        console.warn('Unknown command type:', command.type);
    }
  }, [refetch, statsExpanded]);

  // Quick action handlers
  const handleFilterSeverity = useCallback((severity) => {
    setFilters(prev => ({
      ...prev,
      severity: prev.severity === severity ? '' : severity
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      state: '',
      corridor: '',
      eventType: '',
      severity: '',
      search: ''
    });
    showToast('All filters cleared', 'success');
  }, []);

  const handleToggleParking = useCallback(() => {
    setShowParking(prev => {
      const newValue = !prev;
      showToast(`Truck parking ${newValue ? 'shown' : 'hidden'}`, 'info');
      return newValue;
    });
  }, []);

  const handleToggleInterchanges = useCallback(() => {
    setShowInterchanges(prev => {
      const newValue = !prev;
      showToast(`Coordination points ${newValue ? 'shown' : 'hidden'}`, 'info');
      return newValue;
    });
  }, []);

  // Handle successful login
  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    setAuthToken(token);
    setIsAuthenticated(true);
    showToast(`Welcome back, ${user.username}!`, 'success');
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setAuthToken(null);
    setIsAuthenticated(false);
    showToast('Logged out successfully', 'success');
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <UserLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className={`app ${view === 'groundTruth' ? 'ground-truth-view' : ''}`}>
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="title">
            DOT Corridor Communicator
            <span style={{
              fontSize: '10px',
              fontWeight: '400',
              marginLeft: '12px',
              opacity: '0.8'
            }}>
              brought to you by Matt Miller, CPM
            </span>
          </h1>
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
            <div className="tim-links" style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
              <a
                href={`${config.apiUrl}/api/convert/tim`}
                target="_blank"
                rel="noopener noreferrer"
                className="tim-link"
                style={{
                  padding: '4px 8px',
                  borderRadius: '3px',
                  border: '1px solid #3b82f6',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '11px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-block'
                }}
                title="SAE J2735 Traveler Information Message feed for connected vehicles"
              >
                📡 TIM
              </a>
              <a
                href={`${config.apiUrl}/api/convert/tim-cv`}
                target="_blank"
                rel="noopener noreferrer"
                className="tim-link"
                style={{
                  padding: '4px 8px',
                  borderRadius: '3px',
                  border: '1px solid #8b5cf6',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '11px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-block'
                }}
                title="SAE J2540 Commercial Vehicle TIM feed with truck-specific advisories"
              >
                🚛 CV-TIM
              </a>
            </div>
            <div style={{ marginLeft: '12px' }}>
              <DarkModeToggle
                isDarkMode={isDarkMode}
                onToggle={() => setIsDarkMode(!isDarkMode)}
              />
            </div>
            <button
              onClick={() => setView('profile')}
              className="profile-btn"
              style={{
                padding: '4px 8px',
                borderRadius: '3px',
                border: '1px solid #6b7280',
                backgroundColor: view === 'profile' ? '#3b82f6' : 'white',
                color: view === 'profile' ? 'white' : '#374151',
                cursor: 'pointer',
                fontSize: '11px',
                marginLeft: '8px'
              }}
            >
              Profile
            </button>
            <button
              onClick={handleLogout}
              className="logout-btn"
              style={{
                padding: '4px 8px',
                borderRadius: '3px',
                border: 'none',
                backgroundColor: '#ef4444',
                color: 'white',
                cursor: 'pointer',
                fontSize: '11px',
                marginLeft: '8px'
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
            className={`toggle-btn ${view === 'timeline' ? 'active' : ''}`}
            onClick={() => setView('timeline')}
          >
            Timeline View
          </button>
          <button
            className={`toggle-btn ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            Dashboard
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
          <button
            className="toggle-btn"
            onClick={() => setShowCorridorBriefing(true)}
            style={{
              backgroundColor: '#10b981',
              color: 'white'
            }}
          >
            📋 Corridor Briefing
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
            <div style={{ position: 'relative' }}>
              <button
                className={`toggle-btn ${['groundTruth', 'admin', 'adminUsers', 'adminInterchanges', 'adminFeeds'].includes(view) ? 'active' : ''}`}
                onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                style={{
                  backgroundColor: ['groundTruth', 'admin', 'adminUsers', 'adminInterchanges', 'adminFeeds'].includes(view) ? '#dc3545' : '#6c757d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                Admin
                <span style={{
                  transform: adminDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  fontSize: '10px'
                }}>
                  ▼
                </span>
              </button>

              {adminDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  minWidth: '180px',
                  overflow: 'hidden',
                  border: '1px solid #e5e7eb'
                }}>
                  <button
                    onClick={() => {
                      setView('groundTruth');
                      setAdminDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: view === 'groundTruth' ? '#f3f4f6' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: view === 'groundTruth' ? '600' : '400',
                      color: view === 'groundTruth' ? '#10b981' : '#374151',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = view === 'groundTruth' ? '#f3f4f6' : 'white'}
                  >
                    Ground Truth
                  </button>
                  <button
                    onClick={() => {
                      setView('admin');
                      setAdminDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: view === 'admin' ? '#f3f4f6' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: view === 'admin' ? '600' : '400',
                      color: view === 'admin' ? '#dc3545' : '#374151',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = view === 'admin' ? '#f3f4f6' : 'white'}
                  >
                    States
                  </button>
                  <button
                    onClick={() => {
                      setView('adminUsers');
                      setAdminDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: view === 'adminUsers' ? '#f3f4f6' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: view === 'adminUsers' ? '600' : '400',
                      color: view === 'adminUsers' ? '#dc3545' : '#374151',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = view === 'adminUsers' ? '#f3f4f6' : 'white'}
                  >
                    Users
                  </button>
                  <button
                    onClick={() => {
                      setView('adminInterchanges');
                      setAdminDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: view === 'adminInterchanges' ? '#f3f4f6' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: view === 'adminInterchanges' ? '600' : '400',
                      color: view === 'adminInterchanges' ? '#dc3545' : '#374151',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = view === 'adminInterchanges' ? '#f3f4f6' : 'white'}
                  >
                    Detours
                  </button>
                  <button
                    onClick={() => {
                      setView('adminFeeds');
                      setAdminDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: view === 'adminFeeds' ? '#f3f4f6' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: view === 'adminFeeds' ? '600' : '400',
                      color: view === 'adminFeeds' ? '#dc3545' : '#374151',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = view === 'adminFeeds' ? '#f3f4f6' : 'white'}
                  >
                    Feeds
                  </button>
                </div>
              )}
            </div>
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
          <label className="refresh-toggle">
            <input
              type="checkbox"
              checked={showInterchanges}
              onChange={(e) => setShowInterchanges(e.target.checked)}
            />
            🎯 Interstate Coordination Points
          </label>
          {showParking && (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '13px', flexWrap: 'wrap' }}>
              <span style={{ color: '#6b7280', marginRight: '4px' }}>Predict:</span>
              {[
                { hours: 0, label: 'Now', tooltip: 'Current availability' },
                { hours: 1, label: '+1hr', tooltip: '1 hour ahead' },
                { hours: 3, label: '+3hr', tooltip: '3 hours ahead' },
                { hours: 6, label: '+6hr', tooltip: '6 hours ahead' },
                { hours: 11, label: '+11hr', tooltip: 'Max HOS driving limit (11 hours)' },
                { hours: 14, label: '+14hr', tooltip: 'Max HOS on-duty limit (14 hours)' }
              ].map(({ hours, label, tooltip }) => (
                <button
                  key={hours}
                  onClick={() => setParkingPredictionHours(hours)}
                  title={tooltip}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    border: `2px solid ${
                      parkingPredictionHours === hours
                        ? (hours === 11 || hours === 14 ? '#f59e0b' : '#3b82f6')
                        : (hours === 11 || hours === 14 ? '#fcd34d' : '#e5e7eb')
                    }`,
                    borderRadius: '8px',
                    backgroundColor: parkingPredictionHours === hours
                      ? (hours === 11 || hours === 14 ? '#f59e0b' : '#3b82f6')
                      : 'white',
                    color: parkingPredictionHours === hours ? 'white' : '#374151',
                    cursor: 'pointer',
                    fontWeight: parkingPredictionHours === hours ? '700' : '500',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    boxShadow: parkingPredictionHours === hours
                      ? '0 2px 6px rgba(0,0,0,0.15)'
                      : '0 1px 2px rgba(0,0,0,0.05)',
                    transform: parkingPredictionHours === hours ? 'translateY(-1px)' : 'translateY(0)'
                  }}
                  onMouseEnter={(e) => {
                    if (parkingPredictionHours !== hours) {
                      e.currentTarget.style.borderColor = hours === 11 || hours === 14 ? '#f59e0b' : '#3b82f6';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (parkingPredictionHours !== hours) {
                      e.currentTarget.style.borderColor = hours === 11 || hours === 14 ? '#fcd34d' : '#e5e7eb';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                    }
                  }}
                >
                  {label}
                  {(hours === 11 || hours === 14) && (
                    <span style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      borderRadius: '50%',
                      width: '14px',
                      height: '14px',
                      fontSize: '9px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700'
                    }}>
                      H
                    </span>
                  )}
                </button>
              ))}
              <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '6px' }}>
                (H = HOS limit)
              </span>
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
          <>
            <EventFilters
              events={events}
              filters={filters}
              onFilterChange={setFilters}
            />

            {filters.corridor && (
              <CorridorWarnings
                corridor={filters.corridor}
                onViewOnMap={(event) => {
                  // Switch to map view if not already there
                  if (view !== 'map') {
                    setView('map');
                  }
                  // Set the selected event
                  setSelectedEvent(event);
                  // Note: Map will auto-pan to the event based on selectedEvent change
                }}
              />
            )}

            {authToken && (
              <DetourAlerts
                authToken={authToken}
                onViewOnMap={(event) => {
                  // Switch to map view if not already there
                  if (view !== 'map') {
                    setView('map');
                  }
                  // Set the selected event
                  setSelectedEvent(event);
                }}
              />
            )}

            <BridgeClearanceWarnings
              onViewOnMap={(event) => {
                // Switch to map view if not already there
                if (view !== 'map') {
                  setView('map');
                }
                // Set the selected event
                setSelectedEvent(event);
              }}
            />
          </>
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
        ) : view === 'groundTruth' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <GroundTruthDashboard authToken={authToken} currentUser={currentUser} />
          </div>
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
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <LiveStatistics
                    events={filteredEvents}
                    isExpanded={statsExpanded}
                    onToggle={() => setStatsExpanded(!statsExpanded)}
                  />
                </div>
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TrafficMap
                  events={filteredEvents}
                  messages={messages}
                  detourAlerts={detourAlerts}
                  onEventSelect={setSelectedEvent}
                  selectedEvent={selectedEvent}
                  showParking={showParking}
                  parkingPredictionHours={parkingPredictionHours}
                  showInterchanges={showInterchanges}
                  heatMapActive={heatMapActive}
                  heatMapMode={heatMapMode}
                  onHeatMapToggle={setHeatMapActive}
                  onHeatMapModeChange={setHeatMapMode}
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>

            {/* Quick Action Toolbar */}
            <QuickActionToolbar
              onRefresh={refetch}
              onClearFilters={handleClearFilters}
              onToggleParking={handleToggleParking}
              onToggleInterchanges={handleToggleInterchanges}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              onFilterSeverity={handleFilterSeverity}
              onExport={() => setShowExportMenu(true)}
              autoRefresh={autoRefresh}
              showParking={showParking}
              showInterchanges={showInterchanges}
              currentSeverityFilter={filters.severity}
              eventCount={filteredEvents.length}
            />
          </>
        ) : (
          <div className="view-container">
            {view === 'table' ? (
              <EventTable
                events={filteredEvents}
                messages={messages}
                onEventSelect={setSelectedEvent}
              />
            ) : view === 'timeline' ? (
              <ActivityTimeline
                events={filteredEvents}
                messages={messages}
              />
            ) : view === 'dashboard' ? (
              <DashboardWidgets
                events={filteredEvents}
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

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onExecuteCommand={handleExecuteCommand}
        currentView={view}
        currentFilters={filters}
        autoRefresh={autoRefresh}
        showParking={showParking}
        showInterchanges={showInterchanges}
      />

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Export Menu */}
      {showExportMenu && (
        <ExportMenu
          events={filteredEvents}
          messages={messages}
          onClose={() => setShowExportMenu(false)}
        />
      )}

      {/* Corridor Briefing */}
      {showCorridorBriefing && (
        <CorridorBriefing
          events={filteredEvents}
          detourAlerts={detourAlerts}
          onClose={() => setShowCorridorBriefing(false)}
        />
      )}
    </div>
  );
}

export default App;

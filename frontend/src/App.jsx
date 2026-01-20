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
import CorridorDataQuality from './components/CorridorDataQuality';
import TETCDataGrading from './components/TETCDataGrading';
import VendorDQIComparison from './components/VendorDQIComparison';
import VendorGapAnalysis from './components/VendorGapAnalysis';
import CoverageGapAnalysis from './components/CoverageGapAnalysis';
import VendorLeaderboard from './components/VendorLeaderboard';
import StateQualityDashboard from './components/StateQualityDashboard';
import PredictiveAnalyticsDashboard from './components/PredictiveAnalyticsDashboard';
import EventConfidenceDashboard from './components/EventConfidenceDashboard';
import ProcurementDashboard from './components/ProcurementDashboard';
import AssetHealthDashboard from './components/AssetHealthDashboard';
import APIDocumentationViewer from './components/APIDocumentationViewer';
import GrantApplications from './components/GrantApplications';
import FundingOpportunities from './components/FundingOpportunities';
import NASCOCorridorRegulationsView from './components/NASCOCorridorRegulationsView';
import DigitalInfrastructure from './components/DigitalInfrastructure';
import DigitalStandardsCrosswalk from './components/DigitalStandardsCrosswalk';
import VendorPortal from './components/VendorPortal';
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
  const [showITSEquipment, setShowITSEquipment] = useState(false);
  const [itsEquipmentRoute, setItsEquipmentRoute] = useState(''); // Route filter for ITS equipment
  const [itsEquipmentType, setItsEquipmentType] = useState(''); // Equipment type filter (camera, dms, sensor, rsu)
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [showInterchanges, setShowInterchanges] = useState(false); // Hidden by default - toggle to show
  const [showBridgeClearances, setShowBridgeClearances] = useState(false); // Hidden by default - toggle to show
  const [showCorridorRegulations, setShowCorridorRegulations] = useState(false); // Hidden by default - toggle to show
  const [interstateOnly, setInterstateOnly] = useState(true); // Show only interstate events by default
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
  const [dataQualityDropdownOpen, setDataQualityDropdownOpen] = useState(false);
  const [communicationsDropdownOpen, setCommunicationsDropdownOpen] = useState(false);
  const [stateToolsDropdownOpen, setStateToolsDropdownOpen] = useState(false);
  const [commercialFreightDropdownOpen, setCommercialFreightDropdownOpen] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [heatMapActive, setHeatMapActive] = useState(false);
  const [heatMapMode, setHeatMapMode] = useState('density');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCorridorBriefing, setShowCorridorBriefing] = useState(false);
  const [hasITSEquipment, setHasITSEquipment] = useState(false);
  const [logoIntroComplete, setLogoIntroComplete] = useState(false);

  // Apply dark mode class to document root
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Logo intro animation - show full screen for 5 seconds then transition to corner
  useEffect(() => {
    const timer = setTimeout(() => {
      setLogoIntroComplete(true);
    }, 5000); // 5 seconds

    return () => clearTimeout(timer);
  }, []);

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

  // Fetch available routes for ITS equipment filtering
  useEffect(() => {
    const fetchRoutes = async () => {
      if (!authToken || !currentUser?.stateKey) return;

      try {
        const response = await axios.get(`${config.apiUrl}/api/its-equipment/routes`, {
          params: { stateKey: currentUser.stateKey }
        });
        if (response.data.success) {
          setAvailableRoutes(response.data.routes);
        }
      } catch (error) {
        console.error('Error fetching routes:', error);
      }
    };

    fetchRoutes();
  }, [authToken, currentUser]);

  // Check if user's state has ITS equipment uploaded
  useEffect(() => {
    const checkITSEquipment = async () => {
      if (!authToken || !currentUser?.stateKey) {
        setHasITSEquipment(false);
        return;
      }

      try {
        const response = await api.get('/api/its-equipment', {
          params: { stateKey: currentUser.stateKey }
        });

        if (response.data.success && response.data.equipment?.length > 0) {
          setHasITSEquipment(true);
        } else {
          setHasITSEquipment(false);
        }
      } catch (error) {
        console.error('Error checking ITS equipment:', error);
        setHasITSEquipment(false);
      }
    };

    checkITSEquipment();
  }, [authToken, currentUser]);

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
      // Use 4 decimal places (~11 meters) to only dedupe true duplicates, not nearby events
      const lat = event.latitude ? Math.round(event.latitude * 10000) / 10000 : 'no-lat';
      const lng = event.longitude ? Math.round(event.longitude * 10000) / 10000 : 'no-lng';
      const type = event.eventType || 'unknown';
      const corridor = normalizeCorridorKey(event.corridor);

      // Key combines location (rounded to ~11m), type, and corridor
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
              <a
                href={`${config.apiUrl}/api/convert/cifs`}
                target="_blank"
                rel="noopener noreferrer"
                className="tim-link"
                style={{
                  padding: '4px 8px',
                  borderRadius: '3px',
                  border: '1px solid #10b981',
                  backgroundColor: '#10b981',
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '11px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-block'
                }}
                title="Common Incident Feed Specification"
              >
                🚨 CIFS
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
          {/* Core Views */}
          <button
            className={`toggle-btn ${view === 'map' ? 'active' : ''}`}
            onClick={() => setView('map')}
          >
            🗺️ Map
          </button>
          <button
            className={`toggle-btn ${view === 'table' ? 'active' : ''}`}
            onClick={() => setView('table')}
          >
            📋 Table
          </button>
          <button
            className={`toggle-btn ${view === 'timeline' ? 'active' : ''}`}
            onClick={() => setView('timeline')}
          >
            ⏱️ Timeline
          </button>
          <button
            className={`toggle-btn ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            📊 Dashboard
          </button>

          {/* Data Quality Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              className={`toggle-btn ${['report', 'tetcGrading', 'vendorComparison', 'alignment'].includes(view) ? 'active' : ''}`}
              onClick={() => {
                setDataQualityDropdownOpen(!dataQualityDropdownOpen);
                setCommunicationsDropdownOpen(false);
                setStateToolsDropdownOpen(false);
                setCommercialFreightDropdownOpen(false);
              }}
              style={{
                backgroundColor: ['report', 'tetcGrading', 'vendorComparison', 'alignment'].includes(view) ? '#3b82f6' : undefined,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📈 Data Quality
              <span style={{
                transform: dataQualityDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                fontSize: '10px'
              }}>
                ▼
              </span>
            </button>

            {dataQualityDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10000,
                minWidth: '200px',
                overflow: 'hidden',
                border: '1px solid #e5e7eb'
              }}>
                <button
                  onClick={() => {
                    setView('report');
                    setDataQualityDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'report' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'report' ? '600' : '400',
                    color: view === 'report' ? '#3b82f6' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'report' ? '#f3f4f6' : 'white'}
                >
                  📊 Quality Report
                </button>
                <button
                  onClick={() => {
                    setView('tetcGrading');
                    setDataQualityDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'tetcGrading' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'tetcGrading' ? '600' : '400',
                    color: view === 'tetcGrading' ? '#3b82f6' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'tetcGrading' ? '#f3f4f6' : 'white'}
                >
                  ⭐ TETC Grading
                </button>
                <button
                  onClick={() => {
                    setView('vendorComparison');
                    setDataQualityDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'vendorComparison' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'vendorComparison' ? '600' : '400',
                    color: view === 'vendorComparison' ? '#3b82f6' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'vendorComparison' ? '#f3f4f6' : 'white'}
                >
                  🔄 Vendor Comparison
                </button>
                <button
                  onClick={() => {
                    setView('alignment');
                    setDataQualityDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'alignment' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'alignment' ? '600' : '400',
                    color: view === 'alignment' ? '#3b82f6' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'alignment' ? '#f3f4f6' : 'white'}
                >
                  🔗 Feed Alignment
                </button>
                <button
                  onClick={() => {
                    setView('gapAnalysis');
                    setDataQualityDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'gapAnalysis' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'gapAnalysis' ? '600' : '400',
                    color: view === 'gapAnalysis' ? '#3b82f6' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'gapAnalysis' ? '#f3f4f6' : 'white'}
                >
                  📊 Vendor Gap Analysis
                </button>
                <button
                  onClick={() => {
                    setView('coverageGaps');
                    setDataQualityDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'coverageGaps' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'coverageGaps' ? '600' : '400',
                    color: view === 'coverageGaps' ? '#3b82f6' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'coverageGaps' ? '#f3f4f6' : 'white'}
                >
                  🗺️ Coverage Gap Analysis
                </button>
                <button
                  onClick={() => {
                    setView('vendorLeaderboard');
                    setDataQualityDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'vendorLeaderboard' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'vendorLeaderboard' ? '600' : '400',
                    color: view === 'vendorLeaderboard' ? '#3b82f6' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'vendorLeaderboard' ? '#f3f4f6' : 'white'}
                >
                  🏆 Vendor Leaderboard
                </button>

                <button
                  onClick={() => {
                    setView('stateQualityRankings');
                    setDataQualityDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'stateQualityRankings' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'stateQualityRankings' ? '600' : '400',
                    color: view === 'stateQualityRankings' ? '#3b82f6' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'stateQualityRankings' ? '#f3f4f6' : 'white'}
                >
                  🎖️ State Quality Rankings
                </button>

                <button
                  onClick={() => {
                    setView('predictiveAnalytics');
                    setDataQualityDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'predictiveAnalytics' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'predictiveAnalytics' ? '600' : '400',
                    color: view === 'predictiveAnalytics' ? '#3b82f6' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'predictiveAnalytics' ? '#f3f4f6' : 'white'}
                >
                  🤖 Predictive Analytics (Phase 6)
                </button>

                {/* Phase 1 & 2 Dashboards */}
                <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }}></div>

                <button
                  onClick={() => {
                    setView('eventConfidence');
                    setDataQualityDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'eventConfidence' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'eventConfidence' ? '600' : '400',
                    color: view === 'eventConfidence' ? '#3b82f6' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'eventConfidence' ? '#f3f4f6' : 'white'}
                >
                  ✓ Event Confidence Scoring (Phase 1.2)
                </button>

                <button
                  onClick={() => {
                    setView('procurement');
                    setDataQualityDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'procurement' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'procurement' ? '600' : '400',
                    color: view === 'procurement' ? '#3b82f6' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'procurement' ? '#f3f4f6' : 'white'}
                >
                  💰 Procurement Transparency (Phase 1.3)
                </button>

                <button
                  onClick={() => {
                    setView('assetHealth');
                    setDataQualityDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'assetHealth' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'assetHealth' ? '600' : '400',
                    color: view === 'assetHealth' ? '#3b82f6' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'assetHealth' ? '#f3f4f6' : 'white'}
                >
                  🔧 Asset Health & Maintenance (Phase 2)
                </button>
              </div>
            )}
          </div>

          {/* Communications Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              className={`toggle-btn ${['messages', 'adminInterchanges'].includes(view) ? 'active' : ''}`}
              onClick={() => {
                setCommunicationsDropdownOpen(!communicationsDropdownOpen);
                setDataQualityDropdownOpen(false);
                setStateToolsDropdownOpen(false);
                setCommercialFreightDropdownOpen(false);
              }}
              style={{
                backgroundColor: ['messages', 'adminInterchanges'].includes(view) ? '#10b981' : undefined,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              💬 Communications
              <span style={{
                transform: communicationsDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                fontSize: '10px'
              }}>
                ▼
              </span>
            </button>

            {communicationsDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10000,
                minWidth: '200px',
                overflow: 'hidden',
                border: '1px solid #e5e7eb'
              }}>
                <button
                  onClick={() => {
                    setView('messages');
                    setCommunicationsDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'messages' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'messages' ? '600' : '400',
                    color: view === 'messages' ? '#10b981' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'messages' ? '#f3f4f6' : 'white'}
                >
                  💬 Messages
                </button>
                <button
                  onClick={() => {
                    setShowCorridorBriefing(true);
                    setCommunicationsDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '400',
                    color: '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  📋 Corridor Briefing
                </button>
                <button
                  onClick={() => {
                    setShowAlertsModal(true);
                    setCommunicationsDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '400',
                    color: '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  🚨 Detour & Bridge Alerts
                </button>

                {/* Divider */}
                <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }}></div>

                {/* Interstate Coordination Points Toggle */}
                <div style={{ padding: '10px 16px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#374151'
                  }}>
                    <input
                      type="checkbox"
                      checked={showInterchanges}
                      onChange={(e) => setShowInterchanges(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    🎯 Interstate Coordination Points
                  </label>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }}></div>

                {/* ITS Equipment Toggle */}
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: showITSEquipment ? '#f0fdf4' : 'transparent',
                  borderLeft: showITSEquipment ? '3px solid #10b981' : '3px solid transparent',
                  transition: 'all 0.2s'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: showITSEquipment ? '600' : 'normal',
                    color: showITSEquipment ? '#059669' : '#374151'
                  }}>
                    <input
                      type="checkbox"
                      checked={showITSEquipment}
                      onChange={(e) => {
                        setShowITSEquipment(e.target.checked);
                        if (!e.target.checked) setItsEquipmentRoute(''); // Clear route when hiding
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    📡 ITS Assets Layer
                  </label>
                  {showITSEquipment && (
                    <div style={{
                      fontSize: '10px',
                      color: '#059669',
                      marginTop: '4px',
                      marginLeft: '24px'
                    }}>
                      Shows: Cameras • DMS Signs • Sensors • RSUs
                    </div>
                  )}

                  {/* Equipment Type Filter */}
                  {showITSEquipment && (
                    <div style={{ marginTop: '8px', marginLeft: '24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>
                        Filter by Type:
                      </div>
                      <select
                        value={itsEquipmentType}
                        onChange={(e) => setItsEquipmentType(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '12px',
                          border: '1px solid #d1fae5',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: 'white'
                        }}
                      >
                        <option value="">All Equipment Types</option>
                        <option value="camera">📹 Cameras Only</option>
                        <option value="dms">🚏 DMS Signs Only</option>
                        <option value="sensor">🌡️ Sensors Only</option>
                        <option value="rsu">📡 RSUs Only</option>
                      </select>
                    </div>
                  )}

                  {/* Route Dropdown - only show when ITS Equipment is active */}
                  {showITSEquipment && availableRoutes.length > 0 && (
                    <div style={{ marginTop: '8px', marginLeft: '24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>
                        Filter by Route:
                      </div>
                      <select
                        value={itsEquipmentRoute}
                        onChange={(e) => setItsEquipmentRoute(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '12px',
                          border: '1px solid #d1fae5',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: 'white'
                        }}
                      >
                        <option value="">All Routes</option>
                        {availableRoutes.map(route => (
                          <option key={route} value={route}>{route}</option>
                        ))}
                      </select>
                      {!itsEquipmentRoute && !itsEquipmentType && (
                        <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '4px' }}>
                          💡 Tip: Filter by route or type for better performance
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* State Tools Dropdown (for authenticated users) */}
          {authToken && (
            <div style={{ position: 'relative' }}>
              <button
                className={`toggle-btn ${['feedSubmission', 'grants', 'digitalInfrastructure', 'standardsCrosswalk', 'vendorPortal'].includes(view) ? 'active' : ''}`}
                onClick={() => {
                  setStateToolsDropdownOpen(!stateToolsDropdownOpen);
                  setDataQualityDropdownOpen(false);
                  setCommunicationsDropdownOpen(false);
                  setCommercialFreightDropdownOpen(false);
                }}
                style={{
                  backgroundColor: ['feedSubmission', 'grants', 'digitalInfrastructure', 'standardsCrosswalk', 'vendorPortal'].includes(view) ? '#059669' : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🏛️ State Tools
                <span style={{
                  transform: stateToolsDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  fontSize: '10px'
                }}>
                  ▼
                </span>
              </button>

              {stateToolsDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 10000,
                  minWidth: '200px',
                  overflow: 'hidden',
                  border: '1px solid #e5e7eb'
                }}>
                  <button
                    onClick={() => {
                      setView('feedSubmission');
                      setStateToolsDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: view === 'feedSubmission' ? '#f3f4f6' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: view === 'feedSubmission' ? '600' : '400',
                      color: view === 'feedSubmission' ? '#059669' : '#374151',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = view === 'feedSubmission' ? '#f3f4f6' : 'white'}
                  >
                    📡 Submit Feeds & ITS Infrastructure
                  </button>
                  <button
                    onClick={() => {
                      setView('grants');
                      setStateToolsDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: view === 'grants' ? '#f3f4f6' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: view === 'grants' ? '600' : '400',
                      color: view === 'grants' ? '#059669' : '#374151',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = view === 'grants' ? '#f3f4f6' : 'white'}
                  >
                    💰 Funding Opportunities
                  </button>
                  <button
                    onClick={() => {
                      setView('digitalInfrastructure');
                      setStateToolsDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: view === 'digitalInfrastructure' ? '#f3f4f6' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: view === 'digitalInfrastructure' ? '600' : '400',
                      color: view === 'digitalInfrastructure' ? '#059669' : '#374151',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = view === 'digitalInfrastructure' ? '#f3f4f6' : 'white'}
                  >
                    🏗️ Digital Infrastructure
                  </button>
                  <button
                    onClick={() => {
                      setView('standardsCrosswalk');
                      setStateToolsDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: view === 'standardsCrosswalk' ? '#f3f4f6' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: view === 'standardsCrosswalk' ? '600' : '400',
                      color: view === 'standardsCrosswalk' ? '#059669' : '#374151',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = view === 'standardsCrosswalk' ? '#f3f4f6' : 'white'}
                  >
                    📋 Digital Standards Crosswalk
                  </button>
                  <button
                    onClick={() => {
                      setView('vendorPortal');
                      setStateToolsDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: view === 'vendorPortal' ? '#f3f4f6' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: view === 'vendorPortal' ? '600' : '400',
                      color: view === 'vendorPortal' ? '#059669' : '#374151',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = view === 'vendorPortal' ? '#f3f4f6' : 'white'}
                  >
                    📦 Vendor Data Portal
                  </button>

                  {/* ARC-ITS Export - Only show if state has uploaded equipment */}
                  {hasITSEquipment && (
                    <>
                      <div style={{
                        height: '1px',
                        background: '#e5e7eb',
                        margin: '4px 0'
                      }} />
                      <div style={{
                        padding: '8px 16px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        ITS Equipment Data
                      </div>
                      <button
                        onClick={() => {
                          // Download JSON format
                          const url = `${config.apiUrl}/api/its-equipment/export?format=json&stateKey=${currentUser.stateKey}`;
                          window.open(url, '_blank');
                          setStateToolsDropdownOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          border: 'none',
                          background: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '400',
                          color: '#374151',
                          transition: 'background 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        <span>📥</span>
                        <div style={{ flex: 1 }}>
                          <div>Download ARC-ITS (JSON)</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                            Equipment inventory export
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          // Download XML format
                          const url = `${config.apiUrl}/api/its-equipment/export?format=xml&stateKey=${currentUser.stateKey}`;
                          window.open(url, '_blank');
                          setStateToolsDropdownOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          border: 'none',
                          background: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '400',
                          color: '#374151',
                          transition: 'background 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        <span>📥</span>
                        <div style={{ flex: 1 }}>
                          <div>Download ARC-ITS (XML)</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                            Regional architecture format
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          // Download CSV format
                          const url = `${config.apiUrl}/api/its-equipment/export?format=csv&stateKey=${currentUser.stateKey}`;
                          window.open(url, '_blank');
                          setStateToolsDropdownOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          border: 'none',
                          background: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '400',
                          color: '#374151',
                          transition: 'background 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        <span>📊</span>
                        <div style={{ flex: 1 }}>
                          <div>Download ARC-ITS (CSV)</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                            Spreadsheet format
                          </div>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Commercial Freight */}
          <div style={{ position: 'relative' }}>
            <button
              className={`toggle-btn ${view === 'groundTruth' || showParking || showBridgeClearances || showCorridorRegulations ? 'active' : ''}`}
              onClick={() => {
                setCommercialFreightDropdownOpen(!commercialFreightDropdownOpen);
                setDataQualityDropdownOpen(false);
                setCommunicationsDropdownOpen(false);
                setStateToolsDropdownOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🚛 Commercial Freight
              <span style={{
                transform: commercialFreightDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                fontSize: '10px'
              }}>
                ▼
              </span>
            </button>

            {commercialFreightDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10000,
                minWidth: '240px',
                overflow: 'hidden',
                border: '1px solid #e5e7eb'
              }}>
                {/* Ground Truth */}
                <button
                  onClick={() => {
                    setView('groundTruth');
                    setCommercialFreightDropdownOpen(false);
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
                  🎯 Ground Truth
                </button>

                {/* NASCO OS/OW Regulations */}
                <button
                  onClick={() => {
                    setView('nasco-regulations');
                    setCommercialFreightDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: view === 'nasco-regulations' ? '#f3f4f6' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: view === 'nasco-regulations' ? '600' : '400',
                    color: view === 'nasco-regulations' ? '#10b981' : '#374151',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = view === 'nasco-regulations' ? '#f3f4f6' : 'white'}
                >
                  🛣️ NASCO OS/OW Regulations
                </button>

                {/* Divider */}
                <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }}></div>

                {/* Truck Parking Toggle */}
                <div style={{ padding: '10px 16px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#374151'
                  }}>
                    <input
                      type="checkbox"
                      checked={showParking}
                      onChange={(e) => {
                        setShowParking(e.target.checked);
                        if (!e.target.checked) setParkingPredictionHours(0);
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    🚛 Truck Parking
                  </label>
                  {showParking && (
                    <div style={{ marginTop: '8px', marginLeft: '24px', fontSize: '12px' }}>
                      <div style={{ color: '#6b7280', marginBottom: '4px' }}>Predict:</div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {[0, 1, 2, 3, 6, 12, 24].map(hours => (
                          <button
                            key={hours}
                            onClick={() => setParkingPredictionHours(hours)}
                            style={{
                              padding: '4px 8px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px',
                              background: parkingPredictionHours === hours ? '#3b82f6' : 'white',
                              color: parkingPredictionHours === hours ? 'white' : '#374151',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: parkingPredictionHours === hours ? '600' : '400'
                            }}
                          >
                            {hours === 0 ? 'Now' : `${hours}h`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bridge Clearances Toggle */}
                <div style={{ padding: '10px 16px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#374151'
                  }}>
                    <input
                      type="checkbox"
                      checked={showBridgeClearances}
                      onChange={(e) => setShowBridgeClearances(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    🌉 Bridge Clearances
                  </label>
                </div>

                {/* OS/OW Regulations Toggle */}
                <div style={{ padding: '10px 16px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#374151'
                  }}>
                    <input
                      type="checkbox"
                      checked={showCorridorRegulations}
                      onChange={(e) => setShowCorridorRegulations(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    🛣️ State OS/OW Regulations
                  </label>
                </div>

              </div>
            )}
          </div>

          {/* Documentation */}
          <button
            className={`toggle-btn ${view === 'docs' ? 'active' : ''}`}
            onClick={() => setView('docs')}
          >
            📚 Docs
          </button>

          {currentUser?.role === 'admin' && (
            <div style={{ position: 'relative' }}>
              <button
                className={`toggle-btn ${['admin', 'adminUsers', 'adminFeeds'].includes(view) ? 'active' : ''}`}
                onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                style={{
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
                  zIndex: 10000,
                  minWidth: '180px',
                  overflow: 'hidden',
                  border: '1px solid #e5e7eb'
                }}>
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
          </>
        )}

        {error && view !== 'admin' && view !== 'adminUsers' && view !== 'messages' && view !== 'alignment' && (
          <div className="error-banner">
            Error loading events: {error}
          </div>
        )}

        {view === 'feedSubmission' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <FeedSubmission authToken={authToken} user={currentUser} />
          </div>
        ) : view === 'grants' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <FundingOpportunities />
          </div>
        ) : view === 'nasco-regulations' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <NASCOCorridorRegulationsView darkMode={isDarkMode} />
          </div>
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
        ) : view === 'digitalInfrastructure' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <DigitalInfrastructure />
          </div>
        ) : view === 'standardsCrosswalk' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <DigitalStandardsCrosswalk />
          </div>
        ) : view === 'vendorPortal' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <VendorPortal />
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
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <APIDocumentationViewer />
          </div>
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

            {/* CCAI Logo Overlay */}
            <div style={{
              position: logoIntroComplete ? 'absolute' : 'fixed',
              top: logoIntroComplete ? '80px' : '50%',
              left: logoIntroComplete ? '20px' : '50%',
              transform: logoIntroComplete ? 'translate(0, 0)' : 'translate(-50%, -50%)',
              zIndex: logoIntroComplete ? 10000 : 20000,
              pointerEvents: 'none',
              transition: 'all 1.5s ease-in-out',
              backgroundColor: logoIntroComplete ? 'transparent' : 'white',
              width: logoIntroComplete ? 'auto' : '100vw',
              height: logoIntroComplete ? 'auto' : '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src="/assets/ccai-logo.png"
                alt="Connected Corridor Advancement Initiative Logo"
                style={{
                  height: logoIntroComplete ? '120px' : '60vh',
                  maxHeight: logoIntroComplete ? '120px' : '80vh',
                  maxWidth: logoIntroComplete ? 'none' : '90vw',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                  transition: 'all 1.5s ease-in-out'
                }}
              />
            </div>

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
                  showBridgeClearances={showBridgeClearances}
                  showCorridorRegulations={showCorridorRegulations}
                  showITSEquipment={showITSEquipment}
                  itsEquipmentRoute={itsEquipmentRoute}
                  itsEquipmentType={itsEquipmentType}
                  interstateOnly={interstateOnly}
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
              onToggleInterstateOnly={() => setInterstateOnly(prev => !prev)}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              onFilterSeverity={handleFilterSeverity}
              onExport={() => setShowExportMenu(true)}
              autoRefresh={autoRefresh}
              showParking={showParking}
              showInterchanges={showInterchanges}
              interstateOnly={interstateOnly}
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
            ) : view === 'tetcGrading' ? (
              <TETCDataGrading />
            ) : view === 'vendorComparison' ? (
              <VendorDQIComparison />
            ) : view === 'gapAnalysis' ? (
              <VendorGapAnalysis />
            ) : view === 'coverageGaps' ? (
              <CoverageGapAnalysis />
            ) : view === 'vendorLeaderboard' ? (
              <VendorLeaderboard />
            ) : view === 'stateQualityRankings' ? (
              <StateQualityDashboard />
            ) : view === 'predictiveAnalytics' ? (
              <PredictiveAnalyticsDashboard />
            ) : view === 'eventConfidence' ? (
              <EventConfidenceDashboard />
            ) : view === 'procurement' ? (
              <ProcurementDashboard />
            ) : view === 'assetHealth' ? (
              <AssetHealthDashboard />
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
          isDarkMode={isDarkMode}
          context={
            parkingContext ? parkingContext :
            filters.corridor ? {
              type: 'corridor',
              data: {
                corridor: filters.corridor,
                events: filteredEvents.filter(e =>
                  e.corridor && e.corridor.toLowerCase().includes(filters.corridor.toLowerCase())
                )
              }
            } :
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

      {/* Alerts Modal */}
      {showAlertsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f9fafb'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#111827' }}>
                🚨 Detour & Bridge Alerts
              </h2>
              <button
                onClick={() => setShowAlertsModal(false)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '24px',
                  color: '#6b7280',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#e5e7eb'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px'
            }}>
              {authToken && (
                <DetourAlerts
                  authToken={authToken}
                  isDarkMode={isDarkMode}
                  onViewOnMap={(event) => {
                    setShowAlertsModal(false);
                    if (view !== 'map') {
                      setView('map');
                    }
                    setSelectedEvent(event);
                  }}
                />
              )}

              <BridgeClearanceWarnings
                isDarkMode={isDarkMode}
                onViewOnMap={(event) => {
                  setShowAlertsModal(false);
                  if (view !== 'map') {
                    setView('map');
                  }
                  setSelectedEvent(event);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

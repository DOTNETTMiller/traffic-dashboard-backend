import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import axios from 'axios';
import { useTrafficData } from './hooks/useTrafficData';
import { config } from './config';
import api from './services/api';
import './styles/textVisibility.css';
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
import ActivityTimeline from './components/ActivityTimeline';
import DarkModeToggle from './components/DarkModeToggle';
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
import Calendar from './components/Calendar';
import DocumentationViewer from './components/DocumentationViewer';
import ChatWidget from './components/ChatWidget';
import UserProfile from './components/UserProfile';
import CommunityContribution from './components/CommunityContribution';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import IPAWSRulesConfig from './components/IPAWSRulesConfig';
import IPAWSActiveAlertsManager from './components/IPAWSActiveAlertsManager';
import IPAWSAfterActionReview from './components/IPAWSAfterActionReview';
import ClosureApprovalDashboard from './components/ClosureApprovalDashboard';
import DMSMessagingPanel from './components/DMSMessagingPanel';
import DiversionRoutePanel from './components/DiversionRoutePanel';
import NavSidebar from './components/NavSidebar';
import IntroSplash from './components/IntroSplash';
import './styles/App.css';

// Lazy load heavy components (reduces initial bundle by ~4 MB)
const ExportMenu = lazy(() => import('./components/ExportMenu')); // html2canvas + jspdf
const CADDModels = lazy(() => import('./components/CADDModels')); // three.js + web-ifc
const DigitalInfrastructure = lazy(() => import('./components/DigitalInfrastructure'));
const VendorPortal = lazy(() => import('./components/VendorPortal'));
const GroundTruthDashboard = lazy(() => import('./components/GroundTruthDashboard'));
const CorridorDataQuality = lazy(() => import('./components/CorridorDataQuality'));
const TETCDataGrading = lazy(() => import('./components/TETCDataGrading'));
const VendorDQIComparison = lazy(() => import('./components/VendorDQIComparison'));
const VendorGapAnalysis = lazy(() => import('./components/VendorGapAnalysis'));
const CoverageGapAnalysis = lazy(() => import('./components/CoverageGapAnalysis'));
const VendorLeaderboard = lazy(() => import('./components/VendorLeaderboard'));
const StateQualityDashboard = lazy(() => import('./components/StateQualityDashboard'));
const PredictiveAnalyticsDashboard = lazy(() => import('./components/PredictiveAnalyticsDashboard'));
const AdvancedAnalyticsDashboard = lazy(() => import('./components/AdvancedAnalyticsDashboard'));
const EventConfidenceDashboard = lazy(() => import('./components/EventConfidenceDashboard'));
const ProcurementDashboard = lazy(() => import('./components/ProcurementDashboard'));
const AssetHealthDashboard = lazy(() => import('./components/AssetHealthDashboard'));
const APIDocumentationViewer = lazy(() => import('./components/APIDocumentationViewer'));
const GrantApplications = lazy(() => import('./components/GrantApplications'));
const FundingOpportunities = lazy(() => import('./components/FundingOpportunities'));
const NASCOCorridorRegulationsView = lazy(() => import('./components/NASCOCorridorRegulationsView'));
const DigitalStandardsCrosswalk = lazy(() => import('./components/DigitalStandardsCrosswalk'));
const CorridorDelayDashboard = lazy(() => import('./components/CorridorDelayDashboard'));
const AerialOverlaysPanel = lazy(() => import('./components/AerialOverlaysPanel'));

// Loading fallback component
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    fontSize: '14px',
    color: '#6b7280'
  }}>
    Loading component...
  </div>
);

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
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showParking, setShowParking] = useState(false);
  const [parkingPredictionHours, setParkingPredictionHours] = useState(0);
  const [parkingContext, setParkingContext] = useState(null);
  const [showITSEquipment, setShowITSEquipment] = useState(false);
  const [itsEquipmentRoute, setItsEquipmentRoute] = useState(''); // Route filter for ITS equipment
  const [itsEquipmentType, setItsEquipmentType] = useState(''); // Equipment type filter (camera, dms, sensor, rsu)
  const [showCADDElements, setShowCADDElements] = useState(false);
  const [showV2XDeployments, setShowV2XDeployments] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const [showDiversionRoutes, setShowDiversionRoutes] = useState(false);
  const [showAerialOverlays, setShowAerialOverlays] = useState(false);
  const [showWeatherAlerts, setShowWeatherAlerts] = useState(false);
  const [showBorderWaitTimes, setShowBorderWaitTimes] = useState(false);
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [showInterchanges, setShowInterchanges] = useState(false); // Hidden by default - toggle to show
  const [showBridgeClearances, setShowBridgeClearances] = useState(false); // Hidden by default - toggle to show
  const [showCorridorRegulations, setShowCorridorRegulations] = useState(false); // Hidden by default - toggle to show
  const [interstateOnly, setInterstateOnly] = useState(true); // Show only interstate events by default
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile starts closed
  const [desktopMessagesOpen, setDesktopMessagesOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [detourAlerts, setDetourAlerts] = useState([]);
  const [statsExpanded, setStatsExpanded] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showIPAWSRules, setShowIPAWSRules] = useState(false);
  const [showIPAWSActiveAlerts, setShowIPAWSActiveAlerts] = useState(false);
  const [showIPAWSAfterAction, setShowIPAWSAfterAction] = useState(false);
  const [ipawsGeofence, setIpawsGeofence] = useState(null); // IPAWS geofence polygon for map display
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [heatMapActive, setHeatMapActive] = useState(false);
  const [heatMapMode, setHeatMapMode] = useState('density');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCorridorBriefing, setShowCorridorBriefing] = useState(false);
  const [hasITSEquipment, setHasITSEquipment] = useState(false);

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

    const abortController = new AbortController();

    const fetchParkingContext = async () => {
      try {
        const targetTime = new Date();
        targetTime.setHours(targetTime.getHours() + parkingPredictionHours);
        const timeParam = targetTime.toISOString();

        const response = await axios.get(`${config.apiUrl}/api/parking/historical/predict-all?time=${timeParam}`, {
          signal: abortController.signal
        });

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
        if (axios.isCancel(error)) return;
        console.error('Error fetching parking context:', error);
        // Don't set parking context on error (503, etc.)
        setParkingContext(null);
      }
    };

    fetchParkingContext();

    return () => abortController.abort();
  }, [showParking, parkingPredictionHours]);

  // Decode JWT payload (no verification - just read exp field)
  const decodeJwtExp = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null; // ms
    } catch {
      return null;
    }
  };

  // Force logout with message
  const expireSession = (reason = 'Your session has expired. Please log in again.') => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setAuthToken(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    alert(reason);
  };

  // Check for existing authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        // Check if JWT is expired before restoring session
        const expMs = decodeJwtExp(token);
        if (expMs && Date.now() >= expMs) {
          console.log('🔒 Stored token is expired - clearing session');
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          return;
        }

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

  // Schedule auto-logout when JWT expires (matches backend 7-day expiresIn)
  useEffect(() => {
    if (!authToken) return;

    const expMs = decodeJwtExp(authToken);
    if (!expMs) return;

    const msUntilExpiry = expMs - Date.now();
    if (msUntilExpiry <= 0) {
      expireSession();
      return;
    }

    console.log(`🕒 Session expires in ${Math.round(msUntilExpiry / 1000 / 60)} minutes`);
    const timer = setTimeout(() => {
      expireSession('Your session has expired. Please log in again to continue.');
    }, msUntilExpiry);

    return () => clearTimeout(timer);
  }, [authToken]);

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
      intervalId = setInterval(loadDetourAlerts, 120000); // Changed from 60s to 2min to reduce API calls
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

  // Check if event is on an interstate highway
  const isInterstateEvent = (event) => {
    const text = `${event.corridor || ''} ${event.location || ''} ${event.description || ''}`;
    if (!text.trim()) return false;
    const interstatePattern = /\b(?:I[-\s]?|Interstate\s+)(0*\d{1,3})\b/i;
    const stateRoutePattern = /\b(?:US|SR|PA|CA|KS|NV|UT|OH|NJ|MN|IN|IA|NE)[-\s]?\d{1,3}\b/i;
    return interstatePattern.test(text) && !stateRoutePattern.test(event.corridor || '');
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
      // Interstate-only filter
      if (interstateOnly && !isInterstateEvent(event)) return false;

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
  }, [events, filters, interstateOnly]);

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
      {/* Intro splash — plays once per session, then unmounts */}
      <IntroSplash targetSelector=".title-logo" />
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="title">
            <img
              className="title-logo"
              src="/assets/sandbox-logo.png"
              alt="Matt's Experimental Sandbox"
            />
            <span style={{
              fontSize: '11px',
              fontWeight: '400',
              marginLeft: '12px',
              opacity: '0.7'
            }}>
              by Matt Miller, CPM
            </span>
          </h1>
          <div className="header-info">
            {currentUser && (
              <span className="user-info" title={currentUser.organization || ''}>
                {currentUser.fullName || currentUser.username || 'User'}
              </span>
            )}
            <div className="header-meta">
              {lastUpdate && (
                <span className="header-meta-line">
                  Updated {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
            <div className="header-metric" title="Events currently in view">
              <span className="header-metric-value">
                {filteredEvents.length.toLocaleString()}
              </span>
              <span className="header-metric-label">
                {filteredEvents.length === 1 ? 'Event' : 'Events'}
              </span>
            </div>
            <div className="tim-links">
              <a
                href={`${config.apiUrl}/api/convert/tim`}
                target="_blank"
                rel="noopener noreferrer"
                className="tim-link"
                title="SAE J2735 Traveler Information Message feed for connected vehicles"
              >
                📡 TIM
              </a>
              <a
                href={`${config.apiUrl}/api/convert/tim-cv`}
                target="_blank"
                rel="noopener noreferrer"
                className="tim-link"
                title="SAE J2540 Commercial Vehicle TIM feed with truck-specific advisories"
              >
                🚛 CV-TIM
              </a>
              <a
                href={`${config.apiUrl}/api/convert/cifs`}
                target="_blank"
                rel="noopener noreferrer"
                className="tim-link"
                title="Common Incident Feed Specification"
              >
                🚨 CIFS
              </a>
              <a
                href={`${config.apiUrl}/api/wzdx/feed`}
                target="_blank"
                rel="noopener noreferrer"
                className="tim-link"
                title="WZDx v4.2 Work Zone Data Exchange feed - USDOT standard for work zones and incidents"
              >
                🚧 WZDx
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
              className={`chrome-btn ${view === 'profile' ? 'is-active' : ''}`}
              style={{ marginLeft: '8px' }}
            >
              Profile
            </button>
            <button
              onClick={handleLogout}
              className="chrome-btn chrome-btn--destructive"
              style={{ marginLeft: '6px' }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Nav rail — must NOT be a descendant of any element with
          backdrop-filter (e.g. .controls). Per the CSS spec, those
          properties change the containing block for position:fixed
          descendants, which would pin the rail inside that ancestor
          instead of the viewport. */}
      <NavSidebar
        view={view}
        onViewChange={setView}
        isAdmin={currentUser?.role === "admin"}
        chatOpen={chatOpen}
        messagesOpen={desktopMessagesOpen}
        mapLayerStates={{
          showEvents,
          showParking,
          showITSEquipment,
          showV2XDeployments,
          showCADDElements,
          showInterchanges,
          showBridgeClearances,
          showCorridorRegulations,
          showDiversionRoutes,
          showAerialOverlays,
          showWeatherAlerts,
          showBorderWaitTimes,
          interstateOnly
        }}
        actions={{
          'open-corridor-briefing': () => setShowCorridorBriefing(true),
          'open-alerts':            () => setShowAlertsModal(true),
          'open-ipaws-active':      () => setShowIPAWSActiveAlerts(true),
          'open-ipaws-rules':       () => setShowIPAWSRules(true),
          'open-ipaws-after-action': () => setShowIPAWSAfterAction(true),
          // Quick actions (formerly the floating ⚡ menu)
          'open-command-palette':   () => setCommandPaletteOpen(true),
          'refresh-data':           () => refetch(),
          'clear-filters':          () => handleClearFilters(),
          'export-data':            () => setShowExportMenu(true),
          'toggle-interstate-only': () => setInterstateOnly(p => !p),
          // Map Layers toggles — flipping any of these layer-visibility
          // booleans navigates to the map view first so the user actually
          // sees what they just turned on.
          'toggle-events':             () => { setView('map'); setShowEvents(p => !p); },
          'toggle-parking':            () => { setView('map'); setShowParking(p => !p); },
          'toggle-its-equipment':      () => { setView('map'); setShowITSEquipment(p => !p); },
          'toggle-v2x':                () => { setView('map'); setShowV2XDeployments(p => !p); },
          'toggle-cadd':               () => { setView('map'); setShowCADDElements(p => !p); },
          'toggle-interchanges':       () => { setView('map'); setShowInterchanges(p => !p); },
          'toggle-bridge-clearance':   () => { setView('map'); setShowBridgeClearances(p => !p); },
          'toggle-corridor-regs':      () => { setView('map'); setShowCorridorRegulations(p => !p); },
          'toggle-diversion-routes':   () => { setView('map'); setShowDiversionRoutes(p => !p); },
          'toggle-aerial-overlays':    () => { setView('map'); setShowAerialOverlays(p => !p); },
          'toggle-weather-alerts':     () => { setView('map'); setShowWeatherAlerts(p => !p); },
          'toggle-border-wait-times':  () => { setView('map'); setShowBorderWaitTimes(p => !p); },
          'open-aerial-overlays':      () => setView('aerialOverlays'),
          // Toggling either footer item closes the other so only one
          // secondary panel shows at a time (single-pane sidebar UX).
          'toggle-ai':       () => { setChatOpen(o => !o); setDesktopMessagesOpen(false); },
          'toggle-messages': () => { setDesktopMessagesOpen(o => !o); setChatOpen(false); }
        }}
        secondary={
          chatOpen && currentUser ? (
            <ChatWidget
              user={currentUser}
              isDarkMode={isDarkMode}
              isOpen={true}
              onOpenChange={setChatOpen}
              showFloatingButton={false}
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
                } : null
              }
            />
          ) : desktopMessagesOpen && !ipawsGeofence ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '12px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <LiveStatistics
                  events={filteredEvents}
                  isExpanded={statsExpanded}
                  onToggle={() => setStatsExpanded(!statsExpanded)}
                />
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <MessagesPanel
                  events={filteredEvents}
                  messages={messages}
                  detourAlerts={detourAlerts}
                  filters={filters}
                  onEventSelect={(event) => {
                    setSelectedEvent(event);
                  }}
                  onClose={() => setDesktopMessagesOpen(false)}
                />
              </div>
            </div>
          ) : null
        }
      />

      {/* Controls */}
      <div className="controls">
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
        {view !== 'report' && view !== 'alignment' && view !== 'admin' && view !== 'adminUsers' && view !== 'messages' && view !== 'closureApproval' && view !== 'dmsMessaging' && view !== 'diversionRoutes' && (
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

        {error && view !== 'admin' && view !== 'adminUsers' && view !== 'messages' && view !== 'alignment' && view !== 'closureApproval' && view !== 'dmsMessaging' && view !== 'diversionRoutes' && (
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
            <Suspense fallback={<LoadingFallback />}>
              <FundingOpportunities />
            </Suspense>
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
            <Suspense fallback={<LoadingFallback />}>
              <NASCOCorridorRegulationsView darkMode={isDarkMode} />
            </Suspense>
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
            <Suspense fallback={<LoadingFallback />}>
              <GroundTruthDashboard authToken={authToken} currentUser={currentUser} />
            </Suspense>
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
            <Suspense fallback={<LoadingFallback />}>
              <DigitalInfrastructure />
            </Suspense>
          </div>
        ) : view === 'caddModels' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <Suspense fallback={<LoadingFallback />}>
              <CADDModels />
            </Suspense>
          </div>
        ) : view === 'closureApproval' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <ClosureApprovalDashboard
              userState={currentUser?.state}
              onClose={() => setView('map')}
            />
          </div>
        ) : view === 'dmsMessaging' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <DMSMessagingPanel
              selectedEvent={selectedEvent}
              onClose={() => setView('map')}
            />
          </div>
        ) : view === 'aerialOverlays' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <Suspense fallback={<LoadingFallback />}>
              <AerialOverlaysPanel />
            </Suspense>
          </div>
        ) : view === 'diversionRoutes' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <DiversionRoutePanel
              onClose={() => setView('map')}
            />
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
            <Suspense fallback={<LoadingFallback />}>
              <DigitalStandardsCrosswalk />
            </Suspense>
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
            <Suspense fallback={<LoadingFallback />}>
              <VendorPortal />
            </Suspense>
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
            <Suspense fallback={<LoadingFallback />}>
              <APIDocumentationViewer />
            </Suspense>
          </div>
        ) : view === 'map' ? (
          <>
            {/* Mobile overlay */}
            <div
              className={`mobile-messages-overlay ${mobileMenuOpen ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Messages toggle is now in the NavSidebar (Inbox item).
                Floating bubble removed because the rail covered it. */}

            {/* Sandbox indicator now lives as a small pill in the header chrome
                (.sandbox-pill). The big intro/overlay logo was removed because
                it fought with the new design language. The intro splash, if
                desired, can be reintroduced as a brief fade-in dialog. */}

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
              {/* Messages panel is now rendered inside the NavSidebar's
                  secondary slot — see <NavSidebar secondary={...}> above. */}
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
                  ipawsGeofence={ipawsGeofence}
                  onGeofenceUpdate={setIpawsGeofence}
                  showITSEquipment={showITSEquipment}
                  itsEquipmentRoute={itsEquipmentRoute}
                  itsEquipmentType={itsEquipmentType}
                  showCADDElements={showCADDElements}
                  showV2XDeployments={showV2XDeployments}
                  showEvents={showEvents}
                  showDiversionRoutes={showDiversionRoutes}
                  showAerialOverlays={showAerialOverlays}
                  showWeatherAlerts={showWeatherAlerts}
                  showBorderWaitTimes={showBorderWaitTimes}
                  interstateOnly={interstateOnly}
                  heatMapActive={heatMapActive}
                  heatMapMode={heatMapMode}
                  onHeatMapToggle={setHeatMapActive}
                  onHeatMapModeChange={setHeatMapMode}
                  isDarkMode={isDarkMode}
                  stateKey={currentUser?.stateKey || null}
                />
              </div>
            </div>

            {/* Floating ⚡ QuickActionToolbar removed — its actions
                (Command Palette, Refresh, Clear Filters, Export, Interstate
                Only) live in the new "Actions" group in the left rail.
                Parking + Interchanges moved to the "Map Layers" group. */}
          </>
        ) : (
          <div className="view-container" key={view}>
            {view === 'table' ? (
              <EventTable
                events={filteredEvents}
                messages={messages}
                loading={loading}
                onGeofenceUpdate={setIpawsGeofence}
                onEventSelect={(event) => {
                  setSelectedEvent(event);
                  setView('map');
                }}
              />
            ) : view === 'timeline' ? (
              <ActivityTimeline
                events={filteredEvents}
                messages={messages}
                loading={loading}
              />
            ) : view === 'dashboard' ? (
              <DashboardWidgets
                events={filteredEvents}
                loading={loading}
              />
            ) : view === 'calendar' ? (
              <Calendar authToken={authToken} currentUser={currentUser} />
            ) : view === 'report' ? (
              <DataQualityReport />
            ) : view === 'tetcGrading' ? (
              <Suspense fallback={<LoadingFallback />}>
                <TETCDataGrading />
              </Suspense>
            ) : view === 'vendorComparison' ? (
              <Suspense fallback={<LoadingFallback />}>
                <VendorDQIComparison />
              </Suspense>
            ) : view === 'gapAnalysis' ? (
              <Suspense fallback={<LoadingFallback />}>
                <VendorGapAnalysis />
              </Suspense>
            ) : view === 'coverageGaps' ? (
              <Suspense fallback={<LoadingFallback />}>
                <CoverageGapAnalysis />
              </Suspense>
            ) : view === 'community' ? (
              <CommunityContribution />
            ) : view === 'advancedAnalytics' ? (
              <Suspense fallback={<LoadingFallback />}>
                <AdvancedAnalyticsDashboard />
              </Suspense>
            ) : view === 'vendorLeaderboard' ? (
              <Suspense fallback={<LoadingFallback />}>
                <VendorLeaderboard />
              </Suspense>
            ) : view === 'stateQualityRankings' ? (
              <Suspense fallback={<LoadingFallback />}>
                <StateQualityDashboard />
              </Suspense>
            ) : view === 'predictiveAnalytics' ? (
              <Suspense fallback={<LoadingFallback />}>
                <PredictiveAnalyticsDashboard />
              </Suspense>
            ) : view === 'eventConfidence' ? (
              <Suspense fallback={<LoadingFallback />}>
                <EventConfidenceDashboard />
              </Suspense>
            ) : view === 'procurement' ? (
              <Suspense fallback={<LoadingFallback />}>
                <ProcurementDashboard />
              </Suspense>
            ) : view === 'assetHealth' ? (
              <Suspense fallback={<LoadingFallback />}>
                <AssetHealthDashboard />
              </Suspense>
            ) : view === 'corridorDelays' ? (
              <Suspense fallback={<LoadingFallback />}>
                <CorridorDelayDashboard />
              </Suspense>
            ) : null}
          </div>
        )}
      </div>

      {/* Messaging Modal - hide when IPAWS geofence is active */}
      {selectedEvent && !ipawsGeofence && (
        <EventMessaging
          event={selectedEvent}
          messages={eventMessages}
          onSendMessage={handleCommentAdded}
          onClose={() => setSelectedEvent(null)}
          currentUser={currentUser}
        />
      )}

      {/* AI Chat Widget moved into NavSidebar's secondary slot —
          see <NavSidebar secondary={...}> above. */}

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
        <Suspense fallback={<LoadingFallback />}>
          <ExportMenu
            events={filteredEvents}
            messages={messages}
            onClose={() => setShowExportMenu(false)}
          />
        </Suspense>
      )}

      {/* Corridor Briefing */}
      {showCorridorBriefing && (
        <CorridorBriefing
          events={filteredEvents}
          detourAlerts={detourAlerts}
          onClose={() => setShowCorridorBriefing(false)}
        />
      )}

      {/* IPAWS Rules Configuration */}
      {showIPAWSRules && (
        <IPAWSRulesConfig
          onClose={() => setShowIPAWSRules(false)}
        />
      )}

      {/* IPAWS Active Alerts Manager */}
      {showIPAWSActiveAlerts && (
        <IPAWSActiveAlertsManager
          onClose={() => setShowIPAWSActiveAlerts(false)}
        />
      )}

      {/* IPAWS After-Action Review */}
      {showIPAWSAfterAction && (
        <IPAWSAfterActionReview
          onClose={() => setShowIPAWSAfterAction(false)}
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

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}

export default App;

import { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { useTrafficData } from './hooks/useTrafficData';
import { config } from './config';
import TrafficMap from './components/TrafficMap';
import EventTable from './components/EventTable';
import EventFilters from './components/EventFilters';
import EventMessaging from './components/EventMessaging';
import DataQualityReport from './components/DataQualityReport';
import MessagesPanel from './components/MessagesPanel';
import './styles/App.css';

function App() {
  const [view, setView] = useState('map'); // 'map', 'table', or 'report'
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

  // Fetch traffic data with auto-refresh (60 seconds)
  const { events, loading, error, lastUpdate, refetch } = useTrafficData(
    autoRefresh ? 60000 : null
  );

  // Load messages from backend on mount
  useEffect(() => {
    loadMessagesFromAPI();
  }, []);

  const loadMessagesFromAPI = async () => {
    try {
      setLoadingMessages(true);
      const response = await axios.get(`${config.apiUrl}/api/messages`);

      if (response.data.success) {
        // Convert array to object grouped by eventId
        const messagesByEvent = {};
        response.data.messages.forEach(msg => {
          if (!messagesByEvent[msg.eventId]) {
            messagesByEvent[msg.eventId] = [];
          }
          messagesByEvent[msg.eventId].push(msg);
        });
        setMessages(messagesByEvent);
        console.log('💬 Loaded', response.data.count, 'messages from server');
      }
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

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="title">DOT Corridor Communicator</h1>
          <div className="header-info">
            {lastUpdate && (
              <span className="last-update">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <span className="event-count">
              {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
            </span>
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
        {view !== 'report' && (
          <EventFilters
            events={events}
            filters={filters}
            onFilterChange={setFilters}
          />
        )}

        {error && (
          <div className="error-banner">
            Error loading events: {error}
          </div>
        )}

        {view === 'map' ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'row',
            minHeight: 0,
            overflow: 'hidden',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <MessagesPanel
              events={filteredEvents}
              messages={messages}
              filters={filters}
              onEventSelect={setSelectedEvent}
            />
            <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
              <TrafficMap
                events={filteredEvents}
                messages={messages}
                onEventSelect={setSelectedEvent}
                selectedEvent={selectedEvent}
              />
            </div>
          </div>
        ) : (
          <div className="view-container">
            {view === 'table' ? (
              <EventTable
                events={filteredEvents}
                messages={messages}
                onEventSelect={setSelectedEvent}
              />
            ) : (
              <DataQualityReport />
            )}
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
        />
      )}
    </div>
  );
}

export default App;

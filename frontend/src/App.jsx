import { useState, useMemo } from 'react';
import { useTrafficData } from './hooks/useTrafficData';
import TrafficMap from './components/TrafficMap';
import EventTable from './components/EventTable';
import EventFilters from './components/EventFilters';
import EventMessaging from './components/EventMessaging';
import './styles/App.css';

function App() {
  const [view, setView] = useState('map'); // 'map' or 'table'
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

  // Fetch traffic data with auto-refresh (60 seconds)
  const { events, loading, error, lastUpdate, refetch } = useTrafficData(
    autoRefresh ? 60000 : null
  );

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

  const handleSendMessage = (message) => {
    setMessages(prev => ({
      ...prev,
      [message.eventId]: [...(prev[message.eventId] || []), message]
    }));
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
        <EventFilters
          events={events}
          filters={filters}
          onFilterChange={setFilters}
        />

        {error && (
          <div className="error-banner">
            Error loading events: {error}
          </div>
        )}

        <div className="view-container">
          {view === 'map' ? (
            <TrafficMap
              events={filteredEvents}
              messages={messages}
              onEventSelect={setSelectedEvent}
            />
          ) : (
            <EventTable
              events={filteredEvents}
              onEventSelect={setSelectedEvent}
            />
          )}
        </div>
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

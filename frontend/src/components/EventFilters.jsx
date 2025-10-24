import { useMemo, useState, useEffect } from 'react';

export default function EventFilters({ events, filters, onFilterChange }) {
  // Start collapsed on mobile, expanded on desktop
  const [isExpanded, setIsExpanded] = useState(window.innerWidth > 768);
  // Extract unique values for filters
  const filterOptions = useMemo(() => {
    const states = [...new Set(events.map(e => e.state))].sort();

    // Only show interstate corridors (I-XX format)
    const uniqueCorridors = [...new Set(events.map(e => e.corridor))]
      .filter(Boolean)
      .filter(corridor => corridor.startsWith('I-')); // Only interstate corridors

    const corridors = uniqueCorridors.sort((a, b) => {
      // Extract numbers from I-XX format for numerical sorting
      const getNumber = (corridor) => {
        const match = corridor.match(/^I-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      };
      return getNumber(a) - getNumber(b);
    });

    const eventTypes = [...new Set(events.map(e => e.eventType))].filter(Boolean).sort();
    const severities = ['high', 'medium', 'low'];

    return { states, corridors, eventTypes, severities };
  }, [events]);

  const handleChange = (filterType, value) => {
    onFilterChange({
      ...filters,
      [filterType]: value
    });
  };

  const handleReset = () => {
    onFilterChange({
      state: '',
      corridor: '',
      eventType: '',
      severity: '',
      search: ''
    });
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  return (
    <div className="event-filters-container" style={{
      padding: '16px',
      backgroundColor: '#f3f4f6',
      borderRadius: '8px',
      marginBottom: '16px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: isExpanded ? '16px' : '0',
        cursor: 'pointer'
      }}
      onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Filters {activeFilterCount > 0 && `(${activeFilterCount} active)`}
          <span className="mobile-toggle-icon" style={{ marginLeft: '8px', fontSize: '12px' }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </h3>
        {activeFilterCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReset();
            }}
            style={{
              padding: '4px 12px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Clear All
          </button>
        )}
      </div>

      <div className="filters-content" style={{
        display: isExpanded ? 'grid' : 'none',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        transition: 'all 0.3s ease'
      }}>
        {/* Search */}
        <div>
          <label style={labelStyle}>Search</label>
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => handleChange('search', e.target.value)}
            placeholder="Search location, description..."
            style={inputStyle}
          />
        </div>

        {/* State Filter */}
        <div>
          <label style={labelStyle}>State</label>
          <select
            value={filters.state || ''}
            onChange={(e) => handleChange('state', e.target.value)}
            style={inputStyle}
          >
            <option value="">All States</option>
            {filterOptions.states.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>

        {/* Corridor Filter */}
        <div>
          <label style={labelStyle}>Corridor</label>
          <select
            value={filters.corridor || ''}
            onChange={(e) => handleChange('corridor', e.target.value)}
            style={inputStyle}
          >
            <option value="">All Corridors</option>
            {filterOptions.corridors.map(corridor => (
              <option key={corridor} value={corridor}>{corridor}</option>
            ))}
          </select>
        </div>

        {/* Event Type Filter */}
        <div>
          <label style={labelStyle}>Event Type</label>
          <select
            value={filters.eventType || ''}
            onChange={(e) => handleChange('eventType', e.target.value)}
            style={inputStyle}
          >
            <option value="">All Types</option>
            {filterOptions.eventTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Severity Filter */}
        <div>
          <label style={labelStyle}>Severity</label>
          <select
            value={filters.severity || ''}
            onChange={(e) => handleChange('severity', e.target.value)}
            style={inputStyle}
          >
            <option value="">All Severities</option>
            {filterOptions.severities.map(severity => (
              <option key={severity} value={severity}>
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  marginBottom: '4px',
  fontSize: '12px',
  fontWeight: '500',
  color: '#374151'
};

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  fontSize: '14px',
  backgroundColor: 'white'
};

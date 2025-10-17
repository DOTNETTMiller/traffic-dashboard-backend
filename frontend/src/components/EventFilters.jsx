import { useMemo } from 'react';

export default function EventFilters({ events, filters, onFilterChange }) {
  // Extract unique values for filters
  const filterOptions = useMemo(() => {
    const states = [...new Set(events.map(e => e.state))].sort();
    const corridors = [...new Set(events.map(e => e.corridor))].filter(Boolean).sort();
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
    <div style={{
      padding: '16px',
      backgroundColor: '#f3f4f6',
      borderRadius: '8px',
      marginBottom: '16px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Filters {activeFilterCount > 0 && `(${activeFilterCount} active)`}
        </h3>
        {activeFilterCount > 0 && (
          <button
            onClick={handleReset}
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

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px'
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

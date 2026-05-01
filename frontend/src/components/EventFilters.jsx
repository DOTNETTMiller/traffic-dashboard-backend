import { useMemo, useState, useEffect } from 'react';
import { theme } from '../styles/theme';
import AdvancedSearch from './AdvancedSearch';

export default function EventFilters({ events, filters, onFilterChange }) {
  // Start collapsed by default to save space
  const [isExpanded, setIsExpanded] = useState(false);
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
      background: '#ffffff',
      border: '1px solid rgba(0, 0, 0, 0.08)',
      padding: theme.spacing.md,
      borderRadius: '14px',
      marginBottom: theme.spacing.sm,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
      transition: 'box-shadow 200ms cubic-bezier(0.32, 0.72, 0, 1)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: isExpanded ? theme.spacing.sm : '0',
        cursor: 'pointer',
        transition: theme.transitions.all
      }}
      onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 style={{
          margin: 0,
          fontSize: theme.fontSize.base,
          fontWeight: theme.fontWeight.semibold,
          color: theme.colors.gray[800]
        }}>
          Filters {activeFilterCount > 0 && `(${activeFilterCount} active)`}
          <span style={{
            marginLeft: theme.spacing.sm,
            fontSize: theme.fontSize.xs,
            transition: theme.transitions.base,
            display: 'inline-block',
            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'
          }}>
            ▼
          </span>
        </h3>
        {activeFilterCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReset();
            }}
            style={{
              padding: '5px 12px',
              backgroundColor: 'transparent',
              color: '#6e6e73',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              borderRadius: '999px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              fontFamily: 'inherit',
              letterSpacing: '-0.005em',
              transition: 'background-color 200ms cubic-bezier(0.32, 0.72, 0, 1), color 200ms cubic-bezier(0.32, 0.72, 0, 1)'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(216, 58, 58, 0.08)';
              e.target.style.color = '#d83a3a';
              e.target.style.borderColor = 'rgba(216, 58, 58, 0.32)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = '#6e6e73';
              e.target.style.borderColor = 'rgba(0, 0, 0, 0.12)';
            }}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="filters-content" style={{
        display: isExpanded ? 'grid' : 'none',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: theme.spacing.md,
        transition: theme.transitions.slow,
        opacity: isExpanded ? 1 : 0,
        maxHeight: isExpanded ? '500px' : '0',
        overflow: 'hidden'
      }}>
        {/* Advanced Search */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Search</label>
          <AdvancedSearch
            events={events}
            onSearch={(searchTerm) => handleChange('search', searchTerm)}
            placeholder="Search locations, corridors, states..."
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
  marginBottom: theme.spacing.xs,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  color: theme.colors.gray[700]
};

const inputStyle = {
  width: '100%',
  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
  border: `1px solid ${theme.colors.gray[300]}`,
  borderRadius: theme.borderRadius.md,
  fontSize: theme.fontSize.base,
  backgroundColor: theme.colors.white,
  transition: theme.transitions.base,
  outline: 'none',
  ':focus': {
    borderColor: theme.colors.primary.main,
    boxShadow: `0 0 0 3px ${theme.colors.primary.main}20`
  }
};

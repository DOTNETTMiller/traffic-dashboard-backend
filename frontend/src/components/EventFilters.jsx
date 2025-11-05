import { useMemo, useState, useEffect } from 'react';
import { theme } from '../styles/theme';

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
      ...theme.glass.light,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      marginBottom: theme.spacing.sm,
      boxShadow: theme.shadows.md,
      transition: theme.transitions.all
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
              padding: `${theme.spacing.xs} ${theme.spacing.md}`,
              backgroundColor: theme.colors.error.main,
              color: theme.colors.white,
              border: 'none',
              borderRadius: theme.borderRadius.md,
              cursor: 'pointer',
              fontSize: theme.fontSize.sm,
              fontWeight: theme.fontWeight.medium,
              transition: theme.transitions.all,
              boxShadow: theme.shadows.sm
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = theme.colors.error.dark}
            onMouseLeave={(e) => e.target.style.backgroundColor = theme.colors.error.main}
          >
            Clear All
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

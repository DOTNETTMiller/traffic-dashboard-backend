import { useState, useEffect, useRef, useMemo } from 'react';
import { theme } from '../styles/theme';

export default function AdvancedSearch({ events, onSearch, placeholder = "Search events..." }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchHistory, setSearchHistory] = useState(() => {
    const saved = localStorage.getItem('searchHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Extract unique values from events for autocomplete
  const suggestions = useMemo(() => {
    const locations = new Set();
    const corridors = new Set();
    const states = new Set();
    const descriptions = new Set();

    events.forEach(event => {
      if (event.location) locations.add(event.location);
      if (event.corridor) corridors.add(event.corridor);
      if (event.state) states.add(event.state);
      if (event.description) {
        // Extract significant words from description
        event.description.split(/\s+/).forEach(word => {
          if (word.length > 3) {
            descriptions.add(word.toLowerCase());
          }
        });
      }
    });

    return {
      locations: Array.from(locations),
      corridors: Array.from(corridors),
      states: Array.from(states),
      descriptions: Array.from(descriptions)
    };
  }, [events]);

  // Generate autocomplete suggestions
  const autocompleteSuggestions = useMemo(() => {
    if (!query.trim() || query.length < 2) {
      return searchHistory.slice(0, 5).map(term => ({
        type: 'history',
        value: term,
        label: term,
        icon: '🕐'
      }));
    }

    const queryLower = query.toLowerCase();
    const results = [];

    // Match locations
    suggestions.locations.forEach(location => {
      if (location.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'location',
          value: location,
          label: location,
          icon: '📍',
          score: location.toLowerCase().startsWith(queryLower) ? 10 : 5
        });
      }
    });

    // Match corridors
    suggestions.corridors.forEach(corridor => {
      if (corridor.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'corridor',
          value: corridor,
          label: corridor,
          icon: '🛣️',
          score: corridor.toLowerCase().startsWith(queryLower) ? 10 : 5
        });
      }
    });

    // Match states
    suggestions.states.forEach(state => {
      if (state.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'state',
          value: state,
          label: state,
          icon: '🏛️',
          score: state.toLowerCase().startsWith(queryLower) ? 10 : 5
        });
      }
    });

    // Sort by relevance score
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, 8);
  }, [query, suggestions, searchHistory]);

  // Handle search
  const handleSearch = (searchTerm) => {
    const term = searchTerm || query;
    if (!term.trim()) {
      onSearch('');
      return;
    }

    // Add to history
    const newHistory = [term, ...searchHistory.filter(h => h !== term)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));

    onSearch(term);
    setIsOpen(false);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < autocompleteSuggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : autocompleteSuggestions.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (autocompleteSuggestions[selectedIndex]) {
          setQuery(autocompleteSuggestions[selectedIndex].value);
          handleSearch(autocompleteSuggestions[selectedIndex].value);
        } else {
          handleSearch();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, autocompleteSuggestions]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clearSearch = () => {
    setQuery('');
    onSearch('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('searchHistory');
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={(e) => {
            setIsOpen(true);
            e.currentTarget.style.borderColor = theme.colors.accentBlue;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.colors.accentBlue}20`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isOpen) {
              handleSearch();
            }
          }}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '12px 48px 12px 40px',
            fontSize: '14px',
            border: `2px solid ${theme.colors.border}`,
            borderRadius: '12px',
            outline: 'none',
            transition: `all ${theme.transitions.fast}`,
            backgroundColor: 'white',
            boxShadow: isOpen ? theme.shadows.md : theme.shadows.sm
          }}
          onBlur={(e) => {
            setTimeout(() => {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.boxShadow = theme.shadows.sm;
            }, 200);
          }}
        />

        {/* Search Icon */}
        <div style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '18px',
          color: theme.colors.textSecondary,
          pointerEvents: 'none'
        }}>
          🔍
        </div>

        {/* Clear Button */}
        {query && (
          <button
            onClick={clearSearch}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: 'none',
              background: theme.colors.gray[200],
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              transition: `all ${theme.transitions.fast}`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.colors.gray[300];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.colors.gray[200];
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && autocompleteSuggestions.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: theme.spacing.xs,
            background: theme.colors.glassDark,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '12px',
            boxShadow: theme.shadows.xl,
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 1000,
            animation: 'slideDown 0.15s ease-out'
          }}
        >
          {/* History Header */}
          {query.length < 2 && searchHistory.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              borderBottom: `1px solid ${theme.colors.border}`,
              fontSize: '11px',
              fontWeight: '700',
              color: theme.colors.textSecondary,
              textTransform: 'uppercase'
            }}>
              <span>Recent Searches</span>
              <button
                onClick={clearHistory}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.accentBlue,
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '2px 6px'
                }}
              >
                Clear
              </button>
            </div>
          )}

          {/* Suggestions */}
          {autocompleteSuggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${suggestion.value}-${index}`}
              onClick={() => {
                setQuery(suggestion.value);
                handleSearch(suggestion.value);
              }}
              style={{
                padding: theme.spacing.md,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.sm,
                backgroundColor: index === selectedIndex ? `${theme.colors.accentBlue}20` : 'transparent',
                borderBottom: index < autocompleteSuggestions.length - 1 ? `1px solid ${theme.colors.border}` : 'none',
                transition: `all ${theme.transitions.fast}`
              }}
              onMouseEnter={(e) => {
                if (index !== selectedIndex) {
                  e.currentTarget.style.backgroundColor = theme.colors.glassLight;
                }
                setSelectedIndex(index);
              }}
              onMouseLeave={(e) => {
                if (index !== selectedIndex) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '18px' }}>{suggestion.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.colors.text
                }}>
                  {suggestion.label}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: theme.colors.textSecondary,
                  textTransform: 'capitalize'
                }}>
                  {suggestion.type}
                </div>
              </div>
              {index === selectedIndex && (
                <span style={{
                  fontSize: '12px',
                  color: theme.colors.accentBlue,
                  fontWeight: '600'
                }}>
                  ⏎
                </span>
              )}
            </div>
          ))}

          {/* Footer with keyboard hints */}
          <div style={{
            padding: theme.spacing.sm,
            borderTop: `1px solid ${theme.colors.border}`,
            fontSize: '11px',
            color: theme.colors.textSecondary,
            display: 'flex',
            gap: theme.spacing.md,
            justifyContent: 'center'
          }}>
            <span><kbd style={kbdStyle}>↑↓</kbd> Navigate</span>
            <span><kbd style={kbdStyle}>Enter</kbd> Select</span>
            <span><kbd style={kbdStyle}>Esc</kbd> Close</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

const kbdStyle = {
  padding: '2px 6px',
  borderRadius: '4px',
  backgroundColor: '#e5e7eb',
  border: '1px solid #d1d5db',
  fontFamily: 'monospace',
  fontSize: '10px',
  fontWeight: '700',
  marginRight: '4px'
};

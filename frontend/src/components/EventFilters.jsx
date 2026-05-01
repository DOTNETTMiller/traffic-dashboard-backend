import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AdvancedSearch from './AdvancedSearch';

/**
 * Filters trigger button (in line with the rest of the controls bar) that
 * opens a right-side sheet. Replaces the previous inline disclosure.
 */
export default function EventFilters({ events, filters, onFilterChange }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const filterOptions = useMemo(() => {
    const states = [...new Set(events.map(e => e.state))].sort();

    const uniqueCorridors = [...new Set(events.map(e => e.corridor))]
      .filter(Boolean)
      .filter(corridor => corridor.startsWith('I-'));

    const corridors = uniqueCorridors.sort((a, b) => {
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
    onFilterChange({ ...filters, [filterType]: value });
  };

  const handleReset = () => {
    onFilterChange({ state: '', corridor: '', eventType: '', severity: '', search: '' });
  };

  const requestClose = () => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 240);
  };

  // Lock body scroll while sheet is open. ESC to close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="filters-trigger"
        style={triggerStyle}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {/* Sliders icon (SF Symbols-like) */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 3.5h7M11 3.5h1M2 10.5h1M5 10.5h7" stroke="currentColor"
                  strokeWidth="1.4" strokeLinecap="round"/>
            <circle cx="10" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
            <circle cx="4" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span style={badgeStyle}>{activeFilterCount}</span>
          )}
        </span>
      </button>

      {open && createPortal(
        <>
          <div
            className={`cc-sheet-backdrop ${closing ? 'is-closing' : ''}`}
            onClick={requestClose}
          />
          <aside
            className={`cc-sheet ${closing ? 'is-closing' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="filters-title"
          >
            <div className="cc-sheet-header">
              <h2 id="filters-title" className="cc-sheet-title">Filters</h2>
              <button
                type="button"
                className="cc-sheet-close"
                onClick={requestClose}
                aria-label="Close filters"
              >
                ✕
              </button>
            </div>

            <div className="cc-sheet-body">
              <div>
                <label style={labelStyle}>Search</label>
                <AdvancedSearch
                  events={events}
                  onSearch={(searchTerm) => handleChange('search', searchTerm)}
                  placeholder="Search locations, corridors, states…"
                />
              </div>

              <div>
                <label style={labelStyle}>State</label>
                <select
                  value={filters.state || ''}
                  onChange={(e) => handleChange('state', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">All states</option>
                  {filterOptions.states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Corridor</label>
                <select
                  value={filters.corridor || ''}
                  onChange={(e) => handleChange('corridor', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">All corridors</option>
                  {filterOptions.corridors.map(corridor => (
                    <option key={corridor} value={corridor}>{corridor}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Event type</label>
                <select
                  value={filters.eventType || ''}
                  onChange={(e) => handleChange('eventType', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">All types</option>
                  {filterOptions.eventTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Severity</label>
                <select
                  value={filters.severity || ''}
                  onChange={(e) => handleChange('severity', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">All severities</option>
                  {filterOptions.severities.map(severity => (
                    <option key={severity} value={severity}>
                      {severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="cc-sheet-footer">
              <button
                type="button"
                onClick={handleReset}
                style={ghostButtonStyle}
                disabled={activeFilterCount === 0}
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={requestClose}
                style={primaryButtonStyle}
              >
                Done
              </button>
            </div>
          </aside>
        </>,
        document.body
      )}
    </>
  );
}

const triggerStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '32px',
  minHeight: '32px',
  minWidth: 0,
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(0, 0, 0, 0.10)',
  background: '#ffffff',
  color: '#1d1d1f',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 500,
  letterSpacing: '-0.005em',
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
  transition: 'background-color 180ms cubic-bezier(0.32, 0.72, 0, 1)'
};

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '18px',
  height: '18px',
  padding: '0 6px',
  borderRadius: '999px',
  background: '#0071e3',
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1
};

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#6e6e73'
};

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid rgba(0, 0, 0, 0.12)',
  borderRadius: '8px',
  fontSize: '13px',
  fontFamily: 'inherit',
  backgroundColor: '#ffffff',
  color: '#1d1d1f',
  transition: 'border-color 180ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow 180ms cubic-bezier(0.32, 0.72, 0, 1)',
  outline: 'none'
};

const primaryButtonStyle = {
  padding: '8px 18px',
  borderRadius: '999px',
  border: 'none',
  background: '#0071e3',
  color: '#ffffff',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 500,
  letterSpacing: '-0.01em',
  cursor: 'pointer',
  transition: 'background-color 180ms cubic-bezier(0.32, 0.72, 0, 1)'
};

const ghostButtonStyle = {
  padding: '8px 18px',
  borderRadius: '999px',
  border: '1px solid rgba(0, 0, 0, 0.12)',
  background: 'transparent',
  color: '#6e6e73',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 500,
  letterSpacing: '-0.01em',
  cursor: 'pointer',
  transition: 'background-color 180ms cubic-bezier(0.32, 0.72, 0, 1), color 180ms cubic-bezier(0.32, 0.72, 0, 1)'
};

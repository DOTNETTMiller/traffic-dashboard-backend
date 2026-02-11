import { useState, useEffect } from 'react';
import api from '../services/api';
import { theme } from '../styles/theme';
import { config } from '../config';

export default function ITSEquipmentExport({ user }) {
  // Export filter state - default to user's state, or last uploaded primary state
  const getInitialState = () => {
    if (user?.stateKey) return user.stateKey;
    const lastPrimaryState = localStorage.getItem('its_last_primary_state');
    return lastPrimaryState || '';
  };

  const [exportStateKey, setExportStateKey] = useState(getInitialState());
  const [exportRoute, setExportRoute] = useState('');
  const [exportEquipmentType, setExportEquipmentType] = useState('');
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [availableStates, setAvailableStates] = useState([]);

  // Fetch available routes and states
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        // Fetch routes
        const routesResponse = await api.get('/api/its-equipment/routes', {
          params: exportStateKey ? { stateKey: exportStateKey } : {}
        });
        if (routesResponse.data.success) {
          setAvailableRoutes(routesResponse.data.routes);
        }

        // Fetch states with ITS equipment
        const statesResponse = await api.get('/api/its-equipment/states');
        if (statesResponse.data.success) {
          setAvailableStates(statesResponse.data.states);
        }
      } catch (error) {
        console.error('Error fetching filter options:', error);
      }
    };

    fetchFilterOptions();
  }, [exportStateKey]);

  // Build query string for exports
  const buildExportParams = (format, isRadit = false) => {
    const params = new URLSearchParams();

    if (exportStateKey) {
      params.append('stateKey', exportStateKey);
    } else {
      params.append('stateKey', 'multi-state');
    }

    if (!isRadit && format) {
      params.append('format', format);
    }

    if (exportRoute) {
      params.append('route', exportRoute);
    }

    if (exportEquipmentType) {
      params.append('equipmentType', exportEquipmentType);
    }

    return params.toString();
  };

  return (
    <div style={{
      marginTop: theme.spacing.lg,
      padding: theme.spacing.md,
      borderRadius: '8px',
      backgroundColor: theme.colors.glassLight,
      border: `1px solid ${theme.colors.border}`
    }}>
      {/* Header */}
      <div style={{
        fontSize: '14px',
        fontWeight: '700',
        color: theme.colors.text,
        marginBottom: theme.spacing.md
      }}>
        📥 Download ARC-ITS Compliant Data for Grant Applications
      </div>

      {/* Filter Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: theme.spacing.md
      }}>
        {/* State Filter */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            marginBottom: '4px'
          }}>
            State
          </label>
          <select
            value={exportStateKey}
            onChange={(e) => {
              setExportStateKey(e.target.value);
              setExportRoute(''); // Reset route when state changes
            }}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '12px',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              backgroundColor: theme.colors.bg,
              color: theme.colors.text,
              cursor: 'pointer'
            }}
          >
            <option value="">All States (Multi-State)</option>
            {availableStates.map(state => (
              <option key={state.state_key} value={state.state_key}>
                {state.state_key} - {state.state_name}
              </option>
            ))}
          </select>
        </div>

        {/* Route Filter */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            marginBottom: '4px'
          }}>
            Route (Optional)
          </label>
          <select
            value={exportRoute}
            onChange={(e) => setExportRoute(e.target.value)}
            disabled={!exportStateKey}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '12px',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              backgroundColor: exportStateKey ? theme.colors.bg : theme.colors.bgSecondary,
              color: theme.colors.text,
              cursor: exportStateKey ? 'pointer' : 'not-allowed'
            }}
          >
            <option value="">All Routes</option>
            {availableRoutes.map(route => (
              <option key={route} value={route}>{route}</option>
            ))}
          </select>
        </div>

        {/* Equipment Type Filter */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            marginBottom: '4px'
          }}>
            Equipment Type (Optional)
          </label>
          <select
            value={exportEquipmentType}
            onChange={(e) => setExportEquipmentType(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '12px',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              backgroundColor: theme.colors.bg,
              color: theme.colors.text,
              cursor: 'pointer'
            }}
          >
            <option value="">All Equipment</option>
            <option value="camera">📹 Cameras</option>
            <option value="dms">🚏 DMS Signs</option>
            <option value="rsu">📡 RSU (V2X)</option>
            <option value="sensor">🌡️ Sensors</option>
          </select>
        </div>
      </div>

      {/* Export Buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <a
          href={`${config.apiUrl}/api/its-equipment/export?${buildExportParams('xml')}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '8px 16px',
            backgroundColor: theme.colors.accentBlue,
            color: '#111827',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            fontSize: '12px',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: `all ${theme.transitions.fast}`,
            boxShadow: theme.shadows.sm,
            display: 'inline-block'
          }}
        >
          📄 ARC-ITS XML (Compliant Data)
        </a>
        <a
          href={`${config.apiUrl}/api/its-equipment/export?${buildExportParams('json')}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '8px 16px',
            backgroundColor: theme.colors.accentPurple,
            color: '#111827',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            fontSize: '12px',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: `all ${theme.transitions.fast}`,
            boxShadow: theme.shadows.sm,
            display: 'inline-block'
          }}
        >
          📊 ARC-ITS JSON (Compliant Data)
        </a>
        <a
          href={`${config.apiUrl}/api/its-equipment/compliance-report?${buildExportParams()}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '8px 16px',
            backgroundColor: '#16a34a',
            color: '#111827',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            fontSize: '12px',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: `all ${theme.transitions.fast}`,
            boxShadow: theme.shadows.sm,
            display: 'inline-block'
          }}
        >
          📋 Gap Report (Items to Fix)
        </a>
        <a
          href={`${config.apiUrl}/api/its-equipment/export/radit?${buildExportParams(null, true)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '8px 16px',
            backgroundColor: '#ea580c',
            color: '#111827',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            fontSize: '12px',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: `all ${theme.transitions.fast}`,
            boxShadow: theme.shadows.sm,
            display: 'inline-block'
          }}
        >
          🏛️ RAD-IT Export
        </a>
      </div>

      {/* Info Box */}
      <div style={{
        marginTop: '12px',
        fontSize: '11px',
        color: theme.colors.textSecondary,
        lineHeight: '1.6',
        backgroundColor: theme.colors.bgSecondary,
        padding: '12px',
        borderRadius: '6px',
        border: `1px solid ${theme.colors.border}`
      }}>
        <div style={{ fontWeight: '700', marginBottom: '6px' }}>
          📚 Standards Compliance:
        </div>
        <div style={{ paddingLeft: '12px' }}>
          • <strong>ARC-IT 10.0</strong>: Architecture Reference for Cooperative and Intelligent Transportation<br/>
          • <strong>RAD-IT</strong>: Regional Architecture Development tool-compatible export<br/>
          • <strong>Federal Grants</strong>: SMART, RAISE, ATCMTD, Pooled Fund applications<br/>
          • <strong>Multi-State</strong>: Supports regional architectures across state boundaries<br/>
          • <strong>Filtering</strong>: Export by state, route, or equipment type for targeted grant applications
        </div>
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${theme.colors.border}`, fontSize: '10px' }}>
          <strong>RAD-IT Resources:</strong> <a href="https://www.arc-it.net/" target="_blank" rel="noopener" style={{ color: theme.colors.primary }}>ARC-IT Website</a> |
          <a href="https://www.fhwa.dot.gov/planning/processes/tools/radit/" target="_blank" rel="noopener" style={{ color: theme.colors.primary, marginLeft: '6px' }}>FHWA RAD-IT Guide</a>
        </div>
      </div>
    </div>
  );
}

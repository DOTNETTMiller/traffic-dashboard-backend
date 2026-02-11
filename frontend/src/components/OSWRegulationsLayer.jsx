import { useEffect, useState } from 'react';
import { Popup, Marker } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

// Create state regulation marker icon
const createStateRegulationIcon = (stateName, color) => {
  const svg = `
    <svg width="70" height="30" viewBox="0 0 70 30" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
        </filter>
      </defs>
      <rect x="2" y="2" width="66" height="26" fill="${color}" stroke="white" stroke-width="2.5" rx="6" filter="url(#shadow)"/>
      <text x="35" y="19" text-anchor="middle" font-size="12" font-weight="bold" fill="white">🛣️ ${stateName}</text>
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: 'state-regulation-marker',
    iconSize: [70, 30],
    iconAnchor: [35, 15],
    popupAnchor: [0, -15]
  });
};

export default function OSWRegulationsLayer({ corridor = 'I-35' }) {
  const [regulations, setRegulations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRegulations();
  }, [corridor]);

  const loadRegulations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/corridor-regulations', {
        params: { corridor }
      });

      if (response.data.success) {
        setRegulations(response.data.regulations || []);
        console.log('🛣️  Loaded', response.data.regulations?.length || 0, 'corridor regulations');
      }
    } catch (error) {
      console.error('Error loading corridor regulations:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatWeight = (lbs) => {
    return `${(lbs / 1000).toFixed(0)}k lbs`;
  };

  const parseRequirements = (requirementsStr) => {
    try {
      return JSON.parse(requirementsStr);
    } catch {
      return [];
    }
  };

  const parsePermitCosts = (costsStr) => {
    try {
      return JSON.parse(costsStr);
    } catch {
      return {};
    }
  };

  if (loading || regulations.length === 0) {
    return null;
  }

  return (
    <>
      {regulations.map((reg) => {
        // Calculate center point for state marker
        const centerLat = (reg.bounds_start_lat + reg.bounds_end_lat) / 2;
        const centerLng = (reg.bounds_start_lng + reg.bounds_end_lng) / 2;

        const requirements = parseRequirements(reg.requirements);
        const permitCosts = parsePermitCosts(reg.permit_cost_data);

        return (
          <Marker
            key={reg.id}
            position={[centerLat, centerLng]}
            icon={createStateRegulationIcon(reg.state_code, reg.color || '#3b82f6')}
          >
            <Popup>
                <div style={{ minWidth: '320px', padding: '8px' }}>
                  {/* Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    <span style={{ fontSize: '24px' }}>🛣️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: '700',
                        fontSize: '16px',
                        color: '#111827'
                      }}>
                        {reg.corridor} - {reg.state_name}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        fontWeight: '500'
                      }}>
                        Oversize/Overweight Regulations
                      </div>
                    </div>
                  </div>

                  {/* Max Dimensions */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      fontWeight: '600',
                      marginBottom: '6px',
                      textTransform: 'uppercase'
                    }}>
                      Maximum Dimensions
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px'
                    }}>
                      <div style={{
                        padding: '8px',
                        backgroundcolor: '#6b7280',
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          fontSize: '10px',
                          color: '#6b7280',
                          marginBottom: '2px'
                        }}>Length</div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '700',
                          color: '#111827'
                        }}>{reg.max_length_ft}'</div>
                      </div>
                      <div style={{
                        padding: '8px',
                        backgroundcolor: '#6b7280',
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          fontSize: '10px',
                          color: '#6b7280',
                          marginBottom: '2px'
                        }}>Width</div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '700',
                          color: '#111827'
                        }}>{reg.max_width_ft}'</div>
                      </div>
                      <div style={{
                        padding: '8px',
                        backgroundcolor: '#6b7280',
                        borderRadius: '6px',
                        textAlign: 'center',
                        border: '1.5px solid #f59e0b'
                      }}>
                        <div style={{
                          fontSize: '10px',
                          color: '#92400e',
                          marginBottom: '2px'
                        }}>Height ⚠️</div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '700',
                          color: '#92400e'
                        }}>{reg.max_height_ft}'</div>
                      </div>
                    </div>
                  </div>

                  {/* Weight Limits */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      fontWeight: '600',
                      marginBottom: '6px',
                      textTransform: 'uppercase'
                    }}>
                      Permitted Weight Limits
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '6px',
                      fontSize: '11px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span style={{ color: '#6b7280' }}>Single Axle:</span>
                        <span style={{ fontWeight: '600', color: '#111827' }}>
                          {formatWeight(reg.permitted_single_axle)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span style={{ color: '#6b7280' }}>Tandem:</span>
                        <span style={{ fontWeight: '600', color: '#111827' }}>
                          {formatWeight(reg.permitted_tandem_axle)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span style={{ color: '#6b7280' }}>Tridem:</span>
                        <span style={{ fontWeight: '600', color: '#111827' }}>
                          {formatWeight(reg.permitted_tridem_axle)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span style={{ color: '#6b7280' }}>GVW:</span>
                        <span style={{ fontWeight: '600', color: '#111827' }}>
                          {formatWeight(reg.legal_gvw)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Permit Costs */}
                  {Object.keys(permitCosts).length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        fontWeight: '600',
                        marginBottom: '6px',
                        textTransform: 'uppercase'
                      }}>
                        Permit Costs
                      </div>
                      <div style={{
                        padding: '8px',
                        backgroundcolor: '#6b7280',
                        borderRadius: '6px',
                        border: '1px solid #86efac',
                        fontSize: '11px'
                      }}>
                        {Object.entries(permitCosts).map(([key, value], idx) => (
                          <div key={idx} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '2px 0'
                          }}>
                            <span style={{ color: '#166534', textTransform: 'capitalize' }}>
                              {key.replace(/_/g, ' ')}:
                            </span>
                            <span style={{ fontWeight: '600', color: '#166534' }}>
                              {typeof value === 'number' ? `$${value}` : value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Requirements */}
                  {requirements.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        fontWeight: '600',
                        marginBottom: '6px',
                        textTransform: 'uppercase'
                      }}>
                        Requirements
                      </div>
                      <ul style={{
                        margin: 0,
                        paddingLeft: '20px',
                        fontSize: '11px',
                        color: '#374151',
                        lineHeight: '1.6'
                      }}>
                        {requirements.map((req, idx) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
        );
      })}
    </>
  );
}

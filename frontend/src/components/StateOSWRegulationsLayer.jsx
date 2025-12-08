import { useEffect, useState } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';
import { theme } from '../styles/theme';

// State centroids for marker placement
const STATE_CENTROIDS = {
  'tx': [31.9686, -99.9018],
  'ok': [35.5376, -97.2691],
  'ks': [38.5266, -96.7265],
  'ne': [41.4925, -99.9018],
  'ia': [42.0115, -93.2105],
  'mn': [45.6945, -93.9002],
  'ca': [36.7783, -119.4179],
  'fl': [27.9944, -81.7603]
};

export default function StateOSWRegulationsLayer({ nascoOnly = false }) {
  const [regulations, setRegulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingState, setEditingState] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const map = useMap();

  useEffect(() => {
    fetchRegulations();
  }, [nascoOnly]);

  const fetchRegulations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/state-osow-regulations', {
        params: nascoOnly ? { nascoOnly: 'true' } : {}
      });

      if (response.data.success) {
        setRegulations(response.data.regulations);
      }
    } catch (error) {
      console.error('Error fetching state OS/OW regulations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (regulation) => {
    setEditingState(regulation.state_key);
    setEditFormData({
      max_length_ft: regulation.max_length_ft || '',
      max_width_ft: regulation.max_width_ft || '',
      max_height_ft: regulation.max_height_ft || '',
      legal_gvw: regulation.legal_gvw || '',
      permitted_single_axle: regulation.permitted_single_axle || '',
      permitted_tandem_axle: regulation.permitted_tandem_axle || '',
      permitted_max_gvw: regulation.permitted_max_gvw || '',
      permit_office_phone: regulation.permit_office_phone || '',
      permit_office_email: regulation.permit_office_email || '',
      permit_portal_url: regulation.permit_portal_url || '',
      regulation_url: regulation.regulation_url || '',
      notes: regulation.notes || ''
    });
  };

  const handleSave = async (stateKey) => {
    try {
      const response = await api.put(`/api/state-osow-regulations/${stateKey}`, editFormData);

      if (response.data.success) {
        // Refresh regulations
        await fetchRegulations();
        setEditingState(null);
        alert(`Successfully updated ${stateKey.toUpperCase()} regulations`);
      }
    } catch (error) {
      console.error('Error updating regulation:', error);
      alert('Failed to update regulation');
    }
  };

  // Create custom icon based on data completeness and NASCO status
  const createMarkerIcon = (regulation) => {
    const isComplete = regulation.data_completeness_pct >= 100;
    const isNasco = regulation.is_nasco_state === 1;

    let color;
    if (isNasco && isComplete) {
      color = theme.colors.accentGreen;
    } else if (isNasco) {
      color = theme.colors.accent;
    } else if (isComplete) {
      color = theme.colors.accentBlue;
    } else {
      color = theme.colors.textSecondary;
    }

    return L.divIcon({
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          color: white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
        ">
          ${regulation.state_key.toUpperCase()}
        </div>
      `,
      className: 'state-osw-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  const formatCurrency = (value) => {
    return value ? `$${value.toLocaleString()}` : 'N/A';
  };

  if (loading) {
    return null;
  }

  return (
    <>
      {regulations.map(regulation => {
        const coords = STATE_CENTROIDS[regulation.state_key];
        if (!coords) return null;

        return (
          <Marker
            key={regulation.state_key}
            position={coords}
            icon={createMarkerIcon(regulation)}
          >
            <Popup
              maxWidth={500}
              className="state-osow-popup"
            >
              {editingState === regulation.state_key ? (
                // Edit Mode
                <div style={{
                  padding: '12px',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: `2px solid ${theme.colors.border}`
                  }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>
                      Edit {regulation.state_name} Regulations
                    </h3>
                    <button
                      onClick={() => setEditingState(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '18px',
                        cursor: 'pointer',
                        color: theme.colors.textSecondary
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.textSecondary }}>
                        Max Length (ft)
                      </label>
                      <input
                        type="number"
                        value={editFormData.max_length_ft}
                        onChange={(e) => setEditFormData({ ...editFormData, max_length_ft: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '12px',
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '4px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.textSecondary }}>
                        Max Width (ft)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={editFormData.max_width_ft}
                        onChange={(e) => setEditFormData({ ...editFormData, max_width_ft: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '12px',
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '4px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.textSecondary }}>
                        Max Height (ft)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={editFormData.max_height_ft}
                        onChange={(e) => setEditFormData({ ...editFormData, max_height_ft: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '12px',
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '4px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.textSecondary }}>
                        Legal GVW (lbs)
                      </label>
                      <input
                        type="number"
                        value={editFormData.legal_gvw}
                        onChange={(e) => setEditFormData({ ...editFormData, legal_gvw: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '12px',
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '4px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.textSecondary }}>
                        Permit Office Phone
                      </label>
                      <input
                        type="tel"
                        value={editFormData.permit_office_phone}
                        onChange={(e) => setEditFormData({ ...editFormData, permit_office_phone: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '12px',
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '4px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.textSecondary }}>
                        Permit Office Email
                      </label>
                      <input
                        type="email"
                        value={editFormData.permit_office_email}
                        onChange={(e) => setEditFormData({ ...editFormData, permit_office_email: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '12px',
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '4px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.textSecondary }}>
                        Permit Portal URL
                      </label>
                      <input
                        type="url"
                        value={editFormData.permit_portal_url}
                        onChange={(e) => setEditFormData({ ...editFormData, permit_portal_url: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '12px',
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '4px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.textSecondary }}>
                        Notes
                      </label>
                      <textarea
                        value={editFormData.notes}
                        onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '12px',
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '4px',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>

                    <button
                      onClick={() => handleSave(regulation.state_key)}
                      style={{
                        marginTop: '8px',
                        padding: '8px 16px',
                        background: theme.colors.accentGreen,
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div style={{ padding: '12px', minWidth: '300px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: `2px solid ${theme.colors.border}`
                  }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>
                      {regulation.state_name} OS/OW Regulations
                    </h3>
                    {regulation.is_nasco_state === 1 && (
                      <span style={{
                        padding: '2px 8px',
                        background: theme.colors.accent,
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '700'
                      }}>
                        NASCO
                      </span>
                    )}
                  </div>

                  {/* Data Completeness */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      fontWeight: '600',
                      marginBottom: '4px'
                    }}>
                      <span>Data Completeness</span>
                      <span>{regulation.data_completeness_pct}%</span>
                    </div>
                    <div style={{
                      height: '6px',
                      background: theme.colors.bgSecondary,
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${regulation.data_completeness_pct}%`,
                        background: regulation.data_completeness_pct >= 100
                          ? theme.colors.accentGreen
                          : theme.colors.accent,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  {/* Dimensions */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                      Maximum Dimensions
                    </div>
                    <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
                      <div>Length: {regulation.max_length_ft || 'N/A'} ft</div>
                      <div>Width: {regulation.max_width_ft || 'N/A'} ft</div>
                      <div>Height: {regulation.max_height_ft || 'N/A'} ft</div>
                    </div>
                  </div>

                  {/* Weights */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                      Weight Limits
                    </div>
                    <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
                      <div>Legal GVW: {formatCurrency(regulation.legal_gvw)}</div>
                      <div>Max Permitted GVW: {formatCurrency(regulation.permitted_max_gvw)}</div>
                      <div>Single Axle: {formatCurrency(regulation.permitted_single_axle)}</div>
                      <div>Tandem Axle: {formatCurrency(regulation.permitted_tandem_axle)}</div>
                    </div>
                  </div>

                  {/* NASCO Routes */}
                  {regulation.is_nasco_state === 1 && regulation.nasco_corridor_routes && regulation.nasco_corridor_routes.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                        NASCO Corridor Routes
                      </div>
                      <div style={{ fontSize: '11px' }}>
                        {regulation.nasco_corridor_routes.join(', ')}
                      </div>
                    </div>
                  )}

                  {/* Contact Info */}
                  {(regulation.permit_office_phone || regulation.permit_office_email || regulation.permit_portal_url) && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                        Permit Office
                      </div>
                      <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
                        {regulation.permit_office_phone && (
                          <div>Phone: {regulation.permit_office_phone}</div>
                        )}
                        {regulation.permit_office_email && (
                          <div>Email: {regulation.permit_office_email}</div>
                        )}
                        {regulation.permit_portal_url && (
                          <div>
                            <a
                              href={regulation.permit_portal_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: theme.colors.primary }}
                            >
                              Permit Portal
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {regulation.notes && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                        Notes
                      </div>
                      <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
                        {regulation.notes}
                      </div>
                    </div>
                  )}

                  {/* Edit Button */}
                  {regulation.data_completeness_pct < 100 && (
                    <button
                      onClick={() => handleEdit(regulation)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: theme.colors.accent,
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '12px',
                        cursor: 'pointer',
                        marginTop: '8px'
                      }}
                    >
                      Complete Missing Data
                    </button>
                  )}

                  {/* Last Verified */}
                  {regulation.last_verified_date && (
                    <div style={{
                      marginTop: '12px',
                      paddingTop: '8px',
                      borderTop: `1px solid ${theme.colors.border}`,
                      fontSize: '10px',
                      color: theme.colors.textSecondary
                    }}>
                      Last verified: {regulation.last_verified_date}
                    </div>
                  )}
                </div>
              )}
            </Popup>
          </Marker>
        );
      })}

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: theme.shadows.md,
          fontSize: '11px'
        }}
      >
        <div style={{ fontWeight: '700', marginBottom: '8px' }}>
          State OS/OW Regulations
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              background: theme.colors.accentGreen,
              borderRadius: '50%'
            }} />
            <span>NASCO - Complete</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              background: theme.colors.accent,
              borderRadius: '50%'
            }} />
            <span>NASCO - Incomplete</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              background: theme.colors.accentBlue,
              borderRadius: '50%'
            }} />
            <span>Non-NASCO - Complete</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              background: theme.colors.textSecondary,
              borderRadius: '50%'
            }} />
            <span>Non-NASCO - Incomplete</span>
          </div>
        </div>
      </div>
    </>
  );
}

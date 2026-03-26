import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { config } from '../config';

export default function DiversionRoutePanel({ selectedEvent, onClose }) {
  const [activeTab, setActiveTab] = useState('routes');
  const [diversionRoutes, setDiversionRoutes] = useState([]);
  const [activations, setActivations] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDiversionRoutes();
    fetchActivations();
  }, []);

  const fetchDiversionRoutes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${config.apiUrl}/api/diversion-routes`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch diversion routes');

      const data = await response.json();
      setDiversionRoutes(data.routes || []);
    } catch (err) {
      console.error('Error fetching diversion routes:', err);
      setError('Failed to fetch diversion routes. Database may not be connected.');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivations = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/diversion-routes/activations`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch activations');

      const data = await response.json();
      setActivations(data.activations || []);
    } catch (err) {
      console.error('Error fetching activations:', err);
      // Non-critical — don't show error for history tab
    }
  };

  const activateRoute = async () => {
    if (!selectedRoute) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/api/diversion-routes/${selectedRoute.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          event_id: selectedEvent?.id || null,
          activated_by: 'TMC Operator',
          activation_reason: selectedEvent
            ? `Event: ${selectedEvent.title || selectedEvent.description?.substring(0, 80)}`
            : 'Manual activation'
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to activate route');
      }

      setSelectedRoute(null);
      fetchActivations();
      fetchDiversionRoutes(); // Refresh activation counts
    } catch (err) {
      setError(err.message || 'Failed to activate diversion route');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      approved: '#10b981',
      pending: '#f59e0b',
      active: '#3b82f6'
    };
    return colors[status] || '#6b7280';
  };

  return (
    <div style={{ padding: '24px', minHeight: '100%', backgroundColor: '#f9fafb' }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxWidth: '1152px',
        margin: '0 auto',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(to right, #9333ea, #7e22ce)',
          color: 'white',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: 0
              }}>
                <svg style={{ width: '28px', height: '28px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Diversion Route Management
              </h2>
              <p style={{ color: '#f3e8ff', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>
                CCAI-Aligned Pre-Approved Alternate Routes
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                color: 'white',
                background: 'none',
                border: 'none',
                borderRadius: '50%',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#a855f7'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {selectedEvent && (
            <div style={{
              marginTop: '16px',
              backgroundColor: 'rgba(168, 85, 247, 0.3)',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '14px'
            }}>
              <strong>Active Event:</strong> {selectedEvent.title || selectedEvent.description?.substring(0, 60)}
              {' '} on {selectedEvent.route || selectedEvent.corridor}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
          <button
            onClick={() => setActiveTab('routes')}
            style={{
              padding: '12px 24px',
              fontWeight: '500',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              transition: 'color 0.15s',
              borderBottom: activeTab === 'routes' ? '2px solid #9333ea' : '2px solid transparent',
              color: activeTab === 'routes' ? '#9333ea' : '#4b5563',
              backgroundColor: activeTab === 'routes' ? 'white' : 'transparent'
            }}
          >
            Pre-Approved Routes ({diversionRoutes.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '12px 24px',
              fontWeight: '500',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              transition: 'color 0.15s',
              borderBottom: activeTab === 'history' ? '2px solid #9333ea' : '2px solid transparent',
              color: activeTab === 'history' ? '#9333ea' : '#4b5563',
              backgroundColor: activeTab === 'history' ? 'white' : 'transparent'
            }}
          >
            Activation History ({activations.length})
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {error && (
            <div style={{
              marginBottom: '16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '12px 16px',
              borderRadius: '6px'
            }}>
              {error}
            </div>
          )}

          {activeTab === 'routes' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
              {/* Route List */}
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px', marginTop: 0 }}>
                  Available Diversion Routes
                </h3>
                <div style={{ maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {loading && (
                    <div style={{ textAlign: 'center', padding: '16px', color: '#6b7280' }}>
                      Loading routes...
                    </div>
                  )}

                  {!loading && diversionRoutes.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
                      No diversion routes found
                    </div>
                  )}

                  {diversionRoutes.map(route => (
                    <button
                      key={route.id}
                      onClick={() => setSelectedRoute(route)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '16px',
                        borderRadius: '8px',
                        border: selectedRoute?.id === route.id ? '1px solid #a855f7' : '1px solid #e5e7eb',
                        backgroundColor: selectedRoute?.id === route.id ? '#faf5ff' : 'white',
                        boxShadow: selectedRoute?.id === route.id
                          ? '0 4px 6px -1px rgba(0,0,0,0.1)'
                          : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <h4 style={{ fontWeight: '600', color: '#111827', flex: 1, margin: 0 }}>
                          {route.route_name}
                        </h4>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
                            color: 'white',
                            marginLeft: '8px',
                            backgroundColor: getStatusColor(route.approval_status)
                          }}
                        >
                          {route.approval_status.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ fontSize: '14px', color: '#4b5563' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{route.primary_route} → {route.diversion_route}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <span>{route.distance_miles} mi • +{route.estimated_delay_minutes} min</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                          {route.truck_suitable && (
                            <span style={{
                              padding: '4px 8px',
                              backgroundColor: '#dcfce7',
                              color: '#166534',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}>
                              Truck Suitable
                            </span>
                          )}
                          {route.hazmat_approved && (
                            <span style={{
                              padding: '4px 8px',
                              backgroundColor: '#dbeafe',
                              color: '#1e40af',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}>
                              HAZMAT OK
                            </span>
                          )}
                          {(route.states_involved || []).length > 1 && (
                            <span style={{
                              padding: '4px 8px',
                              backgroundColor: '#ffedd5',
                              color: '#9a3412',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}>
                              Multi-State
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                          Activated {route.activation_count} times
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Route Details & Activation */}
              <div>
                {selectedRoute ? (
                  <div style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    padding: '24px',
                    border: '1px solid #e5e7eb',
                    position: 'sticky',
                    top: 0
                  }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px', marginTop: 0 }}>
                      Route Details
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                          Route Name
                        </label>
                        <div style={{ fontSize: '16px', fontWeight: '600' }}>{selectedRoute.route_name}</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                            Primary Route
                          </label>
                          <div style={{ fontSize: '16px' }}>{selectedRoute.primary_route}</div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                            Diversion Route
                          </label>
                          <div style={{ fontSize: '16px' }}>{selectedRoute.diversion_route}</div>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                          Start Location
                        </label>
                        <div style={{ fontSize: '14px' }}>{selectedRoute.start_location}</div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                          End Location
                        </label>
                        <div style={{ fontSize: '14px' }}>{selectedRoute.end_location}</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                            Distance
                          </label>
                          <div style={{ fontSize: '16px' }}>{selectedRoute.distance_miles} miles</div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                            Est. Delay
                          </label>
                          <div style={{ fontSize: '16px' }}>{selectedRoute.estimated_delay_minutes} minutes</div>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                          States Involved
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {(selectedRoute.states_involved || []).map(state => (
                            <span key={state} style={{
                              padding: '4px 8px',
                              backgroundColor: '#dbeafe',
                              color: '#1e40af',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}>
                              {state}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ paddingTop: '16px', borderTop: '1px solid #d1d5db' }}>
                        <div style={{
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          borderRadius: '6px',
                          padding: '12px',
                          fontSize: '14px',
                          color: '#1e3a5a',
                          marginBottom: '16px'
                        }}>
                          <strong>Activation will:</strong>
                          <ul style={{ marginTop: '8px', marginLeft: '16px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: 0 }}>
                            <li>Notify {(selectedRoute.states_involved || []).join(' and ')} TMCs</li>
                            <li>Activate DMS messages along route</li>
                            <li>Send traveler advisories</li>
                            <li>Log activation for effectiveness tracking</li>
                          </ul>
                        </div>

                        <button
                          onClick={activateRoute}
                          disabled={loading}
                          style={{
                            width: '100%',
                            backgroundColor: loading ? '#c4b5fd' : '#9333ea',
                            color: 'white',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            fontWeight: '500',
                            border: 'none',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '15px',
                            opacity: loading ? 0.7 : 1,
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#7e22ce'; }}
                          onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#9333ea'; }}
                        >
                          {loading ? 'Activating...' : 'Activate Diversion Route'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    padding: '48px 24px',
                    textAlign: 'center',
                    border: '2px dashed #d1d5db'
                  }}>
                    <svg style={{ width: '64px', height: '64px', margin: '0 auto 16px', color: '#9ca3af', display: 'block' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p style={{ color: '#4b5563', margin: 0 }}>
                      Select a diversion route to view details and activate
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                  <svg style={{ width: '64px', height: '64px', margin: '0 auto 16px', color: '#d1d5db', display: 'block' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p style={{ margin: 0 }}>No diversion route activations yet</p>
                </div>
              ) : (
                activations.map(activation => (
                  <div key={activation.id} style={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontWeight: '600', color: '#111827', margin: 0 }}>
                          {activation.route_name}
                        </h4>
                        <p style={{ fontSize: '14px', color: '#4b5563', marginTop: '4px', marginBottom: 0 }}>
                          {activation.activation_reason}
                        </p>
                      </div>
                      {activation.effectiveness_rating && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '16px' }}>
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              style={{
                                width: '16px',
                                height: '16px',
                                color: i < activation.effectiveness_rating ? '#facc15' : '#d1d5db',
                                flexShrink: 0
                              }}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '14px', marginTop: '12px' }}>
                      <div>
                        <span style={{ color: '#4b5563' }}>Activated by:</span>
                        <span style={{ marginLeft: '8px', fontWeight: '500' }}>{activation.activated_by}</span>
                      </div>
                      <div>
                        <span style={{ color: '#4b5563' }}>Duration:</span>
                        <span style={{ marginLeft: '8px', fontWeight: '500' }}>
                          {activation.deactivated_at
                            ? `${Math.round((new Date(activation.deactivated_at) - new Date(activation.activated_at)) / (60 * 1000))} minutes`
                            : 'Active now'}
                        </span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ color: '#4b5563' }}>States notified:</span>
                        <span style={{ marginLeft: '8px', fontWeight: '500' }}>{(activation.states_notified || []).join(', ') || 'None'}</span>
                      </div>
                      <div style={{ gridColumn: 'span 2', fontSize: '12px', color: '#6b7280' }}>
                        {formatDistanceToNow(new Date(activation.activated_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', color: '#4b5563' }}>
            <div>
              <strong>CCAI UC #3:</strong> Pre-Approved Diversion Routes
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#d1d5db'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#e5e7eb'}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

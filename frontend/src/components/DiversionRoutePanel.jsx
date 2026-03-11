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
      // Mock data since API endpoints for diversion routes not yet created
      // In production, this would be: const response = await fetch(`${config.apiUrl}/api/diversion-routes`);

      // Simulating the 6 pre-loaded routes from the migration
      const mockRoutes = [
        {
          id: 1,
          route_name: 'I-35 to US-69 (Iowa-Missouri Border)',
          primary_route: 'I-35',
          diversion_route: 'US-69',
          start_location: 'I-35 Exit 1 (Iowa)',
          end_location: 'I-35 Exit 12 (Missouri)',
          states_involved: ['Iowa', 'Missouri'],
          distance_miles: 25.5,
          estimated_delay_minutes: 15,
          truck_suitable: true,
          hazmat_approved: true,
          approval_status: 'approved',
          activation_count: 12
        },
        {
          id: 2,
          route_name: 'I-35 to I-80 East (Iowa)',
          primary_route: 'I-35',
          diversion_route: 'I-80',
          start_location: 'I-35/I-80 Junction Des Moines',
          end_location: 'I-35 Exit 92',
          states_involved: ['Iowa'],
          distance_miles: 18.2,
          estimated_delay_minutes: 10,
          truck_suitable: true,
          hazmat_approved: true,
          approval_status: 'approved',
          activation_count: 8
        },
        {
          id: 3,
          route_name: 'I-35 to US-75 (Minnesota)',
          primary_route: 'I-35',
          diversion_route: 'US-75',
          start_location: 'I-35 Exit 12',
          end_location: 'I-35 Exit 45',
          states_involved: ['Minnesota'],
          distance_miles: 32.0,
          estimated_delay_minutes: 20,
          truck_suitable: true,
          hazmat_approved: false,
          approval_status: 'approved',
          activation_count: 5
        },
        {
          id: 4,
          route_name: 'I-70 to US-40 (Kansas-Colorado)',
          primary_route: 'I-70',
          diversion_route: 'US-40',
          start_location: 'I-70 MM 420 (KS)',
          end_location: 'I-70 MM 20 (CO)',
          states_involved: ['Kansas', 'Colorado'],
          distance_miles: 45.0,
          estimated_delay_minutes: 30,
          truck_suitable: true,
          hazmat_approved: false,
          approval_status: 'approved',
          activation_count: 3
        },
        {
          id: 5,
          route_name: 'I-80 to I-35 South (Iowa)',
          primary_route: 'I-80',
          diversion_route: 'I-35',
          start_location: 'I-80 Exit 137',
          end_location: 'I-80 Exit 110',
          states_involved: ['Iowa'],
          distance_miles: 22.0,
          estimated_delay_minutes: 12,
          truck_suitable: true,
          hazmat_approved: true,
          approval_status: 'approved',
          activation_count: 15
        },
        {
          id: 6,
          route_name: 'I-80 to US-30 (Nebraska)',
          primary_route: 'I-80',
          diversion_route: 'US-30',
          start_location: 'I-80 Exit 395',
          end_location: 'I-80 Exit 440',
          states_involved: ['Nebraska'],
          distance_miles: 42.0,
          estimated_delay_minutes: 25,
          truck_suitable: true,
          hazmat_approved: false,
          approval_status: 'approved',
          activation_count: 7
        }
      ];

      setDiversionRoutes(mockRoutes);
    } catch (err) {
      setError('Failed to fetch diversion routes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivations = async () => {
    // Mock activation history
    const mockActivations = [
      {
        id: 1,
        diversion_route_id: 5,
        route_name: 'I-80 to I-35 South (Iowa)',
        activated_by: 'Iowa TMC',
        activated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        deactivated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        activation_reason: 'Major crash blocking all lanes on I-80',
        states_notified: ['Iowa'],
        effectiveness_rating: 4
      },
      {
        id: 2,
        diversion_route_id: 1,
        route_name: 'I-35 to US-69 (Iowa-Missouri Border)',
        activated_by: 'Iowa TMC',
        activated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        deactivated_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
        activation_reason: 'Bridge maintenance full closure',
        states_notified: ['Iowa', 'Missouri'],
        effectiveness_rating: 5
      }
    ];

    setActivations(mockActivations);
  };

  const activateRoute = async () => {
    if (!selectedRoute) return;

    setLoading(true);
    setError(null);

    try {
      // In production, this would be an API call
      // const response = await fetch(`${config.apiUrl}/api/diversion-routes/activate`, { ... });

      alert(`Diversion Route Activated!\n\nRoute: ${selectedRoute.route_name}\n\n` +
            `Primary Route: ${selectedRoute.primary_route}\n` +
            `Diversion via: ${selectedRoute.diversion_route}\n` +
            `Distance: ${selectedRoute.distance_miles} miles\n` +
            `Est. Delay: ${selectedRoute.estimated_delay_minutes} minutes\n\n` +
            `States Notified: ${selectedRoute.states_involved.join(', ')}\n\n` +
            `DMS messages would be automatically activated along the route.`);

      setSelectedRoute(null);
      fetchActivations();
    } catch (err) {
      setError('Failed to activate diversion route');
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Diversion Route Management
              </h2>
              <p className="text-purple-100 text-sm mt-1">
                CCAI-Aligned Pre-Approved Alternate Routes
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-purple-500 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {selectedEvent && (
            <div className="mt-4 bg-purple-500 bg-opacity-30 rounded p-3 text-sm">
              <strong>Active Event:</strong> {selectedEvent.title || selectedEvent.description?.substring(0, 60)}
              {' '} on {selectedEvent.route || selectedEvent.corridor}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('routes')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'routes'
                ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pre-Approved Routes ({diversionRoutes.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'history'
                ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Activation History ({activations.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {activeTab === 'routes' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Route List */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Diversion Routes</h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {loading && <div className="text-center py-4 text-gray-500">Loading routes...</div>}

                  {!loading && diversionRoutes.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No diversion routes found
                    </div>
                  )}

                  {diversionRoutes.map(route => (
                    <button
                      key={route.id}
                      onClick={() => setSelectedRoute(route)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        selectedRoute?.id === route.id
                          ? 'border-purple-500 bg-purple-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 flex-1">
                          {route.route_name}
                        </h4>
                        <span
                          className="px-2 py-1 rounded text-xs font-medium text-white ml-2"
                          style={{ backgroundColor: getStatusColor(route.approval_status) }}
                        >
                          {route.approval_status.toUpperCase()}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{route.primary_route} → {route.diversion_route}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <span>{route.distance_miles} mi • +{route.estimated_delay_minutes} min</span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mt-2">
                          {route.truck_suitable && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                              Truck Suitable
                            </span>
                          )}
                          {route.hazmat_approved && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              HAZMAT OK
                            </span>
                          )}
                          {route.states_involved.length > 1 && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                              Multi-State
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-gray-500 mt-2">
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
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 sticky top-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Route Details
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Route Name
                        </label>
                        <div className="text-base font-semibold">{selectedRoute.route_name}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Primary Route
                          </label>
                          <div className="text-base">{selectedRoute.primary_route}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Diversion Route
                          </label>
                          <div className="text-base">{selectedRoute.diversion_route}</div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Location
                        </label>
                        <div className="text-sm">{selectedRoute.start_location}</div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Location
                        </label>
                        <div className="text-sm">{selectedRoute.end_location}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Distance
                          </label>
                          <div className="text-base">{selectedRoute.distance_miles} miles</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Est. Delay
                          </label>
                          <div className="text-base">{selectedRoute.estimated_delay_minutes} minutes</div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          States Involved
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {selectedRoute.states_involved.map(state => (
                            <span key={state} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                              {state}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-300">
                        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900 mb-4">
                          <strong>Activation will:</strong>
                          <ul className="mt-2 ml-4 list-disc space-y-1">
                            <li>Notify {selectedRoute.states_involved.join(' and ')} TMCs</li>
                            <li>Activate DMS messages along route</li>
                            <li>Send traveler advisories</li>
                            <li>Log activation for effectiveness tracking</li>
                          </ul>
                        </div>

                        <button
                          onClick={activateRoute}
                          disabled={loading}
                          className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? 'Activating...' : 'Activate Diversion Route'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-12 text-center border-2 border-dashed border-gray-300">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p className="text-gray-600">
                      Select a diversion route to view details and activate
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {activations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>No diversion route activations yet</p>
                </div>
              ) : (
                activations.map(activation => (
                  <div key={activation.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {activation.route_name}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {activation.activation_reason}
                        </p>
                      </div>
                      {activation.effectiveness_rating && (
                        <div className="flex items-center gap-1 ml-4">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-4 h-4 ${i < activation.effectiveness_rating ? 'text-yellow-400' : 'text-gray-300'}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                      <div>
                        <span className="text-gray-600">Activated by:</span>
                        <span className="ml-2 font-medium">{activation.activated_by}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Duration:</span>
                        <span className="ml-2 font-medium">
                          {Math.round((new Date(activation.deactivated_at) - new Date(activation.activated_at)) / (60 * 1000))} minutes
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">States notified:</span>
                        <span className="ml-2 font-medium">{activation.states_notified.join(', ')}</span>
                      </div>
                      <div className="col-span-2 text-xs text-gray-500">
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
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <strong>CCAI UC #3:</strong> Pre-Approved Diversion Routes
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

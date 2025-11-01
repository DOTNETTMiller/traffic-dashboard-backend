import { useState, useEffect } from 'react';
import api from '../services/api';

export default function GroundTruthDashboard() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedView, setSelectedView] = useState('center'); // center, entry, exit
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchGroundTruthData = async () => {
    try {
      setError(null);
      const response = await api.get('/api/parking/ground-truth');

      if (response.data.success) {
        setFacilities(response.data.facilities);
        setLastUpdate(new Date());
      } else {
        setError('Failed to load ground-truth data');
      }
    } catch (err) {
      console.error('Error fetching ground-truth data:', err);
      setError(err.message || 'Failed to load ground-truth data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroundTruthData();

    // Auto-refresh every 5 minutes if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchGroundTruthData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getOccupancyColor = (rate) => {
    if (rate === null || rate === undefined) return '#9ca3af';
    if (rate > 0.8) return '#ef4444'; // Red - nearly full
    if (rate > 0.5) return '#f59e0b'; // Orange - moderately full
    return '#22c55e'; // Green - plenty available
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence === 'high') return { text: 'High', color: '#22c55e' };
    if (confidence === 'medium') return { text: 'Medium', color: '#f59e0b' };
    return { text: 'Low', color: '#ef4444' };
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '80vh',
        fontSize: '18px',
        color: '#6b7280'
      }}>
        Loading ground-truth dashboard...
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      backgroundColor: '#f9fafb',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          margin: '0 0 8px 0',
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#111827'
        }}>
          Truck Parking Ground-Truth Dashboard
        </h1>
        <p style={{
          margin: '0 0 16px 0',
          color: '#6b7280',
          fontSize: '14px'
        }}>
          Compare parking predictions against live camera feeds for validation
        </p>

        {/* Controls */}
        <div style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {/* Camera View Selector */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Camera View:
            </span>
            {['center', 'entry', 'exit'].map(view => (
              <button
                key={view}
                onClick={() => setSelectedView(view)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: selectedView === view ? '2px solid #3b82f6' : '1px solid #d1d5db',
                  backgroundColor: selectedView === view ? '#eff6ff' : 'white',
                  color: selectedView === view ? '#3b82f6' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  textTransform: 'capitalize'
                }}
              >
                {view}
              </button>
            ))}
          </div>

          {/* Auto-refresh Toggle */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#374151'
            }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Auto-refresh (5 min)
            </label>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchGroundTruthData()}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              color: '#374151',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            Refresh Now
          </button>

          {/* Last Update */}
          {lastUpdate && (
            <span style={{ fontSize: '13px', color: '#6b7280', marginLeft: 'auto' }}>
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          color: '#991b1b'
        }}>
          {error}
        </div>
      )}

      {/* Facilities Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))',
        gap: '24px'
      }}>
        {facilities.map((facility) => {
          const pred = facility.prediction;
          const conf = pred ? getConfidenceLabel(pred.confidence) : null;

          return (
            <div
              key={facility.facilityId}
              style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                overflow: 'hidden'
              }}
            >
              {/* Facility Header */}
              <div style={{
                backgroundColor: '#f3f4f6',
                padding: '16px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <h2 style={{
                  margin: '0 0 4px 0',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#111827'
                }}>
                  {facility.name}
                </h2>
                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#6b7280'
                }}>
                  {facility.location.lat.toFixed(4)}, {facility.location.lon.toFixed(4)}
                </p>
              </div>

              {/* Content */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                padding: '16px'
              }}>
                {/* Camera Feed */}
                <div>
                  <h3 style={{
                    margin: '0 0 8px 0',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    Live Camera ({selectedView})
                  </h3>
                  <div style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb'
                  }}>
                    <img
                      src={facility.cameras[selectedView]}
                      alt={`${facility.name} - ${selectedView} view`}
                      style={{
                        width: '100%',
                        height: '200px',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%236b7280" font-size="16"%3ECamera Unavailable%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                  <p style={{
                    margin: '8px 0 0 0',
                    fontSize: '11px',
                    color: '#9ca3af',
                    fontStyle: 'italic'
                  }}>
                    Manually count trucks visible in the parking area
                  </p>
                </div>

                {/* Prediction Data */}
                <div>
                  <h3 style={{
                    margin: '0 0 8px 0',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    Model Prediction
                  </h3>

                  {pred ? (
                    <div style={{
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px',
                      padding: '12px',
                      border: '1px solid #e5e7eb'
                    }}>
                      {/* Occupancy Bar */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '4px'
                        }}>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>Occupancy</span>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: getOccupancyColor(pred.occupancyRate)
                          }}>
                            {Math.round(pred.occupancyRate * 100)}%
                          </span>
                        </div>
                        <div style={{
                          height: '8px',
                          backgroundColor: '#e5e7eb',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${pred.occupancyRate * 100}%`,
                            height: '100%',
                            backgroundColor: getOccupancyColor(pred.occupancyRate),
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        marginBottom: '12px'
                      }}>
                        <div style={{
                          backgroundColor: 'white',
                          padding: '8px',
                          borderRadius: '4px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            marginBottom: '2px'
                          }}>
                            Available
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#22c55e'
                          }}>
                            {pred.available}
                          </div>
                        </div>

                        <div style={{
                          backgroundColor: 'white',
                          padding: '8px',
                          borderRadius: '4px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            marginBottom: '2px'
                          }}>
                            Occupied
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#ef4444'
                          }}>
                            {pred.occupied}
                          </div>
                        </div>

                        <div style={{
                          backgroundColor: 'white',
                          padding: '8px',
                          borderRadius: '4px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            marginBottom: '2px'
                          }}>
                            Capacity
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#3b82f6'
                          }}>
                            {pred.capacity}
                          </div>
                        </div>

                        <div style={{
                          backgroundColor: 'white',
                          padding: '8px',
                          borderRadius: '4px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            marginBottom: '2px'
                          }}>
                            Confidence
                          </div>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: 'bold',
                            color: conf.color
                          }}>
                            {conf.text}
                          </div>
                        </div>
                      </div>

                      {/* Prediction Time */}
                      <div style={{
                        fontSize: '11px',
                        color: '#9ca3af',
                        borderTop: '1px solid #e5e7eb',
                        paddingTop: '8px'
                      }}>
                        Predicted for: {new Date(pred.predictedFor).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      backgroundColor: '#fef3c7',
                      borderRadius: '6px',
                      padding: '16px',
                      border: '1px solid #f59e0b',
                      textAlign: 'center',
                      color: '#92400e',
                      fontSize: '13px'
                    }}>
                      Prediction data unavailable
                    </div>
                  )}

                  {/* Validation Input */}
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '6px',
                    border: '1px solid #3b82f6'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#1e40af',
                      marginBottom: '6px'
                    }}>
                      Manual Count (optional):
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={pred ? pred.capacity : 100}
                      placeholder="Count trucks in camera"
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #bfdbfe',
                        fontSize: '13px'
                      }}
                    />
                    <p style={{
                      margin: '6px 0 0 0',
                      fontSize: '11px',
                      color: '#6b7280',
                      fontStyle: 'italic'
                    }}>
                      Enter number of occupied spaces you count
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Instructions */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        marginTop: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{
          margin: '0 0 12px 0',
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#111827'
        }}>
          How to Use This Dashboard
        </h3>
        <ol style={{
          margin: 0,
          paddingLeft: '20px',
          color: '#6b7280',
          fontSize: '14px',
          lineHeight: '1.6'
        }}>
          <li>View live camera feeds from Iowa DOT rest areas on I-80</li>
          <li>Compare camera images with the model's parking predictions</li>
          <li>Manually count visible trucks in the parking area using different camera angles</li>
          <li>Enter your count in the validation field to track prediction accuracy</li>
          <li>Use this data to identify patterns where predictions are most/least accurate</li>
        </ol>
      </div>
    </div>
  );
}

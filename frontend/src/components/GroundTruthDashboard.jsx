import { useState, useEffect } from 'react';
import api from '../services/api';
import ParkingAccuracyMetrics from './ParkingAccuracyMetrics';

export default function GroundTruthDashboard({ authToken, currentUser }) {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedViewByFacility, setSelectedViewByFacility] = useState({}); // Track view per facility
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [manualCounts, setManualCounts] = useState({}); // Track manual count per facility
  const [totalCapacityCounts, setTotalCapacityCounts] = useState({}); // Track total capacity per facility
  const [submitStatus, setSubmitStatus] = useState({}); // Track submission status per facility
  const [aiCountLoading, setAiCountLoading] = useState({}); // Track AI counting status per facility
  const [consensusLoading, setConsensusLoading] = useState({}); // Track consensus counting status per facility
  const [consensusResults, setConsensusResults] = useState({}); // Store consensus results per facility

  const getAvailableCameraViews = (cameras) => {
    return Object.keys(cameras || {});
  };

  const formatViewName = (view) => {
    return view.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const handleSubmitObservation = async (facility) => {
    const manualCount = manualCounts[facility.facilityId];
    const totalCapacity = totalCapacityCounts[facility.facilityId];

    // Validate input
    if (manualCount === undefined || manualCount === '' || manualCount === null) {
      setSubmitStatus(prev => ({
        ...prev,
        [facility.facilityId]: { type: 'error', message: 'Please enter an occupied count' }
      }));
      return;
    }

    const count = parseInt(manualCount);
    if (isNaN(count) || count < 0) {
      setSubmitStatus(prev => ({
        ...prev,
        [facility.facilityId]: { type: 'error', message: 'Please enter a valid number' }
      }));
      return;
    }

    // Validate total capacity if provided
    const capacity = totalCapacity ? parseInt(totalCapacity) : null;
    if (capacity !== null && (isNaN(capacity) || capacity < 0)) {
      setSubmitStatus(prev => ({
        ...prev,
        [facility.facilityId]: { type: 'error', message: 'Please enter a valid total capacity' }
      }));
      return;
    }

    // Set submitting status
    setSubmitStatus(prev => ({
      ...prev,
      [facility.facilityId]: { type: 'submitting', message: 'Saving...' }
    }));

    try {
      const currentView = selectedViewByFacility[facility.facilityId];
      const pred = facility.prediction;

      const logMsg = capacity !== null
        ? `Submitting observation: ${count}/${capacity} occupied at ${facility.facilityId} - ${currentView}`
        : `Submitting observation: ${count} trucks at ${facility.facilityId} - ${currentView}`;
      console.log(logMsg);

      const response = await api.post('/api/parking/ground-truth/observations', {
        facilityId: facility.facilityId,
        cameraView: currentView,
        observedCount: count,
        observedTotalCapacity: capacity,
        predictedCount: pred ? pred.occupied : null,
        predictedOccupancyRate: pred ? pred.occupancyRate : null
      });

      console.log('Observation response:', response.data);

      if (response.data.success) {
        const successMsg = capacity !== null
          ? `✅ Saved! ${count} occupied / ${capacity - count} open (${capacity} total) at ${new Date().toLocaleTimeString()}`
          : `✅ Saved! Counted ${count} truck${count !== 1 ? 's' : ''} at ${new Date().toLocaleTimeString()}`;

        setSubmitStatus(prev => ({
          ...prev,
          [facility.facilityId]: {
            type: 'success',
            message: successMsg
          }
        }));

        // Clear the input and success message after 5 seconds
        setTimeout(() => {
          setManualCounts(prev => ({
            ...prev,
            [facility.facilityId]: ''
          }));
          setTotalCapacityCounts(prev => ({
            ...prev,
            [facility.facilityId]: ''
          }));
          setSubmitStatus(prev => ({
            ...prev,
            [facility.facilityId]: null
          }));
        }, 5000);
      } else {
        setSubmitStatus(prev => ({
          ...prev,
          [facility.facilityId]: { type: 'error', message: 'Failed to save observation' }
        }));
      }
    } catch (err) {
      console.error('Error submitting observation:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to save observation';
      setSubmitStatus(prev => ({
        ...prev,
        [facility.facilityId]: { type: 'error', message: `❌ Error: ${errorMsg}` }
      }));

      // Keep error message visible longer
      setTimeout(() => {
        setSubmitStatus(prev => ({
          ...prev,
          [facility.facilityId]: null
        }));
      }, 8000);
    }
  };

  const handleGetAiCount = async (facility) => {
    const currentView = selectedViewByFacility[facility.facilityId];

    // Set loading status
    setAiCountLoading(prev => ({
      ...prev,
      [facility.facilityId]: true
    }));

    try {
      const response = await api.post('/api/parking/ground-truth/ai-count', {
        facilityId: facility.facilityId,
        cameraView: currentView
      });

      if (response.data.success) {
        const { occupied, totalCapacity, available } = response.data;

        // Populate both occupied and total capacity fields
        setManualCounts(prev => ({
          ...prev,
          [facility.facilityId]: occupied
        }));

        setTotalCapacityCounts(prev => ({
          ...prev,
          [facility.facilityId]: totalCapacity
        }));

        // Show success message with all metrics
        setSubmitStatus(prev => ({
          ...prev,
          [facility.facilityId]: {
            type: 'success',
            message: `AI found ${occupied} occupied / ${available} open spaces (${totalCapacity} total)`
          }
        }));

        // Clear success message after 5 seconds
        setTimeout(() => {
          setSubmitStatus(prev => ({
            ...prev,
            [facility.facilityId]: null
          }));
        }, 5000);
      } else {
        setSubmitStatus(prev => ({
          ...prev,
          [facility.facilityId]: {
            type: 'error',
            message: response.data.error || 'Failed to get AI count'
          }
        }));
      }
    } catch (err) {
      console.error('Error getting AI count:', err);
      setSubmitStatus(prev => ({
        ...prev,
        [facility.facilityId]: {
          type: 'error',
          message: err.response?.data?.error || 'Failed to get AI count'
        }
      }));
    } finally {
      setAiCountLoading(prev => ({
        ...prev,
        [facility.facilityId]: false
      }));
    }
  };

  const handleGetConsensusCount = async (facility) => {
    // Set loading status
    setConsensusLoading(prev => ({
      ...prev,
      [facility.facilityId]: true
    }));

    try {
      const response = await api.getAICountConsensus(facility.facilityId);

      if (response.success) {
        const { consensus, individualCameras, cameraCount } = response;

        // Store the full consensus results for display
        setConsensusResults(prev => ({
          ...prev,
          [facility.facilityId]: {
            consensus,
            individualCameras,
            cameraCount,
            timestamp: response.timestamp
          }
        }));

        // Populate the manual count fields with consensus results
        setManualCounts(prev => ({
          ...prev,
          [facility.facilityId]: consensus.occupied
        }));

        // Use consensus totalCapacity if available, otherwise fallback to prediction capacity
        const pred = predictions[facility.facilityId];
        const capacityToUse = consensus.totalCapacity || (pred ? pred.capacity : null);

        setTotalCapacityCounts(prev => ({
          ...prev,
          [facility.facilityId]: capacityToUse
        }));

        // Show success message
        const capacitySource = consensus.totalCapacity ? '' : ' (capacity from prediction)';
        setSubmitStatus(prev => ({
          ...prev,
          [facility.facilityId]: {
            type: 'success',
            message: `Multi-camera consensus: ${consensus.occupied}/${capacityToUse} (${consensus.confidence} confidence, ${consensus.estimatedOverlapPercentage}% overlap detected)${capacitySource}`
          }
        }));

        // Clear success message after 8 seconds (longer for consensus)
        setTimeout(() => {
          setSubmitStatus(prev => ({
            ...prev,
            [facility.facilityId]: null
          }));
        }, 8000);
      } else {
        setSubmitStatus(prev => ({
          ...prev,
          [facility.facilityId]: {
            type: 'error',
            message: response.error || 'Failed to get consensus count'
          }
        }));
      }
    } catch (err) {
      console.error('Error getting consensus count:', err);
      setSubmitStatus(prev => ({
        ...prev,
        [facility.facilityId]: {
          type: 'error',
          message: err.response?.data?.error || 'Failed to get consensus count. Ensure OpenAI API key is configured.'
        }
      }));
    } finally {
      setConsensusLoading(prev => ({
        ...prev,
        [facility.facilityId]: false
      }));
    }
  };

  const fetchGroundTruthData = async () => {
    try {
      setError(null);
      const response = await api.get('/api/parking/ground-truth');

      if (response.data.success) {
        const facilitiesData = response.data.facilities;

        // Fetch 24-hour predictions for each facility
        const facilitiesWithHourlyData = await Promise.all(
          facilitiesData.map(async (facility) => {
            const hourlyPredictions = [];
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Get predictions for each hour of today (in parallel for speed)
            const hourlyPromises = Array.from({ length: 24 }, (_, hour) => {
              const targetTime = new Date(today);
              targetTime.setHours(hour);

              return api.get(`/api/parking/historical/predict/${facility.facilityId}?time=${targetTime.toISOString()}`)
                .then(predResponse => {
                  if (predResponse.data.success && predResponse.data.prediction) {
                    const pred = predResponse.data.prediction;
                    return {
                      hour,
                      occupancyRate: pred.occupancyRate,
                      occupied: pred.predictedOccupied,
                      available: pred.predictedAvailable,
                      capacity: pred.capacity
                    };
                  }
                  return { hour, occupancyRate: null };
                })
                .catch(() => ({ hour, occupancyRate: null }));
            });

            const hourlyResults = await Promise.all(hourlyPromises);
            hourlyPredictions.push(...hourlyResults.sort((a, b) => a.hour - b.hour));

            return {
              ...facility,
              hourlyPredictions
            };
          })
        );

        setFacilities(facilitiesWithHourlyData);

        // Initialize selected views for each facility (use first available camera)
        const initialViews = {};
        const initialCapacities = {};
        facilitiesWithHourlyData.forEach(facility => {
          const views = getAvailableCameraViews(facility.cameras);
          if (views.length > 0) {
            initialViews[facility.facilityId] = views[0];
          }
          // Pre-populate total capacity from prediction data
          if (facility.prediction && facility.prediction.capacity) {
            initialCapacities[facility.facilityId] = facility.prediction.capacity;
          }
        });
        setSelectedViewByFacility(initialViews);
        setTotalCapacityCounts(initialCapacities);

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
    if (confidence === 'medium') return { text: 'Medium', color: '#6b7280' };
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
      backgroundColor: '#6b7280'
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
          Compare parking predictions with live camera feeds • View hourly occupancy trends • Validate model accuracy
        </p>

        {/* Controls */}
        <div style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>

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

      {/* Accuracy Metrics */}
      <ParkingAccuracyMetrics authToken={authToken} currentUser={currentUser} />

      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: '#6b7280',
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
          const availableViews = getAvailableCameraViews(facility.cameras);
          const currentView = selectedViewByFacility[facility.facilityId] || availableViews[0];

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
                backgroundColor: '#6b7280',
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
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Live Camera
                    </h3>
                    {/* Camera View Selector */}
                    <select
                      value={currentView}
                      onChange={(e) => setSelectedViewByFacility(prev => ({
                        ...prev,
                        [facility.facilityId]: e.target.value
                      }))}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        fontSize: '12px',
                        backgroundColor: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      {availableViews.map(view => (
                        <option key={view} value={view}>
                          {formatViewName(view)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{
                    backgroundColor: '#6b7280',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb'
                  }}>
                    <img
                      src={facility.cameras[currentView]}
                      alt={`${facility.name} - ${formatViewName(currentView)} view`}
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

                  {/* All Camera Views Thumbnails */}
                  {availableViews.length > 1 && (
                    <div style={{
                      marginTop: '12px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                      gap: '8px'
                    }}>
                      {availableViews.map(view => (
                        <div
                          key={view}
                          onClick={() => setSelectedViewByFacility(prev => ({
                            ...prev,
                            [facility.facilityId]: view
                          }))}
                          style={{
                            cursor: 'pointer',
                            border: view === currentView ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (view !== currentView) e.currentTarget.style.borderColor = '#3b82f6';
                          }}
                          onMouseLeave={(e) => {
                            if (view !== currentView) e.currentTarget.style.borderColor = '#e5e7eb';
                          }}
                        >
                          <img
                            src={facility.cameras[view]}
                            alt={`${formatViewName(view)}`}
                            style={{
                              width: '100%',
                              height: '60px',
                              objectFit: 'cover',
                              display: 'block'
                            }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="100"%3E%3Crect fill="%23f3f4f6" width="200" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%236b7280" font-size="10"%3EUnavailable%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          <div style={{
                            padding: '4px',
                            backgroundColor: view === currentView ? '#3b82f6' : '#f9fafb',
                            color: view === currentView ? 'white' : '#374151',
                            fontSize: '9px',
                            textAlign: 'center',
                            fontWeight: view === currentView ? '600' : '500'
                          }}>
                            {formatViewName(view).replace(/Truck Parking/g, 'TP')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p style={{
                    margin: '8px 0 0 0',
                    fontSize: '11px',
                    color: '#9ca3af',
                    fontStyle: 'italic'
                  }}>
                    {currentView.includes('truckParking') ?
                      'Count occupied truck parking spaces visible in camera' :
                      'Manually count trucks visible in the parking area'}
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
                      backgroundColor: '#6b7280',
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

                      {/* Hourly Busy Graph */}
                      {facility.hourlyPredictions && facility.hourlyPredictions.length > 0 && (
                        <div style={{
                          borderTop: '1px solid #e5e7eb',
                          paddingTop: '12px',
                          marginTop: '12px'
                        }}>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#374151',
                            marginBottom: '8px'
                          }}>
                            Today's Predicted Busy Hours
                          </div>

                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: '3px',
                            height: '80px',
                            backgroundColor: '#6b7280',
                            padding: '8px',
                            paddingLeft: '32px',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            position: 'relative'
                          }}>
                            {/* Y-axis labels */}
                            <div style={{
                              position: 'absolute',
                              left: '2px',
                              top: '8px',
                              bottom: '8px',
                              width: '28px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              fontSize: '8px',
                              color: '#9ca3af',
                              fontWeight: '500'
                            }}>
                              <span>100%</span>
                              <span>50%</span>
                              <span>0%</span>
                            </div>

                            {/* Grid lines */}
                            <div style={{
                              position: 'absolute',
                              left: '32px',
                              right: '8px',
                              top: '8px',
                              bottom: '8px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between'
                            }}>
                              <div style={{ borderTop: '1px dashed #e5e7eb' }} />
                              <div style={{ borderTop: '1px dashed #e5e7eb' }} />
                            </div>

                            {/* Bars */}
                            {facility.hourlyPredictions.map(({ hour, occupancyRate }) => {
                              const currentHour = new Date().getHours();
                              const isCurrentHour = hour === currentHour;
                              const percentage = occupancyRate !== null ? occupancyRate * 100 : 0;
                              const color = occupancyRate === null ? '#e5e7eb' :
                                occupancyRate > 0.8 ? '#ef4444' :
                                occupancyRate > 0.6 ? '#f59e0b' :
                                occupancyRate > 0.3 ? '#fbbf24' : '#22c55e';

                              return (
                                <div
                                  key={hour}
                                  style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    height: '100%',
                                    position: 'relative'
                                  }}
                                  title={`${hour}:00 - ${Math.round(percentage)}% occupied${occupancyRate === null ? ' (no data)' : ''}`}
                                >
                                  <div
                                    style={{
                                      width: '100%',
                                      height: `${Math.max(percentage, 2)}%`,
                                      backgroundColor: color,
                                      borderRadius: '2px 2px 0 0',
                                      transition: 'all 0.2s ease',
                                      border: isCurrentHour ? '2px solid #3b82f6' : 'none',
                                      boxSizing: 'border-box',
                                      position: 'relative'
                                    }}
                                  >
                                    {isCurrentHour && percentage > 10 && (
                                      <div style={{
                                        position: 'absolute',
                                        top: '-16px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        fontSize: '9px',
                                        fontWeight: '600',
                                        color: '#3b82f6',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {Math.round(percentage)}%
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Hour labels */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: '4px',
                            fontSize: '9px',
                            color: '#9ca3af'
                          }}>
                            <span>12am</span>
                            <span>6am</span>
                            <span>12pm</span>
                            <span>6pm</span>
                            <span>11pm</span>
                          </div>

                          <div style={{
                            display: 'flex',
                            gap: '12px',
                            justifyContent: 'center',
                            fontSize: '9px',
                            color: '#6b7280',
                            marginTop: '6px',
                            flexWrap: 'wrap'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <div style={{ width: '8px', height: '8px', backgroundColor: '#22c55e', borderRadius: '1px' }} />
                              <span>Low (&lt;30%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <div style={{ width: '8px', height: '8px', backgroundColor: '#6b7280', borderRadius: '1px' }} />
                              <span>Med (30-60%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <div style={{ width: '8px', height: '8px', backgroundColor: '#6b7280', borderRadius: '1px' }} />
                              <span>High (60-80%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <div style={{ width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '1px' }} />
                              <span>Full (&gt;80%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <div style={{ width: '2px', height: '8px', backgroundColor: '#3b82f6', borderRadius: '1px' }} />
                              <span>Now ({new Date().getHours()}:00)</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      backgroundColor: '#6b7280',
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
                    {/* AI Count Button */}
                    <button
                      onClick={() => handleGetAiCount(facility)}
                      disabled={aiCountLoading[facility.facilityId]}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: aiCountLoading[facility.facilityId] ? '#9ca3af' : '#8b5cf6',
                        color: '#111827',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: aiCountLoading[facility.facilityId] ? 'not-allowed' : 'pointer',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {aiCountLoading[facility.facilityId] ? (
                        <>
                          <div style={{
                            width: '14px',
                            height: '14px',
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTopColor: 'white',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                          AI Counting...
                        </>
                      ) : (
                        <>
                          🤖 Get AI Count
                        </>
                      )}
                    </button>

                    {/* Multi-Camera Consensus Button */}
                    <button
                      onClick={() => handleGetConsensusCount(facility)}
                      disabled={consensusLoading[facility.facilityId]}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: consensusLoading[facility.facilityId] ? '#9ca3af' : '#10b981',
                        color: '#111827',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: consensusLoading[facility.facilityId] ? 'not-allowed' : 'pointer',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {consensusLoading[facility.facilityId] ? (
                        <>
                          <div style={{
                            width: '14px',
                            height: '14px',
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTopColor: 'white',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                          Analyzing All Cameras...
                        </>
                      ) : (
                        <>
                          🎯 Multi-Camera Consensus ({Object.keys(facility.cameras || {}).length} views)
                        </>
                      )}
                    </button>

                    {/* Display consensus results if available */}
                    {consensusResults[facility.facilityId] && (
                      <div style={{
                        marginBottom: '12px',
                        padding: '10px',
                        backgroundColor: '#ecfdf5',
                        borderRadius: '4px',
                        border: '1px solid #10b981',
                        fontSize: '12px'
                      }}>
                        <div style={{ fontWeight: '600', color: '#047857', marginBottom: '6px' }}>
                          Consensus Analysis ({consensusResults[facility.facilityId].cameraCount} cameras)
                        </div>
                        <div style={{ color: '#065f46', marginBottom: '4px' }}>
                          <strong>Reasoning:</strong> {consensusResults[facility.facilityId].consensus.reasoning}
                        </div>
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #a7f3d0' }}>
                          <div style={{ fontWeight: '600', marginBottom: '4px', color: '#047857' }}>Individual Camera Counts:</div>
                          {consensusResults[facility.facilityId].individualCameras.map((cam, idx) => (
                            <div key={idx} style={{ marginBottom: '2px', color: '#065f46', fontSize: '11px' }}>
                              • {cam.viewName}: {cam.occupied}/{cam.total} ({cam.confidence})
                              {cam.viewDescription && ` - ${cam.viewDescription}`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#1e40af',
                      marginBottom: '6px'
                    }}>
                      Occupied Spaces:
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="number"
                        min="0"
                        max={pred ? pred.capacity : 100}
                        placeholder="Occupied"
                        value={manualCounts[facility.facilityId] || ''}
                        onChange={(e) => setManualCounts(prev => ({
                          ...prev,
                          [facility.facilityId]: e.target.value
                        }))}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #bfdbfe',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#1e40af',
                      marginBottom: '6px'
                    }}>
                      Total Capacity:
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="number"
                        min="0"
                        max={200}
                        placeholder="Total capacity"
                        value={totalCapacityCounts[facility.facilityId] || ''}
                        onChange={(e) => setTotalCapacityCounts(prev => ({
                          ...prev,
                          [facility.facilityId]: e.target.value
                        }))}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #bfdbfe',
                          fontSize: '13px'
                        }}
                      />
                      <button
                        onClick={() => handleSubmitObservation(facility)}
                        disabled={submitStatus[facility.facilityId]?.type === 'submitting'}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: submitStatus[facility.facilityId]?.type === 'submitting' ? '#9ca3af' : '#3b82f6',
                          color: '#111827',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: submitStatus[facility.facilityId]?.type === 'submitting' ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {submitStatus[facility.facilityId]?.type === 'submitting' ? 'Saving...' : 'Submit'}
                      </button>
                    </div>

                    {/* Status Message */}
                    {submitStatus[facility.facilityId] && submitStatus[facility.facilityId].type !== 'submitting' && (
                      <div style={{
                        marginTop: '8px',
                        padding: '6px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: submitStatus[facility.facilityId].type === 'success' ? '#d1fae5' : '#fee2e2',
                        color: submitStatus[facility.facilityId].type === 'success' ? '#065f46' : '#991b1b'
                      }}>
                        {submitStatus[facility.facilityId].message}
                      </div>
                    )}

                    <p style={{
                      margin: '6px 0 0 0',
                      fontSize: '11px',
                      color: '#6b7280',
                      fontStyle: 'italic'
                    }}>
                      Total capacity is pre-filled from prediction data. Enter occupied count or use AI button.
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
          <li>View live camera feeds from Iowa DOT rest areas on I-80 and I-35</li>
          <li>Review the predicted busy hours graph showing occupancy trends throughout the day</li>
          <li>Compare camera images with the model's current parking predictions</li>
          <li>Click "Get AI Count" to use AI vision to automatically count occupied spaces, total capacity, and available spaces</li>
          <li>Manually count visible parking spaces (occupied count) using different camera angles, or adjust the AI count if needed</li>
          <li>Total capacity is pre-filled from the prediction data - just enter the occupied count to submit</li>
          <li>Use this data to identify patterns where predictions are most/least accurate</li>
        </ol>
      </div>
    </div>
  );
}


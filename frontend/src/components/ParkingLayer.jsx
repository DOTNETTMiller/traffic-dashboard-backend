import { useState, useEffect } from 'react';
import { Marker, Popup, Tooltip, LayerGroup } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

// Custom truck parking icon
const createParkingIcon = (availableSpaces, totalSpaces, isPrediction) => {
  // Calculate fill percentage
  const occupancyRate = totalSpaces > 0 ? (totalSpaces - availableSpaces) / totalSpaces : 0;

  // Color based on availability
  let fillColor = '#22c55e'; // Green - plenty available
  if (occupancyRate > 0.8) {
    fillColor = '#ef4444'; // Red - nearly full
  } else if (occupancyRate > 0.5) {
    fillColor = '#f59e0b'; // Orange - moderately full
  }

  // Border style - dashed if prediction
  const borderStyle = isPrediction ? 'stroke-dasharray="3,2"' : '';

  const iconSvg = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="${fillColor}" stroke="white" stroke-width="2" ${borderStyle} />
      <text x="16" y="21" text-anchor="middle" font-size="16" font-weight="bold" fill="white">P</text>
    </svg>
  `;

  return L.divIcon({
    html: iconSvg,
    className: 'parking-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

export default function ParkingLayer({ showParking = false }) {
  const [parkingData, setParkingData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!showParking) {
      return;
    }

    const fetchParkingData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch historical pattern-based predictions for all facilities
        const response = await api.get('/api/parking/historical/predict-all');

        if (response.data && response.data.success) {
          // Transform the prediction data to match the expected format
          const transformedData = response.data.predictions.map(pred => ({
            facilityId: pred.facilityId,
            facilityName: pred.siteId || pred.facilityId,
            state: pred.state,
            latitude: pred.latitude || 0, // Will need coordinates from TruckStopsExport.xlsx
            longitude: pred.longitude || 0,
            availableSpaces: pred.predictedAvailable,
            occupiedSpaces: pred.predictedOccupied,
            truckSpaces: pred.capacity,
            isPrediction: true,
            predictionConfidence: pred.confidence === 'high' ? 0.9 : pred.confidence === 'medium' ? 0.7 : 0.5,
            timestamp: pred.predictedFor,
            occupancyRate: pred.occupancyRate,
            status: pred.status
          }));

          setParkingData(transformedData);
        } else {
          setError('Failed to fetch parking predictions');
        }
      } catch (err) {
        console.error('Error fetching parking predictions:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchParkingData();

    // Refresh parking data every 5 minutes
    const interval = setInterval(fetchParkingData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [showParking]);

  if (!showParking) {
    return null;
  }

  if (loading && parkingData.length === 0) {
    return null; // Don't show anything while initial load
  }

  return (
    <LayerGroup>
      {parkingData.map((facility) => {
        const lat = parseFloat(facility.latitude);
        const lon = parseFloat(facility.longitude);

        // Skip invalid coordinates
        if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
          return null;
        }

        const availableSpaces = facility.availableSpaces || 0;
        const totalSpaces = facility.truckSpaces || 0;
        const occupiedSpaces = facility.occupiedSpaces || 0;
        const isPrediction = facility.isPrediction || false;

        const icon = createParkingIcon(availableSpaces, totalSpaces, isPrediction);

        return (
          <Marker
            key={facility.facilityId}
            position={[lat, lon]}
            icon={icon}
          >
            <Tooltip direction="top" offset={[0, -16]} opacity={0.9}>
              <div style={{ minWidth: '150px' }}>
                <strong>{facility.facilityName}</strong><br />
                <span style={{ color: availableSpaces > 0 ? '#22c55e' : '#ef4444' }}>
                  {availableSpaces} spaces available
                </span>
                {isPrediction && (
                  <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#6b7280' }}>
                    (Predicted)
                  </div>
                )}
              </div>
            </Tooltip>
            <Popup maxWidth={300}>
              <div style={{ padding: '8px' }}>
                <h3 style={{
                  margin: '0 0 8px 0',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🚛 {facility.facilityName}
                </h3>
                <p style={{ margin: '4px 0' }}>
                  <strong>State:</strong> {facility.state}
                </p>
                {facility.address && (
                  <p style={{ margin: '4px 0' }}>
                    <strong>Address:</strong> {facility.address}
                  </p>
                )}
                <div style={{
                  margin: '12px 0',
                  padding: '8px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span><strong>Available:</strong></span>
                    <span style={{
                      color: availableSpaces > 0 ? '#22c55e' : '#ef4444',
                      fontWeight: 'bold'
                    }}>
                      {availableSpaces}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span><strong>Occupied:</strong></span>
                    <span>{occupiedSpaces}</span>
                  </div>
                  {totalSpaces > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong>Total Spaces:</strong></span>
                      <span>{totalSpaces}</span>
                    </div>
                  )}
                </div>
                {isPrediction && (
                  <p style={{
                    margin: '8px 0',
                    padding: '6px',
                    backgroundColor: '#fef3c7',
                    borderRadius: '4px',
                    fontSize: '12px',
                    borderLeft: '3px solid #f59e0b'
                  }}>
                    <strong>⚡ Predicted Availability</strong><br />
                    <span style={{ fontSize: '11px', fontStyle: 'italic' }}>
                      Confidence: {Math.round((facility.predictionConfidence || 0) * 100)}%
                    </span>
                  </p>
                )}
                <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#6b7280' }}>
                  Last updated: {new Date(facility.timestamp).toLocaleString()}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </LayerGroup>
  );
}

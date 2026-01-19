import { useEffect, useState } from 'react';
import { Polyline, Popup, CircleMarker } from 'react-leaflet';
import api from '../services/api';

// DQI score to color mapping
const getDQIColor = (dqi) => {
  if (!dqi) return '#9ca3af'; // gray for no data
  if (dqi >= 90) return '#10b981'; // green (A/A-)
  if (dqi >= 80) return '#3b82f6'; // blue (B+/B/B-)
  if (dqi >= 70) return '#f59e0b'; // orange (C+/C/C-)
  if (dqi >= 60) return '#f97316'; // dark orange (D+/D)
  return '#ef4444'; // red (F/D-)
};

// Get letter grade from DQI
const getDQIGrade = (dqi) => {
  if (!dqi) return 'N/A';
  if (dqi >= 97) return 'A+';
  if (dqi >= 93) return 'A';
  if (dqi >= 90) return 'A-';
  if (dqi >= 87) return 'B+';
  if (dqi >= 83) return 'B';
  if (dqi >= 80) return 'B-';
  if (dqi >= 77) return 'C+';
  if (dqi >= 73) return 'C';
  if (dqi >= 70) return 'C-';
  if (dqi >= 67) return 'D+';
  if (dqi >= 63) return 'D';
  if (dqi >= 60) return 'D-';
  return 'F';
};

const TETCCorridorsLayer = ({ events = [] }) => {
  const [corridors, setCorridors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCorridors = async () => {
      try {
        setLoading(true);
        const response = await api.get('/data-quality/corridors');

        if (response.data.success) {
          setCorridors(response.data.corridors);
        } else {
          setError('Failed to load corridor data');
        }
      } catch (err) {
        console.error('Error fetching TETC corridors:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCorridors();
  }, []);

  // Calculate event density for a corridor (events per 100 miles)
  const getEventDensity = (corridor) => {
    if (!corridor.bounds || !events.length) return 0;

    const { north, south, west, east } = corridor.bounds;

    // Count events within corridor bounds (with some buffer)
    const buffer = 0.2; // ~13 miles
    const eventsInCorridor = events.filter(event => {
      const lat = event.geometry?.coordinates?.[1] || event.lat;
      const lng = event.geometry?.coordinates?.[0] || event.lng;

      return lat >= (south - buffer) && lat <= (north + buffer) &&
             lng >= (west - buffer) && lng <= (east + buffer);
    });

    // Rough distance calculation (miles)
    const latDiff = north - south;
    const distance = latDiff * 69; // 1 degree lat ≈ 69 miles

    return distance > 0 ? (eventsInCorridor.length / distance) * 100 : 0;
  };

  // Determine if corridor has a coverage gap
  const hasCoverageGap = (corridor) => {
    const eventDensity = getEventDensity(corridor);
    const avgDqi = corridor.avg_dqi || 0;

    // Gap = high event activity but low vendor quality
    return eventDensity > 1.0 && avgDqi < 80;
  };

  if (loading) {
    console.log('Loading TETC corridors...');
    return null;
  }

  if (error) {
    console.error('TETC corridors error:', error);
    return null;
  }

  return (
    <>
      {corridors.map(corridor => {
        if (!corridor.geometry) return null;

        const color = getDQIColor(corridor.avg_dqi);
        const grade = getDQIGrade(corridor.avg_dqi);
        const hasGap = hasCoverageGap(corridor);
        const eventDensity = getEventDensity(corridor);

        // Convert LineString to Leaflet coordinates [[lat, lng], ...]
        const positions = corridor.geometry.coordinates.map(coord => [coord[1], coord[0]]);

        return (
          <Polyline
            key={corridor.id}
            positions={positions}
            pathOptions={{
              color: hasGap ? '#ef4444' : color,
              weight: hasGap ? 6 : 4,
              opacity: 0.8,
              dashArray: hasGap ? '10, 10' : null
            }}
          >
            <Popup>
              <div style={{ minWidth: '280px' }}>
                <div style={{
                  background: `linear-gradient(135deg, ${color}, ${color}dd)`,
                  color: 'white',
                  padding: '12px',
                  margin: '-10px -10px 12px -10px',
                  borderRadius: '4px 4px 0 0'
                }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>
                    {corridor.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
                    {corridor.description}
                  </p>
                </div>

                <div style={{ padding: '0 4px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    gap: '12px'
                  }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: 'bold',
                        color: color,
                        lineHeight: 1
                      }}>
                        {grade}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        Letter Grade
                      </div>
                    </div>

                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#1f2937',
                        lineHeight: 1.2
                      }}>
                        {corridor.avg_dqi?.toFixed(1) || 'N/A'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        Avg DQI Score
                      </div>
                    </div>

                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#1f2937',
                        lineHeight: 1.2
                      }}>
                        {corridor.feed_count}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        Data Feeds
                      </div>
                    </div>
                  </div>

                  {hasGap && (
                    <div style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      padding: '8px',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 'bold',
                        color: '#dc2626',
                        marginBottom: '4px'
                      }}>
                        ⚠️ Coverage Gap Detected
                      </div>
                      <div style={{ fontSize: '12px', color: '#991b1b' }}>
                        High event activity ({eventDensity.toFixed(1)} events/100mi) but
                        below-target vendor quality (DQI {corridor.avg_dqi?.toFixed(0)}).
                        Consider additional vendor data sources.
                      </div>
                    </div>
                  )}

                  <div style={{
                    background: '#f9fafb',
                    borderRadius: '6px',
                    padding: '8px',
                    marginTop: '8px'
                  }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px' }}>
                      Quality Range
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '13px', color: '#1f2937' }}>
                        <strong>{corridor.min_dqi?.toFixed(0) || 'N/A'}</strong>
                        <span style={{ color: '#9ca3af', margin: '0 4px' }}>to</span>
                        <strong>{corridor.max_dqi?.toFixed(0) || 'N/A'}</strong>
                      </div>
                      <div style={{
                        flex: 1,
                        height: '6px',
                        background: `linear-gradient(to right,
                          ${getDQIColor(corridor.min_dqi)},
                          ${getDQIColor(corridor.max_dqi)})`,
                        borderRadius: '3px'
                      }}></div>
                    </div>
                  </div>

                  <div style={{
                    fontSize: '11px',
                    color: '#9ca3af',
                    marginTop: '12px',
                    padding: '8px',
                    background: '#f9fafb',
                    borderRadius: '4px'
                  }}>
                    <div style={{ marginBottom: '4px', color: '#6b7280', fontWeight: '500' }}>
                      Event Density
                    </div>
                    {eventDensity.toFixed(1)} events per 100 miles
                  </div>
                </div>
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {/* Add legend markers for coverage gaps */}
      {corridors.filter(hasCoverageGap).map(corridor => {
        if (!corridor.bounds) return null;

        // Place marker at midpoint
        const midLat = (corridor.bounds.north + corridor.bounds.south) / 2;
        const midLng = (corridor.bounds.west + corridor.bounds.east) / 2;

        return (
          <CircleMarker
            key={`gap-${corridor.id}`}
            center={[midLat, midLng]}
            radius={8}
            pathOptions={{
              fillColor: '#ef4444',
              color: 'white',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            }}
          >
            <Popup>
              <div style={{ minWidth: '200px' }}>
                <strong style={{ color: '#dc2626' }}>Coverage Gap</strong>
                <p style={{ margin: '8px 0 4px 0', fontSize: '13px' }}>
                  {corridor.name} has high event activity but needs improved vendor data quality.
                </p>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                  Vendors: Consider providing enhanced data coverage for this corridor.
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
};

export default TETCCorridorsLayer;

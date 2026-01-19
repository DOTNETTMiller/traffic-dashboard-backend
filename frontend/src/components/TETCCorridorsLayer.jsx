import { useEffect, useState } from 'react';
import { Polyline, Popup, CircleMarker, useMap } from 'react-leaflet';
import { DomEvent } from 'leaflet';
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

// Opportunity score to color mapping
const getOpportunityColor = (score) => {
  if (score > 60) return '#dc2626'; // Red - High priority
  if (score > 30) return '#f59e0b'; // Orange - Moderate
  if (score > 0) return '#3b82f6'; // Blue - Low priority
  return '#10b981'; // Green - Well-served
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
  const [coverageGaps, setCoverageGaps] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('dqi'); // 'dqi' or 'opportunity'
  const map = useMap();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch both corridors and coverage gaps in parallel
        const [corridorsRes, gapsRes] = await Promise.all([
          api.get('/api/data-quality/corridors'),
          api.get('/api/data-quality/coverage-gaps')
        ]);

        if (corridorsRes.data.success) {
          setCorridors(corridorsRes.data.corridors);
        } else {
          setError('Failed to load corridor data');
        }

        if (gapsRes.data.success) {
          // Convert gaps array to map by corridor_id for quick lookup
          const gapsMap = {};
          gapsRes.data.corridors.forEach(gap => {
            gapsMap[gap.corridor_id] = gap;
          });
          setCoverageGaps(gapsMap);
        }
      } catch (err) {
        console.error('Error fetching TETC corridors:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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

  // Map Legend Component
  const MapLegend = () => {
    useEffect(() => {
      const legend = DomEvent.disableClickPropagation(
        DomEvent.disableScrollPropagation(document.createElement('div'))
      );
      legend.className = 'leaflet-bar leaflet-control';
      legend.style.background = 'white';
      legend.style.padding = '10px';
      legend.style.borderRadius = '4px';
      legend.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

      const container = map.getContainer();
      container.appendChild(legend);
      legend.style.position = 'absolute';
      legend.style.top = '10px';
      legend.style.right = '10px';
      legend.style.zIndex = '1000';

      return () => {
        if (legend.parentNode) {
          legend.parentNode.removeChild(legend);
        }
      };
    }, []);

    return null;
  };

  return (
    <>
      {/* Toggle button */}
      {(() => {
        useEffect(() => {
          const button = document.createElement('div');
          button.className = 'leaflet-bar leaflet-control';
          button.style.background = 'white';
          button.style.padding = '8px 12px';
          button.style.borderRadius = '4px';
          button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
          button.style.cursor = 'pointer';
          button.style.fontWeight = '600';
          button.style.fontSize = '12px';
          button.style.position = 'absolute';
          button.style.top = '10px';
          button.style.left = '60px';
          button.style.zIndex = '1000';
          button.innerHTML = viewMode === 'dqi'
            ? '📊 Show Market Opportunities'
            : '🎯 Show Data Quality';

          button.onclick = () => {
            setViewMode(prev => prev === 'dqi' ? 'opportunity' : 'dqi');
          };

          DomEvent.disableClickPropagation(button);
          DomEvent.disableScrollPropagation(button);

          const container = map.getContainer();
          container.appendChild(button);

          return () => {
            if (button.parentNode) {
              button.parentNode.removeChild(button);
            }
          };
        }, [viewMode]);

        return null;
      })()}

      {corridors.map(corridor => {
        if (!corridor.geometry) return null;

        const dqiColor = getDQIColor(corridor.avg_dqi);
        const grade = getDQIGrade(corridor.avg_dqi);
        const hasGap = hasCoverageGap(corridor);
        const eventDensity = getEventDensity(corridor);
        const gapData = coverageGaps[corridor.id];
        const opportunityScore = gapData?.opportunity_score || 0;
        const opportunityColor = getOpportunityColor(opportunityScore);

        // Determine color based on view mode
        const color = viewMode === 'opportunity' ? opportunityColor : dqiColor;
        const weight = (viewMode === 'dqi' && hasGap) ? 6 : (viewMode === 'opportunity' && opportunityScore > 30) ? 6 : 4;

        // Convert LineString to Leaflet coordinates [[lat, lng], ...]
        const positions = corridor.geometry.coordinates.map(coord => [coord[1], coord[0]]);

        return (
          <Polyline
            key={corridor.id}
            positions={positions}
            pathOptions={{
              color: color,
              weight: weight,
              opacity: 0.8,
              dashArray: null
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
                  {viewMode === 'opportunity' && gapData ? (
                    <>
                      {/* Opportunity View */}
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
                            color: opportunityColor,
                            lineHeight: 1
                          }}>
                            {opportunityScore}
                          </div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                            Opportunity Score
                          </div>
                        </div>

                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{
                            fontSize: '24px',
                            fontWeight: 'bold',
                            color: '#1f2937',
                            lineHeight: 1.2
                          }}>
                            {gapData.current_state.vendor_count}
                          </div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                            Vendors
                          </div>
                        </div>

                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{
                            fontSize: '24px',
                            fontWeight: 'bold',
                            color: '#1f2937',
                            lineHeight: 1.2
                          }}>
                            {gapData.current_state.avg_dqi?.toFixed(0) || 'N/A'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                            Avg DQI
                          </div>
                        </div>
                      </div>

                      <div style={{
                        padding: '10px',
                        background: '#f9fafb',
                        borderRadius: '6px',
                        marginBottom: '12px',
                        borderLeft: `3px solid ${opportunityColor}`
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151' }}>
                          {gapData.market_assessment}
                        </div>
                      </div>

                      {gapData.gaps && gapData.gaps.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#374151' }}>
                            Gaps ({gapData.gaps.length})
                          </div>
                          {gapData.gaps.slice(0, 2).map((gap, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: '11px',
                                padding: '6px',
                                background: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '4px',
                                marginBottom: '4px'
                              }}
                            >
                              <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '2px' }}>
                                {gap.type.replace(/_/g, ' ').toUpperCase()}
                              </div>
                              <div style={{ color: '#6b7280' }}>
                                {gap.description.substring(0, 80)}{gap.description.length > 80 ? '...' : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {gapData.opportunities && gapData.opportunities.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#374151' }}>
                            Top Opportunity
                          </div>
                          <div style={{
                            fontSize: '12px',
                            padding: '8px',
                            background: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            borderRadius: '4px',
                            color: '#065f46'
                          }}>
                            <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                              {gapData.opportunities[0].action}
                            </div>
                            <div style={{ fontSize: '11px', fontStyle: 'italic' }}>
                              {gapData.opportunities[0].reason}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* DQI View */}
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
                            color: dqiColor,
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
                    </>
                  )}

                  {viewMode === 'dqi' && hasGap && (
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

                  {viewMode === 'dqi' && corridor.min_dqi && corridor.max_dqi && (
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
                          <strong>{corridor.min_dqi.toFixed(0)}</strong>
                          <span style={{ color: '#9ca3af', margin: '0 4px' }}>to</span>
                          <strong>{corridor.max_dqi.toFixed(0)}</strong>
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
                  )}

                  {viewMode === 'dqi' && (
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
                  )}
                </div>
              </div>
            </Popup>
          </Polyline>
        );
      })}
    </>
  );
};

export default TETCCorridorsLayer;

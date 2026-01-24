import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../services/api';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const CoverageGapAnalysis = () => {
  const [corridors, setCorridors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('vendors'); // 'vendors' or 'states'
  const [selectedCorridor, setSelectedCorridor] = useState(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    fetchCoverageGaps();
  }, []);

  const fetchCoverageGaps = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/data-quality/coverage-gaps');

      if (response.data.success) {
        setCorridors(response.data.corridors);
        setSummary(response.data.summary);
      } else {
        setError('Failed to load coverage gap analysis');
      }
    } catch (err) {
      console.error('Error fetching coverage gaps:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Extract geographic info from corridor description/name
  const getCorridorGeography = (corridor) => {
    // Try to extract state and route info from corridor name/description
    const stateMatch = corridor.corridor_name.match(/([A-Z]{2})(?:\s|$|_)/);
    const routeMatch = corridor.corridor_name.match(/(I-?\d+|US-?\d+|SR-?\d+)/i);

    const geography = {
      route: routeMatch ? routeMatch[1].toUpperCase() : null,
      state: stateMatch ? stateMatch[1] : null,
      description: corridor.description || '',
    };

    // Parse common patterns like "Mile 0 to Mile 100" or "City A to City B"
    const milePattern = /mile\s+(\d+\.?\d*)\s+to\s+mile\s+(\d+\.?\d*)/i;
    const cityPattern = /from\s+([A-Za-z\s]+)\s+to\s+([A-Za-z\s]+)/i;

    const mileMatch = corridor.description?.match(milePattern);
    const cityMatch = corridor.description?.match(cityPattern);

    if (mileMatch) {
      geography.startMile = parseFloat(mileMatch[1]);
      geography.endMile = parseFloat(mileMatch[2]);
      geography.segmentType = 'mile-marker';
    } else if (cityMatch) {
      geography.startCity = cityMatch[1].trim();
      geography.endCity = cityMatch[2].trim();
      geography.segmentType = 'city';
    }

    return geography;
  };

  const formatCorridorSegment = (corridor) => {
    const geo = getCorridorGeography(corridor);

    if (geo.segmentType === 'mile-marker') {
      return `${geo.route || 'Route'} (Mile ${geo.startMile} to ${geo.endMile}) - ${geo.state || ''}`;
    } else if (geo.segmentType === 'city') {
      return `${geo.route || 'Route'}: ${geo.startCity} to ${geo.endCity} - ${geo.state || ''}`;
    } else if (geo.route && geo.state) {
      return `${geo.route} - ${geo.state}`;
    }

    return corridor.corridor_name;
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getOpportunityColor = (score) => {
    if (score > 60) return '#dc2626'; // High priority
    if (score > 30) return '#f59e0b'; // Moderate
    if (score > 0) return '#3b82f6'; // Low
    return '#10b981'; // Well-served
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading coverage gap analysis...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: '#ef4444' }}>Error: {error}</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold' }}>
          Coverage Gap & Market Opportunity Analysis
        </h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          Identify underserved corridors and market expansion opportunities based on vendor diversity, data quality, and service coverage
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            padding: '16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: '500' }}>CRITICAL GAPS</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#dc2626' }}>
              {summary.critical_gaps}
            </div>
            <div style={{ fontSize: '11px', color: '#991b1b' }}>No vendor coverage</div>
          </div>

          <div style={{
            padding: '16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: '500' }}>HIGH PRIORITY</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ef4444' }}>
              {summary.high_priority}
            </div>
            <div style={{ fontSize: '11px', color: '#991b1b' }}>Opportunity score &gt; 60</div>
          </div>

          <div style={{
            padding: '16px',
            background: '#fffbeb',
            border: '1px solid #fed7aa',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: '#92400e', fontWeight: '500' }}>MODERATE</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>
              {summary.moderate_priority}
            </div>
            <div style={{ fontSize: '11px', color: '#92400e' }}>Opportunity score 30-60</div>
          </div>

          <div style={{
            padding: '16px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: '500' }}>LOW PRIORITY</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6' }}>
              {summary.low_priority}
            </div>
            <div style={{ fontSize: '11px', color: '#1e40af' }}>Incremental improvements</div>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        padding: '4px',
        background: '#f3f4f6',
        borderRadius: '8px',
        width: 'fit-content'
      }}>
        <button
          onClick={() => setViewMode('vendors')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: viewMode === 'vendors' ? '#3b82f6' : 'transparent',
            color: viewMode === 'vendors' ? 'white' : '#374151',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '14px'
          }}
        >
          Vendor Opportunities
        </button>
        <button
          onClick={() => setViewMode('states')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: viewMode === 'states' ? '#3b82f6' : 'transparent',
            color: viewMode === 'states' ? 'white' : '#374151',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '14px'
          }}
        >
          State Procurement Guidance
        </button>
      </div>

      {/* Corridor List */}
      {corridors.map((corridor, idx) => {
        const relevantOpportunities = corridor.opportunities.filter(
          opp => viewMode === 'vendors' ? opp.for === 'vendors' : opp.for === 'states'
        );

        if (relevantOpportunities.length === 0) return null;

        return (
          <div
            key={corridor.corridor_id}
            style={{
              marginBottom: '24px',
              padding: '20px',
              background: '#fff',
              border: '2px solid #e5e7eb',
              borderLeft: `6px solid ${getOpportunityColor(corridor.opportunity_score)}`,
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            {/* Corridor Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#1f2937', marginBottom: '4px' }}>
                  {corridor.corridor_name}
                </div>
                <div style={{ fontSize: '14px', color: '#3b82f6', fontWeight: '600', marginBottom: '6px' }}>
                  📍 {formatCorridorSegment(corridor)}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  {corridor.description}
                </div>
                <button
                  onClick={() => {
                    setSelectedCorridor(corridor);
                    setShowMap(true);
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '6px 12px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  🗺️ View on Map
                </button>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  display: 'inline-block',
                  padding: '6px 16px',
                  background: getOpportunityColor(corridor.opportunity_score),
                  color: 'white',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '24px'
                }}>
                  {corridor.opportunity_score}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                  Opportunity Score
                </div>
              </div>
            </div>

            {/* Market Assessment */}
            <div style={{
              padding: '12px',
              background: '#f9fafb',
              borderRadius: '6px',
              marginBottom: '16px',
              borderLeft: `3px solid ${getOpportunityColor(corridor.opportunity_score)}`
            }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>
                {corridor.market_assessment}
              </div>
            </div>

            {/* Current State */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
              padding: '16px',
              background: '#f9fafb',
              borderRadius: '6px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>VENDORS</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                  {corridor.current_state.vendor_count}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>
                  {corridor.current_state.providers}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>AVG DQI</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                  {corridor.current_state.avg_dqi != null ? Number(corridor.current_state.avg_dqi || 0).toFixed(1) : 'N/A'}
                </div>
                {corridor.current_state.dqi_range && (
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    Range: {corridor.current_state.dqi_range.min}-{corridor.current_state.dqi_range.max}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>SERVICE TYPES</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                  {corridor.current_state.service_type_count}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>
                  {corridor.current_state.service_types}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>TOTAL FEEDS</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                  {corridor.current_state.feed_count}
                </div>
              </div>
            </div>

            {/* Gaps */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                Identified Gaps ({corridor.gaps.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {corridor.gaps.map((gap, gapIdx) => (
                  <div
                    key={gapIdx}
                    style={{
                      padding: '10px',
                      background: '#fff',
                      border: `1px solid ${getSeverityColor(gap.severity)}33`,
                      borderLeft: `4px solid ${getSeverityColor(gap.severity)}`,
                      borderRadius: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', fontSize: '13px', color: '#1f2937', marginBottom: '4px' }}>
                          {gap.type.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div style={{ fontSize: '13px', color: '#4b5563' }}>
                          {gap.description}
                        </div>
                      </div>
                      <div style={{
                        padding: '3px 10px',
                        background: getSeverityColor(gap.severity),
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}>
                        {gap.severity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Opportunities */}
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#374151'
              }}>
                {viewMode === 'vendors' ? 'Market Opportunities' : 'Procurement Actions'} ({relevantOpportunities.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {relevantOpportunities.map((opp, oppIdx) => (
                  <div
                    key={oppIdx}
                    style={{
                      padding: '14px',
                      background: viewMode === 'vendors' ? '#ecfdf5' : '#eff6ff',
                      border: viewMode === 'vendors' ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                      borderRadius: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: viewMode === 'vendors' ? '#065f46' : '#1e40af'
                      }}>
                        {opp.action}
                      </div>
                      <div style={{
                        padding: '2px 8px',
                        background: getSeverityColor(opp.priority),
                        color: 'white',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}>
                        {opp.priority}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: viewMode === 'vendors' ? '#047857' : '#1d4ed8',
                      fontStyle: 'italic'
                    }}>
                      {opp.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {corridors.length === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            No coverage gaps found
          </div>
          <div style={{ color: '#6b7280' }}>
            All corridors have adequate vendor coverage and quality. The market is well-served.
          </div>
        </div>
      )}

      {/* Map Modal */}
      {showMap && selectedCorridor && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '1200px',
            height: '80vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '2px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 'bold' }}>
                  {selectedCorridor.corridor_name}
                </h3>
                <div style={{ fontSize: '14px', color: '#3b82f6', fontWeight: '600' }}>
                  📍 {formatCorridorSegment(selectedCorridor)}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowMap(false);
                  setSelectedCorridor(null);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                ✕ Close
              </button>
            </div>

            {/* Map */}
            <div style={{ flex: 1, position: 'relative' }}>
              <MapContainer
                center={[40.0, -95.0]}
                zoom={6}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {/* Center marker for corridor */}
                <Marker position={[40.0, -95.0]}>
                  <Popup>
                    <div style={{ textAlign: 'center' }}>
                      <strong>{selectedCorridor.corridor_name}</strong>
                      <br />
                      {formatCorridorSegment(selectedCorridor)}
                      <br />
                      <br />
                      <strong>Coverage Gaps:</strong> {selectedCorridor.gaps.length}
                      <br />
                      <strong>Vendors:</strong> {selectedCorridor.current_state.vendor_count}
                      <br />
                      <strong>Avg DQI:</strong> {selectedCorridor.current_state.avg_dqi != null ? Number(selectedCorridor.current_state.avg_dqi).toFixed(1) : 'N/A'}
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>

              {/* Gap Summary Overlay */}
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'white',
                padding: '16px',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                maxWidth: '300px',
                zIndex: 1000
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>
                  Coverage Summary
                </h4>
                <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Vendors:</strong> {selectedCorridor.current_state.vendor_count} ({selectedCorridor.current_state.providers})
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Service Types:</strong> {selectedCorridor.current_state.service_type_count}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Total Feeds:</strong> {selectedCorridor.current_state.feed_count}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Avg Quality:</strong> {selectedCorridor.current_state.avg_dqi != null ? Number(selectedCorridor.current_state.avg_dqi).toFixed(1) : 'N/A'}
                  </div>
                  <div>
                    <strong>Identified Gaps:</strong> {selectedCorridor.gaps.length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoverageGapAnalysis;
